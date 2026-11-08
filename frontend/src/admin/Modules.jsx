import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, assetUrl, fmtDate, formatApiError } from "@/lib/api";
import { SERVICES } from "@/data/content";
import ResourceManager, { StatusBadge } from "./ResourceManager";

export const ENQ_STATUS = [
  { value: "new", label: "New" }, { value: "contacted", label: "Contacted" },
  { value: "in_progress", label: "In Progress" }, { value: "completed", label: "Completed" },
];
export const APP_STATUS = [
  { value: "new", label: "New" }, { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" }, { value: "rejected", label: "Rejected" },
];
const PROJECT_STATUS = [{ value: "ongoing", label: "Ongoing" }, { value: "completed", label: "Completed" }];
const CATEGORIES = SERVICES.map((s) => ({ value: s.title.en, label: s.title.en }));
const SERVICE_LABEL = Object.fromEntries(SERVICES.map((s) => [s.id, s.title.en]));
const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
const EMAIL_LABEL = { sent: "Sent", failed: "Failed", pending: "Pending" };

const EmailStatusBar = () => {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/admin/email/status").then((r) => setInfo(r.data)).catch(() => setInfo(false));
  }, []);
  const test = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/email/test");
      toast.success(`Test email sent to ${data.to}`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };
  if (!info) return null;
  return (
    <div className={`mb-4 border px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${info.configured ? "bg-white border-slate-200" : "bg-amber-50 border-amber-200"}`} data-testid="email-status-bar">
      <span className="flex items-center gap-2 text-navy"><Mail className="h-4 w-4 text-ember" />
        {info.configured ? <>Email alerts for new enquiries go to <strong data-testid="email-recipient">{info.recipient}</strong></> : "Email alerts are not configured."}
      </span>
      {info.configured && <Button size="sm" variant="outline" className="rounded-none" onClick={test} disabled={busy} data-testid="email-test-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test email"}</Button>}
    </div>
  );
};

const Thumb = ({ src }) => (src ? <img src={assetUrl(src)} alt="" className="h-10 w-14 min-w-[3.5rem] shrink-0 object-cover border border-slate-200" /> : <div className="h-10 w-14 min-w-[3.5rem] shrink-0 bg-slate-100 border border-slate-200" />);
const Muted = ({ children }) => <span className="text-slate-500">{children || "—"}</span>;
const YesNo = ({ on, yes = "Published", no = "Hidden" }) => <StatusBadge value={on ? "completed" : "rejected"} label={on ? yes : no} />;

const Detail = ({ rows }) => (
  <dl className="grid gap-4 sm:grid-cols-2 text-sm">
    {rows.map(([k, v, full]) => (
      <div key={k} className={full ? "sm:col-span-2" : ""}>
        <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{k}</dt>
        <dd className="mt-1 text-navy whitespace-pre-wrap break-words">{v || "—"}</dd>
      </div>
    ))}
  </dl>
);

export const ProjectsAdmin = () => (
  <ResourceManager resource="projects" title="Projects" itemLabel="Project" subtitle="Ongoing and completed projects shown on the website."
    searchKeys={["name", "location", "category"]} statusOptions={null} sortFn={byNewest}
    defaults={{ status: "ongoing", published: true }}
    columns={[
      { key: "image", label: "", render: (p) => <Thumb src={p.images?.[0]} /> },
      { key: "name", label: "Project", render: (p) => <span className="font-medium">{p.name}</span> },
      { key: "category", label: "Category", render: (p) => <Muted>{p.category}</Muted> },
      { key: "location", label: "Location", render: (p) => <Muted>{p.location}</Muted> },
      { key: "pstatus", label: "Status", render: (p) => <StatusBadge value={p.status} label={p.status === "ongoing" ? "Ongoing" : "Completed"} /> },
      { key: "dates", label: "Dates", render: (p) => <Muted>{[fmtDate(p.start_date), fmtDate(p.completion_date)].filter(Boolean).join(" – ")}</Muted> },
      { key: "published", label: "Website", render: (p) => <YesNo on={p.published} /> },
    ]}
    fields={[
      { name: "name", label: "Project title", required: true, full: true },
      { name: "category", label: "Category", type: "select", options: CATEGORIES, required: true },
      { name: "status", label: "Status", type: "select", options: PROJECT_STATUS, required: true },
      { name: "location", label: "Location" },
      { name: "order", label: "Display order", type: "number", help: "Lower numbers appear first." },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "completion_date", label: "Completion / expected date", type: "date" },
      { name: "description", label: "Description", type: "textarea", rows: 5 },
      { name: "images", label: "Project images", type: "images", category: "projects" },
      { name: "published", label: "Show on website", type: "switch", on: "Published", off: "Hidden" },
      { name: "featured", label: "Featured", type: "switch" },
    ]}
  />
);

