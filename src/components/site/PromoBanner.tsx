import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

type Banner = { enabled: boolean; text: string; code: string };

export function PromoBanner() {
  const [b, setB] = useState<Banner | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "promo_banner").maybeSingle()
      .then(({ data }) => { if (data?.value) setB(data.value as Banner); });
    if (typeof window !== "undefined" && sessionStorage.getItem("promo_closed") === "1") setClosed(true);
  }, []);

  if (!b?.enabled || !b.text || closed) return null;

  return (
    <div className="bg-primary text-primary-foreground text-sm">
      <div className="container-page py-2 flex items-center justify-center gap-3 relative">
        <span className="font-semibold">{b.text}</span>
        {b.code && (
          <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-xs uppercase tracking-wider">Code: {b.code}</span>
        )}
        <button
          onClick={() => { setClosed(true); sessionStorage.setItem("promo_closed", "1"); }}
          aria-label="Dismiss"
          className="absolute right-3 opacity-80 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
