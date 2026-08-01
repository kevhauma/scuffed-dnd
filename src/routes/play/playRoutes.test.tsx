/**
 * Play Route Tests
 *
 * Asserts the play routes mount their real components rather than the scaffold's placeholder
 * copy. The components are mocked — they have their own test files, and this is about wiring.
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
vi.mock('../../components/play/creation/CharacterCreationWizard', () => ({
  CharacterCreationWizard: () => <div data-testid="creation-wizard" />,
}));

import { PlayIndex } from './index';
import { PlayCreate } from './create';

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

describe('/play/create', () => {
  it('should render the creation wizard', () => {
    render(<PlayCreate />);

    expect(screen.getByTestId('creation-wizard')).toBeDefined();
  });

  it('should no longer render the scaffold placeholder copy', () => {
    const { container } = render(<PlayCreate />);

    expect(container.textContent).not.toMatch(/will appear here/i);
  });

  it('should carry no stock Tailwind palette classes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/play/create.tsx'), 'utf8');

    expect(source).not.toMatch(/\b(text|bg|border)-(gray|slate|zinc|blue|green|red)-\d{2,3}\b/);
  });
});
