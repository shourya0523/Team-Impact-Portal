import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Company, PendingRecruiter, Recruiter } from '@team-impact/contracts';
import { RecruitersPage } from './Recruiters';

const NORTHBEAM = '00000000-0000-4000-8000-000000000801';

const company: Company = {
  id: NORTHBEAM,
  name: 'Northbeam Capital',
  domains: ['northbeam.com'],
  status: 'active',
  recruiterCount: 1,
  createdAt: '2026-10-01T12:00:00.000Z',
};

const pending: PendingRecruiter = {
  id: '00000000-0000-4000-8000-000000005000',
  firstName: 'Casey',
  lastName: 'New',
  email: 'casey.new@northbeam.com',
  title: null,
  company: { id: NORTHBEAM, name: 'Northbeam Capital' },
  requestedAt: '2026-10-12T12:00:00.000Z',
};

const elena: Recruiter = {
  user: {
    id: '00000000-0000-4000-8000-000000000110',
    firstName: 'Elena',
    lastName: 'Ward',
    role: 'recruiter',
    avatarUrl: null,
  },
  email: 'elena.ward@northbeam.com',
  title: 'Campus Recruiting Lead',
  companyId: NORTHBEAM,
  suspended: false,
  joinedAt: '2026-10-01T12:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A fake staff API that records writes and applies decline and suspend. */
const fakeApi = () => {
  let waiting = [pending];
  let recruiters = [elena];
  const writes: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      const json = (body: unknown, status = 200) =>
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      if (init?.method === 'POST') writes.push(path);
      if (path === '/staff/recruiter-sign-ups') return json(waiting);
      if (path === '/staff/recruiters') return json(recruiters);
      if (path === '/staff/companies') return json([company]);
      if (path.endsWith('/decline')) {
        waiting = [];
        return json(undefined, 204);
      }
      if (path.endsWith('/suspend')) {
        recruiters = [{ ...elena, suspended: true }];
        return json(recruiters[0]);
      }
      return json({ error: { code: 'not_found', message: path } }, 404);
    }),
  );
  return writes;
};

describe('staff recruiters page', () => {
  it('declines a pending sign-up and suspends one approved recruiter', async () => {
    const writes = fakeApi();
    render(<RecruitersPage />);

    expect(await screen.findByText('casey.new@northbeam.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(await screen.findByText('No one is waiting.')).toBeTruthy();
    expect(writes).toContain(`/staff/recruiter-sign-ups/${pending.id}/decline`);

    const northbeam = within(await screen.findByRole('region', { name: 'Northbeam Capital' }));
    expect(northbeam.getByText('Elena Ward')).toBeTruthy();
    fireEvent.click(northbeam.getByRole('button', { name: 'Suspend' }));
    expect(await northbeam.findByRole('button', { name: 'Restore' })).toBeTruthy();
    expect(northbeam.getByText('Suspended')).toBeTruthy();
    expect(writes).toContain(`/staff/recruiters/${elena.user.id}/suspend`);
  });
});
