import { createBedrockReader } from './bedrock';
import { createHandler } from './handler';

/**
 * The deployed entry point (E1.2), and the only place the tested half and the
 * paid half are joined.
 *
 * Everything either side of this line is separately provable: `handler.ts` is
 * the request gate and the failure taxonomy, with the model injected, and
 * `bedrock.ts` is one Messages call and nothing else. Composition is all that
 * happens here, which is why there is no test for this file — there is nothing
 * in it that could be wrong without one of those two being wrong first.
 *
 * Built at module scope: a Lambda container is reused between invocations, so
 * the client and its credential resolution are paid for once per container
 * rather than once per bill.
 */
const reader = createBedrockReader();

export const handler = createHandler({
  read: reader.read,
  usage: reader.lastUsage,
});
