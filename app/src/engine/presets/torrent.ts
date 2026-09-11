import { toPaise } from '../money';
import type { ChargeComponent, MeterReading, OfficialBill } from '../types';

/**
 * Torrent Power (Ahmedabad) LT bill preset. See SPEC.md §1.4.
 *
 * The form is Torrent-shaped but the output is a generic ordered component
 * list, so another utility is a new preset rather than a rewrite (D-05).
 */

export const GOVT_DUTY_BY_CATEGORY = {
  residential: 15,
  commercial: 20,
  industrial: 10,
  religious: 15,
  hostel: 11.25,
} as const;

export type TorrentCategory = keyof typeof GOVT_DUTY_BY_CATEGORY;

/** Printed tariff table, ₹/unit and ₹/kW/month, for pre-filling the form. */
export const TORRENT_TARIFFS = {
  nonRgpUpto5kW: { rate: 4.6, fixedPerKwPerMonth: 70 },
  nonRgp5to15kW: { rate: 4.6, fixedPerKwPerMonth: 90 },
} as const;

/** Everything the owner copies off the paper bill. Rupees, as printed. */
export interface TorrentInput {
  billingMonth: string;
  readingDate: string;
  officialMeter: MeterReading;
  sanctionedLoadKw: number;
  billingMonths: number;

  energyRate: number;          // ₹/unit
  fixedChargeRate: number;     // ₹/kW/month
  baseFppasRate: number;       // ₹/unit
  fppasPercent: number;        // % of (energy + fixed + base FPPAS)
  govtDutyPercent: number;     // % of the subtotal above

  previousDues?: number;
  delayedPaymentCharges?: number;
  otherDebitCredit?: number;
  /** Negative: the bill is rounded DOWN and the remainder carried forward. */
  roundingAdjustment?: number;

  printedPayable?: number;
}

export function buildTorrentBill(input: TorrentInput): OfficialBill {
  const components: ChargeComponent[] = [
    {
      id: 'energy',
      label: 'Energy charges',
      spec: { kind: 'perUnit', rate: toPaise(input.energyRate) },
    },
    {
      id: 'fixed',
      label: 'Fixed charges',
      spec: { kind: 'perKwPerMonth', rate: toPaise(input.fixedChargeRate) },
    },
    {
      id: 'baseFppas',
      label: `Base FPPAS @ ₹${input.baseFppasRate}/unit`,
      spec: { kind: 'perUnit', rate: toPaise(input.baseFppasRate) },
    },
    {
      id: 'fppas',
      label: `FPPAS charges @ ${input.fppasPercent}%`,
      spec: {
        kind: 'percentOfSubtotal',
        percent: input.fppasPercent,
        of: ['energy', 'fixed', 'baseFppas'],
      },
    },
    {
      id: 'govtDuty',
      label: `Government duty @ ${input.govtDutyPercent}%`,
      spec: {
        kind: 'percentOfSubtotal',
        percent: input.govtDutyPercent,
        of: ['energy', 'fixed', 'baseFppas', 'fppas'],
      },
    },
  ];

  const accountLevel: [string, string, number | undefined][] = [
    ['previousDues', 'Previous dues', input.previousDues],
    ['dpc', 'Delayed payment charges', input.delayedPaymentCharges],
    ['other', 'Other debit / credit', input.otherDebitCredit],
    ['rounding', 'Round-off adjustment', input.roundingAdjustment],
  ];

  for (const [id, label, value] of accountLevel) {
    if (value === undefined || value === 0) continue;
    components.push({
      id,
      label,
      spec: { kind: 'flat', amount: toPaise(value) },
      accountLevel: true,
    });
  }

  return {
    billingMonth: input.billingMonth,
    readingDate: input.readingDate,
    officialMeter: input.officialMeter,
    sanctionedLoadKw: input.sanctionedLoadKw,
    billingMonths: input.billingMonths,
    components,
    printedPayable:
      input.printedPayable === undefined ? undefined : toPaise(input.printedPayable),
  };
}

/** The reference bill shipped with the repo (100113210.pdf), July 2026. */
export const REFERENCE_BILL: TorrentInput = {
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
};
