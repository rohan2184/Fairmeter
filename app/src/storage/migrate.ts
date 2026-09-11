import type { CycleBill, SavedCycle } from './types';

/**
 * Cycles saved before provider profiles (D-10) stored a Torrent-shaped bill:
 * flat `energyRate` / `fixedChargeRate` / `baseFppasRate` / `fppasPercent` /
 * `govtDutyPercent` fields and no provider at all. Map them onto the Torrent
 * Ahmedabad Non-RGP plan, which is exactly what they were.
 *
 * Migration happens on read, not as a one-shot rewrite: an export taken from an
 * older browser can be imported here and still work.
 */

interface LegacyBill {
  billingMonth: string;
  readingDate: string;
  officialMeter: { previous: number; present: number; multiplier: number };
  sanctionedLoadKw: number;
  billingMonths: number;
  energyRate: number;
  fixedChargeRate: number;
  baseFppasRate: number;
  fppasPercent: number;
  govtDutyPercent: number;
  previousDues?: number;
  delayedPaymentCharges?: number;
  otherDebitCredit?: number;
  roundingAdjustment?: number;
  printedPayable?: number;
}

const isLegacy = (bill: unknown): bill is LegacyBill =>
  !!bill &&
  typeof bill === 'object' &&
  !('providerId' in bill) &&
  'energyRate' in bill;

function migrateBill(legacy: LegacyBill): CycleBill {
  return {
    providerId: 'torrent-ahmedabad',
    planId: legacy.fixedChargeRate > 70 ? 'nonRgp-5to15kw' : 'nonRgp-upto5kw',
    billingMonth: legacy.billingMonth,
    readingDate: legacy.readingDate,
    officialMeter: legacy.officialMeter,
    sanctionedLoadKw: legacy.sanctionedLoadKw,
    billingMonths: legacy.billingMonths,
    rates: {
      energy: legacy.energyRate,
      fixed: legacy.fixedChargeRate,
      baseFppas: legacy.baseFppasRate,
      fppas: legacy.fppasPercent,
      govtDuty: legacy.govtDutyPercent,
    },
    previousDues: legacy.previousDues,
    delayedPaymentCharges: legacy.delayedPaymentCharges,
    otherDebitCredit: legacy.otherDebitCredit,
    roundingAdjustment: legacy.roundingAdjustment,
    printedPayable: legacy.printedPayable,
  };
}

/**
 * `readingDate` used to be free text and was typed the way the bill prints it,
 * `21/07/26`. Window alignment (D-13) needs a real date, so translate what can
 * be translated. Anything else is left alone: it is a display string, and the
 * engine simply does not align a cycle whose dates it cannot read.
 */
export function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(value.trim());
  if (!m) return value;

  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function migrateCycle(cycle: SavedCycle): SavedCycle {
  const legacy = isLegacy(cycle.bill);
  const bill = legacy ? migrateBill(cycle.bill as unknown as LegacyBill) : cycle.bill;
  const readingDate = toIsoDate(bill.readingDate) ?? '';

  // Nothing to do: hand back the same object so a re-read does not churn.
  if (!legacy && readingDate === bill.readingDate) return cycle;
  return { ...cycle, bill: { ...bill, readingDate } };
}

export const migrateCycles = (cycles: SavedCycle[]): SavedCycle[] => cycles.map(migrateCycle);
