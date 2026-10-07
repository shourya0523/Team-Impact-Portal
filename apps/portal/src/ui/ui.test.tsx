import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { colors, contrastRatio } from '@team-impact/ui-tokens';
import { sampleTeams } from '../fixtures';
import { Button, Input, Logo, Sheet, TeamAvatar } from '.';

afterEach(cleanup);

describe('portal primitives', () => {
  it('Button fires onClick and respects disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button label="Go" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<Button label="Go" onClick={onClick} disabled />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Input labels the field and announces errors', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Required');
  });

  it('TeamAvatar keeps initials legible on any team colour', () => {
    render(<TeamAvatar name="Austin Hawks" teamColor={sampleTeams.hawks} />);
    const el = screen.getByRole('img', { name: 'Austin Hawks' });
    expect(el.textContent).toBe('AH');
    expect(contrastRatio(colors.ink, sampleTeams.hawks)).toBeGreaterThan(4.5);
  });

  it('Logo is labelled and keeps the artwork aspect ratio', () => {
    render(<Logo size="lg" />);
    const img = screen.getByRole('img', { name: 'Team IMPACT' });
    expect(img.getAttribute('height')).toBe('96');
    expect(img.getAttribute('width')).toBe('84');
    expect(img.getAttribute('src')).toBe('/logo.svg');
  });

  it('Logo dark variant uses the keyline file', () => {
    render(<Logo variant="dark" />);
    expect(screen.getByRole('img', { name: 'Team IMPACT' }).getAttribute('src')).toBe(
      '/logo-dark.svg',
    );
  });

  it('Sheet closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Hello" onClose={onClose}>
        body
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Hello' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ui.css', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/ui.css'), 'utf8');
  it('has no hardcoded hex colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it('has no raw px beyond 1px and 2px borders and rings', () => {
    const offenders = css.match(/(?<![\w.-])(?!1px|2px)[1-9]\d*(\.\d+)?px/g);
    expect(offenders).toBeNull();
  });
  it('sources are only tokens: no other css files slip in', () => {
    expect(readdirSync(resolve(process.cwd(), 'src')).filter((f) => f.endsWith('.css'))).toEqual(
      [],
    );
  });
});
