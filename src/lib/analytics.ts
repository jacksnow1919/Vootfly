/**
 * Mixpanel wrapper. Browser-only: every call no-ops during SSR so routes stay
 * isomorphic. The library is dynamically imported after hydration.
 */
const TOKEN = "def37fc319d4408b68bf1d198a2ba53a";

type Props = Record<string, unknown>;

let ready: Promise<typeof import("mixpanel-browser").default | null> | null = null;

const load = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!ready) {
    ready = import("mixpanel-browser")
      .then(({ default: mixpanel }) => {
        mixpanel.init(TOKEN, { track_pageview: true, persistence: "localStorage" });
        mixpanel.register({ site_domain: "vootfly.com" });
        return mixpanel;
      })
      .catch(() => null);
  }
  return ready;
};

/** Call once from the root layout, after hydration. */
export const initAnalytics = () => {
  void load().then((mp) => {
    if (!mp) return;
    const clickId = new URLSearchParams(window.location.search).get("click_id");
    if (clickId) mp.register({ click_id: clickId });
  });
};

/**
 * GA4 forwarding (phase tracker 1.1, 28 Sep 2026). GA4 (G-SVEMV8T5N5) was only
 * recording its own standard events, because track() sent VootFly's events to
 * Mixpanel alone, so Analytics QA could not cross-check bookings in GA4.
 * Every tracked event now also goes to GA4 under a snake_case name
 * ("Booking Requested" -> booking_requested).
 *
 * Privacy guard: GA4 must never receive personal data, so any property whose
 * key mentions email, phone or name, and any value that looks like an email
 * address, is dropped. Only strings (cut to 100 characters, GA4's limit),
 * numbers and booleans are sent.
 */
const ga4Name = (event: string) =>
  event.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

const ga4Params = (props?: Props) => {
  const out: Record<string, string | number | boolean> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || /email|phone|name/i.test(k)) continue;
    const key = k.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    if (typeof v === "number" || typeof v === "boolean") out[key] = v;
    else if (typeof v === "string" && !/@[^\s@]+\.[^\s@]+/.test(v)) out[key] = v.slice(0, 100);
  }
  return out;
};

export const track = (event: string, props?: Props) => {
  void load().then((mp) => mp?.track(event, props));
  if (typeof window !== "undefined") {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") gtag("event", ga4Name(event), ga4Params(props));
  }
};

export const registerSuperProps = (props: Props) => {
  void load().then((mp) => mp?.register(props));
};
