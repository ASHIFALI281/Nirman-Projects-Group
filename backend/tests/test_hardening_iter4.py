# Iteration 4: post-iteration-3 hardening fixes (XFF right-most, per-email lockout, refresh origin/role,
# explicit nulls on PUT, friendly phone message) + persistence + collections/indexes
import os
import subprocess
import time
import uuid
from datetime import timedelta

import jwt
import pytest
import requests
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
LOCAL_API = "http://localhost:8001/api"  # only used to emulate distinct client IPs (no proxy in front)
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def ip():
    return f"203.0.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"


def clear_attempts(*emails):
    for e in emails:
        mdb.login_attempts.delete_many({"identifier": {"$regex": f"{e.replace('.', '[.]')}$"}})


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def created_ids():
    ids = {"enquiries": [], "applications": [], "services": [], "projects": []}
    yield ids
    for coll, lst in ids.items():
        if lst:
            mdb[coll].delete_many({"_id": {"$in": [ObjectId(i) for i in lst]}})


# Collections & indexes
def test_collections_and_indexes():
    expected = {
        "admin_users": {"email_unique"}, "company_info": {"key_unique"}, "services": {"slug_unique", "active_order"},
        "projects": {"published_order", "status"}, "clients": {"public_order"}, "careers": {"open_order"},
        "enquiries": {"created_desc", "status", "ip_created"}, "applications": {"created_desc", "ip_created"},
        "website_content": {"key_unique"}, "login_attempts": {"identifier"},
    }
    names = set(mdb.list_collection_names())
    for coll, idx in expected.items():
        assert coll in names, coll
        have = {i["name"] for i in mdb[coll].list_indexes()}
        assert idx <= have, (coll, have)
    assert mdb.admin_users.index_information()["email_unique"]["unique"] is True


# (e) friendly phone message
def test_phone_friendly_message():
    r = requests.post(f"{API}/enquiries", json={"name": "TEST_Phone", "phone": "123", "message": "hello there"})
    assert r.status_code == 422
    msgs = " ".join(d["msg"] for d in r.json()["detail"])
    assert "Enter a valid phone number (7-15 digits)" in msgs, msgs
    r2 = requests.post(f"{API}/applications", json={"position": "Site Engineer", "name": "TEST_Phone", "phone": "123"})
    assert r2.status_code == 422 and "7-15 digits" in str(r2.json())


# (a) spoofed left-most XFF no longer bypasses enquiry rate limit
def test_spoofed_xff_does_not_bypass_rate_limit(created_ids):
    real = requests.post(f"{API}/enquiries", json={"name": "TEST_XffProbe", "phone": "9876543210", "message": "xff probe"})
    assert real.status_code == 201
    created_ids["enquiries"].append(real.json()["id"])
    shared_ip = mdb.enquiries.find_one({"_id": ObjectId(real.json()["id"])})["ip"]
    preexisting = mdb.enquiries.count_documents({"ip": shared_ip})
    codes = []
    for _ in range(12 - preexisting):
        r = requests.post(f"{API}/enquiries", json={"name": "TEST_Xff", "phone": "9876543210", "message": "xff spoof"},
                          headers={"X-Forwarded-For": ip()})
        codes.append(r.status_code)
        if r.status_code == 201:
            created_ids["enquiries"].append(r.json()["id"])
    assert codes.count(201) == 10 - preexisting and codes[-1] == 429, (preexisting, codes)
    # cleanup so later tests / frontend aren't blocked
    mdb.enquiries.delete_many({"_id": {"$in": [ObjectId(i) for i in created_ids["enquiries"]]}})
    created_ids["enquiries"].clear()


