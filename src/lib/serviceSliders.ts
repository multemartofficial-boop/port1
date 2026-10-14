import { CATEGORY_KEYS, type CategoryKey } from "./servicePackages";
import cycle1 from "@/assets/service-cycle-1.jpg";
import cycle2 from "@/assets/service-cycle-2.jpg";
import car1 from "@/assets/service-car-1.jpg";
import car2 from "@/assets/service-car-2.jpg";
import moto1 from "@/assets/service-moto-1.jpg";
import moto2 from "@/assets/service-moto-2.jpg";

export type SlideItem = { id: string; url: string; alt?: string };
export type CategorySlides = Record<CategoryKey, SlideItem[]>;

export const EMPTY_SLIDES: CategorySlides = { cycle: [], car: [], motorcycle: [] };

/** Shown on the storefront when an admin hasn't uploaded slides for a category. */
export const DEFAULT_SLIDES: CategorySlides = {
  cycle: [
    { id: "d-cycle-1", url: cycle1, alt: "Bike mechanic servicing a road bike in the workshop" },
    { id: "d-cycle-2", url: cycle2, alt: "Mobile bike service van at a customer's door" },
  ],
  car: [
    { id: "d-car-1", url: car1, alt: "Mechanic performing an oil and filter change" },
    { id: "d-car-2", url: car2, alt: "Mechanic replacing brake pads on a car" },
  ],
  motorcycle: [
    { id: "d-moto-1", url: moto1, alt: "Mechanic servicing a motorcycle in the workshop" },
    { id: "d-moto-2", url: moto2, alt: "Mobile motorcycle mechanic working at a customer's driveway" },
  ],
};

export function normalizeSlides(value: unknown): CategorySlides {
  const out: CategorySlides = { cycle: [], car: [], motorcycle: [] };
  if (!value || typeof value !== "object") return out;
  const v = value as Record<string, unknown>;
  for (const key of CATEGORY_KEYS) {
    const arr = Array.isArray(v[key]) ? (v[key] as unknown[]) : [];
    out[key] = arr
      .map((raw, i) => {
        if (typeof raw === "string") return { id: `${key}-${i}`, url: raw };
        const o = (raw ?? {}) as Record<string, unknown>;
        return { id: String(o.id ?? `${key}-${i}`), url: String(o.url ?? ""), alt: o.alt ? String(o.alt) : undefined };
      })
      .filter(s => s.url);
  }
  return out;
}
