import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ITextElement } from "@basis-theory/web-elements";
import { CreditCard, Eye, Loader2 } from "lucide-react";
import { getBookingCard, revealBookingCard } from "@/lib/admin.functions";
import { getCardVaultConfig } from "@/lib/card-vault.functions";

const SHOW_FOR_MS = 60_000;

/**
 * Masked by default. A manager can reveal the number with a logged reason: it then shows in
 * Basis Theory's own fields for one minute, so it never passes through VootFly's code.
 */
export function VaultCard({ bookingId, canReveal }: { bookingId: string; canReveal: boolean }) {
  const queryClient = useQueryClient();
  const fetchCard = useServerFn(getBookingCard);
  const authorize = useServerFn(revealBookingCard);
  const fetchConfig = useServerFn(getCardVaultConfig);
  const card = useQuery({ queryKey: ["admin-booking-card", bookingId], queryFn: () => fetchCard({ data: { id: bookingId } }) });
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<"idle" | "asking" | "working" | "shown">("idle");
  const [noCvc, setNoCvc] = useState(false);
  const [error, setError] = useState("");
  const shown = useRef<ITextElement[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    for (const element of shown.current) element.unmount();
    shown.current = [];
    setPhase("idle");
    setReason("");
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      for (const element of shown.current) element.unmount();
    },
    [],
  );

  const reveal = async () => {
    setError("");
    setPhase("working");
    try {
      const config = await fetchConfig();
      if (!config) throw new Error("The card vault isn't connected.");
      const { basistheory } = await import("@basis-theory/web-elements");
      const bt = await basistheory(config.publicKey, { environment: config.environment === "production" ? "production" : "test" });
      if (!bt) throw new Error("The card vault didn't load.");
      const session = await bt.sessions.create();
      const result = await authorize({ data: { id: bookingId, nonce: session.nonce, reason: reason.trim() } });
      if (!result.ok) throw new Error(result.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-booking-card", bookingId] });
      const token = await bt.tokens.retrieve(result.tokenId, { apiKey: session.sessionKey });
      setNoCvc(!token.data?.cvc);
      setPhase("shown");
      // The frames need their boxes on the page before they can mount.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const number = bt.createElement("text", { targetId: "vault-reveal-number", readOnly: true, enableCopy: true, style: { base: { color: "#102F63", fontSize: "14px" } } });
      await number.mount("#vault-reveal-number");
      number.setValue(token.data.number);
      shown.current = [number];
      if (token.data?.cvc) {
        const cvc = bt.createElement("text", { targetId: "vault-reveal-cvc", readOnly: true, style: { base: { color: "#102F63", fontSize: "14px" } } });
        await cvc.mount("#vault-reveal-cvc");
        cvc.setValue(token.data.cvc);
        shown.current.push(cvc);
      }
      timer.current = setTimeout(hide, SHOW_FOR_MS);
    } catch (e) {
      console.error("[vault] reveal failed", e instanceof Error ? e.message : "unknown error");
      setError(e instanceof Error ? e.message : "Could not reveal this card.");
      setPhase("asking");
    }
  };

  if (card.isError) return <p className="mt-5 text-xs font-semibold text-destructive">Could not load the card for this booking.</p>;
  const c = card.data;
  if (!c) return null;
  const expiry = c.exp_month && c.exp_year ? `${String(c.exp_month).padStart(2, "0")}/${c.exp_year}` : null;

  return (
    <section className="mt-5">
      <h3 className="font-display text-sm font-semibold text-navy">Card on file</h3>
      <div className="mt-1.5 space-y-2 rounded-xl border border-border p-3">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-navy">
          <CreditCard className="size-4 text-gold" aria-hidden="true" />
          <span className="capitalize">{c.brand ?? "Card"}</span>
          <span>•••• {c.last4}</span>
          {expiry ? <span className="text-xs font-normal text-muted-foreground">Exp {expiry}</span> : null}
          {c.test_mode ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">TEST</span> : null}
        </p>
        {c.cardholder_name ? <p className="text-xs text-muted-foreground">{c.cardholder_name}</p> : null}
        {c.deleted_at ? (
          <p className="text-xs text-muted-foreground">Deleted from the vault on {new Date(c.deleted_at).toLocaleDateString()}.</p>
        ) : phase === "shown" ? (
          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Card number</p>
              <div id="vault-reveal-number" className="mt-1 h-[38px] rounded-lg border border-border px-2 py-1.5" />
            </div>
            {noCvc ? (
              <p className="text-xs text-muted-foreground">CVC already deleted. Please get it from the customer by phone.</p>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">CVC</p>
                <div id="vault-reveal-cvc" className="mt-1 h-[38px] w-24 rounded-lg border border-border px-2 py-1.5" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={hide} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground">
                Hide now
              </button>
              <span className="text-xs text-muted-foreground">Hides itself after one minute.</span>
            </div>
          </div>
        ) : canReveal ? (
          phase === "idle" ? (
            <button type="button" onClick={() => setPhase("asking")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy hover:bg-secondary">
              <Eye className="size-3.5" aria-hidden="true" /> Reveal card
            </button>
          ) : (
            <div className="space-y-2">
              <input
                aria-label="Reason for revealing this card"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need the number? (saved in the log)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-gold"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={phase === "working" || reason.trim().length < 5}
                  onClick={() => void reveal()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50"
                >
                  {phase === "working" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null} Reveal now
                </button>
                <button type="button" onClick={hide} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-navy">
                  Cancel
                </button>
              </div>
            </div>
          )
        ) : (
          <p className="text-xs text-muted-foreground">Only a Manager or Superadmin can reveal this card.</p>
        )}
        {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}
