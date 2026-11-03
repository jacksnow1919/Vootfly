# Cabin Suites polish + real search filters

## 1. Mobile drawer active state

Right now "Unpublished Fares" is permanently styled gold in the mobile drawer, so it looks
active even on `/cabin-suites`. Fix: derive the active item from the current pathname
(TanStack `useRouterState`) and apply the gold highlight only to the matching link.
"Unpublished Fares" keeps its lock icon but becomes a normal item unless its modal is open.

## 2. Cabin Suites above the fold

- Tighten the top block: smaller badge/heading/subtitle spacing, shorter intro copy.
- Replace the four feature boxes with one row of compact chips (horizontally scrollable on
  mobile, no wrap).
- Suite cards move up so the first card's price (e.g. $2,290) is visible on a 394px-wide
  phone without scrolling; card internals get slightly denser spacing.

## 3. "Ask the desk" / "Unlock private fares" modal

- Constrain to `max-h-[90vh]` with internal scroll, padding `p-4 sm:p-6`.
- From/To side by side; Travel Month/Cabin side by side; tighter row spacing.
- Shorter intro text and a one-line "Interested in…" note so the submit button stays
  visible on mobile.

## 4. Lead form saving (the "ask the desk API" bug)

Confirmed cause: `fare_leads` and `corporate_leads` have RLS policies that allow public
inserts, but **no table grants**, so every submit fails with a permission error. Migration
adds the missing grants (insert for anon/authenticated, select for admins via authenticated,
full access for service role). No schema change.

## 5. Flight search: airline param reaches the provider

- `flight.search.tsx` already reads `airline` but only filters client-side and leaves it out
  of the query key, so results don't refetch when it changes. Add `airline` to the query key
  and pass it through the search service into the PKFARE V4 payload as
  `search.airline` (server side, in `runPkfareSearch`), keeping the client-side filter as a
  safety net if the provider ignores the hint.
- The route already re-runs on every search-param change once the key includes them.

## 6. Filter engine rebuilt from the live response

Normalised fares gain a few extra fields so filters can be real:
`durationMinutes`, `maxLayoverMinutes`, `departMinutes`, `arriveMinutes`, `carrierCode`.

Sidebar (all derived from the returned fares, no hardcoded lists):

- Stops: Non-stop / 1 stop / 2+.
- Price slider bounded by min/max of the results.
- Airlines: actual carriers in the response, each with its lowest price, sorted by price.
- Flight duration slider from shortest to longest trip.
- Max layover slider (hidden when every result is non-stop).
- Departure and arrival time blocks: 00–06, 06–12, 12–18, 18–24, independently toggleable.
- Alliance checkboxes: Oneworld, SkyTeam, Star Alliance, mapped from carrier code.

Mobile: the sidebar becomes a "Filters" sheet button so it doesn't push results down.

## 7. Sorting tabs

Tabs above the cards: Cheapest (price), Fastest (duration), Best overall (blended score of
normalised price and duration). All filtering/sorting is local state over the fetched array,
so changes render instantly with no reload. A result count plus "reset filters" link shows
when filters exclude everything.

## Technical notes

- Alliance map lives next to `AIRLINE_NAMES`; carriers not in the map are unaffected by
  alliance filters unless one is selected.
- Layover minutes computed server-side from segment arrival/departure timestamps in
  `pkfare.server.ts`; existing card fields keep their current shape.
- Sidebar filter state resets when the route/date/cabin changes so stale bounds can't hide
  all results.
