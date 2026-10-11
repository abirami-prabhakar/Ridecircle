from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User

password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("constant-time-placeholder-password")


def set_session(response, user_id):
    token = jwt.encode({"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, settings.jwt_secret, algorithm="HS256")
    response.set_cookie("ridecircle_session", token, max_age=43200, httponly=True, samesite="lax", secure=settings.cookie_secure)


def current_user(request: Request, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request.cookies.get("ridecircle_session", ""), settings.jwt_secret, algorithms=["HS256"], options={"require": ["sub", "exp"]})
        user = db.get(User, int(payload["sub"]))
        if user is not None:
            return user
    except (jwt.InvalidTokenError, ValueError, TypeError):
        pass
    raise HTTPException(401, "Sign in to continue")
