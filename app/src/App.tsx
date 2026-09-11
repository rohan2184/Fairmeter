import { useMemo, useState } from 'react';
import { split, validate } from './engine/split';
import type { ResidualPolicy, SplitOptions, SplitResult } from './engine/types';
import { createLocalStore } from './storage/localStore';
import type { SavedCycle } from './storage/types';
import { BillForm } from './ui/BillForm';
import { Breakdown } from './ui/Breakdown';
import { CommonMeters } from './ui/CommonMeters';
import { Hero } from './ui/Hero';
import { Households } from './ui/Households';
import { History } from './ui/History';
import { MobileBar } from './ui/MobileBar';
import { SplitPanel } from './ui/SplitPanel';
import { TopBar, type StepState } from './ui/TopBar';
import {
  blankBill,
  blankRow,
  fromCycle,
  nextCycleFrom,
  newId,
  sampleBill,
  submeterDates,
  toCommonMeters,
  toCommonRecords,
  toEngineInputs,
  toHouseholds,
  toOfficialBill,
  toProviderInput,
  toRecords,
  type BillFields,
  type CommonMeterRow,
  type HouseholdRow,
} from './ui/formState';
import './styles.css';

const store = createLocalStore();

const startingRows = (): HouseholdRow[] => [blankRow('Ground floor', false), blankRow('First floor')];

const filled = (v: string) => String(v ?? '').trim() !== '';

export default function App() {
  const [bill, setBill] = useState<BillFields>(blankBill);
  const [rows, setRows] = useState<HouseholdRow[]>(startingRows);
  const [commonRows, setCommonRows] = useState<CommonMeterRow[]>([]);
  const [policy, setPolicy] = useState<ResidualPolicy>({ kind: 'proRata' });
  const [commonPolicy, setCommonPolicy] = useState<ResidualPolicy>({ kind: 'proRata' });
  const [cycles, setCycles] = useState<SavedCycle[]>(() => store.list());
  const [saved, setSaved] = useState(false);

  const { result, issues } = useMemo(
    () => compute(bill, rows, commonRows, policy, commonPolicy),
    [bill, rows, commonRows, policy, commonPolicy],
  );

  const apply = (cycle: SavedCycle, roll: boolean) => {
    const { bill: b, rows: r, commonRows: c } = roll ? nextCycleFrom(cycle) : fromCycle(cycle);
    setBill(b);
    setRows(r);
    setCommonRows(c);
    setPolicy(cycle.policy);
    setCommonPolicy(cycle.commonPolicy ?? { kind: 'proRata' });
    setSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAll = () => {
    setBill(blankBill());
    setRows(startingRows());
    setCommonRows([]);
    setPolicy({ kind: 'proRata' });
    setCommonPolicy({ kind: 'proRata' });
    setSaved(false);
  };

  const saveCycle = () => {
    store.save({
      id: newId(),
      savedAt: new Date().toISOString(),
      label: bill.billingMonth || 'Untitled cycle',
      bill: toProviderInput(bill),
      households: toRecords(rows),
      commonMeters: toCommonRecords(commonRows),
      submeterPriorDate: bill.submeterPriorDate || undefined,
      submeterPreviousDate: bill.submeterPreviousDate || undefined,
      submeterReadingDate: bill.submeterReadingDate || undefined,
      policy,
      commonPolicy,
    });
    setCycles(store.list());
    setSaved(true);
  };

  const month = bill.billingMonth || 'this cycle';
  const latest = cycles[0];

  /** Where you are in the form, for the bar at the top. */
  const steps: StepState[] = [
    { id: 'provider', label: 'Provider', done: true },
    { id: 'bill', label: 'Bill', done: filled(bill.officialPrevious) && filled(bill.officialPresent) },
    {
      id: 'households',
      label: 'Households',
      done: rows.length > 0 && rows.every((r) => !r.metered || filled(r.present)),
    },
    { id: 'shared', label: 'Shared', done: commonRows.length > 0, optional: true },
    { id: 'split', label: 'Split', done: result !== null },
  ];

  return (
    <div className="app">
      <TopBar steps={steps} />

      <Hero
        result={result}
        billingMonth={month}
        lastSaved={latest?.label || latest?.bill.billingMonth}
        onSample={() => (setBill(sampleBill()), setSaved(false))}
        onContinue={() => latest && apply(latest, true)}
        onClear={clearAll}
      />

      <main className="page shell">
        <p className="print-only print-head">Fairmeter — electricity bill split, {month}</p>

        <div className="shell-form">
          <BillForm value={bill} onChange={(b) => (setBill(b), setSaved(false))} />
          <Households
            rows={rows}
            policy={policy}
            priorDate={bill.submeterPriorDate}
            onChange={(r) => (setRows(r), setSaved(false))}
            onPolicyChange={setPolicy}
          />
          <CommonMeters
            rows={commonRows}
            households={rows}
            policy={commonPolicy}
            priorDate={bill.submeterPriorDate}
            onChange={(r) => (setCommonRows(r), setSaved(false))}
            onPolicyChange={setCommonPolicy}
          />
        </div>

        <aside className="shell-aside">
          <SplitPanel
            result={result}
            issues={issues}
            billingMonth={month}
            saved={saved}
            onSave={saveCycle}
          />
        </aside>
      </main>

      <div className="page shell-wide">
        {result && <Breakdown result={result} />}

        <History
          store={store}
          cycles={cycles}
          onLoad={(c) => apply(c, false)}
          onContinue={(c) => apply(c, true)}
          onChanged={() => setCycles(store.list())}
          totalsFor={totalsFor}
        />
      </div>

      <footer className="site-footer print-hide">
        <div className="page footer-inner">
          <div>
            <p className="footer-name">Fairmeter</p>
            <p className="hint">
              One official meter, several households, one bill — divided in proportion to the
              units each used, down to the paisa.
            </p>
          </div>
          <div>
            <p className="footer-heading">Your data</p>
            <p className="hint">
              Saved in this browser only. No account, nothing uploaded. Use Export in History for
              a backup you keep.
            </p>
          </div>
        </div>
      </footer>

      <MobileBar result={result} />
    </div>
  );
}

function compute(
  bill: BillFields,
  rows: HouseholdRow[],
  commonRows: CommonMeterRow[],
  policy: ResidualPolicy,
  commonPolicy: ResidualPolicy,
): { result: SplitResult | null; issues: string[] } {
  const officialBill = toOfficialBill(toProviderInput(bill));
  const dates = submeterDates(bill);
  const households = toHouseholds(rows, dates);
  const options: SplitOptions = {
    residualPolicy: policy,
    commonMeters: toCommonMeters(commonRows, dates),
    commonPolicy,
  };
  const issues = validate(officialBill, households, options);
  if (issues.length) return { result: null, issues };
  try {
    return { result: split(officialBill, households, options), issues: [] };
  } catch (e) {
    return { result: null, issues: [(e as Error).message] };
  }
}

function totalsFor(cycle: SavedCycle) {
  try {
    const { bill, households, options } = toEngineInputs(cycle);
    const r = split(bill, households, options);
    return { units: r.officialUnits, payable: r.payable };
  } catch {
    return null;
  }
}
