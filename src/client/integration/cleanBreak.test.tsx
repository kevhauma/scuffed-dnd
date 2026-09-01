/**
 * The clean break, end to end (TICKET-DX-09, v4.0 D6)
 *
 * v4.0 raised `SUPPORTED_SCHEMA_VERSION` once and shipped **no conversion path** — so what a
 * browser holding older data actually gets is the whole of the compatibility story, and this is
 * the suite that proves it is a *refusal with a backup offer* rather than a crash, a shape error,
 * or a silent drop.
 *
 * **Nothing is mocked**, which is the point and the difference from
 * [`useAppHydration.test.tsx`](../components/shared/useAppHydration.test.tsx): that suite reaches
 * the refusal branch by mocking the loaders to throw, so it proves the *hook* routes a
 * `StorageSchemaError` to the notice — but nothing there proves that genuinely old-shape bytes
 * produce one. Here the bytes are old, the storage service is real, the stores are real, and the
 * component tree is the one `routes/__root.tsx` renders.
 *
 * One stubbed global, and nothing else: `URL`, subclassed to add the two object-url statics
 * (`createObjectURL` / `revokeObjectURL`) that happy-dom does not implement and the backup download
 * needs. Stubbing them is what lets the backup be opened and compared against the stored bytes
 * rather than merely asserted to have been offered.
 *
 * **Validates: Requirements 17.3, 17.4; v2.0 decision "Clean break on persisted data";
 * v4.0 D6**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '#shared/types/character';
import { type Configuration, SUPPORTED_SCHEMA_VERSION } from '#shared/types/config';
import { IncompatibleDataNotice } from '../components/shared/IncompatibleDataNotice';
import { useAppHydration } from '../components/shared/useAppHydration';
import { useCharacterStore } from '../stores/characterStore';
import { useConfigStore } from '../stores/configStore';

const CONFIG_KEY = 'dnd_builder_config';
const CHARACTERS_KEY = 'dnd_builder_characters';

/** A ruleset in the shape LocalStorage holds one, on the version this build reads */
function currentConfig(): Configuration {
  return {
    id: 'config1',
    name: 'Ducklets',
    version: '1.0',
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    stats: [],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  } satisfies Configuration;
}

/**
 * The same ruleset one version back — every shape this build refuses
 *
 * Typed as a loose record rather than a `Configuration`, which is the truth of it:
 * `schemaVersion` is the literal `SUPPORTED_SCHEMA_VERSION`, so an old-shape ruleset is not a
 * `Configuration` at all and only ever exists as stored bytes.
 */
function oldShapeConfig(): Record<string, unknown> {
  const current = currentConfig();

  return { ...current, schemaVersion: SUPPORTED_SCHEMA_VERSION - 1 };
}

