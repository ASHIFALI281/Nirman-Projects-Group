import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, CheckCircle2, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/i18n";
import { useSite } from "@/site/SiteData";
import { api, formatApiError } from "@/lib/api";
import { openWhatsApp } from "./WhatsAppButton";

const empty = { name: "", company_name: "", phone: "", email: "", service: "", location: "", budget: "", message: "", hp: "" };
const field = "rounded-none h-12 bg-white border-slate-300 focus-visible:ring-ember";
const BUDGETS = ["Below ₹5 Lakh", "₹5 – 25 Lakh", "₹25 Lakh – ₹1 Crore", "Above ₹1 Crore", "Not sure yet"];
const newToken = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const validMobile = (v) => {
  const digits = v.replace(/\D/g, "");
  if (!/^[0-9+\-\s()]+$/.test(v)) return false;
  return digits.length === 10 ? /^[6-9]/.test(digits) : digits.length >= 11 && digits.length <= 15;
};

const validate = (f) => {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Please enter your name.";
  if (!f.phone.trim()) e.phone = "Please enter your mobile number.";
  else if (!validMobile(f.phone.trim())) e.phone = "Enter a valid 10-digit mobile number (country code optional).";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (!f.service) e.service = "Please select the service you need.";
  if (f.location.trim().length < 2) e.location = "Please enter the project location.";
  if (f.message.trim().length < 5) e.message = "Please describe your project (at least 5 characters).";
  return e;
};

const Err = ({ id, msg }) => (msg ? <p className="text-xs text-red-600" data-testid={`${id}-error`}>{msg}</p> : null);

const Success = ({ id, result, onReset }) => {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  return (
  <div ref={ref} className="border border-emerald-200 bg-emerald-50 p-8" data-testid={`${id}-success`}>
    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
    <h3 className="mt-4 font-display text-2xl font-bold text-navy">{result.status === "duplicate" ? "We already have your enquiry" : "Thank you! Your enquiry has been received."}</h3>
    <p className="mt-3 text-slate-600">Your enquiry ID is <strong className="font-mono text-navy" data-testid={`${id}-enquiry-no`}>{result.enquiry_no}</strong>. Our team will contact you soon — please keep this ID for reference.</p>
    <Button variant="outline" className="mt-6 rounded-none" onClick={onReset} data-testid={`${id}-new-btn`}>Submit another enquiry</Button>
  </div>
  );
};

export const ContactForm = ({ id = "contact" }) => {
  const { t, pick } = useLang();
  const { services: SERVICES, company } = useSite();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const token = useRef(newToken());
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };
  const pickValue = (k) => (v) => {
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please correct the highlighted fields.", { id: "form-errors" });
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post("/enquiries", { ...form, source: id, client_token: token.current });
      setResult(data);
      setForm(empty);
      token.current = newToken();
      toast.dismiss("form-errors");
      toast.success(`Enquiry ${data.enquiry_no} received.`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSending(false);
    }
  };

  const viaWhatsApp = () => {
    const service = SERVICES.find((s) => s.id === form.service);
    const lines = ["Hello Nirman Projects Group, I would like to enquire about a project.",
      form.name && `Name: ${form.name}`, service && `Service: ${service.title.en}`, form.location && `Location: ${form.location}`,
      form.budget && `Budget: ${form.budget}`, form.message && `Details: ${form.message}`].filter(Boolean);
    openWhatsApp(company.whatsapp, lines.join("\n"));
  };

  if (result) return <Success id={id} result={result} onReset={() => setResult(null)} />;

  return (
    <form onSubmit={submit} noValidate className="relative grid gap-5 sm:grid-cols-2" data-testid={`${id}-form`}>
      <input type="text" name="website" value={form.hp} onChange={set("hp")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" data-testid={`${id}-hp`} />
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>{t("form.name")} *</Label>
        <Input id={`${id}-name`} value={form.name} onChange={set("name")} className={field} data-testid={`${id}-name-input`} />
        <Err id={`${id}-name`} msg={errors.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-company`}>{t("form.company")}</Label>
        <Input id={`${id}-company`} value={form.company_name} onChange={set("company_name")} className={field} data-testid={`${id}-company-input`} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-phone`}>{t("form.phone")} *</Label>
        <Input id={`${id}-phone`} type="tel" inputMode="tel" placeholder="e.g. 98765 43210" value={form.phone} onChange={set("phone")} className={field} data-testid={`${id}-phone-input`} />
        <Err id={`${id}-phone`} msg={errors.phone} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-email`}>{t("form.email")}</Label>
        <Input id={`${id}-email`} type="email" value={form.email} onChange={set("email")} className={field} data-testid={`${id}-email-input`} />
        <Err id={`${id}-email`} msg={errors.email} />
      </div>
      <div className="space-y-2">
        <Label>{t("form.service")} *</Label>
        <Select value={form.service || undefined} onValueChange={pickValue("service")}>
          <SelectTrigger className={field} data-testid={`${id}-service-select`}><SelectValue placeholder="Select a service" /></SelectTrigger>
          <SelectContent>
            {SERVICES.map((s) => <SelectItem key={s.id} value={s.id} data-testid={`${id}-service-${s.id}`}>{pick(s.title)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Err id={`${id}-service`} msg={errors.service} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-location`}>{t("form.location")} *</Label>
        <Input id={`${id}-location`} value={form.location} onChange={set("location")} placeholder="City / site address" className={field} data-testid={`${id}-location-input`} />
        <Err id={`${id}-location`} msg={errors.location} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>{t("form.budget")}</Label>
        <Select value={form.budget || undefined} onValueChange={(v) => setForm({ ...form, budget: v })}>
          <SelectTrigger className={field} data-testid={`${id}-budget-select`}><SelectValue placeholder="Select a budget range (optional)" /></SelectTrigger>
          <SelectContent>{BUDGETS.map((b, i) => <SelectItem key={b} value={b} data-testid={`${id}-budget-${i}`}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${id}-message`}>{t("form.message")} *</Label>
        <Textarea id={`${id}-message`} rows={5} value={form.message} onChange={set("message")} className="rounded-none bg-white border-slate-300 focus-visible:ring-ember" data-testid={`${id}-message-input`} />
        <Err id={`${id}-message`} msg={errors.message} />
      </div>
      <div className="sm:col-span-2 flex flex-wrap gap-3">
        <Button type="submit" disabled={sending} className="bg-ember hover:bg-ember-600 rounded-none h-12 px-8 font-semibold group" data-testid={`${id}-submit-btn`}>
          {sending ? "Sending..." : t("cta.send")} <Send className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
        <Button type="button" variant="outline" onClick={viaWhatsApp} className="rounded-none h-12 px-6 border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10" data-testid={`${id}-whatsapp-btn`}>
          <MessageCircle className="mr-2 h-4 w-4" />{t("cta.whatsappEnquiry")}
        </Button>
      </div>
    </form>
  );
};
