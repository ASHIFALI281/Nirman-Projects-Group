from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from core import (client_ip, clear_auth_cookies, db, decode_token, get_current_admin, hash_password, oid,
                  set_auth_cookies, utcnow, verify_password, check_origin)
from models import AdminOut, ChangePasswordIn, LoginIn
from security import log_event, mask_email

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_ATTEMPTS = 5
MAX_EMAIL_ATTEMPTS = 20
LOCKOUT = timedelta(minutes=15)


def _locked(attempt) -> bool:
    return bool(attempt and attempt.get("locked_until") and attempt["locked_until"].replace(tzinfo=utcnow().tzinfo) > utcnow())


async def _record_failure(identifier: str, attempt, limit: int) -> bool:
    count = (attempt or {}).get("count", 0) + 1
    update = {"count": count, "updated_at": utcnow()}
    if count >= limit:
        update = {"count": 0, "locked_until": utcnow() + LOCKOUT, "updated_at": utcnow()}
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
    return count >= limit


def admin_out(user: dict) -> AdminOut:
    return AdminOut(id=user["_id"], email=user["email"], name=user.get("name", "Admin"), role=user["role"])


@router.post("/login", response_model=AdminOut)
async def login(payload: LoginIn, request: Request, response: Response):
    check_origin(request)
    email = payload.email.lower()
    identifier = f"{client_ip(request)}:{email}"
    email_key = f"email:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    email_attempt = await db.login_attempts.find_one({"identifier": email_key})
    ip = client_ip(request)
    if _locked(attempt) or _locked(email_attempt):
        await log_event("login_blocked", "warning", ip=ip, email=mask_email(email))
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    user = await db.admin_users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        locked = await _record_failure(identifier, attempt, MAX_ATTEMPTS)
        locked = await _record_failure(email_key, email_attempt, MAX_EMAIL_ATTEMPTS) or locked
        await log_event("login_failed", "warning", ip=ip, email=mask_email(email))
        if locked:
            await log_event("login_locked", "critical", ip=ip, email=mask_email(email), minutes=int(LOCKOUT.total_seconds() // 60))
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_many({"identifier": {"$in": [identifier, email_key]}})
    await db.admin_users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": utcnow()}})
    set_auth_cookies(response, str(user["_id"]), email)
    await log_event("login_success", ip=ip, email=mask_email(email))
    return admin_out(user)


@router.post("/logout")
async def logout(request: Request, response: Response):
    clear_auth_cookies(response)
    await log_event("logout", ip=client_ip(request))
    return {"ok": True}


@router.get("/me", response_model=AdminOut)
async def me(user: dict = Depends(get_current_admin)):
    return admin_out(user)


@router.post("/refresh", response_model=AdminOut)
async def refresh(request: Request, response: Response):
    check_origin(request)
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token, "refresh")
    user = await db.admin_users.find_one({"_id": oid(payload["sub"])})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Not authorised")
    set_auth_cookies(response, str(user["_id"]), user["email"])
    return admin_out(user)


@router.post("/change-password")
async def change_password(payload: ChangePasswordIn, user: dict = Depends(get_current_admin)):
    if not verify_password(payload.current_password, user["password_hash"]):
        await log_event("password_change_failed", "warning", email=mask_email(user["email"]))
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.admin_users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": utcnow()}})
    await log_event("password_changed", "warning", email=mask_email(user["email"]))
    return {"ok": True}
