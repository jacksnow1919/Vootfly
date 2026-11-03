Plan: Fix the `/deals` page interaction by making each deal card a clickable link to the checkout flow.

## Objective
Make every deal card on `/deals` (and the reusable `DealCard` component) fully clickable and route the user to `/flight/booking` with the deal's route, cabin, and price prefilled.

## Background
- `DealCard` currently links to `/deals` (itself) and is not functional.
- `FeaturedDeal` only carries display text (`from`, `to`, `trip`, `price`, `cabin`, `airline`, `currency`, `expiresAt`).
- The `deals` table stores `origin` and `destination` as city names, not IATA codes, and has no `departure_date` column.
- `/flight/booking` expects `origin`, `destination`, `depart`, `cabin`, and `price` search params.

## Proposed changes
1. Extend the `FeaturedDeal` type in `src/lib/featured-deals.ts` to include computed routing fields: `originCode`, `destinationCode`, `departureDate`, and `cabinClass`.
2. Map the seeded/hard-coded featured deals to real IATA codes and a sensible future departure date (e.g., 90 days from today).
3. In `src/routes/deals.tsx`, when transforming Supabase `deals` rows into `FeaturedDeal`, derive IATA codes from the city names using `src/lib/airports.ts` and use a default future departure date.
4. Update `src/components/site/DealCard.tsx` to use `Link` from `@tanstack/react-router` pointing to `/flight/booking` with the deal's search params (`origin`, `destination`, `depart`, `cabin`, `price`, `tripType`).
5. Add `cursor-pointer` and stronger hover styles (`hover:shadow-lg hover:border-primary`) to the card so the entire surface is visibly clickable.
6. Ensure the "View deal" button text remains and visually reinforces the link.
7. Verify the card is still keyboard-focusable and accessible because it is a real `<Link>`.

## Acceptance criteria
- Clicking anywhere on a deal card on `/deals` navigates to `/flight/booking?origin=...&destination=...&depart=...&cabin=...&price=...`.
- The checkout page loads with the selected trip locked and pre-filled.
- Cards show a pointer cursor and clear hover state on desktop and mobile.
- The homepage "Featured Flight Deals" section also benefits from the same clickable card behavior.

## Technical notes
- Keep the change frontend-only; no backend logic, validation, or payment changes.
- Use the existing `airports` lookup to resolve city names to IATA codes. Fall back to the original city name if no match is found.
- Cabin values should be normalized to the lower-case codes the checkout parser expects (`economy`, `business`, `first`, etc.).
- Use a stable date format `YYYY-MM-DD` for the `depart` parameter.
