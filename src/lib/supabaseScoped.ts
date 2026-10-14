// DEMO BUILD — the scoped client (order-token RLS headers in the real app)
// simply returns the shared local demo client. Header scoping is unnecessary
// because the demo store grants access to its fictional data.
import { supabase } from "@/integrations/supabase/client";

export function createScopedSupabase(_headers: Record<string, string>) {
  return supabase;
}
