import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TeamAdmin } from "@/components/admin/TeamAdmin";
import { DepartmentsAdmin } from "@/components/admin/DepartmentsAdmin";

import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Plus, Trash2 } from "lucide-react";

export type AboutSection = { heading: string; body: string; image_url: string };
export type AboutStat = { value: string; label: string };

export const ABOUT_KEYS: { key: string; label: string; hint: string }[] = [
  { key: "hero", label: "Hero", hint: "Big image at the top + page headline" },
  { key: "intro", label: "Intro narrative", hint: "Flowing paragraph. Wrap key phrases in **double asterisks** to bold them." },
  { key: "mission", label: "Mission", hint: "" },
  { key: "vision", label: "Vision", hint: "" },
  { key: "values", label: "Values", hint: "" },
  { key: "recognitions", label: "Recognitions", hint: "" },
  { key: "journey", label: "Journey", hint: "" },
  { key: "ceo", label: "From our CEO", hint: "" },
];

export const DEFAULT_STATS: AboutStat[] = [
  { value: "8+", label: "Years in business" },
  { value: "2,400+", label: "Happy customers" },
  { value: "5,000+", label: "Services completed" },
  { value: "98%", label: "5-star ratings" },
];

const INPUT = "mt-1 w-full rounded-md border-[1.5px] border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

export function AboutBusinessAdmin() {
  const [sub, setSub] = useState<"info" | "team" | "department">("info");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 rounded-full bg-ink p-1 w-fit max-w-full overflow-x-auto">
        {([["info", "Business Info"], ["team", "Team"], ["department", "Department"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={"rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition " + (sub === k ? "bg-primary text-primary-foreground" : "text-ink-foreground/70 hover:text-ink-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      {sub === "info" ? <BusinessInfoEditor /> : sub === "team" ? <TeamAdmin /> : <DepartmentsAdmin />}
    </div>
  );
}


function BusinessInfoEditor() {
  const [sections, setSections] = useState<Record<string, AboutSection>>({});
  const [stats, setStats] = useState<AboutStat[]>(DEFAULT_STATS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "about_page").maybeSingle().then(({ data }) => {
      const raw = (data?.value ?? {}) as Record<string, unknown>;
      const { stats: rawStats, ...rest } = raw;
      if (Array.isArray(rawStats) && rawStats.length) setStats(rawStats as AboutStat[]);
      setSections(rest as Record<string, AboutSection>);
    });
  }, []);

  const setSection = (key: string, patch: Partial<AboutSection>) =>
    setSections(v => {
      const prev = v[key] ?? { heading: "", body: "", image_url: "" };
      return { ...v, [key]: { ...prev, ...patch } };
    });

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("site_settings").upsert({ key: "about_page", value: { ...sections, stats } }, { onConflict: "key" });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("About Our Business saved");
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="rounded-lg border border-border p-5 bg-card space-y-3">
        <div className="text-xs uppercase font-bold tracking-widest">Stat highlight cards</div>
        <p className="text-xs text-muted-foreground">Shown as a card row under the intro on the public page.</p>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="block w-32 shrink-0">
                <span className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">Value</span>
                <input value={s.value} onChange={e => setStats(v => v.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className={INPUT} placeholder="8+" />
              </label>
              <label className="block flex-1 min-w-0">
                <span className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">Label</span>
                <input value={s.label} onChange={e => setStats(v => v.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className={INPUT} placeholder="Years in business" />
              </label>
              <button onClick={() => setStats(v => v.filter((_, j) => j !== i))} className="mb-1 p-2 text-muted-foreground hover:text-destructive" aria-label="Remove stat">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setStats(v => [...v, { value: "", label: "" }])} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:border-primary">
          <Plus className="h-3.5 w-3.5" /> Add stat
        </button>
      </section>

      {ABOUT_KEYS.map(({ key, label, hint }) => {
        const s = sections[key] ?? { heading: "", body: "", image_url: "" };
        return (
          <section key={key} className="rounded-lg border border-border p-5 bg-card space-y-2">
            <div className="text-sm font-bold uppercase tracking-widest text-primary">{label}</div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <input value={s.heading} onChange={e => setSection(key, { heading: e.target.value })} placeholder="Heading" className={INPUT} />
            <textarea value={s.body} onChange={e => setSection(key, { body: e.target.value })} placeholder="Paragraph copy…" rows={key === "intro" ? 6 : 4} className={INPUT} />
            <div>
              <span className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">Image</span>
              <ImageUploadField value={s.image_url} onChange={url => setSection(key, { image_url: url })} />
            </div>
          </section>
        );
      })}

      <button onClick={save} disabled={busy} className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-60">
        {busy ? "Saving…" : "Save About Our Business"}
      </button>
    </div>
  );
}
