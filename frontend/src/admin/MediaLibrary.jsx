import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, RefreshCw, Trash2, CheckCircle2, XCircle, ExternalLink, RotateCcw, ImagePlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, assetUrl, fmtDate, formatApiError } from "@/lib/api";
import { MEDIA_CATEGORIES, IMAGE_SLOTS, SLOT_LABEL, SERVICE_CATEGORY } from "@/site/imageSlots";
import { PageTitle } from "./ResourceManager";
import { MediaPicker, MediaTile, Filters, EmptyMedia, useMediaList, uploadMedia, checkFile, fmtBytes, MAX_MB } from "./MediaPicker";

const CategorySelect = ({ value, onChange, testid }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="rounded-none h-10" data-testid={testid}><SelectValue /></SelectTrigger>
    <SelectContent>{MEDIA_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
  </Select>
);

const QueueItem = ({ q, i }) => (
  <li className="flex items-center gap-3 p-2 border border-slate-200 bg-white" data-testid={`upload-item-${i}`}>
    <img src={q.preview} alt="" className="h-12 w-16 object-cover bg-slate-100 shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-navy truncate">{q.name}</div>
      {q.status === "error" ? <div className="text-xs text-red-600">{q.error}</div> : <Progress value={q.progress} className="h-1.5 mt-1.5" />}
    </div>
    {q.status === "done" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : q.status === "error" ? <XCircle className="h-5 w-5 text-red-600" /> : <span className="text-xs text-slate-500 w-9 text-right">{q.progress}%</span>}
  </li>
);

const UploadPanel = ({ onUploaded }) => {
  const ref = useRef(null);
  const [category, setCategory] = useState("other");
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const patch = (i, p) => setQueue((qs) => qs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const start = async (files) => {
    if (!files.length || busy) return;
    const items = files.map((f) => ({ file: f, name: f.name, preview: URL.createObjectURL(f), progress: 0, status: "waiting", error: checkFile(f) }));
    items.forEach((x) => { if (x.error) x.status = "error"; });
    setQueue(items);
    setBusy(true);
    let ok = 0;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].status === "error") continue;
      patch(i, { status: "uploading" });
      try {
        await uploadMedia(items[i].file, category, (p) => patch(i, { progress: p }));
        patch(i, { status: "done", progress: 100 });
        ok += 1;
      } catch (err) {
        patch(i, { status: "error", error: formatApiError(err) });
      }
    }
    setBusy(false);
    const failed = items.length - ok;
    if (ok) toast.success(`${ok} image${ok > 1 ? "s" : ""} uploaded to the Media Library`);
    if (failed) toast.error(`${failed} image${failed > 1 ? "s" : ""} could not be uploaded`);
    onUploaded();
  };

  return (
    <div className="bg-white border border-slate-200 p-5" data-testid="media-upload-panel">
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-2"><Label>Category for new photos</Label><CategorySelect value={category} onChange={setCategory} testid="upload-category-select" /></div>
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); start([...e.dataTransfer.files]); }}
          className={`border-2 border-dashed p-6 text-center transition-colors ${drag ? "border-ember bg-ember/5" : "border-slate-300"}`} data-testid="media-dropzone">
          <Upload className="h-7 w-7 mx-auto text-ember" />
          <p className="mt-2 text-sm text-slate-600">Drag photos here, or</p>
          <Button type="button" className="mt-2 rounded-none bg-ember hover:bg-ember-600" disabled={busy} onClick={() => ref.current?.click()} data-testid="media-upload-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImagePlus className="h-4 w-4 mr-2" />}Choose photos</Button>
          <p className="mt-2 text-xs text-slate-400">JPG, JPEG, PNG or WEBP · up to {MAX_MB} MB each · select several at once</p>
          <input ref={ref} type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; start(f); }} data-testid="media-file-input" />
        </div>
      </div>
      {queue.length > 0 && <ul className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="upload-queue">{queue.map((q, i) => <QueueItem key={i} q={q} i={i} />)}</ul>}
    </div>
  );
};

