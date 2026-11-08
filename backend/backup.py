import asyncio
import gzip
import hashlib
import hmac
import logging
import os
import time
from datetime import timedelta
from html import escape

from bson import json_util
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import notification as notifications
import storage
from core import client, client_ip, db, get_current_admin, oid, utcnow, verify_password
from security import log_event

logger = logging.getLogger("backup")

DB_NAME = os.environ["DB_NAME"]
RETENTION_DAYS = int(os.environ["BACKUP_RETENTION_DAYS"])
TEST_DB_NAME = f"{DB_NAME}_restore_test"
EXCLUDED = {"backup_runs", "security_events", "login_attempts", "cron_runs"}
KEEP_ON_RESTORE = {"admin_users"}
FORMAT = "nirmaan-backup-v1"
SCHEDULE_TEXT = "Daily at 02:30 AM India time (IST)"
_lock = asyncio.Lock()

admin = APIRouter(prefix="/admin/security", tags=["admin-security"], dependencies=[Depends(get_current_admin)])
cron = APIRouter(prefix="/cron", tags=["cron"])


def _digest(docs: list) -> str:
    rows = sorted(json_util.dumps(d, sort_keys=True, json_options=json_util.CANONICAL_JSON_OPTIONS) for d in docs)
    return hashlib.sha256("\n".join(rows).encode()).hexdigest()


def _public(run: dict) -> dict:
    keys = ("kind", "trigger", "status", "started_at", "finished_at", "duration_ms", "size_bytes", "checksum", "counts",
            "total_records", "error", "expired", "verified_at", "verify_ok", "verify_message", "restored_at")
    return {"id": str(run["_id"]), **{k: run.get(k) for k in keys}}


async def _collections() -> list[str]:
    return sorted(n for n in await db.list_collection_names() if n not in EXCLUDED and not n.startswith("system."))


async def _alert_failure(error: str, kind: str) -> None:
    try:
        to = await notifications.notification_recipient()
        html = ('<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0B1F3A">'
                f'<p><strong>{escape(notifications.EMAIL_FROM_NAME)}</strong>: a database backup FAILED.</p>'
                f'<p style="font-size:13px">Type: {escape(kind)}<br>Time: {utcnow():%d %b %Y, %H:%M UTC}<br>Reason: {escape(error)}</p>'
                '<p style="font-size:13px;color:#64748b">Open Admin Dashboard, then Backup and Security, and press Back up now to retry.</p></td></tr></table>')
        await notifications.send_email(to=to, subject=f"{notifications.EMAIL_FROM_NAME}: database backup failed", html=html)
    except Exception as exc:
        logger.error("Backup failure alert email not sent: %s", getattr(exc, "detail", type(exc).__name__))


async def apply_retention() -> int:
    cutoff = utcnow() - timedelta(days=RETENTION_DAYS)
    newest = await db.backup_runs.find_one({"status": "success"}, sort=[("started_at", -1)])
    query = {"status": "success", "expired": {"$ne": True}, "started_at": {"$lt": cutoff}}
    if newest:
        query["_id"] = {"$ne": newest["_id"]}
    res = await db.backup_runs.update_many(query, {"$set": {"expired": True, "expired_at": utcnow()}})
    return res.modified_count


async def run_backup(kind: str, trigger: str) -> dict:
    started = time.monotonic()
    run = {"kind": kind, "trigger": trigger, "status": "running", "started_at": utcnow()}
    run["_id"] = (await db.backup_runs.insert_one(run)).inserted_id
    try:
        data, counts = {}, {}
        for name in await _collections():
            docs = await db[name].find({}).to_list(None)
            data[name] = docs
            counts[name] = len(docs)
        payload = {"format": FORMAT, "created_at": run["started_at"], "collections": data,
                   "digests": {n: _digest(d) for n, d in data.items()}}
        raw = gzip.compress(json_util.dumps(payload, json_options=json_util.CANONICAL_JSON_OPTIONS).encode(), compresslevel=6)
        checksum = hashlib.sha256(raw).hexdigest()
        path = f"{storage.APP_NAME}/backups/{run['started_at']:%Y%m%dT%H%M%SZ}-{kind}-{run['_id']}.json.gz"
        result = (await run_in_threadpool(storage._request, "PUT", path, data=raw, headers={"Content-Type": "application/gzip"})).json()
        update = {"status": "success", "storage_path": result["path"], "size_bytes": len(raw), "checksum": checksum,
                  "counts": counts, "total_records": sum(counts.values()), "finished_at": utcnow(),
                  "duration_ms": int((time.monotonic() - started) * 1000)}
        await db.backup_runs.update_one({"_id": run["_id"]}, {"$set": update})
        await log_event("backup_success", kind=kind, records=update["total_records"])
        await apply_retention()
    except Exception as exc:
        error = str(getattr(exc, "detail", "")) or f"{type(exc).__name__}: backup could not be completed"
        if "storage" in type(exc).__module__ or "requests" in type(exc).__module__:
            error = "Backup storage was unreachable"
        await db.backup_runs.update_one({"_id": run["_id"]}, {"$set": {"status": "failed", "error": error[:300], "finished_at": utcnow(),
                                                                         "duration_ms": int((time.monotonic() - started) * 1000)}})
        logger.error("Backup failed (%s): %s", kind, type(exc).__name__)
        await log_event("backup_failed", "critical", kind=kind, error=error[:300])
        await _alert_failure(error[:300], kind)
    return await db.backup_runs.find_one({"_id": run["_id"]})


