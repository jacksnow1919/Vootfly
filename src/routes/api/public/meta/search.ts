import { createFileRoute } from "@tanstack/react-router";
import { handleMetaSearch, handleMetaSearchOptions } from "@/lib/meta-search-handler";

// Same key-protected handler, mounted under /api/public/* so external
// aggregators can reach it on the published site (site auth is bypassed here,
// the x-api-key check is the security boundary).
export const Route = createFileRoute("/api/public/meta/search")({
  server: {
    handlers: {
      POST: handleMetaSearch,
      OPTIONS: handleMetaSearchOptions,
    },
  },
});
