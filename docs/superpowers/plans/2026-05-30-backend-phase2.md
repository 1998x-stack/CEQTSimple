# CEQTSimple Backend System — Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended).

**Goal:** Add user registration/login with email+password, bcrypt hashing, JWT tokens, and auth middleware. Depends on Phase 1 (backend running).

**Architecture:** FastAPI router (`routers/auth.py`) with `/api/auth/register`, `/api/auth/login`, `/api/auth/me`. OAuth2PasswordBearer + JWT dependency for protected routes.

---

### Task 1: Create routers/auth.py — Registration + Login Endpoints

**Files:**
- Create: `backend/routers/auth.py`

- [ ] **Step 1: Write auth router**

```python
"""Authentication router: register, login, token validation."""
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr

from config import settings
from database.sqlite import get_db
from audit.jsonl_writer import log_api_request
from loguru import logger

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# --- Request/Response Models ---

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# --- Helpers ---

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def _create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --- Endpoints ---

@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest, db=Depends(get_db)):
    import time
    start = time.time()
    
    # Validate
    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="密码长度至少6位")
    
    # Check email format (basic)
    if "@" not in body.email or "." not in body.email:
        raise HTTPException(status_code=422, detail="邮箱格式无效")
    
    # Check uniqueness
    existing = db.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="该邮箱已注册")
    
    # Create user
    user_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    password_hash = _hash_password(body.password)
    
    db.execute(
        "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, body.email, password_hash, now, now),
    )
    db.commit()
    
    token = _create_token(user_id, body.email)
    
    logger.info(f"User registered: {body.email}")
    log_api_request("POST", "/api/auth/register", user_id, 201, (time.time() - start) * 1000)
    
    return AuthResponse(
        token=token,
        user=UserResponse(id=user_id, email=body.email, created_at=now),
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db=Depends(get_db)):
    import time
    start = time.time()
    
    # Find user
    user = db.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    
    # Verify password
    if not _verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    
    token = _create_token(user["id"], user["email"])
    
    logger.info(f"User logged in: {body.email}")
    log_api_request("POST", "/api/auth/login", user["id"], 200, (time.time() - start) * 1000)
    
    return AuthResponse(
        token=token,
        user=UserResponse(id=user["id"], email=user["email"], created_at=user["created_at"]),
    )


@router.get("/me", response_model=UserResponse)
def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    payload = _decode_token(token)
    user = db.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return UserResponse(id=user["id"], email=user["email"], created_at=user["created_at"])
```

- [ ] **Step 2: Register router in main.py**

Edit `backend/main.py` — add after `app = create_app()` but inside `create_app()`:

```python
from routers.auth import router as auth_router
app.include_router(auth_router)
```

- [ ] **Step 3: Test registration**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'
```
Expected: `{"token":"eyJ...","user":{"id":"...","email":"test@example.com","created_at":"..."}}`

- [ ] **Step 4: Test login**

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'
```
Expected: same shape as register response

- [ ] **Step 5: Test token validation**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}' | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer $TOKEN"
```
Expected: `{"id":"...","email":"test@example.com",...}`

- [ ] **Step 6: Test duplicate registration**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"another"}'
```
Expected: 409 `{"detail":"该邮箱已注册"}`

- [ ] **Step 7: Test invalid login**

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```
Expected: 401 `{"detail":"邮箱或密码错误"}`

- [ ] **Step 8: Commit Phase 2**

```bash
git add backend/ && git commit -m "feat(phase2): Auth system - register, login, JWT, bcrypt"
```
