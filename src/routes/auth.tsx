import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, Card, Field } from "@/components/site/ui";

/* Google sign-in went through Lovable's service until the move to VootFly's own Supabase (Nov 2026).
   Turn this on after adding a Google OAuth client under Authentication > Providers in Supabase. */
const GOOGLE_SIGN_IN_ENABLED = false;

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string | undefined } => {
    const raw = typeof search["next"] === "string" ? search["next"] : "";
    return { next: raw.startsWith("/") && !raw.startsWith("//") ? raw : "" };
  },
  head: () => ({
    meta: [
      { title: "Sign In | VootFly" },
      {
        name: "description",
        content:
          "Sign in to manage trips, wallet credits, loyalty status and exclusive deals on VootFly.",
      },
      { property: "og:title", content: "Sign in to VootFly" },
      { property: "og:description", content: "Access My Trips, wallet credits and loyalty perks." },
    ],
  }),
  component: AuthPage,
});

const ADMIN_EMAIL = "rjvtravels8@gmail.com";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const afterAuth = () => {
    if (next) void navigate({ to: next });
    else void navigate({ to: "/dashboard" });
  };
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      setMsg(error ? error.message : "Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else if (email.trim().toLowerCase() === ADMIN_EMAIL) navigate({ to: "/admin" });
      else afterAuth();
    }
    setBusy(false);
  }

  async function google() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setMsg("Google sign-in failed. Please try again.");
  }

  return (
    <PageShell
      eyebrow="Members"
      title={mode === "signin" ? "Welcome back" : "Create your account"}
      subtitle="One account for My Trips, wallet credits, loyalty status and exclusive deals."
    >
      <div className="mx-auto max-w-md">
        <Card>
          <div className="mb-4 inline-flex rounded-full bg-secondary p-1 text-xs font-semibold">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-1.5 ${
                  mode === m ? "bg-navy text-navy-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="grid gap-3">
            {mode === "signup" ? (
              <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Alex Morgan" />
            ) : null}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            <button
              disabled={busy}
              className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground disabled:opacity-60"
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {GOOGLE_SIGN_IN_ENABLED ? (
            <button
              onClick={google}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-bold text-navy"
            >
              Continue with Google
            </button>
          ) : null}

          {msg ? <p className="mt-3 text-sm text-muted-foreground">{msg}</p> : null}
        </Card>
      </div>
    </PageShell>
  );
}
