import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/Layout";
import { cartLineId, useCart } from "@/lib/cart";
import { gbp } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart — Yours" }, { name: "description", content: "Review the items in your cart." }] }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, subtotal, clear } = useCart();
  const shipping = subtotal > 30 || subtotal === 0 ? 0 : 2.99;
  const total = subtotal + shipping;

  // Fetch live stock for each product/variant in the cart
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      if (items.length === 0) { setStockMap({}); return; }
      const productIds = Array.from(new Set(items.map(i => i.productId)));
      const variantIds = Array.from(new Set(items.map(i => i.variantId).filter(Boolean) as string[]));
      const map: Record<string, number> = {};
      if (productIds.length) {
        const { data } = await supabase.from("products").select("id,stock").in("id", productIds);
        for (const r of data ?? []) map[`p:${r.id}`] = r.stock ?? 0;
      }
      if (variantIds.length) {
        const { data } = await supabase.from("product_variants").select("id,stock").in("id", variantIds);
        for (const r of data ?? []) map[`v:${r.id}`] = r.stock ?? 0;
      }
      setStockMap(map);
    })();
  }, [items]);

  const stockFor = (i: typeof items[number]) =>
    i.variantId ? stockMap[`v:${i.variantId}`] : stockMap[`p:${i.productId}`];

  return (
    <SiteLayout>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-8"><h1 className="text-3xl md:text-4xl font-black tracking-tight">Your cart</h1></div>
      </section>
      <div className="container-page py-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px] gap-8">
        <div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-border p-12 text-center">
              <div className="text-muted-foreground">Your cart is empty.</div>
              <Link to="/products" className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground">Shop products</Link>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden bg-card">
              {items.map(i => {
                const lineId = cartLineId(i);
                const stock = stockFor(i);
                const atMax = typeof stock === "number" && i.quantity >= stock;
                const overStock = typeof stock === "number" && i.quantity > stock;
                return (
                <li key={lineId} className="p-3 sm:p-4 grid grid-cols-[64px_minmax(0,1fr)] sm:grid-cols-[80px_minmax(0,1fr)] gap-3 sm:gap-4 items-start">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-md bg-secondary shrink-0"><img src={i.image} alt="" className="h-full w-full object-contain p-2" /></div>
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Link to="/products/$slug" params={{ slug: i.slug }} className="font-semibold hover:text-primary line-clamp-2 text-sm sm:text-base break-words">{i.name}</Link>
                        <div className="mt-1 text-sm text-muted-foreground">{gbp(i.price)}</div>
                        {typeof stock === "number" && stock > 0 && stock <= 5 && (
                          <div className={"mt-1 text-xs " + (overStock ? "text-destructive font-bold" : "text-amber-600")}>
                            {overStock ? `Only ${stock} left — please reduce quantity` : `Only ${stock} left in stock`}
                          </div>
                        )}
                        {typeof stock === "number" && stock === 0 && (
                          <div className="mt-1 text-xs text-destructive font-bold">Out of stock</div>
                        )}
                      </div>
                      <button onClick={() => remove(lineId)} aria-label="Remove item" className="shrink-0 text-muted-foreground hover:text-primary p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-md border border-input shrink-0">
                        <button onClick={() => setQty(lineId, i.quantity - 1)} aria-label="Decrease quantity" className="px-3 py-1.5">−</button>
                        <span className="w-8 text-center text-sm">{i.quantity}</span>
                        <button
                          onClick={() => {
                            if (typeof stock === "number" && i.quantity >= stock) {
                              toast.error(stock === 0 ? "Out of stock" : `Only ${stock} left in stock`);
                              return;
                            }
                            setQty(lineId, i.quantity + 1);
                          }}
                          disabled={atMax}
                          aria-label="Increase quantity"
                          className="px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >+</button>
                      </div>
                      <div className="text-right font-bold shrink-0">{gbp(i.price * i.quantity)}</div>
                    </div>
                  </div>
                </li>
              );})}

            </ul>
          )}
          {items.length > 0 && <button onClick={clear} className="mt-4 text-sm text-muted-foreground hover:text-primary">Clear cart</button>}
        </div>
        <aside className="h-fit rounded-lg border border-border p-5 bg-card">
          <div className="font-bold uppercase tracking-widest text-xs mb-4">Order summary</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{gbp(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shipping === 0 ? "Free" : gbp(shipping)}</span></div>
            <div className="flex justify-between text-base font-black pt-3 border-t border-border mt-3"><span>Total</span><span>{gbp(total)}</span></div>
          </div>
          <Link to="/checkout" className={"mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-bold uppercase tracking-wide " + (items.length ? "bg-primary text-primary-foreground hover:brightness-110" : "bg-muted text-muted-foreground pointer-events-none")}>
            Checkout <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </SiteLayout>
  );
}
