# VootFly — Master Strategy
**Search. Compare. Travel.**
Prepared by: Nida Bano Abbasi

---

## 1. Where VootFly actually stands today

The Lovable project you copied into the "vootfly" account is a remix of **ASAirspace** — a
luxury, business/first-class-only flight OTA. That matters, because it means you didn't start
from zero, but you also didn't start from a blank mass-market template. Two things are true at
once:

- **You inherited a lot for free**: a working flight search/results/booking flow, a proven
  programmatic-SEO hierarchy (places table → route pages → hub pages → breadcrumbs), an n8n
  automation pipeline (content generation, candidate growth, fare refresh), Supabase schema,
  and an admin dashboard shell. This is the same engine that got EazAir and ASAirspace live
  with real published pages.
- **You inherited the wrong positioning**: cabin-class/first-class-only routing, luxury copy,
  no hotels, no cars, a narrow "Flights / Deals / About / Contact" nav. None of that matches
  the brief in your original Vootfly prompt (a general Skyscanner/booking.com/Expedia-style
  metasearch platform across flights, hotels, and cars, "for everyone," economy included).

**Status as of this session**: I've done the surface-level rebrand (logo, brand name, domain,
emails, nav, hero copy, meta tags, robots.txt) and opened **PR #1** on
`aureliantravels4-source/vootfly` for your review — nothing merged to `main` without your
sign-off. The deeper repositioning (below) is the real work and needs decisions from you
before I touch code further.

---

## 2. Positioning — how VootFly actually beats Skyscanner/Kayak

You can't out-Skyscanner Skyscanner on brand trust or ad budget on day one. What you *can* do
— and what your own hierarchy-based pSEO architecture is built for — is out-cover them on
**long-tail route and destination search intent**, the same way EazAir and ASAirspace are
already proving works. Three angles:

1. **Programmatic depth over hand-built breadth.** Skyscanner/Kayak have deep pockets but
   still can't hand-write a page for every {origin}→{destination} pair, every "cheapest month
   to fly X" query, or every {city} hotel/flight combo page. Your places-hierarchy engine
   already generates these with real breadcrumbs and internal linking instead of thin
   auto-generated junk — that's your moat if you scale it across flights *and* hotels *and*
   cars instead of just cabin-class flights.
