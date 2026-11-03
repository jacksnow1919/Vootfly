/**
 * Wall-clock stamps for the EazAir meta-search feed, from the fare provider's local
 * dates and times. No time-zone maths here: the aggregator shows HH:mm as the
 * airport-local time, which is what a traveller reads on a departure board.
 *
 * Prepared by: Emma Jackob
 */

/**
 * ISO wall-clock stamp from the fare provider's local date ("YYYY-MM-DD") + time ("HH:mm").
 * the fare provider gives airport-local clocks with no offset; the "Z" here only makes
 * the string parseable. Aggregators show the HH:mm as the local time, which
 * is what a traveller expects to read on a board.
 */
export function departureIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null;
  // "9:40" is padded rather than treated as midnight. Duffel and MContent
  // fares carry a 12-hour label ("7:30 PM"), which must become 19:30.
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/.exec(timeStr.trim());
  let hour = m ? Number(m[1]) : 0;
  const meridiem = m?.[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  const t = m ? `${String(hour).padStart(2, "0")}:${m[2] ?? "00"}` : "00:00";
  const parsed = Date.parse(`${dateStr}T${t}:00Z`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/**
 * The real local arrival when the fare provider sent a date and a clock, otherwise null.
 * Departure plus duration is deliberately not used as a fallback: it is right
 * in length but wrong by the time-zone change on any route that crosses one,
 * and an aggregator can show "no time" but cannot tell a wrong time apart.
 */
export function arrivalIso(arriveDate: string, arriveTime: string): string | null {
  if (!/^\d{1,2}:\d{2}/.test(arriveTime)) return null;
  return departureIso(arriveDate, arriveTime);
}
