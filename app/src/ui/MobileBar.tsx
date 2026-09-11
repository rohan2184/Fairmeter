import { formatRupees } from '../engine/money';
import type { SplitResult } from '../engine/types';

/**
 * On a narrow screen there is no room beside the form, so the answer travels
 * along the bottom instead: the running total and one tap to the shares.
 * Nothing here that isn't in the panel — it is a way back to it, not a copy.
 */
export function MobileBar({ result }: { result: SplitResult | null }) {
  if (!result) return null;
  return (
    <div className="mobilebar print-hide">
      <span className="mobilebar-figure">
        <span className="mobilebar-label">Bill total</span>
        <span className="mobilebar-value">₹{formatRupees(result.payable)}</span>
      </span>
      <a className="button" href="#split">
        See the shares
      </a>
    </div>
  );
}
