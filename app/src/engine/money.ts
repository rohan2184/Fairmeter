import type { Paise } from './types';

/**
 * Money arithmetic in integer paise. See SPEC.md §2 step 4.
 */

/** Round half away from zero — how printed bills round. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** "4.60" or 4.6 => 460 paise. Guards against float drift (4.6 * 100 = 459.99…). */
export function toPaise(rupees: number | string): Paise {
  const n = typeof rupees === 'string' ? Number(rupees) : rupees;
  if (!Number.isFinite(n)) throw new Error(`Not a number: ${rupees}`);
  return roundHalfUp(n * 100);
}

export function toRupees(paise: Paise): number {
  return paise / 100;
}

/** 186000 => "1,860.00" (Indian digit grouping). */
export function formatRupees(paise: Paise): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/**
 * Split `amount` across `weights` so the parts sum EXACTLY back to `amount`.
 *
 * Largest-remainder method: floor every exact share, then hand out the leftover
 * paise one at a time to the largest fractional parts. Ties break by index, so
 * the result is deterministic. Works for negative amounts (the round-down
 * adjustment is negative) because flooring a negative goes further from zero,
 * leaving a positive remainder to redistribute.
 *
 * Zero total weight falls back to an equal split — otherwise a bill with no
 * consumption at all would throw instead of dividing the fixed charges.
 */
export function allocate(amount: Paise, weights: number[]): Paise[] {
  if (!Number.isInteger(amount)) {
    throw new Error(`allocate() needs integer paise, got ${amount}`);
  }
  const n = weights.length;
  if (n === 0) return [];

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const effective = totalWeight === 0 ? weights.map(() => 1) : weights;
  const effectiveTotal = totalWeight === 0 ? n : totalWeight;

  const exact = effective.map((w) => (amount * w) / effectiveTotal);
  const base = exact.map((x) => Math.floor(x));
  const distributed = base.reduce((a, b) => a + b, 0);
  let remainder = amount - distributed;

  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const out = [...base];
  for (let k = 0; remainder > 0; k++, remainder--) {
    out[order[k % n].i] += 1;
  }
  return out;
}
