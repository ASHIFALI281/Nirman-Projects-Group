import hashlib
import io
import logging
import re
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from PIL import Image
from pydantic import Field

import storage
from core import db, get_current_admin, oid, utcnow
from models import In
from security import log_event

logger = logging.getLogger("media")

MAX_BYTES = 10 * 1024 * 1024
TYPES = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png"), "WEBP": ("image/webp", "webp")}
EXT_OK = {".jpg", ".jpeg", ".png", ".webp"}
Category = Literal["hero", "about", "services", "civil", "building", "electrical", "material", "plumbing", "carpentry", "ups",
                   "projects", "other"]
SLOTS_KEY = "site.images"

public = APIRouter(tags=["media"])
admin = APIRouter(prefix="/admin/media", tags=["admin-media"], dependencies=[Depends(get_current_admin)])


def media_url(media_id) -> str:
    return f"/api/media/{media_id}"


def _out(d: dict) -> dict:
    return {"id": str(d["_id"]), "url": media_url(d["_id"]), "filename": d["filename"], "title": d.get("title", ""),
            "category": d["category"], "content_type": d["content_type"], "size": d["size"], "width": d.get("width"),
            "height": d.get("height"), "version": d.get("version", 1), "created_at": d["created_at"], "updated_at": d["updated_at"]}


def _safe_name(name: str) -> str:
    base = re.sub(r"[^\w.\- ]+", "", (name or "image").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]).strip()[:120]
    return base or "image"


async def _read_image(file: UploadFile) -> tuple[bytes, str, str, int, int]:
    name = (file.filename or "").lower()
    if not any(name.endswith(e) for e in EXT_OK):
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG or WEBP images are allowed")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller")
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty")
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format
            img.verify()
        with Image.open(io.BytesIO(data)) as img:
            width, height = img.size
    except Exception:
        raise HTTPException(status_code=400, detail="The file is not a valid image")
    if fmt not in TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG or WEBP images are allowed")
    if width * height > 60_000_000:
        raise HTTPException(status_code=400, detail="Image dimensions are too large")
    ctype, ext = TYPES[fmt]
    return data, ctype, ext, width, height


async def _store(data: bytes, ctype: str, ext: str) -> str:
    path = f"{storage.APP_NAME}/media/{uuid.uuid4()}.{ext}"
    try:
        result = (await run_in_threadpool(storage._request, "PUT", path, data=data, headers={"Content-Type": ctype})).json()
    except Exception as exc:
        logger.error("Media upload failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Image storage is unavailable. Please try again.")
    return result["path"]


async def find_usage(media_id: str) -> list[dict]:
    url = media_url(media_id)
    places = []
    slots = await db.website_content.find_one({"key": SLOTS_KEY})
    for key, val in ((slots or {}).get("value") or {}).items():
        if val == url:
            places.append({"kind": "slot", "key": key, "label": key})
    async for s in db.services.find({"image_url": url}, {"title_en": 1}):
        places.append({"kind": "service", "key": str(s["_id"]), "label": f"Service: {s['title_en']}"})
    async for p in db.projects.find({"images": url}, {"name": 1}):
        places.append({"kind": "project", "key": str(p["_id"]), "label": f"Project gallery: {p['name']}"})
    async for c in db.clients.find({"logo_url": url}, {"name": 1}):
        places.append({"kind": "client", "key": str(c["_id"]), "label": f"Client logo: {c['name']}"})
    company = await db.company_info.find_one({"key": "company"}, {"management": 1}) or {}
    for m in company.get("management", []):
        if m.get("photo_url") == url:
            places.append({"kind": "management", "key": m.get("name", ""), "label": f"Management photo: {m.get('name', '')}"})
    return places


def _check_length(request: Request) -> None:
    if int(request.headers.get("content-length") or 0) > MAX_BYTES + 512 * 1024:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller")


@admin.post("", status_code=201, dependencies=[Depends(_check_length)])
async def upload(file: UploadFile = File(...), category: Category = Form("other"), title: str = Form("", max_length=150)):
    data, ctype, ext, w, h = await _read_image(file)
    path = await _store(data, ctype, ext)
    now = utcnow()
    doc = {"filename": _safe_name(file.filename), "title": re.sub(r"<[^>]*>", "", title).strip(), "category": category,
           "storage_path": path, "content_type": ctype, "size": len(data), "width": w, "height": h, "version": 1,
           "created_at": now, "updated_at": now}
    doc["_id"] = (await db.media.insert_one(doc)).inserted_id
    return _out(doc)


@admin.get("")
async def list_media(q: Optional[str] = Query(None, max_length=100), category: Optional[Category] = None, limit: int = Query(500, ge=1, le=1000)):
    query: dict = {}
    if category:
        query["category"] = category
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"filename": rx}, {"title": rx}]
    docs = await db.media.find(query).sort("created_at", -1).to_list(limit)
    return [_out(d) for d in docs]


class MediaUpdate(In):
    title: Optional[str] = Field(None, max_length=150)
    category: Optional[Category] = None
    filename: Optional[str] = Field(None, min_length=1, max_length=120)


@admin.put("/{media_id}")
async def update(media_id: str, payload: MediaUpdate):
    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "filename" in data:
        data["filename"] = _safe_name(data["filename"])
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    data["updated_at"] = utcnow()
    res = await db.media.find_one_and_update({"_id": oid(media_id)}, {"$set": data}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Image not found")
    return _out(res)


@admin.post("/{media_id}/replace", dependencies=[Depends(_check_length)])
async def replace(media_id: str, file: UploadFile = File(...)):
    existing = await db.media.find_one({"_id": oid(media_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Image not found")
    data, ctype, ext, w, h = await _read_image(file)
    path = await _store(data, ctype, ext)
    update = {"storage_path": path, "content_type": ctype, "size": len(data), "width": w, "height": h,
              "updated_at": utcnow()}
    doc = await db.media.find_one_and_update({"_id": existing["_id"]}, {"$set": update, "$inc": {"version": 1},
                                                                           "$push": {"previous_paths": existing["storage_path"]}}, return_document=True)
    await log_event("media_replaced", media_id=media_id)
    return {**_out(doc), "used_in": await find_usage(media_id)}


@admin.get("/{media_id}/usage")
async def usage(media_id: str):
    if not await db.media.find_one({"_id": oid(media_id)}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Image not found")
    return await find_usage(media_id)


@admin.delete("/{media_id}")
async def delete(media_id: str):
    doc = await db.media.find_one({"_id": oid(media_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    places = await find_usage(media_id)
    if places:
        raise HTTPException(status_code=409, detail={"message": "This image is used on the website. Replace it in these places first.", "used_in": places})
    await db.media.delete_one({"_id": doc["_id"]})
    await log_event("media_deleted", media_id=media_id, filename=doc["filename"])
    return {"deleted": True, "id": media_id}


@public.get("/media/{media_id}")
async def serve(media_id: str, request: Request):
    doc = await db.media.find_one({"_id": oid(media_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    etag = '"' + hashlib.sha1(doc["storage_path"].encode()).hexdigest()[:20] + '"'
    headers = {"ETag": etag, "Cache-Control": "public, max-age=60, must-revalidate", "Content-Security-Policy": "default-src 'none'"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    try:
        resp = await run_in_threadpool(storage._request, "GET", doc["storage_path"])
    except Exception as exc:
        logger.error("Media fetch failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Image storage is unavailable")
    return Response(content=resp.content, media_type=doc["content_type"], headers=headers)
