import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Store, ShoppingCart, User, Wrench } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/" as const, label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/products" as const, label: "Shop", icon: Store, match: (p: string) => p.startsWith("/products") },
  { to: "/services" as const, label: "Services", icon: Wrench, match: (p: string) => p.startsWith("/services") },
  { to: "/cart" as const, label: "Cart", icon: ShoppingCart, match: (p: string) => p.startsWith("/cart") },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { count } = useCart();
  const { user } = useAuth();
  const accountTo = user ? "/orders" : "/auth";
  const accountActive = pathname.startsWith("/orders") || pathname.startsWith("/auth") || pathname.startsWith("/track");

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to}>
              <Link to={to} className={"flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold " + (active ? "text-primary" : "text-muted-foreground")}>
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {to === "/cart" && count > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-[1rem] px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{count}</span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link to={accountTo} className={"flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold " + (accountActive ? "text-primary" : "text-muted-foreground")}>
            <User className="h-5 w-5" />
            <span>Account</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
