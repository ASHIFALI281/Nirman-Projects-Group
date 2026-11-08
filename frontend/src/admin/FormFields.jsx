import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, RefreshCw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assetUrl } from "@/lib/api";
import { MediaPicker } from "./MediaPicker";

const IconBtn = ({ onClick, label, testid, children, danger }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} data-testid={testid}
    className={`grid h-6 w-6 place-items-center rounded-full text-white shadow ${danger ? "bg-red-600" : "bg-navy/90 hover:bg-ember"}`}>{children}</button>
);

export const ImageUploader = ({ value, onChange, multiple, testid, category = "other" }) => {
  const [picker, setPicker] = useState(null);
  const list = multiple ? value || [] : value ? [value] : [];

  const set = (next) => onChange(multiple ? next : next[0] || "");
  const move = (i, d) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(next);
  };
  const onPicked = (picked) => {
    const urls = (Array.isArray(picked) ? picked : [picked]).filter(Boolean).map((m) => m.url);
    if (!urls.length) return;
    if (picker === "add") set(multiple ? [...list, ...urls] : [urls[0]]);
    else set(list.map((u, j) => (j === picker ? urls[0] : u)));
  };

  return (
    <div data-testid={testid}>
      <div className="flex flex-wrap gap-3">
        {list.map((src, i) => (
          <div key={src + i} className="relative h-24 w-32 border border-slate-200 bg-slate-50" data-testid={`${testid}-item-${i}`}>
            <img src={assetUrl(src)} alt="" className="h-full w-full object-cover" />
            {multiple && <span className="absolute bottom-1 left-1 bg-navy/80 px-1.5 text-[10px] text-white">{i === 0 ? "Cover" : i + 1}</span>}
            <div className="absolute -top-2 -right-2 flex gap-1">
              <IconBtn onClick={() => setPicker(i)} label="Replace image" testid={`${testid}-replace-${i}`}><RefreshCw className="h-3 w-3" /></IconBtn>
              <IconBtn onClick={() => set(list.filter((_, j) => j !== i))} label="Remove image" testid={`${testid}-remove-${i}`} danger><X className="h-3 w-3" /></IconBtn>
            </div>
            {multiple && list.length > 1 && <div className="absolute bottom-1 right-1 flex gap-1">
              {i > 0 && <IconBtn onClick={() => move(i, -1)} label="Move left" testid={`${testid}-left-${i}`}><ArrowLeft className="h-3 w-3" /></IconBtn>}
              {i < list.length - 1 && <IconBtn onClick={() => move(i, 1)} label="Move right" testid={`${testid}-right-${i}`}><ArrowRight className="h-3 w-3" /></IconBtn>}
            </div>}
          </div>
        ))}
        {(multiple || list.length === 0) && (
          <button type="button" onClick={() => setPicker("add")} className="h-24 w-32 border-2 border-dashed border-slate-300 grid place-items-center text-slate-500 hover:border-ember hover:text-ember transition-colors" data-testid={`${testid}-btn`}>
            <span className="flex flex-col items-center text-xs gap-1"><Plus className="h-5 w-5" />{multiple ? "Add images" : "Choose image"}</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">Choose from the Media Library or upload new (JPG, PNG, WEBP, up to 10 MB).{multiple ? " The first image is the cover; use the arrows to reorder." : ""}</p>
      <MediaPicker open={picker !== null} onClose={() => setPicker(null)} onSelect={onPicked} multiple={multiple && picker === "add"} category={category} />
    </div>
  );
};

export const FieldInput = ({ f, value, onChange }) => {
  const id = `field-${f.name}`;
  const common = { id, "data-testid": `field-${f.name}`, placeholder: f.placeholder };
  switch (f.type) {
    case "textarea":
    case "lines":
      return <Textarea {...common} rows={f.rows || 4} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-none" />;
    case "select":
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="rounded-none h-10" data-testid={`field-${f.name}`}><SelectValue placeholder={f.placeholder || "Select"} /></SelectTrigger>
          <SelectContent>{f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      );
    case "switch":
      return <div className="flex items-center gap-3 h-10"><Switch checked={!!value} onCheckedChange={onChange} data-testid={`field-${f.name}`} /><span className="text-sm text-slate-600">{value ? f.on || "Yes" : f.off || "No"}</span></div>;
    case "image":
      return <ImageUploader value={value} onChange={onChange} testid={`field-${f.name}`} category={f.category} />;
    case "images":
      return <ImageUploader value={value} onChange={onChange} multiple testid={`field-${f.name}`} category={f.category} />;
    default:
      return <Input {...common} type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-none h-10" />;
  }
};
