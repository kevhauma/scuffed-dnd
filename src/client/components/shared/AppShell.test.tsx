/**
 * App Shell Tests
 *
 * The router is mocked at its boundary so the shell can be exercised without a router instance.
 *
 * **Validates: Requirements 19.3, 19.4, 19.5, 19.6, 22.1-22.6**
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
let pathname = '/config';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  // `AccountBadge` asks for one to invalidate after signing out (TICKET-AUTH-01)
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname } }),
  Link: ({ to, children, className }: { to: string; children: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// The shell carries the account badge, which asks the server who is signed in. Mocked to *signed
// out* so these cases stay about the shell — `AccountBadge.test.tsx` owns the three auth states.
vi.mock('../auth/authClient', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signOut: vi.fn(),
  },
}));

import { useUIStore } from '../../stores/uiStore';
import { AppShell } from './AppShell';
import { modeForPath } from './useAppMode';

const linkNames = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter((text): text is string => text !== null);

describe('modeForPath', () => {
  it('should map play and config paths to their modes, and everything else to neither', () => {
    expect(modeForPath('/play')).toBe('play');
    expect(modeForPath('/play/create')).toBe('play');
    expect(modeForPath('/play/character/abc')).toBe('play');
    expect(modeForPath('/config')).toBe('config');
    expect(modeForPath('/config/skills')).toBe('config');
    expect(modeForPath('/')).toBeNull();
  });

  it('should treat the ruleset list as configuration mode (TICKET-RUL-01)', () => {
    // It is the mode's entry point, so it belongs to the mode — including under Requirement 19.6's
    // play-mode lock. Leaving it outside would be a door beside a locked door.
    expect(modeForPath('/rulesets')).toBe('config');
  });

  it('should not mistake a path that merely begins with the same letters', () => {
    expect(modeForPath('/playground')).toBeNull();
    expect(modeForPath('/configuration-notes')).toBeNull();
    expect(modeForPath('/rulesets-archive')).toBeNull();
  });
});

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/config';
    useUIStore.setState({ mode: 'config' });
  });

  it('should show the configuration navigation in configuration mode, and not the play links', () => {
    render(<AppShell>content</AppShell>);

    const names = linkNames();
    expect(names).toContain('Skills');
    expect(names).toContain('Materials');
    expect(names).toContain('Archetypes');
    expect(names).toContain('Curves');
    // Split off Items by TICKET-INV-02 — the slots and the figure they sit on are their own page
    expect(names).toContain('Equipment');
    // Retired by TICKET-ARC-03 — the archetype replaced it
    expect(names).not.toContain('Focus Stat');
    expect(names).not.toContain('Characters');
    expect(names).not.toContain('New Character');
  });

  it('should show the play navigation in play mode, and not the config links', () => {
    pathname = '/play';
    useUIStore.setState({ mode: 'play' });

    render(<AppShell>content</AppShell>);

    const names = linkNames();
    expect(names).toContain('Characters');
    expect(names).toContain('New Character');
    expect(names).not.toContain('Skills');
    expect(names).not.toContain('Materials');
  });

  it('should set the mode and navigate when the switcher is used', () => {
    render(<AppShell>content</AppShell>);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(useUIStore.getState().mode).toBe('play');
    expect(navigate).toHaveBeenCalledWith({ to: '/play' });
  });

  it('should adopt the mode of the route it was entered on, so store and route agree', () => {
    pathname = '/play/create';
    useUIStore.setState({ mode: 'config' });

    render(<AppShell>content</AppShell>);

    expect(useUIStore.getState().mode).toBe('play');
  });

  it('should redirect a config route away while in play mode', () => {
    pathname = '/config/skills';
    useUIStore.setState({ mode: 'play' });

    render(<AppShell>content</AppShell>);

    expect(navigate).toHaveBeenCalledWith({ to: '/play', replace: true });
    // The lock wins over the route-to-mode sync — it does not quietly switch to config instead
    expect(useUIStore.getState().mode).toBe('play');
  });

  it('should leave the mode alone on a route that belongs to neither mode', () => {
    pathname = '/';
    useUIStore.setState({ mode: 'play' });

    render(<AppShell>content</AppShell>);

    expect(useUIStore.getState().mode).toBe('play');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should render the routed content', () => {
    render(
      <AppShell>
        <p>routed content</p>
      </AppShell>
    );

    expect(screen.getByText('routed content')).toBeDefined();
  });

  it('should give every interactive element a visible focus ring', () => {
    render(<AppShell>content</AppShell>);

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/focus-visible:ring/);
    }
  });

  it('should carry no stock Tailwind palette classes in the shell or the root layout', () => {
    const stockPalette =
      /\b(text|bg|border|ring)-(gray|slate|zinc|neutral|blue|green|red)-\d{2,3}\b/;

    for (const file of [
      'src/client/components/shared/AppShell.tsx',
      'src/client/routes/__root.tsx',
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(stockPalette);
      expect(source, file).not.toMatch(/\bbg-white\b/);
    }
  });
});
