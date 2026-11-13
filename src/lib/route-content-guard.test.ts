/**
 * Run with: node --test --experimental-strip-types src/lib/route-content-guard.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  findStoredTextViolations,
  hasValidVerification,
  isStrictTemplate,
  verifiedFactIsCurrent,
} from "./route-content-guard.ts";
import { isLiveSnapshot, type FareSnapshot } from "./hierarchy.ts";

describe("findStoredTextViolations", () => {
  it("flags prices, durations, frequencies and nonstop claims", () => {
    const v = findStoredTextViolations({
      meta_title: "Flights Dallas to London from $580 | VootFly",
      content_json: {
        intro: "Two airlines fly daily, nonstop in about nine hours.",
        faqs: [{ q: "How long?", a: "Around 9h 20m." }],
      },
    });
    const reasons = v.map((x) => x.reason.split(" ")[0]);
    assert.ok(reasons.includes("digit"));
    assert.ok(reasons.includes("currency"));
    assert.ok(reasons.includes("frequency"));
    assert.ok(reasons.includes("nonstop"));
    assert.ok(v.some((x) => x.match.toLowerCase() === "nine hours"));
    assert.ok(v.some((x) => x.match.toLowerCase() === "two airlines"));
  });

  it("ignores source URLs and the template marker", () => {
    const v = findStoredTextViolations({
      content_json: {
        template: 2,
        sources: [{ label: "Airport guide", url: "https://example.com/2026/page-1" }],
      },
    });
    assert.deepEqual(v, []);
  });

  it("passes the stored copy of the Dallas to London page", () => {
    const page = JSON.parse(
      readFileSync(new URL("../../supabase/content/route-dfw-lon.json", import.meta.url), "utf8"),
    );
    assert.equal(isStrictTemplate(page.content_json), true);
    assert.deepEqual(findStoredTextViolations(page), []);
  });
});

describe("isLiveSnapshot", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  const base: FareSnapshot = {
    lowest: {
      amount: 612,
      currency: "USD",
      airline: "Example Air",
      depart_date: "2026-12-28",
      return_date: "2027-01-04",
    },
    fetched_at: "2026-11-13T09:00:00Z",
    source: "duffel",
    adults: 1,
    trip: "round_trip",
  };

  it("accepts a complete, recent USD fare", () => {
    assert.equal(isLiveSnapshot(base, now), true);
  });
  it("rejects a check older than seven days", () => {
    assert.equal(isLiveSnapshot({ ...base, fetched_at: "2026-11-01T09:00:00Z" }, now), false);
  });
  it("rejects a departure that has passed", () => {
    assert.equal(
      isLiveSnapshot({ ...base, lowest: { ...base.lowest!, depart_date: "2026-11-10" } }, now),
      false,
    );
  });
  it("rejects a snapshot without a passenger count", () => {
    const { adults: _a, ...rest } = base;
    assert.equal(isLiveSnapshot(rest as FareSnapshot, now), false);
  });
  it("rejects a non-USD amount and a missing price", () => {
    assert.equal(
      isLiveSnapshot({ ...base, lowest: { ...base.lowest!, currency: "GBP" } }, now),
      false,
    );
    assert.equal(isLiveSnapshot({ ...base, lowest: null }, now), false);
    assert.equal(isLiveSnapshot(null, now), false);
  });
  it("rejects a round trip with no return date", () => {
    const { return_date: _r, ...low } = base.lowest!;
    assert.equal(isLiveSnapshot({ ...base, lowest: low }, now), false);
  });
});

describe("verified route facts", () => {
  const verified = {
    checked_at: "2026-11-13",
    sources: [{ label: "Airport flight board", url: "https://www.example-airport.com/flights" }],
  };

  it("exempts a fact that carries a check date and https sources", () => {
    const v = findStoredTextViolations({
      content_json: {
        template: 2,
        sections: [
          { title: "Nonstop flights", body: "Two airlines fly nonstop to Terminal 5.", verified },
        ],
      },
    });
    assert.deepEqual(v, []);
  });

  it("flags a fact without sources or with a bad date, and still checks its text", () => {
    const noSources = findStoredTextViolations({
      content_json: {
        sections: [
          {
            body: "Flies nonstop to Terminal 3.",
            verified: { checked_at: "2026-11-13", sources: [] },
          },
        ],
      },
    });
    assert.ok(noSources.some((x) => x.match === "verified"));
    assert.ok(noSources.some((x) => x.reason.startsWith("digit")));
    assert.equal(
      hasValidVerification({ verified: { ...verified, checked_at: "13 Nov 2026" } }),
      false,
    );
    assert.equal(
      hasValidVerification({
        verified: { ...verified, sources: [{ label: "x", url: "http://insecure.example" }] },
      }),
      false,
    );
  });

  it("shows a fact only while its check is under 180 days old", () => {
    const item = { verified };
    assert.equal(verifiedFactIsCurrent(item, Date.parse("2026-11-14T00:00:00Z")), true);
    assert.equal(verifiedFactIsCurrent(item, Date.parse("2027-05-13T00:00:00Z")), false);
    assert.equal(verifiedFactIsCurrent(item, Date.parse("2026-11-01T00:00:00Z")), false);
  });

  it("has the approved section and FAQ on the Dallas to London copy", () => {
    const page = JSON.parse(
      readFileSync(new URL("../../supabase/content/route-dfw-lon.json", import.meta.url), "utf8"),
    );
    assert.equal(page.content_json.sections.length, 4);
    assert.equal(page.content_json.faqs.length, 6);
    assert.equal(page.content_json.sections.filter(hasValidVerification).length, 1);
    assert.equal(page.content_json.faqs.filter(hasValidVerification).length, 1);
  });
});
