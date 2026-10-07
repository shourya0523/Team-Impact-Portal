import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('portal smoke test', () => {
  it('renders the shell', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'I love you Team Impact Portal' })).toBeTruthy();
  });
});
