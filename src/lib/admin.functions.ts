import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TripSnapshot } from "@/lib/checkout-shared";

export type OperatorRole = "agent" | "manager" | "superadmin";

export type StaffMember = {
  id: string;
  full_name: string;
  work_email: string;
  role: OperatorRole;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  booking_id: string | null;
  operator_name: string | null;
  operator_role: string | null;
  action: string;
  remarks: string | null;
  created_at: string;
};

export type AdminBookingRow = {
  id: string;
  pnr: string | null;
  created_at: string;
  origin: string;
  destination: string;
  airline: string | null;
  cabin_class: string | null;
  depart_date: string | null;
  return_date: string | null;
  total_price: number;
  currency: string;
  status: string;
  source: string;
  utm_source: string | null;
  click_id: string | null;
  promo_code: string | null;
  promo_discount: number;
  lead_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_country: string | null;
  billing_postal_code: string | null;
  verification_status: string;
  verification_notes: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  capture_status: string;
  captured_at: string | null;
  passenger: {
    title: string | null;
    first_name: string;
    last_name: string;
    dob: string | null;
    gender: string | null;
    passport_no: string | null;
  } | null;
  audit: AuditEntry[];
};

export type AdminSessionInfo = {
  admin: boolean;
  name: string;
  email: string;
  role: OperatorRole | null;
};

/* --------------------------------- auth ---------------------------------- */

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().max(160), password: z.string().max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAdminSession } = await import("@/lib/admin-session.server");
    const { hashPassword, verifyPassword } = await import("@/lib/vault-crypto.server");

    const email = data.email.trim().toLowerCase();
    const session = await getAdminSession();

    const { data: operator } = await supabaseAdmin
      .from("admin_operators")
      .select("id, full_name, work_email, role, password_hash")
      .eq("work_email", email)
      .maybeSingle();

    if (operator && (await verifyPassword(data.password, operator.password_hash))) {
      await session.update({
        admin: true,
        operatorId: operator.id,
        name: operator.full_name,
        email: operator.work_email,
        role: operator.role as OperatorRole,
      });
      return { ok: true as const, role: operator.role as OperatorRole };
    }

    // Bootstrap: the configured owner credentials always resolve to a superadmin.
    const rootEmail = process.env["ADMIN_EMAIL"]?.trim().toLowerCase();
    const rootPassword = process.env["ADMIN_PASSWORD"];
    if (rootEmail && rootPassword && email === rootEmail && data.password === rootPassword) {
      let id = operator?.id ?? null;
      if (!id) {
        const { data: created } = await supabaseAdmin
          .from("admin_operators")
          .insert({
            full_name: "Owner",
            work_email: rootEmail,
            role: "superadmin",
            password_hash: await hashPassword(rootPassword),
          })
          .select("id")
          .single();
        id = created?.id ?? null;
      } else {
        await supabaseAdmin
          .from("admin_operators")
          .update({ role: "superadmin", password_hash: await hashPassword(rootPassword) })
          .eq("id", id);
      }
      await session.update({
        admin: true,
        ...(id ? { operatorId: id } : {}),
        name: "Owner",
        email: rootEmail,
        role: "superadmin",
      });
      return { ok: true as const, role: "superadmin" as const };
    }

    return { ok: false as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminSession } = await import("@/lib/admin-session.server");
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const adminSessionStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSessionInfo> => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op) return { admin: false, name: "", email: "", role: null };
    return { admin: true, name: op.name, email: op.email, role: op.role };
  },
);

/* -------------------------------- bookings -------------------------------- */

export type AdminBookingsResult =
  | { authorized: false; role: null; rows: [] }
  | { authorized: true; role: OperatorRole; rows: AdminBookingRow[] };

