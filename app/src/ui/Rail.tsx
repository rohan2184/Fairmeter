import { formatRupees } from '../engine/money';

export interface RailSegment {
  id: string;
  name: string;
  ratio: number;
  total: number;
}

/**
 * The split drawn as the shares themselves, one segment per household.
 *
 * Two forms of the same figure. The wide one carries each household's name and
 * amount inside its own segment, so colour is never doing the work alone. The
 * compact one is a bare bar for the narrow answer panel, where the labelled
 * share cards sit directly beneath it in the same order and the same hues.
 *
 * It says nothing the cards and the table don't, so it is hidden from screen
 * readers rather than read out twice.
 */
export function Rail({ shares, compact }: { shares: RailSegment[]; compact?: boolean }) {
  if (shares.length < 2 || shares.some((s) => s.ratio <= 0)) return null;
  return (
    <div className={compact ? 'rail compact' : 'rail'} aria-hidden="true">
      {shares.map((s) => (
        <div className="rail-seg" key={s.id} style={{ flexGrow: s.ratio }}>
          {!compact && (
            <>
              <span className="rail-name">{s.name}</span>
              <span>
                {(s.ratio * 100).toFixed(1)}% · ₹{formatRupees(s.total)}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
