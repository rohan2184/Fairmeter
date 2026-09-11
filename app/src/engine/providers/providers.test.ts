import { describe, expect, it } from 'vitest';
import { evaluateComponents, sumComponents } from '../charges';
import { toPaise } from '../money';
import { buildTorrentBill, REFERENCE_BILL } from '../presets/torrent';
import { split } from '../split';
import type { Household } from '../types';
import { buildBill, defaultRates } from './build';
import { PROVIDERS, findPlan, findProvider } from './registry';
import type { ProviderBillInput } from './types';

/** Provider profiles (D-10). */

const input = (over: Partial<ProviderBillInput> = {}): ProviderBillInput => ({
  providerId: 'torrent-ahmedabad',
  planId: 'nonRgp-upto5kw',
  billingMonth: 'July 2026',
  readingDate: '21/07/26',
  officialMeter: { previous: 1775, present: 1936, multiplier: 1 },
  sanctionedLoadKw: 1,
  billingMonths: 2,
  rates: { energy: 4.6, fixed: 70, baseFppas: 3.72, fppas: 3.4, govtDuty: 20 },
  previousDues: 0.23,
  delayedPaymentCharges: 30.28,
  roundingAdjustment: -6.29,
  printedPayable: 1860,
  ...over,
});

const build = (i: ProviderBillInput) => {
  const provider = findProvider(i.providerId);
  return buildBill(provider, findPlan(provider, i.planId), i);
};

const amounts = (i: ProviderBillInput, units = 161) => {
  const bill = build(i);
  const m = new Map<string, number>();
  for (const c of evaluateComponents(bill, units)) m.set(c.id, c.amount);
  return m;
};

describe('Torrent Ahmedabad profile reproduces the reference bill', () => {
  it('matches every printed figure, exactly as the hand-written preset does', () => {
    const a = amounts(input());
    expect(a.get('energy')).toBe(toPaise(740.6));
    expect(a.get('fixed')).toBe(toPaise(140));
    expect(a.get('baseFppas')).toBe(toPaise(598.92));
    expect(a.get('fppas')).toBe(toPaise(50.3));
    expect(a.get('govtDuty')).toBe(toPaise(305.96));
  });

  it('agrees component-for-component with buildTorrentBill()', () => {
    const viaProfile = evaluateComponents(build(input()), 161);
    const viaPreset = evaluateComponents(buildTorrentBill(REFERENCE_BILL), 161);

    expect(viaProfile.map((c) => c.id)).toEqual(viaPreset.map((c) => c.id));
    expect(viaProfile.map((c) => c.amount)).toEqual(viaPreset.map((c) => c.amount));
    expect(sumComponents(viaProfile)).toBe(toPaise(1860));
  });

  it('records which provider and plan produced the bill', () => {
    const bill = build(input());
    expect(bill.providerId).toBe('torrent-ahmedabad');
    expect(bill.planLabel).toContain('Non-RGP');
  });

  it('splits to the paisa through the profile route', () => {
    const r = split(build(input()), [unmetered('ground'), h('first', 81)]);
    expect(r.payable).toBe(toPaise(1860));
    expect(r.shares.reduce((a, s) => a + s.total, 0)).toBe(r.payable);
    expect(r.warnings.filter((w) => w.includes('printed payable'))).toHaveLength(0);
  });
});