2. **Answer-first content (AEO/GEO).** Both AI Overviews and traditional search increasingly
   reward a direct, extractable answer at the top of a page ("The cheapest month to fly
   NYC→London is..."), backed by supporting detail below. This is on your own "worth doing
   soon" list and it's cheap to build once — it also positions VootFly to get cited by AI
   assistants, which Skyscanner has been slower to optimize for.
3. **Tools people bookmark and link to.** Flight-duration/layover/budget calculators cost you
   almost nothing (pure client-side math, no data dependency) but earn backlinks and repeat
   visits neither Skyscanner nor Kayak specifically targets at the long tail.

None of this requires beating them on paid acquisition. It requires shipping more *correct*,
well-linked pages than they bother to, faster than they bother to.

---

## 3. Information architecture — generalizing the hierarchy engine

Your existing `hierarchy.ts` / places-table engine (country → state → metro → airport, with
derived breadcrumbs) is the right foundation. It needs to widen from "cabin-class flight
routes only" to the full structure from your original brief:

```
/flights                          /hotels                       /cars
/flights/usa                      /hotels/new-york               /cars/new-york
/flights/{from}/{to}/{slug}/      /hotels/dubai                  /destinations/paris
/flights-from/{code}/             /destinations
/flights-to/{code}/               /travel-guides
/cities/{slug}                    /airports/{iata}               /tools/{calculator-slug}
```

Decisions this forces, which I'd want your sign-off on before building:

- **Keep or retire the `/first-class*` and `/cabin-suites` routes?** They don't fit a
  mass-market brand. My recommendation: fold cabin selection into the *same* route-page
  template as a filter (Economy/Premium/Business/First), not a separate URL tree — one page
  per route, not four. Cuts duplicate-content risk too.
- **Hotels and cars are net-new builds**, not a rebrand of anything that exists. They need
  their own `HotelService` / `CarService` abstractions (mock data first, per your original
  "Important Development Rule"), matching the same `FlightService` pattern already in the
  codebase.
- **City/airport pages** (`/cities/{slug}`, `/airports/{iata}`) are the one item from the SEO
  list that's genuinely cheap because the `places` table already has this data — it's a
  template + route, not new data collection.

---

## 4. Phased build order (reconciled with what's inherited)

Your original 8-phase plan, adjusted for what's already standing:

| Phase | Scope | Status |
|---|---|---|
| 1 | Homepage, header, hero, flight search widget, destinations, deals, footer | **Mostly done** — inherited from ASAirspace, rebrand in PR #1. Widget needs cabin-class fields added (Economy/Premium/Business/First) and Hotels/Cars tabs |
| 2 | Flight results, filters, sorting, flight detail page | **Inherited, functional** — needs mass-market copy pass, remove luxury-only framing |
| 3 | Hotels: search, results, details | **Net new** |
| 4 | Cars: search, results, details | **Net new** |
| 5 | Destination/airport/route pages, travel guides | **Engine exists** (pSEO v2 hierarchy) — needs generalizing off cabin-class-only, plus travel guides content type is new |
| 6 | Admin dashboard, DB, auth, API abstraction | **Inherited shell** — needs Hotels/Cars sections added |
| 7 | Real API integrations (flight/hotel/car) | Not started — matches your "mock data first" rule, defer |
| 8 | Programmatic SEO system, AI content gen, n8n automation, auto-publishing | **Proven pipeline exists** (the exact one running on EazAir/ASAirspace: Keyword Planner scoring, Gemini content generation, QA gate, n8n webhooks) — needs a new n8n workflow set scoped to VootFly's places/verticals, following the same "never Lovable credits, feature branch + PR" rule |

**Recommended near-term order**: finish Phase 1 rebrand review (PR #1) → widen the pSEO
hierarchy off cabin-class (Phase 5 groundwork, since it's mostly config not new code) → build
Hotels (Phase 3) with mock data → replicate the n8n content pipeline for VootFly (Phase 8) once
there's a full page template to generate against. Cars (Phase 4) last — lowest search volume
of the three verticals for most routes.

---

## 5. Quick SEO wins (from your notes, prioritized by effort vs. impact)

Already actioned in PR #1:
- ✅ Tightened `robots.txt` to block `/admin/`
- ✅ `sitemap.xml` reference now points at the correct domain (the route already exists,
  `sitemap.tsx` / `sitemap[.]xml.ts`)

Next, roughly in order:
1. **AEO answer-layer** on route/destination pages — small effort, uses data already on the
   page, and is the single highest-leverage item for both classic SEO and AI-assistant
   citation.
2. **Flexible date search (±1/2/3 days)** — medium effort, drives real conversion lift, reuses
   the existing mock flight service.
3. **City & airport pages** — medium effort, pure template work off the existing `places`
   table, meaningfully expands page count/coverage.
4. **Travel calculator tools** (duration, layover, budget) — medium effort, no data
   dependency, good backlink bait, can ship independently of the rest of the roadmap.
5. **Deal Score badge** — small/medium, cosmetic-but-credible using existing mock price data;
   fine as a v1, but flag internally that it needs real historical pricing before you'd want
   to defend the number publicly.
6. **Functional currency selector** — lowest priority of the list; real value needs a live FX
   feed, and a fixed-rate "estimated" version is more work than value until the rest of the
   funnel is built.

---

## 6. Trust, conversion, and compliance guardrails

Carried over from your existing FaresMatch practice, apply the same discipline to VootFly:
- Any discount or specific fare shown publicly needs internal sign-off before publishing, plus
  the standard fare disclaimer, reproduced word-for-word.
- No unsupported claims like "guaranteed cheapest price" — matches your own brief's Section 20.
- Trust elements (reviews, badges, FAQ, support/contact, help center) belong on every vertical,
  not just flights, once hotels/cars ship.

---

## 7. Automation stack — reuse, don't rebuild

The n8n pipeline proven on EazAir and now live on ASAirspace (Keyword Planner scoring → PKfare
or equivalent fare lookup → Gemini content generation → QA gate → publish) is directly
reusable for VootFly's flight vertical, and the same pattern (score candidates → generate →
QA → publish) extends cleanly to hotel and car destination pages once those verticals have
real page templates. This is the biggest reason VootFly doesn't need 8 phases of manual page
building to compete on page count with Skyscanner/Kayak — it needs the template and the places
data, and the pipeline you already built does the rest.

All of this work continues to go through GitHub (feature branch + PR) per your standing
instruction — never Lovable credits.

---

## 8. Decisions made so far

1. **Retired `/first-class*` and `/cabin-suites`** — done. The pSEO hierarchy is a single
   `/flights` tree; cabin is a filter on the standard route page, not a separate URL tree.
2. **Domain confirmed**: `vootfly.com` is the user's own existing site (a quote-request/
   lead-gen travel agency), and this build is meant to eventually replace it. SITE_ORIGIN,
   canonical tags, sitemap, and contact emails pointing at vootfly.com are correct as-is.
3. **`places` seeded with a fresh, VootFly-specific baseline** (not synced from ASAirspace) —
   see `supabase/seed/0001_places_baseline.sql`. 12 countries, 22 metros, 9 airports as of
   2026-09-04, enough to make route pages, hub pages, and hub index pages render real
   navigation immediately. `seo_pages` (written content, fare snapshots) is still empty --
   see section 9.

## 9. Next up: replicate the n8n content pipeline for VootFly

This is now the highest-leverage next step. `places` existing means every route/hub page
resolves and renders (with computed default copy + the live search widget), but the polished
written content, meta descriptions, and fare snapshots that make a page actually competitive
in search all come from `seo_pages`, which only gets populated by the n8n pipeline (Keyword
Planner scoring → fare lookup → Gemini content generation → QA gate → publish) already proven
on EazAir and ASAirspace. VootFly needs its own copy of that workflow set, pointed at its own
Supabase project and its own `route_candidates`/`seo_pages` tables.
