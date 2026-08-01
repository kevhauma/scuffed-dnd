/**
 * Configuration Route Tests
 *
 * Asserts every /config/* route mounts its panel(s) rather than placeholder copy.
 *
 * The panels are mocked: they have their own test files, and rendering the real ones
 * here would pull in the hooks-dispatcher failures documented in TEST_STATUS.md.
 * Each page component is imported by name rather than through `Route.options.component`,
 * which automatic code splitting replaces with a lazy wrapper Vitest cannot resolve.
 *
 * **Validates: Requirements 19.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../components/config/skills/main/MainSkillsPanel', () => ({
  MainSkillsPanel: () => <div data-testid="main-skills-panel" />,
}));
vi.mock('../../components/config/skills/speciality/SpecialitySkillsPanel', () => ({
  SpecialitySkillsPanel: () => <div data-testid="speciality-skills-panel" />,
}));
vi.mock('../../components/config/skills/combat/CombatSkillsPanel', () => ({
  CombatSkillsPanel: () => <div data-testid="combat-skills-panel" />,
}));
vi.mock('../../components/config/stats/StatsConfigPanel', () => ({
  StatsConfigPanel: () => <div data-testid="stats-config-panel" />,
}));
vi.mock('../../components/config/materials/MaterialsConfigPanel', () => ({
  MaterialsConfigPanel: () => <div data-testid="materials-config-panel" />,
}));
vi.mock('../../components/config/items/ItemsConfigPanel', () => ({
  ItemsConfigPanel: () => <div data-testid="items-config-panel" />,
}));
vi.mock('../../components/config/items/EquipmentSlotsConfigPanel', () => ({
  EquipmentSlotsConfigPanel: () => <div data-testid="equipment-slots-config-panel" />,
}));
vi.mock('../../components/config/races/RacesConfigPanel', () => ({
  RacesConfigPanel: () => <div data-testid="races-config-panel" />,
}));
vi.mock('../../components/config/currency/CurrencyConfigPanel', () => ({
  CurrencyConfigPanel: () => <div data-testid="currency-config-panel" />,
}));
vi.mock('../../components/config/focus/FocusStatConfig', () => ({
  FocusStatConfig: () => <div data-testid="focus-stat-config" />,
}));

// The dashboard must not hydrate itself — the root layout owns that (TICKET-IO-01)
vi.mock('../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { loadConfiguration } from '../../services/storage';
import { useConfigStore } from '../../stores/configStore';
import { ConfigIndex } from './index';
import { SkillsConfig } from './skills';
import { StatsConfig } from './stats';
import { MaterialsConfig } from './materials';
import { ItemsConfig } from './items';
import { RacesConfig } from './races';
import { CurrencyConfig } from './currency';
import { FocusConfig } from './focus';

describe('configuration routes', () => {
  it('/config/skills renders the three skills panels', () => {
    render(<SkillsConfig />);

    expect(screen.getByTestId('main-skills-panel')).toBeDefined();
    expect(screen.getByTestId('speciality-skills-panel')).toBeDefined();
    expect(screen.getByTestId('combat-skills-panel')).toBeDefined();
  });

  it('/config/stats renders the stats panel', () => {
    render(<StatsConfig />);

    expect(screen.getByTestId('stats-config-panel')).toBeDefined();
  });

  it('/config/materials renders the materials panel', () => {
    render(<MaterialsConfig />);

    expect(screen.getByTestId('materials-config-panel')).toBeDefined();
  });

  it('/config/items renders the items and equipment slots panels', () => {
    render(<ItemsConfig />);

    expect(screen.getByTestId('items-config-panel')).toBeDefined();
    expect(screen.getByTestId('equipment-slots-config-panel')).toBeDefined();
  });

  it('/config/races renders the races panel', () => {
    render(<RacesConfig />);

    expect(screen.getByTestId('races-config-panel')).toBeDefined();
  });

  it('/config/currency renders the currency panel', () => {
    render(<CurrencyConfig />);

    expect(screen.getByTestId('currency-config-panel')).toBeDefined();
  });

  it('/config/focus renders the focus stat configuration', () => {
    render(<FocusConfig />);

    expect(screen.getByTestId('focus-stat-config')).toBeDefined();
  });

  it('no config route renders the scaffold placeholder copy', () => {
    for (const Page of [
      SkillsConfig,
      StatsConfig,
      MaterialsConfig,
      ItemsConfig,
      RacesConfig,
      CurrencyConfig,
      FocusConfig,
    ]) {
      const { container, unmount } = render(<Page />);

      expect(container.textContent).not.toMatch(/will appear here/i);
      expect(container.textContent).not.toMatch(/^\s*\w+ Configuration\s*$/);
      unmount();
    }
  });
});

describe('/config dashboard hydration', () => {
  beforeEach(() => {
    vi.mocked(loadConfiguration).mockClear();
    useConfigStore.setState({ config: null, isLoaded: false });
  });

  it('does not hydrate itself — the root layout owns that', () => {
    render(<ConfigIndex />);

    expect(loadConfiguration).not.toHaveBeenCalled();
  });

  it('still shows the empty state when storage genuinely holds no configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<ConfigIndex />);

    expect(screen.getByText('No Configuration Found')).toBeDefined();
  });
});
