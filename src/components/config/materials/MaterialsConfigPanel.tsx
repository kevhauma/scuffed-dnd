/**
 * Materials Configuration Panel
 * 
 * Manages material categories, materials, and material levels with bonuses and values.
 */

import { useMaterialManager } from './useMaterialManager';
import { MaterialCategoryCard } from './MaterialCategoryCard';
import { MaterialCategoryFormDialog } from './MaterialCategoryFormDialog';
import { MaterialFormDialog } from './MaterialFormDialog';
import { MaterialLevelFormDialog } from './MaterialLevelFormDialog';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

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
  } = useMaterialManager();

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
      {/* Header */}
      <Card className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Text variant="h4" as="h2" className="mb-2">Materials</Text>
            <Text variant="body-secondary">
              Define materials with categories, levels, bonuses, and values
            </Text>
          </div>
          <Button variant="primary" onClick={handleAddCategory}>
            Add Category
          </Button>
        </div>

        {availableSkillCodes.length === 0 && (
          <div className="mt-4 p-4 bg-amber/10 border border-amber rounded">
            <Text variant="body-small" className="text-ink-700">
              No skills configured yet. Add skills first to use them in material bonuses.
            </Text>
          </div>
        )}

        {currencyTiers.length === 0 && (
          <div className="mt-4 p-4 bg-amber/10 border border-amber rounded">
            <Text variant="body-small" className="text-ink-700">
              No currency tiers configured yet. Add currency tiers first to set material values.
            </Text>
          </div>
        )}
      </Card>

      {/* Categories List */}
      {categories.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            No material categories configured yet. Click 'Add Category' to create your first category.
          </Text>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <MaterialCategoryCard
              key={category.id}
              category={category}
              materials={config.materials.filter(m => m.categoryId === category.id)}
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

      {/* Category Form Dialog */}
      <MaterialCategoryFormDialog
        isOpen={isCategoryDialogOpen}
        isEditing={!!editingCategoryId}
        form={categoryForm}
        onClose={() => setIsCategoryDialogOpen(false)}
        onSave={handleSaveCategory}
      />

      {/* Material Form Dialog */}
      <MaterialFormDialog
        isOpen={isMaterialDialogOpen}
        isEditing={!!editingMaterialId}
        form={materialForm}
        onClose={() => setIsMaterialDialogOpen(false)}
        onSave={handleSaveMaterial}
      />

      {/* Material Level Form Dialog */}
      <MaterialLevelFormDialog
        isOpen={isLevelDialogOpen}
        isEditing={editingMaterialLevelIndex !== null}
        form={levelForm}
        availableSkillCodes={availableSkillCodes}
        currencyTiers={currencyTiers}
        onClose={() => setIsLevelDialogOpen(false)}
        onSave={handleSaveLevel}
      />
    </div>
  );
}
