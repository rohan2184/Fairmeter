import { migrateCycles } from './migrate';
import type { CycleStore, SavedCycle } from './types';

const KEY = 'bill-split.cycles.v1';

/**
 * localStorage implementation of CycleStore (D-03). Degrades to an in-memory
 * store if localStorage is unavailable (private browsing, blocked storage) so
 * the calculator still works — history just does not survive a reload.
 */
export function createLocalStore(): CycleStore {
  let memory: SavedCycle[] | null = null;

  const read = (): SavedCycle[] => {
    if (memory) return memory;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrateCycles(JSON.parse(raw) as SavedCycle[]) : [];
    } catch {
      memory = [];
      return memory;
    }
  };

  const write = (cycles: SavedCycle[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cycles));
      memory = null;
    } catch {
      memory = cycles;
    }
  };

  const sorted = (cycles: SavedCycle[]) =>
    [...cycles].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  return {
    list: () => sorted(read()),
    get: (id) => read().find((c) => c.id === id),

    save(cycle) {
      const cycles = read().filter((c) => c.id !== cycle.id);
      cycles.push(cycle);
      write(cycles);
    },

    remove(id) {
      write(read().filter((c) => c.id !== id));
    },

    exportAll: () => JSON.stringify({ version: 1, cycles: sorted(read()) }, null, 2),

    importAll(json, mode = 'merge') {
      const parsed = JSON.parse(json) as { cycles?: SavedCycle[] } | SavedCycle[];
      const raw = Array.isArray(parsed) ? parsed : (parsed.cycles ?? []);
      if (!Array.isArray(raw)) throw new Error('No cycles found in that file.');
      const incoming = migrateCycles(raw);

      if (mode === 'replace') {
        write(incoming);
        return incoming.length;
      }
      const byId = new Map(read().map((c) => [c.id, c]));
      for (const c of incoming) byId.set(c.id, c);
      write([...byId.values()]);
      return incoming.length;
    },
  };
}
