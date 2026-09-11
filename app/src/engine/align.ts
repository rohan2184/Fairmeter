import type { Alignment, MeterReading, ReadingWindow, Units } from './types';

/**
 * Lining a sub-meter's reading window up with the bill's (D-13).
 *
 * The utility reads the official meter on the 28th. The owner reads the
 * sub-meters when the bill arrives — the 3rd, the 8th, the 11th, whenever. So
 * a sub-meter's two readings span a different stretch of time from the one the
 * bill charges for, and the difference is not the lag itself but the CHANGE in
 * lag: read four days later than last cycle and the sub-meter covers 65 days
 * against the bill's 61. Those four extra days of consumption inflate that
 * household's units, which shrinks the residual by exactly as much — so the
 * whole error lands on the unmetered household (D-08).
 *
 * The fix is to stop treating a meter as a pair of numbers and treat it as what
 * it is: a cumulative curve sampled at known dates. Interpolate it linearly
 * between samples, evaluate at the bill's two reading dates, subtract. Because
 * consecutive bills share an endpoint, every unit is billed exactly once across
 * the whole history — the extra days are not discarded, they move into the
 * cycle they belong to.
 *
 * Simply scaling units by (bill days / meter days) looks like the same idea and
 * is not: it throws the extra days away, and the next cycle's delta starts from
 * the late reading, so those units are never billed to anybody. That is why
 * this module interpolates instead.
 *
 * No clock. Dates come in as `yyyy-mm-dd` strings and are only ever compared
 * with each other.
 */

const DAY = 86_400_000;

/** `yyyy-mm-dd` -> epoch ms, or NaN. Deliberately strict: no locale guessing. */
function parseDate(iso: string | undefined): number {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN;
  return Date.parse(`${iso}T00:00:00Z`);
}

export const daysBetween = (from: string, to: string): number =>
  (parseDate(to) - parseDate(from)) / DAY;

export function isValidDate(iso: string | undefined): boolean {
  return Number.isFinite(parseDate(iso));
}

interface Knot {
  t: number;
  /** Cumulative units at t — the reading times its multiplier. */
  v: number;
}

/** Cumulative units at time t, by linear interpolation between samples. */
function valueAt(knots: Knot[], t: number): number {
  const first = knots[0];
  const last = knots[knots.length - 1];

  // Outside the sampled range, continue at the rate of the nearest segment.
  if (t <= first.t) {
    const next = knots[1];
    const slope = (next.v - first.v) / (next.t - first.t);
    return first.v + slope * (t - first.t);
  }
  if (t >= last.t) {
    const prev = knots[knots.length - 2];
    const slope = (last.v - prev.v) / (last.t - prev.t);
    return last.v + slope * (t - last.t);
  }

  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1];
    const b = knots[i];
    if (t <= b.t) {
      const slope = (b.v - a.v) / (b.t - a.t);
      return a.v + slope * (t - a.t);
    }
  }
  return last.v;
}

const raw = (reading: MeterReading): Units =>
  (reading.present - reading.previous) * (reading.multiplier || 1);

const unaligned = (reading: MeterReading, billDays = 0): Alignment => ({
  rawUnits: raw(reading),
  units: raw(reading),
  adjustment: 0,
  meterDays: 0,
  billDays,
  aligned: false,
  extrapolated: false,
});

/**
 * Units this meter contributes to `window`, rather than to its own reading
 * dates. Falls back to the raw delta whenever the dates cannot support the
 * calculation — a bill with no dates behaves exactly as it did before D-13.
 */
export function alignReading(reading: MeterReading, window?: ReadingWindow): Alignment {
  const t0 = parseDate(window?.previousDate);
  const t1 = parseDate(window?.presentDate);
  const billDays = Number.isFinite(t0) && Number.isFinite(t1) ? (t1 - t0) / DAY : 0;

  if (!Number.isFinite(t0) || !Number.isFinite(t1) || billDays <= 0) return unaligned(reading);

  const p0 = parseDate(reading.previousDate);
  const p1 = parseDate(reading.presentDate);
  if (!Number.isFinite(p0) || !Number.isFinite(p1) || p1 <= p0) return unaligned(reading, billDays);

  const multiplier = reading.multiplier || 1;
  const knots: Knot[] = [
    { t: p0, v: reading.previous * multiplier },
    { t: p1, v: reading.present * multiplier },
  ];

  const priorT = parseDate(reading.prior?.date);
  if (reading.prior && Number.isFinite(priorT) && priorT < p0) {
    knots.unshift({ t: priorT, v: reading.prior.value * multiplier });
  }

  const units = valueAt(knots, t1) - valueAt(knots, t0);
  const rawUnits = raw(reading);

  return {
    rawUnits,
    units,
    adjustment: units - rawUnits,
    meterDays: (p1 - p0) / DAY,
    billDays,
    aligned: true,
    extrapolated: t0 < knots[0].t,
  };
}
