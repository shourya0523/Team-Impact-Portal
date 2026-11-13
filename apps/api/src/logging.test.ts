import { describe, expect, it } from 'vitest';
import { redactUrl } from './logging';

describe('redactUrl', () => {
  it('hides the token in a reset link’s path, keeping the rest', () => {
    expect(redactUrl('/api/auth/reset-password/abc123XYZ?callbackURL=http://app.test/r')).toBe(
      '/api/auth/reset-password/[redacted]?callbackURL=[redacted]',
    );
  });

  it('hides every query value under /api/auth', () => {
    expect(redactUrl('/api/auth/verify-email?token=eyJhbGci.x.y&callbackURL=%2Fok')).toBe(
      '/api/auth/verify-email?token=[redacted]&callbackURL=[redacted]',
    );
  });

  it('hides secret-looking parameters on other routes, and keeps the rest readable', () => {
    expect(redactUrl('/teams/join?code=TIGERS-42&ref=qr&Token=t1&token=t2')).toBe(
      '/teams/join?code=[redacted]&ref=qr&Token=[redacted]&token=[redacted]',
    );
  });

  it('leaves URLs without secrets alone', () => {
    expect(redactUrl('/health')).toBe('/health');
    expect(redactUrl('/feed?cursor=abc&limit=20')).toBe('/feed?cursor=abc&limit=20');
    expect(redactUrl('/api/auth/get-session')).toBe('/api/auth/get-session');
  });
});
