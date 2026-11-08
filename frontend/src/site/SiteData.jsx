import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { api, assetUrl, fmtDate } from "@/lib/api";
import { COMPANY, SERVICES, PROJECTS, JOBS, MANAGEMENT } from "@/data/content";
import { SLOT_FALLBACK } from "@/site/imageSlots";

const STATIC = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

const initials = (name) =>
  name.replace(/\[.*?\]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "—";

const mapService = (s) => ({
  id: s.slug,
  icon: STATIC[s.slug]?.icon || Building2,
  image: assetUrl(s.image_url) || "/images/civil.jpg",
  title: { en: s.title_en, hi: s.title_hi || s.title_en },
  short: { en: s.short_en, hi: s.short_hi || s.short_en },
  desc: s.description,
  more: s.details,
  points: s.points || [],
  note: STATIC[s.slug]?.note,
});

const mapProject = (p) => ({
  id: p.id,
  sample: false,
  status: p.status,
  title: p.name,
  category: p.category,
  location: p.location || "—",
  start: fmtDate(p.start_date) || "—",
  end: fmtDate(p.completion_date) || (p.status === "ongoing" ? "In progress" : "—"),
  images: p.images?.length ? p.images.map(assetUrl) : ["/images/civil.jpg"],
  desc: p.description || "",
});

const mapJob = (j) => ({ id: j.id, sample: false, title: j.title, type: j.employment_type, location: j.location || "—", exp: j.experience || "—" });

const build = (raw) => {
  const c = raw.company;
  return {
    company: {
      phone: c?.phone || COMPANY.phone,
      email: c?.email || COMPANY.email,
      whatsapp: c?.whatsapp || COMPANY.whatsapp,
      address: c?.address || COMPANY.address,
      hours: c?.working_hours || COMPANY.hours,
      vision: c?.vision,
      mission: c?.mission,
      management: c?.management?.length
        ? c.management.map((m) => ({ ...m, initials: initials(m.name), pending: m.name.startsWith("["), photo: assetUrl(m.photo_url) }))
        : MANAGEMENT,
    },
    services: raw.services?.length ? raw.services.map(mapService) : SERVICES,
    projects: raw.projects?.length ? raw.projects.map(mapProject) : PROJECTS,
    clients: raw.clients || [],
    jobs: raw.jobs?.length ? raw.jobs.map(mapJob) : JOBS,
    content: Object.fromEntries((raw.content || []).map((x) => [x.key, x.value])),
  };
};

const SiteCtx = createContext(build({}));

export const SiteDataProvider = ({ children }) => {
  const [raw, setRaw] = useState({});
  useEffect(() => {
    const get = (p) => api.get(p).then((r) => r.data).catch(() => null);
    Promise.all(["/company", "/services", "/projects", "/clients", "/careers", "/content"].map(get)).then(
      ([company, services, projects, clients, jobs, content]) => setRaw({ company, services, projects, clients, jobs, content })
    );
  }, []);
  const value = useMemo(() => build(raw), [raw]);
  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
};

export const useSite = () => useContext(SiteCtx);

export const useSiteImage = () => {
  const imgs = useSite().content["site.images"] || {};
  return (key) => assetUrl(imgs[key]) || SLOT_FALLBACK[key];
};
