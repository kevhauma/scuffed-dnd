/**
 * Landing Page Route
 *
 * The way into both modes.
 *
 * **Validates: Requirements 19.1, 22.1-22.4**
 */

import { createFileRoute, Link } from '@tanstack/react-router';

import { TavernSign } from '../components/shared/TavernSign';
import { buttonStyles } from '../components/ui/Button/Button.style';
import { Card } from '../components/ui/Card/Card';
import { Divider } from '../components/ui/Divider/Divider';
import { Ornament } from '../components/ui/Ornament/Ornament';
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
      'Define stats — invested, derived from a formula, or a resource pool',
      'Build skills as weighted stats, plus what a Player invests',
      'Tune the numbers once as constants and curves',
      'Design materials, items and the slots they equip into',
      'Configure races as stat blocks and archetypes as growth rates',
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
      'Roll what the ruleset defines, decomposed down its dice ladder',
      'Everything stored in your browser, nowhere else',
    ],
  },
] as const;

export function Home() {
  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-10">
      {/*
        The welcome. An oak board with the sign on it and a seal in the corner — the one place in
        the app that is allowed to be purely atmosphere, because it is the only screen with no work
        on it. Everything inside the plaque needs `inverse` (CR-07): the ground is timber.
      */}
      <section className="mb-10">
        <Card
          variant="plaque"
          className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 px-8 py-10 text-center"
        >
          <TavernSign className="h-20 w-24" />
          <Text variant="h1" as="h1" inverse>
            Custom DnD Builder
          </Text>
          <Text variant="quill" as="p" inverse className="max-w-xl">
            Pull up a stool. The ruleset is yours to write and the dice are yours to roll.
          </Text>
          <Text variant="body-small-secondary" as="p" inverse className="max-w-2xl">
            Build a tabletop RPG ruleset of your own — skills, stats, materials, items and races —
            then play characters on it. No account, no server: everything lives in this browser, and
            a ruleset travels as a JSON file.
          </Text>
          <Ornament
            variant="seal"
            className="absolute -bottom-6 right-6 h-14 w-14 rotate-12 text-crimson"
          />
        </Card>
      </section>

      <Divider className="mx-auto mb-10 max-w-2xl" />

      <section className="grid gap-6 md:grid-cols-2">
        {MODES.map((mode) => (
          <Card key={mode.to} variant="elevated" className="flex h-full flex-col p-8">
            <Text variant="h3" as="h2" className="mb-3">
              {mode.heading}
            </Text>
            <Text variant="body-secondary" as="p" className="mb-4">
              {mode.lead}
            </Text>

            <ul className="mb-6 space-y-2">
              {mode.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  {/* A fleuron rather than a bullet — and an `Ornament` rather than a `Text` with a
                      colour class on it, which would be two `text-*` utilities fighting (CR-07) */}
                  <Ornament
                    variant="fleuron"
                    className="mt-2 h-2 w-5 shrink-0 text-brass-dark/70"
                  />
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
            <Link to={mode.to} className={buttonStyles('primary', 'lg', 'mt-auto')}>
              {mode.action}
            </Link>
          </Card>
        ))}
      </section>
    </div>
  );
}
