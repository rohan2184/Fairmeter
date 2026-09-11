import { buildBill, defaultRates } from '../engine/providers/build';
import {
  DEFAULT_PLAN_ID,
  DEFAULT_PROVIDER_ID,
  findPlan,
  findProvider,
} from '../engine/providers/registry';
import type { ProviderBillInput } from '../engine/providers/types';
import type {
  CommonMeter,
  Household,
  MeterReading,
  OfficialBill,
  SplitOptions,
} from '../engine/types';
import type { CommonMeterRecord, HouseholdRecord, SavedCycle } from '../storage/types';

/**
 * Form state is held as STRINGS, not numbers. Parsing on every keystroke turns
 * "4." into NaN and yanks the character back out of the field while the user is
 * still typing "4.6". Parse once, at calculation time.
 */

export interface BillFields {
  providerId: string;
  planId: string;

  billingMonth: string;
  /** `yyyy-mm-dd` — when the utility read the meter for THIS bill. */
  readingDate: string;
  /** `yyyy-mm-dd` — the reading date this bill's window opens on (D-13). */
  previousReadingDate: string;
  /**
   * When the sub-meters were read. One set of dates for all of them, because
   * that is how it happens: the owner walks round the building once. `prior` is
   * the round before `previous`, rolled forward automatically.
   */
  submeterPriorDate: string;
  submeterPreviousDate: string;
  submeterReadingDate: string;
  officialPrevious: string;
  officialPresent: string;
  officialMultiplier: string;
  sanctionedLoadKw: string;
  billingMonths: string;

  /** Keyed by the plan's rate keys. Whatever the plan does not define is ignored. */
  rates: Record<string, string>;

  previousDues: string;
  delayedPaymentCharges: string;
  otherDebitCredit: string;
  roundingAdjustment: string;
  printedPayable: string;
}

export interface HouseholdRow {
  id: string;
  name: string;
  metered: boolean;
  previous: string;
  present: string;
  multiplier: string;
  /** Reading before `previous`. Filled by rolling a cycle forward, not typed. */
  prior: string;
}

/** A shared-load sub-meter: pump, lift, porch light (D-09). */
export interface CommonMeterRow {
  id: string;
  name: string;
  previous: string;
  present: string;
  multiplier: string;
  prior: string;
}

export const num = (s: string): number => {
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : 0;
};

/** An empty date field means "not known", which is not the same as a bad date. */
const date = (s: string): string | undefined => (s.trim() === '' ? undefined : s.trim());

const asStrings = (rates: Record<string, number>): Record<string, string> =>
  Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, String(v)]));

/** The published defaults for a plan, as form strings. */
export function ratesFor(providerId: string, planId: string): Record<string, string> {
  const provider = findProvider(providerId);
  return asStrings(defaultRates(findPlan(provider, planId)));
}

/**
 * Switching provider or plan swaps the whole rate sheet — the keys of one plan
 * mean nothing under another. Everything else about the bill survives.
 */
export function withPlan(bill: BillFields, providerId: string, planId: string): BillFields {
  const provider = findProvider(providerId);
  const plan = findPlan(provider, planId);
  return {
    ...bill,
    providerId: provider.id,
    planId: plan.id,
    rates: ratesFor(provider.id, plan.id),
  };
}

export const blankBill = (): BillFields => ({
  providerId: DEFAULT_PROVIDER_ID,
  planId: DEFAULT_PLAN_ID,
  billingMonth: '',
  readingDate: '',
  previousReadingDate: '',
  submeterPriorDate: '',
  submeterPreviousDate: '',
  submeterReadingDate: '',
  officialPrevious: '',
  officialPresent: '',
  officialMultiplier: '1',
  sanctionedLoadKw: '1',
  billingMonths: '2',
  rates: ratesFor(DEFAULT_PROVIDER_ID, DEFAULT_PLAN_ID),
  previousDues: '',
  delayedPaymentCharges: '',
  otherDebitCredit: '',
  roundingAdjustment: '',
  printedPayable: '',
});

