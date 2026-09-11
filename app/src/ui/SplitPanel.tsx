import { useState } from 'react';
import { formatRupees } from '../engine/money';
import type { SplitResult } from '../engine/types';
import { fmtUnits, fullSummary, householdMessage } from '../export/text';
import { Rail } from './Rail';

interface Props {
  result: SplitResult | null;
  /** What is still missing, when there is no result yet. */
  issues: string[];
  billingMonth: string;
  saved: boolean;
  onSave: () => void;
}

/**
 * The answer, kept beside the form rather than at the end of it.
 *
 * On a wide screen this sticks to the top of the viewport while the form
 * scrolls under it, so every reading typed in is seen landing on somebody's
 * share. Before the form has enough in it, the same panel holds the list of
 * what is still missing — the space where the answer will be, saying why it
 * isn't there yet.
 */
export function SplitPanel({ result, issues, billingMonth, saved, onSave }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      setCopied('failed');
    }
  };

  if (!result) {
    return (
      <section className="card panel panel-waiting" id="split">
        <div className="panel-head">
          <h2>The split</h2>
        </div>
        <h3>Before this can be calculated</h3>
        <ul className="todo">
          {issues.map((i, k) => (
            <li key={k}>{i}</li>
          ))}
        </ul>
      </section>
    );
  }

  const sumOfShares = result.shares.reduce((a, s) => a + s.total, 0);
  const balanced = sumOfShares === result.payable;

  return (
    <section className="card panel" id="split">
      <div className="panel-head">
        <h2>The split</h2>
        <span className="panel-month">{billingMonth}</span>
      </div>

      {result.warnings.length > 0 && (
        <ul className="warnings">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <Rail
        compact
        shares={result.shares.map((s) => ({
          id: s.householdId,
          name: s.name,
          ratio: s.ratio,
          total: s.total,
        }))}
      />

      <div className="shares">
        {result.shares.map((s, i) => (
          <div className="share" key={s.householdId} data-seg={(i % 3) + 1}>
            <span className="share-name">{s.name}</span>
            <span className="share-amount">₹{formatRupees(s.total)}</span>
            <span className="share-meta">
              {fmtUnits(s.units)} units · {(s.ratio * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <p className="panel-total">
        <span>Bill total</span>
        <span className="panel-total-value">₹{formatRupees(result.payable)}</span>
      </p>

      <p className={balanced ? 'check ok' : 'check bad'}>
        {balanced
          ? `✓ Shares add up to ₹${formatRupees(sumOfShares)} — exactly the bill total, to the paisa.`
          : `✗ Shares add up to ₹${formatRupees(sumOfShares)} but the bill is ₹${formatRupees(result.payable)}.`}
      </p>

      <div className="panel-actions print-hide">
        <button onClick={() => copy('all', fullSummary(result, billingMonth))}>
          {copied === 'all' ? 'Copied ✓' : 'Copy summary of everyone'}
        </button>
        {result.shares.map((s) => (
          <button
            key={s.householdId}
            className="ghost"
            onClick={() => copy(s.householdId, householdMessage(result, s, billingMonth))}
          >
            {copied === s.householdId ? 'Copied ✓' : `Copy message for ${s.name}`}
          </button>
        ))}
        <div className="panel-actions-split">
          <button className="ghost" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <button className="ghost" onClick={onSave} disabled={saved}>
            {saved ? 'Saved ✓' : 'Save this cycle'}
          </button>
        </div>
        {copied === 'failed' && (
          <p className="hint">Clipboard blocked by the browser — select the text and copy manually.</p>
        )}
        <p className="hint">
          Saving keeps this cycle in History, so the next one starts with these readings already
          in place.
        </p>
      </div>
    </section>
  );
}
