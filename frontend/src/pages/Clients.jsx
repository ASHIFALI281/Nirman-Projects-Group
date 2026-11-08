import { Link } from "react-router-dom";
import { Landmark, Home, Building, Factory, ImageIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n";
import { PageHeader, Reveal, SectionHeading, Placeholder } from "@/components/site/Shared";
import { useSite, useSiteImage } from "@/site/SiteData";
import { assetUrl } from "@/lib/api";

const RealLogos = ({ clients }) => (
  <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 border-l border-t border-slate-200 bg-white">
    {clients.map((c) => (
      <div key={c.id} className="bg-white aspect-[3/2] grid place-items-center text-center p-6 border-r border-b border-slate-200" data-testid={`client-logo-${c.id}`}>
        {c.logo_url ? <img src={assetUrl(c.logo_url)} alt={c.name} className="max-h-20 max-w-full object-contain" /> : <span className="font-display font-semibold text-navy">{c.company_name || c.name}</span>}
        {c.logo_url && <span className="mt-2 text-xs text-slate-500">{c.company_name || c.name}</span>}
      </div>
    ))}
  </div>
);

const SECTORS = [
  { icon: Landmark, title: "Government & Public Bodies", text: "Civil and electrical works executed to departmental specifications." },
  { icon: Home, title: "Homeowners", text: "Independent houses, renovations and turnkey residential projects." },
  { icon: Building, title: "Commercial", text: "Offices, shops and institutional buildings." },
  { icon: Factory, title: "Industrial", text: "Electrical, UPS, plumbing and civil works for industrial sites." },
];

export default function Clients() {
  const { t } = useLang();
  const { clients } = useSite();
  const img = useSiteImage();
  return (
    <>
      <PageHeader eyebrow={t("nav.clients")} title="The people and organisations we build for." image={img("clients.header")} />
      <section className="py-24 md:py-32 bg-white" data-testid="client-sectors-section">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <SectionHeading eyebrow="Who we serve" title="Client segments." text="The types of clients Nirman Projects Group works with. Specific client names will be published only with permission." />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SECTORS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="border border-slate-200 p-8 transition-colors hover:border-ember">
                <s.icon className="h-9 w-9 text-ember" />
                <h3 className="mt-6 font-display text-lg font-semibold text-navy">{s.title}</h3>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="py-24 md:py-32 bg-slate-50 blueprint-light" data-testid="client-logos-section">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <SectionHeading eyebrow={t("sec.clientLogos")} title="Client logos." />
            {!clients.length && <Placeholder label="Real logos to be added with client permission" />}
          </div>
          {clients.length > 0 ? <RealLogos clients={clients} /> : (
          <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white aspect-[3/2] grid place-items-center text-center" data-testid={`client-logo-slot-${i}`}>
                <div className="flex flex-col items-center gap-2 text-slate-300">
                  <ImageIcon className="h-8 w-8" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Client Logo {i + 1}</span>
                </div>
              </div>
            ))}
          </div>
          )}
          <div className="mt-14 bg-navy text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6 blueprint">
            <h3 className="font-display text-2xl md:text-3xl font-bold max-w-xl">Planning a project? Talk to our team.</h3>
            <Button asChild className="bg-ember hover:bg-ember-600 rounded-none h-12 px-8 group">
              <Link to="/contact" data-testid="clients-cta-btn">{t("cta.quote")}<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
