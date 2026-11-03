# EazAir meta-search partner endpoint

Prepared by: Nida Bano Abbasi

## What was found (2 Sep 2026)

The endpoint EazAir needs already existed and matched EazAir's request/response
contract almost exactly: `POST /api/meta/search` and `POST /api/public/meta/search`
(same handler, `x-api-key` protected via the `META_SEARCH_API_KEY` secret, already
configured). Request schema, response shape, `deep_link_url`, `pricing.total_price`
all lined up.

**The data source did not.** `resolveResults()` tried the `deals` table first (empty,
0 rows), then fell through to a deterministic-but-fake itinerary generator with
invented flight numbers, times and prices inside made-up price bands — with a comment
explicitly saying it exists "so the aggregator never receives an empty result set."
That was live, reachable code. Turning this partner on as-is would have sent
fabricated flights to real EazAir visitors.

## What changed

`src/lib/meta-search.ts` now resolves every quote from a **live PKfare search**
(`runPkfareSearch`, the same integration already used by the pSEO fare pipeline),
matching the requested route, dates, passengers and cabin. If PKfare has nothing —
no availability, credential issue, timeout — the endpoint returns `results: []`,
never an invented fare. EazAir's aggregator already treats an empty/slow partner
response as "no offer from this partner," so this is the correct honest behaviour,
not a degraded one.

Known, deliberate simplification: `return_segment` is omitted for round trips. The
PKfare integration in this repo only normalises the outbound journey's segments
(see `normaliseSolution` in `pkfare.server.ts`), so a real return flight number/time
isn't available yet. `pricing.total_price` is still the real full round-trip price.
Reporting a return segment we don't have would be exactly the kind of fabrication
this fix removes, so it's left out rather than guessed. Extending the PKfare
normaliser to also surface the return journey is a real follow-up if EazAir wants
return-flight detail in the offer card.

The `deals`-table path was removed entirely rather than kept as a secondary source:
the table has no flight-time columns, so any itinerary built from it would still
need invented segment times. If `deals` is ever populated with a real schedule,
that path can be reintroduced properly.

## New requirement: `SITE_PUBLIC_URL`

`deep_link_url` (the link a real visitor is sent to after clicking "Book" on
EazAir) now derives from `SITE_PUBLIC_URL` and defaults to `vootfly.lovable.app`
if unset. **Do not set this to `vootfly.com` until domain ownership and live
DNS are confirmed** — a public search of that domain currently shows an unrelated
business ("VootFly"), not this project. Sending real partner
traffic to the wrong site is a serious, user-facing failure mode, worse than a
missing feature. Confirm the domain first; this is a one-line secret change once
it's safe.

## Activation checklist (nothing here is a code change)

1. Confirm `vootfly.com` is actually owned and live-connected in Lovable, or
   decide to launch this partnership on the `vootfly.lovable.app` domain for now.
2. If using the custom domain, set the `SITE_PUBLIC_URL` secret to it.
3. Confirm `META_SEARCH_API_KEY`, `PKFARE_PARTNER_ID`, `PKFARE_PARTNER_KEY` are set
   (they already were, per the Aug 2026 secrets list).
4. Report the real, working URL (`https://<domain>/api/public/meta/search`) back —
   turning the partner on is then a `PARTNER_ASAIRSPACE_URL` secret on EazAir's
   side, no code change there either.
5. Test end to end with a real request before calling it live: confirm a real
   fare comes back, and that clicking the resulting `deep_link_url` lands on a
   working VootFly booking page with matching price.
