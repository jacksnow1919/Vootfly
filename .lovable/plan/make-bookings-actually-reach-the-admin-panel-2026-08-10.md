# Make bookings actually reach the Admin panel

## What's wrong (verified)

The database currently holds **0 bookings, 0 passengers, 0 payments** — so the admin panel is not "failing to display" data, the booking was never saved. Two separate bugs stack up:

1. **Guest checkouts are silently dropped.** The save routine bails out immediately when there is no signed-in user, and EAZAIR-referred travellers check out as guests. Every referred booking is discarded after the confirmation screen.
2. **Even if rows existed, the admin panel couldn't read them.** Admin sign-in is a browser-only flag (a value stored in the browser), so the dashboard queries the database as an anonymous visitor. Security rules only allow a booking's own owner to read it, so the query returns an empty list.

## The fix

### 1. Save every booking server-side
- Add a secure server-side save step that writes the booking, passenger and payment rows with trusted backend access, so guest bookings persist.
- If the traveller *is* signed in, the booking is attributed to them; otherwise it is stored as a guest booking with the contact email/phone captured at checkout.
- Store the referral fields exactly as captured: source, click id, promo code, promo discount, plus the final paid total.
- Checkout calls this on submit and only then redirects to the confirmation page; a failure is logged and surfaced, never swallowed.

### 2. Let guest bookings exist in the data model
- Allow the owner field on bookings to be empty (guest), and add guest contact columns (email, phone) plus the promo discount amount so the admin table can show who booked.

### 3. Make the admin panel read real data
- Replace the browser-flag gate with a real admin check: the admin dashboard fetches its data through a server-side endpoint that verifies the admin password server-side (kept as a backend secret) and then reads bookings with trusted access.
- The dashboard shows: totals (gross bookings value, net revenue, referral count, conversion), the affiliate reconciliation table (PNR, date, route, total, source, promo, click id, traveller email) and the PNR queue — all from live rows.

### 4. Backfill your existing booking
- The booking you already completed was never stored, so nothing can be recovered automatically. Once the fix is live, either re-run one referred test checkout to confirm end-to-end, or provide the details (PNR TFG592915, JFK→MIA, 2026-08-18, Delta, $279, EAZAIR) and it will be inserted manually so the panel is accurate.

### 5. Verify
- Complete a guest checkout with `?utm_source=EAZAIR&click_id=…&promo_code=…`, confirm the row lands in the database, then confirm the admin dashboard KPIs and reconciliation table reflect it (source badge green for EAZAIR).

## Technical notes

- New migration: `bookings.user_id` nullable, add `guest_email`, `guest_phone`, `promo_discount numeric default 0`; keep RLS and add GRANTs for `service_role`. No `anon` read policy is added — admin reads go through the server.
- New `src/lib/bookings.functions.ts`: `createBooking` (validated with Zod, loads `supabaseAdmin` inside the handler, derives `user_id` from the bearer token when present and ignores any client-supplied owner) and `getAdminBookings` (verifies an admin passphrase against a backend secret before reading).
- `src/lib/booking-store.ts`: `persistBooking` delegates to `createBooking` instead of the browser client; local session copy for the confirmation page stays.
- `src/routes/admin.index.tsx` / `admin.dashboard.tsx`: the login posts the passphrase to the server function, stores only the returned short-lived token/flag, and the dashboard queries via the server function instead of the browser database client.
- Requires one new backend secret for the admin passphrase (the current credentials are hard-coded in client code, which is why anyone can currently open the dashboard shell).
