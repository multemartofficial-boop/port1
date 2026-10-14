import { Bike, Car, Bus, Truck, Wrench, Cog, Zap, Ship, Plane, Tractor, Caravan, Bot } from "lucide-react";
import type { ComponentType } from "react";
import { DEFAULT_CATEGORY_PACKAGES, CATEGORY_KEYS, CATEGORY_LABELS, type CategoryPackages } from "./servicePackages";
import { DEFAULT_SLIDES, type SlideItem } from "./serviceSliders";

export type FieldType = "text" | "number" | "select" | "date";

export type CustomField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
};

export type TypePackage = {
  id: string;
  label: string;
  description: string;
  price: number;
  active: boolean;
};

export type ServiceType = {
  key: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
  slides: SlideItem[];
  packages: TypePackage[];
  fields: CustomField[];
};

export const ICON_OPTIONS = [
  "bike", "car", "motorbike", "truck", "bus", "tractor", "caravan", "ship", "plane", "wrench", "cog", "bolt", "robot",
] as const;

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  bike: Bike, car: Car, motorbike: Bike, truck: Truck, bus: Bus, tractor: Tractor,
  caravan: Caravan, ship: Ship, plane: Plane, wrench: Wrench, cog: Cog, bolt: Zap, robot: Bot,
};

export function iconFor(name: string): ComponentType<{ className?: string }> {
  return ICON_MAP[name] ?? Wrench;
}

const LEGACY_BLURBS: Record<string, string> = {
  cycle: "Bicycle & e-bike repairs and servicing",
  car: "Oil, filters, brake pads, wipers & more",
  motorcycle: "Chains, oil, brakes, tyres & MOT prep",
};
const LEGACY_ICONS: Record<string, string> = { cycle: "bike", car: "car", motorcycle: "motorbike" };

const VEHICLE_FIELDS: CustomField[] = [
  { id: "vehicle_reg", label: "Registration number", type: "text", required: true, options: [] },
  { id: "vehicle_brand", label: "Brand", type: "text", required: true, options: [] },
  { id: "vehicle_model", label: "Model", type: "text", required: true, options: [] },
];

export function slug(s: string): string {
  return (s || "type").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "type";
}

/** Build the initial service-type list from the legacy per-category settings. */
export function buildDefaultServiceTypes(
  packages: CategoryPackages = DEFAULT_CATEGORY_PACKAGES,
  slides: Record<string, SlideItem[]> = DEFAULT_SLIDES,
): ServiceType[] {
  return CATEGORY_KEYS.map(key => ({
    key,
    name: CATEGORY_LABELS[key],
    description: LEGACY_BLURBS[key] ?? "",
    icon: LEGACY_ICONS[key] ?? "wrench",
    active: true,
    slides: (slides[key] ?? []).map(s => ({ ...s })),
    packages: Object.entries(packages[key] ?? {}).map(([id, p]) => ({
      id, label: p.label, description: p.description, price: p.price, active: p.active !== false,
    })),
    fields: key === "cycle" ? [] : VEHICLE_FIELDS.map(f => ({ ...f })),
  }));
}

function normField(raw: unknown, i: number): CustomField | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = String(o.label ?? "").trim();
  if (!label) return null;
  const type = (["text", "number", "select", "date"] as string[]).includes(String(o.type)) ? (o.type as FieldType) : "text";
  return {
    id: String(o.id ?? `f${i}`),
    label,
    type,
    required: o.required !== false,
    options: Array.isArray(o.options) ? o.options.map(String).filter(Boolean) : [],
  };
}

export function normalizeServiceTypes(value: unknown): ServiceType[] {
  if (!Array.isArray(value)) return [];
  const out: ServiceType[] = [];
  value.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const o = raw as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) return;
    out.push({
      key: String(o.key ?? slug(name) + i),
      name,
      description: String(o.description ?? ""),
      icon: String(o.icon ?? "wrench"),
      active: o.active !== false,
      slides: Array.isArray(o.slides)
        ? (o.slides as unknown[]).map((s, j) => {
            const so = (s ?? {}) as Record<string, unknown>;
            return { id: String(so.id ?? `s${j}`), url: String(so.url ?? ""), alt: so.alt ? String(so.alt) : undefined };
          }).filter(s => s.url)
        : [],
      packages: Array.isArray(o.packages)
        ? (o.packages as unknown[]).map((p, j) => {
            const po = (p ?? {}) as Record<string, unknown>;
            return {
              id: String(po.id ?? `p${j}`),
              label: String(po.label ?? "Package"),
              description: String(po.description ?? ""),
              price: Number(po.price) || 0,
              active: po.active !== false,
            };
          })
        : [],
      fields: Array.isArray(o.fields) ? (o.fields as unknown[]).map(normField).filter(Boolean) as CustomField[] : [],
    });
  });
  return out;
}

/** Value stored on a booking for each admin-defined field. */
export type CustomFieldValue = { id: string; label: string; value: string };

export function normalizeCustomValues(value: unknown): CustomFieldValue[] {
  if (Array.isArray(value)) {
    return value
      .map((raw, i) => {
        const o = (raw ?? {}) as Record<string, unknown>;
        return { id: String(o.id ?? i), label: String(o.label ?? ""), value: String(o.value ?? "") };
      })
      .filter(v => v.label && v.value);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => ({ id: k, label: k, value: String(v ?? "") }))
      .filter(v => v.value);
  }
  return [];
}

export const truncate = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);
