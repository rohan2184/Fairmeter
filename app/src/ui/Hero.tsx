import { formatRupees } from '../engine/money';
import { fmtUnits } from '../export/text';
import type { SplitResult } from '../engine/types';
import { Rail, type RailSegment } from './Rail';

interface Props {
  /** The live split, once there is one — the hero shows the real thing over the example. */
  result: SplitResult | null;
  billingMonth: string;
  /** Label of the most recent saved cycle, if any. */
  lastSaved?: string;
  onSample: () => void;
  onContinue: () => void;
  onClear: () => void;
}

/** What the specimen shows before there is anything real to show. */
const EXAMPLE: (RailSegment & { units: number })[] = [
  { id: 'a', name: 'Ground floor', ratio: 0.5768, total: 246850, units: 214 },
  { id: 'b', name: 'First floor', ratio: 0.4232, total: 181150, units: 157 },
];

/**
 * The opening band: what the app does, one way in, and the answer it produces
 * shown rather than described.
 *
 * The specimen on the right is the same figure the answer panel uses, filled
 * with an example until the form has enough in it — at which point it switches
 * to this cycle's real shares, so the promise and the result are literally the
 * same object.
 */
export function Hero({ result, billingMonth, lastSaved, onSample, onContinue, onClear }: Props) {
  const live = result && result.shares.length > 0;
  const segments: RailSegment[] = live
    ? result.shares.map((s) => ({ id: s.householdId, name: s.name, ratio: s.ratio, total: s.total }))
    : EXAMPLE;
  const rows = live
    ? result.shares.map((s) => ({ id: s.householdId, name: s.name, units: s.units, total: s.total }))
    : EXAMPLE;
  const total = live ? result.payable : EXAMPLE.reduce((a, s) => a + s.total, 0);

  return (
    <section className="hero print-hide" id="top">
      <div className="page hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">One connection · several households</p>
          <h1>One bill in. Everyone’s share out.</h1>
          <p className="hero-lede">
            Type in what the utility charged and what each sub-meter read. Every line of the
            bill — energy, fixed charges, fuel surcharge, duty, even last month’s dues — is
            divided by the units each household actually used, and the shares add up to the
            printed total exactly.
          </p>

          <div className="hero-actions">
            {lastSaved && (
              <button onClick={onContinue}>Continue from {lastSaved}</button>
            )}
            <a className={lastSaved ? 'button ghost' : 'button'} href="#provider">
              Start this month’s split
            </a>
            <button className="ghost" onClick={onSample}>
              Fill with the sample bill
            </button>
            <button className="link" onClick={onClear}>
              Clear the form
            </button>
          </div>

          <ul className="hero-facts">
            <li>Nothing leaves this browser</li>
            <li>No account, no upload</li>
            <li>Send it on WhatsApp or print it</li>
          </ul>
        </div>

        <figure className="specimen">
          <figcaption className="specimen-head">
            <span className="eyebrow">{live ? billingMonth : 'Example'}</span>
            <span className="specimen-total">₹{formatRupees(total)}</span>
          </figcaption>

          <Rail shares={segments} />

          <ul className="specimen-rows">
            {rows.map((s, i) => (
              <li key={s.id} data-seg={(i % 3) + 1}>
                <span className="specimen-name">{s.name}</span>
                <span className="specimen-units">{fmtUnits(s.units)} units</span>
                <span className="specimen-amount">₹{formatRupees(s.total)}</span>
              </li>
            ))}
          </ul>

          <p className="specimen-foot">
            {live
              ? 'Live — this updates as you type.'
              : 'An example of the answer. Fill the form in and this becomes yours.'}
          </p>
        </figure>
      </div>
    </section>
  );
}
