import os
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
from urllib.parse import urlparse

import bcrypt
import jwt
from bson import ObjectId
from fastapi import HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import AliasChoices, BaseModel, BeforeValidator, ConfigDict, Field

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
TRUSTED_PROXY_HOPS = int(os.environ["TRUSTED_PROXY_HOPS"])
ACCESS_TTL = timedelta(minutes=15)
REFRESH_TTL = timedelta(days=7)
ALLOWED_ORIGINS = [o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip() and o.strip() != "*"] + [
    os.environ["FRONTEND_URL"],
    "http://localhost:3000",
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: Optional[PyObjectId] = Field(default=None, validation_alias=AliasChoices("_id", "id"))
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(exclude={"id"})
        if self.id:
            data["_id"] = ObjectId(self.id)
        return data


def oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=404, detail="Record not found")
    return ObjectId(value)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        chain = [p.strip() for p in fwd.split(",") if p.strip()]
        idx = max(len(chain) - 1 - TRUSTED_PROXY_HOPS, 0)
        return chain[idx]
    return request.client.host if request.client else "unknown"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str, kind: str, ttl: timedelta, email: str = "") -> str:
    payload = {"sub": user_id, "email": email, "type": kind, "exp": utcnow() + ttl}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def decode_token(token: str, kind: str) -> dict:
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != kind:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


def set_auth_cookies(response: Response, user_id: str, email: str) -> None:
    opts = {"httponly": True, "secure": True, "samesite": "none", "path": "/"}
    response.set_cookie("access_token", create_token(user_id, "access", ACCESS_TTL, email), max_age=int(ACCESS_TTL.total_seconds()), **opts)
    response.set_cookie("refresh_token", create_token(user_id, "refresh", REFRESH_TTL), max_age=int(REFRESH_TTL.total_seconds()), **opts)


def clear_auth_cookies(response: Response) -> None:
    for name in ("access_token", "refresh_token"):
        response.delete_cookie(name, path="/", secure=True, httponly=True, samesite="none")


def check_origin(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    origin = request.headers.get("origin")
    if not origin:
        return
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    if origin in ALLOWED_ORIGINS or urlparse(origin).netloc == host:
        return
    raise HTTPException(status_code=403, detail="Origin not allowed")


async def get_current_admin(request: Request) -> dict:
    check_origin(request)
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token, "access")
    user = await db.admin_users.find_one({"_id": oid(payload["sub"])})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Not authorised")
    return user
