import { describe, expect, it } from 'vitest';
import { split, validate } from './split';
import { buildTorrentBill, REFERENCE_BILL } from './presets/torrent';
import type { CommonMeter, Household } from './types';

/**
 * Shared-load meters (D-09) — the water pump, the porch light, the lift.
 *
 * The reference bill is 161 official units throughout.
 */

const bill = buildTorrentBill(REFERENCE_BILL);

describe('shared meters (D-09)', () => {
  it('shares measured common load pro-rata, on top of own consumption', () => {
    const r = split(bill, [h('a', 90), h('b', 30)], {
      commonMeters: [pump(20)],
    });

    expect(r.commonUnits).toBe(20);
    expect(r.meteredUnits).toBe(120);
    expect(r.residual).toBe(161 - 120 - 20); // 21, shared pro-rata (nobody is unmetered)

    // own + residual first, then the pump shared in proportion to THAT — the
    // weight base is 141 own-and-residual units, not the 161 on the bill.
    const baseA = 90 + 21 * (90 / 120);
    const baseB = 30 + 21 * (30 / 120);
    expect(r.shares[0].units).toBeCloseTo(baseA + 20 * (baseA / 141), 9);
    expect(r.shares[1].units).toBeCloseTo(baseB + 20 * (baseB / 141), 9);
    expect(r.shares[0].units + r.shares[1].units).toBeCloseTo(161, 9);
  });

  it('shares it equally when asked — a lift serves everyone the same', () => {
    const r = split(bill, [h('a', 100), h('b', 20)], {
      commonMeters: [pump(21)],
      commonPolicy: { kind: 'equalSplit' },
    });
    expect(r.shares[0].commonUnits).toBeCloseTo(10.5, 9);
    expect(r.shares[1].commonUnits).toBeCloseTo(10.5, 9);
  });

  it('charges it all to one household when asked', () => {
    const r = split(bill, [h('a', 100), h('b', 20)], {
      commonMeters: [pump(21)],
      commonPolicy: { kind: 'assignTo', householdId: 'b' },
    });
    expect(r.shares[0].commonUnits).toBe(0);
    expect(r.shares[1].commonUnits).toBe(21);
  });

  it('does NOT dump shared load on the unmetered household', () => {
    // The spreadsheet's mistake in reverse: with a motor meter present, the
    // unmetered household takes only the genuinely unaccounted units.
    const r = split(bill, [unmetered('ground'), h('first', 100)], {
      commonMeters: [pump(11)],
    });

    expect(r.commonUnits).toBe(11);
    expect(r.residual).toBe(50); // 161 - 100 - 11
    expect(r.shares[0].ownUnits).toBe(0);
    expect(r.shares[0].residualUnits).toBe(50);
    expect(r.shares[1].residualUnits).toBe(0);

    // 11 pump units split 50 : 100, not handed to the ground floor whole.
    expect(r.shares[0].commonUnits).toBeCloseTo(11 * (50 / 150), 9);
    expect(r.shares[1].commonUnits).toBeCloseTo(11 * (100 / 150), 9);
  });

  it('keeps several shared meters itemised', () => {
    const r = split(bill, [h('a', 100), h('b', 30)], {
      commonMeters: [pump(10), { id: 'lift', name: 'Lift', reading: reading(5) }],
    });
    expect(r.commonMeters).toEqual([
      { id: 'pump', name: 'Motor / water pump', units: 10, rawUnits: 10 },
      { id: 'lift', name: 'Lift', units: 5, rawUnits: 5 },
    ]);
    expect(r.commonUnits).toBe(15);
  });

  it('conserves both units and money with shared meters in play', () => {
    const cases: [string, Household[], CommonMeter[]][] = [
      ['unmetered + metered + pump', [unmetered('g'), h('f', 100)], [pump(11)]],
      ['three metered + two shared', [h('a', 40), h('b', 40), h('c', 40)], [pump(7), { id: 'l', name: 'Lift', reading: reading(4) }]],
      ['shared meter is the whole bill', [h('a', 0), h('b', 0)], [pump(161)]],
      ['shared meter reads zero', [unmetered('g'), h('f', 80)], [pump(0)]],
    ];

    for (const [name, households, commonMeters] of cases) {
      const r = split(bill, households, { commonMeters });
      const units = r.shares.reduce((a, s) => a + s.units, 0);
      const money = r.shares.reduce((a, s) => a + s.total, 0);
      expect(units, name).toBeCloseTo(r.officialUnits, 9);
      expect(money, name).toBe(r.payable);
    }
  });

  it('rejects a rolled-back shared meter and a clashing id', () => {
    expect(
      validate(bill, [h('a', 10)], {
        commonMeters: [{ id: 'p', name: 'Pump', reading: { previous: 50, present: 40, multiplier: 1 } }],
      }).some((i) => i.includes('lower than')),
    ).toBe(true);

    expect(
      validate(bill, [h('a', 10)], { commonMeters: [{ id: 'a', name: 'Pump', reading: reading(5) }] }).some(
        (i) => i.includes('Duplicate meter id'),
      ),
    ).toBe(true);
  });

  it('still accepts the old bare-policy third argument', () => {
    const r = split(bill, [h('a', 120), h('b', 30)], { kind: 'equalSplit' });
    expect(r.shares[0].units).toBeCloseTo(125.5, 9);
  });
});

// helpers -------------------------------------------------------------------

const reading = (units: number) => ({ previous: 0, present: units, multiplier: 1 });

const pump = (units: number): CommonMeter => ({
  id: 'pump',
  name: 'Motor / water pump',
  reading: reading(units),
});

function h(id: string, units: number): Household {
  return { id, name: id, metered: true, reading: reading(units) };
}

function unmetered(id: string): Household {
  return { id, name: id, metered: false };
}
