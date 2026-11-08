export const MEDIA_CATEGORIES = [
  { value: "hero", label: "Homepage Hero Banner" },
  { value: "about", label: "About Us" },
  { value: "services", label: "Services" },
  { value: "civil", label: "Civil Construction Projects" },
  { value: "building", label: "Building Construction" },
  { value: "electrical", label: "Electrical Works" },
  { value: "material", label: "Material Supply" },
  { value: "plumbing", label: "Plumbing" },
  { value: "carpentry", label: "Carpentry" },
  { value: "ups", label: "UPS Solutions" },
  { value: "projects", label: "Project Gallery" },
  { value: "other", label: "Other website sections" },
];

export const CATEGORY_LABEL = Object.fromEntries(MEDIA_CATEGORIES.map((c) => [c.value, c.label]));

export const IMAGE_SLOTS = [
  { key: "home.hero", group: "Homepage", label: "Hero banner (background)", fallback: "/images/hero.jpg", category: "hero" },
  { key: "home.intro", group: "Homepage", label: "Company introduction photo", fallback: "/images/team.jpg", category: "about" },
  { key: "home.why", group: "Homepage", label: "\"Why choose us\" photo", fallback: "/images/workers.jpg", category: "other" },
  { key: "about.header", group: "About Us", label: "Page banner", fallback: "/images/civil.jpg", category: "about" },
  { key: "about.photo", group: "About Us", label: "Introduction photo", fallback: "/images/cranes.jpg", category: "about" },
  { key: "services.header", group: "Services", label: "Services page banner", fallback: "/images/panel.jpg", category: "services" },
  { key: "projects.header", group: "Other pages", label: "Projects page banner", fallback: "/images/highway.jpg", category: "projects" },
  { key: "clients.header", group: "Other pages", label: "Clients page banner", fallback: "/images/government.jpg", category: "other" },
  { key: "careers.header", group: "Other pages", label: "Careers page banner", fallback: "/images/workers.jpg", category: "other" },
  { key: "contact.header", group: "Other pages", label: "Contact page banner", fallback: "/images/hero.jpg", category: "other" },
];

export const SLOT_FALLBACK = Object.fromEntries(IMAGE_SLOTS.map((s) => [s.key, s.fallback]));
export const SLOT_LABEL = Object.fromEntries(IMAGE_SLOTS.map((s) => [s.key, `${s.group} — ${s.label}`]));

export const SERVICE_CATEGORY = { civil: "civil", building: "building", electrical: "electrical", material: "material", plumbing: "plumbing", carpentry: "carpentry", ups: "ups" };
