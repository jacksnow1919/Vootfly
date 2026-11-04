import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminLogout,
  adminSessionStatus,
  chargeOnlineCheckout,
  markBookingPaid,
  createStaff,
  getAdminBookings,
  getBookingPayment,
  getOnlineCheckouts,
  listStaff,
  refundOnlineCheckout,
  releaseOnlineCheckout,
  updateBookingStatus,
  updateStaffRole,
  verifyBooking,
  type AdminBookingRow,
  type AdminCheckoutRow,
  type OperatorRole,
} from "@/lib/admin.functions";
import { FlightApisTab } from "@/components/admin/FlightApisTab";
import { TripDetails } from "@/components/checkout/TripDetails";
import { VaultCard } from "@/components/admin/VaultCard";
import {
  CreditCard,
  LayoutDashboard,
  PlaneTakeoff,
  Ticket,
  Users,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  BadgeCheck,
  LogOut,
  Loader2,
  Lock,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mission Control CRM — Verification & Staff | VootFly" },
      {
        name: "description",
        content:
          "Role-based Mission Control CRM with mandatory booking verification, conditional fund capture, staff management and an audited PCI card vault.",
      },
      { property: "og:title", content: "Mission Control CRM — VootFly" },
      {
        property: "og:description",
        content: "Verification-first booking queue, RBAC staff management and audited card reveals.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const ROLE_LABEL: Record<OperatorRole, string> = {
  agent: "Agent — masked cards, no capture",
  manager: "Manager",
  superadmin: "Superadmin",
};

// Phase tracker 4.3 (28 Sep 2026): VootFly's real stages. A request is
// received, an advisor confirms it with the traveller, payment is arranged,
// then the ticket is issued. "confirmed" and "paid" were added to the
// booking_status type; "Pending Ticketing" was a leftover template label.
const STATUS_OPTIONS = [
  { value: "pending", label: "Received" },
  { value: "confirmed", label: "Confirmed with traveller" },
  { value: "paid", label: "Paid" },
  { value: "issued", label: "Ticketed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const isVerified = (b: AdminBookingRow) => b.verification_status === "verified";

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof DollarSign;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span className="grid size-8 place-items-center rounded-lg bg-navy text-navy-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-navy">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-navy">{value || "—"}</span>
    </div>
  );
}

function VerificationBadge({ booking }: { booking: AdminBookingRow }) {
  return isVerified(booking) ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      <BadgeCheck className="size-3.5" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
      <ShieldAlert className="size-3.5" /> Pending Verification
    </span>
  );
}

/* ------------------------------ details panel ----------------------------- */

