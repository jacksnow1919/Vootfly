import { Minus, Plus, Users, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type Travelers = { adults: number; children: number; infants: number };

export const totalTravelers = (t: Travelers) => t.adults + t.children + t.infants;

const rows = [
  { key: "adults", label: "Adults", hint: "12+", min: 1 },
  { key: "children", label: "Children", hint: "2-11", min: 0 },
  { key: "infants", label: "Infants", hint: "Under 2", min: 0 },
] as const;

export function TravelerSelect({
  value,
  onChange,
  field = false,
}: {
  value: Travelers;
  onChange: (t: Travelers) => void;
  /** A labelled cell for the homepage search bar, instead of the small pill. */
  field?: boolean;
}) {
  const total = totalTravelers(value);
  const count = `${total} ${total === 1 ? "Traveler" : "Travelers"}`;

  const step = (key: keyof Travelers, delta: number, min: number) => {
    const next = Math.min(9, Math.max(min, value[key] + delta));
    onChange({ ...value, [key]: next });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {field ? (
          <button
            type="button"
            className="flex h-full min-h-14 w-full min-w-0 items-center gap-2.5 px-4 py-2.5 text-left outline-none transition-colors hover:bg-[#F6F8FC] focus-visible:shadow-[inset_0_0_0_2px_var(--primary)] lg:px-3 xl:px-4"
          >
            <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Travelers</span>
              <span className="block truncate text-base font-semibold text-foreground sm:text-[15px]">{count}</span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Travelers"
            className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-navy shadow-sm transition hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:text-sm"
          >
            <Users className="size-4 shrink-0 text-primary" />
            <span className="truncate">{count}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl p-3">
        <div className="space-y-1">
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex items-center justify-between gap-3 rounded-xl px-2 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-navy">{r.label}</p>
                <p className="text-[11px] text-muted-foreground">{r.hint}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Remove one ${r.label}`}
                  onClick={() => step(r.key, -1, r.min)}
                  disabled={value[r.key] <= r.min}
                  className="grid size-10 place-items-center rounded-full border border-border text-primary transition hover:bg-primary/10 disabled:opacity-40 sm:size-8"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-5 text-center text-sm font-bold text-navy">{value[r.key]}</span>
                <button
                  type="button"
                  aria-label={`Add one ${r.label}`}
                  onClick={() => step(r.key, 1, r.min)}
                  disabled={total >= 9}
                  className="grid size-10 place-items-center rounded-full border border-border text-primary transition hover:bg-primary/10 disabled:opacity-40 sm:size-8"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