const UsageList = ({ places }) => (
  <ul className="mt-1 space-y-1 text-sm" data-testid="media-usage-list">
    {places.map((p, i) => <li key={i} className="text-navy">• {p.kind === "slot" ? SLOT_LABEL[p.key] || p.key : p.label}</li>)}
  </ul>
);

const ReplaceButton = ({ m, onDone }) => {
  const ref = useRef(null);
  const [progress, setProgress] = useState(null);
  const onFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const err = checkFile(f);
    if (err) return toast.error(err);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post(`/admin/media/${m.id}/replace`, fd, { onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded * 100) / ev.total)) });
      toast.success(data.used_in.length ? `Image replaced in ${data.used_in.length} place${data.used_in.length > 1 ? "s" : ""} on the website` : "Image replaced");
      onDone(data);
    } catch (er) {
      toast.error(formatApiError(er));
    } finally {
      setProgress(null);
    }
  };
  return (
    <div className="flex-1">
      <Button type="button" variant="outline" className="w-full rounded-none" disabled={progress !== null} onClick={() => ref.current?.click()} data-testid="media-replace-btn">{progress !== null ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Replace photo</Button>
      {progress !== null && <Progress value={progress} className="h-1.5 mt-2" data-testid="media-replace-progress" />}
      <input ref={ref} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} data-testid="media-replace-input" />
    </div>
  );
};

