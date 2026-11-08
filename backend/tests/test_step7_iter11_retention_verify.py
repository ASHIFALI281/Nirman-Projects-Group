# STEP 7 iter11: retention (mark expired only), verify-failure recording, failure banner logic, cron auth
# Run with: pytest -n 0 -p no:randomly /app/backend/tests/test_step7_iter11_retention_verify.py -v
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient


def _env(path, key):
    for line in open(path):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env("/app/frontend/.env", "REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = _env("/app/backend/.env", "ADMIN_EMAIL")
ADMIN_PASSWORD = _env("/app/backend/.env", "ADMIN_PASSWORD")
CRON_SECRET = _env("/app/backend/.env", "WEBHOOK_CRON_SECRET")
DB = MongoClient(_env("/app/backend/.env", "MONGO_URL"))[_env("/app/backend/.env", "DB_NAME")]
CREATED_RUNS = []


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    yield s
    if CREATED_RUNS:
        DB.backup_runs.delete_many({"_id": {"$in": CREATED_RUNS}})


def _fake_run(**kw):
    doc = {"kind": "manual", "trigger": "TEST_iter11", "status": "success", "started_at": datetime.now(timezone.utc),
           "storage_path": "TEST_missing/path.json.gz", "checksum": "0" * 64, "counts": {"services": 8},
           "total_records": 8, "size_bytes": 10, **kw}
    _id = DB.backup_runs.insert_one(doc).inserted_id
    CREATED_RUNS.append(_id)
    return _id


class TestOverviewBanner:
    def test_no_failures_since_last_success(self, admin):
        ov = admin.get(f"{API}/admin/security/overview").json()
        assert ov["latest"]["status"] == "success"
        assert ov["failures_since_last_success"] == []
        assert ov["retention_days"] == 30


class TestVerifyFailure:
    def test_verify_unloadable_records_false(self, admin):
        rid = _fake_run()
        r = admin.post(f"{API}/admin/security/backups/{rid}/verify")
        print(r.status_code, r.text)
        assert r.status_code in (502, 422)
        doc = DB.backup_runs.find_one({"_id": rid})
        assert doc["verify_ok"] is False and doc["verified_at"] and doc["verify_message"]

    def test_verify_expired_400(self, admin):
        rid = _fake_run(expired=True)
        r = admin.post(f"{API}/admin/security/backups/{rid}/verify")
        assert r.status_code == 400
        assert DB.backup_runs.find_one({"_id": rid})["verify_ok"] is False

    def test_restore_expired_rejected(self, admin):
        rid = _fake_run(expired=True)
        r = admin.post(f"{API}/admin/security/backups/{rid}/restore", json={"password": ADMIN_PASSWORD, "confirm": "RESTORE"})
        assert r.status_code == 400


class TestRetention:
    def test_old_run_marked_expired_not_deleted(self, admin):
        old = _fake_run(started_at=datetime.now(timezone.utc) - timedelta(days=40))
        recent = _fake_run(started_at=datetime.now(timezone.utc) - timedelta(days=5))
        r = admin.post(f"{API}/admin/security/backups")
        assert r.status_code == 201, r.text
        o = DB.backup_runs.find_one({"_id": old})
        assert o is not None and o.get("expired") is True
        assert DB.backup_runs.find_one({"_id": recent}).get("expired") is not True
        lst = admin.get(f"{API}/admin/security/backups", params={"limit": 200}).json()
        row = [x for x in lst if x["id"] == str(old)]
        assert row and row[0]["expired"] is True


class TestCron:
    def test_cron_401_and_202(self):
        assert requests.post(f"{API}/cron/backup", json={}).status_code == 401
        r = requests.post(f"{API}/cron/backup", json={"run_id": f"TEST_iter11_{datetime.now().timestamp()}"},
                          headers={"Authorization": f"Bearer {CRON_SECRET}"})
        assert r.status_code == 202 and r.json()["accepted"] is True
