import { Link } from "@tanstack/react-router";
import { FARE_DISCLAIMER } from "@/components/home/home-data";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { FlightSearchWidget } from "@/components/site/FlightSearchWidget";
import { AnswerLayer } from "@/components/site/AnswerLayer";
import { Price } from "@/components/site/Price";
import { buildRouteAnswer, buildStrictRouteAnswer } from "@/lib/answer-layer";
import { airlineName } from "@/lib/airline-names";
import { FareWatchCard } from "@/components/site/FareWatchCard";
import { ShieldCheck, Radar, ArrowRight, Headphones } from "lucide-react";
import { SITE_ORIGIN } from "@/lib/site-config";
import { useRegionSettings } from "@/lib/region-settings";
import {
  destinationHubPath,
  dedupeSimilarFares,
  formatUtcCheckTime,
  formatUtcDay,
  isLiveSnapshot,
  originHubPath,
  placeLabel,
  routePath,
  snapshotIsFresh,
  type Cabin,
  type Crumb,
  type FareSnapshot as Snapshot,
  type Place,
  type PlaceMap,
} from "@/lib/hierarchy";
import { PHONE_TEL, PHONE_DISPLAY } from "@/lib/site-contact";
import heroAsset from "@/assets/hero-tropical.jpg.asset.json";
import type { DestPhoto } from "@/lib/destination-images";
import {
  hasValidVerification,
  verifiedFactIsCurrent,
  type VerifiedMeta,
} from "@/lib/route-content-guard";

export type RouteContent = {
  /** 2 = strict template (13 Nov 2026): prices only from a live, fully described
   * snapshot; stored copy holds no numbers (see route-content-guard.ts). */
  template?: number;
  heading?: string;
  intro?: string;
  /** `verified`: a route fact checked against official sources (strict template, 14 Nov 2026). */
  sections?: { title?: string; body?: string; verified?: VerifiedMeta }[];
  faqs?: { q?: string; a?: string; verified?: VerifiedMeta }[];
  sources?: { label?: string; url: string }[];
};

type Summary = {
  path: string;
  from_code: string | null;
  to_code: string | null;
  fare_snapshot_json: unknown;
};

