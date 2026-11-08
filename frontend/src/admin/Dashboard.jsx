import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { HardHat, Users, Wrench, Inbox, BellRing, Briefcase, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fmtDate, formatApiError } from "@/lib/api";
import { PageTitle, StatusBadge, EmptyState } from "./ResourceManager";
import { ENQ_STATUS } from "./Modules";

const ENQ_LABEL = Object.fromEntries(ENQ_STATUS.map((s) => [s.value, s.label]));

const CARDS = [
  { key: "projects", label: "Total Projects", icon: HardHat, to: "/admin/projects" },
  { key: "clients", label: "Total Clients", icon: Users, to: "/admin/clients" },
  { key: "services", label: "Total Services", icon: Wrench, to: "/admin/services" },
  { key: "enquiries", label: "Total Enquiries", icon: Inbox, to: "/admin/enquiries" },
  { key: "new_enquiries", label: "New Enquiries", icon: BellRing, to: "/admin/enquiries", accent: true },
  { key: "applications", label: "Career Applications", icon: Briefcase, to: "/admin/careers" },
];

const Panel = ({ title, to, children, testid }) => (
  <div className="bg-white border border-slate-200" data-testid={testid}>
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
      <h2 className="font-display font-semibold text-navy">{title}</h2>
      <Link to={to} className="text-sm text-ember-600 font-medium flex items-center gap-1 hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
    </div>
    {children}
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [enquiries, setEnquiries] = useState(null);
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/admin/stats"), api.get("/admin/enquiries", { params: { limit: 5 } }), api.get("/admin/projects", { params: { limit: 1000 } })])
      .then(([s, e, p]) => {
        setStats(s.data);
        setEnquiries(e.data);
        setProjects([...p.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5));
      })
      .catch((err) => toast.error(formatApiError(err)));
  }, []);

  return (
    <div data-testid="admin-dashboard">
      <PageTitle title="Dashboard" subtitle="Live overview from the website database." />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {CARDS.map((c) => (
          <Link key={c.key} to={c.to} className={`p-5 border transition-shadow hover:shadow-md ${c.accent ? "bg-ember text-white border-ember" : "bg-white border-slate-200"}`} data-testid={`stat-card-${c.key}`}>
            <c.icon className={`h-6 w-6 ${c.accent ? "text-white" : "text-ember"}`} />
            {stats ? <div className="mt-4 font-display text-3xl font-bold" data-testid={`stat-${c.key}`}>{stats[c.key]}</div> : <Skeleton className="mt-4 h-9 w-14" />}
            <div className={`mt-1 text-xs ${c.accent ? "text-white/85" : "text-slate-500"}`}>{c.label}</div>
          </Link>
        ))}
      </div>
      {stats && <p className="mt-3 text-xs text-slate-500" data-testid="project-split">{stats.ongoing_projects} ongoing · {stats.completed_projects} completed projects</p>}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel title="Recent Enquiries" to="/admin/enquiries" testid="recent-enquiries">
          {!enquiries ? <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            : enquiries.length === 0 ? <EmptyState text="No enquiries received yet." />
            : <ul className="divide-y divide-slate-100">{enquiries.map((e) => (
              <li key={e.id} className="px-5 py-3 flex items-center justify-between gap-4" data-testid={`recent-enquiry-${e.id}`}>
                <div className="min-w-0"><div className="font-medium text-navy truncate">{e.name}</div><div className="text-xs text-slate-500 truncate">{e.phone} · {fmtDate(e.created_at, true)}</div></div>
                <StatusBadge value={e.status} label={ENQ_LABEL[e.status]} />
              </li>))}</ul>}
        </Panel>
        <Panel title="Recent Projects" to="/admin/projects" testid="recent-projects">
          {!projects ? <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            : projects.length === 0 ? <EmptyState text="No projects added yet." />
            : <ul className="divide-y divide-slate-100">{projects.map((p) => (
              <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-4" data-testid={`recent-project-${p.id}`}>
                <div className="min-w-0"><div className="font-medium text-navy truncate">{p.name}</div><div className="text-xs text-slate-500 truncate">{p.category} · {p.location || "—"}</div></div>
                <StatusBadge value={p.status} label={p.status === "ongoing" ? "Ongoing" : "Completed"} />
              </li>))}</ul>}
        </Panel>
      </div>
    </div>
  );
}
