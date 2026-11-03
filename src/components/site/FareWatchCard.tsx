import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Check, Loader2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/site/ui";
import { createPriceAlert } from "@/lib/price-alerts.functions";
import { formatMoney } from "@/lib/hierarchy";
import { track } from "@/lib/analytics";

/**
 * Fare watch (Phase 7 activation).
 *
 * Captures a visitor who is interested but not ready to book. The real
 * fare currently on the page is sent as the BASELINE, so any future
 * "price dropped" message can be measured against a real number that
 * was really on screen, rather than asserted.
 *
 * Deliberately makes no promise about frequency or guaranteed savings --
 * VootFly cannot control either, and implying otherwise would be a claim
 * the product cannot keep.
 */
export function FareWatchCard({
  fromCode,
  toCode,
  fromName,
  toName,
  cabin,
  baselinePrice,
  baselineCurrency,
  source = "route_page",
  variant = "card",
}: {
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  cabin: string;
  baselinePrice?: number | undefined;
  baselineCurrency?: string | undefined;
  /** Where the card is shown, recorded with each alert (phase tracker 5.4). */
  source?: "route_page" | "search_results";
  /** "inline" renders as a plain band in the page flow instead of a card (29 Oct 2026). */
  variant?: "card" | "inline";
}) {
  const create = useServerFn(createPriceAlert);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const submit = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setState("error");
      return;
    }
    setState("saving");
    try {
      const res = await create({
        data: {
          email: email.trim(),
          fromCode,
          toCode,
          cabin,
          passengers: 1,
          baselinePrice: baselinePrice ?? null,
          baselineCurrency: baselineCurrency ?? null,
        },
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      setState("done");
      track("Fare Watch Created", {
        origin: fromCode,
        destination: toCode,
        cabin,
        // Whether we captured a real baseline, so we can tell later how many
        // alerts are actually measurable rather than assuming all of them are.
        has_baseline: typeof baselinePrice === "number" && baselinePrice > 0,
        baseline_price: baselinePrice ?? null,
        // Phase 5.4: where the alert was offered (route_page or search_results).
        source,
      });
    } catch {
      setState("error");
    }
  };

  const Wrap = variant === "inline" ? InlineBand : Card;

  if (state === "done") {
    return (
      <Wrap>
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-bold text-navy">We will keep an eye on this route</p>
            <p className="mt-1 text-xs text-muted-foreground">
              If the {fromName} to {toName} fare drops below{" "}
              {typeof baselinePrice === "number"
                ? formatMoney(baselinePrice, baselineCurrency ?? "USD")
                : "the current price"}
              , we will email you. Fares are per person and subject to availability and change.
            </p>
          </div>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      {variant === "inline" ? (
        <p className="flex items-center gap-2 font-display text-lg font-semibold text-navy">
          <BellRing className="size-4 text-primary" /> Watch this fare
        </p>
      ) : (
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <BellRing className="size-4 text-primary" /> Watch this fare
          </span>
        </SectionTitle>
      )}
      <p
        className={
          variant === "inline"
            ? "mt-1 text-sm text-muted-foreground"
            : "mt-1 text-xs text-muted-foreground"
        }
      >
        {typeof baselinePrice === "number"
          ? `We will email you if the ${fromName} to ${toName} fare drops below ${formatMoney(baselinePrice, baselineCurrency ?? "USD")}.`
          : `We will email you if we see a lower fare from ${fromName} to ${toName}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm sm:max-w-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={state === "saving"}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-gold-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : null} Watch fare
        </button>
      </div>
      {state === "error" ? (
        <p className="mt-2 text-xs font-semibold text-destructive">
          Please check the email address and try again.
        </p>
      ) : null}
    </Wrap>
  );
}

/** Plain band for the single-column route page: a top and bottom rule, no card. */
function InlineBand({ children }: { children: ReactNode }) {
  return <div className="border-y border-border py-5">{children}</div>;
}
