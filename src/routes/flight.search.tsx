import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Plane, Clock, Briefcase, GitCompare, X, TrendingDown, Loader2, SlidersHorizontal, ChevronLeft } from "lucide-react";
import { searchFlightsWithMeta, type PkfareNormalisedFare } from "@/services/flightSearch";
import { FlightDetails } from "@/components/site/FlightDetails";
import { MotionLogo } from "@/components/site/MotionLogo";
import { FareWatchCard } from "@/components/site/FareWatchCard";
import { getSearchWatch } from "@/lib/search-watch.functions";
import { Price } from "@/components/site/Price";
import { useRegionSettings } from "@/lib/region-settings";
import { formatMoney } from "@/lib/hierarchy";
import { compareFares } from "@/lib/comparison-engine";
import { track } from "@/lib/analytics";

export type SearchParams = {
  origin: string;
  destination: string;
  date: string;
  returnDate?: string | undefined;
  passengers: number;
  cabin: "Economy" | "PremiumEconomy" | "Business" | "First";
  currency?: string | undefined;
  airline?: string | undefined;
  /** true = switch the Non-stop filter on once fares arrive (homepage Direct flights only). */
  direct?: true | undefined;
};

const asStr = (v: unknown, fallback: string) =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;

export const AIRLINE_NAMES: Record<string, string> = {
  QR: "Qatar Airways",
  EK: "Emirates",
  SQ: "Singapore Airlines",
  NH: "ANA",
  DL: "Delta",
  LH: "Lufthansa",
  BA: "British Airways",
  AA: "American Airlines",
  UA: "United Airlines",
  AF: "Air France",
  EY: "Etihad Airways",
  TK: "Turkish Airlines",
};

export const Route = createFileRoute("/flight/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const pax = Number(search["passengers"]);
    return {
      origin: asStr(search["origin"], "JFK").toUpperCase(),
      destination: asStr(search["destination"], "MIA").toUpperCase(),
      date: asStr(search["date"], format(new Date(), "yyyy-MM-dd")),
      ...(asStr(search["returnDate"], "") ? { returnDate: asStr(search["returnDate"], "") } : {}),
      passengers: Number.isFinite(pax) && pax > 0 ? Math.min(9, Math.round(pax)) : 1,
      airline: asStr(search["airline"], "").toUpperCase().slice(0, 3),
      // Accepts direct=true, direct=1 and the older direct="1" so any shared link keeps working.
      ...(search["direct"] === true || search["direct"] === 1 || search["direct"] === "1" || search["direct"] === "true" ? { direct: true as const } : {}),
      currency: asStr(search["currency"], "USD").toUpperCase(),
      cabin: (() => {
        const raw = asStr(search["cabin"], "Economy").toLowerCase();
        if (raw === "premiumeconomy" || raw === "premium economy") return "PremiumEconomy" as const;
        if (raw === "business") return "Business" as const;
        if (raw === "first") return "First" as const;
        // Falls through to Economy for "economy" and for anything
        // unrecognised -- VootFly's actual positioning is lowest-price/
        // economy, so an unrecognised cabin string should never silently
        // become the most expensive option (previously fell through to
        // "Business" here).
        return "Economy" as const;
      })(),
    };
  },

  head: () => ({
    meta: [
      { title: "Flight Search Results | VootFly" },
      {
        name: "description",
        content:
          "Compare live flight fares from airlines worldwide, with filters for stops, times and airlines.",
      },
      { property: "og:title", content: "Flight Search Results" },
      { property: "og:description", content: "Filter flight fares by airline, price and departure time." },
    ],
  }),
  component: SearchPage,
  errorComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold text-navy">
        We are currently checking live rates with our airline desk.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Please refresh or call our advisors on +1-800-773-6613 for more options.
      </p>
    </div>
  ),
});

export const ALLIANCES: Record<string, string[]> = {
  Oneworld: ["QR", "BA", "AA", "CX", "JL", "AY", "IB", "QF", "MH", "RJ", "UL", "AT", "AS"],
  SkyTeam: ["DL", "AF", "KL", "KE", "SU", "AZ", "MU", "CI", "VN", "SV", "AM", "RO", "KQ"],
  "Star Alliance": ["LH", "SQ", "NH", "UA", "AC", "TK", "TG", "OS", "LX", "SN", "SK", "ET", "AI", "OZ", "BR", "ZH", "MS", "CA"],
};

