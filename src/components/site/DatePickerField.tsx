import { lazy, Suspense, useState } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/*
 * The calendar (react-day-picker, the largest part of the search form's code) is loaded only
 * when it is needed (1 Nov 2026, page speed). It starts downloading as soon as a visitor points
 * at, touches or focuses a date field, so it is normally ready by the time the popover opens.
 */
const loadCalendar = () => import("@/components/ui/calendar");
const Calendar = lazy(() => loadCalendar().then((m) => ({ default: m.Calendar })));
const prefetchCalendar = () => {
  void loadCalendar();
};

export function DatePickerField({
  label = "Dates",
  value,
  onChange,
  // "Nov 9, 2026" (2 Nov 2026): the old 09-11-2026 reads as two different dates depending on the country.
  displayFormat = "MMM d, yyyy",
  bare = false,
  minDate,
  tripStart,
  tripEnd,
}: {
  label?: string;
  displayFormat?: string;
  value: Date;
  onChange: (d: Date) => void;
  /** A borderless cell filling its slot in the search bar, instead of a bordered box of its own. */
  bare?: boolean;
  /** Earliest date that can be picked (a return cannot be before departure). Defaults to today. */
  minDate?: Date | undefined;
  /** Both ends of a round trip, so either calendar shows the whole trip. */
  tripStart?: Date | undefined;
  tripEnd?: Date | undefined;
}) {
  const [open, setOpen] = useState(false);
  // In the search bar, wider screens get two months side by side. Decided when the calendar opens.
  const [months, setMonths] = useState(1);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setMonths(bare && window.matchMedia("(min-width: 768px)").matches ? 2 : 1);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={prefetchCalendar}
          onTouchStart={prefetchCalendar}
          onFocus={prefetchCalendar}
          className={
            bare
              ? "flex h-full min-h-14 w-full min-w-0 items-center gap-2.5 px-4 py-2.5 text-left outline-none transition-colors hover:bg-[#F6F8FC] focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]"
              : "relative z-20 flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-left sm:py-2"
          }
        >
          {/* On the narrowest phones the date needs the icon's room, or it gets cut off. */}
          <span className={`shrink-0 text-primary ${bare ? "max-[359px]:hidden" : ""}`}>
            <CalendarDays className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span className={`block truncate font-semibold text-foreground ${bare ? "text-base sm:text-[15px]" : "text-sm"}`}>
              {format(value, displayFormat)}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl p-0" align="start" collisionPadding={8}>
        {bare ? (
          <p className="border-b border-border px-4 py-2.5 text-sm font-semibold text-navy">Choose your {label.toLowerCase()} date</p>
        ) : null}
        <Suspense fallback={<div className="h-[19rem] w-[17rem]" aria-busy="true" />}>
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          numberOfMonths={months}
          onSelect={(d) => {
            if (d) {
              onChange(d);
              setOpen(false);
            }
          }}
          disabled={{ before: minDate ?? new Date(new Date().setHours(0, 0, 0, 0)) }}
          {...(tripStart && tripEnd
            ? {
                modifiers: { trip: { from: tripStart, to: tripEnd }, tripEnds: [tripStart, tripEnd] },
                modifiersClassNames: { trip: "bg-primary/10", tripEnds: "font-semibold text-primary" },
              }
            : {})}
          initialFocus
          className={cn("p-3 pointer-events-auto [--cell-size:2.75rem] sm:[--cell-size:2.25rem]")}
        />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
