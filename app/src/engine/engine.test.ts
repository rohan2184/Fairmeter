import { describe, expect, it } from 'vitest';
import { evaluateComponents } from './charges';
import { allocate, toPaise } from './money';
import { split, validate } from './split';
import { buildTorrentBill, REFERENCE_BILL } from './presets/torrent';
import type { Household } from './types';

const bill = buildTorrentBill(REFERENCE_BILL);
const amounts = () => {
  const m = new Map<string, number>();
  for (const c of evaluateComponents(bill, 161)) m.set(c.id, c.amount);
  return m;
};

describe('reference bill 100113210.pdf — every printed figure', () => {
  it('reads 161 units off the official meter', () => {
    expect(split(bill, [h('a', 161)]).officialUnits).toBe(161);
  });

  it('reproduces each printed component to the paisa', () => {
    const a = amounts();
    expect(a.get('energy')).toBe(toPaise(740.6));      // 161 × ₹4.60
    expect(a.get('fixed')).toBe(toPaise(140));         // ₹70 × 1 kW × 2 months
    expect(a.get('baseFppas')).toBe(toPaise(598.92));  // 161 × ₹3.72
    expect(a.get('fppas')).toBe(toPaise(50.3));        // 3.40% of 1479.52
    expect(a.get('govtDuty')).toBe(toPaise(305.96));   // 20% of 1529.82
  });

  it('reproduces the printed subtotals', () => {
    const a = amounts();
    const withoutDuty =
      a.get('energy')! + a.get('fixed')! + a.get('baseFppas')! + a.get('fppas')!;
    expect(withoutDuty).toBe(toPaise(1529.82));
    expect(withoutDuty + a.get('govtDuty')!).toBe(toPaise(1835.78));

    const amountDue = withoutDuty + a.get('govtDuty')! + a.get('previousDues')! + a.get('dpc')!;
    expect(amountDue).toBe(toPaise(1866.29));
    expect(amountDue + a.get('rounding')!).toBe(toPaise(1860));
  });

  it('totals to the printed payable with no mismatch warning', () => {
    const r = split(bill, [h('a', 100), h('b', 61)]);
    expect(r.payable).toBe(toPaise(1860));
    expect(r.warnings.filter((w) => w.includes('printed payable'))).toHaveLength(0);
  });
});

describe('conservation — shares always sum back to the bill', () => {
  const cases: [string, Household[]][] = [
    ['owner unmetered + one tenant', [unmetered('owner'), h('t1', 90)]],
    ['owner unmetered + three tenants', [unmetered('owner'), h('t1', 55), h('t2', 33), h('t3', 21)]],
    ['absent owner, all metered', [h('t1', 70), h('t2', 50), h('t3', 30)]],
    ['awkward thirds', [h('a', 53), h('b', 54), h('c', 54)]],
    ['one household takes everything', [unmetered('owner'), h('t1', 0)]],
    ['zero consumption everywhere', [h('a', 0), h('b', 0), unmetered('c')]],
    ['fractional multiplier', [{ id: 'x', name: 'X', metered: true, reading: { previous: 100, present: 120, multiplier: 1.5 } }, unmetered('owner')]],
  ];

  for (const [name, households] of cases) {
    it(name, () => {
      const r = split(bill, households);
      const sum = r.shares.reduce((a, s) => a + s.total, 0);
      expect(sum).toBe(r.payable);

      // and per component, not just in aggregate
      for (const c of r.components) {
        const partSum = r.shares.reduce(
          (a, s) => a + s.lines.find((l) => l.componentId === c.id)!.amount,
          0,
        );
        expect(partSum).toBe(c.amount);
      }

      // units conserve too
      const units = r.shares.reduce((a, s) => a + s.units, 0);
      expect(units).toBeCloseTo(r.officialUnits, 9);
    });
  }
});

