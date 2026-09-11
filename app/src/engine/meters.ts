import { alignReading } from './align';
import type {
  Alignment,
  CommonMeter,
  CommonMeterUnits,
  Household,
  MeterReading,
  ReadingWindow,
  ResidualPolicy,
  Units,
  WindowSummary,
} from './types';

/**
 * Meter reading -> units, then attribution of everything nobody's own meter
 * claims. See SPEC.md §2 steps 1-2.
 *
 * There are TWO kinds of shared consumption and they are not the same thing:
 *
 *   common meters  — measured shared load (pump, lift, porch light). Known
 *                    exactly, belongs to everyone, shared by `commonPolicy`.
 *   residual       — official units minus every meter above. Unknown by
 *                    construction: the unmetered household's own consumption,
 *                    plus meter tolerance and reading-date drift.
 */

export function unitsOf(reading: MeterReading): Units {
  return (reading.present - reading.previous) * (reading.multiplier || 1);
}

export interface HouseholdUnits {
  householdId: string;
  /** Own sub-meter units, lined up with the bill's window (0 if unmetered). */
  ownUnits: Units;
  /** What the sub-meter itself showed, before that alignment (D-13). */
  ownRawUnits: Units;
  /** Portion attributed from the unmetered residual. */
  residualUnits: Units;
  /** Portion attributed from the common meters. */
  commonUnits: Units;
  /** ownUnits + residualUnits + commonUnits */
  units: Units;
}

export interface MeterBreakdown {
  officialUnits: Units;
  meteredUnits: Units;
  commonUnits: Units;
  commonMeters: CommonMeterUnits[];
  residual: Units;
  perHousehold: HouseholdUnits[];
  window?: WindowSummary;
  warnings: string[];
}

export interface AttributionOptions {
  residualPolicy?: ResidualPolicy;
  commonMeters?: CommonMeter[];
  commonPolicy?: ResidualPolicy;
  /** The bill's reading window. Enables window alignment (D-13). */
  billWindow?: ReadingWindow;
}

