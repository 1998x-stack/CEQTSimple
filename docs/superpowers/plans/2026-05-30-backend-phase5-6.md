# CEQTSimple Backend System — Implementation Plan (Phases 5-6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended).

**Goal:** Phase 5: DeepSeek LLM polish system. Phase 6: Refresh button, deadline field, API key UI, default values.

---

## Phase 5: LLM Polish System

### Task 1: Create routers/polish.py

**Files:**
- Create: `backend/routers/polish.py`
- Modify: `backend/main.py` (register router)

- [ ] **Step 1: Write polish router**

```python
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
            logger.error(f"DeepSeek API error: {data}")
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
```

- [ ] **Step 2: Register in main.py**

```python
from routers.polish import router as polish_router
app.include_router(polish_router)
```

- [ ] **Step 3: Test polish**

```bash
TOKEN=...  # get token from Phase 2
curl -X POST http://localhost:8000/api/polish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_title":"筹备产品发布会","task_description":"需要在两周内完成场地预定、嘉宾邀请、宣传物料制作"}'
```

---

### Task 2: Add API Key Management Endpoints

**Files:**
- Create: `backend/routers/config.py`

- [ ] **Step 1: Write config router**

```python
"""Config router — API key management."""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from config import settings
from routers.auth import get_current_user

router = APIRouter(prefix="/api/config", tags=["config"])

class ApiKeyRequest(BaseModel):
    key: str

class ModelRequest(BaseModel):
    model: str  # deepseek-v4-flash or deepseek-v4-pro

@router.post("/apikey")
async def set_api_key(body: ApiKeyRequest, user=Depends(get_current_user)):
    settings.deepseek_api_key = body.key
    return {"ok": True}

@router.post("/test-connection")
async def test_connection(user=Depends(get_current_user)):
    if not settings.deepseek_api_key:
        raise HTTPException(400, "未配置 API Key")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.deepseek_api_url,
                headers={"Authorization": f"Bearer {settings.deepseek_api_key}", "Content-Type": "application/json"},
                json={"model": settings.deepseek_default_model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5},
                timeout=10.0,
            )
        return {"ok": True, "model": settings.deepseek_default_model}
    except Exception as e:
        raise HTTPException(503, f"连接失败: {str(e)}")

@router.post("/model")
async def set_model(body: ModelRequest, user=Depends(get_current_user)):
    if body.model not in ("deepseek-v4-flash", "deepseek-v4-pro"):
        raise HTTPException(400, "不支持的模型")
    settings.deepseek_default_model = body.model
    return {"ok": True, "model": body.model}

@router.get("/apikey-status")
async def api_key_status(user=Depends(get_current_user)):
    return {"configured": bool(settings.deepseek_api_key), "model": settings.deepseek_default_model}
```

- [ ] **Step 2: Register in main.py and commit**

```bash
git add backend/ && git commit -m "feat(phase5): LLM polish system + API key management"
```

---

## Phase 6: Enhanced Frontend Features

### Task 3: Add Deadline Field + Default Values to Task Modal

**Files:**
- Modify: `index.html` — add deadline input
- Modify: `app.js` — default values, auto-reminder compute

- [ ] **Step 1: Add deadline input to index.html**

Insert in task modal, between urgency dropdown and subtask list:

```html
<div class="form-group">
  <label for="deadlineInput">截止时间</label>
  <input type="datetime-local" id="deadlineInput">
</div>
```

- [ ] **Step 2: Update default values in app.js**

In `openTaskModal()`:
```js
$('#importanceSlider').value = task ? task.importance : 5;  // was 4
$('#urgencySelect').value = task ? task.urgency : 8;         // was 6
```

Auto-compute reminder on deadline change:
```js
$('#deadlineInput').addEventListener('change', function() {
  const dl = this.value;
  if (dl) {
    const reminderDate = new Date(new Date(dl).getTime() - 30 * 60000);
    $('#reminderTime').value = reminderDate.toISOString().slice(0, 16);
  }
});
```

---

### Task 4: Add Refresh Button to Header

**Files:**
- Modify: `index.html` — add refresh button
- Modify: `app.js` — refresh handler

- [ ] **Step 1: Add refresh button in header**

```html
<button class="theme-toggle" id="refreshBtn" title="刷新任务位置">🔄</button>
```

- [ ] **Step 2: Wire refresh handler in app.js**

```js
dom.refreshBtn = $('#refreshBtn');
dom.refreshBtn.addEventListener('click', async function() {
  dom.refreshBtn.style.animation = 'spin 1s linear infinite';
  try {
    const tasks = await C.refreshTasks();
    renderTasks();
  } catch (e) {
    // Offline: no-op
  } finally {
    dom.refreshBtn.style.animation = '';
  }
});
```

Add refreshTasks to data.js:
```js
async function refreshTasks() {
  if (authToken) {
    const tasks = await apiFetch('/api/tasks/refresh', { method: 'POST' });
    tasks.forEach(t => {
      const idx = state.tasks.findIndex(l => l.id === t.id);
      if (idx !== -1) state.tasks[idx] = t;
    });
    dispatchChange();
    return tasks;
  }
  return getActiveTasks();
}
// Export: window.CEQT.refreshTasks = refreshTasks;
```

---

### Task 5: Add Polish Button + API Key UI

**Files:**
- Modify: `index.html` — polish button in modal
- Modify: `app.js` — polish handler

- [ ] **Step 1: Add polish button to modal**

```html
<button class="btn btn-secondary" id="polishBtn" style="margin-right:auto;">✨ 润色</button>
```

- [ ] **Step 2: Wire polish handler**

```js
$('#polishBtn').addEventListener('click', async function() {
  const title = $('#taskTitle').value.trim();
  if (!title) { alert('请先输入任务标题'); return; }
  $('#polishBtn').textContent = '⏳ 分析中...';
  $('#polishBtn').disabled = true;
  try {
    const res = await apiFetch('/api/polish', {
      method: 'POST',
      body: JSON.stringify({
        task_title: title,
        task_description: $('#taskDesc').value.trim(),
        category: $('#taskCategory').value,
      }),
    });
    tempSubtasks = res.subtasks.map((s, i) => ({
      id: 'ps_' + Date.now() + i,
      text: s.text,
      done: false,
      order: i,
    }));
    renderSubtasksInModal();
    if (res.suggested_importance) $('#importanceSlider').value = res.suggested_importance;
    if (res.suggested_urgency) $('#urgencySelect').value = res.suggested_urgency;
    updateImportanceDisplay();
    updateUrgencyDisplay();
  } catch (e) {
    alert('润色失败: ' + e.message);
  } finally {
    $('#polishBtn').textContent = '✨ 润色';
    $('#polishBtn').disabled = false;
  }
});
```

- [ ] **Step 3: Commit Phases 5-6**

```bash
git add index.html app.js data.js backend/ && git commit -m "feat(phase5-6): Polish button, refresh, deadline, API key UI"
```