/** Pre-fills the form with the repo's reference bill, for demoing and testing. */
export const sampleBill = (): BillFields => ({
  ...blankBill(),
  billingMonth: 'July 2026',
  // The bill prints its own reading date but not the previous one, so the
  // window stays open and this cycle is not aligned. Rolling it forward fills
  // the next cycle's opening date automatically.
  readingDate: '2026-07-21',
  officialPrevious: '1775',
  officialPresent: '1936',
  officialMultiplier: '1',
  sanctionedLoadKw: '1',
  billingMonths: '2',
  rates: {
    energy: '4.60',
    fixed: '70',
    baseFppas: '3.72',
    fppas: '3.40',
    govtDuty: '20',
  },
  previousDues: '0.23',
  delayedPaymentCharges: '30.28',
  roundingAdjustment: '-6.29',
  printedPayable: '1860',
});

export function toProviderInput(b: BillFields): ProviderBillInput {
  return {
    providerId: b.providerId,
    planId: b.planId,
    billingMonth: b.billingMonth || 'this cycle',
    readingDate: b.readingDate,
    officialMeter: {
      previous: num(b.officialPrevious),
      present: num(b.officialPresent),
      multiplier: num(b.officialMultiplier) || 1,
      previousDate: date(b.previousReadingDate),
      presentDate: date(b.readingDate),
    },
    sanctionedLoadKw: num(b.sanctionedLoadKw),
    billingMonths: num(b.billingMonths),
    rates: Object.fromEntries(Object.entries(b.rates).map(([k, v]) => [k, num(v)])),
    previousDues: num(b.previousDues),
    delayedPaymentCharges: num(b.delayedPaymentCharges),
    otherDebitCredit: num(b.otherDebitCredit),
    roundingAdjustment: num(b.roundingAdjustment),
    printedPayable: b.printedPayable.trim() === '' ? undefined : num(b.printedPayable),
  };
}

export function toOfficialBill(input: ProviderBillInput): OfficialBill {
  const provider = findProvider(input.providerId);
  return buildBill(provider, findPlan(provider, input.planId), input);
}

/**
 * Sub-meter reading dates, which every sub-meter on the cycle shares. Kept
 * separate from the rows because the owner reads the whole building in one go.
 */
export interface SubmeterDates {
  priorDate: string;
  previousDate: string;
  presentDate: string;
}

export const submeterDates = (b: BillFields): SubmeterDates => ({
  priorDate: b.submeterPriorDate,
  previousDate: b.submeterPreviousDate,
  presentDate: b.submeterReadingDate,
});

/** Readings plus the cycle's dates make the curve the aligner walks (D-13). */
const readingOf = (
  m: { previous: number; present: number; multiplier: number; prior?: number },
  d: SubmeterDates,
): MeterReading => ({
  previous: m.previous,
  present: m.present,
  multiplier: m.multiplier || 1,
  previousDate: date(d.previousDate),
  presentDate: date(d.presentDate),
  prior:
    m.prior === undefined || date(d.priorDate) === undefined
      ? undefined
      : { value: m.prior, date: d.priorDate.trim() },
});

const toReading = (
  r: { previous: string; present: string; multiplier: string; prior: string },
  d: SubmeterDates,
): MeterReading =>
  readingOf(
    {
      previous: num(r.previous),
      present: num(r.present),
      multiplier: num(r.multiplier) || 1,
      prior: r.prior.trim() === '' ? undefined : num(r.prior),
    },
    d,
  );

export function toHouseholds(rows: HouseholdRow[], dates: SubmeterDates): Household[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name.trim() || r.id,
    metered: r.metered,
    reading: r.metered ? toReading(r, dates) : undefined,
  }));
}

export function toCommonMeters(rows: CommonMeterRow[], dates: SubmeterDates): CommonMeter[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name.trim() || 'Shared load',
    reading: toReading(r, dates),
  }));
}

const prior = (r: { prior: string }) => (r.prior.trim() === '' ? undefined : num(r.prior));

export function toRecords(rows: HouseholdRow[]): HouseholdRecord[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    metered: r.metered,
    previous: num(r.previous),
    present: num(r.present),
    multiplier: num(r.multiplier) || 1,
    prior: prior(r),
  }));
}

export function toCommonRecords(rows: CommonMeterRow[]): CommonMeterRecord[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    previous: num(r.previous),
    present: num(r.present),
    multiplier: num(r.multiplier) || 1,
    prior: prior(r),
  }));
}

/**
 * A saved cycle, ready for the engine. One place, so history totals, the golden
 * seed test and anything the backend grows later cannot drift apart.
 */
