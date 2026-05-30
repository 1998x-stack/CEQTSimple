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
    model: str


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
            await client.post(
                settings.deepseek_api_url,
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.deepseek_default_model,
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 5,
                },
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
