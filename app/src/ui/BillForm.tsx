import { daysBetween, isValidDate } from '../engine/align';
import { rateKey, slabRateKey } from '../engine/providers/build';
import { PROVIDERS, findPlan, findProvider } from '../engine/providers/registry';
import type { ChargeTemplate } from '../engine/providers/types';
import { Disclosure } from './Disclosure';
import { Section } from './Section';
import { withPlan, type BillFields } from './formState';

interface Props {
  value: BillFields;
  onChange: (next: BillFields) => void;
}

const UNIT: Record<ChargeTemplate['kind'], string> = {
  perUnit: '₹/unit',
  flat: '₹',
  slabPerUnit: '₹/unit',
  perKwPerMonth: '₹/kW/month',
  perInstallationPerMonth: '₹/month',
  percentOfSubtotal: '%',
};

const spanDays = (a: string, b: string) =>
  isValidDate(a) && isValidDate(b) && daysBetween(a, b) > 0 ? daysBetween(a, b) : null;

/**
 * Live read-out of the two windows. The point is to make the drift visible
 * while it can still be fixed — by reading the meters on the utility's day.
 */
function Drift({ value }: { value: BillFields }) {
  const billDays = spanDays(value.previousReadingDate, value.readingDate);
  const meterDays = spanDays(value.submeterPreviousDate, value.submeterReadingDate);
  if (billDays === null && meterDays === null) return null;

  if (billDays === null || meterDays === null) {
    return (
      <p className="hint">
        {billDays !== null
          ? `The bill covers ${billDays} days. Add the sub-meter dates to line them up.`
          : `Your sub-meters cover ${meterDays} days. Add the bill's two reading dates to line them up.`}
      </p>
    );
  }

  const drift = meterDays - billDays;
  return (
    <p className={drift === 0 ? 'check ok' : 'hint'}>
      {drift === 0
        ? `✓ Both windows are ${billDays} days — nothing to adjust.`
        : `Your sub-meters cover ${meterDays} days against the bill's ${billDays}: ` +
          `${Math.abs(drift)} day${Math.abs(drift) === 1 ? '' : 's'} ` +
          `${drift > 0 ? 'more' : 'less'}. That difference is corrected below rather than ` +
          `charged to whoever has no sub-meter.`}
    </p>
  );
}

/** The one line of the drift worth reading without opening the disclosure. */
function driftState(value: BillFields): string {
  const billDays = spanDays(value.previousReadingDate, value.readingDate);
  const meterDays = spanDays(value.submeterPreviousDate, value.submeterReadingDate);
  if (billDays === null && meterDays === null) return 'Not set — nothing is adjusted';
  if (billDays === null || meterDays === null) return 'Half filled in';
  const drift = meterDays - billDays;
  return drift === 0
    ? `Both windows ${billDays} days`
    : `${Math.abs(drift)} day${Math.abs(drift) === 1 ? '' : 's'} ${drift > 0 ? 'more' : 'less'} than the bill — corrected`;
}

/** The star. `aria-hidden` because the input already carries aria-required. */
function Required() {
  return (
    <span className="req" aria-hidden="true" title="Needed before the split can be calculated">
      *
    </span>
  );
}

function slabLabel(i: number, widthPerMonth: number | undefined): string {
  if (widthPerMonth === undefined) return 'Remaining units';
  return `${i === 0 ? 'First' : 'Next'} ${widthPerMonth} units/month`;
}

