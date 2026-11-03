import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeftRight, ArrowUpDown, BedDouble, CalendarPlus, Car, Loader2, MoveHorizontal, PhoneCall, Plane, Search, Umbrella } from "lucide-react";
import { AirportAutocomplete } from "@/components/site/AirportAutocomplete";
import { DatePickerField } from "@/components/site/DatePickerField";
import { MultiCityPlanner } from "@/components/site/MultiCityPlanner";
import { CabinSelect, type Cabin } from "@/components/site/CabinSelect";
import { TravelerSelect, totalTravelers, type Travelers } from "@/components/site/TravelerSelect";
import { FLIGHT_SEARCH_ID } from "@/lib/focus-search";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site-contact";

export const DEFAULT_CURRENCY = "USD";

/* White on VootFly orange is about 3.1:1, which only meets the contrast guideline for large text (bold
   and at least 18.66px). So the homepage button keeps white, as in the owner's reference, at this size. */
const HERO_SEARCH_TEXT = "text-[1.1875rem] text-white";

type Trip = "round" | "one" | "multi";

const tabIcon = "size-[18px] shrink-0 max-[359px]:hidden";
/* Three linked stops, as in the owner's reference. Lucide has no icon of this shape. */
const MultiCityIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={tabIcon}>
    <circle cx="12" cy="5" r="3" />
    <circle cx="4.500" cy="19" r="2.500" />
    <circle cx="19.500" cy="19" r="2.500" />
    <path d="m10.300 7.500-4.400 9.400M13.700 7.500l4.400 9.400" />
  </svg>
);
const HERO_TRIPS: { key: Trip; label: string; icon: ReactNode }[] = [
  { key: "round", label: "Round Trip", icon: <Plane fill="currentColor" strokeWidth={1.5} className={tabIcon} aria-hidden="true" /> },
  { key: "one", label: "One Way", icon: <MoveHorizontal className={tabIcon} aria-hidden="true" /> },
  { key: "multi", label: "Multi-City", icon: <MultiCityIcon /> },
];
const TAB_ACTIVE = "#0A53D8";
const TAB_IDLE = "url(#vf-trip-tab-idle)";
/* A tab's curved edge: rounded at the top, flaring out at the bottom. The clip keeps its shadow on the
   curved side only; it overlaps the tab by 1px so no seam shows between them. */
const TabEdge = ({ fill, side, shadow }: { fill: string; side: "left" | "right"; shadow: boolean }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 28 44"
    preserveAspectRatio="none"
    className={`pointer-events-none absolute top-0 h-11 w-4 [clip-path:inset(0_-12px_0_0)] sm:w-7 ${side === "right" ? "left-full -ml-px" : "left-0 -scale-x-100"} ${shadow ? "drop-shadow-[3px_0_3px_rgba(0,20,80,0.4)]" : ""}`}
  >
    <path d="M0 0C8 0 13.500 5 14 14V28C14.500 37 20 44 28 44H0Z" fill={fill} />
  </svg>
);
/* Trip tabs on the homepage, shaped as in the owner's reference (2 Nov 2026). The row is the idle colour
   and every tab draws its own right edge, so a curve and its shadow separate each pair of tabs. The chosen
   tab also fills its body and, unless it comes first, its left edge. No tab changes width when chosen.
   The row runs on under the card, so the blue shows behind the card's rounded corner. On phones the row
   fills the width, so the last tab has no outer edge and the curves are narrower. */