const BOOKING_COLUMNS =
  "id, pnr, created_at, origin, destination, airline, cabin_class, depart_date, return_date, total_price, currency, status, source, utm_source, click_id, promo_code, promo_discount, lead_name, guest_email, guest_phone, billing_address, billing_city, billing_country, billing_postal_code, verification_status, verification_notes, verified_by_name, verified_at, capture_status, captured_at, passengers(title, first_name, last_name, dob, gender, passport_no), audit_logs(id, booking_id, operator_name, operator_role, action, remarks, created_at)";

export type AdminCheckoutRow = {
  id: string;
  reference: string;
  created_at: string;
  test_mode: boolean;
  payment_status: string;
  booking_status: string;
  amount: string;
  currency: string;
  supplier_pnr: string | null;
  supplier_order_id: string | null;
  stripe_payment_intent_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  cardholder_name: string | null;
  hold_expires_at: string | null;
  supplier: string;
  trip: TripSnapshot;
  /** Full passport details only while the team still has to issue the ticket. */
  travellers: { title: string; firstName: string; lastName: string; bornOn?: string; passportNo?: string; passportExpiry?: string; nationality?: string }[];
  failure_code: string | null;
  failure_detail: string | null;
  booking_id: string | null;
  lead_name: string;
  email: string;
  phone: string;
};

/** Online card checkouts for staff, including any that need a manual check. No passport data. */
export const getOnlineCheckouts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ authorized: boolean; canManagePayments: boolean; rows: AdminCheckoutRow[] }> => {
    const { currentOperator, canCapture } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op) return { authorized: false, canManagePayments: false, rows: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("checkouts")
      .select(
        "id, reference, created_at, test_mode, payment_status, booking_status, amount, currency, supplier_pnr, supplier_order_id, stripe_payment_intent_id, card_brand, card_last4, card_exp_month, card_exp_year, cardholder_name, hold_expires_at, supplier, trip, failure_code, failure_detail, booking_id, travellers, contact",
      )
      .neq("booking_status", "draft")
      .order("created_at", { ascending: false })
      .limit(100);
    // The checkouts table is only created when card payment is set up, so until then there is nothing to list.
    if (error?.code === "PGRST205" || error?.code === "42P01") return { authorized: true, canManagePayments: false, rows: [] };
    if (error) {
      console.error("[getOnlineCheckouts] read failed", error);
      throw new Error("Could not load online payments.");
    }

    const rows = (data ?? []).map(({ travellers, contact, trip, ...row }) => {
      const people = (travellers ?? []) as unknown as AdminCheckoutRow["travellers"];
      const lead = people[0];
      const c = contact as { email?: string; phone?: string } | null;
      return {
        ...row,
        trip: trip as unknown as TripSnapshot,
        travellers: people,
        lead_name: `${lead?.firstName ?? ""} ${lead?.lastName ?? ""}`.trim(),
        email: c?.email ?? "",
        phone: c?.phone ?? "",
      };
    });
    return { authorized: true, canManagePayments: canCapture(op.role), rows };
  },
);

/** The masked card and live gateway status behind one booking. Any signed-in operator can see this. */
export const getBookingPayment = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    if (!(await currentOperator())) return null;
    const { bookingPaymentSummary } = await import("@/lib/checkout.server");
    return bookingPaymentSummary(data.id);
  });

async function logPaymentAction(
  op: { id: string | null; name: string; role: OperatorRole },
  bookingId: string | null,
  action: string,
  remarks: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    booking_id: bookingId,
    operator_id: op.id,
    operator_name: op.name,
    operator_role: op.role,
    action,
    remarks,
  });
  if (error) console.error("[audit] could not log", action, error);
}

