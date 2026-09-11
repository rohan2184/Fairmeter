import type { MeterReading } from '../types';

/**
 * Provider profiles (D-10).
 *
 * A profile is DATA describing how one utility stacks its charges: which line
 * items exist, in what order, on what basis, and what the published rate is.
 * `build.ts` turns a profile plus the rates the owner typed into the generic
 * ordered component list the engine already understands (D-05) — so adding a
 * utility is a new entry in `registry.ts`, never a change to the engine.
 *
 * Rates live in the profile only as DEFAULTS. Tariffs change every April, fuel
 * surcharges change every cycle, and the bill in the owner's hand always wins.
 * The printed-payable cross-check is what catches a stale default.
 */

/** A slab of a telescopic energy tariff, as printed in the tariff schedule. */
export interface SlabTemplate {
  /** Width in units per month. Omit on the last slab: "remaining units". */
  widthPerMonth?: number;
  /** Published rate in ₹/unit. */
  default: number;
}

export type ChargeTemplate =
  | { kind: 'perUnit'; id: string; label: string; default: number; hint?: string }
  /**
   * A lump sum in rupees, not a rate. For the case where the itemised bill is
   * gone and only the total survives — historical cycles, a bill photographed
   * badly, a provider we do not model. Split pro-rata like everything else
   * (D-01), which is exact: with one ratio per household the split of a total
   * does not depend on how that total was composed.
   */
  | { kind: 'flat'; id: string; label: string; default: number; hint?: string }
  | { kind: 'slabPerUnit'; id: string; label: string; slabs: SlabTemplate[]; hint?: string }
  | { kind: 'perKwPerMonth'; id: string; label: string; default: number; hint?: string }
  | {
      kind: 'perInstallationPerMonth';
      id: string;
      label: string;
      default: number;
      hint?: string;
    }
  | {
      kind: 'percentOfSubtotal';
      id: string;
      label: string;
      default: number;
      of: string[];
      hint?: string;
    };

export interface TariffPlan {
  id: string;
  /** "Non-RGP commercial (up to 5 kW)" */
  label: string;
  /** Who this tariff applies to, quoted from the schedule. */
  applicability: string;
  /** false => the sanctioned-load field is irrelevant to the charges. */
  usesSanctionedLoad: boolean;
  charges: ChargeTemplate[];
}

export interface ProviderProfile {
  id: string;
  name: string;
  shortName: string;
  /** "Ahmedabad & Gandhinagar" */
  area: string;
  ownership: 'private' | 'state';
  regulator: string;
  /**
   * 'verified'   — transcribed from the regulator's tariff order, and for
   *                Torrent Ahmedabad additionally reproduced by the golden test
   *                against the reference bill.
   * 'indicative' — the structure is right, the rates come from secondary
   *                sources. Check them against your bill before trusting them.
   */
  confidence: 'verified' | 'indicative';
  source: string;
  effectiveFrom: string;
  notes?: string[];
  plans: TariffPlan[];
}

/** Everything the owner copies off the paper bill, in rupees as printed. */
export interface ProviderBillInput {
  providerId: string;
  planId: string;

  billingMonth: string;
  readingDate: string;
  officialMeter: MeterReading;
  sanctionedLoadKw: number;
  billingMonths: number;

  /** Keyed by `rateKey(charge)` / `slabRateKey(charge, i)`. Rupees or percent. */
  rates: Record<string, number>;

  previousDues?: number;
  delayedPaymentCharges?: number;
  otherDebitCredit?: number;
  /** Negative: the bill is rounded DOWN and the remainder carried forward. */
  roundingAdjustment?: number;

  printedPayable?: number;
}
