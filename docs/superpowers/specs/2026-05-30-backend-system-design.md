# CEQTSimple Backend System — Multi-Phase Design Spec

**Date**: 2026-05-30
**Status**: Draft

## Summary

Add a Python (FastAPI) backend to the existing CEQTSimple frontend, replacing localStorage with SQLite persistence, adding user authentication (email/password), LLM-powered task decomposition (DeepSeek), time-decay urgency recalculation, and a pluggable module architecture for future extensions (e.g., Notion import).

## Architecture Overview

```
Browser (file:// or localhost)
  ├── frontend/ (existing: index.html, app.js, data.js, styles.css)
  │     └── data.js becomes API client (fetch → localhost:8000)
  │
  └── backend/ (new: FastAPI on localhost:8000)
        ├── routers/auth.py        # Register, login, JWT
        ├── routers/tasks.py       # Task CRUD, refresh, polish
        ├── routers/config.py      # API key management
        ├── database/sqlite.py     # SQLite connection + schema
        ├── audit/jsonl_writer.py  # Append-only audit logs
        ├── logging/loguru_setup.py
        ├── plugins/               # Pluggable extension system
        └── models/                # Pydantic schemas
```

**Key decisions:**
- Backend: FastAPI + uvicorn
- Database: SQLite for domain data, JSONL for audit/logs
- Auth: Email + password, bcrypt, JWT (7-day expiry)
- LLM: DeepSeek API (`deepseek-v4-flash` default, `deepseek-v4-pro` optional)
- Plugin system: AbstractPlugin base class + PluginRegistry (factory pattern)
- Offline fallback: Frontend falls back to localStorage if backend unreachable

---

## Phase 1: Backend Foundation

### 1.1 Project Structure
```
backend/
├── main.py                 # App factory: creates FastAPI, plugs in routers, starts plugins
├── config.py               # Settings from env vars (pydantic-settings)
├── database/
│   ├── sqlite.py            # get_db() dependency, init_schema()
│   └── migrations/          # Schema migration .sql files
├── audit/
│   └── jsonl_writer.py      # JsonlWriter class: append events atomically
├── logging/
│   └── loguru_setup.py      # setup_logging(): console + rotating file + JSONL sink
├── plugins/
│   ├── base.py              # AbstractPlugin ABC
│   └── registry.py          # PluginRegistry: register, get, activate_all
├── routers/                 # (populated in later phases)
├── models/                  # (Pydantic models)
└── requirements.txt
```

### 1.2 SQLite Schema
```sql
CREATE TABLE users (
    id          TEXT PRIMARY KEY,           -- UUID4
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,            -- bcrypt
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
    id              TEXT PRIMARY KEY,        -- UUID4
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    category        TEXT DEFAULT 'other',    -- work|personal|study|health|family|other
    importance      INTEGER DEFAULT 5,       -- 1-7, default 5
    urgency         INTEGER DEFAULT 8,       -- 0-12, default 8 (=4 hours)
    deadline        TEXT,                    -- ISO datetime (NEW)
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed       INTEGER DEFAULT 0,
    completed_at    TEXT,
    notes           TEXT DEFAULT '',
    reminder_at     TEXT,
    polish_data     TEXT                     -- JSON: LLM polish results
);

CREATE TABLE subtasks (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    done        INTEGER DEFAULT 0,
    sort_order  INTEGER DEFAULT 0
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);
```

### 1.3 JSONL Audit System
Append-only files in `data/audit/`. One JSON object per line.

**Files:**
- `api_requests.jsonl` — all REST API calls (method, path, user_id, status, duration_ms)
- `llm_calls.jsonl` — DeepSeek API interactions (model, task_id, tokens, duration)
- `system_events.jsonl` — startup, shutdown, errors, warnings

**Format example:**
```json
{"timestamp":"2026-05-30T10:00:00.000Z","event":"api_request","method":"POST","path":"/api/tasks","user_id":"abc123","status":201,"duration_ms":45}
{"timestamp":"2026-05-30T10:00:01.500Z","event":"llm_call","model":"deepseek-v4-flash","task_id":"def456","prompt_tokens":150,"completion_tokens":200,"duration_ms":1200,"status":"success"}
```