/** Takes the money for a held card, once the team has issued the ticket. Managers and above, always logged. */
export const chargeOnlineCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        pnr: z.string().trim().regex(/^[A-Za-z0-9]{5,8}$/),
        ticketNumbers: z.array(z.string().trim().regex(/^[0-9][0-9 -]{9,19}$/)).max(9),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { currentOperator, canCapture } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canCapture(op.role)) return { ok: false as const, message: "Only a manager can charge a card." };

    const { chargeHeldCheckout } = await import("@/lib/checkout.server");
    const pnr = data.pnr.toUpperCase();
    const result = await chargeHeldCheckout(data.id, { pnr, ticketNumbers: data.ticketNumbers, operatorName: op.name });
    if (!result.ok) return result;
    await logPaymentAction(op, result.bookingId, "CARD_CHARGED", `Charged ${result.currency} ${result.amount} on ${result.reference}, PNR ${pnr}`);
    return { ok: true as const };
  });

/** Frees a held card when the ticket can't be issued. Managers and above, always logged. */
export const releaseOnlineCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().min(4).max(300) }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator, canCapture } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canCapture(op.role)) return { ok: false as const, message: "Only a manager can release a hold." };

    const { releaseHeldCheckout } = await import("@/lib/checkout.server");
    const result = await releaseHeldCheckout(data.id, data.reason);
    if (!result.ok) return result;
    await logPaymentAction(op, result.bookingId, "HOLD_RELEASED", `Released ${result.currency} ${result.amount} on ${result.reference}: ${data.reason}`);
    return { ok: true as const };
  });

/** Refunds a charged online payment through Stripe. Managers and above only, and always logged. */
export const refundOnlineCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator, canCapture } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canCapture(op.role)) return { ok: false as const, message: "Only a manager can refund a payment." };

    const { refundCheckout } = await import("@/lib/checkout.server");
    const result = await refundCheckout(data.id);
    if (!result.ok) return result;

    await logPaymentAction(op, result.bookingId, "CARD_REFUNDED", `Refunded ${result.currency} ${result.amount} on ${result.reference}`);
    return { ok: true as const };
  });

export const getAdminBookings = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminBookingsResult> => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op) return { authorized: false, role: null, rows: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("[getAdminBookings] read failed", error);
      throw new Error("Could not load bookings.");
    }

    const rows: AdminBookingRow[] = (data ?? []).map((b) => {
      const row = b as unknown as Record<string, unknown>;
      const pax = (row["passengers"] as AdminBookingRow["passenger"][] | null) ?? [];
      const audit = ((row["audit_logs"] as AuditEntry[] | null) ?? []).sort((a, z) =>
        z.created_at.localeCompare(a.created_at),
      );

      return {
        ...(row as unknown as AdminBookingRow),
        passenger: pax[0] ?? null,
        audit,
      };
    });

    return { authorized: true, role: op.role, rows };
  },
);

/** Manager/Superadmin only: the mandatory verification gate. */
export const verifyBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), notes: z.string().trim().min(4).max(1000) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { currentOperator, canVerify } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canVerify(op.role)) return { ok: false as const, reason: "forbidden" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        verification_status: "verified",
        verification_notes: data.notes,
        verified_by: op.id,
        verified_by_name: op.name,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) {
      console.error("[verifyBooking] update failed", error);
      throw new Error("Could not verify this booking.");
    }

    await supabaseAdmin.from("audit_logs").insert({
      booking_id: data.id,
      operator_id: op.id,
      operator_name: op.name,
      operator_role: op.role,
      action: "BOOKING_VERIFIED",
      remarks: data.notes,
    });
    return { ok: true as const };
  });

/**
 * Manual bookkeeping only. This does NOT charge any card or call any
 * payment processor -- it just records that payment was collected through
 * a separate, real channel (phone, a payment link, etc.) after the team
 * verified the booking. Manager/Superadmin only, and only after
 * verification. Renamed from "captureFunds"/"Auth & Capture" (2026-09-05):
 * that language implied a real payment authorization was being captured
 * here, which was never true -- see bookings.functions.ts for the fix to
 * how bookings are created.
 */
