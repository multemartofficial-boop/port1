import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  variantId?: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "yours_cart_v1";
export const cartLineId = (item: Pick<CartItem, "productId" | "variantId">) =>
  `${item.productId}::${item.variantId ?? ""}`;

/** Merge any duplicate lines (same product + variant) into one line. */
function mergeLines(list: CartItem[]): CartItem[] {
  const out: CartItem[] = [];
  const index = new Map<string, number>();
  for (const raw of list) {
    const item: CartItem = { ...raw, variantId: raw.variantId ?? undefined };
    const key = cartLineId(item);
    const at = index.get(key);
    if (at === undefined) { index.set(key, out.length); out.push({ ...item, quantity: Math.max(1, item.quantity) }); }
    else out[at] = { ...out[at], quantity: out[at].quantity + Math.max(1, item.quantity) };
  }
  return out;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
      if (raw) {
        const stored = JSON.parse(raw);
        // Merge stored lines with anything added before hydration finished.
        if (Array.isArray(stored)) setItems(prev => mergeLines([...(stored as CartItem[]), ...prev]));
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [hydrated, items]);


  const value = useMemo<CartCtx>(() => ({
    items,
    add: (item, qty = 1) => setItems(prev => {
      const nextLineId = cartLineId(item);
      const existing = prev.find(p => cartLineId(p) === nextLineId);
      if (existing) return prev.map(p => cartLineId(p) === nextLineId ? { ...p, quantity: p.quantity + qty } : p);
      return [...prev, { ...item, quantity: qty }];
    }),
    remove: (id) => setItems(prev => prev.filter(p => cartLineId(p) !== id)),
    setQty: (id, qty) => setItems(prev => qty <= 0 ? prev.filter(p => cartLineId(p) !== id) : prev.map(p => cartLineId(p) === id ? { ...p, quantity: qty } : p)),
    clear: () => {
      try { window.localStorage.setItem(KEY, JSON.stringify([])); } catch { /* ignore */ }
      setItems([]);
    },
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.quantity * i.price, 0),
  }), [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
