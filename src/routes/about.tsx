import { staticPageHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { TeamGrid } from "@/components/site/TeamSection";

type Section = { heading: string; body: string; image_url: string };
type Stat = { value: string; label: string };

const NARRATIVE: { key: string; label: string }[] = [
  { key: "mission", label: "Mission" },
  { key: "vision", label: "Vision" },
  { key: "values", label: "Values" },
  { key: "recognitions", label: "Recognitions" },
  { key: "journey", label: "Journey" },
  { key: "ceo", label: "From our CEO" },
];

const DEFAULT_STATS: Stat[] = [
  { value: "8+", label: "Years in business" },
  { value: "2,400+", label: "Happy customers" },
  { value: "5,000+", label: "Services completed" },
  { value: "98%", label: "5-star ratings" },
];

const DEFAULT_INTRO =
  "At Yours Bikes & Home Services, **our commitment to excellence** shapes every wheel we true and every doorstep we ride to. What began as a single workshop has grown into a trusted team of mechanics and specialists serving riders across the UK — powered by **unwavering dedication** to honest work, fair pricing and parts we would happily fit to our own bikes.";

export const Route = createFileRoute("/about")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: s.tab === "team" ? "team" : "business" }) as { tab: "business" | "team" },
  loader: () => staticPageHead("about", {
    title: "About Our Business",
    description: "The story, values and people behind Yours Bikes & Home Services — trusted cycle parts and mobile mechanics across the UK.",
    path: "/about",
  }),
  head: ({ loaderData }) => loaderData?.seo ?? {},
  component: AboutPage,
});

function Rich({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="text-foreground font-bold">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
      )}
    </p>
  );
}

function AboutPage() {
  const { tab } = Route.useSearch();
  const [sections, setSections] = useState<Record<string, Section>>({});
  const [stats, setStats] = useState<Stat[]>(DEFAULT_STATS);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "about_page").maybeSingle().then(({ data }) => {
      const raw = (data?.value ?? {}) as Record<string, unknown>;
      const { stats: rawStats, ...rest } = raw;
      if (Array.isArray(rawStats) && rawStats.length) setStats(rawStats as Stat[]);
      setSections(rest as Record<string, Section>);
    });
  }, []);

  const hero = sections.hero ?? { heading: "", body: "", image_url: "" };
  const intro = sections.intro?.body?.trim() ? sections.intro.body : DEFAULT_INTRO;
  const heroImg = hero.image_url || "/images/workshop.jpg";
  const narrative = NARRATIVE.map(n => ({ ...n, s: sections[n.key] })).filter(n => n.s && (n.s.heading || n.s.body));

  return (
    <SiteLayout>
      {/* Pill switcher */}
      <div className="container-page pt-8">
        <div className="mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ink p-1.5">
          {([["business", "About Our Business"], ["team", "Team"]] as const).map(([k, label]) => (
            <Link
              key={k}
              to="/about"
              search={{ tab: k }}
              replace
              className={
                "rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-300 " +
                (tab === k ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-ink-foreground/70 hover:text-ink-foreground")
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div key={tab} className="animate-fade-in">
        {tab === "business" ? (
          <>
            {/* Hero image + Know More pill */}
            <section className="container-page pt-8">
              <div className="relative overflow-hidden rounded-2xl bg-secondary">
                <img src={heroImg} alt={hero.heading || "About our business"} className="h-[240px] sm:h-[340px] lg:h-[440px] w-full object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                  <div className="text-[11px] uppercase tracking-widest text-primary font-bold">About our business</div>
                  <h1 className="mt-2 max-w-2xl text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05]">
                    {hero.heading || "Built by riders, for riders"}
                  </h1>
                  <Link to="/services" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 transition">
                    Know more <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>

            {/* Bold intro narrative */}
            <section className="container-page py-12">
              <Rich text={intro} className="mx-auto max-w-3xl text-center text-lg sm:text-xl leading-relaxed text-muted-foreground" />
              {hero.body && <p className="mx-auto mt-5 max-w-3xl text-center text-muted-foreground whitespace-pre-line">{hero.body}</p>}
            </section>

            {/* Stat cards */}
            {stats.length > 0 && (
              <section className="container-page pb-14">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats.filter(s => s.value || s.label).map((s, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-surface p-6 text-center">
                      <div className="text-3xl sm:text-4xl font-black tracking-tight text-primary">{s.value}</div>
                      <div className="mt-1.5 text-xs sm:text-sm uppercase tracking-widest text-muted-foreground font-bold">{s.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Narrative sections — no empty placeholder boxes */}
            {narrative.map(({ key, label, s }, i) => {
              const sec = s!;
              const right = i % 2 === 1;
              const hasImg = !!sec.image_url;
              return (
                <section key={key} className={"container-page pb-14 " + (hasImg ? "grid grid-cols-1 md:grid-cols-2 gap-10 items-center" : "")}>
                  {hasImg && (
                    <div className={"rounded-2xl overflow-hidden aspect-[4/3] bg-secondary " + (right ? "md:order-2" : "")}>
                      <img src={sec.image_url} alt={sec.heading || label} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={hasImg ? "" : "max-w-3xl mx-auto text-center"}>
                    <div className="text-[11px] uppercase tracking-widest text-primary font-bold">{label}</div>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">{sec.heading}</h2>
                    {sec.body && <Rich text={sec.body} className="mt-4 text-muted-foreground whitespace-pre-line leading-relaxed" />}
                  </div>
                </section>
              );
            })}
          </>
        ) : (
          <TeamGrid />
        )}
      </div>

      <section className="bg-surface border-t border-border">
        <div className="container-page py-12 text-center">
          <h3 className="text-2xl font-black tracking-tight">Ready to ride with us?</h3>
          <p className="mt-2 text-muted-foreground">Shop parts or book a mobile mechanic today.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/products" className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold uppercase text-primary-foreground">Shop</Link>
            <Link to="/services" className="rounded-md border border-input px-5 py-2.5 text-sm font-bold uppercase">Book a service</Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
