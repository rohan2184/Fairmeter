import { describe, expect, it } from 'vitest';
import { findPlan, findProvider } from '../engine/providers/registry';
import { blankBill, toOfficialBill, toProviderInput, type BillFields } from '../ui/formState';
import { split } from '../engine/split';
import { toPaise } from '../engine/money';
import { schemaRateKeys } from './schema';
import { normaliseDate, normaliseNumber, parseCandidate, parseCandidateJson } from './candidate';
import type { ExtractResult } from './types';

/**
 * E0.2's checkpoint: the candidate type-checks as a `BillFields`, and a
 * malformed fixture is rejected with a NAMED error rather than a thrown
 * exception.
 */

const TORRENT = 'torrent-ahmedabad';
const PLAN = 'nonRgp-upto5kw';

/** The reference bill as the model would return it (D-21's schema shape). */
const reference = {
  billingMonth: 'July 2026',
  readingDate: '21/07/2026',
  previousReadingDate: '',
  officialPrevious: '1,775',
  officialPresent: '1,936',
  officialMultiplier: '1',
  sanctionedLoadKw: '1',
  billingMonths: '2',
  previousDues: '0.23',
  delayedPaymentCharges: '₹30.28',
  otherDebitCredit: '',
  roundingAdjustment: '-6.29',
  printedPayable: 'Rs. 1,860.00',
  rates: {
    energy: '4.60',
    fixed: '70',
    baseFppas: '3.72',
    fppas: '3.40',
    govtDuty: '20',
  },
};

const candidateOf = (result: ExtractResult): BillFields => {
  if (!result.ok) throw new Error(`expected a candidate, got ${result.error.code}`);
  return result.fields;
};

describe('parseCandidate — the happy path', () => {
  const result = parseCandidate(reference, TORRENT, PLAN);

  it('produces a complete BillFields, assignable as one', () => {
    // The assignment itself is the type-level half of the checkpoint: if
    // `fields` were not a `BillFields`, this file would not compile.
    const fields: BillFields = candidateOf(result);
    expect(Object.keys(fields).sort()).toEqual(Object.keys(blankBill()).sort());
    expect(fields.providerId).toBe(TORRENT);
    expect(fields.planId).toBe(PLAN);
  });

  it('normalises what the bill prints into what the owner would have typed', () => {
    const f = candidateOf(result);
    expect(f.readingDate).toBe('2026-07-21');
    expect(f.officialPrevious).toBe('1775');
    expect(f.officialPresent).toBe('1936');
    expect(f.delayedPaymentCharges).toBe('30.28');
    expect(f.printedPayable).toBe('1860.00');
  });

  it('recomputes to the printed payable — the D-18 cross-check, on a candidate', () => {
    const f = candidateOf(result);
    const bill = toOfficialBill(toProviderInput(f));
    const r = split(bill, [{ id: 'a', name: 'a', metered: false }]);
    expect(bill.printedPayable).toBe(toPaise(1860));
    expect(r.payable).toBe(bill.printedPayable);
    expect(r.warnings.filter((w) => w.includes('printed payable'))).toHaveLength(0);
  });

  it('names the fields the bill did not print instead of leaving them silent', () => {
    if (!result.ok) throw new Error('expected a candidate');
    expect(result.status.fields.previousReadingDate).toBe('missing');
    expect(result.status.fields.officialPresent).toBe('read');
    expect(result.warnings.map((w) => w.field)).toContain('previousReadingDate');
    expect(result.warnings.every((w) => w.code === 'missing-field')).toBe(true);
  });
});

