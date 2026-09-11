import { formatRupees } from '../engine/money';
import type { SplitResult } from '../engine/types';
import { fmtUnits } from '../export/text';
import { Disclosure } from './Disclosure';
import { Section } from './Section';

/**
 * The working behind the panel's answer, at full width because it is a wide
 * table: where the units came from, then every charge on the bill with each
 * household's part of it beside the whole.
 *
 * The unit counts are open — they are what people argue about. The charge-by-
 * charge table is behind a fold whose summary already says what it totals, and
 * it prints open regardless.
 */
export function Breakdown({ result }: { result: SplitResult }) {
  return (
    <Section id="working" title="How it was worked out" className="result">
      <div className="totals">
        <Stat label="Official units" value={fmtUnits(result.officialUnits)} />
        <Stat label="Household sub-meters" value={fmtUnits(result.meteredUnits)} />
        {result.window && result.window.driftDays !== 0 && (
          <Stat
            label="Reading-date drift"
            value={`${result.window.driftDays > 0 ? '+' : ''}${result.window.driftDays.toFixed(0)} d`}
            tone="warn"
          />
        )}
        {result.commonMeters.length > 0 && (
          <Stat label="Shared meters" value={fmtUnits(result.commonUnits)} />
        )}
        <Stat
          label="Unaccounted"
          value={fmtUnits(result.residual)}
          tone={result.residual < 0 ? 'warn' : undefined}
        />
        <Stat label="Bill total" value={`₹${formatRupees(result.payable)}`} strong />
      </div>

      {result.commonMeters.length > 0 && (
        <p className="hint">
          Shared load: {result.commonMeters.map((m) => `${m.name} ${fmtUnits(m.units)} units`).join(' · ')}{' '}
          — divided across the households and included in their unit counts below.
        </p>
      )}

      <Disclosure
        summary="Charge by charge"
        detail={`${result.components.length} lines · ₹${formatRupees(result.payable)}`}
      >
        <p className="hint table-hint print-hide">
          A column per household — scroll sideways for the rest. The charge names stay put.
        </p>
        <div className="table-scroll">
          <table className="breakdown">
            <thead>
              <tr>
                <th>Charge</th>
                {result.shares.map((s) => (
                  <th key={s.householdId} className="num">
                    {s.name}
                  </th>
                ))}
                <th className="num">Bill</th>
              </tr>
              <tr className="subhead">
                <th>Units</th>
                {result.shares.map((s) => (
                  <th key={s.householdId} className="num">
                    {fmtUnits(s.units)}
                    <span className="pct"> · {(s.ratio * 100).toFixed(1)}%</span>
                    {(s.commonUnits !== 0 || s.residualUnits !== 0) && (
                      <span className="units-origin">
                        {fmtUnits(s.ownUnits)} own
                        {s.commonUnits !== 0 && ` + ${fmtUnits(s.commonUnits)} shared`}
                        {s.residualUnits !== 0 && ` + ${fmtUnits(s.residualUnits)} unaccounted`}
                      </span>
                    )}
                    {Math.abs(s.ownUnits - s.ownRawUnits) >= 0.005 && (
                      <span className="units-origin">
                        sub-meter read {fmtUnits(s.ownRawUnits)}, aligned to the bill’s window
                      </span>
                    )}
                  </th>
                ))}
                <th className="num">{fmtUnits(result.officialUnits)}</th>
              </tr>
            </thead>
            <tbody>
              {result.components.map((c, ci) => (
                <tr key={c.id} className={c.accountLevel ? 'account-level' : undefined}>
                  <td>{c.label}</td>
                  {result.shares.map((s) => (
                    <td key={s.householdId} className="num">
                      {formatRupees(s.lines[ci].amount)}
                    </td>
                  ))}
                  <td className="num">{formatRupees(c.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Share payable</th>
                {result.shares.map((s) => (
                  <th key={s.householdId} className="num">
                    ₹{formatRupees(s.total)}
                  </th>
                ))}
                <th className="num">₹{formatRupees(result.payable)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </Disclosure>
    </Section>
  );
}

function Stat({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'warn';
}) {
  return (
    <div className={`stat${strong ? ' strong' : ''}${tone === 'warn' ? ' warn' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
