import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import type { DocumentKind } from '../../app/src/extract/types';
import type { ModelReader } from './handler';

/**
 * The one Messages call (D-21, E1.2).
 *
 * This is the only file in the repository that reaches the network, and it is
 * deliberately the only thing in it: everything that decides anything — the
 * gate, the prompt, the schema, the parser, the diagnosis — is pure and tested
 * without a credential (E1.1, E1.3). This module is imported by `index.ts` and
 * by the live check, and by no test, which is why `npm test` costs nothing.
 *
 * One request. No tool loop, no agent, no session: the task is structured
 * extraction and nothing about it is open-ended (D-21).
 */

/**
 * Served through Bedrock Mantle, so the entire credential story is the Lambda's
 * IAM execution role carrying `bedrock:InvokeModel` — nothing in Secrets
 * Manager, nothing to rotate, nothing that can be committed by accident (D-17).
 *
 * Mantle is the Messages-API path for Anthropic models on Bedrock, and it is
 * chosen over the legacy `bedrock-runtime` InvokeModel path for the reason
 * D-17 gives: it exposes the same `messages.create` surface as the first-party
 * SDK, so this file stays portable if the serving platform ever changes.
 */
export const MODEL_ID = 'anthropic.claude-opus-5';

/** Where the stack already deploys, and where model availability is broadest (D-17). */
export const REGION = 'us-east-1';

/**
 * The hard output-token ceiling of D-20, settled at 4096 by the owner in S2 and
 * recorded as D-22.
 *
 * It lives here rather than in `extract/types.ts` on purpose: `LIMITS` is the
 * contract the BROWSER shares, and how many tokens the model may emit is no
 * concern of the browser's (D-22).
 */
export const MAX_OUTPUT_TOKENS = 4096;

/**
 * Thinking depth, which D-22 did not settle because the question did not exist
 * when it was written: on this model thinking is ON by default, and thinking
 * tokens are spent against `MAX_OUTPUT_TOKENS` alongside the answer.
 *
 * `medium` rather than `low` because the job is not pure transcription. Picking
 * the tariff-table row that matches the plan and the load band is a judgement,
 * and it is the one misread that produces no symptom — a plausible rate, of the
 * right magnitude, in the right units, which would sail past everything except
 * D-18's cross-check. `high` is not obviously better here and spends more of a
 * ceiling that the answer itself also has to fit inside.
 *
 * `logged.usage.thinkingTokens` is what turns this from an opinion into a
 * measurement; E5.1's eval is where it gets settled.
 */
export const EFFORT = 'medium' as const;

/** What the API calls each kind. Decided by magic bytes upstream, never by name. */
const MEDIA_TYPE: Record<DocumentKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** What one call cost and how it ended. Numbers and enums only — see `log.ts`. */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  /**
   * `max_tokens` here means the answer was truncated by `MAX_OUTPUT_TOKENS`,
   * which arrives downstream as a `malformed-response` the owner cannot act on.
   * It is logged because that is the only way the ceiling is ever diagnosable
   * from the outside (D-22).
   */
  stopReason: string | null;
}

export interface BedrockReader {
  read: ModelReader;
  /** The usage of the most recent call, for the log line and for the eval. */
  lastUsage: () => ModelUsage | null;
}

/**
 * A PDF and a photograph are one code path, which is what P-06's Claude branch
 * bought: the document block differs by one field and nothing else does.
 */
const documentBlock = (kind: DocumentKind, data: string) =>
  kind === 'pdf'
    ? ({
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data,
        },
      })
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: MEDIA_TYPE[kind] as 'image/jpeg' | 'image/png',
          data,
        },
      });

/**
 * Builds the reader the handler is given.
 *
 * The client is constructed once, outside the request, because a Lambda
 * container is reused and rebuilding it per invocation would pay for credential
 * resolution on every bill.
 */
export function createBedrockReader(
  client: AnthropicBedrockMantle = new AnthropicBedrockMantle({ awsRegion: REGION }),
): BedrockReader {
  let usage: ModelUsage | null = null;

  const read: ModelReader = async ({ document, kind, prompt, schema }) => {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_OUTPUT_TOKENS,
      output_config: {
        effort: EFFORT,
        // Schema-valid by construction rather than by hopeful parsing (D-21).
        // The schema is generated from the selected plan's `ChargeTemplate[]`,
        // so a utility added to `registry.ts` needs no edit here (E0.1).
        format: { type: 'json_schema', schema: schema as unknown as Record<string, unknown> },
      },
      messages: [
        {
          role: 'user',
          content: [
            // The document goes before the text, which is what the model reads
            // best, and both pages arrive in this one block when the upload has
            // both (E3.1).
            documentBlock(kind, Buffer.from(document).toString('base64')),
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      thinkingTokens: response.usage.output_tokens_details?.thinking_tokens ?? 0,
      stopReason: response.stop_reason,
    };

    // Structured outputs put the candidate in the text blocks. Anything else in
    // the response — a thinking block, for instance — is not the answer, and
    // concatenating it would corrupt the JSON rather than add to it.
    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  };

  return { read, lastUsage: () => usage };
}
