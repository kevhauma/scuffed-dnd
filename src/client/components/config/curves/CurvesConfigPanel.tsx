/**
 * Curves Configuration Panel
 *
 * The named lookup tables a ruleset's progressions are made of (Concept 06) — point-buy, XP
 * thresholds, challenge rating. A progression is *data* here: a table you read and tune, rather
 * than a chain of nested conditionals buried in a formula string.
 *
 * Layout and composition only; the decisions live in `useCurveManager`.
 *
 * **Validates: Concept 06; Concept 00 §1.1, §6**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { CurveCard } from './CurveCard';
import { CurveColumnDialog } from './CurveColumnDialog';
import { CurveFormDialog } from './CurveFormDialog';
import { useCurveManager } from './useCurveManager';

export function CurvesConfigPanel() {
  const {
    config,
    curves,
    usages,
    reports,
    generatorVariables,
    curveForm,
    columnForm,
    editingCurveId,
    isCurveDialogOpen,
    closeCurveDialog,
    columnTarget,
    closeColumnDialog,
    handleAddCurve,
    handleEditCurve,
    handleDeleteCurve,
    handleSaveCurve,
    handleAddColumn,
    handleEditColumn,
    handleSaveColumn,
    handleDeleteColumn,
    handleAddRow,
    handleDeleteRow,
    handleCellChange,
    handleClearOverride,
    handleRegenerate,
    handleSettingChange,
    blocked,
    dismissBlocked,
  } = useCurveManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Curves"
      description="Progressions as tables you can read and tune, rather than formulas nobody can check"
      actions={
        <Button variant="primary" onClick={handleAddCurve}>
          Add Curve
        </Button>
      }
      headerExtra={
        <div className="mt-4 p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            <strong>Tip:</strong> A formula reads a curve as{' '}
            <span className="font-mono">curve.point_buy.main(9)</span>. A column with a generator
            fills itself in; a cell you type into is kept as an override, highlighted, and never
            overwritten by regenerating.
          </Text>
        </div>
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {curves.length === 0 ? (
        <ConfigEmptyState message="No curves configured yet. Click 'Add Curve' to create your first one." />
      ) : (
        <ul className="space-y-4">
          {curves.map((curve) => (
            <li key={curve.id}>
              <CurveCard
                curve={curve}
                usages={usages.get(curve.id) ?? []}
                report={reports[curve.id]}
                onEdit={handleEditCurve}
                onDelete={handleDeleteCurve}
                onRegenerate={handleRegenerate}
                onSettingChange={handleSettingChange}
                onAddColumn={handleAddColumn}
                onEditColumn={handleEditColumn}
                onDeleteColumn={handleDeleteColumn}
                onAddRow={handleAddRow}
                onDeleteRow={handleDeleteRow}
                onCellChange={handleCellChange}
                onClearOverride={handleClearOverride}
              />
            </li>
          ))}
        </ul>
      )}

      <CurveFormDialog
        isOpen={isCurveDialogOpen}
        isEditing={!!editingCurveId}
        form={curveForm}
        onClose={closeCurveDialog}
        onSave={handleSaveCurve}
      />
      <CurveColumnDialog
        isOpen={columnTarget !== null}
        isEditing={!!columnTarget?.columnId}
        form={columnForm}
        generatorVariables={generatorVariables}
        config={config}
        onClose={closeColumnDialog}
        onSave={handleSaveColumn}
      />
    </ConfigPanelShell>
  );
}
