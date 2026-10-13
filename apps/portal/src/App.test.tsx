import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('portal smoke test', () => {
  it('renders the shell', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Team Impact Portal' })).toBeTruthy();
  });
});

describe('athlete card preview', () => {
  it('flips between resume and personal info', () => {
    render(<App />);
    const card = screen.getByRole('button', { name: /athlete resume/ });
    expect(card.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(card);
    expect(card.getAttribute('aria-pressed')).toBe('true');
    expect(card.getAttribute('aria-label')).toMatch(/personal info/);

    fireEvent.click(screen.getByRole('button', { name: 'Show resume' }));
    expect(card.getAttribute('aria-pressed')).toBe('false');
  });
});
