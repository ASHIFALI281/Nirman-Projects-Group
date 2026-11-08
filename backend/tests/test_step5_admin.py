# Step 5 admin dashboard backend tests: uploads, files, new statuses, client company_name, stats
import io
import os
import struct
import zlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "nirmanprojectsgroup@gmail.com"
PASSWORD = "Nirmaan@eapuz6iAjBXt"


def png_bytes():
    raw = b"\x00" + b"\xff\x00\x00" * 4
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return s


@pytest.fixture(scope="module")
def created():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, created):
    yield
    for res, i in created:
        admin.delete(f"{BASE_URL}/api/admin/{res}/{i}")


# Uploads
class TestUploads:
    def test_upload_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/uploads", files={"file": ("a.png", png_bytes(), "image/png")})
        assert r.status_code == 401

    def test_upload_png_and_serve(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/uploads", files={"file": ("TEST_a.png", png_bytes(), "image/png")})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["url"].startswith("/api/files/") and d["path"] in d["url"]
        f = requests.get(f"{BASE_URL}{d['url']}")
        assert f.status_code == 200
        assert f.headers["content-type"].startswith("image/png")
        assert f.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_upload_bad_type(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/uploads", files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 400

    def test_upload_spoofed_magic(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/uploads", files={"file": ("a.png", b"notreallyapng" * 10, "image/png")})
        assert r.status_code == 400

    def test_upload_too_large(self, admin):
        data = png_bytes() + b"\x00" * (5 * 1024 * 1024 + 10)
        r = admin.post(f"{BASE_URL}/api/admin/uploads", files={"file": ("big.png", data, "image/png")})
        assert r.status_code == 413

    def test_file_not_found(self):
        r = requests.get(f"{BASE_URL}/api/files/nirmaan-enterprises/uploads/nope.png")
        assert r.status_code == 404


# Statuses + client company_name + stats
class TestRecords:
    def test_enquiry_statuses(self, admin, created):
        r = requests.post(f"{BASE_URL}/api/enquiries", json={"name": "TEST_Enq", "phone": "9876543210", "message": "TEST message here"})
        assert r.status_code == 201
        eid = r.json()["id"]
        created.append(("enquiries", eid))
        for st in ["contacted", "in_progress", "completed", "new"]:
            u = admin.put(f"{BASE_URL}/api/admin/enquiries/{eid}", json={"status": st})
            assert u.status_code == 200 and u.json()["status"] == st
        bad = admin.put(f"{BASE_URL}/api/admin/enquiries/{eid}", json={"status": "closed"})
        assert bad.status_code == 422

    def test_application_statuses(self, admin, created):
        r = requests.post(f"{BASE_URL}/api/applications", json={"position": "Site Engineer", "name": "TEST_App", "phone": "9876543210"})
        assert r.status_code == 201
        aid = r.json()["id"]
        created.append(("applications", aid))
        for st in ["reviewing", "shortlisted", "rejected", "new"]:
            u = admin.put(f"{BASE_URL}/api/admin/applications/{aid}", json={"status": st})
            assert u.status_code == 200 and u.json()["status"] == st
        assert admin.put(f"{BASE_URL}/api/admin/applications/{aid}", json={"status": "contacted"}).status_code == 422

    def test_client_company_name_public(self, admin, created):
        r = admin.post(f"{BASE_URL}/api/admin/clients", json={"name": "TEST_Client", "company_name": "TEST_Co Pvt", "show_on_website": True, "notes": "secret"})
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        created.append(("clients", cid))
        pub = requests.get(f"{BASE_URL}/api/clients").json()
        mine = [c for c in pub if c["id"] == cid]
        assert mine and mine[0]["company_name"] == "TEST_Co Pvt" and "notes" not in mine[0]

    def test_stats_counts(self, admin, created):
        before = admin.get(f"{BASE_URL}/api/admin/stats").json()
        r = admin.post(f"{BASE_URL}/api/admin/projects", json={"name": "TEST_Proj", "category": "Civil Construction", "status": "ongoing"})
        assert r.status_code in (200, 201), r.text
        created.append(("projects", r.json()["id"]))
        after = admin.get(f"{BASE_URL}/api/admin/stats").json()
        assert after["projects"] == before["projects"] + 1
        assert after["ongoing_projects"] == before["ongoing_projects"] + 1
        for k in ["services", "clients", "enquiries", "new_enquiries", "applications"]:
            assert isinstance(after[k], int)

    def test_project_date_validation(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/projects", json={"name": "TEST_Bad", "category": "Civil", "status": "ongoing",
                                                                 "start_date": "2025-05-01", "completion_date": "2025-01-01"})
        assert r.status_code == 422
