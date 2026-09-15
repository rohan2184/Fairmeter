import seed from '../../../seed/spreadsheet-history.json';
import type { SavedCycle } from '../storage/types';
import { fromCycle, sampleBill, type BillFields } from '../ui/formState';
import type { DocumentKind } from './types';

// Vite serves this as a string; it is the text layer `pypdf` pulls out of the
// reference PDF, kept beside the fixtures so an offline test has a document to
// work from without a PDF parser in the test process.
import referenceText from './fixtures/reference-bill.txt?raw';

/**
 * The scored set for extraction (D-21, E0.4) — the reference bill plus the seven
 * restated cycles of D-12.
 *
 * Grading is the same question in every case, and it is the one D-18 already
 * answers: feed the expected fields to the engine and see whether the computed
 * payable equals the payable printed on the paper, to the paisa. That is an
 * objective number in the same spirit as the golden test, which is what makes
 * "would a cheaper model do" a measurement rather than an argument.
 *
 * **The seven have figures only.** Confirmed with the owner (2026-09-15): the
 * original bills behind the spreadsheet no longer exist, so those fixtures carry
 * no document. They still pin the contract — expected fields in, printed payable
 * out — and the reference bill is the one that exercises a real page. If a scan
 * of any of them ever turns up, it drops into `document` and nothing else moves.
 */

export interface ExtractFixture {
  id: string;
  label: string;
  providerId: string;
  planId: string;
  /**
   * The document to extract from, when one survives. Path is relative to the
   * repository root, because the Lambda tests and the eval harness read it from
   * disk rather than through the bundler.
   */
  document?: { kind: DocumentKind; path: string };
  /** The document's text layer, where it has one. */
  text?: string;
  /** What a correct read produces: a complete `BillFields`, as strings. */
  expected: BillFields;
}

const cycles = (seed as { cycles: SavedCycle[] }).cycles;

/**
 * The seeded cycles were restated onto the `custom` / `total-only` plan (D-12):
 * one figure, the bill's total. A degenerate extraction, and worth keeping for
 * exactly that reason — a plan with a single rate is the shape a utility we have
 * not modelled yet arrives in.
 */
const fromSeed = (cycle: SavedCycle): ExtractFixture => ({
  id: cycle.id,
  label: cycle.label ?? cycle.bill.billingMonth,
  providerId: cycle.bill.providerId,
  planId: cycle.bill.planId,
  expected: fromCycle(cycle).bill,
});

export const REFERENCE_FIXTURE: ExtractFixture = {
  id: 'torrent-july-2026',
  label: 'Torrent Power, Ahmedabad — July 2026 (the reference bill)',
  providerId: 'torrent-ahmedabad',
  planId: 'nonRgp-upto5kw',
  document: { kind: 'pdf', path: '100113210.pdf' },
  text: referenceText,
  // The same figures the golden test pins, as the owner would have typed them.
  expected: sampleBill(),
};

export const FIXTURES: ExtractFixture[] = [REFERENCE_FIXTURE, ...cycles.map(fromSeed)];

/** Fixtures that carry a document, i.e. the ones a model can actually be run on. */
export const DOCUMENT_FIXTURES = FIXTURES.filter((f) => f.document !== undefined);
