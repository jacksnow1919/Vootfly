import type { RouteAnswer } from "@/lib/answer-layer";

/**
 * A short, extractable "direct answer" for AEO/AI-Overview citation.
 * Deliberately plain markup near the top of the page -- a lead paragraph,
 * not a tinted card -- so crawlers and answer engines can lift the sentence
 * cleanly and readers see it as the opening line of the page rather than a
 * widget. See docs/VOOTFLY-STRATEGY.md, section 5.
 */
export function AnswerLayer({ answer }: { answer: RouteAnswer }) {
  return (
    <div className="max-w-3xl">
      <p className="font-display text-lg font-semibold leading-snug text-navy sm:text-xl">
        {answer.headline}
      </p>
      {answer.detail ? (
        <p className="mt-2 text-base leading-relaxed text-navy/75">{answer.detail}</p>
      ) : null}
    </div>
  );
}
