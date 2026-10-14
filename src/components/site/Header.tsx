import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingCart, User, Menu, X, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import siteLogo from "@/assets/site-logo.png.asset.json";

type Cat = { id: string; name: string; slug: string };
type Sub = { id: string; category_id: string; name: string; slug: string };

const EXTRA = [
  { label: "New Arrivals", slug: "new-arrivals" },
  { label: "Best Sellers", slug: "best-sellers" },
];

export function Header() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([
        supabase.from("categories").select("id,name,slug").eq("active", true).order("sort_order"),
        supabase.from("sub_categories").select("id,category_id,name,slug").eq("active", true).order("sort_order"),
      ]);
      setCats((c.data as Cat[]) ?? []);
      setSubs((s.data as Sub[]) ?? []);
    })();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/products", search: { q } as never });
    setOpen(false);
  };

  const subsFor = (catId: string) => subs.filter(s => s.category_id === catId);
  // Some sites also store these as real categories — avoid rendering them twice.
  const extras = EXTRA.filter(e => !cats.some(c => c.slug === e.slug || c.name.toLowerCase() === e.label.toLowerCase()));

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="bg-ink text-ink-foreground text-xs">
        <div className="container-page py-2 text-center">
          Yours+ Loyalty Scheme — Earn points with every purchase. Free UK shipping over £30.
        </div>
      </div>
      <div className="container-page grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-4">
        <Link to="/" className="flex items-center shrink-0" aria-label="Yours Bikes & Home Services">
          <img src={siteLogo.url} alt="Yours Bikes & Home Services" className="h-11 md:h-12 w-auto object-contain" />
        </Link>
        <form onSubmit={submit} className="hidden md:flex items-center gap-2 rounded-full border border-input bg-secondary px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search for parts, brands, gear..." className="bg-transparent outline-none flex-1 text-sm min-w-0" />
        </form>
        <div className="flex items-center justify-end gap-4 shrink-0">
          {user ? (
            <Link to="/orders" className="hidden sm:flex items-center gap-1.5 text-sm hover:text-primary transition-colors"><User className="h-4 w-4" /> Account</Link>
          ) : (
            <Link to="/auth" className="hidden sm:flex items-center gap-1.5 text-sm hover:text-primary transition-colors"><User className="h-4 w-4" /> Sign in</Link>
          )}
          <Link to="/wishlist" className="relative hidden sm:block hover:text-primary transition-colors" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
            {wishCount > 0 && (<span className="absolute -top-2 -right-2 h-5 min-w-[1.25rem] px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{wishCount}</span>)}
          </Link>
          <Link to="/cart" className="relative hover:text-primary transition-colors" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (<span className="absolute -top-2 -right-2 h-5 min-w-[1.25rem] px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{count}</span>)}
          </Link>
          {isAdmin && (<Link to="/admin" search={{ tab: "products" }} className="hidden md:inline-block text-xs uppercase font-bold tracking-widest text-primary hover:underline">Admin</Link>)}
          {user && (<button onClick={() => supabase.auth.signOut()} className="hidden md:inline-block text-xs text-muted-foreground hover:text-foreground">Sign out</button>)}
          <button onClick={() => setOpen(o => !o)} className="lg:hidden" aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {/* Mobile search */}
      <div className="md:hidden border-t border-border">
        <form onSubmit={submit} className="container-page py-2">
          <div className="flex items-center gap-2 rounded-full border border-input bg-secondary px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" className="bg-transparent outline-none flex-1 text-sm min-w-0" />
          </div>
        </form>
      </div>
      {/* Desktop nav with dropdowns */}
      <nav className="hidden lg:block border-t border-border">
        <div className="container-page flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-[13px] font-semibold uppercase tracking-wide">
          {cats.map(c => {
            const cSubs = subsFor(c.id);
            return (
              <div key={c.id} className="relative group">
                <Link to="/products" search={{ category: c.slug } as never} className="flex items-center gap-1 hover:text-primary transition-colors py-1">
                  {c.name}
                  {cSubs.length > 0 && <ChevronDown className="h-3 w-3" />}
                </Link>
                {cSubs.length > 0 && (
                  <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-0 top-full pt-1 z-50 min-w-[220px]">
                    <div className="bg-background border border-border rounded-md shadow-lg py-2">
                      <Link to="/products" search={{ category: c.slug } as never} className="block px-4 py-1.5 text-xs uppercase tracking-wide text-muted-foreground hover:text-primary hover:bg-secondary">All {c.name}</Link>
                      <div className="my-1 h-px bg-border" />
                      {cSubs.map(s => (
                        <Link key={s.id} to="/products" search={{ category: c.slug, sub: s.slug } as never} className="block px-4 py-1.5 text-xs normal-case tracking-normal font-medium hover:text-primary hover:bg-secondary">{s.name}</Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {extras.map(n => (
            <Link key={n.slug} to="/products" search={{ category: n.slug } as never} className="hover:text-primary transition-colors">{n.label}</Link>
          ))}
          <Link to="/about" search={{ tab: "business" } as never} className="hover:text-primary transition-colors">About Our Business</Link>
          <Link to="/services" className="text-primary hover:underline">Services</Link>
        </div>
      </nav>
      {/* Mobile nav */}
      {open && (
        <nav className="lg:hidden border-t border-border max-h-[70vh] overflow-y-auto">
          <div className="container-page py-3 flex flex-col text-sm font-semibold uppercase tracking-wide">
            {cats.map(c => {
              const cSubs = subsFor(c.id);
              const isOpen = expanded === c.id;
              return (
                <div key={c.id} className="border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <Link to="/products" search={{ category: c.slug } as never} onClick={() => setOpen(false)} className="py-2.5 flex-1">{c.name}</Link>
                    {cSubs.length > 0 && (
                      <button onClick={() => setExpanded(isOpen ? null : c.id)} aria-label="Toggle" className="p-2">
                        <ChevronDown className={"h-4 w-4 transition-transform " + (isOpen ? "rotate-180" : "")} />
                      </button>
                    )}
                  </div>
                  {isOpen && cSubs.length > 0 && (
                    <div className="pb-2 pl-3 flex flex-col gap-1 normal-case tracking-normal font-medium text-sm">
                      {cSubs.map(s => (
                        <Link key={s.id} to="/products" search={{ category: c.slug, sub: s.slug } as never} onClick={() => setOpen(false)} className="py-1.5 text-muted-foreground">{s.name}</Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {extras.map(n => (
              <Link key={n.slug} to="/products" search={{ category: n.slug } as never} onClick={() => setOpen(false)} className="py-2.5 border-b border-border/50">{n.label}</Link>
            ))}
            <Link to="/about" search={{ tab: "business" } as never} onClick={() => setOpen(false)} className="py-2.5 border-b border-border/50">About Our Business</Link>
            <Link to="/services" onClick={() => setOpen(false)} className="py-2.5 text-primary">Book a Service</Link>
            {user ? (
              <>
                <Link to="/orders" onClick={() => setOpen(false)} className="py-2.5">My Account</Link>
                {isAdmin && <Link to="/admin" search={{ tab: "products" }} onClick={() => setOpen(false)} className="py-2.5 text-primary">Admin</Link>}
                <button onClick={() => { supabase.auth.signOut(); setOpen(false); }} className="py-2.5 text-left text-muted-foreground">Sign out</button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="py-2.5">Sign in</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
