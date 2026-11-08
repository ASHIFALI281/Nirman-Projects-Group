from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ValidationError
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from core import db, get_current_admin, oid, utcnow


def validation_422(exc: ValidationError) -> HTTPException:
    return HTTPException(status_code=422, detail=[{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()])


def build_crud(name: str, coll: str, Model, In, Update, public_filter: Optional[dict] = None, public_model=None,
               sort=(("order", 1), ("created_at", -1)), admin_create: bool = True):
    """Returns (public_router, admin_router) for a collection."""
    public = APIRouter(prefix=f"/{name}", tags=[name])
    admin = APIRouter(prefix=f"/admin/{name}", tags=[f"admin-{name}"], dependencies=[Depends(get_current_admin)])
    Out = public_model or Model
    sort = list(sort)
    required = {n for n, f in In.model_fields.items() if f.is_required()}

    def to_out(doc):
        item = Model.from_mongo(doc)
        return item if Out is Model else Out.model_validate(item.model_dump())

    if public_filter is not None:
        @public.get("", response_model=list[Out])
        async def list_public():
            docs = await db[coll].find(public_filter).sort(sort).to_list(500)
            return [to_out(d) for d in docs]

        @public.get("/{item_id}", response_model=Out)
        async def get_public(item_id: str):
            doc = await db[coll].find_one({"_id": oid(item_id), **public_filter})
            if not doc:
                raise HTTPException(status_code=404, detail="Record not found")
            return to_out(doc)

    @admin.get("", response_model=list[Model])
    async def list_admin(status: Optional[str] = None, limit: int = Query(200, ge=1, le=1000)):
        query = {"status": status} if status else {}
        docs = await db[coll].find(query).sort(sort).to_list(limit)
        return [Model.from_mongo(d) for d in docs]

    @admin.get("/{item_id}", response_model=Model)
    async def get_admin(item_id: str):
        doc = await db[coll].find_one({"_id": oid(item_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Record not found")
        return Model.from_mongo(doc)

    if admin_create:
        @admin.post("", response_model=Model, status_code=201)
        async def create(payload: In):
            item = Model(**payload.model_dump())
            try:
                res = await db[coll].insert_one(item.to_mongo())
            except DuplicateKeyError:
                raise HTTPException(status_code=409, detail="A record with this identifier already exists")
            item.id = str(res.inserted_id)
            return item

    @admin.put("/{item_id}", response_model=Model)
    async def update(item_id: str, payload: Update):
        data = payload.model_dump(exclude_unset=True)
        nulls = [k for k, v in data.items() if v is None and k in required]
        if nulls:
            raise HTTPException(status_code=422, detail=[{"loc": ["body", k], "msg": "This field cannot be empty"} for k in nulls])
        if not data:
            raise HTTPException(status_code=400, detail="No fields to update")
        existing = await db[coll].find_one({"_id": oid(item_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Record not found")
        merged = {**Model.from_mongo(existing).model_dump(), **data}
        try:
            Model.model_validate(merged)
        except ValidationError as exc:
            raise validation_422(exc)
        data = {k: (v.model_dump() if isinstance(v, BaseModel) else v) for k, v in data.items()}
        data["updated_at"] = utcnow()
        try:
            doc = await db[coll].find_one_and_update({"_id": existing["_id"]}, {"$set": data}, return_document=ReturnDocument.AFTER)
        except DuplicateKeyError:
            raise HTTPException(status_code=409, detail="A record with this identifier already exists")
        return Model.from_mongo(doc)

    @admin.delete("/{item_id}")
    async def delete(item_id: str):
        res = await db[coll].delete_one({"_id": oid(item_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"deleted": True, "id": item_id}

    return public, admin