### 1.4 Loguru Configuration
- Console: colored, INFO+ level
- Rotating file (`data/logs/app.log`): DEBUG+, 10MB rotation, 7-day retention
- JSONL sink (`data/logs/structured.jsonl`): INFO+, machine-readable

### 1.5 Plugin System
```python
class AbstractPlugin(ABC):
    name: str
    version: str
    async def on_startup(self, app: FastAPI) -> None: ...
    async def on_shutdown(self, app: FastAPI) -> None: ...

class PluginRegistry:
    def register(self, plugin: AbstractPlugin) -> None: ...
    def get(self, name: str) -> AbstractPlugin | None: ...
    async def activate_all(self, app: FastAPI) -> None: ...
```

### 1.6 Tech Stack
| Library | Version | Purpose |
|---|---|---|
| fastapi | 0.115+ | Web framework |
| uvicorn | 0.34+ | ASGI server |
| pydantic | 2.10+ | Validation |
| pydantic-settings | 2.7+ | Env config |
| bcrypt | 4.2+ | Password hashing |
| PyJWT | 2.9+ | JWT tokens |
| httpx | 0.28+ | Async HTTP client (DeepSeek) |
| loguru | 0.7+ | Logging |
| uuid (stdlib) | — | UUID generation |
| sqlite3 (stdlib) | — | Database |

### 1.7 Startup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Phase 2: Auth System

### 2.1 Registration
```
POST /api/auth/register
  Body: { "email": "user@example.com", "password": "secure123" }
  Validates: email format (regex), password ≥ 6 chars
  Checks: email uniqueness in SQLite
  Hashes: bcrypt (12 rounds)
  Returns: { "token": "eyJ...", "user": { "id": "uuid", "email": "..." } }
  Errors: 409 (email already exists), 422 (validation)
```

### 2.2 Login
```
POST /api/auth/login
  Body: { "email": "user@example.com", "password": "secure123" }
  Looks up user by email → verifies bcrypt hash
  Returns: { "token": "eyJ...", "user": { "id": "uuid", "email": "..." } }
  Errors: 401 (invalid credentials)
```

### 2.3 JWT Token
- Payload: `{ "sub": user_id, "email": email, "exp": now + 7 days }`
- Algorithm: HS256
- Secret: from `JWT_SECRET` env var, auto-generated UUID4 if not set
- Stored in frontend `localStorage` key `ceqt_token`

### 2.4 Auth Middleware
```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db = Depends(get_db)
) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user = db.execute("SELECT * FROM users WHERE id=?", (payload["sub"],)).fetchone()
    if not user: raise HTTPException(401, "Invalid token")
    return dict(user)
```
All `/api/tasks/*` endpoints require `Depends(get_current_user)`.

### 2.5 Token Refresh (optional)
```
GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Returns: { "user": { "id", "email", "created_at" } }
  Used by frontend on page load to validate stored token
```

---

## Phase 3: Task API

### 3.1 Extended Task Model

New fields beyond current frontend model:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `deadline` | ISO datetime | null | Target completion time. Drives time-decay urgency. |
| `polish_data` | JSON string | null | LLM polish results (subtasks, suggestions) |
| `user_id` | UUID | from JWT | Task owner (multi-user) |

Default value changes:
- `importance` default: **5** (was 4)
- `urgency` default: **8** (=4 hours, was 6=1 day)
- `reminder_at`: auto-computed as `deadline - 30 minutes` (user-adjustable)

### 3.2 Time-Decay Urgency Formula

```
urgency = map_to_urgency(deadline - now)

| Remaining Time | Urgency |
|---|---|
| > 1 year       | 0       |
| 6–12 months    | 1       |
| 3–6 months     | 2       |
| 1–3 months     | 3       |
| 1 week–1 month | 4       |
| 3 days–1 week  | 5       |
| 1–3 days       | 6       |
| 10–24 hours    | 7       |
| 4–10 hours     | 8       |
| 2–4 hours      | 9       |
| 1–2 hours      | 10      |
| 30 min–1 hour  | 11      |
| < 30 minutes   | 12      |
```

Tasks without a `deadline` keep their manually-set urgency.

### 3.3 REST Endpoints

