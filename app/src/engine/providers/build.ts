import { toPaise } from '../money';
import type { ChargeComponent, OfficialBill, Slab } from '../types';
import type { ChargeTemplate, ProviderBillInput, ProviderProfile, TariffPlan } from './types';

/**
 * Provider profile + typed rates -> the generic OfficialBill the engine eats.
 * See providers/types.ts for why the rates are not baked in.
 */

export const rateKey = (c: ChargeTemplate): string => c.id;
export const slabRateKey = (c: ChargeTemplate, i: number): string => `${c.id}#${i}`;

/** Every editable rate field a plan exposes, with its published default. */
export function defaultRates(plan: TariffPlan): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of plan.charges) {
    if (c.kind === 'slabPerUnit') {
      c.slabs.forEach((s, i) => (out[slabRateKey(c, i)] = s.default));
    } else {
      out[rateKey(c)] = c.default;
    }
  }
  return out;
}

const value = (rates: Record<string, number>, key: string, fallback: number): number => {
  const v = rates[key];
  return v === undefined || Number.isNaN(v) ? fallback : v;
};

function toComponent(c: ChargeTemplate, rates: Record<string, number>): ChargeComponent {
  switch (c.kind) {
    case 'perUnit': {
      const rate = value(rates, rateKey(c), c.default);
      return {
        id: c.id,
        label: `${c.label} @ ₹${rate}/unit`,
        spec: { kind: 'perUnit', rate: toPaise(rate) },
      };
    }

    case 'flat': {
      const amount = value(rates, rateKey(c), c.default);
      return { id: c.id, label: c.label, spec: { kind: 'flat', amount: toPaise(amount) } };
    }

    case 'slabPerUnit': {
      const slabs: Slab[] = c.slabs.map((s, i) => ({
        widthPerMonth: s.widthPerMonth,
        rate: toPaise(value(rates, slabRateKey(c, i), s.default)),
      }));
      return {
        id: c.id,
        label: `${c.label} (${slabs.length} slabs)`,
        spec: { kind: 'slabPerUnit', slabs },
      };
    }

    case 'perKwPerMonth': {
      const rate = value(rates, rateKey(c), c.default);
      return {
        id: c.id,
        label: `${c.label} @ ₹${rate}/kW/month`,
        spec: { kind: 'perKwPerMonth', rate: toPaise(rate) },
      };
    }

    case 'perInstallationPerMonth': {
      const rate = value(rates, rateKey(c), c.default);
      return {
        id: c.id,
        label: `${c.label} @ ₹${rate}/month`,
        spec: { kind: 'perInstallationPerMonth', amount: toPaise(rate) },
      };
    }

    case 'percentOfSubtotal': {
      const percent = value(rates, rateKey(c), c.default);
      return {
        id: c.id,
        label: `${c.label} @ ${percent}%`,
        spec: { kind: 'percentOfSubtotal', percent, of: c.of },
      };
    }
  }
}

/** A charge whose rate is zero is not on this bill at all. */
function isZero(c: ChargeTemplate, rates: Record<string, number>): boolean {
  if (c.kind === 'slabPerUnit') {
    return c.slabs.every((s, i) => value(rates, slabRateKey(c, i), s.default) === 0);
  }
  return value(rates, rateKey(c), c.default) === 0;
}

export function buildBill(
  profile: ProviderProfile,
  plan: TariffPlan,
  input: ProviderBillInput,
): OfficialBill {
  // Drop zero-rated lines, then repair the percentage components that referred
  // to them — otherwise `percentOfSubtotal` would point at an id that no longer
  // exists and the engine would (correctly) refuse to evaluate the bill.
  const kept = plan.charges.filter((c) => !isZero(c, input.rates));
  const keptIds = new Set(kept.map((c) => c.id));
  const components = kept.map((c) =>
    toComponent(
      c.kind === 'percentOfSubtotal' ? { ...c, of: c.of.filter((id) => keptIds.has(id)) } : c,
      input.rates,
    ),
  );

  const accountLevel: [string, string, number | undefined][] = [
    ['previousDues', 'Previous dues', input.previousDues],
    ['dpc', 'Delayed payment charges', input.delayedPaymentCharges],
    ['other', 'Other debit / credit', input.otherDebitCredit],
    ['rounding', 'Round-off adjustment', input.roundingAdjustment],
  ];

  for (const [id, label, amount] of accountLevel) {
    if (amount === undefined || amount === 0) continue;
    components.push({
      id,
      label,
      spec: { kind: 'flat', amount: toPaise(amount) },
      accountLevel: true,
    });
  }

  return {
    billingMonth: input.billingMonth,
    readingDate: input.readingDate,
    officialMeter: input.officialMeter,
    // Plans without a per-kW charge ignore this, but validate() insists it is
    // positive, so never hand the engine a zero it cannot use.
    sanctionedLoadKw: plan.usesSanctionedLoad ? input.sanctionedLoadKw : input.sanctionedLoadKw || 1,
    billingMonths: input.billingMonths,
    components,
    printedPayable:
      input.printedPayable === undefined ? undefined : toPaise(input.printedPayable),
    providerId: profile.id,
    providerName: profile.name,
    planId: plan.id,
    planLabel: plan.label,
  };
}
