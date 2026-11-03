import { useSession } from "@tanstack/react-start/server";

export type OperatorRole = "agent" | "manager" | "superadmin";

export type AdminSession = {
  admin?: boolean;
  operatorId?: string;
  name?: string;
  email?: string;
  role?: OperatorRole;
};

export function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "bcd-admin",
    maxAge: 60 * 60 * 8,
    // The preview renders the app in a cross-site iframe, where SameSite=Lax
    // cookies are never sent back. None+Secure+Partitioned keeps the session.
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      partitioned: true,
      path: "/",
    },
  };
}

export const getAdminSession = () => useSession<AdminSession>(sessionConfig());

/** Returns the signed-in operator or null. Never trusts client-supplied roles. */
export async function currentOperator() {
  const session = await getAdminSession();
  const d = session.data;
  if (d.admin !== true || !d.role) return null;
  return {
    id: d.operatorId ?? null,
    name: d.name ?? "Operator",
    email: d.email ?? "",
    role: d.role as OperatorRole,
  };
}

export const canVerify = (role: OperatorRole) => role === "manager" || role === "superadmin";
export const canCapture = (role: OperatorRole) => role === "manager" || role === "superadmin";
export const canManageStaff = (role: OperatorRole) => role === "superadmin";