const DetailDialog = ({ m, onClose, onChanged }) => {
  const [form, setForm] = useState({ filename: "", category: "other" });
  const [places, setPlaces] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!m) return;
    setForm({ filename: m.filename, category: m.category });
    setPlaces(null);
    setBlocked(null);
    api.get(`/admin/media/${m.id}/usage`).then((r) => setPlaces(r.data)).catch(() => setPlaces([]));
  }, [m]);
  if (!m) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/media/${m.id}`, form);
      toast.success("Image details saved");
      onChanged(data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    try {
      await api.delete(`/admin/media/${m.id}`);
      toast.success("Image deleted from the Media Library");
      onChanged(null);
      onClose();
    } catch (err) {
      const d = err?.response?.data?.detail;
      if (err?.response?.status === 409 && d?.used_in) {
        setBlocked(d.used_in);
        toast.error("This image is used on the website and cannot be deleted yet.");
      } else toast.error(formatApiError(err));
    }
  };

  return (
    <>
      <Dialog open={!!m} onOpenChange={(o) => !o && onClose()}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="rounded-none max-w-3xl w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto" data-testid="media-detail-dialog">
          <DialogTitle className="font-display text-xl text-navy break-all">{m.filename}</DialogTitle>
          <DialogDescription>Uploaded {fmtDate(m.created_at, true)} · {fmtBytes(m.size)}{m.width ? ` · ${m.width}×${m.height}px` : ""}{m.version > 1 ? ` · replaced ${m.version - 1}×` : ""}</DialogDescription>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-slate-100 aspect-[4/3] overflow-hidden"><img src={`${assetUrl(m.url)}?v=${m.version}`} alt={m.filename} className="h-full w-full object-contain" data-testid="media-detail-preview" /></div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>File name</Label><Input value={form.filename} onChange={(e) => setForm({ ...form, filename: e.target.value })} className="rounded-none" data-testid="media-filename-input" /></div>
              <div className="space-y-2"><Label>Category</Label><CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} testid="media-category-select" /></div>
              <Button onClick={save} disabled={saving} className="w-full rounded-none bg-navy hover:bg-navy/90" data-testid="media-save-btn">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save details"}</Button>
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-slate-400">Used on the website</div>
                {places === null ? <Loader2 className="h-4 w-4 animate-spin mt-2" /> : places.length ? <UsageList places={places} /> : <p className="mt-1 text-sm text-slate-500" data-testid="media-not-used">Not used anywhere yet.</p>}
              </div>
            </div>
          </div>
          {blocked && <div className="border border-red-300 bg-red-50 p-3 text-sm text-red-800" data-testid="media-delete-blocked">This image cannot be deleted because it is shown on the website. Replace it in these places first (or use "Replace photo" to swap the picture everywhere):<UsageList places={blocked} /></div>}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-200">
            <ReplaceButton m={m} onDone={(d) => onChanged(d)} />
            <Button asChild variant="outline" className="flex-1 rounded-none"><a href={assetUrl(m.url)} target="_blank" rel="noreferrer" data-testid="media-open-btn"><ExternalLink className="h-4 w-4 mr-2" />Open full size</a></Button>
            <Button variant="outline" className="flex-1 rounded-none text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirm(true)} data-testid="media-delete-btn"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-none" data-testid="media-delete-confirm">
          <AlertDialogHeader><AlertDialogTitle>Delete this image?</AlertDialogTitle><AlertDialogDescription>"{m.filename}" will be removed from the Media Library. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-none" data-testid="media-delete-cancel">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-none bg-red-600 hover:bg-red-700" onClick={remove} data-testid="media-delete-confirm-btn">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Library = () => {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [items, reload] = useMediaList(q, category);
  const [selected, setSelected] = useState(null);
  return (
    <div className="space-y-6">
      <UploadPanel onUploaded={reload} />
      <div className="bg-white border border-slate-200 p-5" data-testid="media-gallery">
        <Filters q={q} setQ={setQ} category={category} setCategory={setCategory} prefix="media" />
        <p className="mt-3 text-xs text-slate-500" data-testid="media-count">{items ? `${items.length} image${items.length === 1 ? "" : "s"}` : "Loading…"} · click an image to view, rename, replace or delete it.</p>
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {!items ? <div className="col-span-full grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ember" /></div>
            : items.length === 0 ? <EmptyMedia text={q || category !== "all" ? "No images match your search." : "No images uploaded yet."} />
            : items.map((m) => <MediaTile key={m.id} m={m} selected={selected?.id === m.id} onClick={() => setSelected(m)} />)}
        </div>
      </div>
      <DetailDialog m={selected} onClose={() => setSelected(null)} onChanged={(d) => { if (d) setSelected(d); reload(); }} />
    </div>
  );
};

const SlotCard = ({ testid, label, sub, src, isDefault, onChange, onReset, busy }) => (
  <div className="bg-white border border-slate-200 flex flex-col" data-testid={testid}>
    <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden"><img src={src} alt={label} className="h-full w-full object-cover" data-testid={`${testid}-img`} />
      <span className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-medium ${isDefault ? "bg-white/90 text-slate-600" : "bg-ember text-white"}`}>{isDefault ? "Default photo" : "Your photo"}</span></div>
    <div className="p-3 flex-1 flex flex-col">
      <div className="text-sm font-medium text-navy">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
      <div className="mt-3 flex gap-2 mt-auto pt-3">
        <Button size="sm" className="flex-1 rounded-none bg-ember hover:bg-ember-600" disabled={busy} onClick={onChange} data-testid={`${testid}-change`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Change photo"}</Button>
        {!isDefault && onReset && <Button size="sm" variant="outline" className="rounded-none" disabled={busy} onClick={onReset} data-testid={`${testid}-reset`} title="Use default photo"><RotateCcw className="h-3.5 w-3.5" /></Button>}
      </div>
    </div>
  </div>
);

const SERVICE_DEFAULT = { civil: "/images/civil.jpg", electrical: "/images/electrical.jpg", building: "/images/residential.jpg", government: "/images/government.jpg", material: "/images/material.jpg", plumbing: "/images/plumbing.jpg", carpentry: "/images/carpentry.jpg", ups: "/images/ups.jpg" };

