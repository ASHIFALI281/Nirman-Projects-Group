import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Database, ShieldCheck, ShieldAlert, HardDrive, CalendarClock, Loader2, RotateCcw, FlaskConical, AlertTriangle, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, fmtDate, formatApiError } from "@/lib/api";
import { PageTitle, EmptyState } from "./ResourceManager";

const KIND = { scheduled: "Daily (automatic)", manual: "Manual", pre_restore: "Safety (before restore)" };
const STATUS_CLS = { success: "bg-emerald-50 text-emerald-700 border-emerald-200", failed: "bg-red-50 text-red-700 border-red-200", running: "bg-amber-50 text-amber-700 border-amber-200" };
const fmtSize = (b) => (b == null ? "—" : b > 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`);

const Badge = ({ run, m = "" }) => {
  const label = run.expired ? "Expired" : run.status === "success" ? "Success" : run.status === "failed" ? "Failed" : "Running";
  return <span className={`inline-flex border px-2 py-0.5 text-xs font-medium ${run.expired ? "bg-slate-100 text-slate-500 border-slate-200" : STATUS_CLS[run.status]}`} data-testid={`backup-status-${m}${run.id}`}>{label}</span>;
};

const StatCard = ({ icon: Icon, label, value, sub, tone, testid }) => (
  <div className={`p-5 border bg-white ${tone === "bad" ? "border-red-300" : "border-slate-200"}`} data-testid={testid}>
    <Icon className={`h-6 w-6 ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-600" : "text-ember"}`} />
    <div className="mt-3 font-display text-lg font-bold text-navy break-words" data-testid={`${testid}-value`}>{value}</div>
    <div className="text-xs text-slate-500">{label}</div>
    {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
  </div>
);

const Overview = ({ o }) => {
  const ok = o.latest?.status === "success";
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Database} testid="db-status" label="Database connection" value={o.database.connected ? "Connected" : "Unreachable"} sub={o.database.connected ? `Response ${o.database.latency_ms} ms` : null} tone={o.database.connected ? "good" : "bad"} />
      <StatCard icon={ok ? ShieldCheck : ShieldAlert} testid="backup-state" label="Latest backup status" value={o.latest ? (ok ? "Healthy" : o.latest.status === "failed" ? "Failed" : "Running") : "No backups yet"} sub={o.latest ? fmtDate(o.latest.started_at, true) : null} tone={ok ? "good" : o.latest ? "bad" : null} />
      <StatCard icon={HardDrive} testid="last-success" label="Last successful backup" value={o.last_success ? fmtDate(o.last_success.started_at, true) : "Never"} sub={o.last_success ? `${o.last_success.total_records} records · ${fmtSize(o.last_success.size_bytes)}` : null} />
      <StatCard icon={CalendarClock} testid="backup-schedule" label="Automatic schedule" value={o.schedule_configured ? o.schedule : "Not configured"} sub={`Kept for ${o.retention_days} days · ${o.storage}`} tone={o.schedule_configured ? null : "bad"} />
    </div>
  );
};

const FailureAlert = ({ failures }) => !failures.length ? null : (
  <div className="mt-6 border border-red-300 bg-red-50 p-4 flex gap-3" data-testid="backup-failure-alert">
    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
    <div className="text-sm text-red-800"><div className="font-semibold">{failures.length} backup{failures.length > 1 ? "s" : ""} failed since the last successful backup</div>
      <div className="mt-1">Latest: {fmtDate(failures[0].started_at, true)} — {failures[0].error}. An email alert was sent. Press "Back up now" to retry.</div></div>
  </div>
);

