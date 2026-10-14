import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronRight, Copy, Save, X, Plus, Trash2, ChevronLeft } from "lucide-react";

type Cat = { id: string; name: string };
type Brand = { id: string; name: string };
type Sub = { id: string; name: string; category_id: string };

type ProductRow = {
  id?: string;
  name?: string;
  slug?: string | null;
  description?: string | null;
  short_description?: string | null;
  category_id?: string | null;
  sub_category_id?: string | null;
  brand_id?: string | null;
  price?: number | string;
  compare_at_price?: number | string | null;
  stock?: number | string;
  sku?: string | null;
  video_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  og_image_url?: string | null;
  image_alt?: string | null;
  images?: string[];
  featured?: boolean;
  is_bestseller?: boolean;
  is_new?: boolean;
  published?: boolean;
  tags?: string[];
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}


type AttrType = { name: string; values: string[] };
type VariantRow = {
  id?: string;
  attributes: Record<string, string>;
  price: string;
  stock: string;
  sku: string;
  enabled: boolean;
};

function cartesian(types: AttrType[]): Record<string, string>[] {
  if (types.length === 0) return [];
  return types.reduce<Record<string, string>[]>((acc, t) => {
    if (t.values.length === 0) return acc;
    if (acc.length === 0) return t.values.map(v => ({ [t.name]: v }));
    return acc.flatMap(a => t.values.map(v => ({ ...a, [t.name]: v })));
  }, []);
}

function sig(a: Record<string, string>) {
  return Object.keys(a).sort().map(k => `${k}=${a[k]}`).join("|");
}

function variantName(attrs: Record<string, string>) {
  return Object.values(attrs).map(v => String(v).trim()).filter(Boolean).join(" / ") || "default";
}

