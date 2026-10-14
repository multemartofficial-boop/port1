// DEMO BUILD — real Supabase removed for the portfolio showcase.
// The service-role client aliases the same local demo client; no privileged
// credentials exist in this build.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createDemoClient } from "./demo-client";

// Server-side "admin" client — same demo store in this build.
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
export const supabaseAdmin = createDemoClient() as unknown as SupabaseClient<Database>;
