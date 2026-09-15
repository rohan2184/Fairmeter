import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '../../app/src/engine/providers/registry';
import { LIMITS, type ExtractResult } from '../../app/src/extract/types';
import { base64Bytes, createHandler, gate, type HttpEvent, type ModelReader } from './handler';

/**
 * E1.1's checkpoint (D-20): an oversized body, a `.pdf` that is really a ZIP,
 * and an empty body each get a DISTINCT 4xx and NEVER REACH THE MODEL.
 *
 * "Never reach the model" is the load-bearing half and the reason the reader is
 * injected: the spy counts calls, so the test can assert a negative about a
 * paid call without making one.
 */

const provider = PROVIDERS[0];
const plan = provider.plans[0];

/** A reader that records every call and would fail the test by being called. */
function spy(answer = '{}') {
  const calls: unknown[] = [];
  const read: ModelReader = async (input) => {
    calls.push(input);
    return answer;
  };
  return { read, calls };
}

const b64 = (bytes: number[]) => Buffer.from(Uint8Array.from(bytes)).toString('base64');

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** "PK\x03\x04" — a ZIP, which is what a renamed .docx or .xlsx really is. */
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00];

const event = (body: unknown, extra: Partial<HttpEvent> = {}): HttpEvent => ({
  body: typeof body === 'string' ? body : JSON.stringify(body),
  requestContext: { http: { method: 'POST' } },
  ...extra,
});

const request = (data: string, declaredType = 'application/pdf') => ({
  providerId: provider.id,
  planId: plan.id,
  data,
  declaredType,
});

const parse = (body: string): ExtractResult => JSON.parse(body) as ExtractResult;
const errorOf = (body: string) => {
  const r = parse(body);
  if (r.ok) throw new Error('expected a failure');
  return r.error;
};

describe('base64Bytes', () => {
  it('counts decoded bytes without decoding', () => {
    for (const n of [1, 2, 3, 4, 5, 100, 1023]) {
      const data = Buffer.alloc(n, 7).toString('base64');
      expect(base64Bytes(data)).toBe(n);
    }
  });

  it('is unbothered by whitespace and by an empty string', () => {
    expect(base64Bytes('')).toBe(0);
    const data = Buffer.alloc(300, 1).toString('base64');
    expect(base64Bytes(`${data.slice(0, 40)}\n${data.slice(40)}`)).toBe(300);
  });
});

