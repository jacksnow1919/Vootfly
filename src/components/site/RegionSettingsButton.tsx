import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Globe2, MessageCircle, Coins, X } from "lucide-react";
import { useRegionSettings, LANGUAGES, COUNTRIES, CURRENCY_SYMBOLS, SELECTABLE_CURRENCIES } from "@/lib/region-settings";

/**
 * Combined Language / Country-Region / Currency settings, one panel, one
 * click to open -- matching how Booking.com/Expedia-style sites bundle
 * these rather than three separate menus. Styled to match a reference
 * design the user provided (icon-per-row, a Country/Region subtitle,
 * "CODE - Symbol" currency format, stacked Save/Cancel).
 *
 * Save/Cancel is a real staged-edit pattern, not cosmetic: nothing in
 * this panel touches the live settings until Save is pressed. Opening
 * the panel, changing a value, and closing without saving (or pressing
 * Cancel) leaves everything exactly as it was.
 *
 * Honest about what each control actually does:
 * - Currency: REAL. Prices shown across the site are converted from the
 *   real USD amount PKFARE returns, using live ECB rates (Frankfurter).
 *   PKFARE itself only ever quotes in USD (confirmed by testing, not
 *   assumed) -- there's no native multi-currency quote, only a real,
 *   live-rate conversion of a real price, clearly labelled wherever
 *   it's shown.
 * - Country/Region: sets your market and auto-suggests that market's
 *   currency. Doesn't change page content yet -- no region-specific
 *   legal pages or localised routing exist.
 * - Language: saves your preference for later. The site's actual page
 *   content is English-only right now -- full translation is a separate,
 *   much larger project, not something to half-do here. Selecting a
 *   language does not translate anything today.
 *
 * `compact` (2 Nov 2026) is the shorter button for the header bar. The panel
 * renders on document.body because the sticky header is its own stacking
 * context, which would otherwise leave the advisor call bar on top of it.
 */
export function RegionSettingsButton({ compact = false }: { compact?: boolean | undefined }) {
  const [open, setOpen] = useState(false);
  const { language, country, currency, setLanguage, setCountry, setCurrency } = useRegionSettings();

  // Staged/draft values -- only committed to the real settings on Save.
  const [draftLanguage, setDraftLanguage] = useState(language);
  const [draftCountry, setDraftCountry] = useState(country);
  const [draftCurrency, setDraftCurrency] = useState(currency);

  const openPanel = () => {
    setDraftLanguage(language);
    setDraftCountry(country);
    setDraftCurrency(currency);
    setOpen(true);
  };

  const applyDraftCountry = (code: string) => {
    setDraftCountry(code as never);
    const match = COUNTRIES.find((c) => c.code === code);
    if (match) setDraftCurrency(match.currency);
  };

  const save = () => {
    setLanguage(draftLanguage);
    setCountry(draftCountry);
    setCurrency(draftCurrency);
    setOpen(false);
  };

  const currentCountry = COUNTRIES.find((c) => c.code === country);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={openPanel}
          aria-label={`Language and currency: ${language.toUpperCase()}, ${currency}`}
          title={`Language and currency: ${language.toUpperCase()}, ${currency}`}
          className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-navy hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Globe2 className="size-5" aria-hidden="true" />
          <span>{language.toUpperCase()}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openPanel}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-navy hover:border-primary hover:text-primary sm:w-auto lg:text-sm"
        >
          <Globe2 className="size-4" />
          <span>
            {language.toUpperCase()} · {currentCountry?.code ?? country} · {currency}
          </span>
        </button>
      )}

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/50 sm:items-center" onClick={() => setOpen(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Regional settings"
                className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-lux sm:rounded-3xl sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-navy">Regional settings</h2>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-secondary">
                    <X className="size-5" />
                  </button>
                </div>

                <div className="mt-5">
                  <p className="flex items-center gap-2 text-sm font-bold text-navy">
                    <MessageCircle className="size-4 text-muted-foreground" /> Language
                  </p>
                  <select
                    value={draftLanguage}
                    onChange={(e) => setDraftLanguage(e.target.value as never)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-navy"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {draftLanguage !== "en" ? (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Saved for later -- VootFly's page content is English-only right now, so this won't
                      translate the site yet.
                    </p>
                  ) : null}
                </div>

                <div className="mt-5">
                  <p className="flex items-center gap-2 text-sm font-bold text-navy">
                    <Globe2 className="size-4 text-muted-foreground" /> Country / Region
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Selecting the country you're in sets your default currency below.
                  </p>
                  <select
                    value={draftCountry}
                    onChange={(e) => applyDraftCountry(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-navy"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <p className="flex items-center gap-2 text-sm font-bold text-navy">
                    <Coins className="size-4 text-muted-foreground" /> Currency
                  </p>
                  <select
                    value={draftCurrency}
                    onChange={(e) => setDraftCurrency(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-navy"
                  >
                    {SELECTABLE_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code} - {CURRENCY_SYMBOLS[code] ?? code}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Prices are converted from real USD fares at today's exchange rate -- always marked
                    as converted, never shown as a native quote.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={save}
                  className="mt-6 w-full rounded-full bg-navy px-6 py-3 text-sm font-bold text-navy-foreground transition hover:brightness-110"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-2 w-full rounded-full bg-secondary px-6 py-3 text-sm font-bold text-navy transition hover:bg-secondary/70"
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
