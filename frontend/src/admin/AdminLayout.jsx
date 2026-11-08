import { useState } from "react";
import { Navigate, NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { LayoutDashboard, Inbox, HardHat, Users, Wrench, Briefcase, FileText, ShieldCheck, Images, LogOut, Menu, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site/Logo";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "./AuthContext";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { to: "/admin/projects", label: "Projects", icon: HardHat },
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/services", label: "Services", icon: Wrench },
  { to: "/admin/careers", label: "Careers", icon: Briefcase },
  { to: "/admin/content", label: "Website Content", icon: FileText },
  { to: "/admin/media", label: "Media Management", icon: Images },
  { to: "/admin/security", label: "Backup & Security", icon: ShieldCheck },
];

const SidebarNav = ({ onNavigate }) => (
  <nav className="flex flex-col gap-1">
    {NAV_ITEMS.map((n) => (
      <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} data-testid={`admin-nav-${n.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
        className={({ isActive }) => `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isActive ? "bg-ember text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
        <n.icon className="h-4 w-4" />{n.label}
      </NavLink>
    ))}
  </nav>
);

const ChangePassword = () => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.next.length < 10) return toast.error("New password must be at least 10 characters.");
    if (f.next !== f.confirm) return toast.error("New passwords do not match.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: f.current, new_password: f.next });
      toast.success("Password changed successfully.");
      setF({ current: "", next: "", confirm: "" });
      setOpen(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };
  const field = (k, label) => (
    <div className="space-y-2"><Label>{label}</Label><Input type="password" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="rounded-none" data-testid={`change-password-${k}`} /></div>
  );
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} data-testid="change-password-btn"><KeyRound className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Password</span></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogTitle className="font-display text-xl text-navy">Change password</DialogTitle>
          <DialogDescription>Use at least 10 characters.</DialogDescription>
          <form onSubmit={submit} className="space-y-4">
            {field("current", "Current password")}{field("next", "New password")}{field("confirm", "Confirm new password")}
            <Button type="submit" disabled={busy} className="w-full rounded-none bg-ember hover:bg-ember-600" data-testid="change-password-submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const FullLoader = () => (
  <div className="min-h-screen grid place-items-center bg-slate-50" data-testid="admin-loading"><Loader2 className="h-8 w-8 animate-spin text-ember" /></div>
);

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  if (user === null) return <FullLoader />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="min-h-screen bg-slate-100" data-testid="admin-layout">
      <aside className="hidden lg:flex w-64 flex-col bg-navy blueprint text-white fixed inset-y-0 left-0 z-30">
        <div className="p-6 border-b border-white/10"><Logo light /></div>
        <div className="flex-1 py-6 px-3"><SidebarNav /></div>
        <div className="p-6 border-t border-white/10 text-xs text-white/50 break-all" data-testid="admin-user-email">{user.email}</div>
      </aside>
      <div className="lg:ml-64 min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild><button className="lg:hidden p-2 text-navy" data-testid="admin-mobile-menu-btn" aria-label="Open menu"><Menu className="h-5 w-5" /></button></SheetTrigger>
              <SheetContent side="left" className="bg-navy text-white border-none w-72 p-0">
                <SheetTitle className="sr-only">Admin menu</SheetTitle>
                <div className="p-6 border-b border-white/10"><Logo light /></div>
                <div className="py-6 px-3"><SidebarNav onNavigate={() => setOpen(false)} /></div>
              </SheetContent>
            </Sheet>
            <span className="font-display font-semibold text-navy">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/" target="_blank" data-testid="admin-view-site"><ExternalLink className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">View site</span></Link></Button>
            <ChangePassword />
            <Button variant="outline" size="sm" className="rounded-none" onClick={logout} data-testid="admin-logout-btn"><LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Logout</span></Button>
          </div>
        </header>
        <main className="p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
