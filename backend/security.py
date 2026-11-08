import logging
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

from core import client_ip, db, utcnow

logger = logging.getLogger("security")

GLOBAL_LIMIT = 240
GLOBAL_WINDOW = 60
_hits: dict[str, deque] = defaultdict(deque)
_last_logged: dict[str, float] = {}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
}


def mask_email(email: str) -> str:
    if "@" not in (email or ""):
        return "***"
    user, domain = email.split("@", 1)
    return f"{user[:1]}***@{domain}"


async def log_event(event: str, severity: str = "info", ip: str = "", **detail) -> None:
    try:
        await db.security_events.insert_one({"event": event, "severity": severity, "ip": ip, "detail": detail, "created_at": utcnow()})
    except Exception as exc:
        logger.error("Could not record security event %s: %s", event, type(exc).__name__)
    log = logger.warning if severity in ("warning", "critical") else logger.info
    log("security_event=%s severity=%s", event, severity)


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    q = _hits[ip]
    while q and q[0] <= now - GLOBAL_WINDOW:
        q.popleft()
    q.append(now)
    if len(_hits) > 20000:
        for k in [k for k, v in _hits.items() if not v or v[-1] <= now - GLOBAL_WINDOW]:
            _hits.pop(k, None)
    return len(q) > GLOBAL_LIMIT


async def security_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api") and not path.startswith("/api/cron/") and request.method != "OPTIONS":
        ip = client_ip(request)
        if _rate_limited(ip):
            if time.monotonic() - _last_logged.get(ip, 0) > GLOBAL_WINDOW:
                _last_logged[ip] = time.monotonic()
                await log_event("rate_limited", "warning", ip=ip, path=path)
            response = JSONResponse(status_code=429, content={"detail": "Too many requests. Please slow down and try again shortly."})
        else:
            response = await call_next(request)
    else:
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            if k == "Content-Security-Policy" and path.startswith(("/docs", "/redoc")):
                continue
        response.headers.setdefault(k, v)
    if path.startswith("/api/admin") or path.startswith("/api/auth"):
        response.headers["Cache-Control"] = "no-store"
    return response
