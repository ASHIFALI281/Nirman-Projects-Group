import { useState } from "react";
import { MapPin, ArrowUpRight, CalendarDays, CalendarCheck, Tag, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Placeholder } from "./Shared";
import { useLang } from "@/i18n";

const StatusTag = ({ status }) => {
  const { lang } = useLang();
  const label = status === "ongoing" ? (lang === "hi" ? "चालू" : "Ongoing") : lang === "hi" ? "पूर्ण" : "Completed";
  return (
    <span className={`absolute top-4 left-4 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white ${status === "ongoing" ? "bg-ember" : "bg-navy"}`}>{label}</span>
  );
};

const Fact = ({ icon: Icon, label, value }) => (
  <div className="flex gap-3">
    <Icon className="h-4 w-4 text-ember mt-0.5 shrink-0" />
    <div><div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{label}</div><div className="text-navy mt-1">{value}</div></div>
  </div>
);

const Gallery = ({ p }) => {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="relative aspect-video bg-navy">
        <img src={p.images[active]} alt={p.category} className="h-full w-full object-cover" data-testid={`project-gallery-main-${p.id}`} />
        <StatusTag status={p.status} />
      </div>
      <div className="flex gap-2 p-3 bg-slate-100">
        {p.images.map((src, i) => (
          <button key={src + i} onClick={() => setActive(i)} data-testid={`project-thumb-${p.id}-${i}`}
            className={`h-14 w-20 overflow-hidden border-2 transition-colors ${active === i ? "border-ember" : "border-transparent opacity-70 hover:opacity-100"}`}>
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        {p.sample !== false && <span className="ml-auto self-center font-mono text-[9px] uppercase tracking-widest text-slate-500">Representative images</span>}
      </div>
    </div>
  );
};

export const ProjectCard = ({ p }) => (
  <Dialog>
    <DialogTrigger asChild>
      <button className="group text-left bg-white border border-slate-200 transition-shadow duration-300 hover:shadow-[0_20px_50px_rgba(11,31,58,0.12)] w-full" data-testid={`project-card-${p.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden img-zoom">
          <img src={p.images[0]} alt={p.category} className="h-full w-full object-cover" />
          <StatusTag status={p.status} />
          {p.sample !== false && <span className="absolute bottom-3 right-3 bg-white/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-slate-600">Representative image</span>}
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ember-600">{p.category}</span>
            <ArrowUpRight className="h-5 w-5 text-navy transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-navy">{p.title}</h3>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{p.start} — {p.end}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4" />{p.location}</span>
            {p.sample !== false && <Placeholder />}
          </div>
        </div>
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-2xl rounded-none p-0 overflow-hidden" data-testid={`project-dialog-${p.id}`}>
      <Gallery p={p} />
      <div className="p-6 md:p-8 max-h-[45vh] overflow-y-auto">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ember-600">{p.category}</span>
        <DialogTitle className="mt-2 font-display text-2xl text-navy" data-testid={`project-dialog-title-${p.id}`}>{p.title}</DialogTitle>
        <DialogDescription className="mt-3 text-slate-600 leading-relaxed">{p.desc}</DialogDescription>
        <div className="mt-6 grid grid-cols-2 gap-5 text-sm border-t border-slate-200 pt-6">
          <Fact icon={MapPin} label="Location" value={p.location} />
          <Fact icon={Tag} label="Category" value={p.category} />
          <Fact icon={Activity} label="Status" value={p.status === "ongoing" ? "Ongoing" : "Completed"} />
          <Fact icon={CalendarDays} label="Start Date" value={p.start} />
          <Fact icon={CalendarCheck} label={p.status === "ongoing" ? "Expected Completion" : "Completion Date"} value={p.end} />
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