/** A character this build can read: every field a reader dereferences, `composedItems` included */
function currentCharacter(): Character {
  return {
    id: 'char1',
    name: 'Thomas',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

/**
 * A character from before composed items — v4.0's clean break as the roster sees it
 *
 * `equippedItems` full of *template* ids and no `composedItems` at all: readable-looking, and
 * every read of its gear would resolve nothing (TICKET-INV-05).
 */
function preComposedCharacter(): Record<string, unknown> {
  const { inventory: _dropped, ...rest } = currentCharacter();

  return { ...rest, inventory: { equippedItems: { hand: 'item-axe' } } };
}

/**
 * Put a ruleset and a roster into storage as the bytes LocalStorage actually holds
 *
 * A helper rather than four `localStorage.setItem(KEY, JSON.stringify(…))` lines, because
 * CLAUDE.md's *never call a function as the argument of another call* covers test **arrangement**
 * too, not only assertions — the rule this ticket settled, applied to the file that settled it.
 * The serialisation is named on the way past.
 */
function seedStorage(config: unknown, characters: unknown[]): void {
  const configBytes = JSON.stringify(config);
  const rosterBytes = JSON.stringify(characters);

  localStorage.setItem(CONFIG_KEY, configBytes);
  localStorage.setItem(CHARACTERS_KEY, rosterBytes);
}

/** What `routes/__root.tsx` does with the hook's verdict, and nothing else */
function HydrationHarness() {
  const { incompatibleData, isHydrated } = useAppHydration();

  if (incompatibleData) {
    return (
      <IncompatibleDataNotice
        message={incompatibleData.message}
        onBackup={incompatibleData.downloadBackup}
        onStartFresh={incompatibleData.startFresh}
      />
    );
  }

  return <div>{isHydrated ? 'The app' : 'Loading'}</div>;
}

/** The blobs the backup download handed to the browser, newest last */
const downloaded: Blob[] = [];

/**
 * The real `URL`, plus the two object-url statics happy-dom does not implement
 *
 * A subclass rather than a plain object, because the anchor click the download performs runs
 * happy-dom's own navigation, which calls `new URL(…)` — replacing the constructor with a record of
 * two functions makes the download "work" while logging a `URL is not a constructor` underneath it.
 */
class CapturingURL extends URL {
  static createObjectURL(blob: Blob): string {
    downloaded.push(blob);

    return 'blob:backup';
  }

  static revokeObjectURL(): void {
    // Nothing to release: the blob is held by `downloaded` for the assertions
  }
}

describe('the clean break (v4.0 D6)', () => {
  beforeEach(() => {
    localStorage.clear();
    downloaded.length = 0;
    useConfigStore.setState({ config: null, isLoaded: false });
    useCharacterStore.setState({ characters: [], isLoaded: false });

    vi.stubGlobal('URL', CapturingURL);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('an old-shape ruleset', () => {
    beforeEach(() => {
      const old = oldShapeConfig();
      const roster = [currentCharacter()];

      seedStorage(old, roster);
    });

    it('meets the notice with its backup offer rather than a shape error', async () => {
      render(<HydrationHarness />);

      const heading = await screen.findByText('Saved Data Cannot Be Opened');
      const backup = screen.getByRole('button', { name: /download backup/i });

      expect(heading).toBeDefined();
      expect(backup).toBeDefined();
      // Refused in the User's terms — not "unexpected token" and not a missing-field list
      const notice = screen.getByText(/older version of the app/i);
      expect(notice).toBeDefined();
    });

    it('loads nothing and deletes nothing', async () => {
      const before = localStorage.getItem(CONFIG_KEY);

      render(<HydrationHarness />);
      await screen.findByText('Saved Data Cannot Be Opened');

      const config = useConfigStore.getState().config;
      const characters = useCharacterStore.getState().characters;
      const after = localStorage.getItem(CONFIG_KEY);

      expect(config).toBeNull();
      expect(characters).toEqual([]);
      // The bytes are still the User's, to the character
      expect(after).toBe(before);
    });

    it('hands the stored bytes back exactly as they are when the backup is taken', async () => {
      const storedBytes = localStorage.getItem(CONFIG_KEY);

      render(<HydrationHarness />);
      await screen.findByText('Saved Data Cannot Be Opened');

      // `downloadBlob` attaches an anchor and clicks it, which makes happy-dom start a real
      // navigation to the object URL — an async one that can settle inside a *later* file sharing
      // this worker and surface as an unattributed run error. `configFiles.test.ts` neutralises the
      // insertion the same way; it is spied here rather than in `beforeEach` because
      // `render` needs a working `appendChild` to mount the harness in the first place.
      const attach = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      const detach = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      const backup = screen.getByRole('button', { name: /download backup/i });
      fireEvent.click(backup);

      await waitFor(() => expect(downloaded).toHaveLength(1));

      attach.mockRestore();
      detach.mockRestore();

      const contents = await downloaded[0].text();
      const envelope = JSON.parse(contents) as Record<string, unknown>;
      const carried = JSON.stringify(envelope[CONFIG_KEY]);

      // Verbatim, not re-serialised from a parse: what they had is what they get
      expect(carried).toBe(storedBytes);
    });
  });

  describe('an old-shape character beside a current ruleset', () => {
    beforeEach(() => {
      const current = currentConfig();
      const roster = [preComposedCharacter()];

      seedStorage(current, roster);
    });

    it('meets the same notice with the same backup offer', async () => {
      render(<HydrationHarness />);

      const heading = await screen.findByText('Saved Data Cannot Be Opened');
      const backup = screen.getByRole('button', { name: /download backup/i });
      // The counts are in the message: one stray record reads differently from a whole roster
      const notice = screen.getByText(/1 of 1 saved character/i);

      expect(heading).toBeDefined();
      expect(backup).toBeDefined();
      expect(notice).toBeDefined();
    });

    it('refuses the whole roster rather than dropping the record it cannot read', async () => {
      const before = localStorage.getItem(CHARACTERS_KEY);

      render(<HydrationHarness />);
      await screen.findByText('Saved Data Cannot Be Opened');

      const characters = useCharacterStore.getState().characters;
      const after = localStorage.getItem(CHARACTERS_KEY);

      expect(characters).toEqual([]);
      expect(after).toBe(before);
    });
  });

  it('opens the app when both halves are on the current shape', async () => {
    const current = currentConfig();
    const roster = [currentCharacter()];

    seedStorage(current, roster);
    render(<HydrationHarness />);

    // Without this the two refusals above would pass for a hydration that never runs at all
    const app = await screen.findByText('The app');
    const loaded = useConfigStore.getState().config;

    expect(app).toBeDefined();
    expect(loaded?.name).toBe('Ducklets');
  });
});
