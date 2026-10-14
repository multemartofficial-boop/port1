import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { Wrench, ShieldCheck, Clock, MapPin, PhoneCall, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/services/details")({
  head: () => ({
    meta: [
      { title: "Service details — Yours Home Servicing" },
      {
        name: "description",
        content:
          "How our mobile mechanic service works: transparent pricing, qualified mechanics, same-week slots.",
      },
      { property: "og:title", content: "Service details — Yours Home Servicing" },
      {
        property: "og:description",
        content:
          "How our mobile mechanic service works: transparent pricing, qualified mechanics, same-week slots.",
      },
    ],
  }),
  component: ServicesDetails,
});

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Qualified mechanics",
    body: "Cytech-trained pros with insurance and DBS checks.",
  },
  {
    icon: MapPin,
    title: "We come to you",
    body: "Home, office or roadside — Bristol and surrounding areas.",
  },
  {
    icon: Clock,
    title: "Same-week slots",
    body: "Book online in under 2 minutes. Evening & weekend slots available.",
  },
  {
    icon: Wrench,
    title: "Full workshop kit",
    body: "Professional tools, spare parts on van, no compromises.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Choose a service",
    body: "Pick from Emergency Fix, Silver, Gold, Mobile Bike/E-bike, Mobile Car or Roadside Puncture.",
  },
  {
    n: "2",
    title: "Pick a time",
    body: "Select a date and time slot that suits you. We confirm within an hour.",
  },
  {
    n: "3",
    title: "We come to you",
    body: "Our mechanic arrives with the workshop. Most jobs done on the spot.",
  },
  {
    n: "4",
    title: "Pay securely",
    body: "Card payment upfront via Stripe. 14-day free re-visit guarantee.",
  },
];

function ServicesDetails() {
  return (
    <SiteLayout>
      <section className="bg-ink text-ink-foreground">
        <div className="container-page py-14">
          <div className="text-[11px] uppercase tracking-widest text-primary font-bold">
            Service
          </div>
          <h1 className="mt-2 text-4xl md:text-5xl font-black tracking-tight max-w-2xl">
            Mobile bike & home servicing done right.
          </h1>
          <p className="mt-4 text-white/70 max-w-xl">
            Transparent pricing, qualified mechanics and same-week availability. Available for
            Bristol and surrounding areas.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              to="/services"
              className="rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground"
            >
              Book now
            </Link>
            <a
              href="tel:+447700900123"
              className="rounded-md border border-white/25 px-5 py-3 text-sm font-bold uppercase inline-flex items-center gap-2"
            >
              <PhoneCall className="h-4 w-4" /> Call us
            </a>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">Why choose Yours</h2>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border p-5 bg-card">
              <div className="h-10 w-10 grid place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-bold">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface border-y border-border">
        <div className="container-page py-14">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">How it works</h2>
          <ol className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-lg border border-border p-5 bg-card">
                <div className="h-8 w-8 grid place-items-center rounded-full bg-primary text-primary-foreground font-black">
                  {s.n}
                </div>
                <div className="mt-3 font-bold">{s.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">What's included</h2>
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          {[
            "Safety inspection",
            "Brake adjustment",
            "Gear indexing",
            "Drivetrain clean & lube",
            "Wheel truing",
            "Tyre pressure check",
            "14-day re-visit guarantee",
            "Genuine parts only",
          ].map((x) => (
            <li key={x} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" /> {x}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container-page py-12 text-center">
          <h3 className="text-2xl font-black tracking-tight">Ready to book?</h3>
          <p className="mt-2 opacity-90">Get your one — sorted this week.</p>
          <div className="mt-6">
            <Link
              to="/services"
              className="rounded-md bg-white text-primary px-6 py-3 text-sm font-black uppercase"
            >
              Book Your One
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
