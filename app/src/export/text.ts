import { formatRupees } from '../engine/money';
import type { HouseholdShare, SplitResult } from '../engine/types';

/**
 * Plain-text summaries, formatted for pasting into WhatsApp (D-07).
 * No markdown tables — they render as noise in chat apps.
 */

export function householdMessage(
  result: SplitResult,
  share: HouseholdShare,
  billingMonth: string,
): string {
  const lines: string[] = [];
  lines.push(`*Electricity — ${billingMonth}*`);
  lines.push(`${share.name}`);
  lines.push('');
  lines.push(
    `Units used: ${fmtUnits(share.units)} of ${fmtUnits(result.officialUnits)} ` +
      `(${(share.ratio * 100).toFixed(1)}%)`,
  );
  if (share.commonUnits !== 0) {
    lines.push(`  incl. ${fmtUnits(share.commonUnits)} units of shared load (pump, lights)`);
  }
  if (share.residualUnits !== 0) {
    lines.push(`  incl. ${fmtUnits(share.residualUnits)} units not measured by any sub-meter`);
  }
  lines.push('');

  for (const l of share.lines) {
    if (l.amount === 0) continue;
    lines.push(`${l.label}: ₹${formatRupees(l.amount)}`);
  }

  lines.push('');
  lines.push(`*Your share: ₹${formatRupees(share.total)}*`);
  lines.push('');
  lines.push(`(Total bill ₹${formatRupees(result.payable)} for ${fmtUnits(result.officialUnits)} units)`);
  return lines.join('\n');
}

export function fullSummary(result: SplitResult, billingMonth: string): string {
  const lines: string[] = [];
  lines.push(`*Electricity bill split — ${billingMonth}*`);
  lines.push(
    `Official meter: ${fmtUnits(result.officialUnits)} units · Total ₹${formatRupees(result.payable)}`,
  );
  lines.push(
    `Household sub-meters: ${fmtUnits(result.meteredUnits)} units` +
      (result.commonUnits !== 0 ? ` · Shared meters: ${fmtUnits(result.commonUnits)} units` : '') +
      ` · Unaccounted: ${fmtUnits(result.residual)} units`,
  );
  for (const m of result.commonMeters) {
    lines.push(`  ${m.name}: ${fmtUnits(m.units)} units`);
  }
  lines.push('');
  for (const s of result.shares) {
    lines.push(
      `${s.name} — ${fmtUnits(s.units)} units — ₹${formatRupees(s.total)} (${(s.ratio * 100).toFixed(1)}%)`,
    );
  }
  lines.push('');
  lines.push(`Sum of shares: ₹${formatRupees(result.shares.reduce((a, s) => a + s.total, 0))}`);
  return lines.join('\n');
}

export function fmtUnits(u: number): string {
  return Number.isInteger(u) ? String(u) : u.toFixed(2);
}
