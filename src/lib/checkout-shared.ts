/** Types and display helpers shared by the checkout pages and the checkout server code. */
import { currencySymbol } from "./flight-search-params";
import type { TripSnapshot } from "./duffel.server";

export type { TripSnapshot, TripSlice, TripCondition } from "./duffel.server";

/** Lets a cancelled payment return to the same fare with what the traveller typed. Session only. */
export const CHECKOUT_RETURN_KEY = "vf:checkout-return";
export const CHECKOUT_DRAFT_KEY = "vf:checkout-draft";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded";
export type BookingStatus =
  | "draft"
  | "awaiting_payment"
  | "payment_confirmed"
  | "booking_in_progress"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "manual_review";

/** The fare as the airline's offer states it right now. Never contains passenger ids or keys. */
export type PublicQuote = {
  total: string;
  currency: string;
  base: string | null;
  tax: string | null;
  trip: TripSnapshot;
};

export type QuoteResult =
  | { status: "ok"; quote: PublicQuote }
  | { status: "payments_off" | "unavailable" | "check_failed" };

export type StartCheckoutResult =
  | { status: "ok"; checkoutId: string }
  | { status: "price_changed"; quote: PublicQuote }
  | { status: "invalid"; message: string }
  | { status: "payments_off" | "unavailable" | "check_failed" | "failed" };

/** What the customer's browser may see of a checkout. No passport data, no secret keys. */
export type CheckoutView = {
  id: string;
  reference: string;
  /** Stripe test key: no real money moves. */
  testMode: boolean;
  /** Stripe test key with live Duffel fares: the card step can be tried, but no ticket can be booked. */
  noTicketInThisMode: boolean;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  currency: string;
  amount: string;
  baseAmount: string | null;
  taxAmount: string | null;
  trip: TripSnapshot;
  travellerNames: string[];
  email: string;
  phone: string;
  supplierPnr: string | null;
  ticketNumbers: string[];
  paymentRef: string | null;
  /** Message to show the customer about the last failed attempt or booking problem. */
  message: string | null;
  /** Only while the customer can still pay. */
  clientSecret: string | null;
  publishableKey: string | null;
  /** Stripe holds the card amount and the server has not finished the booking yet. */
  paymentAuthorised: boolean;
};

export function formatAmount(amount: string | number, currency: string): string {
  const value = Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currencySymbol(currency)}${value}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Airline times are local to the airport ("2026-12-10T18:25:00"), so they are read as written. */
export function formatStamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const hour = Number(m[4]);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${((hour + 11) % 12) + 1}:${m[5]} ${hour < 12 ? "AM" : "PM"}`;
}
