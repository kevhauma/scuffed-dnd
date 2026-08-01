/**
 * Play Route Tests
 *
 * Asserts `/play` mounts the character list rather than the scaffold's placeholder copy.
 * `CharacterList` is mocked — it has its own test file, and this is about the route's wiring.
 *
 * **Validates: Requirements 19.5, 11.1**
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../components/play/characters/CharacterList', () => ({
  CharacterList: () => <div data-testid="character-list" />,
}));

import { PlayIndex } from './index';

describe('/play', () => {
  it('should render the character list', () => {
    render(<PlayIndex />);

    expect(screen.getByTestId('character-list')).toBeDefined();
  });

  it('should no longer render the scaffold placeholder copy', () => {
    const { container } = render(<PlayIndex />);

    expect(container.textContent).not.toMatch(/will appear here/i);
  });

  it('should carry no stock Tailwind palette classes', () => {
    // The route file itself must be free of the scaffold's grey/blue utilities (Req 22.1)
    const source = readFileSync(resolve(process.cwd(), 'src/routes/play/index.tsx'), 'utf8');

    expect(source).not.toMatch(/\b(text|bg|border)-(gray|slate|zinc|blue|green|red)-\d{2,3}\b/);
  });
});
