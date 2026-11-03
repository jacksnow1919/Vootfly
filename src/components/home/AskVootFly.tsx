import { useMemo, useState, type FormEvent } from "react";
import { Price } from "@/components/site/Price";
import { track } from "@/lib/analytics";
import type { PlaceMap } from "@/lib/hierarchy";
import { type HomeRoute, addDays, checkedLabel, cityName, hasVerifiedPrice, isoDate, primaryAirport } from "@/components/home/home-data";

/**
 * Trip ideas (id="trip-ideas"), a compact block inside "Price tools and trip ideas".
 *
 * A plain-language trip finder, deliberately NOT presented as AI: it reads a
 * departure city, month, trip length and budget from what the traveller types
 * and answers only from stored fares that pass the homepage's verified-price
 * rule (supplier-confirmed economy, checked in the last 7 days). No model is
 * called and nothing is invented. Where no verified fare exists it says so.
 */
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const ALIASES: Record<string, string[]> = { nyc: ["nyc", "new york city", "ny"], lax: ["la", "l.a."], sea: ["seattle"], chi: ["chicago"], bos: ["boston"] };
const EXAMPLES = ["7 days from New York in November", "Cheap trip from Boston in December", "Cheap 10-day trip from Chicago"];

type Parsed = { origin: string | null; month: number | null; days: number; budget: number | null };

function parse(q: string, origins: string[], places: PlaceMap): Parsed {
  const text = ` ${q.toLowerCase().replace(/[^a-z0-9$ .]/g, " ")} `;
  let origin: string | null = null;
  for (const code of origins) {
    const names = [cityName(code, places).toLowerCase(), code, ...(ALIASES[code] ?? [])];
    if (names.some((n) => text.includes(` ${n} `))) { origin = code; break; }
  }
  const mIdx = MONTHS.findIndex((m) => text.includes(` ${m} `) || text.includes(` ${m.slice(0, 3)} `));
  const dm = text.match(/(\d{1,2})\s*-?\s*(day|days|night|nights)\b/);
  const days = dm ? Math.min(30, Math.max(2, Number(dm[1]))) : /two weeks|2 weeks/.test(text) ? 14 : /weekend/.test(text) ? 3 : 7;
  const bm = text.match(/(?:under|below|less than|max)\s*\$?\s*(\d{3,5})/);
  return { origin, month: mIdx >= 0 ? mIdx : null, days, budget: bm ? Number(bm[1]) : null };
}

function departFor(month: number | null): Date {
  const now = new Date();
  if (month === null) return addDays(now, 30);
  let year = now.getUTCFullYear();
  if (month < now.getUTCMonth()) year += 1;
  const mid = new Date(Date.UTC(year, month, 15));
  return mid.getTime() - now.getTime() < 7 * 86_400_000 ? addDays(now, 14) : mid;
}

const MUTED = "text-[#4F5D75]";

export function TripIdeas({ routes, places }: { routes: HomeRoute[]; places: PlaceMap }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const origins = useMemo(() => [...new Set(routes.map((r) => r.from_code).filter((c): c is string => Boolean(c)))], [routes]);

  const answer = useMemo(() => {
    if (!asked) return null;
    const p = parse(asked, origins, places);
    if (!p.origin) return { p, kind: "no-origin" as const, matches: [] as HomeRoute[] };
    const pool = routes.filter((r) => r.from_code === p.origin && hasVerifiedPrice(r)).sort((a, b) => a.amount - b.amount);
    if (pool.length === 0) return { p, kind: "no-fares" as const, matches: [] as HomeRoute[] };
    const matches = (p.budget ? pool.filter((r) => r.amount <= p.budget!) : pool).slice(0, 4);
    return { p, kind: matches.length ? ("ok" as const) : ("over-budget" as const), matches, cheapest: pool[0]! };
  }, [asked, origins, places, routes]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setQ(t);
    setAsked(t);
    const p = parse(t, origins, places);
    track("Trip Ideas Asked", { origin: p.origin ?? "unknown", month: p.month ?? -1, days: p.days, budget: p.budget ?? 0 });
  };

  const depart = answer ? departFor(answer.p.month) : null;
  const ret = depart && answer ? addDays(depart, answer.p.days) : null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div id="trip-ideas" className="min-w-0 scroll-mt-20">
      <h3 className="font-display text-base font-bold text-navy">Trip ideas</h3>
      <p className={`mt-1 text-sm ${MUTED}`}>Describe a trip and we will match it to routes we track.</p>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); submit(q); }} className="mt-3 flex max-w-2xl flex-col gap-2 sm:flex-row">
        <label htmlFor="trip-ideas-input" className="sr-only">Describe your trip</label>
        <input
          id="trip-ideas-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="7 days from New York in November"
          className="h-11 w-full rounded-xl border border-[#D5DEEA] sm:flex-1 bg-white px-4 text-base sm:text-[15px] text-navy placeholder:text-[#6B7890] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button type="submit" className="h-11 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Find trips
        </button>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => submit(ex)} className="rounded-full border border-[#D5DEEA] px-3 py-1.5 text-xs font-semibold text-navy hover:border-primary/50">
            {ex}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="mt-5" aria-live="polite">
          {answer.kind === "no-origin" ? (
            <p className="text-sm text-navy">Tell us where you are leaving from. We track trips from {origins.map((o) => cityName(o, places)).join(", ")}.</p>
          ) : answer.kind === "no-fares" ? (
            <p className="text-sm text-navy">We have no recently checked fares from {cityName(answer.p.origin, places)} right now. Search current fares above.</p>
          ) : answer.kind === "over-budget" ? (
            <p className="text-sm text-navy">
              No recently checked fares from {cityName(answer.p.origin, places)} are under ${answer.p.budget}. The lowest Recently Tracked Fare is {cityName(answer.cheapest!.to_code, places)} from <Price usdAmount={answer.cheapest!.amount} />, {checkedLabel(answer.cheapest!.checked_at)!.replace(/^Checked/, "checked")}.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-navy">
                From {cityName(answer.p.origin, places)}
                {answer.p.month !== null ? `, ${MONTHS[answer.p.month]!.charAt(0).toUpperCase()}${MONTHS[answer.p.month]!.slice(1)}` : ""}, about {answer.p.days} days
              </p>
              <ul className="mt-2 max-w-3xl divide-y divide-[#E2E8F1] border-y border-[#E2E8F1]">
                {answer.matches.map((r) => (
                  <li key={r.path} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm">
                      <b className="text-navy">{cityName(r.to_code, places)}</b>{" "}
                      <span className={MUTED}>from </span><b className="text-navy"><Price usdAmount={r.amount} /></b>
                      <span className={`block text-xs ${MUTED}`}>Recently Tracked Fare, round trip. {checkedLabel(r.checked_at)}</span>
                    </p>
                    <span className="flex gap-4 text-sm font-bold">
                      <a className="py-1 text-primary underline-offset-4 hover:underline" href={`/flight/search?origin=${primaryAirport(r.from_code!, places)}&destination=${primaryAirport(r.to_code!, places)}&date=${isoDate(depart!)}&returnDate=${isoDate(ret!)}&passengers=1&cabin=Economy`}>
                        Search {fmt(depart!)} to {fmt(ret!)}
                      </a>
                      <a className={`py-1 underline-offset-4 hover:underline ${MUTED}`} href={r.path}>About this route</a>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={`mt-2 text-xs ${MUTED}`}>These are Recently Tracked Fares from our stored airline searches, not prices for your exact dates. Search to see current fares.</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
