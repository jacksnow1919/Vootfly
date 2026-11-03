/**
 * Run with: node --test --experimental-strip-types src/lib/fare-times.test.ts
 *
 * Prepared by: Emma Jackob
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { arrivalIso, departureIso } from "./fare-times.ts";

describe("departureIso", () => {
  it("stamps PKfare's local date and clock", () => {
    assert.equal(departureIso("2026-11-03", "09:40"), "2026-11-03T09:40:00.000Z");
    assert.equal(departureIso("2026-11-03", "9:40"), "2026-11-03T09:40:00.000Z");
    assert.equal(departureIso("2026-11-03", "09:40:00"), "2026-11-03T09:40:00.000Z");
    assert.equal(departureIso("", "09:40"), null);
  });
});

describe("arrivalIso", () => {
  it("uses the real local arrival PKfare sent", () => {
    // AF 6754, 3 Nov 2026: leaves London 09:40, lands Miami 15:00 local.
    assert.equal(arrivalIso("2026-11-03", "15:00"), "2026-11-03T15:00:00.000Z");
  });

  it("keeps the next-day date for an overnight arrival", () => {
    // TP 1357 via Lisbon: leaves 18:30, lands 15:00 the next day.
    assert.equal(arrivalIso("2026-11-04", "15:00"), "2026-11-04T15:00:00.000Z");
  });

  it("reports no arrival rather than an estimate when PKfare sent none", () => {
    assert.equal(arrivalIso("", ""), null);
    assert.equal(arrivalIso("2026-11-03", ""), null);
    assert.equal(arrivalIso("", "15:00"), null);
  });

  it("accepts seconds and an unpadded hour, like departureIso", () => {
    assert.equal(arrivalIso("2026-11-03", "15:00:00"), "2026-11-03T15:00:00.000Z");
    assert.equal(arrivalIso("2026-11-03", "9:05"), "2026-11-03T09:05:00.000Z");
  });
});

describe("12-hour clocks (Duffel and MContent fares)", () => {
  it("reads AM and PM labels", () => {
    assert.equal(departureIso("2026-11-03", "7:30 PM"), "2026-11-03T19:30:00.000Z");
    assert.equal(departureIso("2026-11-03", "7:30 AM"), "2026-11-03T07:30:00.000Z");
    assert.equal(departureIso("2026-11-03", "12:05 AM"), "2026-11-03T00:05:00.000Z");
    assert.equal(departureIso("2026-11-03", "12:05 PM"), "2026-11-03T12:05:00.000Z");
    assert.equal(arrivalIso("2026-11-04", "11:59 PM"), "2026-11-04T23:59:00.000Z");
  });
});
