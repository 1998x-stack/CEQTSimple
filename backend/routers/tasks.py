"""Task management router."""
import uuid
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from loguru import logger

from routers.auth import get_current_user, oauth2_scheme
from database.sqlite import get_db
from audit.jsonl_writer import log_api_request

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# Urgency time-decay mapping: (max_seconds, urgency_level)
URGENCY_DECAY = [
    (365*24*3600, 0), (183*24*3600, 1), (91*24*3600, 2),
    (30*24*3600, 3), (7*24*3600, 4), (3*24*3600, 5),
    (24*3600, 6), (10*3600, 7), (4*3600, 8),
    (2*3600, 9), (3600, 10), (1800, 11), (0, 12),
]

def calc_urgency(deadline_str):
    if not deadline_str: return None
    deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
    remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
    for max_sec, urg in URGENCY_DECAY:
        if remaining > max_sec: return urg
    return 12


class SubtaskCreate(BaseModel):
    text: str
    done: bool = False
    sort_order: int = 0

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    category: str = "other"
    importance: int = 5
    urgency: int = 8
    deadline: str | None = None
    notes: str = ""
    reminder_at: str | None = None
    subtasks: list[SubtaskCreate] = []

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    importance: int | None = None
    urgency: int | None = None
    deadline: str | None = None
    notes: str | None = None
    reminder_at: str | None = None

class SubtaskResponse(BaseModel):
    id: str
    text: str
    done: bool
    sort_order: int

class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    category: str
    importance: int
    urgency: int
    deadline: str | None
    created_at: str
    updated_at: str
    completed: bool
    completed_at: str | None
    notes: str
    reminder_at: str | None
    polish_data: dict | None = None
    subtasks: list[SubtaskResponse] = []


def _row_to_task(row) -> dict:
    return {
        "id": row["id"], "user_id": row["user_id"], "title": row["title"],
        "description": row["description"], "category": row["category"],
        "importance": row["importance"], "urgency": row["urgency"],
        "deadline": row["deadline"], "created_at": row["created_at"],
        "updated_at": row["updated_at"], "completed": bool(row["completed"]),
        "completed_at": row["completed_at"], "notes": row["notes"],
        "reminder_at": row["reminder_at"], "polish_data": None, "subtasks": [],
    }

def _load_subtasks(db, task_id):
    rows = db.execute("SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order", (task_id,)).fetchall()
    return [{"id": r["id"], "text": r["text"], "done": bool(r["done"]), "sort_order": r["sort_order"]} for r in rows]


@router.get("", response_model=list[TaskResponse])
def list_tasks(category: str | None = None, completed: bool | None = None,
               user=Depends(get_current_user), db=Depends(get_db)):
    query = "SELECT * FROM tasks WHERE user_id = ?"
    params = [user.id]
    if category:
        query += " AND category = ?"
        params.append(category)
    if completed is not None:
        query += " AND completed = ?"
        params.append(1 if completed else 0)
    query += " ORDER BY created_at DESC"
    rows = db.execute(query, params).fetchall()
    tasks = [_row_to_task(r) for r in rows]
    for t in tasks: t["subtasks"] = _load_subtasks(db, t["id"])
    return tasks


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(body: TaskCreate, user=Depends(get_current_user), db=Depends(get_db)):
    t0 = time.time()
    task_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        """INSERT INTO tasks (id, user_id, title, description, category, importance, urgency, deadline, created_at, updated_at, notes, reminder_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (task_id, user.id, body.title, body.description, body.category,
         body.importance, body.urgency, body.deadline, now, now, body.notes, body.reminder_at))
    for st in body.subtasks:
        db.execute("INSERT INTO subtasks (id, task_id, text, done, sort_order) VALUES (?, ?, ?, ?, ?)",
                   (uuid.uuid4().hex, task_id, st.text, 1 if st.done else 0, st.sort_order))
    db.commit()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    task = _row_to_task(row)
    task["subtasks"] = _load_subtasks(db, task_id)
    logger.info(f"Task created: {body.title}")
    log_api_request("POST", "/api/tasks", user.id, 201, (time.time() - t0) * 1000)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user.id)).fetchone()
    if not row: raise HTTPException(404, "Task not found")
    t = _row_to_task(row)
    t["subtasks"] = _load_subtasks(db, task_id)
    return t


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: str, body: TaskUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user.id)).fetchone()
    if not row: raise HTTPException(404, "Task not found")
    updates = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", list(updates.values()) + [task_id])
        db.commit()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    t = _row_to_task(row)
    t["subtasks"] = _load_subtasks(db, task_id)
    return t


@router.delete("/{task_id}")
def delete_task(task_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ?", (task_id, user.id)).fetchone()
    if not row: raise HTTPException(404, "Task not found")
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return {"ok": True}


@router.post("/{task_id}/complete")
def complete_task(task_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ?", (task_id, user.id)).fetchone()
    if not row: raise HTTPException(404, "Task not found")
    now = datetime.now(timezone.utc).isoformat()
    db.execute("UPDATE tasks SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?", (now, now, task_id))
    db.commit()
    return {"ok": True, "completed_at": now}


@router.post("/refresh", response_model=list[TaskResponse])
def refresh_tasks(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.execute("SELECT * FROM tasks WHERE user_id = ? AND completed = 0", (user.id,)).fetchall()
    updated = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for row in rows:
        if row["deadline"]:
            new_urg = calc_urgency(row["deadline"])
            if new_urg is not None and new_urg != row["urgency"]:
                db.execute("UPDATE tasks SET urgency = ?, updated_at = ? WHERE id = ?", (new_urg, now_iso, row["id"]))
        updated.append(row["id"])
    db.commit()
    tasks = []
    for tid in updated:
        row = db.execute("SELECT * FROM tasks WHERE id = ?", (tid,)).fetchone()
        t = _row_to_task(row)
        t["subtasks"] = _load_subtasks(db, tid)
        tasks.append(t)
    return tasks


@router.post("/migrate")
def migrate_tasks(body: list[dict], user=Depends(get_current_user), db=Depends(get_db)):
    migrated = 0
    for old_task in body:
        task_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            """INSERT INTO tasks (id, user_id, title, description, category, importance, urgency, deadline, created_at, updated_at, completed, completed_at, notes, reminder_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (task_id, user.id, old_task.get("title",""), old_task.get("description",""),
             old_task.get("category","other"), old_task.get("importance",4), old_task.get("urgency",6),
             old_task.get("deadline"), old_task.get("createdAt") or now, old_task.get("updatedAt") or now,
             1 if old_task.get("completed") else 0, old_task.get("completedAt"),
             old_task.get("notes",""), old_task.get("reminderAt")))
        for st in old_task.get("subtasks", []):
            db.execute("INSERT INTO subtasks (id, task_id, text, done, sort_order) VALUES (?, ?, ?, ?, ?)",
                       (uuid.uuid4().hex, task_id, st.get("text",""), 1 if st.get("done") else 0, st.get("order",0)))
        migrated += 1
    db.commit()
    logger.info(f"Migrated {migrated} tasks for user {user.email}")
    return {"migrated": migrated, "failed": 0}
