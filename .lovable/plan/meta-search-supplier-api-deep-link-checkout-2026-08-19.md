# Meta-Search supplier API + deep-link checkout

Give EazAir one POST endpoint that always returns live fares, and make the checkout page land ready-to-book from the deep link it returns.

## 1. Supplier endpoint: `POST /api/meta/search`

A pure JSON backend route (no page, no redirect) at `src/routes/api/meta/search.ts`:

- Auth: compare the `x-api-key` header against the `META_SEARCH_API_KEY` secret with a constant-time check; missing/invalid gives `401` JSON. The secret is read inside the handler.
- Also handle `OPTIONS` (204) and add CORS headers so the aggregator can call it from any origin; path has no trailing-slash variant, so POST bodies are never turned into GETs.
- Reject non-JSON bodies with `400`.

Note: this path is not under `/api/public/*`, so on the published site it sits behind site auth. If EazAir must reach it server-to-server on the published domain, the route belongs at `/api/public/meta/search` (still key-protected). I'll implement it at `/api/meta/search` as asked and mount the same handler at `/api/public/meta/search` so both work — the API key is the real gate either way.

## 2. Request validation (Zod)

`search_id` (string, required), `trip_type` (`round_trip` | `one_way`), `origin`/`destination` (3-letter IATA, uppercased), `departure_date` (`YYYY-MM-DD`), `return_date` (optional, nullable, empty string treated as absent), `passengers` `{ adults (default 1), children (default 0), infants (default 0) }`, `cabin_class` (default `economy`), `currency` (default `USD`). Invalid payloads return `400` with the Zod issues.

## 3. Inventory: database first, generator fallback

1. Query the existing `deals` table for rows matching origin/destination (and cabin) and map any hits into the response contract.
2. If nothing matches, deterministically generate 3–4 options seeded from `search_id + route + date`, so repeated calls for the same search are stable.
   - Domestic vs international decided from an airport→country map built on the existing airport data.
   - Price bands per cabin exactly as specified (economy 120–380 / 450–950; premium economy 320–750 / 950–1800; business & first 650–1400 / 2200–4500); taxes ≈ 18% split out of the total, base fare = total − taxes.
   - Carriers from a realistic pool (Delta DL, United UA, American AA, JetBlue B6 domestic; British Airways BA, Lufthansa LH, Emirates EK, Air France AF international) with matching flight numbers, ISO departure/arrival timestamps on the requested dates, `duration_minutes`, and 0 or 1 stops.
   - Return segment only when `trip_type` is `round_trip` and a `return_date` is present.

## 4. Response contract

Exactly the requested shape: `search_id`, `partner_id: "vootfly"`, `timestamp`, `results[]` with `itinerary_id`, `airline`, `airline_code`, `outbound_segment`, optional `return_segment`, `pricing`, and `deep_link_url` built with the specified query string (`origin`, `destination`, `depart`, `return`, `cabin`, `price`, `airline`, `click_id=search_id`, `utm_source=eazair`, `utm_medium=meta`), all values URL-encoded.

## 5. Checkout deep-link locking (`/flight/booking`)

`src/lib/flight-search-params.ts` currently only reads `departDate`. Extend the parser to also accept the aggregator's aliases (`depart` → `departDate`, `return` → `returnDate`, plus `utm_medium`), keeping existing params working unchanged.

In `src/routes/flight.booking.tsx`, when a deep link is detected (`utm_source` present, or `price` + route params present):

- Show a locked trip summary card at the top: route, airline, cabin, depart/return dates, passengers, and the total from `price` — rendered as read-only text with a small "Fare locked from EazAir" badge instead of editable inputs.
- Keep the price used for totals bound to the incoming `price`, and skip any prompt to re-search.
- The user lands directly on passenger details.

## Not touched

Checkout validation, Stripe auth/capture, card vault, EazAir postback, Mixpanel tracking, and the admin dashboard stay exactly as they are.

## Verification

- `curl` the endpoint with a wrong key (expect 401), with a one-way payload where `return_date` is `null` (expect 200, no `return_segment`), and with a round-trip business-class international payload (expect 200, 3–4 results, prices inside the band).
- Open a generated `deep_link_url` against the local app and confirm the locked summary and price render and checkout proceeds.

## Requirement

`META_SEARCH_API_KEY` must exist as a secret; I'll request it on approval if it isn't set yet.
