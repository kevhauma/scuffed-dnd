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
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { BlockedDeleteDialog } from '../shared/BlockedDeleteDialog';
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
    return (
      <Card className="p-6">
        <Text variant="body-secondary">
          No configuration loaded. Please initialize a configuration first.
        </Text>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Text variant="h4" as="h2" className="mb-2">
              Curves
            </Text>
            <Text variant="body-secondary">
              Progressions as tables you can read and tune, rather than formulas nobody can check
            </Text>
          </div>
          <Button variant="primary" onClick={handleAddCurve}>
            Add Curve
          </Button>
        </div>

        <div className="mt-4 p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            <strong>Tip:</strong> A formula reads a curve as{' '}
            <span className="font-mono">curve.point_buy.main(9)</span>. A column with a generator
            fills itself in; a cell you type into is kept as an override, highlighted, and never
            overwritten by regenerating.
          </Text>
        </div>
      </Card>

      {curves.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            No curves configured yet. Click 'Add Curve' to create your first one.
          </Text>
        </Card>
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
      <BlockedDeleteDialog blocked={blocked} onClose={dismissBlocked} />
    </div>
  );
}
