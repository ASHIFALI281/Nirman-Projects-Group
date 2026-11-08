import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from core import db, utcnow

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
EMAIL_RE = re.compile(r"^[^@\s\[\]]+@[^@\s\[\]]+\.[a-z]{2,}$", re.I)

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    if not EMAIL_KEY:
        raise HTTPException(status_code=503, detail="Email is not configured")
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code}): {e.response.json().get('message', '')}")
            raise HTTPException(status_code=503, detail=f"Email is temporarily unavailable ({code})")
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send email")


async def notification_recipient() -> str:
    company = await db.company_info.find_one({"key": "company"}) or {}
    email = (company.get("email") or "").strip()
    return email if EMAIL_RE.match(email) else os.environ["NOTIFY_EMAIL"]


def _row(label: str, value: str) -> str:
    return (f'<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;vertical-align:top;width:150px">{escape(label)}</td>'
            f'<td style="padding:6px 0;color:#0B1F3A;font-size:14px">{value}</td></tr>')


def enquiry_html(e: dict) -> str:
    email = escape(e.get("email") or "")
    phone = escape(e.get("phone", ""))
    rows = [
        _row("Enquiry ID", f"<strong>{escape(e.get('enquiry_no', ''))}</strong>"),
        _row("Received", escape(e["created_at"].strftime("%d %b %Y, %H:%M UTC"))),
        _row("Name", escape(e.get("name", ""))),
        _row("Company", escape(e.get("company_name") or "—")),
        _row("Mobile", f'<a href="tel:{phone}" style="color:#EA580C">{phone}</a>'),
        _row("Email", f'<a href="mailto:{email}" style="color:#EA580C">{email}</a>' if email else "—"),
        _row("Service", escape(e.get("service_label") or e.get("service") or "—")),
        _row("Location", escape(e.get("location") or "—")),
        _row("Budget", escape(e.get("budget") or "—")),
        _row("Message", escape(e.get("message", "")).replace("\n", "<br>")),
    ]
    return ('<table role="presentation" width="100%" style="background:#f1f5f9;padding:24px 0"><tr><td align="center">'
            '<table role="presentation" width="600" style="background:#ffffff;font-family:Arial,sans-serif">'
            f'<tr><td style="background:#0B1F3A;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold">{escape(EMAIL_FROM_NAME)}'
            '<div style="color:#F97316;font-size:12px;font-weight:normal;margin-top:4px">New website enquiry</div></td></tr>'
            f'<tr><td style="padding:24px"><table role="presentation" width="100%">{"".join(rows)}</table>'
            '<p style="margin-top:20px;font-size:13px;color:#64748b">Log in to the admin dashboard to update the status of this enquiry.</p></td></tr>'
            f'<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Automatic notification from the {escape(EMAIL_FROM_NAME)} website.</td></tr>'
            '</table></td></tr></table>')


async def notify_new_enquiry(enquiry_id, doc: dict) -> None:
    update = {"email_status": "sent", "email_error": "", "email_sent_at": utcnow()}
    try:
        to = await notification_recipient()
        await send_email(to=to, subject=f"New enquiry {doc.get('enquiry_no', '')} — {doc.get('name', '')}", html=enquiry_html(doc))
        update["email_to"] = to
    except HTTPException as exc:
        update = {"email_status": "failed", "email_error": str(exc.detail)}
    except Exception as exc:
        logger.error("Enquiry notification failed: %s", exc)
        update = {"email_status": "failed", "email_error": "Unexpected error"}
    await db.enquiries.update_one({"_id": enquiry_id}, {"$set": update})


def test_email_html() -> str:
    return ('<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0B1F3A">'
            f'<p><strong>{escape(EMAIL_FROM_NAME)}</strong> — enquiry email alerts are working.</p>'
            '<p style="font-size:13px;color:#64748b">You will receive an email like this for every new website enquiry.</p>'
            f'<p style="font-size:11px;color:#94a3b8">Sent from the {escape(EMAIL_FROM_NAME)} admin dashboard.</p></td></tr></table>')
