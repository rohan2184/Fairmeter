import { isValidDate } from './align';
import { evaluateComponents, sumComponents } from './charges';
import { computeUnits, unitsOf } from './meters';
import { allocate, formatRupees } from './money';
import {
  ValidationError,
  type Household,
  type HouseholdShare,
  type OfficialBill,
  type MeterReading,
  type ReadingWindow,
  type ResidualPolicy,
  type ShareLine,
  type SplitOptions,
  type SplitResult,
} from './types';

/**
 * The whole calculation. Pure: no storage, no DOM, no clock.
 *
 * Every component is split by one ratio (units_i / official units), per
 * D-01/D-02/D-04 — fixed charges, surcharges, duty, arrears and the round-down
 * adjustment alike. Allocation uses the largest-remainder method so each
 * component's parts sum back to it exactly, and therefore every household's
 * total sums back to the payable amount exactly.
 */
export function split(
  bill: OfficialBill,
  households: Household[],
  options: SplitOptions | ResidualPolicy = {},
): SplitResult {
  const opts = normalise(options);
  const issues = validate(bill, households, opts);
  if (issues.length) throw new ValidationError(issues);

  const officialUnits = unitsOf(bill.officialMeter);
  const meters = computeUnits(officialUnits, households, {
    ...opts,
    billWindow: opts.billWindow ?? officialWindow(bill.officialMeter),
  });
  const components = evaluateComponents(bill, officialUnits);
  const payable = sumComponents(components);

  const weights = meters.perHousehold.map((h) => h.units);
  const lines: ShareLine[][] = households.map(() => []);

  for (const c of components) {
    const parts = allocate(c.amount, weights);
    parts.forEach((amount, i) => {
      lines[i].push({
        componentId: c.id,
        label: c.label,
        amount,
        accountLevel: c.accountLevel,
      });
    });
  }

  const shares: HouseholdShare[] = households.map((h, i) => ({
    householdId: h.id,
    name: h.name,
    units: meters.perHousehold[i].units,
    ownUnits: meters.perHousehold[i].ownUnits,
    ownRawUnits: meters.perHousehold[i].ownRawUnits,
    residualUnits: meters.perHousehold[i].residualUnits,
    commonUnits: meters.perHousehold[i].commonUnits,
    ratio: officialUnits === 0 ? 0 : meters.perHousehold[i].units / officialUnits,
    lines: lines[i],
    total: lines[i].reduce((a, l) => a + l.amount, 0),
  }));

  const warnings = [...meters.warnings];
  if (bill.printedPayable !== undefined && bill.printedPayable !== payable) {
    const delta = payable - bill.printedPayable;
    warnings.push(
      `Computed total ₹${formatRupees(payable)} does not match the printed payable ` +
        `₹${formatRupees(bill.printedPayable)} (off by ₹${formatRupees(Math.abs(delta))}). ` +
        `Re-check the rates and readings you entered.`,
    );
  }

  return {
    officialUnits,
    meteredUnits: meters.meteredUnits,
    commonUnits: meters.commonUnits,
    commonMeters: meters.commonMeters,
    residual: meters.residual,
    window: meters.window,
    components,
    payable,
    shares,
    warnings,
  };
}

/**
 * Accepts either a bare ResidualPolicy (the pre-common-meter signature, still
 * used by tests and older saved cycles) or the full options object.
 */
function normalise(options: SplitOptions | ResidualPolicy): SplitOptions {
  return 'kind' in options ? { residualPolicy: options } : options;
}

/**
 * Reading dates are optional, but a half-typed or backwards one is a mistake
 * worth stopping for — silently ignoring it would quietly disable alignment.
 */
function dateIssues(what: string, reading: MeterReading): string[] {
  const out: string[] = [];
  for (const [label, value] of [
    ['previous', reading.previousDate],
    ['present', reading.presentDate],
    ['earlier', reading.prior?.date],
  ] as const) {
    if (value !== undefined && value !== '' && !isValidDate(value)) {
      out.push(`${what}: "${value}" is not a ${label} reading date in yyyy-mm-dd form.`);
    }
  }

  const { previousDate, presentDate } = reading;
  if (isValidDate(previousDate) && isValidDate(presentDate) && presentDate! <= previousDate!) {
    out.push(
      `${what}: it was read on ${presentDate} and previously on ${previousDate} — the ` +
        `present reading must be the later one.`,
    );
  }
  return out;
}

/** The span the bill charges for, when the official meter carries both dates. */
export function officialWindow(meter: MeterReading): ReadingWindow | undefined {
  if (!isValidDate(meter.previousDate) || !isValidDate(meter.presentDate)) return undefined;
  return { previousDate: meter.previousDate!, presentDate: meter.presentDate! };
}

export function validate(
  bill: OfficialBill,
  households: Household[],
  options: SplitOptions | ResidualPolicy = {},
): string[] {
  const opts = normalise(options);
  const issues: string[] = [];

  if (households.length === 0) {
    issues.push('Add at least one household.');
  }

  const unmetered = households.filter((h) => !h.metered);
  if (unmetered.length > 1) {
    issues.push(
      `Only one household can be without a sub-meter (${unmetered
        .map((h) => h.name || h.id)
        .join(', ')} are all unmetered). With two unknowns and one official ` +
        `reading there is no way to tell their consumption apart.`,
    );
  }

  const ids = new Set<string>();
  for (const h of households) {
    if (ids.has(h.id)) issues.push(`Duplicate household id "${h.id}".`);
    ids.add(h.id);

    if (h.metered) {
      if (!h.reading) {
        issues.push(`"${h.name || h.id}" is metered but has no reading.`);
      } else if (h.reading.present < h.reading.previous) {
        issues.push(
          `"${h.name || h.id}": present reading (${h.reading.present}) is lower than ` +
            `previous (${h.reading.previous}).`,
        );
      }
    }
  }

  for (const m of opts.commonMeters ?? []) {
    if (ids.has(m.id)) issues.push(`Duplicate meter id "${m.id}".`);
    ids.add(m.id);
    if (m.reading.present < m.reading.previous) {
      issues.push(
        `Shared meter "${m.name || m.id}": present reading (${m.reading.present}) is lower ` +
          `than previous (${m.reading.previous}).`,
      );
    }
  }

  for (const [what, reading] of [
    ['the official meter', bill.officialMeter] as const,
    ...households
      .filter((h) => h.metered && h.reading)
      .map((h) => [`"${h.name || h.id}"`, h.reading!] as const),
    ...(opts.commonMeters ?? []).map((c) => [`shared meter "${c.name || c.id}"`, c.reading] as const),
  ]) {
    issues.push(...dateIssues(what, reading));
  }

  const m = bill.officialMeter;
  if (m.present < m.previous) {
    issues.push(
      `Official meter: present reading (${m.present}) is lower than previous (${m.previous}).`,
    );
  } else if (unitsOf(m) <= 0) {
    issues.push('Official meter shows zero units consumed — nothing to split.');
  }

  if (bill.billingMonths <= 0) issues.push('Billing months must be greater than zero.');
  if (bill.sanctionedLoadKw <= 0) issues.push('Sanctioned load must be greater than zero.');

  for (const [policy, what] of [
    [opts.residualPolicy, 'absorb common load'],
    [opts.commonPolicy, 'take the shared meters'],
  ] as const) {
    if (policy?.kind === 'assignTo' && !households.some((h) => h.id === policy.householdId)) {
      issues.push(`The household chosen to ${what} no longer exists.`);
    }
  }

  return issues;
}
