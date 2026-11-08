import { Building2, Zap, Truck, Landmark, Home, Droplets, Hammer, BatteryCharging } from "lucide-react";

export const COMPANY = {
  name: "Nirman Projects Group",
  phone: "[+91 XXXXX XXXXX]",
  email: "[info@yourcompany.com]",
  whatsapp: "[WhatsApp number]",
  address: "[Registered office address to be provided]",
  hours: "Mon – Sat, 9:30 AM – 6:30 PM",
};

export const SERVICES = [
  {
    id: "civil", icon: Building2, image: "/images/civil.jpg",
    title: { en: "Civil Construction", hi: "सिविल निर्माण" },
    short: { en: "Foundations, RCC structures, buildings and site development.", hi: "नींव, RCC संरचना, भवन और साइट विकास।" },
    desc: "End-to-end civil works from excavation and foundations to RCC framing, masonry and finishing, executed to approved drawings and specifications.",
    more: "Our site teams work from approved structural drawings, follow a stage-wise quality checklist — excavation, reinforcement, shuttering, concreting and curing — and keep the client informed through regular progress updates.",
    points: ["Foundations & structural RCC work", "Buildings and boundary walls", "Roads, drains and site development", "Renovation and repair works"],
  },
  {
    id: "electrical", icon: Zap, image: "/images/electrical.jpg",
    title: { en: "Electrical Installation & Maintenance", hi: "इलेक्ट्रिकल इंस्टॉलेशन एवं रखरखाव" },
    short: { en: "Wiring, panels, earthing, lighting and maintenance.", hi: "वायरिंग, पैनल, अर्थिंग, लाइटिंग और रखरखाव।" },
    desc: "Safe, standards-compliant electrical installation for residential, commercial and institutional buildings — from concealed wiring to distribution panels — followed by planned maintenance to keep systems reliable.",
    more: "Every installation is tested before handover. Maintenance visits cover inspection, load checks, fault rectification and replacement of worn components.",
    points: ["Internal & external wiring", "LT panels and distribution boards", "Earthing and lightning protection", "Preventive & breakdown maintenance"],
  },
  {
    id: "building", icon: Home, image: "/images/residential.jpg",
    title: { en: "Building Construction", hi: "भवन निर्माण" },
    short: { en: "Residential and commercial buildings, delivered turnkey.", hi: "आवासीय और व्यावसायिक भवन, टर्नकी आधार पर।" },
    desc: "Residential and commercial building construction with one team handling structure, electrical, plumbing and carpentry — a single point of contact from start to handover.",
    more: "We plan the work in clear phases, share a schedule before starting, and hand over with finishing, fittings and services completed and checked.",
    points: ["Independent houses & villas", "Commercial and institutional buildings", "Turnkey construction & finishing", "Extensions and renovations"],
  },
  {
    id: "government", icon: Landmark, image: "/images/government.jpg",
    title: { en: "Government Infrastructure Projects", hi: "सरकारी इंफ्रास्ट्रक्चर परियोजनाएँ" },
    short: { en: "Public civil and electrical works to departmental specifications.", hi: "विभागीय मानकों के अनुसार सार्वजनिक सिविल एवं इलेक्ट्रिकल कार्य।" },
    desc: "Execution of public infrastructure works as per departmental specifications, with disciplined documentation, measurement and billing support.",
    more: "We work to the work order, approved drawings and specification schedule, maintain site records and measurement books, and coordinate with the engineer-in-charge for inspections.",
    note: "Registration / empanelment details to be added",
    points: ["Civil and electrical public works", "Public building works", "Compliance with departmental specifications", "Documentation and billing support"],
  },
  {
    id: "material", icon: Truck, image: "/images/material.jpg",
    title: { en: "Material Supply", hi: "सामग्री आपूर्ति" },
    short: { en: "Cement, steel, aggregates and site material logistics.", hi: "सीमेंट, स्टील, गिट्टी और साइट सामग्री आपूर्ति।" },
    desc: "Reliable sourcing and on-time delivery of construction materials so your site never stops for want of supply.",
    more: "Quantities are coordinated with the site schedule and every delivery is checked against the order. Supply is available for our own projects and for client-managed sites on request.",
    points: ["Cement, steel and aggregates", "Bricks, blocks and sand", "Electrical and plumbing materials", "Site delivery coordination"],
  },
  {
    id: "plumbing", icon: Droplets, image: "/images/plumbing.jpg",
    title: { en: "Plumbing", hi: "प्लंबिंग" },
    short: { en: "Water supply, drainage and sanitary installations.", hi: "जल आपूर्ति, ड्रेनेज और सेनेटरी इंस्टॉलेशन।" },
    desc: "Leak-free water supply, drainage and sanitation systems designed for long service life and easy maintenance.",
    more: "Pipelines are pressure-tested before concealment, and fixtures are installed to manufacturer guidelines for long, trouble-free use.",
    points: ["Water supply lines", "Drainage & sanitation", "Bathroom & kitchen fittings", "Water tank and pump installation"],
  },
  {
    id: "carpentry", icon: Hammer, image: "/images/carpentry.jpg",
    title: { en: "Carpentry", hi: "कारपेंट्री" },
    short: { en: "Doors, windows, furniture and shuttering work.", hi: "दरवाज़े, खिड़कियाँ, फर्नीचर और शटरिंग कार्य।" },
    desc: "Skilled carpentry for structural formwork as well as fine finishing — doors, frames, wardrobes and custom furniture.",
    more: "From shuttering for RCC work to finished joinery, our carpenters work to measured drawings and agreed material specifications.",
    points: ["Doors, windows & frames", "Modular furniture and wardrobes", "Shuttering & formwork", "Wooden flooring and panelling"],
  },
  {
    id: "ups", icon: BatteryCharging, image: "/images/ups.jpg",
    title: { en: "UPS & Electrical Solutions", hi: "UPS एवं इलेक्ट्रिकल समाधान" },
    short: { en: "UPS, inverters, battery banks and power backup.", hi: "UPS, इन्वर्टर, बैटरी बैंक और पावर बैकअप।" },
    desc: "Uninterrupted power for homes, offices and institutions — supply, installation and maintenance of UPS and backup systems.",
    more: "We assess the connected load, recommend suitable capacity and backup time, install and commission the system, and provide maintenance support.",
    points: ["UPS and inverter installation", "Battery banks & power backup", "Stabilizers and power conditioning", "Maintenance support"],
  },
];

