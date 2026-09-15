import { SCALAR_FIELDS, schemaRateKeys } from '../../app/src/extract/schema';
import type {
  ExtractCandidate,
  ExtractIssue,
  ExtractResult,
} from '../../app/src/extract/types';
import type { ProviderProfile, TariffPlan } from '../../app/src/engine/providers/types';

/**
 * Turns a parsed candidate into a candidate plus a NAMED reason it is partial,
 * or into a failure (E1.3).
 *
 * Everything here is derived from what came back, never claimed by the model
 * (D-22). `parseCandidate` already names each missing field one by one; this
 * adds the sentence above them — the one that says what to actually do, which
 * is a different thing from a list of twelve field names.
 *
 * Only total illegibility is fatal. A partial read is a result: the fields that
 * came through are still worth having, and the owner types the rest. A blank
 * form is what they had before this feature existed.
 */

/** Words that identify a utility once the corporate furniture is removed. */
const significant = (name: string): string[] =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['ltd', 'limited', 'power', 'company', 'corporation', 'the', 'and', 'electricity', 'electric'].includes(w));

/**
 * Whether the name printed on the page is the utility whose plan was selected.
 *
 * Deliberately generous. A false "wrong provider" tells someone their correct
 * bill is the wrong bill, which is worse than missing a genuinely wrong one —
 * that one still faces D-18's cross-check. So one shared distinctive word is
 * enough, and an unreadable or absent name is never a mismatch.
 */
export function utilityMatches(printed: string, provider: ProviderProfile): boolean {
  if (printed.trim() === '') return true;
  const seen = significant(printed);
  if (seen.length === 0) return true;
  const expected = new Set([...significant(provider.name), ...significant(provider.shortName)]);
  if (expected.size === 0) return true;
  return seen.some((w) => expected.has(w));
}

const counts = (candidate: ExtractCandidate, plan: TariffPlan) => {
  const scalars = SCALAR_FIELDS.map((f) => candidate.status.fields[f.key]);
  const rates = schemaRateKeys(plan).map((k) => candidate.status.rates[k]);
  return {
    scalarsRead: scalars.filter((s) => s === 'read').length,
    ratesRead: rates.filter((s) => s === 'read').length,
    rateCount: rates.length,
  };
};

/**
 * The reason a candidate is thin, as one actionable sentence — or null when it
 * is not thin.
 */
export function diagnose(
  candidate: ExtractCandidate,
  provider: ProviderProfile,
  plan: TariffPlan,
): ExtractIssue | null {
  if (!utilityMatches(candidate.document.utility, provider))
    return {
      code: 'wrong-provider',
      message:
        `This looks like a bill from ${candidate.document.utility}, but the tariff selected is ` +
        `${provider.shortName}'s "${plan.label}". Check the provider before saving — the figures ` +
        'below were read from the page, but they were read against the wrong tariff.',
      field: 'providerId',
    };

  const { scalarsRead, ratesRead, rateCount } = counts(candidate, plan);

  // Nothing at all. Not a partial read — a page that could not be read.
  if (scalarsRead === 0 && ratesRead === 0)
    return {
      code: 'unreadable',
      message:
        'Nothing on this page could be read as a bill. If it is a photograph, try again in ' +
        'better light with the whole bill in frame and the text upright.',
    };

  // The shape a photograph of the front produces: the readings and the total
  // came through, and the tariff table — which is on the reverse — did not.
  // Naming it is the difference between "twelve fields are missing" and
  // "turn the bill over".
  if (rateCount > 0 && ratesRead === 0)
    return {
      code: 'back-page-missing',
      message:
        'The readings came through, but none of the rates did. The rates are printed on the ' +
        'BACK of the bill, in the tariff table — upload that side as well, or type the rates in.',
      field: 'rates',
    };

  return null;
}

/** `diagnose`, applied: fatal reasons become a failure, the rest a warning. */
export function reviewed(
  result: ExtractResult,
  provider: ProviderProfile,
  plan: TariffPlan,
): ExtractResult {
  if (!result.ok) return result;
  const issue = diagnose(result, provider, plan);
  if (!issue) return result;
  // `unreadable` is the only one with nothing worth keeping, by construction:
  // it is defined as the case where nothing was read.
  if (issue.code === 'unreadable') return { ok: false, error: issue };
  return { ...result, warnings: [issue, ...result.warnings] };
}
