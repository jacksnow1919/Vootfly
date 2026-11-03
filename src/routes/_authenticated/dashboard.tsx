import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, Card, SectionTitle, Stat } from "@/components/site/ui";
import { Bell, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Trips | VootFly" },
      {
        name: "description",
        content:
          "See your VootFly booking requests and trips.",
      },
      { property: "og:title", content: "Your VootFly account" },
      { property: "og:description", content: "Your booking requests and trips." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"active" | "past" | "cancelled">("active");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const all = bookings ?? [];
  const filtered = all.filter((b) =>
    tab === "active"
      ? b.status === "pending" || b.status === "confirmed" || b.status === "paid" || b.status === "issued"
      : tab === "past"
        ? b.status === "refunded"
        : b.status === "cancelled",
  );

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <PageShell
      eyebrow="Customer Dashboard"
      title={profile?.full_name ? `Welcome, ${profile.full_name}` : "My account"}
      subtitle="Your booking requests and trips."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total bookings" value={String(all.length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>My Trips</SectionTitle>
              <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-semibold">
                {(["active", "past", "cancelled"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-full px-3 py-1.5 capitalize ${
                      tab === t ? "bg-navy text-navy-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No {tab} trips yet.{" "}
                <Link to="/" className="font-semibold text-navy underline">
                  Search flights
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {filtered.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">
                        {b.origin} → {b.destination}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.airline} · {b.depart_date} · PNR {b.pnr ?? "pending"}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-lg font-semibold text-navy">
                      ${Number(b.total_price).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle>Saved searches & price alerts</SectionTitle>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <Bell className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>
                Open any route page and choose Watch this fare. We will email you if the price drops below the fare you saw.{" "}
                <Link to="/flights-to/" className="font-semibold text-navy underline">Browse destinations</Link>
              </span>
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <p className="text-sm text-muted-foreground">
              Questions about a booking? Call our advisors on +1-800-773-6613 or email info@vootfly.com.
            </p>
            <button
              onClick={signOut}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-navy"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
