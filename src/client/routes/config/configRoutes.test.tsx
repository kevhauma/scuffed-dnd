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

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../components/config/skills/skill/SkillsPanel', () => ({
  SkillsPanel: () => <div data-testid="skills-panel" />,
}));
vi.mock('../../components/config/stats/StatsConfigPanel', () => ({
  StatsConfigPanel: () => <div data-testid="stats-config-panel" />,
}));
vi.mock('../../components/config/materials/MaterialsConfigPanel', () => ({
  MaterialsConfigPanel: () => <div data-testid="materials-config-panel" />,
}));
vi.mock('../../components/config/inlays/InlaysConfigPanel', () => ({
  InlaysConfigPanel: () => <div data-testid="inlays-config-panel" />,
}));
vi.mock('../../components/config/spells/SpellsConfigPanel', () => ({
  SpellsConfigPanel: () => <div data-testid="spells-config-panel" />,
}));
vi.mock('../../components/config/passives/PassivesConfigPanel', () => ({
  PassivesConfigPanel: () => <div data-testid="passives-config-panel" />,
}));
vi.mock('../../components/config/items/ItemsConfigPanel', () => ({
  ItemsConfigPanel: () => <div data-testid="items-config-panel" />,
}));
vi.mock('../../components/config/equipment/EquipmentSlotsConfigPanel', () => ({
  EquipmentSlotsConfigPanel: () => <div data-testid="equipment-slots-config-panel" />,
}));
vi.mock('../../components/config/equipment/EquipmentLayoutPanel', () => ({
  EquipmentLayoutPanel: () => <div data-testid="equipment-layout-panel" />,
}));
vi.mock('../../components/config/archetypes/ArchetypesConfigPanel', () => ({
  ArchetypesConfigPanel: () => <div data-testid="archetypes-config-panel" />,
}));

vi.mock('../../components/config/rolls/RollsConfigPanel', () => ({
  RollsConfigPanel: () => <div data-testid="rolls-config-panel" />,
}));
vi.mock('../../components/config/rolls/DiceLaddersConfigPanel', () => ({
  DiceLaddersConfigPanel: () => <div data-testid="dice-ladders-config-panel" />,
}));
vi.mock('../../components/config/races/RacesConfigPanel', () => ({
  RacesConfigPanel: () => <div data-testid="races-config-panel" />,
}));
vi.mock('../../components/config/currency/CurrencyConfigPanel', () => ({
  CurrencyConfigPanel: () => <div data-testid="currency-config-panel" />,
}));
vi.mock('../../components/config/constants/ConstantsConfigPanel', () => ({
  ConstantsConfigPanel: () => <div data-testid="constants-config-panel" />,
}));
vi.mock('../../components/config/curves/CurvesConfigPanel', () => ({
  CurvesConfigPanel: () => <div data-testid="curves-config-panel" />,
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
import { ArchetypesConfig } from './archetypes';
import { ConstantsConfig } from './constants';
import { CurrencyConfig } from './currency';
import { CurvesConfig } from './curves';
import { EquipmentConfig } from './equipment';
import { ConfigIndex } from './index';
import { InlaysConfig } from './inlays';
import { ItemsConfig } from './items';
import { MaterialsConfig } from './materials';
import { PassivesConfig } from './passives';
import { RacesConfig } from './races';
import { RollsConfig } from './rolls';
import { SkillsConfig } from './skills';
import { SpellsConfig } from './spells';
import { StatsConfig } from './stats';

describe('configuration routes', () => {
  it('/config/skills renders one skills panel, with no main-skills or combat surface', () => {
    // Main skills went with TICKET-STAT-01 and combat skills with TICKET-ROLL-06 — the invested
    // atom is a stat (/config/stats) and a thing that produces dice is a roll (/config/rolls)
    const { container } = render(<SkillsConfig />);

    expect(screen.getByTestId('skills-panel')).toBeDefined();
    expect(container.querySelectorAll('[data-testid$="-panel"]')).toHaveLength(1);
    expect(screen.queryByTestId('main-skills-panel')).toBeNull();
    expect(screen.queryByTestId('combat-skills-panel')).toBeNull();
  });

  it('/config/stats renders the stats panel', () => {
    render(<StatsConfig />);

    expect(screen.getByTestId('stats-config-panel')).toBeDefined();
  });

  it('/config/materials renders the materials panel', () => {
    render(<MaterialsConfig />);

    expect(screen.getByTestId('materials-config-panel')).toBeDefined();
  });

  it('/config/inlays renders the inlays panel', () => {
    render(<InlaysConfig />);

    expect(screen.getByTestId('inlays-config-panel')).toBeDefined();
  });

  it('/config/items renders only the items panel', () => {
    // Equipment slots left this page in TICKET-INV-02 — asserting their absence is what stops the
    // two pages quietly growing back together
    render(<ItemsConfig />);

    expect(screen.getByTestId('items-config-panel')).toBeDefined();
    expect(screen.queryByTestId('equipment-slots-config-panel')).toBeNull();
  });

  it('/config/equipment renders the equipment slots and layout panels', () => {
    render(<EquipmentConfig />);

    expect(screen.getByTestId('equipment-slots-config-panel')).toBeDefined();
    expect(screen.getByTestId('equipment-layout-panel')).toBeDefined();
  });

  it('/config/races renders the races panel', () => {
    render(<RacesConfig />);

    expect(screen.getByTestId('races-config-panel')).toBeDefined();
  });

  it('/config/currency renders the currency panel', () => {
    render(<CurrencyConfig />);

    expect(screen.getByTestId('currency-config-panel')).toBeDefined();
  });

  it('/config/constants renders the constants panel', () => {
    render(<ConstantsConfig />);

    expect(screen.getByTestId('constants-config-panel')).toBeDefined();
  });

  it('/config/curves renders the curves panel', () => {
    render(<CurvesConfig />);

    expect(screen.getByTestId('curves-config-panel')).toBeDefined();
  });

  it('/config/archetypes renders the archetypes panel', () => {
    render(<ArchetypesConfig />);

    expect(screen.getByTestId('archetypes-config-panel')).toBeDefined();
  });

  it('/config/rolls renders the rolls and dice ladders panels', () => {
    render(<RollsConfig />);

    expect(screen.getByTestId('rolls-config-panel')).toBeDefined();
    expect(screen.getByTestId('dice-ladders-config-panel')).toBeDefined();
  });

  it('/config/spells renders the spells panel', () => {
    render(<SpellsConfig />);

    expect(screen.getByTestId('spells-config-panel')).toBeDefined();
  });

  it('/config/passives renders the passives panel', () => {
    render(<PassivesConfig />);

    expect(screen.getByTestId('passives-config-panel')).toBeDefined();
  });

  it('no config route renders the scaffold placeholder copy', () => {
    for (const Page of [
      SkillsConfig,
      StatsConfig,
      MaterialsConfig,
      InlaysConfig,
      SpellsConfig,
      PassivesConfig,
      ItemsConfig,
      EquipmentConfig,
      RacesConfig,
      ArchetypesConfig,
      RollsConfig,
      CurrencyConfig,
      ConstantsConfig,
      CurvesConfig,
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
