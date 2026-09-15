import { isValidDate } from '../engine/align';
import { PROVIDERS } from '../engine/providers/registry';
import type { ProviderProfile, TariffPlan } from '../engine/providers/types';
import { blankBill, type BillFields } from '../ui/formState';
import { SCALAR_FIELDS, schemaRateKeys } from './schema';
import {
  fail,
  ok,
  type CandidateStatus,
  type ExtractIssue,
  type ExtractResult,
  type FieldStatus,
} from './types';

/**
 * Turns whatever the model returned into a candidate `BillFields`, or into a
 * named failure. It NEVER throws: a bad response is a result, because the
 * caller is a Lambda handler and the ultimate caller is someone standing in a
 * stairwell with a phone (D-18, E0.2).
 *
 * Structured outputs make the response schema-valid by construction (D-21), so
 * most of this never fires. It exists because "never" is doing a lot of work in
 * that sentence, and because the same parser is what the eval harness of E5.1
 * feeds its fixtures through.
 */

/** Unknown ids are a caller bug, not a silent fallback to provider zero. */
export function resolve(
  providerId: string,
  planId: string,
): { provider: ProviderProfile; plan: TariffPlan } | ExtractIssue {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider)
    return { code: 'internal', message: `No provider "${providerId}".`, field: 'providerId' };
  const plan = provider.plans.find((p) => p.id === planId);
  if (!plan) return { code: 'internal', message: `No plan "${planId}".`, field: 'planId' };
  return { provider, plan };
}

/** Fields the form holds as a date, whose `type="date"` input demands yyyy-mm-dd. */
const DATE_FIELDS = new Set<keyof BillFields>(['readingDate', 'previousReadingDate']);

/** The only free-text field. Everything else the form parses with `num()`. */
const TEXT_FIELDS = new Set<keyof BillFields>(['billingMonth']);

const pad = (s: string) => (s.length === 1 ? `0${s}` : s);

/**
 * Bills print dates in whatever the utility's software does. The form wants one
 * shape, so convert the common Indian ones and reject the rest rather than
 * inventing a day from a month.
 */
export function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (s === '') return '';
  // A shape the form accepts is not yet a date: `isValidDate` is what rejects
  // the 13th month and the 30th of February, and it is the engine's own
  // definition rather than a second one written here.
  const valid = (iso: string) => (isValidDate(iso) ? iso : null);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) return valid(`${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    // Day-first: every utility in PROVIDERS.md bills in India. An ambiguous
    // 03/04/2026 is 3 April, and a 13 or more in the second position is not a
    // month at all, which means the string was not the shape assumed.
    if (Number(m) > 12) return null;
    return valid(`${y}-${pad(m)}-${pad(d)}`);
  }
  return null;
}

/**
 * Money and readings as printed: "₹1,860.00", "1 936", "(30.28)" for a credit.
 * Returns the plain string the owner would have typed, or null if it is not a
 * number at all.
 */
export function normaliseNumber(raw: string): string | null {
  let s = raw.trim();
  if (s === '') return '';
  const bracketed = /^\((.*)\)$/.exec(s);
  if (bracketed) s = `-${bracketed[1]}`;
  s = s
    .replace(/^(Rs\.?|INR|₹)\s*/i, '')
    .replace(/\/-$/, '')
    .replace(/[−–—]/g, '-')
    .replace(/[,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? s : null;
}

const normaliseField = (key: keyof BillFields, raw: string): string | null =>
  TEXT_FIELDS.has(key)
    ? raw.trim()
    : DATE_FIELDS.has(key)
      ? normaliseDate(raw)
      : normaliseNumber(raw);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A rate the model did not find is left EMPTY, not filled with the plan's
 * published default. The default would be a guess wearing the owner's clothes:
 * it looks typed, it is usually right, and when it is wrong it is wrong in the
 * one direction nobody checks. Empty is visible, and D-18's printed-payable
 * cross-check makes the consequence loud.
 */
const emptyRates = (plan: TariffPlan): Record<string, string> =>
  Object.fromEntries(schemaRateKeys(plan).map((k) => [k, '']));

export function parseCandidate(raw: unknown, providerId: string, planId: string): ExtractResult {
  try {
    const found = resolve(providerId, planId);
    if (!('provider' in found)) return { ok: false, error: found };
    const { plan } = found;

    if (!isRecord(raw))
      return fail('malformed-response', 'The reader returned something that was not a bill.');

    const fields: BillFields = {
      ...blankBill(),
      providerId,
      planId,
      rates: emptyRates(plan),
    };
    const status: CandidateStatus = { fields: {}, rates: {} };
    const warnings: ExtractIssue[] = [];

    const record = (key: keyof BillFields, value: unknown): FieldStatus => {
      if (value === undefined || value === null) return 'missing';
      if (typeof value !== 'string') return 'rejected';
      const clean = normaliseField(key, value);
      if (clean === null) return 'rejected';
      if (clean === '') return 'missing';
      (fields[key] as string) = clean;
      return 'read';
    };

    for (const { key } of SCALAR_FIELDS) {
      const state = record(key, raw[key]);
      status.fields[key] = state;
      if (state === 'rejected')
        warnings.push({
          code: 'malformed-response',
          message: `"${String(raw[key])}" is not a value this field can hold, so it was left empty.`,
          field: key,
        });
    }

    const rates = isRecord(raw.rates) ? raw.rates : {};
    if (!isRecord(raw.rates))
      warnings.push({
        code: 'malformed-response',
        message: 'No rates came back from the bill; every rate needs typing in.',
        field: 'rates',
      });

    for (const key of schemaRateKeys(plan)) {
      const value = rates[key];
      let state: FieldStatus = 'missing';
      if (typeof value === 'string') {
        const clean = normaliseNumber(value);
        if (clean === null) state = 'rejected';
        else if (clean !== '') {
          fields.rates[key] = clean;
          state = 'read';
        }
      } else if (value !== undefined && value !== null) state = 'rejected';
      status.rates[key] = state;
      if (state === 'rejected')
        warnings.push({
          code: 'malformed-response',
          message: `The rate read for "${key}" was not a number, so it was left empty.`,
          field: key,
        });
    }

    // Keys the plan does not have are noise, not data: a rate under another
    // utility's name means nothing here and must never reach `buildBill`.
    for (const key of Object.keys(rates))
      if (!(key in fields.rates))
        warnings.push({
          code: 'malformed-response',
          message: `Ignored "${key}", which is not a rate on this tariff.`,
          field: key,
        });

    // Empty fields are the owner's to type; say so once, by name, rather than
    // leaving them to be discovered when the total disagrees (E1.3).
    const missing = [
      ...SCALAR_FIELDS.filter((f) => status.fields[f.key] === 'missing').map(
        (f) => f.key as string,
      ),
      ...schemaRateKeys(plan).filter((k) => status.rates[k] === 'missing'),
    ];
    for (const field of missing)
      warnings.push({ code: 'missing-field', message: 'Not found on the bill — type it in.', field });

    return ok({ fields, status, warnings });
  } catch (e) {
    // The contract is that this function returns. Nothing above should reach
    // here; if it does, the owner still gets a form they can type into.
    return fail('internal', `The reader's answer could not be understood: ${String(e)}`);
  }
}

/** The same, from raw response text. `JSON.parse` is the only throw, and it is caught. */
export function parseCandidateJson(
  text: string,
  providerId: string,
  planId: string,
): ExtractResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('malformed-response', 'The reader did not return usable JSON.');
  }
  return parseCandidate(raw, providerId, planId);
}
