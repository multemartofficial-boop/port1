import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";
import { WishlistProvider } from "@/lib/wishlist";
import { fetchSeoSettings, DEFAULT_GLOBAL_SEO, absoluteUrl, SITE_URL } from "@/lib/seo";

function NotFoundComponent() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();
  // Legacy URLs typed with the filename's escape underscore (e.g. /admin_/products/new)
  // — rewrite to the real public path (/admin/products/new).
  useEffect(() => {
    if (pathname.startsWith("/admin_/")) {
      const target = pathname.replace(/^\/admin_\//, "/admin/");
      navigate({ to: target, replace: true });
    }
  }, [pathname, navigate]);
  if (pathname.startsWith("/admin_/")) return null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This route doesn't exist. Head back to the shop.</p>
        <div className="mt-6"><Link to="/" className="inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground">Go home</Link></div>
      </div>
    </div>
  );
}


function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground">Try again</button>
          <a href="/" className="rounded-md border border-input bg-background px-5 py-2.5 text-sm font-bold uppercase">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ location }) => {
    const { global } = await fetchSeoSettings();
    const isAdmin = /^\/admin(_|\/|$)/.test(location.pathname);
    return { seo: global, isAdmin };
  },
  head: ({ loaderData }) => {
    const g = loaderData?.seo ?? DEFAULT_GLOBAL_SEO;
    const ogImage = absoluteUrl(g.og_image);
    const meta: Record<string, string>[] = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: g.default_title },
      { name: "description", content: g.default_description },
      { name: "author", content: g.org_name },
      { property: "og:site_name", content: g.org_name },
      { property: "og:title", content: g.default_title },
      { property: "og:description", content: g.default_description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: g.default_title },
      { name: "twitter:description", content: g.default_description },
    ];
    if (g.keywords) meta.push({ name: "keywords", content: g.keywords });
    if (g.google_verification) meta.push({ name: "google-site-verification", content: g.google_verification });

    const scripts: Record<string, unknown>[] = [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: g.org_name,
          url: SITE_URL,
          logo: absoluteUrl(g.logo_url),
          image: ogImage,
          ...(g.org_phone || g.org_email
            ? {
                contactPoint: [{
                  "@type": "ContactPoint",
                  contactType: "customer service",
                  ...(g.org_phone ? { telephone: g.org_phone } : {}),
                  ...(g.org_email ? { email: g.org_email } : {}),
                }],
              }
            : {}),
          ...(g.org_address ? { address: { "@type": "PostalAddress", streetAddress: g.org_address } } : {}),
        }),
      },
    ];
    if (g.ga4_id && !loaderData?.isAdmin) {
      scripts.push({ src: `https://www.googletagmanager.com/gtag/js?id=${g.ga4_id}`, async: true });
      scripts.push({
        children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${g.ga4_id}');`,
      });
    }

    return {
      meta,
      links: [{ rel: "stylesheet", href: appCss }, { rel: "icon", href: "/favicon.png", type: "image/png" }],
      scripts,
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function GaPageViews({ id }: { id?: string }) {
  const href = useRouterState({ select: s => s.location.href });
  const first = useRef(true);
  useEffect(() => {
    if (!id) return;
    // gtag('config') already sends the initial page_view.
    if (first.current) { first.current = false; return; }
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag?.("event", "page_view", {
      page_path: window.location.pathname + window.location.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [href, id]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const ga4Id = data?.isAdmin ? undefined : data?.seo?.ga4_id;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <Outlet />
            <GaPageViews id={ga4Id} />
            <Toaster position="top-right" richColors />
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
