/**
 * Landing Page Route
 *
 * The way into both modes.
 *
 * **Validates: Requirements 19.1, 22.1-22.4**
 */

import { createFileRoute, Link } from '@tanstack/react-router';

import { buttonStyles } from '../components/ui/Button/Button.style';
import { Card } from '../components/ui/Card/Card';
import { Text } from '../components/ui/Text/Text';

export const Route = createFileRoute('/')({ component: Home });

/** What each mode actually does, as the app now stands */
const MODES = [
  {
    to: '/config',
    heading: 'Configuration Mode',
    lead: 'Design every part of your game system:',
    action: 'Start Configuring',
    points: [
      'Define custom skills with 3-letter codes',
      'Create stats from formulas over those skills',
      'Build materials with bonuses and value tiers',
      'Design items and the slots they equip into',
      'Configure races with their skill modifiers',
    ],
  },
  {
    to: '/play',
    heading: 'Play Mode',
    lead: 'Bring your characters to life:',
    action: 'Play Now',
    points: [
      'Create characters on your own ruleset',
      'Manage inventory and equipment',
      'Track current and maximum stat values',
      'Roll combat skills with simulated dice',
      'Everything stored in your browser, nowhere else',
    ],
  },
] as const;

export function Home() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <section className="py-12 text-center">
        <Text variant="h1" as="h1" className="mb-4">
          Custom DnD Builder
        </Text>
        <Text variant="body-secondary" as="p" className="mx-auto mb-8 max-w-2xl">
          Build a tabletop RPG ruleset of your own — skills, stats, materials, items and races —
          then play characters on it. No account, no server: everything lives in this browser, and a
          ruleset travels as a JSON file.
        </Text>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {MODES.map((mode) => (
          <Card key={mode.to} className="flex h-full flex-col p-8">
            <Text variant="h3" as="h2" className="mb-3">
              {mode.heading}
            </Text>
            <Text variant="body-secondary" as="p" className="mb-4">
              {mode.lead}
            </Text>

            <ul className="mb-6 space-y-2">
              {mode.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Text variant="body-small" as="span" className="text-amber">
                    &bull;
                  </Text>
                  <Text variant="body-small" as="span">
                    {point}
                  </Text>
                </li>
              ))}
            </ul>

            {/*
              Pushed to the bottom so both cards' actions line up regardless of list length. The
              styling is `Button`'s own (CR-28) rather than a copy of it — this has to be a `Link`
              to keep its href, but it must not drift from the buttons it sits beside.
            */}
            <Link to={mode.to} className={buttonStyles('secondary', 'md', 'mt-auto')}>
              {mode.action}
            </Link>
          </Card>
        ))}
      </section>
    </div>
  );
}
