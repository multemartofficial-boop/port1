import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, ShoppingCart, Heart, Truck, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useWishlist } from "@/lib/wishlist";
import { gbp } from "@/lib/format";
import { toast } from "sonner";
import { fetchSeoSettings, DEFAULT_GLOBAL_SEO, buildSeoHead, applyTitleTemplate, truncate, absoluteUrl, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ params }) => {
    const [{ global }, { data }] = await Promise.all([
      fetchSeoSettings(),
      supabase.from("products")
        .select("id,name,slug,description,short_description,price,stock,sku,images,rating_avg,review_count,seo_title,seo_description,seo_keywords,tags,og_image_url,image_alt,brand:brands(name)")
        .eq("slug", params.slug).eq("published", true).maybeSingle(),
    ]);
    return { seo: global, product: data as SeoProduct | null };
  },
  head: ({ params, loaderData }) => {
    const g = loaderData?.seo ?? DEFAULT_GLOBAL_SEO;
    const p = loaderData?.product;
    const path = `/products/${params.slug}`;
    if (!p) {
      return buildSeoHead({ title: applyTitleTemplate(g.title_template, "Product"), description: g.default_description, path, image: g.og_image });
    }
    const title = p.seo_title?.trim() || applyTitleTemplate(g.title_template, p.name);
    const description = p.seo_description?.trim() || truncate(p.short_description || p.description || g.default_description);
    const firstImage = Array.isArray(p.images) ? (p.images as string[])[0] : undefined;
    const image = p.og_image_url?.trim() || firstImage || g.og_image;
    const keywords = Array.from(new Set([
      ...String(p.seo_keywords ?? "").split(",").map(k => k.trim()).filter(Boolean),
      ...((p.tags ?? []) as string[]).map(t => t.trim()).filter(Boolean),
    ])).join(", ");
    const head = buildSeoHead({ title, description, path, image, type: "product", keywords: keywords || null });
    const ratingCount = Number(p.review_count ?? 0);
    return {
      ...head,
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          description,
          sku: p.sku ?? undefined,
          image: absoluteUrl(image),
          ...(p.brand?.name ? { brand: { "@type": "Brand", name: p.brand.name } } : {}),
          offers: {
            "@type": "Offer",
            url: `${SITE_URL}${path}`,
            priceCurrency: "GBP",
            price: Number(p.price ?? 0).toFixed(2),
            availability: Number(p.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
          ...(ratingCount > 0
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(p.rating_avg ?? 0).toFixed(1), reviewCount: ratingCount } }
            : {}),
        }),
      }],
    };
  },
  component: PDP,
});

type SeoProduct = {
  id: string; name: string; slug: string; description: string | null; short_description: string | null;
  price: string | number; stock: number; sku: string | null; images: unknown;
  rating_avg: string | number; review_count: number;
  seo_title: string | null; seo_description: string | null; seo_keywords: string | null; tags?: string[] | null;
  og_image_url: string | null; image_alt: string | null;
  brand: { name: string } | null;
};

type Product = {
  id: string; name: string; slug: string; description: string | null; short_description: string | null;
  price: string | number; compare_at_price: string | number | null; stock: number; sku: string | null;
  images: unknown; video_url: string | null; rating_avg: string | number; review_count: number;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string } | null;
};
type Variant = { id: string; name: string; price: string | number | null; stock: number; sku: string | null; attributes: Record<string, string> };
type Review = { id: string; rating: number; title: string | null; body: string | null; created_at: string };

