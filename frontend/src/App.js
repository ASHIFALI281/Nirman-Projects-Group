import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/i18n";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { WhatsAppButton, CallButton } from "@/components/site/WhatsAppButton";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import Projects from "@/pages/Projects";
import Clients from "@/pages/Clients";
import Careers from "@/pages/Careers";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";
import { SiteDataProvider } from "@/site/SiteData";
import { AuthProvider } from "@/admin/AuthContext";
import AdminLogin from "@/admin/AdminLogin";
import AdminLayout from "@/admin/AdminLayout";
import Dashboard from "@/admin/Dashboard";
import ContentAdmin from "@/admin/ContentAdmin";
import Security from "@/admin/Security";
import MediaLibrary from "@/admin/MediaLibrary";
import { ProjectsAdmin, ClientsAdmin, ServicesAdmin, EnquiriesAdmin, CareersAdmin } from "@/admin/Modules";

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
};

const Layout = () => (
  <SiteDataProvider>
  <div className="min-h-screen flex flex-col">
    <ScrollToTop />
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
    <CallButton />
    <WhatsAppButton />
    <Toaster position="top-center" richColors />
  </div>
  </SiteDataProvider>
);

const AdminRoot = () => (
  <AuthProvider>
    <ScrollToTop />
    <Outlet />
    <Toaster position="top-right" richColors />
  </AuthProvider>
);

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<AdminRoot />}>
            <Route path="login" element={<AdminLogin />} />
            <Route element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="enquiries" element={<EnquiriesAdmin />} />
              <Route path="projects" element={<ProjectsAdmin />} />
              <Route path="clients" element={<ClientsAdmin />} />
              <Route path="services" element={<ServicesAdmin />} />
              <Route path="careers" element={<CareersAdmin />} />
              <Route path="content" element={<ContentAdmin />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="security" element={<Security />} />
            </Route>
          </Route>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
