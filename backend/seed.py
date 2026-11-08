import logging
import os

from core import db, hash_password, utcnow
from models import CompanyInfo, Service

logger = logging.getLogger(__name__)

COMPANY = {
    "key": "company",
    "name": "Nirman Projects Group",
    "tagline": "Building Trust Through Quality Construction and Infrastructure Solutions.",
    "phone": "[+91 XXXXX XXXXX]",
    "email": "nirmanprojectsgroup@gmail.com",
    "whatsapp": "[WhatsApp number]",
    "address": "[Registered office address to be provided]",
    "working_hours": "Mon – Sat, 9:30 AM – 6:30 PM",
    "gst_number": "",
    "founded_year": "2026",
    "about": "Nirman Projects Group is a professional construction, electrical,mechanical and material supply company.",
    "vision": "To be a trusted name in construction and infrastructure, known for quality workmanship, safe sites and on-time delivery.",
    "mission": "To deliver complete construction solutions through one accountable team, with transparency at every step.",
    "management": [
        {"name": "Ashif Ali", "role": "GM", "about": "Provides overall leadership and direction to the company and oversees key client relationships and project commitments."},
        {"name": "Soeb Aktar", "role": "Manager", "about": "Coordinates day-to-day business operations, project planning, client communication and site teams."},
        {"name": "Nausad (Rajan)", "role": "Operations Manager", "about": "Oversees tactical execution, and drives productivity, quality, and profitability across departments"},
    ],
}

SERVICES = [
    ("civil", "Civil Construction", "सिविल निर्माण", "Foundations, RCC structures, buildings and site development.", "civil",
     "End-to-end civil works from excavation and foundations to RCC framing, masonry and finishing, executed to approved drawings and specifications.",
     ["Foundations & structural RCC work", "Buildings and boundary walls", "Roads, drains and site development", "Renovation and repair works"]),
    ("electrical", "Electrical Installation & Maintenance", "इलेक्ट्रिकल इंस्टॉलेशन एवं रखरखाव", "Wiring, panels, earthing, lighting and maintenance.", "electrical",
     "Safe, standards-compliant electrical installation for residential, commercial and institutional buildings, followed by planned maintenance.",
     ["Internal & external wiring", "LT panels and distribution boards", "Earthing and lightning protection", "Preventive & breakdown maintenance"]),
    ("building", "Building Construction", "भवन निर्माण", "Residential and commercial buildings, delivered turnkey.", "residential",
     "Residential and commercial building construction with one team handling structure, electrical, plumbing and carpentry.",
     ["Independent houses & villas", "Commercial and institutional buildings", "Turnkey construction & finishing", "Extensions and renovations"]),
    ("government", "Government Infrastructure Projects", "सरकारी इंफ्रास्ट्रक्चर परियोजनाएँ", "Public civil and electrical works to departmental specifications.", "government",
     "Execution of public infrastructure works as per departmental specifications, with disciplined documentation, measurement and billing support.",
     ["Civil and electrical public works", "Public building works", "Compliance with departmental specifications", "Documentation and billing support"]),
    ("material", "Material Supply", "सामग्री आपूर्ति", "Cement, steel, aggregates and site material logistics.", "material",
     "Reliable sourcing and on-time delivery of construction materials so your site never stops for want of supply.",
     ["Cement, steel and aggregates", "Bricks, blocks and sand", "Electrical and plumbing materials", "Site delivery coordination"]),
    ("plumbing", "Plumbing", "प्लंबिंग", "Water supply, drainage and sanitary installations.", "plumbing",
     "Leak-free water supply, drainage and sanitation systems designed for long service life and easy maintenance.",
     ["Water supply lines", "Drainage & sanitation", "Bathroom & kitchen fittings", "Water tank and pump installation"]),
    ("carpentry", "Carpentry", "कारपेंट्री", "Doors, windows, furniture and shuttering work.", "carpentry",
     "Skilled carpentry for structural formwork as well as fine finishing — doors, frames, wardrobes and custom furniture.",
     ["Doors, windows & frames", "Modular furniture and wardrobes", "Shuttering & formwork", "Wooden flooring and panelling"]),
    ("ups", "UPS & Electrical Solutions", "UPS एवं इलेक्ट्रिकल समाधान", "UPS, inverters, battery banks and power backup.", "ups",
     "Uninterrupted power for homes, offices and institutions — supply, installation and maintenance of UPS and backup systems.",
     ["UPS and inverter installation", "Battery banks & power backup", "Stabilizers and power conditioning", "Maintenance support"]),
]

