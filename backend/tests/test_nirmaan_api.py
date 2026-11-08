# Nirmaan Enterprises backend regression tests: health, public reads, auth, admin CRUD, enquiries, applications, company/content, stats
import os
import uuid

import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "nirmanprojectsgroup@gmail.com"
ADMIN_PASSWORD = "Nirmaan@eapuz6iAjBXt"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def fake_ip():
    return f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def created():
    items = []
    yield items


@pytest.fixture(scope="module", autouse=True)
def cleanup(created):
    yield
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    for path in created:
        s.delete(f"{API}/admin/{path}")


# Health + public reads
class TestPublic:
    def test_health(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200 and r.json()["database"] == "connected"

    def test_services(self):
        r = requests.get(f"{API}/services")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 8 and all(s["active"] for s in data)
        assert "_id" not in data[0] and isinstance(data[0]["id"], str)
        one = requests.get(f"{API}/services/{data[0]['id']}")
        assert one.status_code == 200 and one.json()["slug"] == data[0]["slug"]
        assert requests.get(f"{API}/services/badid").status_code == 404

    def test_company_and_content(self):
        r = requests.get(f"{API}/company")
        assert r.status_code == 200 and r.json()["name"] == "Nirmaan Enterprises"
        assert len(r.json()["management"]) >= 2
        c = requests.get(f"{API}/content")
        assert c.status_code == 200 and any(x["key"] == "home.hero" for x in c.json())
        h = requests.get(f"{API}/content/home.hero")
        assert h.status_code == 200 and "line1_en" in h.json()["value"]
        assert requests.get(f"{API}/content/nope.none").status_code == 404

    def test_lists(self):
        for p in ("projects", "clients", "careers"):
            r = requests.get(f"{API}/{p}")
            assert r.status_code == 200 and isinstance(r.json(), list)


# Auth
class TestAuth:
    def test_login_cookies_me_refresh_logout(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200 and r.json()["email"] == ADMIN_EMAIL and r.json()["role"] == "admin"
        sc = r.headers.get("set-cookie", "").lower()
        assert "access_token" in sc and "refresh_token" in sc and "httponly" in sc and "secure" in sc and "samesite=none" in sc
        assert "password_hash" not in r.json()
        assert s.get(f"{API}/auth/me").status_code == 200
        rf = s.post(f"{API}/auth/refresh")
        assert rf.status_code == 200 and rf.json()["email"] == ADMIN_EMAIL
        # Bearer
        tok = s.cookies.get("access_token")
        b = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert b.status_code == 200
        lo = s.post(f"{API}/auth/logout")
        assert lo.status_code == 200
        assert s.get(f"{API}/auth/me").status_code == 401

    def test_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"},
                          headers={"X-Forwarded-For": fake_ip()})
        assert r.status_code == 401

    def test_lockout(self):
        email = f"test_lockout_{uuid.uuid4().hex[:6]}@x.com"
        h = {"X-Forwarded-For": fake_ip()}
        codes = [requests.post(f"{API}/auth/login", json={"email": email, "password": "bad"}, headers=h).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429, codes
        # client_ip is now the right-most XFF (ingress IP), so clean ip:email and email: keys for this test email
        mdb.login_attempts.delete_many({"identifier": {"$regex": f":{email.replace('.', '[.]')}$"}})

    def test_bcrypt_hash(self):
        u = mdb.admin_users.find_one({"email": ADMIN_EMAIL})
        assert u["password_hash"].startswith("$2b$")
        assert mdb.admin_users.count_documents({}) == 1

    def test_admin_requires_auth(self):
        for p in ("services", "projects", "clients", "careers", "enquiries", "applications", "stats"):
            assert requests.get(f"{API}/admin/{p}").status_code == 401, p
        assert requests.put(f"{API}/admin/company", json={"tagline": "x"}).status_code == 401
        assert requests.put(f"{API}/admin/content/test_x", json={"value": 1}).status_code == 401
        assert requests.post(f"{API}/admin/services", json={}).status_code == 401


# Admin CRUD
class TestAdminCrud:
    def test_service_crud_and_dup_slug(self, admin, created):
        slug = f"test-svc-{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{API}/admin/services", json={"slug": slug, "title_en": "TEST_Service", "active": False})
        assert r.status_code == 201, r.text
        sid = r.json()["id"]
        created.append(f"services/{sid}")
        assert admin.post(f"{API}/admin/services", json={"slug": slug, "title_en": "TEST_Dup"}).status_code == 409
        # inactive not public
        assert requests.get(f"{API}/services/{sid}").status_code == 404
        u = admin.put(f"{API}/admin/services/{sid}", json={"title_en": "TEST_Service2"})
        assert u.status_code == 200 and u.json()["title_en"] == "TEST_Service2" and u.json()["slug"] == slug
        g = admin.get(f"{API}/admin/services/{sid}")
        assert g.json()["title_en"] == "TEST_Service2"
        d = admin.delete(f"{API}/admin/services/{sid}")
        assert d.status_code == 200
        assert admin.get(f"{API}/admin/services/{sid}").status_code == 404
        assert admin.get(f"{API}/admin/services/notanid").status_code == 404
        assert admin.delete(f"{API}/admin/services/notanid").status_code == 404

    def test_project_crud_validation(self, admin, created):
        base = {"name": "TEST_Project", "category": "Civil", "status": "ongoing"}
        assert admin.post(f"{API}/admin/projects", json={**base, "start_date": "2025-05-01", "completion_date": "2025-01-01"}).status_code == 422
        assert admin.post(f"{API}/admin/projects", json={**base, "start_date": "2025-13-45"}).status_code == 422
        assert admin.post(f"{API}/admin/projects", json={**base, "status": "paused"}).status_code == 422
        r = admin.post(f"{API}/admin/projects", json={**base, "start_date": "2025-01-01", "published": True})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        created.append(f"projects/{pid}")
        assert any(p["id"] == pid for p in requests.get(f"{API}/projects").json())
        assert admin.put(f"{API}/admin/projects/{pid}", json={"completion_date": "2024-01-01"}).status_code == 422
        assert admin.put(f"{API}/admin/projects/{pid}", json={"status": "bad"}).status_code == 422
        u = admin.put(f"{API}/admin/projects/{pid}", json={"status": "completed", "completion_date": "2025-06-01", "published": False})
        assert u.status_code == 200 and u.json()["status"] == "completed"
        assert not any(p["id"] == pid for p in requests.get(f"{API}/projects").json())
        assert admin.put(f"{API}/admin/projects/{pid}", json={}).status_code == 400
        assert admin.delete(f"{API}/admin/projects/{pid}").status_code == 200

    def test_client_public_fields(self, admin, created):
        r = admin.post(f"{API}/admin/clients", json={"name": "TEST_Client", "sector": "Gov", "phone": "9999999999",
                                                     "email": "c@x.com", "notes": "secret", "contact_person": "Bob", "show_on_website": True})
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
        created.append(f"clients/{cid}")
        pub = [c for c in requests.get(f"{API}/clients").json() if c["id"] == cid]
        assert len(pub) == 1
        assert set(pub[0].keys()) == {"id", "name", "company_name", "sector", "description", "logo_url", "website"}, pub[0].keys()
        one = requests.get(f"{API}/clients/{cid}").json()
        assert "phone" not in one and "notes" not in one
        assert admin.post(f"{API}/admin/clients", json={"name": "TEST_C2", "email": "bad"}).status_code == 422
        assert admin.delete(f"{API}/admin/clients/{cid}").status_code == 200

    def test_career_crud(self, admin, created):
        r = admin.post(f"{API}/admin/careers", json={"title": "TEST_Job", "requirements": ["a"]})
        assert r.status_code == 201
        jid = r.json()["id"]
        created.append(f"careers/{jid}")
        assert any(j["id"] == jid for j in requests.get(f"{API}/careers").json())
        admin.put(f"{API}/admin/careers/{jid}", json={"is_open": False})
        assert not any(j["id"] == jid for j in requests.get(f"{API}/careers").json())
        assert admin.delete(f"{API}/admin/careers/{jid}").status_code == 200


# Enquiries & applications
class TestSubmissions:
    def test_enquiry_validation(self):
        h = {"X-Forwarded-For": fake_ip()}
        good = {"name": "TEST_Enq", "phone": "+91 98765 43210", "email": "", "message": "Need a building"}
        for bad in ({"name": "A"}, {"phone": "123"}, {"email": "bad"}, {"message": "hi"}, {"phone": "abcdefghij"}):
            r = requests.post(f"{API}/enquiries", json={**good, **bad}, headers=h)
            assert r.status_code == 422, (bad, r.status_code)

    def test_enquiry_flow(self, admin, created):
        h = {"X-Forwarded-For": fake_ip()}
        r = requests.post(f"{API}/enquiries", json={"name": "TEST_Enq", "phone": "9876543210", "email": "",
                                                    "message": "Need a building", "service": "civil"}, headers=h)
        assert r.status_code == 201, r.text
        eid = r.json()["id"]
        created.append(f"enquiries/{eid}")
        doc = mdb.enquiries.find_one({"_id": ObjectId(eid)})
        assert doc and doc["name"] == "TEST_Enq" and doc["status"] == "new" and doc["email"] is None
        lst = admin.get(f"{API}/admin/enquiries?status=new").json()
        assert any(e["id"] == eid for e in lst) and all(e["status"] == "new" for e in lst)
        u = admin.put(f"{API}/admin/enquiries/{eid}", json={"status": "completed", "admin_notes": "called"})
        assert u.status_code == 200 and u.json()["status"] == "completed" and u.json()["admin_notes"] == "called"
        assert admin.put(f"{API}/admin/enquiries/{eid}", json={"status": "bogus"}).status_code == 422
        assert admin.delete(f"{API}/admin/enquiries/{eid}").status_code == 200
        assert mdb.enquiries.find_one({"_id": ObjectId(eid)}) is None

    def test_enquiry_rate_limit(self, created):
        # client_ip is the real client IP (TRUSTED_PROXY_HOPS); XFF spoofing is ignored, so account for existing docs in the bucket
        h = {"X-Forwarded-For": fake_ip()}
        codes = []
        ip = None
        for i in range(11):
            r = requests.post(f"{API}/enquiries", json={"name": "TEST_Rate", "phone": "9876543210", "message": "rate test"}, headers=h)
            codes.append(r.status_code)
            if r.status_code == 201:
                created.append(f"enquiries/{r.json()['id']}")
                ip = ip or mdb.enquiries.find_one({"_id": ObjectId(r.json()["id"])})["ip"]
            else:
                break
        assert codes[-1] == 429 and ip is not None, codes
        assert mdb.enquiries.count_documents({"ip": ip}) == 10

    def test_application_flow(self, admin, created):
        h = {"X-Forwarded-For": fake_ip()}
        assert requests.post(f"{API}/applications", json={"name": "TEST_App", "phone": "12"}, headers=h).status_code == 422
        r = requests.post(f"{API}/applications", json={"position": "Site Engineer", "job_id": "j1", "name": "TEST_App",
                                                       "phone": "9876543210", "email": "a@b.com", "message": "5 yrs"}, headers=h)
        assert r.status_code == 201, r.text
        aid = r.json()["id"]
        created.append(f"applications/{aid}")
        assert any(a["id"] == aid for a in admin.get(f"{API}/admin/applications").json())
        u = admin.put(f"{API}/admin/applications/{aid}", json={"status": "shortlisted"})
        assert u.status_code == 200 and u.json()["status"] == "shortlisted"
        assert admin.delete(f"{API}/admin/applications/{aid}").status_code == 200


# Company, content, stats
class TestCompanyContent:
    def test_company_partial_update(self, admin):
        orig = requests.get(f"{API}/company").json()["tagline"]
        r = admin.put(f"{API}/admin/company", json={"tagline": "TEST_tagline"})
        assert r.status_code == 200 and r.json()["tagline"] == "TEST_tagline" and r.json()["name"] == "Nirmaan Enterprises"
        assert requests.get(f"{API}/company").json()["tagline"] == "TEST_tagline"
        admin.put(f"{API}/admin/company", json={"tagline": orig})
        assert requests.get(f"{API}/company").json()["tagline"] == orig
        assert admin.put(f"{API}/admin/company", json={}).status_code == 400

    def test_content_upsert_delete(self, admin):
        key = f"test_{uuid.uuid4().hex[:6]}"
        r = admin.put(f"{API}/admin/content/{key}", json={"value": {"a": 1}})
        assert r.status_code == 200 and r.json()["value"] == {"a": 1}
        r2 = admin.put(f"{API}/admin/content/{key}", json={"value": [1, 2]})
        assert r2.json()["value"] == [1, 2] and r2.json()["id"] == r.json()["id"]
        assert requests.get(f"{API}/content/{key}").json()["value"] == [1, 2]
        assert admin.put(f"{API}/admin/content/BAD KEY!", json={"value": 1}).status_code in (404, 422)
        assert admin.delete(f"{API}/admin/content/{key}").status_code == 200
        assert requests.get(f"{API}/content/{key}").status_code == 404

    def test_stats(self, admin):
        r = admin.get(f"{API}/admin/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("services", "projects", "clients", "careers", "enquiries", "applications", "new_enquiries"):
            assert isinstance(d[k], int)
        assert d["services"] >= 8
