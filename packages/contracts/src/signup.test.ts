import { describe, expect, it } from 'vitest';
import { CreateJoinRequest, CURRENT_TERMS_VERSION, NewChild, SignupRequest } from './index';

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
      termsVersion: CURRENT_TERMS_VERSION,
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