const RestoreDialog = ({ run, onClose, onDone }) => {
  const [f, setF] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/security/backups/${run.id}/restore`, f);
      toast.success(`Restore complete: ${data.records} records restored. A safety backup of the previous data was saved first.`);
      onDone();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!run} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="rounded-none max-w-md" data-testid="restore-dialog">
        <DialogTitle className="font-display text-xl text-navy">Restore this backup?</DialogTitle>
        <DialogDescription>All live website data (except the admin login, which keeps its current password) will be replaced with the backup from <strong>{run && fmtDate(run.started_at, true)}</strong> ({run?.total_records} records). The backup is tested in a separate test database first, and a safety backup of today's data is taken before anything is overwritten.</DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>Your admin password</Label><Input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="rounded-none" data-testid="restore-password-input" /></div>
          <div className="space-y-2"><Label>Type RESTORE to confirm</Label><Input required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} className="rounded-none" data-testid="restore-confirm-input" /></div>
          <Button type="submit" disabled={busy || f.confirm !== "RESTORE"} className="w-full rounded-none bg-red-600 hover:bg-red-700" data-testid="restore-submit-btn">{busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Restoring…</> : "Restore backup"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const HistoryRow = ({ r, busyId, onVerify, onRestore }) => {
  const usable = r.status === "success" && !r.expired;
  return (
    <tr className="border-t border-slate-100 align-top" data-testid={`backup-row-${r.id}`}>
      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.started_at, true)}</td>
      <td className="px-4 py-3">{KIND[r.kind] || r.kind}</td>
      <td className="px-4 py-3"><Badge run={r} />{r.error && <div className="mt-1 text-xs text-red-600 max-w-xs">{r.error}</div>}</td>
      <td className="px-4 py-3 whitespace-nowrap">{r.total_records ?? "—"} · {fmtSize(r.size_bytes)}</td>
      <td className="px-4 py-3 text-xs max-w-xs" data-testid={`backup-verify-result-${r.id}`}><VerifyInfo r={r} /></td>
      <td className="px-4 py-3 whitespace-nowrap">{usable && <Actions r={r} busyId={busyId} onVerify={onVerify} onRestore={onRestore} />}</td>
    </tr>
  );
};

const VerifyInfo = ({ r }) => (
  <>{r.verified_at ? <span className={r.verify_ok ? "text-emerald-700" : "text-red-600"}>{r.verify_ok ? "Verified" : "Failed"} {fmtDate(r.verified_at, true)}</span> : <span className="text-slate-400">Not tested</span>}{r.restored_at && <div className="text-amber-700">Restored {fmtDate(r.restored_at, true)}</div>}</>
);

const Actions = ({ r, busyId, onVerify, onRestore, m = "" }) => (
  <div className="flex gap-2">
    <Button size="sm" variant="outline" className="rounded-none flex-1 sm:flex-none" disabled={!!busyId} onClick={() => onVerify(r)} data-testid={`backup-verify-btn-${m}${r.id}`}>{busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 mr-1" />}Test restore</Button>
    <Button size="sm" variant="outline" className="rounded-none flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50" disabled={!!busyId} onClick={() => onRestore(r)} data-testid={`backup-restore-btn-${m}${r.id}`}><RotateCcw className="h-3.5 w-3.5 mr-1" />Restore</Button>
  </div>
);

const HistoryCard = ({ r, busyId, onVerify, onRestore }) => (
  <li className="p-4 space-y-2 text-sm" data-testid={`backup-card-${r.id}`}>
    <div className="flex items-start justify-between gap-3"><div><div className="font-medium text-navy">{fmtDate(r.started_at, true)}</div><div className="text-xs text-slate-500">{KIND[r.kind] || r.kind}</div></div><Badge run={r} m="m-" /></div>
    {r.error && <div className="text-xs text-red-600">{r.error}</div>}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600"><span>{r.total_records ?? "—"} records · {fmtSize(r.size_bytes)}</span><span data-testid={`backup-verify-result-m-${r.id}`}><VerifyInfo r={r} /></span></div>
    {r.status === "success" && !r.expired && <Actions r={r} busyId={busyId} onVerify={onVerify} onRestore={onRestore} m="m-" />}
  </li>
);

const History = ({ runs, busyId, onVerify, onRestore }) => (
  <div className="mt-8 bg-white border border-slate-200" data-testid="backup-history">
    <div className="px-5 py-4 border-b border-slate-200"><h2 className="font-display font-semibold text-navy">Backup history</h2><p className="text-xs text-slate-500">"Test restore" loads the backup into a separate test database, checks every record, then deletes the test copy. Live data is not touched.</p></div>
    {runs.length === 0 ? <EmptyState text="No backups have been taken yet." /> : (
      <>
      <ul className="md:hidden divide-y divide-slate-100" data-testid="backup-history-mobile">{runs.map((r) => <HistoryCard key={r.id} r={r} busyId={busyId} onVerify={onVerify} onRestore={onRestore} />)}</ul>
      <div className="hidden md:block overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{["Date", "Type", "Status", "Records · Size", "Test restore", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{runs.map((r) => <HistoryRow key={r.id} r={r} busyId={busyId} onVerify={onVerify} onRestore={onRestore} />)}</tbody></table></div>
      </>)}
  </div>
);

const EVENT_LABEL = { login_success: "Admin login", login_failed: "Failed login", login_locked: "Account locked (15 min)", login_blocked: "Login blocked while locked", logout: "Logout", password_changed: "Password changed", password_change_failed: "Wrong current password", rate_limited: "Too many requests blocked", spam_blocked: "Spam submission blocked", server_error: "Server error", backup_success: "Backup completed", backup_failed: "Backup failed", backup_verified: "Test restore passed", backup_verify_failed: "Test restore failed", restore_started: "Restore started", restore_completed: "Restore completed", restore_denied: "Restore denied", restore_integrity_failed: "Restore integrity failed", cron_unauthorized: "Unauthorized schedule call" };
const SEV = { critical: "text-red-600", warning: "text-amber-600", info: "text-slate-500" };

const Events = ({ events, o }) => (
  <div className="mt-8 bg-white border border-slate-200" data-testid="security-events">
    <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap gap-x-6 gap-y-1 items-end justify-between"><h2 className="font-display font-semibold text-navy">Security activity</h2>
      <div className="text-xs text-slate-500" data-testid="security-24h">Last 24 h: {o.failed_logins_24h} failed logins · {o.lockouts_24h} lockouts · {o.errors_24h} server errors</div></div>
    {events.length === 0 ? <EmptyState text="No security events recorded yet." /> : (
      <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">{events.map((e) => (
        <li key={e.id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm" data-testid={`security-event-${e.id}`}>
          <span className={`font-medium ${SEV[e.severity]}`}>{EVENT_LABEL[e.event] || e.event}</span>
          <span className="text-xs text-slate-500">{[e.detail?.email, e.detail?.form, e.detail?.path, e.ip].filter(Boolean).join(" · ")} · {fmtDate(e.created_at, true)}</span>
        </li>))}</ul>)}
  </div>
);

export default function Security() {
  const [o, setO] = useState(null);
  const [runs, setRuns] = useState([]);
  const [events, setEvents] = useState([]);
  const [backingUp, setBackingUp] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [restoreRun, setRestoreRun] = useState(null);

  const load = useCallback(async () => {
    try {
      const [ov, b, ev] = await Promise.all([api.get("/admin/security/overview"), api.get("/admin/security/backups"), api.get("/admin/security/events")]);
      setO(ov.data); setRuns(b.data); setEvents(ev.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const backupNow = async () => {
    setBackingUp(true);
    try {
      const { data } = await api.post("/admin/security/backups");
      toast.success(`Backup completed: ${data.total_records} records saved.`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBackingUp(false);
      load();
    }
  };
  const verify = async (r) => {
    setBusyId(r.id);
    try {
      const { data } = await api.post(`/admin/security/backups/${r.id}/verify`);
      data.ok ? toast.success(data.message) : toast.error(data.message);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusyId(null);
      load();
    }
  };

  return (
    <div data-testid="admin-security">
      <PageTitle title="Backup & Security" subtitle="Live status of database backups, restores and security events."
        action={<Button onClick={backupNow} disabled={backingUp || !!busyId} className="rounded-none bg-ember hover:bg-ember-600" data-testid="backup-now-btn">{backingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CloudUpload className="h-4 w-4 mr-2" />}Back up now</Button>} />
      {!o ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div> : <>
        <Overview o={o} />
        <FailureAlert failures={o.failures_since_last_success} />
        <History runs={runs} busyId={busyId} onVerify={verify} onRestore={setRestoreRun} />
        <Events events={events} o={o} />
      </>}
      <RestoreDialog run={restoreRun} onClose={() => setRestoreRun(null)} onDone={() => { setRestoreRun(null); load(); }} />
    </div>
  );
}
