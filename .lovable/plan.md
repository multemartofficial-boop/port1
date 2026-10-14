# Phased Delivery Plan

Shipping 19 substantial features in a single turn would produce broken flows. I'll deliver in 4 phases across follow-up turns. Each phase is independently testable and leaves the app in a working state.

## Phase 1 — Admin isolation + service reconciliation (items 1, 16, 17, 18)

**Goal:** admin becomes a self-contained app with its own layout; storefront cleaned up.

- Delete `/book-service` route; keep only `/services`.
- New `src/routes/admin.route.tsx` pathless layout with sidebar (Dashboard, Products, Categories, Brands, Coupons, Banners, Slideshow, Orders, Bookings, Refunds, Reviews, Newsletter, Staff Roles, Blog, Settings) — no `SiteLayout`, no storefront header/footer/promo banner/mobile-nav/WhatsApp.
- Split current monolithic `admin.tsx` into per-section child routes: `admin.dashboard.tsx`, `admin.products.tsx`, `admin.categories.tsx`, etc.
- Mobile: collapsible sidebar (shadcn Sidebar `collapsible="icon"`), sticky top bar with `SidebarTrigger`, tables → responsive card views under `md`.
- Reconcile Settings `service_prices` to 6 rows: Bronze / Silver / Gold / Emergency / Mobile Service–Bicycle & E-bike / Mobile Service–Car / Roadside Puncture. `/services` reads names+prices from Settings only.
- Global CSS: add `cursor: pointer` to `button, [role="button"], a[href], [data-clickable]` (storefront + admin).

## Phase 2 — Storefront critical (items 8, 9, 10, 11)

- **Hero slideshow (#8):** new `site_settings.hero_slides` (array of `{image_url, title, subtitle, cta_label, cta_href, order}`). Full-width carousel with prev/next arrows + dot indicators, autoplay 5s, pause on hover. Admin `Slideshow` page: upload images, edit copy, reorder (drag), remove.
- **Promo banner CMS (#9):** already reads `site_settings.promo_banner` — expose in admin Settings with live preview + enable toggle.
- **Stock auto-management (#10):** DB trigger deducts `products.stock`/`product_variants.stock` when `orders.status` moves to `paid`/`processing` (via webhook or admin confirm); returns stock on `refunded`/`cancelled`. Product card + PDP show "Out of Stock" and disable Add-to-Cart when 0. Admin can still edit stock manually.
- **Cash on Delivery (#11):** checkout adds "Cash on Delivery" radio next to card. COD orders skip Stripe: insert with `payment_status='cod_pending'`, `status='processing'`, trigger admin+customer email, deduct stock. Admin marks paid on delivery.

## Phase 3 — Orders, emails, payment reliability, tracking (items 3, 5, 12, 13, 14, 15)

- **Emails (#3):** send BOTH customer + admin on order paid, order cancelled, order refunded, and **service booking submitted**. Admin body includes full details: contact, items/service, qty, unit + line totals, coupon, shipping, grand total, shipping method, address, order/booking number, tracking number.
- **Order details view (#13):** new `/orders/$id` (customer) and `admin.orders.$id` (admin) with items table, pricing breakdown, coupon, shipping, customer info, status timeline from `order_status_events`.
- **Order date/time (#14):** show `created_at` prominently on all order rows + details, formatted `dd MMM yyyy, HH:mm`.
- **Payment flow fix (#15):** audit webhook — ensure Stripe events reliably move `status` to `paid`→`processing`; add idempotency guard on `stripe_session_id`. Distinguish `paid`, `pending`, `cancelled`, `refunded` with distinct color badges and copy everywhere (admin, my-account, emails).
- **Refunds (#12):** customer "Request Refund" button on paid orders (creates row in existing `refund_requests`); admin Refunds page approves → sets `orders.status='refunded'`, `payment_status='refunded'`, restores stock (via #10 trigger), triggers refund email. Admin can optionally trigger Stripe refund via server function.
- **Tracking display (#5):** customer order detail shows tracking number, current status, and status-event timeline; refreshed by courier poller (Phase 4) or manual admin update.

## Phase 4 — Heavy features: image uploads, variations, courier, perf (items 2, 4, 6, 19)

- **Image uploads (#2):** replace every image-URL text input (categories, brands, banners, hero slideshow, products, blog) with an `<ImageUploader>` component that uploads to `product-images` bucket (or new `site-assets` bucket) via `supabase.storage.from(...).upload()` and writes the public URL to the field. Multi-image support for products.
- **Product variations (#6):** use existing `product_variants` table extended with `attributes jsonb` (e.g. `{size:"M", color:"Red", type:"V-Neck"}`), `price`, `stock`, `sku`. Admin: variation matrix builder (define attributes, generate rows, edit price/stock per row). PDP: attribute selectors → resolves to a variant → price + stock update; Add-to-Cart uses variant id.
- **Courier integration (#4):**
  - New Settings field for Royal Mail Click & Drop API key (stored as secret `ROYAL_MAIL_API_KEY` — I'll open `add_secret` when we reach this phase).
  - Server function `sync-royal-mail-status` polls Click & Drop orders API by tracking number and updates `orders.fulfillment_status` (`dispatched`, `out_for_delivery`, `delivered`) + inserts `order_status_events`.
  - pg_cron job runs every 30 min.
  - Admin retains manual override dropdown.
- **Service booking hours (#7):** admin Settings adds `booking_hours` config (days-of-week + open/close times + slot minutes). Booking page renders available slots in 12-hour AM/PM format from that config.
- **Performance audit (#19):**
  - Lazy-load below-fold images (`loading="lazy"` + explicit width/height).
  - Route-level `React.lazy` for admin subroutes.
  - Consolidate duplicate Supabase queries (single loader per route, `useSuspenseQuery`).
  - Add TanStack Query cache with `staleTime` on catalog reads.
  - Convert hero images to WebP via `vite-imagetools`.
  - Report before/after LCP + bundle size.

## Technical notes

- New migrations required: `hero_slides` JSON in `site_settings`, `booking_hours` JSON in `site_settings`, `product_variants.attributes jsonb`, stock trigger, refund status flow, idempotent webhook guard.
- Secret needed in Phase 4: `ROYAL_MAIL_API_KEY` (I'll request it then, not now).
- No breaking changes to existing paid orders — new fields default-safe.

## Execution

Reply "go" and I'll ship **Phase 1** immediately. After each phase lands and you've verified it, say "next" for the following phase. If you want a different order or want to drop something (e.g. skip courier and keep manual tracking), tell me now and I'll adjust before starting.
