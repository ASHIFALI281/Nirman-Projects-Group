import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Upload, Loader2, Check, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, assetUrl, fmtDate, formatApiError } from "@/lib/api";
import { MEDIA_CATEGORIES, CATEGORY_LABEL } from "@/site/imageSlots";

export const MAX_MB = 10;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const checkFile = (f) => {
  if (!OK_TYPES.includes(f.type) || !/\.(jpe?g|png|webp)$/i.test(f.name)) return `${f.name}: only JPG, JPEG, PNG or WEBP images are allowed`;
  if (f.size > MAX_MB * 1024 * 1024) return `${f.name}: larger than ${MAX_MB} MB`;
  return null;
};

export const uploadMedia = async (file, category, onProgress) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", category);
  const { data } = await api.post("/admin/media", fd, { onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded * 100) / e.total)) });
  return data;
};

export const fmtBytes = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const useMediaList = (q, category) => {
  const [items, setItems] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/media", { params: { q: q || undefined, category: category === "all" ? undefined : category } });
      setItems(data);
    } catch (err) {
      toast.error(formatApiError(err));
      setItems([]);
    }
  }, [q, category]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  return [items, load];
};

export const Filters = ({ q, setQ, category, setCategory, prefix }) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name" className="pl-9 rounded-none h-10" data-testid={`${prefix}-search`} /></div>
    <Select value={category} onValueChange={setCategory}>
      <SelectTrigger className="rounded-none h-10 sm:w-64" data-testid={`${prefix}-category-filter`}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">All categories</SelectItem>{MEDIA_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>
);

export const MediaTile = ({ m, selected, onClick, prefix = "media" }) => (
  <button type="button" onClick={onClick} className={`group text-left bg-white border transition-shadow hover:shadow-md ${selected ? "border-ember ring-2 ring-ember" : "border-slate-200"}`} data-testid={`${prefix}-tile-${m.id}`}>
    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
      <img src={`${assetUrl(m.url)}?v=${m.version}`} alt={m.filename} loading="lazy" className="h-full w-full object-cover" />
      {selected && <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-ember text-white"><Check className="h-4 w-4" /></span>}
    </div>
    <div className="p-2.5">
      <div className="text-xs font-medium text-navy truncate" title={m.filename}>{m.filename}</div>
      <div className="mt-0.5 text-[11px] text-slate-500 truncate">{CATEGORY_LABEL[m.category]} · {fmtDate(m.created_at)}</div>
    </div>
  </button>
);

export const EmptyMedia = ({ text }) => (
  <div className="py-16 text-center text-slate-500 col-span-full" data-testid="media-empty"><ImageOff className="h-10 w-10 mx-auto text-slate-300" /><p className="mt-3 text-sm">{text}</p></div>
);

const PickerUpload = ({ category, onUploaded }) => {
  const ref = useRef(null);
  const [progress, setProgress] = useState(null);
  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    const uploaded = [];
    for (const f of files) {
      const err = checkFile(f);
      if (err) { toast.error(err); continue; }
      setProgress(0);
      try {
        uploaded.push(await uploadMedia(f, category, setProgress));
      } catch (er) {
        toast.error(`${f.name}: ${formatApiError(er)}`);
      }
    }
    setProgress(null);
    if (uploaded.length) {
      toast.success(uploaded.length > 1 ? `${uploaded.length} images uploaded` : "Image uploaded");
      onUploaded(uploaded);
    }
  };
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" className="rounded-none" disabled={progress !== null} onClick={() => ref.current?.click()} data-testid="picker-upload-btn">{progress !== null ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}Upload new</Button>
      {progress !== null && <Progress value={progress} className="h-2 w-32" data-testid="picker-upload-progress" />}
      <input ref={ref} type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={onFiles} data-testid="picker-file-input" />
    </div>
  );
};

export const MediaPicker = ({ open, onClose, onSelect, multiple, category = "other", title = "Choose an image" }) => {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [items, reload] = useMediaList(q, cat);
  const [sel, setSel] = useState([]);
  useEffect(() => {
    if (open) { setSel([]); setQ(""); setCat("all"); reload(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const toggle = (m) => setSel((s) => (multiple ? (s.find((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : [...s, m]) : [m]));
  const done = () => { onSelect(multiple ? sel : sel[0]); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none max-w-5xl w-[calc(100vw-1.5rem)] max-h-[90vh] flex flex-col" data-testid="media-picker">
        <DialogTitle className="font-display text-xl text-navy">{title}</DialogTitle>
        <DialogDescription>Pick from the Media Library or upload new photos (JPG, PNG, WEBP, up to {MAX_MB} MB).</DialogDescription>
        <div className="flex flex-col gap-3"><Filters q={q} setQ={setQ} category={cat} setCategory={setCat} prefix="picker" /><PickerUpload category={category} onUploaded={(ups) => { reload(); setSel((s) => (multiple ? [...s, ...ups] : [ups[ups.length - 1]])); }} /></div>
        <div className="flex-1 overflow-y-auto grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 py-2 min-h-[200px]">
          {!items ? <div className="col-span-full grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ember" /></div>
            : items.length === 0 ? <EmptyMedia text="No images found. Upload one above." />
            : items.map((m) => <MediaTile key={m.id} m={m} prefix="picker" selected={!!sel.find((x) => x.id === m.id)} onClick={() => toggle(m)} />)}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="ghost" className="rounded-none" onClick={onClose}>Cancel</Button>
          <Button className="rounded-none bg-ember hover:bg-ember-600" disabled={!sel.length} onClick={done} data-testid="picker-confirm-btn">{multiple && sel.length > 1 ? `Use ${sel.length} images` : "Use this image"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
