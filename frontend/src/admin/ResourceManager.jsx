import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, formatApiError } from "@/lib/api";
import { FieldInput } from "./FormFields";

const STATUS_STYLE = {
  new: "bg-ember/10 text-ember-600 border-ember/30", contacted: "bg-sky-50 text-sky-700 border-sky-200", reviewing: "bg-sky-50 text-sky-700 border-sky-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200", shortlisted: "bg-amber-50 text-amber-700 border-amber-200", ongoing: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200", rejected: "bg-red-50 text-red-700 border-red-200",
};

export const StatusBadge = ({ value, label }) => (
  <span className={`inline-flex border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[value] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{label || value}</span>
);

export const PageTitle = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
    <div><h1 className="text-2xl md:text-3xl font-bold text-navy" data-testid="admin-page-title">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
    {action}
  </div>
);

export const EmptyState = ({ text }) => (
  <div className="py-16 text-center text-slate-500" data-testid="empty-state"><Inbox className="h-10 w-10 mx-auto text-slate-300" /><p className="mt-3">{text}</p></div>
);

const blank = (f) => (f.type === "switch" ? false : f.type === "images" ? [] : f.type === "number" ? 0 : "");

const toForm = (fields, item, defaults) =>
  Object.fromEntries(fields.map((f) => {
    let v = item?.[f.name] ?? defaults[f.name];
    if (f.type === "lines") v = (v || []).join("\n");
    return [f.name, v ?? blank(f)];
  }));

const toPayload = (fields, form) =>
  Object.fromEntries(fields.map((f) => {
    let v = form[f.name];
    if (f.type === "lines") v = v.split("\n").map((s) => s.trim()).filter(Boolean);
    else if (f.type === "number") v = Number(v) || 0;
    else if (f.type === "date") v = v || null;
    else if (typeof v === "string") v = v.trim();
    return [f.name, v];
  }));

const RecordDialog = ({ item, onClose, onSaved, resource, fields, defaults, detail, itemLabel }) => {
  const isNew = !item?.id;
  const [form, setForm] = useState(() => toForm(fields, item, defaults));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    fields.forEach((f) => {
      const v = form[f.name];
      if (f.required && (typeof v === "string" ? v.trim().length < 2 : !v)) errs[f.name] = `${f.label} is required`;
      if (f.type === "email" && v && !/^\S+@\S+\.\S+$/.test(v)) errs[f.name] = "Enter a valid email";
    });
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Please fix the highlighted fields.");
    setSaving(true);
    try {
      const payload = toPayload(fields, form);
      const { data } = isNew ? await api.post(`/admin/${resource}`, payload) : await api.put(`/admin/${resource}/${item.id}`, payload);
      toast.success(isNew ? `${itemLabel} added` : `${itemLabel} updated`);
      onSaved(data, isNew);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="record-dialog">
        <DialogTitle className="font-display text-xl text-navy">{isNew ? `Add ${itemLabel.toLowerCase()}` : `${detail ? "View" : "Edit"} ${itemLabel.toLowerCase()}`}</DialogTitle>
        <DialogDescription>Fields marked * are required.</DialogDescription>
        {!isNew && detail && <div className="border border-slate-200 bg-slate-50 p-5">{detail(item)}</div>}
        <form onSubmit={save} noValidate className="grid gap-5 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={`space-y-2 ${f.full || ["textarea", "lines", "images"].includes(f.type) ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={`field-${f.name}`}>{f.label}{f.required && " *"}</Label>
              <FieldInput f={f} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
              {f.help && <p className="text-xs text-slate-400">{f.help}</p>}
              {errors[f.name] && <p className="text-xs text-red-600" data-testid={`error-${f.name}`}>{errors[f.name]}</p>}
            </div>
          ))}
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={onClose} data-testid="record-cancel-btn">Cancel</Button>
            <Button type="submit" disabled={saving} className="rounded-none bg-ember hover:bg-ember-600 min-w-28" data-testid="record-save-btn">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function ResourceManager({ resource, title, subtitle, columns, fields, defaults = {}, canCreate = true, searchKeys = [], statusOptions, detail, itemLabel = "Record", sortFn }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/${resource}`, { params: { limit: 1000 } });
      setItems(sortFn ? [...data].sort(sortFn) : data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [resource, sortFn]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => (status === "all" || i.status === status) && (!term || searchKeys.some((k) => String(i[k] ?? "").toLowerCase().includes(term))));
  }, [items, q, status, searchKeys]);

  const quickStatus = async (item, value) => {
    try {
      const { data } = await api.put(`/admin/${resource}/${item.id}`, { status: value });
      setItems((list) => list.map((i) => (i.id === item.id ? data : i)));
      toast.success("Status updated");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/${resource}/${toDelete.id}`);
      setItems((list) => list.filter((i) => i.id !== toDelete.id));
      toast.success(`${itemLabel} deleted`);
      setToDelete(null);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const onSaved = (data, isNew) => {
    setItems((list) => (isNew ? [data, ...list] : list.map((i) => (i.id === data.id ? data : i))));
    setEditing(null);
  };

  return (
    <div data-testid={`admin-${resource}-page`}>
      <PageTitle title={title} subtitle={subtitle} action={canCreate && (
        <Button onClick={() => setEditing({})} className="rounded-none bg-ember hover:bg-ember-600" data-testid={`add-${resource}-btn`}><Plus className="h-4 w-4 mr-2" />Add {itemLabel.toLowerCase()}</Button>
      )} />
      <div className="bg-white border border-slate-200">
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-slate-200">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="pl-9 rounded-none h-10" data-testid={`${resource}-search`} />
          </div>
          {statusOptions && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-48 rounded-none h-10" data-testid={`${resource}-status-filter`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {loading ? (
          <div className="p-4 space-y-3" data-testid="table-loading">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState text={items.length ? "No records match your search." : `No ${title.toLowerCase()} yet.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid={`${resource}-table`}>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium whitespace-nowrap">{c.label}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70" data-testid={`${resource}-row-${item.id}`}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 align-middle text-navy">
                        {c.key === "status" && statusOptions ? (
                          <Select value={item.status} onValueChange={(v) => quickStatus(item, v)}>
                            <SelectTrigger className="h-8 w-36 rounded-none text-xs" data-testid={`${resource}-row-status-${item.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : c.render ? c.render(item) : item[c.key]}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(item)} data-testid={`${resource}-edit-${item.id}`} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => setToDelete(item)} data-testid={`${resource}-delete-${item.id}`} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && items.length > 0 && <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-500" data-testid={`${resource}-count`}>Showing {filtered.length} of {items.length}</div>}
      </div>

      {editing && <RecordDialog item={editing} onClose={() => setEditing(null)} onSaved={onSaved} resource={resource} fields={fields} defaults={defaults} detail={detail} itemLabel={itemLabel} />}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="rounded-none" data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {itemLabel.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the record from the database. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none" data-testid="delete-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }} disabled={deleting} className="rounded-none bg-red-600 hover:bg-red-700" data-testid="delete-confirm-btn">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
