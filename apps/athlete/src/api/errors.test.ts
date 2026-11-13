import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './client';
import { describeError, isNotFound } from './errors';

const apiError = (status: number, message: string) =>
  new ApiRequestError(status, { error: { code: 'x', message } } as never);

describe('describeError', () => {
  it('passes the API’s own message through for a 4xx', () => {
    expect(describeError(apiError(404, 'No such community'))).toBe('No such community');
    expect(describeError(apiError(403, 'Teens post only to their team'))).toBe(
      'Teens post only to their team',
    );
  });

  it('hides a server error behind a generic line', () => {
    expect(describeError(apiError(500, 'relation "posts" does not exist'))).toMatch(
      /went wrong on our side/,
    );
    expect(describeError(apiError(503, 'upstream timeout'))).toMatch(/went wrong on our side/);
  });

  it('reads a failed connection as offline', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toMatch(/offline/);
    expect(describeError(new TypeError('Network request failed'))).toMatch(/offline/);
  });

  it('never shows anything else raw', () => {
    expect(describeError(new SyntaxError('Unexpected token < in JSON'))).toMatch(/went wrong/);
    expect(describeError('boom')).toMatch(/went wrong/);
  });
});

describe('isNotFound', () => {
  it('is true only for an API 404', () => {
    expect(isNotFound(apiError(404, 'No such post'))).toBe(true);
    expect(isNotFound(apiError(403, 'No'))).toBe(false);
    expect(isNotFound(new TypeError('Failed to fetch'))).toBe(false);
  });
});
