// DEMO BUILD — real Supabase removed for the portfolio showcase.
// This exports a fully local, in-browser Supabase-compatible client backed by
// fictional demo data (see demo-client.ts / demo-data.ts). No network calls.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createDemoClient } from "./demo-client";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createDemoClient() as unknown as SupabaseClient<Database>;
