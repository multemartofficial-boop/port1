import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_GLOBAL_SEO,
  DEFAULT_ROBOTS_TXT,
  PAGE_SEO_KEYS,
  type GlobalSeo,
  type PageSeoMap,
} from "@/lib/seo";

function F({ label, hint, children, full }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={"block " + (full ? "sm:col-span-2" : "")}>
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </label>
  );
}

const PAGE_LABELS: Record<string, string> = {
  home: "Home page",
  products: "Shop / products page",
  services: "Services page",
  about: "About Our Business page",
  contact: "Contact page",
  blog: "Blog page",
};

export function SeoAdmin() {
  const [g, setG] = useState<GlobalSeo>(DEFAULT_GLOBAL_SEO);
  const [pages, setPages] = useState<PageSeoMap>({});
  const [robots, setRobots] = useState<string>(DEFAULT_ROBOTS_TXT.trim());

  useEffect(() => {
    supabase.from("site_settings").select("key,value").in("key", ["seo", "page_seo", "robots_txt"]).then(({ data }) => {
      for (const row of data ?? []) {
        if (row.key === "seo") setG({ ...DEFAULT_GLOBAL_SEO, ...(row.value as Partial<GlobalSeo>) });
        if (row.key === "page_seo") setPages((row.value ?? {}) as PageSeoMap);
        if (row.key === "robots_txt") {
          const c = (row.value as { content?: string } | null)?.content;
          if (c) setRobots(c);
        }
      }
    });
  }, []);

  const set = (k: keyof GlobalSeo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setG(v => ({ ...v, [k]: e.target.value }));

  const setPage = (key: string, field: "title" | "description" | "keywords", value: string) =>
    setPages(p => {
      const prev = p[key] ?? { title: "", description: "", keywords: "" };
      return { ...p, [key]: { ...prev, [field]: value } };
    });

  const saveGlobal = async () => {
    const { error } = await supabase.from("site_settings").upsert({ key: "seo", value: g }, { onConflict: "key" });
    if (error) toast.error(error.message); else toast.success("Global SEO saved");
  };
  const savePages = async () => {
    const { error } = await supabase.from("site_settings").upsert({ key: "page_seo", value: pages }, { onConflict: "key" });
    if (error) toast.error(error.message); else toast.success("Page SEO saved");
  };
  const saveRobots = async () => {
    const { error } = await supabase.from("site_settings").upsert({ key: "robots_txt", value: { content: robots.trim() } }, { onConflict: "key" });
    if (error) toast.error(error.message); else toast.success("robots.txt saved");
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border p-5 bg-card space-y-4 max-w-3xl">
        <div className="text-xs uppercase font-bold tracking-widest">Global SEO</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Title template" hint="Use %s for the page name, e.g. “%s | Yours”." full>
            <input className="in" value={g.title_template} onChange={set("title_template")} placeholder="%s | Yours — Bikes & Home Service" />
          </F>
          <F label="Default site title" full><input className="in" value={g.default_title} onChange={set("default_title")} /></F>
          <F label="Default meta description" full>
            <textarea rows={2} className="in" value={g.default_description} onChange={set("default_description")} />
          </F>
          <F label="Default Open Graph image URL"><input className="in" value={g.og_image} onChange={set("og_image")} placeholder="/images/hero.jpg" /></F>
          <F label="Logo URL (for search results)"><input className="in" value={g.logo_url} onChange={set("logo_url")} placeholder="/favicon.png" /></F>
          <F label="Default focus keywords" hint="For your own tracking; also rendered as meta keywords." full>
            <input className="in" value={g.keywords} onChange={set("keywords")} placeholder="bike parts uk, mobile bike mechanic" />
          </F>
        </div>
        <button onClick={saveGlobal} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save global SEO</button>
      </section>

      <section className="rounded-lg border border-border p-5 bg-card space-y-4 max-w-3xl">
        <div className="text-xs uppercase font-bold tracking-widest">Search Console & Analytics</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Google verification code" hint='Paste only the content value from the meta tag Google gives you (the long string after content="…").' full>
            <input className="in" value={g.google_verification} onChange={set("google_verification")} placeholder="abcd1234EFGH…" />
          </F>
          <F label="GA4 Measurement ID" hint="e.g. G-XXXXXXX. Leave blank to disable analytics.">
            <input className="in" value={g.ga4_id} onChange={set("ga4_id")} placeholder="G-XXXXXXXXXX" />
          </F>
        </div>
        <div className="text-xs uppercase font-bold tracking-widest pt-2">Business info (structured data)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Business name"><input className="in" value={g.org_name} onChange={set("org_name")} /></F>
          <F label="Phone"><input className="in" value={g.org_phone} onChange={set("org_phone")} /></F>
          <F label="Email"><input className="in" value={g.org_email} onChange={set("org_email")} /></F>
          <F label="Address"><input className="in" value={g.org_address} onChange={set("org_address")} /></F>
        </div>
        <button onClick={saveGlobal} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save</button>
      </section>

      <section className="rounded-lg border border-border p-5 bg-card space-y-4 max-w-3xl">
        <div className="text-xs uppercase font-bold tracking-widest">Page metadata</div>
        <p className="text-xs text-muted-foreground">Leave a field blank to use the automatic default.</p>
        <div className="space-y-4">
          {PAGE_SEO_KEYS.map(key => (
            <div key={key} className="rounded-md border border-border p-3 space-y-2">
              <div className="text-sm font-bold">{PAGE_LABELS[key] ?? key}</div>
              <input className="in" placeholder="Meta title" value={pages[key]?.title ?? ""} onChange={e => setPage(key, "title", e.target.value)} />
              <textarea rows={2} className="in" placeholder="Meta description" value={pages[key]?.description ?? ""} onChange={e => setPage(key, "description", e.target.value)} />
              <input className="in" placeholder="Focus keywords" value={pages[key]?.keywords ?? ""} onChange={e => setPage(key, "keywords", e.target.value)} />
            </div>
          ))}
        </div>
        <button onClick={savePages} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save page metadata</button>
      </section>

      <section className="rounded-lg border border-border p-5 bg-card space-y-3 max-w-3xl">
        <div className="text-xs uppercase font-bold tracking-widest">robots.txt</div>
        <p className="text-xs text-muted-foreground">
          Served at <span className="font-mono">/robots.txt</span>. Your sitemap is generated automatically at{" "}
          <span className="font-mono">/sitemap.xml</span> and always includes every published product, category and blog post.
        </p>
        <textarea rows={8} className="in font-mono text-xs" value={robots} onChange={e => setRobots(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={saveRobots} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save robots.txt</button>
          <button onClick={() => setRobots(DEFAULT_ROBOTS_TXT.trim())} className="rounded-md border border-input px-4 py-2 text-sm font-bold">Reset to default</button>
        </div>
      </section>
    </div>
  );
}
