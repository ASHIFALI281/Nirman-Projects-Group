# STEP 7: security hardening, backups, verify/restore, cron, spam protection
# Run with: pytest -n 0 -p no:randomly /app/backend/tests/test_step7_security_backup.py -v
import os
import random
import time
import uuid

import pytest
import requests
from pymongo import MongoClient


def _env(path, key):
    for line in open(path):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env("/app/frontend/.env", "REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
LOCAL = "http://localhost:8001/api"  # only for IP-scoped tests (spoofed X-Forwarded-For)
ADMIN_EMAIL = _env("/app/backend/.env", "ADMIN_EMAIL")
ADMIN_PASSWORD = _env("/app/backend/.env", "ADMIN_PASSWORD")
CRON_SECRET = _env("/app/backend/.env", "WEBHOOK_CRON_SECRET")
MONGO = MongoClient(_env("/app/backend/.env", "MONGO_URL"))
DB_NAME = _env("/app/backend/.env", "DB_NAME")
DB = MONGO[DB_NAME]

STATE = {}
CREATED = {"enquiries": [], "applications": []}


def fake_ip():
    return f"10.{random.randint(1, 250)}.{random.randint(1, 250)}.{random.randint(1, 250)}"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code} {r.text}")
    STATE["login_resp"] = r
    yield s
    for coll, ids in CREATED.items():
        for i in ids:
            s.delete(f"{API}/admin/{coll}/{i}")