describe('residual attribution (D-08)', () => {
  it('gives the whole residual to the unmetered household', () => {
    const r = split(bill, [unmetered('owner'), h('t1', 100), h('t2', 25)]);
    expect(r.residual).toBe(36);
    expect(r.shares[0].units).toBe(36);
    expect(r.shares[0].residualUnits).toBe(36);
    expect(r.shares[1].residualUnits).toBe(0);
  });

  it('splits common load pro-rata when every household is metered', () => {
    const r = split(bill, [h('a', 120), h('b', 30)]);
    expect(r.residual).toBe(11);
    expect(r.shares[0].units).toBeCloseTo(120 + 11 * (120 / 150), 9);
    expect(r.shares[1].units).toBeCloseTo(30 + 11 * (30 / 150), 9);
  });

  it('splits common load equally when asked', () => {
    const r = split(bill, [h('a', 120), h('b', 30)], { kind: 'equalSplit' });
    expect(r.shares[0].units).toBeCloseTo(125.5, 9);
    expect(r.shares[1].units).toBeCloseTo(35.5, 9);
  });

  it('assigns common load to a nominated household', () => {
    const r = split(bill, [h('a', 120), h('b', 30)], { kind: 'assignTo', householdId: 'b' });
    expect(r.shares[0].units).toBe(120);
    expect(r.shares[1].units).toBe(41);
  });

  it('warns but still conserves when sub-meters exceed the official meter', () => {
    const r = split(bill, [unmetered('owner'), h('t1', 200)]);
    expect(r.residual).toBe(-39);
    expect(r.warnings.some((w) => w.includes('MORE than the official meter'))).toBe(true);
    expect(r.shares.reduce((a, s) => a + s.total, 0)).toBe(r.payable);
  });

  it('warns when a large share is unaccounted for and every household is metered', () => {
    const r = split(bill, [h('a', 10), h('t1', 10)]);
    expect(r.warnings.some((w) => w.includes('unaccounted for'))).toBe(true);
  });

  it('stays quiet about the residual when a household is deliberately unmetered', () => {
    // The residual IS the unmetered household's consumption (D-08), so a large
    // one is the normal case rather than something to flag.
    const r = split(bill, [unmetered('owner'), h('t1', 10)]);
    expect(r.warnings).toEqual([]);
  });
});

describe('validation', () => {
  it('rejects two unmetered households', () => {
    const issues = validate(bill, [unmetered('a'), unmetered('b')]);
    expect(issues.some((i) => i.includes('Only one household'))).toBe(true);
  });

  it('rejects a rolled-back sub-meter', () => {
    const bad: Household = {
      id: 'x', name: 'X', metered: true,
      reading: { previous: 500, present: 400, multiplier: 1 },
    };
    expect(validate(bill, [bad]).some((i) => i.includes('lower than'))).toBe(true);
  });

  it('rejects a metered household with no reading', () => {
    expect(
      validate(bill, [{ id: 'x', name: 'X', metered: true }]).some((i) =>
        i.includes('no reading'),
      ),
    ).toBe(true);
  });

  it('rejects duplicate ids and empty household lists', () => {
    expect(validate(bill, [h('a', 1), h('a', 2)]).some((i) => i.includes('Duplicate'))).toBe(true);
    expect(validate(bill, []).some((i) => i.includes('at least one'))).toBe(true);
  });

  it('warns when the typed rates do not reproduce the printed payable', () => {
    const wrong = buildTorrentBill({ ...REFERENCE_BILL, energyRate: 5.6 });
    const r = split(wrong, [unmetered('owner'), h('t1', 80)]);
    expect(r.warnings.some((w) => w.includes('printed payable'))).toBe(true);
  });
});

describe('allocate()', () => {
  it('never loses or invents a paisa', () => {
    expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('handles negative amounts (the round-down adjustment)', () => {
    const parts = allocate(-629, [161, 0]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-629);
  });

  it('falls back to an equal split when nobody consumed anything', () => {
    expect(allocate(300, [0, 0, 0])).toEqual([100, 100, 100]);
  });

  it('is deterministic on ties', () => {
    expect(allocate(10, [1, 1, 1])).toEqual(allocate(10, [1, 1, 1]));
  });
});

describe('worked example the owner can check by hand', () => {
  it('80/81 split of the reference bill', () => {
    const r = split(bill, [unmetered('owner'), h('tenant', 81)]);
    // owner 80 units, tenant 81 units, of 161. Payable ₹1,860.00.
    expect(r.shares[0].units).toBe(80);
    expect(r.shares[1].units).toBe(81);
    expect(r.shares[0].total + r.shares[1].total).toBe(186000);
    // Splitting component-by-component lands within a paisa or two of the
    // naive ratio × total (81/161 × 186000 = 93577.6…) — the difference is the
    // largest-remainder rounding, and it never escapes the bill.
    expect(r.shares[1].total).toBeGreaterThanOrEqual(93570);
    expect(r.shares[1].total).toBeLessThanOrEqual(93586);
  });
});

// helpers -------------------------------------------------------------------

function h(id: string, units: number): Household {
  return {
    id,
    name: id,
    metered: true,
    reading: { previous: 0, present: units, multiplier: 1 },
  };
}

function unmetered(id: string): Household {
  return { id, name: id, metered: false };
}
