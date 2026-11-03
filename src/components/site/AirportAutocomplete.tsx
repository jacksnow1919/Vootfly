import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { airports, searchAirports } from "@/lib/airports";

/** "New York (JFK)" for a known airport. A code with no row in the list is shown as it is. */
function labelFor(code: string): string {
  const a = airports.find((x) => x.code === code);
  return a ? `${a.city} (${a.code})` : code;
}

/** The airport list abbreviates names ("John F. Kennedy Intl", "Heathrow"); the field has room to spell them out. */
const fullAirportName = (name: string) => {
  const full = name.replace(/\bIntl\b/g, "International");
  return /international|airport/i.test(full) ? full : `${full} Airport`;
};

/** Shown before anything is typed: major airports across the regions VootFly's routes cover. */
const POPULAR_AIRPORTS = ["JFK", "LAX", "ORD", "YYZ", "LHR", "CDG", "DXB", "NRT", "SIN", "DEL"]
  .map((code) => airports.find((a) => a.code === code))
  .filter((a): a is (typeof airports)[number] => Boolean(a));

export function AirportAutocomplete({
  label,
  value,
  onChange,
  placeholder = "Country, city or airport",
  tone = "light",
  required,
  bare = false,
  className = "",
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  /** "dark" renders on navy surfaces (modals); "light" on cards. */
  tone?: "light" | "dark";
  required?: boolean;
  /** A borderless cell filling its slot in the search bar, instead of a bordered box of its own. */
  bare?: boolean;
  /** Extra classes for the bare cell (spacing around the swap button). */
  className?: string;
  /** Marks the field as the one a validation error refers to. */
  invalid?: boolean;
}) {
  const display = labelFor(value);
  const selected = airports.find((a) => a.code === value);
  const [query, setQuery] = useState(display);
  // True once the traveller has typed. Until then the field holds the chosen airport's label,
  // which is not a search term, so the suggestions show the main hubs instead.
  const [typed, setTyped] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const keyNav = useRef(false);
  const listId = useId();

  useEffect(() => {
    setQuery(display);
    setTyped(false);
  }, [display]);

  // Leaving without choosing puts the chosen airport back, so the field never shows
  // half-typed text while a different airport is what would be searched.
  const close = useCallback(() => {
    setOpen(false);
    if (typed && value) {
      setQuery(display);
      setTyped(false);
    }
  }, [typed, value, display]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  // Arrow keys keep the highlighted suggestion in view (the list scrolls).
  useEffect(() => {
    if (open && keyNav.current) listRef.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView({ block: "nearest" });
    keyNav.current = false;
  }, [open, active]);

  const results = useMemo(() => (typed && query.trim() ? searchAirports(query) : POPULAR_AIRPORTS), [query, typed]);

  const pick = (code: string) => {
    onChange(code);
    setQuery(labelFor(code));
    setTyped(false);
    setOpen(false);
  };

  const dark = tone === "dark";

  return (
    <div
      ref={wrapRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
      className={`relative min-w-0 flex-1 ${open ? "z-40" : "z-20"}`}
    >
      <label
        className={
          bare
            ? `flex h-full min-h-14 min-w-0 cursor-text items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-[#F6F8FC] focus-within:bg-[#F6F8FC] focus-within:shadow-[inset_0_0_0_2px_var(--primary)] ${invalid ? "bg-red-50 shadow-[inset_0_0_0_2px_#DC2626]" : ""} ${className}`
            : `flex min-w-0 items-center gap-2 rounded-xl border px-3 py-1.5 sm:py-2 ${dark ? "border-white/15 bg-white/5" : "border-border bg-card"}`
        }
      >
        <span className={`shrink-0 ${dark ? "text-gold" : "text-primary"}`}>
          <MapPin className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[11px] font-semibold uppercase tracking-wider ${
              dark ? "text-navy-foreground/50" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
          <input
            value={query}
            placeholder={placeholder}
            required={required}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setTyped(true);
              setOpen(true);
              setActive(0);
            }}
            onFocus={(e) => {
              e.target.select();
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                keyNav.current = true;
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                keyNav.current = true;
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                pick(results[active].code);
              } else if (e.key === "Escape") {
                close();
              }
            }}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
            aria-invalid={invalid || undefined}
            className={`w-full truncate border-0 bg-transparent p-0 text-base font-semibold outline-none sm:text-[15px] ${
              dark
                ? "text-navy-foreground placeholder:text-navy-foreground/40"
                : "text-foreground placeholder:font-medium placeholder:text-muted-foreground"
            }`}
          />
          {bare && selected && !typed ? (
            <span className="block truncate text-xs text-muted-foreground">{fullAirportName(selected.name)}</span>
          ) : null}
        </span>
      </label>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${label} airports`}
          // Keeps focus in the input, so choosing a suggestion never counts as leaving the field.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-[calc(100%+0.35rem)] z-50 max-h-80 w-full min-w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card p-1 text-left shadow-lux"
        >
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-2.5 text-sm text-muted-foreground">No airports found</li>
          ) : (
            <>
              {typed && query.trim() ? null : (
                <li role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Popular airports
                </li>
              )}
              {results.map((a, i) => (
                <li
                  key={a.code}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(a.code)}
                  className={`w-full cursor-pointer rounded-lg px-3 py-2.5 ${i === active ? "bg-secondary" : ""}`}
                >
                  <span className="block truncate text-sm font-semibold text-navy">
                    {a.city}
                    <span className="font-normal text-muted-foreground">, {a.country}</span>
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    <b className="font-bold text-primary">{a.code}</b> · {fullAirportName(a.name)}
                  </span>
                </li>
              ))}
            </>
          )}
        </ul>
      ) : null}
    </div>
  );
}
