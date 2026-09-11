import { roundHalfUp } from './money';
import type { ChargeComponent, ComponentAmount, OfficialBill, Units } from './types';

/**
 * Evaluate the bill's charge components against the whole-bill totals.
 * See SPEC.md §2 step 3.
 *
 * Components are evaluated in declaration order so `percentOfSubtotal` can only
 * reference components already computed — that mirrors how the printed bill
 * stacks FPPAS on (energy + fixed + base FPPAS), then government duty on all of
 * it.
 */
export function evaluateComponents(
  bill: OfficialBill,
  officialUnits: Units,
): ComponentAmount[] {
  const out: ComponentAmount[] = [];
  const byId = new Map<string, number>();

  for (const c of bill.components) {
    const amount = evaluateOne(c, bill, officialUnits, byId);
    byId.set(c.id, amount);
    out.push({
      id: c.id,
      label: c.label,
      amount,
      accountLevel: c.accountLevel ?? false,
    });
  }
  return out;
}

function evaluateOne(
  c: ChargeComponent,
  bill: OfficialBill,
  officialUnits: Units,
  computed: Map<string, number>,
): number {
  switch (c.spec.kind) {
    case 'perUnit':
      return roundHalfUp(c.spec.rate * officialUnits);

    /**
     * Telescopic slabs (P-02). Slab widths are quoted per month, so a 60-day
     * bill gets twice the width — that is how the utilities bill a two-month
     * cycle, and getting it wrong pushes units into a dearer slab.
     *
     * The slabs are applied to the WHOLE official reading, exactly once. Each
     * household then pays its pro-rata share of the result, i.e. everybody pays
     * the same blended average rate. Splitting slabs per household instead
     * would charge the heavy user the marginal rate — a different policy, and
     * one that would not sum back to the bill.
     */
    case 'slabPerUnit': {
      let remaining = officialUnits;
      let total = 0;
      for (const slab of c.spec.slabs) {
        if (remaining <= 0) break;
        const width =
          slab.widthPerMonth === undefined
            ? Infinity
            : slab.widthPerMonth * bill.billingMonths;
        const take = Math.min(remaining, width);
        total += slab.rate * take;
        remaining -= take;
      }
      if (remaining > 0) {
        throw new Error(
          `Slab tariff for "${c.id}" does not cover all ${officialUnits} units — ` +
            `the last slab must have no width limit.`,
        );
      }
      return roundHalfUp(total);
    }

    case 'perKwPerMonth':
      return roundHalfUp(c.spec.rate * bill.sanctionedLoadKw * bill.billingMonths);

    case 'perInstallationPerMonth':
      return roundHalfUp(c.spec.amount * bill.billingMonths);

    case 'flat':
      return c.spec.amount;

    case 'percentOfSubtotal': {
      let subtotal = 0;
      for (const ref of c.spec.of) {
        if (!computed.has(ref)) {
          throw new Error(
            `Component "${c.id}" references "${ref}", which is not defined before it.`,
          );
        }
        subtotal += computed.get(ref)!;
      }
      return roundHalfUp((c.spec.percent / 100) * subtotal);
    }
  }
}

export function sumComponents(components: ComponentAmount[]): number {
  return components.reduce((a, c) => a + c.amount, 0);
}
