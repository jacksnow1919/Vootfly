export const FLIGHT_SEARCH_ID = "flight-search";

/**
 * Scrolls the homepage flight search widget into view and focuses the origin field.
 * Returns false when the widget is not on the current page.
 */
export function focusFlightSearch(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(FLIGHT_SEARCH_ID);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    el.querySelector<HTMLInputElement>("input")?.focus();
  }, 400);
  return true;
}
