import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SeoAdmin } from "@/components/admin/SeoAdmin";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { gbp } from "@/lib/format";
import { toast } from "sonner";
import {
  Package,
  Layers,
  Tag,
  Ticket,
  Image as ImageIcon,
  ShoppingBag,
  Wrench,
  RotateCcw,
  Star,
  Mail,
  Users,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  ExternalLink,
  Plus,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Search,
} from "lucide-react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/servicePackages";
import { ServiceTypesManager } from "@/components/admin/ServiceTypesManager";
import { AboutBusinessAdmin } from "@/components/admin/AboutBusinessAdmin";
import { normalizeCustomValues, normalizeServiceTypes, type ServiceType } from "@/lib/serviceTypes";

import type { Json } from "@/integrations/supabase/types";

const TAB_KEYS = [
  "dashboard",
  "products",
  "categories",
  "menus",
  "brands",
  "coupons",
  "banners",
  "orders",
  "bookings",
  "service-types",
  "refunds",
  "reviews",
  "newsletter",
  "roles",
  "about",
  "blog",
  "settings",
] as const;
type Tab = (typeof TAB_KEYS)[number];

/** Tabs a "staff" role may open. Admin-only areas (roles, settings, …) are also blocked server-side by RLS. */
const STAFF_TABS: Tab[] = ["dashboard", "products", "orders"];

