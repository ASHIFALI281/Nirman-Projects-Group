import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, Phone, Mail, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useLang } from "@/i18n";
import { NAV } from "@/data/content";
import { useSite } from "@/site/SiteData";
import { callNow } from "./WhatsAppButton";

const LangToggle = ({ dark }) => {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex border ${dark ? "border-white/20" : "border-navy/20"} text-xs font-mono`} data-testid="lang-toggle">
      {["en", "hi"].map((l) => (
        <button
          key={l}
          data-testid={`lang-${l}-btn`}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 transition-colors ${lang === l ? "bg-ember text-white" : dark ? "text-white/70 hover:text-white" : "text-navy hover:bg-navy/5"}`}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
};

const TopBar = () => {
  const { company: COMPANY } = useSite();
  return (
  <div className="hidden md:block bg-navy-900 text-white/70 text-xs">
    <div className="mx-auto max-w-7xl px-6 lg:px-10 h-10 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <button onClick={() => callNow(COMPANY.phone)} className="flex items-center gap-2 hover:text-white transition-colors" data-testid="topbar-call-btn"><Phone className="h-3.5 w-3.5 text-ember" />{COMPANY.phone}</button>
        <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-ember" />{COMPANY.email}</span>
        <span className="hidden lg:flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-ember" />{COMPANY.hours}</span>
      </div>
      <LangToggle dark />
    </div>
  </div>
  );
};

const MobileMenu = () => {
  const { t } = useLang();
  const { company } = useSite();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="lg:hidden p-2 text-navy" data-testid="mobile-menu-btn" aria-label="Open menu"><Menu className="h-6 w-6" /></button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-navy text-white border-none w-[85%] sm:max-w-sm">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="mt-10 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end onClick={() => setOpen(false)} data-testid={`mobile-nav-${n.key.split(".")[1]}`}
              className={({ isActive }) => `py-3 border-b border-white/10 font-display text-lg ${isActive ? "text-ember" : "text-white"}`}>
              {t(n.key)}
            </NavLink>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between"><LangToggle dark /></div>
        <Button variant="outline" className="mt-8 w-full rounded-none h-12 bg-transparent text-white border-white/30 hover:bg-white hover:text-navy" onClick={() => callNow(company.phone)} data-testid="mobile-call-btn">
          <Phone className="mr-2 h-4 w-4 text-ember" />{t("cta.call")}
        </Button>
        <Button asChild className="mt-3 w-full bg-ember hover:bg-ember-600 rounded-none h-12" onClick={() => setOpen(false)}>
          <Link to="/contact" data-testid="mobile-quote-btn">{t("cta.quote")}</Link>
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export const Navbar = () => {
  const { t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className="sticky top-0 z-50" data-testid="site-header">
      <TopBar />
      <div className={`bg-white/95 backdrop-blur-xl transition-shadow duration-300 ${scrolled ? "shadow-[0_8px_30px_rgba(11,31,58,0.08)]" : "border-b border-slate-200"}`}>
        <div className="mx-auto max-w-7xl px-6 lg:px-10 h-20 flex items-center justify-between">
          <Logo />
          <nav className="hidden lg:flex items-center gap-8" data-testid="main-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end data-testid={`nav-${n.key.split(".")[1]}`} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="md:hidden"><LangToggle /></div>
            <Button asChild className="hidden lg:inline-flex bg-ember hover:bg-ember-600 rounded-none h-11 px-6 font-semibold transition-colors">
              <Link to="/contact" data-testid="nav-quote-btn">{t("cta.quote")}</Link>
            </Button>
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  );
};
