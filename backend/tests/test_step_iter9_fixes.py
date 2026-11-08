# Iteration 9: retest enquiry fixes (phone_key dedupe, atomic client_token dedupe, per-day counter, email status, admin list)
import os
import re
import time
import uuid
import concurrent.futures as cf
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
ADMIN = {"email": "nirmanprojectsgroup@gmail.com", "password": "Nirmaan@eapuz6iAjBXt"}
CREATED = []


def payload(phone, msg, token=None, name="TEST_Iter9"):
    p = {"name": name, "phone": phone, "service": "", "location": "TEST_Pune", "message": msg, "source": "contact"}
    svc = requests.get(f"{BASE_URL}/api/services").json()
    p["service"] = svc[0]["slug"] if svc else "residential"
    if token:
        p["client_token"] = token
    return p


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for i in CREATED:
        mongo.enquiries.delete_one({"_id": ObjectId(i)})


# Duplicate detection by normalised phone (phone_key)
def test_phone_format_duplicate():
    msg = f"TEST_iter9 phone-format dup {uuid.uuid4().hex[:6]}"
    r1 = requests.post(f"{BASE_URL}/api/enquiries", json=payload("9876501234", msg, str(uuid.uuid4())))
    assert r1.status_code == 201, r1.text
    d1 = r1.json()
    CREATED.append(d1["id"])
    assert d1["status"] == "received"
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    assert re.fullmatch(rf"NE-{day}-\d{{4}}", d1["enquiry_no"]), d1["enquiry_no"]
    doc = mongo.enquiries.find_one({"_id": ObjectId(d1["id"])})
    assert doc["phone_key"] == "9876501234"
    r2 = requests.post(f"{BASE_URL}/api/enquiries", json=payload("+91 98765 01234", msg, str(uuid.uuid4())))
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["status"] == "duplicate" and d2["enquiry_no"] == d1["enquiry_no"] and d2["id"] == d1["id"]
    assert mongo.enquiries.count_documents({"message": msg}) == 1


# Per-day counter doc
def test_counter_per_day():
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    c = mongo.counters.find_one({"_id": f"enquiry-{day}"})
    assert c is not None and c["seq"] >= 1
    assert mongo.counters.find_one({"_id": "enquiry"}) is None


# Concurrent same client_token -> one record, other 200 duplicate
def test_concurrent_same_token():
    token = str(uuid.uuid4())
    msg = f"TEST_iter9 concurrent {uuid.uuid4().hex[:6]}"
    body = payload("9123456780", msg, token, name="TEST_Concurrent")
    with cf.ThreadPoolExecutor(max_workers=2) as ex:
        futs = [ex.submit(requests.post, f"{BASE_URL}/api/enquiries", json=body) for _ in range(2)]
        res = [f.result() for f in futs]
    codes = sorted(r.status_code for r in res)
    print("codes", codes, [r.text for r in res])
    for r in res:
        if r.status_code in (200, 201) and r.json()["id"] not in CREATED:
            CREATED.append(r.json()["id"])
    assert 500 not in codes
    assert codes == [200, 201], codes
    nos = {r.json()["enquiry_no"] for r in res}
    assert len(nos) == 1
    assert mongo.enquiries.count_documents({"client_token": token}) == 1


# Email status + admin list regression
def test_email_sent_and_admin_list(admin):
    assert CREATED
    time.sleep(8)
    for i in CREATED:
        doc = mongo.enquiries.find_one({"_id": ObjectId(i)})
        assert doc.get("email_status") == "sent", doc.get("email_status")
    r = admin.get(f"{BASE_URL}/api/admin/enquiries")
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", [])
    ids = {x["id"] for x in items}
    for i in CREATED:
        assert i in ids
    assert all("_id" not in x for x in items)