export const Route = createFileRoute("/admin")({
  validateSearch: (s: Record<string, unknown>): { tab: Tab } => {
    const t =
      typeof s.tab === "string" && (TAB_KEYS as readonly string[]).includes(s.tab)
        ? (s.tab as Tab)
        : "dashboard";
    return { tab: t };
  },
  head: () => ({
    meta: [{ title: "Admin — Yours" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Admin,
});

type TabItem = { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV_GROUPS: { title: string; items: TabItem[] }[] = [
  { title: "Dashboard", items: [{ key: "dashboard", label: "Dashboard", icon: Layers }] },
  {
    title: "Order management",
    items: [
      { key: "orders", label: "Orders", icon: ShoppingBag },
      { key: "bookings", label: "Bookings", icon: Wrench },
      { key: "service-types", label: "Service Types", icon: Layers },
      { key: "refunds", label: "Refunds", icon: RotateCcw },
    ],
  },
  {
    title: "Item management",
    items: [
      { key: "products", label: "Products", icon: Package },
      { key: "categories", label: "Categories", icon: Tag },
      { key: "menus", label: "Menus", icon: Menu },
      { key: "brands", label: "Brands", icon: Tag },
    ],
  },
  {
    title: "Marketing",
    items: [
      { key: "coupons", label: "Coupons", icon: Ticket },
      { key: "banners", label: "Banners", icon: ImageIcon },
      { key: "newsletter", label: "Newsletter", icon: Mail },
      { key: "blog", label: "Blog", icon: FileText },
    ],
  },
  {
    title: "Team management",
    items: [
      { key: "roles", label: "Staff Roles", icon: Users },
      { key: "about", label: "About Our Business", icon: Users },
    ],
  },
  {
    title: "Reports & config",
    items: [
      { key: "reviews", label: "Reviews", icon: Star },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const TABS: TabItem[] = NAV_GROUPS.flatMap((g) => g.items);

function Admin() {
  const { user, isAdmin, role, loading, serviceScope } = useAuth();
  const nav = useNavigate();
  const { tab } = Route.useSearch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pickTab = (k: Tab) => {
    nav({ to: "/admin", search: { tab: k } });
    setMobileOpen(false);
  };

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!loading && serviceScope && tab !== "bookings")
      nav({ to: "/admin", search: { tab: "bookings" } });
  }, [loading, serviceScope, tab, nav]);

  if (loading || !user)
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm">Loading…</div>
    );

  if (!isAdmin)
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-black">Not authorised</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need an admin or staff role to access this page.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    );

  const allowedTabs: Tab[] = serviceScope ? ["bookings"] : STAFF_TABS;
  const visibleTabs = role === "admin" ? TABS : TABS.filter((t) => allowedTabs.includes(t.key));
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: role === "admin" ? g.items : g.items.filter((i) => allowedTabs.includes(i.key)),
  })).filter((g) => g.items.length > 0);
  const canView = role === "admin" || allowedTabs.includes(tab);

  const current = visibleTabs.find((t) => t.key === tab);

  const navList = (onPick?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {visibleGroups.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            {g.title}
          </div>
          <div className="space-y-0.5">
            {g.items.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  pickTab(t.key);
                  onPick?.();
                }}
                className={
                  "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition " +
                  (tab === t.key
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white")
                }
              >
                <t.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const CORE_TABS: Tab[] =
    role === "admin" ? ["dashboard", "products", "orders", "bookings", "settings"] : STAFF_TABS;

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Mobile bottom nav (primary) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${CORE_TABS.length + 1}, minmax(0, 1fr))` }}
        >
          {CORE_TABS.map((k) => {
            const t = TABS.find((x) => x.key === k)!;
            const active = tab === k;
            return (
              <li key={k}>
                <button
                  onClick={() => pickTab(k)}
                  className={
                    "w-full flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold " +
                    (active ? "text-primary" : "text-muted-foreground")
                  }
                >
                  <t.icon className="h-5 w-5" />
                  <span>{t.label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setMobileOpen(true)}
              className="w-full flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-ink sticky top-0 h-screen">
        <div className="h-16 flex items-center px-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-black">
            Y
          </span>
          <span className="ml-2.5 text-sm font-black tracking-widest uppercase text-white">
            Yours Admin
          </span>
        </div>
        {navList()}
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View storefront
          </Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white text-left"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="relative w-64 bg-ink flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 flex items-center justify-between px-5">
              <span className="text-sm font-black tracking-widest uppercase text-white">
                Yours Admin
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList(() => setMobileOpen(false))}
            <div className="p-3 border-t border-white/10 space-y-1">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View storefront
              </Link>
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white text-left"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 sticky top-0 z-30 bg-card border-b border-border flex items-center px-4 gap-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-bold uppercase tracking-widest">{current?.label}</div>
          <div className="ml-auto text-xs text-muted-foreground truncate max-w-[40vw]">
            {user.email}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0 overflow-x-hidden pb-24 lg:pb-8">
          {!canView ? (
            <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
              <h1 className="mt-3 text-xl font-black">Restricted area</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your staff account doesn't have access to this section. Ask an admin if you need it.
              </p>
              <button
                onClick={() => pickTab("dashboard")}
                className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground"
              >
                Back to dashboard
              </button>
            </div>
          ) : (
            <>
              {tab === "dashboard" && <Dashboard />}
              {tab === "products" && <ProductsAdmin />}
              {tab === "categories" && (
                <SimpleCRUD
                  table="categories"
                  fields={[
                    ["name", "text"],
                    ["slug", "text"],
                    ["sort_order", "number"],
                    ["image_url", "text"],
                    ["image_alt", "text"],
                    ["seo_title", "text"],
                    ["seo_description", "text"],
                    ["seo_keywords", "text"],
                    ["active", "bool"],
                  ]}
                />
              )}
              {tab === "menus" && <MenusAdmin />}
              {tab === "brands" && (
                <SimpleCRUD
                  table="brands"
                  fields={[
                    ["name", "text"],
                    ["slug", "text"],
                    ["logo_url", "text"],
                    ["active", "bool"],
                  ]}
                />
              )}
              {tab === "coupons" && <CouponsAdmin />}
              {tab === "banners" && (
                <SimpleCRUD
                  table="banners"
                  fields={[
                    ["title", "text"],
                    ["subtitle", "text"],
                    ["image_url", "text"],
                    ["cta_text", "text"],
                    ["cta_link", "text"],
                    ["position", "text"],
                    ["sort_order", "number"],
                    ["active", "bool"],
                  ]}
                />
              )}
              {tab === "orders" && <OrdersAdmin />}
              {tab === "bookings" && <BookingsAdmin />}
              {tab === "service-types" && <ServiceTypesManager />}
              {tab === "refunds" && <RefundsAdmin />}
              {tab === "reviews" && <ReviewsAdmin />}
              {tab === "newsletter" && <NewsletterAdmin />}
              {tab === "roles" && <RolesAdmin />}
              {tab === "about" && <AboutBusinessAdmin />}
              {tab === "blog" && (
                <SimpleCRUD
                  table="blog_posts"
                  fields={[
                    ["title", "text"],
                    ["slug", "text"],
                    ["excerpt", "text"],
                    ["body", "text"],
                    ["cover_url", "text"],
                    ["seo_title", "text"],
                    ["seo_description", "text"],
                    ["seo_keywords", "text"],
                    ["published", "bool"],
                  ]}
                />
              )}
              {tab === "settings" && <SettingsAdmin />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  total: number;
  fulfillment_status: string;
  payment_status: string;
  created_at: string;
};
type LowStock = { id: string; name: string; stock: number; slug: string };
type TopProduct = {
  product_id: string;
  name: string;
  qty: number;
  revenue: number;
  image_url?: string | null;
};

type Tone = "green" | "mint" | "amber" | "rose" | "sky" | "violet" | "slate";
const TONE: Record<Tone, string> = {
  green: "bg-primary/10 text-primary",
  mint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-muted text-muted-foreground",
};

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 text-xs font-bold " +
        (up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
      }
    >
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(Math.round(value))}%
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string | number;
  tone: Tone;
  sub?: ReactNode;
}) {
  return (
    <div className={"rounded-2xl p-4 " + TONE[tone]}>
      <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">{label}</div>
      <div className="mt-1.5 text-xl md:text-2xl font-black text-foreground">{value}</div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

function Dashboard() {
  const [range, setRange] = useState<7 | 30>(30);
  const [stats, setStats] = useState({
    products: 0,
    orders: 0,
    revenue: 0,
    bookings: 0,
    subscribers: 0,
    inStock: 0,
    outOfStock: 0,
    refunded: 0,
  });
  const [flow, setFlow] = useState({ pending: 0, processing: 0, ready: 0, delivered: 0 });
  const [series, setSeries] = useState<
    { date: string; revenue: number; orders: number; aov: number }[]
  >([]);
  const [prev, setPrev] = useState({ revenue: 0, orders: 0 });
  const [recent, setRecent] = useState<OrderRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    (async () => {
      const day = 24 * 60 * 60 * 1000;
      const since = new Date(Date.now() - range * day).toISOString();
      const prevSince = new Date(Date.now() - range * 2 * day).toISOString();
      const [p, oAll, b, n, oWindow, rec, low, items, prods, fstat] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total", { count: "exact" }).eq("payment_status", "paid"),
        supabase.from("service_bookings").select("id", { count: "exact", head: true }),
        supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("total,created_at,payment_status")
          .gte("created_at", prevSince)
          .eq("payment_status", "paid"),
        supabase
          .from("orders")
          .select("id,order_number,email,total,fulfillment_status,payment_status,created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("products")
          .select("id,name,slug,stock")
          .lte("stock", 5)
          .order("stock", { ascending: true })
          .limit(8),
        supabase
          .from("order_items")
          .select(
            "product_id,name,quantity,price,image_url,order:orders!inner(payment_status,created_at)",
          )
          .eq("orders.payment_status", "paid")
          .gte("orders.created_at", since)
          .limit(500),
        supabase.from("products").select("stock"),
        supabase.from("orders").select("fulfillment_status,payment_status"),
      ]);

      const revenue = (oAll.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const stockRows = (prods.data ?? []) as { stock: number | null }[];
      const inStock = stockRows.reduce((s, r) => s + Math.max(0, Number(r.stock ?? 0)), 0);
      const outOfStock = stockRows.filter((r) => Number(r.stock ?? 0) <= 0).length;

      const fRows = (fstat.data ?? []) as { fulfillment_status: string; payment_status: string }[];
      const countF = (...v: string[]) =>
        fRows.filter((r) => v.includes((r.fulfillment_status ?? "").toLowerCase())).length;
      setFlow({
        pending: fRows.filter((r) =>
          ["pending", "cod_pending"].includes((r.payment_status ?? "").toLowerCase()),
        ).length,
        processing: countF("processing", "confirmed"),
        ready: countF("ready", "packed", "shipped"),
        delivered: countF("delivered", "completed"),
      });
      const refunded = fRows.filter(
        (r) =>
          ["refunded"].includes((r.payment_status ?? "").toLowerCase()) ||
          ["refunded"].includes((r.fulfillment_status ?? "").toLowerCase()),
      ).length;

      setStats({
        products: p.count ?? 0,
        orders: oAll.count ?? 0,
        revenue,
        bookings: b.count ?? 0,
        subscribers: n.count ?? 0,
        inStock,
        outOfStock,
        refunded,
      });

      // Current window daily buckets + previous window totals
      const buckets = new Map<string, { revenue: number; orders: number }>();
      for (let i = range - 1; i >= 0; i--) {
        buckets.set(new Date(Date.now() - i * day).toISOString().slice(0, 10), {
          revenue: 0,
          orders: 0,
        });
      }
      let prevRev = 0,
        prevOrd = 0;
      const cutoff = Date.now() - range * day;
      for (const r of oWindow.data ?? []) {
        const t = new Date(String(r.created_at)).getTime();
        if (t < cutoff) {
          prevRev += Number(r.total);
          prevOrd += 1;
          continue;
        }
        const cur = buckets.get(String(r.created_at).slice(0, 10));
        if (cur) {
          cur.revenue += Number(r.total);
          cur.orders += 1;
        }
      }
      setPrev({ revenue: prevRev, orders: prevOrd });
      setSeries(
        Array.from(buckets.entries()).map(([date, v]) => ({
          date: date.slice(5),
          revenue: Math.round(v.revenue * 100) / 100,
          orders: v.orders,
          aov: v.orders ? Math.round((v.revenue / v.orders) * 100) / 100 : 0,
        })),
      );

      setRecent((rec.data ?? []) as OrderRow[]);
      setLowStock((low.data ?? []) as LowStock[]);

      const agg = new Map<string, TopProduct>();
      for (const it of (items.data ?? []) as {
        product_id: string;
        name: string;
        quantity: number;
        price: number;
        image_url: string | null;
      }[]) {
        if (!it.product_id) continue;
        const cur = agg.get(it.product_id) ?? {
          product_id: it.product_id,
          name: it.name,
          qty: 0,
          revenue: 0,
          image_url: it.image_url,
        };
        cur.qty += Number(it.quantity);
        cur.revenue += Number(it.quantity) * Number(it.price);
        agg.set(it.product_id, cur);
      }
      setTopProducts(
        Array.from(agg.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 6),
      );
    })();
  }, [range]);

  const windowRevenue = series.reduce((s, r) => s + r.revenue, 0);
  const windowOrders = series.reduce((s, r) => s + r.orders, 0);
  const aov = windowOrders ? windowRevenue / windowOrders : 0;
  const prevAov = prev.orders ? prev.revenue / prev.orders : 0;
  const pct = (now: number, before: number) =>
    before > 0 ? ((now - before) / before) * 100 : null;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      paid: "bg-primary/10 text-primary",
      cod_pending: "bg-amber-500/10 text-amber-600",
      pending: "bg-muted text-muted-foreground",
      placed: "bg-secondary text-foreground",
      processing: "bg-sky-500/10 text-sky-600",
      shipped: "bg-violet-500/10 text-violet-600",
      delivered: "bg-emerald-500/10 text-emerald-600",
      refunded: "bg-muted text-muted-foreground",
      canceled: "bg-destructive/10 text-destructive",
      cancelled: "bg-destructive/10 text-destructive",
    };
    return map[s] ?? "bg-secondary text-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Live figures from your store, bookings and stock.
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-full bg-secondary p-1 text-xs font-bold uppercase">
          {[7, 30].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as 7 | 30)}
              className={
                "rounded-full px-3 py-1.5 transition " +
                (range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Pastel summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          label="Total earning"
          tone="green"
          value={gbp(stats.revenue)}
          sub={<Delta value={pct(windowRevenue, prev.revenue)} />}
        />
        <StatCard
          label="Total orders"
          tone="sky"
          value={stats.orders}
          sub={<Delta value={pct(windowOrders, prev.orders)} />}
        />
        <StatCard
          label="Avg order value"
          tone="violet"
          value={gbp(aov)}
          sub={<Delta value={pct(aov, prevAov)} />}
        />
        <StatCard label="Total items" tone="mint" value={stats.products} />
        <StatCard label="In stock" tone="mint" value={stats.inStock} />
        <StatCard label="Out of stock" tone="rose" value={stats.outOfStock} />
        <StatCard label="Waiting for confirmation" tone="amber" value={flow.pending} />
        <StatCard label="Processing order" tone="sky" value={flow.processing} />
        <StatCard label="Ready for delivery" tone="violet" value={flow.ready} />
        <StatCard label="Delivered order" tone="green" value={flow.delivered} />
        <StatCard label="Bookings" tone="slate" value={stats.bookings} />
        <StatCard label="Refunded" tone="rose" value={stats.refunded} />
      </div>

      {/* Revenue trend */}
      <div className="card-admin p-4 md:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold">Total revenue</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-black">{gbp(windowRevenue)}</span>
              <Delta value={pct(windowRevenue, prev.revenue)} />
            </div>
            <div className="text-xs text-muted-foreground">
              vs {gbp(prev.revenue)} previous {range} days
            </div>
          </div>
        </div>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                formatter={(v: number) => gbp(v)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#revFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-admin p-4 md:p-5">
          <div className="text-sm font-bold">Orders trend</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-black">{windowOrders}</span>
            <Delta value={pct(windowOrders, prev.orders)} />
          </div>
          <div className="h-56 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="orders"
                  fill="var(--color-primary)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-admin p-4 md:p-5">
          <div className="text-sm font-bold">Average order value</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-black">{gbp(aov)}</span>
            <Delta value={pct(aov, prevAov)} />
          </div>
          <div className="h-56 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="aovFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  formatter={(v: number) => gbp(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="aov"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#aovFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-admin p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div className="text-sm font-bold">Low stock alerts</div>
          </div>
          {lowStock.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">All products in stock.</div>
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.map((p) => (
                <li
                  key={p.id}
                  className="py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm"
                >
                  <span className="truncate">{p.name}</span>
                  <span
                    className={
                      "badge " +
                      (p.stock === 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/10 text-amber-600")
                    }
                  >
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-admin p-4 md:p-5">
          <div className="text-sm font-bold mb-3">Top selling products</div>
          {topProducts.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">No sales in this period.</div>
          ) : (
            <ul className="divide-y divide-border">
              {topProducts.map((p) => (
                <li
                  key={p.product_id}
                  className="py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-sm"
                >
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.qty} sold · <b className="text-foreground">{gbp(p.revenue)}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card-admin overflow-hidden">
        <div className="p-4 text-sm font-bold border-b border-border">Recent orders</div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-left p-3">Fulfillment</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="p-3 font-mono">{r.order_number}</td>
                  <td className="p-3 truncate max-w-[180px]">{r.email}</td>
                  <td className="p-3">
                    <span className={"badge " + statusBadge(r.payment_status)}>
                      {r.payment_status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={"badge " + statusBadge(r.fulfillment_status)}>
                      {r.fulfillment_status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold">{gbp(r.total)}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="md:hidden divide-y divide-border">
          {recent.map((r) => (
            <li key={r.id} className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{r.order_number}</span>
                <span className="font-bold text-sm">{gbp(r.total)}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{r.email}</div>
              <div className="flex flex-wrap gap-1.5">
                <span className={"badge " + statusBadge(r.payment_status)}>{r.payment_status}</span>
                <span className={"badge " + statusBadge(r.fulfillment_status)}>
                  {r.fulfillment_status}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(r.created_at).toLocaleDateString("en-GB")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Generic CRUD ---------------- */
type Field = [string, "text" | "number" | "bool"];
function SimpleCRUD({ table, fields }: { table: string; fields: Field[] }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const sb = supabase as unknown as { from: (t: string) => any };
  const load = async () => {
    const { data } = await sb.from(table).select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Record<string, unknown>[]);
  };
  useEffect(() => {
    load();
  }, [table]);

  const save = async (row: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {};
    for (const [k] of fields) payload[k] = row[k];
    let error;
    if (row.id)
      ({ error } = await sb
        .from(table)
        .update(payload)
        .eq("id", row.id as string));
    else ({ error } = await sb.from(table).insert(payload));
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this row?")) return;
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black capitalize tracking-tight">
          {table.replace(/_/g, " ")}
        </h1>
        <button
          onClick={() =>
            setEditing(
              Object.fromEntries(
                fields.map(([k, t]) => [k, t === "bool" ? true : t === "number" ? 0 : ""]),
              ),
            )
          }
          className="rounded-md bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground"
        >
          + New
        </button>
      </div>
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              {fields.map(([k]) => (
                <th key={k} className="text-left p-3">
                  {k}
                </th>
              ))}
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id as string} className="border-t border-border">
                {fields.map(([k]) => (
                  <td key={k} className="p-3 truncate max-w-[200px]">
                    {String(r[k] ?? "")}
                  </td>
                ))}
                <td className="p-3 text-right space-x-3 whitespace-nowrap">
                  <button
                    onClick={() => setEditing(r)}
                    className="text-xs font-bold uppercase text-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(r.id as string)}
                    className="text-xs font-bold uppercase text-muted-foreground hover:text-primary"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <div className="text-lg font-bold mb-3">{editing.id ? "Edit" : "New"}</div>
          <div className="space-y-3">
            {fields.map(([k, t]) => (
              <label key={k} className="block">
                <span className="text-xs uppercase font-bold tracking-widest">{k}</span>
                {t === "bool" ? (
                  <select
                    value={String(editing[k] ?? true)}
                    onChange={(e) => setEditing({ ...editing, [k]: e.target.value === "true" })}
                    className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : t === "number" ? (
                  <input
                    type="number"
                    step="0.01"
                    value={String(editing[k] ?? "")}
                    onChange={(e) =>
                      setEditing({ ...editing, [k]: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                  />
                ) : /^(image_url|logo_url|cover_url|image|logo|photo)$/.test(k) ? (
                  <ImageUploadField
                    value={String(editing[k] ?? "")}
                    onChange={(v: string) => setEditing({ ...editing, [k]: v })}
                  />
                ) : k === "body" || k === "description" ? (
                  <textarea
                    rows={5}
                    value={String(editing[k] ?? "")}
                    onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    value={String(editing[k] ?? "")}
                    onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={() => setEditing(null)}
              className="rounded-md border border-input px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={() => save(editing)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Products (custom because of images JSON + relations) ---------------- */
function ProductsAdmin() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    const hay = [
      r.name,
      (r.brand as { name: string } | null)?.name,
      (r.category as { name: string } | null)?.name,
      r.sku,
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" ");
    return hay.includes(term);
  });

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("*,category:categories(name),brand:brands(name)")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setSelected(new Set());
  };
  useEffect(() => {
    load();
  }, []);

  const deleteImagesForRows = async (rowsToDelete: Record<string, unknown>[]) => {
    const paths: string[] = [];
    for (const r of rowsToDelete) {
      const imgs = Array.isArray(r.images) ? (r.images as string[]) : [];
      for (const url of imgs) {
        const m = /\/storage\/v1\/object\/public\/product-images\/(.+)$/.exec(url);
        if (m) paths.push(decodeURIComponent(m[1]));
      }
    }
    if (paths.length) await supabase.storage.from("product-images").remove(paths);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product? Images will be removed from storage.")) return;
    const target = rows.find((r) => r.id === id);
    if (target) await deleteImagesForRows([target]);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    load();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Delete ${selected.size} product${selected.size === 1 ? "" : "s"}? Their images will be removed from storage. This cannot be undone.`,
      )
    )
      return;
    const ids = Array.from(selected);
    const targets = rows.filter((r) => ids.includes(r.id as string));
    await deleteImagesForRows(targets);
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted ${ids.length} product${ids.length === 1 ? "" : "s"}`);
    load();
  };

  const toggleAll = () => {
    if (selected.size === rows.length && rows.length > 0) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id as string)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const goEdit = (id: string) => nav({ to: "/admin/products/$id/edit", params: { id } });
  const goNew = () => nav({ to: "/admin/products/new" });

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">Products</h1>
        <div className="flex shrink-0 items-center gap-2">
          {selected.size > 0 && (
            <button onClick={bulkDelete} className="btn btn-danger">
              Delete ({selected.size})
            </button>
          )}
          <button onClick={goNew} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New product
          </button>
        </div>
      </div>

      <div className="card-admin p-3 mb-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products by name, brand or category…"
            className="in w-full pl-9"
          />
        </label>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card-admin overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Brand</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Price</th>
              <th className="text-left p-3">Stock</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id as string} className="border-t border-border hover:bg-secondary/40">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id as string)}
                      onChange={() => toggleOne(r.id as string)}
                      aria-label="Select row"
                    />
                  </td>
                  <td className="p-3 font-semibold">{r.name as string}</td>
                  <td className="p-3 text-muted-foreground">
                    {(r.brand as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {(r.category as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="p-3 text-right font-bold">{gbp(r.price as number)}</td>
                  <td className="p-3">
                    <span
                      className={
                        "badge " +
                        ((r.stock as number) <= 0
                          ? "bg-destructive/10 text-destructive"
                          : (r.stock as number) <= 5
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-primary/10 text-primary")
                      }
                    >
                      {(r.stock as number) <= 0 ? "Out of stock" : `${r.stock as number} in stock`}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => goEdit(r.id as string)} className="btn btn-ghost">
                      Edit
                    </button>
                    <button
                      onClick={() => remove(r.id as string)}
                      className="btn btn-ghost text-destructive"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <ul className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <li className="card-admin p-6 text-center text-sm text-muted-foreground">
            No products found.
          </li>
        ) : (
          filtered.map((r) => (
            <li key={r.id as string} className="card-admin p-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(r.id as string)}
                onChange={() => toggleOne(r.id as string)}
                className="mt-1"
                aria-label="Select"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm truncate">{r.name as string}</div>
                  <div className="text-sm font-bold shrink-0">{gbp(r.price as number)}</div>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{(r.brand as { name: string } | null)?.name ?? "—"}</span>
                  <span>·</span>
                  <span>{(r.category as { name: string } | null)?.name ?? "—"}</span>
                  <span>·</span>
                  <span className={(r.stock as number) <= 5 ? "text-destructive font-bold" : ""}>
                    Stock: {r.stock as number}
                  </span>
                </div>
                <div className="mt-2 flex gap-3">
                  <button
                    onClick={() => goEdit(r.id as string)}
                    className="text-xs font-bold uppercase text-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(r.id as string)}
                    className="text-xs font-bold uppercase text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ---------------- Orders ---------------- */
function OrdersAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<{
    id: string;
    order_number: string;
    current: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [detailItems, setDetailItems] = useState<Record<string, unknown>[]>([]);
  const [detailEvents, setDetailEvents] = useState<Record<string, unknown>[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);
  const openDetails = async (r: Record<string, unknown>) => {
    setDetails(r);
    setDetailItems([]);
    setDetailEvents([]);
    const [{ data: items }, { data: events }] = await Promise.all([
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", r.id as string),
      supabase
        .from("order_status_events")
        .select("*")
        .eq("order_id", r.id as string)
        .order("created_at", { ascending: true }),
    ]);
    setDetailItems(items ?? []);
    setDetailEvents(events ?? []);
  };
  const setTracking = async (id: string, tracking_number: string) => {
    const { error } = await supabase.from("orders").update({ tracking_number }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Updated");
    load();
  };
  const submitStatus = async () => {
    if (!editing || !newStatus) return;
    const sb = supabase as unknown as { from: (t: string) => any };
    const statusChanged = newStatus !== editing.current;
    if (note.trim() || statusChanged) {
      const { error: e1 } = await sb
        .from("order_status_events")
        .insert({ order_id: editing.id, status: newStatus, note: note.trim() || null });
      if (e1) {
        toast.error(e1.message);
        return;
      }
    }
    if (statusChanged) {
      const { error: e2 } = await supabase
        .from("orders")
        .update({ fulfillment_status: newStatus })
        .eq("id", editing.id);
      if (e2) {
        toast.error(e2.message);
        return;
      }
      // Notify customer of status change (fire-and-forget)
      supabase.functions
        .invoke("send-order-email", {
          body: {
            order_id: editing.id,
            kind: "status_update",
            status: newStatus,
            note: note.trim() || null,
            site_url: window.location.origin,
          },
        })
        .catch(() => {});
    }
    toast.success("Order updated");
    setEditing(null);
    setNewStatus("");
    setNote("");
    load();
  };

  const issueRefund = async (r: Record<string, unknown>) => {
    if (
      !confirm(
        `Mark order ${r.order_number} as refunded? This will update fulfillment and payment status.`,
      )
    )
      return;
    const sb = supabase as unknown as { from: (t: string) => any };
    const { error: e1 } = await sb
      .from("order_status_events")
      .insert({ order_id: r.id, status: "refunded", note: "Refund issued by admin" });
    if (e1) {
      toast.error(e1.message);
      return;
    }
    // Insert refund_request as approved for record-keeping (best-effort)
    await sb
      .from("refund_requests")
      .insert({
        order_id: r.id,
        status: "approved",
        reason: "Admin issued refund",
        amount: r.total,
      })
      .then(
        () => {},
        () => {},
      );
    const { error: e2 } = await supabase
      .from("orders")
      .update({ fulfillment_status: "refunded" })
      .eq("id", r.id as string);
    if (e2) {
      toast.error(e2.message);
      return;
    }
    toast.success("Refund recorded");
    setDetails(null);
    load();
  };
  const STATUSES = [
    "placed",
    "processing",
    "ready_to_ship",
    "handed_to_courier",
    "delivered",
    "cancelled",
    "refunded",
  ];
  const addr = (details?.shipping_address as Record<string, unknown> | null) ?? null;
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-4">Orders</h1>

      {/* Mobile: compact rows */}
      <ul className="md:hidden space-y-2">
        {rows.length === 0 && (
          <li className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No orders.
          </li>
        )}
        {rows.map((r) => (
          <li
            key={r.id as string}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-bold">{r.order_number as string}</div>
              <div className="truncate text-xs text-muted-foreground">
                {gbp(r.total as number)} · {(r.fulfillment_status as string) ?? "placed"}
              </div>
            </div>
            <button
              onClick={() => openDetails(r)}
              className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              View details
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden md:block rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Payment</th>
              <th className="text-left p-3">Fulfillment</th>
              <th className="text-left p-3">Tracking</th>
              <th className="text-right p-3">Total</th>
              <th className="text-left p-3">Date</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id as string}
                className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                onClick={() => openDetails(r)}
              >
                <td className="p-3 font-mono">{r.order_number as string}</td>
                <td className="p-3">{r.email as string}</td>
                <td className="p-3">
                  <span
                    className={
                      "rounded-sm px-2 py-0.5 text-xs font-bold uppercase " +
                      ((r.payment_status as string) === "paid"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {(r.payment_status as string) ?? "pending"}
                  </span>
                </td>
                <td className="p-3">
                  <span className="rounded-sm bg-secondary text-foreground px-2 py-0.5 text-xs font-bold uppercase">
                    {(r.fulfillment_status as string) ?? "placed"}
                  </span>
                </td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    defaultValue={(r.tracking_number as string) ?? ""}
                    onBlur={(e) => setTracking(r.id as string, e.target.value)}
                    className="in w-32"
                  />
                </td>
                <td className="p-3 text-right font-bold">{gbp(r.total as number)}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(r.created_at as string).toLocaleDateString("en-GB")}
                </td>
                <td
                  className="p-3 text-right whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditing({
                        id: r.id as string,
                        order_number: r.order_number as string,
                        current: (r.fulfillment_status as string) ?? "placed",
                      });
                      setNewStatus((r.fulfillment_status as string) ?? "placed");
                      setNote("");
                    }}
                    className="text-xs font-bold uppercase text-primary hover:underline"
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <div className="text-lg font-bold mb-1">
            Update order <span className="font-mono">{editing.order_number}</span>
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            Adds a new event to the customer tracking timeline.
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase font-bold tracking-widest">Status</span>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase font-bold tracking-widest">
                Note for customer (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Handed to courier Alex (07700 900456)"
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={() => setEditing(null)}
              className="rounded-md border border-input px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={submitStatus}
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
      {details && (
        <Modal onClose={() => setDetails(null)}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-lg font-bold">
                Order <span className="font-mono">{details.order_number as string}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Placed {new Date(details.created_at as string).toLocaleString("en-GB")}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={
                  "rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase " +
                  ((details.payment_status as string) === "paid"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground")
                }
              >
                {(details.payment_status as string) ?? "pending"}
              </span>
              <span className="rounded-sm bg-secondary text-foreground px-2 py-0.5 text-[10px] font-bold uppercase">
                {(details.fulfillment_status as string) ?? "placed"}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">
                Customer
              </div>
              <div className="text-sm">
                <span className="font-bold">{(addr?.name as string) ?? "—"}</span>
              </div>
              <div className="text-sm">{details.email as string}</div>
              {addr?.phone ? <div className="text-sm">{addr.phone as string}</div> : null}
              {details.user_id ? (
                <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                  User: {(details.user_id as string).slice(0, 8)}…
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground mt-1">Guest checkout</div>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">
                Shipping
              </div>
              {addr ? (
                <div className="text-sm leading-relaxed">
                  {addr.line1 ? <div>{addr.line1 as string}</div> : null}
                  {addr.line2 ? <div>{addr.line2 as string}</div> : null}
                  <div>{[addr.city, addr.postcode].filter(Boolean).join(", ")}</div>
                  {addr.country ? <div>{addr.country as string}</div> : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No address</div>
              )}
              <div className="text-xs mt-2">
                <span className="text-muted-foreground">Tracking:</span>{" "}
                <span className="font-mono">{(details.tracking_number as string) || "—"}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Payment:</span>{" "}
                {(details.payment_method as string) ?? "—"}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border overflow-hidden mb-4">
            <div className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground p-2 font-bold">
              Items
            </div>
            <table className="w-full text-sm">
              <tbody>
                {detailItems.map((it) => (
                  <tr key={it.id as string} className="border-t border-border">
                    <td className="p-2">{it.name as string}</td>
                    <td className="p-2 text-center text-muted-foreground">
                      × {it.quantity as number}
                    </td>
                    <td className="p-2 text-right">{gbp(it.price as number)}</td>
                    <td className="p-2 text-right font-bold">
                      {gbp((it.price as number) * (it.quantity as number))}
                    </td>
                  </tr>
                ))}
                {detailItems.length === 0 && (
                  <tr>
                    <td className="p-3 text-xs text-muted-foreground" colSpan={4}>
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-1 text-sm max-w-xs ml-auto mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{gbp(details.subtotal as number)}</span>
            </div>
            {(details.discount as number) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount{details.coupon_code ? ` (${details.coupon_code as string})` : ""}
                </span>
                <span>−{gbp(details.discount as number)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{gbp(details.shipping as number)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
              <span>Total</span>
              <span>{gbp(details.total as number)}</span>
            </div>
          </div>

          {detailEvents.length > 0 && (
            <div className="mb-4">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">
                Timeline
              </div>
              <ol className="space-y-1 text-sm">
                {detailEvents.map((ev) => (
                  <li key={ev.id as string} className="flex gap-3">
                    <span className="text-muted-foreground text-xs w-32 shrink-0">
                      {new Date(ev.created_at as string).toLocaleString("en-GB")}
                    </span>
                    <span className="font-bold uppercase text-xs">{ev.status as string}</span>
                    {ev.note ? (
                      <span className="text-muted-foreground">— {ev.note as string}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setDetails(null)}
              className="rounded-md border border-input px-4 py-2 text-sm font-bold"
            >
              Close
            </button>
            {(details.fulfillment_status as string) !== "refunded" &&
              (details.payment_status as string) === "paid" && (
                <button
                  onClick={() => issueRefund(details)}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground"
                >
                  Issue refund
                </button>
              )}
            <button
              onClick={() => {
                const d = details;
                setDetails(null);
                setEditing({
                  id: d.id as string,
                  order_number: d.order_number as string,
                  current: (d.fulfillment_status as string) ?? "placed",
                });
                setNewStatus((d.fulfillment_status as string) ?? "placed");
                setNote("");
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Update status
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Bookings ---------------- */
const BOOKING_STATUSES = ["pending", "confirmed", "in_progress", "completed", "cancelled"];

function splitAddress(full: string) {
  const parts = (full ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    postcode: parts.length > 1 ? parts[parts.length - 1] : "—",
    street: parts.length > 1 ? parts.slice(0, -1).join(", ") : (full ?? ""),
  };
}

function BookingsAdmin() {
  const { role, serviceScope } = useAuth();
  const [subTab, setSubTab] = useState<"list" | "types">("list");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [fType, setFType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    let q = supabase
      .from("service_bookings")
      .select("*")
      .order("scheduled_date", { ascending: false });
    if (serviceScope) q = q.eq("category", serviceScope);
    const { data } = await q;
    setRows(data ?? []);
  };
  useEffect(() => {
    if (subTab === "list") load();
  }, [subTab, serviceScope]);
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "service_types")
      .maybeSingle()
      .then(({ data }) => setTypes(normalizeServiceTypes(data?.value)));
  }, []);

  const typeName = (key: string) =>
    types.find((t) => t.key === key)?.name ?? CATEGORY_LABELS[key as CategoryKey] ?? key;

  const applyStatus = async (id: string, status: string, extra: Record<string, unknown> = {}) => {
    const { error } = await supabase
      .from("service_bookings")
      .update({ status, ...extra })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status, ...extra } : r)));
    setDetail((d) => (d && d.id === id ? { ...d, status, ...extra } : d));
    supabase.functions
      .invoke("send-booking-email", { body: { booking_id: id, kind: "status_update" } })
      .then(() => toast.success(`Customer notified: ${status}`))
      .catch(() => {});
    return true;
  };

  const setStatus = async (id: string, status: string) => {
    if (status === "cancelled" || status === "canceled") {
      setCancelReason("");
      setCancelId(id);
      return;
    }
    await applyStatus(id, status);
  };

  const confirmCancel = async () => {
    if (!cancelId || !cancelReason.trim()) return;
    setCancelling(true);
    const ok = await applyStatus(cancelId, "cancelled", {
      cancellation_reason: cancelReason.trim(),
    });
    setCancelling(false);
    if (ok) {
      setCancelId(null);
      setCancelReason("");
      load();
    }
  };

  const catKeys = useMemo(
    () => Array.from(new Set(rows.map((r) => (r.category as string) ?? "cycle"))),
    [rows],
  );
  const filtered = rows.filter(
    (r) =>
      (fType === "all" || ((r.category as string) ?? "cycle") === fType) &&
      (fStatus === "all" || (r.status as string) === fStatus),
  );

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
        <h1 className="truncate text-xl sm:text-2xl font-black tracking-tight">
          {serviceScope ? `${typeName(serviceScope)} Bookings` : "Service Bookings"}
        </h1>
      </div>

      {role === "admin" && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-secondary p-1 text-xs font-bold uppercase tracking-widest w-fit max-w-full">
          <button
            onClick={() => setSubTab("list")}
            className={
              "shrink-0 rounded-full px-4 py-2 transition " +
              (subTab === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            All bookings ({rows.length})
          </button>
          <button
            onClick={() => setSubTab("types")}
            className={
              "shrink-0 rounded-full px-4 py-2 transition " +
              (subTab === "types"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Service types
          </button>
        </div>
      )}

      {role === "admin" && subTab === "types" && <ServiceTypesManager />}

      {subTab === "list" && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {!serviceScope && (
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value)}
                className="in max-w-[220px]"
              >
                <option value="all">All service types</option>
                {catKeys.map((k) => (
                  <option key={k} value={k}>
                    {typeName(k)}
                  </option>
                ))}
              </select>
            )}

            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="in max-w-[200px]"
            >
              <option value="all">All statuses</option>
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="self-center text-xs text-muted-foreground">
              {filtered.length} shown
            </span>
          </div>

          {/* Mobile: compact rows */}
          <ul className="md:hidden space-y-2">
            {filtered.length === 0 && (
              <li className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No bookings.
              </li>
            )}
            {filtered.map((r) => (
              <li
                key={r.id as string}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-bold">
                    {r.booking_number as string}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {typeName((r.category as string) ?? "")} · {r.status as string}
                  </div>
                </div>
                <button
                  onClick={() => setDetail(r)}
                  className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  View details
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-border overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left p-3">#</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Service</th>
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Address</th>
                  <th className="text-left p-3">Postcode</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      No bookings.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const { street, postcode } = splitAddress(r.address as string);
                    return (
                      <tr
                        key={r.id as string}
                        className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                        onClick={() => setDetail(r)}
                      >
                        <td className="p-3 font-mono">{r.booking_number as string}</td>
                        <td className="p-3">
                          {r.full_name as string}
                          <div className="text-xs text-muted-foreground">
                            {r.email as string} · {r.phone as string}
                          </div>
                        </td>
                        <td className="p-3">
                          {typeName((r.category as string) ?? "")} · {r.service_type as string} ·{" "}
                          {gbp(r.price as number)}
                        </td>
                        <td className="p-3">
                          {r.scheduled_date as string} at {r.scheduled_time as string}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[220px] whitespace-pre-wrap break-words">
                          {street || "—"}
                        </td>
                        <td className="p-3 text-xs font-mono font-bold uppercase">{postcode}</td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={r.status as string}
                            onChange={(e) => setStatus(r.id as string, e.target.value)}
                            className="in"
                          >
                            {BOOKING_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detail && (
        <BookingDetail
          row={detail}
          typeName={typeName}
          onClose={() => setDetail(null)}
          onStatus={setStatus}
        />
      )}

      {cancelId && (
        <Modal onClose={() => setCancelId(null)}>
          <h3 className="text-lg font-black">Cancel Booking</h3>
          <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Reason for cancellation
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={4}
            maxLength={1000}
            autoFocus
            placeholder="Let the customer know why this booking is being cancelled"
            className="in mt-2 w-full"
          />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setCancelId(null)}
              className="rounded-md border border-border px-4 py-2 text-sm font-bold"
            >
              Back
            </button>
            <button
              onClick={confirmCancel}
              disabled={!cancelReason.trim() || cancelling}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Confirm Cancellation"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function BookingDetail({
  row,
  typeName,
  onClose,
  onStatus,
}: {
  row: Record<string, unknown>;
  typeName: (k: string) => string;
  onClose: () => void;
  onStatus: (id: string, status: string) => void;
}) {
  const { street, postcode } = splitAddress(row.address as string);
  const custom = normalizeCustomValues(row.custom_fields);
  const legacy = [
    ["Registration", row.vehicle_reg as string],
    ["Brand", row.vehicle_brand as string],
    ["Model", row.vehicle_model as string],
  ].filter(([, v]) => v && !custom.some((c) => c.value === v));
  const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words">{value || "—"}</span>
    </div>
  );
  return (
    <Modal onClose={onClose}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h3 className="truncate text-lg font-black">Booking {row.booking_number as string}</h3>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-bold"
        >
          Close
        </button>
      </div>
      <div className="mt-4 divide-y divide-border">
        <Row label="Customer" value={row.full_name as string} />
        <Row label="Email" value={row.email as string} />
        <Row label="Phone" value={row.phone as string} />
        <Row label="Service type" value={typeName((row.category as string) ?? "")} />
        <Row
          label="Package"
          value={`${row.service_type as string} · ${gbp(row.price as number)}`}
        />
        <Row
          label="When"
          value={`${row.scheduled_date as string} at ${row.scheduled_time as string}`}
        />
        <Row label="Address" value={street} />
        <Row
          label="Postcode"
          value={<span className="font-mono font-bold uppercase">{postcode}</span>}
        />
        {custom.map((c) => (
          <Row key={c.id} label={c.label} value={c.value} />
        ))}
        {legacy.map(([l, v]) => (
          <Row key={l as string} label={l as string} value={v as string} />
        ))}
        <Row label="Notes" value={(row.notes as string) || "—"} />
        {(row.cancellation_reason as string) && (
          <Row label="Cancel reason" value={row.cancellation_reason as string} />
        )}

        <Row label="Payment" value={(row.payment_status as string) || "—"} />
        <Row label="Placed" value={new Date(row.created_at as string).toLocaleString()} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
          Status
        </span>
        <select
          value={row.status as string}
          onChange={(e) => onStatus(row.id as string, e.target.value)}
          className="in max-w-[200px]"
        >
          {BOOKING_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
    </Modal>
  );
}

/* ---------------- Menus (sub-categories) ---------------- */
function MenusAdmin() {
  type Cat = { id: string; name: string; slug: string };
  type Sub = {
    id: string;
    category_id: string;
    name: string;
    slug: string;
    sort_order: number;
    active: boolean;
  };
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [editing, setEditing] = useState<Partial<Sub> | null>(null);

  const load = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("categories").select("id,name,slug").order("sort_order"),
      supabase.from("sub_categories").select("*").order("sort_order"),
    ]);
    setCats((c ?? []) as Cat[]);
    setSubs((s ?? []) as Sub[]);
    if (!selectedCat && c && c[0]) setSelectedCat((c[0] as Cat).id);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = subs.filter((s) => s.category_id === selectedCat);
  const save = async () => {
    if (!editing || !editing.name || !editing.category_id) {
      toast.error("Name and category required");
      return;
    }
    const slug =
      editing.slug && editing.slug.length > 0
        ? editing.slug
        : editing.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    const payload = {
      category_id: editing.category_id,
      name: editing.name,
      slug,
      sort_order: editing.sort_order ?? 0,
      active: editing.active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("sub_categories").update(payload).eq("id", editing.id)
      : await supabase.from("sub_categories").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setEditing(null);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
    const { error } = await supabase.from("sub_categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    load();
  };

  const selectedCatName = cats.find((c) => c.id === selectedCat)?.name ?? "";
  const nextOrder = filtered.length ? Math.max(...filtered.map((s) => s.sort_order ?? 0)) + 1 : 1;
  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-black tracking-tight">Menus (Sub-categories)</h1>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Sub-categories appear as dropdown items under their parent category in the main menu.
      </p>

      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">
          Step 1 — pick a parent category
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={
                "px-3 py-2 rounded-full text-xs font-bold uppercase tracking-widest border transition " +
                (selectedCat === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/50")
              }
            >
              {c.name}
            </button>
          ))}
          {cats.length === 0 && (
            <span className="text-sm text-muted-foreground">Create categories first.</span>
          )}
        </div>
        {selectedCatName && (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0 text-sm">
              Adding to <span className="font-bold">{selectedCatName}</span> · {filtered.length}{" "}
              sub-categor{filtered.length === 1 ? "y" : "ies"}
            </div>
            <button
              onClick={() =>
                setEditing({
                  category_id: selectedCat,
                  name: "",
                  slug: "",
                  sort_order: nextOrder,
                  active: true,
                })
              }
              className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground"
            >
              + New sub-category
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Slug</th>
              <th className="text-right p-3">Order</th>
              <th className="p-3">Active</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">
                  No sub-categories yet{selectedCatName ? ` under ${selectedCatName}` : ""}.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{s.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{s.slug}</td>
                  <td className="p-3 text-right">{s.sort_order}</td>
                  <td className="p-3 text-center">{s.active ? "✓" : "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap space-x-3">
                    <button
                      onClick={() => setEditing(s)}
                      className="text-xs font-bold uppercase text-primary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="text-xs font-bold uppercase text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <div className="text-lg font-bold">
            {editing.id ? "Edit sub-category" : "New sub-category"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This will show as a dropdown item under{" "}
            <span className="font-bold text-foreground">
              {cats.find((c) => c.id === editing.category_id)?.name ?? "—"}
            </span>{" "}
            in the main menu.
          </p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs uppercase font-bold tracking-widest">Name</span>
              <input
                autoFocus
                value={editing.name ?? ""}
                placeholder="e.g. Electric Mountain Bikes"
                onChange={(e) => {
                  const name = e.target.value;
                  setEditing((prev) => {
                    const p = prev ?? {};
                    const slugWasAuto = !p.id && (!p.slug || p.slug === autoSlug(p.name ?? ""));
                    return { ...p, name, slug: slugWasAuto ? autoSlug(name) : p.slug };
                  });
                }}
                className="in mt-1"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Link: /products?sub={editing.slug || "…"}
              </span>
            </label>
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-xs uppercase font-bold tracking-widest text-muted-foreground">
                Advanced (optional)
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs uppercase font-bold tracking-widest">Slug</span>
                  <input
                    value={editing.slug ?? ""}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    className="in mt-1"
                    placeholder="auto-generated from name"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase font-bold tracking-widest">Sort order</span>
                  <input
                    type="number"
                    value={editing.sort_order ?? nextOrder}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })
                    }
                    className="in mt-1"
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Lower numbers appear first. Defaults to the end of the list.
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs uppercase font-bold tracking-widest">
                    Parent category
                  </span>
                  <select
                    value={editing.category_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
                    className="in mt-1"
                  >
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active ?? true}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />{" "}
              Active (visible in the menu)
            </label>
          </div>
          <div className="mt-5 flex gap-2 justify-end">
            <button
              onClick={() => setEditing(null)}
              className="rounded-md border border-input px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!editing.name}
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Refunds ---------------- */
function RefundsAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from("refund_requests")
      .select("*,order:orders(order_number,total)")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("refund_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight mb-4">Refund Requests</h1>
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Reason</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id as string} className="border-t border-border">
                <td className="p-3 font-mono">
                  {(r.order as { order_number: string } | null)?.order_number ?? "—"}
                </td>
                <td className="p-3 max-w-md">{r.reason as string}</td>
                <td className="p-3">
                  <select
                    defaultValue={r.status as string}
                    onChange={(e) => setStatus(r.id as string, e.target.value)}
                    className="in"
                  >
                    {["pending", "approved", "rejected", "completed"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(r.created_at as string).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Reviews ---------------- */
function ReviewsAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*,product:products(name)")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);
  const toggle = async (id: string, approved: boolean) => {
    await supabase.from("reviews").update({ approved }).eq("id", id);
    load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("reviews").delete().eq("id", id);
    load();
  };
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight mb-4">Reviews</h1>
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">Rating</th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Approved</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id as string} className="border-t border-border">
                <td className="p-3">{(r.product as { name: string } | null)?.name ?? "—"}</td>
                <td className="p-3">{r.rating as number}★</td>
                <td className="p-3">
                  {r.title as string}
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {r.body as string}
                  </div>
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={!!r.approved}
                    onChange={(e) => toggle(r.id as string, e.target.checked)}
                  />
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => del(r.id as string)}
                    className="text-xs font-bold uppercase text-muted-foreground hover:text-primary"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Newsletter ---------------- */
function NewsletterAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    supabase
      .from("newsletter_subscribers")
      .select("*")
      .order("subscribed_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, []);
  const csv = "email,subscribed_at\n" + rows.map((r) => `${r.email},${r.subscribed_at}`).join("\n");
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black tracking-tight">
          Newsletter Subscribers ({rows.length})
        </h1>
        <a
          href={"data:text/csv;charset=utf-8," + encodeURIComponent(csv)}
          download="subscribers.csv"
          className="rounded-md border border-input px-4 py-2 text-sm font-bold"
        >
          Export CSV
        </a>
      </div>
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Since</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id as string} className="border-t border-border">
                <td className="p-3">{r.email as string}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(r.subscribed_at as string).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Roles ---------------- */
type DirUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  staff_role_id: string | null;
};
type StaffRole = { id: string; name: string; service_type: string };
const ROLE_OPTS = [
  { v: "admin", label: "Admin", hint: "Full access to everything" },
  { v: "staff", label: "Staff", hint: "Products & orders only" },
  { v: "customer", label: "User", hint: "No admin access" },
];

function RolesAdmin() {
  const [sub, setSub] = useState<"all" | "create">("all");
  const [custom, setCustom] = useState<StaffRole[]>([]);
  const loadRoles = async () => {
    const { data } = await supabase
      .from("staff_roles")
      .select("id,name,service_type")
      .order("name");
    setCustom((data as StaffRole[]) ?? []);
  };
  useEffect(() => {
    loadRoles();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight mb-1">Staff Roles</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Admin = everything · Staff = products &amp; orders · Custom roles = one service type&apos;s
        bookings only.
      </p>

      <div className="mb-5 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ink p-1.5">
        {(
          [
            ["all", "All Roles"],
            ["create", "Create a Role"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={
              "rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition " +
              (sub === k
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-white/70 hover:text-white")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {sub === "all" ? (
        <AllRoles custom={custom} />
      ) : (
        <CreateRoles roles={custom} reload={loadRoles} />
      )}
    </div>
  );
}

function AllRoles({ custom }: { custom: StaffRole[] }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<DirUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as DirUser[]);
  };
  useEffect(() => {
    load();
  }, []);

  /** value is "admin" | "staff" | "customer" | "custom:<id>" */
  const valueOf = (u: DirUser) => (u.staff_role_id ? `custom:${u.staff_role_id}` : u.role);

  const change = async (u: DirUser, value: string) => {
    const isCustom = value.startsWith("custom:");
    const staffRoleId = isCustom ? value.slice(7) : null;
    const role = isCustom ? "staff" : value;
    setSavingId(u.user_id);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _user_id: u.user_id,
      _role: role,
      _staff_role_id: staffRoleId ?? undefined,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((rs) =>
      rs.map((r) => (r.user_id === u.user_id ? { ...r, role, staff_role_id: staffRoleId } : r)),
    );
    const label = isCustom
      ? custom.find((c) => c.id === staffRoleId)?.name
      : ROLE_OPTS.find((o) => o.v === role)?.label;
    toast.success(`${u.email ?? "User"} is now ${label}`);
  };

  const options = (
    <>
      {ROLE_OPTS.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
      {custom.map((c) => (
        <option key={c.id} value={`custom:${c.id}`}>
          {c.name} (bookings: {c.service_type})
        </option>
      ))}
    </>
  );

  const filtered = rows.filter(
    (r) =>
      !q.trim() ||
      `${r.email ?? ""} ${r.full_name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email…"
        className="in mb-4 max-w-sm"
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading users…</div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="md:hidden space-y-3">
            {filtered.map((u) => (
              <li key={u.user_id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="font-bold break-all">{u.full_name || u.email}</div>
                <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                <select
                  value={valueOf(u)}
                  disabled={savingId === u.user_id || u.user_id === user?.id}
                  onChange={(e) => change(u, e.target.value)}
                  className="in w-full"
                >
                  {options}
                </select>
              </li>
            ))}
          </ul>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-border overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-10 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr key={u.user_id} className="border-t border-border">
                    <td className="p-3">
                      {u.full_name || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <select
                        value={valueOf(u)}
                        disabled={savingId === u.user_id || u.user_id === user?.id}
                        onChange={(e) => change(u, e.target.value)}
                        className="in disabled:opacity-60"
                        title={
                          u.user_id === user?.id ? "You can't change your own role" : undefined
                        }
                      >
                        {options}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CreateRoles({ roles, reload }: { roles: StaffRole[]; reload: () => Promise<void> }) {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "service_types")
      .maybeSingle()
      .then(({ data }) => setTypes(normalizeServiceTypes(data?.value)));
  }, []);

  const typeName = (key: string) =>
    types.find((t) => t.key === key)?.name ?? CATEGORY_LABELS[key as CategoryKey] ?? key;
  const reset = () => {
    setEditId(null);
    setName("");
    setType("");
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }
    if (!type) {
      toast.error("Pick a service type");
      return;
    }
    setBusy(true);
    const payload = { name: name.trim(), service_type: type };
    const { error } = editId
      ? await supabase.from("staff_roles").update(payload).eq("id", editId)
      : await supabase.from("staff_roles").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editId ? "Role updated" : "Role created");
    reset();
    reload();
  };

  const remove = async (r: StaffRole) => {
    if (!confirm(`Delete the "${r.name}" role? Users with it lose their scoped access.`)) return;
    const { error } = await supabase.from("staff_roles").delete().eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Role deleted");
    if (editId === r.id) reset();
    reload();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest">
          {editId ? "Edit custom role" : "Create a custom role"}
        </h2>
        <p className="text-xs text-muted-foreground">
          A custom role only sees and manages bookings of its assigned service type — no orders, no
          other service types.
        </p>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide">Role name</label>
          <input
            className="in mt-1 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cycle Staff"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide">Service type</label>
          <select className="in mt-1 w-full" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">— Select a service type —</option>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
          {types.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Add service types under Bookings → Service types first.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={save}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : editId ? "Save changes" : "Create role"}
          </button>
          {editId && (
            <button
              onClick={reset}
              className="rounded-md border border-input px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
          <div className="font-bold uppercase tracking-widest text-foreground">Default roles</div>
          <div className="mt-1">
            Admin — full access · Staff — orders &amp; bookings. These can&apos;t be edited or
            deleted.
          </div>
        </div>
        {roles.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No custom roles yet.
          </div>
        ) : (
          roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  Bookings scope: {typeName(r.service_type)}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditId(r.id);
                  setName(r.name);
                  setType(r.service_type);
                }}
                className="rounded border border-input px-2 py-1 text-xs font-bold"
              >
                Edit
              </button>
              <button
                onClick={() => remove(r)}
                aria-label="Delete role"
                className="rounded border border-input p-1.5 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
type ContactInfo = {
  phone: string;
  email: string;
  address: string;
  map_embed: string;
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
  tiktok: string;
};
const DEFAULT_CONTACT: ContactInfo = {
  phone: "",
  email: "",
  address: "",
  map_embed: "",
  facebook: "",
  instagram: "",
  twitter: "",
  youtube: "",
  tiktok: "",
};

function SettingsAdmin() {
  const [contact, setContact] = useState<ContactInfo>(DEFAULT_CONTACT);
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "contact_info")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value)
          setContact({ ...DEFAULT_CONTACT, ...(data.value as Partial<ContactInfo>) });
      });
  }, []);
  const saveContact = async () => {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "contact_info", value: contact }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else toast.success("Contact info saved");
  };
  const setC =
    (k: keyof ContactInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setContact((c) => ({ ...c, [k]: e.target.value }));
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-black tracking-tight">Site Settings</h1>
      <p className="text-xs text-muted-foreground">
        Service package prices & descriptions are managed in{" "}
        <Link to="/admin" search={{ tab: "bookings" }} className="text-primary underline">
          Bookings → Edit packages
        </Link>
        .
      </p>

      <section className="rounded-lg border border-border p-5 bg-card space-y-4 max-w-2xl">
        <div className="text-xs uppercase font-bold tracking-widest">Contact & footer info</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Phone">
            <input
              value={contact.phone}
              onChange={setC("phone")}
              className="in"
              placeholder="+44 7700 900123"
            />
          </Field>
          <Field label="Email">
            <input
              value={contact.email}
              onChange={setC("email")}
              className="in"
              placeholder="hello@example.com"
            />
          </Field>
          <Field label="Address" full>
            <textarea
              rows={2}
              value={contact.address}
              onChange={setC("address")}
              className="in"
              placeholder="Street, city, postcode, country"
            />
          </Field>
          <Field label="Google Maps embed URL" full>
            <input
              value={contact.map_embed}
              onChange={setC("map_embed")}
              className="in"
              placeholder="https://www.google.com/maps?q=...&output=embed"
            />
          </Field>
          <Field label="Facebook URL">
            <input
              value={contact.facebook}
              onChange={setC("facebook")}
              className="in"
              placeholder="https://facebook.com/…"
            />
          </Field>
          <Field label="Instagram URL">
            <input
              value={contact.instagram}
              onChange={setC("instagram")}
              className="in"
              placeholder="https://instagram.com/…"
            />
          </Field>
          <Field label="Twitter / X URL">
            <input
              value={contact.twitter}
              onChange={setC("twitter")}
              className="in"
              placeholder="https://x.com/…"
            />
          </Field>
          <Field label="YouTube URL">
            <input
              value={contact.youtube}
              onChange={setC("youtube")}
              className="in"
              placeholder="https://youtube.com/…"
            />
          </Field>
          <Field label="TikTok URL" full>
            <input
              value={contact.tiktok}
              onChange={setC("tiktok")}
              className="in"
              placeholder="https://tiktok.com/@…"
            />
          </Field>
        </div>
        {contact.map_embed && (
          <div className="rounded-md overflow-hidden border border-border aspect-video">
            <iframe
              src={contact.map_embed}
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
        <button
          onClick={saveContact}
          className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Save contact info
        </button>
      </section>

      <section className="rounded-lg border border-border p-5 bg-card space-y-2 max-w-3xl">
        <div className="text-xs uppercase font-bold tracking-widest">SEO</div>
        <p className="text-xs text-muted-foreground">
          Search engine metadata, Google Search Console verification, analytics, sitemap and
          robots.txt.
        </p>
      </section>
      <SeoAdmin />
      <ExternalShopEditor />
      <ShippingRulesEditor />
      <PaymentSettingsEditor />
      <BookingHoursEditor />
      <p className="text-xs text-muted-foreground">
        The sitewide discount banner is now managed in{" "}
        <Link to="/admin" search={{ tab: "coupons" }} className="text-primary underline">
          Coupons
        </Link>
        .
      </p>
    </div>
  );
}

function ExternalShopEditor() {
  const [v, setV] = useState<{ url: string; title: string; subtitle: string }>({
    url: "",
    title: "",
    subtitle: "",
  });
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "external_shop")
      .maybeSingle()
      .then(({ data }) => {
        const d = data?.value as Partial<{ url: string; title: string; subtitle: string }> | null;
        if (d) setV({ url: d.url ?? "", title: d.title ?? "", subtitle: d.subtitle ?? "" });
      });
  }, []);
  const save = async () => {
    const payload = { url: v.url.trim(), title: v.title.trim(), subtitle: v.subtitle.trim() };
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "external_shop", value: payload }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else toast.success(payload.url ? "External shop link saved" : "External shop banner hidden");
  };
  return (
    <section className="rounded-lg border border-border p-5 bg-card space-y-3 max-w-2xl">
      <div className="text-xs uppercase font-bold tracking-widest">
        External shop (dropshipping store)
      </div>
      <p className="text-xs text-muted-foreground">
        Shows a banner on the homepage linking to your second store. Leave the URL empty to hide the
        banner completely.
      </p>
      <Field label="External Shop URL" full>
        <input
          value={v.url}
          onChange={(e) => setV((x) => ({ ...x, url: e.target.value }))}
          className="in"
          placeholder="https://shop.yourbikesandhomeserviceslimited.co.uk"
        />
      </Field>
      <Field label="Banner heading (optional)" full>
        <input
          value={v.title}
          onChange={(e) => setV((x) => ({ ...x, title: e.target.value }))}
          className="in"
          placeholder="Explore our Dropshipping Store"
        />
      </Field>
      <Field label="Banner subtitle (optional)" full>
        <input
          value={v.subtitle}
          onChange={(e) => setV((x) => ({ ...x, subtitle: e.target.value }))}
          className="in"
          placeholder="Thousands of extra products, shipped direct."
        />
      </Field>
      <button
        onClick={save}
        className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        Save external shop
      </button>
    </section>
  );
}

