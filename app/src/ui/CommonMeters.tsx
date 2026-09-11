import type { ResidualPolicy } from '../engine/types';
import { blankCommonRow, num, type CommonMeterRow, type HouseholdRow } from './formState';
import { PriorNote } from './PriorNote';
import { Section } from './Section';

interface Props {
  rows: CommonMeterRow[];
  households: HouseholdRow[];
  policy: ResidualPolicy;
  /** Date of the reading before last, if there is one. Display only (D-13). */
  priorDate: string;
  onChange: (rows: CommonMeterRow[]) => void;
  onPolicyChange: (p: ResidualPolicy) => void;
}

/**
 * Shared-load sub-meters (D-09): the water pump, the porch light, the lift.
 *
 * Distinct from the unmetered residual. The residual is unknown and lands on
 * the unmetered household; these units are MEASURED and belong to everybody, so
 * they are shared out separately.
 */
export function CommonMeters({
  rows,
  households,
  policy,
  priorDate,
  onChange,
  onPolicyChange,
}: Props) {
  const update = (id: string, patch: Partial<CommonMeterRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const total = rows.reduce(
    (a, r) => a + (num(r.present) - num(r.previous)) * (num(r.multiplier) || 1),
    0,
  );

  return (
    <Section
      id="shared"
      step={4}
      title="Shared meters"
      lede="A sub-meter on load that belongs to nobody in particular — the pump, the porch light, the lift. Skip this if there is no such meter."
    >
      {rows.length > 0 && (
        <div className="households">
          {rows.map((r, i) => (
            <div className="household" key={r.id}>
              <div className="household-head">
                <input
                  className="name"
                  value={r.name}
                  placeholder={`Shared meter ${i + 1}`}
                  onChange={(e) => update(r.id, { name: e.target.value })}
                />
                <button
                  className="ghost danger"
                  onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                >
                  Remove
                </button>
              </div>
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
            </div>
          ))}
        </div>
      )}

      <div className="row-actions">
        <button
          className={rows.length > 0 ? 'ghost' : undefined}
          onClick={() =>
            onChange([...rows, blankCommonRow(rows.length === 0 ? 'Motor / water pump' : '')])
          }
        >
          + Add shared meter
        </button>
      </div>

      {rows.length > 0 && (
        <div className="policy">
          <h3>Who pays the {total.toFixed(2)} shared units?</h3>
          <div className="radios">
            <label>
              <input
                type="radio"
                checked={policy.kind === 'proRata'}
                onChange={() => onPolicyChange({ kind: 'proRata' })}
              />
              In proportion to each household's own consumption
            </label>
            <label>
              <input
                type="radio"
                checked={policy.kind === 'equalSplit'}
                onChange={() => onPolicyChange({ kind: 'equalSplit' })}
              />
              Equally per household
            </label>
            <label>
              <input
                type="radio"
                checked={policy.kind === 'assignTo'}
                onChange={() =>
                  onPolicyChange({ kind: 'assignTo', householdId: households[0]?.id ?? '' })
                }
              />
              All to
              <select
                disabled={policy.kind !== 'assignTo'}
                value={policy.kind === 'assignTo' ? policy.householdId : ''}
                onChange={(e) =>
                  onPolicyChange({ kind: 'assignTo', householdId: e.target.value })
                }
              >
                {households.map((h, i) => (
                  <option key={h.id} value={h.id}>
                    {h.name || `Household ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            A lift or a stair light serves the households equally whatever they consume; a
            water pump tracks usage. Pick whichever matches what you actually share.
          </p>
        </div>
      )}
    </Section>
  );
}
