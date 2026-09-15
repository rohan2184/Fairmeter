import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { split } from '../engine/split';
import { toOfficialBill, toProviderInput } from '../ui/formState';
import { parseCandidate } from './candidate';
import { DOCUMENT_FIXTURES, FIXTURES } from './fixtures';
import { SCALAR_FIELDS, schemaRateKeys } from './schema';
import { resolve as resolvePlan } from './candidate';

/**
 * E0.4's checkpoint: the fixtures load, and each one's expected fields, fed to
 * the engine, reproduce that cycle's `printedPayable` to the paisa.
 *
 * That is the grading function of the eval in E5.1, tested here against the
 * expected answers before any model has been asked for one — so a bad score
 * later is the model's, never the harness's.
 */

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

/** One household, unmetered, takes the whole bill: the total is what is graded. */
const WHOLE_BILL = [{ id: 'all', name: 'Everyone', metered: false }];

describe('extraction fixtures', () => {
  it('loads the reference bill and all seven seeded cycles', () => {
    expect(FIXTURES).toHaveLength(8);
    expect(new Set(FIXTURES.map((f) => f.id)).size).toBe(8);
  });

  it('carries the reference bill as a real document', () => {
    expect(DOCUMENT_FIXTURES).toHaveLength(1);
    const doc = DOCUMENT_FIXTURES[0].document;
    expect(doc?.kind).toBe('pdf');
    expect(existsSync(resolve(ROOT, doc?.path ?? ''))).toBe(true);
  });

  it("has the reference bill's text layer, with the figures in it", () => {
    const text = FIXTURES[0].text ?? '';
    expect(text.length).toBeGreaterThan(1000);
    for (const printed of ['1,860.00', '1936', '1775', 'July 2026', '21/07/26']) {
      expect(text).toContain(printed);
    }
  });

  for (const fixture of FIXTURES) {
    describe(fixture.label, () => {
      it('recomputes to the printed payable, to the paisa', () => {
        const bill = toOfficialBill(toProviderInput(fixture.expected));
        expect(bill.printedPayable).toBeDefined();
        const result = split(bill, WHOLE_BILL);
        expect(result.payable).toBe(bill.printedPayable);
        expect(result.warnings.filter((w) => w.includes('printed payable'))).toHaveLength(0);
      });

      it('names a plan that exists, with exactly that plan\'s rate keys', () => {
        const found = resolvePlan(fixture.providerId, fixture.planId);
        if (!('plan' in found)) throw new Error(found.message);
        expect(Object.keys(fixture.expected.rates).sort()).toEqual(
          schemaRateKeys(found.plan).sort(),
        );
      });

      it('is reachable through the parser, which is how the eval will grade it', () => {
        // A perfect model returns exactly these strings. Round-tripping them
        // through `parseCandidate` proves the fixture is a valid extraction
        // target and not merely a valid bill.
        const asResponse = {
          ...Object.fromEntries(
            SCALAR_FIELDS.map((f) => [f.key, fixture.expected[f.key] as string]),
          ),
          rates: fixture.expected.rates,
        };
        const result = parseCandidate(asResponse, fixture.providerId, fixture.planId);
        if (!result.ok) throw new Error(result.error.message);

        for (const { key } of SCALAR_FIELDS) {
          expect(result.fields[key]).toBe(fixture.expected[key]);
        }
        expect(result.fields.rates).toEqual(fixture.expected.rates);

        const bill = toOfficialBill(toProviderInput(result.fields));
        expect(split(bill, WHOLE_BILL).payable).toBe(bill.printedPayable);
      });
    });
  }
});
