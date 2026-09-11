import type { MeterReading, ResidualPolicy } from '../engine/types';

/**
 * Storage contract. The UI depends on THIS, never on localStorage directly, so
 * the future backend (D-03) is a second implementation rather than a rewrite.
 */

export interface HouseholdRecord {
  id: string;
  name: string;
  metered: boolean;
  previous: number;
  present: number;
  multiplier: number;
  /**
   * The reading before `previous`. Rolled forward automatically by
   * `nextCycleFrom`, never typed: it is what lets the next cycle align its
   * window exactly instead of extrapolating (D-13).
   */
  prior?: number;
}

/** A shared-load sub-meter: pump, lift, porch light (D-09). */
export interface CommonMeterRecord {
  id: string;
  name: string;
  previous: number;
  present: number;
  multiplier: number;
  prior?: number;
}

/** The bill as typed, in rupees. Provider-shaped rather than Torrent-shaped (D-10). */
export interface CycleBill {
  providerId: string;
  planId: string;
  billingMonth: string;
  /**
   * When the utility read the official meter, `yyyy-mm-dd`. The date the bill's
   * window OPENS on lives on `officialMeter.previousDate` (D-13).
   */
  readingDate: string;
  officialMeter: MeterReading;
  sanctionedLoadKw: number;
  billingMonths: number;
  rates: Record<string, number>;
  previousDues?: number;
  delayedPaymentCharges?: number;
  otherDebitCredit?: number;
  roundingAdjustment?: number;
  printedPayable?: number;
}

export interface SavedCycle {
  id: string;
  /** ISO timestamp, supplied by the caller — the engine and store stay clock-free. */
  savedAt: string;
  label: string;
  bill: CycleBill;
  households: HouseholdRecord[];
  /** Absent on cycles saved before D-09 shipped. */
  commonMeters?: CommonMeterRecord[];
  /**
   * When the sub-meters were read — all of them on one day, which is how it
   * actually happens. `prior` is the reading day before `previous`, rolled
   * forward automatically. All `yyyy-mm-dd`, all optional (D-13).
   */
  submeterPriorDate?: string;
  submeterPreviousDate?: string;
  submeterReadingDate?: string;
  /** Where the unmetered residual goes when every household is metered. */
  policy: ResidualPolicy;
  /** How common-meter units are shared. Absent => pro-rata. */
  commonPolicy?: ResidualPolicy;
}

export interface CycleStore {
  list(): SavedCycle[];
  get(id: string): SavedCycle | undefined;
  save(cycle: SavedCycle): void;
  remove(id: string): void;
  /** JSON dump — the migration path to a backend, and the user's backup. */
  exportAll(): string;
  importAll(json: string, mode?: 'merge' | 'replace'): number;
}
