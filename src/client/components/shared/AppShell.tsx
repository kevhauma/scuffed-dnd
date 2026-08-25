/**
 * App Shell
 *
 * The frame every route renders inside, and the app's one piece of scene-setting: a timber beam
 * carrying the sign and the mode switcher, a rail of tabs hung under it, and the User's work laid
 * out on a sheet of parchment on the table below.
 *
 * The layout is built on one idea — **the room is dark and the work is lit**. Everything
 * structural (beam, rail, footer) is oak; everything the User reads or edits is parchment. That is
 * what gives the interface depth: before, the page and the cards on it were the same near-white,
 * so nothing sat on top of anything.
 *
 * Layout lives here; the primitives supply the styling.
 *
 * **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 21.4, 21.5, 22.1-22.6**
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AccountBadge } from '../auth/AccountBadge';
import { Button } from '../ui/Button/Button';
import { Divider } from '../ui/Divider/Divider';
import { Ornament } from '../ui/Ornament/Ornament';
import { Text } from '../ui/Text/Text';
import { TavernBackdrop } from './TavernBackdrop';
import { TavernSign } from './TavernSign';
import { useAppMode } from './useAppMode';

/** Sections reachable in configuration mode (Requirement 19.4) */
const CONFIG_NAV = [
  { to: '/config', label: 'Dashboard' },
  { to: '/config/skills', label: 'Skills' },
  { to: '/config/stats', label: 'Stats' },
  { to: '/config/materials', label: 'Materials' },
  { to: '/config/items', label: 'Items' },
  { to: '/config/equipment', label: 'Equipment' },
  { to: '/config/races', label: 'Races' },
  { to: '/config/archetypes', label: 'Archetypes' },
  { to: '/config/rolls', label: 'Rolls' },
  { to: '/config/currency', label: 'Currency' },
  { to: '/config/constants', label: 'Constants' },
  { to: '/config/curves', label: 'Curves' },
] as const;

/** Screens reachable in play mode (Requirement 19.5) */
const PLAY_NAV = [
  { to: '/play', label: 'Characters' },
  { to: '/play/create', label: 'New Character' },
] as const;

/**
 * A nav item is a wooden tab in the rail, and the current one is a parchment tab pulled forward
 * into the light. Same shape, opposite side of the "room dark, work lit" split — which is why the
 * active state needs no underline or dot to be obvious.
 */
const navShapeStyles = [
  'rounded-t border border-b-0',
  'px-3 py-1.5',
  'font-heading text-sm tracking-wide',
  'transition-colors duration-150',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber',
].join(' ');

/**
 * Colour is held apart from shape, and the two states go in `inactiveProps` / `activeProps` — the
 * CR-07 problem again, in the router's clothes. `Link` *appends* `activeProps.className` to
 * `className`, so a colour written into the shared string is still on the element when the tab is
 * current, and which of the two `text-*` utilities wins is decided by stylesheet order rather than
 * by the order they appear. The current tab came out light-on-light. Emitting only one colour per
 * state is the only reliable fix.
 */
const navRestingStyles =
  'border-transparent text-parchment-300 hover:bg-oak-700 hover:text-parchment-50';

const navCurrentStyles = 'border-brass-dark bg-parchment-200 text-ink-900 shadow-parchment';

/** Where the four vine corners sit on the parchment page */
const PAGE_CORNERS = [
  'left-0 top-0',
  'right-0 top-0 rotate-90',
  'right-0 bottom-0 rotate-180',
  'left-0 bottom-0 -rotate-90',
];

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { mode, switchMode } = useAppMode();

  const navItems = mode === 'play' ? PLAY_NAV : CONFIG_NAV;

  return (
    <div className="relative flex min-h-screen flex-col">
      <TavernBackdrop />

      {/* The beam. Sticky, because the config nav is eleven sections deep and scrolling back up to
          change section was the most common thing the old layout made you do. */}
      <header className="sticky top-0 z-30 border-b-2 border-brass-dark/70 bg-oak-800/95 surface-fibre shadow-parchment-lg backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            <TavernSign className="h-12 w-14 shrink-0" />
            <span className="font-heading text-xl font-semibold tracking-wide text-parchment-50">
              Custom DnD Builder
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-4">
            {/* Lit parchment for the mode you are in, unlit oak for the one you are not — the same
                split the nav rail uses, so "where am I" is answered the same way twice */}
            <nav aria-label="Mode" className="flex gap-2">
              <Button
                variant={mode === 'config' ? 'secondary' : 'plaque'}
                onClick={() => switchMode('config')}
                aria-pressed={mode === 'config'}
              >
                Configuration
              </Button>
              <Button
                variant={mode === 'play' ? 'secondary' : 'plaque'}
                onClick={() => switchMode('play')}
                aria-pressed={mode === 'play'}
              >
                Play
              </Button>
            </nav>

            {/* Beside the mode switcher rather than above it: signing in is *smaller* than
                choosing a mode, because it gates connected play and nothing else (D6) */}
            <AccountBadge />
          </div>
        </div>

        <nav
          aria-label={mode === 'play' ? 'Play navigation' : 'Configuration navigation'}
          className="border-t border-oak-900/80 bg-oak-900/50"
        >
          <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={navShapeStyles}
                  inactiveProps={{ className: navRestingStyles }}
                  activeProps={{ className: navCurrentStyles }}
                  activeOptions={{ exact: true }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </header>

      {/* The table, and the sheet on it. The page is *aged* parchment and the cards the routes
          render onto it are fresh vellum, so a card reads as something set down on the page. */}
      <main className="mx-auto flex w-full max-w-7xl grow px-4 py-6 sm:px-8 sm:py-10 lg:px-14">
        {/* `grow` on the sheet as well as on `main`: a short page should still look like a sheet
            lying on the table rather than a strip torn off one */}
        <div className="relative grow rounded-lg border border-oak-900/70 bg-parchment-200 surface-fibre shadow-parchment-lg ring-1 ring-inset ring-parchment-50/60">
          {PAGE_CORNERS.map((position) => (
            <Ornament
              key={position}
              variant="corner"
              className={`absolute h-10 w-10 text-ink-700/25 ${position}`}
            />
          ))}
          {children}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <Divider tone="brass" className="mb-3" />
        <Text variant="caption" as="p" inverse className="text-center">
          {mode === 'play'
            ? 'Play mode — the ruleset is locked while you play.'
            : 'Configuration mode — you are editing the ruleset.'}
        </Text>
      </footer>
    </div>
  );
}