export function computeUnits(
  officialUnits: Units,
  households: Household[],
  options: AttributionOptions = {},
): MeterBreakdown {
  const residualPolicy = options.residualPolicy ?? { kind: 'proRata' };
  const commonPolicy = options.commonPolicy ?? { kind: 'proRata' };
  const commonMeters = options.commonMeters ?? [];
  const warnings: string[] = [];
  const n = households.length;

  // 1. Each household's own metered consumption, lined up with the window the
  //    bill actually charges for (D-13). Without reading dates this is exactly
  //    the raw meter delta, as it always was.
  const window = options.billWindow;
  const alignments = new Map<string, Alignment>();
  const measure = (id: string, reading: MeterReading): Units => {
    const a = alignReading(reading, window);
    alignments.set(id, a);
    return a.units;
  };

  const own = households.map((h) => (h.metered && h.reading ? measure(h.id, h.reading) : 0));
  const meteredTotal = own.reduce((a, b) => a + b, 0);

  // 2. Measured shared load.
  const perCommon: CommonMeterUnits[] = commonMeters.map((m) => ({
    id: m.id,
    name: m.name,
    units: measure(m.id, m.reading),
    rawUnits: alignments.get(m.id)!.rawUnits,
  }));
  const commonTotal = perCommon.reduce((a, m) => a + m.units, 0);

  // 3. What is left over is nobody's measured consumption.
  const residual = officialUnits - meteredTotal - commonTotal;

  // 4. The residual lands on the unmetered household if there is one — that is
  //    the whole definition of "unmetered" (D-08). Otherwise it is shared.
  const residualShare = new Array<number>(n).fill(0);
  const unmeteredIndex = households.findIndex((h) => !h.metered);

  if (unmeteredIndex >= 0) {
    residualShare[unmeteredIndex] = residual;
  } else if (residual !== 0) {
    apportion(residual, residualPolicy, households, own, meteredTotal, residualShare);
  }

  // 5. Own consumption is now known for every household. Common-meter units are
  //    shared on top of THAT — pro-rata means "in proportion to what you
  //    actually used", which includes the unmetered household's residual.
  const base = own.map((u, i) => u + residualShare[i]);
  const baseTotal = base.reduce((a, b) => a + b, 0);
  const commonShare = new Array<number>(n).fill(0);
  if (commonTotal !== 0 && n > 0) {
    apportion(commonTotal, commonPolicy, households, base, baseTotal, commonShare);
  }

  const window_ = summarise([...alignments.values()]);
  if (window_) {
    if (Math.abs(window_.adjustment) >= 0.05) {
      const moved = Math.abs(window_.adjustment).toFixed(2);
      warnings.push(
        `The sub-meters cover ${window_.meterDays.toFixed(0)} days, the bill covers ` +
          `${window_.billDays.toFixed(0)} — they were read ${Math.abs(window_.driftDays).toFixed(0)} ` +
          `day(s) ${window_.driftDays > 0 ? 'later' : 'earlier'} than the utility read the ` +
          `official meter. ${moved} units have been moved ` +
          `${window_.adjustment < 0 ? 'off the sub-meters' : 'onto the sub-meters'} so both ` +
          `cover the same window; untouched, that difference would have fallen entirely on ` +
          `whoever takes the unaccounted units.`,
      );
    }
    if (window_.extrapolated) {
      warnings.push(
        `No sub-meter reading exists from before this bill's window, so the rate for its ` +
          `opening days was extrapolated. This cycle's alignment is an estimate; from the ` +
          `next cycle on there is a reading either side and it becomes exact.`,
      );
    }
  } else if (options.billWindow && alignments.size > 0) {
    warnings.push(
      `Reading dates are only half filled in, so the sub-meters were taken at face value. ` +
        `Enter when each meter was read and any difference between their window and the ` +
        `bill's is corrected instead of landing on the unmetered household.`,
    );
  }

  if (residual < 0) {
    warnings.push(
      `Sub-meters recorded ${(-residual).toFixed(2)} units MORE than the official meter. ` +
        `Check the reading dates and multipliers — the extra is being distributed, not ignored.`,
    );
  } else if (unmeteredIndex < 0 && officialUnits > 0 && residual / officialUnits > 0.3) {
    // Only worth saying when EVERY household is metered. With an unmetered
    // household the residual is that household's consumption by definition
    // (D-08) — a big one means they used a lot, not that anything is wrong,
    // and crying wolf every cycle teaches the owner to ignore the warnings.
    warnings.push(
      `${residual.toFixed(2)} units (${((residual / officialUnits) * 100).toFixed(1)}% of the bill) ` +
        `are unaccounted for by any sub-meter.`,
    );
  }

  return {
    officialUnits,
    meteredUnits: meteredTotal,
    commonUnits: commonTotal,
    commonMeters: perCommon,
    residual,
    perHousehold: households.map((h, i) => ({
      householdId: h.id,
      ownUnits: own[i],
      ownRawUnits: alignments.get(h.id)?.rawUnits ?? 0,
      residualUnits: residualShare[i],
      commonUnits: commonShare[i],
      units: base[i] + commonShare[i],
    })),
    window: window_,
    warnings,
  };
}

/** Cycle-level view of what alignment did. Undefined when nothing was aligned. */
function summarise(alignments: Alignment[]): WindowSummary | undefined {
  const aligned = alignments.filter((a) => a.aligned);
  if (aligned.length === 0 || aligned.length !== alignments.length) return undefined;

  // Meters are normally all read on the same day; if they are not, the longest
  // window is the one worth reporting.
  const meterDays = Math.max(...aligned.map((a) => a.meterDays));
  const billDays = aligned[0].billDays;

  return {
    billDays,
    meterDays,
    driftDays: meterDays - billDays,
    adjustment: aligned.reduce((a, x) => a + x.adjustment, 0),
    extrapolated: aligned.some((a) => a.extrapolated),
  };
}

/**
 * Hand `amount` units out across the households by `policy`, writing into `out`.
 * `weights` / `weightTotal` drive the pro-rata case.
 */
function apportion(
  amount: Units,
  policy: ResidualPolicy,
  households: Household[],
  weights: number[],
  weightTotal: number,
  out: number[],
): void {
  const n = households.length;
  if (n === 0) return;

  switch (policy.kind) {
    case 'equalSplit':
      for (let i = 0; i < n; i++) out[i] += amount / n;
      return;

    case 'assignTo': {
      const i = households.findIndex((h) => h.id === policy.householdId);
      if (i < 0) throw new Error(`policy.assignTo: unknown household ${policy.householdId}`);
      out[i] += amount;
      return;
    }

    case 'proRata':
    default:
      if (weightTotal === 0) {
        for (let i = 0; i < n; i++) out[i] += amount / n;
      } else {
        for (let i = 0; i < n; i++) out[i] += amount * (weights[i] / weightTotal);
      }
  }
}
