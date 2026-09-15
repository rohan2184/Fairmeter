import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { split } from '../../app/src/engine/split';
import { toOfficialBill, toProviderInput } from '../../app/src/ui/formState';
import { REFERENCE_FIXTURE } from '../../app/src/extract/fixtures';
import { SCALAR_FIELDS, schemaRateKeys } from '../../app/src/extract/schema';
import { resolve as resolvePlan } from '../../app/src/extract/candidate';
import type { ExtractResult } from '../../app/src/extract/types';
import { createHandler } from './handler';
import type { LogLine } from './log';

/**
 * E1.2's checkpoint, and Milestone M2 — the reference bill reads itself.
 *
 * **This is the only test in the repository that costs money.** It is skipped
 * unless `FAIRMETER_LIVE=1`, so `npm test` is free and stays free; run it with
 * `fairmeter-admin` loaded (D-23 — `fairmeter-deploy` cannot invoke the model,
 * and the failure would look like a Bedrock error rather than a credential one).
 *
 *     AWS_PROFILE=fairmeter-admin FAIRMETER_LIVE=1 npx vitest run ../lambda
 *
 * The grading is not new. It is exactly E0.4's function — feed the fields to
 * the engine and see whether the computed payable equals the payable printed on
 * the paper, to the paisa — applied to fields a model produced instead of
 * fields the owner typed. That is D-18's whole argument made executable: the
 * bill checks its own extraction, so this test never has to trust the model.
 */

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** One household, unmetered, takes the whole bill: the total is what is graded. */
const WHOLE_BILL = [{ id: 'all', name: 'Everyone', metered: false }];

const live = process.env.FAIRMETER_LIVE === '1';
const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

describe.skipIf(!live)('E1.2 — the reference bill, read by the model', () => {
  it(
    'returns a schema-valid candidate that recomputes to the printed payable',
    { timeout: 180_000 },
    async () => {
      const fixture = REFERENCE_FIXTURE;
      const bytes = readFileSync(resolve(ROOT, fixture.document!.path));

      // The SDK is imported HERE rather than at the top of the file so that a
      // skipped run never loads it, and `npm test` never pays for resolving a
      // credential it is not going to use.
      const { createBedrockReader, MODEL_ID, MAX_OUTPUT_TOKENS, EFFORT } = await import('./bedrock');
      const reader = createBedrockReader();

      const lines: LogLine[] = [];
      const handler = createHandler({
        read: reader.read,
        usage: reader.lastUsage,
        log: (line) => lines.push(line),
      });

      const response = await handler({
        body: JSON.stringify({
          providerId: fixture.providerId,
          planId: fixture.planId,
          data: bytes.toString('base64'),
          declaredType: 'application/pdf',
        }),
      });

      const result = JSON.parse(response.body) as ExtractResult;

      // Everything below is printed whether the assertions pass or fail: the
      // owner's job this session is to read the candidate next to the actual
      // bill, and a bare assertion failure would not let them.
      console.log(`\nmodel ${MODEL_ID} · effort ${EFFORT} · ceiling ${MAX_OUTPUT_TOKENS} tokens`);
      console.log(`log line (E1.4 — this is verbatim what CloudWatch gets):`);
      for (const line of lines) console.log(`  ${JSON.stringify(line)}`);

      if (!result.ok) {
        console.log(`\nFAILED: ${result.error.code} — ${result.error.message}`);
      } else {
        const found = resolvePlan(fixture.providerId, fixture.planId);
        if (!('plan' in found)) throw new Error(found.message);

        console.log(`\nutility as printed: "${result.document.utility}"`);
        console.log('\nfield                      read                 expected');
        const row = (label: string, got: string, want: string) =>
          console.log(
            `${(got === want ? '  ' : '✗ ') + label.padEnd(25)}${got.padEnd(21)}${want}`,
          );
        for (const { key } of SCALAR_FIELDS) {
          row(key, result.fields[key] as string, fixture.expected[key] as string);
        }
        for (const key of schemaRateKeys(found.plan)) {
          row(`rates.${key}`, result.fields.rates[key] ?? '', fixture.expected.rates[key] ?? '');
        }
        for (const w of result.warnings) console.log(`\nwarning [${w.code}] ${w.message}`);

        const bill = toOfficialBill(toProviderInput(result.fields));
        const computed = split(bill, WHOLE_BILL).payable;
        console.log(
          `\ncomputed ${rupees(computed)} · printed ${rupees(bill.printedPayable ?? 0)} · ` +
            `difference ${rupees(Math.abs(computed - (bill.printedPayable ?? 0)))}`,
        );
      }

      expect(response.statusCode).toBe(200);
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);

      // M2, stated exactly as `ROADMAP.md` states it: candidate `BillFields`
      // out, engine recomputes, computed total equals `printedPayable` to the
      // paisa (D-18).
      const bill = toOfficialBill(toProviderInput(result.fields));
      expect(bill.printedPayable).toBeDefined();
      expect(split(bill, WHOLE_BILL).payable).toBe(bill.printedPayable);
    },
  );
});
