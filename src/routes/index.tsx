import { createFileRoute, Link } from '@tanstack/react-router';

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

            {/* Pushed to the bottom so both cards' actions line up regardless of list length */}
            <Link
              to={mode.to}
              className="mt-auto inline-block rounded-md border-2 border-ink-700 bg-parchment-100 px-6 py-2 text-center font-heading font-semibold text-ink-900 shadow-parchment transition-all duration-200 hover:border-ink-800 hover:bg-parchment-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            >
              {mode.action}
            </Link>
          </Card>
        ))}
      </section>
    </div>
  );
}
