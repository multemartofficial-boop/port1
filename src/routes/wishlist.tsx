import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWishlist } from "@/lib/wishlist";
import { ProductCard, type ProductLite } from "@/components/site/ProductCard";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "My Wishlist — Yours" },
      { name: "description", content: "Products you've saved for later." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const { ids, toggle, loading } = useWishlist();
  const [items, setItems] = useState<ProductLite[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    if (ids.size === 0) { setItems([]); return; }
    setFetching(true);
    supabase.from("products")
      .select("id,name,slug,price,compare_at_price,images,rating_avg,review_count,stock,brand:brands(name)")
      .in("id", Array.from(ids))
      .eq("published", true)
      .then(({ data }) => {
        setItems((data ?? []) as unknown as ProductLite[]);
        setFetching(false);
      });
  }, [ids, user]);

  return (
    <SiteLayout>
      <section className="container-page py-10">
        <div className="flex items-center gap-3 mb-6">
          <Heart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">My Wishlist</h1>
          {items.length > 0 && <span className="text-sm text-muted-foreground">({items.length})</span>}
        </div>

        {authLoading || loading || fetching ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : !user ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <p className="text-muted-foreground">Sign in to save products to your wishlist.</p>
            <Link to="/auth" className="mt-4 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground">Sign in</Link>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <p className="text-muted-foreground">Your wishlist is empty.</p>
            <Link to="/products" className="mt-4 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground">Shop products</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(p => (
              <div key={p.id} className="relative group">
                <ProductCard p={p} />
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-label="Remove from wishlist"
                  className="absolute top-2 right-2 z-10 grid place-items-center h-9 w-9 rounded-full bg-background/90 border border-border shadow-sm hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