export const markBookingPaid = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator, canCapture } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canCapture(op.role)) return { ok: false as const, reason: "forbidden" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, verification_status, capture_status, total_price, currency, pnr")
      .eq("id", data.id)
      .maybeSingle();

    if (!booking) return { ok: false as const, reason: "not_found" as const };
    if (booking.verification_status !== "verified")
      return { ok: false as const, reason: "not_verified" as const };
    if (booking.capture_status === "captured")
      return { ok: false as const, reason: "already_captured" as const };
    // A card payment is charged from the Online payments tab, which really moves the money.
    const { data: online } = await supabaseAdmin.from("checkouts").select("id").eq("booking_id", data.id).maybeSingle();
    if (online) return { ok: false as const, reason: "use_online_payments_tab" as const };

    // Records that the operator collected payment through a real, separate
    // channel -- this call itself never moves any money.
    const capturedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ capture_status: "captured", captured_at: capturedAt })
      .eq("id", data.id);
    if (error) {
      console.error("[markBookingPaid] update failed", error);
      throw new Error("Could not mark this booking as paid.");
    }

    await supabaseAdmin
      .from("payments")
      .update({ status: "captured" })
      .eq("booking_id", data.id);

    await supabaseAdmin.from("audit_logs").insert({
      booking_id: data.id,
      operator_id: op.id,
      operator_name: op.name,
      operator_role: op.role,
      action: "FUNDS_CAPTURED",
      remarks: `Captured ${booking.currency} ${Number(booking.total_price).toLocaleString()}`,
    });
    return { ok: true as const };
  });

/** Ticketing queue status change. */
export const updateBookingStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "paid", "issued", "cancelled", "refunded"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { currentOperator, canVerify } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canVerify(op.role)) return { ok: false as const, reason: "forbidden" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) {
      console.error("[updateBookingStatus] update failed", error);
      throw new Error("Could not update the booking status.");
    }
    await supabaseAdmin.from("audit_logs").insert({
      booking_id: data.id,
      operator_id: op.id,
      operator_name: op.name,
      operator_role: op.role,
      action: "STATUS_CHANGED",
      remarks: `Status set to ${data.status}`,
    });
    // Once a booking is ticketed or closed nobody needs the card, so it leaves the vault.
    if (data.status === "issued" || data.status === "cancelled" || data.status === "refunded") {
      await forgetCard(data.id, op);
    }
    return { ok: true as const };
  });

/* ------------------------------ card reveal ------------------------------- */

export type BookingCard = {
  brand: string | null;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
  test_mode: boolean;
  deleted_at: string | null;
};

const CARD_TABLE_MISSING = ["PGRST205", "42P01"];

/** Masked details only. Null for a booking with no card, including before the table exists. */
export const getBookingCard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<BookingCard | null> => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    if (!(await currentOperator())) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: card, error } = await supabaseAdmin
      .from("card_tokens")
      .select("brand, last4, exp_month, exp_year, cardholder_name, test_mode, deleted_at")
      .eq("booking_id", data.id)
      .maybeSingle();
    if (error && CARD_TABLE_MISSING.includes(error.code)) return null;
    if (error) {
      console.error("[getBookingCard] read failed", error);
      throw new Error("Could not load the card.");
    }
    return card;
  });

/**
 * Allows one browser session to read one card, and logs who asked and why before it does.
 * If the log can't be written the card stays hidden. Managers and above only.
 */
export const revealBookingCard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), nonce: z.string().min(8).max(200), reason: z.string().trim().min(5).max(300) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { currentOperator, canCapture } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canCapture(op.role)) return { ok: false as const, message: "Only a manager can reveal a card." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: card } = await supabaseAdmin.from("card_tokens").select("token_id, last4, deleted_at").eq("booking_id", data.id).maybeSingle();
    if (!card || card.deleted_at) return { ok: false as const, message: "This card is no longer in the vault." };

    const { error: logError } = await supabaseAdmin.from("audit_logs").insert({
      booking_id: data.id,
      operator_id: op.id,
      operator_name: op.name,
      operator_role: op.role,
      action: "CARD_REVEALED",
      remarks: `Card ending ${card.last4}: ${data.reason}`,
    });
    if (logError) {
      console.error("[revealBookingCard] could not log", logError);
      return { ok: false as const, message: "The reveal couldn't be logged, so the card stays hidden." };
    }

    const { authorizeRevealSession, vaultConfig } = await import("@/lib/card-vault.server");
    if (!vaultConfig() || !(await authorizeRevealSession(data.nonce, card.token_id))) {
      return { ok: false as const, message: "The card vault didn't allow this reveal." };
    }
    return { ok: true as const, tokenId: card.token_id };
  });

