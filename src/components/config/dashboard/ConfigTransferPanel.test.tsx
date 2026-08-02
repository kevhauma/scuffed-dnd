/**
 * Config Transfer Panel Tests
 *
 * The config store is real with LocalStorage mocked, so an import really lands in the store. The
 * import/export *service* is mocked only for the export assertion — jsdom has no
 * `URL.createObjectURL`, so what matters is that the service was asked with the right ruleset.
 *
 * **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 18.5**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '../../../types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

vi.mock('../../../services/importExport', async () => {
  const actual = await vi.importActual<typeof import('../../../services/importExport')>(
    '../../../services/importExport'
  );
  return { ...actual, downloadConfiguration: vi.fn() };
});

import { downloadConfiguration } from '../../../services/importExport';
import { useConfigStore } from '../../../stores/configStore';
import { ConfigTransferPanel } from './ConfigTransferPanel';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [{ code: 'STR', name: 'Strength', description: '', maxLevel: 20 }],
    stats: [],
    specialitySkills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** A stand-in for a picked file; jsdom's File.text() is unreliable, so it is provided here */
function jsonFile(name: string, contents: string): File {
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
  return file;
}

function choose(file: File) {
  fireEvent.change(screen.getByLabelText('Configuration file'), { target: { files: [file] } });
}

function confirmImport() {
  fireEvent.click(screen.getByRole('button', { name: 'Replace Configuration' }));
}

describe('ConfigTransferPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
  });

  it('should export the current configuration through the service', () => {
    render(<ConfigTransferPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Export Configuration' }));

    // Requirement 1.4 — the component builds no Blob and touches no URL API itself
    expect(downloadConfiguration).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadConfiguration).mock.calls[0][0].name).toBe('Test Config');
  });

  it('should ask before replacing the current ruleset', () => {
    render(<ConfigTransferPanel />);

    choose(jsonFile('other.json', JSON.stringify(createConfig({ name: 'Imported' }))));

    expect(screen.getByText(/Importing other.json replaces "Test Config"/)).toBeDefined();
    expect(useConfigStore.getState().config?.name).toBe('Test Config');
  });

  it('should leave the ruleset untouched when the import is cancelled', () => {
    render(<ConfigTransferPanel />);

    choose(jsonFile('other.json', JSON.stringify(createConfig({ name: 'Imported' }))));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useConfigStore.getState().config?.name).toBe('Test Config');
  });

  it('should apply a valid file to the store on confirmation', async () => {
    render(<ConfigTransferPanel />);

    choose(
      jsonFile(
        'other.json',
        JSON.stringify(createConfig({ id: 'imported', name: 'Imported Ruleset' }))
      )
    );
    confirmImport();

    // Requirement 1.5
    await waitFor(() => {
      expect(useConfigStore.getState().config?.name).toBe('Imported Ruleset');
    });
  });

  it('should reject malformed JSON without touching the current ruleset', async () => {
    render(<ConfigTransferPanel />);

    choose(jsonFile('broken.json', '{ not json'));
    confirmImport();

    // Requirement 1.6
    await waitFor(() => {
      expect(screen.getByText(/That file was not imported/)).toBeDefined();
    });
    expect(useConfigStore.getState().config?.name).toBe('Test Config');
  });

  it('should reject a structurally invalid file and list every reason', async () => {
    render(<ConfigTransferPanel />);

    choose(jsonFile('partial.json', JSON.stringify({ id: 'x', name: 'Half a ruleset' })));
    confirmImport();

    await waitFor(() => {
      expect(screen.getByText(/That file was not imported/)).toBeDefined();
    });
    // Every missing field is reported, not just the first
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(1);
    expect(useConfigStore.getState().config?.name).toBe('Test Config');
  });

  it('should report reference problems in an imported ruleset without refusing it', async () => {
    render(<ConfigTransferPanel />);

    // Structurally fine, but the stat formula names a skill that does not exist
    choose(
      jsonFile(
        'dangling.json',
        JSON.stringify(
          createConfig({
            name: 'Dangling',
            stats: [{ id: 'health', name: 'Health', description: '', formula: 'WIS * 10' }],
          })
        )
      )
    );
    confirmImport();

    // Requirement 18.5 — applied, and the problem named
    await waitFor(() => {
      expect(screen.getByText(/found problems to fix/)).toBeDefined();
    });
    expect(useConfigStore.getState().config?.name).toBe('Dangling');
    expect(screen.getByText(/WIS/)).toBeDefined();
  });

  it('should confirm a clean import found no issues', async () => {
    render(<ConfigTransferPanel />);

    choose(jsonFile('clean.json', JSON.stringify(createConfig({ name: 'Clean' }))));
    confirmImport();

    await waitFor(() => {
      expect(screen.getByText(/no issues found/)).toBeDefined();
    });
  });

  it('should rename the configuration through the store', () => {
    render(<ConfigTransferPanel />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grimdark Hollow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    // Requirement 1.1 — no longer stuck as 'My Custom Game System'
    expect(useConfigStore.getState().config?.name).toBe('Grimdark Hollow');
  });

  it('should refuse to rename to an empty name', () => {
    render(<ConfigTransferPanel />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });

    expect((screen.getByRole('button', { name: 'Rename' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(useConfigStore.getState().config?.name).toBe('Test Config');
  });

  it('should render nothing without a configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    const { container } = render(<ConfigTransferPanel />);

    expect(container.firstChild).toBeNull();
  });
});
