import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { adminLogin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Mission Control — VootFly" },
      {
        name: "description",
        content:
          "Restricted operator sign-in for the VootFly admin console and EAZAIR affiliate reconciliation.",
      },
      { property: "og:title", content: "Admin Mission Control" },
      { property: "og:description", content: "Operator sign-in for VootFly admin tools." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login({ data: { email, password } });
      if (res.ok) {
        navigate({ to: "/admin/dashboard" });
        return;
      }
      setError("Invalid credentials. Access denied.");
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="grid min-h-[100dvh] place-items-center bg-navy px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card">
        <span className="grid size-11 place-items-center rounded-xl bg-navy text-navy-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold text-navy">Admin Mission Control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restricted access. Operator credentials required.
        </p>

        <form onSubmit={submit} className="mt-5 grid gap-3">
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@email.com"
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-gold"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-gold"
            />
          </label>
          <button
            disabled={busy}
            className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground disabled:opacity-60"
          >
            {busy ? "Checking…" : "Enter console"}
          </button>

        </form>

        {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
