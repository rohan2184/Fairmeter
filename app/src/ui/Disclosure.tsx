import type { ReactNode } from 'react';

interface Props {
  /** What is behind the fold, named as a thing rather than an action. */
  summary: string;
  /** The current state of what's inside, so it need not be opened to be checked. */
  detail?: string;
  /** There is a field inside that blocks the calculation — say so on the fold. */
  required?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Progressive disclosure, on native <details> so it works without JS, prints,
 * and stays searchable — the content is in the DOM whether or not it is open.
 *
 * Used for everything that is either pre-filled correctly (tariff rates), rarely
 * needed (dues, reading dates) or already stated more briefly elsewhere (the
 * charge-by-charge table). The rule: nothing is hidden unless its summary line
 * says enough to decide whether it needs opening.
 */
export function Disclosure({ summary, detail, required, defaultOpen = false, children }: Props) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary>
        <span className="disclosure-title">
          {summary}
          {required && (
            <span className="req" title="Contains a field the calculation needs">
              *
            </span>
          )}
        </span>
        {detail && <span className="disclosure-detail">{detail}</span>}
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
