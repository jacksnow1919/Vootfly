# Location search + direct booking capture + Mission Control booking details

## 1. Smarter location autocomplete everywhere

Improve ranking in the shared airport search so country matches surface properly (typing "India" lists Delhi DEL, Mumbai BOM, Goa GOX, etc.), add country aliases (UK/United Kingdom, USA/US, UAE, Emirates), show more results (up to 10) and rank major hubs first within a country.

Reuse the existing autocomplete component in the places that still use plain text boxes:
- Cabin Suites "Ask the desk" / route modal (From, To)
- Unpublished Fares modal (From, To)

Each dropdown row reads `City (CODE) — Airport name`, and selecting a row always binds the exact 3-letter IATA code to the payload, same as the homepage today.

## 2. Direct / organic booking capture at checkout

When "Continue to Book" is submitted on `/flight/booking`, the booking saved to the database also stores:
- source: `direct` when there is no affiliate source/click id, otherwise the affiliate source (e.g. `EAZAIR`)
- lead passenger name, email, phone
- billing address, city, country, postal code
- route, travel date, airline, cabin, PNR, price, promo code (already saved today)

This requires a small database change adding the source and billing/contact columns to the bookings table.

## 3. Mission Control (`/admin/dashboard`)

- Rename the table to **All Bookings & PNR Queue** and list every booking (not only affiliate ones).
- Source badge per row: gold/navy `DIRECT`, green `EAZAIR`, neutral for other sources.
- New **View Details** button per row opening a slide-over panel showing:
  - Passenger contact: name, email, phone, full billing address
  - Flight: PNR, route, airline, cabin class, travel date
  - Financials: total price, promo code + discount, estimated 12% commission/yield
  - Status control: switch between Pending ticketing / Ticketed / Cancelled, saved to the database and reflected in the table and KPI cards

## Technical notes

- `src/lib/airports.ts`: rewrite `searchAirports` scoring (exact code/city, prefix, country prefix with hub priority), add a country alias map, raise default limit.
- `src/components/site/AirportAutocomplete.tsx`: unchanged API; used in `CabinRouteModal.tsx` and `UnpublishedFaresModal.tsx`.
- Migration on `public.bookings`: `source text not null default 'direct'`, `lead_name text`, `billing_address text`, `billing_city text`, `billing_country text`, `billing_postal_code text`. No new tables, existing RLS unchanged.
- `src/lib/booking-store.ts` + `src/lib/bookings.functions.ts`: extend the validated input and insert with the new fields; source derived server-side from utm/click id.
- `getAdminBookings` returns the new columns; add an admin-session-guarded `updateBookingStatus` server function (`pending | issued | cancelled`) using the existing `bcd-admin` session check.
- `src/routes/admin.dashboard.tsx`: table rename, all-bookings list, source badges, details slide-over component, React Query invalidation after a status change.
