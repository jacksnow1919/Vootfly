import { createFileRoute } from "@tanstack/react-router";
import { handleMetaSearch, handleMetaSearchOptions } from "@/lib/meta-search-handler";

export const Route = createFileRoute("/api/meta/search")({
  server: {
    handlers: {
      POST: handleMetaSearch,
      OPTIONS: handleMetaSearchOptions,
    },
  },
});
