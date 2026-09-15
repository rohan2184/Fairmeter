import type { BillFields } from '../ui/formState';

/**
 * The wire contract between the browser and the extraction Lambda (D-17).
 *
 * Both ends import this file, so the shapes cannot drift. It holds types and
 * constants only — no parsing, no network, no clock. The parser is
 * `candidate.ts`.
 */

/** What the browser sends. The bytes are base64 because the transport is JSON. */
export interface ExtractRequest {
  /** The plan the owner already chose. The schema is generated for it (D-21). */
  providerId: string;
  planId: string;
  /** The document, base64-encoded. */
  data: string;
  /**
   * What the browser believes it is. ADVISORY ONLY — the Lambda sniffs magic
   * bytes and believes those instead, never this and never the extension
   * (D-20, E1.1).
   */
  declaredType: string;
}

/** The document kinds the model is given. Decided by magic bytes, not by name. */
export type DocumentKind = 'pdf' | 'jpeg' | 'png';

/**
 * Why an extraction did not produce a usable candidate, or why one is partial.
 *
 * Every code is something a person can act on, because the message is shown to
 * one. Codes are stable strings: the UI switches on them.
 */
export type ExtractErrorCode =
  /** Nothing was uploaded, or the body was empty. */
  | 'empty'
  /**
   * The request itself was wrong — not JSON, no plan, bytes that are not
   * base64. Added in E1.1: E0.2's taxonomy described the document and the
   * model, and had no word for the caller getting the envelope wrong.
   */
  | 'bad-request'
  /** Over the request size cap (D-20). */
  | 'too-large'
  /** Magic bytes say this is not a PDF, JPEG or PNG. */
  | 'unsupported-type'
  /** The bytes disagree with what the caller claimed they were. */
  | 'content-mismatch'
  /** The page could not be read — blur, glare, a crop that lost the figures. */
  | 'unreadable'
  /** It reads like a bill from a different utility than the plan selected. */
  | 'wrong-provider'
  /** A field the model could not find. Carried as a warning, never a guess. */
  | 'missing-field'
  /**
   * The front of the bill read, and nothing on the back did. A bill is printed
   * on both sides and nearly every RATE is on the reverse (the tariff table and
   * the itemised charges), so a photograph of the front alone produces exactly
   * this shape. Added in E1.3, because "twelve missing fields" is a worse thing
   * to tell someone than "turn the bill over".
   */
  | 'back-page-missing'
  /** The model answered, but not in the shape the schema demanded. */
  | 'malformed-response'
  /** Rate limited upstream, or by the WAF rule of D-20. */
  | 'rate-limited'
  /** Anything else. The owner types the bill in; the app still works. */
  | 'internal';

export interface ExtractIssue {
  code: ExtractErrorCode;
  /** One sentence, addressed to the owner. */
  message: string;
  /** The `BillFields` key or rate key this is about, when it is about one. */
  field?: string;
}

/**
 * How a candidate value came to be, per field.
 *
 * Derived from the response rather than claimed by the model: a model's own
 * confidence score is not evidence, and D-18 already supplies real evidence —
 * the engine recomputes and the printed total either agrees or does not. What
 * the UI actually needs to know is whether a person still has to type this
 * field, and whether what arrived survived normalisation.
 */
export type FieldStatus =
  /** Read off the bill and usable. Flagged as read rather than typed (D-18). */
  | 'read'
  /** Not found on the page. Left empty on purpose, for the owner to type. */
  | 'missing'
  /** Something arrived that could not be a value of this field. Blanked. */
  | 'rejected';

/** Keyed by `BillFields` key, and by rate key under `rates`. */
export interface CandidateStatus {
  fields: Partial<Record<keyof BillFields, FieldStatus>>;
  rates: Record<string, FieldStatus>;
}

/** What the page said it was, transcribed. Not a form field; see `schema.ts`. */
export interface DocumentMeta {
  /** The utility's name as printed, or empty if none was legible. */
  utility: string;
}

export interface ExtractCandidate {
  /**
   * A COMPLETE `BillFields` — every key present, anything unread left empty.
   * It is the same object the form holds, so the owner can edit it, and the
   * engine recomputes from it exactly as from a typed one (D-18).
   */
  fields: BillFields;
  status: CandidateStatus;
  /** Used to check the bill is the utility the owner selected (E1.3). */
  document: DocumentMeta;
  /** Partial reads and anything else the owner should know. Never fatal. */
  warnings: ExtractIssue[];
}

export type ExtractResult =
  | ({ ok: true } & ExtractCandidate)
  | { ok: false; error: ExtractIssue };

export const ok = (candidate: ExtractCandidate): ExtractResult => ({ ok: true, ...candidate });

export const fail = (
  code: ExtractErrorCode,
  message: string,
  field?: string,
): ExtractResult => ({ ok: false, error: { code, message, field } });

/**
 * Limits shared by both ends, so the browser rejects what the Lambda would
 * (E3.1) instead of spending an upload to find out. The Lambda enforces them
 * regardless — a client-side check is a courtesy, not a control (D-20).
 *
 * `maxBytes` was confirmed by the owner in session S2 and is recorded as D-22:
 * 8 MB clears any phone photo of a bill without the owner resizing anything,
 * and still bounds one request. The output-token ceiling belongs to the model
 * call and is settled in S3 with E1.2.
 */
export const LIMITS = {
  /** Bytes of raw document, before base64. A phone photo of a bill is ~2–5 MB. */
  maxBytes: 8 * 1024 * 1024,
  /** Accepted document kinds, by magic bytes. */
  kinds: ['pdf', 'jpeg', 'png'] as DocumentKind[],
} as const;