# (b) per-email lockout after 20 failures across IPs (direct to backend so each request has a distinct client IP)
def test_per_email_lockout_across_ips():
    email = "test_lock@example.com"
    clear_attempts(email)
    try:
        codes = [requests.post(f"{LOCAL_API}/auth/login", json={"email": email, "password": "bad"},
                               headers={"X-Forwarded-For": ip()}).status_code for _ in range(20)]
        assert codes == [401] * 20, codes
        r = requests.post(f"{LOCAL_API}/auth/login", json={"email": email, "password": "bad"}, headers={"X-Forwarded-For": ip()})
        assert r.status_code == 429, r.status_code
        assert mdb.login_attempts.find_one({"identifier": f"email:{email}"})["locked_until"]
        # admin not affected
        ok = requests.post(f"{LOCAL_API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, headers={"X-Forwarded-For": ip()})
        assert ok.status_code == 200
    finally:
        clear_attempts(email)


# (b) per ip+email lockout still 5 via public ingress; spoofed XFF can't reset it
def test_ip_email_lockout_spoof_resistant():
    email = "test_lock2@example.com"
    clear_attempts(email)
    try:
        codes = [requests.post(f"{API}/auth/login", json={"email": email, "password": "bad"},
                               headers={"X-Forwarded-For": ip()}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429, codes
    finally:
        clear_attempts(email)


# (c) refresh origin + token checks
def test_refresh_origin_and_role():
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).status_code == 200
    bad = s.post(f"{API}/auth/refresh", headers={"Origin": "https://evil.example.com"})
    assert bad.status_code == 403, bad.status_code
    good = s.post(f"{API}/auth/refresh", headers={"Origin": BASE_URL})
    assert good.status_code == 200 and good.json()["role"] == "admin"
    assert requests.post(f"{API}/auth/refresh").status_code == 401
    # access token used as refresh -> 401
    acc = s.cookies.get("access_token")
    assert requests.post(f"{API}/auth/refresh", cookies={"refresh_token": acc}).status_code == 401
    # valid refresh signature for unknown user -> 401
    fake = jwt.encode({"sub": str(ObjectId()), "type": "refresh", "exp": int(time.time()) + 600}, os.environ["JWT_SECRET"], algorithm="HS256")
    assert requests.post(f"{API}/auth/refresh", cookies={"refresh_token": fake}).status_code == 401
    # foreign origin also blocked on login
    assert requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                         headers={"Origin": "https://evil.example.com"}).status_code == 403


# (d) explicit null for required fields on PUT -> 422
def test_put_null_required(admin, created_ids):
    slug = f"test-null-{uuid.uuid4().hex[:6]}"
    r = admin.post(f"{API}/admin/services", json={"slug": slug, "title_en": "TEST_NullSvc", "active": False})
    assert r.status_code == 201
    sid = r.json()["id"]
    created_ids["services"].append(sid)
    for body in ({"title_en": None}, {"slug": None}):
        u = admin.put(f"{API}/admin/services/{sid}", json=body)
        assert u.status_code == 422, (body, u.status_code, u.text)
    opt = admin.put(f"{API}/admin/services/{sid}", json={"title_hi": None})
    assert opt.status_code == 422, ("optional str null", opt.status_code)
    assert admin.get(f"{API}/admin/services/{sid}").json()["title_en"] == "TEST_NullSvc"
    p = admin.post(f"{API}/admin/projects", json={"name": "TEST_NullProj", "category": "Civil", "status": "ongoing", "published": False})
    assert p.status_code == 201
    pid = p.json()["id"]
    created_ids["projects"].append(pid)
    assert admin.put(f"{API}/admin/projects/{pid}", json={"status": None}).status_code == 422
    assert admin.put(f"{API}/admin/projects/{pid}", json={"name": None}).status_code == 422
    assert admin.delete(f"{API}/admin/services/{sid}").status_code == 200
    assert admin.delete(f"{API}/admin/projects/{pid}").status_code == 200


# (d) explicit null on enquiry/application status (fields not in *In model)
def test_put_null_status_on_submissions(admin, created_ids):
    r = requests.post(f"{API}/enquiries", json={"name": "TEST_NullEnq", "phone": "9876543210", "message": "null status"})
    assert r.status_code == 201
    eid = r.json()["id"]
    created_ids["enquiries"].append(eid)
    u = admin.put(f"{API}/admin/enquiries/{eid}", json={"status": None})
    stored = mdb.enquiries.find_one({"_id": ObjectId(eid)})["status"]
    lst = admin.get(f"{API}/admin/enquiries")
    # restore before asserting so the admin list is never left broken
    mdb.enquiries.update_one({"_id": ObjectId(eid)}, {"$set": {"status": "new"}})
    assert u.status_code == 422, f"PUT status:null returned {u.status_code}; stored status={stored!r}; admin list={lst.status_code}"


# Persistence across backend restart
def test_persistence_after_restart(admin, created_ids):
    r = requests.post(f"{API}/enquiries", json={"name": "TEST_Persist", "phone": "9876543210", "message": "persist across restart"})
    assert r.status_code == 201
    eid = r.json()["id"]
    created_ids["enquiries"].append(eid)
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    for _ in range(30):
        time.sleep(2)
        try:
            if requests.get(f"{API}/health", timeout=5).status_code == 200:
                break
        except requests.RequestException:
            pass
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).status_code == 200
    assert any(e["id"] == eid and e["name"] == "TEST_Persist" for e in s.get(f"{API}/admin/enquiries").json())
    assert mdb.enquiries.find_one({"_id": ObjectId(eid)})["name"] == "TEST_Persist"
    assert mdb.admin_users.count_documents({}) == 1
    assert s.delete(f"{API}/admin/enquiries/{eid}").status_code == 200
    assert mdb.enquiries.find_one({"_id": ObjectId(eid)}) is None
