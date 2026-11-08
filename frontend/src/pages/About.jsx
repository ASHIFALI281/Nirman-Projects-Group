import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Eye, Target, User, Award, Clock3, Briefcase, Smile, Truck } from "lucide-react";
import { useLang } from "@/i18n";
import { VALUES, COMMITMENTS } from "@/data/content";
import { useSite, useSiteImage } from "@/site/SiteData";

const C_ICONS = { quality: Award, timely: Clock3, management: Briefcase, satisfaction: Smile, supply: Truck };

const Commitments = () => {
  const { t } = useLang();
  return (
    <section className="py-24 md:py-32 bg-white" data-testid="commitments-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading eyebrow={t("sec.commitment")} title="What every client can expect from us." />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {COMMITMENTS.map((c, i) => {
            const Icon = C_ICONS[c.id];
            return (
              <Reveal key={c.id} delay={i * 0.06} className="group border border-slate-200 p-7 transition-colors duration-300 hover:bg-navy hover:border-navy">
                <Icon className="h-9 w-9 text-ember" />
                <h3 className="mt-6 font-display text-lg font-semibold text-navy group-hover:text-white transition-colors" data-testid={`commitment-${c.id}`}>{c.title}</h3>
                <p className="mt-3 text-sm text-slate-500 group-hover:text-white/60 leading-relaxed transition-colors">{c.text}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};
import { PageHeader, Reveal, SectionHeading, Placeholder } from "@/components/site/Shared";

const VisionMission = () => {
  const { t } = useLang();
  const { company } = useSite();
  const items = [
    { icon: Eye, title: t("sec.vision"), text: company.vision || "To be a trusted name in construction and infrastructure, known for quality workmanship, safe sites and on-time delivery." },
    { icon: Target, title: t("sec.mission"), text: company.mission || "To deliver complete construction solutions — civil, electrical, plumbing, carpentry, supply and power backup — through one accountable team, with transparency at every step." },
  ];
  return (
    <section className="py-24 bg-slate-50 blueprint-light">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-8 md:grid-cols-2">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.1} className="bg-white border-t-4 border-ember p-10 shadow-[0_10px_40px_rgba(11,31,58,0.06)]" >
            <it.icon className="h-10 w-10 text-navy" />
            <h3 className="mt-6 font-display text-2xl font-bold text-navy" data-testid={`about-${i === 0 ? "vision" : "mission"}-title`}>{it.title}</h3>
            <p className="mt-4 text-slate-600 leading-relaxed">{it.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

const Team = () => {
  const { t } = useLang();
  const { company: { management: MANAGEMENT } } = useSite();
  return (
    <section id="management" className="scroll-mt-32 py-24 md:py-32 bg-slate-50" data-testid="management-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading eyebrow={t("sec.management")} title="Leadership that stays on site." />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {MANAGEMENT.map((m, i) => (
            <Reveal key={m.role} delay={i * 0.08} className="group border border-slate-200 bg-white transition-shadow hover:shadow-[0_20px_50px_rgba(11,31,58,0.1)]">
              <div className="relative aspect-[4/3] bg-navy blueprint grid place-items-center overflow-hidden">
                {m.photo ? <img src={m.photo} alt={m.name} className="absolute inset-0 h-full w-full object-cover" /> : <>
                <span className="font-display text-6xl font-extrabold text-white/90">{m.pending ? <User className="h-16 w-16 text-white/40" /> : m.initials}</span>
                <span className="absolute bottom-3 left-3"><Placeholder label="Photo to be added" /></span>
                </>}
              </div>
              <div className="p-7">
                <div className="font-mono text-[11px] uppercase tracking-widest text-ember-600">{m.role}</div>
                <h3 className="mt-2 font-display text-2xl font-bold text-navy" data-testid={`team-member-${i}`}>{m.name}</h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{m.about}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const Values = () => {
  const { t } = useLang();
  return (
    <section className="py-24 md:py-32 bg-navy blueprint" data-testid="values-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading light eyebrow={t("sec.values")} title="The principles behind every project." />
        <div className="mt-14 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.08} className="bg-navy p-8">
              <div className="font-mono text-sm text-ember">0{i + 1}</div>
              <h3 className="mt-6 font-display text-xl font-semibold text-white">{v.title}</h3>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">{v.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function About() {
  const { t } = useLang();
  const { hash } = useLocation();
  const intro = useSite().content["about.intro"];
  const img = useSiteImage();
  useEffect(() => {
    if (hash) {
      setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  }, [hash]);
  
  return (
    <>
      <PageHeader eyebrow={t("nav.about")} title="Building with integrity, one project at a time." image={img("about.header")} />
      <section className="py-24 md:py-32 bg-white" data-testid="about-intro-section">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-16 lg:grid-cols-2 items-center">
          <div>
            <SectionHeading eyebrow={t("sec.intro")} title={intro?.heading || "Construction,Mechanical,electrical and material supply — under one management."} />
            <Reveal delay={0.1}>
              {intro?.body ? intro.body.split(/\n\s*\n/).map((p, i) => <p key={i} className="mt-5 text-slate-600 leading-relaxed whitespace-pre-line">{p}</p>) : (<>
              <p className="mt-6 text-slate-600 leading-relaxed">Nirman Projects Group is a professional construction, electrical and material supply company. We deliver civil and building construction, electrical installation and maintenance, government infrastructure works, plumbing, carpentry and UPS & electrical solutions.</p>
              <p className="mt-4 text-slate-600 leading-relaxed">By managing every trade and the supply of materials ourselves, we reduce coordination gaps, control quality and timelines, and give our clients a single point of accountability.</p>
              </>)}
              <div className="mt-6 flex flex-wrap gap-2"><Placeholder label="Founding year" /><Placeholder label="Registration / GST details" /><Placeholder label="Certifications" /></div>
            </Reveal>
          </div>
          <Reveal className="aspect-[4/3] overflow-hidden img-zoom"><img src={img("about.photo")} alt="Construction cranes" className="h-full w-full object-cover" /></Reveal>
        </div>
      </section>
      <VisionMission />
      <Commitments />
      <Team />
      <Values />
    </>
  );
}
