/**
 * Core domain types. See SPEC.md §1.3.
 *
 * Money is ALWAYS integer paise. Never floats — a float rupee value cannot
 * represent 0.23 exactly and the conservation guarantee would break.
 */

/** Integer minor units (1 rupee = 100 paise). */
export type Paise = number;

/** kWh consumed. May be fractional when a meter multiplier applies. */
export type Units = number;

export interface MeterReading {
  previous: number;
  present: number;
  /** Meter constant. 1.00 on the reference bill. */
  multiplier: number;
  /**
   * When the readings were taken, as `yyyy-mm-dd`. Optional: a bill with no
   * dates behaves exactly as it did before window alignment existed (D-13).
   *
   * On the OFFICIAL meter these two define the window the bill charges for.
   * On a sub-meter they say when that meter was actually read, which is rarely
   * the same day — the utility reads on the 28th, the owner reads when the bill
   * turns up.
   */
  previousDate?: string;
  presentDate?: string;
  /**
   * The reading before `previous`, with its date. Lets the aligner walk the
   * meter's curve back past `previousDate` rather than extrapolating, which is
   * what makes consecutive bills partition consumption exactly (D-13).
   */
  prior?: { value: number; date: string };
}

/** The span a bill charges for: the official meter's two reading dates. */
export interface ReadingWindow {
  previousDate: string;
  presentDate: string;
}

/** What window alignment did to one meter. See engine/align.ts. */
export interface Alignment {
  /** Units between the meter's own two readings — what the meter itself shows. */
  rawUnits: Units;
  /** Units attributed to the bill's window. Equals rawUnits when not aligned. */
  units: Units;
  /** units − rawUnits. Positive: this meter is being charged for more than it read. */
  adjustment: Units;
  /** Length of the meter's own window, in days. 0 when unknown. */
  meterDays: number;
  /** Length of the bill's window, in days. 0 when unknown. */
  billDays: number;
  /** false => dates were missing or unusable, and the raw units were kept. */
  aligned: boolean;
  /**
   * true => the bill's window starts before this meter's earliest known
   * reading, so its rate had to be extrapolated backwards. An estimate rather
   * than an interpolation; it stops happening once a cycle has history.
   */
  extrapolated: boolean;
}

export interface Household {
  id: string;
  /** "Ground floor", "Shop 16", "Common Area" — free text. */
  name: string;
  /**
   * false => this household's units are DERIVED as the residual
   * (official units minus every metered household's units, minus common
   * meters). At most one household in a bill may be unmetered. See D-08.
   */
  metered: boolean;
  /** Required iff `metered`. */
  reading?: MeterReading;
}

/**
 * A sub-meter on load that belongs to NOBODY in particular: the water pump,
 * the porch light, the lift, the stair lighting (D-09).
 *
 * It is not a household. Its units are measured, then shared out across the
 * households by `commonPolicy` — unlike the unmetered residual, which lands
 * wholly on the unmetered household.
 */
export interface CommonMeter {
  id: string;
  /** "Motor / water pump", "Porch light", "Lift". */
  name: string;
  reading: MeterReading;
}

/** One slab of a telescopic energy tariff. */
export interface Slab {
  /**
   * Width of this slab in units PER MONTH. Bills covering more than one month
   * widen every slab accordingly — a 60-day Torrent RGP bill gets 100 units at
   * the first-slab rate, not 50. Omit on the last slab: "remaining units".
   */
  widthPerMonth?: number;
  rate: Paise;
}

export type ChargeSpec =
  | { kind: 'perUnit'; rate: Paise }
  /** Telescopic slabs (P-02). Evaluated on the WHOLE bill, then split pro-rata. */
  | { kind: 'slabPerUnit'; slabs: Slab[] }
  | { kind: 'flat'; amount: Paise }
  | { kind: 'perKwPerMonth'; rate: Paise }
  /** Fixed charge that ignores load entirely — Torrent RGP, BSES, MSEDCL. */
  | { kind: 'perInstallationPerMonth'; amount: Paise }
  | { kind: 'percentOfSubtotal'; percent: number; of: string[] };