describe('slab tariffs (P-02)', () => {
  const rgp = (units: number, billingMonths: number) =>
    amounts(
      input({
        planId: 'rgp-single-phase',
        billingMonths,
        officialMeter: { previous: 0, present: units, multiplier: 1 },
        rates: defaultRates(findPlan(findProvider('torrent-ahmedabad'), 'rgp-single-phase')),
        previousDues: 0,
        delayedPaymentCharges: 0,
        roundingAdjustment: 0,
        printedPayable: undefined,
      }),
      units,
    );

  it('walks the slabs on a one-month bill', () => {
    // 161 units: 50 @ 3.20 + 111 @ 3.95 = 160 + 438.45
    const bill = build(
      input({
        planId: 'rgp-single-phase',
        billingMonths: 1,
        rates: defaultRates(findPlan(findProvider('torrent-ahmedabad'), 'rgp-single-phase')),
      }),
    );
    const a = new Map(evaluateComponents(bill, 161).map((c) => [c.id, c.amount]));
    expect(a.get('energy')).toBe(toPaise(160 + 438.45));
  });

  it('widens every slab by the number of billing months', () => {
    // Over 2 months the first slab holds 100 units, not 50:
    // 100 @ 3.20 + 61 @ 3.95 = 320 + 240.95
    const a = rgp(161, 2);
    expect(a.get('energy')).toBe(toPaise(320 + 240.95));
  });

  it('charges the top slab once the lower ones are exhausted', () => {
    // 1 month, 250 units: 50 @ 3.20 + 150 @ 3.95 + 50 @ 5.00
    const a = rgp(250, 1);
    expect(a.get('energy')).toBe(toPaise(160 + 592.5 + 250));
  });

  it('bills the fixed charge per installation per month, not per kW', () => {
    const a = rgp(161, 2);
    expect(a.get('fixed')).toBe(toPaise(50)); // ₹25/month × 2, whatever the load
  });

  it('still conserves — every household pays the same blended rate', () => {
    const bill = build(
      input({
        planId: 'rgp-single-phase',
        rates: defaultRates(findPlan(findProvider('torrent-ahmedabad'), 'rgp-single-phase')),
        printedPayable: undefined,
      }),
    );
    const r = split(bill, [unmetered('g'), h('a', 55), h('b', 33)]);
    expect(r.shares.reduce((a, s) => a + s.total, 0)).toBe(r.payable);
  });
});

describe('zero rates drop the line item', () => {
  it('removes the component and repairs the percentages that referenced it', () => {
    const bill = build(
      input({
        rates: { energy: 4.6, fixed: 70, baseFppas: 0, fppas: 0, govtDuty: 20 },
        printedPayable: undefined,
      }),
    );
    const ids = bill.components.map((c) => c.id);
    expect(ids).not.toContain('baseFppas');
    expect(ids).not.toContain('fppas');

    // Duty now sits on energy + fixed only: 20% of 880.60
    const a = new Map(evaluateComponents(bill, 161).map((c) => [c.id, c.amount]));
    expect(a.get('govtDuty')).toBe(toPaise(176.12));
  });
});

describe('the catalogue itself', () => {
  it('gives every provider at least one plan and every plan a workable bill', () => {
    for (const provider of PROVIDERS) {
      expect(provider.plans.length, provider.id).toBeGreaterThan(0);

      for (const plan of provider.plans) {
        const bill = buildBill(provider, plan, {
          ...input({ providerId: provider.id, planId: plan.id, printedPayable: undefined }),
          rates: defaultRates(plan),
        });
        // Nothing throws, and every percentage points at a component that exists.
        const total = sumComponents(evaluateComponents(bill, 161));
        expect(Number.isInteger(total), `${provider.id}/${plan.id}`).toBe(true);
      }
    }
  });

  it('has unique provider ids and unique plan ids within a provider', () => {
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
    for (const p of PROVIDERS) {
      expect(new Set(p.plans.map((x) => x.id)).size, p.id).toBe(p.plans.length);
    }
  });

  it('declares a percentage only over components declared before it', () => {
    for (const provider of PROVIDERS) {
      for (const plan of provider.plans) {
        const seen = new Set<string>();
        for (const c of plan.charges) {
          if (c.kind === 'percentOfSubtotal') {
            for (const ref of c.of) {
              expect(seen.has(ref), `${provider.id}/${plan.id}: ${c.id} -> ${ref}`).toBe(true);
            }
          }
          seen.add(c.id);
        }
      }
    }
  });

  it('ends every slab tariff with an unbounded slab', () => {
    for (const provider of PROVIDERS) {
      for (const plan of provider.plans) {
        for (const c of plan.charges) {
          if (c.kind !== 'slabPerUnit') continue;
          const last = c.slabs[c.slabs.length - 1];
          expect(last.widthPerMonth, `${provider.id}/${plan.id}/${c.id}`).toBeUndefined();
        }
      }
    }
  });
});

// helpers -------------------------------------------------------------------

function h(id: string, units: number): Household {
  return { id, name: id, metered: true, reading: { previous: 0, present: units, multiplier: 1 } };
}

function unmetered(id: string): Household {
  return { id, name: id, metered: false };
}