```
GET    /api/tasks              # List user's tasks. Query: ?category=work&completed=false
POST   /api/tasks              # Create task
GET    /api/tasks/{id}         # Get single task
PUT    /api/tasks/{id}         # Update task (partial — only send changed fields)
DELETE /api/tasks/{id}         # Delete task + subtasks (CASCADE)
POST   /api/tasks/{id}/complete  # Mark complete (sets completed_at)
POST   /api/tasks/refresh      # Recalculate all urgencies via time-decay
```

All endpoints require `Authorization: Bearer <token>`.

### 3.4 Response Format (single task)
```json
{
  "id": "abc-123",
  "user_id": "usr-456",
  "title": "完成项目报告",
  "description": "准备季度总结报告",
  "category": "work",
  "importance": 5,
  "urgency": 8,
  "deadline": "2026-06-01T18:00:00Z",
  "created_at": "2026-05-30T10:00:00Z",
  "updated_at": "2026-05-30T10:30:00Z",
  "completed": false,
  "completed_at": null,
  "notes": "",
  "reminder_at": "2026-06-01T17:30:00Z",
  "polish_data": null,
  "subtasks": [
    { "id": "sub-1", "text": "收集数据", "done": true, "sort_order": 0 },
    { "id": "sub-2", "text": "分析报告", "done": false, "sort_order": 1 }
  ]
}
```

### 3.5 Data Migration
On first login after backend activation, frontend detects existing localStorage tasks and offers migration:
```
POST /api/tasks/migrate
  Body: { "tasks": [...] }  # Array of localStorage task objects
  → Maps old fields to new model, adds UUIDs
  → Returns: { "migrated": 8, "failed": 0 }
```

---

## Phase 4: Frontend Auth + API Integration

### 4.1 Login/Register Modal
- Replaces current workspace selector modal
- Two tabs: "登录" (Login) / "注册" (Register)
- Login fields: email, password
- Register fields: email, password (no confirm, no captcha)
- On success: stores JWT → `localStorage.setItem('ceqt_token', token)`, shows main UI
- On error: inline error message below form
- Auto-login: on page load, if `ceqt_token` exists, calls `GET /api/auth/me` to validate

### 4.2 API Client Layer (data.js rewrite)

```javascript
const API_BASE = 'http://localhost:8000/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('ceqt_token');
  try {
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (res.status === 401) {
      localStorage.removeItem('ceqt_token');
      window.dispatchEvent(new CustomEvent('auth-expired'));
      throw new Error('Unauthorized');
    }
    return res.json();
  } catch (e) {
    if (e.message === 'Failed to fetch') {
      // Backend unreachable — fallback to localStorage mode
      return fallbackLocalStorage(path, options);
    }
    throw e;
  }
}
```

### 4.3 Offline Fallback
If backend is unreachable:
- Show yellow banner: "无法连接服务器，使用离线模式"
- `data.js` falls back to existing localStorage CRUD
- Data syncs to backend on next successful connection

### 4.4 Migration on First Login
On first successful login after backend introduction:
1. Check `localStorage` for existing tasks (old keys: `tasks_<username>`)
2. If tasks exist, show dialog: "发现本地任务，是否迁移到云端？"
3. On confirm: `POST /api/tasks/migrate` with all tasks
4. After migration: clear old localStorage task keys

---

## Phase 5: LLM Polish System

### 5.1 Flow
```
User creates/edits task → clicks "✨ 润色" in modal
  → Frontend POSTs to /api/tasks/{id}/polish
  → Backend constructs system + user prompts
  → Calls DeepSeek API (POST https://api.deepseek.com/v1/chat/completions)
  → Parses response JSON
  → Returns structured subtasks + suggestions
  → Frontend populates subtask list, shows importance/urgency suggestions
  → User can modify before saving
```

### 5.2 API Endpoint
```
POST /api/tasks/{id}/polish
  Headers: Authorization: Bearer <token>
  Body: { "task_title": "...", "task_description": "...", "category": "work" }
  Response: {
    "subtasks": [
      {
        "text": "具体可执行步骤",
        "estimated_importance": 5,
        "estimated_urgency": 6,
        "estimated_duration_minutes": 30
      }
    ],
    "suggested_importance": 5,
    "suggested_urgency": 6,
    "suggested_category": "work",
    "reasoning": "该任务涉及..."
  }
  Errors: 429 (rate limited), 503 (DeepSeek API error)
```

