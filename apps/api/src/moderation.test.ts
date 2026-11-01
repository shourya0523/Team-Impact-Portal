import { describe, expect, it, vi } from 'vitest';
import { openAiScreen, verdictFrom } from './moderation';

const clean = { harassment: 0.01, violence: 0.02, 'sexual/minors': 0, 'self-harm': 0 };

describe('verdictFrom', () => {
  it('allows content under every threshold', () => {
    expect(verdictFrom(clean)).toEqual({ outcome: 'allow', flags: [] });
  });

  it('holds between the thresholds and blocks over the block one, flags highest first', () => {
    expect(verdictFrom({ ...clean, harassment: 0.5, violence: 0.4 })).toEqual({
      outcome: 'hold',
      flags: ['harassment', 'violence'],
    });
    expect(verdictFrom({ ...clean, violence: 0.95 }).outcome).toBe('block');
  });

  it('blocks anything sexual involving minors as soon as it would be held', () => {
    expect(verdictFrom({ ...clean, 'sexual/minors': 0.31 })).toEqual({
      outcome: 'block',
      flags: ['sexual/minors'],
    });
  });

  it('never blocks self-harm, only holds it so staff can reach out', () => {
    expect(verdictFrom({ ...clean, 'self-harm': 0.99, 'self-harm/intent': 0.97 })).toEqual({
      outcome: 'hold',
      flags: ['self-harm', 'self-harm/intent'],
    });
  });

  it('follows the configured thresholds', () => {
    const strict = { holdAt: 0.01, blockAt: 0.02 };
    expect(verdictFrom(clean, strict).outcome).toBe('block');
  });
});

const answer = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

describe('openAiScreen', () => {
  it('sends the text, and a photo alongside it, to OpenAI moderation', async () => {
    const fetch = answer({ results: [{ flagged: false, category_scores: clean }] });
    const screen = openAiScreen({ apiKey: 'sk-test', fetch });

    expect(await screen({ text: 'Lift at 6?' })).toEqual({ outcome: 'allow', flags: [] });
    await screen({ text: 'Team', imageUrl: 'https://cdn.example.org/team.jpg' });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/moderations');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-test');
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'omni-moderation-latest',
      input: 'Lift at 6?',
    });
    expect(JSON.parse(String(fetch.mock.calls[1]![1]?.body)).input).toEqual([
      { type: 'text', text: 'Team' },
      { type: 'image_url', image_url: { url: 'https://cdn.example.org/team.jpg' } },
    ]);
  });

  it('decides on the scores with the configured thresholds', async () => {
    const fetch = answer({
      results: [{ flagged: true, category_scores: { ...clean, hate: 0.6 } }],
    });
    const screen = openAiScreen({ apiKey: 'k', fetch, thresholds: { holdAt: 0.5, blockAt: 0.7 } });
    expect(await screen({ text: 'x' })).toEqual({ outcome: 'hold', flags: ['hate'] });
  });

  it('holds for staff, never allows, when the screen can’t answer', async () => {
    const onError = vi.fn();
    const failing = [
      answer({ error: { message: 'rate limited' } }, 429),
      answer({ results: [] }),
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('fetch failed');
      }),
    ];
    for (const fetch of failing) {
      const screen = openAiScreen({ apiKey: 'k', fetch, onError });
      expect(await screen({ text: 'x' })).toEqual({ outcome: 'hold', flags: [] });
    }
    expect(onError).toHaveBeenCalledTimes(failing.length);
  });
});
