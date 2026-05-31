# CEQTSimple — Eisenhower Matrix Task Manager

A full-stack task management tool built on the Eisenhower Matrix (Important/Urgent quadrants). Features LLM-powered task decomposition, time-decay urgency, dark/light themes, and offline-capable progressive web experience.

## Quick Start

### Frontend Only (Zero Dependencies)
```bash
# Open index.html in any browser — no server needed
open index.html
```
All data persists in `localStorage`. Works fully offline.

### Full Stack (Backend + Frontend)
```bash
# 1. Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# 2. Start the backend
python main.py
# Server runs at http://localhost:8000

# 3. Open frontend
open ../index.html
```

Set `DEEPSEEK_API_KEY` environment variable (optional) to enable LLM polish features.

## Features

| Feature | Description |
|---|---|
| **Eisenhower Matrix** | 12 urgency levels × 7 importance levels on an interactive grid |
| **Drag & Drop** | Reposition tasks on the matrix, urgency/importance update automatically |
| **Time-Decay Refresh** | Tasks with deadlines auto-adjust urgency as time passes |
| **LLM Polish (✨)** | DeepSeek API decomposes tasks into atomic subtasks with metadata |
| **Subtasks** | Checklist per task with progress rings on matrix dots |
| **Search & Filter** | Real-time search across titles, descriptions, and notes; category filters |
| **Multiple Views** | Matrix view, List view (sortable table), Profile view (stats + charts) |
| **Dark/Light Theme** | System-persisted theme toggle |
| **User Accounts** | Email + password registration, JWT authentication (backend mode) |
| **Offline Fallback** | Frontend works fully offline with `localStorage` when backend is unavailable |
| **Reminders** | Browser notifications with auto-computed reminder time (deadline - 30min) |
| **Keyboard Shortcuts** | Full keyboard navigation: `Ctrl+N` new task, `Ctrl+K` search, `1/2/3` views, `?` help |

## Architecture

```
CEQTSimple/
├── index.html          # HTML shell (zero-build)
├── styles.css          # Dark/light theme, responsive
├── app.js              # UI logic: matrix, modals, views, Chart.js
├── data.js             # State management + API client + offline fallback
├── favicon.ico
├── backend/
│   ├── main.py         # FastAPI app factory (lifespan, CORS, health)
│   ├── config.py       # pydantic-settings (env vars)
│   ├── requirements.txt
│   ├── database/
│   │   └── sqlite.py   # SQLite connection, schema (users, tasks, subtasks)
│   ├── routers/
│   │   ├── auth.py     # Register, login, JWT, bcrypt
│   │   ├── tasks.py    # Task CRUD, time-decay refresh, migration
│   │   ├── polish.py   # DeepSeek LLM polish endpoint
│   │   └── config.py   # API key + model management
│   ├── audit/
│   │   └── jsonl_writer.py  # Append-only JSONL audit logs
│   ├── logging_config/
│   │   └── loguru_setup.py  # loguru: console + rotating file + JSONL
│   └── plugins/
│       ├── base.py     # AbstractPlugin ABC
│       └── registry.py # PluginRegistry (factory pattern)
└── data/               # Runtime data (gitignored)
    ├── ceqt.db         # SQLite database
    ├── audit/          # JSONL audit files
    └── logs/           # Loguru log files
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (custom properties), vanilla JavaScript |
| **Charts** | Chart.js 4.x (CDN) |
| **Backend** | Python 3.10+, FastAPI, uvicorn |
| **Database** | SQLite (WAL mode, foreign keys) |
| **Audit** | JSONL (append-only, thread-safe) |
| **Auth** | bcrypt + JWT (HS256, 7-day expiry) |
| **LLM** | DeepSeek API (deepseek-v4-flash / v4-pro) |
| **Logging** | loguru (console + rotating file + structured JSONL) |

## Data Model

```js
{
  id: string,              // UUID
  title: string,
  description: string,
  category: "work" | "personal" | "study" | "health" | "family" | "other",
  importance: 1–7,         // 7 = highest
  urgency: 0–12,           // 0=1年 … 12=15min
  deadline: ISO datetime,  // drives time-decay
  subtasks: [{id, text, done, sort_order}],
  notes: string,
  reminder_at: ISO datetime,  // auto: deadline - 30min
  created_at, updated_at, completed, completed_at
}
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register (email + password ≥ 6 chars) |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `GET` | `/api/auth/me` | Validate token, return user |
| `GET` | `/api/tasks` | List tasks (?category=&completed=) |
| `POST` | `/api/tasks` | Create task |
| `GET` | `/api/tasks/{id}` | Get task |
| `PUT` | `/api/tasks/{id}` | Update task |
| `DELETE` | `/api/tasks/{id}` | Delete task |
| `POST` | `/api/tasks/{id}/complete` | Mark complete |
| `POST` | `/api/tasks/refresh` | Recalculate urgencies (time-decay) |
| `POST` | `/api/tasks/migrate` | Import localStorage tasks |
| `POST` | `/api/polish` | LLM task decomposition (DeepSeek) |
| `POST` | `/api/config/apikey` | Set DeepSeek API key |
| `POST` | `/api/config/test-connection` | Test API key |
| `POST` | `/api/config/model` | Set model (v4-flash / v4-pro) |
| `GET` | `/api/config/apikey-status` | Check API key status |
| `GET` | `/api/health` | Health check |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Esc` | Close modals/menus |
| `Ctrl + N` | New task at matrix center |
| `Ctrl + K` | Focus search bar |
| `Ctrl + F` | Focus filter chips |
| `1` | Matrix view |
| `2` | List view |
| `3` | Profile view |
| `?` | Help overlay |

## Constraints

- **No build step** for frontend. Open `index.html` directly.
- **No framework** on frontend. Vanilla JS with `window.CEQT` namespace.
- **No ES modules**. Plain `<script>` tags, dependency order: `data.js` → `app.js`.
- **Backend requires Python 3.10+**. Uses `pip` for dependencies.
- **Chart.js from CDN**. Version pinned in `index.html` `<script>` tag.

## License

MIT
