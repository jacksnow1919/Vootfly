/**
 * Run with: node --test --experimental-strip-types src/lib/supplier-segments.test.ts
 *
 * Prepared by: Emma Jackob
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allSegments, localStamp, segment, terms } from "./supplier-segments.ts";

describe("localStamp", () => {
  it("keeps the supplier's local clock, never shifted", () => {
    assert.equal(localStamp("2026-11-14T07:03:00"), "2026-11-14T07:03:00");
    assert.equal(localStamp("2026-12-10T12:00:00.000+00:00"), "2026-12-10T12:00:00");
    assert.equal(localStamp("2026-11-14", "7:03"), "2026-11-14T07:03:00");
    assert.equal(localStamp("2026-11-14", "07:03:00"), "2026-11-14T07:03:00");
  });
  it("gives null rather than a guess", () => {
    assert.equal(localStamp(null), null);
    assert.equal(localStamp("2026-11-14", null), null);
    assert.equal(localStamp("2026-11-14", ""), null);
    assert.equal(localStamp("soon"), null);
  });
});

describe("segment", () => {
  const base = {
    carrier: "as",
    origin: "lax",
    destination: "sea",
    departure: "2026-11-14T07:03:00",
    arrival: "2026-11-14T09:50:00",
  };
  it("normalises codes and flight numbers", () => {
    const s = segment({ ...base, flightNumber: "562", operatingCarrier: "QX", aircraft: " 739 " });
    assert.deepEqual(s, {
      carrier: "AS",
      operating_carrier: "QX",
      flight_number: "AS 562",
      origin: "LAX",
      destination: "SEA",
      departure_time: "2026-11-14T07:03:00",
      arrival_time: "2026-11-14T09:50:00",
      aircraft: "739",
    });
  });
  it("leaves out an operating carrier equal to the marketing one", () => {
    assert.equal(segment({ ...base, operatingCarrier: "AS" })?.operating_carrier, undefined);
  });
  it("rejects a segment without a valid carrier or airport", () => {
    assert.equal(segment({ ...base, carrier: "" }), null);
    assert.equal(segment({ ...base, origin: "LAXX" }), null);
    assert.equal(segment({ ...base, destination: undefined }), null);
  });
  it("is all or nothing per leg", () => {
    const ok = segment(base);
    assert.equal(allSegments([ok, null]), undefined);
    assert.equal(allSegments([]), undefined);
    assert.equal(allSegments([ok])?.length, 1);
  });
});

describe("terms", () => {
  it("keeps only stated terms", () => {
    assert.equal(terms({}), undefined);
    assert.equal(terms({ brand: " ", refundable: undefined }), undefined);
    assert.deepEqual(terms({ brand: "Main", baggage: { checked_bags: 0 }, refundable: false }), {
      brand: "Main",
      baggage: { checked_bags: 0 },
      refundable: false,
    });
  });
});
