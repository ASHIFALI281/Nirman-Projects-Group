import asyncio
import re
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from pymongo import ReturnDocument

import notification as notifications
from core import client_ip, db, get_current_admin, utcnow
from crud import build_crud, validation_422
from security import log_event
from models import (Application, ApplicationIn, ApplicationSubmit, ApplicationUpdate, Client, ClientIn, ClientPublic, ClientUpdate,
                    CompanyInfo, CompanyUpdate, Content, ContentIn, ContentKey, Enquiry, EnquiryIn, EnquirySubmit, EnquiryUpdate, Job,
                    JobIn, JobUpdate, Project, ProjectIn, ProjectUpdate, Service, ServiceIn, ServiceUpdate)

RATE_LIMIT = 10
RATE_WINDOW = timedelta(hours=1)
DUPLICATE_WINDOW = timedelta(minutes=10)
_background: set = set()

public = APIRouter()
admin = APIRouter(prefix="/admin", dependencies=[Depends(get_current_admin)])

CRUDS = [
    build_crud("services", "services", Service, ServiceIn, ServiceUpdate, public_filter={"active": True}),
    build_crud("projects", "projects", Project, ProjectIn, ProjectUpdate, public_filter={"published": True}),
    build_crud("clients", "clients", Client, ClientIn, ClientUpdate, public_filter={"show_on_website": True}, public_model=ClientPublic),
    build_crud("careers", "careers", Job, JobIn, JobUpdate, public_filter={"is_open": True}),
    build_crud("enquiries", "enquiries", Enquiry, EnquiryIn, EnquiryUpdate, sort=(("created_at", -1),), admin_create=False),
    build_crud("applications", "applications", Application, ApplicationIn, ApplicationUpdate, sort=(("created_at", -1),), admin_create=False),
]


async def enforce_rate_limit(coll: str, ip: str) -> None:
    recent = await db[coll].count_documents({"ip": ip, "created_at": {"$gte": utcnow() - RATE_WINDOW}})
    if recent >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many submissions. Please try again later or call us directly.")


