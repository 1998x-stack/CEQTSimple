"""Append-only JSONL audit/log writer."""
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from config import settings


class JsonlWriter:
    """Thread-safe append-only JSONL writer."""
    
    def __init__(self, filename: str):
        self._filepath = Path(settings.audit_dir) / filename
        self._filepath.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
    
    def append(self, data: dict) -> None:
        """Append a JSON object to the file. Thread-safe."""
        data.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        line = json.dumps(data, ensure_ascii=False) + "\n"
        with self._lock:
            with open(self._filepath, "a", encoding="utf-8") as f:
                f.write(line)
    
    def read_tail(self, n: int = 20) -> list[dict]:
        """Read the last n entries."""
        if not self._filepath.exists():
            return []
        with open(self._filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
        return [json.loads(line) for line in lines[-n:]]


# Global audit writers
api_audit = JsonlWriter("api_requests.jsonl")
llm_audit = JsonlWriter("llm_calls.jsonl")
system_audit = JsonlWriter("system_events.jsonl")


def log_api_request(method: str, path: str, user_id: str | None, status: int, duration_ms: float):
    api_audit.append({
        "event": "api_request",
        "method": method,
        "path": path,
        "user_id": user_id,
        "status": status,
        "duration_ms": round(duration_ms, 2),
    })


def log_llm_call(model: str, task_id: str | None, prompt_tokens: int, completion_tokens: int, duration_ms: float, status: str = "success"):
    llm_audit.append({
        "event": "llm_call",
        "model": model,
        "task_id": task_id,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "duration_ms": round(duration_ms, 2),
        "status": status,
    })


def log_system_event(level: str, message: str):
    system_audit.append({
        "event": "system",
        "level": level,
        "message": message,
    })
