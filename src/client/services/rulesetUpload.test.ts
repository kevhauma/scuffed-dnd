/**
 * Putting this browser's ruleset on an Account (TICKET-IO-04)
 *
 * **The load-bearing case is the last one in the first block: the two LocalStorage keys are
 * byte-identical afterwards.** An upload *copies* (v3 Req 36.5), and the failure that rule exists
 * against is silent — a "move" that cleared the keys, or a well-meant normalising rewrite, would
 * both leave the User's browser subtly different and neither would fail a test that only counted
 * requests. Comparing the raw strings before and after is the only assertion that cannot be
 * satisfied by a path that writes something equivalent.
 *
 * **Validates: v3 Req 36.2, 36.3, 36.5, 36.6, 36.7**
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toStoredConfiguration } from '#shared/engine/formula/references';
import { createFreshConfiguration } from '#shared/services/freshConfiguration';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { claimUploadPrompt, importToAccount, readBrowserUpload } from './rulesetUpload';
import { StorageSchemaError } from './storage';

const CONFIG_KEY = 'dnd_builder_config';
const CHARACTERS_KEY = 'dnd_builder_characters';

/** A character in the shape LocalStorage holds one */
function storedCharacter(configurationId: string, overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId,
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Put a ruleset and a roster in this browser, exactly as the app would have */
function seedBrowser(characters: Character[] = []): Configuration {
  const config = createFreshConfiguration('Ducklets');

  localStorage.setItem(CONFIG_KEY, JSON.stringify(toStoredConfiguration(config)));
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));

  return config;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('readBrowserUpload', () => {
  it('answers nothing when this browser holds no ruleset', () => {
    expect(readBrowserUpload()).toBeNull();
  });

  it('names the stored ruleset and counts what would go with it', () => {
    const config = seedBrowser();

    expect(readBrowserUpload()).toMatchObject({ name: 'Ducklets', characterCount: 0 });
    expect((readBrowserUpload()?.request.configuration as Configuration).id).toBe(config.id);
  });

  it('sends the document in stored form, which is what a file carries', () => {
    const config = seedBrowser();

    // The same bytes the export path would have written, rather than the display form the app
    // holds in memory — the server's import is the file's import (TICKET-REF-01's boundary)
    expect(readBrowserUpload()?.request.configuration).toEqual(toStoredConfiguration(config));
  });

  it('brings the characters built on this ruleset', () => {
    const config = seedBrowser();
    localStorage.setItem(
      CHARACTERS_KEY,
      JSON.stringify([
        storedCharacter(config.id),
        storedCharacter(config.id, { id: 'character-2', name: 'Waddles' }),
      ])
    );

    expect(readBrowserUpload()?.characterCount).toBe(2);
  });

  it('leaves behind characters built on a ruleset that is no longer here', () => {
    const config = seedBrowser();
    localStorage.setItem(
      CHARACTERS_KEY,
      JSON.stringify([
        storedCharacter(config.id),
        // A roster left over from a ruleset an import replaced. Uploading it would attach a
        // character to a ruleset it was never priced against.
        storedCharacter('a-ruleset-that-was-replaced', { id: 'character-orphan' }),
      ])
    );

    const upload = readBrowserUpload();

    expect(upload?.characterCount).toBe(1);
    expect((upload?.request.characters as Character[])[0].id).toBe('character-1');
  });

  it('leaves both stored keys byte-identical', () => {
    const config = seedBrowser([storedCharacter('anything')]);
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify([storedCharacter(config.id)]));

    const before = {
      config: localStorage.getItem(CONFIG_KEY),
      characters: localStorage.getItem(CHARACTERS_KEY),
    };

    readBrowserUpload();

    expect({
      config: localStorage.getItem(CONFIG_KEY),
      characters: localStorage.getItem(CHARACTERS_KEY),
    }).toEqual(before);
  });

  it('refuses stored data this build cannot read rather than uploading it (v3 Req 36.7)', () => {
    const config = createFreshConfiguration('Ducklets');
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ ...toStoredConfiguration(config), schemaVersion: 1 })
    );

    // The same `StorageSchemaError` the existing incompatible-data notice is built around — not a
    // second message invented for the upload
    expect(() => readBrowserUpload()).toThrow(StorageSchemaError);
  });
});

describe('importToAccount', () => {
  it('posts the document to the one import route', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'r1', name: 'Ducklets' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    await importToAccount({ configuration: { schemaVersion: 3 } });

    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/rulesets/import');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('writes nothing to LocalStorage on the way past', async () => {
    const config = seedBrowser();
    const before = localStorage.getItem(CONFIG_KEY);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'r1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    await importToAccount({ configuration: toStoredConfiguration(config) });

    expect(localStorage.getItem(CONFIG_KEY)).toBe(before);
  });
});

describe('claimUploadPrompt', () => {
  it('reports what the server decided rather than deciding anything itself', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ shouldPrompt: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(await claimUploadPrompt()).toBe(false);
  });
});
