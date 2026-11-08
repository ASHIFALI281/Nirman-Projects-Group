import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n";
import { useSite, useSiteImage } from "@/site/SiteData";
import { PageHeader, Reveal, Placeholder } from "@/components/site/Shared";

const ServiceBlock = ({ s, i }) => {
  const { t, pick } = useLang();
  const flip = i % 2 === 1;
  return (
    <section id={s.id} className={`scroll-mt-36 md:scroll-mt-44 py-20 md:py-28 ${flip ? "bg-slate-50" : "bg-white"}`} data-testid={`service-section-${s.id}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-12 lg:grid-cols-2 items-center">
        <Reveal className={`relative aspect-[4/3] overflow-hidden img-zoom ${flip ? "lg:order-2" : ""}`}>
          <img src={s.image} alt={s.title.en} className="h-full w-full object-cover" />
          <span className="absolute top-0 left-0 bg-navy text-white font-mono text-sm px-4 py-2">0{i + 1}</span>
        </Reveal>
        <Reveal delay={0.1}>
          <s.icon className="h-10 w-10 text-ember" />
          <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-navy">{pick(s.title)}</h2>
          <p className="mt-5 text-slate-600 leading-relaxed">{s.desc}</p>
          {s.more && <p className="mt-4 text-slate-600 leading-relaxed">{s.more}</p>}
          {s.note && <div className="mt-4"><Placeholder label={s.note} /></div>}
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {s.points.map((p) => (
              <li key={p} className="flex gap-3 text-sm text-navy"><CheckCircle2 className="h-5 w-5 text-ember shrink-0" />{p}</li>
            ))}
          </ul>
          <Button asChild className="mt-10 bg-navy hover:bg-navy-800 rounded-none h-12 px-6 group">
            <Link to="/contact" data-testid={`service-quote-${s.id}`}>{t("cta.quote")}<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
};

export default function Services() {
  const { t, pick } = useLang();
  const { services: SERVICES } = useSite();
  const img = useSiteImage();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) {
      setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [hash]);
  return (
    <>
      <PageHeader eyebrow={t("nav.services")} title={`${["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][SERVICES.length - 1] || SERVICES.length} disciplines. One accountable team.`.replace("One disciplines", "One discipline")} image={img("services.header")} />
      <div className="sticky top-20 md:top-[120px] z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 flex gap-6 overflow-x-auto py-4 text-sm whitespace-nowrap">
          {SERVICES.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="nav-link" data-testid={`service-jump-${s.id}`}>{pick(s.title)}</a>
          ))}
        </div>
      </div>
      {SERVICES.map((s, i) => <ServiceBlock key={s.id} s={s} i={i} />)}
    </>
  );
}
