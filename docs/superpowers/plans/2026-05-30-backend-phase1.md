# CEQTSimple Backend System — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 backend foundation: FastAPI app with SQLite, JSONL audit, loguru logging, and pluggable plugin system.

**Architecture:** FastAPI app factory pattern. SQLite for domain data (users + tasks), append-only JSONL files for audit/logs. Loguru for structured logging (console + rotating file + JSONL sink). AbstractPlugin ABC + PluginRegistry for future extensions.

**Tech Stack:** Python 3.10+, FastAPI 0.115+, uvicorn 0.34+, pydantic-settings 2.7+, bcrypt 4.2+, PyJWT 2.9+, httpx 0.28+, loguru 0.7+, sqlite3 (stdlib)

---

## File Structure (Phase 1)

```
backend/
├── main.py                  # FastAPI app factory
├── config.py                # Settings from env vars
├── requirements.txt         # Python dependencies
├── database/
│   ├── __init__.py
│   └── sqlite.py            # get_db() + init_schema()
├── audit/
│   ├── __init__.py
│   └── jsonl_writer.py      # Append-only JSONL audit
├── logging_config/
│   ├── __init__.py
│   └── loguru_setup.py      # loguru configuration
├── plugins/
│   ├── __init__.py
│   ├── base.py              # AbstractPlugin ABC
│   └── registry.py          # PluginRegistry
├── routers/
│   └── __init__.py          # (empty for now)
└── models/
    └── __init__.py          # (empty for now)
```

---

### Task 1: Create Project Structure and requirements.txt

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/database/__init__.py` (empty)
- Create: `backend/audit/__init__.py` (empty)
- Create: `backend/logging_config/__init__.py` (empty)
- Create: `backend/plugins/__init__.py` (empty)
- Create: `backend/routers/__init__.py` (empty)
- Create: `backend/models/__init__.py` (empty)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p /Users/mx/Desktop/CEQTSimple/backend/{database,audit,logging_config,plugins,routers,models}
touch /Users/mx/Desktop/CEQTSimple/backend/{database,audit,logging_config,plugins,routers,models}/__init__.py
```

- [ ] **Step 2: Write requirements.txt**

```txt
fastapi>=0.115.0,<1.0.0
uvicorn[standard]>=0.34.0,<1.0.0
pydantic>=2.10.0,<3.0.0
pydantic-settings>=2.7.0,<3.0.0
bcrypt>=4.2.0,<5.0.0
PyJWT>=2.9.0,<3.0.0
httpx>=0.28.0,<1.0.0
loguru>=0.7.0,<1.0.0
```

File: `backend/requirements.txt`

- [ ] **Step 3: Verify structure**

```bash
ls -R /Users/mx/Desktop/CEQTSimple/backend/
```
Expected: 8 `__init__.py` files + `requirements.txt`

---

### Task 2: Create config.py — Settings Management

**Files:**
- Create: `backend/config.py`

- [ ] **Step 1: Write config.py**

```python
"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    
    # Database
    database_path: str = str(Path(__file__).parent.parent / "data" / "ceqt.db")
    
    # JWT
    jwt_secret: str = ""  # auto-generated if empty
    jwt_expire_days: int = 7
    
    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_default_model: str = "deepseek-v4-flash"
    deepseek_api_url: str = "https://api.deepseek.com/v1/chat/completions"
    
    # Audit
    audit_dir: str = str(Path(__file__).parent.parent / "data" / "audit")
    
    # Logs
    log_dir: str = str(Path(__file__).parent.parent / "data" / "logs")
    
    # CORS (allow frontend from any origin in dev)
    cors_origins: list[str] = ["*"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
```

- [ ] **Step 2: Verify config loads**

```bash
cd /Users/mx/Desktop/CEQTSimple/backend && python -c "from config import settings; print(settings.database_path)"
```
Expected: prints path ending with `data/ceqt.db`

---

### Task 3: Create database/sqlite.py — SQLite Connection + Schema

**Files:**
- Create: `backend/database/sqlite.py`

- [ ] **Step 1: Write sqlite.py**