async def _load(run: dict) -> dict:
    if run.get("status") != "success" or run.get("expired"):
        raise HTTPException(status_code=400, detail="Only successful, non-expired backups can be used")
    try:
        raw = (await run_in_threadpool(storage._request, "GET", run["storage_path"])).content
    except Exception:
        raise HTTPException(status_code=502, detail="Backup storage is unavailable. Please try again.")
    if not hmac.compare_digest(hashlib.sha256(raw).hexdigest(), run["checksum"]):
        raise HTTPException(status_code=422, detail="Backup file failed its integrity check (checksum mismatch)")
    payload = json_util.loads(gzip.decompress(raw).decode())
    if payload.get("format") != FORMAT:
        raise HTTPException(status_code=422, detail="Unrecognised backup format")
    for name, docs in payload["collections"].items():
        if _digest(docs) != payload["digests"].get(name) or len(docs) != run["counts"].get(name):
            raise HTTPException(status_code=422, detail=f"Backup contents for '{name}' failed verification")
    return payload


async def _write(target, collections: dict) -> None:
    for name, docs in collections.items():
        await target[name].delete_many({})
        if docs:
            await target[name].insert_many(docs, ordered=True)


async def verify_in_test_db(run: dict) -> dict:
    payload = await _load(run)
    test_db = client[TEST_DB_NAME]
    try:
        await client.drop_database(TEST_DB_NAME)
        await _write(test_db, payload["collections"])
        mismatches = []
        for name, docs in payload["collections"].items():
            restored = await test_db[name].find({}).to_list(None)
            if len(restored) != len(docs) or _digest(restored) != payload["digests"][name]:
                mismatches.append(name)
    finally:
        await client.drop_database(TEST_DB_NAME)
    ok = not mismatches
    msg = (f"Restored {sum(len(d) for d in payload['collections'].values())} records into a separate test database; all "
           f"{len(payload['collections'])} collections match exactly." if ok else f"Mismatch in: {', '.join(mismatches)}")
    await db.backup_runs.update_one({"_id": run["_id"]}, {"$set": {"verified_at": utcnow(), "verify_ok": ok, "verify_message": msg}})
    return {"ok": ok, "message": msg}


async def _verify_recorded(run: dict) -> dict:
    try:
        return await verify_in_test_db(run)
    except HTTPException as exc:
        await db.backup_runs.update_one({"_id": run["_id"]}, {"$set": {"verified_at": utcnow(), "verify_ok": False, "verify_message": str(exc.detail)}})
        await log_event("backup_verify_failed", "critical", backup_id=str(run["_id"]), error=str(exc.detail))
        raise


class RestoreIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)
    confirm: str = Field(max_length=20)


async def _get_run(run_id: str) -> dict:
    run = await db.backup_runs.find_one({"_id": oid(run_id)})
    if not run:
        raise HTTPException(status_code=404, detail="Backup not found")
    return run


@admin.get("/overview")
async def overview():
    t0 = time.monotonic()
    try:
        await db.command("ping")
        db_status = {"connected": True, "latency_ms": int((time.monotonic() - t0) * 1000)}
    except Exception:
        db_status = {"connected": False, "latency_ms": None}
    last_ok = await db.backup_runs.find_one({"status": "success"}, sort=[("started_at", -1)])
    latest = await db.backup_runs.find_one({}, sort=[("started_at", -1)])
    since = last_ok["started_at"] if last_ok else utcnow() - timedelta(days=3650)
    failures = await db.backup_runs.find({"status": "failed", "started_at": {"$gt": since}}).sort("started_at", -1).to_list(20)
    day_ago = utcnow() - timedelta(hours=24)
    return {
        "database": db_status,
        "last_success": _public(last_ok) if last_ok else None,
        "latest": _public(latest) if latest else None,
        "failures_since_last_success": [_public(f) for f in failures],
        "retention_days": RETENTION_DAYS,
        "schedule": SCHEDULE_TEXT,
        "schedule_configured": bool(os.environ.get("WEBHOOK_CRON_SECRET")),
        "storage": "Private file storage (separate from the database)",
        "failed_logins_24h": await db.security_events.count_documents({"event": "login_failed", "created_at": {"$gte": day_ago}}),
        "lockouts_24h": await db.security_events.count_documents({"event": "login_locked", "created_at": {"$gte": day_ago}}),
        "errors_24h": await db.security_events.count_documents({"event": "server_error", "created_at": {"$gte": day_ago}}),
    }


