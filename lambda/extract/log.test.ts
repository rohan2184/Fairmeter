import { describe, expect, it } from 'vitest';
import { blankBill } from '../../app/src/ui/formState';
import type { ExtractResult } from '../../app/src/extract/types';
import { buildLogLine, type LogLine } from './log';
import { createHandler } from './handler';

/**
 * E1.4 — logging discipline (D-19).
 *
 * The checkpoint in `ROADMAP.md` is written as "read the CloudWatch output of
 * an E1.2 run and find no consumer number, no name, no address". That is a
 * reading, and a reading passes once. These tests are the same check made
 * repeatable: the log line is built from a closed record of scalars, so the
 * question is not whether a particular run leaked but whether a leak is
 * expressible at all.
 *
 * The personal fields below are invented. A real bill's name and address are
 * exactly what must not end up in a repository either.
 */

/** A candidate as personal as a bill gets, to prove none of it can get out. */
const LOADED = {
  name: 'Chandrakant B Upadhyay',
  address: '14 Swastik Society, Navrangpura, Ahmedabad 380009',
  consumer: '100113210',
  utility: 'Adani Electricity Mumbai Limited',
};

const loadedResult = (): ExtractResult => ({
  ok: true,
  fields: {
    ...blankBill(),
    // Every free-text field a bill fills, filled with something identifying.
    billingMonth: `July 2026 — ${LOADED.name}`,
    printedPayable: '18604.00',
    officialPresent: '13284',
  },
  status: {
    fields: { billingMonth: 'read', printedPayable: 'read', officialPresent: 'read' },
    rates: { energy: 'read', fixed: 'missing' },
  },
  document: { utility: LOADED.utility },
  warnings: [
    {
      code: 'wrong-provider',
      // The warning MESSAGE quotes the printed utility name. It is shown to the
      // owner, which is right, and it is the most likely thing to be logged by
      // accident, which is why it is here.
      message: `This looks like a bill from ${LOADED.utility}, but the tariff selected is Torrent's.`,
      field: 'providerId',
    },
  ],
});

const serialised = (line: LogLine) => JSON.stringify(line);

describe('E1.4 — the log carries size and content type, and nothing off the page', () => {
  it('logs a successful read as counts, never as values', () => {
    const line = buildLogLine({ bytes: 221_184, kind: 'pdf', result: loadedResult() });

    expect(line).toEqual({
      event: 'extract',
      bytes: 221_184,
      kind: 'pdf',
      outcome: 'ok',
      scalarsRead: 3,
      ratesRead: 1,
      warnings: 1,
      utilityMatched: false,
    });
  });

  it('leaks no name, address, consumer number or utility name', () => {
    const text = serialised(buildLogLine({ bytes: 221_184, kind: 'pdf', result: loadedResult() }));

    for (const secret of Object.values(LOADED)) expect(text).not.toContain(secret);
    // Nor any figure off the bill: a payable is not personal, but it is the
    // customer's, and D-19 draws the line at the size and the content type.
    expect(text).not.toContain('18604');
    expect(text).not.toContain('13284');
    expect(text).not.toContain('July 2026');
  });

  it('carries no document bytes, in any encoding', () => {
    const line = buildLogLine({ bytes: 4, kind: 'png', result: loadedResult() });
    const text = serialised(line);

    // A base64 payload is the failure this is guarding: it is one interpolation
    // away and it would be invisible in a log viewer.
    expect(text.length).toBeLessThan(400);
    expect(text).not.toMatch(/[A-Za-z0-9+/]{100,}={0,2}/);
  });

  it('records the model call as tokens and a stop reason', () => {
    const line = buildLogLine({
      bytes: 221_184,
      kind: 'pdf',
      result: loadedResult(),
      usage: { inputTokens: 5_012, outputTokens: 881, thinkingTokens: 140, stopReason: 'end_turn' },
      ms: 9_310,
    });

    expect(line.inputTokens).toBe(5_012);
    expect(line.outputTokens).toBe(881);
    expect(line.thinkingTokens).toBe(140);
    expect(line.stopReason).toBe('end_turn');
    expect(line.ms).toBe(9_310);
  });

  it('names a failure by its code and never by its message', () => {
    const line = buildLogLine({
      bytes: 0,
      kind: 'rejected',
      result: {
        ok: false,
        error: {
          code: 'too-large',
          message: `That file is 9.4 MB — ${LOADED.name}'s bill, over the limit.`,
        },
      },
    });

    expect(line.outcome).toBe('too-large');
    expect(serialised(line)).not.toContain(LOADED.name);
  });
});

describe('E1.4 — the handler emits exactly one line per request', () => {
  const body = (data: string) =>
    JSON.stringify({ providerId: 'torrent-ahmedabad', planId: 'nonRgp-upto5kw', data });

  it('logs a rejected request without ever having read it', async () => {
    const lines: LogLine[] = [];
    // A reader that would fail the test if it were ever reached: a gate
    // rejection must not be a paid call.
    const handler = createHandler({
      read: async () => {
        throw new Error('the model must not be called for a rejected request');
      },
      log: (l) => lines.push(l),
      now: () => 0,
    });

    const response = await handler({ body: body('') });

    expect(response.statusCode).toBe(400);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'rejected', outcome: 'empty', bytes: 0 });
  });

  it('logs the decoded size and the sniffed kind of a real document', async () => {
    const lines: LogLine[] = [];
    const pdf = Buffer.from('%PDF-1.7\n… a bill …').toString('base64');
    const handler = createHandler({
      read: async () => JSON.stringify({ printedPayable: '18604.00', rates: {}, document: {} }),
      log: (l) => lines.push(l),
      usage: () => ({
        inputTokens: 100,
        outputTokens: 20,
        thinkingTokens: 0,
        stopReason: 'end_turn',
      }),
      now: () => 0,
    });

    await handler({ body: body(pdf) });

    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('pdf');
    expect(lines[0].bytes).toBe(Buffer.from(pdf, 'base64').length);
    expect(lines[0].inputTokens).toBe(100);
  });
});
