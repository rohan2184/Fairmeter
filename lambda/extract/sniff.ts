import type { DocumentKind } from '../../app/src/extract/types';

/**
 * What a document IS, decided by its first few bytes.
 *
 * D-20 is explicit that this is never the file extension and never a
 * `Content-Type` the caller chose. Both are strings someone else wrote; the
 * magic number is the file telling us about itself. A `.pdf` that is really a
 * ZIP is the cheap version of the attack, and it must not reach the model.
 *
 * No dependency, no allocation beyond the slice: this runs before the size cap
 * has finished being trusted, on bytes nobody has vouched for.
 */

const MAGIC: { kind: DocumentKind; bytes: number[] }[] = [
  // "%PDF-". The header may legally be preceded by junk, but a bill produced by
  // a utility's billing system is not that file, and accepting a leading
  // offset means accepting a polyglot.
  { kind: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // JPEG SOI + the first marker byte. Covers JFIF, Exif and raw camera output.
  { kind: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { kind: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

const startsWith = (data: Uint8Array, bytes: number[]): boolean =>
  data.length >= bytes.length && bytes.every((b, i) => data[i] === b);

/** The kind these bytes actually are, or null for anything else. */
export function sniff(data: Uint8Array): DocumentKind | null {
  for (const { kind, bytes } of MAGIC) if (startsWith(data, bytes)) return kind;
  return null;
}

/**
 * The kind the caller CLAIMED, when the claim is specific enough to be worth
 * comparing. A browser that says `application/octet-stream` — which is what
 * some Android cameras hand over — is saying nothing, and nothing cannot
 * disagree with anything.
 */
export function declaredKind(declaredType: string): DocumentKind | null {
  const t = declaredType.trim().toLowerCase().split(';')[0];
  if (t === 'application/pdf') return 'pdf';
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpeg';
  if (t === 'image/png') return 'png';
  return null;
}

/** The media type handed to the model for this kind. */
export const MEDIA_TYPE: Record<DocumentKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