describe('the gate, before any model call', () => {
  it('rejects an empty body with 400 and calls nothing', async () => {
    const { read, calls } = spy();
    const res = await createHandler(read)(event(''));
    expect(res.statusCode).toBe(400);
    expect(errorOf(res.body).code).toBe('empty');
    expect(calls).toHaveLength(0);
  });

  it('rejects an upload with no bytes in it with 400', async () => {
    const { read, calls } = spy();
    const res = await createHandler(read)(event(request('')));
    expect(res.statusCode).toBe(400);
    expect(errorOf(res.body).code).toBe('empty');
    expect(calls).toHaveLength(0);
  });

  it('rejects an oversized body with 413 and calls nothing', async () => {
    const { read, calls } = spy();
    // One byte over, so the boundary is what is being tested and not a
    // comfortably huge number that any check would catch.
    const oversized = Buffer.alloc(LIMITS.maxBytes + 1, 0x41).toString('base64');
    const res = await createHandler(read)(event(request(oversized)));
    expect(res.statusCode).toBe(413);
    expect(errorOf(res.body).code).toBe('too-large');
    expect(calls).toHaveLength(0);
  });

  it('accepts a document exactly at the cap', () => {
    const atCap = Buffer.concat([
      Buffer.from(Uint8Array.from(PDF)),
      Buffer.alloc(LIMITS.maxBytes - PDF.length, 0x20),
    ]).toString('base64');
    const checked = gate(event(request(atCap)));
    expect(checked.ok).toBe(true);
  });

  it('rejects a ZIP calling itself a PDF with 415, by its bytes', async () => {
    const { read, calls } = spy();
    const res = await createHandler(read)(event(request(b64(ZIP), 'application/pdf')));
    expect(res.statusCode).toBe(415);
    expect(errorOf(res.body).code).toBe('unsupported-type');
    expect(calls).toHaveLength(0);
  });

  it('gives those three distinct statuses', async () => {
    const { read } = spy();
    const handler = createHandler(read);
    const statuses = await Promise.all(
      [
        event(''),
        event(request(Buffer.alloc(LIMITS.maxBytes + 1, 0x41).toString('base64'))),
        event(request(b64(ZIP))),
      ].map(async (e) => (await handler(e)).statusCode),
    );
    expect(new Set(statuses).size).toBe(statuses.length);
    expect(statuses).toEqual([400, 413, 415]);
  });

  it('rejects a body that is not JSON, and one that is not an object', async () => {
    const { read, calls } = spy();
    const handler = createHandler(read);
    expect(errorOf((await handler(event('not json'))).body).code).toBe('bad-request');
    expect(errorOf((await handler(event('[1,2,3]'))).body).code).toBe('bad-request');
    expect(calls).toHaveLength(0);
  });

  it('rejects an unknown provider or plan without calling the model', async () => {
    const { read, calls } = spy();
    const handler = createHandler(read);
    const res = await handler(
      event({ providerId: 'nope', planId: plan.id, data: b64(PDF), declaredType: '' }),
    );
    expect(errorOf(res.body).code).toBe('internal');
    expect(calls).toHaveLength(0);
  });

  it('rejects anything but POST', async () => {
    const { read, calls } = spy();
    const res = await createHandler(read)(
      event(request(b64(PDF)), { requestContext: { http: { method: 'GET' } } }),
    );
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('believes the bytes over the caller for every accepted kind', () => {
    for (const [bytes, kind] of [
      [PDF, 'pdf'],
      [JPEG, 'jpeg'],
      [PNG, 'png'],
    ] as const) {
      // Declared as nothing in particular, which is what a phone often sends.
      const checked = gate(event(request(b64([...bytes]), 'application/octet-stream')));
      expect(checked.ok && checked.kind).toBe(kind);
    }
  });

  it('rejects a confident disagreement between the label and the bytes', async () => {
    const { read, calls } = spy();
    const res = await createHandler(read)(event(request(b64(PNG), 'application/pdf')));
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.body).code).toBe('content-mismatch');
    expect(calls).toHaveLength(0);
  });

  it('unwraps a base64-encoded Function URL body', () => {
    const inner = JSON.stringify(request(b64(PDF)));
    const checked = gate(
      event(Buffer.from(inner, 'utf8').toString('base64'), { isBase64Encoded: true }),
    );
    expect(checked.ok).toBe(true);
  });
});

describe('the handler, once the gate has passed', () => {
  it('hands the model the sniffed kind, the prompt and the generated schema', async () => {
    const { read, calls } = spy();
    await createHandler(read)(event(request(b64(JPEG), 'image/jpeg')));
    expect(calls).toHaveLength(1);
    const input = calls[0] as {
      kind: string;
      prompt: string;
      schema: { properties?: Record<string, unknown> };
      provider: { id: string };
    };
    expect(input.kind).toBe('jpeg');
    expect(input.provider.id).toBe(provider.id);
    expect(input.prompt).toContain('TWO SIDES');
    expect(Object.keys(input.schema.properties ?? {})).toContain('rates');
  });

  it('turns a thrown model error into a named failure, never a stack trace', async () => {
    const boom: ModelReader = async () => {
      throw new Error('socket hang up at 10.0.0.1');
    };
    const res = await createHandler(boom)(event(request(b64(PDF))));
    expect(res.statusCode).toBe(500);
    const error = errorOf(res.body);
    expect(error.code).toBe('internal');
    expect(error.message).not.toContain('socket');
    expect(error.message).not.toContain('10.0.0.1');
  });

  it('names a throttled model 429 rather than 500', async () => {
    const busy: ModelReader = async () => {
      throw new Error('ThrottlingException: Too many requests');
    };
    const res = await createHandler(busy)(event(request(b64(PDF))));
    expect(res.statusCode).toBe(429);
    expect(errorOf(res.body).code).toBe('rate-limited');
  });

  it('never puts a CORS header on the response — the call is same-origin (D-17)', async () => {
    const { read } = spy();
    const res = await createHandler(read)(event(request(b64(PDF))));
    expect(Object.keys(res.headers).map((h) => h.toLowerCase())).toEqual(['content-type']);
  });
});
