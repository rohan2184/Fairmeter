import { describe, expect, it } from 'vitest';
import { evaluateComponents } from '../engine/charges';
import { toPaise } from '../engine/money';
import { buildBill } from '../engine/providers/build';
import { findPlan, findProvider } from '../engine/providers/registry';
import { migrateCycle } from './migrate';
import type { SavedCycle } from './types';

/**
 * Cycles saved before provider profiles (D-10) must keep producing the same
 * numbers. A history that silently re-prices itself is worse than no history.
 */

const legacy = {
  id: 'c1',
  savedAt: '2026-07-21T00:00:00.000Z',
  label: 'July 2026',
  bill: {
    billingMonth: 'July 2026',
    readingDate: '21/07/26',
    officialMeter: { previous: 1775, present: 1936, multiplier: 1 },
    sanctionedLoadKw: 1,
    billingMonths: 2,
    energyRate: 4.6,
    fixedChargeRate: 70,
    baseFppasRate: 3.72,
    fppasPercent: 3.4,
    govtDutyPercent: 20,
    previousDues: 0.23,
    delayedPaymentCharges: 30.28,
    roundingAdjustment: -6.29,
    printedPayable: 1860,
  },
  households: [{ id: 'a', name: 'Owner', metered: false, previous: 0, present: 0, multiplier: 1 }],
  policy: { kind: 'proRata' },
} as unknown as SavedCycle;

describe('legacy cycle migration', () => {
  it('maps a Torrent-shaped bill onto the Torrent Non-RGP plan', () => {
    const bill = migrateCycle(legacy).bill;
    expect(bill.providerId).toBe('torrent-ahmedabad');
    expect(bill.planId).toBe('nonRgp-upto5kw');
    expect(bill.rates).toEqual({
      energy: 4.6,
      fixed: 70,
      baseFppas: 3.72,
      fppas: 3.4,
      govtDuty: 20,
    });
    expect(bill.printedPayable).toBe(1860);
  });

  it('re-prices to exactly the same total it was saved with', () => {
    const bill = migrateCycle(legacy).bill;
    const provider = findProvider(bill.providerId);
    const built = buildBill(provider, findPlan(provider, bill.planId), bill);
    const total = evaluateComponents(built, 161).reduce((a, c) => a + c.amount, 0);
    expect(total).toBe(toPaise(1860));
  });

  it('picks the 5–15 kW plan when the fixed charge says so', () => {
    const bigger = {
      ...legacy,
      bill: { ...(legacy.bill as unknown as Record<string, unknown>), fixedChargeRate: 90 },
    } as unknown as SavedCycle;
    expect(migrateCycle(bigger).bill.planId).toBe('nonRgp-5to15kw');
  });

  it('leaves an already-migrated cycle untouched', () => {
    const modern = migrateCycle(legacy);
    expect(migrateCycle(modern)).toBe(modern);
  });
});
