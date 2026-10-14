import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

type Member = {
  id: string;
  name: string;
  position: string;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
  active: boolean;
  department_id: string | null;
};

type Dept = { id: string; name: string };

const INPUT = "mt-1 w-full rounded-md border-[1.5px] border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

export function TeamAdmin() {
  const [rows, setRows] = useState<Member[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Member> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: d }] = await Promise.all([
      supabase.from("team_members").select("*").order("sort_order"),
      supabase.from("departments").select("id,name").order("sort_order"),
    ]);
    if (error) toast.error(error.message);
    setRows((data as Member[]) ?? []);
    setDepts((d as Dept[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const deptName = (id: string | null | undefined) => depts.find(d => d.id === id)?.name ?? "";

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    const payload = {
      name: editing.name.trim(),
      position: (editing.position ?? "").trim(),
      photo_url: editing.photo_url || null,
      bio: editing.bio || null,
      department_id: editing.department_id || null,
      sort_order: Number(editing.sort_order ?? rows.length),
      active: editing.active ?? true,
    };

    const { error } = editing.id
      ? await supabase.from("team_members").update(payload).eq("id", editing.id)
      : await supabase.from("team_members").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Team member updated" : "Team member added");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= rows.length) return;
    const a = rows[idx], b = rows[next];
    await Promise.all([
      supabase.from("team_members").update({ sort_order: next }).eq("id", a.id),
      supabase.from("team_members").update({ sort_order: idx }).eq("id", b.id),
    ]);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black tracking-tight">Team</h2>
          <p className="text-sm text-muted-foreground">Shown publicly on the About page.</p>
        </div>
        <button onClick={() => setEditing({ name: "", position: "", sort_order: rows.length, active: true })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> Add member
        </button>
      </div>

      {editing && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide">Name</label>
              <input className={INPUT} value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide">Position / title</label>
              <input className={INPUT} value={editing.position ?? ""} onChange={e => setEditing({ ...editing, position: e.target.value })} placeholder="e.g. CEO" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide">Department</label>
            <select className={INPUT} value={editing.department_id ?? ""} onChange={e => setEditing({ ...editing, department_id: e.target.value || null })}>
              <option value="">— No department —</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {depts.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Add departments in the Department tab first.</p>}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide">Short bio (optional)</label>
            <textarea rows={3} className={INPUT} value={editing.bio ?? ""} onChange={e => setEditing({ ...editing, bio: e.target.value })} />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide">Photo</label>
            <ImageUploadField value={editing.photo_url ?? ""} onChange={url => setEditing({ ...editing, photo_url: url })} />
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
        <div className="text-sm text-muted-foreground">No team members yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m, i) => (
            <div key={m.id} className="rounded-lg border border-border bg-background p-3 flex gap-3">
              <div className="h-16 w-16 rounded-md overflow-hidden bg-secondary shrink-0">
                {m.photo_url ? <img src={m.photo_url} alt={m.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground truncate">{m.position}</div>
                {deptName(m.department_id) && <div className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">{deptName(m.department_id)}</div>}
                {!m.active && <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Hidden</div>}

                <div className="mt-2 flex items-center gap-1.5">
                  <button onClick={() => setEditing(m)} className="rounded border border-input px-2 py-1 text-xs font-bold">Edit</button>
                  <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded border border-input p-1"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded border border-input p-1"><ArrowDown className="h-3 w-3" /></button>
                  <button onClick={() => remove(m.id)} aria-label="Delete" className="rounded border border-input p-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
