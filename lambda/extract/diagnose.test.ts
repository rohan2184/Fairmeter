import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '../../app/src/engine/providers/registry';
import { split } from '../../app/src/engine/split';
import { toOfficialBill, toProviderInput } from '../../app/src/ui/formState';
import { REFERENCE_FIXTURE } from '../../app/src/extract/fixtures';
import { schemaRateKeys } from '../../app/src/extract/schema';
import type { ExtractResult } from '../../app/src/extract/types';
import { createHandler, type ModelReader } from './handler';
import { diagnose, utilityMatches } from './diagnose';
import { extractionPrompt } from './prompt';

/**
 * E1.3's checkpoint: a cropped bill returns PARTIAL FIELDS plus a NAMED REASON,
 * and the UI contract of E0.2 can render it.
 *
 * The bill is printed on both sides and nearly every rate is on the back, so
 * "cropped" here is the real-world crop: a photograph of the front only. It is
 * built by taking the reference bill's correct read and removing what is not on
 * page 1, which is exactly what a model looking at one side would return.
 */

/** One household holding the whole bill: the split is not what is under test. */
const WHOLE_BILL = [{ id: 'all', name: 'All', metered: false as const }];

const provider = PROVIDERS.find((p) => p.id === REFERENCE_FIXTURE.providerId)!;
const plan = provider.plans.find((p) => p.id === REFERENCE_FIXTURE.planId)!;

/** The model's response for a complete, correct read of the reference bill. */
function fullResponse(): Record<string, unknown> {
  const { expected } = REFERENCE_FIXTURE;
  const { providerId, planId, rates, ...scalars } = expected;
  void providerId;
  void planId;
  return {
    ...scalars,
    document: { utility: 'Torrent Power Limited' },
    rates: { ...rates },
  };
}

/** The front page only: the readings are there, the tariff table is not. */
function frontPageOnly(): Record<string, unknown> {
  const response = fullResponse();
  response.rates = Object.fromEntries(schemaRateKeys(plan).map((k) => [k, '']));
  return response;
}

const PDF = Buffer.from(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])).toString('base64');

async function run(response: Record<string, unknown>): Promise<{
  statusCode: number;
  result: ExtractResult;
}> {
  const read: ModelReader = async () => JSON.stringify(response);
  const res = await createHandler(read)({
    body: JSON.stringify({
      providerId: provider.id,
      planId: plan.id,
      data: PDF,
      declaredType: 'application/pdf',
    }),
    requestContext: { http: { method: 'POST' } },
  });
  return { statusCode: res.statusCode, result: JSON.parse(res.body) as ExtractResult };
}

describe('a complete read', () => {
  it('recomputes to the printed payable, to the paisa (D-18)', async () => {
    const { statusCode, result } = await run(fullResponse());
    expect(statusCode).toBe(200);
    if (!result.ok) throw new Error(result.error.message);

    // This is the whole point of the contract: the candidate goes into the
    // engine exactly as typed fields do, and the paper agrees.
    const bill = toOfficialBill(toProviderInput(result.fields));
    expect(split(bill, WHOLE_BILL).payable).toBe(bill.printedPayable);
    expect(result.warnings.filter((w) => w.code !== 'missing-field')).toEqual([]);
  });
});

