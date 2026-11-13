// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Hands-free fare refresh (14 Nov 2026), replacing the n8n W6 workflow. Nitro turns
 * `scheduledTasks` into a Cloudflare Cron Trigger in the generated wrangler.json at
 * build time, and the Worker's scheduled() handler runs the task. Every 30 minutes,
 * one published route page with a fare over 20 hours old (src/tasks/fare-refresh.ts).
 *
 * The Lovable config passes these straight to nitro() outside the Lovable sandbox,
 * but its `nitro` option type only lists preset/output/cloudflare, hence the cast.
 */
const nitroWithFareRefresh = {
  experimental: { tasks: true },
  tasks: {
    "fares:refresh": {
      // Absolute path: Nitro does not resolve a relative handler from its virtual tasks module.
      handler: fileURLToPath(new URL("./src/tasks/fare-refresh.ts", import.meta.url)),
      description: "Refresh the fare on one due published route page",
    },
  },
  scheduledTasks: { "*/30 * * * *": ["fares:refresh"] },
} as unknown as { preset?: string };

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: nitroWithFareRefresh,
});
