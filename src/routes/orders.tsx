import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { gbp } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My Account — Yours" }] }),
  component: MyAccount,
});

type Order = { id: string; order_number: string; status: string; payment_status?: string | null; total: number | string; created_at: string };
type Booking = { id: string; booking_number: string; service_type: string; scheduled_date: string; scheduled_time: string; status: string; price: number | string };

function MyAccount() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refundOrder, setRefundOrder] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [o, b] = await Promise.all([
        supabase.from("orders").select("id,order_number,status,payment_status,total,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("service_bookings").select("id,booking_number,service_type,scheduled_date,scheduled_time,status,price").eq("user_id", user.id).order("scheduled_date", { ascending: false }),
      ]);
      setOrders(o.data ?? []); setBookings(b.data ?? []);
    })();
  }, [user]);

  const requestRefund = async () => {
    if (!refundOrder || !user) return;
    const { error } = await supabase.from("refund_requests").insert({ order_id: refundOrder, user_id: user.id, reason });
    if (error) { toast.error(error.message); return; }
    toast.success("Refund request submitted");
    setRefundOrder(null); setReason("");
  };

  if (loading || !user) return <SiteLayout><div className="container-page py-20 text-center text-muted-foreground">Loading…</div></SiteLayout>;

  const statusInfo = (o: Order): { label: string; cls: string } => {
    const ps = (o.payment_status ?? "").toLowerCase();
    const s = (o.status ?? "").toLowerCase();
    if (ps === "canceled" || s === "cancelled" || s === "canceled") return { label: "Canceled", cls: "bg-destructive/10 text-destructive" };
    if (ps === "refunded" || s === "refunded") return { label: "Refunded", cls: "bg-muted text-muted-foreground" };
    if (ps === "paid" || ["paid","processing","shipped","delivered"].includes(s)) return { label: s === "paid" || ps === "paid" ? "Order Placed" : s.charAt(0).toUpperCase()+s.slice(1), cls: "bg-primary/10 text-primary" };
    return { label: "Pending", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" };
  };

  return (
    <SiteLayout>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-8"><h1 className="text-3xl md:text-4xl font-black tracking-tight">My Account</h1><div className="text-sm text-muted-foreground mt-1">{user.email}</div></div>
      </section>
      <div className="container-page py-10 space-y-10">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide mb-4">Orders</h2>
          {orders.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">No orders yet. <Link to="/products" className="text-primary underline">Start shopping</Link></div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
                  <tr><th className="text-left p-3">Order</th><th className="text-left p-3">Date</th><th className="text-left p-3">Status</th><th className="text-right p-3">Total</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-t border-border hover:bg-secondary/40 cursor-pointer" onClick={() => nav({ to: "/track", search: { order: o.order_number } as never })}>
                      <td className="p-3 font-mono"><Link to="/track" search={{ order: o.order_number } as never} className="text-primary hover:underline" onClick={e => e.stopPropagation()}>{o.order_number}</Link></td>
                      <td className="p-3">{new Date(o.created_at).toLocaleDateString("en-GB")}</td>
                      <td className="p-3">{(() => { const si = statusInfo(o); return <span className={`rounded-sm px-2 py-0.5 text-xs font-bold uppercase ${si.cls}`}>{si.label}</span>; })()}</td>
                      <td className="p-3 text-right font-bold">{gbp(o.total)}</td>
                      <td className="p-3 text-right space-x-3" onClick={e => e.stopPropagation()}>
                        <Link to="/track" search={{ order: o.order_number } as never} className="text-xs font-bold uppercase text-primary hover:underline">Track</Link>
                        <button onClick={() => setRefundOrder(o.id)} className="text-xs font-bold uppercase text-muted-foreground hover:text-primary">Refund</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide mb-4">Service Bookings</h2>
          {bookings.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">No bookings yet. <Link to="/services" className="text-primary underline">Book a mechanic</Link></div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
                  <tr><th className="text-left p-3">Booking</th><th className="text-left p-3">Service</th><th className="text-left p-3">When</th><th className="text-left p-3">Status</th><th className="text-right p-3">Price</th></tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-3 font-mono">{b.booking_number}</td>
                      <td className="p-3 capitalize">{b.service_type}</td>
                      <td className="p-3">{b.scheduled_date} at {b.scheduled_time}</td>
                      <td className="p-3"><span className="rounded-sm bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold uppercase">{b.status}</span></td>
                      <td className="p-3 text-right font-bold">{gbp(b.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {refundOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setRefundOrder(null)}>
          <div className="bg-card rounded-lg p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-lg">Request refund</div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason…" rows={4} className="mt-3 w-full rounded-md border border-input px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setRefundOrder(null)} className="rounded-md border border-input px-4 py-2 text-sm font-bold">Cancel</button>
              <button onClick={requestRefund} disabled={!reason} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Submit</button>
            </div>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