export function BillForm({ value, onChange }: Props) {
  const provider = findProvider(value.providerId);
  const plan = findPlan(provider, value.planId);

  const set = (k: keyof BillFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  const setRate = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, rates: { ...value.rates, [key]: e.target.value } });

  /**
   * `required` marks the fields the engine cannot produce a split without —
   * only those. A multiplier defaults to 1 and a blank sub-meter reading is a
   * household that used nothing, so neither is starred.
   *
   * aria-required rather than the `required` attribute, deliberately: `required`
   * brings `:invalid` with it, which would light every empty field red on a form
   * nobody has filled in yet.
   */
  const field = (
    k: keyof BillFields,
    label: string,
    hint?: string,
    type: 'text' | 'number' | 'date' = 'number',
    required = false,
  ) => (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <Required />}
      </span>
      <input
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        step="any"
        aria-required={required || undefined}
        value={String(value[k] ?? '')}
        onChange={set(k)}
        placeholder={type === 'number' ? '0' : ''}
      />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );

  const rateField = (key: string, label: string, unit: string, hint?: string) => (
    <label className="field" key={key}>
      <span className="field-label">
        {label} <span className="unit">({unit})</span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value.rates[key] ?? ''}
        onChange={setRate(key)}
        placeholder="0"
      />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );

  const rateFields = plan.charges.flatMap((c) =>
    c.kind === 'slabPerUnit'
      ? c.slabs.map((s, i) =>
          rateField(
            slabRateKey(c, i),
            `${c.label} — ${slabLabel(i, s.widthPerMonth)}`,
            UNIT[c.kind],
            i === 0 ? c.hint : undefined,
          ),
        )
      : [rateField(rateKey(c), c.label, UNIT[c.kind], c.hint)],
  );

  return (
    <>
      <Section
        id="provider"
        step={1}
        title="Your electricity provider"
        lede="Picking these fills in the published rates."
      >
        <div className="grid">
          <label className="field">
            <span className="field-label">Provider</span>
            <select
              value={provider.id}
              onChange={(e) => {
                const next = findProvider(e.target.value);
                onChange(withPlan(value, next.id, next.plans[0].id));
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.shortName} — {p.area}
                </option>
              ))}
            </select>
          </label>

          <label className="field wide">
            <span className="field-label">Tariff category</span>
            <select
              value={plan.id}
              onChange={(e) => onChange(withPlan(value, provider.id, e.target.value))}
            >
              {provider.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {provider.confidence !== 'verified' && (
          <p className="provenance indicative">
            Indicative rates — the structure is right, but the numbers came from secondary
            summaries. Check every rate against your bill.
          </p>
        )}

        <Disclosure
          summary="Where these rates come from"
          detail={
            provider.confidence === 'verified'
              ? `Regulator's tariff order · from ${provider.effectiveFrom}`
              : 'Secondary summaries — check them'
          }
        >
          <p className={`provenance ${provider.confidence}`}>
            {provider.confidence === 'verified'
              ? `Rates transcribed from: ${provider.source}. Effective ${provider.effectiveFrom}.`
              : `Indicative rates — the structure is right, the numbers came from secondary summaries (${provider.source}). Check every rate against your bill.`}
          </p>
          <p className="hint">
            {provider.ownership === 'private' ? 'Private licensee' : 'State discom'} · regulated
            by {provider.regulator}. {plan.applicability}
          </p>
          {provider.notes && provider.notes.length > 0 && (
            <ul className="notes">
              {provider.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </Disclosure>
      </Section>

      <Section
        id="bill"
        step={2}
        title="The official bill"
        lede="Copy these straight off the utility bill, in rupees, exactly as printed."
      >
        <p className="hint req-legend">
          <span className="req" aria-hidden="true">
            *
          </span>{' '}
          needed before the split can be calculated. Everything else is optional.
        </p>

        <div className="grid">
          {field('billingMonth', 'Billing month', 'e.g. July 2026', 'text')}
          {field('billingMonths', 'Billing months', '60-day cycle = 2', 'number', true)}
        </div>

        <h3>Official meter</h3>
        <div className="grid">
          {field('officialPrevious', 'Previous reading', undefined, 'number', true)}
          {field('officialPresent', 'Present reading', undefined, 'number', true)}
          {field('officialMultiplier', 'Multiplier', 'usually 1.00')}
          {field(
            'printedPayable',
            'Amount payable as printed (₹)',
            'Optional — catches a stale rate or a mistyped reading.',
          )}
        </div>

        <Disclosure summary="Reading dates" detail={driftState(value)}>
          <p className="lede">
            The utility reads the official meter on its own day; you read the sub-meters when
            the bill reaches you. Fill both in and every sub-meter is lined up with the window
            the bill actually charges for, instead of the difference landing on whoever has no
            sub-meter. Leave them blank and nothing is adjusted.
          </p>
          <div className="grid">
            {field('previousReadingDate', 'Official meter — window opens', 'Last bill’s reading date.', 'date')}
            {field('readingDate', 'Official meter — read on', 'Printed on this bill.', 'date')}
            {field('submeterPreviousDate', 'Sub-meters — previously read on', undefined, 'date')}
            {field('submeterReadingDate', 'Sub-meters — read on', undefined, 'date')}
          </div>
          <Drift value={value} />
        </Disclosure>

        <Disclosure
          summary="Rates and charges"
          required={plan.usesSanctionedLoad}
          detail={`${plan.label} · ${rateFields.length} line item${rateFields.length === 1 ? '' : 's'} pre-filled`}
        >
          <p className="lede">
            The line items this tariff has, in the order the bill stacks them. Correct anything
            your bill disagrees with; a rate of 0 removes that line from the split.
          </p>
          <div className="grid">
            {plan.usesSanctionedLoad &&
              field(
                'sanctionedLoadKw',
                'Sanctioned load (kW)',
                'Drives the per-kW fixed charge.',
                'number',
                true,
              )}
            {rateFields}
          </div>
        </Disclosure>

        <Disclosure summary="Dues and adjustments" detail={duesState(value)}>
          <p className="lede">
            Leave blank if not on the bill. These are shared pro-rata like everything else.
          </p>
          <div className="grid">
            {field('previousDues', 'Previous dues (₹)')}
            {field('delayedPaymentCharges', 'Delayed payment charges (₹)')}
            {field('otherDebitCredit', 'Other debit / credit (₹)')}
            {field('roundingAdjustment', 'Round-off adjustment (₹)', 'usually negative')}
          </div>
        </Disclosure>
      </Section>
    </>
  );
}

/** How many of the four account-level lines are actually on this bill. */
function duesState(value: BillFields): string {
  const filled = (
    ['previousDues', 'delayedPaymentCharges', 'otherDebitCredit', 'roundingAdjustment'] as const
  ).filter((k) => String(value[k] ?? '').trim() !== '' && Number(value[k]) !== 0).length;
  return filled === 0 ? 'None on this bill' : `${filled} on this bill`;
}