function HeroTripTabs({ trip, onChange }: { trip: Trip; onChange: (t: Trip) => void }) {
  return (
    <div className="relative -mb-4 flex rounded-t-2xl bg-[linear-gradient(180deg,#0349C9,#0143B8_73%)] pb-4 sm:w-fit sm:rounded-tr-none">
      <svg aria-hidden="true" className="absolute size-0">
        <defs>
          <linearGradient id="vf-trip-tab-idle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0349C9" />
            <stop offset="1" stopColor="#0143B8" />
          </linearGradient>
        </defs>
      </svg>
      {HERO_TRIPS.map((t, i) => {
        const active = trip === t.key;
        const first = i === 0;
        const last = i === HERO_TRIPS.length - 1;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={active}
            className={`relative flex h-11 flex-auto cursor-pointer justify-center whitespace-nowrap text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white sm:flex-none sm:text-[15px] ${
              first ? "rounded-tl-2xl pl-2.5 pr-1.5 sm:pl-6 sm:pr-4" : `pl-5 sm:pl-[2.1rem] sm:pr-4 ${last ? "pr-2" : "pr-1.5"}`
            }`}
          >
            {active ? (
              <span
                aria-hidden="true"
                style={{ backgroundColor: TAB_ACTIVE }}
                className={`absolute inset-y-0 right-0 ${first ? "left-0 rounded-tl-2xl" : "left-[15px] sm:left-[27px]"} ${last ? "max-sm:rounded-tr-2xl" : ""}`}
              />
            ) : null}
            {active && !first ? <TabEdge fill={TAB_ACTIVE} side="left" shadow /> : null}
            <span className={last ? "hidden sm:contents" : "contents"}>
              <TabEdge fill={active ? TAB_ACTIVE : TAB_IDLE} side="right" shadow={!last} />
            </span>
            <span className="relative flex h-full items-center gap-1.5 sm:gap-2">
              {t.icon}
              {t.label}
              {active ? <span aria-hidden="true" className="absolute -inset-x-0.5 bottom-0 h-1 rounded-t-[3px] bg-gold" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Sensible fallback when no real fare-snapshot dates are available: ~1 week out, ~2 weeks for return. */
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/*
 * Default dates are built from calendar-day numbers, never from the clock's local time zone
 * (fixed 1 Nov 2026). The server renders in UTC; a visitor's browser does not. Using local
 * "today" made the server and browser disagree on the date whenever it was already the next
 * day in UTC (US evenings) or in the visitor's zone (India after midnight). React then threw
 * the server HTML away and re-rendered the whole page (error #418), which slowed every load
 * at those hours. Both sides now use the UTC calendar day, so the first render always matches.
 */
function calendarDay(y: number, m: number, d: number): Date {
  return new Date(y, m, d);
}
function todayUtcDay(): Date {
  const n = new Date();
  return calendarDay(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}
/** "YYYY-MM-DD" as that calendar day (not UTC midnight shifted into the local zone). */
function parseDay(iso?: string): Date | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const d = calendarDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A usable pre-filled departure date: the given one if it is today or later, otherwise a week out. */
function initialDepart(iso?: string): Date {
  const d = parseDay(iso);
  const today = todayUtcDay();
  return d && d >= today ? d : addDays(today, 7);
}

/** A usable pre-filled return date: the given one if it is valid and after departure, otherwise a week after departure. */
function initialReturn(iso: string | undefined, depart: Date): Date {
  const d = parseDay(iso);
  return d && d > depart ? d : addDays(depart, 7);
}

export type FlightSearchWidgetProps = {
  /** Origin IATA code to pre-fill. Left blank (no arbitrary default) when the page has no fixed origin. */
  defaultOrigin?: string | undefined;
  /** Destination IATA code to pre-fill. Left blank when the page has no fixed destination. */
  defaultDestination?: string | undefined;
  /** ISO date (YYYY-MM-DD) to pre-select for departure -- pass the page's real fare-snapshot date when known. */
  defaultDepartDate?: string | undefined;
  /** ISO date (YYYY-MM-DD) to pre-select for return. */
  defaultReturnDate?: string | undefined;
  /**
   * VootFly is a lowest-price/economy platform -- "Economy" is the
   * site-wide floor default here (fixed 2026-09-11; this comment
   * previously and incorrectly said "Business" was the floor, which no
   * longer matches VootFly's actual positioning or the default below).
   * Pass "First"/"Business" explicitly only for a page that's
   * specifically about a premium cabin.
   */
  defaultCabin?: Cabin | undefined;
  /** Show the Flights / Hotels / Cars / Flight+Hotel product tiles above the
   * card. On by default for the homepage; route and hub pages embed just the
   * card, where product tiles mid-page would be noise. */
  showProductTiles?: boolean | undefined;
  /** "hero" (homepage only, 30 Sep 2026): blue header with Round Trip / One
   * Way / Multi-City tabs marked by the orange bar from the VootFly logo, a
   * Direct flights only option, Travelers in the main bar (2 Nov 2026), and no
   * call button under the card. Every other page keeps the default look. */
  variant?: "default" | "hero" | undefined;
};

export function FlightSearchWidget({
  defaultOrigin = "",
  defaultDestination = "",
  defaultDepartDate,
  defaultReturnDate,
  defaultCabin = "Economy",
  showProductTiles = false,
  variant = "default",
}: FlightSearchWidgetProps) {
  const hero = variant === "hero";
  // The horizontal search bar needs about 950px. On the homepage it therefore starts at
  // 1024px; tablets below that get the stacked layout that phones use. (At 768px the
  // From and To fields were squeezed to 19-41px of usable width.) Both sets are written
  // out in full so the stylesheet generator can see every class.
  const B = hero
    ? {
        bar: "lg:flex lg:items-stretch lg:divide-x lg:divide-border",
        od: "relative lg:flex lg:min-w-0 lg:flex-1 lg:items-stretch lg:divide-x lg:divide-border",
        // Between 1024 and 1280px the bar is tight, so its field icons give their room to the text.
        field: "lg:flex lg:min-w-0 lg:flex-1 lg:border-b-0 lg:[&_label>span:first-child]:hidden xl:[&_label>span:first-child]:inline",
        fromCell: "lg:px-3 lg:pr-6 lg:py-3 xl:px-4 xl:pr-7",
        toCell: "lg:px-3 lg:pl-7 lg:py-3 xl:px-4 xl:pl-8",
        swap: "lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:size-9",
        swapVertical: "lg:hidden",
        swapHorizontal: "hidden lg:block",
        dates: "lg:flex lg:border-b-0",
        date: "lg:w-[7.75rem] xl:w-[10.25rem] lg:[&_button]:px-3 lg:[&_button]:py-3 xl:[&_button]:px-4 lg:[&_button>span:first-child]:hidden xl:[&_button>span:first-child]:inline",
        inline: "hidden lg:flex lg:items-center lg:p-2",
        mobile: "p-3 lg:hidden",
      }
    : {
        bar: "md:flex md:items-stretch md:divide-x md:divide-border",
        od: "relative md:flex md:flex-1 md:items-stretch md:divide-x md:divide-border",
        field: "md:flex md:flex-1 md:border-b-0",
        fromCell: "",
        toCell: "",
        swap: "md:left-1/2 md:right-auto md:-translate-x-1/2 md:size-9",
        swapVertical: "",
        swapHorizontal: "hidden",
        dates: "md:flex md:border-b-0",
        date: "md:min-w-[9rem]",
        inline: "hidden md:flex md:items-center md:p-2",
        mobile: "p-3 md:hidden",
      };
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip>("round");
  // Direct flights only: switches on the results page's existing Non-stop filter.
  const [directOnly, setDirectOnly] = useState(false);
  // Shown when Search is pressed without two different airports (added 30 Sep 2026).
  // Before this, an empty form silently searched New York to Miami (the results page
  // default), and the same airport at both ends was accepted.
  const [formError, setFormError] = useState<string | null>(null);
  // Which field that error is about, so it is marked and focused (2 Nov 2026).
  const [invalid, setInvalid] = useState<"origin" | "destination" | "both" | null>(null);
  // True from the moment Search is pressed until the results page opens: shows the spinner and
  // ignores further presses, so one search is never sent twice.
  const [submitting, setSubmitting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDestination);
  // FIXED 2026-09-28 (phase tracker 5.2). Route and hub pages pre-fill the
  // form with their stored fare snapshot's departure date, which goes stale
  // once that date passes. The calendar only blocks past days when someone
  // PICKS a date, not when one is pre-filled, so 5 of the first 19 real
  // searches were sent for dates already gone and returned no flights.
  // A pre-filled date in the past now falls back to a week out, and a return
  // date that is not after departure falls back to a week after departure.
  const [date, setDate] = useState<Date>(() => initialDepart(defaultDepartDate));
  const [returnDate, setReturnDate] = useState<Date>(() => initialReturn(defaultReturnDate, initialDepart(defaultDepartDate)));
  const [travelers, setTravelers] = useState<Travelers>({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState<Cabin>(defaultCabin);

  const clearError = () => {
    setFormError(null);
    setInvalid(null);
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    clearError();
  };

  const showError = (message: string, field: "origin" | "destination" | "both") => {
    setFormError(message);
    setInvalid(field);
    const input = cardRef.current?.querySelectorAll<HTMLInputElement>('input[role="combobox"]')[field === "destination" ? 1 : 0];
    input?.focus();
  };

  // Moving departure past the return date would otherwise search a return before the outbound.
  const pickDeparture = (d: Date) => {
    setDate(d);
    if (returnDate < d) setReturnDate(addDays(d, 7));
  };

  const submitSearch = () => {
    if (submitting) return;
    if (!origin || !destination) {
      if (!origin && !destination) showError("Choose where you are flying from and to.", "both");
      else if (!origin) showError("Choose where you are flying from.", "origin");
      else showError("Choose where you are flying to.", "destination");
      return;
    }
    if (origin === destination) {
      showError("Choose two different airports.", "destination");
      return;
    }
    clearError();
    setSubmitting(true);
    void navigate({
      to: "/flight/search",
      search: {
        origin,
        destination,
        date: format(date, "yyyy-MM-dd"),
        ...(trip === "round" ? { returnDate: format(returnDate, "yyyy-MM-dd") } : {}),
        passengers: totalTravelers(travelers),
        cabin,
        currency: DEFAULT_CURRENCY,
        ...(directOnly ? { direct: true as const } : {}),
      },
    }).finally(() => setSubmitting(false));
  };

  const searchLabel = hero ? "Search Flights" : "Search";
  const searchContent = submitting ? (
    <>
      <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Searching…
    </>
  ) : (
    <>
      <Search className="size-5" aria-hidden="true" /> {searchLabel}
    </>
  );

  return (
    <div>
      {/* PRODUCT TILES -- Kayak pattern. Flights is the only working product;
          Hotels, Cars and Flight+Hotel are shown as coming soon rather than
          hidden, because the business intends to add them. They are not
          clickable and say so: a tile that looks live but does nothing is
          worse than an honest "soon" badge. */}
      {showProductTiles ? (
      <div className="mb-3 grid grid-cols-4 gap-2 md:flex md:justify-start md:gap-4">
        {[
          { key: "flights", label: "Flights", icon: Plane, live: true },
          { key: "hotels", label: "Hotels", icon: BedDouble, live: false },
          { key: "cars", label: "Car Rental", icon: Car, live: false },
          { key: "bundle", label: "Flight+Hotel", icon: Umbrella, live: false },
        ].map((t) => (
          <div key={t.key} className="flex flex-col items-center gap-1.5">
            <div
              aria-disabled={!t.live}
              className={
                t.live
                  ? "grid size-14 place-items-center rounded-2xl bg-gold text-gold-foreground shadow-card sm:size-16"
                  : "relative grid size-14 place-items-center rounded-2xl bg-card text-navy/40 shadow-card sm:size-16"
              }
            >
              <t.icon className="size-6" />
              {!t.live ? (
                <span className="absolute -top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                  Soon
                </span>
              ) : null}
            </div>
            <span className={t.live ? "text-xs font-bold text-navy sm:text-sm" : "text-xs font-semibold text-navy/50 sm:text-sm"}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
      ) : null}

      {/* SEARCH CARD -- one white card of stacked, full-width rows separated
          by dividers, exactly as Kayak lays it out: trip tabs, origin,
          destination, dates, travellers+cabin, then a full-width Search.
          On the homepage the trip tabs sit on the sky as a folder tab above the
          card (2 Nov 2026). No overflow-hidden on the card (fixed 2 Nov 2026):
          it cut the airport suggestions down to about one visible row. */}
      <div ref={cardRef} id={FLIGHT_SEARCH_ID} className={hero ? "text-left text-card-foreground" : "rounded-2xl bg-card text-left text-card-foreground shadow-lux"}>
        {/* Trip type */}
        {hero ? (
          <HeroTripTabs trip={trip} onChange={setTrip} />
        ) : (
          <div className="flex border-b border-border px-2">
            {(
              [
                { key: "round", label: "Return" },
                { key: "one", label: "One-way" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTrip(t.key)}
                aria-pressed={trip === t.key}
                className={
                  trip === t.key
                    ? "border-b-2 border-navy px-4 py-3.5 text-sm font-bold text-navy sm:text-base"
                    : "border-b-2 border-transparent px-4 py-3.5 text-sm font-semibold text-muted-foreground hover:text-navy sm:text-base"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className={hero ? "relative z-10 rounded-2xl border border-border bg-card shadow-[0_18px_44px_-20px_rgba(20,85,192,0.45)]" : "contents"}>
        {formError ? (
          <p role="alert" className="rounded-t-2xl border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800">
            {formError}
          </p>
        ) : null}
        {trip === "multi" ? (
          // Multi-city is not supported by the live fare search or booking flow, so the
          // planner collects every flight and hands the trip to an advisor (1 Nov 2026).
          <MultiCityPlanner />
        ) : (
        <>
        {/* Inputs. Mobile: stacked rows with dividers. md+: one horizontal
            bar -- From, To, Dates, then Search -- like Kayak's desktop. */}
        <div className={B.bar}>
          {/* Origin / Destination */}
          <div className={B.od}>
            <div className={`border-b border-border ${B.field}`}>
              <AirportAutocomplete
                bare
                className={B.fromCell}
                label="From"
                value={origin}
                invalid={invalid === "origin" || invalid === "both"}
                onChange={(code) => {
                  setOrigin(code);
                  clearError();
                }}
                {...(hero ? { placeholder: "City or airport" } : {})}
              />
            </div>
            <div className={`border-b border-border ${B.field}`}>
              <AirportAutocomplete
                bare
                className={B.toCell}
                label="To"
                value={destination}
                invalid={invalid === "destination" || invalid === "both"}
                onChange={(code) => {
                  setDestination(code);
                  clearError();
                }}
                {...(hero ? { placeholder: "City or airport" } : {})}
              />
            </div>
            <button
              type="button"
              onClick={swap}
              aria-label="Swap origin and destination"
              className={`absolute right-4 top-1/2 z-30 grid size-11 -translate-y-1/2 place-items-center border border-border bg-card shadow-card hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${hero ? "rounded-full text-primary" : "rounded-xl text-navy"} ${B.swap}`}
            >
              <ArrowUpDown className={`size-4 ${B.swapVertical}`} aria-hidden="true" />
              <ArrowLeftRight className={`size-4 ${B.swapHorizontal}`} aria-hidden="true" />
            </button>
          </div>

          {/* Dates */}
          <div className={`grid grid-cols-2 divide-x divide-border border-b border-border ${B.dates}`}>
            <div className={`min-w-0 ${B.date}`}>
              <DatePickerField bare label="Departure" value={date} onChange={pickDeparture} {...(trip === "round" ? { tripStart: date, tripEnd: returnDate } : {})} />
            </div>
            {trip === "round" ? (
              <div className={`min-w-0 ${B.date}`}>
                <DatePickerField bare label="Return" value={returnDate} onChange={setReturnDate} minDate={date} tripStart={date} tripEnd={returnDate} />
              </div>
            ) : (
              <div className={`min-w-0 ${B.date}`}>
                <button
                  type="button"
                  onClick={() => setTrip("round")}
                  className="flex h-full min-h-14 w-full min-w-0 items-center gap-2.5 px-4 py-2.5 text-left outline-none transition-colors hover:bg-[#F6F8FC] focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]"
                >
                  <CalendarPlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Return</span>
                    <span className="block truncate text-base font-medium text-muted-foreground sm:text-[15px]">Add return</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Travelers (homepage: a main field, in the bar) */}
          {hero ? (
            <div className="border-b border-border lg:w-[8.75rem] lg:border-b-0 xl:w-[10.5rem] lg:[&_button>svg:first-child]:hidden xl:[&_button>svg:first-child]:block">
              <TravelerSelect field value={travelers} onChange={setTravelers} />
            </div>
          ) : null}

          {/* Search (md+ inline, right edge of the bar) */}
          <div className={B.inline}>
            <button
              type="button"
              onClick={submitSearch}
              aria-busy={submitting}
              className={`inline-flex h-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gold font-bold ${hero ? `min-w-[10.25rem] px-5 ${HERO_SEARCH_TEXT} lg:[&>svg]:hidden xl:px-6 xl:[&>svg]:block` : "px-8 text-base text-gold-foreground"} shadow-card transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy aria-busy:cursor-progress`}
            >
              {searchContent}
            </button>
          </div>
        </div>
        {/* Cabin and options (travellers too on other pages), full width under the bar */}
        <div className={hero ? "flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 lg:border-t lg:border-border" : "flex flex-wrap items-center gap-2 border-t border-border px-4 py-3"}>
          {hero ? null : <TravelerSelect value={travelers} onChange={setTravelers} />}
          <CabinSelect bare={hero} value={cabin} onChange={setCabin} />
          {hero ? (
            <label className="ml-auto inline-flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-navy">
              <input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} className="size-4 accent-primary" />
              Direct flights only
            </label>
          ) : null}
        </div>
        {/* Search (mobile only, full-width) */}
        <div className={B.mobile}>
          <button
            type="button"
            onClick={submitSearch}
            aria-busy={submitting}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-8 py-4 font-bold ${hero ? HERO_SEARCH_TEXT : "text-base text-gold-foreground"} shadow-card transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy aria-busy:cursor-progress`}
          >
            {searchContent}
          </button>
        </div>
        </>
        )}
        </div>
      </div>

      {hero ? null : (
      <div className="md:flex md:justify-center">
        <a
          href={PHONE_TEL}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-card transition hover:brightness-110 md:mt-4 md:w-auto md:px-8"
        >
          <PhoneCall className="size-4" /> Talk to a VootFly Travel Advisor: {PHONE_DISPLAY}
        </a>
      </div>
      )}
    </div>
  );
}
