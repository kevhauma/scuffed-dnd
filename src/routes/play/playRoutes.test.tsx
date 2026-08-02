/**
 * Play Route Tests
 *
 * Asserts the play routes mount their real components rather than the scaffold's placeholder
 * copy. The components are mocked — they have their own test files, and this is about wiring.
 *
 * **Validates: Requirements 19.5, 11.1**
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/play/characters/CharacterList', () => ({
  CharacterList: () => <div data-testid="character-list" />,
}));
vi.mock('../../components/play/creation/CharacterCreationWizard', () => ({
  CharacterCreationWizard: () => <div data-testid="creation-wizard" />,
}));
vi.mock('../../components/play/sheet/CharacterSheet', () => ({
  CharacterSheet: ({ characterId }: { characterId: string }) => (
    <div data-testid="character-sheet">{characterId}</div>
  ),
}));

import { Route as CharacterRoute, PlayCharacterSheet } from './character.$id';
import { PlayCreate } from './create';
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

describe('/play/character/$id', () => {
  it('should render the character sheet for the route param', () => {
    // The route reads `id` from `useParams`; stub it rather than standing up a router
    vi.spyOn(CharacterRoute, 'useParams').mockReturnValue({ id: 'char1' });

    render(<PlayCharacterSheet />);

    expect(screen.getByTestId('character-sheet').textContent).toBe('char1');
  });

  it('should no longer render the scaffold placeholder copy', () => {
    vi.spyOn(CharacterRoute, 'useParams').mockReturnValue({ id: 'char1' });

    const { container } = render(<PlayCharacterSheet />);

    expect(container.textContent).not.toMatch(/will appear here/i);
  });

  it('should carry no stock Tailwind palette classes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/routes/play/character.$id.tsx'),
      'utf8'
    );

    expect(source).not.toMatch(/\b(text|bg|border)-(gray|slate|zinc|blue|green|red)-\d{2,3}\b/);
  });
});