export const ClientsAdmin = () => (
  <ResourceManager resource="clients" title="Clients" itemLabel="Client" subtitle="Client records. Only clients marked 'Show on website' appear publicly."
    searchKeys={["name", "company_name", "sector", "contact_person", "phone", "email"]} sortFn={byNewest}
    columns={[
      { key: "logo", label: "", render: (c) => <Thumb src={c.logo_url} /> },
      { key: "name", label: "Client", render: (c) => <span className="font-medium">{c.name}</span> },
      { key: "company_name", label: "Company", render: (c) => <Muted>{c.company_name}</Muted> },
      { key: "sector", label: "Sector", render: (c) => <Muted>{c.sector}</Muted> },
      { key: "contact", label: "Contact", render: (c) => <Muted>{[c.contact_person, c.phone].filter(Boolean).join(" · ")}</Muted> },
      { key: "show", label: "Website", render: (c) => <YesNo on={c.show_on_website} yes="Shown" /> },
    ]}
    fields={[
      { name: "name", label: "Client name", required: true },
      { name: "company_name", label: "Company / organisation name" },
      { name: "sector", label: "Sector", placeholder: "e.g. Government, Residential" },
      { name: "website", label: "Website" },
      { name: "contact_person", label: "Contact person" },
      { name: "phone", label: "Phone" },
      { name: "email", label: "Email", type: "email" },
      { name: "order", label: "Display order", type: "number" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "logo_url", label: "Logo", type: "image", full: true, category: "other" },
      { name: "notes", label: "Private notes (never shown publicly)", type: "textarea", rows: 3 },
      { name: "show_on_website", label: "Show on website", type: "switch", on: "Shown", off: "Hidden" },
    ]}
  />
);

export const ServicesAdmin = () => (
  <ResourceManager resource="services" title="Services" itemLabel="Service" subtitle="Services shown on the website. Unpublish to hide a service."
    searchKeys={["title_en", "title_hi", "slug"]} defaults={{ active: true }}
    columns={[
      { key: "img", label: "", render: (s) => <Thumb src={s.image_url} /> },
      { key: "title_en", label: "Service", render: (s) => <span className="font-medium">{s.title_en}</span> },
      { key: "title_hi", label: "Hindi title", render: (s) => <Muted>{s.title_hi}</Muted> },
      { key: "order", label: "Order", render: (s) => <Muted>{String(s.order)}</Muted> },
      { key: "active", label: "Status", render: (s) => <YesNo on={s.active} yes="Published" no="Unpublished" /> },
    ]}
    fields={[
      { name: "title_en", label: "Title (English)", required: true },
      { name: "title_hi", label: "Title (Hindi)" },
      { name: "slug", label: "URL identifier", required: true, help: "Lowercase letters, numbers and dashes, e.g. civil" },
      { name: "order", label: "Display order", type: "number" },
      { name: "short_en", label: "Short description (English)", full: true },
      { name: "short_hi", label: "Short description (Hindi)", full: true },
      { name: "description", label: "Main description", type: "textarea" },
      { name: "details", label: "Additional details", type: "textarea" },
      { name: "points", label: "Key points (one per line)", type: "lines" },
      { name: "image_url", label: "Service image", type: "image", full: true, category: "services" },
      { name: "active", label: "Published", type: "switch", on: "Published", off: "Unpublished" },
    ]}
  />
);

