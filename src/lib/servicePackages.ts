export type ServicePackage = {
  label: string;
  description: string;
  price: number;
  active?: boolean;
};
export type PackageMap = Record<string, ServicePackage>;
export type CategoryKey = "cycle" | "car" | "motorcycle";
export type CategoryPackages = Record<CategoryKey, PackageMap>;

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  cycle: "Cycle Service",
  car: "Car Service",
  motorcycle: "Motorcycle Service",
};
export const CATEGORY_KEYS: CategoryKey[] = ["cycle", "car", "motorcycle"];
/** Categories that require vehicle registration / brand / model details. */
export const VEHICLE_CATEGORIES: CategoryKey[] = ["car", "motorcycle"];

export const DEFAULT_CATEGORY_PACKAGES: CategoryPackages = {
  cycle: {
    emergency: { label: "Emergency Fix", description: "Puncture, snapped chain, quick repair", price: 35, active: true },
    silver: { label: "Silver Service", description: "Safety check + drivetrain clean & degrease", price: 75, active: true },
    gold: { label: "Gold Service", description: "Full workshop overhaul, bearings, cables", price: 120, active: true },
    mobile_bike: { label: "Mobile Service – Bicycle / E-bike", description: "We come to your door", price: 60, active: true },
    roadside_puncture: { label: "Roadside Puncture", description: "Fast on-the-spot puncture fix", price: 25, active: true },
  },
  car: {
    mobile_car: { label: "Mobile Service – Car", description: "Basic mobile car servicing at your address", price: 90, active: true },
    oil_change: { label: "Oil & Filter Change", description: "Engine oil drain, refill and oil filter replacement", price: 65, active: true },
    filter_change: { label: "Filter Change", description: "Air / cabin / fuel filter replacement", price: 45, active: true },
    brake_pads: { label: "Brake Pad Change", description: "Front or rear brake pad replacement", price: 80, active: true },
    wipers: { label: "Wiper Blade Change", description: "Front and rear wiper blade fitting", price: 20, active: true },
    battery: { label: "Battery Check & Replace", description: "Battery health test and replacement if needed", price: 55, active: true },
  },
  motorcycle: {
    moto_mobile: { label: "Mobile Service – Motorcycle", description: "Motorcycle servicing at your address", price: 85, active: true },
    moto_oil: { label: "Oil & Filter Change", description: "Engine oil drain, refill and oil filter replacement", price: 60, active: true },
    moto_chain: { label: "Chain & Sprocket Service", description: "Clean, adjust or replace chain and sprockets", price: 55, active: true },
    moto_brakes: { label: "Brake Pad Change", description: "Front or rear brake pad replacement", price: 70, active: true },
    moto_tyre: { label: "Tyre Fit / Puncture Repair", description: "Tyre replacement or puncture repair", price: 45, active: true },
    moto_mot_prep: { label: "MOT Prep Check", description: "Full pre-MOT safety inspection", price: 50, active: true },
  },
};

/** Accepts legacy flat shape (all cycle) or the new per-category shape. */
export function normalizePackages(value: unknown): CategoryPackages {
  const base: CategoryPackages = {
    cycle: { ...DEFAULT_CATEGORY_PACKAGES.cycle },
    car: { ...DEFAULT_CATEGORY_PACKAGES.car },
    motorcycle: { ...DEFAULT_CATEGORY_PACKAGES.motorcycle },
  };
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  if (v.cycle || v.car || v.motorcycle) {
    return {
      cycle: { ...base.cycle, ...((v.cycle as PackageMap) ?? {}) },
      car: { ...base.car, ...((v.car as PackageMap) ?? {}) },
      motorcycle: { ...base.motorcycle, ...((v.motorcycle as PackageMap) ?? {}) },
    };
  }
  // legacy flat map — treat car-ish keys as car, rest as cycle
  const flat = v as PackageMap;
  const out: CategoryPackages = { cycle: {}, car: {}, motorcycle: {} };
  for (const [k, pkg] of Object.entries(flat)) {
    if (!pkg || typeof pkg !== "object") continue;
    const target: CategoryKey = k.includes("moto") ? "motorcycle" : k.includes("car") ? "car" : "cycle";
    out[target][k] = { active: true, ...pkg };
  }
  return {
    cycle: Object.keys(out.cycle).length ? out.cycle : base.cycle,
    car: Object.keys(out.car).length ? { ...base.car, ...out.car } : base.car,
    motorcycle: Object.keys(out.motorcycle).length ? { ...base.motorcycle, ...out.motorcycle } : base.motorcycle,
  };
}

export function activeEntries(map: PackageMap): [string, ServicePackage][] {
  return Object.entries(map ?? {}).filter(([, p]) => p.active !== false);
}