type ShippingTier = { min_subtotal: number; price: number; label: string };
const DEFAULT_SHIPPING_TIERS: ShippingTier[] = [
  { min_subtotal: 0, price: 2.99, label: "Standard delivery" },
  { min_subtotal: 30, price: 0, label: "Free delivery over £30" },
];
function ShippingRulesEditor() {
  const [tiers, setTiers] = useState<ShippingTier[]>(DEFAULT_SHIPPING_TIERS);
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "shipping_rules")
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value as { tiers?: ShippingTier[] } | null;
        if (v?.tiers && Array.isArray(v.tiers) && v.tiers.length > 0) setTiers(v.tiers);
      });
  }, []);
  const setTier = (i: number, patch: Partial<ShippingTier>) =>
    setTiers((t) => t.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addTier = () => setTiers((t) => [...t, { min_subtotal: 0, price: 0, label: "New tier" }]);
  const removeTier = (i: number) => setTiers((t) => t.filter((_, j) => j !== i));
  const save = async () => {
    const sorted = [...tiers].sort((a, b) => a.min_subtotal - b.min_subtotal);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "shipping_rules", value: { tiers: sorted } }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else {
      toast.success("Shipping rules saved");
      setTiers(sorted);
    }
  };
  return (
    <section className="rounded-lg border border-border p-5 bg-card space-y-3 max-w-3xl">
      <div className="text-xs uppercase font-bold tracking-widest">Shipping rules</div>
      <p className="text-xs text-muted-foreground">
        Charges based on cart subtotal. The tier with the highest matching minimum applies. Set
        price to 0 for free shipping.
      </p>
      <ul className="space-y-2">
        {tiers.map((t, i) => (
          <li
            key={i}
            className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-2 items-end rounded-md border border-border p-3"
          >
            <label className="block">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Label
              </span>
              <input
                value={t.label}
                onChange={(e) => setTier(i, { label: e.target.value })}
                className="in mt-1"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Min subtotal £
              </span>
              <input
                type="number"
                step="0.01"
                value={t.min_subtotal}
                onChange={(e) => setTier(i, { min_subtotal: Number(e.target.value) || 0 })}
                className="in mt-1"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Price £
              </span>
              <input
                type="number"
                step="0.01"
                value={t.price}
                onChange={(e) => setTier(i, { price: Number(e.target.value) || 0 })}
                className="in mt-1"
              />
            </label>
            <button
              onClick={() => removeTier(i)}
              type="button"
              aria-label="Remove tier"
              className="h-9 w-9 grid place-items-center rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={addTier}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> Add tier
        </button>
        <button
          onClick={save}
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Save shipping rules
        </button>
      </div>
    </section>
  );
}

function PaymentSettingsEditor() {
  const [codEnabled, setCodEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "checkout_settings")
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value as { cod_enabled?: boolean } | null;
        if (v && typeof v.cod_enabled === "boolean") setCodEnabled(v.cod_enabled);
        setLoaded(true);
      });
  }, []);
  const save = async () => {
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: "checkout_settings", value: { cod_enabled: codEnabled } },
        { onConflict: "key" },
      );
    if (error) toast.error(error.message);
    else toast.success("Payment settings saved");
  };
  return (
    <section className="rounded-lg border border-border p-5 bg-card space-y-3 max-w-3xl">
      <div className="text-xs uppercase font-bold tracking-widest">Payment methods</div>
      <p className="text-xs text-muted-foreground">
        Control which payment methods are available at checkout.
      </p>
      <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div>
          <div className="text-sm font-bold">Cash on Delivery</div>
          <div className="text-xs text-muted-foreground">
            Allow customers to pay in cash when the order arrives.
          </div>
        </div>
        <input
          type="checkbox"
          checked={codEnabled}
          onChange={(e) => setCodEnabled(e.target.checked)}
          className="h-5 w-5"
        />
      </label>
      <button
        onClick={save}
        disabled={!loaded}
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        Save payment settings
      </button>
    </section>
  );
}

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type BookingDay = { open: boolean; start: string; end: string };
type BookingHours = { interval_minutes: number; days: Record<DayKey, BookingDay> };
const DAY_ORDER: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];
export const DEFAULT_BOOKING_HOURS: BookingHours = {
  interval_minutes: 60,
  days: {
    mon: { open: true, start: "08:00", end: "17:00" },
    tue: { open: true, start: "08:00", end: "17:00" },
    wed: { open: true, start: "08:00", end: "17:00" },
    thu: { open: true, start: "08:00", end: "17:00" },
    fri: { open: true, start: "08:00", end: "17:00" },
    sat: { open: true, start: "09:00", end: "15:00" },
    sun: { open: false, start: "09:00", end: "15:00" },
  },
};
function BookingHoursEditor() {
  const [hours, setHours] = useState<BookingHours>(DEFAULT_BOOKING_HOURS);
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "booking_hours")
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value as Partial<BookingHours> | null;
        if (v && v.days)
          setHours({
            interval_minutes: v.interval_minutes ?? 60,
            days: { ...DEFAULT_BOOKING_HOURS.days, ...v.days },
          });
      });
  }, []);
  const setDay = (k: DayKey, patch: Partial<BookingDay>) =>
    setHours((h) => ({ ...h, days: { ...h.days, [k]: { ...h.days[k], ...patch } } }));
  const save = async () => {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "booking_hours", value: hours }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else toast.success("Booking hours saved");
  };
  return (
    <section className="rounded-lg border border-border p-5 bg-card space-y-3 max-w-3xl">
      <div className="text-xs uppercase font-bold tracking-widest">Booking hours</div>
      <p className="text-xs text-muted-foreground">
        Toggle each day open/closed and set opening/closing times. Slots on the booking page are
        generated from these times using the interval below.
      </p>
      <label className="flex items-center gap-3 text-sm">
        <span className="w-56 text-muted-foreground">Slot interval (minutes)</span>
        <select
          value={hours.interval_minutes}
          onChange={(e) => setHours((h) => ({ ...h, interval_minutes: Number(e.target.value) }))}
          className="in flex-1 max-w-[160px]"
        >
          {[15, 30, 45, 60, 90, 120].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
      </label>
      <ul className="space-y-2">
        {DAY_ORDER.map(({ key, label }) => {
          const d = hours.days[key];
          return (
            <li
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[140px_110px_1fr_1fr] gap-2 items-center rounded-md border border-border p-3"
            >
              <div className="font-medium text-sm">{label}</div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => setDay(key, { open: e.target.checked })}
                />
                <span>{d.open ? "Open" : "Closed"}</span>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  Opens
                </span>
                <input
                  type="time"
                  disabled={!d.open}
                  value={d.start}
                  onChange={(e) => setDay(key, { start: e.target.value })}
                  className="in mt-1 disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  Closes
                </span>
                <input
                  type="time"
                  disabled={!d.open}
                  value={d.end}
                  onChange={(e) => setDay(key, { end: e.target.value })}
                  className="in mt-1 disabled:opacity-50"
                />
              </label>
            </li>
          );
        })}
      </ul>
      <button
        onClick={save}
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        Save booking hours
      </button>
    </section>
  );
}

