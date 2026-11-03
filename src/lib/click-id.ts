/**
 * Persistent affiliate click tracking.
 *
 * EAZAIR sends visitors with `?click_id=EZ-XXXXX`. The value must survive the
 * whole checkout journey (multi-page, possible refreshes), so it's stored in
 * localStorage and read back at booking time.
 */

const CLICK_ID_KEY = "bcd:click_id";
const UTM_SOURCE_KEY = "bcd:utm_source";
const MAX_LEN = 160;

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value.slice(0, MAX_LEN));
  } catch {
    /* storage unavailable */
  }
};

const read = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

/** Reads `click_id` / `utm_source` off the current URL and persists them. */
export const captureClickId = () => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const clickId = params.get("click_id");
  if (clickId) write(CLICK_ID_KEY, clickId);
  const utm = params.get("utm_source");
  if (utm) write(UTM_SOURCE_KEY, utm);
};

export const getClickId = (): string => (typeof window === "undefined" ? "" : read(CLICK_ID_KEY));

export const getUtmSource = (): string =>
  typeof window === "undefined" ? "" : read(UTM_SOURCE_KEY);
