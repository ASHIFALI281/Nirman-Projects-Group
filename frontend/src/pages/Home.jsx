import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Quote, Phone, Mail, MessageCircle, ShieldCheck, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang } from "@/i18n";
import { WHY, STATS } from "@/data/content";
import { useSite, useSiteImage } from "@/site/SiteData";
import { Reveal, SectionHeading, Placeholder } from "@/components/site/Shared";
import { ProjectCard } from "@/components/site/ProjectCard";
import { ContactForm } from "@/components/site/ContactForm";
import { openWhatsApp, callNow } from "@/components/site/WhatsAppButton";

const Hero = () => {
  const { t, pick, lang } = useLang();
  const { services: SERVICES, content } = useSite();
  const img = useSiteImage();
  const hero = content["home.hero"] || {};
  return (
    <section className="relative min-h-[88vh] flex items-center bg-navy overflow-hidden" data-testid="hero-section">
      <motion.img initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 2.2, ease: "easeOut" }}
        src={img("home.hero")} alt="Construction site" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy/80 to-navy/30" />
      <div className="absolute inset-0 blueprint" />
      <div className="relative mx-auto max-w-7xl w-full px-6 lg:px-10 py-24">
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="eyebrow !text-ember">{t("hero.eyebrow")}</motion.span>
        <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08] max-w-5xl" data-testid="hero-title">
          {hero[`line1_${lang}`] || t("hero.title1")}<br /><span className="text-ember">{hero[`line2_${lang}`] || t("hero.title2")}</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55 }}
          className="mt-8 max-w-xl text-base md:text-lg text-white/75 leading-relaxed">{hero[`subtitle_${lang}`] || t("hero.sub")}</motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.75 }} className="mt-10 flex flex-wrap gap-4">
          <Button asChild className="bg-ember hover:bg-ember-600 rounded-none h-14 px-8 text-base font-semibold group">
            <Link to="/contact" data-testid="hero-quote-btn">{t("cta.quote")}<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></Link>
          </Button>
          <Button asChild variant="outline" className="rounded-none h-14 px-8 text-base bg-transparent text-white border-white/40 hover:bg-white hover:text-navy">
            <Link to="/services" data-testid="hero-services-btn">{t("cta.services")}</Link>
          </Button>
        </motion.div>
      </div>
      <div className="absolute bottom-0 right-0 md:right-28 hidden md:grid grid-cols-2 bg-white">
        {SERVICES.slice(0, 2).map((s) => (
          <Link key={s.id} to={`/services#${s.id}`} className="flex items-center gap-4 px-8 py-6 border-l border-slate-200 hover:bg-slate-50 transition-colors" data-testid={`hero-quick-${s.id}`}>
            <s.icon className="h-7 w-7 text-ember" /><span className="font-display font-semibold text-navy">{pick(s.title)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};

const Intro = () => {
  const { t } = useLang();
  const { content } = useSite();
  const img = useSiteImage();
  const intro = content["home.intro"];
  return (
    <section className="py-24 md:py-32 bg-white" data-testid="intro-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-16 lg:grid-cols-12 items-center">
        <Reveal className="lg:col-span-6 relative">
          <div className="relative aspect-[4/5] overflow-hidden img-zoom"><img src={img("home.intro")} alt="Site team" className="h-full w-full object-cover" /></div>
          <div className="absolute -bottom-8 -right-4 md:-right-8 bg-navy text-white p-8 w-64 blueprint">
            <HardHat className="h-8 w-8 text-ember" />
            <div className="mt-4 font-display text-4xl font-bold">8</div>
            <div className="text-sm text-white/70">Construction & infrastructure service verticals</div>
          </div>
        </Reveal>
        <div className="lg:col-span-6">
          <SectionHeading eyebrow={t("sec.intro")} title={intro?.heading || "A professional construction, electrical and material supply company."} />
          <Reveal delay={0.1}>
            {intro?.body ? intro.body.split(/\n\s*\n/).map((p, i) => <p key={i} className="mt-5 text-slate-600 leading-relaxed whitespace-pre-line" data-testid={`intro-paragraph-${i}`}>{p}</p>) : (<>
            <p className="mt-6 text-slate-600 leading-relaxed">Nirman Projects Group brings civil construction, building construction, electrical installation and maintenance, government infrastructure works, material supply, plumbing, carpentry and UPS solutions together under one management.</p>
            <p className="mt-4 text-slate-600 leading-relaxed">Our clients work with one accountable team — one schedule, one point of contact and one standard of quality — from the first site visit to the final handover.</p>
            <p className="mt-4 text-slate-600 leading-relaxed">Led by GM <strong className="text-navy">Ashif Ali</strong> and Manager <strong className="text-navy">Soeb Aktar</strong>, we focus on quality workmanship, timely delivery and transparent communication on every project.</p>
            </>)}
            <div className="mt-4"><Placeholder label="Founded in 2026" /></div>
            <Button asChild variant="link" className="mt-6 px-0 text-ember-600 font-semibold group">
              <Link to="/about" data-testid="intro-about-link">{t("cta.learnMore")}<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

const ServicesGrid = () => {
  const { t, pick } = useLang();
  const { services: SERVICES } = useSite();
  return (
    <section className="py-24 md:py-32 bg-slate-50 blueprint-light" data-testid="services-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <SectionHeading eyebrow={t("sec.services")} title="Complete construction capability, under one roof." />
          <Link to="/services" className="font-semibold text-navy hover:text-ember transition-colors flex items-center gap-2" data-testid="services-view-all">{t("cta.viewAll")}<ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-16 grid gap-px bg-slate-200 border border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s, i) => (
            <Reveal key={s.id} delay={i * 0.05} className="bg-white">
              <Link to={`/services#${s.id}`} className="group block h-full p-8 transition-colors duration-300 hover:bg-navy" data-testid={`service-card-${s.id}`}>
                <div className="flex items-start justify-between">
                  <s.icon className="h-9 w-9 text-ember" />
                  <span className="font-mono text-xs text-slate-300 group-hover:text-white/30">0{i + 1}</span>
                </div>
                <h3 className="mt-8 font-display text-lg font-semibold text-navy group-hover:text-white transition-colors">{pick(s.title)}</h3>
                <p className="mt-3 text-sm text-slate-500 group-hover:text-white/60 transition-colors leading-relaxed">{pick(s.short)}</p>
                <ArrowRight className="mt-6 h-5 w-5 text-ember -translate-x-2 opacity-0 transition-[opacity,transform] duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const ProjectsSection = () => {
  const { t } = useLang();
  const { projects: PROJECTS } = useSite();
  return (
    <section className="py-24 md:py-32 bg-white" data-testid="home-projects-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading eyebrow={t("sec.projects")} title="Work on site and work delivered." text="Real project names, photographs and details will be added from the admin dashboard." />
        <Tabs defaultValue="ongoing" className="mt-12">
          <TabsList className="rounded-none bg-slate-100 p-1 h-auto">
            <TabsTrigger value="ongoing" className="rounded-none px-6 py-2.5 data-[state=active]:bg-navy data-[state=active]:text-white" data-testid="home-tab-ongoing">{t("sec.ongoing")}</TabsTrigger>
            <TabsTrigger value="completed" className="rounded-none px-6 py-2.5 data-[state=active]:bg-navy data-[state=active]:text-white" data-testid="home-tab-completed">{t("sec.completed")}</TabsTrigger>
          </TabsList>
          {["ongoing", "completed"].map((st) => (
            <TabsContent key={st} value={st} className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {PROJECTS.filter((p) => p.status === st).map((p) => <ProjectCard key={p.id} p={p} />)}
              {!PROJECTS.some((p) => p.status === st) && <p className="text-slate-500" data-testid={`home-projects-empty-${st}`}>No {st} projects to show yet.</p>}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
};

const Why = () => {
  const { t } = useLang();
  const img = useSiteImage();
  return (
    <section className="py-24 md:py-32 bg-navy text-white blueprint relative overflow-hidden" data-testid="why-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading light eyebrow={t("sec.why")} title="Built on discipline, delivered with accountability." />
          <Reveal delay={0.1} className="mt-10 relative aspect-[4/3] overflow-hidden"><img src={img("home.why")} alt="Site workers" className="h-full w-full object-cover" /></Reveal>
        </div>
        <div className="lg:col-span-7 grid gap-6 sm:grid-cols-2 content-center">
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.08} className="border border-white/10 bg-white/[0.03] p-8 transition-colors duration-300 hover:border-ember">
              <ShieldCheck className="h-8 w-8 text-ember" />
              <h3 className="mt-6 font-display text-xl font-semibold">{w.title}</h3>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">{w.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const ManagementStrip = () => {
  const { t } = useLang();
  const { company: { management: MANAGEMENT } } = useSite();
  return (
    <section className="py-24 md:py-32 bg-white" data-testid="home-management-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <SectionHeading eyebrow={t("sec.management")} title="The people accountable for your project." />
          <Link to="/about#management" className="font-semibold text-navy hover:text-ember transition-colors flex items-center gap-2" data-testid="home-management-link">{t("cta.learnMore")}<ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-12 grid gap-px bg-slate-200 border border-slate-200 md:grid-cols-3">
          {MANAGEMENT.map((m, i) => (
            <Reveal key={m.role} delay={i * 0.08} className="bg-white p-8 flex items-center gap-5">
              <span className="grid h-16 w-16 shrink-0 place-items-center bg-navy font-display text-xl font-bold text-white relative">{m.initials}<span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-ember" /></span>
              <div>
                <div className="font-display text-lg font-semibold text-navy" data-testid={`home-team-${i}`}>{m.name}</div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-ember-600 mt-1">{m.role}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const Stats = () => {
  const { t } = useLang();
  const live = useSite().content["home.stats"];
  const stats = live?.length ? live.map((s) => ({ label: s.label, value: s.value || "[--]" })) : STATS;
  return (
    <section className="bg-ember" data-testid="stats-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-white/80">{t("sec.stats")}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white border border-dashed border-white/60 px-2 py-0.5">[--] = figures to be provided</span>
        </div>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="border-l-2 border-white/40 pl-6">
              <div className="font-display text-4xl md:text-5xl font-extrabold text-white" data-testid={`stat-value-${i}`}>{s.value}</div>
              <div className="mt-2 text-sm text-white/85">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const { t } = useLang();
  return (
    <section className="py-24 md:py-32 bg-slate-50" data-testid="testimonials-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading eyebrow={t("sec.testimonials")} title="What our clients say." text="Genuine client testimonials will be published here once collected." />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {[1, 2, 3].map((n, i) => (
            <Reveal key={n} delay={i * 0.08} className="bg-white border border-slate-200 p-8 flex flex-col" >
              <Quote className="h-8 w-8 text-ember" />
              <p className="mt-6 text-slate-500 italic leading-relaxed flex-1">"[Client testimonial {n} to be added — a short quote about the project experience.]"</p>
              <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
                <div><div className="font-display font-semibold text-navy">[Client Name]</div><div className="text-xs text-slate-500">[Organisation / Project]</div></div>
                <Placeholder />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const ContactSection = () => {
  const { t } = useLang();
  const { company: COMPANY } = useSite();
  const items = [
    { icon: Phone, label: "Phone", value: COMPANY.phone, onClick: () => callNow(COMPANY.phone) },
    { icon: Mail, label: "Email", value: COMPANY.email },
    { icon: MessageCircle, label: "WhatsApp", value: COMPANY.whatsapp, onClick: () => openWhatsApp(COMPANY.whatsapp) },
  ];
  return (
    <section className="py-24 md:py-32 bg-white" data-testid="home-contact-section">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading eyebrow={t("sec.contact")} title="Let's discuss your project." text="Share your requirement and our team will get back with a site visit plan and quotation." />
          <div className="mt-10 space-y-4">
            {items.map((it) => (
              <button key={it.label} onClick={it.onClick} className="w-full flex items-center gap-5 p-5 border border-slate-200 text-left transition-colors hover:border-ember" data-testid={`home-contact-${it.label.toLowerCase()}`}>
                <span className="grid h-12 w-12 place-items-center bg-navy text-ember"><it.icon className="h-5 w-5" /></span>
                <span><span className="block font-mono text-[10px] uppercase tracking-widest text-slate-400">{it.label}</span><span className="text-navy font-medium">{it.value}</span></span>
              </button>
            ))}
          </div>
        </div>
        <Reveal className="lg:col-span-7 bg-slate-50 border border-slate-200 p-8 md:p-12"><ContactForm id="home-contact" /></Reveal>
      </div>
    </section>
  );
};

export default function Home() {
  return (
    <>
      <Hero />
      <Intro />
      <ServicesGrid />
      <ProjectsSection />
      <Why />
      <Stats />
      <ManagementStrip />
      <Testimonials />
      <ContactSection />
    </>
  );
}
