# Media Library & photo management backend tests (upload/list/update/replace/delete/usage/public serve)
import io
import os

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "nirmanprojectsgroup@gmail.com"
PASSWORD = "Nirmaan@eapuz6iAjBXt"


def img_bytes(fmt="JPEG", color=(200, 30, 30), size=(64, 48)):
    b = io.BytesIO()
    Image.new("RGB", size, color).save(b, fmt)
    return b.getvalue()


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return s


@pytest.fixture(scope="module")
def media_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, media_ids):
    yield
    for i in media_ids:
        admin.delete(f"{BASE_URL}/api/admin/media/{i}")


def upload(admin, media_ids, name="TEST_a.jpg", fmt="JPEG", ctype="image/jpeg", category="other", color=(200, 30, 30)):
    r = admin.post(f"{BASE_URL}/api/admin/media", files={"file": (name, img_bytes(fmt, color), ctype)}, data={"category": category})
    if r.status_code == 201:
        media_ids.append(r.json()["id"])
    return r


# Upload validation
class TestUpload:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/media", files={"file": ("TEST_x.jpg", img_bytes(), "image/jpeg")})
        assert r.status_code == 401

    @pytest.mark.parametrize("name,fmt,ctype,expected", [
        ("TEST_a.jpg", "JPEG", "image/jpeg", "image/jpeg"),
        ("TEST_b.jpeg", "JPEG", "image/jpeg", "image/jpeg"),
        ("TEST_c.png", "PNG", "image/png", "image/png"),
        ("TEST_d.webp", "WEBP", "image/webp", "image/webp"),
    ])
    def test_accepts_formats(self, admin, media_ids, name, fmt, ctype, expected):
        r = upload(admin, media_ids, name, fmt, ctype, category="hero")
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["content_type"] == expected and d["filename"] == name and d["category"] == "hero"
        assert d["url"] == f"/api/media/{d['id']}" and d["version"] == 1 and d["width"] == 64
        g = requests.get(f"{BASE_URL}{d['url']}")
        assert g.status_code == 200 and g.headers["content-type"].startswith(expected)
        assert g.content[:2] in (b"\xff\xd8", b"\x89P", b"RI")

    def test_rejects_gif(self, admin, media_ids):
        r = upload(admin, media_ids, "TEST_g.gif", "GIF", "image/gif")
        assert r.status_code == 400

    def test_rejects_non_image_renamed(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/media", files={"file": ("TEST_fake.jpg", b"hello not an image" * 50, "image/jpeg")})
        assert r.status_code == 400

    def test_rejects_gif_renamed_jpg(self, admin, media_ids):
        r = upload(admin, media_ids, "TEST_gif.jpg", "GIF", "image/jpeg")
        assert r.status_code == 400

    def test_rejects_over_10mb(self, admin):
        data = img_bytes() + os.urandom(10 * 1024 * 1024)
        r = admin.post(f"{BASE_URL}/api/admin/media", files={"file": ("TEST_big.jpg", data, "image/jpeg")})
        assert r.status_code == 413, r.status_code

    def test_invalid_category(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/media", files={"file": ("TEST_x.jpg", img_bytes(), "image/jpeg")}, data={"category": "bogus"})
        assert r.status_code == 422


# List / search / update
class TestListUpdate:
    def test_search_and_filter(self, admin, media_ids):
        r = upload(admin, media_ids, "TEST_searchme_unique.png", "PNG", "image/png", category="plumbing")
        mid = r.json()["id"]
        l = admin.get(f"{BASE_URL}/api/admin/media", params={"q": "searchme_unique"}).json()
        assert [x["id"] for x in l] == [mid]
        l = admin.get(f"{BASE_URL}/api/admin/media", params={"category": "plumbing"}).json()
        assert mid in [x["id"] for x in l] and all(x["category"] == "plumbing" for x in l)
        l = admin.get(f"{BASE_URL}/api/admin/media", params={"q": "searchme_unique", "category": "ups"}).json()
        assert l == []
        assert requests.get(f"{BASE_URL}/api/admin/media").status_code == 401

    def test_update(self, admin, media_ids):
        mid = upload(admin, media_ids, "TEST_ren.jpg").json()["id"]
        r = admin.put(f"{BASE_URL}/api/admin/media/{mid}", json={"filename": "TEST_renamed.jpg", "category": "ups"})
        assert r.status_code == 200 and r.json()["filename"] == "TEST_renamed.jpg" and r.json()["category"] == "ups"
        l = admin.get(f"{BASE_URL}/api/admin/media", params={"q": "TEST_renamed"}).json()
        assert l[0]["id"] == mid and l[0]["category"] == "ups"
        assert admin.put(f"{BASE_URL}/api/admin/media/{mid}", json={"category": "bad"}).status_code == 422
        assert admin.put(f"{BASE_URL}/api/admin/media/000000000000000000000000", json={"filename": "x.jpg"}).status_code == 404

    def test_public_404(self):
        assert requests.get(f"{BASE_URL}/api/media/000000000000000000000000").status_code == 404
        assert requests.get(f"{BASE_URL}/api/media/notanid").status_code in (400, 404, 422)


# Replace + usage + delete blocking
class TestReplaceDelete:
    def test_replace_same_url(self, admin, media_ids):
        d = upload(admin, media_ids, "TEST_rep.jpg").json()
        g1 = requests.get(f"{BASE_URL}{d['url']}")
        r = admin.post(f"{BASE_URL}/api/admin/media/{d['id']}/replace", files={"file": ("TEST_rep2.png", img_bytes("PNG", (0, 0, 255)), "image/png")})
        assert r.status_code == 200, r.text
        nd = r.json()
        assert nd["url"] == d["url"] and nd["version"] == 2 and nd["content_type"] == "image/png" and nd["used_in"] == []
        g2 = requests.get(f"{BASE_URL}{d['url']}")
        assert g2.headers["content-type"].startswith("image/png") and g2.content != g1.content
        assert g1.headers.get("etag") != g2.headers.get("etag")
        assert requests.post(f"{BASE_URL}/api/admin/media/{d['id']}/replace", files={"file": ("a.jpg", img_bytes(), "image/jpeg")}).status_code == 401
        bad = admin.post(f"{BASE_URL}/api/admin/media/{d['id']}/replace", files={"file": ("x.gif", img_bytes("GIF"), "image/gif")})
        assert bad.status_code == 400

    def test_etag_304(self, admin, media_ids):
        d = upload(admin, media_ids, "TEST_etag.jpg").json()
        g = requests.get(f"{BASE_URL}{d['url']}")
        r = requests.get(f"{BASE_URL}{d['url']}", headers={"If-None-Match": g.headers["etag"]})
        assert r.status_code == 304

    def test_delete_unused(self, admin, media_ids):
        mid = upload(admin, media_ids, "TEST_del.jpg").json()["id"]
        assert requests.delete(f"{BASE_URL}/api/admin/media/{mid}").status_code == 401
        r = admin.delete(f"{BASE_URL}/api/admin/media/{mid}")
        assert r.status_code == 200 and r.json()["deleted"] is True
        assert requests.get(f"{BASE_URL}/api/media/{mid}").status_code == 404
        assert admin.delete(f"{BASE_URL}/api/admin/media/{mid}").status_code == 404

    def test_delete_blocked_slot(self, admin, media_ids):
        d = upload(admin, media_ids, "TEST_slot.jpg").json()
        prev = requests.get(f"{BASE_URL}/api/content/site.images")
        prev_val = prev.json().get("value", {}) if prev.status_code == 200 else None
        try:
            assert admin.put(f"{BASE_URL}/api/admin/content/site.images", json={"value": {**(prev_val or {}), "about.header": d["url"]}}).status_code == 200
            r = admin.delete(f"{BASE_URL}/api/admin/media/{d['id']}")
            assert r.status_code == 409
            used = r.json()["detail"]["used_in"]
            assert any(u["kind"] == "slot" and u["key"] == "about.header" for u in used)
            u = admin.get(f"{BASE_URL}/api/admin/media/{d['id']}/usage").json()
            assert any(x["key"] == "about.header" for x in u)
            rep = admin.post(f"{BASE_URL}/api/admin/media/{d['id']}/replace", files={"file": ("TEST_s2.jpg", img_bytes(color=(1, 200, 1)), "image/jpeg")})
            assert any(x["key"] == "about.header" for x in rep.json()["used_in"])
        finally:
            if prev_val is None:
                admin.delete(f"{BASE_URL}/api/admin/content/site.images")
            else:
                admin.put(f"{BASE_URL}/api/admin/content/site.images", json={"value": prev_val})

    def test_delete_blocked_service(self, admin, media_ids):
        d = upload(admin, media_ids, "TEST_svc.jpg").json()
        svc = [s for s in admin.get(f"{BASE_URL}/api/admin/services", params={"limit": 100}).json() if s["slug"] == "plumbing"][0]
        orig = svc["image_url"]
        try:
            assert admin.put(f"{BASE_URL}/api/admin/services/{svc['id']}", json={"image_url": d["url"]}).status_code == 200
            r = admin.delete(f"{BASE_URL}/api/admin/media/{d['id']}")
            assert r.status_code == 409 and any(u["kind"] == "service" for u in r.json()["detail"]["used_in"])
        finally:
            admin.put(f"{BASE_URL}/api/admin/services/{svc['id']}", json={"image_url": orig})

    def test_delete_blocked_project_and_client(self, admin, media_ids):
        d = upload(admin, media_ids, "TEST_proj.jpg").json()
        p = admin.post(f"{BASE_URL}/api/admin/projects", json={"name": "TEST_media_proj", "category": "Civil", "status": "ongoing", "images": [d["url"]], "published": False})
        assert p.status_code in (200, 201), p.text
        pid = p.json()["id"]
        c = admin.post(f"{BASE_URL}/api/admin/clients", json={"name": "TEST_media_client", "logo_url": d["url"]})
        cid = c.json().get("id") if c.status_code in (200, 201) else None
        try:
            r = admin.delete(f"{BASE_URL}/api/admin/media/{d['id']}")
            assert r.status_code == 409
            kinds = {u["kind"] for u in r.json()["detail"]["used_in"]}
            assert "project" in kinds
            assert cid is None or "client" in kinds
        finally:
            admin.delete(f"{BASE_URL}/api/admin/projects/{pid}")
            if cid:
                admin.delete(f"{BASE_URL}/api/admin/clients/{cid}")
        assert admin.delete(f"{BASE_URL}/api/admin/media/{d['id']}").status_code == 200
