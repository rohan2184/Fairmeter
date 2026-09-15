import { parseCandidateJson, resolve } from '../../app/src/extract/candidate';
import { billFieldsSchema, type JsonSchema } from '../../app/src/extract/schema';
import {
  LIMITS,
  fail,
  type DocumentKind,
  type ExtractErrorCode,
  type ExtractRequest,
  type ExtractResult,
} from '../../app/src/extract/types';
import type { ProviderProfile, TariffPlan } from '../../app/src/engine/providers/types';
import { reviewed } from './diagnose';
import { extractionPrompt } from './prompt';
import { declaredKind, sniff } from './sniff';

/**
 * The extraction Lambda (D-17, E1.1).
 *
 * Bytes and a chosen plan in, a candidate `BillFields` out. It computes no
 * money — the engine does that, in the browser, from these strings, exactly as
 * it does from typed ones (D-18).
 *
 * The model call is INJECTED rather than imported, which is what lets every
 * gate below be tested with no credential, no network and no spend. E1.2
 * supplies the real one.
 */

/** A Lambda Function URL request, narrowed to what this handler reads. */
export interface HttpEvent {
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** What E1.2 implements: one Messages call, returning the raw JSON text. */
export interface ModelReader {
  (input: {
    document: Uint8Array;
    kind: DocumentKind;
    provider: ProviderProfile;
    plan: TariffPlan;
    prompt: string;
    schema: JsonSchema;
  }): Promise<string>;
}

/**
 * Status codes, one per reason, because the browser distinguishes them and so
 * does anything sitting in front of this.
 *
 * `missing-field` and `back-page-missing` are 200: they are warnings on a
 * successful read, never the reason for a response.
 */
const STATUS: Record<ExtractErrorCode, number> = {
  empty: 400,
  'bad-request': 400,
  'too-large': 413,
  'unsupported-type': 415,
  'content-mismatch': 422,
  unreadable: 422,
  'wrong-provider': 422,
  'back-page-missing': 200,
  'missing-field': 200,
  'malformed-response': 502,
  'rate-limited': 429,
  internal: 500,
};

const respond = (result: ExtractResult): HttpResponse => ({
  statusCode: result.ok ? 200 : STATUS[result.error.code],
  // Same-origin through the distribution (D-17), so there is no CORS header
  // here, and adding one would be the first crack in D-15's CSP.
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(result),
});

/**
 * Bytes a base64 string decodes to, WITHOUT decoding it.
 *
 * The size cap exists to stop a large body being processed, so it has to be
 * enforceable before the large body is turned into a buffer. Four base64
 * characters are three bytes, less one per '=' of padding.
 */
export function base64Bytes(b64: string): number {
  const clean = b64.replace(/\s/g, '');
  if (clean.length === 0) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor(clean.length / 4) * 3 - padding;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

type Gated =
  | { ok: true; request: ExtractRequest; document: Uint8Array; kind: DocumentKind }
  | { ok: false; result: ExtractResult };

/**
 * Everything between the request arriving and the model being worth calling.
 *
 * Separate from the handler because it is the half with the security properties
 * in it, and a function that returns a verdict is easier to be sure of than a
 * sequence of early returns inside an async handler. Nothing here awaits
 * anything: if `gate` says no, no call was made.
 */
export function gate(event: HttpEvent): Gated {
  const no = (code: ExtractErrorCode, message: string, field?: string): Gated => ({
    ok: false,
    result: fail(code, message, field),
  });

  if ((event.requestContext?.http?.method ?? 'POST').toUpperCase() !== 'POST')
    return no('bad-request', 'A bill is uploaded with POST.');

  const raw = event.body ?? '';
  if (raw.trim() === '') return no('empty', 'No bill was uploaded.');

  // A Function URL may hand the body over base64-encoded. That envelope is the
  // gateway's, not the caller's, so it is unwrapped before anything is judged.
  let text = raw;
  if (event.isBase64Encoded) {
    try {
      text = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      return no('bad-request', 'The request body could not be decoded.');
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return no('bad-request', 'The request body was not JSON.');
  }
  if (!isRecord(parsed)) return no('bad-request', 'The request body was not an object.');

  const { providerId, planId, data, declaredType } = parsed;
  if (typeof providerId !== 'string' || typeof planId !== 'string')
    return no('bad-request', 'The request named no tariff to read the bill against.');
  if (typeof data !== 'string' || data.trim() === '')
    return no('empty', 'No bill was uploaded.');

  // An unknown id is the caller's mistake, and it must not reach the model:
  // that would be a paid call that cannot produce a usable answer.
  const found = resolve(providerId, planId);
  if (!('provider' in found)) return { ok: false, result: { ok: false, error: found } };

  // BEFORE decoding. The point of a size cap is that the oversized thing is
  // never built (D-20).
  const size = base64Bytes(data);
  if (size > LIMITS.maxBytes)
    return no(
      'too-large',
      `That file is ${(size / 1024 / 1024).toFixed(1)} MB, over the ` +
        `${LIMITS.maxBytes / 1024 / 1024} MB limit. A photograph of the bill is usually far smaller.`,
    );

  // `Buffer.from` is lenient with base64 and silently drops what it cannot
  // read, so what came out is measured as well as what went in.
  const document = new Uint8Array(Buffer.from(data, 'base64'));
  if (document.length === 0) return no('empty', 'No bill was uploaded.');
  if (document.length > LIMITS.maxBytes)
    return no('too-large', 'That file is over the upload limit.');

  // The file itself decides what it is. Never the extension, never a
  // `Content-Type` the caller chose (D-20).
  const kind = sniff(document);
  if (!kind)
    return no(
      'unsupported-type',
      'That file is not a PDF, a JPEG or a PNG. A photograph of the bill, or the PDF the ' +
        'utility emailed, both work.',
    );

  // Both sides confident and disagreeing. A vague declaration — some Android
  // cameras say `application/octet-stream` — is not a disagreement, and must
  // not be treated as one: that would block a real owner, which D-20 says is
  // worse than no control at all.
  const claimed = typeof declaredType === 'string' ? declaredKind(declaredType) : null;
  if (claimed && claimed !== kind)
    return no(
      'content-mismatch',
      `That file is labelled ${claimed.toUpperCase()} but its contents are ${kind.toUpperCase()}. ` +
        'Re-save it and try again.',
    );

  return {
    ok: true,
    request: {
      providerId,
      planId,
      data,
      declaredType: typeof declaredType === 'string' ? declaredType : '',
    },
    document,
    kind,
  };
}

export function createHandler(read: ModelReader) {
  return async function handler(event: HttpEvent): Promise<HttpResponse> {
    const checked = gate(event);
    if (!checked.ok) return respond(checked.result);

    const { request, document, kind } = checked;
    // `gate` already resolved these; this is the narrowing, not a second
    // decision.
    const found = resolve(request.providerId, request.planId);
    if (!('provider' in found)) return respond({ ok: false, error: found });
    const { provider, plan } = found;

    try {
      const text = await read({
        document,
        kind,
        provider,
        plan,
        prompt: extractionPrompt(provider, plan),
        schema: billFieldsSchema(provider, plan),
      });
      return respond(
        reviewed(parseCandidateJson(text, request.providerId, request.planId), provider, plan),
      );
    } catch (e) {
      // Nothing about the document goes into this message. D-19 allows size and
      // content type in the log, and nothing else.
      const message = e instanceof Error ? e.message : String(e);
      const throttled = /throttl|too many requests|rate limit/i.test(message);
      return respond(
        throttled
          ? fail('rate-limited', 'The reader is busy. Wait a moment and try again.')
          : fail('internal', 'The bill could not be read. Type it in, or try again.'),
      );
    }
  };
}
