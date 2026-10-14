import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ROBOTS_TXT } from "@/lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        let body = DEFAULT_ROBOTS_TXT;
        try {
          const { data } = await supabase.from("site_settings").select("value").eq("key", "robots_txt").maybeSingle();
          const custom = (data?.value as { content?: string } | null)?.content?.trim();
          if (custom) body = `${custom}\n`;
          if (!/^\s*Disallow:\s*\/admin\s*$/im.test(body)) body += "\nUser-agent: *\nDisallow: /admin\n";
        } catch {
          /* default */
        }
        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