async def next_enquiry_no() -> str:
    day = f"{utcnow():%Y%m%d}"
    counter = await db.counters.find_one_and_update({"_id": f"enquiry-{day}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return f"NE-{day}-{counter['seq']:04d}"


def phone_key(phone: str) -> str:
    return re.sub(r"\D", "", phone)[-10:]


@public.post("/enquiries", status_code=201, tags=["enquiries"])
async def submit_enquiry(payload: EnquirySubmit, request: Request):
    if payload.hp:
        await log_event("spam_blocked", "warning", ip=client_ip(request), form="enquiry")
        raise HTTPException(status_code=400, detail="Submission rejected")
    dup_query = [{"phone_key": phone_key(payload.phone), "message": payload.message, "created_at": {"$gte": utcnow() - DUPLICATE_WINDOW}}]
    if payload.client_token:
        dup_query.append({"client_token": payload.client_token})
    existing = await db.enquiries.find_one({"$or": dup_query})
    if existing:
        return JSONResponse(status_code=200, content={"id": str(existing["_id"]), "enquiry_no": existing.get("enquiry_no", ""), "status": "duplicate"})
    ip = client_ip(request)
    await enforce_rate_limit("enquiries", ip)
    enquiry = Enquiry(**payload.model_dump(exclude={"hp", "client_token"}), enquiry_no=await next_enquiry_no())
    doc = {**enquiry.to_mongo(), "ip": ip, "phone_key": phone_key(payload.phone)}
    if payload.client_token:
        doc["client_token"] = payload.client_token
    try:
        res = await db.enquiries.insert_one(doc)
    except DuplicateKeyError:
        existing = await db.enquiries.find_one({"client_token": payload.client_token})
        return JSONResponse(status_code=200, content={"id": str(existing["_id"]), "enquiry_no": existing.get("enquiry_no", ""), "status": "duplicate"})
    service = await db.services.find_one({"slug": payload.service}) if payload.service else None
    task = asyncio.create_task(notifications.notify_new_enquiry(res.inserted_id, {**doc, "service_label": service["title_en"] if service else payload.service}))
    _background.add(task)
    task.add_done_callback(_background.discard)
    return {"id": str(res.inserted_id), "enquiry_no": enquiry.enquiry_no, "created_at": enquiry.created_at.isoformat(), "status": "received"}


@admin.get("/email/status", tags=["admin-email"])
async def email_status():
    return {"configured": bool(notifications.EMAIL_KEY), "recipient": await notifications.notification_recipient(), "from_name": notifications.EMAIL_FROM_NAME}


@admin.post("/email/test", tags=["admin-email"])
async def email_test():
    to = await notifications.notification_recipient()
    email_id = await notifications.send_email(to=to, subject=f"{notifications.EMAIL_FROM_NAME}: test enquiry alert", html=notifications.test_email_html())
    return {"sent": True, "to": to, "id": email_id}


@public.post("/applications", status_code=201, tags=["applications"])
async def submit_application(payload: ApplicationSubmit, request: Request):
    ip = client_ip(request)
    if payload.hp:
        await log_event("spam_blocked", "warning", ip=ip, form="application")
        raise HTTPException(status_code=400, detail="Submission rejected")
    existing = await db.applications.find_one({"phone_key": phone_key(payload.phone), "position": payload.position,
                                              "created_at": {"$gte": utcnow() - DUPLICATE_WINDOW}})
    if existing:
        return JSONResponse(status_code=200, content={"id": str(existing["_id"]), "status": "duplicate"})
    await enforce_rate_limit("applications", ip)
    doc = {**Application(**payload.model_dump(exclude={"hp"})).to_mongo(), "ip": ip, "phone_key": phone_key(payload.phone)}
    res = await db.applications.insert_one(doc)
    return {"id": str(res.inserted_id), "status": "received"}


@public.get("/company", response_model=CompanyInfo, tags=["company"])
async def get_company():
    doc = await db.company_info.find_one({"key": "company"})
    if not doc:
        raise HTTPException(status_code=404, detail="Company information not set")
    return CompanyInfo.from_mongo(doc)


@admin.put("/company", response_model=CompanyInfo, tags=["admin-company"])
async def update_company(payload: CompanyUpdate):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    existing = await db.company_info.find_one({"key": "company"})
    if not existing:
        raise HTTPException(status_code=404, detail="Company information not set")
    try:
        CompanyInfo.model_validate({**CompanyInfo.from_mongo(existing).model_dump(), **data})
    except ValidationError as exc:
        raise validation_422(exc)
    data["updated_at"] = utcnow()
    doc = await db.company_info.find_one_and_update({"key": "company"}, {"$set": data}, return_document=ReturnDocument.AFTER)
    if not doc:
        raise HTTPException(status_code=404, detail="Company information not set")
    return CompanyInfo.from_mongo(doc)


@public.get("/content", response_model=list[Content], tags=["content"])
async def list_content():
    docs = await db.website_content.find({}).sort("key", 1).to_list(500)
    return [Content.from_mongo(d) for d in docs]


@public.get("/content/{key}", response_model=Content, tags=["content"])
async def get_content(key: str):
    doc = await db.website_content.find_one({"key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Content not found")
    return Content.from_mongo(doc)


@admin.put("/content/{key}", response_model=Content, tags=["admin-content"])
async def upsert_content(key: ContentKey, payload: ContentIn):
    now = utcnow()
    doc = await db.website_content.find_one_and_update(
        {"key": key},
        {"$set": {"value": payload.value, "description": payload.description, "updated_at": now}, "$setOnInsert": {"key": key, "created_at": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return Content.from_mongo(doc)


@admin.delete("/content/{key}", tags=["admin-content"])
async def delete_content(key: str):
    res = await db.website_content.delete_one({"key": key})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"deleted": True, "key": key}


@admin.get("/stats", tags=["admin"])
async def stats():
    names = ["services", "projects", "clients", "careers", "enquiries", "applications"]
    counts = {n: await db[n].count_documents({}) for n in names}
    counts["new_enquiries"] = await db.enquiries.count_documents({"status": "new"})
    counts["ongoing_projects"] = await db.projects.count_documents({"status": "ongoing"})
    counts["completed_projects"] = await db.projects.count_documents({"status": "completed"})
    return counts
