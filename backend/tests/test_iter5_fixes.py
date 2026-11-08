# Iteration 5: verifies 3 HIGH fixes from iteration 4: explicit null -> 422 on submissions/other resources,
# company null -> 422, client_ip uses TRUSTED_PROXY_HOPS (real egress IP, spoof resistant, rate limit 429)
import os
import uuid

import pytest
import requests
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
LB_IP = "35.190.85.20"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def egress_ip():
    try:
        return requests.get("https://api.ipify.org", timeout=5).text.strip()
    except requests.RequestException:
        return None


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    return s


@pytest.fixture(scope="module")
def ids():
    d = {"enquiries": [], "applications": [], "projects": [], "services": [], "clients": [], "careers": []}
    yield d
    for coll, lst in d.items():
        if lst:
            mdb[coll].delete_many({"_id": {"$in": [ObjectId(i) for i in lst]}})


def _enquiry(ids, name="TEST_I5Enq", headers=None):
    r = requests.post(f"{API}/enquiries", json={"name": name, "phone": "9876543210", "message": "iteration five"}, headers=headers or {})
    assert r.status_code == 201, r.text
    ids["enquiries"].append(r.json()["id"])
    return r.json()["id"]


# FIX 1: null status/admin_notes on enquiries + applications -> 422, nothing written, lists stay 200
def test_null_on_submissions(admin, ids):
    eid = _enquiry(ids)
    r = requests.post(f"{API}/applications", json={"position": "Site Engineer", "name": "TEST_I5App", "phone": "9876543210"})
    assert r.status_code == 201
    aid = r.json()["id"]
    ids["applications"].append(aid)
    for coll, rid in (("enquiries", eid), ("applications", aid)):
        before = mdb[coll].find_one({"_id": ObjectId(rid)})
        for body in ({"status": None}, {"admin_notes": None}, {"status": None, "admin_notes": None}):
            u = admin.put(f"{API}/admin/{coll}/{rid}", json=body)
            assert u.status_code == 422, (coll, body, u.status_code, u.text)
        after = mdb[coll].find_one({"_id": ObjectId(rid)})
        assert after["status"] == "new" and after["admin_notes"] == "" and after["updated_at"] == before["updated_at"]
        assert admin.get(f"{API}/admin/{coll}").status_code == 200
        assert admin.get(f"{API}/admin/{coll}/{rid}").status_code == 200
        ok = admin.put(f"{API}/admin/{coll}/{rid}", json={"admin_notes": "TEST note"})
        assert ok.status_code == 200 and ok.json()["admin_notes"] == "TEST note" and ok.json()["status"] == "new"


# FIX 1: same null check on other resources
def test_null_on_other_resources(admin, ids):
    p = admin.post(f"{API}/admin/projects", json={"name": "TEST_I5Proj", "category": "Civil", "status": "ongoing", "published": False})
    assert p.status_code == 201
    pid = p.json()["id"]
    ids["projects"].append(pid)
    for body in ({"featured": None}, {"published": None}, {"images": None}, {"status": None}):
        u = admin.put(f"{API}/admin/projects/{pid}", json=body)
        assert u.status_code == 422, (body, u.status_code, u.text)
    # Optional date may be null
    assert admin.put(f"{API}/admin/projects/{pid}", json={"start_date": None}).status_code == 200
    assert admin.get(f"{API}/admin/projects").status_code == 200
    assert requests.get(f"{API}/projects").status_code == 200
    c = admin.post(f"{API}/admin/clients", json={"name": "TEST_I5Client", "show_on_website": False})
    assert c.status_code == 201, c.text
    cid = c.json()["id"]
    ids["clients"].append(cid)
    assert admin.put(f"{API}/admin/clients/{cid}", json={"show_on_website": None}).status_code == 422
    j = admin.post(f"{API}/admin/careers", json={"title": "TEST_I5Job", "is_open": False})
    if j.status_code == 201:
        jid = j.json()["id"]
        ids["careers"].append(jid)
        assert admin.put(f"{API}/admin/careers/{jid}", json={"is_open": None}).status_code == 422
        assert admin.put(f"{API}/admin/careers/{jid}", json={"requirements": None}).status_code == 422
    assert admin.get(f"{API}/admin/clients").status_code == 200
    assert admin.get(f"{API}/admin/careers").status_code == 200


# FIX 2: company null -> 422 and GET /company unchanged; valid partial update works
def test_company_null(admin):
    orig = requests.get(f"{API}/company").json()
    for body in ({"tagline": None}, {"name": None}, {"management": None}, {"social_links": None}, {"phone": None}):
        u = admin.put(f"{API}/admin/company", json=body)
        assert u.status_code == 422, (body, u.status_code, u.text)
    g = requests.get(f"{API}/company")
    assert g.status_code == 200 and g.json()["tagline"] == orig["tagline"] and g.json()["name"] == orig["name"]
    ok = admin.put(f"{API}/admin/company", json={"tagline": "TEST_I5 tagline"})
    try:
        assert ok.status_code == 200 and ok.json()["tagline"] == "TEST_I5 tagline" and ok.json()["phone"] == orig["phone"]
    finally:
        admin.put(f"{API}/admin/company", json={"tagline": orig["tagline"]})
    assert requests.get(f"{API}/company").json()["tagline"] == orig["tagline"]


# FIX 3: stored IP is the real egress IP, spoofed XFF ignored
def test_client_ip_real_and_spoof_resistant(ids):
    real = egress_ip()
    e1 = _enquiry(ids, "TEST_I5Ip1")
    e2 = _enquiry(ids, "TEST_I5Ip2", {"X-Forwarded-For": "1.2.3.4"})
    e3 = _enquiry(ids, "TEST_I5Ip3", {"X-Forwarded-For": "1.1.1.1, 2.2.2.2, 3.3.3.3"})
    stored = [mdb.enquiries.find_one({"_id": ObjectId(i)})["ip"] for i in (e1, e2, e3)]
    assert len(set(stored)) == 1, stored
    assert stored[0] != LB_IP
    if real:
        assert stored[0] == real, (stored, real)


# FIX 3: rate limit 10/hr still triggers 429 with the real IP even when XFF is rotated
def test_rate_limit_real_ip(ids):
    probe = _enquiry(ids, "TEST_I5RateProbe")
    ip = mdb.enquiries.find_one({"_id": ObjectId(probe)})["ip"]
    pre = mdb.enquiries.count_documents({"ip": ip})
    codes = []
    for i in range(11 - pre):
        r = requests.post(f"{API}/enquiries", json={"name": "TEST_I5Rate", "phone": "9876543210", "message": "rate limit"},
                          headers={"X-Forwarded-For": f"9.9.{i}.{i}"})
        codes.append(r.status_code)
        if r.status_code == 201:
            ids["enquiries"].append(r.json()["id"])
    assert codes[-1] == 429 and codes.count(201) == 10 - pre, (pre, codes)
    mdb.enquiries.delete_many({"_id": {"$in": [ObjectId(i) for i in ids["enquiries"]]}})
    ids["enquiries"].clear()
    assert requests.post(f"{API}/enquiries", json={"name": "TEST_I5After", "phone": "9876543210", "message": "after clear"}).status_code == 201
    mdb.enquiries.delete_many({"name": "TEST_I5After", "ip": ip})