function lowestOf(s: unknown): { amount: number; currency: string } | null {
  const snap = s as Snapshot | null;
  return snap?.lowest ? { amount: snap.lowest.amount, currency: snap.lowest.currency } : null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Check date and official sources under a verified route fact. */
function VerifiedNote({ verified }: { verified: VerifiedMeta }) {
  return (
    <p className="mt-3 text-xs leading-5 text-muted-foreground">
      Checked {formatUtcDay(verified.checked_at)} against:{" "}
      {verified.sources.map((src, i) => (
        <span key={src.url}>
          {i ? "; " : ""}
          <a
            href={src.url}
            rel="nofollow noopener"
            target="_blank"
            className="text-primary hover:underline"
          >
            {src.label}
          </a>
        </span>
      ))}
      .
    </p>
  );
}

/** "A, B and C" */
function joinNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Strict template: states the currency a price is shown in, including when it
 * is an approximate conversion of the US dollar fare the supplier returned. */
function FareCurrencyNote() {
  const { currency, rates } = useRegionSettings();
  const converted = currency !== "USD" && !!rates?.rates[currency];
  return (
    <>
      {converted
        ? `Approximate ${currency} conversion of a US dollar (USD) fare`
        : "Prices in US dollars (USD)"}
    </>
  );
}

export function RoutePageView({
  cabin,
  from,
  to,
  crumbs,
  content,
  snapshot,
  canonicalPath,
  siblings,
  places,
  fromChain,
  toChain,
  baggageFees,
  photo,
  publishedPaths,
}: {
  cabin: Cabin;
  from: Place;
  to: Place;
  crumbs: Crumb[];
  content: RouteContent;
  snapshot: Snapshot | null;
  canonicalPath: string;
  siblings: { fromSameOrigin: Summary[]; toSameDestination: Summary[] };
  /** Paths of every live route page. Internal links are only drawn to these (29 Oct 2026). */
  publishedPaths?: string[];
  places: PlaceMap;
  fromChain: Place[];
  toChain: Place[];
  /** Real, sourced checked-bag fee per airline IATA code, where we have one
   * on file. Absent for any airline without a real verified fee -- never
   * filled with a guess (see baggage-fees.functions.ts). */
  baggageFees?: Record<
    string,
    { amount: number; currency: string; note: string | null; checkedAt: string }
  >;
  /** Real photo of the destination (added 28 Oct 2026). Absent: the generic hero is used. */
  photo?: DestPhoto | null;
}) {
  const heading = content.heading ?? `Flights from ${from.name} to ${to.name}`;
  // Strict template (13 Nov 2026, content_json.template === 2). Prices, the
  // answer sentence, the fare table and fare-derived facts show only when the
  // snapshot is live and fully described (isLiveSnapshot); otherwise the page
  // shows the no-fare fallback. Pages without the flag keep the behaviour below.
  const strict = content.template === 2;
  const liveSnap = strict && isLiveSnapshot(snapshot) ? snapshot : null;
  const showFares = strict ? !!liveSnap : !!snapshot?.lowest;
  const routeAnswer = strict
    ? liveSnap
      ? buildStrictRouteAnswer(from, to, liveSnap, places)
      : null
    : buildRouteAnswer(from, to, snapshot);

  // Verified route facts (14 Nov 2026): an item carrying a `verified` block is shown
  // only with complete sources and a check under VERIFIED_FACT_MAX_AGE_DAYS old, so an
  // unchecked or stale fact disappears instead of being shown as current.
  const showItem = (item: { verified?: unknown }) =>
    !("verified" in item) || (hasValidVerification(item) && verifiedFactIsCurrent(item));
  const sections = (content.sections ?? []).filter(showItem);

  // Airport-level variants of this route (metro -> airports on either side), for internal linking.
  const fromAirports = Object.values(places).filter(
    (p) => p.parent_code === from.code && p.level === "airport",
  );
  const toAirports = Object.values(places).filter(
    (p) => p.parent_code === to.code && p.level === "airport",
  );
  const fromMetro = fromChain.find((p) => p.level === "metro");
  const toMetro = toChain.find((p) => p.level === "metro");

  // Link only to route pages that are live (fixed 29 Oct 2026). Unpublished
  // airport variants return 404, and links to them told Google a large share
  // of this site's internal links go nowhere.
  const live = new Set(publishedPaths ?? []);
  const isLive = (path: string | null | undefined): path is string => !!path && live.has(path);
  const fromAirportLinks = fromAirports
    .map((a) => ({ a, path: routePath(places, a.code, to.code, cabin) }))
    .filter((x): x is { a: Place; path: string } => isLive(x.path));
  const toAirportLinks = toAirports
    .map((a) => ({ a, path: routePath(places, from.code, a.code, cabin) }))
    .filter((x): x is { a: Place; path: string } => isLive(x.path));
  const fromMetroPath =
    from.level === "airport" && fromMetro
      ? routePath(places, fromMetro.code, to.code, cabin)
      : null;
  const toMetroPath =
    to.level === "airport" && toMetro ? routePath(places, from.code, toMetro.code, cabin) : null;
  const fromMetroLink = isLive(fromMetroPath) ? fromMetroPath : null;
  const toMetroLink = isLive(toMetroPath) ? toMetroPath : null;
  const hasAirportLinks =
    fromAirportLinks.length > 0 || toAirportLinks.length > 0 || !!fromMetroLink || !!toMetroLink;

  // Multi-airport metros (NYC, LON, TYO, CHI...) have no single .iata --
  // that field is only set on airport-level places or single-airport
  // metros. Metro codes (NYC, TYO, LON...) are themselves valid, real
  // IATA metropolitan-area codes airlines/GDS systems accept for search,
  // so use the metro's own code as the fallback instead of requiring an
  // airport-specific IATA code. Previously required from.iata && to.iata,
  // which silently fell through to a bare "/flight/search" (no params at
  // all) for any multi-airport-metro route -- landing on validateSearch's
  // own hardcoded defaults (JFK-MIA, today's date) instead of this route.
  // Found 2026-09-09: every "Check Availability" link on the New York-
  // Tokyo page (both multi-airport metros) did exactly that.
  const fromCode = from.iata || from.code.toUpperCase();
  // Strict pages (13 Nov 2026): a multi-airport city such as London has no airport
  // code of its own, and the search turns its city code into a single airport anyway.
  // Use the airport the stored fare search actually used, so the box reads
  // "London (LHR)" rather than a bare "LON" and matches the fares shown.
  const toCode =
    to.iata ||
    (strict && snapshot?.searched?.destination
      ? snapshot.searched.destination
      : to.code.toUpperCase());
  // VootFly is positioned as a lowest-price/economy platform, not the
  // business-class-focused sibling project this pSEO system was
  // originally modelled on (hierarchy.ts's Cabin type is still
  // "business" | "first" only, a structural leftover -- see the
  // 2026-09-11 fix notes there). Every route page currently has
  // cabin="business", so this ternary's "business" branch is really the
  // default for the whole site right now -- point it at Economy, not
  // Business, so "Check Availability" reflects VootFly's actual
  // positioning instead of the copied luxury-OTA default.
  const searchHref = `/flight/search?origin=${fromCode}&destination=${toCode}&cabin=${cabin === "first" ? "First" : "Economy"}`;

  // Real, derived-from-data info tiles -- never invented. Each one is omitted
  // if the underlying real data isn't there rather than filled with a guess.
  // Display-layer safeguard (2026-09-17): stored snapshots fetched before
  // the selection-logic fix above (seo-pages.server.ts) may still hold
  // several fares that are indistinguishable in this UI -- same airline,
  // price, duration and stops, differing only in a fare-class/booking code
  // this page does not show. Collapsing those here means already-stored
  // real data renders sensibly without spending another PKFARE call just
  // to re-fetch it; it never merges fares that actually differ on what's
  // shown.
  const fares = dedupeSimilarFares(snapshot?.fares ?? []);
  const durations = fares
    .map((f) => f.duration_minutes)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const nonStopDurations = fares
    .filter((f) => (f.stops ?? 0) === 0)
    .map((f) => f.duration_minutes)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const airlineList = [
    ...new Set(fares.map((f) => airlineName(f.airline ?? f.airline_code)).filter(Boolean)),
  ];
  // "Most seen airline" and "average flight time" tiles were dropped in the
  // 29 Oct 2026 redesign: frequency within one search and an average over
  // mixed one-stop journeys told a traveller nothing useful.
  const cheapestMonth = snapshot?.by_month?.length
    ? [...snapshot.by_month].sort((a, b) => a.lowest - b.lowest)[0]
    : null;

  // Strict template: one extra question answered from the live snapshot only,
  // never stored (the stored copy may hold no airline claims).
  const searchedPair = liveSnap?.searched
    ? (() => {
        const o = Object.values(places).find((p) => p.iata === liveSnap.searched!.origin);
        const d = Object.values(places).find((p) => p.iata === liveSnap.searched!.destination);
        return `${o ? placeLabel(o) : liveSnap.searched!.origin} to ${d ? placeLabel(d) : liveSnap.searched!.destination}`;
      })()
    : null;
  const liveTripText = liveSnap
    ? `${liveSnap.adults} adult${liveSnap.adults === 1 ? "" : "s"}, ${
        liveSnap.lowest.return_date
          ? `round trip ${formatUtcDay(liveSnap.lowest.depart_date)} to ${formatUtcDay(liveSnap.lowest.return_date)}`
          : `one way on ${formatUtcDay(liveSnap.lowest.depart_date)}`
      }`
    : null;
  const liveAirlines = liveSnap
    ? [
        ...new Set(
          dedupeSimilarFares(liveSnap.fares ?? [])
            .map((f) => airlineName(f.airline ?? f.airline_code))
            .filter(Boolean),
        ),
      ]
    : [];
  const faqs = [
    ...(content.faqs ?? []).filter(showItem),
    ...(liveSnap && liveAirlines.length
      ? [
          {
            q: `Which airlines appeared in our latest ${from.name} to ${to.name} search?`,
            a: `Our search checked ${formatUtcCheckTime(liveSnap.fetched_at)}, for ${liveTripText}${
              searchedPair ? `, from ${searchedPair}` : ""
            }, returned fares from ${joinNames(liveAirlines)}. This is one search, not a full timetable, so search your own dates to see every option.`,
          },
        ]
      : []),
  ];

  // Product/Offer structured data removed 29 Oct 2026: a flight route is not
  // a product, and marking a fare "InStock" claimed availability nobody had
  // verified. FAQ and breadcrumb data stay.
  //
  // Strict template (13 Nov 2026, at the owner's request): a plain Offer for the
  // lowest live fare, only while the snapshot is live. It states price, currency,
  // passenger count, dates and check time, and makes no availability claim.
  const offerLd = liveSnap
    ? {
        "@context": "https://schema.org",
        "@type": "Offer",
        name: `${liveSnap.lowest.return_date ? "Round-trip" : "One-way"} fare, ${searchedPair ?? `${from.name} to ${to.name}`}, ${liveSnap.adults} adult${liveSnap.adults === 1 ? "" : "s"}`,
        description: `Lowest fare in our search checked ${formatUtcCheckTime(liveSnap.fetched_at)}, ${liveTripText}${
          airlineName(liveSnap.lowest.airline ?? liveSnap.lowest.airline_code)
            ? `, on ${airlineName(liveSnap.lowest.airline ?? liveSnap.lowest.airline_code)}`
            : ""
        }.`,
        price: liveSnap.lowest.amount,
        priceCurrency: "USD",
        validFrom: liveSnap.fetched_at,
        url: SITE_ORIGIN + canonicalPath,
        eligibleQuantity: {
          "@type": "QuantitativeValue",
          value: liveSnap.adults,
          unitText: "adult",
        },
        seller: { "@type": "Organization", name: "VootFly", url: SITE_ORIGIN },
      }
    : null;

  const faqLd = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs
          .filter((f) => f.q && f.a)
          .map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
      }
    : null;

  // Dates shown over the fare table. Every fare in a snapshot is from one
  // search, so the first fare's dates describe the whole table.
  const sampleFare = fares[0];
  const tripLabel = sampleFare?.depart_date
    ? sampleFare.return_date
      ? `Round trip, ${formatDate(sampleFare.depart_date)} to ${formatDate(sampleFare.return_date)}`
      : `One way, departing ${formatDate(sampleFare.depart_date)}`
    : null;

  // "At a glance" facts, each derived from real data and omitted when the
  // data isn't there. Replaces the former grid of info tiles (29 Oct 2026).
  const glance: { label: string; value: string }[] = [];
  if (nonStopDurations.length) {
    const lo = formatDuration(Math.min(...nonStopDurations));
    const hi = formatDuration(Math.max(...nonStopDurations));
    glance.push({ label: "Nonstop flight time", value: lo === hi ? lo! : `${lo} to ${hi}` });
  } else if (durations.length) {
    glance.push({
      label: "Shortest journey in our search",
      value: `${formatDuration(Math.min(...durations))} with a stop`,
    });
  }
  if (airlineList.length)
    glance.push({ label: "Airlines in our search", value: airlineList.slice(0, 6).join(", ") });
  if (cheapestMonth) glance.push({ label: "Lowest month we checked", value: cheapestMonth.month });
  if (toAirports.length) {
    glance.push({
      label: `Airports in ${to.name}`,
      value: toAirports.map((a) => `${a.name}${a.iata ? ` (${a.iata})` : ""}`).join(", "),
    });
  }

  // Strict template facts: only what this one live search returned, labelled as
  // such. No "airports in London" list (the places table holds only some of a
  // city's airports) and no monthly figure.
  const strictGlance: { label: string; value: string }[] = [];
  if (liveSnap) {
    if (nonStopDurations.length) {
      const lo = formatDuration(Math.min(...nonStopDurations));
      const hi = formatDuration(Math.max(...nonStopDurations));
      strictGlance.push({
        label: "Nonstop flight time in this search",
        value: lo === hi ? lo! : `${lo} to ${hi}`,
      });
    } else if (durations.length) {
      strictGlance.push({
        label: "Shortest journey in this search",
        value: `${formatDuration(Math.min(...durations))} with a stop`,
      });
    }
    if (liveAirlines.length)
      strictGlance.push({
        label: "Airlines in this search",
        value: liveAirlines.slice(0, 6).join(", "),
      });
    if (searchedPair) strictGlance.push({ label: "Airports searched", value: searchedPair });
  }

  const sectionParagraphs = (body: string) =>
    body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

  return (
    <div className="bg-background pb-20">
      {faqLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      ) : null}
      {offerLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(offerLd) }}
        />
      ) : null}

      {/* Photo hero. The three lines under the intro are things VootFly can
          stand behind: real fares with a check date, an advisor confirming
          before payment, and a phone number. Not "real-time fares". */}
      <section className="relative">
        <img
          src={photo?.url ?? heroAsset.url}
          alt={photo?.alt ?? ""}
          className="absolute inset-0 size-full object-cover"
          width={photo ? 2000 : 1920}
          height={photo ? 1125 : 1088}
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-navy/65" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:py-14">
          <h1 className="max-w-3xl font-display text-2xl font-bold leading-tight text-navy-foreground sm:text-4xl">
            {heading}
          </h1>
          {content.intro ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-foreground/90 sm:text-base">
              {content.intro}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-navy-foreground/90 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Radar className="size-4 text-gold" /> Real fares, with the date we checked them
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-gold" /> An advisor confirms before you pay
            </span>
            <a
              href={`tel:${PHONE_TEL.replace("tel:", "")}`}
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              <Headphones className="size-4 text-gold" /> {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      {/* Search widget floats over the hero/content boundary */}
      <div className="relative z-10 mx-auto -mt-7 max-w-7xl px-4 sm:-mt-9">
        <FlightSearchWidget
          defaultOrigin={fromCode}
          defaultDestination={toCode}
          // Strict pages prefill dates only from a live snapshot, never a stale or past one.
          defaultDepartDate={strict ? liveSnap?.lowest.depart_date : snapshot?.lowest?.depart_date}
          defaultReturnDate={strict ? liveSnap?.lowest.return_date : snapshot?.lowest?.return_date}
        />
      </div>

      {/* Single column from here down. The only boxed element is the fare
          snapshot, because it is a distinct, dated object; everything else
          is a document with headings (29 Oct 2026 redesign). */}
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        {routeAnswer ? <AnswerLayer answer={routeAnswer} /> : null}

        {/* Fare snapshot panel */}
        {showFares && snapshot?.lowest ? (
          <section className="mt-8 overflow-hidden rounded-2xl border border-border">
            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              {liveSnap ? (
                <div>
                  <p className="text-sm text-muted-foreground">Lowest fare in our latest search</p>
                  <p className="mt-1 font-display text-4xl font-bold leading-none text-navy sm:text-5xl">
                    <Price usdAmount={liveSnap.lowest.amount} />
                  </p>
                  <p className="mt-3 text-sm text-navy">
                    {liveTripText}
                    {airlineName(liveSnap.lowest.airline ?? liveSnap.lowest.airline_code)
                      ? `, ${airlineName(liveSnap.lowest.airline ?? liveSnap.lowest.airline_code)}`
                      : ""}
                    {searchedPair ? `, ${searchedPair}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <FareCurrencyNote />. Checked {formatUtcCheckTime(liveSnap.fetched_at)}.{" "}
                    {FARE_DISCLAIMER}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Lowest fare found</p>
                  <p className="mt-1 font-display text-4xl font-bold leading-none text-navy sm:text-5xl">
                    <Price usdAmount={snapshot.lowest.amount} />
                  </p>
                  <p className="mt-3 text-sm text-navy">
                    {airlineName(snapshot.lowest.airline ?? snapshot.lowest.airline_code) ||
                      "Airline"}
                    {snapshot.lowest.depart_date
                      ? `, departing ${formatDate(snapshot.lowest.depart_date)}`
                      : ""}
                    {snapshot.lowest.return_date
                      ? `, returning ${formatDate(snapshot.lowest.return_date)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Checked {formatDate(snapshot.fetched_at)}
                    {snapshotIsFresh(snapshot.fetched_at)
                      ? ""
                      : " (older than 7 days, verify with a live search)"}
                    . {FARE_DISCLAIMER}
                  </p>
                </div>
              )}
              <a
                href={searchHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gold-foreground transition hover:brightness-110"
              >
                Check live availability <ArrowRight className="size-4" />
              </a>
            </div>

            {/* Not on strict pages: a month cell has no dates or passenger count to show with it. */}
            {!strict && snapshot.by_month?.length ? (
              <div className="border-t border-border bg-secondary/50 px-5 py-4 sm:px-7">
                <p className="text-sm font-semibold text-navy">
                  Lowest fare by month, one search per month
                </p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {snapshot.by_month.map((m) => {
                    const isLow = m.month === cheapestMonth?.month;
                    return (
                      <div
                        key={m.month}
                        className={`min-w-[104px] shrink-0 rounded-xl px-3 py-2.5 text-center ${
                          isLow ? "bg-primary text-primary-foreground" : "bg-background text-navy"
                        }`}
                      >
                        <p
                          className={`text-xs ${isLow ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                        >
                          {m.month}
                        </p>
                        <p className="mt-0.5 text-base font-bold">
                          <Price usdAmount={m.lowest} />
                        </p>
                      </div>
                    );
                  })}
                </div>
                {snapshot.by_month_fetched_at &&
                snapshot.by_month_fetched_at !== snapshot.fetched_at ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Monthly prices last checked {formatDate(snapshot.by_month_fetched_at)}. The
                    headline fare above is refreshed more often.
                  </p>
                ) : null}
              </div>
            ) : null}

            {fares.length ? (
              <div className="border-t border-border px-5 py-5 sm:px-7">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-display text-lg font-semibold text-navy">
                    Fares we found by airline
                  </h2>
                  {liveSnap ? (
                    <p className="text-sm text-muted-foreground">
                      {liveTripText}, per person. <FareCurrencyNote />
                    </p>
                  ) : tripLabel ? (
                    <p className="text-sm text-muted-foreground">{tripLabel}, per person</p>
                  ) : null}
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Airline
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Journey
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Stops
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Fare
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fares.slice(0, 10).map((f, i) => {
                      // No bag fees on strict pages: none on file is verified for an international fare.
                      const bag = strict ? undefined : baggageFees?.[f.airline_code ?? ""];
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="py-3 pr-3 align-top">
                            <p className="font-semibold text-navy">
                              {airlineName(f.airline ?? f.airline_code) || "Airline"}
                            </p>
                            {/* Codeshare (14 Nov 2026): the airline selling the fare is not
                                the one flying it, as the supplier's own segments show. */}
                            {strict && f.operated_by?.length ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Operated by{" "}
                                {joinNames(f.operated_by.map((c) => airlineName(c) || c))}
                              </p>
                            ) : null}
                            {bag ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                With 1 checked bag: <Price usdAmount={f.amount + bag.amount} /> (fee
                                verified{" "}
                                {new Date(bag.checkedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  year: "numeric",
                                })}
                                )
                              </p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3 align-top text-navy">
                            {formatDuration(f.duration_minutes) ?? "Not stated"}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3 align-top text-navy">
                            {typeof f.stops === "number"
                              ? f.stops === 0
                                ? "Nonstop"
                                : `${f.stops} stop${f.stops > 1 ? "s" : ""}`
                              : "Not stated"}
                          </td>
                          <td className="py-3 text-right align-top font-display text-base font-bold text-navy">
                            <Price usdAmount={f.amount} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {(liveSnap ? strictGlance : glance).length ? (
              <dl className="grid gap-x-8 gap-y-4 border-t border-border px-5 py-5 sm:grid-cols-2 sm:px-7">
                {(liveSnap ? strictGlance : glance).map((g) => (
                  <div key={g.label}>
                    <dt className="text-xs text-muted-foreground">{g.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-navy">{g.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {liveSnap ? (
              <p className="border-t border-border px-5 py-4 text-xs text-muted-foreground sm:px-7">
                These results come from one search for the dates above. They may not include every
                airline or every nonstop flight on this route, so search your own dates for the full
                list.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-border p-5 sm:p-7">
            <p className="text-base text-navy">
              {strict
                ? `We don't have a recent fare check for ${from.name} to ${to.name} right now, so we are not showing a price. Search your dates to see live fares.`
                : `We do not have a recent fare on file for ${from.name} to ${to.name}. Run a live search for today's availability.`}
            </p>
            <a
              href={searchHref}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gold-foreground transition hover:brightness-110"
            >
              Search live fares <ArrowRight className="size-4" />
            </a>
          </section>
        )}

        <div className="mt-8">
          <FareWatchCard
            variant="inline"
            fromCode={from.code}
            toCode={to.code}
            fromName={from.name}
            toName={to.name}
            cabin={cabin}
            // Strict pages store the live starting price with the alert but don't print it here.
            baselinePrice={strict ? liveSnap?.lowest.amount : snapshot?.lowest?.amount}
            baselineCurrency={strict ? liveSnap?.lowest.currency : snapshot?.lowest?.currency}
            hideBaselineInText={strict}
          />
        </div>

        {/* The written guide: real headings over readable prose */}
        {sections.length ? (
          <article className="mt-12 max-w-3xl">
            {sections.map((s, i) => (
              <section key={s.title ?? i} className={i === 0 ? "" : "mt-10"}>
                {s.title ? (
                  <h2 className="font-display text-2xl font-semibold leading-tight text-navy">
                    {s.title}
                  </h2>
                ) : null}
                {s.body
                  ? sectionParagraphs(s.body).map((para, j) => (
                      <p key={j} className="mt-4 text-[17px] leading-7 text-navy/85">
                        {para}
                      </p>
                    ))
                  : null}
                {s.verified ? <VerifiedNote verified={s.verified} /> : null}
              </section>
            ))}
          </article>
        ) : null}

        {faqs.length ? (
          <section className="mt-14 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold leading-tight text-navy">
              Questions about {from.name} to {to.name} flights
            </h2>
            <dl className="mt-2 divide-y divide-border">
              {faqs.map((f, i) => (
                <div key={f.q ?? i} className="py-5">
                  <dt className="text-base font-semibold text-navy">{f.q}</dt>
                  <dd className="mt-2 text-[17px] leading-7 text-navy/85">{f.a}</dd>
                  {"verified" in f && f.verified ? <VerifiedNote verified={f.verified} /> : null}
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {content.sources?.length ? (
          <section className="mt-10 max-w-3xl border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-navy">Sources</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {content.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    rel="nofollow noopener"
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    {s.label ?? s.url}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* Call banner */}
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-navy px-5 py-5 text-navy-foreground sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10">
              <Headphones className="size-5" />
            </span>
            <div>
              <p className="text-base font-bold">Want an advisor to check this route for you?</p>
              <p className="text-sm text-navy-foreground/70">
                Call us and we will confirm the fare and seat before you pay.
              </p>
            </div>
          </div>
          <a
            href={`tel:${PHONE_TEL.replace("tel:", "")}`}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-gold-foreground transition hover:brightness-110"
          >
            Call {PHONE_DISPLAY}
          </a>
        </div>

        {/* Route directory: the former sidebar, as plain link columns. Strict pages
            list the links without prices: another route's stored fare carries no
            dates, passenger count or check time here. */}
        <section className="mt-14 border-t border-border pt-8">
          <h2 className="font-display text-xl font-semibold text-navy">More routes</h2>
          <div className="mt-5 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-navy">From {from.name}</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li>
                  <Link to={originHubPath(from.code)} className="text-primary hover:underline">
                    All flights from {placeLabel(from)}
                  </Link>
                </li>
                {siblings.fromSameOrigin.map((s) => {
                  const dest = s.to_code ? places[s.to_code] : undefined;
                  const low = lowestOf(s.fare_snapshot_json);
                  return (
                    <li key={s.path}>
                      <Link to={s.path} className="text-primary hover:underline">
                        {from.name} to {dest?.name ?? s.to_code}
                      </Link>
                      {low && !strict ? (
                        <span className="text-muted-foreground">
                          {" "}
                          from <Price usdAmount={low.amount} />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-navy">To {to.name}</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li>
                  <Link
                    to={destinationHubPath(to.code, cabin)}
                    className="text-primary hover:underline"
                  >
                    All flights to {placeLabel(to)}
                  </Link>
                </li>
                {siblings.toSameDestination.map((s) => {
                  const org = s.from_code ? places[s.from_code] : undefined;
                  const low = lowestOf(s.fare_snapshot_json);
                  return (
                    <li key={s.path}>
                      <Link to={s.path} className="text-primary hover:underline">
                        {org?.name ?? s.from_code} to {to.name}
                      </Link>
                      {low && !strict ? (
                        <span className="text-muted-foreground">
                          {" "}
                          from <Price usdAmount={low.amount} />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            {hasAirportLinks ? (
              <div>
                <h3 className="text-sm font-semibold text-navy">By airport</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {fromAirportLinks.map(({ a, path }) => (
                    <li key={a.code}>
                      <Link to={path} className="text-primary hover:underline">
                        {placeLabel(a)} to {to.name}
                      </Link>
                    </li>
                  ))}
                  {toAirportLinks.map(({ a, path }) => (
                    <li key={a.code}>
                      <Link to={path} className="text-primary hover:underline">
                        {from.name} to {placeLabel(a)}
                      </Link>
                    </li>
                  ))}
                  {fromMetroLink && fromMetro ? (
                    <li>
                      <Link to={fromMetroLink} className="text-primary hover:underline">
                        All {fromMetro.name} airports to {to.name}
                      </Link>
                    </li>
                  ) : null}
                  {toMetroLink && toMetro ? (
                    <li>
                      <Link to={toMetroLink} className="text-primary hover:underline">
                        {from.name} to all {toMetro.name} airports
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
