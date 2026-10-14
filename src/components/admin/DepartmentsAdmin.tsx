import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export type Department = { id: string; name: string; sort_order: number; active: boolean };

const INPUT = "mt-1 w-full rounded-md border-[1.5px] border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

export function DepartmentsAdmin() {
  const [rows, setRows] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Department> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("departments").select("id,name,sort_order,active").order("sort_order");
    if (error) toast.error(error.message);
    setRows((data as Department[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error("Department name is required"); return; }
    setBusy(true);
    const payload = {
      name: editing.name.trim(),
      sort_order: Number(editing.sort_order ?? rows.length),
      active: editing.active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("departments").update(payload).eq("id", editing.id)
      : await supabase.from("departments").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Department updated" : "Department added");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this department? Team members in it will become unassigned.")) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Department deleted");
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= rows.length) return;
    const a = rows[idx], b = rows[next];
    await Promise.all([
      supabase.from("departments").update({ sort_order: next }).eq("id", a.id),
      supabase.from("departments").update({ sort_order: idx }).eq("id", b.id),
    ]);
    load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black tracking-tight">Departments</h2>
          <p className="text-sm text-muted-foreground">Group your team — e.g. Cycle Department, Car Department.</p>
        </div>
        <button onClick={() => setEditing({ name: "", sort_order: rows.length, active: true })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> Add department
        </button>
      </div>

      {editing && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide">Department name</label>
            <input className={INPUT} value={editing.name ?? ""} placeholder="e.g. Cycle Department"
              onChange={e => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active ?? true} onChange={e => setEditing({ ...editing, active: e.target.checked })} /> Visible on site
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Order</span>
              <input type="number" className="w-20 rounded-md border-[1.5px] border-input bg-background px-2 py-1 text-sm"
                value={editing.sort_order ?? 0} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-md border border-input px-4 py-2 text-sm font-bold">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No departments yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{d.name}</div>
                {!d.active && <div className="text-[10px] uppercase font-bold text-muted-foreground">Hidden</div>}
              </div>
              <button onClick={() => setEditing(d)} className="rounded border border-input px-2 py-1 text-xs font-bold">Edit</button>
              <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded border border-input p-1"><ArrowUp className="h-3 w-3" /></button>
              <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded border border-input p-1"><ArrowDown className="h-3 w-3" /></button>
              <button onClick={() => remove(d.id)} aria-label="Delete" className="rounded border border-input p-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
