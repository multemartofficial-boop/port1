import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Facebook, Instagram, Twitter, Youtube, Phone, Mail, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import siteLogo from "@/assets/site-logo.png.asset.json";

type Contact = {
  phone?: string; email?: string; address?: string; map_embed?: string;
  facebook?: string; instagram?: string; twitter?: string; youtube?: string; tiktok?: string;
};

export function Footer() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [c, setC] = useState<Contact>({});

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "contact_info").maybeSingle()
      .then(({ data }) => { if (data?.value) setC(data.value as Contact); });
  }, []);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({ email });
    setBusy(false);
    if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
    toast.success("Subscribed. Ride on.");
    setEmail("");
  };

  const socials = [
    { url: c.facebook, Icon: Facebook, label: "Facebook" },
    { url: c.instagram, Icon: Instagram, label: "Instagram" },
    { url: c.twitter, Icon: Twitter, label: "Twitter" },
    { url: c.youtube, Icon: Youtube, label: "YouTube" },
  ].filter(s => s.url);

  return (
    <footer className="bg-ink text-ink-foreground">
      {/* Contact strip */}
      <div className="border-b border-white/10">
        <div className="container-page grid gap-6 py-8 md:grid-cols-4 text-sm">
          <div><div className="text-primary font-bold uppercase tracking-widest text-[11px]">Customer Service</div><div className="mt-1">7 days, 9am–6pm</div></div>
          <div>
            <div className="text-primary font-bold uppercase tracking-widest text-[11px] flex items-center gap-1"><Phone className="h-3 w-3" /> Call Us</div>
            {c.phone ? <a href={`tel:${c.phone.replace(/\s+/g,"")}`} className="mt-1 block hover:text-white">{c.phone}</a> : <div className="mt-1 text-white/50">—</div>}
          </div>
          <div>
            <div className="text-primary font-bold uppercase tracking-widest text-[11px] flex items-center gap-1"><Mail className="h-3 w-3" /> Email</div>
            {c.email ? <a href={`mailto:${c.email}`} className="mt-1 block hover:text-white break-all">{c.email}</a> : <div className="mt-1 text-white/50">—</div>}
          </div>
          <div>
            <div className="text-primary font-bold uppercase tracking-widest text-[11px] flex items-center gap-1"><MapPin className="h-3 w-3" /> Yours HQ</div>
            <div className="mt-1 whitespace-pre-line">{c.address || "—"}</div>
          </div>
        </div>
      </div>

      {/* Map */}
      {c.map_embed && (
        <div className="border-b border-white/10">
          <div className="container-page py-8">
            <div className="rounded-lg overflow-hidden border border-white/10 aspect-[21/9]">
              <iframe title="Location map" src={c.map_embed} className="w-full h-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          </div>
        </div>
      )}

      {/* Main footer */}
      <div className="container-page grid gap-10 py-14 md:grid-cols-3">
        <div className="md:col-span-1">
          <img src={siteLogo.url} alt="Yours Bikes & Home Services" className="h-14 w-auto object-contain bg-white/95 rounded-md p-2 mb-4" />
          <div className="text-2xl font-black">Ride with us, join our club.</div>
          <p className="mt-3 text-sm text-white/70">Sign up to our newsletter for early access to drops, workshop tips and member-only discounts.</p>
          <form onSubmit={subscribe} className="mt-5 flex gap-2">
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="Your email"
              className="flex-1 rounded-md bg-white/10 border border-white/15 px-3 py-2.5 text-sm outline-none placeholder:text-white/50 focus:border-primary" />
            <button disabled={busy} className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-60">
              {busy ? "…" : "Sign up"}
            </button>
          </form>
          {socials.length > 0 && (
            <div className="mt-6 flex items-center gap-3">
              {socials.map(({ url, Icon, label }) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-primary font-bold uppercase tracking-widest text-[11px] mb-4">Customer Support</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/track" className="hover:text-white">Track order</Link></li>
            <li><Link to="/orders" className="hover:text-white">My orders & returns</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-primary font-bold uppercase tracking-widest text-[11px] mb-4">Company</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/products" className="hover:text-white">All products</Link></li>
            <li><Link to="/services" className="hover:text-white">Book a Service</Link></li>
            <li><Link to="/services/details" className="hover:text-white">Service details</Link></li>
            <li><Link to="/about" search={{ tab: "business" } as never} className="hover:text-white">About Our Business</Link></li>
            <li><Link to="/about" search={{ tab: "team" } as never} className="hover:text-white">Our team</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
          <div>© {new Date().getFullYear()} Yours — Bikes & Home Services.</div>
          <div>Visa · Mastercard · Amex · Apple Pay · Google Pay · Klarna</div>
        </div>
      </div>
    </footer>
  );
}
