import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Briefcase, Clock, Mail, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLang } from "@/i18n";
import { useSite, useSiteImage } from "@/site/SiteData";
import { PageHeader, Reveal, SectionHeading, Placeholder } from "@/components/site/Shared";
import { api, formatApiError } from "@/lib/api";

const field = "rounded-none h-11 focus-visible:ring-ember";

const emptyApp = { name: "", phone: "", email: "", message: "", hp: "" };

const ApplyDialog = ({ job, onClose }) => {
  const [form, setForm] = useState(emptyApp);
  const [sending, setSending] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/applications", { ...form, position: job.title, job_id: job.id });
      toast.success("Thank you! Your application has been received.");
      setForm(emptyApp);
      onClose();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none max-w-lg" data-testid="apply-dialog">
        <DialogTitle className="font-display text-2xl text-navy">Apply: {job?.title}</DialogTitle>
        <DialogDescription>Fill in your details and our team will contact you.</DialogDescription>
        <form onSubmit={submit} className="mt-2 space-y-4 relative">
          <input type="text" name="website" value={form.hp} onChange={set("hp")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" data-testid="apply-hp" />
          <div className="space-y-2"><Label>Full name *</Label><Input required value={form.name} onChange={set("name")} className={field} data-testid="apply-name-input" /></div>
          <div className="space-y-2"><Label>Phone number *</Label><Input required type="tel" value={form.phone} onChange={set("phone")} className={field} data-testid="apply-phone-input" /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} className={field} data-testid="apply-email-input" /></div>
          <div className="space-y-2"><Label>Experience summary</Label><Textarea rows={3} value={form.message} onChange={set("message")} className="rounded-none" data-testid="apply-message-input" /></div>
          <div className="border border-dashed border-slate-300 p-4 text-sm text-slate-500 flex items-center gap-3"><FileText className="h-5 w-5" />Resume upload coming soon.</div>
          <Button type="submit" className="w-full bg-ember hover:bg-ember-600 rounded-none h-12" disabled={sending} data-testid="apply-submit-btn">{sending ? "Submitting..." : "Submit Application"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function Careers() {
  const { t } = useLang();
  const { company: COMPANY, jobs: JOBS } = useSite();
  const img = useSiteImage();
  const [job, setJob] = useState(null);
  return (
    <>
      <PageHeader eyebrow={t("nav.careers")} title="Build your career with Nirman Projects Group." image={img("careers.header")} />
      <section className="py-24 md:py-32 bg-white" data-testid="openings-section">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <SectionHeading eyebrow={t("sec.openings")} title="Open positions." />
            {JOBS.some((j) => j.sample !== false) && <Placeholder label="Sample listings — to be confirmed" />}
          </div>
          <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            {JOBS.map((j, i) => (
              <Reveal key={j.id} delay={i * 0.05} className="group py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors hover:bg-slate-50 md:px-6">
                <div>
                  <h3 className="font-display text-xl font-semibold text-navy" data-testid={`job-title-${j.id}`}>{j.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{j.type}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{j.location}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{j.exp}</span>
                  </div>
                </div>
                <Button onClick={() => setJob(j)} className="bg-navy hover:bg-ember rounded-none h-11 px-6 transition-colors" data-testid={`apply-btn-${j.id}`}>{t("cta.apply")}</Button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="py-24 bg-navy blueprint text-white" data-testid="application-info-section">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-10 md:grid-cols-3">
          {[
            { icon: Users, title: "Who we hire", text: "Engineers, supervisors, electricians, plumbers, carpenters and site staff." },
            { icon: FileText, title: "How to apply", text: "Use the Apply button on any role, or send your resume by email." },
            { icon: Mail, title: "HR contact", text: COMPANY.email },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <c.icon className="h-9 w-9 text-ember" />
              <h3 className="mt-5 font-display text-xl font-semibold">{c.title}</h3>
              <p className="mt-3 text-white/60 text-sm leading-relaxed">{c.text}</p>
            </Reveal>
          ))}
        </div>
      </section>
      <ApplyDialog job={job} onClose={() => setJob(null)} />
    </>
  );
}
