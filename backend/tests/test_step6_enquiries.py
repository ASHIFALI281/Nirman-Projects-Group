# Step 6: contact/enquiry system - validation, enquiry_no, duplicate, honeypot, rate limit, email, admin CRUD
# NOTE: each valid enquiry sends a REAL email. This file sends exactly ONE valid enquiry + ONE test email.
import os
import re
import time
import uuid
from datetime import datetime

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "nirmanprojectsgroup@gmail.com", "password": "Nirmaan@eapuz6iAjBXt"}
mongo = MongoClient("mongodb://localhost:27017")["test_database"]
STATE = {}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    return s


def valid_payload(**kw):
    p = {"name": "TEST_Step6 Backend", "company_name": "TEST Co", "phone": "+91 98765 43210", "email": "test6@example.com",
         "service": "civil", "location": "TEST Lucknow", "budget": "₹5 – 25 Lakh",
         "message": f"TEST backend enquiry {uuid.uuid4().hex[:6]}", "source": "contact", "client_token": uuid.uuid4().hex}
    p.update(kw)
    return p


# Validation (no DB writes, no emails)
class TestValidation:
    @pytest.mark.parametrize("phone", ["12345", "1234567890", "abc9876543", ""])
    def test_invalid_mobile(self, phone):
        r = requests.post(f"{API}/enquiries", json=valid_payload(phone=phone))
        assert r.status_code == 422, r.text

    def test_invalid_email(self):
        r = requests.post(f"{API}/enquiries", json=valid_payload(email="bad@x"))
        assert r.status_code == 422

    @pytest.mark.parametrize("field", ["name", "location", "message"])
    def test_required_missing(self, field):
        p = valid_payload()
        p.pop(field)
        r = requests.post(f"{API}/enquiries", json=p)
        assert r.status_code == 422

    def test_honeypot(self):
        p = valid_payload(hp="x")
        r = requests.post(f"{API}/enquiries", json=p)
        assert r.status_code == 400
        assert mongo.enquiries.count_documents({"message": p["message"]}) == 0


# Valid submit + duplicate + email + admin
class TestFlow:
    def test_valid_submit(self):
        p = valid_payload()
        r = requests.post(f"{API}/enquiries", json=p)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["status"] == "received"
        assert re.fullmatch(rf"NE-{datetime.utcnow():%Y%m%d}-\d{{4}}", d["enquiry_no"]), d
        STATE.update(payload=p, id=d["id"], no=d["enquiry_no"])
        doc = mongo.enquiries.find_one({"enquiry_no": d["enquiry_no"]})
        assert doc and doc["company_name"] == "TEST Co" and doc["location"] == "TEST Lucknow"
        assert doc["budget"] == p["budget"] and doc["created_at"] and doc["status"] == "new"
        assert doc["phone"] and doc["email"] == p["email"] and doc["service"] == "civil"
        STATE["ip"] = doc["ip"]

    def test_duplicate_same_token(self):
        p = STATE["payload"]
        r = requests.post(f"{API}/enquiries", json=p)
        assert r.status_code == 200
        assert r.json()["status"] == "duplicate" and r.json()["enquiry_no"] == STATE["no"]
        assert mongo.enquiries.count_documents({"message": p["message"]}) == 1

    def test_duplicate_same_phone_message_new_token(self):
        p = {**STATE["payload"], "client_token": uuid.uuid4().hex}
        r = requests.post(f"{API}/enquiries", json=p)
        assert r.status_code == 200 and r.json()["status"] == "duplicate"
        assert mongo.enquiries.count_documents({"message": p["message"]}) == 1

    def test_email_sent(self):
        doc = None
        for _ in range(15):
            doc = mongo.enquiries.find_one({"enquiry_no": STATE["no"]})
            if doc.get("email_status") != "pending":
                break
            time.sleep(1)
        assert doc["email_status"] == "sent", doc.get("email_error")
        assert doc["email_to"] == "nirmanprojectsgroup@gmail.com"

    def test_rate_limit(self):
        ip = STATE["ip"]
        now = datetime.utcnow()
        ids = mongo.enquiries.insert_many([{"name": "TEST_RL", "phone": "9876500000", "message": f"TEST rl {i}", "ip": ip,
                                            "created_at": now, "status": "new"} for i in range(10)]).inserted_ids
        try:
            p = valid_payload()
            r = requests.post(f"{API}/enquiries", json=p)
            assert r.status_code == 429, r.text
            assert mongo.enquiries.count_documents({"message": p["message"]}) == 0
        finally:
            mongo.enquiries.delete_many({"_id": {"$in": ids}})

    def test_email_status(self, admin):
        r = admin.get(f"{API}/admin/email/status")
        assert r.status_code == 200
        d = r.json()
        assert d["configured"] is True and d["recipient"] == "nirmanprojectsgroup@gmail.com"

    def test_email_status_unauth(self):
        assert requests.get(f"{API}/admin/email/status").status_code == 401

    def test_email_test_once(self, admin):
        r = admin.post(f"{API}/admin/email/test")
        assert r.status_code == 200, r.text
        assert r.json()["sent"] is True

    def test_admin_list_and_update(self, admin):
        r = admin.get(f"{API}/admin/enquiries")
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        mine = [e for e in items if e.get("enquiry_no") == STATE["no"]]
        assert mine and mine[0]["location"] == "TEST Lucknow"
        assert "ip" not in mine[0] and "client_token" not in mine[0], "internal fields leaked to admin"
        for st in ["contacted", "in_progress", "completed"]:
            u = admin.put(f"{API}/admin/enquiries/{STATE['id']}", json={"status": st})
            assert u.status_code == 200 and u.json()["status"] == st
        assert admin.put(f"{API}/admin/enquiries/{STATE['id']}", json={"status": "bogus"}).status_code == 422
        assert admin.get(f"{API}/admin/enquiries/{STATE['id']}").json()["status"] == "completed"

    def test_stats(self, admin):
        s = admin.get(f"{API}/admin/stats").json()
        assert s["enquiries"] == mongo.enquiries.count_documents({})

    def test_application_regression(self):
        r = requests.post(f"{API}/applications", json={"position": "TEST Engineer", "name": "TEST_Applicant", "phone": "9876543210", "message": "TEST"})
        assert r.status_code == 201
        STATE["app_id"] = r.json()["id"]

    def test_delete(self, admin):
        r = admin.delete(f"{API}/admin/enquiries/{STATE['id']}")
        assert r.status_code in (200, 204)
        assert admin.get(f"{API}/admin/enquiries/{STATE['id']}").status_code == 404
        if STATE.get("app_id"):
            assert admin.delete(f"{API}/admin/applications/{STATE['app_id']}").status_code in (200, 204)