export function toEngineInputs(cycle: SavedCycle): {
  bill: OfficialBill;
  households: Household[];
  options: SplitOptions;
} {
  const dates: SubmeterDates = {
    priorDate: cycle.submeterPriorDate ?? '',
    previousDate: cycle.submeterPreviousDate ?? '',
    presentDate: cycle.submeterReadingDate ?? '',
  };
  return {
    bill: toOfficialBill(cycle.bill),
    households: cycle.households.map((h) => ({
      id: h.id,
      name: h.name,
      metered: h.metered,
      reading: h.metered ? readingOf(h, dates) : undefined,
    })),
    options: {
      residualPolicy: cycle.policy,
      commonMeters: (cycle.commonMeters ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        reading: readingOf(m, dates),
      })),
      commonPolicy: cycle.commonPolicy ?? { kind: 'proRata' },
    },
  };
}

export interface LoadedCycle {
  bill: BillFields;
  rows: HouseholdRow[];
  commonRows: CommonMeterRow[];
}

export function fromCycle(cycle: SavedCycle): LoadedCycle {
  const b = cycle.bill;
  const s = (n: number | undefined) => (n === undefined || n === 0 ? '' : String(n));
  return {
    bill: {
      providerId: b.providerId,
      planId: b.planId,
      billingMonth: b.billingMonth,
      readingDate: b.officialMeter.presentDate ?? b.readingDate,
      previousReadingDate: b.officialMeter.previousDate ?? '',
      submeterPriorDate: cycle.submeterPriorDate ?? '',
      submeterPreviousDate: cycle.submeterPreviousDate ?? '',
      submeterReadingDate: cycle.submeterReadingDate ?? '',
      officialPrevious: String(b.officialMeter.previous),
      officialPresent: String(b.officialMeter.present),
      officialMultiplier: String(b.officialMeter.multiplier),
      sanctionedLoadKw: String(b.sanctionedLoadKw),
      billingMonths: String(b.billingMonths),
      rates: asStrings(b.rates),
      previousDues: s(b.previousDues),
      delayedPaymentCharges: s(b.delayedPaymentCharges),
      otherDebitCredit: s(b.otherDebitCredit),
      roundingAdjustment: s(b.roundingAdjustment),
      printedPayable: s(b.printedPayable),
    },
    rows: cycle.households.map((h) => ({
      id: h.id,
      name: h.name,
      metered: h.metered,
      previous: String(h.previous),
      present: String(h.present),
      multiplier: String(h.multiplier),
      prior: h.prior === undefined ? '' : String(h.prior),
    })),
    commonRows: (cycle.commonMeters ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      previous: String(m.previous),
      present: String(m.present),
      multiplier: String(m.multiplier),
      prior: m.prior === undefined ? '' : String(m.prior),
    })),
  };
}

/**
 * Roll a saved cycle forward: this cycle's PRESENT readings become the next
 * cycle's PREVIOUS readings. This is the single biggest source of manual error
 * the app removes.
 */
export function nextCycleFrom(cycle: SavedCycle): LoadedCycle {
  const { bill, rows, commonRows } = fromCycle(cycle);
  // The reading that is `previous` today becomes `prior` tomorrow. That third
  // point is what lets the next cycle interpolate its opening date instead of
  // extrapolating it (D-13) — it costs the owner nothing, so always keep it.
  const roll = <T extends { previous: string; present: string; prior: string }>(r: T): T => ({
    ...r,
    prior: r.previous,
    previous: r.present,
    present: '',
  });
  return {
    bill: {
      ...bill,
      billingMonth: '',
      readingDate: '',
      previousReadingDate: bill.readingDate,
      submeterPriorDate: bill.submeterPreviousDate,
      submeterPreviousDate: bill.submeterReadingDate,
      submeterReadingDate: '',
      officialPrevious: bill.officialPresent,
      officialPresent: '',
      previousDues: '',
      delayedPaymentCharges: '',
      otherDebitCredit: '',
      roundingAdjustment: '',
      printedPayable: '',
    },
    rows: rows.map(roll),
    commonRows: commonRows.map(roll),
  };
}

let counter = 0;
/** Ids only need to be unique within a bill; no clock or randomness needed. */
export const newId = (): string => `h${Date.now().toString(36)}${(counter++).toString(36)}`;

export const blankRow = (name: string, metered = true): HouseholdRow => ({
  id: newId(),
  name,
  metered,
  previous: '',
  present: '',
  multiplier: '1',
  prior: '',
});

export const blankCommonRow = (name: string): CommonMeterRow => ({
  id: newId(),
  name,
  previous: '',
  present: '',
  multiplier: '1',
  prior: '',
});