export interface ChargeComponent {
  id: string;
  label: string;
  spec: ChargeSpec;
  /**
   * Dues, delayed payment charges, rounding adjustment: they belong to the
   * account rather than to any meter. Still split pro-rata per D-02, but
   * flagged so the UI can itemise them separately.
   */
  accountLevel?: boolean;
}

export interface OfficialBill {
  billingMonth: string;
  readingDate: string;
  officialMeter: MeterReading;
  sanctionedLoadKw: number;
  /** 60-day cycle => 2. Drives perKwPerMonth components and slab widths. */
  billingMonths: number;
  components: ChargeComponent[];
  /** The printed "amount payable" — cross-checked against the computed total. */
  printedPayable?: Paise;
  /** Provenance, for the printed statement and history. Purely descriptive. */
  providerId?: string;
  providerName?: string;
  planId?: string;
  planLabel?: string;
}

/**
 * How to divide units that no single household's meter claims.
 *
 * Used in two places: the unmetered residual when every household IS metered,
 * and always for common-meter units (D-09).
 */
export type ResidualPolicy =
  | { kind: 'proRata' }
  | { kind: 'equalSplit' }
  | { kind: 'assignTo'; householdId: string };

export interface SplitOptions {
  /** Where the unmetered gap goes when no household is unmetered. */
  residualPolicy?: ResidualPolicy;
  /** Metered shared load: pump, lift, porch light (D-09). */
  commonMeters?: CommonMeter[];
  /** How common-meter units are shared out. Defaults to pro-rata (D-09). */
  commonPolicy?: ResidualPolicy;
  /**
   * Overrides the window taken from the official meter's own reading dates.
   * Rarely needed — the bill is the authority on what it charges for (D-13).
   */
  billWindow?: ReadingWindow;
}

export interface ShareLine {
  componentId: string;
  label: string;
  amount: Paise;
  accountLevel: boolean;
}

export interface HouseholdShare {
  householdId: string;
  name: string;
  units: Units;
  /** Units read off this household's own sub-meter (0 if unmetered). */
  ownUnits: Units;
  /**
   * What the sub-meter itself showed, before its window was lined up with the
   * bill's (D-13). Differs from ownUnits only when reading dates are known and
   * the meter was read on a different day from the utility's reading.
   */
  ownRawUnits: Units;
  /** How much of `units` came from the unmetered residual. */
  residualUnits: Units;
  /** How much of `units` came from the shared common meters (D-09). */
  commonUnits: Units;
  ratio: number;
  lines: ShareLine[];
  total: Paise;
}

export interface ComponentAmount {
  id: string;
  label: string;
  amount: Paise;
  accountLevel: boolean;
}

export interface CommonMeterUnits {
  id: string;
  name: string;
  units: Units;
  rawUnits: Units;
}

/** Cycle-level summary of window alignment, for the UI to explain itself. */
export interface WindowSummary {
  /** Days the bill charges for. */
  billDays: number;
  /** Days the sub-meters covered. Sub-meters read on one day share this. */
  meterDays: number;
  /** meterDays − billDays. Positive: the meters ran ahead of the bill. */
  driftDays: number;
  /** Net units moved off the sub-meters and onto the residual (or back). */
  adjustment: Units;
  /** Some meter had to be extrapolated backwards — this cycle is an estimate. */
  extrapolated: boolean;
}

export interface SplitResult {
  officialUnits: Units;
  /** Sum of the households' own sub-meters. Excludes common meters. */
  meteredUnits: Units;
  /** Sum of the common meters (D-09). */
  commonUnits: Units;
  commonMeters: CommonMeterUnits[];
  /** official − household meters − common meters. Still never discarded. */
  residual: Units;
  /** Present only when reading dates made window alignment possible (D-13). */
  window?: WindowSummary;
  components: ComponentAmount[];
  payable: Paise;
  shares: HouseholdShare[];
  warnings: string[];
}

export class ValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues.join('\n'));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