### 5.3 System Prompt
```
你是一个任务分解专家。你的职责是将用户给出的任务描述分解为可独立执行的原子子任务（subtask）。

要求：
1. 每个子任务必须是原子性的——一个人可以在一次不间断的工作会话中完成。
2. 子任务应该按逻辑顺序排列，从前置步骤到最终步骤。
3. 为每个子任务估算：
   - estimated_importance (1-7): 该子任务对整体目标的重要程度，7=最关键
   - estimated_urgency (0-12): 该子任务的时间敏感性，映射如下：
     0=一年内, 1=半年, 2=3个月, 3=1个月, 4=1周, 5=3天, 6=1天,
     7=10小时, 8=4小时, 9=2小时, 10=1小时, 11=30分钟, 12=15分钟
   - estimated_duration_minutes: 预计单人完成时间（分钟）
4. 为整个任务建议：
   - suitable category: 从 [work, personal, study, health, family, other] 中选择
   - suggested_importance (1-7)
   - suggested_urgency (0-12)
5. 用中文输出子任务文本。

输出必须是有效的 JSON 格式，不要包含 markdown 代码块标记（不要输出 ```json）。
```

### 5.4 User Prompt Template
```
请将以下任务分解为原子子任务：

任务标题：{task_title}
任务描述：{task_description}

当前上下文：
- 任务分类：{category_name}
- 该任务还有其他 {existing_subtask_count} 个未完成的子任务待处理。

请输出 JSON。
```

### 5.5 DeepSeek API Call
```python
async def call_deepseek(system_prompt: str, user_prompt: str, model: str = "deepseek-v4-flash"):
    response = await httpx.AsyncClient().post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.deepseek_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
        },
        timeout=30.0,
    )
    # Log to JSONL audit
    audit.log_llm_call(model, task_id, request, response)
    return response.json()
```

### 5.6 API Key Management
- **Auto-detect**: On startup, check `DEEPSEEK_API_KEY` env var
- **If missing**: Frontend shows API key input field in header dropdown menu
- **Set key**: `POST /api/config/apikey` — stores in server memory for session (not persisted to disk for security)
- **Test connection**: `POST /api/config/test-connection` — sends minimal ping to DeepSeek, returns `{ "ok": true, "model": "deepseek-v4-flash" }` or error
- **Model selector**: Dropdown in header: `deepseek-v4-flash` (default) / `deepseek-v4-pro`
- **Persist model preference**: `POST /api/config/model` updates server-side model preference

### 5.7 Rate Limiting & Error Handling
- 3 polish requests per minute per user (429 if exceeded)
- 30-second timeout on DeepSeek calls
- Polish failures: return 503 with user-friendly error message
- JSON parse failures from DeepSeek: retry once, then return error
- All LLM interactions logged to `data/audit/llm_calls.jsonl`

---

## Phase 6: Enhanced Frontend Features

### 6.1 Refresh Button (右上角 🔄)
- Position: header right, next to theme toggle
- Calls `POST /api/tasks/refresh`
- Applies time-decay formula to all tasks with deadlines
- Animated spin during API call
- After response: re-renders all task dots on matrix
- If backend unavailable: skips (offline mode)

### 6.2 Deadline Field in Task Modal
- New input: `<input type="datetime-local" id="deadlineInput">`
- Position: between urgency dropdown and reminder time
- Auto-compute: when deadline changes, set `reminder_at = deadline - 30 minutes`
- Reminder time remains manually adjustable (overrides auto-compute)

### 6.3 API Key Management UI
- Header dropdown (click profile badge or gear icon)
- If `DEEPSEEK_API_KEY` env var detected: shows "API Key 已配置 ✅"
- If not detected: shows masked password input + "Test Connection" button
- Model selector: radio or dropdown (v4-flash / v4-pro)
- Test Connection button: green ✅ or red ❌ indicator after test

### 6.4 Default Value Changes
- `importanceSlider.value` default: **5** (was 4)
- `urgencySelect.value` default: **8** (4小时, was 5/3天)
- Add task modal pre-fills these defaults
- Manual drag still overrides these values

### 6.5 Polish Button
- Button: "✨ 润色" in task modal button group (next to "保存" and "取消")
- Behavior:
  1. Collects title + description → calls `/api/tasks/{id}/polish`
  2. Shows loading spinner ("正在分析任务...")
  3. On success: fills subtask list, updates importance/urgency sliders with suggestions
  4. User can review, modify, then click "保存"
- Disabled state: if no API key configured (shows tooltip "请先配置 DeepSeek API Key")
- Error state: toast notification "润色失败，请重试"

### 6.6 Auth States
- **Logged out**: Login/Register modal visible, header hidden
- **Token expired**: 401 response triggers modal, clears token
- **Backend down**: Yellow banner, localStorage fallback mode active

---

## Phase Dependencies

```
Phase 1 (Foundation) ──required──→ Phase 2 (Auth)
                                       │
