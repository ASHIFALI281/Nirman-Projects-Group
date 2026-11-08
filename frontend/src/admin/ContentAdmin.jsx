import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, formatApiError } from "@/lib/api";
import { FieldInput, ImageUploader } from "./FormFields";
import { PageTitle } from "./ResourceManager";

const Fields = ({ fields, value, onChange }) => (
  <div className="grid gap-5 sm:grid-cols-2">
    {fields.map((f) => (
      <div key={f.name} className={`space-y-2 ${f.type === "textarea" || f.full ? "sm:col-span-2" : ""}`}>
        <Label htmlFor={`field-${f.name}`}>{f.label}</Label>
        <FieldInput f={f} value={value[f.name] ?? ""} onChange={(v) => onChange({ ...value, [f.name]: v })} />
        {f.help && <p className="text-xs text-slate-400">{f.help}</p>}
      </div>
    ))}
  </div>
);

const SaveBar = ({ onSave, saving, testid }) => (
  <div className="mt-6 flex justify-end"><Button onClick={onSave} disabled={saving} className="rounded-none bg-ember hover:bg-ember-600 min-w-32" data-testid={testid}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button></div>
);

const Card = ({ title, children }) => (
  <div className="bg-white border border-slate-200 p-5 md:p-8 mb-6"><h2 className="font-display text-lg font-semibold text-navy mb-6">{title}</h2>{children}</div>
);

const COMPANY_FIELDS = [
  { name: "name", label: "Company name" }, { name: "tagline", label: "Tagline" },
  { name: "phone", label: "Phone number" }, { name: "email", label: "Email address" },
  { name: "whatsapp", label: "WhatsApp number", help: "Include country code, e.g. +91 98765 43210. The WhatsApp button starts working once a real number is saved." },
  { name: "working_hours", label: "Working hours" },
  { name: "address", label: "Office address", full: true },
  { name: "gst_number", label: "GST number" }, { name: "founded_year", label: "Founded year" },
];
const ABOUT_FIELDS = [{ name: "vision", label: "Vision", type: "textarea" }, { name: "mission", label: "Mission", type: "textarea" }];
const HERO_FIELDS = [
  { name: "line1_en", label: "Headline line 1 (English)" }, { name: "line2_en", label: "Headline line 2 — orange (English)" },
  { name: "line1_hi", label: "Headline line 1 (Hindi)" }, { name: "line2_hi", label: "Headline line 2 — orange (Hindi)" },
  { name: "subtitle_en", label: "Sub-heading (English)", type: "textarea" }, { name: "subtitle_hi", label: "Sub-heading (Hindi)", type: "textarea" },
];
const BLOCK_FIELDS = [{ name: "heading", label: "Heading", full: true }, { name: "body", label: "Text", type: "textarea", help: "Leave a blank line between paragraphs." }];

const useSaver = () => {
  const [saving, setSaving] = useState("");
  const run = async (key, fn) => {
    setSaving(key);
    try {
      await fn();
      toast.success("Changes saved");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving("");
    }
  };
  return [saving, run];
};

const ManagementEditor = ({ list, onChange }) => {
  const set = (i, k, v) => onChange(list.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  return (
    <div className="space-y-4">
      {list.map((m, i) => (
        <div key={i} className="border border-slate-200 p-4 grid gap-4 md:grid-cols-[auto_1fr_1fr_auto] items-start" data-testid={`manager-row-${i}`}>
          <ImageUploader value={m.photo_url || ""} onChange={(v) => set(i, "photo_url", v)} testid={`manager-photo-${i}`} />
          <div className="space-y-3">
            <FieldInput f={{ name: `m-name-${i}`, placeholder: "Name" }} value={m.name} onChange={(v) => set(i, "name", v)} />
            <FieldInput f={{ name: `m-role-${i}`, placeholder: "Role / designation" }} value={m.role} onChange={(v) => set(i, "role", v)} />
          </div>
          <FieldInput f={{ name: `m-about-${i}`, type: "textarea", rows: 4, placeholder: "Short description" }} value={m.about} onChange={(v) => set(i, "about", v)} />
          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => onChange(list.filter((_, j) => j !== i))} data-testid={`manager-remove-${i}`} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" className="rounded-none" onClick={() => onChange([...list, { name: "", role: "", about: "", photo_url: "" }])} data-testid="manager-add-btn"><Plus className="h-4 w-4 mr-2" />Add person</Button>
    </div>
  );
};

const StatsEditor = ({ list, onChange }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {list.map((s, i) => (
      <div key={i} className="flex gap-2">
        <FieldInput f={{ name: `stat-value-${i}`, placeholder: "Value e.g. 15+" }} value={s.value} onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, value: v } : x)))} />
        <FieldInput f={{ name: `stat-label-${i}`, placeholder: "Label" }} value={s.label} onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
      </div>
    ))}
    <p className="text-xs text-slate-400 sm:col-span-2">Leave a value empty to show it as "[--]" until the real figure is available.</p>
  </div>
);

