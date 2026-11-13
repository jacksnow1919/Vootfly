import { defineTask } from "nitro/task";

/**
 * Scheduled fare refresh (14 Nov 2026). Nitro turns the schedule in vite.config.ts into a
 * Cloudflare Cron Trigger and runs this task from the Worker's scheduled() handler.
 * One published route page per run; see runScheduledFareRefresh.
 */
export default defineTask({
  meta: { name: "fares:refresh", description: "Refresh the fare on one due published route page" },
  async run({ payload }) {
    const { runScheduledFareRefresh } = await import("../lib/seo-pages.server");
    const at =
      typeof payload?.["scheduledTime"] === "number"
        ? (payload["scheduledTime"] as number)
        : Date.now();
    return { result: await runScheduledFareRefresh(at) };
  },
});
