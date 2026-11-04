import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { parseFlightSearch, currencySymbol } from "@/lib/flight-search-params";
import { SearchSelect } from "@/components/checkout/SearchSelect";
import { VaultCardForm, type VaultCard, type VaultCardFormHandle } from "@/components/checkout/VaultCardForm";
import { getCardVaultConfig } from "@/lib/card-vault.functions";
import type { VaultConfig } from "@/lib/card-vault.server";
import { ServiceFeeNote, TripDetails } from "@/components/checkout/TripDetails";
import { Steps } from "@/components/site/ui";
import { track } from "@/lib/analytics";
import {
  validatePassenger,
  validateTraveller,
  type PassengerForm,
  type TravellerErrors,
  type TravellerForm,
} from "@/lib/checkout-validation";
import { beginCheckout, getFareQuote } from "@/lib/checkout.functions";
import { CHECKOUT_DRAFT_KEY, CHECKOUT_RETURN_KEY, formatAmount, type QuoteResult, type FareRef } from "@/lib/checkout-shared";
import { COUNTRY_NAMES, PHONE_COUNTRIES } from "@/lib/countries";
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

const COUNTRIES = COUNTRY_NAMES;
const COUNTRY_OPTIONS = COUNTRY_NAMES.map((name) => ({ value: name, label: name }));
const PHONE_OPTIONS = PHONE_COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${c.dial})` }));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(
  (label, i) => ({ value: String(i + 1).padStart(2, "0"), label }),
);

const blankPassenger = (): PassengerForm => ({
  title: "Mr",
  gender: "Male",
  firstName: "",
  lastName: "",
  dobDay: "",
  dobMonth: "",
  dobYear: "",
  passportNo: "",
  passportExpiry: "",
  nationality: "India",
});

/** One traveller's own details: the same fields for the lead traveller and everyone else. */
function PassengerFields({
  value,
  onChange,
  onBlur,
  errorFor,
}: {
  value: PassengerForm;
  onChange: (k: keyof PassengerForm, v: string) => void;
  onBlur: (k: keyof PassengerForm) => void;
  errorFor: (k: keyof PassengerForm) => string | undefined;
}) {
  return (
    <>
      <Choice label="Title" value={value.title} onChange={(v) => onChange("title", v)} options={["Mr", "Mrs", "Ms"]} />
      <Choice label="Gender" value={value.gender} onChange={(v) => onChange("gender", v)} options={["Male", "Female"]} />
      <Text label="First Name" value={value.firstName} onChange={(v) => onChange("firstName", v)} onBlur={() => onBlur("firstName")} error={errorFor("firstName")} placeholder="As on passport" required />
      <Text label="Last Name" value={value.lastName} onChange={(v) => onChange("lastName", v)} onBlur={() => onBlur("lastName")} error={errorFor("lastName")} placeholder="As on passport" required />
      <div className="grid grid-cols-3 items-start gap-2 sm:col-span-2">
        <Text label="Day" value={value.dobDay} onChange={(v) => onChange("dobDay", v.replace(/\D/g, "").slice(0, 2))} onBlur={() => onBlur("dobDay")} error={errorFor("dobDay")} placeholder="DD" inputMode="numeric" maxLength={2} required />
        <Choice label="Month *" value={value.dobMonth} onChange={(v) => { onChange("dobMonth", v); onBlur("dobMonth"); }} options={MONTHS} placeholder="Select" error={errorFor("dobMonth")} />
        <Text label="Year" value={value.dobYear} onChange={(v) => onChange("dobYear", v.replace(/\D/g, "").slice(0, 4))} onBlur={() => onBlur("dobYear")} error={errorFor("dobYear")} placeholder="YYYY" inputMode="numeric" maxLength={4} required />
      </div>
      <Text label="Passport Number" value={value.passportNo} onChange={(v) => onChange("passportNo", v.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} onBlur={() => onBlur("passportNo")} error={errorFor("passportNo")} placeholder="X1234567" required />
      <Text label="Passport Expiry" type="date" value={value.passportExpiry} onChange={(v) => onChange("passportExpiry", v)} onBlur={() => onBlur("passportExpiry")} error={errorFor("passportExpiry")} required />
      <CountryField label="Nationality" value={value.nationality} onChange={(v) => onChange("nationality", v)} full />
    </>
  );
}

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
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  full?: boolean;
  placeholder?: string;
  error?: string | undefined;
}) {
  return (
    <label className={`relative z-20 block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ${
          error ? "border-destructive" : "border-input focus:border-gold"
        }`}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
      {error ? <span className="mt-1 block text-[11px] font-semibold text-destructive">{error}</span> : null}
    </label>
  );
}

function CountryField({ label, value, onChange, full }: { label: string; value: string; onChange: (v: string) => void; full?: boolean }) {
  return (
    <div className={`relative z-20 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <SearchSelect ariaLabel={label} value={value} options={COUNTRY_OPTIONS} onChange={onChange} placeholder="Search country" className="mt-1 w-full" />
    </div>
  );
}