type PromoBannerValue = { enabled: boolean; text: string; code: string };
type CouponRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  active: boolean;
};

function CouponsAdmin() {
  return (
    <div className="space-y-8">
      <CouponBannerEditor />
      <SimpleCRUD
        table="coupons"
        fields={[
          ["code", "text"],
          ["discount_type", "text"],
          ["discount_value", "number"],
          ["min_order", "number"],
          ["active", "bool"],
        ]}
      />
    </div>
  );
}

function describeCoupon(c: CouponRow) {
  const off =
    c.discount_type === "percent" ? `${c.discount_value}% off` : `${gbp(c.discount_value)} off`;
  return c.min_order > 0 ? `${off} orders over ${gbp(c.min_order)}` : `${off} your order`;
}

function CouponBannerEditor() {
  const [b, setB] = useState<PromoBannerValue>({ enabled: false, text: "", code: "" });
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "promo_banner")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as Partial<PromoBannerValue>;
          setB({ enabled: !!v.enabled, text: v.text ?? "", code: v.code ?? "" });
        }
      });
    supabase
      .from("coupons")
      .select("id,code,discount_type,discount_value,min_order,active")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setCoupons((data ?? []) as CouponRow[]));
  }, []);
  const pick = (code: string) => {
    const c = coupons.find((x) => x.code === code);
    setB((v) => ({ ...v, code, text: c ? describeCoupon(c) : v.text }));
  };
  const save = async () => {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "promo_banner", value: b }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else toast.success("Banner saved");
  };
  return (
    <section className="rounded-lg border border-border p-5 bg-card space-y-4 max-w-2xl">
      <div>
        <div className="text-xs uppercase font-bold tracking-widest">
          Sitewide announcement banner
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Feature one of your active coupon codes in the banner shown at the top of every page.
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-full bg-secondary p-1 text-xs font-bold uppercase tracking-widest">
        <button
          type="button"
          onClick={() => setB((v) => ({ ...v, enabled: true }))}
          className={
            "rounded-full px-4 py-2 transition " +
            (b.enabled ? "bg-primary text-primary-foreground" : "text-muted-foreground")
          }
        >
          Banner on
        </button>
        <button
          type="button"
          onClick={() => setB((v) => ({ ...v, enabled: false }))}
          className={
            "rounded-full px-4 py-2 transition " +
            (!b.enabled ? "bg-primary text-primary-foreground" : "text-muted-foreground")
          }
        >
          Banner off
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setB((v) => ({ ...v, code: "" }))}
          className={
            "rounded-full border px-3 py-1.5 text-xs font-bold uppercase " +
            (!b.code
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50")
          }
        >
          No code
        </button>
        {coupons.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => pick(c.code)}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-bold uppercase " +
              (b.code === c.code
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50")
            }
          >
            {c.code}{" "}
            <span className="font-normal normal-case opacity-70">— {describeCoupon(c)}</span>
          </button>
        ))}
        {coupons.length === 0 && (
          <span className="text-xs text-muted-foreground">
            No active coupons yet — create one below.
          </span>
        )}
      </div>

      <Field label="Banner text" full>
        <input
          value={b.text}
          onChange={(e) => setB((v) => ({ ...v, text: e.target.value }))}
          className="in"
          placeholder="Save 10% on your first order"
        />
      </Field>

      <div className="rounded-md border border-dashed border-border p-3 text-xs">
        <span className="text-muted-foreground">Preview: </span>
        {b.enabled && b.text ? (
          <span className="font-semibold">
            {b.text}
            {b.code ? ` — Code: ${b.code.toUpperCase()}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">Banner hidden</span>
        )}
      </div>

      <button
        onClick={save}
        className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        Save banner
      </button>
    </section>
  );
}

/* helpers */
function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={"block " + (full ? "sm:col-span-2" : "")}>
      <span className="text-xs uppercase font-bold tracking-widest">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ImageUploader({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setBusy(false);
    if (urls.length) {
      onChange([...value, ...urls]);
      toast.success(`Uploaded ${urls.length}`);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <div
            key={url + i}
            className="relative h-24 w-24 rounded-md border border-border overflow-hidden bg-secondary group"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
        <label className="h-24 w-24 flex items-center justify-center rounded-md border-2 border-dashed border-border text-xs text-muted-foreground cursor-pointer hover:border-primary hover:text-primary">
          {busy ? "Uploading…" : "+ Add"}
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        PNG, JPG, WEBP. First image is used as the main tile.
      </p>
    </div>
  );
}
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  // Only close when the mousedown started on the overlay itself — prevents drag-to-select from closing the modal.
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-full flex items-start justify-center p-4">
        <div
          className="bg-card rounded-lg p-6 max-w-2xl w-full my-8 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
