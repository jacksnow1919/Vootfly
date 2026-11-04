import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { BasisTheoryElements, ICardExpirationDateElement, ICardNumberElement, ICardVerificationCodeElement } from "@basis-theory/web-elements";
import { CreditCard, Loader2, TestTube2 } from "lucide-react";
import type { VaultConfig } from "@/lib/card-vault.server";

export type VaultCard = { tokenId: string; cardholderName: string };
export type VaultCardFormHandle = { tokenize: () => Promise<VaultCard> };

const STYLE = { base: { color: "#102F63", fontSize: "14px", "::placeholder": { color: "#7A8AA5" } }, invalid: { color: "#C62828" } };
const BOX = "mt-1 h-[42px] rounded-xl border border-input bg-background px-3 py-2.5";
const LABEL = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground";

/**
 * Card fields hosted by Basis Theory, each in its own frame. This page can't read what is
 * typed in them, and tokenizing sends the values straight to the vault.
 */
export const VaultCardForm = forwardRef<VaultCardFormHandle, { config: VaultConfig; onReadyChange: (ready: boolean) => void }>(
  function VaultCardForm({ config, onReadyChange }, ref) {
    const bt = useRef<BasisTheoryElements | null>(null);
    const fields = useRef<{ number: ICardNumberElement; expiry: ICardExpirationDateElement; cvc: ICardVerificationCodeElement } | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
    const [name, setName] = useState("");
    const [complete, setComplete] = useState({ number: false, expiry: false, cvc: false });

    useEffect(() => {
      let active = true;
      void (async () => {
        try {
          const { basistheory } = await import("@basis-theory/web-elements");
          const client = await basistheory(config.publicKey, { environment: config.environment === "production" ? "production" : "test" });
          if (!client || !active) return;
          const number = client.createElement("cardNumber", { targetId: "vault-card-number", style: STYLE, autoComplete: "cc-number", placeholder: "4242 4242 4242 4242" });
          const expiry = client.createElement("cardExpirationDate", { targetId: "vault-card-expiry", style: STYLE, autoComplete: "cc-exp", placeholder: "MM / YY" });
          const cvc = client.createElement("cardVerificationCode", { targetId: "vault-card-cvc", style: STYLE, autoComplete: "cc-csc", placeholder: "123" });
          number.on("change", (e) => {
            setComplete((c) => ({ ...c, number: e.complete }));
            void cvc.update({ cardBrand: e.cardBrand });
          });
          expiry.on("change", (e) => setComplete((c) => ({ ...c, expiry: e.complete })));
          cvc.on("change", (e) => setComplete((c) => ({ ...c, cvc: e.complete })));
          await Promise.all([number.mount("#vault-card-number"), expiry.mount("#vault-card-expiry"), cvc.mount("#vault-card-cvc")]);
          if (!active) {
            number.unmount();
            expiry.unmount();
            cvc.unmount();
            return;
          }
          bt.current = client;
          fields.current = { number, expiry, cvc };
          setState("ready");
        } catch (e) {
          console.error("[vault] the card form did not load", e instanceof Error ? e.message : "unknown error");
          if (active) setState("failed");
        }
      })();
      return () => {
        active = false;
        fields.current?.number.unmount();
        fields.current?.expiry.unmount();
        fields.current?.cvc.unmount();
        fields.current = null;
      };
    }, [config.publicKey, config.environment]);

    const ready = state === "ready" && complete.number && complete.expiry && complete.cvc && name.trim().length >= 2;
    useEffect(() => onReadyChange(ready), [ready, onReadyChange]);

    useImperativeHandle(
      ref,
      () => ({
        tokenize: async () => {
          if (!bt.current || !fields.current) throw new Error("CARD_FORM_NOT_READY");
          const { number, expiry, cvc } = fields.current;
          const token = await bt.current.tokens.create({
            type: "card",
            data: { number, expiration_month: expiry.month(), expiration_year: expiry.year(), cvc },
          });
          return { tokenId: token.id, cardholderName: name.trim() };
        },
      }),
      [name],
    );

    return (
      <div className="rounded-xl border border-border bg-secondary/40 p-4 sm:col-span-2">
        <div className="flex items-center gap-2 text-navy">
          <CreditCard className="size-4 text-gold" aria-hidden="true" />
          <span className="text-sm font-bold">Card details</span>
          {state === "loading" ? <Loader2 className="size-4 animate-spin text-gold" aria-label="Loading the secure card form" /> : null}
        </div>
        {config.environment !== "production" ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
            <TestTube2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            TEST MODE. Don't enter a real card. Use 4242 4242 4242 4242, any future date and any CVC.
          </p>
        ) : null}
        {state === "failed" ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
            The secure card form didn't load. Please reload this page, or call +1-800-773-6613.
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className={LABEL}>Name on Card *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="cc-name"
              placeholder="As printed on the card"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
            />
          </label>
          <div className="col-span-2">
            <span className={LABEL}>Card Number *</span>
            <div id="vault-card-number" className={BOX} />
          </div>
          <div>
            <span className={LABEL}>Expiry *</span>
            <div id="vault-card-expiry" className={BOX} />
          </div>
          <div>
            <span className={LABEL}>CVV *</span>
            <div id="vault-card-cvc" className={BOX} />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Your card number goes straight to our secure card vault and is only ever shown masked on VootFly. The CVV is deleted
          automatically. Funds are charged only after our team verifies your booking and issues your ticket.
        </p>
      </div>
    );
  },
);
