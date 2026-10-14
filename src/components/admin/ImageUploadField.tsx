import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

export function ImageUploadField({ value, onChange, bucket = "product-images" }: { value: string; onChange: (url: string) => void; bucket?: string }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { setBusy(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
    toast.success("Image uploaded");
  };

  return (
    <div className="mt-1 space-y-2">
      <div className="flex items-start gap-3">
        {value && <img src={value} alt="" loading="lazy" className="h-20 w-28 object-cover rounded border border-border" />}
        <div className="flex-1 space-y-2">
          <input type="url" value={value} onChange={e => onChange(e.target.value)} placeholder="Paste URL or upload below"
            className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-secondary disabled:opacity-50 cursor-pointer">
              <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : value ? "Replace" : "Upload"}
            </button>
            {value && (
              <button type="button" onClick={() => onChange("")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive cursor-pointer">
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); if (ref.current) ref.current.value = ""; }} />
        </div>
      </div>
    </div>
  );
}
