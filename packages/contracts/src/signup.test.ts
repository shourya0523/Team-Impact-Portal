import { describe, expect, it } from 'vitest';
import { codeFromScan, CreateJoinRequest, NewChild, SignupRequest } from './index';

const bornYearsAgo = (years: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const TEAM = '00000000-0000-4000-8000-000000000201';

describe('sign-up and join contracts', () => {
  it('sends under-13s to a parent instead of creating an account', () => {
    const result = SignupRequest.safeParse({
      email: 'kid@example.org',
      password: 'correct horse battery',
      firstName: 'Kid',
      lastName: 'Young',
      birthDate: bornYearsAgo(12),
      role: 'athlete',
      acceptTerms: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/parent or guardian/);
  });

  it('takes only under-13 children, keeping just an initial of the last name', () => {
    const ok = NewChild.parse({ firstName: 'Lucia', lastInitial: 'd', birthDate: bornYearsAgo(8) });
    expect(ok.lastInitial).toBe('D');
    expect(
      NewChild.safeParse({ firstName: 'Lucia', lastInitial: 'D', birthDate: bornYearsAgo(13) })
        .success,
    ).toBe(false);
    expect(
      NewChild.safeParse({ firstName: 'Lucia', lastInitial: 'Diaz', birthDate: bornYearsAgo(8) })
        .success,
    ).toBe(false);
  });

  it('lets only parents add children to a join request', () => {
    const children = [{ firstName: 'Lucia', lastInitial: 'D', birthDate: bornYearsAgo(8) }];
    expect(
      CreateJoinRequest.safeParse({
        role: 'parent',
        teamId: TEAM,
        relationship: 'parent',
        children,
      }).success,
    ).toBe(true);
    const asTeen = CreateJoinRequest.parse({ role: 'teen', teamId: TEAM, children });
    expect(asTeen).not.toHaveProperty('children');
  });
});

describe('codeFromScan', () => {
  it('reads the short code from a coach’s QR link, on every scheme the app is opened with', () => {
    expect(codeFromScan('teamimpact://scan?code=JUMBQ7K4')).toBe('JUMBQ7K4');
    expect(codeFromScan('exp://192.168.0.2:8081/--/scan?code=JUMBQ7K4')).toBe('JUMBQ7K4');
    expect(codeFromScan('http://localhost:8081/scan?ref=poster&code=JUMBQ7K4#top')).toBe(
      'JUMBQ7K4',
    );
  });

  it('takes a typed short code any way it’s written, and decodes an escaped one', () => {
    expect(codeFromScan('  jumb-q7k4 ')).toBe('JUMBQ7K4');
    expect(codeFromScan('teamimpact://scan?code=jumb%2Dq7k4')).toBe('JUMBQ7K4');
  });

  it('passes a bare token through unchanged', () => {
    const token = 'kX9fQ2mZ7pL4vB8nR3tY6wC1';
    expect(codeFromScan(token)).toBe(token);
  });

  it('is null for anything that isn’t a Team IMPACT code', () => {
    expect(codeFromScan('https://example.com/menu')).toBeNull(); // someone else’s QR
    expect(codeFromScan('teamimpact://scan?code=%E0%A4%A')).toBeNull(); // a broken escape
    expect(codeFromScan('teamimpact://scan?code=ABC')).toBeNull(); // too short to be either
    expect(codeFromScan('JUMB2026')).toBeNull(); // 0 is a look-alike the alphabet leaves out
    expect(codeFromScan('')).toBeNull();
    // Long enough to be a token, but not one: it stays on the phone.
    expect(codeFromScan('WIFI:S:CafeGuest;T:WPA;P:hunter22;;')).toBeNull();
    expect(codeFromScan('Call me at 617 555 0100 tonight')).toBeNull();
  });
});
