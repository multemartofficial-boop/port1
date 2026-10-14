// ─────────────────────────────────────────────────────────────────────────────
// DEMO SUPABASE CLIENT — portfolio showcase build.
//
// Drop-in replacement for @supabase/supabase-js. Implements the subset of the
// supabase-js API this app uses — table queries (with PostgREST-style embedded
// selects), mutations, auth, storage, rpc and edge-function invocation — backed
// by an in-memory store seeded from demo-data.ts and persisted to localStorage.
//
// No network calls are ever made. All data is fictional demo data.
// ─────────────────────────────────────────────────────────────────────────────

import { DEMO_USERS, SEED_TABLES, type DemoUser } from "./demo-data";

type Row = Record<string, unknown>;
type Result<T = unknown> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
  status?: number;
  statusText?: string;
};

// ── persistence ───────────────────────────────────────────────────────────────

const DB_KEY = "demo_db_v1";
const USERS_KEY = "demo_users_v1";
const AUTH_KEY = "demo_auth_v1";
const STORAGE_KEY = "demo_storage_v1";

const hasLS = () => typeof window !== "undefined" && !!window.localStorage;

function loadJSON<T>(key: string, fallback: T): T {
  if (!hasLS()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, value: unknown) {
  if (!hasLS()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

const tables: Record<string, Row[]> = loadJSON(DB_KEY, structuredClone(SEED_TABLES));
const users: DemoUser[] = loadJSON(USERS_KEY, [...DEMO_USERS]);
const objects: Record<string, string> = loadJSON(STORAGE_KEY, {});
let session: DemoSession | null = loadJSON(AUTH_KEY, null);

const persistTables = () => saveJSON(DB_KEY, tables);
const persistUsers = () => saveJSON(USERS_KEY, users);
const persistObjects = () => saveJSON(STORAGE_KEY, objects);
const persistSession = () => saveJSON(AUTH_KEY, session);

// ── relationships (parentTable → childTable → fk column on parent) ───────────

const FK: Record<string, Record<string, string>> = {
  products: { brands: "brand_id", categories: "category_id", sub_categories: "sub_category_id" },
  product_variants: { products: "product_id" },
  order_items: { orders: "order_id", products: "product_id", product_variants: "variant_id" },
  order_status_events: { orders: "order_id" },
  refund_requests: { orders: "order_id" },
  reviews: { products: "product_id" },
  sub_categories: { categories: "category_id" },
  team_members: { departments: "department_id" },
  user_roles: { staff_roles: "staff_role_id" },
  wishlist: { products: "product_id" },
};

const UNIQUE_COLS: Record<string, string[]> = {
  site_settings: ["key"],
  newsletter_subscribers: ["email"],
  coupons: ["code"],
  products: ["slug"],
  categories: ["slug"],
  brands: ["slug"],
  sub_categories: ["slug"],
  orders: ["order_number"],
};

const rows = (t: string): Row[] => (tables[t] ??= []);

const ok = <T>(data: T | null, count: number | null = null): Result<T> => ({
  data,
  error: null,
  count,
  status: 200,
  statusText: "OK",
});
const fail = (message: string, code?: string): Result<never> => ({
  data: null,
  error: { message, code },
  count: null,
  status: 400,
  statusText: "Bad Request",
});
const dupError = (constraint: string) =>
  fail(`duplicate key value violates unique constraint "${constraint}"`, "23505");

// ── select-spec parsing ───────────────────────────────────────────────────────

type SelectCol = { name: string; alias: string };
type Embed = { key: string; table: string; inner: boolean; spec: SelectSpec };
type SelectSpec = { star: boolean; cols: SelectCol[]; embeds: Embed[] };

function splitTop(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0,
    cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== "" || out.length === 0) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseSelect(spec: string | undefined): SelectSpec {
  const out: SelectSpec = { star: false, cols: [], embeds: [] };
  if (!spec || spec.trim() === "" || spec.trim() === "*") {
    out.star = true;
    return out;
  }
  for (const tok of splitTop(spec)) {
    if (tok === "*") {
      out.star = true;
      continue;
    }
    const m = /^(?:(\w+)\s*:\s*)?(\w+)(\s*!\s*inner)?\s*\(([\s\S]*)\)$/.exec(tok);
    if (m) {
      const [, alias, table, inner, innerSpec] = m;
      out.embeds.push({ key: alias ?? table, table, inner: !!inner, spec: parseSelect(innerSpec) });
      continue;
    }
    const cm = /^(\w+)\s*:\s*(\w+)$/.exec(tok);
    out.cols.push(cm ? { name: cm[2], alias: cm[1] } : { name: tok, alias: tok });
  }
  return out;
}

// ── filter evaluation ────────────────────────────────────────────────────────

type Cond = { col: string; op: string; val: unknown };

const looseEq = (a: unknown, b: unknown): boolean =>
  a === b || (a != null && b != null && String(a) === String(b));

function cmp(a: unknown, b: unknown): number {
  const an = typeof a === "number" ? a : Number(a);
  const bn = typeof b === "number" ? b : Number(b);
  if (
    !Number.isNaN(an) &&
    !Number.isNaN(bn) &&
    a !== null &&
    b !== null &&
    typeof a !== "boolean" &&
    typeof b !== "boolean"
  )
    return an - bn;
  const as = String(a ?? ""),
    bs = String(b ?? "");
  return as < bs ? -1 : as > bs ? 1 : 0;
}

const likeToRe = (pat: string, ci: boolean) =>
  new RegExp(
    "^" +
      pat
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".") +
      "$",
    ci ? "i" : "",
  );

function evalCond(row: Row, cond: Cond): boolean {
  const v = row[cond.col];
  const val = cond.val;
  switch (cond.op) {
    case "eq":
      return looseEq(v, val);
    case "neq":
      return !looseEq(v, val);
    case "gt":
      return cmp(v, val) > 0;
    case "gte":
      return cmp(v, val) >= 0;
    case "lt":
      return cmp(v, val) < 0;
    case "lte":
      return cmp(v, val) <= 0;
    case "in":
      return Array.isArray(val) ? val.some((x) => looseEq(v, x)) : false;
    case "is":
      return val === null ? v == null : looseEq(v, val);
    case "like":
      return typeof v === "string" && likeToRe(String(val), false).test(v);
    case "ilike":
      return typeof v === "string" && likeToRe(String(val), true).test(v);
    case "contains": {
      if (Array.isArray(v) && Array.isArray(val)) return val.every((x) => v.includes(x));
      if (v && typeof v === "object" && val && typeof val === "object")
        return Object.entries(val as Row).every(([k, x]) => looseEq((v as Row)[k], x));
      return looseEq(v, val);
    }
    case "not": {
      const inner = val as { op: string; val: unknown };
      return !evalCond(row, { col: cond.col, op: inner.op, val: inner.val });
    }
    default:
      return true;
  }
}

function relCond(table: string, row: Row, cond: Cond): boolean {
  const [relTable, ...rest] = cond.col.split(".");
  const path = rest.join(".");
  const fk = FK[table]?.[relTable];
  if (fk) {
    const rel = rows(relTable).find((r) => looseEq(r.id, row[fk]));
    return rel != null && evalCond(rel, { col: path, op: cond.op, val: cond.val });
  }
  const childFk = FK[relTable]?.[table];
  if (childFk) {
    return rows(relTable).some(
      (r) => looseEq(r[childFk], row.id) && evalCond(r, { col: path, op: cond.op, val: cond.val }),
    );
  }
  return false;
}

function matchRow(table: string, row: Row, conds: Cond[]): boolean {
  return conds.every((c) => {
    if (c.op === "or")
      return (c.val as Cond[]).some((inner) =>
        inner.col.includes(".") ? relCond(table, row, inner) : evalCond(row, inner),
      );
    return c.col.includes(".") ? relCond(table, row, c) : evalCond(row, c);
  });
}

function parseOr(expr: string): Cond[] {
  let s = expr.trim();
  if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1);
  return splitTop(s).map((part) => {
    const m = /^([\w.]+)\.(\w+)\.([\s\S]*)$/.exec(part);
    if (!m) return { col: part, op: "eq", val: true };
    const [, c, op, raw] = m;
    let val: unknown = raw;
    if (op === "in")
      val = raw
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((x) => coerce(x.trim()));
    else val = coerce(raw);
    return { col: c, op, val };
  });
}
const coerce = (s: string): unknown =>
  s === "null"
    ? null
    : s === "true"
      ? true
      : s === "false"
        ? false
        : s !== "" && !Number.isNaN(Number(s))
          ? Number(s)
          : s;

// ── projection / embedding ───────────────────────────────────────────────────

function resolveEmbed(table: string, row: Row, e: Embed): unknown {
  const fk = FK[table]?.[e.table];
  if (fk) {
    const rel = rows(e.table).find((r) => looseEq(r.id, row[fk]));
    return rel ? project(e.table, rel, e.spec) : null;
  }
  const childFk = FK[e.table]?.[table];
  if (childFk) {
    return rows(e.table)
      .filter((r) => looseEq(r[childFk], row.id))
      .map((r) => project(e.table, r, e.spec));
  }
  return null;
}

function project(table: string, row: Row, spec: SelectSpec): Row {
  const out: Row = {};
  if (spec.star) Object.assign(out, row);
  for (const c of spec.cols) out[c.alias] = row[c.name];
  for (const e of spec.embeds) out[e.key] = resolveEmbed(table, row, e);
  return out;
}

// ── defaults & uniqueness ────────────────────────────────────────────────────

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
const nowISO = () => new Date().toISOString();

function applyDefaults(table: string, r: Row): Row {
  const out = { ...r };
  if (table !== "site_settings" && out.id == null) out.id = uuid();
  const colSet = new Set(rows(table).flatMap((x) => Object.keys(x)));
  if ((colSet.has("created_at") || colSet.size === 0) && out.created_at == null)
    out.created_at = nowISO();
  if ((colSet.has("updated_at") || colSet.size === 0) && out.updated_at == null)
    out.updated_at = nowISO();
  if (table === "newsletter_subscribers" && out.subscribed_at == null) out.subscribed_at = nowISO();
  if (table === "newsletter_subscribers" && out.active == null) out.active = true;
  if (table === "blog_posts" && out.published_at == null) out.published_at = nowISO();
  if (table === "orders") {
    if (out.access_token == null) out.access_token = uuid();
    if (out.order_number == null)
      out.order_number = `YRS-${String(Math.floor(100000 + Math.random() * 899999))}`;
  }
  if (table === "service_bookings" && out.booking_number == null) {
    const max = rows(table).reduce(
      (m, x) => Math.max(m, Number(String(x.booking_number ?? "").replace(/\D/g, "")) || 0),
      1000,
    );
    out.booking_number = `BK-${max + 1}`;
  }
  if (table === "site_settings" && out.updated_at == null) out.updated_at = nowISO();
  return out;
}

function checkUnique(table: string, r: Row, exclude?: Row): Result<never> | null {
  for (const col of UNIQUE_COLS[table] ?? []) {
    if (r[col] == null) continue;
    if (rows(table).some((x) => x !== exclude && looseEq(x[col], r[col])))
      return dupError(`${table}_${col}_key`);
  }
  if (table === "service_bookings" && r.status !== "cancelled") {
    const clash = rows(table).some(
      (x) =>
        x !== exclude &&
        x.scheduled_date === r.scheduled_date &&
        x.scheduled_time === r.scheduled_time &&
        x.status !== "cancelled",
    );
    if (clash) return dupError("service_bookings_slot_unique");
  }
  return null;
}

// ── query builder ────────────────────────────────────────────────────────────

type Mutation = {
  type: "insert" | "update" | "upsert" | "delete";
  rows?: Row[];
  patch?: Row;
  onConflict?: string;
};

class QB implements PromiseLike<Result> {
  private conds: Cond[] = [];
  private ords: { col: string; asc: boolean }[] = [];
  private lim?: number;
  private rng?: [number, number];
  private spec?: SelectSpec;
  private wantCount?: string;
  private wantHead = false;
  private singleMode: "none" | "single" | "maybe" = "none";
  private mut?: Mutation;

  constructor(private table: string) {}

  // filters
  eq(c: string, v: unknown) {
    this.conds.push({ col: c, op: "eq", val: v });
    return this;
  }
  neq(c: string, v: unknown) {
    this.conds.push({ col: c, op: "neq", val: v });
    return this;
  }
  gt(c: string, v: unknown) {
    this.conds.push({ col: c, op: "gt", val: v });
    return this;
  }
  gte(c: string, v: unknown) {
    this.conds.push({ col: c, op: "gte", val: v });
    return this;
  }
  lt(c: string, v: unknown) {
    this.conds.push({ col: c, op: "lt", val: v });
    return this;
  }
  lte(c: string, v: unknown) {
    this.conds.push({ col: c, op: "lte", val: v });
    return this;
  }
  in(c: string, v: unknown[]) {
    this.conds.push({ col: c, op: "in", val: v });
    return this;
  }
  is(c: string, v: unknown) {
    this.conds.push({ col: c, op: "is", val: v });
    return this;
  }
  like(c: string, v: string) {
    this.conds.push({ col: c, op: "like", val: v });
    return this;
  }
  ilike(c: string, v: string) {
    this.conds.push({ col: c, op: "ilike", val: v });
    return this;
  }
  contains(c: string, v: unknown) {
    this.conds.push({ col: c, op: "contains", val: v });
    return this;
  }
  not(c: string, op: string, v: unknown) {
    this.conds.push({ col: c, op: "not", val: { op, val: v } });
    return this;
  }
  or(expr: string) {
    this.conds.push({ col: "", op: "or", val: parseOr(expr) });
    return this;
  }
  match(obj: Row) {
    for (const [c, v] of Object.entries(obj)) this.eq(c, v);
    return this;
  }
  filter(c: string, op: string, v: unknown) {
    this.conds.push({ col: c, op, val: v });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.ords.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  range(from: number, to: number) {
    this.rng = [from, to];
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  select(spec?: string, opts?: { count?: string; head?: boolean }) {
    this.spec = parseSelect(spec);
    if (opts?.count) this.wantCount = opts.count;
    if (opts?.head) this.wantHead = true;
    return this;
  }

  insert(v: Row | Row[]) {
    this.mut = { type: "insert", rows: Array.isArray(v) ? v : [v] };
    return this;
  }
  update(patch: Row) {
    this.mut = { type: "update", patch };
    return this;
  }
  upsert(v: Row | Row[], opts?: { onConflict?: string }) {
    this.mut = { type: "upsert", rows: Array.isArray(v) ? v : [v], onConflict: opts?.onConflict };
    return this;
  }
  delete() {
    this.mut = { type: "delete" };
    return this;
  }

  private matched(): Row[] {
    return rows(this.table).filter((r) => matchRow(this.table, r, this.conds));
  }

  private execute(): Result {
    // mutation path
    if (this.mut) {
      const res = this.execMutation();
      if (res.error) return res as Result;
      const affected = (res as { rows?: Row[] }).rows ?? [];
      return this.finish(affected);
    }
    return this.finish(this.matched());
  }

  private execMutation(): Result & { rows?: Row[] } {
    const tbl = rows(this.table);
    const m = this.mut!;
    let affected: Row[] = [];

    if (m.type === "insert") {
      for (const raw of m.rows ?? []) {
        const r = applyDefaults(this.table, raw);
        const err = checkUnique(this.table, r);
        if (err) return err;
        tbl.push(r);
        affected.push(r);
      }
    } else if (m.type === "update") {
      for (const r of this.matched()) {
        const err = checkUnique(this.table, { ...r, ...m.patch }, r);
        if (err) return err;
        Object.assign(r, m.patch);
        if ("updated_at" in r && m.patch!.updated_at == null) r.updated_at = nowISO();
        affected.push(r);
      }
    } else if (m.type === "delete") {
      const targets = new Set(this.matched());
      tables[this.table] = tbl.filter((r) => !targets.has(r));
      affected = [...targets];
    } else if (m.type === "upsert") {
      const oc = m.onConflict || "id";
      for (const raw of m.rows ?? []) {
        const existing = tbl.find((x) => raw[oc] != null && looseEq(x[oc], raw[oc]));
        if (existing) {
          const candidate = { ...existing, ...raw };
          const err = checkUnique(this.table, candidate, existing);
          if (err) return err;
          Object.assign(existing, raw);
          affected.push(existing);
        } else {
          const r = applyDefaults(this.table, raw);
          const err = checkUnique(this.table, r);
          if (err) return err;
          tbl.push(r);
          affected.push(r);
        }
      }
    }
    persistTables();
    return { ...ok(null), rows: affected };
  }

  private finish(sourceRows: Row[]): Result {
    let out = sourceRows;

    // !inner embeds: drop parents with no related row(s)
    const innerEmbeds = this.spec?.embeds.filter((e) => e.inner) ?? [];
    if (innerEmbeds.length) {
      out = out.filter((r) =>
        innerEmbeds.every((e) => {
          const v = resolveEmbed(this.table, r, e);
          return Array.isArray(v) ? v.length > 0 : v != null;
        }),
      );
    }

    for (let i = this.ords.length - 1; i >= 0; i--) {
      const { col, asc } = this.ords[i];
      out = [...out].sort((a, b) => {
        const va = a[col],
          vb = b[col];
        if (va == null && vb == null) return 0;
        if (va == null) return asc ? 1 : -1;
        if (vb == null) return asc ? -1 : 1;
        return (asc ? 1 : -1) * cmp(va, vb);
      });
    }

    const count = this.wantCount ? out.length : null;
    if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim != null) out = out.slice(0, this.lim);

    if (this.wantHead) return ok(null, count);

    if (this.singleMode !== "none") {
      if (out.length === 0) {
        if (this.singleMode === "maybe") return ok(null, count);
        return fail("JSON object requested, multiple (or no) rows returned", "PGRST116");
      }
      if (out.length > 1)
        return fail("JSON object requested, multiple (or no) rows returned", "PGRST116");
      const row = this.spec ? project(this.table, out[0], this.spec) : out[0];
      return ok(row, count);
    }

    const spec = this.spec;
    const data = spec ? out.map((r) => project(this.table, r, spec)) : out;
    return ok(data, count);
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

// ── auth ─────────────────────────────────────────────────────────────────────

type DemoSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: {
    id: string;
    email: string;
    aud: string;
    role: string;
    user_metadata: { full_name?: string };
    app_metadata: Record<string, unknown>;
    created_at: string;
  };
};

const fakeJwt = (uid: string) =>
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: uid, aud: "authenticated", role: "authenticated" })).replace(/=+$/, "")}.demo_signature`;

function makeSession(u: DemoUser): DemoSession {
  return {
    access_token: fakeJwt(u.id),
    refresh_token: `demo_refresh_${Math.random().toString(36).slice(2)}`,
    token_type: "bearer",
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: {
      id: u.id,
      email: u.email,
      aud: "authenticated",
      role: "authenticated",
      user_metadata: { full_name: u.full_name },
      app_metadata: {},
      created_at: u.created_at,
    },
  };
}

type AuthListener = { id: string; cb: (event: string, session: DemoSession | null) => void };
const listeners = new Set<AuthListener>();
const fire = (event: string) => {
  for (const l of [...listeners]) l.cb(event, session);
};

const auth = {
  onAuthStateChange(cb: AuthListener["cb"]) {
    const l: AuthListener = { id: uuid(), cb };
    listeners.add(l);
    queueMicrotask(() => {
      try {
        cb("INITIAL_SESSION", session);
      } catch {
        /* noop */
      }
    });
    return { data: { subscription: { id: l.id, unsubscribe: () => listeners.delete(l) } } };
  },
  getSession: async () => ({ data: { session }, error: null }),
  getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
  getClaims: async () =>
    session
      ? {
          data: { claims: { sub: session.user.id, aud: "authenticated", role: "authenticated" } },
          error: null,
        }
      : { data: { claims: null }, error: { message: "invalid token" } },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password)
      return {
        data: { user: null, session: null },
        error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 },
      };
    session = makeSession(u);
    persistSession();
    fire("SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  },
  signUp: async ({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: { data?: { full_name?: string } };
  }) => {
    if (users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase()))
      return {
        data: { user: null, session: null },
        error: { message: "User already registered", code: "user_already_exists", status: 422 },
      };
    const u: DemoUser = {
      id: uuid(),
      email: email.trim(),
      password,
      full_name: options?.data?.full_name?.trim() || email.split("@")[0],
      created_at: nowISO(),
    };
    users.push(u);
    persistUsers();
    rows("profiles").push({
      id: u.id,
      full_name: u.full_name,
      phone: null,
      avatar_url: null,
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    persistTables();
    session = makeSession(u);
    persistSession();
    fire("SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  },
  signOut: async () => {
    session = null;
    persistSession();
    fire("SIGNED_OUT");
    return { error: null };
  },
  setSession: async () => ({ data: { session, user: session?.user ?? null }, error: null }),
  updateUser: async (attrs: { password?: string; data?: Record<string, unknown> }) => {
    if (session && attrs.password) {
      const u = users.find((x) => x.id === session!.user.id);
      if (u) {
        u.password = attrs.password;
        persistUsers();
      }
    }
    return { data: { user: session?.user ?? null }, error: null };
  },
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
};

// ── storage ──────────────────────────────────────────────────────────────────

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

const storage = {
  from: (bucket: string) => ({
    upload: async (path: string, file: Blob) => {
      try {
        objects[`${bucket}/${path}`] = await fileToDataUrl(file);
        persistObjects();
        return { data: { path, id: path, fullPath: `${bucket}/${path}` }, error: null };
      } catch (e) {
        return { data: null, error: { message: `Upload failed: ${String(e)}` } };
      }
    },
    getPublicUrl: (path: string) => ({
      data: {
        publicUrl:
          objects[`${bucket}/${path}`] ??
          `https://demo-storage.invalid/storage/v1/object/public/${bucket}/${path}`,
      },
    }),
    remove: async (paths: string | string[]) => {
      for (const p of [paths].flat()) delete objects[`${bucket}/${p}`];
      persistObjects();
      return { data: [paths].flat().map((p) => ({ name: p })), error: null };
    },
    list: async () => ({ data: [], error: null }),
    download: async () => ({ data: null, error: { message: "download not supported in demo" } }),
  }),
};

