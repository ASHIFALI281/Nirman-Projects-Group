import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { Logo } from "./Logo";
import { useLang } from "@/i18n";
import { NAV } from "@/data/content";
import { useSite } from "@/site/SiteData";

const Col = ({ title, children }) => (
  <div>
    <h4 className="font-mono text-xs uppercase tracking-[0.25em] text-ember mb-6">{title}</h4>
    <ul className="space-y-3 text-sm text-white/70">{children}</ul>
  </div>
);

export const Footer = () => {
  const { t, pick } = useLang();
  const { company: COMPANY, services: SERVICES } = useSite();
  return (
    <footer className="bg-navy-950 text-white blueprint" data-testid="site-footer">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-20 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-6 text-sm text-white/60 leading-relaxed max-w-xs">{t("footer.tagline")}</p>
        </div>
        <Col title={t("footer.links")}>
          {NAV.map((n) => (
            <li key={n.to}><Link to={n.to} className="hover:text-ember transition-colors" data-testid={`footer-link-${n.key.split(".")[1]}`}>{t(n.key)}</Link></li>
          ))}
        </Col>
        <Col title={t("footer.services")}>
          {SERVICES.map((s) => (
            <li key={s.id}><Link to={`/services#${s.id}`} className="hover:text-ember transition-colors" data-testid={`footer-service-${s.id}`}>{pick(s.title)}</Link></li>
          ))}
        </Col>
        <Col title={t("footer.contact")}>
          <li className="flex gap-3"><Phone className="h-4 w-4 text-ember shrink-0 mt-0.5" />{COMPANY.phone}</li>
          <li className="flex gap-3"><Mail className="h-4 w-4 text-ember shrink-0 mt-0.5" />{COMPANY.email}</li>
          <li className="flex gap-3"><MessageCircle className="h-4 w-4 text-ember shrink-0 mt-0.5" />{COMPANY.whatsapp}</li>
          <li className="flex gap-3"><MapPin className="h-4 w-4 text-ember shrink-0 mt-0.5" />{COMPANY.address}</li>
        </Col>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex flex-col sm:flex-row gap-2 justify-between text-xs text-white/50">
          <span data-testid="footer-copyright">© {new Date().getFullYear()} Nirman Projects Group. {t("footer.rights")}</span>
          <span className="font-mono">CMD: Asif Ali</span>
        </div>
      </div>
    </footer>
  );
};
