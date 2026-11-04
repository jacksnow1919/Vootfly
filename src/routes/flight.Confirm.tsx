import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Phone, Mail, MapPin, Plane } from "lucide-react";
import { parseFlightSearch, currencySymbol } from "@/lib/flight-search-params";
import { readBookingLocal, type BookingRecord } from "@/lib/booking-store";

export const Route = createFileRoute("/flight/Confirm")({
  validateSearch: parseFlightSearch,
  head: () => ({
    meta: [
      { title: "Booking Request Received | VootFly" },
      {
        name: "description",
        content:
          "Your booking request has been received. Review your reference, flight details and price summary while our team confirms availability.",
      },
      { property: "og:title", content: "Booking Request Received — VootFly" },
      {
        property: "og:description",
        content: "Booking request received, pending confirmation.",
      },
    ],
  }),
  component: ConfirmPage,
});

const ADDRESS = "16007 Merrill Avenue, Apartment 52, Fontana, California 92335";
const PHONE = "+1-800-773-6613";
const EMAIL = "info@vootfly.com";

function ConfirmPage() {
  const s = Route.useSearch();
  const sym = currencySymbol(s.currency);
  const [record, setRecord] = useState<BookingRecord | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setRecord(readBookingLocal());
    setChecked(true);
  }, []);

  // Without a saved request there is nothing to show. This page used to invent a booking
  // id and default flight here, so opening the URL directly looked like a real request.
  if (!record) {
    return (
      <div className="grid min-h-[70dvh] place-items-center bg-secondary/40 px-4 text-center">
        {checked ? (
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy">We couldn't find a booking request</h1>
            <p className="mt-2 text-sm text-muted-foreground">If you need help with a booking, please call {PHONE}.</p>
            <Link to="/" className="mt-4 inline-block rounded-xl bg-navy px-5 py-3 text-sm font-bold text-navy-foreground">
              Back to home
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  const bookingId = record.bookingId;
  const bookingDate = record.bookingDate;
  const fullName = `${record.title} ${record.firstName} ${record.lastName}`.trim();
  const email = record.email;
  const phone = record.phone;
  const billing = [record.address, record.city, record.postalCode, record.country].filter(Boolean).join(", ");
  const passengers = record.passengers;
  const grandTotal = record.total;
  const perPerson = grandTotal / Math.max(1, passengers);

  return (
    <div className="min-h-[100dvh] bg-secondary/40 pb-24">
      {/* Dark green header bar */}
      <div className="bg-[#1B5E20] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[11px] font-semibold sm:text-xs">
          <span className="font-display text-sm font-semibold">VootFly</span>
          <span className="opacity-60">|</span>
          <span className="inline-flex items-center gap-1">
            Booking Request Received <Check className="size-3.5" />
          </span>
          <span className="opacity-60">|</span>
          <a href={`tel:${PHONE}`} className="inline-flex items-center gap-1">
            <Phone className="size-3.5" /> {PHONE}
          </a>
          <span className="opacity-60">|</span>
          <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-1">
            <Mail className="size-3.5" /> {EMAIL}
          </a>
          <span className="opacity-60">|</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {ADDRESS}
          </span>
        </div>
      </div>

      {/* Green banner */}
      <div className="bg-[#2E7D32] text-white">
        <div className="mx-auto max-w-4xl px-4 py-8 text-center sm:py-12">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#43A047] ring-4 ring-white/30">
            <Check className="size-9 text-white" strokeWidth={3} />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold sm:text-4xl">
            Booking request received
          </h1>
          <p className="mt-4 text-sm font-semibold sm:text-base">Dear, {fullName}</p>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-white/90">
            We've received your booking request. One of our team members will confirm
            availability and contact you{" "}
            {record.cardOnFile ? "before your card is charged" : "to arrange payment"}, at {PHONE} or by email at {EMAIL}.
            Please find the details of your request below (this is not a confirmed booking or a
            ticket).
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-navy">Contact Information</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Line label="Email ID" value={email} />
              <Line label="Phone Number" value={phone} />
              <Line label="Address" value={billing} />
            </dl>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-navy">Booking Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Line label="Booking Id #" value={bookingId} />
              <Line label="Booking Date" value={bookingDate} />
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-navy">
                    Pending confirmation
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Segment
            kind="Departure"
            airline={s.airline}
            flightNo={s.flightNo}
            from={s.origin}
            to={s.destination}
            date={s.departDate}
            cabin={s.cabin}
          />
          {s.returnDate ? (
            <Segment
              kind="Return"
              airline={s.airline}
              from={s.destination}
              to={s.origin}
              date={s.returnDate}
              cabin={s.cabin}
            />
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold text-navy">Price Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Line label="Passengers" value={`${passengers} Adult${passengers > 1 ? "s" : ""}`} />
            <Line label="Cabin" value={s.cabin} />
            {s.returnDate ? <Line label="Return" value={s.returnDate} /> : null}
            <Line
              label="Fare per passenger"
              value={`${sym}${perPerson.toLocaleString()}`}
            />
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <dt className="font-semibold text-navy">Total price (incl. taxes &amp; fees)</dt>
              <dd className="font-display text-xl font-semibold text-gold">
                {sym}
                {grandTotal.toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-navy px-5 py-3 text-sm font-bold text-navy-foreground"
          >
            Back to home
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-bold text-navy"
          >
            Print booking
          </button>
        </div>
      </div>
    </div>
  );
}

function Segment({
  kind,
  airline,
  flightNo,
  from,
  to,
  date,
  cabin,
}: {
  kind: string;
  airline: string;
  flightNo?: string;
  from: string;
  to: string;
  date: string;
  cabin: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {kind} flight
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy text-navy-foreground">
          <Plane className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-navy">{airline}</p>
          {flightNo ? <p className="text-xs text-muted-foreground">Flight {flightNo}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="font-display text-2xl font-semibold text-navy">{from}</span>
        <Plane className="size-4 text-mutedblue" />
        <span className="font-display text-2xl font-semibold text-navy">{to}</span>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Line label="Date" value={date} />
        <Line label="Cabin" value={cabin} />
      </dl>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-navy">{value}</dd>
    </div>
  );
}
