import { describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './db';

const url = (host: string) => `postgres://postgres:secret@${host}:5432/postgres`;

describe('testDatabaseUrl', () => {
  it('uses PGlite (no URL) unless TEST_DATABASE_URL is set', () => {
    expect(testDatabaseUrl({})).toBeUndefined();
    expect(testDatabaseUrl({ TEST_DATABASE_URL: '  ' })).toBeUndefined();
  });

  it('never falls back to DATABASE_URL', () => {
    expect(testDatabaseUrl({ DATABASE_URL: url('localhost') })).toBeUndefined();
    expect(testDatabaseUrl({ DATABASE_URL: url('staging.example.com') })).toBeUndefined();
  });

  it('accepts local hosts and docker-compose service names', () => {
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '[::1]', 'postgres', 'db']) {
      expect(testDatabaseUrl({ TEST_DATABASE_URL: url(host) })).toBe(url(host));
    }
  });

  it('refuses a remote host without naming the password', () => {
    for (const host of [
      'staging.example.com',
      '10.0.0.5',
      'localhost.evil.com',
      'localhost,evil',
    ]) {
      expect(() => testDatabaseUrl({ TEST_DATABASE_URL: url(host) })).toThrow(/not local/);
    }
    expect(() => testDatabaseUrl({ TEST_DATABASE_URL: 'postgres:///postgres' })).toThrow(/no host/);
    const error = (() => {
      try {
        testDatabaseUrl({ TEST_DATABASE_URL: url('staging.example.com') });
      } catch (e) {
        return (e as Error).message;
      }
    })();
    expect(error).toMatch(/"staging\.example\.com"/);
    expect(error).not.toMatch(/secret/);
  });

  it('allows a remote host only with TEST_DATABASE_ALLOW_REMOTE=1', () => {
    const remote = url('ci-db.internal');
    expect(testDatabaseUrl({ TEST_DATABASE_URL: remote, TEST_DATABASE_ALLOW_REMOTE: '1' })).toBe(
      remote,
    );
    expect(() =>
      testDatabaseUrl({ TEST_DATABASE_URL: remote, TEST_DATABASE_ALLOW_REMOTE: 'yes' }),
    ).toThrow(/not local/);
  });

  it('rejects a malformed URL', () => {
    expect(() => testDatabaseUrl({ TEST_DATABASE_URL: 'not a url' })).toThrow(/not a valid URL/);
  });
});
