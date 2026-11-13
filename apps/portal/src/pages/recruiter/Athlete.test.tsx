import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
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

const view: TrackEventRequest = {
  name: 'card.viewed',
  properties: { cardId: CARD },
  subjectId: JORDAN,
};

/** jsdom can't follow mailto:, tel: or new-tab links; the click handlers still run. */
const stayOnPage = (event: MouseEvent) => event.preventDefault();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.removeEventListener('click', stayOnPage);
});

/** Lets requests started by effects land before counting them. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Serves the card and no lists, and records every event the page logs. */
const fakeApi = (served: CardWithContact = card) => {
  const events: TrackEventRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^\/api/, '');
      if (path === '/events') {
        events.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      }
      const body = path === `/cards/${JORDAN}` ? served : [];
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return events;
};

const renderPage = ({ strict = false } = {}) => {
  const page = (
    <MemoryRouter initialEntries={[`/athletes/${JORDAN}`]}>
      <Routes>
        <Route path="/athletes/:id" element={<AthletePage />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
};

describe('athlete page', () => {
  it('logs one card view, and a contact view when a shared detail is copied', async () => {
    const events = fakeApi();
    renderPage();
    const email = await screen.findByRole('link', { name: 'jordan@example.edu' });
    expect(email.getAttribute('href')).toBe('mailto:jordan@example.edu');
    await vi.waitFor(() => expect(events).toEqual([view]));

    fireEvent.copy(email);
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events[1]).toEqual({
      name: 'contact.viewed',
      properties: { channel: 'email' },
      subjectId: JORDAN,
    });
  });

  it('logs the card view once under StrictMode’s double mount', async () => {
    const events = fakeApi();
    renderPage({ strict: true });
    await screen.findByRole('link', { name: 'jordan@example.edu' });
    await settle();
    expect(events).toEqual([view]);
  });

  it('logs a contact view when a shared detail is opened', async () => {
    window.addEventListener('click', stayOnPage);
    const contact = {
      email: 'jordan@example.edu',
      phone: '(617) 555-0142',
      linkedinUrl: 'linkedin.com/in/jordan-ellis',
    };
    const events = fakeApi({ ...card, contact });
    renderPage();
    const links = { email: contact.email, phone: contact.phone, linkedin: contact.linkedinUrl };
    for (const [channel, text] of Object.entries(links)) {
      fireEvent.click(await screen.findByRole('link', { name: text }));
      await vi.waitFor(() =>
        expect(events.at(-1)).toEqual({
          name: 'contact.viewed',
          properties: { channel },
          subjectId: JORDAN,
        }),
      );
    }
    expect(events.map((e) => e.name)).toEqual([
      'card.viewed',
      'contact.viewed',
      'contact.viewed',
      'contact.viewed',
    ]);
  });
});
