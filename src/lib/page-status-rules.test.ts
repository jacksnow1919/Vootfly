/**
 * Run with: node --test --experimental-strip-types src/lib/page-status-rules.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  pickScheduledRefresh,
  statusAfterFareRefresh,
  statusForUpsert,
  type RefreshCandidate,
} from "./page-status-rules.ts";

describe("status rules", () => {
  it("a fare refresh never changes a pending or expired page", () => {
    assert.equal(
      statusAfterFareRefresh("pending", () => "published"),
      "pending",
    );
    assert.equal(
      statusAfterFareRefresh("expired", () => "published"),
      "expired",
    );
    assert.equal(
      statusAfterFareRefresh("published", () => "noindex"),
      "noindex",
    );
    assert.equal(
      statusAfterFareRefresh("noindex", () => "published"),
      "published",
    );
  });

  it("a page save keeps an existing pending page pending unless a status is given", () => {
    assert.equal(
      statusForUpsert(undefined, "pending", () => "published"),
      "pending",
    );
    assert.equal(
      statusForUpsert("published", "pending", () => "noindex"),
      "published",
    );
    assert.equal(
      statusForUpsert(undefined, null, () => "published"),
      "published",
    );
    assert.equal(
      statusForUpsert(undefined, "published", () => "noindex"),
      "noindex",
    );
  });
});

describe("pickScheduledRefresh", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  const row = (path: string, status: string, hoursOld: number | null): RefreshCandidate => ({
    path,
    page_type: "route",
    status,
    from_code: "aaa",
    to_code: "bbb",
    cabin: "economy",
    fare_snapshot_at: hoursOld === null ? null : new Date(now - hoursOld * 3_600_000).toISOString(),
  });

  it("never picks a pending, noindex or expired page", () => {
    const rows = [
      row("/a/", "pending", 900),
      row("/b/", "noindex", 900),
      row("/c/", "expired", 900),
    ];
    assert.equal(pickScheduledRefresh(rows, now), null);
  });

  it("skips published pages checked in the last 20 hours", () => {
    assert.equal(pickScheduledRefresh([row("/a/", "published", 5)], now), null);
    assert.equal(pickScheduledRefresh([row("/a/", "published", 21)], now)?.path, "/a/");
    assert.equal(pickScheduledRefresh([row("/a/", "published", null)], now)?.path, "/a/");
  });

  it("rotates through due pages run by run, so one failing page cannot block the rest", () => {
    const rows = [
      row("/a/", "published", 50),
      row("/b/", "published", 50),
      row("/c/", "published", 50),
    ];
    const picks = new Set(
      [0, 1, 2].map((i) => pickScheduledRefresh(rows, now + i * 30 * 60_000)?.path),
    );
    assert.equal(picks.size, 3);
  });
});