Phase 1 (Foundation) ──required──→ Phase 3 (Task API)
                                       │
                          Phase 2 + 3 ──required──→ Phase 4 (Frontend Auth + API)
                                                       │
                          Phase 3 ──────────required──→ Phase 5 (LLM Polish)
                                                       │
                          Phase 4 + 5 ──required──→ Phase 6 (Enhanced Frontend)
```

**Parallelizable**: Phase 2 and Phase 3 can be developed simultaneously after Phase 1.

---

## Future Extension Points (Factory Pattern)

The plugin system (`backend/plugins/`) is designed for:
- **Notion Import Plugin**: `plugins/notion_import.py` — implements `AbstractPlugin`, adds `/api/notion/import` route
- **Calendar Sync Plugin**: iCal export, Google Calendar integration
- **Email Reminders Plugin**: SMTP-based email notifications as fallback for browser notifications
- **Export Plugins**: CSV, PDF, Markdown export of task lists

Each plugin self-registers:
```python
# plugins/notion_import.py
class NotionImportPlugin(AbstractPlugin):
    name = "notion_import"
    version = "0.1.0"
    
    async def on_startup(self, app):
        app.include_router(notion_router, prefix="/api/notion")
    
    async def on_shutdown(self, app): ...

# Auto-discovered and registered via PluginRegistry
```

---

## Constraints
- **No build step for frontend.** Only backend uses pip/venv.
- **Backend runs locally** — `localhost:8000`. No deployment config needed yet.
- **No external auth services** — email/password only, no OAuth, no email verification.
- **Chinese UI** — all labels, error messages, prompts in zh-CN.
- **Backward compatible** — old localStorage data migrates to backend.
- **Offline capable** — frontend falls back to localStorage if backend unreachable.

---

## Grilling Resolutions (2026-05-30)

| # | Topic | Resolution |
|---|---|---|
| Q1 | "Workspace" vs "User Account" | Workspace concept retired. CONTEXT.md updated to "User Account." Login/Register modal replaces workspace selector. |
| Q2 | Time-decay label imprecision | Mapping kept as-is. Accept label fuzziness at extreme urgency levels. |
| Q3 | Polish endpoint requires task_id | Changed to `POST /api/polish` (no task_id). Pure LLM call, no DB side-effect. Task context optional. |
| Q4 | `polish_data` duplicates subtasks | Narrowed to metadata only (model, reasoning, suggestions). Actual subtasks stored in subtasks table. |
| Q5 | Offline sync conflict resolution | Last-write-wins via `updated_at` timestamp comparison on reconnect. |
| Q6 | Migration user association | Backend assigns `user_id` from JWT, generates new UUIDs for task IDs. |
| Q7 | SQLite boolean conversion | Keep `INTEGER` in DB. Pydantic validators handle 0/1 ↔ false/true conversion in API. |

### Spec Fixes Applied

**Polish endpoint** (Phase 5.2): Changed from `POST /api/tasks/{id}/polish` to `POST /api/polish`:
```
POST /api/polish
  Body: { "task_title": "...", "task_description": "...", "category": "work" }
  Response: { "subtasks": [...], "suggested_importance": 5, ... }
```

**`polish_data` field** (Phase 1.2): Stores metadata only:
```json
{
  "model": "deepseek-v4-flash",
  "reasoning": "...",
  "suggested_importance": 5,
  "suggested_urgency": 6,
  "suggested_category": "work",
  "polished_at": "2026-05-30T10:00:00Z"
}
```

**Migration** (Phase 3.5): Backend assigns `user_id` from JWT, generates new UUIDs for task/subtask IDs. All other fields preserved.

**Boolean fields** (Phase 1.2): `tasks.completed` and `subtasks.done` stored as `INTEGER` (0/1) in SQLite. Pydantic response models convert to `bool` in API responses.
