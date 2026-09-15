import type { DocumentKind, ExtractResult } from '../../app/src/extract/types';
import type { ModelUsage } from './bedrock';

/**
 * What the extraction Lambda is allowed to say about a request (D-19, E1.4).
 *
 * An electricity bill carries a name, an address and a consumer number. This is
 * the first thing in this project's life that sees any of them, and D-19's
 * answer is that it uses them and forgets them: nothing to S3, nothing in the
 * log beyond the size and the content type.
 *
 * So the log line is built by CONSTRUCTION rather than by redaction. `LogLine`
 * below is a closed record of scalars, every one of which is a number, a
 * boolean or a value from a fixed set; there is no field a bill's contents
 * could reach even if some future caller passed the whole candidate in. A
 * redactor is a list of things to remember to remove, and this is the opposite
 * shape of thing.
 *
 * Pure: it builds a line and returns it. `emit` is the only part that writes,
 * and it is injected so a test can read what would have gone to CloudWatch.
 */

/**
 * Every key that may ever be logged, and nothing else.
 *
 * `outcome` is the taxonomy code from `ExtractErrorCode` — 'unreadable',
 * 'too-large', and so on — which describes what HAPPENED to the request and
 * never what the page said. `utilityMatched` is the `wrong-provider` check's
 * verdict as a boolean, deliberately not the name that produced it: whether the
 * bill matched is operational, and which utility it came from is the customer's.
 */
export interface LogLine {
  event: 'extract';
  /** Bytes of document, after decoding. The one figure D-19 names. */
  bytes: number;
  /** The other: what the magic bytes said it was. Never the caller's claim. */
  kind: DocumentKind | 'rejected';
  /** `ok`, or the error code. Never a message — messages quote the bill. */
  outcome: string;
  /** How many fields came back filled, as counts. Never which, never what. */
  scalarsRead?: number;
  ratesRead?: number;
  warnings?: number;
  /** Whether the printed utility matched the selected provider. Not its name. */
  utilityMatched?: boolean;
  /** What the call cost, which is what makes D-20's budget alarm legible. */
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  /** `max_tokens` here means the ceiling truncated a real read (D-22). */
  stopReason?: string;
  /** Wall-clock milliseconds. A clock is fine HERE — `engine/` is the pure half. */
  ms?: number;
}

/**
 * Counts, from a result. Counting is the whole point: "nine rates read" is the
 * operational fact, and "₹4.60" is the customer's.
 */
function summarise(result: ExtractResult): Partial<LogLine> {
  if (!result.ok) return { outcome: result.error.code };
  const statuses = Object.values(result.status.fields);
  const rates = Object.values(result.status.rates);
  return {
    outcome: 'ok',
    scalarsRead: statuses.filter((s) => s === 'read').length,
    ratesRead: rates.filter((s) => s === 'read').length,
    warnings: result.warnings.length,
    // `wrong-provider` is raised by `diagnose` when the printed name does not
    // match, so its absence from the warnings IS the match. The name itself
    // stays out of the log.
    utilityMatched: !result.warnings.some((w) => w.code === 'wrong-provider'),
  };
}

export function buildLogLine(input: {
  bytes: number;
  kind: DocumentKind | 'rejected';
  result: ExtractResult;
  usage?: ModelUsage | null;
  ms?: number;
}): LogLine {
  const { bytes, kind, result, usage, ms } = input;
  const line: LogLine = { event: 'extract', bytes, kind, outcome: 'ok', ...summarise(result) };
  if (usage) {
    line.inputTokens = usage.inputTokens;
    line.outputTokens = usage.outputTokens;
    line.thinkingTokens = usage.thinkingTokens;
    if (usage.stopReason) line.stopReason = usage.stopReason;
  }
  if (ms !== undefined) line.ms = ms;
  return line;
}

/** Where a log line goes. Injected so the test reads what CloudWatch would. */
export type LogSink = (line: LogLine) => void;

/**
 * One JSON object per line, which is what CloudWatch Logs Insights queries
 * without a parser.
 */
export const consoleSink: LogSink = (line) => {
  console.log(JSON.stringify(line));
};
