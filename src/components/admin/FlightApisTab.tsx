import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, PauseCircle, PlayCircle, RefreshCw } from "lucide-react";
import { getFlightApis, setFlightApiPaused, type FlightApiCard } from "@/lib/provider-admin.functions";

const PERIODS = [
  { hours: 24, label: "Last 24 hours" },
  { hours: 168, label: "Last 7 days" },
  { hours: 720, label: "Last 30 days" },
] as const;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "None yet";

const seconds = (ms: number | null) => (ms === null ? "None yet" : `${(ms / 1000).toFixed(1)} s`);

/** Based only on what is recorded: no answers in this period is not reported as working. */
function cardState(card: FlightApiCard) {
  if (!card.hasKey) return { label: "No key added", tone: "bg-secondary text-muted-foreground", Icon: KeyRound };
  if (card.paused) return { label: "Paused", tone: "bg-amber-100 text-amber-900", Icon: PauseCircle };
  if (card.errors > 0 && card.searches === card.errors) return { label: "Failing", tone: "bg-red-100 text-red-800", Icon: AlertTriangle };
  if (card.searches === 0) return { label: "On, no searches yet", tone: "bg-secondary text-navy", Icon: PlayCircle };
  return { label: "Working", tone: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 };
}

export function FlightApisTab() {
  const [hours, setHours] = useState<24 | 168 | 720>(24);
  const fetchApis = useServerFn(getFlightApis);
  const setPaused = useServerFn(setFlightApiPaused);
  const queryClient = useQueryClient();

  const apis = useQuery({
    queryKey: ["admin-flight-apis", hours],
    queryFn: () => fetchApis({ data: { hours } }),
  });

  const change = useMutation({
    mutationFn: (input: { code: "pkfare" | "duffel" | "mcontent"; paused: boolean }) => setPaused({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-flight-apis"] }),
  });

  if (apis.isLoading) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }
  if (apis.isError || !apis.data?.authorized) {
    return <p className="p-4 text-sm font-semibold text-destructive">Could not load the flight APIs.</p>;
  }

  const { cards, latest, canControl, historyReady } = apis.data;
  const usable = cards.filter((c) => c.hasKey && !c.paused).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Flight APIs</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Every search asks each API that is on, and customers see the first one that returns fares. A paused API
            gets no searches, and its key stays saved. A change can take up to 30 seconds to reach every search.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value) as 24 | 168 | 720)}
            aria-label="Period"
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.hours} value={p.hours}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void apis.refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-navy"
          >
            <RefreshCw className={`size-4 ${apis.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {usable === 0 ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          No flight API is on. Customers will see "No live fares" on every search.
        </p>
      ) : null}
      {!historyReady ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Search history isn't set up yet, so the numbers below stay at zero. Pause and resume still work.
        </p>
      ) : null}
      {change.isError || change.data?.ok === false ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          {change.data?.ok === false ? "Only a superadmin can pause or resume an API." : "That change didn't save. Please try again."}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => {
          const state = cardState(card);
          const busy = change.isPending && change.variables?.code === card.code;
          return (
            <section key={card.code} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-navy">{card.name}</h3>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${state.tone}`}>
                  <state.Icon className="size-3.5" aria-hidden="true" /> {state.label}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <Stat label="Searches with fares" value={`${card.searchesWithFares} of ${card.searches}`} />
                <Stat label="Fares returned" value={card.fares.toLocaleString()} />
                <Stat label="Errors" value={String(card.errors)} />
                <Stat label="Average answer time" value={seconds(card.averageMs)} />
                <Stat label="Last fares" value={when(card.lastFaresAt)} />
              </dl>
              {card.lastError ? (
                <p className="mt-3 break-words rounded-lg bg-red-50 p-2 text-xs text-red-800">
                  Last error ({when(card.lastErrorAt)}): {card.lastError}
                </p>
              ) : null}
              {canControl ? (
                <button
                  type="button"
                  disabled={busy || !card.hasKey}
                  onClick={() => change.mutate({ code: card.code as "pkfare" | "duffel" | "mcontent", paused: !card.paused })}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    card.paused ? "bg-gold text-gold-foreground" : "border border-border text-navy hover:bg-secondary"
                  }`}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : card.paused ? (
                    <PlayCircle className="size-4" aria-hidden="true" />
                  ) : (
                    <PauseCircle className="size-4" aria-hidden="true" />
                  )}
                  {card.paused ? "Resume" : "Pause"}
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-card">
        <h3 className="border-b border-border px-4 py-3 font-display text-base font-semibold text-navy">Latest answers</h3>
        {latest.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing recorded in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">API</th>
                  <th className="px-4 py-2">Route</th>
                  <th className="px-4 py-2">Fares</th>
                  <th className="px-4 py-2">Took</th>
                  <th className="px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {latest.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{when(row.createdAt)}</td>
                    <td className="px-4 py-2 font-semibold capitalize text-navy">{row.supplier}</td>
                    <td className="whitespace-nowrap px-4 py-2">{row.route}</td>
                    <td className="px-4 py-2">{row.fares}</td>
                    <td className="px-4 py-2">{seconds(row.durationMs)}</td>
                    <td className="max-w-xs truncate px-4 py-2" title={row.error ?? undefined}>
                      {row.error ? <span className="font-semibold text-destructive">{row.error}</span> : row.fares > 0 ? "Fares found" : "No fares"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-navy">{value}</dd>
    </div>
  );
}
