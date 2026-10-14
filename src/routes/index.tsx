import { staticPageHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Truck, ShieldCheck, Wrench, RotateCcw, ChevronLeft, ChevronRight, ExternalLink, PackageSearch } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { ProductCard, type ProductLite } from "@/components/site/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { gbp } from "@/lib/format";

export const Route = createFileRoute("/")({
  loader: () => staticPageHead("home", {
    title: "Home",
    description: "Pro-grade drivetrains, wheels, helmets and cycling gear — plus mobile mechanics who come to your door. Free UK shipping over £30.",
    path: "/",
  }),
  head: ({ loaderData }) => loaderData?.seo ?? {},
  component: Home,
});

type Cat = { id: string; name: string; slug: string; image_url: string | null };
type Banner = { id?: string; title: string; subtitle: string | null; image_url: string | null; cta_text: string | null; cta_link: string | null };
type Blog = { id: string; title: string; slug: string; excerpt: string | null; cover_url: string | null; published_at: string };

const TRUST = [
  { icon: Truck, title: "Fast UK Shipping", sub: "Free over £30" },
  { icon: ShieldCheck, title: "Genuine Aftermarket", sub: "100% authentic parts" },
  { icon: Wrench, title: "Home Servicing", sub: "Mechanics to your door" },
  { icon: RotateCcw, title: "Easy Returns", sub: "30-day no fuss" },
];

const CATEGORY_TILE_IMG: Record<string, string> = {
  "components": "/images/cassette.jpg",
  "wheels-tyres-tubes": "/images/fork.jpg",
  "clothing": "/images/gloves.jpg",
  "accessories-training": "/images/light.jpg",
  "helmets": "/images/helmet.jpg",
  "workshop": "/images/workshop.jpg",
  "new-arrivals": "/images/saddle.jpg",
  "best-sellers": "/images/shoes.jpg",
};

