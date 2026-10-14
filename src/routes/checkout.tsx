import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { cartLineId, useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { gbp } from "@/lib/format";
import { toast } from "sonner";
import { createScopedSupabase } from "@/lib/supabaseScoped";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Yours" }] }),
  component: Checkout,
});

type ShippingTier = { min_subtotal: number; price: number; label: string };
const DEFAULT_SHIPPING_TIERS: ShippingTier[] = [
  { min_subtotal: 0, price: 2.99, label: "Standard delivery" },
  { min_subtotal: 30, price: 0, label: "Free delivery over £30" },
];

function pickTier(tiers: ShippingTier[], subtotal: number): ShippingTier {
  const sorted = [...tiers].sort((a, b) => a.min_subtotal - b.min_subtotal);
  let match = sorted[0] ?? DEFAULT_SHIPPING_TIERS[0];
  for (const t of sorted) if (subtotal >= t.min_subtotal) match = t;
  return match;
}

function Checkout() {
  const { items, subtotal, clear: clearCart } = useCart();
  const { user } = useAuth();

  const [form, setForm] = useState({ email: user?.email ?? "", full_name: "", phone: "", line1: "", city: "", postcode: "", country: "United Kingdom" });
  const [shippingMethod, setShippingMethod] = useState<"delivery" | "collect">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "cod">("stripe");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tiers, setTiers] = useState<ShippingTier[]>(DEFAULT_SHIPPING_TIERS);
  const [codEnabled, setCodEnabled] = useState(true);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "shipping_rules").maybeSingle().then(({ data }) => {
      const v = data?.value as { tiers?: ShippingTier[] } | null;
      if (v?.tiers && Array.isArray(v.tiers) && v.tiers.length > 0) setTiers(v.tiers);
    });
    supabase.from("site_settings").select("value").eq("key", "checkout_settings").maybeSingle().then(({ data }) => {
      const v = data?.value as { cod_enabled?: boolean } | null;
      if (v && typeof v.cod_enabled === "boolean") {
        setCodEnabled(v.cod_enabled);
        if (!v.cod_enabled) setPaymentMethod("stripe");
      }
    });
  }, []);

  const activeTier = useMemo(() => pickTier(tiers, subtotal), [tiers, subtotal]);
  const shipping = shippingMethod === "collect" || subtotal === 0 ? 0 : activeTier.price;
  const discount = applied?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const applyCoupon = async () => {
    if (!coupon) return;
    const { data: rows } = await supabase.rpc("validate_coupon", { _code: coupon.toUpperCase() });
    const data = Array.isArray(rows) ? rows[0] : null;
    if (!data) { toast.error("Invalid coupon"); return; }
    if (Number(data.min_order) > subtotal) { toast.error(`Min order £${data.min_order}`); return; }
    const d = data.discount_type === "percent" ? subtotal * (Number(data.discount_value) / 100) : Number(data.discount_value);
    setApplied({ code: data.code, discount: d });
    toast.success("Coupon applied");
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setBusy(true);

    // Pre-flight stock check — aggregate quantities per product (variants share product stock).
    const qtyByProduct = new Map<string, number>();
    for (const i of items) qtyByProduct.set(i.productId, (qtyByProduct.get(i.productId) ?? 0) + i.quantity);
    const checkPayload = Array.from(qtyByProduct.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));
    const { data: shortRows, error: stockErr } = await supabase.rpc("check_stock_availability", { _items: checkPayload });
    if (stockErr) { setBusy(false); toast.error(stockErr.message); return; }
    if (Array.isArray(shortRows) && shortRows.length > 0) {
      const r = shortRows[0] as { name: string; available: number; requested: number };
      setBusy(false);
      toast.error(
        r.available <= 0
          ? `Sorry, ${r.name} is out of stock.`
          : `Sorry, ${r.name} is no longer available in this quantity (only ${r.available} left).`
      );
      return;
    }

    const accessToken = crypto.randomUUID();
    const orderNumber = "YRS-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const orderClient = createScopedSupabase({ "x-order-access-token": accessToken, "x-order-number": orderNumber });
    const { data: authData } = await supabase.auth.getSession();
    if (authData.session) {
      await orderClient.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      });
    }
    const { data: order, error } = await orderClient.from("orders").insert({
      user_id: user?.id ?? null,
      access_token: accessToken,
      order_number: orderNumber,
      email: form.email,
      status: "pending",
      payment_method: paymentMethod,
      payment_status: paymentMethod === "cod" ? "cod_pending" : "pending",
      fulfillment_status: paymentMethod === "cod" ? "confirmed" : "pending",
      subtotal, discount, shipping, total,
      coupon_code: applied?.code ?? null,
      shipping_address: { full_name: form.full_name, phone: form.phone, line1: form.line1, city: form.city, postcode: form.postcode, country: form.country, shipping_method: shippingMethod },
      tracking_number: "TRK" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    }).select("id,order_number,access_token").single();
    if (error || !order) { setBusy(false); toast.error(error?.message ?? "Failed to place order"); return; }
    const productIds = Array.from(new Set(items.map(i => i.productId)));
    const { data: existingProducts } = await supabase.from("products").select("id").in("id", productIds);
    const validIds = new Set((existingProducts ?? []).map(p => p.id));
    const { error: itemsErr } = await orderClient.from("order_items").insert(
      items.map(i => ({ order_id: order.id, product_id: validIds.has(i.productId) ? i.productId : null, variant_id: i.variantId ?? null, name: i.name, price: i.price, quantity: i.quantity, image_url: i.image }))
    );
    if (itemsErr) { setBusy(false); toast.error(itemsErr.message); return; }

    if (paymentMethod === "cod") {
      // Notify admin + customer
      await supabase.functions.invoke("send-order-email", { body: { order_id: order.id, kind: "placed" } }).catch(() => {});
      clearCart();
      toast.success("Order placed! Pay on delivery.");
      window.location.href = `/track?order=${order.order_number}&token=${order.access_token}&cod=1`;
      return;
    }

    const stripeItems = items.filter(i => validIds.has(i.productId)).map(i => ({ product_id: i.productId, variant_id: i.variantId ?? null, quantity: i.quantity }));
    if (stripeItems.length === 0) {
      setBusy(false);
      toast.error("Your cart contains items that are no longer available. Please remove them and try again.");
      return;
    }
    const { data: sess, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
      body: {
        order_id: order.id,
        customer_email: form.email,
        items: stripeItems,
        shipping_fee: shipping,
        shipping_label: shippingMethod === "collect" ? "Collect from Shop" : "Delivery (Royal Mail / EVRi)",
        discount_amount: discount,
        coupon_code: applied?.code ?? null,
        success_url: `${window.location.origin}/track?order=${order.order_number}&token=${order.access_token}&paid=1`,
        cancel_url: `${window.location.origin}/cart`,
      },
    });
    if (fnErr || !sess?.url) { setBusy(false); toast.error(fnErr?.message ?? "Could not start payment"); return; }
    // Do NOT clear cart here — cart clears only after Stripe webhook confirms payment_status='paid' (see /track success page).
    window.location.href = sess.url;
  };

  return (
    <SiteLayout>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-8"><h1 className="text-3xl md:text-4xl font-black tracking-tight">Checkout</h1></div>
      </section>
      <form onSubmit={placeOrder} className="container-page py-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_380px] gap-8">
        <div className="space-y-6 min-w-0">

          <div className="rounded-lg border border-border p-5 bg-card">
            <div className="font-bold uppercase text-xs tracking-widest mb-4">Contact</div>
            <input required type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full rounded-md border border-input px-3 py-2.5 text-sm" />
          </div>
          <div className="rounded-lg border border-border p-5 bg-card space-y-3">
            <div className="font-bold uppercase text-xs tracking-widest">Shipping address</div>
            <input required placeholder="Full name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="w-full rounded-md border border-input px-3 py-2.5 text-sm" />
            <input required placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full rounded-md border border-input px-3 py-2.5 text-sm" />
            <input required placeholder="Address" value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} className="w-full rounded-md border border-input px-3 py-2.5 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="rounded-md border border-input px-3 py-2.5 text-sm" />
              <input required placeholder="Postcode" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} className="rounded-md border border-input px-3 py-2.5 text-sm" />
            </div>
          </div>
          <div className="rounded-lg border border-border p-5 bg-card space-y-3">
            <div className="font-bold uppercase text-xs tracking-widest">Shipping method</div>
            <label className={"flex items-start justify-between gap-3 rounded-md border p-3 cursor-pointer " + (shippingMethod === "delivery" ? "border-primary bg-primary/5" : "border-border")}>
              <div className="flex items-start gap-3">
                <input type="radio" name="ship" checked={shippingMethod === "delivery"} onChange={() => setShippingMethod("delivery")} className="mt-1" />
                <div>
                  <div className="text-sm font-bold">Delivery (Royal Mail / EVRi)</div>
                  <div className="text-xs text-muted-foreground">{activeTier.label}</div>
                </div>
              </div>
              <div className="text-sm font-bold">{activeTier.price === 0 ? "Free" : gbp(activeTier.price)}</div>
            </label>
            <label className={"flex items-start justify-between gap-3 rounded-md border p-3 cursor-pointer " + (shippingMethod === "collect" ? "border-primary bg-primary/5" : "border-border")}>
              <div className="flex items-start gap-3">
                <input type="radio" name="ship" checked={shippingMethod === "collect"} onChange={() => setShippingMethod("collect")} className="mt-1" />
                <div>
                  <div className="text-sm font-bold">Collect from Shop</div>
                  <div className="text-xs text-muted-foreground">Ready for pickup — we'll notify you</div>
                </div>
              </div>
              <div className="text-sm font-bold">Free</div>
            </label>
          </div>
          <div className="rounded-lg border border-border p-5 bg-card space-y-3">
            <div className="font-bold uppercase text-xs tracking-widest">Payment method</div>
            <label className={"flex items-start justify-between gap-3 rounded-md border p-3 cursor-pointer " + (paymentMethod === "stripe" ? "border-primary bg-primary/5" : "border-border")}>
              <div className="flex items-start gap-3">
                <input type="radio" name="pay" checked={paymentMethod === "stripe"} onChange={() => setPaymentMethod("stripe")} className="mt-1" />
                <div>
                  <div className="text-sm font-bold">Card (Stripe)</div>
                  <div className="text-xs text-muted-foreground">Secure card payment — you'll be redirected to Stripe.</div>
                </div>
              </div>
            </label>
            {codEnabled && (
            <label className={"flex items-start justify-between gap-3 rounded-md border p-3 cursor-pointer " + (paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border")}>
              <div className="flex items-start gap-3">
                <input type="radio" name="pay" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="mt-1" />
                <div>
                  <div className="text-sm font-bold">Cash on Delivery</div>
                  <div className="text-xs text-muted-foreground">Pay the courier in cash when your order arrives.</div>
                </div>
              </div>
            </label>
            )}
          </div>
        </div>
        <aside className="h-fit rounded-lg border border-border p-5 bg-card">
          <div className="font-bold uppercase text-xs tracking-widest mb-4">Order summary</div>
          <ul className="divide-y divide-border">
            {items.map(i => (
              <li key={cartLineId(i)} className="py-2 flex items-center gap-3 text-sm">
                <div className="h-10 w-10 rounded bg-secondary shrink-0"><img src={i.image} alt="" className="h-full w-full object-contain p-1" /></div>
                <div className="flex-1 min-w-0 truncate">{i.name} × {i.quantity}</div>
                <div className="font-semibold">{gbp(i.price * i.quantity)}</div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="Coupon code" className="flex-1 rounded-md border border-input px-3 py-2 text-sm" />
            <button type="button" onClick={applyCoupon} className="rounded-md border border-input px-3 py-2 text-sm font-bold">Apply</button>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{gbp(subtotal)}</span></div>
            {applied && <div className="flex justify-between text-primary"><span>Discount ({applied.code})</span><span>−{gbp(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">{shippingMethod === "collect" ? "Collect from Shop" : "Delivery"}</span><span>{shipping === 0 ? "Free" : gbp(shipping)}</span></div>
            <div className="flex justify-between text-base font-black pt-3 border-t border-border mt-3"><span>Total</span><span>{gbp(total)}</span></div>
          </div>
          <button disabled={busy || items.length === 0} className="mt-5 w-full rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50">
            {busy ? "Placing order…" : paymentMethod === "cod" ? `Place order — Pay ${gbp(total)} on delivery` : `Pay ${gbp(total)}`}
          </button>
        </aside>
      </form>
    </SiteLayout>
  );
}
