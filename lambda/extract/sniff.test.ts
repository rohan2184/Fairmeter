import { describe, expect, it } from 'vitest';
import { MEDIA_TYPE, declaredKind, sniff } from './sniff';

const bytes = (...b: number[]) => Uint8Array.from(b);

describe('sniff', () => {
  it('recognises the three kinds by their magic numbers', () => {
    expect(sniff(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34))).toBe('pdf');
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe1))).toBe('jpeg');
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
  });

  it('refuses everything else, including the near misses', () => {
    // A ZIP — every .docx and .xlsx renamed to .pdf.
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull();
    // A GIF, a TIFF, HTML, and plain text.
    expect(sniff(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBeNull();
    expect(sniff(bytes(0x49, 0x49, 0x2a, 0x00))).toBeNull();
    expect(sniff(Buffer.from('<!doctype html>'))).toBeNull();
    expect(sniff(Buffer.from('%PDF'))).toBeNull(); // truncated: no trailing '-'
    expect(sniff(bytes())).toBeNull();
  });

  it('will not accept a PDF header hidden behind a prefix', () => {
    // A polyglot: valid ZIP at offset 0, valid PDF further in. Accepting an
    // offset would accept this, and there is no bill it would let through.
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04, 0x25, 0x50, 0x44, 0x46, 0x2d))).toBeNull();
  });

  it('is not fooled by a truncated PNG signature', () => {
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });
});

describe('declaredKind', () => {
  it('reads a specific claim, with parameters and casing', () => {
    expect(declaredKind('application/pdf')).toBe('pdf');
    expect(declaredKind('IMAGE/JPEG')).toBe('jpeg');
    expect(declaredKind('image/jpg')).toBe('jpeg');
    expect(declaredKind('image/png; charset=binary')).toBe('png');
  });

  it('treats a vague claim as no claim, so it can never disagree', () => {
    // An Android camera handing over `application/octet-stream` must not be
    // told its own photograph is the wrong type (D-20: never block the owner).
    for (const vague of ['', '   ', 'application/octet-stream', 'binary/octet-stream', 'text/plain'])
      expect(declaredKind(vague)).toBeNull();
  });
});

describe('MEDIA_TYPE', () => {
  it('names every kind the sniffer can return', () => {
    expect(Object.keys(MEDIA_TYPE).sort()).toEqual(['jpeg', 'pdf', 'png']);
  });
});