function Home() {
  const [slides, setSlides] = useState<Banner[]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [cats, setCats] = useState<Cat[]>([]);
  const [best, setBest] = useState<ProductLite[]>([]);
  const [fresh, setFresh] = useState<ProductLite[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [prices, setPrices] = useState<{ bronze: number; silver: number; gold: number; emergency: number }>({ bronze: 45, silver: 75, gold: 120, emergency: 35 });
  const [extShop, setExtShop] = useState<{ url: string; title: string; subtitle: string }>({ url: "", title: "", subtitle: "" });

  useEffect(() => {
    (async () => {
      const [b, c, bs, ne, bl, sp, ex] = await Promise.all([
        supabase.from("banners").select("id,title,subtitle,image_url,cta_text,cta_link").eq("position", "hero").eq("active", true).order("sort_order"),
        supabase.from("categories").select("id,name,slug,image_url").eq("active", true).order("sort_order").limit(8),
        supabase.from("products").select("id,name,slug,price,compare_at_price,images,rating_avg,review_count,stock,brand:brands(name)").eq("published", true).eq("is_bestseller", true).limit(4),
        supabase.from("products").select("id,name,slug,price,compare_at_price,images,rating_avg,review_count,stock,brand:brands(name)").eq("published", true).eq("is_new", true).limit(3),
        supabase.from("blog_posts").select("id,title,slug,excerpt,cover_url,published_at").eq("published", true).order("published_at", { ascending: false }).limit(3),
        supabase.from("site_settings").select("value").eq("key", "service_prices").maybeSingle(),
        supabase.from("site_settings").select("value").eq("key", "external_shop").maybeSingle(),
      ]);
      setSlides((b.data as Banner[]) ?? []);
      setCats(c.data ?? []);
      setBest((bs.data as unknown as ProductLite[]) ?? []);
      setFresh((ne.data as unknown as ProductLite[]) ?? []);
      setBlogs(bl.data ?? []);
      if (sp.data?.value) setPrices(sp.data.value as typeof prices);
      if (ex.data?.value) {
        const v = ex.data.value as Partial<{ url: string; title: string; subtitle: string }>;
        setExtShop({ url: (v.url ?? "").trim(), title: v.title ?? "", subtitle: v.subtitle ?? "" });
      }
    })();
  }, []);

  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  const go = (dir: 1 | -1) => setSlideIdx(i => (i + dir + slides.length) % slides.length);
  const heroSlides: Banner[] = slides.length > 0 ? slides : [{ title: "", subtitle: null, image_url: "/images/hero.jpg", cta_text: null, cta_link: null }];


  return (
    <SiteLayout>
      {/* Hero slideshow — sliding right-to-left, no awkward cropping */}
      <section
        className="relative w-full bg-ink group overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-label="Featured promotions"
      >
        <div className="relative w-full h-[240px] sm:h-[340px] md:h-[420px] lg:h-[470px] overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ transform: `translateX(-${slideIdx * 100}%)` }}
          >
            {heroSlides.map((s, i) => {
              const src = s.image_url ?? "/images/hero.jpg";
              const inner = (
                <>
                  {/* Blurred fill so any aspect ratio looks intentional, never badly cropped */}
                  <img
                    src={src}
                    alt={s.title || "Promotion"}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                  {(s.title || s.subtitle || s.cta_text) && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/50 to-transparent" />
                      <div className="absolute inset-0 flex items-center">
                        <div className="container-page max-w-3xl">
                          {s.title && (
                            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05] drop-shadow-sm">
                              {s.title}
                            </h2>
                          )}
                          {s.subtitle && (
                            <p className="mt-2 sm:mt-4 text-sm sm:text-base lg:text-lg text-white/80 max-w-lg">{s.subtitle}</p>
                          )}
                          {s.cta_text && (
                            <span className="mt-4 sm:mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 transition group-hover:brightness-110">
                              {s.cta_text} <ArrowRight className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
              return s.cta_link ? (
                <a key={s.id ?? i} href={s.cta_link} className="relative shrink-0 basis-full h-full block overflow-hidden" tabIndex={i === slideIdx ? 0 : -1}>
                  {inner}
                </a>
              ) : (
                <div key={s.id ?? i} className="relative shrink-0 basis-full h-full overflow-hidden">{inner}</div>
              );
            })}
          </div>

          {slides.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => go(-1)}
                className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 grid place-items-center h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/85 text-foreground shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-background transition"
              >
                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => go(1)}
                className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 grid place-items-center h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/85 text-foreground shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-background transition"
              >
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
              </button>
              <div className="absolute bottom-4 md:bottom-6 inset-x-0 flex justify-center gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => setSlideIdx(i)}
                    className={"h-2.5 rounded-full transition-all " + (i === slideIdx ? "w-8 bg-primary" : "w-2.5 bg-white/70 hover:bg-white")}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>




      {/* External dropshipping store */}
      {extShop.url && (
        <section className="container-page pt-8">
          <a
            href={extShop.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6 transition hover:border-primary hover:bg-primary/10"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <PackageSearch className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary">Our other store</div>
              <h2 className="mt-1 text-lg sm:text-xl font-black tracking-tight">
                {extShop.title || "Explore our Dropshipping Store"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {extShop.subtitle || "Thousands of extra products, shipped direct — a separate store from our cycle parts business."}
              </p>
            </div>
            <span className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 group-hover:brightness-110 whitespace-nowrap">
              Visit store <ExternalLink className="h-4 w-4" />
            </span>
          </a>
        </section>
      )}

      {/* Trust row */}
      <section className="border-b border-border">
        <div className="container-page grid grid-cols-2 md:grid-cols-4 gap-6 py-6">
          {TRUST.map(t => (
            <div key={t.title} className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0"><t.icon className="h-5 w-5" /></div>
              <div className="min-w-0"><div className="text-sm font-bold">{t.title}</div><div className="text-xs text-muted-foreground">{t.sub}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* Category tile grid */}
      <section className="container-page py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cats.slice(0, 8).map(c => (
            <Link key={c.id} to="/products" search={{ category: c.slug } as never}
              className="product-tile relative aspect-square rounded-lg overflow-hidden bg-secondary group">
              <img src={c.image_url || CATEGORY_TILE_IMG[c.slug] || "/images/cassette.jpg"} alt={c.name} loading="lazy"
                className="absolute inset-0 h-full w-full object-contain p-6 transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-white text-xs font-bold uppercase tracking-wide">
                {c.name}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Best Sellers / New Arrivals CTA */}
      <section className="container-page grid grid-cols-1 md:grid-cols-2 gap-3 pb-10">
        <Link to="/products" search={{ tag: "bestsellers" } as never} className="card-elevated rounded-lg bg-surface p-10 text-center">
          <div className="text-2xl md:text-3xl font-black tracking-tight">BEST SELLERS</div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-sm bg-ink text-ink-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest">Shop best sellers <ArrowRight className="h-3.5 w-3.5" /></div>
        </Link>
        <Link to="/products" search={{ tag: "new" } as never} className="card-elevated rounded-lg bg-surface p-10 text-center">
          <div className="text-2xl md:text-3xl font-black tracking-tight">NEW ARRIVALS</div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-sm bg-ink text-ink-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest">Shop new arrivals <ArrowRight className="h-3.5 w-3.5" /></div>
        </Link>
      </section>

      {/* Best sellers products */}
      <section className="container-page pb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black uppercase tracking-wide">Best Sellers</h2>
          <Link to="/products" search={{ tag: "bestsellers" } as never} className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">View all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {best.map(p => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Workshop black band */}
      <section className="bg-ink text-ink-foreground">
        <div className="container-page py-14 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary font-bold">Home Service</div>
            <h2 className="mt-3 text-4xl md:text-5xl font-black tracking-tight">Your workshop,<br />at your door.</h2>
            <p className="mt-4 text-white/70 max-w-md">Book a qualified mechanic for a full service, drivetrain overhaul or emergency repair. Same-week slots available.</p>
            <Link to="/services" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wide hover:brightness-110">Book a service</Link>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-lg overflow-hidden border border-white/10 bg-white/5">
              <img
                src={CATEGORY_TILE_IMG.workshop}
                alt="Mobile mechanic at work"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-5 hidden md:block rounded-md bg-primary text-primary-foreground px-5 py-4 shadow-lg">
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-90">Same-week slots</div>
              <div className="mt-1 text-lg font-black">We come to you</div>
            </div>
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="container-page py-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black uppercase tracking-wide">New Arrivals</h2>
          <Link to="/products" search={{ tag: "new" } as never} className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">View all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {fresh.map(p => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Blog */}
      <section className="container-page pb-16">
        <h2 className="text-lg font-black uppercase tracking-wide mb-5">From the Workshop</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {blogs.map(b => (
            <article key={b.id} className="product-tile rounded-lg overflow-hidden">
              <div className="aspect-[3/2] bg-secondary overflow-hidden">
                <img src={b.cover_url ?? "/images/blog-summer.jpg"} alt={b.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
              </div>
              <div className="p-5">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{new Date(b.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                <h3 className="mt-2 font-bold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{b.excerpt}</p>
                <div className="mt-4 inline-block text-xs font-bold uppercase tracking-widest border border-border rounded-sm px-4 py-2 hover:border-primary hover:text-primary transition">Read more</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