```python
"""SQLite database connection and schema initialization."""
import sqlite3
import uuid
from pathlib import Path
from config import settings


def get_connection() -> sqlite3.Connection:
    """Get a new SQLite connection with row factory."""
    db_path = Path(settings.database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def get_db():
    """FastAPI dependency: yields a connection, closes after request."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_schema():
    """Create tables if they don't exist. Called on startup."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id              TEXT PRIMARY KEY,
                email           TEXT UNIQUE NOT NULL,
                password_hash   TEXT NOT NULL,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id              TEXT PRIMARY KEY,
                user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title           TEXT NOT NULL,
                description     TEXT DEFAULT '',
                category        TEXT DEFAULT 'other',
                importance      INTEGER DEFAULT 5,
                urgency         INTEGER DEFAULT 8,
                deadline        TEXT,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
                completed       INTEGER DEFAULT 0,
                completed_at    TEXT,
                notes           TEXT DEFAULT '',
                reminder_at     TEXT,
                polish_data     TEXT
            );

            CREATE TABLE IF NOT EXISTS subtasks (
                id          TEXT PRIMARY KEY,
                task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                text        TEXT NOT NULL,
                done        INTEGER DEFAULT 0,
                sort_order  INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
            CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
        """)
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 2: Test schema initialization**

```bash
cd /Users/mx/Desktop/CEQTSimple/backend && python -c "
from database.sqlite import init_schema, get_connection
init_schema()
conn = get_connection()
tables = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()
print([t['name'] for t in tables])
conn.close()
"
```
Expected: `['users', 'tasks', 'subtasks']`

---

### Task 4: Create audit/jsonl_writer.py — JSONL Audit System

**Files:**
- Create: `backend/audit/jsonl_writer.py`

- [ ] **Step 1: Write jsonl_writer.py**

```python
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
```

- [ ] **Step 2: Test JSONL writer**

```bash
cd /Users/mx/Desktop/CEQTSimple/backend && python -c "
from audit.jsonl_writer import log_api_request, log_system_event
log_api_request('GET', '/api/health', None, 200, 1.5)
log_system_event('INFO', 'Test event')
print('Audit files created in data/audit/')
import os; print(os.listdir('data/audit/') if os.path.exists('data/audit') else 'not found')
"
```

---

### Task 5: Create logging_config/loguru_setup.py — Loguru Configuration

**Files:**
- Create: `backend/logging_config/loguru_setup.py`

- [ ] **Step 1: Write loguru_setup.py**

```python
"""Loguru logging configuration."""
import sys
from pathlib import Path
from loguru import logger
from config import settings


