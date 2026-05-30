"""LLM polish router — task decomposition via DeepSeek."""
import json
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from loguru import logger

from routers.auth import get_current_user
from config import settings
from audit.jsonl_writer import log_llm_call

router = APIRouter(prefix="/api", tags=["polish"])

SYSTEM_PROMPT = """你是一个任务分解专家。你的职责是将用户给出的任务描述分解为可独立执行的原子子任务（subtask）。

要求：
1. 每个子任务必须是原子性的——一个人可以在一次不间断的工作会话中完成。
2. 子任务应该按逻辑顺序排列。
3. 为每个子任务估算 estimated_importance (1-7)、estimated_urgency (0-12)、estimated_duration_minutes。
4. 建议 suitable category (work/personal/study/health/family/other)、suggested_importance、suggested_urgency。
5. 用中文输出子任务文本。
6. 输出必须是有效的 JSON 格式，不要包含 markdown 代码块标记。"""


class PolishRequest(BaseModel):
    task_title: str
    task_description: str = ""
    category: str = "other"


class PolishResponse(BaseModel):
    subtasks: list[dict]
    suggested_importance: int
    suggested_urgency: int
    suggested_category: str
    reasoning: str


@router.post("/polish", response_model=PolishResponse)
async def polish_task(body: PolishRequest, user=Depends(get_current_user)):
    if not settings.deepseek_api_key:
        raise HTTPException(503, "DeepSeek API Key 未配置")

    user_prompt = f"""请将以下任务分解为原子子任务：

任务标题：{body.task_title}
任务描述：{body.task_description}
当前分类：{body.category}

请输出 JSON。"""

    t0 = time.time()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.deepseek_api_url,
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.deepseek_default_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
        data = resp.json()
        usage = data.get("usage", {})
        duration_ms = (time.time() - t0) * 1000
        log_llm_call(
            model=settings.deepseek_default_model,
            task_id=None,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            duration_ms=duration_ms,
        )
        if resp.status_code != 200:
            raise HTTPException(503, "润色服务暂时不可用")
        content = data["choices"][0]["message"]["content"]
        result = json.loads(content)
        return PolishResponse(
            subtasks=result.get("subtasks", []),
            suggested_importance=result.get("suggested_importance", 5),
            suggested_urgency=result.get("suggested_urgency", 6),
            suggested_category=result.get("suggested_category", body.category),
            reasoning=result.get("reasoning", ""),
        )
    except json.JSONDecodeError:
        raise HTTPException(503, "润色结果解析失败，请重试")
    except httpx.TimeoutException:
        raise HTTPException(503, "润色服务超时，请重试")
