import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock, ShieldCheck, User } from "lucide-react";
import { parseFlightSearch, currencySymbol } from "@/lib/flight-search-params";
import { Steps } from "@/components/site/ui";
import { track } from "@/lib/analytics";
import {
  validateTraveller,
  type TravellerErrors,
  type TravellerForm,
} from "@/lib/checkout-validation";
import {
  makeBookingId,
  formatBookingDate,
  saveBookingLocal,
  persistBooking,
  type BookingRecord,
} from "@/lib/booking-store";
import { getClickId, getUtmSource } from "@/lib/click-id";



export const Route = createFileRoute("/flight/booking")({
  validateSearch: parseFlightSearch,
  head: () => ({
    meta: [
      { title: "Secure Checkout | VootFly" },
      {
        name: "description",
        content: "Enter your traveller details to request this fare. Our team will contact you to confirm and arrange payment.",
      },
      { property: "og:title", content: "Secure Checkout" },
      { property: "og:description", content: "Request a fare with VootFly." },
    ],
  }),
  component: BookingPage,
});

const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Singapore",
  "Other",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
      <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  full,
  required,
  error,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  full?: boolean;
  required?: boolean;
  error?: string | undefined;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
}) {
  return (
    <label className={`relative z-20 block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        className={`mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ${
          error ? "border-destructive focus:border-destructive" : "border-input focus:border-gold"
        }`}
      />
      {error ? <span className="mt-1 block text-[11px] font-semibold text-destructive">{error}</span> : null}
    </label>
  );
}


function Choice({
  label,
  value,
  onChange,
  options,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  full?: boolean;
}) {
  return (
    <label className={`relative z-20 block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function BookingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const sym = currencySymbol(search.currency);
  // baseTotal is the PER-PERSON price, taxes & fees already included -- exactly
  // as labelled on the search results page. Never re-split into a fake
  // "base fare + 18% taxes" breakdown (removed 2026-09-08): PkfareNormalisedFare
  // has no real base/tax split field, so that breakdown was always invented,
  // and it made the per-person price look wrong next to search results
  // whenever someone compared the "Base fare" line to the price they'd
  // actually seen (which included taxes).
  const baseTotal = Number(search.price) || 0;
  const paxCount = Number(search.passengers) || 1;

  const partnerPromo = search.promo_code ?? "";
  const discountPct = Number(search.discount_pct) || 0;
  const discountAmount = Number(search.discount_amount) || 0;
  const flatDiscountVal = Number(search.discount_val) || 0;
  const finalPrice = Number(search.final_price) || 0;

  const rawDiscount =
    (search.discount_type ?? "").toLowerCase() === "percentage" && discountPct > 0
      ? Math.round((baseTotal * discountPct) / 100)
      : discountAmount > 0
        ? discountAmount
        : flatDiscountVal;

  const partnerDiscount = Math.min(Math.max(0, rawDiscount), baseTotal);
  const isPartner = (search.utm_source ?? "").toUpperCase() === "EAZAIR";
  const autoApplied = Boolean(partnerPromo && partnerDiscount > 0 && isPartner);

  // Aggregator deep link: trip + fare arrive locked in the URL, so the traveller
  // goes straight to passenger details instead of re-searching.
  const isDeepLink = Boolean((search.utm_source ?? "") || (search.click_id ?? ""));
  const partnerLabel = isPartner ? "EazAir" : (search.utm_source ?? "partner");

  const [promoInput, setPromoInput] = useState(autoApplied ? partnerPromo : "");
  const [appliedPromo, setAppliedPromo] = useState(autoApplied ? partnerPromo : "");
  const [promoError, setPromoError] = useState("");

  let discount = appliedPromo ? Math.min(partnerDiscount, baseTotal) : 0;
  // Consistency check: trust the partner's final_price if it disagrees by more than 1 unit.
  if (appliedPromo && finalPrice > 0 && Math.abs(baseTotal - discount - finalPrice) > 1) {
    discount = Math.min(Math.max(0, baseTotal - finalPrice), baseTotal);
  }
  const total = Math.max(0, baseTotal - discount);

  const applyPromo = () => {
    const code = promoInput.trim();
    if (code && partnerPromo && code.toUpperCase() === partnerPromo.toUpperCase()) {
      setAppliedPromo(partnerPromo);
      setPromoError("");
      return;
    }
    setAppliedPromo("");
    setPromoError(code ? "This promo code is not valid for this fare." : "Enter a promo code.");
  };

  useEffect(() => {
    track("Checkout Started", {
      route: `${search.origin}-${search.destination}`,
      cabin: search.cabin,
      total_price: total,
    });
    // Fires once per checkout entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  /** Set only when a fresh revalidation found a real, different price the
   * customer must explicitly confirm before a booking is created -- never
   * auto-applied. Holds the exact record that was submitted, so the
   * confirm action can resubmit with only the price adjusted. */
  const [priceChange, setPriceChange] = useState<{ record: BookingRecord; newPrice: number; currency: string } | null>(null);

  const [t, setT] = useState<TravellerForm>({
    title: "Mr",
    firstName: "",
    lastName: "",
    dobDay: "",
    dobMonth: "",
    dobYear: "",
    gender: "Male",
    passportNo: "",
    passportExpiry: "",
    nationality: "India",
    email: "",
    phone: "",
    address: "",
    country: "India",
    city: "",
    postalCode: "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof TravellerForm, boolean>>>({});
  const set = (k: keyof TravellerForm) => (v: string) => setT((p) => ({ ...p, [k]: v }));
  const touch = (k: keyof TravellerForm) => () => setTouched((p) => ({ ...p, [k]: true }));

  const fieldErrors: TravellerErrors = useMemo(() => validateTraveller(t), [t]);
  const travellerValid = Object.keys(fieldErrors).length === 0;
  const errorFor = (k: keyof TravellerForm) => (touched[k] ? fieldErrors[k] : undefined);

  const [accepted, setAccepted] = useState(false);

  const continueToBook = () => {
    if (!travellerValid) {
      setTouched(
        Object.fromEntries(Object.keys(t).map((k) => [k, true])) as Record<
          keyof TravellerForm,
          boolean
        >,
      );
      setError("Please correct the highlighted fields before continuing.");
      return;
    }
    setError("");
    setStep(2);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Shared by both the initial submit and the "confirm new price" resubmit
   * -- every attempt goes through the same real, freshly-revalidating
   * backend call, so a resubmission after accepting a changed price is
   * itself re-verified rather than trusted blindly. */
  const attemptPersist = async (record: BookingRecord) => {
    saveBookingLocal(record);
    let result;
    try {
      result = await persistBooking(record);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[checkout] backend rejected the booking:", message, e);
      setError("We couldn't save your booking request. Please call +1-800-773-6613 so our team can confirm it.");
      setSubmitting(false);
      return;
    }

    if (!result.ok) {
      setSubmitting(false);
      if (result.reason === "price_changed") {
        setPriceChange({ record, newPrice: result.newPrice, currency: result.currency });
        setError("");
      } else if (result.reason === "unavailable") {
        setPriceChange(null);
        setError(
          "This fare is no longer available at any price. Please search again for current options.",
        );
      } else {
        setPriceChange(null);
        setError("We couldn't verify this fare right now. Please try again in a moment.");
      }
      return;
    }

    setPriceChange(null);
    track("Booking Requested", {
      pnr: record.bookingId,
      gross_amount: record.total,
      source: record.utmSource || record.clickId ? "affiliate" : "direct",
    });
    navigate({ to: "/flight/Confirm", search });
  };

  const submitBookingRequest = async () => {
    if (!accepted) {
      setError("Please accept the Terms & Conditions to continue.");
      return;
    }
    setError("");
    setPriceChange(null);
    setSubmitting(true);

    // VootFly does not collect or store card details anywhere in this flow.
    // A booking request is saved with traveller details only; our team
    // contacts the customer to confirm availability and take payment through
    // a real, secure channel (phone or a payment link) before anything is
    // actually booked with the airline.
    const grandTotal = total * paxCount;
    const record: BookingRecord = {
      bookingId: makeBookingId(),
      bookingDate: formatBookingDate(),
      ...t,
      passengers: paxCount,
      flight: search,
      total: grandTotal,
      utmSource: search.utm_source ?? getUtmSource(),
      clickId: search.click_id ?? getClickId(),
      promoCode: appliedPromo,
      promoDiscount: discount,
    };

    await attemptPersist(record);
  };

  /** The customer has explicitly seen and accepted the new price -- resubmits
   * with total updated to exactly that price. This still goes through the
   * same real revalidation on the backend before anything is created. */
  const confirmNewPriceAndSubmit = async () => {
    if (!priceChange) return;
    setError("");
    setSubmitting(true);
    const updatedRecord: BookingRecord = { ...priceChange.record, total: priceChange.newPrice };
    setPriceChange(null);
    await attemptPersist(updatedRecord);
  };



  return (
    <div className="min-h-[100dvh] bg-secondary/50 px-4 py-6 pb-40">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-navy">
          <User className="size-4 shrink-0 text-gold" />
          <span className="text-muted-foreground">Already have an account?</span>
          <Link to="/auth" className="font-bold text-gold underline-offset-4 hover:underline">
            Sign In
          </Link>
          <span className="text-muted-foreground">
            for faster booking and to earn loyalty points. Guest checkout is fine too.
          </span>
        </div>
        <Steps current={step === 1 ? 3 : 5} />
      </div>

      <div className="mx-auto mt-4 grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {isDeepLink ? (
            <section className="rounded-2xl border border-navy/20 bg-card p-4 shadow-card sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-navy">Your Selected Trip</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-navy-foreground">
                  <Lock className="size-3" /> Fare locked from {partnerLabel}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Route", value: `${search.origin} → ${search.destination}` },
                  { label: "Airline", value: `${search.airline} · ${search.flightNo}` },
                  { label: "Cabin", value: search.cabin },
                  { label: "Depart", value: search.departDate },
                  {
                    label: "Return",
                    value: search.returnDate ? search.returnDate : "One way",
                  },
                  { label: "Travellers", value: `${paxCount} Adult` },
                ].map((f) => (
                  <div key={f.label} className="rounded-xl border border-border bg-secondary/60 px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-bold text-navy">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy px-4 py-3 text-navy-foreground">
                <span className="text-xs font-semibold uppercase tracking-widest text-navy-foreground/70">
                  Total fare (locked)
                </span>
                <span className="font-display text-xl font-semibold text-gold">
                  {sym}
                  {total.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                This fare reflects the one you selected on {partnerLabel}. Add your traveller details below
                to request this booking.
              </p>
            </section>
          ) : null}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
            <h2 className="font-display text-lg font-semibold text-navy">Promo Code</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Enter promo code"
                className="relative z-20 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm uppercase outline-none focus:border-gold"
              />
              <button
                onClick={applyPromo}
                className="shrink-0 rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-navy-foreground transition hover:brightness-125"
              >
                Apply
              </button>
            </div>
            {appliedPromo ? (
              <p className="mt-2 text-sm font-semibold text-emerald-600">
                {autoApplied && appliedPromo === partnerPromo
                  ? "✓ Partner discount applied automatically!"
                  : `✓ Promo code ${appliedPromo} applied — you save ${sym}${discount.toLocaleString()}.`}
              </p>
            ) : promoError ? (
              <p className="mt-2 text-sm font-semibold text-destructive">{promoError}</p>
            ) : null}
          </section>

          {step === 1 ? (
            <>
              <Section title="Traveller Details">
                <Choice label="Title" value={t.title} onChange={set("title")} options={["Mr", "Mrs", "Ms"]} />
                <Choice label="Gender" value={t.gender} onChange={set("gender")} options={["Male", "Female"]} />
                <Text label="First Name" value={t.firstName} onChange={set("firstName")} onBlur={touch("firstName")} error={errorFor("firstName")} placeholder="As on passport" required />
                <Text label="Last Name" value={t.lastName} onChange={set("lastName")} onBlur={touch("lastName")} error={errorFor("lastName")} placeholder="As on passport" required />
                <div className="grid grid-cols-3 items-start gap-2 sm:col-span-2">
                  <Text label="Day" value={t.dobDay} onChange={(v) => set("dobDay")(v.replace(/\D/g, "").slice(0, 2))} onBlur={touch("dobDay")} error={errorFor("dobDay")} placeholder="DD" inputMode="numeric" maxLength={2} required />
                  <Text label="Month" value={t.dobMonth} onChange={(v) => set("dobMonth")(v.replace(/\D/g, "").slice(0, 2))} onBlur={touch("dobMonth")} error={errorFor("dobMonth")} placeholder="MM" inputMode="numeric" maxLength={2} required />
                  <Text label="Year" value={t.dobYear} onChange={(v) => set("dobYear")(v.replace(/\D/g, "").slice(0, 4))} onBlur={touch("dobYear")} error={errorFor("dobYear")} placeholder="YYYY" inputMode="numeric" maxLength={4} required />
                </div>
                <Text label="Passport Number" value={t.passportNo} onChange={(v) => set("passportNo")(v.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} onBlur={touch("passportNo")} error={errorFor("passportNo")} placeholder="X1234567" required />
                <Text label="Passport Expiry" type="date" value={t.passportExpiry} onChange={set("passportExpiry")} onBlur={touch("passportExpiry")} error={errorFor("passportExpiry")} required />
                <Choice label="Nationality" value={t.nationality} onChange={set("nationality")} options={COUNTRIES} full />
              </Section>

              <Section title="Contact Details">
                <Text label="Email" type="email" inputMode="email" value={t.email} onChange={set("email")} onBlur={touch("email")} error={errorFor("email")} placeholder="you@email.com" required />
                <Text label="Phone Number" type="tel" inputMode="tel" value={t.phone} onChange={(v) => set("phone")(v.replace(/[^\d+\s]/g, ""))} onBlur={touch("phone")} error={errorFor("phone")} placeholder="+1 844 362 5118" required />
              </Section>

              <Section title="Billing Address">
                <Text label="Address" value={t.address} onChange={set("address")} onBlur={touch("address")} error={errorFor("address")} placeholder="Street address" full required />
                <Choice label="Country" value={t.country} onChange={set("country")} options={COUNTRIES} />
                <Text label="City" value={t.city} onChange={set("city")} onBlur={touch("city")} error={errorFor("city")} placeholder="City" required />
                <Text label="Postal Code" value={t.postalCode} onChange={set("postalCode")} onBlur={touch("postalCode")} error={errorFor("postalCode")} placeholder="110041" required />
              </Section>

              {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}

              <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
                <button
                  onClick={continueToBook}
                  disabled={!travellerValid}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3.5 text-sm font-bold text-gold-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck className="size-4" /> Continue to Book
                </button>
                <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
                  {travellerValid
                    ? "🔒 Your details are sent over a secure connection"
                    : "Complete every required field above to continue."}
                </p>
              </div>

            </>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-6">
                  <h2 className="font-display text-lg font-semibold text-navy">Review &amp; Request Booking</h2>
                </div>
                <div className="grid gap-3 p-4 sm:p-6">
                  <div className="rounded-xl border border-border bg-secondary/60 p-4 sm:p-5">
                    <div className="flex items-center gap-2 text-navy">
                      <ShieldCheck className="size-4 text-gold" />
                      <span className="text-sm font-bold">How this works</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Submitting this form sends a booking request, not a payment. VootFly does not
                      collect card details on this page. Once we've confirmed availability for your
                      fare, our team will contact you by phone or email to arrange secure payment
                      before your booking is finalised.
                    </p>
                  </div>

                  <label className="relative z-20 mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-0.5 size-4 accent-[var(--gold)]"
                    />
                    <span className="text-xs text-muted-foreground">
                      By submitting this request I accept VootFly's Terms &amp; Conditions. This is a booking
                      request, not a completed purchase — our team will contact me to confirm
                      availability and arrange payment before anything is charged.
                    </span>
                  </label>

                  {priceChange ? (
                    <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-navy sm:col-span-2">
                      <p className="font-bold">The price for this fare has changed.</p>
                      <p className="mt-1 text-muted-foreground">
                        We checked with our airline partner just now — the fare is available, but at{" "}
                        <span className="font-bold text-navy">
                          {currencySymbol(priceChange.currency)}
                          {priceChange.newPrice.toLocaleString()}
                        </span>{" "}
                        instead of the price you originally saw. We have not booked anything yet.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={confirmNewPriceAndSubmit}
                          disabled={submitting}
                          className="inline-flex items-center justify-center rounded-xl bg-gold px-4 py-2 text-xs font-bold text-gold-foreground transition hover:brightness-110 disabled:opacity-60"
                        >
                          {submitting ? "Submitting…" : `Confirm & Request at ${currencySymbol(priceChange.currency)}${priceChange.newPrice.toLocaleString()}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPriceChange(null)}
                          className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-navy"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {error ? (
                    <p className="text-sm font-semibold text-destructive sm:col-span-2">{error}</p>
                  ) : null}
                </div>
              </section>

              <button
                onClick={() => setStep(1)}
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-navy"
              >
                ← Back to traveller details
              </button>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-navy text-navy-foreground shadow-lux">
            <div className="border-b border-white/10 p-5">
              <h2 className="font-display text-lg font-semibold">Trip Summary</h2>
              <p className="mt-1 text-xs text-navy-foreground/60">
                From your referring search.
              </p>
            </div>
            <dl className="space-y-3 p-5 text-sm">
              <Row label="Route" value={`${search.origin} → ${search.destination}`} />
              <Row label="Airline" value={search.airline} />
              <Row label="Flight" value={search.flightNo} />
              <Row label="Cabin" value={search.cabin} />
              <Row label="Depart" value={search.departDate} />
              {search.returnDate ? <Row label="Return" value={search.returnDate} /> : null}
              <div className="border-t border-white/10 pt-3">
                <Row label="Fare (per person, incl. taxes & fees)" value={`${sym}${baseTotal.toLocaleString()}`} />
                {paxCount > 1 ? (
                  <Row label={`Total for ${paxCount} passengers`} value={`${sym}${(baseTotal * paxCount).toLocaleString()}`} />
                ) : null}
                {appliedPromo ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs uppercase tracking-widest text-red-400">
                      Promo Code ({appliedPromo})
                    </dt>
                    <dd className="font-semibold text-red-400">
                      -{sym}
                      {discount.toLocaleString()}
                    </dd>
                  </div>
                ) : null}
              </div>

              <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                <dt className="text-xs uppercase tracking-widest text-navy-foreground/60">
                  Total per person
                </dt>
                <dd className="font-display text-2xl font-semibold text-gold">
                  {sym}
                  {total.toLocaleString()}
                </dd>
              </div>
            </dl>
            <div className="p-5 pt-0 text-[11px] text-navy-foreground/60">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-3.5" /> This is a booking request. Our team confirms
                availability and arranges payment separately.
              </p>
              {/* Fees shown before ticketing (1 Nov 2026). Amounts are copied from /refund-policy;
                  no other VootFly fee exists in the booking code. */}
              <div className="mt-3 rounded-lg border border-white/10 p-3 leading-relaxed">
                <p className="font-semibold text-navy-foreground/80">VootFly service fees</p>
                <p className="mt-1">
                  The fare above is the airline fare, including taxes. After a ticket is issued, our service fee is
                  USD 50 per passenger for a change and USD 75 per passenger for a cancellation, plus any airline
                  charges. Your advisor confirms the final total with you before anything is ticketed.{" "}
                  <a href="/refund-policy" className="font-semibold text-gold underline">Refund &amp; Cancellation Policy</a>
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {step === 2 ? (
        <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-navy">
              Fare: {sym}
              {total.toLocaleString()}{" "}
              <span className="text-xs font-normal text-muted-foreground">incl. taxes &amp; fees</span>
            </p>
            <button
              onClick={submitBookingRequest}
              disabled={submitting || !!priceChange}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-gold-foreground transition hover:brightness-110 disabled:opacity-60 sm:flex-none"
            >
              <Lock className="size-4" />{" "}
              {priceChange ? "Confirm the new price above to continue" : submitting ? "Submitting…" : "Request This Booking"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-widest text-navy-foreground/60">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold">{value}</dd>
    </div>
  );
}
