import { staticPageHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { ProductCard, type ProductLite } from "@/components/site/ProductCard";
import { supabase } from "@/integrations/supabase/client";

type Search = { category?: string; sub?: string; q?: string; tag?: string; brand?: string; sort?: "price_asc" | "price_desc" };

export const Route = createFileRoute("/products/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    category: typeof s.category === "string" ? s.category : undefined,
    sub: typeof s.sub === "string" ? s.sub : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    tag: typeof s.tag === "string" ? s.tag : undefined,
    brand: typeof s.brand === "string" ? s.brand : undefined,
    sort: s.sort === "price_asc" || s.sort === "price_desc" ? s.sort : undefined,
  }),
  loader: () => staticPageHead("products", {
    title: "Shop All",
    description: "Browse cycling components, wheels, helmets, apparel and accessories from top brands. Free UK shipping over £30.",
    path: "/products",
  }),
  head: ({ loaderData }) => loaderData?.seo ?? {},
  component: ProductsPage,
});

type SubCat = { id: string; name: string; slug: string };

function ProductsPage() {
  const search = Route.useSearch();
  const [items, setItems] = useState<ProductLite[]>([]);
  const [subs, setSubs] = useState<SubCat[]>([]);
  const [loading, setLoading] = useState(true);

  // sub-categories of the currently browsed category
  useEffect(() => {
    const cat = search.category;
    if (!cat || ["new-arrivals", "best-sellers"].includes(cat)) { setSubs([]); return; }
    (async () => {
      const { data } = await supabase
        .from("sub_categories")
        .select("id,name,slug,category:categories!inner(slug)")
        .eq("active", true)
        .eq("categories.slug", cat)
        .order("sort_order");
      setSubs(((data ?? []) as unknown as SubCat[]));
    })();
  }, [search.category]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("products")
        .select("id,name,slug,price,compare_at_price,images,rating_avg,review_count,stock,is_bestseller,is_new,sub_category_id,category:categories!inner(slug),brand:brands(id,name,slug),sub_category:sub_categories(id,name,slug)")
        .eq("published", true);
      if (search.category && !["new-arrivals","best-sellers"].includes(search.category)) q = q.eq("categories.slug", search.category);
      if (search.category === "new-arrivals" || search.tag === "new") q = q.eq("is_new", true);
      if (search.category === "best-sellers" || search.tag === "bestsellers") q = q.eq("is_bestseller", true);
      if (search.brand) q = q.eq("brands.slug", search.brand);
      if (search.q) q = q.ilike("name", `%${search.q}%`);
      if (search.sort === "price_asc") q = q.order("price", { ascending: true });
      else if (search.sort === "price_desc") q = q.order("price", { ascending: false });
      const { data } = await q.limit(48);
      let rows = (data as unknown as (ProductLite & { sub_category?: SubCat | null })[]) ?? [];
      if (search.sub) rows = rows.filter(r => r.sub_category?.slug === search.sub);
      setItems(rows);
      setLoading(false);
    })();
  }, [search.category, search.sub, search.q, search.tag, search.brand, search.sort]);


  const title = search.q ? `Results for "${search.q}"` : search.category ? search.category.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : (search.tag === "new" ? "New Arrivals" : search.tag === "bestsellers" ? "Best Sellers" : "All Products");

  return (
    <SiteLayout>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-8">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Shop</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-black tracking-tight">{title}</h1>
        </div>
      </section>
      <div className="container-page grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6 md:gap-8 py-6 md:py-10">
        <aside className="md:sticky md:top-24 md:self-start">
          <details className="md:hidden rounded-lg border border-border bg-card p-4 mb-2" open={false}>
            <summary className="text-sm font-bold uppercase tracking-widest cursor-pointer">Sort</summary>
            <div className="mt-4">
              <SortOptions search={search} />
            </div>
          </details>
          <div className="hidden md:block">
            <SortOptions search={search} />
          </div>
        </aside>
        <div className="min-w-0">
          {subs.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              <Link to="/products" search={{ ...search, sub: undefined } as never}
                className={"rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide " + (!search.sub ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}>
                All
              </Link>
              {subs.map(s => (
                <Link key={s.id} to="/products" search={{ ...search, sub: s.slug } as never}
                  className={"rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide " + (search.sub === s.slug ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}>
                  {s.name}
                </Link>
              ))}
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">{Array.from({length:6}).map((_,i)=>(<div key={i} className="aspect-square bg-secondary rounded-lg animate-pulse"/>))}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">No products match your filters.</div>
          ) : subs.length > 0 && !search.sub ? (
            <div className="space-y-10">
              {[...subs.map(s => ({ key: s.slug, name: s.name })), { key: "__none", name: "More" }].map(group => {
                const rows = items.filter(p => {
                  const slug = (p as ProductLite & { sub_category?: SubCat | null }).sub_category?.slug;
                  return group.key === "__none" ? !slug : slug === group.key;
                });
                if (!rows.length) return null;
                return (
                  <section key={group.key}>
                    <h2 className="mb-3 text-lg font-black tracking-tight">{group.name}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
                      {rows.map(p => <ProductCard key={p.id} p={p} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
              {items.map(p => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}

function SortOptions({ search }: { search: Search }) {
  const opts = [
    { key: undefined, label: "Default" },
    { key: "price_asc", label: "Price: Low to High" },
    { key: "price_desc", label: "Price: High to Low" },
  ] as const;

  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Sort by</div>
      <ul className="space-y-1.5 text-sm">
        {opts.map(o => (
          <li key={o.label}>
            <Link
              to="/products"
              search={{ ...search, sort: o.key } as never}
              className={search.sort === o.key ? "text-primary font-bold" : "hover:text-primary"}
            >
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
