import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import { formatApiError } from "@/lib/api";
import { useAuth } from "./AuthContext";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const dest = useLocation().state?.from || "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={dest} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-navy blueprint p-12 text-white">
        <Logo light />
        <div>
          <ShieldCheck className="h-12 w-12 text-ember" />
          <h1 className="mt-6 text-4xl font-bold">Admin Dashboard</h1>
          <p className="mt-4 text-white/60 max-w-md">Manage enquiries, projects, clients, services, careers and website content for Nirman Projects Group.</p>
        </div>
        <p className="text-xs text-white/40 font-mono">Authorised personnel only</p>
      </div>
      <div className="flex items-center justify-center p-6 bg-slate-50">
        <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 p-8 md:p-10 shadow-[0_20px_50px_rgba(11,31,58,0.08)]" data-testid="admin-login-form">
          <div className="lg:hidden mb-8"><Logo /></div>
          <span className="eyebrow">Secure sign in</span>
          <h2 className="mt-3 text-3xl font-bold text-navy">Welcome back</h2>
          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 rounded-none" data-testid="admin-login-email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 rounded-none" data-testid="admin-login-password" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2" data-testid="admin-login-error">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full h-12 rounded-none bg-ember hover:bg-ember-600 font-semibold" data-testid="admin-login-submit">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
