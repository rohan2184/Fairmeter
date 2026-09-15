import type { ProviderProfile, TariffPlan } from '../../app/src/engine/providers/types';

/**
 * The instruction half of the single Messages call (D-21, E1.3).
 *
 * The SCHEMA already carries a description per field, and that is where
 * anything field-specific belongs — it is generated from the plan, so it cannot
 * go stale when a provider is added. This file holds only what is true of the
 * task rather than of a field: what the document is, what the job is, and the
 * three things a reader of bills gets wrong.
 *
 * Pure: a provider and a plan in, a string out. No clock, no network, no bytes.
 */

/**
 * Two facts drive most of this prompt, and both come from the reference bill.
 *
 * FIRST: the bill is printed on both sides, and the sides carry different
 * halves of the answer. `100113210.pdf` puts the meter readings, the sanctioned
 * load, the reading date and the amount payable on page 1, and the itemised
 * charge stack plus the TARIFF STRUCTURE table on page 2. Nearly every RATE the
 * schema asks for is on the back. A model that answers from page 1 alone
 * returns a complete-looking candidate with no rates in it.
 *
 * SECOND: that tariff table lists EVERY tariff the utility sells — residential,
 * BPL, agricultural, EV charging — in adjacent rows of similar-looking numbers,
 * banded by connected load. Picking the wrong row is the failure mode with no
 * symptom: it is a plausible rate, of the right magnitude, in the right units,
 * and it would sail through anything except D-18's printed-total cross-check.
 */
export function extractionPrompt(provider: ProviderProfile, plan: TariffPlan): string {
  const lines: (string | null)[] = [
    `You are reading one electricity bill from ${provider.name}${provider.area ? ` (${provider.area})` : ''}.`,
    '',
    'Transcribe it into the given schema. You are a typist with good eyesight: every',
    'value is copied off the page exactly as printed. Do not calculate anything, do not',
    'add figures together, do not convert units, and do not correct the bill.',
    '',
    'THE BILL HAS TWO SIDES, and you need both.',
    '  - The front carries the meter readings, the sanctioned or connected load, the',
    '    reading date, the billing month and the total amount payable.',
    '  - The back carries the itemised charges and the tariff table, which is where',
    '    almost every per-unit rate and fixed charge is printed.',
    'Read every page you have been given before you answer. If you have only been given',
    'one side, fill in what that side shows and leave the rest empty — do not supply a',
    'rate from the other side from memory.',
    '',
    `THE TARIFF IS ALREADY CHOSEN: "${plan.label}".`,
    plan.applicability ? `It applies to: ${plan.applicability}` : null,
    'The tariff table lists every tariff this utility sells, in rows that look alike.',
    'Take the rates from the row for this tariff, and where the rows are banded by',
    `connected load, the band that contains this bill's load. A residential rate on a`,
    'commercial bill is the one mistake here that produces no visible symptom, so check',
    'the row label before you copy the number, not after.',
    plan.usesSanctionedLoad
      ? 'This tariff charges by sanctioned load, so the load band matters to the fixed charge.'
      : 'This tariff does not vary with sanctioned load.',
    '',
    'WHERE THE SAME FIGURE APPEARS TWICE, prefer the one in the itemised charges over',
    'the one in the tariff table. A percentage printed as "@ 3.40%" next to a charge is',
    'what this bill was actually charged; the table is what the tariff says in general,',
    'and in a month where they differ, the itemised line is the true one.',
    '',
    'ANYTHING YOU CANNOT FIND ON THE PAGE IS AN EMPTY STRING. This matters more than it',
    'sounds: an empty field asks the owner to type one number, and a plausible guess',
    'silently changes what someone is asked to pay. You are never penalised for leaving',
    'a field empty, and a value you inferred, remembered or derived is worse than none.',
    'In particular, never compute the total payable — read it as printed, or leave it',
    'empty. It is the figure everything else is checked against.',
    '',
    `Record in "document.utility" the utility's name exactly as printed on the page. If`,
    `the bill is not from ${provider.shortName} at all, still transcribe the name you see`,
    'there — that is how the mistake gets noticed.',
  ];
  // Only the conditional entries drop out; the empty strings are paragraph
  // breaks and are meant to survive.
  return lines.filter((l) => l !== null).join('\n');
}