# --- Auth ---
class TestAuth:
    def test_login_cookies_me_refresh(self, admin):
        r = STATE["login_resp"]
        sc = r.headers.get("set-cookie", "")
        assert "access_token" in sc and "refresh_token" in sc and "HttpOnly" in sc
        me = admin.get(f"{API}/auth/me")
        assert me.status_code == 200 and me.json()["email"] == ADMIN_EMAIL
        ref = admin.post(f"{API}/auth/refresh")
        assert ref.status_code == 200
        h = DB.admin_users.find_one({"email": ADMIN_EMAIL})["password_hash"]
        assert h.startswith("$2b$")

    def test_bearer_and_logout(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        tok = r.cookies.get("access_token")
        b = requests.get(f"{API}/admin/security/overview", headers={"Authorization": f"Bearer {tok}"})
        assert b.status_code == 200
        lo = s.post(f"{API}/auth/logout")
        assert lo.status_code == 200
        assert s.get(f"{API}/auth/me").status_code == 401

    @pytest.mark.parametrize("path", ["/admin/security/overview", "/admin/security/backups", "/admin/security/events", "/admin/enquiries"])
    def test_admin_401(self, path):
        assert requests.get(f"{API}{path}").status_code == 401
        assert requests.get(f"{API}{path}", headers={"Authorization": "Bearer junk"}).status_code == 401

    def test_unauth_post_backup_401(self):
        assert requests.post(f"{API}/admin/security/backups").status_code == 401

    def test_mongo_injection_422(self):
        r = requests.post(f"{API}/auth/login", json={"email": {"$ne": None}, "password": "x"})
        assert r.status_code == 422
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": {"$ne": None}})
        assert r.status_code == 422


# --- Lockout (fake email, spoofed IP on localhost) ---
class TestLockout:
    def test_lockout_and_events(self, admin):
        email = f"lockout_test_{uuid.uuid4().hex[:6]}@example.com"
        ip = fake_ip()
        h = {"X-Forwarded-For": ip}
        codes = [requests.post(f"{LOCAL}/auth/login", json={"email": email, "password": "WrongPass!1"}, headers=h).status_code for _ in range(6)]
        print(codes)
        assert codes[:5] == [401] * 5
        assert codes[5] == 429
        # different IP same email still allowed (per IP+email)
        r = requests.post(f"{LOCAL}/auth/login", json={"email": email, "password": "WrongPass!1"}, headers={"X-Forwarded-For": fake_ip()})
        assert r.status_code == 401
        ev = admin.get(f"{API}/admin/security/events", params={"limit": 200}).json()
        masked = "l***@example.com"
        mine = [e for e in ev if e["ip"] == ip]
        kinds = {e["event"] for e in mine}
        assert {"login_failed", "login_locked"} <= kinds, kinds
        assert all(e["detail"].get("email") == masked for e in mine if "email" in e["detail"])
        txt = str(ev)
        assert "WrongPass" not in txt and ADMIN_PASSWORD not in txt and email not in txt
        assert "eyJ" not in txt  # no JWTs
        succ = admin.get(f"{API}/admin/security/events", params={"event": "login_success"}).json()
        assert succ and succ[0]["detail"]["email"].startswith("n***@")
        DB.login_attempts.delete_many({"identifier": {"$in": [f"{ip}:{email}", f"email:{email}"]}})


# --- Headers & CORS ---
class TestHeadersCors:
    def test_security_headers(self, admin):
        r = requests.get(f"{API}/health")
        assert r.headers.get("X-Frame-Options") == "DENY"
        assert r.headers.get("X-Content-Type-Options") == "nosniff"
        assert "Content-Security-Policy" in r.headers
        assert "max-age" in r.headers.get("Strict-Transport-Security", "")
        assert r.headers.get("Referrer-Policy")
        a = admin.get(f"{API}/admin/security/overview")
        assert "no-store" in a.headers.get("Cache-Control", "")
        assert "no-store" in requests.get(f"{API}/auth/me").headers.get("Cache-Control", "")

    def test_cors_foreign_origin(self, admin):
        r = requests.get(f"{API}/health", headers={"Origin": "https://evil.example.com"})
        assert "access-control-allow-origin" not in {k.lower() for k in r.headers}
        ok = requests.get(f"{API}/health", headers={"Origin": BASE_URL})
        assert ok.headers.get("access-control-allow-origin") == BASE_URL
        assert ok.headers.get("access-control-allow-credentials") == "true"
        pre = requests.options(f"{API}/admin/security/backups", headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"})
        assert pre.headers.get("access-control-allow-origin") != "https://evil.example.com"
        p = admin.post(f"{API}/admin/security/backups", headers={"Origin": "https://evil.example.com"})
        assert p.status_code == 403
        lg = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, headers={"Origin": "https://evil.example.com"})
        assert lg.status_code == 403


# --- Spam / sanitization ---
class TestSpam:
    def test_honeypot(self):
        e = requests.post(f"{API}/enquiries", json={"name": "TEST_Hp", "phone": "9876500011", "location": "Pune",
                                                     "message": "honeypot test", "hp": "bot"})
        assert e.status_code == 400
        a = requests.post(f"{API}/applications", json={"name": "TEST_Hp", "phone": "9876500011", "position": "Site Engineer", "hp": "x"})
        assert a.status_code == 400
        assert DB.enquiries.count_documents({"name": "TEST_Hp"}) == 0
        assert DB.applications.count_documents({"name": "TEST_Hp"}) == 0

    def test_application_sanitize_and_duplicate(self):
        body = {"name": "<b>TEST_Appl</b>", "phone": "9876500022", "position": "<script>alert(1)</script>Site Engineer",
                "message": "<img src=x onerror=alert(1)>Hello there"}
        r1 = requests.post(f"{API}/applications", json=body)
        assert r1.status_code == 201, r1.text
        CREATED["applications"].append(r1.json()["id"])
        doc = DB.applications.find_one({"_id": __import__("bson").ObjectId(r1.json()["id"])})
        print(doc["name"], doc["position"], doc["message"])
        assert "<" not in doc["name"] + doc["position"] + doc["message"]
        assert doc["name"] == "TEST_Appl"
        r2 = requests.post(f"{API}/applications", json=body)
        assert r2.status_code == 200 and r2.json()["status"] == "duplicate" and r2.json()["id"] == r1.json()["id"]
        assert DB.applications.count_documents({"phone_key": "9876500022"}) == 1

    def test_per_ip_limit(self):
        ip = fake_ip()
        codes = []
        for i in range(11):
            r = requests.post(f"{LOCAL}/applications", headers={"X-Forwarded-For": ip},
                              json={"name": "TEST_Rate", "phone": f"98765{i:05d}", "position": f"Rate Test {i}"})
            codes.append(r.status_code)
            if r.status_code == 201:
                CREATED["applications"].append(r.json()["id"])
        print(codes)
        assert codes[:10] == [201] * 10 and codes[10] == 429


# --- Backups ---
class TestBackup:
    def test_manual_backup(self, admin):
        r = admin.post(f"{API}/admin/security/backups")
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["status"] == "success" and len(d["checksum"]) == 64 and d["size_bytes"] > 0
        assert d["counts"]["admin_users"] == 1 and "backup_runs" not in d["counts"]
        STATE["backup"] = d
        lst = admin.get(f"{API}/admin/security/backups").json()
        assert lst[0]["id"] == d["id"]
        ov = admin.get(f"{API}/admin/security/overview").json()
        assert ov["last_success"]["id"] == d["id"] and ov["database"]["connected"] is True
        assert ov["retention_days"] == 30 and ov["schedule_configured"] is True

    def test_verify(self, admin):
        bid = STATE["backup"]["id"]
        r = admin.post(f"{API}/admin/security/backups/{bid}/verify")
        assert r.status_code == 200 and r.json()["ok"] is True, r.text
        assert f"{DB_NAME}_restore_test" not in MONGO.list_database_names()
        run = [x for x in admin.get(f"{API}/admin/security/backups").json() if x["id"] == bid][0]
        assert run["verify_ok"] is True and run["verified_at"]

    def test_verify_404(self, admin):
        assert admin.post(f"{API}/admin/security/backups/000000000000000000000000/verify").status_code == 404

    def test_restore_validation(self, admin):
        bid = STATE["backup"]["id"]
        assert admin.post(f"{API}/admin/security/backups/{bid}/restore", json={"password": ADMIN_PASSWORD, "confirm": "restore"}).status_code == 400
        assert admin.post(f"{API}/admin/security/backups/{bid}/restore", json={"password": "wrong", "confirm": "RESTORE"}).status_code == 403

    def test_restore_flow(self, admin):
        # fresh backup right before restore so other data is unchanged
        b = admin.post(f"{API}/admin/security/backups").json()
        assert b["status"] == "success"
        e = requests.post(f"{API}/enquiries", json={"name": "<i>TEST_Restore</i>", "phone": "9876500033", "location": "<b>Pune</b>",
                                                     "message": "<script>x</script>TEST restore check", "hp": ""})
        assert e.status_code == 201, e.text
        eid = e.json()["id"]
        edoc = DB.enquiries.find_one({"_id": __import__("bson").ObjectId(eid)})
        assert edoc["name"] == "TEST_Restore" and "<" not in edoc["location"] + edoc["message"]
        time.sleep(3)  # let email task finish
        r = admin.post(f"{API}/admin/security/backups/{b['id']}/restore", json={"password": ADMIN_PASSWORD, "confirm": "RESTORE"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["restored"] is True and d["counts"] == b["counts"]
        assert DB.enquiries.find_one({"_id": __import__("bson").ObjectId(eid)}) is None
        for name, cnt in b["counts"].items():
            assert DB[name].count_documents({}) == cnt, name
        runs = admin.get(f"{API}/admin/security/backups").json()
        safety = [x for x in runs if x["id"] == d["safety_backup_id"]][0]
        assert safety["kind"] == "pre_restore" and safety["status"] == "success"
        assert safety["counts"]["enquiries"] == b["counts"]["enquiries"] + 1
        restored = [x for x in runs if x["id"] == b["id"]][0]
        assert restored["restored_at"]
        # session still valid after restore
        assert admin.get(f"{API}/auth/me").status_code == 200


# --- Cron ---
class TestCron:
    def test_cron_auth(self):
        assert requests.post(f"{API}/cron/backup", json={}).status_code == 401
        assert requests.post(f"{API}/cron/backup", json={}, headers={"Authorization": "Bearer wrong"}).status_code == 401

    def test_cron_run_and_duplicate(self, admin):
        before = DB.backup_runs.count_documents({"kind": "scheduled"})
        wid = f"TEST_{uuid.uuid4().hex}"
        h = {"Authorization": f"Bearer {CRON_SECRET}", "X-Webhook-Id": wid}
        r = requests.post(f"{API}/cron/backup", json={}, headers=h)
        assert r.status_code == 202 and r.json()["accepted"] is True, r.text
        for _ in range(20):
            time.sleep(1)
            if DB.backup_runs.count_documents({"kind": "scheduled", "status": "success"}) > before:
                break
        assert DB.backup_runs.count_documents({"kind": "scheduled"}) == before + 1
        r2 = requests.post(f"{API}/cron/backup", json={}, headers=h)
        assert r2.json().get("duplicate") is True
        time.sleep(2)
        assert DB.backup_runs.count_documents({"kind": "scheduled"}) == before + 1


# --- Global rate limit (spoofed IP on localhost, run last) ---
class TestZGlobalRate:
    def test_global_rate_limit(self):
        ip = fake_ip()
        s = requests.Session()
        codes = [s.get(f"{LOCAL}/health", headers={"X-Forwarded-For": ip}).status_code for _ in range(245)]
        assert codes[:240].count(200) == 240 and codes[-1] == 429
        assert s.get(f"{LOCAL}/health", headers={"X-Forwarded-For": fake_ip()}).status_code == 200
