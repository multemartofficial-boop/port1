import { supabase } from "@/integrations/supabase/client";

export const SITE_URL = "https://demo.yourbikes.example.com";

export type GlobalSeo = {
  title_template: string;
  default_title: string;
  default_description: string;
  og_image: string;
  logo_url: string;
  google_verification: string;
  ga4_id: string;
  org_name: string;
  org_phone: string;
  org_email: string;
  org_address: string;
  keywords: string;
};

export const DEFAULT_GLOBAL_SEO: GlobalSeo = {
  title_template: "%s | Yours — Bikes & Home Service",
  default_title: "Yours — Bikes & Home Service | Pro Cycling Parts & Mobile Mechanics",
  default_description:
    "Pro-grade drivetrains, wheels, helmets and cycling gear — plus mobile mechanics who come to your door. Free UK shipping over £30.",
  og_image: "/images/hero.jpg",
  logo_url: "/favicon.png",
  google_verification: "",
  ga4_id: "",
  org_name: "Yours Demo Store Ltd",
  org_phone: "",
  org_email: "",
  org_address: "",
  keywords: "",
};

export type PageSeo = { title: string; description: string; keywords: string };
export type PageSeoMap = Record<string, PageSeo>;

export const PAGE_SEO_KEYS = ["home", "about", "services", "contact", "products", "blog"] as const;
export type PageSeoKey = (typeof PAGE_SEO_KEYS)[number];

export const DEFAULT_ROBOTS_TXT = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /cart\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

export function absoluteUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function applyTitleTemplate(template: string, title: string): string {
  if (!title) return title;
  if (!template || !template.includes("%s")) return title;
  return template.replace("%s", title);
}

export function truncate(text: string | null | undefined, max = 160): string {
  const t = (text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

type MetaInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: string;
  keywords?: string | null;
};

/** Build the full meta + canonical set for a leaf route (self-referencing URLs). */
export function buildSeoHead({
  title,
  description,
  path,
  image,
  type = "website",
  keywords,
}: MetaInput) {
  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const img = absoluteUrl(image ?? DEFAULT_GLOBAL_SEO.og_image);
  const meta: Record<string, string>[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (keywords) meta.push({ name: "keywords", content: keywords });
  if (img) {
    meta.push({ property: "og:image", content: img });
    meta.push({ name: "twitter:image", content: img });
  }
  return { meta, links: [{ rel: "canonical", href: url }] };
}

/** Isomorphic fetch of the admin-managed SEO settings (safe during SSR). */
export async function fetchSeoSettings(): Promise<{ global: GlobalSeo; pages: PageSeoMap }> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["seo", "page_seo"]);
    const rows = data ?? [];
    const g = rows.find((r) => r.key === "seo")?.value as Partial<GlobalSeo> | undefined;
    const p = (rows.find((r) => r.key === "page_seo")?.value ?? {}) as PageSeoMap;
    return { global: { ...DEFAULT_GLOBAL_SEO, ...(g ?? {}) }, pages: p };
  } catch {
    return { global: DEFAULT_GLOBAL_SEO, pages: {} };
  }
}

/** Resolve the head for one of the editable static pages. */
export async function staticPageHead(
  key: PageSeoKey,
  fallback: { title: string; description: string; path: string; image?: string },
) {
  const { global, pages } = await fetchSeoSettings();
  const page = pages[key] ?? { title: "", description: "", keywords: "" };
  const title = page.title?.trim()
    ? page.title.trim()
    : key === "home"
      ? global.default_title
      : applyTitleTemplate(global.title_template, fallback.title);
  const description =
    page.description?.trim() || fallback.description || global.default_description;
  return {
    seo: buildSeoHead({
      title,
      description,
      path: fallback.path,
      image: fallback.image ?? global.og_image,
      keywords: page.keywords || global.keywords,
    }),
    global,
  };
}