const projectDesc = "[Project description — scope of work, client type and key details to be added by Nirman Projects Group.]";
const ongoing = { status: "ongoing", location: "[Location]", start: "[Start date]", end: "[Expected completion]", desc: projectDesc };
const completed = { status: "completed", location: "[Location]", start: "[Start date]", end: "[Completion date]", desc: projectDesc };

// Replace these sample entries with real projects (they will move to the admin dashboard later).
export const PROJECTS = [
  { ...ongoing, id: "p1", title: "[Ongoing Project Name 1]", category: "Civil Construction", images: ["/images/cranes.jpg", "/images/civil.jpg", "/images/material.jpg"] },
  { ...ongoing, id: "p2", title: "[Ongoing Project Name 2]", category: "Electrical Installation & Maintenance", images: ["/images/panel.jpg", "/images/electrical.jpg"] },
  { ...ongoing, id: "p3", title: "[Ongoing Project Name 3]", category: "Building Construction", images: ["/images/residential.jpg", "/images/carpentry.jpg"] },
  { ...completed, id: "p4", title: "[Completed Project Name 1]", category: "Government Infrastructure Projects", images: ["/images/highway.jpg", "/images/government.jpg"] },
  { ...completed, id: "p5", title: "[Completed Project Name 2]", category: "Plumbing", images: ["/images/plumbing.jpg", "/images/civil.jpg"] },
  { ...completed, id: "p6", title: "[Completed Project Name 3]", category: "UPS & Electrical Solutions", images: ["/images/ups.jpg", "/images/panel.jpg"] },
];

export const MANAGEMENT = [
  { name: "ASHIF ALI", role: "GM", initials: "AA", about: "Provides overall leadership and direction to the company and oversees key client relationships and project commitments." },
  { name: "SOEB AKTAR", role: "Manager", initials: "SA", about: "Coordinates day-to-day business operations, project planning, client communication and site teams." },
  { name: "NAUSAD (RAJAN)", role: "Operations Manager", initials: "OM", about: "Details to be updated later." },
];

export const COMMITMENTS = [
  { id: "quality", title: "Quality Work", text: "Approved materials, skilled workmanship and stage-wise checks so every structure is built to last." },
  { id: "timely", title: "Timely Delivery", text: "Realistic schedules shared upfront, tracked on site and communicated honestly at every milestone." },
  { id: "management", title: "Professional Management", text: "Organised planning, clear documentation and a single accountable point of contact for every project." },
  { id: "satisfaction", title: "Customer Satisfaction", text: "Listening first, keeping clients informed and handing over only when the work meets the agreed standard." },
  { id: "supply", title: "Reliable Material Supply", text: "Dependable sourcing and on-time delivery of construction, electrical and plumbing materials." },
];

export const VALUES = [
  { title: "Integrity", text: "Honest estimates, transparent billing and commitments we keep." },
  { title: "Safety", text: "Safe working practices for every worker on every site." },
  { title: "Quality", text: "Approved materials and workmanship checked at every stage." },
  { title: "Accountability", text: "One team responsible from first survey to final handover." },
];

export const WHY = [
  { title: "Eight trades, one team", text: "Civil, electrical, plumbing, carpentry, supply and UPS under a single contract." },
  { title: "In-house material supply", text: "Direct material sourcing keeps sites supplied and schedules on track." },
  { title: "Transparent quotations", text: "Itemised estimates with clear scope, timelines and payment milestones." },
  { title: "Safety-first sites", text: "PPE, supervision and site discipline as standard practice." },
];

export const STATS = [
  { value: "8", label: "Service Verticals", real: true },
  { value: "[--]", label: "Years of Experience" },
  { value: "[--]", label: "Projects Delivered" },
  { value: "[--]", label: "Skilled Workforce" },
];

export const JOBS = [
  { id: "j1", title: "Site Engineer (Civil)", type: "Full-time", location: "U.P.", exp: "NIL" },
  { id: "j2", title: "Supervisor", type: "Full-time", location: "U.P.", exp: "NIL" },
  { id: "j3", title: "Project Manager", type: "Full-time / Contract", location: "U.P.", exp: "NIL" },
  { id: "j4", title: "Liasoning Officer", type: "Full-time / Contract", location: "U.P.", exp: "NIL" },
];

export const NAV = [
  { to: "/", key: "nav.home" },
  { to: "/about", key: "nav.about" },
  { to: "/services", key: "nav.services" },
  { to: "/projects", key: "nav.projects" },
  { to: "/clients", key: "nav.clients" },
  { to: "/careers", key: "nav.careers" },
  { to: "/contact", key: "nav.contact" },
];
