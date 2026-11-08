import { Link } from "react-router-dom";
import { Phone, Mail, MessageCircle, MapPin, Clock, Building2, Truck, Landmark, Briefcase } from "lucide-react";

const HELP = [
  { id: "project", icon: Building2, title: "New Project Enquiry", text: "Civil, building, electrical, plumbing, carpentry or UPS work — share your requirement for a site visit and quotation." },
  { id: "supply", icon: Truck, title: "Material Supply", text: "Request rates and delivery schedules for cement, steel, aggregates, electrical and plumbing materials." },
  { id: "government", icon: Landmark, title: "Government Works", text: "Departments and agencies can contact us regarding public infrastructure works." },
  { id: "careers", icon: Briefcase, title: "Careers", text: "Looking to join our team? View open roles on the Careers page.", to: "/careers" },
];

const HelpSection = () => (
  <section className="py-24 bg-slate-50 blueprint-light" data-testid="contact-help-section">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <SectionHeading eyebrow="How can we help" title="Choose the right enquiry." />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {HELP.map((h, i) => (
          <Reveal key={h.id} delay={i * 0.06} className="bg-white border border-slate-200 p-7 transition-colors hover:border-ember">
            <h.icon className="h-8 w-8 text-ember" />
            <h3 className="mt-5 font-display text-lg font-semibold text-navy">{h.title}</h3>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">{h.text}</p>
            {h.to
              ? <Link to={h.to} className="mt-5 inline-block text-sm font-semibold text-ember-600 hover:underline" data-testid={`help-link-${h.id}`}>View openings</Link>
              : <a href="#enquiry" className="mt-5 inline-block text-sm font-semibold text-ember-600 hover:underline" data-testid={`help-link-${h.id}`}>Send enquiry</a>}
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);
import { useLang } from "@/i18n";
import { useSite, useSiteImage } from "@/site/SiteData";
import { PageHeader, Reveal, SectionHeading, Placeholder } from "@/components/site/Shared";
import { ContactForm } from "@/components/site/ContactForm";
import { openWhatsApp, callNow } from "@/components/site/WhatsAppButton";

const cardsFor = (COMPANY) => [
  { id: "phone", icon: Phone, label: "Call Now", value: COMPANY.phone, onClick: () => callNow(COMPANY.phone) },
  { id: "email", icon: Mail, label: "Email", value: COMPANY.email, onClick: () => /^[^\s@[\]]+@[^\s@[\]]+\.[a-z]{2,}$/i.test(COMPANY.email) && (window.location.href = `mailto:${COMPANY.email}`) },
  { id: "whatsapp", icon: MessageCircle, label: "WhatsApp", value: COMPANY.whatsapp, onClick: () => openWhatsApp(COMPANY.whatsapp) },
  { id: "address", icon: MapPin, label: "Office", value: COMPANY.address },
];

export default function Contact() {
  const { t } = useLang();
  const { company: COMPANY } = useSite();
  const img = useSiteImage();
  const CARDS = cardsFor(COMPANY);
  return (
    <>
      <PageHeader eyebrow={t("nav.contact")} title="Let's build something lasting together." image={img("contact.header")} />
      <section className="relative -mt-12 z-10" data-testid="contact-cards">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4 shadow-[0_20px_50px_rgba(11,31,58,0.1)]">
          {CARDS.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.06} className="bg-white">
              <button onClick={c.onClick} className="w-full text-left p-8 h-full transition-colors hover:bg-slate-50" data-testid={`contact-card-${c.id}`}>
                <c.icon className="h-8 w-8 text-ember" />
                <div className="mt-5 font-mono text-[10px] uppercase tracking-widest text-slate-400">{c.label}</div>
                <div className="mt-1 text-navy font-medium break-words">{c.value}</div>
              </button>
            </Reveal>
          ))}
        </div>
      </section>
      <section id="enquiry" className="scroll-mt-32 py-24 md:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading eyebrow={t("sec.contact")} title="Send us an enquiry." text="Tell us about your project and we'll respond with next steps." />
            <div className="mt-10"><ContactForm id="contact-page" /></div>
          </div>
          <div className="lg:col-span-5 space-y-6">
            <div className="aspect-square bg-navy blueprint grid place-items-center text-center p-8" data-testid="map-placeholder">
              <div>
                <MapPin className="h-12 w-12 text-ember mx-auto" />
                <p className="mt-4 text-white font-display text-lg">Office location map</p>
                <div className="mt-3"><Placeholder label="Map added once address is provided" /></div>
              </div>
            </div>
            <div className="border border-slate-200 p-6 flex items-center gap-4">
              <Clock className="h-6 w-6 text-ember" />
              <div><div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Working hours</div><div className="text-navy">{COMPANY.hours}</div><div className="mt-1"><Placeholder label="Confirm hours" /></div></div>
            </div>
          </div>
        </div>
      </section>
      <HelpSection />
    </>
  );
}
