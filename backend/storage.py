import logging
import os
import uuid

import requests
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from core import db, get_current_admin, utcnow

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "nirmaan-enterprises"
ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_BYTES = 5 * 1024 * 1024
_storage_key = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _request(method: str, path: str, **kwargs) -> requests.Response:
    for attempt in range(2):
        headers = {"X-Storage-Key": init_storage(force=attempt == 1), **kwargs.pop("headers", {})}
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers=headers, timeout=120, **kwargs)
        if resp.status_code != 404 or attempt == 1:
            resp.raise_for_status()
            return resp
        kwargs["headers"] = {k: v for k, v in headers.items() if k != "X-Storage-Key"}
    raise RuntimeError("unreachable")


def _is_image(data: bytes) -> bool:
    return data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n" or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")


public = APIRouter(tags=["files"])
admin = APIRouter(prefix="/admin", tags=["admin-uploads"], dependencies=[Depends(get_current_admin)])


@admin.post("/uploads", status_code=201)
async def upload(file: UploadFile = File(...)):
    ext = ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Only JPG, PNG or WebP images are allowed")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")
    if not _is_image(data):
        raise HTTPException(status_code=400, detail="The file is not a valid image")
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    try:
        result = (await run_in_threadpool(_request, "PUT", path, data=data, headers={"Content-Type": file.content_type})).json()
    except Exception as exc:
        logger.error("Upload failed: %s", exc)
        raise HTTPException(status_code=502, detail="File storage is unavailable. Please try again.")
    await db.files.insert_one({"storage_path": result["path"], "original_filename": file.filename, "content_type": file.content_type,
                               "size": result.get("size", len(data)), "is_deleted": False, "created_at": utcnow()})
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@public.get("/files/{path:path}")
async def serve(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        resp = await run_in_threadpool(_request, "GET", path)
    except Exception as exc:
        logger.error("File fetch failed: %s", exc)
        raise HTTPException(status_code=502, detail="File storage is unavailable")
    return Response(content=resp.content, media_type=record["content_type"], headers={"Cache-Control": "public, max-age=86400"})
