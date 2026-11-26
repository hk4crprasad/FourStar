# Phirmy

FourStar is a fictional boutique hotel and Indian kitchen in Kataka, Odisha. The same Next.js app, staff sign-in, and PostgreSQL database power room reservations, dining and room service. The demo includes four room types, one physical room of each type, and 24 dishes.

## Local setup

Requires Node.js 22.13+ on Node 22, or Node.js 24+, and a PostgreSQL server. The included Compose file starts PostgreSQL 17 on local port 54327.

```sh
cp .env.example .env
npm ci
docker compose up -d --wait
npm run db:setup
npm run dev
```

For Podman without Compose, use `podman run -d --name phirmy-db -e POSTGRES_USER=phirmy -e POSTGRES_PASSWORD=phirmy -e POSTGRES_DB=phirmy -p 127.0.0.1:54327:5432 -v phirmy-db:/var/lib/postgresql/data docker.io/library/postgres:17-alpine`.

Open [the hotel](http://localhost:3000), [rooms](http://localhost:3000/rooms), [dining](http://localhost:3000/food), or [the staff dashboard](http://localhost:3000/admin).

| Staff sign-in | Demo value |
| --- | --- |
| Email | `admin@fourstar.test` |
| Password | `DemoKitchen2026!` |

Keep `.env` private. Use your own staff credentials and a random `SESSION_SECRET` before sharing the app. Set `APP_ORIGIN` to the public HTTPS origin if you deploy behind a reverse proxy.

## Supabase PostgreSQL

Use the Supabase **Session pooler** URL on port 5432. Add `schema=phirmy` to keep the app’s tables in a dedicated schema. Download the Supabase CA from Database Settings and add `sslmode=verify-full&sslrootcert=/absolute/path/to/supabase-ca.crt` to the URL. URL-encode the password and any special characters in the certificate path. Set `DATABASE_URL` privately and run `npm run db:setup`. The seed is rerunnable and preserves staff edits. [Supabase connection instructions](https://supabase.com/docs/guides/database/connecting-to-postgres)

## Booking and room service

1. Search dates and guest count under **Stay**, open a room, and submit the guest form. The confirmation page has the reservation ID and updates as staff process the booking.
2. In **Reservations**, confirm the booking and check in the guest during the stay dates. A room must be available and clean. Checkout releases the remaining room nights, marks the room as needing cleaning, and ends room-service access.
3. The guest can open **Room service** from the booking timeline or scan the room QR downloaded from **Room inventory**. They verify their reservation ID and booking phone number. The kitchen receives the order with the assigned room number. The guest can follow it in the same order tracker as dining orders.

Booking prices are calculated server-side from the saved nightly rate and the check-in-inclusive, checkout-exclusive date range. PostgreSQL gives each room night one unique slot. Pending reservations hold those slots until staff cancel or check out the booking. The availability calendar shows the next seven days from its selected date. Daily revenue combines completed food orders and checked-out stays.

Room and room-service payments are demos. The app does not charge a card, post a balance to a real hotel folio, or send notifications.

## Demo checkout

Choose delivery, takeaway, or dine-in. Delivery asks for an address and dine-in asks for a table number. The server validates availability and customisations and calculates tax and delivery from restaurant settings. Save the confirmation ID to track the order. Staff can accept or reject it and advance it through the kitchen. Delivery orders have an additional Out for delivery step. Daily sales reports count completed orders in the restaurant’s time zone.

Optional Razorpay integration uses `RAZORPAY_TEST_KEY_ID` and `RAZORPAY_TEST_KEY_SECRET` in `.env`. The app accepts only a Test Mode key. Select **Razorpay (Test Mode)** and continue to the hosted checkout using Razorpay’s test card, mock bank, or test UPI details. The server prepares the amount, verifies the signature and capture, and then releases the order to staff. If the browser loses the confirmation, reopen the order and use the payment button to check for a completed test payment. The offline cash demo is always available. No real payments or notifications are sent. [Razorpay Standard Checkout and test details](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps)

## Management and verification

Staff can manage menu items, availability, categories, pricing, images, hours and storefront branding. Uploaded images are re-encoded and stored under `.data/media` by default. Set `MEDIA_DIRECTORY` to a persistent writable volume for a hosted instance. Persist or back up that volume alongside PostgreSQL.

The Phirmy chat, voice and telephony adapter contracts are in `lib/phirmy.ts`. No AI or telephone provider is connected.

```sh
npm test
npm run typecheck
npm run build
npm start
```

The browser test uses a seeded demo database and creates demo orders. Install Python Playwright and Chromium with `python -m pip install playwright` and `python -m playwright install chromium`, then run `python tests/e2e.py` and `python tests/hotel_e2e.py` against the running server. Use a seeded demo database with the Standard room available for tonight when running the hotel suite. Override `PHIRMY_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `PHIRMY_SCREENSHOTS` as needed.

The key visuals were generated with ImageGen for this demo. The hero depicts butter chicken on a charcoal tabletop with the food on the right and clear space for the overlaid headline. The menu photos depict individual seeded dishes in the same dark tabletop style. The exported WebP images are in `public/food`.


## Hosting

The deployment files in `deploy/` target `hara` using Nginx and two systemd services. Releases are installed in `/opt/fourstar/releases`, with `/opt/fourstar/current` pointing to the active Git revision. Keep the environment file, CA certificate, and uploaded media under `/opt/fourstar/shared` across releases. Build and run Prisma migrations and the seed before switching the release. The Node process listens on loopback port 3102.

Create a **DNS only** Cloudflare A record for `fourstar.phirmy.com` pointing to `4.240.114.186`. The `fourstar-tls.timer` service checks for the DNS record and installs the Let's Encrypt certificate using the hostname's HTTP challenge route. After HTTPS works, the record can be proxied with **Full (strict)** TLS. [Cloudflare subdomain setup](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/)

Hotel photography was generated for the demo. It depicts a courtyard hotel and two views of each fictional room type. The WebP images are in `public/hotel`.
