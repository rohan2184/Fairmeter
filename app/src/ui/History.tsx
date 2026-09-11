import { useRef } from 'react';
import { formatRupees } from '../engine/money';
import type { CycleStore, SavedCycle } from '../storage/types';

interface Props {
  store: CycleStore;
  cycles: SavedCycle[];
  onLoad: (cycle: SavedCycle) => void;
  onContinue: (cycle: SavedCycle) => void;
  onChanged: () => void;
  totalsFor: (cycle: SavedCycle) => { units: number; payable: number } | null;
}

export function History({ store, cycles, onLoad, onContinue, onChanged, totalsFor }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([store.exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bill-split-history.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const count = store.importAll(await file.text(), 'merge');
      onChanged();
      alert(`Imported ${count} saved cycle${count === 1 ? '' : 's'}.`);
    } catch (e) {
      alert(`Could not read that file: ${(e as Error).message}`);
    }
  };

  return (
    <section className="card print-hide">
      <div className="card-head">
        <div className="card-headings">
          <h2>History</h2>
        </div>
        <div className="card-actions row-actions">
          <button className="ghost" onClick={doExport} disabled={cycles.length === 0}>
            Export backup
          </button>
          <button className="ghost" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {cycles.length === 0 ? (
        <p className="lede">
          Nothing saved yet. Save a cycle and the next one starts with this cycle’s present
          readings already in place.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="history">
            <thead>
              <tr>
                <th>Cycle</th>
                <th className="num">Units</th>
                <th className="num">Total</th>
                <th>Households</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => {
                const t = totalsFor(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.label || c.bill.billingMonth || 'Untitled'}</strong>
                      <span className="hint"> saved {c.savedAt.slice(0, 10)}</span>
                    </td>
                    <td className="num">{t ? t.units.toFixed(0) : '—'}</td>
                    <td className="num">{t ? `₹${formatRupees(t.payable)}` : '—'}</td>
                    <td>{c.households.map((h) => h.name).join(', ')}</td>
                    <td className="row-actions">
                      <button className="ghost" onClick={() => onLoad(c)}>
                        Open
                      </button>
                      <button onClick={() => onContinue(c)}>Start next cycle</button>
                      <button
                        className="ghost danger"
                        onClick={() => {
                          if (confirm(`Delete "${c.label || c.bill.billingMonth}"?`)) {
                            store.remove(c.id);
                            onChanged();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
