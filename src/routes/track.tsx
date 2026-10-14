import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { gbp } from "@/lib/format";
import { createScopedSupabase } from "@/lib/supabaseScoped";
import { Check } from "lucide-react";

type S = { order?: string; paid?: string; cod?: string; token?: string };
export const Route = createFileRoute("/track")({
  validateSearch: (s: Record<string, unknown>): S => ({
    order: typeof s.order === "string" ? s.order : undefined,
    paid: typeof s.paid === "string" ? s.paid : undefined,
    cod: typeof s.cod === "string" ? s.cod : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Track Order — Yours" }, { name: "robots", content: "noindex" }] }),
  component: Track,
});

type Order = {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  tracking_number: string | null;
  created_at: string;
  email: string;
  payment_method?: string;
  items: { name: string; quantity: number; price: number | string; image_url: string | null }[];
};

type Event = { id: string; status: string; note: string | null; created_at: string };

const STEP_LABELS: Record<string, string> = {
  placed: "Order Placed",
  pending: "Order Placed",
  paid: "Payment Confirmed",
  processing: "Processing Order",
  ready_to_ship: "Ready to Ship",
  handed_to_courier: "Handed to Courier",
  shipped: "Handed to Courier",
  delivered: "Order Delivered",
  cancelled: "Order Cancelled",
  refunded: "Order Refunded",
};

function fmtDT(iso: string) {
  const d = new Date(iso);
  return { date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
}

function Track() {
  const { order: orderNumber, paid, cod, token } = useSearch({ from: "/track" });
  const { user, loading } = useAuth();
  const { clear: clearCart } = useCart();
  const nav = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const clearedRef = useRef(false);
  const canTrack = Boolean(user || token);

  useEffect(() => {
    if (!loading && !user && !token) nav({ to: "/auth" });
  }, [loading, user, token, nav]);

  useEffect(() => {
    if (!canTrack || !orderNumber) return;
    let cancelled = false;
    const load = async () => {
      const client = token ? createScopedSupabase({ "x-order-access-token": token, "x-order-number": (orderNumber ?? "").trim() }) : supabase;
      const { data, error } = await client
        .from("orders")
        .select("id,order_number,status,payment_status,payment_method,total,tracking_number,created_at,email,items:order_items(name,quantity,price,image_url)")
        .eq("order_number", orderNumber.trim())
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { setErr("Order not found."); setBusy(false); return; }
      setOrder(data as unknown as Order);
      const paymentStatus = (data as { payment_status?: string }).payment_status;
      const paymentMethod = (data as { payment_method?: string }).payment_method;
      const shouldClearForStripe = paid === "1" && paymentStatus === "paid";
      const shouldClearForCod = cod === "1" && paymentMethod === "cod" && paymentStatus === "cod_pending";
      if ((shouldClearForStripe || shouldClearForCod) && !clearedRef.current) {
        clearedRef.current = true;
        clearCart();
      }
      const sb = client as unknown as { from: (t: string) => any };
      const { data: ev } = await sb.from("order_status_events").select("id,status,note,created_at").eq("order_id", data.id).order("created_at", { ascending: false });
      if (cancelled) return;
      setEvents((ev ?? []) as Event[]);
      setBusy(false);
      return (data as { payment_status?: string }).payment_status;
    };
    (async () => {
      setBusy(true); setErr(null);
      let status = await load();
      // If we arrived from Stripe success but the webhook hasn't marked it paid yet, poll briefly.
      if (paid === "1" && status !== "paid") {
        for (let i = 0; i < 6 && status !== "paid" && !cancelled; i++) {
          await new Promise(r => setTimeout(r, 1500));
          status = await load();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [canTrack, orderNumber, paid, cod, token, clearCart]);

  if ((loading && !token) || !canTrack) return <SiteLayout><div className="container-page py-20 text-center text-muted-foreground">Loading…</div></SiteLayout>;

  if (!orderNumber) {
    return (
      <SiteLayout>
        <div className="container-page py-20 text-center">
          <h1 className="text-2xl font-black">No order selected</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose an order from your account to track it.</p>
          <Link to="/orders" className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground">My orders</Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-6 text-xs text-muted-foreground flex items-center gap-2">
          <Link to="/orders" className="hover:text-primary">Orders</Link>
          <span>›</span>
          <span className="text-foreground font-semibold">Track Order</span>
        </div>
      </section>
      <div className="container-page py-8 space-y-6 max-w-4xl">
        {busy ? (
          <div className="rounded-lg border border-border p-10 text-center text-muted-foreground bg-card">Loading…</div>
        ) : err || !order ? (
          <div className="rounded-lg border border-border p-10 text-center bg-card">
            <div className="font-bold">{err ?? "Order not found."}</div>
            <Link to="/orders" className="mt-4 inline-block text-primary underline text-sm">Back to My Orders</Link>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between flex-wrap gap-3 pb-4 border-b border-border">
                <div>
                  <h1 className="text-xl font-black tracking-tight">Track Order</h1>
                  <div className="text-xs text-muted-foreground mt-1">Order ID: <span className="font-mono text-foreground">{order.order_number}</span></div>
                </div>
                {order.tracking_number && (
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Tracking</div>
                    <div className="font-mono text-sm">{order.tracking_number}</div>
                  </div>
                )}
              </div>
              <ol className="mt-5 relative">
                {events.length === 0 ? (
                  <li className="text-sm text-muted-foreground py-4">No status updates yet.</li>
                ) : events.map((e, i) => {
                  const { date, time } = fmtDT(e.created_at);
                  const isLast = i === events.length - 1;
                  return (
                    <li key={e.id} className="grid grid-cols-[110px_auto_1fr] gap-4 pb-6 relative">
                      <div className="text-xs text-muted-foreground pt-1 leading-tight">
                        <div className="font-semibold text-foreground">{date}</div>
                        <div>{time}</div>
                      </div>
                      <div className="relative">
                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </div>
                        {!isLast && <div className="absolute left-1/2 top-6 -translate-x-1/2 w-px h-full bg-border" />}
                      </div>
                      <div className="pt-0.5">
                        <div className="font-bold text-sm">{STEP_LABELS[e.status] ?? e.status}</div>
                        {e.note && <div className="text-sm text-muted-foreground mt-0.5">{e.note}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-black tracking-tight mb-4">Order Items</h2>
              <ul className="divide-y divide-border">
                {order.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-4 py-3">
                    <div className="h-16 w-16 rounded bg-secondary shrink-0 overflow-hidden">
                      <img src={it.image_url ?? "/images/cassette.jpg"} alt="" className="h-full w-full object-contain p-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm line-clamp-2">{it.name}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">Qty: {it.quantity}</div>
                    <div className="font-bold text-sm w-20 text-right">{gbp(Number(it.price) * it.quantity)}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Subtotal ({order.items.reduce((n, i) => n + i.quantity, 0)} item{order.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"})</div>
                <div className="font-black">{gbp(order.total)}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
