import { useState } from "react";
import { format } from "date-fns";
import { Mail, PhoneCall, Plus, X } from "lucide-react";
import { AirportAutocomplete } from "@/components/site/AirportAutocomplete";
import { DatePickerField } from "@/components/site/DatePickerField";
import { CabinSelect, type Cabin } from "@/components/site/CabinSelect";
import { TravelerSelect, type Travelers } from "@/components/site/TravelerSelect";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site-contact";
import { track } from "@/lib/analytics";

/**
 * Multi-city trip planner (1 Nov 2026).
 *
 * The live fare search and the booking flow only handle one-way and round trips, so multi-city
 * fares are quoted by a VootFly advisor. This lets the traveller enter every flight (with the same
 * instant airport autocomplete as the main search) and send the whole itinerary by email in one
 * step, or call. It never shows a price, because no live multi-city price exists to show.
 */
type Leg = { from: string; to: string; date: Date };
const MAX_LEGS = 5;

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function MultiCityPlanner() {
  const start = addDays(new Date(), 14);
  const [legs, setLegs] = useState<Leg[]>([
    { from: "", to: "", date: start },
    { from: "", to: "", date: addDays(start, 5) },
  ]);
  const [travelers, setTravelers] = useState<Travelers>({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState<Cabin>("Economy");
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Leg>) => {
    setError(null);
    setLegs((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  };
  const addLeg = () =>
    setLegs((ls) => {
      const last = ls[ls.length - 1]!;
      return ls.length >= MAX_LEGS ? ls : [...ls, { from: last.to, to: "", date: addDays(last.date, 4) }];
    });
  const removeLeg = (i: number) => setLegs((ls) => (ls.length <= 2 ? ls : ls.filter((_, k) => k !== i)));

  const send = () => {
    const bad = legs.findIndex((l) => !l.from || !l.to || l.from === l.to);
    if (bad >= 0) {
      setError(`Flight ${bad + 1}: choose two different airports.`);
      return;
    }
    const lines = legs.map((l, i) => `Flight ${i + 1}: ${l.from} to ${l.to}, ${format(l.date, "EEE d MMM yyyy")}`);
    const pax = `${travelers.adults} adult(s), ${travelers.children} child(ren), ${travelers.infants} infant(s)`;
    const body = [
      "Hello VootFly, please send me fares for this multi-city trip:",
      "",
      ...lines,
      "",
      `Travelers: ${pax}`,
      `Cabin: ${cabin === "PremiumEconomy" ? "Premium Economy" : cabin}`,
      "",
      "My name:",
      "My phone number:",
    ].join("\n");
    track("Multi-city Request Sent", { legs: legs.length });
    window.location.href = `mailto:info@vootfly.com?subject=${encodeURIComponent("Multi-city trip request")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="text-sm text-muted-foreground">
        Add each flight and send the trip to a VootFly advisor, who replies with current fares. Multi-city fares are
        quoted by an advisor, not shown online.
      </p>
      <ol className="mt-3 space-y-3">
        {legs.map((l, i) => (
          <li key={i} className="rounded-xl border border-border p-2">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wide text-navy/70">Flight {i + 1}</span>
              {legs.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeLeg(i)}
                  aria-label={`Remove flight ${i + 1}`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-navy"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <AirportAutocomplete label="From" value={l.from} onChange={(c) => update(i, { from: c })} placeholder="City or airport" />
              <AirportAutocomplete label="To" value={l.to} onChange={(c) => update(i, { to: c })} placeholder="City or airport" />
              <div className="md:w-44">
                <DatePickerField label="Date" value={l.date} onChange={(d) => update(i, { date: d })} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {legs.length < MAX_LEGS ? (
          <button
            type="button"
            onClick={addLeg}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-navy hover:bg-accent"
          >
            <Plus className="size-4" /> Add another flight
          </button>
        ) : null}
        <TravelerSelect value={travelers} onChange={setTravelers} />
        <CabinSelect value={cabin} onChange={setCabin} />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={send}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:brightness-110"
        >
          <Mail className="size-4" /> Email this trip to an advisor
        </button>
        <a
          href={PHONE_TEL}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-bold text-navy hover:bg-accent"
        >
          <PhoneCall className="size-4" /> Call {PHONE_DISPLAY}
        </a>
      </div>
    </div>
  );
}