export default function ContentAdmin() {
  const [company, setCompany] = useState(null);
  const [content, setContent] = useState(null);
  const [saving, run] = useSaver();

  useEffect(() => {
    let alive = true;
    Promise.all([api.get("/company"), api.get("/content")])
      .then(([c, ct]) => {
        if (!alive) return;
        setCompany(c.data);
        setContent(Object.fromEntries(ct.data.map((x) => [x.key, x.value])));
      })
      .catch((err) => alive && toast.error(formatApiError(err)));
    return () => {
      alive = false;
    };
  }, []);

  if (!company || !content) return <div className="space-y-4" data-testid="content-loading"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;

  const setBlock = (key) => (v) => setContent((c) => ({ ...c, [key]: v }));
  const saveCompany = (key, names) => run(key, async () => {
    const payload = Object.fromEntries(names.map((n) => [n, typeof company[n] === "string" ? company[n].trim() : company[n]]));
    const { data } = await api.put("/admin/company", payload);
    setCompany(data);
  });
  const saveBlock = (key) => run(key, () => api.put(`/admin/content/${key}`, { value: content[key] }));
  const saveManagement = () => {
    if (company.management.some((m) => m.name.trim().length < 2 || m.role.trim().length < 2)) return toast.error("Each person needs a name and role (at least 2 characters).");
    saveCompany("management", ["management"]);
  };
  const tab = "rounded-none px-4 py-2 data-[state=active]:bg-navy data-[state=active]:text-white";

  return (
    <div data-testid="admin-content-page">
      <PageTitle title="Website Content" subtitle="Edit text and contact details shown on the public website. Changes appear after saving." />
      <Tabs defaultValue="company">
        <TabsList className="rounded-none bg-white border border-slate-200 p-1 h-auto mb-6 flex-wrap justify-start">
          <TabsTrigger value="company" className={tab} data-testid="content-tab-company">Company & Contact</TabsTrigger>
          <TabsTrigger value="home" className={tab} data-testid="content-tab-home">Homepage</TabsTrigger>
          <TabsTrigger value="about" className={tab} data-testid="content-tab-about">About Us</TabsTrigger>
          <TabsTrigger value="management" className={tab} data-testid="content-tab-management">Management</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <Card title="Company & contact information">
            <Fields fields={COMPANY_FIELDS} value={company} onChange={setCompany} />
            <SaveBar saving={saving === "company"} onSave={() => saveCompany("company", COMPANY_FIELDS.map((f) => f.name))} testid="save-company-btn" />
          </Card>
        </TabsContent>
        <TabsContent value="home">
          <Card title="Hero section">
            <Fields fields={HERO_FIELDS} value={content["home.hero"] || {}} onChange={setBlock("home.hero")} />
            <SaveBar saving={saving === "home.hero"} onSave={() => saveBlock("home.hero")} testid="save-hero-btn" />
          </Card>
          <Card title="Company introduction">
            <Fields fields={BLOCK_FIELDS} value={content["home.intro"] || {}} onChange={setBlock("home.intro")} />
            <SaveBar saving={saving === "home.intro"} onSave={() => saveBlock("home.intro")} testid="save-intro-btn" />
          </Card>
          <Card title="Company statistics">
            <StatsEditor list={content["home.stats"] || []} onChange={setBlock("home.stats")} />
            <SaveBar saving={saving === "home.stats"} onSave={() => saveBlock("home.stats")} testid="save-stats-btn" />
          </Card>
        </TabsContent>
        <TabsContent value="about">
          <Card title="About Us introduction">
            <Fields fields={BLOCK_FIELDS} value={content["about.intro"] || {}} onChange={setBlock("about.intro")} />
            <SaveBar saving={saving === "about.intro"} onSave={() => saveBlock("about.intro")} testid="save-about-btn" />
          </Card>
          <Card title="Vision & mission">
            <Fields fields={ABOUT_FIELDS} value={company} onChange={setCompany} />
            <SaveBar saving={saving === "vision"} onSave={() => saveCompany("vision", ["vision", "mission"])} testid="save-vision-btn" />
          </Card>
        </TabsContent>
        <TabsContent value="management">
          <Card title="Management team">
            <ManagementEditor list={company.management} onChange={(m) => setCompany({ ...company, management: m })} />
            <SaveBar saving={saving === "management"} onSave={saveManagement} testid="save-management-btn" />
          </Card>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-slate-500">Service descriptions are edited in the Services section.</p>
    </div>
  );
}
