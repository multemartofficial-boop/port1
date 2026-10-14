import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "customer";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  role: AppRole;
  /** Service-type key a custom staff role is scoped to, or null for full access. */
  serviceScope: string | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, isAdmin: false, role: "customer", serviceScope: null, loading: true, refreshRole: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>("customer");
  const [serviceScope, setServiceScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkRole = async (uid: string | undefined) => {
    if (!uid) { setRole("customer"); setServiceScope(null); return; }
    const { data } = await supabase.from("user_roles").select("role, staff_roles(service_type)").eq("user_id", uid);
    const rows = (data ?? []) as { role: string; staff_roles: { service_type: string } | null }[];
    const roles = rows.map(r => r.role);
    setRole(roles.includes("admin") ? "admin" : roles.includes("staff") ? "staff" : "customer");
    setServiceScope(rows.find(r => r.staff_roles?.service_type)?.staff_roles?.service_type ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // defer role check
      setTimeout(() => { checkRole(s?.user.id); }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      checkRole(data.session?.user.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);


  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, isAdmin: role === "admin" || role === "staff", role, serviceScope, loading, refreshRole: () => checkRole(session?.user.id) }}>

      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
