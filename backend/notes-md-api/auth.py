"""
Authentication endpoints for notes.md.
Register, login, JWT token management, and current user lookup.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_db
from models import RegisterRequest, LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

# In production, load from environment/file
SECRET_KEY = "notesmd-dev-secret-change-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def create_token(user_id: int, username: str) -> str:
    """Create a JWT token for the given user."""
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Dependency that extracts the current user from the JWT token."""
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]
        )
        return {"id": int(payload["sub"]), "username": payload["username"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    """Register a new user account."""
    if len(req.username) < 3:
        raise HTTPException(
            status_code=400, detail="Username must be at least 3 characters"
        )
    if len(req.password) < 4:
        raise HTTPException(
            status_code=400, detail="Password must be at least 4 characters"
        )

    password_hash = bcrypt.hashpw(
        req.password.encode(), bcrypt.gensalt()
    ).decode()

    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (req.username, password_hash),
        )
        await db.commit()
        user_id = cursor.lastrowid
        token = create_token(user_id, req.username)
        return TokenResponse(
            token=token, user={"id": user_id, "username": req.username}
        )
    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        err_str = str(e)
        if "UNIQUE constraint" in err_str:
            raise HTTPException(
                status_code=409, detail="Username already exists"
            )
        raise HTTPException(
            status_code=500, detail=f"Registration error: {err_str}"
        )
    finally:
        await db.close()


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Authenticate and get a JWT token."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (req.username,),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=401, detail="Invalid username or password"
            )

        if not bcrypt.checkpw(
            req.password.encode(), row["password_hash"].encode()
        ):
            raise HTTPException(
                status_code=401, detail="Invalid username or password"
            )

        token = create_token(row["id"], row["username"])
        return TokenResponse(
            token=token, user={"id": row["id"], "username": row["username"]}
        )
    finally:
        await db.close()


@router.get("/me", response_model=UserResponse)
async def me(user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's info."""
    return UserResponse(user=user)
