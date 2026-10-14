# Yours — Demo Storefront (portfolio build)

A full-stack e-commerce + service-booking demo. **This build contains no real
backend and no real data** — every product, order, booking, review and contact
detail is fictional, stored in an in-browser demo database.

## Run it

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # production build
npm run lint
```

## Demo accounts

Sign in at `/auth` (credentials are also shown on the page):

| Account | Password | Access |
| --- | --- | --- |
| `admin@demo.io` | `admin123` | Full admin dashboard at `/admin` |
| `staff@demo.io` | `staff123` | Staff — scoped to cycle bookings |
| `customer@demo.io` | `demo1234` | Customer — orders, wishlist, bookings |

Other things to try: coupon codes `WELCOME10` (10% off) and `FLAT5` (£5 off),
checkout with "Cash on delivery" or demo "card" checkout, and the `/track`
order-tracking page.

## How the demo backend works

`src/integrations/supabase/client.ts` no longer talks to Supabase. It exports a
local drop-in replacement (`demo-client.ts`) that implements the supabase-js
surface this app uses — table queries with embedded selects, inserts, updates,
upserts, deletes, auth, storage, RPCs and edge functions — against the fictional
seed data in `demo-data.ts`. Mutations persist to `localStorage`, so admin
changes survive reloads; clear site data to reset.

No API keys, database credentials or real contact information exist in this
copy.
