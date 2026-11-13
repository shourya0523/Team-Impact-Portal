/**
 * Automated screening of new posts, comments, events and communities (PRD §9, CLAUDE.md). Each
 * item is screened before anyone but its author sees it:
 *
 * - not flagged: `allow`, published at once;
 * - flagged with lower confidence: `hold`, queued for staff review (`in_review`);
 * - flagged with high confidence: `block`, never published (staff still see it, resolved).
 *
 * A category is flagged when OpenAI flags it or its score reaches `holdAt`; it is high confidence
 * at `blockAt`. `sexual/minors` blocks whenever it is flagged, whatever its score. Team Impact
 * staff content is exempt and never sent here (`./mock/activity.ts`).
 *
 * The screen fails closed: when OpenAI can't be reached, times out, answers with something
 * unexpected, or no key is configured, the item is held for staff, never let through. Only the
 * item's text, and a post photo's URL, are sent (docs/moderation.md).
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
  /** A category scoring this or more counts as flagged, even if OpenAI didn't flag it: held. */
  holdAt: number;
  /** A flagged category scoring this or more is high confidence: blocked. */
  blockAt: number;
}

/**
 * Defaults for `MODERATION_HOLD_AT` and `MODERATION_BLOCK_AT`. Cautious for a platform with
 * children: a 0.3 score is already worth a person's look, and 0.85 is clear enough to block.
 */
export const DEFAULT_THRESHOLDS: Thresholds = { holdAt: 0.3, blockAt: 0.85 };

/** No tolerance on a platform with children: blocked whenever flagged, whatever the score. */
const ALWAYS_BLOCK = new Set(['sexual/minors']);

/** Without OpenAI configured every item waits for staff, as before screening existed. */
export const holdEverything: Screen = async () => ({ outcome: 'hold', flags: [] });

/** Staff content, and anything else exempt from screening. */
export const ALLOWED: Verdict = { outcome: 'allow', flags: [] };

/**
 * The decision for one OpenAI result: its category scores, and the categories OpenAI itself
 * flagged (`categories`, true when flagged).
 */
export const verdictFrom = (
  scores: Record<string, number>,
  { holdAt, blockAt }: Thresholds = DEFAULT_THRESHOLDS,
  flaggedByOpenAi: Record<string, boolean> = {},
): Verdict => {
  const categories = new Set([...Object.keys(scores), ...Object.keys(flaggedByOpenAi)]);
  const flagged = [...categories]
    .map((category) => [category, scores[category] ?? 0] as const)
    .filter(([category, score]) => score >= holdAt || flaggedByOpenAi[category] === true)
    .sort(([, a], [, b]) => b - a);
  const blocked = flagged.some(
    ([category, score]) => ALWAYS_BLOCK.has(category) || score >= blockAt,
  );
  const flags = flagged.map(([category]) => category);
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

/**
 * Screens with OpenAI's moderation endpoint (free, text and images in one call). Sends only the
 * text and photo URL, with no account, name or other identifier.
 */
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
        results?: {
          categories?: Record<string, boolean>;
          category_scores?: Record<string, number>;
        }[];
      };
      const result = body.results?.[0];
      const scores = result?.category_scores;
      if (!scores || typeof scores !== 'object' || Object.keys(scores).length === 0) {
        throw new Error('OpenAI moderation: no scores');
      }
      const flagged = typeof result?.categories === 'object' ? (result.categories ?? {}) : {};
      return verdictFrom(scores, thresholds, flagged);
    } catch (error) {
      onError(error);
      return { outcome: 'hold', flags: [] };
    }
  };
};