export const EnquiriesAdmin = () => (
  <>
  <EmailStatusBar />
  <ResourceManager resource="enquiries" title="Enquiries" itemLabel="Enquiry" subtitle="Enquiries submitted through the website contact forms." canCreate={false}
    searchKeys={["enquiry_no", "name", "company_name", "phone", "email", "location", "message", "service"]} statusOptions={ENQ_STATUS}
    columns={[
      { key: "enquiry_no", label: "ID", render: (e) => <span className="font-mono text-xs">{e.enquiry_no || "—"}</span> },
      { key: "created_at", label: "Date", render: (e) => <Muted>{fmtDate(e.created_at, true)}</Muted> },
      { key: "name", label: "Name", render: (e) => <div><div className="font-medium">{e.name}</div><Muted>{e.company_name}</Muted></div> },
      { key: "contact", label: "Contact", render: (e) => <div className="text-xs"><div>{e.phone}</div><Muted>{e.email}</Muted></div> },
      { key: "service", label: "Service", render: (e) => <div className="text-xs"><div>{SERVICE_LABEL[e.service] || e.service || "—"}</div><Muted>{e.location}</Muted></div> },
      { key: "status", label: "Status" },
    ]}
    detail={(e) => <Detail rows={[["Enquiry ID", e.enquiry_no], ["Received", fmtDate(e.created_at, true)], ["Name", e.name], ["Company", e.company_name], ["Mobile", e.phone], ["Email", e.email], ["Service", SERVICE_LABEL[e.service] || e.service], ["Project location", e.location], ["Estimated budget", e.budget], ["Form", e.source], ["Email alert", EMAIL_LABEL[e.email_status] || e.email_status], ["Message", e.message, true]]} />}
    fields={[
      { name: "status", label: "Status", type: "select", options: ENQ_STATUS, required: true },
      { name: "admin_notes", label: "Internal notes", type: "textarea", rows: 3 },
    ]}
  />
  </>
);

const ApplicationsAdmin = () => (
  <ResourceManager resource="applications" title="Applications" itemLabel="Application" canCreate={false}
    searchKeys={["name", "phone", "email", "position", "message"]} statusOptions={APP_STATUS}
    columns={[
      { key: "created_at", label: "Date", render: (a) => <Muted>{fmtDate(a.created_at, true)}</Muted> },
      { key: "name", label: "Applicant", render: (a) => <span className="font-medium">{a.name}</span> },
      { key: "position", label: "Position", render: (a) => <Muted>{a.position}</Muted> },
      { key: "contact", label: "Contact", render: (a) => <div className="text-xs"><div>{a.phone}</div><Muted>{a.email}</Muted></div> },
      { key: "status", label: "Status" },
    ]}
    detail={(a) => <Detail rows={[["Applicant", a.name], ["Received", fmtDate(a.created_at, true)], ["Position", a.position], ["Phone", a.phone], ["Email", a.email], ["Resume", "Resume upload not enabled yet"], ["Experience summary", a.message, true]]} />}
    fields={[
      { name: "status", label: "Status", type: "select", options: APP_STATUS, required: true },
      { name: "admin_notes", label: "Internal notes", type: "textarea", rows: 3 },
    ]}
  />
);

const JobsAdmin = () => (
  <ResourceManager resource="careers" title="Job openings" itemLabel="Job opening" subtitle="Open positions appear on the Careers page."
    searchKeys={["title", "location", "department"]} defaults={{ employment_type: "Full-time", is_open: true }}
    columns={[
      { key: "title", label: "Position", render: (j) => <span className="font-medium">{j.title}</span> },
      { key: "employment_type", label: "Type", render: (j) => <Muted>{j.employment_type}</Muted> },
      { key: "location", label: "Location", render: (j) => <Muted>{j.location}</Muted> },
      { key: "is_open", label: "Status", render: (j) => <YesNo on={j.is_open} yes="Open" no="Closed" /> },
    ]}
    fields={[
      { name: "title", label: "Position title", required: true },
      { name: "department", label: "Department" },
      { name: "employment_type", label: "Employment type" },
      { name: "location", label: "Location" },
      { name: "experience", label: "Experience required" },
      { name: "order", label: "Display order", type: "number" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "requirements", label: "Requirements (one per line)", type: "lines" },
      { name: "is_open", label: "Accepting applications", type: "switch", on: "Open", off: "Closed" },
    ]}
  />
);

export const CareersAdmin = () => (
  <Tabs defaultValue="applications">
    <TabsList className="rounded-none bg-white border border-slate-200 p-1 h-auto mb-6">
      <TabsTrigger value="applications" className="rounded-none px-5 py-2 data-[state=active]:bg-navy data-[state=active]:text-white" data-testid="careers-tab-applications">Applications</TabsTrigger>
      <TabsTrigger value="jobs" className="rounded-none px-5 py-2 data-[state=active]:bg-navy data-[state=active]:text-white" data-testid="careers-tab-jobs">Job openings</TabsTrigger>
    </TabsList>
    <TabsContent value="applications"><ApplicationsAdmin /></TabsContent>
    <TabsContent value="jobs"><JobsAdmin /></TabsContent>
  </Tabs>
);
