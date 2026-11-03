# Fix live flight results by matching the EAZAIR provider integration

The credentials are fine (both partner keys are saved here). The difference is *how* this project talks to the provider — EAZAIR uses a different endpoint, transport method and response shape. That is why every retry ends in a 406 and "No flights found".

## What is actually different

Verified by reading both projects' provider clients side by side:

| | This project (failing) | EAZAIR (working) |
|---|---|---|
| Endpoint | `https://api.pkfare.com/shopping` | `https://api.pkfare.com/shoppingV4` |
| Method | GET with `?param=<base64>` | POST, `application/x-www-form-urlencoded`, body `param=<base64>` |
| Response reading | manual redirect handling + gzip guessing | plain `response.json()` |
| Result mapping | expects `data.solutions[].segments[]` inline | joins `data.solutions` + `data.flights` + `data.segments` by id |

The 406 comes from the GET query-string transport; the "No flights found" empty state comes from the mapper expecting a segment shape the V4 response never returns.

## Changes

1. **`src/lib/pkfare.server.ts`** — replace `pkfareGet` with a POST-form request to `/shoppingV4`, sending `param` as an urlencoded body, with a 30s timeout. Drop the manual-redirect and gzip-decode workarounds (unnecessary once the transport is correct). Keep MD5 signing of `partnerId + partnerKey`.
2. **Request payload** — send `{ authentication, search: { adults, children, infants, nonstop, airline: "", solutions, searchAirLegs } }`, with `cabinClass` on each leg (as EAZAIR does), not at the search root.
3. **`src/lib/pkfare-types.ts`** — model the real V4 response: `solutions[].journeys` (map of journey key -> flightIds), plus `flights[]` and `segments[]` lookup tables, and the fare fields used for pricing.
4. **New mapper** — for each solution, resolve journeys -> flights -> segments, then build the existing normalised fare (airline, flight number, times from `strDepartureDate`/`strDepartureTime`, total duration from segment `flightTime`, stops, price from adult fare + tax, refundable).
5. **`src/routes/flight.search.tsx`** — no shape change needed for the cards, but surface provider errors as the existing clean message and keep the empty state distinct from a failure, so "no inventory" and "provider error" no longer look identical.

## Verification

Run a real JFK-MIA Business search against the live endpoint from the server side and confirm a non-empty solution set and populated cards; check the dev-server log for `[pkfare]` lines showing a `0` error code.

## Note

Business-class JFK-MIA on a single date can legitimately return few or no solutions. After the transport fix, if the provider returns `0` results with error code `0`, I will confirm with a broader route (e.g. JFK-LHR) so we know the pipeline works before adjusting the search itself.