describe('a bill photographed front-side only', () => {
  it('returns the fields it did read, still 200', async () => {
    const { statusCode, result } = await run(frontPageOnly());
    expect(statusCode).toBe(200);
    if (!result.ok) throw new Error('a partial read is a result, not a failure');
    expect(result.fields.officialPresent).toBe(REFERENCE_FIXTURE.expected.officialPresent);
    expect(result.fields.printedPayable).toBe(REFERENCE_FIXTURE.expected.printedPayable);
  });

  it('names the reason, and the reason says to turn the bill over', async () => {
    const { result } = await run(frontPageOnly());
    if (!result.ok) throw new Error('expected a partial read');
    const named = result.warnings[0];
    expect(named.code).toBe('back-page-missing');
    expect(named.message).toMatch(/back/i);
    expect(named.field).toBe('rates');
  });

  it('leaves every unread rate EMPTY, never the published default (D-22)', async () => {
    const { result } = await run(frontPageOnly());
    if (!result.ok) throw new Error('expected a partial read');
    for (const key of schemaRateKeys(plan)) {
      expect(result.fields.rates[key]).toBe('');
      expect(result.status.rates[key]).toBe('missing');
    }
  });

  it('names each missing rate as well, so the UI can flag the fields', async () => {
    const { result } = await run(frontPageOnly());
    if (!result.ok) throw new Error('expected a partial read');
    const flagged = result.warnings.filter((w) => w.code === 'missing-field').map((w) => w.field);
    for (const key of schemaRateKeys(plan)) expect(flagged).toContain(key);
  });

  it('computes LOW, which is how the owner finds out (D-22)', async () => {
    const { result } = await run(frontPageOnly());
    if (!result.ok) throw new Error('expected a partial read');
    // The consequence the owner accepted: dropped charges make the computed
    // total disagree loudly with the printed one, rather than quietly.
    const bill = toOfficialBill(toProviderInput(result.fields));
    const computed = split(bill, WHOLE_BILL).payable;
    expect(bill.printedPayable).toBeDefined();
    expect(computed).toBeLessThan(bill.printedPayable!);
  });
});

describe('a page that is not a bill', () => {
  it('is a failure, not a candidate', async () => {
    const empty = Object.fromEntries(
      Object.entries(fullResponse()).map(([k]) => [k, k === 'rates' || k === 'document' ? {} : '']),
    );
    const { statusCode, result } = await run(empty);
    expect(statusCode).toBe(422);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unreadable');
  });
});

describe('a bill from another utility', () => {
  it('is named as wrong-provider, with the fields kept for inspection', async () => {
    const other = fullResponse();
    other.document = { utility: 'Adani Electricity Mumbai Limited' };
    const { statusCode, result } = await run(other);
    expect(statusCode).toBe(200);
    if (!result.ok) throw new Error('the figures are still worth showing');
    expect(result.warnings[0].code).toBe('wrong-provider');
    expect(result.warnings[0].message).toContain('Adani');
  });
});

describe('utilityMatches', () => {
  it('accepts the utility whose plan was chosen, in any printed form', () => {
    for (const printed of [
      'Torrent Power Limited',
      'TORRENT POWER LTD.',
      'Torrent Power',
      '  torrent  power  ',
    ])
      expect(utilityMatches(printed, provider)).toBe(true);
  });

  it('never calls an absent or illegible name a mismatch', () => {
    // Telling someone their correct bill is the wrong bill is the worse error:
    // a genuinely wrong one still meets D-18's cross-check.
    for (const printed of ['', '   ', '!!! ???', 'Ltd']) expect(utilityMatches(printed, provider)).toBe(true);
  });

  it('catches a different utility', () => {
    for (const printed of ['Adani Electricity Mumbai Limited', 'Tata Power Company Limited'])
      expect(utilityMatches(printed, provider)).toBe(false);
  });
});

describe('diagnose', () => {
  it('says nothing about a complete read', async () => {
    const { result } = await run(fullResponse());
    if (!result.ok) throw new Error('expected a read');
    expect(diagnose(result, provider, plan)).toBeNull();
  });
});

describe('the prompt', () => {
  it('tells the model the bill has two sides and where the rates are', () => {
    const prompt = extractionPrompt(provider, plan);
    expect(prompt).toContain('TWO SIDES');
    expect(prompt).toMatch(/back carries the itemised charges and the tariff table/);
  });

  it('names the chosen tariff, so the right row of the table is read', () => {
    expect(extractionPrompt(provider, plan)).toContain(plan.label);
  });

  it('forbids guessing, computing and remembering', () => {
    const prompt = extractionPrompt(provider, plan);
    expect(prompt).toContain('EMPTY STRING');
    expect(prompt).toMatch(/never compute the total payable/i);
  });

  it('keeps its paragraph breaks — it is read, not parsed', () => {
    expect(extractionPrompt(provider, plan)).toContain('\n\n');
  });

  it('is built for every plan in the registry, not just Torrent', () => {
    for (const p of PROVIDERS)
      for (const tariff of p.plans) {
        const prompt = extractionPrompt(p, tariff);
        expect(prompt).toContain(p.name);
        expect(prompt).toContain(tariff.label);
      }
  });
});
