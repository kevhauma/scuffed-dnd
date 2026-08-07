/**
 * App Shell
 *
 * The medieval frame every route renders inside: title, mode switcher, and the navigation for
 * whichever mode is active. Layout lives here; the primitives supply the styling.
 *
 * **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 21.4, 21.5, 22.1-22.6**
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button/Button';
import { Text } from '../ui/Text/Text';
import { useAppMode } from './useAppMode';

/** Sections reachable in configuration mode (Requirement 19.4) */
const CONFIG_NAV = [
  { to: '/config', label: 'Dashboard' },
  { to: '/config/skills', label: 'Skills' },
  { to: '/config/stats', label: 'Stats' },
  { to: '/config/materials', label: 'Materials' },
  { to: '/config/items', label: 'Items' },
  { to: '/config/races', label: 'Races' },
  { to: '/config/currency', label: 'Currency' },
  { to: '/config/constants', label: 'Constants' },
  { to: '/config/focus', label: 'Focus Stat' },
] as const;

/** Screens reachable in play mode (Requirement 19.5) */
const PLAY_NAV = [
  { to: '/play', label: 'Characters' },
  { to: '/play/create', label: 'New Character' },
] as const;

const navLinkStyles =
  'rounded px-3 py-1 font-body text-sm text-ink-700 transition-colors hover:bg-parchment-200 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber';

const activeNavLinkStyles = 'bg-parchment-300 text-ink-900 font-medium';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { mode, switchMode } = useAppMode();

  const navItems = mode === 'play' ? PLAY_NAV : CONFIG_NAV;

  return (
    <div className="min-h-screen bg-parchment-50">
      <header className="border-b border-stone-200 bg-parchment-100 shadow-parchment">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="rounded font-heading text-xl font-semibold text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            Custom DnD Builder
          </Link>

          <nav aria-label="Mode" className="flex gap-2">
            <Button
              variant={mode === 'config' ? 'primary' : 'secondary'}
              onClick={() => switchMode('config')}
              aria-pressed={mode === 'config'}
            >
              Configuration
            </Button>
            <Button
              variant={mode === 'play' ? 'primary' : 'secondary'}
              onClick={() => switchMode('play')}
              aria-pressed={mode === 'play'}
            >
              Play
            </Button>
          </nav>
        </div>

        <nav
          aria-label={mode === 'play' ? 'Play navigation' : 'Configuration navigation'}
          className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 lg:px-8"
        >
          <div className="flex flex-wrap gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={navLinkStyles}
                activeProps={{ className: `${navLinkStyles} ${activeNavLinkStyles}` }}
                activeOptions={{ exact: true }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Text variant="caption" as="p">
          {mode === 'play'
            ? 'Play mode — the ruleset is locked while you play.'
            : 'Configuration mode — you are editing the ruleset.'}
        </Text>
      </footer>
    </div>
  );
}
