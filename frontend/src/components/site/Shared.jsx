import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useLang } from "@/i18n";

export const Reveal = ({ children, delay = 0, className = "" }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

export const Placeholder = ({ label = "Placeholder" }) => <span className="ph-badge" data-testid="placeholder-badge">{label}</span>;

export const SectionHeading = ({ eyebrow, title, text, light = false, className = "" }) => (
  <Reveal className={`max-w-2xl ${className}`}>
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h2 className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${light ? "text-white" : "text-navy"}`}>{title}</h2>
    {text && <p className={`mt-5 text-base md:text-lg leading-relaxed ${light ? "text-white/70" : "text-slate-600"}`}>{text}</p>}
  </Reveal>
);

const HomeCrumb = () => {
  const { t } = useLang();
  return <Link to="/" className="hover:text-ember">{t("nav.home")}</Link>;
};

export const PageHeader = ({ title, eyebrow, image, text }) => (
  <section className="relative bg-navy overflow-hidden" data-testid="page-header">
    <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
    <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/90 to-navy/40" />
    <div className="absolute inset-0 blueprint" />
    <div className="relative mx-auto max-w-7xl px-6 lg:px-10 py-24 md:py-32">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/50">
        <HomeCrumb /><ChevronRight className="h-3 w-3" /><span className="text-ember">{eyebrow}</span>
      </div>
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-3xl" data-testid="page-title">
        {title}
      </motion.h1>
      {text && <p className="mt-6 max-w-2xl text-white/70 text-base md:text-lg">{text}</p>}
    </div>
    <div className="absolute bottom-0 left-0 h-1.5 w-40 bg-ember" />
  </section>
);
