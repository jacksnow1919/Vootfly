import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { adminSessionStatus } from "@/lib/admin.functions";
import {
  adminGetFareIntelligence,
  adminGetRouteIntelligence,
  adminGetAirlineIntelligence,
  adminGetAirportIntelligence,
  adminGetDestinationIntelligence,
} from "@/lib/intelligence.functions";

/**
 * Internal-only verification surface for the Phase 3 Travel Intelligence
 * services. Same admin/operator auth as the rest of /admin -- not public,
 * not linked from anywhere customer-facing. Deliberately plain: this is a
 * verification tool for real data already computed by the existing
 * services, not a new UI system, and not the customer-facing surface for
 * any of this data (none of it is exposed publicly yet, per instruction).
 */
export const Route = createFileRoute("/admin/intelligence")({
  head: () => ({ meta: [{ title: "Travel Intelligence — Internal" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminIntelligencePage,
});

function ReportPanel<T>({
  title,
  fields,
  onFetch,
  renderReport,
}: {
  title: string;
  fields: { key: string; label: string; placeholder: string }[];
  onFetch: (values: Record<string, string>) => Promise<{ ok: boolean; report?: T; error?: string }>;
  renderReport: (report: T) => React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; report?: T; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      setResult(await onFetch(values));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-display text-sm font-bold text-navy">{title}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-[11px] font-semibold text-muted-foreground">{f.label}</label>
            <input
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value.trim().toLowerCase() }))}
              placeholder={f.placeholder}
              className="mt-1 w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null} Fetch
        </button>
      </div>
      {result ? (
        <div className="mt-3 rounded-lg bg-secondary/60 p-3 text-xs">
          {!result.ok ? (
            <p className="font-semibold text-destructive">{result.error ?? "Request failed."}</p>
          ) : result.report ? (
            renderReport(result.report)
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function AdminIntelligencePage() {
  const sessionStatus = useServerFn(adminSessionStatus);
  const fareIntel = useServerFn(adminGetFareIntelligence);
  const routeIntel = useServerFn(adminGetRouteIntelligence);
  const airlineIntel = useServerFn(adminGetAirlineIntelligence);
  const airportIntel = useServerFn(adminGetAirportIntelligence);
  const destinationIntel = useServerFn(adminGetDestinationIntelligence);

  const session = useQuery({
    queryKey: ["admin-session"],
    queryFn: () => sessionStatus(),
    retry: false,
    staleTime: 60_000,
  });

  if (session.isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-secondary/60">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }

  if (session.isError || session.data?.admin !== true) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-secondary/60 px-4 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold text-navy">Sign-in required</h1>
          <p className="mt-1 text-sm text-muted-foreground">This page is for internal use only.</p>
          <Link to="/admin" className="mt-4 inline-flex rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground">
            Go to admin sign-in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-xl font-bold text-navy">Travel Intelligence — Internal Verification</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real data from the Phase 3 intelligence services. Internal use only -- not exposed publicly.
      </p>

      <div className="mt-6 grid gap-4">
        <ReportPanel
          title="Fare Intelligence"
          fields={[
            { key: "fromCode", label: "From", placeholder: "nyc" },
            { key: "toCode", label: "To", placeholder: "lon" },
            { key: "cabin", label: "Cabin", placeholder: "economy" },
          ]}
          onFetch={(v) => fareIntel({ data: { fromCode: v['fromCode'] ?? "", toCode: v['toCode'] ?? "", cabin: v['cabin'] ?? "economy" } })}
          renderReport={(r: Extract<Awaited<ReturnType<typeof fareIntel>>, { ok: true }>["report"]) =>
            r ? (
              <div className="space-y-1">
                <p>
                  Observations: <strong>{r.observationCount}</strong> · Trend: <strong>{r.trend}</strong> · Source:{" "}
                  {r.dataSource}
                </p>
                {r.lowestObserved ? (
                  <p>
                    Lowest: {r.lowestObserved.currency} {r.lowestObserved.price} ({r.lowestObserved.airlineIata ?? "airline n/a"}) at{" "}
                    {r.lowestObserved.observedAt}
                  </p>
                ) : (
                  <p>No real observations yet for this route/cabin.</p>
                )}
              </div>
            ) : null
          }
        />

        <ReportPanel
          title="Route Intelligence"
          fields={[
            { key: "fromCode", label: "From", placeholder: "nyc" },
            { key: "toCode", label: "To", placeholder: "lon" },
          ]}
          onFetch={(v) => routeIntel({ data: { fromCode: v['fromCode'] ?? "", toCode: v['toCode'] ?? "" } })}
          renderReport={(r: Extract<Awaited<ReturnType<typeof routeIntel>>, { ok: true }>["report"]) =>
            r ? (
              <div className="space-y-1">
                <p>
                  {r.fromPlace?.name ?? r.fromCode} → {r.toPlace?.name ?? r.toCode} · In catalog: {String(r.inCatalog)} · Has
                  SEO page: {String(r.hasSeoPage)} {r.seoPagePath ? `(${r.seoPagePath})` : ""}
                </p>
                <p>Fare observations: {r.fare.observationCount}, trend {r.fare.trend}</p>
              </div>
            ) : null
          }
        />

        <ReportPanel
          title="Airline Intelligence"
          fields={[{ key: "iataCode", label: "IATA code", placeholder: "FI" }]}
          onFetch={(v) => airlineIntel({ data: { iataCode: (v['iataCode'] ?? "").toUpperCase() } })}
          renderReport={(r: Extract<Awaited<ReturnType<typeof airlineIntel>>, { ok: true }>["report"]) =>
            r ? (
              <div className="space-y-1">
                <p>
                  {r.airline ? r.airline.name : "Not in airlines reference table"} · identity source:{" "}
                  {r.dataSourceForIdentity}
                </p>
                <p>
                  Observed routes ({r.dataSourceForRoutes}): {r.observedRoutes.length === 0 ? "none yet" : r.observedRoutes.map((o) => o.route).join(", ")}
                </p>
              </div>
            ) : null
          }
        />

        <ReportPanel
          title="Airport Intelligence"
          fields={[{ key: "code", label: "Code", placeholder: "nyc" }]}
          onFetch={(v) => airportIntel({ data: { code: v['code'] ?? "" } })}
          renderReport={(r: Extract<Awaited<ReturnType<typeof airportIntel>>, { ok: true }>["report"]) =>
            r ? (
              <div className="space-y-1">
                <p>{r.place ? `${r.place.name} (${r.place.level})` : "Not in places table"} · {r.dataSourceForPlace}</p>
                <p>Routes from: {r.routesFrom.join(", ") || "none"} · Routes to: {r.routesTo.join(", ") || "none"}</p>
                <p>Observed airlines: {r.observedAirlines.join(", ") || "none yet"}</p>
              </div>
            ) : null
          }
        />

        <ReportPanel
          title="Destination Intelligence"
          fields={[{ key: "code", label: "Code", placeholder: "lon" }]}
          onFetch={(v) => destinationIntel({ data: { code: v['code'] ?? "" } })}
          renderReport={(r: Extract<Awaited<ReturnType<typeof destinationIntel>>, { ok: true }>["report"]) =>
            r ? (
              <div className="space-y-1">
                <p>{r.place ? `${r.place.name} (${r.place.level})` : "Not in places table"} · {r.dataSourceForPlace}</p>
                <p>
                  Reachable from ({r.dataSourceForFares}):{" "}
                  {r.reachableFrom.length === 0 ? "none yet" : r.reachableFrom.map((f) => `${f.fromCode} (${f.currency}${f.lowestObservedPrice})`).join(", ")}
                </p>
                <p className="text-muted-foreground">Visa/weather: not built yet (by design, no fabricated data).</p>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