/** Country code plus number, saved together as "+91 9876543210". */
function PhoneField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string | undefined;
}) {
  const [country, setCountry] = useState("US");
  const dial = PHONE_COUNTRIES.find((c) => c.code === country)?.dial ?? "+1";

  useEffect(() => {
    if (value.startsWith(`${dial} `)) return;
    // A number restored from an earlier visit, or a first visit with no number: match its code, else the browser's region.
    const saved = PHONE_COUNTRIES.filter((c) => value.startsWith(`${c.dial} `)).sort((a, z) => z.dial.length - a.dial.length)[0];
    const region = navigator.language.split("-")[1]?.toUpperCase();
    const next = saved?.code ?? (!value ? PHONE_COUNTRIES.find((c) => c.code === region)?.code : undefined);
    if (next) setCountry(next);
    // Only on arrival: choosing a code afterwards must stick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const number = value.startsWith(`${dial} `) ? value.slice(dial.length + 1) : value.replace(/^\+/, "");
  const save = (nextDial: string, digits: string) => onChange(digits ? `${nextDial} ${digits}` : "");

  return (
    <div className="relative z-20">
      <label htmlFor="traveller-phone" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Phone Number *
      </label>
      <div className="mt-1 flex gap-2">
        <SearchSelect
          ariaLabel="Country code"
          value={country}
          shown={dial}
          options={PHONE_OPTIONS}
          onChange={(code) => {
            setCountry(code);
            save(PHONE_COUNTRIES.find((c) => c.code === code)?.dial ?? dial, number);
          }}
          placeholder="Search country or code"
          className="w-[6.25rem] shrink-0"
        />
        <input
          id="traveller-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={number}
          placeholder="Mobile number"
          onChange={(e) => save(dial, e.target.value.replace(/\D/g, ""))}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          className={`min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ${
            error ? "border-destructive focus:border-destructive" : "border-input focus:border-gold"
          }`}
        />
      </div>
      {error ? <span className="mt-1 block text-[11px] font-semibold text-destructive">{error}</span> : null}
    </div>
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


  // Fares from our own search can be held by card, and the sales team tickets them. Partner
  // deep links and their discounts, or a site with no payment keys, stay a booking request.
  const cardEligible = Boolean(search.offer || search.supplier) && !isDeepLink && !autoApplied;
  const fareRef = useMemo<FareRef>(
    () => ({
      ...(search.offer ? { offerId: search.offer } : {}),
      ...(search.supplier ? { supplier: search.supplier as FareRef["supplier"] } : {}),
      origin: search.origin,
      destination: search.destination,
      departDate: search.departDate,
      ...(search.returnDate ? { returnDate: search.returnDate } : {}),
      cabin: search.cabin,
      flightNo: search.flightNo,
      passengers: paxCount,
      price: search.price,
      currency: search.currency,
    }),
    [search, paxCount],
  );
  const draftKey = search.offer ?? `${search.origin}-${search.destination}-${search.departDate}-${search.flightNo}`;
  const [quote, setQuote] = useState<QuoteResult | { status: "loading" | "none" }>(
    cardEligible ? { status: "loading" } : { status: "none" },
  );
  const liveQuote = quote.status === "ok" ? quote.quote : null;
  const payable = liveQuote !== null;
  const requestFlow = quote.status === "none" || quote.status === "payments_off";
  const fareBlocked = quote.status === "unavailable" || quote.status === "check_failed";

  const loadQuote = useCallback(() => {
    if (!cardEligible) return;
    setQuote({ status: "loading" });
    getFareQuote({ data: fareRef })
      .then(setQuote)
      .catch((e) => {
        console.error("[checkout] fare check failed", e);
        setQuote({ status: "check_failed" });
      });
  }, [cardEligible, fareRef]);
  useEffect(loadQuote, [loadQuote]);

  const searchAgainHref = `/flight/search?${new URLSearchParams({
    origin: search.origin,
    destination: search.destination,
    date: search.departDate,
    ...(search.returnDate ? { returnDate: search.returnDate } : {}),
    passengers: String(paxCount),
    cabin: search.cabin,
    currency: search.currency,
  }).toString()}`;

  // The payment page shows to everyone once the vault is live, and only on the ?cardtest=1
  // link until then. Without vault keys that link shows the page with its fields switched off.
  const [vault, setVault] = useState<VaultConfig | null | undefined>(undefined);
  useEffect(() => {
    getCardVaultConfig()
      .then(setVault)
      .catch(() => setVault(null));
  }, []);
  const cardOn = requestFlow && Boolean(vault?.live || search.cardtest);
  const cardForm = useRef<VaultCardFormHandle>(null);
  const vaultCard = useRef<VaultCard | undefined>(undefined);
  const [cardReady, setCardReady] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const [extra, setExtra] = useState<PassengerForm[]>(() => Array.from({ length: Math.max(0, paxCount - 1) }, blankPassenger));
  const [extraTouched, setExtraTouched] = useState<Record<string, boolean>>({});
  const extraErrors = useMemo(() => extra.map(validatePassenger), [extra]);

  const fieldErrors: TravellerErrors = useMemo(() => {
    const errors = validateTraveller(t);
    // The airline needs the full international number for a real booking.
    if (payable && !errors.phone && !t.phone.trim().startsWith("+")) errors.phone = "Add your country code, such as +1.";
    return errors;
  }, [t, payable]);
  const travellerValid =
    Object.keys(fieldErrors).length === 0 && (!payable || extraErrors.every((e) => Object.keys(e).length === 0));
  const errorFor = (k: keyof TravellerForm) => (touched[k] ? fieldErrors[k] : undefined);

  // Coming back from the payment page keeps what was typed, for this same fare only.
  useEffect(() => {
    if (!cardEligible) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(CHECKOUT_DRAFT_KEY) ?? "null") as
        | { offer: string; t: TravellerForm; extra: PassengerForm[] }
        | null;
      if (saved?.offer !== draftKey) return;
      setT(saved.t);
      if (saved.extra.length === paxCount - 1) setExtra(saved.extra);
    } catch {
      /* storage unavailable */
    }
    // Restores once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [accepted, setAccepted] = useState(false);

  const continueToBook = () => {
    if (!travellerValid) {
      setTouched(
        Object.fromEntries(Object.keys(t).map((k) => [k, true])) as Record<
          keyof TravellerForm,
          boolean
        >,
      );
      setExtraTouched(
        Object.fromEntries(
          extra.flatMap((p, i) => Object.keys(p).map((k) => [`${i}.${k}`, true])),
        ),
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
      result = await persistBooking(record, vaultCard.current);
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
      } else if (result.reason === "card_failed") {
        setPriceChange(null);
        vaultCard.current = undefined;
        setError("We couldn't save your card securely, so nothing was booked. Please check your card details and try again, or call +1-800-773-6613.");
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

    // VootFly never receives a card number. With the vault on, the card goes straight to the
    // vault and only its token reference comes here. Nothing is charged by this page.
    if (cardOn) {
      try {
        if (!cardForm.current) throw new Error("CARD_FORM_NOT_READY");
        vaultCard.current = await cardForm.current.tokenize();
      } catch (e) {
        console.error("[checkout] card vault failed", e instanceof Error ? e.message : "unknown error");
        setError("We couldn't save your card securely, so nothing was booked. Please check your card details and try again, or call +1-800-773-6613.");
        setSubmitting(false);
        return;
      }
    }
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
      ...(cardOn ? { cardOnFile: true } : {}),
    };

    await attemptPersist(record);
  };

  /** Opens a real payment. The server re-reads the offer and sets the amount; nothing is booked yet. */
  const proceedToPayment = async () => {
    if (!liveQuote) return;
    if (!accepted) {
      setError("Please accept the Terms & Conditions to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ offer: draftKey, t, extra }));
      sessionStorage.setItem(CHECKOUT_RETURN_KEY, `${window.location.pathname}${window.location.search}`);
    } catch {
      /* storage unavailable: the customer would only have to type their details again */
    }
    try {
      const result = await beginCheckout({
        data: {
          fare: fareRef,
          expectedTotal: liveQuote.total,
          acceptedTerms: true,
          travellers: [t, ...extra],
          contact: {
            email: t.email,
            phone: t.phone,
            address: t.address,
            country: t.country,
            city: t.city,
            postalCode: t.postalCode,
          },
          utmSource: search.utm_source ?? getUtmSource(),
          clickId: search.click_id ?? getClickId(),
        },
      });
      if (result.status === "ok") {
        track("Payment Started", { route: `${search.origin}-${search.destination}`, total_price: Number(liveQuote.total) });
        await navigate({ to: "/flight/payment", search: { checkout: result.checkoutId } });
        return;
      }
      if (result.status === "price_changed") {
        setQuote({ status: "ok", quote: result.quote });
        setAccepted(false);
        setError(
          `The airline's price has changed to ${formatAmount(result.quote.total, result.quote.currency)}. Nothing has been charged. Please check the new total and accept the terms again to continue.`,
        );
      } else if (result.status === "invalid") {
        setError(result.message);
      } else if (result.status === "unavailable" || result.status === "payments_off") {
        setQuote({ status: result.status });
      } else {
        setError("We couldn't start your payment. You have not been charged. Please try again in a moment.");
      }
    } catch (e) {
      console.error("[checkout] could not start payment", e);
      setError("We couldn't start your payment. You have not been charged. Please try again in a moment.");
    }
    setSubmitting(false);
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
        <Steps current={step === 1 ? 3 : step === 2 ? 4 : 5} />
      </div>

      <div className="mx-auto mt-4 grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {quote.status === "unavailable" ? (
            <section className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-navy sm:p-6">
              <h2 className="font-display text-lg font-semibold">This fare is no longer available</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Airline offers only last a short time. Nothing has been booked or charged. Please search again for
                current prices.
              </p>
              <a href={searchAgainHref} className="mt-3 inline-block rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground">
                Search again
              </a>
            </section>
          ) : null}
          {quote.status === "check_failed" ? (
            <section className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-navy sm:p-6">
              <h2 className="font-display text-lg font-semibold">We couldn't check this fare with the airline</h2>
              <p className="mt-1 text-sm text-muted-foreground">Nothing has been booked or charged. Please try again in a moment.</p>
              <button type="button" onClick={loadQuote} className="mt-3 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground">
                Try again
              </button>
            </section>
          ) : null}
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
          {requestFlow && step !== 3 ? (
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
          ) : null}

          {step === 1 ? (
            <>
              <Section title={payable && paxCount > 1 ? "Traveller 1 Details" : "Traveller Details"}>
                <PassengerFields value={t} onChange={(k, v) => set(k)(v)} onBlur={(k) => touch(k)()} errorFor={errorFor} />
              </Section>

              {payable
                ? extra.map((p, i) => (
                    <Section key={i} title={`Traveller ${i + 2} Details`}>
                      <PassengerFields
                        value={p}
                        onChange={(k, v) => setExtra((list) => list.map((x, j) => (j === i ? { ...x, [k]: v } : x)))}
                        onBlur={(k) => setExtraTouched((was) => ({ ...was, [`${i}.${k}`]: true }))}
                        errorFor={(k) => (extraTouched[`${i}.${k}`] ? extraErrors[i]?.[k] : undefined)}
                      />
                    </Section>
                  ))
                : null}

              <Section title="Contact Details">
                <Text label="Email" type="email" inputMode="email" value={t.email} onChange={set("email")} onBlur={touch("email")} error={errorFor("email")} placeholder="you@email.com" required />
                <PhoneField value={t.phone} onChange={set("phone")} onBlur={touch("phone")} error={errorFor("phone")} />
              </Section>

              <Section title="Billing Address">
                <Text label="Address" value={t.address} onChange={set("address")} onBlur={touch("address")} error={errorFor("address")} placeholder="Street address" full required />
                <CountryField label="Country" value={t.country} onChange={set("country")} />
                <Text label="City" value={t.city} onChange={set("city")} onBlur={touch("city")} error={errorFor("city")} placeholder="City" required />
                <Text label="Postal Code" value={t.postalCode} onChange={set("postalCode")} onBlur={touch("postalCode")} error={errorFor("postalCode")} placeholder="110041" required />
              </Section>

              {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}

              <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
                <button
                  onClick={continueToBook}
                  disabled={!travellerValid || quote.status === "loading" || fareBlocked}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3.5 text-sm font-bold text-gold-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck className="size-4" /> {payable ? "Continue to Review" : "Continue to Book"}
                </button>
                <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
                  {quote.status === "loading"
                    ? "Checking this fare with the airline…"
                    : travellerValid
                    ? "🔒 Your details are sent over a secure connection"
                    : "Complete every required field above to continue."}
                </p>
              </div>

            </>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-6">
                  <h2 className="font-display text-lg font-semibold text-navy">
                    {payable || (cardOn && step === 2) ? "Review Your Booking" : cardOn ? "Make Your Payment" : <>Review &amp; Request Booking</>}
                  </h2>
                  {cardOn && step === 3 ? (
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-navy">
                      {["Visa", "Mastercard", "Amex", "Maestro"].map((brand) => (
                        <span key={brand} className="rounded-md border border-border bg-secondary px-2 py-1">
                          {brand}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 p-4 sm:p-6">
                  {liveQuote ? (
                    <>
                      <TripDetails trip={liveQuote.trip} />
                      <div className="rounded-xl border border-border p-4">
                        <h3 className="font-display text-sm font-semibold text-navy">Travellers</h3>
                        <ul className="mt-1 space-y-0.5 text-sm font-semibold text-navy">
                          {[t, ...extra].map((p, i) => (
                            <li key={i}>
                              {p.title} {p.firstName} {p.lastName}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Names must match each passport. Contact: {t.email}, {t.phone}.
                        </p>
                      </div>
                    </>
                  ) : null}
                  <div className={`rounded-xl border border-border bg-secondary/60 p-4 sm:p-5 ${step === 3 ? "hidden" : ""}`}>
                    <div className="flex items-center gap-2 text-navy">
                      <ShieldCheck className="size-4 text-gold" />
                      <span className="text-sm font-bold">How this works</span>
                    </div>
                    {payable ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        On the next page you pay by card through Stripe, our payment processor. VootFly never sees or
                        stores your full card number. Your card is held first and only charged after our team issues your
                        ticket. If we can't issue it, the hold on your card is released.
                      </p>
                    ) : cardOn ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        On the next page you add your card details. Nothing is charged there. Our team confirms availability
                        and the final fare with you, and your card is charged when your ticket is issued.
                      </p>
                    ) : (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Submitting this form sends a booking request, not a payment. VootFly does not
                        collect card details on this page. Once we've confirmed availability for your
                        fare, our team will contact you by phone or email to arrange secure payment
                        before your booking is finalised.
                      </p>
                    )}
                  </div>

                  {cardOn && step === 3 ? (
                    vault ? <VaultCardForm ref={cardForm} config={vault} onReadyChange={setCardReady} /> : <CardFormOff />
                  ) : null}

                  <label className={`relative z-20 mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 sm:col-span-2 ${cardOn && step === 2 ? "hidden" : ""}`}>
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => {
                        setAccepted(e.target.checked);
                        if (e.target.checked) setError("");
                      }}
                      className="mt-0.5 size-4 accent-[var(--gold)]"
                    />
                    {payable ? (
                      <span className="text-xs text-muted-foreground">
                        I accept VootFly's <a href="/terms" className="font-semibold underline">Terms &amp; Conditions</a> and{" "}
                        <a href="/refund-policy" className="font-semibold underline">Refund &amp; Cancellation Policy</a>, and the
                        baggage, refund and change conditions shown above.
                      </span>
                    ) : cardOn ? (
                      <span className="text-xs text-muted-foreground">
                        By clicking on "Confirm Booking" I accept the <a href="/terms" className="font-semibold underline">Terms &amp; Conditions</a> and{" "}
                        <a href="/refund-policy" className="font-semibold underline">Refund &amp; Cancellation Policy</a> of VootFly, and I accept
                        that my bank card will be charged, by VootFly or the airline or ticketing partner, for the fare confirmed with me when my
                        ticket is issued.
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        By submitting this request I accept VootFly's Terms &amp; Conditions. This is a booking
                        request, not a completed purchase — our team will contact me to confirm
                        availability and arrange payment before anything is charged.
                      </span>
                    )}
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
                onClick={() => {
                  setCardReady(false);
                  setStep(step === 3 ? 2 : 1);
                }}
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-navy"
              >
                {step === 3 ? "← Back to review" : "← Back to traveller details"}
              </button>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-navy text-navy-foreground shadow-lux">
            <div className="border-b border-white/10 p-5">
              <h2 className="font-display text-lg font-semibold">Trip Summary</h2>
              <p className="mt-1 text-xs text-navy-foreground/60">
                {payable ? "Price checked just now." : "From your referring search."}
              </p>
            </div>
            <dl className="space-y-3 p-5 text-sm">
              <Row label="Route" value={`${search.origin} → ${search.destination}`} />
              <Row label="Airline" value={search.airline} />
              <Row label="Flight" value={search.flightNo} />
              <Row label="Cabin" value={search.cabin} />
              <Row label="Depart" value={search.departDate} />
              {search.returnDate ? <Row label="Return" value={search.returnDate} /> : null}
              {liveQuote ? (
                <>
                  <div className="space-y-3 border-t border-white/10 pt-3">
                    {liveQuote.base ? <Row label="Fare" value={formatAmount(liveQuote.base, liveQuote.currency)} /> : null}
                    {liveQuote.tax ? <Row label="Taxes and fees" value={formatAmount(liveQuote.tax, liveQuote.currency)} /> : null}
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
                    <dt className="text-xs uppercase tracking-widest text-navy-foreground/60">
                      Total for {paxCount} traveller{paxCount === 1 ? "" : "s"}
                    </dt>
                    <dd className="font-display text-2xl font-semibold text-gold">
                      {formatAmount(liveQuote.total, liveQuote.currency)}
                    </dd>
                  </div>
                </>
              ) : (
              <>
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
              </>
              )}
            </dl>
            {liveQuote ? (
              <div className="p-5 pt-0 text-[11px] text-navy-foreground/60">
                <ServiceFeeNote />
              </div>
            ) : (
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
            )}
          </div>
        </aside>
      </div>

      {step !== 1 ? (
        <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            {liveQuote ? (
              <>
                <p className="text-sm font-bold text-navy">
                  Total: {formatAmount(liveQuote.total, liveQuote.currency)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">incl. taxes &amp; fees</span>
                </p>
                <button
                  onClick={proceedToPayment}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-gold-foreground transition hover:brightness-110 disabled:opacity-60 sm:flex-none"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}{" "}
                  {submitting ? "Opening secure payment…" : "Proceed to Payment"}
                </button>
              </>
            ) : requestFlow ? (
              <>
                <p className="text-sm font-bold text-navy">
                  Fare: {sym}
                  {total.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-muted-foreground">incl. taxes &amp; fees</span>
                </p>
                <button
                  onClick={
                    cardOn && step === 2
                      ? () => {
                          setError("");
                          setStep(3);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      : submitBookingRequest
                  }
                  disabled={submitting || !!priceChange || vault === undefined || (cardOn && step === 3 && !cardReady)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-gold-foreground transition hover:brightness-110 disabled:opacity-60 sm:flex-none"
                >
                  <Lock className="size-4" />{" "}
                  {priceChange ? "Confirm the new price above to continue" : submitting ? "Submitting…" : cardOn ? (step === 2 ? "Continue to Payment" : "Confirm Booking") : "Request This Booking"}
                </button>
              </>
            ) : null}
            {import.meta.env.DEV ? (
              <Link to="/flight/payment-preview" search={search} className="text-xs font-bold text-primary underline">
                Preview card payment page
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The payment page before the card vault is connected, so its layout can be seen. */
function CardFormOff() {
  const box = "mt-1 w-full cursor-not-allowed rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm";
  const label = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground";
  const field = (name: string, placeholder: string, wide = false) => (
    <label key={name} className={`block ${wide ? "col-span-2" : ""}`}>
      <span className={label}>{name} *</span>
      <input disabled placeholder={placeholder} className={box} />
    </label>
  );
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4 sm:col-span-2">
      <p className="flex items-center gap-2 text-sm font-bold text-navy">
        <CreditCard className="size-4 text-gold" aria-hidden="true" /> Card details
      </p>
      <p role="status" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
        Preview only. These fields turn on once the card vault is connected.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {field("Name on Card", "As printed on the card", true)}
        {field("Card Number", "4242 4242 4242 4242", true)}
        {field("Expiry", "MM / YY")}
        {field("CVV", "123")}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-xs uppercase tracking-widest text-navy-foreground/60">{label}</dt>
      <dd className="max-w-[65%] shrink-0 break-words text-right font-semibold">{value}</dd>
    </div>
  );
}
