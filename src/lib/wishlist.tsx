import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type WishlistCtx = {
  ids: Set<string>;
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
  count: number;
  loading: boolean;
};

const Ctx = createContext<WishlistCtx>({
  ids: new Set(),
  has: () => false,
  toggle: async () => {},
  count: 0,
  loading: false,
});

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("wishlist").select("product_id").eq("user_id", user.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { console.error("wishlist load", error); setIds(new Set()); }
      else setIds(new Set((data ?? []).map(r => r.product_id)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) { toast.error("Sign in to save to your wishlist"); return; }
    const already = ids.has(productId);
    // optimistic
    setIds(prev => {
      const n = new Set(prev);
      if (already) n.delete(productId); else n.add(productId);
      return n;
    });
    if (already) {
      const { error } = await supabase.from("wishlist").delete().eq("user_id", user.id).eq("product_id", productId);
      if (error) {
        setIds(prev => new Set(prev).add(productId));
        toast.error(error.message);
      } else toast.success("Removed from wishlist");
    } else {
      const { error } = await supabase.from("wishlist").insert({ user_id: user.id, product_id: productId });
      if (error) {
        setIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
        toast.error(error.message);
      } else toast.success("Added to wishlist");
    }
  }, [ids, user]);

  const value = useMemo<WishlistCtx>(() => ({
    ids,
    has: (id: string) => ids.has(id),
    toggle,
    count: ids.size,
    loading,
  }), [ids, toggle, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWishlist = () => useContext(Ctx);
