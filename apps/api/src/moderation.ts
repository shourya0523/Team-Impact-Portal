/**
 * Automated screening of new posts, comments, events and community names (PRD §9). Each item is
 * screened before anyone but its author sees it, and the screen decides what happens next:
 * `allow` publishes it, `hold` queues it for staff, `block` takes it down at once. Team Impact
 * staff content is exempt and never sent here (`../mock/activity.ts`).
 *
 * The screen fails closed: when OpenAI can't be reached or answers with something unexpected, the
 * item is held for staff, never let through.
 */

export interface ScreenInput {
  text: string;
  /** A post's photo. OpenAI fetches it, so it must be publicly reachable. */
  imageUrl?: string | null;
}

export interface Verdict {
  outcome: 'allow' | 'hold' | 'block';
  /** OpenAI categories at or over the hold threshold, highest score first. */
  flags: string[];
}

export type Screen = (input: ScreenInput) => Promise<Verdict>;

export interface Thresholds {
  /** Any category scoring this or more is held for staff. */
  holdAt: number;
  /** Any category scoring this or more is blocked outright. */
  blockAt: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { holdAt: 0.3, blockAt: 0.85 };

/** No tolerance on a platform with children: anything worth holding is blocked. */
const BLOCK_AT_HOLD = new Set(['sexual/minors']);

/**
 * Never blocked, only held: someone writing about self-harm may need help, and staff should see
 * it and reach out rather than the post silently disappearing.
 */
const NEVER_BLOCK = new Set(['self-harm', 'self-harm/intent', 'self-harm/instructions']);

/** Without OpenAI configured every item waits for staff, as before screening existed. */
export const holdEverything: Screen = async () => ({ outcome: 'hold', flags: [] });

/** Staff content, and anything else exempt from screening. */
export const ALLOWED: Verdict = { outcome: 'allow', flags: [] };

/** The decision for one set of OpenAI category scores. */
export const verdictFrom = (
  scores: Record<string, number>,
  { holdAt, blockAt }: Thresholds = DEFAULT_THRESHOLDS,
): Verdict => {
  const over = Object.entries(scores)
    .filter(([, score]) => score >= holdAt)
    .sort(([, a], [, b]) => b - a);
  const flags = over.map(([category]) => category);
  const blocked = over.some(
    ([category, score]) =>
      !NEVER_BLOCK.has(category) && (BLOCK_AT_HOLD.has(category) || score >= blockAt),
  );
  return { outcome: blocked ? 'block' : flags.length ? 'hold' : 'allow', flags };
};

export interface OpenAiScreenOptions {
  apiKey: string;
  thresholds?: Thresholds;
  model?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  /** Told about every failure that held an item because the screen couldn't answer. */
  onError?: (error: unknown) => void;
}

const MODERATIONS_URL = 'https://api.openai.com/v1/moderations';

/** Screens with OpenAI's moderation endpoint (free, text and images in one call). */
export const openAiScreen = ({
  apiKey,
  thresholds = DEFAULT_THRESHOLDS,
  model = 'omni-moderation-latest',
  timeoutMs = 5000,
  fetch = globalThis.fetch,
  onError = () => {},
}: OpenAiScreenOptions): Screen => {
  return async ({ text, imageUrl }) => {
    const input = imageUrl
      ? [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: imageUrl } },
        ]
      : text;
    try {
      const res = await fetch(MODERATIONS_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, input }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`OpenAI moderation answered ${res.status}`);
      const body = (await res.json()) as {
        results?: { category_scores?: Record<string, number> }[];
      };
      const scores = body.results?.[0]?.category_scores;
      if (!scores || typeof scores !== 'object') throw new Error('OpenAI moderation: no scores');
      return verdictFrom(scores, thresholds);
    } catch (error) {
      onError(error);
      return { outcome: 'hold', flags: [] };
    }
  };
};