describe('parseCandidate — malformed input is a result, never a throw', () => {
  const cases: [string, unknown][] = [
    ['null', null],
    ['a string', 'the bill says 1860'],
    ['a number', 42],
    ['an array', [reference]],
    ['undefined', undefined],
  ];

  for (const [name, raw] of cases) {
    it(`rejects ${name} with a named error`, () => {
      const result = parseCandidate(raw, TORRENT, PLAN);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('malformed-response');
      expect(result.error.message.length).toBeGreaterThan(0);
    });
  }

  it('rejects an unknown provider or plan rather than silently using another', () => {
    const bad = parseCandidate(reference, 'no-such-utility', PLAN);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('internal');

    const badPlan = parseCandidate(reference, TORRENT, 'no-such-plan');
    expect(badPlan.ok).toBe(false);
    if (!badPlan.ok) expect(badPlan.error.field).toBe('planId');
  });

  it('blanks a field of the wrong shape and says which, keeping the rest', () => {
    const result = parseCandidate(
      { ...reference, officialPresent: 'nineteen thirty-six', readingDate: '2026-13-45' },
      TORRENT,
      PLAN,
    );
    if (!result.ok) throw new Error('a bad field must not fail the whole read');
    expect(result.fields.officialPresent).toBe('');
    expect(result.status.fields.officialPresent).toBe('rejected');
    expect(result.status.fields.readingDate).toBe('rejected');
    expect(result.fields.officialPrevious).toBe('1775');
    expect(result.warnings.some((w) => w.field === 'officialPresent')).toBe(true);
  });

  it('ignores a rate this tariff does not have, and says so', () => {
    const result = parseCandidate(
      { ...reference, rates: { ...reference.rates, wheelingCharge: '1.20' } },
      TORRENT,
      PLAN,
    );
    if (!result.ok) throw new Error('an extra rate must not fail the read');
    expect(Object.keys(result.fields.rates)).toEqual(
      schemaRateKeys(findPlan(findProvider(TORRENT), PLAN)),
    );
    expect(result.warnings.some((w) => w.field === 'wheelingCharge')).toBe(true);
  });

  it('leaves an unread rate empty rather than filling in the published default', () => {
    const { energy: _dropped, ...rest } = reference.rates;
    const result = parseCandidate({ ...reference, rates: rest }, TORRENT, PLAN);
    if (!result.ok) throw new Error('a missing rate must not fail the read');
    expect(result.fields.rates.energy).toBe('');
    expect(result.status.rates.energy).toBe('missing');
  });

  it('rejects a non-string value without throwing', () => {
    const result = parseCandidate({ ...reference, officialPresent: 1936 }, TORRENT, PLAN);
    if (!result.ok) throw new Error('expected a candidate');
    expect(result.status.fields.officialPresent).toBe('rejected');
  });

  it('treats unparseable JSON as a named failure', () => {
    const result = parseCandidateJson('{not json', TORRENT, PLAN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('malformed-response');
  });

  it('parses the response text the model actually returns', () => {
    const result = parseCandidateJson(JSON.stringify(reference), TORRENT, PLAN);
    expect(result.ok).toBe(true);
  });
});

describe('normalisers', () => {
  it('reads Indian date shapes day-first, and refuses the rest', () => {
    expect(normaliseDate('21/07/2026')).toBe('2026-07-21');
    expect(normaliseDate('21-07-2026')).toBe('2026-07-21');
    expect(normaliseDate('2026-7-1')).toBe('2026-07-01');
    expect(normaliseDate('')).toBe('');
    expect(normaliseDate('21 July 2026')).toBeNull();
    expect(normaliseDate('07/21/2026')).toBeNull();
  });

  it('strips what the printer added and nothing else', () => {
    expect(normaliseNumber('₹1,860.00')).toBe('1860.00');
    expect(normaliseNumber('1 936')).toBe('1936');
    expect(normaliseNumber('(6.29)')).toBe('-6.29');
    expect(normaliseNumber('−6.29')).toBe('-6.29');
    expect(normaliseNumber('Rs. 70/-')).toBe('70');
    expect(normaliseNumber('')).toBe('');
    expect(normaliseNumber('N/A')).toBeNull();
    expect(normaliseNumber('4.6.0')).toBeNull();
  });
});

