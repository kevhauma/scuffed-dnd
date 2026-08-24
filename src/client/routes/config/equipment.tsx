/**
 * Equipment Configuration Route
 *
 * Two panels, the shape `/config/items` and `/config/rolls` already use: the slots a ruleset
 * defines, and the figure they are arranged on. They are one page because you place what you have
 * just defined, and two panels because a slot and a layout are separate things — each owns its own
 * `ConfigPanelShell` rather than one hand-writing a header the shell already emits (DX-05).
 *
 * **Validates: Requirements 7.5, 12.1, 12.2, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { EquipmentLayoutPanel } from '../../components/config/equipment/EquipmentLayoutPanel';
import { EquipmentSlotsConfigPanel } from '../../components/config/equipment/EquipmentSlotsConfigPanel';

export const Route = createFileRoute('/config/equipment')({
  component: EquipmentConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function EquipmentConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <EquipmentSlotsConfigPanel />
      <EquipmentLayoutPanel />
    </div>
  );
}
