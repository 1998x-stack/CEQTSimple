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
