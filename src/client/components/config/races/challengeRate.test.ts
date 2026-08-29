/**
 * `Race.challengeRate` is stored and built on nothing (TICKET-RACE-03)
 *
 * The v4.0 workbook gives every race a challenge rate and every playable one has it at **0** — a
 * creature-facing number waiting for a bestiary the app does not have. So the field is recorded
 * because the sheet has it (overview D1) and *nothing is built on it*: no engine term reads it, no
 * character sheet draws it, not even the race card.
 *
 * "Built on nothing" is a claim that decays silently, so it is a test rather than a sentence. The
 * ticket asks for a grep; this is that grep, run every time the suite runs. It fails the day a
 * second module names the field — which is the point: wiring a challenge rate into a rule should
 * be a deliberate decision with this file's expectation edited in the same change, not something
 * that happens on the way past.
 *
 * The scan is over source text rather than over imports, for `routeGuards.test.ts`' reason: the
 * obligation is about a *reader*, and a module can read a property of a `Race` it was handed
 * without importing anything at all.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The whole of `src/`, since a reader could appear in any of the three roots */
const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');

/** The field whose readership is being pinned */
const FIELD = 'challengeRate';

/**
 * The modules allowed to name it, as paths relative to `src/`
 *
 * Four, and every one of them is the field's own plumbing rather than something built on it: the
 * **declaration**, the **shape gate** that says an imported one has to be a number, and the
 * editor — its **hook**, which reads the stored number into the form and writes it back, and its
 * **dialog**, which names the *form's* field through `register('challengeRate')`. The string is the
 * same in the last two and a scan that tried to tell them apart would be a parser.
 *
 * What is *not* here is the whole point: nothing in `shared/engine/`, nothing in
 * `client/components/play/`, nothing under `src/server/`.
 */
const ALLOWED_READERS = [
  'shared/types/config.ts',
  'shared/services/importExport.ts',
  'client/components/config/races/RaceFormDialog.tsx',
  'client/components/config/races/useRaceManager.ts',
];

/** Directories with no source of ours in them */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.output', '.nitro']);

/**
 * Every non-test TypeScript module under `src/`, as paths relative to it
 *
 * Tests are excluded deliberately: a test naming the field is a test *of* the field, and this file
 * is itself one of them.
 *
 * @param directory - Where to look, absolute
 * @returns The modules found, relative to `src/`, with forward slashes
 */
function sourceModules(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;

    const absolute = join(directory, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      found.push(...sourceModules(absolute));
      continue;
    }

    const isSource = /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry);
    if (!isSource) continue;

    const relative = absolute.slice(SOURCE_ROOT.length + 1);
    found.push(relative.split('\\').join('/'));
  }

  return found;
}

describe('Race.challengeRate', () => {
  // Walked once for both cases: the scan is the expensive half of this file, and the second case
  // is about the very corpus the first one reads
  const modules = sourceModules(SOURCE_ROOT);

  it('is named by its declaration and its editor, and by nothing else', () => {
    const readers = modules.filter((relative) => {
      const source = readFileSync(join(SOURCE_ROOT, relative), 'utf8');
      return source.includes(FIELD);
    });

    expect([...readers].sort()).toEqual([...ALLOWED_READERS].sort());
  });

  it('scans a corpus big enough for the answer to mean something', () => {
    // The failure this guards against is the scan silently finding nothing — an unfalsifiable green
    // box. If `src/` ever comes back nearly empty, the expectation above proves nothing.
    expect(modules.length).toBeGreaterThan(100);
  });
});
