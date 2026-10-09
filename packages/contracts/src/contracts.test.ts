import { describe, expect, it } from 'vitest';
import { hasBaseballCard, SignupRequest } from './index';

describe('contracts', () => {
  it('only athletes have a Baseball Card', () => {
    expect(hasBaseballCard('athlete')).toBe(true);
    expect(hasBaseballCard('alumni')).toBe(true);
    expect(hasBaseballCard('parent')).toBe(false);
    expect(hasBaseballCard('recruiter')).toBe(false);
  });

  it('normalises signup email and rejects short passwords', () => {
    const ok = SignupRequest.parse({
      email: 'Jane@Example.com',
      password: 'correct horse battery',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(ok.email).toBe('jane@example.com');
    expect(SignupRequest.safeParse({ ...ok, password: 'short' }).success).toBe(false);
  });
});
