import { rateKey, slabRateKey } from '../engine/providers/build';
import type { ChargeTemplate, ProviderProfile, TariffPlan } from '../engine/providers/types';
import type { BillFields } from '../ui/formState';

/**
 * The JSON response schema for one extraction call, GENERATED from the selected
 * plan (D-21).
 *
 * The plan already describes every line item it has, as data. Its
 * `ChargeTemplate[]` maps onto the properties of a JSON schema keyed by the same
 * `rateKey` / `slabRateKey` the form renders, so a utility added to
 * `registry.ts` gets a working extraction schema with no second edit — the
 * promise D-10 made about the form, kept for a feature it was not written for.
 *
 * Everything here is a STRING, because the model's whole output is a candidate
 * `BillFields` — the same strings the owner would otherwise have typed (D-18).
 * It computes no money. A field the model cannot find on the page comes back
 * EMPTY for the owner to type; it is never guessed.
 *
 * This module is imported by the Lambda and by the UI. Nothing under `engine/`
 * may import it (D-18) — see `purity.test.ts`.
 */

/** The 2020-12 subset Anthropic structured outputs accepts. */
export interface JsonSchema {
  type: 'object' | 'string';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
}

/** A scalar field of `BillFields` that is read off the paper bill. */
export interface ScalarField {
  key: keyof BillFields;
  description: string;
}

/**
 * The scalar half of the candidate, in the order the form asks for it.
 *
 * `providerId` and `planId` are absent on purpose: the owner chose them before
 * uploading, and the schema is generated FOR that choice. The `submeter*` dates
 * are absent because they are not printed on the utility's bill — the owner
 * read those meters themselves.
 */
export const SCALAR_FIELDS: ScalarField[] = [
  {
    key: 'billingMonth',
    description: 'Billing month as printed, e.g. "July 2026". Empty if not printed.',
  },
  {
    key: 'readingDate',
    description:
      'Date the utility read the meter for THIS bill, as yyyy-mm-dd. The present/current reading date.',
  },
  {
    key: 'previousReadingDate',
    description:
      'Date of the previous official reading, as yyyy-mm-dd — the day this billing window opens. Empty if the bill prints only one date.',
  },
  {
    key: 'officialPrevious',
    description: 'Previous reading of the official meter, in units as printed.',
  },
  {
    key: 'officialPresent',
    description: 'Present (current) reading of the official meter, in units as printed.',
  },
  {
    key: 'officialMultiplier',
    description: 'Meter multiplier / MF. Usually "1". Use "1" if the bill does not print one.',
  },
  {
    key: 'sanctionedLoadKw',
    description: 'Sanctioned / connected load in kW, as printed.',
  },
  {
    key: 'billingMonths',
    description:
      'Number of months this bill covers: "2" for a bi-monthly bill, "1" for monthly.',
  },
  {
    key: 'previousDues',
    description: 'Arrears / previous balance carried forward, in rupees. Empty if none.',
  },
  {
    key: 'delayedPaymentCharges',
    description: 'Delayed payment charges (DPC) in rupees. Empty if none.',
  },
  {
    key: 'otherDebitCredit',
    description:
      'Any other account-level debit or credit in rupees, negative for a credit. Empty if none.',
  },
  {
    key: 'roundingAdjustment',
    description:
      'Round-off adjustment in rupees, negative when the bill is rounded down. Empty if none.',
  },
  {
    key: 'printedPayable',
    description:
      'The total amount payable as PRINTED on the bill, in rupees. This is the cross-check, so read it exactly and never compute it.',
  },
];

const UNIT: Record<ChargeTemplate['kind'], string> = {
  perUnit: '₹ per unit',
  flat: '₹',
  slabPerUnit: '₹ per unit',
  perKwPerMonth: '₹ per kW per month',
  perInstallationPerMonth: '₹ per installation per month',
  percentOfSubtotal: 'percent',
};

const slabLabel = (i: number, widthPerMonth: number | undefined): string =>
  widthPerMonth === undefined ? 'remaining units' : `${i === 0 ? 'first' : 'next'} ${widthPerMonth} units/month`;

/** One rate property: its schema key and the description the model reads. */
export interface RateField {
  key: string;
  description: string;
}

/**
 * Every rate the plan exposes, in charge order — the same keys, by the same
 * two functions, that `BillForm` renders and `defaultRates` fills.
 */
export function rateFields(plan: TariffPlan): RateField[] {
  return plan.charges.flatMap((c) =>
    c.kind === 'slabPerUnit'
      ? c.slabs.map((s, i) => ({
          key: slabRateKey(c, i),
          description: `${c.label} — ${slabLabel(i, s.widthPerMonth)}, in ${UNIT[c.kind]}.`,
        }))
      : [{ key: rateKey(c), description: `${c.label}, in ${UNIT[c.kind]}.` }],
  );
}

const str = (description: string): JsonSchema => ({ type: 'string', description });

const objectOf = (props: Record<string, JsonSchema>, description: string): JsonSchema => ({
  type: 'object',
  description,
  properties: props,
  // Structured outputs require every property listed and the object closed;
  // "not found" is an empty string, not a missing key, so the owner sees an
  // empty field rather than a silently absent one.
  required: Object.keys(props),
  additionalProperties: false,
});

/**
 * The response schema for `output_config.format` on the extraction call.
 *
 * `provider` is taken only to name the schema and to tell the model which
 * utility's layout it is looking at; no figure comes from it.
 */
export function billFieldsSchema(provider: ProviderProfile, plan: TariffPlan): JsonSchema {
  const scalars = Object.fromEntries(SCALAR_FIELDS.map((f) => [f.key, str(f.description)]));
  const rates = Object.fromEntries(rateFields(plan).map((f) => [f.key, str(f.description)]));

  return objectOf(
    {
      ...scalars,
      rates: objectOf(
        rates,
        `The rates printed on this bill, for ${provider.shortName}'s "${plan.label}" tariff. ` +
          'Read each one off the page; leave it empty rather than supplying the published rate from memory.',
      ),
    },
    `The fields of one ${provider.name} electricity bill, transcribed exactly as printed. ` +
      'Every value is a string. Do not calculate anything, do not convert units, and leave ' +
      'anything you cannot find on the page as an empty string.',
  );
}

/** The schema's rate keys, which must match the plan's form fields exactly. */
export const schemaRateKeys = (plan: TariffPlan): string[] => rateFields(plan).map((f) => f.key);