const WebsiteImages = () => {
  const [slots, setSlots] = useState(null);
  const [services, setServices] = useState(null);
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    Promise.all([api.get("/content/site.images").then((r) => r.data.value || {}).catch(() => ({})), api.get("/admin/services", { params: { limit: 100 } })])
      .then(([s, sv]) => { setSlots(s); setServices(sv.data); })
      .catch((err) => toast.error(formatApiError(err)));
  }, []);

  const saveSlot = async (key, url) => {
    setBusy(key);
    const next = { ...slots };
    if (url) next[key] = url; else delete next[key];
    try {
      await api.put("/admin/content/site.images", { value: next, description: "Website image positions" });
      setSlots(next);
      toast.success(url ? "Photo updated on the website" : "Default photo restored");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy("");
    }
  };
  const saveService = async (s, url) => {
    setBusy(s.id);
    try {
      const { data } = await api.put(`/admin/services/${s.id}`, { image_url: url });
      setServices((list) => list.map((x) => (x.id === s.id ? data : x)));
      toast.success(url.startsWith("/api/") ? `${s.title_en} photo updated on the website` : `${s.title_en} default photo restored`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy("");
    }
  };
  const onPicked = (m) => {
    if (!m || !picker) return;
    if (picker.service) saveService(picker.service, m.url);
    else saveSlot(picker.key, m.url);
  };

  if (!slots || !services) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ember" /></div>;
  const groups = [...new Set(IMAGE_SLOTS.map((s) => s.group))];
  const grid = "grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";
  return (
    <div className="space-y-8" data-testid="website-images">
      <p className="text-sm text-slate-600">Each card is a photo position on the public website. Press <strong>Change photo</strong>, pick a photo from the library (or upload a new one) and it goes live immediately.</p>
      {groups.map((g) => (
        <section key={g}><h2 className="font-display font-semibold text-navy mb-3">{g}</h2>
          <div className={grid}>{IMAGE_SLOTS.filter((s) => s.group === g).map((s) => (
            <SlotCard key={s.key} testid={`slot-${s.key.replace(".", "-")}`} label={s.label} src={assetUrl(slots[s.key]) || s.fallback} isDefault={!slots[s.key]} busy={busy === s.key}
              onChange={() => setPicker({ key: s.key, category: s.category, title: `Choose photo: ${g} — ${s.label}` })} onReset={() => saveSlot(s.key, "")} />))}</div>
        </section>
      ))}
      <section><h2 className="font-display font-semibold text-navy mb-3">Service photos</h2>
        <div className={grid}>{services.map((s) => (
          <SlotCard key={s.id} testid={`slot-service-${s.slug}`} label={s.title_en} sub={s.active ? "Shown on Home and Services pages" : "Service is unpublished"} src={assetUrl(s.image_url) || "/images/civil.jpg"} isDefault={!s.image_url?.startsWith("/api/")} busy={busy === s.id}
            onChange={() => setPicker({ service: s, category: SERVICE_CATEGORY[s.slug] || "services", title: `Choose photo: ${s.title_en}` })}
            onReset={() => saveService(s, SERVICE_DEFAULT[s.slug] || "/images/civil.jpg")} />))}</div>
      </section>
      <p className="text-xs text-slate-500">Project gallery photos are managed per project in <strong>Projects</strong> (open a project → Project images: add, replace, reorder with arrows, or remove).</p>
      <MediaPicker open={!!picker} onClose={() => setPicker(null)} onSelect={onPicked} category={picker?.category} title={picker?.title} />
    </div>
  );
};

export default function MediaLibrary() {
  const tab = "rounded-none px-4 py-2 data-[state=active]:bg-navy data-[state=active]:text-white";
  return (
    <div data-testid="admin-media-page">
      <PageTitle title="Media Management" subtitle="Upload, organise and place all website photos. Stored in permanent private cloud storage." />
      <Tabs defaultValue="library">
        <TabsList className="rounded-none bg-white border border-slate-200 p-1 h-auto mb-6 flex-wrap justify-start">
          <TabsTrigger value="library" className={tab} data-testid="media-tab-library">Media Library</TabsTrigger>
          <TabsTrigger value="website" className={tab} data-testid="media-tab-website">Website Images</TabsTrigger>
        </TabsList>
        <TabsContent value="library"><Library /></TabsContent>
        <TabsContent value="website"><WebsiteImages /></TabsContent>
      </Tabs>
    </div>
  );
}