@admin.get("/backups")
async def list_backups(limit: int = 60):
    runs = await db.backup_runs.find({}).sort("started_at", -1).to_list(min(max(limit, 1), 200))
    return [_public(r) for r in runs]


@admin.post("/backups", status_code=201)
async def backup_now(request: Request):
    if _lock.locked():
        raise HTTPException(status_code=409, detail="Another backup or restore is in progress")
    async with _lock:
        run = await run_backup("manual", f"admin:{client_ip(request)}")
    if run["status"] != "success":
        raise HTTPException(status_code=500, detail=f"Backup failed: {run.get('error', 'unknown error')}")
    return _public(run)


@admin.post("/backups/{run_id}/verify")
async def verify(run_id: str):
    if _lock.locked():
        raise HTTPException(status_code=409, detail="Another backup or restore is in progress")
    async with _lock:
        result = await _verify_recorded(await _get_run(run_id))
    await log_event("backup_verified" if result["ok"] else "backup_verify_failed", "info" if result["ok"] else "critical", backup_id=run_id)
    return result


@admin.post("/backups/{run_id}/restore")
async def restore(run_id: str, payload: RestoreIn, request: Request, user: dict = Depends(get_current_admin)):
    ip = client_ip(request)
    if payload.confirm != "RESTORE":
        raise HTTPException(status_code=400, detail="Type RESTORE in capital letters to confirm")
    if not verify_password(payload.password, user["password_hash"]):
        await log_event("restore_denied", "warning", ip=ip, reason="wrong password", backup_id=run_id)
        raise HTTPException(status_code=403, detail="Password is incorrect")
    if _lock.locked():
        raise HTTPException(status_code=409, detail="Another backup or restore is in progress")
    async with _lock:
        run = await _get_run(run_id)
        check = await _verify_recorded(run)
        if not check["ok"]:
            raise HTTPException(status_code=422, detail=f"Restore cancelled: backup failed test restore ({check['message']})")
        payload_data = await _load(run)
        safety = await run_backup("pre_restore", f"before restoring {run_id}")
        if safety["status"] != "success":
            raise HTTPException(status_code=500, detail="Restore cancelled: the safety backup of current data could not be created")
        await log_event("restore_started", "warning", ip=ip, backup_id=run_id, safety_backup_id=str(safety["_id"]))
        restore_set = {n: d for n, d in payload_data["collections"].items() if n not in KEEP_ON_RESTORE}
        for name in await _collections():
            if name not in payload_data["collections"] and name not in KEEP_ON_RESTORE:
                restore_set[name] = []
        await _write(db, restore_set)
        for name in payload_data["collections"]:
            if name in KEEP_ON_RESTORE:
                continue
            if _digest(await db[name].find({}).to_list(None)) != payload_data["digests"][name]:
                await log_event("restore_integrity_failed", "critical", ip=ip, backup_id=run_id, collection=name)
                raise HTTPException(status_code=500, detail=f"Restored data for '{name}' did not match. Restore the safety backup {safety['_id']}.")
        await db.backup_runs.update_one({"_id": run["_id"]}, {"$set": {"restored_at": utcnow()}})
    await log_event("restore_completed", "warning", ip=ip, backup_id=run_id, records=run["total_records"])
    return {"restored": True, "records": run["total_records"], "counts": run["counts"], "safety_backup_id": str(safety["_id"])}


@admin.get("/events")
async def events(limit: int = 50, event: str | None = None):
    query = {"event": event} if event else {}
    docs = await db.security_events.find(query).sort("created_at", -1).to_list(min(max(limit, 1), 200))
    return [{"id": str(d["_id"]), "event": d["event"], "severity": d["severity"], "ip": d.get("ip", ""),
             "detail": d.get("detail", {}), "created_at": d["created_at"]} for d in docs]


async def _scheduled_backup() -> None:
    async with _lock:
        await run_backup("scheduled", "daily schedule")


@cron.post("/backup", status_code=202)
async def cron_backup(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:].encode(), secret.encode()):
        await log_event("cron_unauthorized", "warning", ip=client_ip(request))
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid request body")
    run_id = request.headers.get("X-Webhook-Id") or body.get("run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="Missing run id")
    try:
        await db.cron_runs.insert_one({"_id": str(run_id)[:100], "job": "backup", "created_at": utcnow()})
    except DuplicateKeyError:
        return {"accepted": False, "duplicate": True}
    background.add_task(_scheduled_backup)
    return {"accepted": True}
