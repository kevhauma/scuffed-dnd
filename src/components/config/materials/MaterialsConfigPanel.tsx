/**
 * Materials Configuration Panel
 *
 * Manages material categories, materials, and material levels with bonuses and values.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { MaterialCategoryCard } from './MaterialCategoryCard';
import { MaterialCategoryFormDialog } from './MaterialCategoryFormDialog';
import { MaterialFormDialog } from './MaterialFormDialog';
import { MaterialLevelFormDialog } from './MaterialLevelFormDialog';
import { useMaterialManager } from './useMaterialManager';

export function MaterialsConfigPanel() {
  const {
    config,
    categories,
    availableSkillCodes,
    currencyTiers,
    isCategoryDialogOpen,
    setIsCategoryDialogOpen,
    isMaterialDialogOpen,
    setIsMaterialDialogOpen,
    isLevelDialogOpen,
    setIsLevelDialogOpen,
    editingCategoryId,
    editingMaterialId,
    editingMaterialLevelIndex,
    categoryForm,
    materialForm,
    levelForm,
    handleAddCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleSaveCategory,
    handleAddMaterial,
    handleEditMaterial,
    handleDeleteMaterial,
    handleSaveMaterial,
    handleAddLevel,
    handleEditLevel,
    handleDeleteLevel,
    handleSaveLevel,
    blocked,
    dismissBlocked,
  } = useMaterialManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Materials"
      description="Define materials with categories, levels, bonuses, and values"
      actions={
        <Button variant="primary" onClick={handleAddCategory}>
          Add Category
        </Button>
      }
      prerequisites={[
        ...(availableSkillCodes.length === 0
          ? ['No skills configured yet. Add skills first to use them in material bonuses.']
          : []),
        ...(currencyTiers.length === 0
          ? ['No currency tiers configured yet. Add currency tiers first to set material values.']
          : []),
      ]}
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {categories.length === 0 ? (
        <ConfigEmptyState message="No material categories configured yet. Click 'Add Category' to create your first category." />
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <MaterialCategoryCard
              key={category.id}
              category={category}
              materials={config.materials.filter((m) => m.categoryId === category.id)}
              availableSkillCodes={availableSkillCodes}
              currencyTiers={currencyTiers}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
              onAddMaterial={() => handleAddMaterial(category.id)}
              onEditMaterial={handleEditMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              onAddLevel={handleAddLevel}
              onEditLevel={handleEditLevel}
              onDeleteLevel={handleDeleteLevel}
            />
          ))}
        </div>
      )}

      <MaterialCategoryFormDialog
        isOpen={isCategoryDialogOpen}
        isEditing={!!editingCategoryId}
        form={categoryForm}
        onClose={() => setIsCategoryDialogOpen(false)}
        onSave={handleSaveCategory}
      />

      <MaterialFormDialog
        isOpen={isMaterialDialogOpen}
        isEditing={!!editingMaterialId}
        form={materialForm}
        onClose={() => setIsMaterialDialogOpen(false)}
        onSave={handleSaveMaterial}
      />

      <MaterialLevelFormDialog
        isOpen={isLevelDialogOpen}
        isEditing={editingMaterialLevelIndex !== null}
        form={levelForm}
        availableSkillCodes={availableSkillCodes}
        currencyTiers={currencyTiers}
        onClose={() => setIsLevelDialogOpen(false)}
        onSave={handleSaveLevel}
      />
    </ConfigPanelShell>
  );
}
