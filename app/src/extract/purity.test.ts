import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * E0.3's checkpoint (D-18, and `CLAUDE.md`'s working conventions): nothing under
 * `engine/` may import `extract/`, reach the network, or read a clock.
 *
 * The engine is the core asset precisely because it is pure, deterministic and
 * offline, and the golden test against the reference bill means what it means
 * only while that stays true. Extraction is the first feature in this project's
 * life that talks to anything, so the rule gets a test rather than a paragraph.
 *
 * The scanners are text-level on purpose: a rule that runs before the bundler
 * and needs no graph is one that cannot be argued with in review.
 */

const ENGINE = resolvePath(fileURLToPath(new URL('../engine', import.meta.url)));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.tsx?$/.test(e.name) ? [path] : [];
  });
}

/** `from '...'` and `import('...')` — every specifier a file pulls in. */
export function importsOf(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

/** An import that leaves `engine/`. Relative paths that stay inside are fine. */
const escapes = (specifier: string, fileDir: string): boolean => {
  if (!specifier.startsWith('.')) return true; // a bare package, including node builtins
  const resolved = join(fileDir, specifier);
  return !resolved.startsWith(ENGINE);
};

/**
 * Anything that reaches off the machine, plus browser storage — the engine may
 * not know that storage exists either (D-03).
 */
const NETWORK =
  /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\s*\.|localStorage|sessionStorage|indexedDB|require\s*\(\s*['"]https?/;

/**
 * Reading a clock, not handling a date. `align.ts` parses `yyyy-mm-dd` strings
 * and compares them with each other, which is arithmetic; `Date.now()` and a
 * zero-argument `new Date()` are the machine's opinion about right now, and the
 * same bill must split the same way next year.
 */
const CLOCK = /Date\s*\.\s*now\s*\(|new\s+Date\s*\(\s*\)|performance\s*\.\s*now\s*\(|Math\s*\.\s*random\s*\(/;

const files = sources(ENGINE).filter((f) => !/\.test\.tsx?$/.test(f));
const named = (f: string) => relative(ENGINE, f).replace(/\\/g, '/');

describe('the engine stays pure (D-18)', () => {
  it('has engine sources to check at all', () => {
    // A scanner that silently finds no files passes forever.
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const dir = join(file, '..');

    it(`${named(file)} imports nothing outside engine/`, () => {
      expect(importsOf(source).filter((s) => escapes(s, dir))).toEqual([]);
    });

    it(`${named(file)} does not reach the network or browser storage`, () => {
      expect(NETWORK.test(source)).toBe(false);
    });

    it(`${named(file)} does not read a clock`, () => {
      expect(CLOCK.test(source)).toBe(false);
    });
  }
});

/**
 * The checkpoint asks that the guard fail when a deliberate import is added.
 * Proving that against the real tree means breaking it; proving it against the
 * exact strings a break would produce does not, and fails for the same reason.
 */
describe('the guard itself catches what it is for', () => {
  const dir = join(ENGINE, 'providers');

  it('flags an import of the extraction module', () => {
    const bad = "import { parseCandidate } from '../../extract/candidate';";
    expect(importsOf(bad).filter((s) => escapes(s, dir))).toEqual(['../../extract/candidate']);
  });

  it('flags an import of the UI or of storage', () => {
    for (const line of [
      "import { blankBill } from '../../ui/formState';",
      "import { load } from '../../storage/local';",
      "import fetch from 'node-fetch';",
      "const { x } = await import('../../extract/schema');",
    ]) {
      expect(importsOf(line).filter((s) => escapes(s, dir)).length).toBe(1);
    }
  });

  it('allows a relative import that stays inside the engine', () => {
    const fine = "import { toPaise } from '../money';\nimport type { Slab } from './types';";
    expect(importsOf(fine).filter((s) => escapes(s, dir))).toEqual([]);
  });

  it('flags a network call and a clock read', () => {
    expect(NETWORK.test("await fetch('/api/extract')")).toBe(true);
    expect(NETWORK.test('localStorage.getItem("cycles")')).toBe(true);
    expect(CLOCK.test('const now = Date.now();')).toBe(true);
    expect(CLOCK.test('const now = new Date();')).toBe(true);
    // And does not flag the date arithmetic the aligner is built on (D-13).
    expect(CLOCK.test('Date.parse(`${iso}T00:00:00Z`)')).toBe(false);
  });
});