def setup_logging():
    """Configure loguru with console + rotating file + JSONL sinks."""
    logger.remove()  # Remove default handler
    
    log_dir = Path(settings.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Console: colored, INFO+
    logger.add(
        sys.stderr,
        level="INFO",
        colorize=True,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> | {message}",
    )
    
    # Rotating file: DEBUG+, 10MB, keep 7 days
    logger.add(
        str(log_dir / "app.log"),
        level="DEBUG",
        rotation="10 MB",
        retention="7 days",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
    )
    
    # JSONL structured log
    logger.add(
        str(log_dir / "structured.jsonl"),
        level="INFO",
        serialize=True,
        rotation="10 MB",
        retention="30 days",
    )
    
    logger.info("Logging initialized")
    return logger
```

- [ ] **Step 2: Test logging**

```bash
cd /Users/mx/Desktop/CEQTSimple/backend && python -c "
from logging_config.loguru_setup import setup_logging
logger = setup_logging()
logger.info('Test info message')
logger.debug('Test debug message')
logger.warning('Test warning')
print('Check data/logs/ for log files')
"
```

---

### Task 6: Create plugins system (base.py + registry.py)

**Files:**
- Create: `backend/plugins/base.py`
- Create: `backend/plugins/registry.py`

- [ ] **Step 1: Write plugins/base.py**

```python
"""Abstract base class for plugins."""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI


class AbstractPlugin(ABC):
    """All plugins must implement this interface."""
    
    name: str = "unnamed"
    version: str = "0.1.0"
    
    @abstractmethod
    async def on_startup(self, app: "FastAPI") -> None:
        """Called when FastAPI app starts. Register routes, init resources."""
        ...
    
    @abstractmethod
    async def on_shutdown(self, app: "FastAPI") -> None:
        """Called when FastAPI app shuts down. Cleanup resources."""
        ...
```

- [ ] **Step 2: Write plugins/registry.py**

```python
"""Plugin registry for discovering and managing plugins."""
from typing import TYPE_CHECKING
from loguru import logger

if TYPE_CHECKING:
    from fastapi import FastAPI
    from plugins.base import AbstractPlugin


class PluginRegistry:
    """Manages plugin lifecycle."""
    
    def __init__(self):
        self._plugins: dict[str, "AbstractPlugin"] = {}
    
    def register(self, plugin: "AbstractPlugin") -> None:
        """Register a plugin instance."""
        if plugin.name in self._plugins:
            logger.warning(f"Plugin '{plugin.name}' already registered, overwriting")
        self._plugins[plugin.name] = plugin
        logger.info(f"Plugin registered: {plugin.name} v{plugin.version}")
    
    def get(self, name: str) -> "AbstractPlugin | None":
        """Get a plugin by name."""
        return self._plugins.get(name)
    
    def list_plugins(self) -> list[str]:
        """List registered plugin names."""
        return list(self._plugins.keys())
    
    async def activate_all(self, app: "FastAPI") -> None:
        """Call on_startup on all registered plugins."""
        for name, plugin in self._plugins.items():
            logger.info(f"Activating plugin: {name}")
            await plugin.on_startup(app)
    
    async def deactivate_all(self, app: "FastAPI") -> None:
        """Call on_shutdown on all registered plugins."""
        for name, plugin in self._plugins.items():
            logger.info(f"Deactivating plugin: {name}")
            await plugin.on_shutdown(app)


# Global registry instance
plugin_registry = PluginRegistry()
```

- [ ] **Step 3: Verify plugin system**

```bash
cd /Users/mx/Desktop/CEQTSimple/backend && python -c "
from plugins.base import AbstractPlugin
from plugins.registry import plugin_registry

class TestPlugin(AbstractPlugin):
    name = 'test'
    version = '0.1.0'
    async def on_startup(self, app): print('started')
    async def on_shutdown(self, app): print('stopped')

plugin_registry.register(TestPlugin())
print('Registered:', plugin_registry.list_plugins())
"
```
Expected: `Registered: ['test']`

---

### Task 7: Create main.py — FastAPI App Factory

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Write main.py**

```python
"""FastAPI application entry point."""
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.sqlite import init_schema
from logging_config.loguru_setup import setup_logging
from audit.jsonl_writer import log_system_event
from plugins.registry import plugin_registry

# Initialize logging first
logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # Startup
    logger.info("Starting CEQTSimple backend...")
    
    # Ensure data directories exist
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.audit_dir).mkdir(parents=True, exist_ok=True)
    
    # Auto-generate JWT secret if not provided
    if not settings.jwt_secret:
        settings.jwt_secret = uuid.uuid4().hex
        logger.warning("JWT_SECRET not set, generated random secret")
    
    # Initialize database
    init_schema()
    logger.info("Database initialized")
    
    # Activate plugins
    await plugin_registry.activate_all(app)
    
    log_system_event("INFO", "Backend started")
    logger.info("Backend ready on http://{}:{}", settings.host, settings.port)
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await plugin_registry.deactivate_all(app)
    log_system_event("INFO", "Backend stopped")
    logger.info("Backend stopped")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="CEQTSimple API",
        version="0.1.0",
        lifespan=lifespan,
    )
    
    # CORS — allow frontend from any origin in dev
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Health check
    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "version": "0.1.0"}
    
    return app


# App instance for uvicorn
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
```

- [ ] **Step 2: Start the server**

```bash
cd /Users/mx/Desktop/CEQTSimple/backend
pip install -r requirements.txt
python main.py
```

Open browser to `http://localhost:8000/api/health` — Expected: `{"status":"ok","version":"0.1.0"}`

- [ ] **Step 3: Verify logs and audit files exist**

```bash
ls /Users/mx/Desktop/CEQTSimple/data/logs/
ls /Users/mx/Desktop/CEQTSimple/data/audit/
```

- [ ] **Step 4: Commit Phase 1**

```bash
git add backend/ data/ && git commit -m "feat(phase1): FastAPI backend foundation - SQLite, JSONL audit, loguru, plugins"
```

---

## Phase 1 Complete — Verification Checklist

- [ ] `GET /api/health` returns 200
- [ ] `data/ceqt.db` exists with 3 tables (users, tasks, subtasks)
- [ ] `data/logs/app.log` has startup messages
- [ ] `data/audit/system_events.jsonl` has startup event
- [ ] Plugin registry works (test plugin registers)
- [ ] Server starts without errors
