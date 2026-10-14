import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { colors, contrastRatio, onTeamColor } from '@team-impact/ui-tokens';
import { sampleTeams } from '../fixtures';
import { Avatar, Badge, Button, Input, Logo, Select, Sheet, TeamAvatar } from '.';

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

  it('Button sizes and variants map to their classes', () => {
    render(<Button label="Clear" variant="quiet" size="sm" />);
    expect(screen.getByRole('button', { name: 'Clear' }).className).toBe(
      'ti-button ti-button--quiet ti-button--sm',
    );
  });

  it('Badge renders its tone', () => {
    render(<Badge label="Approved" variant="success" />);
    expect(screen.getByText('Approved').className).toBe('ti-badge ti-badge--success');
  });

  it('Avatar on a role colour keeps initials legible', () => {
    render(<Avatar name="Maya Chen" color={colors.role.staff} />);
    const el = screen.getByRole('img', { name: 'Maya Chen' });
    expect(el.textContent).toBe('MC');
    expect(el.style.background).not.toBe('');
    expect(contrastRatio(onTeamColor(colors.role.staff), colors.role.staff)).toBeGreaterThan(4.5);
  });

  it('Select labels the field', () => {
    render(
      <Select label="Region" defaultValue="">
        <option value="">Any</option>
      </Select>,
    );
    expect(screen.getByLabelText('Region').tagName).toBe('SELECT');
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