function PDP() {
  const { slug } = useParams({ from: "/products/$slug" });
  const { add } = useCart();
  const { user } = useAuth();
  const { has: wishHas, toggle: wishToggle } = useWishlist();
  const [p, setP] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [imgIdx, setImgIdx] = useState(0);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [newReview, setNewReview] = useState({ rating: 5, title: "", body: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products")
        .select("*,brand:brands(name,slug),category:categories(name,slug)")
        .eq("slug", slug).eq("published", true).maybeSingle();
      setP(data as unknown as Product | null);
      if (data) {
        const [v, r] = await Promise.all([
          supabase.from("product_variants").select("id,name,price,stock,sku,attributes").eq("product_id", (data as { id: string }).id).order("created_at", { ascending: true }),
          supabase.from("reviews").select("id,rating,title,body,created_at").eq("product_id", (data as { id: string }).id).eq("approved", true).order("created_at", { ascending: false }).limit(20),
        ]);
        setVariants((v.data ?? []).map(x => ({ ...x, attributes: (x.attributes ?? {}) as Record<string, string> })) as Variant[]); setReviews(r.data ?? []);
      }
    })();
  }, [slug]);

  // Derive attribute types from variants (safe when p is null)
  const attrTypes: { name: string; values: string[] }[] = [];
  const seen = new Map<string, Set<string>>();
  for (const v of variants) {
    for (const [k, val] of Object.entries(v.attributes ?? {})) {
      if (!seen.has(k)) { seen.set(k, new Set()); attrTypes.push({ name: k, values: [] }); }
      seen.get(k)!.add(String(val));
    }
  }
  for (const t of attrTypes) t.values = Array.from(seen.get(t.name) ?? []);

  const allSelected = attrTypes.length > 0 && attrTypes.every(t => selectedAttrs[t.name]);
  const currentVariant = allSelected
    ? variants.find(v => attrTypes.every(t => v.attributes[t.name] === selectedAttrs[t.name])) ?? null
    : null;
  const availStock = attrTypes.length > 0
    ? (currentVariant ? currentVariant.stock : 0)
    : (p?.stock ?? 0);
  const canPickQty = attrTypes.length === 0 || !!currentVariant;
  const maxQty = canPickQty ? Math.max(1, availStock) : 1;

  // Clamp qty when available stock changes (must run before any early return)
  useEffect(() => {
    if (canPickQty && availStock > 0 && qty > availStock) setQty(availStock);
    if (canPickQty && availStock <= 0 && qty !== 1) setQty(1);
  }, [availStock, canPickQty]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <SiteLayout><div className="container-page py-20 text-center text-muted-foreground">Loading…</div></SiteLayout>;

  const images = (Array.isArray(p.images) ? p.images : []) as string[];
  const hasImages = images.length > 0;

  const priceNum = Number(currentVariant?.price ?? p.price);
  const compareNum = p.compare_at_price ? Number(p.compare_at_price) : null;
  const outOfStock = attrTypes.length > 0
    ? (currentVariant ? currentVariant.stock <= 0 : false)
    : p.stock <= 0;


  const addToCart = () => {
    if (attrTypes.length > 0 && !currentVariant) { toast.error("Please select all options"); return; }
    if (outOfStock) { toast.error("Out of stock"); return; }
    if (qty > availStock) { toast.error(`Only ${availStock} left in stock`); return; }
    add({ productId: p.id, variantId: currentVariant?.id, name: p.name + (currentVariant ? ` (${currentVariant.name})` : ""), slug: p.slug, price: priceNum, image: images[0] ?? "" }, qty);
    toast.success("Added to cart");
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to leave a review"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({ product_id: p.id, user_id: user.id, rating: newReview.rating, title: newReview.title, body: newReview.body });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Review posted");
    setNewReview({ rating: 5, title: "", body: "" });
    const { data } = await supabase.from("reviews").select("id,rating,title,body,created_at").eq("product_id", p.id).eq("approved", true).order("created_at", { ascending: false }).limit(20);
    setReviews(data ?? []);
  };

  return (
    <SiteLayout>
      <div className="container-page py-4 text-xs text-muted-foreground">
        <Link to="/">Home</Link> / <Link to="/products">Shop</Link>
        {p.category && <> / <Link to="/products" search={{ category: p.category.slug } as never}>{p.category.name}</Link></>}
        {" / "}<span className="text-foreground">{p.name}</span>
      </div>
      <section className="container-page grid grid-cols-1 md:grid-cols-2 gap-10 pb-14">
        <div>
          <div className="aspect-square rounded-lg bg-secondary overflow-hidden grid place-items-center">
            {hasImages ? (
              <img src={images[imgIdx]} alt={p.name} className="h-full w-full object-contain p-8" />
            ) : (
              <div className="text-xs uppercase tracking-widest text-muted-foreground">No image</div>
            )}
          </div>
          {(images.length > 1 || p.video_url) && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {images.map((im, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={"h-16 w-16 rounded-md overflow-hidden border-2 " + (i === imgIdx ? "border-primary" : "border-border")}>
                  <img src={im} alt="" className="h-full w-full object-contain p-1 bg-secondary" />
                </button>
              ))}
            </div>
          )}
          {p.video_url && (() => {
            const yt = p.video_url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
            return (
              <div className="mt-4 aspect-video rounded-md overflow-hidden bg-black">
                {yt ? (
                  <iframe src={`https://www.youtube.com/embed/${yt[1]}`} title="Product video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" />
                ) : (
                  <video controls src={p.video_url} className="h-full w-full" />
                )}
              </div>
            );
          })()}
        </div>
        <div>
          {p.brand && <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{p.brand.name}</div>}
          <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">{p.name}</h1>
          <div className="mt-3 flex items-center gap-1 text-amber-500">
            {[1,2,3,4,5].map(i => <Star key={i} className={"h-4 w-4 " + (i <= Math.round(Number(p.rating_avg)) ? "fill-current" : "opacity-30")} />)}
            <span className="text-sm text-muted-foreground ml-2">{Number(p.rating_avg).toFixed(1)} · {p.review_count} reviews</span>
          </div>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-black text-primary">{gbp(priceNum)}</span>
            {compareNum && compareNum > priceNum && (
              <>
                <span className="text-lg text-muted-foreground line-through">{gbp(compareNum)}</span>
                <span className="rounded-sm bg-primary/10 text-primary text-xs font-bold px-2 py-1">Save {gbp(compareNum - priceNum)}</span>
              </>
            )}
          </div>
          {p.short_description && <p className="mt-4 text-muted-foreground">{p.short_description}</p>}

          {attrTypes.length > 0 && (
            <div className="mt-6 space-y-4">
              {attrTypes.map(t => (
                <div key={t.name}>
                  <div className="text-xs uppercase font-bold tracking-widest mb-2">{t.name}{selectedAttrs[t.name] && <span className="ml-2 text-muted-foreground normal-case tracking-normal">· {selectedAttrs[t.name]}</span>}</div>
                  <div className="flex flex-wrap gap-2">
                    {t.values.map(val => {
                      // Check if this value has any in-stock combo given other selections
                      const trial = { ...selectedAttrs, [t.name]: val };
                      const matches = variants.filter(v => Object.entries(trial).every(([k, vv]) => v.attributes[k] === vv));
                      const available = matches.some(v => v.stock > 0);
                      const active = selectedAttrs[t.name] === val;
                      return (
                        <button key={val} onClick={() => setSelectedAttrs(s => ({ ...s, [t.name]: val }))}
                          disabled={!available}
                          className={"px-3 py-2 rounded-md border text-sm transition " + (active ? "border-primary bg-primary/10 text-primary font-bold" : "border-border hover:border-primary") + (!available ? " opacity-40 line-through cursor-not-allowed" : "")}>
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {allSelected && currentVariant && (
                <div className="text-xs text-muted-foreground">
                  {currentVariant.stock > 0 ? <>In stock · <b className="text-foreground">{currentVariant.stock}</b> available{currentVariant.sku ? <> · SKU {currentVariant.sku}</> : null}</> : <span className="text-destructive font-bold">Out of stock</span>}
                </div>
              )}
              {attrTypes.length > 0 && !allSelected && (
                <div className="text-xs text-muted-foreground">Select all options to see availability.</div>
              )}
            </div>
          )}

          {attrTypes.length === 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              {availStock > 0 ? <>In stock · <b className="text-foreground">{availStock}</b> available</> : <span className="text-destructive font-bold">Out of stock</span>}
            </div>
          )}



          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center rounded-md border border-input">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2" disabled={outOfStock}>−</button>
              <span className="w-10 text-center">{qty}</span>
              <button
                onClick={() => setQty(q => {
                  if (!canPickQty) return q;
                  if (q >= maxQty) { toast.error(`Only ${availStock} left in stock`); return q; }
                  return q + 1;
                })}
                className="px-3 py-2 disabled:opacity-40"
                disabled={outOfStock || (canPickQty && qty >= maxQty)}
              >+</button>
            </div>
            <button onClick={addToCart} disabled={outOfStock} className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed">
              <ShoppingCart className="h-4 w-4" /> {outOfStock ? "Out of stock" : "Add to cart"}
            </button>
            {(() => {
              const inWish = wishHas(p.id);
              return (
                <button type="button" onClick={() => wishToggle(p.id)} aria-label={inWish ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={inWish} className={"grid place-items-center h-11 w-11 rounded-md border transition " + (inWish ? "border-primary bg-primary/10 text-primary" : "border-input hover:border-primary hover:text-primary")}>
                  <Heart className={"h-4 w-4 " + (inWish ? "fill-current" : "")} />
                </button>
              );
            })()}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Free UK shipping over £30</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Genuine parts · 30-day returns</div>
          </div>

          {p.description && (
            <div className="mt-8 pt-8 border-t border-border prose prose-sm max-w-none">
              <h3 className="text-sm font-bold uppercase tracking-widest">Description</h3>
              <p className="text-muted-foreground mt-2 whitespace-pre-wrap">{p.description}</p>
            </div>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section className="container-page pb-16">
        <h2 className="text-lg font-black uppercase tracking-wide mb-5">Reviews</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            {reviews.length === 0 && <div className="text-muted-foreground">No reviews yet.</div>}
            {reviews.map(r => (
              <div key={r.id} className="rounded-md border border-border p-4">
                <div className="flex items-center gap-1 text-amber-500">
                  {[1,2,3,4,5].map(i => <Star key={i} className={"h-4 w-4 " + (i <= r.rating ? "fill-current" : "opacity-30")} />)}
                  <span className="ml-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                </div>
                {r.title && <div className="mt-1 font-bold">{r.title}</div>}
                {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
              </div>
            ))}
          </div>
          <form onSubmit={submitReview} className="rounded-md border border-border p-5 space-y-3 h-fit">
            <div className="font-bold">Write a review</div>
            {!user && <div className="text-xs text-muted-foreground"><Link to="/auth" className="text-primary underline">Sign in</Link> to leave a review.</div>}
            <div>
              <div className="text-xs uppercase font-bold tracking-widest mb-1">Rating</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button key={i} type="button" onClick={() => setNewReview(r => ({ ...r, rating: i }))}>
                    <Star className={"h-6 w-6 text-amber-500 " + (i <= newReview.rating ? "fill-current" : "opacity-30")} />
                  </button>
                ))}
              </div>
            </div>
            <input value={newReview.title} onChange={e => setNewReview(r => ({ ...r, title: e.target.value }))} placeholder="Title" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
            <textarea value={newReview.body} onChange={e => setNewReview(r => ({ ...r, body: e.target.value }))} placeholder="Your thoughts…" rows={4} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
            <button disabled={submitting || !user} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">Post review</button>
          </form>
        </div>
      </section>
    </SiteLayout>
  );
}