const TIME_BLOCKS = [
  { label: "00–06", from: 0, to: 360 },
  { label: "06–12", from: 360, to: 720 },
  { label: "12–18", from: 720, to: 1080 },
  { label: "18–24", from: 1080, to: 1441 },
] as const;

type SortKey = "cheapest" | "fastest" | "best";

type Filters = {
  stops: string[];
  maxPrice: number | null;
  airlines: string[];
  alliances: string[];
  maxDuration: number | null;
  maxLayover: number | null;
  departBlocks: string[];
  arriveBlocks: string[];
};

const emptyFilters: Filters = {
  stops: [],
  maxPrice: null,
  airlines: [],
  alliances: [],
  maxDuration: null,
  maxLayover: null,
  departBlocks: [],
  arriveBlocks: [],
};

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const minutesLabel = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

const stopsBucket = (stops: number) => (stops === 0 ? "Non-stop" : stops === 1 ? "1 Stop" : "2+ Stops");

const inBlocks = (minutes: number, blocks: string[]) =>
  blocks.length === 0 ||
  blocks.some((label) => {
    const b = TIME_BLOCKS.find((t) => t.label === label);
    return b ? minutes >= b.from && minutes < b.to : true;
  });

type Bounds = {
  minPrice: number;
  maxPrice: number;
  minDuration: number;
  maxDuration: number;
  maxLayover: number;
  airlines: { code: string; name: string; price: number }[];
  stops: string[];
  alliances: string[];
};

function computeBounds(fares: PkfareNormalisedFare[]): Bounds {
  const prices = fares.map((f) => f.price);
  const durations = fares.map((f) => f.durationMinutes || 0);
  const byAirline = new Map<string, { code: string; name: string; price: number }>();
  for (const f of fares) {
    const code = f.carrierCode || f.flightNo.slice(0, 2).toUpperCase();
    const name = AIRLINE_NAMES[code] ?? f.airline ?? code;
    const existing = byAirline.get(code);
    if (!existing || f.price < existing.price) byAirline.set(code, { code, name, price: f.price });
  }
  const codes = [...byAirline.keys()];
  return {
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    minDuration: durations.length ? Math.min(...durations) : 0,
    maxDuration: durations.length ? Math.max(...durations) : 0,
    maxLayover: fares.reduce((m, f) => Math.max(m, f.maxLayoverMinutes || 0), 0),
    airlines: [...byAirline.values()].sort((a, b) => a.price - b.price),
    stops: ["Non-stop", "1 Stop", "2+ Stops"].filter((s) =>
      fares.some((f) => stopsBucket(f.stops) === s),
    ),
    alliances: Object.keys(ALLIANCES).filter((a) =>
      codes.some((c) => ALLIANCES[a]!.includes(c)),
    ),
  };
}

function applyFilters(fares: PkfareNormalisedFare[], f: Filters): PkfareNormalisedFare[] {
  return fares.filter((fare) => {
    const code = fare.carrierCode || fare.flightNo.slice(0, 2).toUpperCase();
    if (f.stops.length && !f.stops.includes(stopsBucket(fare.stops))) return false;
    if (f.maxPrice !== null && fare.price > f.maxPrice) return false;
    if (f.airlines.length && !f.airlines.includes(code)) return false;
    if (f.alliances.length && !f.alliances.some((a) => ALLIANCES[a]!.includes(code))) return false;
    if (f.maxDuration !== null && (fare.durationMinutes || 0) > f.maxDuration) return false;
    if (f.maxLayover !== null && (fare.maxLayoverMinutes || 0) > f.maxLayover) return false;
    if (!inBlocks(fare.departMinutes ?? 0, f.departBlocks)) return false;
    if (!inBlocks(fare.arriveMinutes ?? 0, f.arriveBlocks)) return false;
    return true;
  });
}

function sortFares(fares: PkfareNormalisedFare[], sort: SortKey, bounds: Bounds) {
  const list = [...fares];
  if (sort === "cheapest") return list.sort((a, b) => a.price - b.price);
  if (sort === "fastest")
    return list.sort((a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0));
  const priceSpan = Math.max(1, bounds.maxPrice - bounds.minPrice);
  const durSpan = Math.max(1, bounds.maxDuration - bounds.minDuration);
  const score = (f: PkfareNormalisedFare) =>
    0.6 * ((f.price - bounds.minPrice) / priceSpan) +
    0.4 * (((f.durationMinutes || 0) - bounds.minDuration) / durSpan);
  return list.sort((a, b) => score(a) - score(b));
}

