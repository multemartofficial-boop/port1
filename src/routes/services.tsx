import { staticPageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { gbp } from "@/lib/format";
import { Wrench, MapPin, Phone, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { normalizePackages } from "@/lib/servicePackages";
import { DEFAULT_SLIDES, normalizeSlides } from "@/lib/serviceSliders";
import {
  buildDefaultServiceTypes,
  iconFor,
  normalizeServiceTypes,
  truncate,
  type CustomFieldValue,
  type ServiceType,
} from "@/lib/serviceTypes";

function CategorySlider({ slides }: { slides: { id: string; url: string; alt?: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [slides.map((s) => s.id).join(",")]);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);
  if (!slides.length) return null;
  const go = (d: number) => setI((p) => (p + d + slides.length) % slides.length);
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20 group">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {slides.map((s) => (
          <img
            key={s.id}
            src={s.url}
            alt={s.alt ?? ""}
            loading="lazy"
            className="w-full shrink-0 object-cover h-[180px] sm:h-[240px] md:h-[300px]"
          />
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Go to image ${idx + 1}`}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (idx === i ? "w-6 bg-primary" : "w-1.5 bg-white/60")
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const Route = createFileRoute("/services")({
  loader: () =>
    staticPageHead("services", {
      title: "Book a Service — Cycle, Car & Motorcycle",
      description:
        "Book a qualified mobile mechanic for your bike, car or motorcycle across Bristol and surrounding areas.",
      path: "/services",
    }),
  head: ({ loaderData }) => loaderData?.seo ?? {},
  component: Services,
});

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
type BookingDay = { open: boolean; start: string; end: string };
type BookingHours = { interval_minutes: number; days: Record<DayKey, BookingDay> };
const DEFAULT_BOOKING_HOURS: BookingHours = {
  interval_minutes: 60,
  days: {
    mon: { open: true, start: "09:00", end: "18:00" },
    tue: { open: true, start: "09:00", end: "18:00" },
    wed: { open: true, start: "09:00", end: "18:00" },
    thu: { open: true, start: "09:00", end: "18:00" },
    fri: { open: true, start: "09:00", end: "18:00" },
    sat: { open: true, start: "09:00", end: "18:00" },
    sun: { open: true, start: "09:00", end: "18:00" },
  },
};
const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function to12h(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  const h = Number(hStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}
function buildSlots(day: BookingDay, interval: number): string[] {
  const [sh, sm] = day.start.split(":").map(Number);
  const [eh, em] = day.end.split(":").map(Number);
  const startMin = sh * 60 + sm,
    endMin = eh * 60 + em;
  const step = interval > 0 ? interval : 60;
  const out: string[] = [];
  for (let t = startMin; t <= endMin; t += step) {
    const hh = String(Math.floor(t / 60)).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}
const norm = (t: string) => t.slice(0, 5);

function Services() {
  const { user } = useAuth();

  const [types, setTypes] = useState<ServiceType[]>([]);
  const [hours, setHours] = useState<BookingHours>(DEFAULT_BOOKING_HOURS);
  const [categoryKey, setCategoryKey] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});

  const [booked, setBooked] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: user?.email ?? "",
    phone: "",
    service_type: "" as string,
    scheduled_date: "",
    scheduled_time: "",
    address: "",
    postcode: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key,value")
        .in("key", ["service_types", "service_packages", "service_sliders", "booking_hours"]);
      const byKey = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value]));
      const existing = normalizeServiceTypes(byKey["service_types"]).filter((t) => t.active);
      setTypes(
        existing.length
          ? existing
          : buildDefaultServiceTypes(
              normalizePackages(byKey["service_packages"] ?? {}),
              normalizeSlides(byKey["service_sliders"] ?? {}),
            ),
      );
      const v = byKey["booking_hours"] as Partial<BookingHours> | undefined;
      if (v && v.days)
        setHours({
          interval_minutes: v.interval_minutes ?? 60,
          days: { ...DEFAULT_BOOKING_HOURS.days, ...v.days },
        });
    })();
  }, []);

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, email: user.email ?? "" }));
  }, [user]);

  useEffect(() => {
    if (!types.length) return;
    if (!types.some((t) => t.key === categoryKey)) setCategoryKey(types[0].key);
  }, [types, categoryKey]);

  const activeType = useMemo(
    () => types.find((t) => t.key === categoryKey) ?? null,
    [types, categoryKey],
  );
  const catPackages = useMemo(
    () => (activeType?.packages ?? []).filter((p) => p.active !== false),
    [activeType],
  );

  useEffect(() => {
    setCustom({});
    setExpanded(null);
    if (!catPackages.length) {
      setForm((f) => ({ ...f, service_type: "" }));
      return;
    }
    setForm((f) =>
      catPackages.some((p) => p.id === f.service_type)
        ? f
        : { ...f, service_type: catPackages[0].id },
    );
  }, [categoryKey, catPackages.map((p) => p.id).join(",")]);

  const selectedDayKey: DayKey | null = form.scheduled_date
    ? DAY_KEYS[new Date(form.scheduled_date + "T00:00:00").getDay()]
    : null;
  const selectedDay = selectedDayKey ? hours.days[selectedDayKey] : null;
  const dayIsOpen = !!selectedDay?.open;
  const slots = dayIsOpen && selectedDay ? buildSlots(selectedDay, hours.interval_minutes) : [];

  const refreshBooked = useCallback(async (date: string) => {
    if (!date) {
      setBooked([]);
      return;
    }
    setLoadingSlots(true);
    const { data, error } = await supabase.rpc("get_booked_slots", { p_date: date });
    setLoadingSlots(false);
    if (error) {
      setBooked([]);
      return;
    }
    setBooked(((data ?? []) as { scheduled_time: string }[]).map((r) => norm(r.scheduled_time)));
  }, []);

  useEffect(() => {
    refreshBooked(form.scheduled_date);
  }, [form.scheduled_date, refreshBooked]);

  const isTaken = (t: string) => booked.includes(norm(t));
  const freeSlots = slots.filter((t) => !isTaken(t));

  useEffect(() => {
    if (!dayIsOpen && form.scheduled_time) setForm((f) => ({ ...f, scheduled_time: "" }));
    else if (dayIsOpen && !freeSlots.includes(form.scheduled_time))
      setForm((f) => ({ ...f, scheduled_time: freeSlots[0] ?? "" }));
  }, [form.scheduled_date, dayIsOpen, freeSlots.join(","), booked.join(",")]);

  const priceFor = (id: string) => catPackages.find((p) => p.id === id)?.price ?? 0;
  const fields = activeType?.fields ?? [];

  const slides = activeType?.slides?.length
    ? activeType.slides
    : (DEFAULT_SLIDES[categoryKey as keyof typeof DEFAULT_SLIDES] ?? []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeType) {
      toast.error("Please choose a service type.");
      return;
    }
    if (!form.service_type) {
      toast.error("Please choose a service package.");
      return;
    }
    if (!form.postcode.trim()) {
      toast.error("Please enter your postcode.");
      return;
    }
    for (const f of fields) {
      if (f.required && !(custom[f.id] ?? "").trim()) {
        toast.error(`Please enter ${f.label.toLowerCase()}.`);
        return;
      }
    }
    if (!dayIsOpen || !form.scheduled_time) {
      toast.error("Please pick an open date and time slot.");
      return;
    }
    if (isTaken(form.scheduled_time)) {
      toast.error("Sorry, this time slot was just booked. Please choose another time.");
      return;
    }
    setBusy(true);

    const values: CustomFieldValue[] = fields
      .map((f) => ({ id: f.id, label: f.label, value: (custom[f.id] ?? "").trim() }))
      .filter((v) => v.value);
    const byId = Object.fromEntries(values.map((v) => [v.id, v.value]));
    const pkg = catPackages.find((p) => p.id === form.service_type);

    const bookingId = crypto.randomUUID();
    // Do NOT use .select() here — anon users can't read back via RLS. Generate the id client-side instead.
    const { error } = await supabase.from("service_bookings").insert({
      id: bookingId,
      user_id: user?.id ?? null,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      category: activeType.key,
      service_type: pkg?.label ?? form.service_type,
      price: priceFor(form.service_type),
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time,
      address: `${form.address.trim()}, ${form.postcode.trim().toUpperCase()}`,
      notes: form.notes,
      custom_fields: values,
      vehicle_reg: byId["vehicle_reg"]?.toUpperCase() ?? null,
      vehicle_brand: byId["vehicle_brand"] ?? null,
      vehicle_model: byId["vehicle_model"] ?? null,
    });
    setBusy(false);
    if (error) {
      const dup =
        error.code === "23505" ||
        /duplicate key|service_bookings_slot_unique/i.test(error.message ?? "");
      if (dup) {
        toast.error("Sorry, this time slot was just booked. Please choose another time.");
        refreshBooked(form.scheduled_date);
      } else toast.error(error.message ?? "Failed");
      return;
    }
    // Fire-and-forget: notify admin + customer of new booking
    supabase.functions
      .invoke("send-booking-email", { body: { booking_id: bookingId, kind: "placed" } })
      .catch(() => {});
    toast.success("Booking received — we'll call you shortly to confirm.");
    refreshBooked(form.scheduled_date);
    setCustom({});
    setForm((f) => ({
      ...f,
      full_name: "",
      phone: "",
      address: "",
      postcode: "",
      notes: "",
      scheduled_date: "",
      scheduled_time: "",
    }));
  };

  return (
    <SiteLayout>
      <section className="bg-ink text-ink-foreground">
        <div className="container-page py-10 md:py-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-center">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-primary font-bold">
              Home Service
            </div>
            <h1 className="mt-2 text-4xl md:text-5xl font-black tracking-tight">Book Your One</h1>
            <p className="mt-3 text-white/70 max-w-xl">
              Qualified mechanics come to your door — pick a service type and slot below.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/30 px-3 py-1.5 text-sm text-primary-foreground">
              <MapPin className="h-3.5 w-3.5" /> Available for Bristol and surrounding areas.
            </div>
          </div>
          <div key={categoryKey} className="animate-in fade-in duration-500">
            <CategorySlider slides={slides} />
          </div>
        </div>
      </section>

      <div className="bg-primary/10 border-b border-primary/20">
        <div className="container-page py-3 flex items-center gap-2 text-sm text-foreground">
          <Phone className="h-4 w-4 text-primary shrink-0" />
          <span>
            <strong>Heads up:</strong> submitting this form doesn't confirm your slot instantly —
            we'll call you shortly to confirm your booking.
          </span>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="container-page py-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px] gap-8"
      >
        <div className="min-w-0 space-y-6">
          <div className="text-center">
            <div className="font-bold uppercase text-xs tracking-widest mb-3 text-muted-foreground">
              What do you need serviced?
            </div>
            {/* Mobile: clean 2-column grid of pills (no horizontal scroll) */}
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {types.map((t) => {
                const Icon = iconFor(t.icon);
                const on = t.key === categoryKey;
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => setCategoryKey(t.key)}
                    className={
                      "flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-bold transition-all duration-300 " +
                      (on
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-ink text-white/70 active:scale-[0.98]")
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Desktop / tablet: pill switcher, swipe-scrollable if many types */}
            <div
              className="hidden sm:block mx-auto max-w-full overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
            >
              <div className="inline-flex min-w-max gap-1 rounded-full bg-ink p-1.5">
                {types.map((t) => {
                  const Icon = iconFor(t.icon);
                  const on = t.key === categoryKey;
                  return (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => setCategoryKey(t.key)}
                      style={{ scrollSnapAlign: "center" }}
                      className={
                        "flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 " +
                        (on
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "text-white/70 hover:text-white")
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {activeType?.description && (
              <p className="mt-3 text-sm text-muted-foreground">{activeType.description}</p>
            )}
          </div>

          <div key={categoryKey} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="font-bold uppercase text-xs tracking-widest mb-3">Choose a package</div>
            {catPackages.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                No packages available for this service type yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                {catPackages.map((pkg) => {
                  const long = pkg.description.length > 90;
                  const open = expanded === pkg.id;
                  return (
                    <label
                      key={pkg.id}
                      className={
                        "flex h-full flex-col rounded-md border p-4 cursor-pointer transition " +
                        (form.service_type === pkg.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50")
                      }
                    >
                      <input
                        type="radio"
                        name="svc"
                        className="sr-only"
                        value={pkg.id}
                        checked={form.service_type === pkg.id}
                        onChange={() => setForm((f) => ({ ...f, service_type: pkg.id }))}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 font-bold">{pkg.label}</div>
                        <div className="shrink-0 text-lg font-black text-primary">
                          {gbp(pkg.price)}
                        </div>
                      </div>
                      <div
                        className="mt-1 flex-1 text-xs text-muted-foreground"
                        title={pkg.description}
                      >
                        {open ? pkg.description : truncate(pkg.description, 90)}
                      </div>
                      {long && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpanded(open ? null : pkg.id);
                          }}
                          className="mt-2 self-start text-[11px] font-bold uppercase tracking-widest text-primary"
                        >
                          {open ? "Show less" : "Read more"}
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-5 bg-card space-y-3">
            <div className="font-bold uppercase text-xs tracking-widest">Your details</div>
            <input
              required
              placeholder="Full name"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="in"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="in"
              />
              <input
                required
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="in"
              />
            </div>
            <input
              required
              placeholder="Address (where the mechanic should come)"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="in"
            />
            <input
              required
              placeholder="Postcode (required)"
              value={form.postcode}
              onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
              maxLength={12}
              autoComplete="postal-code"
              className="in uppercase"
            />

            {fields.length > 0 && (
              <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-3">
                <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                  {activeType?.name} details
                </div>
                {fields.map((f) =>
                  f.type === "select" ? (
                    <select
                      key={f.id}
                      required={f.required}
                      value={custom[f.id] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.id]: e.target.value }))}
                      className="in"
                    >
                      <option value="">
                        {f.label}
                        {f.required ? " *" : ""}
                      </option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={f.id}
                      required={f.required}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      placeholder={`${f.label}${f.required ? " *" : ""}`}
                      value={custom[f.id] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.id]: e.target.value }))}
                      className="in"
                    />
                  ),
                )}
              </div>
            )}

            <input
              required
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
              min={new Date().toISOString().slice(0, 10)}
              className="in"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                  Pick a time slot
                </span>
                {form.scheduled_date && (
                  <button
                    type="button"
                    onClick={() => refreshBooked(form.scheduled_date)}
                    className="inline-flex items-center gap-1 text-xs text-primary font-bold"
                  >
                    <RefreshCw className={"h-3 w-3 " + (loadingSlots ? "animate-spin" : "")} />{" "}
                    Refresh
                  </button>
                )}
              </div>
              {!form.scheduled_date && (
                <p className="text-xs text-muted-foreground">
                  Pick a date first to see available times.
                </p>
              )}
              {form.scheduled_date && !dayIsOpen && (
                <p className="text-xs text-destructive">
                  We're closed on this day — please pick another date.
                </p>
              )}
              {dayIsOpen && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((t) => {
                    const taken = isTaken(t);
                    const on = form.scheduled_time === t;
                    return (
                      <button
                        type="button"
                        key={t}
                        disabled={taken}
                        onClick={() => setForm((f) => ({ ...f, scheduled_time: t }))}
                        className={
                          "rounded-md border px-2 py-2 text-xs font-bold transition " +
                          (taken
                            ? "border-border bg-muted text-muted-foreground line-through cursor-not-allowed opacity-60"
                            : on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/60")
                        }
                        title={taken ? "Already booked" : undefined}
                      >
                        {to12h(t)}
                      </button>
                    );
                  })}
                </div>
              )}
              {dayIsOpen && slots.length > 0 && freeSlots.length === 0 && (
                <p className="text-xs text-destructive">
                  All slots on this date are booked — please pick another date.
                </p>
              )}
            </div>

            <textarea
              placeholder="Notes (symptoms, gate code…)"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="in"
            />
          </div>
        </div>
        <aside className="h-fit rounded-lg border border-border p-5 bg-card space-y-4 md:sticky md:top-24">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-full bg-primary/10 text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                Total
              </div>
              <div className="text-2xl font-black">{gbp(priceFor(form.service_type))}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {activeType?.name ?? ""}
            {form.scheduled_time ? ` · ${to12h(form.scheduled_time)}` : ""}
          </div>
          <div className="text-xs text-muted-foreground">
            No payment now — we confirm by phone. Free re-visit within 14 days if the issue
            re-occurs.
          </div>
          <button
            disabled={busy || !form.scheduled_time}
            className="w-full rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit booking request"}
          </button>
        </aside>
      </form>
    </SiteLayout>
  );
}
