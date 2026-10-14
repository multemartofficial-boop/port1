import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/seo";

type Entry = { path: string; lastmod?: string; changefreq?: string; priority?: string };

const STATIC: Entry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/products", changefreq: "daily", priority: "0.9" },
  { path: "/services", changefreq: "weekly", priority: "0.8" },
  { path: "/services/details", changefreq: "monthly", priority: "0.5" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = [...STATIC];
        const isPublic = (p: string) => !/^\/admin(_|\/|$|\?)/.test(p);
        try {
          const [prod, cats, blog] = await Promise.all([
            supabase.from("products").select("slug,updated_at").eq("published", true).limit(1000),
            supabase.from("categories").select("slug,updated_at").eq("active", true).limit(1000),
            supabase.from("blog_posts").select("slug,updated_at").eq("published", true).limit(1000),
          ]);
          for (const c of cats.data ?? [])
            entries.push({ path: `/products?category=${encodeURIComponent(c.slug)}`, lastmod: c.updated_at?.slice(0, 10), changefreq: "weekly", priority: "0.7" });
          for (const p of prod.data ?? [])
            entries.push({ path: `/products/${p.slug}`, lastmod: p.updated_at?.slice(0, 10), changefreq: "weekly", priority: "0.8" });
          for (const b of blog.data ?? [])
            entries.push({ path: `/blog/${b.slug}`, lastmod: b.updated_at?.slice(0, 10), changefreq: "monthly", priority: "0.6" });
        } catch {
          /* fall back to static entries */
        }

        const publicEntries = entries.filter(e => isPublic(e.path));
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const urls = publicEntries.map(e =>
          [
            "  <url>",
            `    <loc>${esc(SITE_URL + e.path)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            "  </url>",
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