// ── rpc ──────────────────────────────────────────────────────────────────────

function roleInfo(userId: string): { role: string; staff_role_id: string | null } {
  const rs = rows("user_roles").filter((r) => r.user_id === userId);
  const best = rs.find((r) => r.role === "admin") ?? rs.find((r) => r.role === "staff") ?? null;
  return {
    role: (best?.role as string) ?? "customer",
    staff_role_id: (best?.staff_role_id as string) ?? null,
  };
}

async function rpc(name: string, args?: Record<string, unknown>): Promise<Result> {
  switch (name) {
    case "validate_coupon": {
      const code = String(args?._code ?? "").toUpperCase();
      const c = rows("coupons").find(
        (x) =>
          x.active === true &&
          String(x.code).toUpperCase() === code &&
          (x.expires_at == null || String(x.expires_at) > nowISO()) &&
          (x.usage_limit == null || Number(x.times_used ?? 0) < Number(x.usage_limit)),
      );
      return ok(
        c
          ? [
              {
                code: c.code,
                discount_type: c.discount_type,
                discount_value: c.discount_value,
                min_order: c.min_order,
                expires_at: c.expires_at,
              },
            ]
          : [],
      );
    }
    case "check_stock_availability": {
      const items = Array.isArray(args?._items)
        ? (args._items as { product_id: string; quantity: number }[])
        : [];
      const short = items.flatMap((i) => {
        const p = rows("products").find((x) => looseEq(x.id, i.product_id));
        if (!p || p.stock == null) return [];
        const available = Number(p.stock);
        return available < Number(i.quantity)
          ? [{ product_id: p.id, name: p.name, available, requested: Number(i.quantity) }]
          : [];
      });
      return ok(short);
    }
    case "get_booked_slots": {
      const d = String(args?.p_date ?? "");
      return ok(
        rows("service_bookings")
          .filter((b) => b.scheduled_date === d && b.status !== "cancelled")
          .map((b) => ({ scheduled_time: b.scheduled_time })),
      );
    }
    case "admin_list_users": {
      const list = [...users]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((u) => {
          const prof = rows("profiles").find((p) => p.id === u.id);
          const ri = roleInfo(u.id);
          return {
            user_id: u.id,
            email: u.email,
            full_name: (prof?.full_name as string) ?? u.full_name,
            role: ri.role,
            staff_role_id: ri.staff_role_id,
          };
        });
      return ok(list);
    }
    case "admin_set_user_role": {
      const uid = String(args?._user_id ?? "");
      const role = String(args?._role ?? "customer");
      const staffRoleId = (args?._staff_role_id as string) ?? null;
      tables.user_roles = rows("user_roles").filter((r) => r.user_id !== uid);
      if (role !== "customer")
        rows("user_roles").push({
          id: uuid(),
          user_id: uid,
          role,
          staff_role_id: staffRoleId,
          created_at: nowISO(),
        });
      persistTables();
      return ok(null);
    }
    case "apply_stock_change": {
      const dir = Number(args?._direction ?? 0);
      const oid = args?._order_id;
      for (const it of rows("order_items").filter((i) => i.order_id === oid)) {
        const p = rows("products").find((x) => looseEq(x.id, it.product_id));
        if (p) p.stock = Math.max(0, Number(p.stock ?? 0) + dir * Number(it.quantity ?? 0));
      }
      persistTables();
      return ok(null);
    }
    case "has_role":
      return ok(roleInfo(String(args?._user_id ?? session?.user.id ?? "")).role === args?._role);
    case "is_admin":
      return ok(roleInfo(String(args?._user_id ?? session?.user.id ?? "")).role === "admin");
    case "is_super_admin":
      return ok(roleInfo(String(args?._user_id ?? session?.user.id ?? "")).role === "admin");
    case "my_service_scope": {
      const ri = session ? roleInfo(session.user.id) : { staff_role_id: null };
      const sr = ri.staff_role_id
        ? rows("staff_roles").find((x) => x.id === ri.staff_role_id)
        : null;
      return ok((sr?.service_type as string) ?? null);
    }
    case "can_access_order":
      return ok(true);
    case "request_header":
      return ok("");
    default:
      return {
        data: null,
        error: { message: `Unknown rpc: ${name}` },
        count: null,
        status: 404,
        statusText: "Not Found",
      };
  }
}

