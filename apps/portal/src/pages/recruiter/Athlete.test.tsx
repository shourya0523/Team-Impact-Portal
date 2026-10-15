import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardWithContact, TrackEventRequest } from '@team-impact/contracts';
import { AthletePage } from './Athlete';

const JORDAN = '00000000-0000-4000-8000-000000000101';
const CARD = '00000000-0000-4000-8000-000000000601';

const card: CardWithContact = {
  id: CARD,
  athleteId: JORDAN,
  season: 2026,
  team: null,
  photoUrl: null,
  firstName: 'Jordan',
  lastName: 'Ellis',
  jerseyNumber: '07',
  position: null,
  classYear: 2027,
  major: 'Economics',
  hometown: null,
  city: null,
  region: null,
  experience: [],
  skills: [],
  lookingFor: null,
  contact: { email: 'jordan@example.edu' },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Serves the card and no lists, and records every event the page logs. */
const fakeApi = () => {
  const events: TrackEventRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      if (path === '/events') {
        events.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      }
      const body = path === `/cards/${JORDAN}` ? card : [];
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return events;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/athletes/${JORDAN}`]}>
      <Routes>
        <Route path="/athletes/:id" element={<AthletePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('athlete page', () => {
  it('logs one card view, and a contact view when a shared detail is copied', async () => {
    const events = fakeApi();
    renderPage();
    const email = await screen.findByRole('link', { name: 'jordan@example.edu' });
    expect(email.getAttribute('href')).toBe('mailto:jordan@example.edu');
    expect(events).toEqual([
      { name: 'card.viewed', properties: { cardId: CARD }, subjectId: JORDAN },
    ]);

    fireEvent.copy(email);
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events[1]).toEqual({
      name: 'contact.viewed',
      properties: { channel: 'email' },
      subjectId: JORDAN,
    });
  });
});