/** Shows nothing for a booking request, which has no card payment behind it. */
function PaymentSummary({ bookingId }: { bookingId: string }) {
  const fetchPayment = useServerFn(getBookingPayment);
  const payment = useQuery({ queryKey: ["admin-booking-payment", bookingId], queryFn: () => fetchPayment({ data: { id: bookingId } }) });
  if (payment.isError) {
    return <p className="mt-5 text-xs font-semibold text-destructive">Could not load the card payment for this booking.</p>;
  }
  const p = payment.data;
  if (!p) return null;
  return (
    <section className="mt-5">
      <h3 className="font-display text-sm font-semibold text-navy">Payment summary</h3>
      <div className="mt-1.5 space-y-1.5 rounded-xl border border-border p-3">
        <CardSummary checkout={p} />
        <Row label="Amount" value={`${p.currency} ${p.amount}`} />
        <Row label="Stripe status now" value={p.gatewayStatus ?? "Could not check Stripe"} />
        {p.holdExpiresAt ? <Row label="Charge before" value={new Date(p.holdExpiresAt).toLocaleString()} /> : null}
        {p.holdExpiresAt ? <p className="text-xs text-muted-foreground">Charge or release this hold in the Online payments tab.</p> : null}
        <Row label="VootFly record" value={p.recordedStatus} />
        <div className="flex flex-wrap gap-3 pt-1 text-xs font-bold text-primary">
          {p.receiptUrl ? (
            <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="underline">
              View receipt
            </a>
          ) : null}
          {p.gatewayUrl ? (
            <a href={p.gatewayUrl} target="_blank" rel="noreferrer" className="underline">
              Open in Stripe
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DetailsPanel({
  booking,
  role,
  onClose,
}: {
  booking: AdminBookingRow;
  role: OperatorRole;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyBooking);
  const markPaid = useServerFn(markBookingPaid);
  const setStatus = useServerFn(updateBookingStatus);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const privileged = role === "manager" || role === "superadmin";
  const verified = isVerified(booking);
  const captured = booking.capture_status === "captured";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });

  const verifyMutation = useMutation({
    mutationFn: () => verify({ data: { id: booking.id, notes: notes.trim() } }),
    onSuccess: (res) => {
      setFeedback(res.ok ? "Booking marked as verified." : "Not permitted.");
      void invalidate();
    },
    onError: (e) => {
      console.error("[verify] failed", e);
      setFeedback("Verification failed.");
    },
  });

  const captureMutation = useMutation({
    mutationFn: () => markPaid({ data: { id: booking.id } }),
    onSuccess: (res) => {
      setFeedback(res.ok ? "Marked as paid." : `Could not mark as paid (${res.reason}).`);
      void invalidate();
    },
    onError: (e) => {
      console.error("[capture] failed", e);
      setFeedback("Could not mark as paid.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      setStatus({ data: { id: booking.id, status: status as "pending" } }),
    onSuccess: () => void invalidate(),
  });

  const address = [
    booking.billing_address,
    booking.billing_city,
    booking.billing_postal_code,
    booking.billing_country,
  ]
    .filter(Boolean)
    .join(", ");
  const total = Number(booking.total_price);
  const pax = booking.passenger;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-navy/60" />
      <div className="relative h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-lux">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
              Customer profile &amp; trip
            </p>
            <h2 className="font-display text-xl font-semibold text-navy">
              {booking.pnr ?? "No PNR"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <VerificationBadge booking={booking} />
          <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase text-muted-foreground">
            {(booking.source || "direct").toUpperCase()}
          </span>
          <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase text-muted-foreground">
            {captured ? "Paid" : "Awaiting payment"}
          </span>
        </div>

        <section className="mt-5">
          <h3 className="font-display text-sm font-semibold text-navy">Passenger information</h3>
          <div className="mt-1.5">
            <Row
              label="Full name"
              value={
                pax
                  ? `${pax.title ?? ""} ${pax.first_name} ${pax.last_name}`.trim()
                  : (booking.lead_name ?? "")
              }
            />
            <Row label="Date of birth" value={pax?.dob ?? ""} />
            <Row label="Gender" value={pax?.gender ?? ""} />
            <Row label="Passport / ID" value={pax?.passport_no ?? ""} />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="font-display text-sm font-semibold text-navy">Contact information</h3>
          <div className="mt-1.5">
            <Row label="Email" value={booking.guest_email ?? ""} />
            <Row label="Phone" value={booking.guest_phone ?? ""} />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="font-display text-sm font-semibold text-navy">Flight details</h3>
          <div className="mt-1.5">
            <Row label="PNR" value={booking.pnr ?? ""} />
            <Row label="Route" value={`${booking.origin} → ${booking.destination}`} />
            <Row label="Airline" value={booking.airline ?? ""} />
            <Row label="Cabin" value={booking.cabin_class ?? ""} />
            <Row label="Travel date" value={booking.depart_date ?? ""} />
            <Row label="Return" value={booking.return_date ?? ""} />
            <Row label="Total price" value={`${booking.currency} ${total.toLocaleString()}`} />
            <Row label="Booked on" value={new Date(booking.created_at).toLocaleString()} />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="font-display text-sm font-semibold text-navy">Billing details</h3>
          <div className="mt-1.5">
            <Row label="Billing address" value={address} />
            <Row label="Zip / postal code" value={booking.billing_postal_code ?? ""} />
            <Row label="Promo code" value={booking.promo_code ?? ""} />
          </div>
        </section>

        <VaultCard bookingId={booking.id} canReveal={privileged} />
        <PaymentSummary bookingId={booking.id} />

        <section className="mt-5">
          <h3 className="font-display text-sm font-semibold text-navy">Verification gate</h3>
          {verified ? (
            <div className="mt-1.5">
              <Row label="Verified by" value={booking.verified_by_name ?? ""} />
              <Row
                label="Verified at"
                value={booking.verified_at ? new Date(booking.verified_at).toLocaleString() : ""}
              />
              <Row label="Notes" value={booking.verification_notes ?? ""} />
            </div>
          ) : privileged ? (
            <div className="mt-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Voice Auth Code / Bank Notes (required)"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <button
                disabled={verifyMutation.isPending || notes.trim().length < 4}
                onClick={() => verifyMutation.mutate()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-navy-foreground disabled:opacity-50"
              >
                <ShieldCheck className="size-4" /> Mark Booking as Verified
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Only a Manager or Superadmin can verify this booking.
            </p>
          )}
        </section>

        <section className="mt-5">
          <h3 className="font-display text-sm font-semibold text-navy">Payment capture</h3>
          {privileged ? (
            verified ? (
              <button
                disabled={captureMutation.isPending || captured}
                onClick={() => captureMutation.mutate()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-gold-foreground disabled:opacity-50"
              >
                <DollarSign className="size-4" />
                {captured ? "Already marked as paid" : "Mark as Paid"}
              </button>
            ) : (
              <button
                disabled
                title="Booking must be verified first"
                className="mt-2 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-bold text-muted-foreground"
              >
                <Lock className="size-4" /> Mark as Paid
              </button>
            )
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Marking a booking as paid is restricted to Manager and Superadmin roles.
            </p>
          )}
          {captured ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Marked as paid {booking.captured_at ? new Date(booking.captured_at).toLocaleString() : ""}
            </p>
          ) : null}
        </section>

        {privileged ? (
          <section className="mt-5">
            <h3 className="font-display text-sm font-semibold text-navy">Ticketing status</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  disabled={statusMutation.isPending || booking.status === s.value}
                  onClick={() => statusMutation.mutate(s.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-70 ${
                    booking.status === s.value
                      ? "bg-navy text-navy-foreground"
                      : "border border-border bg-background text-navy hover:border-gold"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5">
          <h3 className="font-display text-sm font-semibold text-navy">Audit log</h3>
          <ul className="mt-2 space-y-2">
            {booking.audit.length === 0 ? (
              <li className="text-xs text-muted-foreground">No sensitive actions recorded yet.</li>
            ) : (
              booking.audit.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-3 text-xs">
                  <p className="font-bold text-navy">{a.action.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">
                    {a.operator_name ?? "Operator"} ({a.operator_role ?? "—"}) ·{" "}
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                  {a.remarks ? <p className="mt-1 text-navy">{a.remarks}</p> : null}
                </li>
              ))
            )}
          </ul>
        </section>

        {feedback ? (
          <p className="mt-4 text-sm font-semibold text-navy">{feedback}</p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------- staff tab ------------------------------- */

function StaffTab() {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const addStaff = useServerFn(createStaff);
  const setRole = useServerFn(updateStaffRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRoleValue] = useState<OperatorRole>("agent");
  const [message, setMessage] = useState<string | null>(null);

  const staff = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => fetchStaff(),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => addStaff({ data: { fullName, email, password, role } }),
    onSuccess: (res) => {
      if (res.ok) {
        setMessage("Account created.");
        setFullName("");
        setEmail("");
        setPassword("");
        setRoleValue("agent");
        void queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      } else {
        setMessage(
          res.reason === "duplicate"
            ? "That work email already has an account."
            : "You are not permitted to create staff.",
        );
      }
    },
    onError: (e) => {
      console.error("[createStaff] failed", e);
      setMessage("Could not create the account. Check the fields and try again.");
    },
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { id: string; role: OperatorRole }) => setRole({ data: vars }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-staff"] }),
  });

  if (staff.isPending) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-gold" />
      </div>
    );
  }

  if (!staff.data || staff.data.authorized === false) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
        Staff management is restricted to Superadmin accounts.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-navy">Staff &amp; roles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-secondary text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {staff.data.staff.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold text-navy">{s.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.work_email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={s.role}
                      onChange={(e) =>
                        roleMutation.mutate({ id: s.id, role: e.target.value as OperatorRole })
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold text-navy outline-none focus:border-gold"
                    >
                      {(Object.keys(ROLE_LABEL) as OperatorRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-display text-base font-semibold text-navy">Add staff member</h2>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-gold"
            />
          </label>
          <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Work email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-gold"
            />
          </label>
          <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Temporary password (min 10 characters)
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-gold"
            />
          </label>
          <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Role
            <select
              value={role}
              onChange={(e) => setRoleValue(e.target.value as OperatorRole)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-gold"
            >
              {(Object.keys(ROLE_LABEL) as OperatorRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={createMutation.isPending || password.length < 10 || !email || !fullName}
            onClick={() => createMutation.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-gold-foreground disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Create
            account
          </button>
          {message ? <p className="text-xs font-semibold text-navy">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------- dashboard ------------------------------- */

function CardSummary({
  checkout: c,
}: {
  checkout: Pick<AdminCheckoutRow, "card_brand" | "card_last4" | "card_exp_month" | "card_exp_year" | "cardholder_name">;
}) {
  if (!c.card_last4) return null;
  const expiry = c.card_exp_month && c.card_exp_year ? `${String(c.card_exp_month).padStart(2, "0")}/${c.card_exp_year}` : null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-navy">
      <CreditCard className="size-3.5 text-gold" aria-hidden="true" />
      <span className="capitalize">{c.card_brand ?? "Card"}</span>
      <span>•••• •••• •••• {c.card_last4}</span>
      {expiry ? <span className="font-normal text-muted-foreground">Expires {expiry}</span> : null}
      {c.cardholder_name ? <span className="font-normal text-muted-foreground">{c.cardholder_name}</span> : null}
    </p>
  );
}

/** The team's ticketing queue: everything needed to issue the ticket, then charge or release. */
function HoldAction({ checkout: c, canAct }: { checkout: AdminCheckoutRow; canAct: boolean }) {
  const queryClient = useQueryClient();
  const charge = useServerFn(chargeOnlineCheckout);
  const release = useServerFn(releaseOnlineCheckout);
  const [pnr, setPnr] = useState("");
  const [tickets, setTickets] = useState("");
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<"charge" | "release" | null>(null);
  const refresh = () => {
    setAsking(null);
    void queryClient.invalidateQueries({ queryKey: ["admin-online-checkouts"] });
  };
  const chargeMutation = useMutation({
    mutationFn: () =>
      charge({
        data: {
          id: c.id,
          pnr: pnr.trim(),
          ticketNumbers: tickets.split(",").map((t) => t.trim()).filter(Boolean),
        },
      }),
    onSettled: refresh,
  });
  const releaseMutation = useMutation({ mutationFn: () => release({ data: { id: c.id, reason: reason.trim() } }), onSettled: refresh });
  const busy = chargeMutation.isPending || releaseMutation.isPending;
  const failed =
    chargeMutation.isError || releaseMutation.isError
      ? "That didn't go through. Check this payment in Stripe before trying again."
      : chargeMutation.data && !chargeMutation.data.ok
        ? chargeMutation.data.message
        : releaseMutation.data && !releaseMutation.data.ok
          ? releaseMutation.data.message
          : "";
  const expires = c.hold_expires_at ? new Date(c.hold_expires_at) : null;
  const soon = expires ? expires.getTime() - Date.now() < 48 * 3_600_000 : false;
  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-gold";

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-border bg-background p-3">
      {expires ? (
        <p className={`text-xs font-bold ${soon ? "text-destructive" : "text-navy"}`}>Charge before {expires.toLocaleString()}, or the hold ends.</p>
      ) : (
        <p className="text-xs font-bold text-navy">Stripe gave no end date. Holds usually last about 7 days.</p>
      )}
      <TripDetails trip={c.trip} />
      <ul className="space-y-1 text-xs text-navy">
        {c.travellers.map((t) => (
          <li key={`${t.firstName} ${t.lastName} ${t.passportNo ?? ""}`}>
            <span className="font-semibold">
              {t.title} {t.firstName} {t.lastName}
            </span>
            {" · "}Born {t.bornOn ?? "not given"} · Passport {t.passportNo ?? "not given"}, expires {t.passportExpiry ?? "not given"} · {t.nationality ?? "Nationality not given"}
          </li>
        ))}
      </ul>
      {canAct ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label="Airline PNR" value={pnr} onChange={(e) => setPnr(e.target.value)} placeholder="Airline PNR (required to charge)" className={field} />
            <input aria-label="E-ticket numbers" value={tickets} onChange={(e) => setTickets(e.target.value)} placeholder="E-ticket numbers, separated by commas" className={field} />
          </div>
          {asking === "charge" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
              <p className="text-xs font-semibold text-navy">
                Charge {c.currency} {c.amount} now, PNR {pnr.trim().toUpperCase()}? Only do this after the ticket is issued.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => chargeMutation.mutate()} className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-gold-foreground disabled:opacity-60">
                  {chargeMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null} Yes, charge
                </button>
                <button type="button" disabled={busy} onClick={() => setAsking(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy">Not yet</button>
              </div>
            </div>
          ) : asking === "release" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
              <input aria-label="Reason for releasing" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why can't this be ticketed? (saved in the log)" className={field} />
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy || reason.trim().length < 4} onClick={() => releaseMutation.mutate()} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  {releaseMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null} Yes, release hold
                </button>
                <button type="button" disabled={busy} onClick={() => setAsking(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy">Keep hold</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!/^[A-Za-z0-9]{5,8}$/.test(pnr.trim())} onClick={() => setAsking("charge")} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-gold-foreground disabled:opacity-50">
                Charge card
              </button>
              <button type="button" onClick={() => setAsking("release")} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy hover:bg-secondary">
                Release hold
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only a Manager or Superadmin can charge this card or release the hold.</p>
      )}
      {failed ? <p className="text-xs font-semibold text-destructive">{failed}</p> : null}
    </div>
  );
}

/** Asks first, because the refund moves real money and does not cancel the airline ticket. */
function RefundAction({ checkout: c }: { checkout: AdminCheckoutRow }) {
  const queryClient = useQueryClient();
  const refund = useServerFn(refundOnlineCheckout);
  const [asking, setAsking] = useState(false);
  const mutation = useMutation({
    mutationFn: () => refund({ data: { id: c.id } }),
    onSettled: () => {
      setAsking(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-online-checkouts"] });
    },
  });
  const failed = mutation.isError ? "Could not refund this payment. Check it in Stripe before trying again." : mutation.data && !mutation.data.ok ? mutation.data.message : "";

  return (
    <div className="pt-1">
      {asking ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-semibold text-navy">
            Refund {c.currency} {c.amount} to this card? This does not cancel the airline ticket. Cancel it with the airline first.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null} Yes, refund
            </button>
            <button type="button" disabled={mutation.isPending} onClick={() => setAsking(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy">
              Keep payment
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy hover:bg-secondary">
          Process refund
        </button>
      )}
      {failed ? <p className="mt-1 text-xs font-semibold text-destructive">{failed}</p> : null}
    </div>
  );
}

function OnlinePaymentsTab() {
  const fetchCheckouts = useServerFn(getOnlineCheckouts);
  const checkouts = useQuery({ queryKey: ["admin-online-checkouts"], queryFn: () => fetchCheckouts() });

  if (checkouts.isLoading) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }
  if (checkouts.isError) {
    return <p className="p-4 text-sm font-semibold text-destructive">Could not load online payments.</p>;
  }

  // Anything staff must act on comes first.
  const urgency = (status: string) => (status === "manual_review" ? 2 : status === "awaiting_ticket" ? 1 : 0);
  const rows = [...(checkouts.data?.rows ?? [])].sort((a, z) => urgency(z.booking_status) - urgency(a.booking_status));

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-base font-semibold text-navy">Online payments</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cards on hold come first. Issue the ticket, enter the PNR, then charge the card. If it can't be ticketed, release
          the hold. For a manual review, check the payment in Stripe before doing anything.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No online payments yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id} className={`space-y-1 p-4 text-sm ${c.booking_status === "manual_review" ? "bg-gold/10" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold text-navy">{c.reference}</span>
                {c.test_mode ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">TEST</span> : null}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-navy">Booking: {c.booking_status}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-navy">Payment: {c.payment_status}</span>
                <span className="ml-auto font-semibold text-navy">{c.currency} {c.amount}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString()} · {c.lead_name} · {c.email} · {c.phone}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                Checkout {c.id}
                {c.supplier_pnr ? ` · PNR ${c.supplier_pnr}` : ""}
                {` · Fare from ${c.supplier}`}
              </p>
              <CardSummary checkout={c} />
              {c.stripe_payment_intent_id ? (
                <a
                  href={`https://dashboard.stripe.com/${c.test_mode ? "test/" : ""}payments/${c.stripe_payment_intent_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-bold text-primary underline"
                >
                  View payment log in Stripe
                </a>
              ) : null}
              {(c.booking_status === "confirmed" || c.booking_status === "awaiting_ticket") && !c.booking_id && !c.test_mode ? (
                <p className="text-xs font-semibold text-destructive">Not copied to All Bookings. Add it by hand.</p>
              ) : null}
              {c.failure_code ? (
                <p className="break-words text-xs font-semibold text-destructive">
                  {c.failure_code}{c.failure_detail ? `: ${c.failure_detail}` : ""}
                </p>
              ) : null}
              {c.booking_status === "awaiting_ticket" ? <HoldAction checkout={c} canAct={Boolean(checkouts.data?.canManagePayments)} /> : null}
              {checkouts.data?.canManagePayments && c.payment_status === "paid" && c.stripe_payment_intent_id ? <RefundAction checkout={c} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const fetchBookings = useServerFn(getAdminBookings);
  const logout = useServerFn(adminLogout);
  const sessionStatus = useServerFn(adminSessionStatus);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"bookings" | "online" | "apis" | "staff">("bookings");

  const session = useQuery({
    queryKey: ["admin-session"],
    queryFn: () => sessionStatus(),
    retry: false,
    staleTime: 60_000,
  });

  const { data, isError } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => fetchBookings(),
    retry: false,
    enabled: session.data?.admin === true,
  });

  const signedOut =
    session.isError || session.data?.admin === false || isError || data?.authorized === false;

  if (session.isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-secondary/60 px-4">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }

  if (signedOut || !session.data?.role) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-secondary/60 px-4 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold text-navy">Session expired</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Please sign in again to view Mission Control.
          </p>
          <Link
            to="/admin"
            className="mt-4 inline-flex rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground"
          >
            Go to admin sign-in
          </Link>
        </div>
      </div>
    );
  }

  const role = session.data.role;
  const all = data?.rows ?? [];
  const gbv = all.reduce((sum, b) => sum + Number(b.total_price), 0);
  const awaiting = all.filter((b) => !isVerified(b)).length;
  const verified = all.filter(isVerified).length;
  const ticketed = all.filter((b) => b.status === "issued").length;
  const openBooking = all.find((b) => b.id === openId) ?? null;

  return (
    <div className="grid bg-secondary/60 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="bg-navy text-navy-foreground lg:min-h-[100dvh]">
        <div className="px-4 py-5">
          <p className="font-display text-base font-semibold">Mission Control</p>
          <p className="text-[11px] uppercase tracking-widest text-navy-foreground/60">
            {session.data.name} · {role}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-4 lg:flex-col lg:overflow-visible">
          <button
            onClick={() => setTab("bookings")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              tab === "bookings"
                ? "bg-white/15 text-navy-foreground"
                : "text-navy-foreground/80 hover:bg-white/10"
            }`}
          >
            <LayoutDashboard className="size-4" /> All Bookings &amp; PNR Queue
          </button>
          <button
            onClick={() => setTab("online")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              tab === "online"
                ? "bg-white/15 text-navy-foreground"
                : "text-navy-foreground/80 hover:bg-white/10"
            }`}
          >
            <CreditCard className="size-4" /> Online payments
          </button>
          <button
            onClick={() => setTab("apis")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              tab === "apis"
                ? "bg-white/15 text-navy-foreground"
                : "text-navy-foreground/80 hover:bg-white/10"
            }`}
          >
            <PlaneTakeoff className="size-4" /> Flight APIs
          </button>
          <button
            onClick={() => setTab("staff")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              tab === "staff"
                ? "bg-white/15 text-navy-foreground"
                : "text-navy-foreground/80 hover:bg-white/10"
            }`}
          >
            <Users className="size-4" /> Staff &amp; roles
          </button>
          <button
            onClick={async () => {
              await logout();
              navigate({ to: "/admin", replace: true });
            }}
            className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-navy-foreground/80 transition hover:bg-white/10"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </nav>
      </aside>

      <div className="min-w-0 px-4 py-6 pb-24 lg:px-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
              Verification-first CRM
            </p>
            <h1 className="font-display text-2xl font-semibold text-navy">Mission Control</h1>
            <p className="text-sm text-muted-foreground">
              Every booking lands pending verification before it can be marked as paid.
            </p>
          </div>
          <Link to="/" className="text-xs font-semibold text-navy underline">
            Back to site
          </Link>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Gross Booking Value"
            value={`$${Math.round(gbv).toLocaleString()}`}
            sub={`${all.length} bookings tracked`}
            icon={DollarSign}
          />
          <Kpi
            label="Awaiting Verification"
            value={String(awaiting)}
            sub="Pending manager review"
            icon={ShieldAlert}
          />
          <Kpi label="Verified" value={String(verified)} sub="Cleared for capture" icon={BadgeCheck} />
          <Kpi label="Ticketed" value={String(ticketed)} sub="Issued PNRs" icon={Ticket} />
        </div>

        {tab === "bookings" ? (
          <section className="mt-6 rounded-2xl border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-semibold text-navy">
                All Bookings &amp; PNR Queue
              </h2>
              <span className="text-xs text-muted-foreground">{all.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-secondary text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">PNR</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Route</th>
                    <th className="px-4 py-2.5 font-semibold">Passenger</th>
                    <th className="px-4 py-2.5 font-semibold">Total</th>
                    <th className="px-4 py-2.5 font-semibold">Verification</th>
                    <th className="px-4 py-2.5 font-semibold">Ticketing</th>
                    <th className="px-4 py-2.5 font-semibold">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {all.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No bookings recorded yet.
                      </td>
                    </tr>
                  ) : (
                    all.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="px-4 py-3 font-semibold text-navy">{b.pnr ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(b.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {b.origin} → {b.destination}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {b.lead_name ?? b.guest_email ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-navy">
                          {b.currency} {Number(b.total_price).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <VerificationBadge booking={b} />
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold capitalize text-navy">
                          {b.status}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setOpenId(b.id)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy transition hover:border-gold"
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : tab === "online" ? (
          <div className="mt-6">
            <OnlinePaymentsTab />
          </div>
        ) : tab === "apis" ? (
          <div className="mt-6">
            <FlightApisTab />
          </div>
        ) : (
          <div className="mt-6">
            <StaffTab />
          </div>
        )}
      </div>

      {openBooking ? (
        <DetailsPanel booking={openBooking} role={role} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}