DETAILS = {
    "civil": ("नींव, RCC संरचना, भवन और साइट विकास।", "Our site teams work from approved structural drawings, follow a stage-wise quality checklist — excavation, reinforcement, shuttering, concreting and curing — and keep the client informed through regular progress updates."),
    "electrical": ("वायरिंग, पैनल, अर्थिंग, लाइटिंग और रखरखाव।", "Every installation is tested before handover. Maintenance visits cover inspection, load checks, fault rectification and replacement of worn components."),
    "building": ("आवासीय और व्यावसायिक भवन, टर्नकी आधार पर।", "We plan the work in clear phases, share a schedule before starting, and hand over with finishing, fittings and services completed and checked."),
    "government": ("विभागीय मानकों के अनुसार सार्वजनिक सिविल एवं इलेक्ट्रिकल कार्य।", "We work to the work order, approved drawings and specification schedule, maintain site records and measurement books, and coordinate with the engineer-in-charge for inspections."),
    "material": ("सीमेंट, स्टील, गिट्टी और साइट सामग्री आपूर्ति।", "Quantities are coordinated with the site schedule and every delivery is checked against the order. Supply is available for our own projects and for client-managed sites on request."),
    "plumbing": ("जल आपूर्ति, ड्रेनेज और सेनेटरी इंस्टॉलेशन।", "Pipelines are pressure-tested before concealment, and fixtures are installed to manufacturer guidelines for long, trouble-free use."),
    "carpentry": ("दरवाज़े, खिड़कियाँ, फर्नीचर और शटरिंग कार्य।", "From shuttering for RCC work to finished joinery, our carpenters work to measured drawings and agreed material specifications."),
    "ups": ("UPS, इन्वर्टर, बैटरी बैंक और पावर बैकअप।", "We assess the connected load, recommend suitable capacity and backup time, install and commission the system, and provide maintenance support."),
}

CONTENT = {
    "home.hero": {"line1_en": "Building Trust Through Quality", "line2_en": "Construction and Infrastructure Solutions.",
                  "line1_hi": "गुणवत्तापूर्ण निर्माण एवं इंफ्रास्ट्रक्चर", "line2_hi": "समाधानों से विश्वास का निर्माण।",
                  "subtitle_en": "Civil and building construction, electrical installation, government infrastructure works, material supply, plumbing, carpentry and UPS solutions — delivered by one accountable team.",
                  "subtitle_hi": "सिविल एवं भवन निर्माण, इलेक्ट्रिकल इंस्टॉलेशन, सरकारी इंफ्रास्ट्रक्चर कार्य, सामग्री आपूर्ति, प्लंबिंग, कारपेंट्री और UPS समाधान — एक ज़िम्मेदार टीम द्वारा।"},
    "home.intro": {"heading": "A professional construction, electrical and material supply company.",
                   "body": "Nirman Projects Group brings civil construction, building construction, electrical installation and maintenance, government infrastructure works, material supply, plumbing, carpentry and UPS solutions together under one management.\n\nOur clients work with one accountable team — one schedule, one point of contact and one standard of quality — from the first site visit to the final handover.\n\nLed by CMD Asif Ali and Manager Soheb Akhtar, we focus on quality workmanship, timely delivery and transparent communication on every project."},
    "about.intro": {"heading": "Construction, electrical and material supply — under one management.",
                    "body": "Nirman Projects Group is a professional construction, electrical and material supply company. We deliver civil and building construction, electrical installation and maintenance, government infrastructure works, plumbing, carpentry and UPS & electrical solutions.\n\nBy managing every trade and the supply of materials ourselves, we reduce coordination gaps, control quality and timelines, and give our clients a single point of accountability."},
    "home.stats": [{"label": "Service Verticals", "value": "8"}, {"label": "Years of Experience", "value": ""},
                   {"label": "Projects Delivered", "value": ""}, {"label": "Skilled Workforce", "value": ""}],
}


async def seed_admin() -> None:
    email = os.environ["ADMIN_EMAIL"].lower()
    if await db.admin_users.find_one({"email": email}) is None:
        await db.admin_users.insert_one({"email": email, "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
                                         "name": "Admin", "role": "admin", "created_at": utcnow(), "updated_at": utcnow()})
        logger.info("Seeded admin user %s", email)


async def seed_site() -> None:
    if await db.company_info.count_documents({"key": "company"}) == 0:
        await db.company_info.insert_one({**CompanyInfo(**COMPANY).to_mongo(), "key": "company"})
    if await db.services.count_documents({}) == 0:
        docs = [Service(slug=s, title_en=en, title_hi=hi, short_en=short, short_hi=DETAILS[s][0], description=desc, details=DETAILS[s][1],
                        points=pts, image_url=f"/images/{img}.jpg", order=i).to_mongo()
                for i, (s, en, hi, short, img, desc, pts) in enumerate(SERVICES)]
        await db.services.insert_many(docs)
    for key, value in CONTENT.items():
        await db.website_content.update_one({"key": key}, {"$setOnInsert": {"key": key, "value": value, "description": "",
                                                                             "created_at": utcnow(), "updated_at": utcnow()}}, upsert=True)


async def run_seed() -> None:
    try:
        await seed_admin()
        await seed_site()
    except Exception as exc:
        logger.error("Seeding failed: %s", exc)