// ── edge functions ───────────────────────────────────────────────────────────

const functions = {
  invoke: async (name: string, opts?: { body?: Record<string, unknown> }) => {
    const body = (opts?.body ?? {}) as Record<string, unknown>;
    if (name === "create-checkout-session") {
      const order = rows("orders").find((o) => o.id === body.order_id);
      if (order) {
        order.payment_status = "paid";
        order.status = "paid";
        order.updated_at = nowISO();
        rows("order_status_events").push({
          id: uuid(),
          order_id: order.id,
          status: "paid",
          note: "Payment confirmed (demo checkout)",
          created_by: null,
          created_at: nowISO(),
        });
        persistTables();
      }
      return {
        data: { id: "cs_demo_" + uuid().slice(0, 8), url: String(body.success_url ?? "/") },
        error: null,
      };
    }
    // send-order-email / send-booking-email / notify-* — no-ops in demo
    return { data: { ok: true }, error: null };
  },
};

// ── client factory ───────────────────────────────────────────────────────────

export function createDemoClient() {
  return {
    from: (table: string) => new QB(table),
    rpc,
    auth,
    storage,
    functions,
    channel: () => ({
      on: () => ({ subscribe: () => "SUBSCRIBED" }),
      subscribe: () => "SUBSCRIBED",
      unsubscribe: () => Promise.resolve("ok"),
    }),
    removeChannel: () => Promise.resolve("ok"),
    removeAllChannels: () => Promise.resolve([]),
  };
}
