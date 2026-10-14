import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { Json } from "@/integrations/supabase/types";
import { normalizePackages } from "@/lib/servicePackages";
import { normalizeSlides } from "@/lib/serviceSliders";
import {
  ICON_OPTIONS, buildDefaultServiceTypes, iconFor, normalizeServiceTypes, slug,
  type CustomField, type FieldType, type ServiceType,
} from "@/lib/serviceTypes";

const uid = () => crypto.randomUUID();

export function ServiceTypesManager() {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [section, setSection] = useState<"info" | "packages" | "slides" | "fields">("info");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("key,value").in("key", ["service_types", "service_packages", "service_sliders"]);
      const byKey = Object.fromEntries((data ?? []).map(r => [r.key as string, r.value]));
      const existing = normalizeServiceTypes(byKey["service_types"]);
      if (existing.length) setTypes(existing);
      else {
        const pkgs = normalizePackages(byKey["service_packages"] ?? {});
        const slides = normalizeSlides(byKey["service_sliders"] ?? {});
        setTypes(buildDefaultServiceTypes(pkgs, slides));
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (next: ServiceType[]) => {
    setSaving(true);
    const { error } = await supabase.from("site_settings")
      .upsert({ key: "service_types", value: next as unknown as Json }, { onConflict: "key" });
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    toast.success("Service types saved");
    return true;
  };

  const patchType = (key: string, p: Partial<ServiceType>) =>
    setTypes(t => t.map(x => (x.key === key ? { ...x, ...p } : x)));

  const addType = () => {
    const key = `${slug("service")}_${Date.now().toString(36)}`;
    const t: ServiceType = { key, name: "New service type", description: "", icon: "wrench", active: true, slides: [], packages: [], fields: [] };
    setTypes(prev => [...prev, t]);
    setOpenKey(key); setSection("info");
  };

  const removeType = (key: string) => {
    if (!confirm("Deactivate and remove this service type? Existing bookings keep their data.")) return;
    setTypes(prev => prev.filter(t => t.key !== key));
    if (openKey === key) setOpenKey(null);
  };

  const moveType = (key: string, dir: -1 | 1) => setTypes(prev => {
    const i = prev.findIndex(t => t.key === key), j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });

  const open = useMemo(() => types.find(t => t.key === openKey) ?? null, [types, openKey]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading service types…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black tracking-tight">Service Types</h2>
          <p className="text-xs text-muted-foreground">Each type has its own banner slider, packages and booking fields.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={addType} className="rounded-md border border-border px-3 py-2 text-xs font-bold uppercase">+ Add type</button>
          <button onClick={() => persist(types)} disabled={saving} className="rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save all"}</button>
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {types.length === 0 && <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No service types yet.</li>}
        {types.map((t, i) => {
          const Icon = iconFor(t.icon);
          return (
            <li key={t.key} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{t.name}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{t.description || "No description"}</div>
                </div>
                <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " + (t.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{t.active ? "Active" : "Hidden"}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>{t.packages.length} packages</span>·<span>{t.slides.length} images</span>·<span>{t.fields.length} custom fields</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button onClick={() => { setOpenKey(t.key); setSection("info"); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Manage</button>
                <button onClick={() => moveType(t.key, -1)} disabled={i === 0} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↑</button>
                <button onClick={() => moveType(t.key, 1)} disabled={i === types.length - 1} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↓</button>
                <button onClick={() => removeType(t.key)} className="rounded border border-destructive/50 px-2 py-1 text-xs font-bold text-destructive">Delete</button>
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" onMouseDown={e => { if (e.target === e.currentTarget) setOpenKey(null); }}>
          <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
            <div className="my-6 w-full max-w-3xl rounded-lg bg-card p-4 sm:p-6 shadow-2xl space-y-4" onMouseDown={e => e.stopPropagation()}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h3 className="truncate text-lg font-black">{open.name}</h3>
                <button onClick={() => setOpenKey(null)} className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-bold">Close</button>
              </div>
              <div className="flex gap-1 overflow-x-auto rounded-full bg-secondary p-1 text-xs font-bold uppercase tracking-wide">
                {(["info", "packages", "slides", "fields"] as const).map(s => (
                  <button key={s} onClick={() => setSection(s)}
                    className={"shrink-0 rounded-full px-4 py-2 transition " + (section === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {s === "info" ? "Details" : s === "slides" ? "Banner images" : s}
                  </button>
                ))}
              </div>

              {section === "info" && <InfoSection t={open} patch={p => patchType(open.key, p)} />}
              {section === "packages" && <PackagesSection t={open} patch={p => patchType(open.key, p)} />}
              {section === "slides" && <SlidesSection t={open} patch={p => patchType(open.key, p)} />}
              {section === "fields" && <FieldsSection t={open} patch={p => patchType(open.key, p)} />}

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button onClick={async () => { if (await persist(types)) setOpenKey(null); }} disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type SectionProps = { t: ServiceType; patch: (p: Partial<ServiceType>) => void };

function InfoSection({ t, patch }: SectionProps) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</label>
      <input value={t.name} onChange={e => patch({ name: e.target.value })} className="in" placeholder="e.g. Truck Service" />
      <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Short description</label>
      <input value={t.description} onChange={e => patch({ description: e.target.value })} className="in" placeholder="Shown under the name in the selector" />
      <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Icon</label>
      <div className="flex flex-wrap gap-2">
        {ICON_OPTIONS.map(name => {
          const Icon = iconFor(name);
          return (
            <button key={name} type="button" onClick={() => patch({ icon: name })}
              className={"grid h-10 w-10 place-items-center rounded-md border " + (t.icon === name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={t.active} onChange={e => patch({ active: e.target.checked })} />
        <span className="text-muted-foreground">Active (visible to customers)</span>
      </label>
    </div>
  );
}

function PackagesSection({ t, patch }: SectionProps) {
  const set = (id: string, p: Partial<ServiceType["packages"][number]>) =>
    patch({ packages: t.packages.map(x => (x.id === id ? { ...x, ...p } : x)) });
  const move = (id: string, dir: -1 | 1) => {
    const i = t.packages.findIndex(x => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= t.packages.length) return;
    const next = [...t.packages]; [next[i], next[j]] = [next[j], next[i]]; patch({ packages: next });
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {t.packages.length === 0 && <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No packages yet.</li>}
        {t.packages.map((p, i) => (
          <li key={p.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => move(p.id, -1)} disabled={i === 0} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↑</button>
              <button onClick={() => move(p.id, 1)} disabled={i === t.packages.length - 1} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↓</button>
              <button onClick={() => confirm("Delete this package?") && patch({ packages: t.packages.filter(x => x.id !== p.id) })}
                className="rounded border border-destructive/50 px-2 py-1 text-xs font-bold text-destructive">Delete</button>
            </div>
            <input value={p.label} onChange={e => set(p.id, { label: e.target.value })} placeholder="Package name" className="in" />
            <textarea value={p.description} onChange={e => set(p.id, { description: e.target.value })} rows={2} placeholder="Short description (first ~90 characters show on the card)" className="in" />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Price £</span>
                <input type="number" step="0.01" value={p.price} onChange={e => set(p.id, { price: Number(e.target.value) || 0 })} className="in max-w-[140px]" /></label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={p.active} onChange={e => set(p.id, { active: e.target.checked })} />
                <span className="text-muted-foreground">Active</span>
              </label>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={() => patch({ packages: [...t.packages, { id: uid(), label: "New package", description: "", price: 0, active: true }] })}
        className="rounded-md border border-border px-4 py-2 text-sm font-bold">+ Add package</button>
    </div>
  );
}

function SlidesSection({ t, patch }: SectionProps) {
  const move = (id: string, dir: -1 | 1) => {
    const i = t.slides.findIndex(x => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= t.slides.length) return;
    const next = [...t.slides]; [next[i], next[j]] = [next[j], next[i]]; patch({ slides: next });
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {t.slides.length === 0 && <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No banner images yet.</li>}
        {t.slides.map((s, i) => (
          <li key={s.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Slide {i + 1}</div>
              <div className="flex gap-1">
                <button onClick={() => move(s.id, -1)} disabled={i === 0} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↑</button>
                <button onClick={() => move(s.id, 1)} disabled={i === t.slides.length - 1} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↓</button>
                <button onClick={() => confirm("Delete this slide?") && patch({ slides: t.slides.filter(x => x.id !== s.id) })}
                  className="rounded border border-destructive/50 px-2 py-1 text-xs font-bold text-destructive">Delete</button>
              </div>
            </div>
            <ImageUploadField value={s.url} onChange={url => patch({ slides: t.slides.map(x => (x.id === s.id ? { ...x, url } : x)) })} />
            <input value={s.alt ?? ""} onChange={e => patch({ slides: t.slides.map(x => (x.id === s.id ? { ...x, alt: e.target.value } : x)) })}
              placeholder="Image description (alt text)" className="in" />
          </li>
        ))}
      </ul>
      <button onClick={() => patch({ slides: [...t.slides, { id: uid(), url: "", alt: "" }] })}
        className="rounded-md border border-border px-4 py-2 text-sm font-bold">+ Add image</button>
    </div>
  );
}

function FieldsSection({ t, patch }: SectionProps) {
  const set = (id: string, p: Partial<CustomField>) => patch({ fields: t.fields.map(x => (x.id === id ? { ...x, ...p } : x)) });
  const move = (id: string, dir: -1 | 1) => {
    const i = t.fields.findIndex(x => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= t.fields.length) return;
    const next = [...t.fields]; [next[i], next[j]] = [next[j], next[i]]; patch({ fields: next });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Name, email, phone, address, postcode, date and time are always collected. Add extra fields specific to this service type.</p>
      <ul className="space-y-3">
        {t.fields.length === 0 && <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No extra fields.</li>}
        {t.fields.map((f, i) => (
          <li key={f.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => move(f.id, -1)} disabled={i === 0} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↑</button>
              <button onClick={() => move(f.id, 1)} disabled={i === t.fields.length - 1} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">↓</button>
              <button onClick={() => confirm("Delete this field?") && patch({ fields: t.fields.filter(x => x.id !== f.id) })}
                className="rounded border border-destructive/50 px-2 py-1 text-xs font-bold text-destructive">Delete</button>
            </div>
            <input value={f.label} onChange={e => set(f.id, { label: e.target.value })} placeholder="Field label (e.g. Registration number)" className="in" />
            <div className="flex flex-wrap items-center gap-3">
              <select value={f.type} onChange={e => set(f.id, { type: e.target.value as FieldType })} className="in max-w-[160px]">
                <option value="text">Text</option><option value="number">Number</option>
                <option value="select">Dropdown</option><option value="date">Date</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.required} onChange={e => set(f.id, { required: e.target.checked })} />
                <span className="text-muted-foreground">Required</span>
              </label>
            </div>
            {f.type === "select" && (
              <input value={f.options.join(", ")} onChange={e => set(f.id, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                placeholder="Dropdown options, comma separated" className="in" />
            )}
          </li>
        ))}
      </ul>
      <button onClick={() => patch({ fields: [...t.fields, { id: uid(), label: "New field", type: "text", required: true, options: [] }] })}
        className="rounded-md border border-border px-4 py-2 text-sm font-bold">+ Add field</button>
    </div>
  );
}
