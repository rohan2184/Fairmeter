import type { ResidualPolicy } from '../engine/types';
import { blankRow, num, type HouseholdRow } from './formState';
import { PriorNote } from './PriorNote';
import { Section } from './Section';

interface Props {
  rows: HouseholdRow[];
  policy: ResidualPolicy;
  /** Date of the reading before last, if there is one. Display only (D-13). */
  priorDate: string;
  onChange: (rows: HouseholdRow[]) => void;
  onPolicyChange: (p: ResidualPolicy) => void;
}

export function Households({ rows, policy, priorDate, onChange, onPolicyChange }: Props) {
  const update = (id: string, patch: Partial<HouseholdRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const unmeteredCount = rows.filter((r) => !r.metered).length;
  const allMetered = rows.length > 0 && unmeteredCount === 0;

  return (
    <Section
      id="households"
      step={3}
      title="Households sharing this connection"
      lede="One row per household behind the official meter — whoever lives there, owner or tenant."
    >
      <div className="households">
        {rows.map((r, i) => (
          <div className={`household ${r.metered ? 'metered' : 'unmetered'}`} key={r.id}>
            <div className="household-head">
              <input
                className="name"
                value={r.name}
                placeholder={`Household ${i + 1}`}
                onChange={(e) => update(r.id, { name: e.target.value })}
              />
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={r.metered}
                  onChange={(e) => update(r.id, { metered: e.target.checked })}
                />
                <span>Has a sub-meter</span>
              </label>
              <button
                className="ghost danger"
                onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                disabled={rows.length <= 1}
                title={rows.length <= 1 ? 'At least one household is required' : 'Remove'}
              >
                Remove
              </button>
            </div>

            {r.metered ? (
              <div className="grid readings">
                <label className="field">
                  <span className="field-label">Previous reading</span>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={r.previous}
                    onChange={(e) => update(r.id, { previous: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Present reading</span>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={r.present}
                    onChange={(e) => update(r.id, { present: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Multiplier</span>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={r.multiplier}
                    onChange={(e) => update(r.id, { multiplier: e.target.value })}
                  />
                </label>
                <div className="field computed">
                  <span className="field-label">Units</span>
                  <output>
                    {((num(r.present) - num(r.previous)) * (num(r.multiplier) || 1)).toFixed(2)}
                  </output>
                </div>
                <PriorNote prior={r.prior} date={priorDate} />
              </div>
            ) : (
              <p className="note">
                No sub-meter — charged the official meter minus every other meter, so this
                household also absorbs whatever nothing measures.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="row-actions">
        <button onClick={() => onChange([...rows, blankRow(`Household ${rows.length + 1}`)])}>
          + Add household with sub-meter
        </button>
        <button
          className="ghost"
          disabled={unmeteredCount > 0}
          title={unmeteredCount > 0 ? 'Only one household can be unmetered' : undefined}
          onClick={() => onChange([...rows, blankRow('Owner / common', false)])}
        >
          + Add unmetered household
        </button>
      </div>
      <p className="hint row-hint">
        Only one household can be unmetered: with two unknowns and one official reading, their
        consumption cannot be told apart.
      </p>

      {allMetered && (
        <div className="policy">
          <h3>Unaccounted units</h3>
          <p className="lede">
            Every household is sub-metered, so whatever the official meter saw beyond every
            sub-meter is unaccounted for. Who pays it?
          </p>
          <div className="radios">
            <label>
              <input
                type="radio"
                checked={policy.kind === 'proRata'}
                onChange={() => onPolicyChange({ kind: 'proRata' })}
              />
              Split in proportion to consumption
            </label>
            <label>
              <input
                type="radio"
                checked={policy.kind === 'equalSplit'}
                onChange={() => onPolicyChange({ kind: 'equalSplit' })}
              />
              Split equally
            </label>
            <label>
              <input
                type="radio"
                checked={policy.kind === 'assignTo'}
                onChange={() => onPolicyChange({ kind: 'assignTo', householdId: rows[0].id })}
              />
              Charge it all to
              <select
                disabled={policy.kind !== 'assignTo'}
                value={policy.kind === 'assignTo' ? policy.householdId : ''}
                onChange={(e) => onPolicyChange({ kind: 'assignTo', householdId: e.target.value })}
              >
                {rows.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    {r.name || `Household ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </Section>
  );
}