async function forgetCard(bookingId: string, op: { id: string | null; name: string; role: OperatorRole }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: card, error } = await supabaseAdmin.from("card_tokens").select("id, token_id, last4, deleted_at").eq("booking_id", bookingId).maybeSingle();
  if (error || !card || card.deleted_at) return;
  const { deleteVaultToken, vaultConfig } = await import("@/lib/card-vault.server");
  if (!vaultConfig() || !(await deleteVaultToken(card.token_id))) return;
  await supabaseAdmin.from("card_tokens").update({ deleted_at: new Date().toISOString() }).eq("id", card.id);
  await supabaseAdmin.from("audit_logs").insert({
    booking_id: bookingId,
    operator_id: op.id,
    operator_name: op.name,
    operator_role: op.role,
    action: "CARD_DELETED",
    remarks: `Card ending ${card.last4} deleted from the vault`,
  });
}

/* -------------------------------- staff ---------------------------------- */

export type StaffResult =
  | { authorized: false; staff: [] }
  | { authorized: true; staff: StaffMember[] };

export const listStaff = createServerFn({ method: "GET" }).handler(
  async (): Promise<StaffResult> => {
    const { currentOperator, canManageStaff } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canManageStaff(op.role)) return { authorized: false, staff: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_operators")
      .select("id, full_name, work_email, role, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[listStaff] read failed", error);
      throw new Error("Could not load staff accounts.");
    }
    return { authorized: true, staff: (data ?? []) as StaffMember[] };
  },
);

export const createStaff = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z
          .string()
          .trim()
          .max(160)
          .regex(/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/, "Enter a valid work email."),
        password: z.string().min(10, "Minimum 10 characters.").max(200),
        role: z.enum(["agent", "manager", "superadmin"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { currentOperator, canManageStaff } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canManageStaff(op.role)) return { ok: false as const, reason: "forbidden" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword } = await import("@/lib/vault-crypto.server");

    const { error } = await supabaseAdmin.from("admin_operators").insert({
      full_name: data.fullName,
      work_email: data.email.toLowerCase(),
      role: data.role,
      password_hash: await hashPassword(data.password),
    });
    if (error) {
      console.error("[createStaff] insert failed", error);
      return { ok: false as const, reason: "duplicate" as const };
    }

    await supabaseAdmin.from("audit_logs").insert({
      operator_id: op.id,
      operator_name: op.name,
      operator_role: op.role,
      action: "STAFF_CREATED",
      remarks: `${data.email.toLowerCase()} as ${data.role}`,
    });
    return { ok: true as const };
  });

export const updateStaffRole = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), role: z.enum(["agent", "manager", "superadmin"]) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { currentOperator, canManageStaff } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canManageStaff(op.role)) return { ok: false as const, reason: "forbidden" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_operators")
      .update({ role: data.role })
      .eq("id", data.id);
    if (error) {
      console.error("[updateStaffRole] update failed", error);
      throw new Error("Could not update this role.");
    }
    await supabaseAdmin.from("audit_logs").insert({
      operator_id: op.id,
      operator_name: op.name,
      operator_role: op.role,
      action: "STAFF_ROLE_CHANGED",
      remarks: `${data.id} -> ${data.role}`,
    });
    return { ok: true as const };
  });
