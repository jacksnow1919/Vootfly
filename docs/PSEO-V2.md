# pSEO Hierarchy v2 (Skyscanner model)

Prepared by: Nida Bano Abbasi

Short flat URLs, deep breadcrumbs. Every breadcrumb crumb is a real hub page generated from the `places` parent chain.
Full strategy: see the v2 strategy document (VootFly-pSEO-Hierarchy-and-Strategy-v2).

## Deploy checklist
1. Apply migrations in the Supabase SQL editor: `20260902090000_pseo_hierarchy_v2.sql` (applied), `20260902103000_fix_punta_cana_code.sql` (applied), `20260902120000_route_candidates.sql`.
2. Confirm `N8N_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` exist as server secrets.
3. Deploy; wait 75 to 90 seconds before testing (deployment propagation lag).
4. Smoke: `/flights-from/`, `/flights-from/nyc/`, `/flights-to/lon/`, `/sitemap.xml`. Route pages 404 until n8n publishes one.

## URL taxonomy
| Page | Path |
|---|---|
| Business route | `/flights/{from}/{to}/{from-slug}-to-{to-slug}/` e.g. `/flights/nyc/lon/new-york-to-london/` |
| First class route | `/first-class/{from}/{to}/{slug}/` |
| Origin hub | `/flights-from/{code}/` (country `us`, state `us-ny`, metro `nyc`, airport `jfk`) |
| Destination hub | `/flights-to/{code}/`, `/first-class-to/{code}/` |
| Directories | `/flights/`, `/first-class/`, `/flights-from/`, `/flights-to/`, `/first-class-to/` |
| Legacy | `/flights/{x}-to-{y}` 301s to the v2 path |

Wrong name slug or uppercase codes 301 to the canonical path. Single-airport cities are one `metro` row; only multi-airport metros have `airport` children.

## n8n contract (all endpoints need header `x-webhook-secret: $N8N_WEBHOOK_SECRET`)

### POST `/api/public/webhook/score-candidates`  body `{ "limit": 15 }`
W2 keyword-research step. For unscored gateway x destination pairs, calls Google Ads Keyword Planner (generateKeywordIdeas, US, English), keeps ideas that contain both places and a cabin word, and stores real `search_volume`, `competition_index` and `opportunity_score = round((volume / (competition_index + 1)) * 100) / 100` in `route_candidates`. Needs Lovable secrets `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`. Returns 400 with a clear message if they are missing.

### GET `/api/public/webhook/pages?queue=candidates&limit=15`
Scored candidates with no page yet, best `opportunity_score` first, each with its real keyword list (`keywords`) for W1 to target. Response carries `scoring: "keyword-planner"`; if nothing is scored yet it falls back to seed order and says `scoring: "seed-order"` so nobody mistakes it for a data-driven ranking. Creating a route page marks the candidate `promoted`.

### GET `/api/public/webhook/pages?queue=fare-refresh&limit=60`
Tiered, starvation-safe fare-refresh queue (see `assignRefreshTiers`/`fareRefreshQueue` in `seo-pages.server.ts`).
Every route page is ranked by `route_candidates.opportunity_score` percentile: top 15% is Tier A (refreshed every
12h), next 35% is Tier B (48h), the rest is Tier C (7 days). A page with no scored candidate row defaults to
Tier C, never guessed into a faster tier. Each call reserves ~50/30/20% of `limit` across A/B/C so a burst of
new Tier A candidates can never fully starve B or C. Corrected 2 Sep 2026 after checking EazAir's actual code
directly -- EazAir has no proactive tiered schedule running; this design is new, not a copy.

Swap only `assignRefreshTiers()` once pages have real GSC click/impression history -- nothing else in the
pipeline changes. `limit` needs periodic re-tuning as real page count grows (see the workflow's sticky note
for the formula); it is not self-scaling.

Feed to W6.

### GET `/api/public/webhook/pages?queue=content&limit=5`
Route pages with a real fare snapshot but empty content, newest fare first, with place names/IATA attached. Feed to W1.

### GET `/api/public/webhook/pages?queue=published-24h&limit=200`
Pages published or refreshed in the last 24 hours. Feed to W5 daily summary.

### GET `/api/public/webhook/pages?queue=index-check&limit=50`
Published pages, least recently checked first. Feed to W4 (URL Inspection API).

### POST `/api/public/webhook/pages`  (single object or array, max 100)
```json
{
  "page_type": "route",
  "from_code": "nyc",
  "to_code": "lon",
  "cabin": "business",
  "meta_title": "Business Class Flights New York to London from $2,140 | VootFly",
  "meta_description": "...",
  "content_json": {
    "heading": "...", "intro": "...",
    "sections": [{"title": "...", "body": "..."}],
    "faqs": [{"q": "...", "a": "..."}],
    "sources": [{"label": "British Airways Club World", "url": "https://..."}]
  },
  "qa_score": 91,
  "fare_snapshot": { "lowest": {"amount": 2140, "currency": "USD", "airline": "British Airways", "depart_date": "2026-11-14"}, "fetched_at": "2026-09-02T09:00:00Z", "source": "pkfare" }
}
```
`path` is computed server-side for route, airline_route and hub types. `status` is decided by the index gate unless you pass it explicitly:
- no content: `pending` (hidden by RLS, 404 on site)
- content + qa_score >= 85 + fare snapshot under 7 days (route-type pages): `published`
- otherwise `noindex` (renders with `robots: noindex, follow`)

### POST `/api/public/webhook/fare-lookup`
```json
{ "from_code": "nyc", "to_code": "lon", "cabin": "business", "months": 0, "apply": true }
```
Runs a real PKfare search on the site (PKfare keys never enter n8n) and returns a `FareSnapshot`. Tries the metro IATA code first, then up to 3 airport pairs if empty. `months: n` adds n monthly probes (1 provider call each). `apply: true` writes the snapshot to the matching page and re-runs the index gate, so W6 is one call per route.

### POST `/api/public/webhook/fares`  (single or array)
```json
{ "from_code": "nyc", "to_code": "lon", "cabin": "business", "snapshot": { "lowest": {...}, "fares": [...], "by_month": [...], "fetched_at": "...", "source": "pkfare" } }
```
Re-runs the index gate after writing the snapshot.

### POST `/api/public/webhook/index-status`
```json
{ "path": "/flights/nyc/lon/new-york-to-london/", "indexed_status": "INDEXED", "checked_at": "..." }
```

### Deprecated
`POST /api/public/webhook/routes` (v1, writes to `seo_route_pages`). Do not use for new pages.

## Real-data rules enforced in code
- `FareSnapshot` renders only a real snapshot with its date; no snapshot means "no recent fare on file", never a placeholder number.
- Index gate refuses to publish route pages without a fresh real fare.
- Breadcrumbs, canonical paths and Product/Offer schema are derived, never typed.

## Known follow-ups (not in this PR)
- `src/lib/travel-data.ts` still has hardcoded `fromPrice` values on `/airlines/*` and `/destinations/*`. Remove before submitting those pages for indexing.
- Root `<title>` still says "Cheap Flight Deals"; needs the luxury positioning copy.
- Sitemap is a single file; split into a sitemap index once page count passes 5,000.
- Airline x route, airport and guide templates: phase 2.