export function ProductEditor({ productId }: { productId?: string }) {
  const nav = useNavigate();
  const isEdit = !!productId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState<ProductRow>({
    published: true, images: [], price: 0, stock: 0, is_new: false, is_bestseller: false, featured: false,
  });
  const [cats, setCats] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [attrTypes, setAttrTypes] = useState<AttrType[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  // deleted existing variant ids to remove on save
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("categories").select("id,name").order("name").then(({ data }) => setCats(data ?? []));
    supabase.from("brands").select("id,name").order("name").then(({ data }) => setBrands(data ?? []));
    supabase.from("sub_categories").select("id,name,category_id").eq("active", true).order("sort_order").then(({ data }) => setSubs((data ?? []) as Sub[]));
  }, []);

  const catSubs = useMemo(() => subs.filter(s => s.category_id === p.category_id), [subs, p.category_id]);


  useEffect(() => {
    if (!productId) return;
    (async () => {
      const [{ data: prod, error: prodError }, { data: vars, error: varsError }] = await Promise.all([
        supabase.from("products").select("*").eq("id", productId).maybeSingle(),
        supabase.from("product_variants").select("id,name,price,stock,sku,attributes").eq("product_id", productId).order("created_at", { ascending: true }),
      ]);
      if (prodError) toast.error(`Product load failed: ${prodError.message}`);
      if (varsError) toast.error(`Variation load failed: ${varsError.message}`);
      if (prod) {
        setP({
          ...prod,
          images: Array.isArray(prod.images) ? (prod.images as string[]) : [],
          tags: Array.isArray((prod as { tags?: unknown }).tags) ? ((prod as { tags?: string[] }).tags as string[]) : [],
        });

      }
      if (vars && vars.length) {
        const derivedTypes = new Map<string, Set<string>>();
        const loaded: VariantRow[] = vars.map(v => {
          const attrs = (v.attributes ?? {}) as Record<string, string>;
          for (const [k, val] of Object.entries(attrs)) {
            if (!derivedTypes.has(k)) derivedTypes.set(k, new Set());
            derivedTypes.get(k)!.add(String(val));
          }
          return {
            id: v.id,
            attributes: attrs,
            price: v.price == null ? "" : String(v.price),
            stock: String(v.stock ?? 0),
            sku: v.sku ?? "",
            enabled: true,
          };
        });
        setAttrTypes(Array.from(derivedTypes.entries()).map(([name, vs]) => ({ name, values: Array.from(vs) })));
        setVariants(loaded);
      }
      setLoading(false);
    })();
  }, [productId]);

  const setField = <K extends keyof ProductRow>(k: K, v: ProductRow[K]) => setP(prev => ({ ...prev, [k]: v }));

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) { toast.error(error.message); continue; }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    if (urls.length) setField("images", [...(p.images ?? []), ...urls]);
  };

  const generateMatrix = () => {
    const clean = attrTypes
      .map(t => ({ name: t.name.trim(), values: t.values.map(v => v.trim()).filter(Boolean) }))
      .filter(t => t.name && t.values.length);
    if (clean.length === 0) {
      toast.error("Add at least one attribute with a name and values first");
      return;
    }
    const combos = cartesian(clean);
    const byKey = new Map(variants.map(v => [sig(v.attributes), v]));
    const next: VariantRow[] = combos.map(attrs => {
      const existing = byKey.get(sig(attrs));
      return existing ?? {
        attributes: attrs,
        price: String(p.price ?? ""),
        stock: String(p.stock ?? 0),
        sku: "",
        enabled: true,
      };
    });
    const keepKeys = new Set(next.map(v => sig(v.attributes)));
    const orphanIds = variants.filter(v => v.id && !keepKeys.has(sig(v.attributes))).map(v => v.id!);
    setRemovedVariantIds(prev => [...prev, ...orphanIds]);
    setVariants(next);
    toast.success(`Generated ${next.length} combination${next.length === 1 ? "" : "s"}`);
  };

  const setVariantField = (i: number, patch: Partial<VariantRow>) => {
    setVariants(vs => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  };

  const enabledVariants = useMemo(() => variants.filter(v => v.enabled), [variants]);
  const hasVariants = enabledVariants.length > 0;

  const save = async () => {
    if (!p.name || !String(p.name).trim()) { toast.error("Product name is required"); return; }
    setSaving(true);

    const desiredSlug = slugify(String(p.slug ?? "").trim() || String(p.name));
    if (!desiredSlug) { toast.error("Please enter a valid URL slug"); setSaving(false); return; }
    {
      let q = supabase.from("products").select("id").eq("slug", desiredSlug).limit(1);
      if (isEdit && productId) q = q.neq("id", productId);
      const { data: clash } = await q;
      if (clash && clash.length) {
        toast.error(`The URL slug "${desiredSlug}" is already used by another product. Please choose a different one.`);
        setSaving(false);
        return;
      }
    }

    const tags = (p.tags ?? []).map(t => t.trim()).filter(Boolean);
    const keywords = Array.from(new Set([
      ...String(p.seo_keywords ?? "").split(",").map(k => k.trim()).filter(Boolean),
      ...tags,
    ])).join(", ");

    const payload = {
      name: String(p.name),
      slug: desiredSlug,
      description: p.description ?? null,
      short_description: p.short_description ?? null,
      category_id: p.category_id || null,
      sub_category_id: p.sub_category_id || null,
      brand_id: p.brand_id || null,
      price: Number(p.price) || 0,
      compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
      stock: Number(p.stock) || 0,
      sku: p.sku || null,
      video_url: p.video_url || null,
      seo_title: p.seo_title || null,
      seo_description: p.seo_description || null,
      seo_keywords: keywords || null,
      og_image_url: p.og_image_url || null,
      image_alt: p.image_alt || null,
      images: p.images ?? [],
      tags,
      featured: !!p.featured, is_bestseller: !!p.is_bestseller, is_new: !!p.is_new,
      published: p.published !== false,
    };
    const friendly = (msg?: string) =>
      msg && /duplicate key|unique/i.test(msg)
        ? `That URL slug is already taken. Please choose a different one.`
        : `Save failed: ${msg ?? "no data returned"}`;
    let id = productId;
    if (isEdit && productId) {
      const { error } = await supabase.from("products").update(payload).eq("id", productId);
      if (error) { console.error("[save] product update failed", error); toast.error(friendly(error.message)); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error || !data) { console.error("[save] product insert failed", error); toast.error(friendly(error?.message)); setSaving(false); return; }

      id = data.id;
    }

    // Variants sync — with explicit error handling so failures are visible
    if (id) {
      console.log("[save] syncing variants", { productId: id, enabled: enabledVariants.length, removed: removedVariantIds.length });

      if (removedVariantIds.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", removedVariantIds);
        if (error) { console.error("[save] variant delete (removed) failed", error); toast.error(`Variant delete failed: ${error.message}`); setSaving(false); return; }
      }
      const disabledIds = variants.filter(v => !v.enabled && v.id).map(v => v.id!);
      if (disabledIds.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", disabledIds);
        if (error) { console.error("[save] variant delete (disabled) failed", error); toast.error(`Variant delete failed: ${error.message}`); setSaving(false); return; }
      }

      const cleanRows = enabledVariants.map(v => ({
        id: v.id,
        product_id: id!,
        name: variantName(v.attributes),
        attributes: v.attributes,
        price: v.price === "" ? Number(payload.price) : Number(v.price),
        stock: v.stock === "" ? Number(payload.stock) : Number(v.stock),
        sku: v.sku?.trim() || null,
      }));

      const badRow = cleanRows.find(row => !Number.isFinite(row.price) || !Number.isFinite(row.stock));
      if (badRow) {
        toast.error(`Variation ${badRow.name} has an invalid price or stock value`);
        setSaving(false);
        return;
      }

      const wantedKeys = new Set(cleanRows.map(row => sig(row.attributes)));
      const { data: existingRows, error: existingError } = await supabase
        .from("product_variants")
        .select("id,attributes")
        .eq("product_id", id);
      if (existingError) { console.error("[save] variant lookup failed", existingError); toast.error(`Variation lookup failed: ${existingError.message}`); setSaving(false); return; }

      const existingByKey = new Map((existingRows ?? []).map(row => [sig((row.attributes ?? {}) as Record<string, string>), row.id]));
      const staleIds = (existingRows ?? [])
        .filter(row => !wantedKeys.has(sig((row.attributes ?? {}) as Record<string, string>)))
        .map(row => row.id);
      const deleteIds = Array.from(new Set([...removedVariantIds, ...disabledIds, ...staleIds]));
      if (deleteIds.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", deleteIds);
        if (error) { console.error("[save] variant delete (stale) failed", error); toast.error(`Variant delete failed: ${error.message}`); setSaving(false); return; }
      }

      const rowsToSave = cleanRows.map(row => ({ ...row, id: row.id ?? existingByKey.get(sig(row.attributes)) }));
      let inserted = 0, updated = 0;
      for (const row of rowsToSave) {
        if (row.id) {
          const { id: rid, ...rest } = row;
          const { error, data } = await supabase.from("product_variants").update(rest).eq("id", rid).select("id");
          if (error) { console.error("[save] variant update failed", { row, error }); toast.error(`Variant update failed: ${error.message}`); setSaving(false); return; }
          updated += (data?.length ?? 0);
        } else {
          const { id: _drop, ...rest } = row;
          const { error, data } = await supabase.from("product_variants").insert(rest).select("id");
          if (error) { console.error("[save] variant insert failed", { row, error }); toast.error(`Variant insert failed: ${error.message}`); setSaving(false); return; }
          inserted += (data?.length ?? 0);
          if ((data?.length ?? 0) === 0) {
            console.warn("[save] variant insert returned 0 rows (likely RLS)", row);
            toast.error("Variation insert returned no rows — database permissions are blocking the save.");
            setSaving(false);
            return;
          }
        }
      }
      console.log("[save] variants synced", { inserted, updated });
    }

    setSaving(false);
    toast.success(isEdit ? "Product updated" : "Product created");
    nav({ to: "/admin", search: { tab: "products" } });
  };


  const duplicate = async () => {
    if (!productId) return;
    const { data: prod } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
    if (!prod) return;
    const { id: _id, slug: _slug, created_at: _c, updated_at: _u, rating_avg: _r, review_count: _rc, ...rest } = prod as Record<string, unknown>;
    const { data, error } = await supabase.from("products").insert({ ...rest, name: `${rest.name} (copy)`, published: false } as never).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Duplicated");
    nav({ to: "/admin/products/$id/edit", params: { id: data.id } });
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-surface text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-surface">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center gap-3">
          <Link to="/admin" search={{ tab: "products" }} className="lg:hidden -ml-1 p-1.5 rounded hover:bg-secondary" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Link to="/admin" search={{ tab: "products" }} className="hover:text-foreground">Admin</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="hover:text-foreground">Products</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground truncate">{isEdit ? "Edit" : "New"}</span>
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tight truncate">
              {isEdit ? (p.name || "Edit product") : "New product"}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEdit && (
              <button onClick={duplicate} className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-secondary">
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
            )}
            <Link to="/admin" search={{ tab: "products" }} className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-secondary">
              <X className="h-3.5 w-3.5" /> Cancel
            </Link>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs md:text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-6 min-w-0">
          <Card title="Basic information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Labeled label="Product name" required full>
                <input value={String(p.name ?? "")} onChange={e => setField("name", e.target.value)} placeholder="e.g. Shimano 105 Groupset" className="in" />
              </Labeled>
              <Labeled label={`Price ${hasVariants ? "(base, unused when variations set)" : ""}`}>
                <input type="number" step="0.01" value={String(p.price ?? "")} onChange={e => setField("price", e.target.value)} placeholder="0.00" className="in" />
              </Labeled>
              <Labeled label="Compare at price">
                <input type="number" step="0.01" value={String(p.compare_at_price ?? "")} onChange={e => setField("compare_at_price", e.target.value)} placeholder="0.00" className="in" />
              </Labeled>
              <Labeled label={`Stock ${hasVariants ? "(unused when variations set)" : ""}`}>
                <input type="number" value={String(p.stock ?? 0)} onChange={e => setField("stock", e.target.value)} placeholder="0" className="in" />
              </Labeled>
              <Labeled label="SKU">
                <input value={String(p.sku ?? "")} onChange={e => setField("sku", e.target.value)} placeholder="Optional stock code" className="in" />
              </Labeled>
            </div>
          </Card>

          <Card title="Description">
            <div className="space-y-3">
              <Labeled label="Short description">
                <input value={String(p.short_description ?? "")} onChange={e => setField("short_description", e.target.value)} className="in" placeholder="One-line hook shown on cards and PDP" />
              </Labeled>
              <Labeled label="Full description">
                <textarea rows={6} value={String(p.description ?? "")} onChange={e => setField("description", e.target.value)} className="in" placeholder="Product details, features, materials…" />
              </Labeled>
            </div>
          </Card>

          {/* Variations */}
          <Card title="Variations" subtitle="Add attribute types like Size, Color, or Type. When variations are defined, the base Price and Stock above are ignored — each combination sets its own.">
            <div className="space-y-4">
              <div className="space-y-3">
                {attrTypes.map((t, i) => (
                  <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <input value={t.name} onChange={e => setAttrTypes(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        placeholder="Attribute name (e.g. Size)" className="in flex-1" />
                      <button type="button" onClick={() => setAttrTypes(prev => prev.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive rounded" aria-label="Remove attribute">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {t.values.map((v, vi) => (
                        <div key={vi} className="inline-flex items-center gap-1 rounded-md border border-input bg-card pl-2">
                          <input value={v} onChange={e => setAttrTypes(prev => prev.map((x, j) => j === i ? { ...x, values: x.values.map((y, k) => k === vi ? e.target.value : y) } : x))}
                            placeholder="Value" className="w-24 py-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/60" />
                          <button type="button" onClick={() => setAttrTypes(prev => prev.map((x, j) => j === i ? { ...x, values: x.values.filter((_, k) => k !== vi) } : x))}
                            className="px-1.5 py-1 text-muted-foreground hover:text-destructive" aria-label="Remove value">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setAttrTypes(prev => prev.map((x, j) => j === i ? { ...x, values: [...x.values, ""] } : x))}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-input px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary">
                        <Plus className="h-3 w-3" /> Value
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setAttrTypes(prev => [...prev, { name: "", values: [""] }])}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-secondary">
                  <Plus className="h-3.5 w-3.5" /> Add attribute
                </button>
                <button type="button" onClick={generateMatrix}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-primary/20">
                  Generate combinations
                </button>
              </div>

              {variants.length > 0 && (
                <div className="rounded-md border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-[10px] uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="text-left p-2">Combination</th>
                        <th className="text-right p-2 w-24">Price</th>
                        <th className="text-right p-2 w-20">Stock</th>
                        <th className="text-left p-2 w-32">SKU</th>
                        <th className="p-2 w-16">On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, i) => (
                        <tr key={i} className={"border-t border-border " + (!v.enabled ? "opacity-50" : "")}>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(v.attributes).map(([k, val]) => (
                                <span key={k} className="rounded bg-secondary px-1.5 py-0.5 text-[11px]"><b className="font-bold">{k}:</b> {val}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-1"><input type="number" step="0.01" value={v.price} onChange={e => setVariantField(i, { price: e.target.value })} className="in text-right" /></td>
                          <td className="p-1"><input type="number" value={v.stock} onChange={e => setVariantField(i, { stock: e.target.value })} className="in text-right" /></td>
                          <td className="p-1"><input value={v.sku} onChange={e => setVariantField(i, { sku: e.target.value })} className="in" /></td>
                          <td className="p-2 text-center"><input type="checkbox" checked={v.enabled} onChange={e => setVariantField(i, { enabled: e.target.checked })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card title="SEO & Tags" subtitle="URL slug, tags and the meta tags rendered on the product page.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Labeled label="URL slug" hint={`Page URL: /products/${slugify(String(p.slug ?? "").trim() || String(p.name ?? "")) || "…"} — must be unique.`} full>
                <div className="flex gap-2">
                  <input value={String(p.slug ?? "")} onChange={e => setField("slug", e.target.value)} placeholder="auto-generated from the product name" className="in flex-1" />
                  <button type="button" onClick={() => setField("slug", slugify(String(p.name ?? "")))}
                    className="shrink-0 rounded-md border border-border px-3 text-xs font-bold uppercase tracking-wide hover:bg-secondary">
                    Auto
                  </button>
                </div>
              </Labeled>
              <Labeled label="Tags" hint="Press Enter or comma to add. Tags are also merged into the page meta keywords." full>
                <TagInput value={p.tags ?? []} onChange={v => setField("tags", v)} />
              </Labeled>
              <Labeled label="Meta title" hint="Leave blank to use the product name." full>
                <input value={String(p.seo_title ?? "")} onChange={e => setField("seo_title", e.target.value)} className="in" placeholder="e.g. Shimano 105 11-Speed Cassette | Yours" />
                <Counter len={String(p.seo_title ?? "").length} min={50} max={60} />
              </Labeled>
              <Labeled label="Meta description" hint="Leave blank to use the short description." full>
                <textarea rows={3} value={String(p.seo_description ?? "")} onChange={e => setField("seo_description", e.target.value)} className="in" />
                <Counter len={String(p.seo_description ?? "").length} min={150} max={160} />
              </Labeled>
              <Labeled label="Meta keywords" hint="Comma separated. Tags above are merged in automatically on save." full>
                <input value={String(p.seo_keywords ?? "")} onChange={e => setField("seo_keywords", e.target.value)} className="in" placeholder="comma, separated, keywords" />
              </Labeled>
              <Labeled label="Image alt text" hint="Describes the main image for search engines and screen readers.">
                <input value={String(p.image_alt ?? "")} onChange={e => setField("image_alt", e.target.value)} className="in" />
              </Labeled>
              <Labeled label="Social share image URL" hint="Optional. Defaults to the first product image.">
                <input value={String(p.og_image_url ?? "")} onChange={e => setField("og_image_url", e.target.value)} className="in" />
              </Labeled>
              <Labeled label="Video URL (YouTube or MP4)" full>
                <input value={String(p.video_url ?? "")} onChange={e => setField("video_url", e.target.value)} className="in" />
              </Labeled>
            </div>
          </Card>

        </div>

        {/* Sidebar */}
        <aside className="space-y-6 min-w-0">
          <Card title="Visibility">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!p.published} onChange={e => setField("published", e.target.checked)} /> Published
              </label>
              <p className="text-xs text-muted-foreground">Unpublished products are hidden from the storefront.</p>
              <div className="pt-2 border-t border-border space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.is_new} onChange={e => setField("is_new", e.target.checked)} /> New arrival</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.is_bestseller} onChange={e => setField("is_bestseller", e.target.checked)} /> Best seller</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.featured} onChange={e => setField("featured", e.target.checked)} /> Featured</label>
              </div>
            </div>
          </Card>

          <Card title="Category & brand" subtitle="Pick a category first to choose one of its sub-categories.">
            <div className="space-y-3">
              <Labeled label="Category">
                <select value={String(p.category_id ?? "")} onChange={e => { const v = e.target.value || null; setP(prev => ({ ...prev, category_id: v, sub_category_id: null })); }} className="in">
                  <option value="">—</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Labeled>
              <Labeled label="Sub-category">
                <select value={String(p.sub_category_id ?? "")} onChange={e => setField("sub_category_id", e.target.value || null)} className="in" disabled={!p.category_id}>
                  <option value="">{p.category_id ? (catSubs.length ? "—" : "No sub-categories yet") : "Choose a category first"}</option>
                  {catSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Labeled>
              {p.category_id && catSubs.length === 0 && (
                <p className="text-xs text-muted-foreground">Add sub-categories in Admin → Menus.</p>
              )}
              <Labeled label="Brand">
                <select value={String(p.brand_id ?? "")} onChange={e => setField("brand_id", e.target.value || null)} className="in">
                  <option value="">—</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Labeled>
            </div>
          </Card>

          <Card title="Product images" subtitle="First image is used as the main thumbnail.">
            <div className="flex flex-wrap gap-2">
              {(p.images ?? []).map((url, i) => (
                <div key={url + i} className="relative h-20 w-20 rounded-md border border-border overflow-hidden bg-secondary group">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setField("images", (p.images ?? []).filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
              <label className="h-20 w-20 flex items-center justify-center rounded-md border-2 border-dashed border-border text-xs text-muted-foreground cursor-pointer hover:border-primary hover:text-primary">
                + Add
                <input type="file" multiple accept="image/*" className="hidden" onChange={e => { uploadImages(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </Card>
        </aside>
      </div>

      {/* Sticky mobile save bar */}
      <div className="lg:hidden sticky bottom-0 z-30 bg-card border-t border-border p-3 flex gap-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Link to="/admin" search={{ tab: "products" }} className="flex-1 text-center rounded-md border border-input px-4 py-2.5 text-sm font-bold uppercase">Cancel</Link>
        <button onClick={save} disabled={saving} className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-bold uppercase text-primary-foreground disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 md:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Labeled({ label, required, full, hint, children }: { label: string; required?: boolean; full?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={"block " + (full ? "sm:col-span-2" : "")}>
      <span className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </label>
  );
}

function Counter({ len, min, max }: { len: number; min: number; max: number }) {
  const ok = len >= min && len <= max;
  return (
    <p className={"mt-1 text-xs font-semibold " + (len === 0 ? "text-muted-foreground" : ok ? "text-emerald-600" : "text-amber-600")}>
      {len} characters {len === 0 ? `(recommended ${min}–${max})` : ok ? "— good length" : `— aim for ${min}–${max}`}
    </p>
  );
}

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map(t => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const t of parts) if (!next.some(x => x.toLowerCase() === t.toLowerCase())) next.push(t);
    onChange(next);
    setDraft("");
  };
  return (
    <div className="rounded-md border-[1.5px] border-border bg-background p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map(t => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
            {t}
            <button type="button" onClick={() => onChange(value.filter(x => x !== t))} aria-label={`Remove ${t}`} className="opacity-60 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "Add another tag…" : "e.g. mountain bike, e-bike, brake pads"}
          className="flex-1 min-w-[10rem] bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}