function SidebarFilters({
  bounds,
  filters,
  setFilters,
}: {
  bounds: Bounds;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  const { convert } = useRegionSettings();
  const priceValue = filters.maxPrice ?? bounds.maxPrice;
  const durationValue = filters.maxDuration ?? bounds.maxDuration;
  const layoverValue = filters.maxLayover ?? bounds.maxLayover;

  return (
    <div className="space-y-4">
      {bounds.stops.length > 1 ? (
        <FilterCard title="Stopovers">
          {bounds.stops.map((o) => (
            <Check
              key={o}
              label={o}
              checked={filters.stops.includes(o)}
              onChange={() => setFilters((p) => ({ ...p, stops: toggleIn(p.stops, o) }))}
            />
          ))}
        </FilterCard>
      ) : null}

      {bounds.maxPrice > bounds.minPrice ? (
        <FilterCard title="Price Range">
          <input
            type="range"
            min={bounds.minPrice}
            max={bounds.maxPrice}
            step={10}
            value={priceValue}
            onChange={(e) => setFilters((p) => ({ ...p, maxPrice: Number(e.target.value) }))}
            className="w-full accent-[var(--gold)]"
          />
          <p className="text-xs font-semibold text-muted-foreground">
            Up to ${priceValue.toLocaleString()}
          </p>
        </FilterCard>
      ) : null}

      {bounds.maxDuration > bounds.minDuration ? (
        <FilterCard title="Flight Duration">
          <input
            type="range"
            min={bounds.minDuration}
            max={bounds.maxDuration}
            step={15}
            value={durationValue}
            onChange={(e) => setFilters((p) => ({ ...p, maxDuration: Number(e.target.value) }))}
            className="w-full accent-[var(--gold)]"
          />
          <p className="text-xs font-semibold text-muted-foreground">
            Up to {minutesLabel(durationValue)}
          </p>
        </FilterCard>
      ) : null}

      {bounds.maxLayover > 0 ? (
        <FilterCard title="Max Layover">
          <input
            type="range"
            min={0}
            max={bounds.maxLayover}
            step={15}
            value={layoverValue}
            onChange={(e) => setFilters((p) => ({ ...p, maxLayover: Number(e.target.value) }))}
            className="w-full accent-[var(--gold)]"
          />
          <p className="text-xs font-semibold text-muted-foreground">
            Up to {minutesLabel(layoverValue)}
          </p>
        </FilterCard>
      ) : null}

      <FilterCard title="Departure Time">
        <TimeBlocks
          selected={filters.departBlocks}
          onToggle={(t) => setFilters((p) => ({ ...p, departBlocks: toggleIn(p.departBlocks, t) }))}
        />
      </FilterCard>

      <FilterCard title="Arrival Time">
        <TimeBlocks
          selected={filters.arriveBlocks}
          onToggle={(t) => setFilters((p) => ({ ...p, arriveBlocks: toggleIn(p.arriveBlocks, t) }))}
        />
      </FilterCard>

      {bounds.airlines.length > 1 ? (
        <FilterCard title="Airlines">
          {bounds.airlines.map((a) => (
            <Check
              key={a.code}
              label={a.name}
              hint={formatMoney(convert(a.price).amount, convert(a.price).currency)}
              checked={filters.airlines.includes(a.code)}
              onChange={() => setFilters((p) => ({ ...p, airlines: toggleIn(p.airlines, a.code) }))}
            />
          ))}
        </FilterCard>
      ) : null}

      {bounds.alliances.length > 0 ? (
        <FilterCard title="Alliances">
          {bounds.alliances.map((a) => (
            <Check
              key={a}
              label={a}
              checked={filters.alliances.includes(a)}
              onChange={() => setFilters((p) => ({ ...p, alliances: toggleIn(p.alliances, a) }))}
            />
          ))}
        </FilterCard>
      ) : null}

      <button
        type="button"
        onClick={() => setFilters(emptyFilters)}
        className="w-full rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-navy hover:border-gold hover:text-gold"
      >
        Reset all filters
      </button>
    </div>
  );
}

function TimeBlocks({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (t: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TIME_BLOCKS.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onToggle(t.label)}
          className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
            selected.includes(t.label)
              ? "border-gold bg-gold/10 text-gold"
              : "border-border hover:border-gold hover:text-gold"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-display text-sm font-semibold text-navy">{title}</h2>
      {children}
    </div>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-[var(--gold)]"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="shrink-0 text-xs font-semibold text-gold">{hint}</span> : null}
    </label>
  );
}

const prettyDate = (iso: string) => {
  try {
    return format(parseISO(iso), "dd MMM yy");
  } catch {
    return iso;
  }
};

/** "+1"/"+2" day badge text when arrival lands on a later calendar date than departure. */
const dayOffset = (departDate: string, arriveDate: string): string | null => {
  if (!departDate || !arriveDate) return null;
  const d = Date.parse(`${departDate}T00:00:00Z`);
  const a = Date.parse(`${arriveDate}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(a)) return null;
  const days = Math.round((a - d) / 86_400_000);
  return days > 0 ? `+${days}` : null;
};

function SearchPage() {
  const { origin, destination, date, returnDate, passengers, cabin, currency, airline: airlineParam } = Route.useSearch();
  const airline = airlineParam ?? "";
  // Display-only currency conversion (real USD fare -> visitor's chosen
  // currency at today's real rate). Sorting, filtering and the price that
  // actually flows into checkout (searchFor() below) stay in raw USD --
  // converting those would drift from the real bookable amount and could
  // double-convert downstream. Only the rendered price text uses this.
  const { convert } = useRegionSettings();
  const [compare, setCompare] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("best");
  // Homepage "Direct flights only" arrives as direct=true. It switches the existing
  // Non-stop filter on once fares arrive, if any non-stop fare exists. If none does
  // (about 2 in 13 of our tracked routes today, e.g. New York to Singapore), all fares
  // are shown with a notice instead of an empty page. Travellers can still change it.
  const { direct } = Route.useSearch();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [directState, setDirectState] = useState<"off" | "pending" | "applied" | "unavailable">(direct ? "pending" : "off");

  // Fresh bounds whenever the query changes, so stale slider caps can't hide results.
  useEffect(() => {
    setFilters(emptyFilters);
    setDirectState(direct ? "pending" : "off");
  }, [origin, destination, date, returnDate, passengers, cabin, airline, direct]);

  const {
    data,
    isPending,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["flight-search", origin, destination, date, returnDate, passengers, cabin, airline, currency],
    retry: false,
    queryFn: () =>
      searchFlightsWithMeta({
        origin,
        destination,
        departDate: date,
        ...(returnDate ? { returnDate } : {}),
        adults: passengers,
        cabinClass: cabin,
        currency: currency || "USD",
        ...(airline ? { airline } : {}),
      }),
  });
  const allFlights = data?.fares ?? [];
  const fallbackReason = data?.fallbackReason;
  const sourceLabel = "live";
  const airlineName = airline ? (AIRLINE_NAMES[airline] ?? airline) : "";
  const carrierFlights = airline
    ? allFlights.filter(
        (f) =>
          f.carrierCode === airline.slice(0, 2) ||
          f.flightNo.toUpperCase().startsWith(airline) ||
          f.airline.toLowerCase().includes(airlineName.toLowerCase()),
      )
    : allFlights;

  const bounds = useMemo(() => computeBounds(carrierFlights), [carrierFlights]);
  const flights = useMemo(
    () => sortFares(applyFilters(carrierFlights, filters), sort, bounds),
    [carrierFlights, filters, sort, bounds],
  );

  const isLoading = isPending;
  const { data: routeWatch } = useQuery({
    queryKey: ["search-watch", origin, destination],
    queryFn: () => getSearchWatch({ data: { origin: String(origin), destination: String(destination) } }),
    enabled: typeof origin === "string" && typeof destination === "string" && origin.length === 3 && destination.length === 3,
    staleTime: 10 * 60_000,
  });
  const noResults = !isLoading && (isError || carrierFlights.length === 0);

  /* ---------------------------------------------------------------------
   * Funnel instrumentation (Phase 7).
   *
   * Before this, only the BOTTOM of the funnel was tracked (Checkout
   * Started, Booking Requested), so there was no way to tell whether a
   * drop happened because people never searched, searched and got
   * nothing, or got results and did not like them. These events close
   * that gap.
   *
   * Fired off real query OUTCOMES, never optimistically: the result event
   * only fires once the query has genuinely settled, and carries the real
   * result count and the real failure reason. A zero-result search is
   * recorded as its own outcome rather than silently looking like a
   * user who lost interest -- that distinction is the whole point.
   * ------------------------------------------------------------------- */
  const funnelKey = `${origin}|${destination}|${date}|${returnDate}|${passengers}|${cabin}|${airline}`;
  const lastTracked = useRef<string>("");
  useEffect(() => {
    if (isLoading) return;
    if (lastTracked.current === funnelKey) return; // one event per real search
    lastTracked.current = funnelKey;
    track("Search Results Shown", {
      origin,
      destination,
      depart_date: date,
      return_date: returnDate || null,
      passengers,
      cabin,
      result_count: carrierFlights.length,
      had_results: carrierFlights.length > 0,
      errored: isError,
      // Real diagnostic from the search service when nothing came back,
      // so a zero-result search can be traced to a cause rather than guessed at.
      fallback_reason: carrierFlights.length === 0 ? (fallbackReason ?? null) : null,
    });
  }, [isLoading, funnelKey, carrierFlights.length, isError, fallbackReason, origin, destination, date, returnDate, passengers, cabin]);
  const showDeskMessage = !isLoading && isError;
  const filteredOut = !isLoading && !noResults && flights.length === 0;
  const showEmpty = noResults;
  useEffect(() => {
    if (directState !== "pending" || isLoading) return;
    if (allFlights.length === 0) {
      setDirectState("off");
    } else if (allFlights.some((f) => f.stops === 0)) {
      setFilters((f) => ({ ...f, stops: ["Non-stop"] }));
      setDirectState("applied");
    } else {
      setDirectState("unavailable");
    }
  }, [directState, isLoading, allFlights]);

  const cheapest = flights.length
    ? flights.reduce((a, b) => (a.price <= b.price ? a : b))
    : undefined;
  const fastest = flights.length
    ? flights.reduce((a, b) => ((a.durationMinutes || 0) <= (b.durationMinutes || 0) ? a : b))
    : undefined;

  // Comparison Engine (built and tested in Phase 2, surfaced here in Phase 5).
  // Ranks the SAME real PKFARE fares already on screen by price, duration and
  // stops. It fetches nothing and changes no fare -- it only labels fares the
  // user is already looking at, so a traveller can see the real trade-off
  // instead of scanning a long list. Fares with no usable price or duration
  // are excluded from ranking by the engine rather than given a placeholder.
  const comparison = useMemo(() => compareFares(flights), [flights]);
  const badgesById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of comparison.fares) {
      const tags: string[] = [];
      if (c.isBestOverall) tags.push("Best overall");
      else {
        if (c.id === comparison.cheapestId) tags.push("Lowest fare");
        if (c.id === comparison.fastestId) tags.push("Quickest");
        if (c.id === comparison.fewestStopsId && c.stops === 0) tags.push("Fewest stops");
      }
      if (tags.length) m.set(c.id, tags);
    }
    return m;
  }, [comparison]);
  const selected = flights.filter((f) => compare.includes(f.flightNo));



  function toggle(flightNo: string) {
    setCompare((prev) =>
      prev.includes(flightNo) ? prev.filter((n) => n !== flightNo) : [...prev, flightNo].slice(-3),
    );
  }

  const searchFor = (f: PkfareNormalisedFare) => ({
    origin: f.origin,
    destination: f.destination,
    departDate: f.departDate,
    ...(f.returnFlight ? { returnDate: f.returnFlight.departDate } : {}),
    airline: f.airline,
    flightNo: f.flightNo,
    cabin: f.cabin,
    currency: f.currency,
    price: String(f.price),
    passengers: String(passengers),
    ...(f.supplier ? { supplier: f.supplier } : {}),
    ...(f.supplier === "duffel" ? { offer: f.id } : {}),
  });

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-secondary/50 pb-20">
      <div className="border-b border-border bg-navy px-4 py-2.5 text-navy-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <Link
            to="/"
            hash="flight-search"
            aria-label="Edit search"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-navy-foreground/25 px-2 py-1 text-navy-foreground transition hover:bg-navy-foreground/10 sm:px-3"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden text-xs font-bold sm:inline">Edit Search</span>
          </Link>
          <p className="min-w-0 flex-1 text-xs font-semibold leading-tight sm:text-sm">
            {origin} - {destination} <span className="text-navy-foreground/50">|</span>{" "}
            {passengers === 1 ? "Adult- 1" : `Adults- ${passengers}`}{" "}
            <span className="text-navy-foreground/50">|</span> {prettyDate(date)}
            {returnDate ? (
              <>
                {" "}
                <span className="text-navy-foreground/50">-</span> {prettyDate(returnDate)}
              </>
            ) : null}
          </p>
          {airline ? (
            <Link
              from={Route.fullPath}
              to="."
              search={(prev: SearchParams) => ({ ...prev, airline: "" })}
              className="hidden shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-bold text-gold hover:brightness-110 sm:inline-flex"
            >
              {airlineName} only <X className="size-3" />
            </Link>
          ) : null}
          <span className="hidden shrink-0 text-xs text-gold sm:inline">
            {isLoading
              ? "Searching fare inventory…"
              : showEmpty
                ? "No fares found"
                : `${flights.length} ${sourceLabel} ${cabin} fares`}
          </span>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
          <SidebarFilters bounds={bounds} filters={filters} setFilters={setFilters} />
        </aside>
        <div className="min-w-0 space-y-4">
          {!isLoading && !noResults ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-card">
                {([
                  ["best", "Best overall"],
                  ["cheapest", "Cheapest"],
                  ["fastest", "Fastest"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key)}
                    className={`flex-1 px-3 py-2.5 text-xs font-bold transition ${
                      sort === key ? "bg-navy text-navy-foreground" : "text-navy hover:text-gold"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-navy lg:hidden"
              >
                <SlidersHorizontal className="size-4 text-gold" /> Filters
              </button>
            </div>
          ) : null}

          {filteredOut ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
              <p className="font-display text-base font-semibold text-navy">
                No fares match your filters.
              </p>
              <button
                type="button"
                onClick={() => setFilters(emptyFilters)}
                className="mt-2 text-sm font-bold text-gold underline"
              >
                Reset filters
              </button>
            </div>
          ) : null}
          {directState === "unavailable" ? (
            <p role="status" className="mb-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-navy">
              No direct flights found for this route and date. Showing all options.
            </p>
          ) : null}

          {!isLoading && !showEmpty && cheapest && fastest ? (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl bg-secondary px-3.5 py-2.5 text-xs text-muted-foreground">
              <TrendingDown className="size-3.5 shrink-0 text-gold" />
              <span className="font-semibold text-navy">Best value:</span> {cheapest.airline} from <Price usdAmount={cheapest.price} />
              <span className="text-border">·</span>
              <span className="font-semibold text-navy">Fastest:</span> {fastest.airline} ({fastest.duration})
              {dataUpdatedAt ? (
                <>
                  <span className="text-border">·</span>
                  {/* Live Fare label (1 Nov 2026): these prices come from the airline search that just ran. */}
                  <span className="font-semibold text-navy">Live fares</span>, searched at{" "}
                  <time dateTime={new Date(dataUpdatedAt).toISOString()}>
                    {new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </time>
                </>
              ) : null}
            </p>
          ) : null}

          {isLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <MotionLogo className="h-14 w-auto shrink-0" loop />
                <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <Loader2 className="size-4 animate-spin text-gold" />
                  Verifying private airline fares…
                </p>
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
              ))}
            </div>
          ) : null}

          {/* Phase 5.4: offer a price alert after a search, only for routes that have a
              VootFly page (that page's tracked fare is what the alert checks). */}
          {!isLoading && routeWatch && String(cabin ?? "").toLowerCase() === "economy" ? (
            <FareWatchCard
              fromCode={routeWatch.fromCode}
              toCode={routeWatch.toCode}
              fromName={routeWatch.fromName}
              toName={routeWatch.toName}
              cabin="economy"
              baselinePrice={routeWatch.baselinePrice}
              baselineCurrency={routeWatch.baselineCurrency}
              source="search_results"
            />
          ) : null}

          {showEmpty ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
              <p className="font-display text-lg font-semibold text-navy">
                {showDeskMessage
                  ? "We are currently checking live rates with our airline desk."
                  : "No live fares available"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {showDeskMessage
                  ? "Please refresh or call our advisors for more options."
                  : "We couldn't find a live fare for this exact search. Please try different dates or route."}
              </p>
              {!showDeskMessage && fallbackReason ? (
                <p className="mt-3 font-mono text-[10px] text-muted-foreground/70">Diagnostic: {fallbackReason}</p>
              ) : null}
            </div>
          ) : null}

          {flights.map((f) => (
            <article
              key={f.id}
              className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="space-y-2.5 p-4">
                {badgesById.get(f.id)?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {badgesById.get(f.id)!.map((tag) => (
                      <span
                        key={tag}
                        className={
                          tag === "Best overall"
                            ? "inline-flex rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground"
                            : "inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-navy"
                        }
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <FlightLeg
                  code={f.carrierCode || f.flightNo.slice(0, 2)}
                  departTime={f.departTime}
                  origin={f.origin}
                  arriveTime={f.arriveTime}
                  destination={f.destination}
                  dayOffsetText={dayOffset(f.departDate, f.arriveDate)}
                  duration={f.duration}
                  stops={f.stops}
                />
                {f.returnFlight ? (
                  <FlightLeg
                    code={f.carrierCode || f.flightNo.slice(0, 2)}
                    departTime={f.returnFlight.departTime}
                    origin={f.returnFlight.origin}
                    arriveTime={f.returnFlight.arriveTime}
                    destination={f.returnFlight.destination}
                    dayOffsetText={dayOffset(f.returnFlight.departDate, f.returnFlight.arriveDate)}
                    duration={f.returnFlight.duration}
                    stops={f.returnFlight.stops}
                  />
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{f.airline}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {f.flightNo} · {f.cabin} · {f.refundable ? "Refundable" : "Non-refundable"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gold">Live Fare</p>
                  <p className="font-display text-xl font-bold leading-none text-navy">
                    <Price usdAmount={f.price} />
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">per person, incl. taxes</p>
                </div>
              </div>

              <FlightDetails fare={f} passengers={passengers} renderPrice={(amount) => <Price usdAmount={amount} />} />

              <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/40 px-4 py-2.5">
                <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={compare.includes(f.flightNo)}
                    onChange={() => toggle(f.flightNo)}
                    className="size-4 accent-[var(--gold)]"
                  />
                  Compare
                </label>
                {/* Goes straight to checkout. /flight/fare-details was retired on 29 Sep 2026 and
                    redirects to the homepage, so linking there sent every selected fare home. */}
                <Link
                  to="/flight/booking"
                  search={searchFor(f)}
                  onClick={() =>
                    track("Fare Selected", {
                      origin: f.origin,
                      destination: f.destination,
                      airline: f.airline,
                      carrier_code: f.carrierCode,
                      price: f.price,
                      currency: f.currency,
                      stops: f.stops,
                      duration_minutes: f.durationMinutes,
                      // Which comparison badge, if any, the traveller chose.
                      // This is the one signal that shows whether the badges
                      // actually influence choice, rather than assuming they do.
                      badges: badgesById.get(f.id) ?? [],
                      // Rank within the list they were shown, so we can see
                      // whether people take the first option or genuinely compare.
                      position: flights.findIndex((x) => x.id === f.id) + 1,
                      result_count: flights.length,
                    })
                  }
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-gold px-5 py-2 text-sm font-bold text-gold-foreground transition hover:brightness-110"
                >
                  Select
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-navy/60 backdrop-blur-sm lg:hidden">
          <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-secondary/95 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-navy">Filters</h2>
              <button
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="rounded-full bg-card p-2"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarFilters bounds={bounds} filters={filters} setFilters={setFilters} />
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-4 w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-gold-foreground"
            >
              Show {flights.length} flights
            </button>
          </div>
        </div>
      ) : null}

      {compare.length > 0 ? (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-xs font-bold text-navy-foreground shadow-lux md:bottom-6"
        >
          <GitCompare className="size-4 text-gold" /> Compare {compare.length} flights
        </button>
      ) : null}

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-navy/60 backdrop-blur-sm">
          <div className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-navy">Comparison drawer</h2>
              <button onClick={() => setDrawerOpen(false)} className="rounded-full bg-secondary p-2">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {selected.map((f) => (
                <div key={f.id} className="rounded-2xl border border-border p-4">
                  <p className="font-display text-base font-semibold text-navy">{f.airline}</p>
                  <p className="text-xs text-muted-foreground">{f.flightNo}</p>
                  <dl className="mt-3 space-y-1 text-xs">
                    <Row label="Depart" value={f.departTime} />
                    <Row
                      label="Arrive"
                      value={dayOffset(f.departDate, f.arriveDate) ? `${f.arriveTime} (${dayOffset(f.departDate, f.arriveDate)} day)` : f.arriveTime}
                    />
                    <Row label="Duration" value={f.duration} />
                    <Row label="Cabin" value={f.cabin} />
                    <Row label="Price" value={formatMoney(convert(f.price).amount, convert(f.price).currency)} />
                  </dl>
                  <Link
                    to="/flight/booking"
                    search={searchFor(f)}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-gold px-4 py-2 text-xs font-bold text-gold-foreground"
                  >
                    Select
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-navy">{value}</dd>
    </div>
  );
}

/**
 * One flight leg's row, laid out like Kayak's: [logo] [depart time+airport]
 * [duration over a line over stops] [arrive time+airport]. Every column is a
 * minmax(0, ...) grid track, so no cell can ever force the row -- or the page
 * -- wider than its container. The earlier flex version of this row went
 * through three "fixes" for mobile overflow that never worked, because the
 * real cause was the date strip widening the whole results column (fixed in
 * the same commit); this grid is the belt to that fix's braces.
 */
function FlightLeg({
  code,
  departTime,
  origin,
  arriveTime,
  destination,
  dayOffsetText,
  duration,
  stops,
}: {
  code: string;
  departTime: string;
  origin: string;
  arriveTime: string;
  destination: string;
  dayOffsetText: string | null;
  duration: string;
  stops: number;
}) {
  const stopsLabel = stops === 0 ? "Non-stop" : `${stops} stop${stops > 1 ? "s" : ""}`;
  return (
    <div className="grid grid-cols-[minmax(0,1.5rem)_minmax(0,auto)_minmax(0,1fr)_minmax(0,auto)] items-center gap-x-3">
      <AirlineLogo code={code} size="sm" />
      <div className="min-w-0">
        <p className="font-display text-base font-semibold leading-tight text-navy">{departTime}</p>
        <p className="text-[11px] text-muted-foreground">{origin}</p>
      </div>
      <div className="min-w-0 text-center">
        <p className="truncate text-[11px] leading-tight text-muted-foreground">{duration}</p>
        <div className="my-0.5 flex items-center gap-1 text-mutedblue">
          <span className="h-px flex-1 bg-border" />
          <Plane className="size-3 shrink-0" />
          <span className="h-px flex-1 bg-border" />
        </div>
        <p className={`truncate text-[11px] leading-tight ${stops === 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
          {stopsLabel}
        </p>
      </div>
      <div className="min-w-0 text-right">
        <p className="font-display text-base font-semibold leading-tight text-navy">
          {arriveTime}
          {dayOffsetText ? (
            <sup className="ml-0.5 text-[10px] font-bold text-destructive">{dayOffsetText}</sup>
          ) : null}
        </p>
        <p className="text-[11px] text-muted-foreground">{destination}</p>
      </div>
    </div>
  );
}

/**
 * Real airline logo via pics.avs.io (Aviasales/Travelpayouts' free, public,
 * no-API-key logo endpoint -- documented at
 * support.travelpayouts.com/hc/en-us/articles/203956073). Falls back to the
 * carrier-code text badge if a given code has no logo there or the request
 * fails, so a missing/broken logo never shows as a broken image icon.
 */
function AirlineLogo({ code, size = "md" }: { code: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const cleanCode = code.trim().toUpperCase();
  const box = size === "sm" ? "size-6 rounded-md text-[9px]" : "size-10 rounded-xl text-xs";
  const img = size === "sm" ? "size-5" : "size-8";

  if (!cleanCode || failed) {
    return (
      <span className={`grid shrink-0 place-items-center bg-navy font-bold text-navy-foreground ${box}`}>
        {cleanCode || "--"}
      </span>
    );
  }

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden border border-border bg-white ${box}`}>
      <img
        src={`https://pics.avs.io/120/120/${cleanCode}.png`}
        alt={`${cleanCode} logo`}
        className={`object-contain ${img}`}
        loading="lazy"
        onError={() => setFailed(true)}
        onLoad={(e) => {
          // pics.avs.io returns HTTP 200 with a tiny/blank placeholder for
          // unrecognised codes instead of a real 404 -- onError alone never
          // catches that (confirmed 2026-09-09: Air India's "AI" rendered as
          // a genuinely blank circle, no fallback text, because the request
          // "succeeded"). A real logo is never this small, so treat a
          // suspiciously tiny natural size as a failure too.
          const img = e.currentTarget;
          if (img.naturalWidth < 8 || img.naturalHeight < 8) setFailed(true);
        }}
      />
    </span>
  );
}
