import { describe, expect, it } from 'vitest';
import { alignReading, daysBetween } from './align';
import { split } from './split';
import type { MeterReading, OfficialBill, ReadingWindow } from './types';

/**
 * Window alignment (D-13).
 *
 * The scenario throughout is the real one: the utility reads on a fixed day,
 * the owner reads the sub-meters a week or two later, and that lag creeps.
 */

const day = (n: number): string => {
  const ms = Date.parse('2026-01-01T00:00:00Z') + n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
};

const window = (from: number, to: number): ReadingWindow => ({
  previousDate: day(from),
  presentDate: day(to),
});

describe('daysBetween', () => {
  it('counts calendar days across a month boundary', () => {
    expect(daysBetween('2026-01-28', '2026-03-29')).toBe(60);
  });
});

describe('alignReading', () => {
  const reading: MeterReading = {
    previous: 100,
    present: 224,
    multiplier: 1,
    previousDate: day(8),
    presentDate: day(70),
  };

  it('leaves the meter alone when the bill has no dates', () => {
    const a = alignReading(reading, undefined);
    expect(a.aligned).toBe(false);
    expect(a.units).toBe(124);
    expect(a.adjustment).toBe(0);
  });

  it('leaves the meter alone when the meter itself has no dates', () => {
    const a = alignReading({ previous: 100, present: 224, multiplier: 1 }, window(0, 60));
    expect(a.aligned).toBe(false);
    expect(a.units).toBe(124);
  });

  it('shortens a meter that ran two days longer than the bill', () => {
    // 124 units over 62 days = 2/day; the bill covers 60 of those days.
    const a = alignReading(reading, window(0, 60));
    expect(a.aligned).toBe(true);
    expect(a.meterDays).toBe(62);
    expect(a.billDays).toBe(60);
    expect(a.units).toBeCloseTo(120, 9);
    expect(a.adjustment).toBeCloseTo(-4, 9);
  });

  it('flags the first cycle, where there is nothing to interpolate back to', () => {
    expect(alignReading(reading, window(0, 60)).extrapolated).toBe(true);
    const withPrior: MeterReading = {
      ...reading,
      prior: { value: 0, date: day(-52) },
    };
    expect(alignReading(withPrior, window(0, 60)).extrapolated).toBe(false);
  });

  it('applies the meter multiplier to the aligned units', () => {
    const a = alignReading({ ...reading, multiplier: 2 }, window(0, 60));
    expect(a.rawUnits).toBe(248);
    expect(a.units).toBeCloseTo(240, 9);
  });
});

describe('consecutive cycles partition consumption exactly', () => {
  /**
   * A meter that runs at 2 units/day for 100 days and 5/day after — so the
   * rate genuinely changes inside a reading interval and no single cycle can
   * be exactly right. What must still hold is that the cycles together bill
   * every unit once: the endpoint each pair of bills shares is evaluated on
   * the same segment of the same curve, so the errors cancel by construction.
   *
   * Scaling units by (bill days / meter days) instead would total 634.29 here
   * against a true 600 — 34 units billed to nobody. That is the whole reason
   * this module interpolates.
   */
  const R = (t: number): number => (t <= 100 ? 2 * t : 200 + 5 * (t - 100));

  // Official reads on days 0, 60, 120, 180. Owner reads on 8, 70, 133, 190.
  const submeter = [8, 70, 133, 190];
  const official = [0, 60, 120, 180];

  const cycle = (i: number): MeterReading => ({
    previous: R(submeter[i]),
    present: R(submeter[i + 1]),
    multiplier: 1,
    previousDate: day(submeter[i]),
    presentDate: day(submeter[i + 1]),
    prior: i === 0 ? undefined : { value: R(submeter[i - 1]), date: day(submeter[i - 1]) },
  });

  it('sums to the meter’s true consumption over the whole span', () => {
    const total = [0, 1, 2]
      .map((i) => alignReading(cycle(i), window(official[i], official[i + 1])).units)
      .reduce((a, b) => a + b, 0);

    expect(total).toBeCloseTo(R(180) - R(0), 6);
    expect(total).toBeCloseTo(600, 6);
  });

  it('does not lose units the way duration scaling does', () => {
    const scaled = [0, 1, 2]
      .map((i) => {
        const a = alignReading(cycle(i), window(official[i], official[i + 1]));
        return a.rawUnits * (a.billDays / a.meterDays);
      })
      .reduce((a, b) => a + b, 0);

    expect(scaled).toBeGreaterThan(630);
    expect(scaled).not.toBeCloseTo(600, 1);
  });

  it('is exact per cycle when the meter runs at a steady rate', () => {
    const steady = (i: number): MeterReading => ({
      previous: 3 * submeter[i],
      present: 3 * submeter[i + 1],
      multiplier: 1,
      previousDate: day(submeter[i]),
      presentDate: day(submeter[i + 1]),
      prior: i === 0 ? undefined : { value: 3 * submeter[i - 1], date: day(submeter[i - 1]) },
    });
    for (const i of [0, 1, 2]) {
      expect(alignReading(steady(i), window(official[i], official[i + 1])).units).toBeCloseTo(
        3 * (official[i + 1] - official[i]),
        9,
      );
    }
  });
});

describe('a whole split with drifting reading dates', () => {
  const bill = (): OfficialBill => ({
    billingMonth: 'test',
    readingDate: day(60),
    officialMeter: {
      previous: 0,
      present: 300,
      multiplier: 1,
      previousDate: day(0),
      presentDate: day(60),
    },
    sanctionedLoadKw: 1,
    billingMonths: 2,
    components: [{ id: 'energy', label: 'Energy', spec: { kind: 'perUnit', rate: 900 } }],
  });

  const households = [
    { id: 'ground', name: 'Ground floor', metered: false },
    {
      id: 'first',
      name: 'First floor',
      metered: true,
      // 2/day across a 65-day window: 130 units read, but the bill covers 60.
      reading: {
        previous: 1000,
        present: 1130,
        multiplier: 1,
        previousDate: day(8),
        presentDate: day(73),
      },
    },
  ];

  it('moves the extra days off the sub-meter and onto the residual', () => {
    const r = split(bill(), households);

    expect(r.window?.driftDays).toBe(5);
    expect(r.shares[1].ownRawUnits).toBe(130);
    expect(r.shares[1].ownUnits).toBeCloseTo(120, 9);
    expect(r.residual).toBeCloseTo(180, 9);
    expect(r.warnings.some((w) => w.includes('have been moved'))).toBe(true);
  });

  it('still hands out every paisa', () => {
    const r = split(bill(), households);
    expect(r.shares.reduce((a, s) => a + s.total, 0)).toBe(r.payable);
  });

  it('changes nothing at all when the dates are absent', () => {
    const undated = bill();
    delete undated.officialMeter.previousDate;
    delete undated.officialMeter.presentDate;

    const r = split(undated, households);
    expect(r.window).toBeUndefined();
    expect(r.shares[1].ownUnits).toBe(130);
    expect(r.residual).toBe(170);
  });
});
