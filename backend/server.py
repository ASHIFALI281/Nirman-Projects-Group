from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import asyncio  # noqa: E402
import logging  # noqa: E402
from contextlib import suppress  # noqa: E402

from fastapi import APIRouter, FastAPI, Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from pymongo import ASCENDING, DESCENDING, IndexModel  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from core import ALLOWED_ORIGINS, client, db  # noqa: E402
from routes_auth import router as auth_router  # noqa: E402
from routes_site import CRUDS, admin as site_admin, public as site_public  # noqa: E402
from seed import run_seed  # noqa: E402
import storage  # noqa: E402
import backup  # noqa: E402
import media  # noqa: E402
from security import log_event, security_middleware  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "admin_users": [IndexModel([("email", ASCENDING)], name="email_unique", unique=True)],
    "login_attempts": [IndexModel([("identifier", ASCENDING)], name="identifier")],
    "company_info": [IndexModel([("key", ASCENDING)], name="key_unique", unique=True)],
    "website_content": [IndexModel([("key", ASCENDING)], name="key_unique", unique=True)],
    "services": [IndexModel([("slug", ASCENDING)], name="slug_unique", unique=True),
                 IndexModel([("active", ASCENDING), ("order", ASCENDING)], name="active_order")],
    "projects": [IndexModel([("published", ASCENDING), ("order", ASCENDING)], name="published_order"),
                 IndexModel([("status", ASCENDING)], name="status")],
    "clients": [IndexModel([("show_on_website", ASCENDING), ("order", ASCENDING)], name="public_order")],
    "careers": [IndexModel([("is_open", ASCENDING), ("order", ASCENDING)], name="open_order")],
    "enquiries": [IndexModel([("created_at", DESCENDING)], name="created_desc"),
                  IndexModel([("status", ASCENDING)], name="status"),
                  IndexModel([("ip", ASCENDING), ("created_at", DESCENDING)], name="ip_created"),
                  IndexModel([("enquiry_no", ASCENDING)], name="enquiry_no_unique", unique=True, partialFilterExpression={"enquiry_no": {"$type": "string", "$gt": ""}}),
                  IndexModel([("phone_key", ASCENDING), ("created_at", DESCENDING)], name="phone_key_created"),
                  IndexModel([("client_token", ASCENDING)], name="client_token_unique", unique=True, partialFilterExpression={"client_token": {"$type": "string"}})],
    "applications": [IndexModel([("created_at", DESCENDING)], name="created_desc"),
                     IndexModel([("ip", ASCENDING), ("created_at", DESCENDING)], name="ip_created")],
    "files": [IndexModel([("storage_path", ASCENDING)], name="storage_path")],
    "media": [IndexModel([("created_at", DESCENDING)], name="created_desc"),
              IndexModel([("category", ASCENDING), ("created_at", DESCENDING)], name="category_created")],
    "backup_runs": [IndexModel([("started_at", DESCENDING)], name="started_desc"),
                    IndexModel([("status", ASCENDING), ("started_at", DESCENDING)], name="status_started")],
    "security_events": [IndexModel([("created_at", ASCENDING)], name="ttl_180d", expireAfterSeconds=180 * 86400),
                        IndexModel([("event", ASCENDING), ("created_at", DESCENDING)], name="event_created")],
    "cron_runs": [IndexModel([("created_at", ASCENDING)], name="ttl_30d", expireAfterSeconds=30 * 86400)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI(title="Nirman Projects Group API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Nirman Projects Group API"}


@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "database": "unreachable"})


api_router.include_router(auth_router)
api_router.include_router(site_public)
api_router.include_router(site_admin)
api_router.include_router(storage.public)
api_router.include_router(storage.admin)
api_router.include_router(backup.admin)
api_router.include_router(backup.cron)
api_router.include_router(media.public)
api_router.include_router(media.admin)
for pub, adm in CRUDS:
    api_router.include_router(pub)
    api_router.include_router(adm)
app.include_router(api_router)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, type(exc).__name__, exc_info=exc)
    await log_event("server_error", "critical", method=request.method, path=request.url.path, error=type(exc).__name__)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.middleware("http")(security_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await run_seed()
    asyncio.get_running_loop().run_in_executor(None, _init_storage)


def _init_storage():
    try:
        storage.init_storage()
        logger.info("Storage initialized")
    except Exception as exc:
        logger.error("Storage init failed: %s", exc)


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
