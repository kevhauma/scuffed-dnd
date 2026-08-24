/**
 * Landing Page Tests
 *
 * The landing page was the last of the project scaffold's stock-palette markup. These tests keep
 * it from coming back and check the page still says what the two modes do.
 *
 * **Validates: Requirements 21.4, 22.1, 22.3, 22.4**
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { Home } from './index';

const source = readFileSync(resolve(process.cwd(), 'src/client/routes/index.tsx'), 'utf8');

describe('/', () => {
  it('should offer a way into both modes', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { level: 1, name: 'Custom DnD Builder' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Start Configuring' }).getAttribute('href')).toBe(
      '/config'
    );
    expect(screen.getByRole('link', { name: 'Play Now' }).getAttribute('href')).toBe('/play');
  });

  it('should describe what each mode does', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: 'Configuration Mode' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Play Mode' })).toBeDefined();
  });

  it('should carry no stock Tailwind palette classes', () => {
    // Requirement 22.1 — the medieval theme does not stop at the landing page
    expect(source).not.toMatch(
      /\b(bg|text|border|ring|from|via|to)-(gray|slate|zinc|neutral|blue|green|red|indigo|purple|yellow|pink|cyan)-\d{2,3}\b/
    );
  });

  it('should carry no white surfaces or text', () => {
    expect(source).not.toMatch(/\b(bg|text)-white\b/);
  });

  it('should render its headings and copy through the Text primitive', () => {
    // Requirement 21.4 — no raw <h1>/<p> carrying utility classes
    expect(source).not.toMatch(/<h[1-6]\s+className=/);
    expect(source).not.toMatch(/<p\s+className=/);
    expect(source).toMatch(/<Text/);
  });
});
