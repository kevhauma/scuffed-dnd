/**
 * Material Manager Hook
 * 
 * Manages material categories, materials, and levels CRUD operations and form state.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { MaterialCategory, Material, MaterialLevel } from '../../../types';

interface CategoryFormData {
  name: string;
  description: string;
}

interface MaterialFormData {
  name: string;
  description: string;
}

interface LevelFormData {
  level: number;
  name: string;
  bonuses: Array<{ skillCode: string; modifier: number }>;
  tierId: string;
  amount: number;
}

export function useMaterialManager() {
  const config = useConfigStore((state) => state.config);
  const addMaterialCategory = useConfigStore((state) => state.addMaterialCategory);
  const updateMaterialCategory = useConfigStore((state) => state.updateMaterialCategory);
  const deleteMaterialCategory = useConfigStore((state) => state.deleteMaterialCategory);
  const addMaterial = useConfigStore((state) => state.addMaterial);
  const updateMaterial = useConfigStore((state) => state.updateMaterial);
  const deleteMaterial = useConfigStore((state) => state.deleteMaterial);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [isLevelDialogOpen, setIsLevelDialogOpen] = useState(false);
  
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingMaterialLevelIndex, setEditingMaterialLevelIndex] = useState<number | null>(null);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);

  const categoryForm = useForm<CategoryFormData>({
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const materialForm = useForm<MaterialFormData>({
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const levelForm = useForm<LevelFormData>({
    defaultValues: {
      level: 1,
      name: '',
      bonuses: [],
      tierId: '',
      amount: 0,
    },
  });

  const categories = config?.materialCategories || [];
  const availableSkillCodes = [
    ...(config?.mainSkills.map(s => s.code) || []),
    ...(config?.specialitySkills.map(s => s.code) || []),
    ...(config?.combatSkills.map(s => s.code) || []),
  ];
  const currencyTiers = config?.currencyTiers || [];

  // Category handlers
  const handleAddCategory = () => {
    setEditingCategoryId(null);
    categoryForm.reset({
      name: '',
      description: '',
    });
    setIsCategoryDialogOpen(true);
  };

  const handleEditCategory = (id: string) => {
    const category = categories.find(c => c.id === id);
    if (!category) return;
    
    setEditingCategoryId(id);
    categoryForm.reset({
      name: category.name,
      description: category.description,
    });
    setIsCategoryDialogOpen(true);
  };

  const handleDeleteCategory = (id: string) => {
    // Check if category has materials
    const hasMaterials = config?.materials.some(m => m.categoryId === id);
    if (hasMaterials) {
      alert('Cannot delete category with materials. Delete materials first.');
      return;
    }
    deleteMaterialCategory(id);
  };

  const handleSaveCategory = categoryForm.handleSubmit((data) => {
    const category: MaterialCategory = {
      id: editingCategoryId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
    };
    
    if (editingCategoryId) {
      updateMaterialCategory(editingCategoryId, category);
    } else {
      addMaterialCategory(category);
    }
    
    setIsCategoryDialogOpen(false);
  });

  // Material handlers
  const handleAddMaterial = (categoryId: string) => {
    setCurrentCategoryId(categoryId);
    setEditingMaterialId(null);
    materialForm.reset({
      name: '',
      description: '',
    });
    setIsMaterialDialogOpen(true);
  };

  const handleEditMaterial = (id: string) => {
    const material = config?.materials.find(m => m.id === id);
    if (!material) return;
    
    setCurrentCategoryId(material.categoryId);
    setEditingMaterialId(id);
    materialForm.reset({
      name: material.name,
      description: material.description,
    });
    setIsMaterialDialogOpen(true);
  };

  const handleDeleteMaterial = (id: string) => {
    // Check if material is used by items
    const isUsed = config?.items.some(item => item.materialId === id);
    if (isUsed) {
      alert('Cannot delete material used by items. Remove from items first.');
      return;
    }
    deleteMaterial(id);
  };

  const handleSaveMaterial = materialForm.handleSubmit((data) => {
    if (!currentCategoryId) return;
    
    const material: Material = {
      id: editingMaterialId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      categoryId: currentCategoryId,
      levels: editingMaterialId 
        ? (config?.materials.find(m => m.id === editingMaterialId)?.levels || [])
        : [],
    };
    
    if (editingMaterialId) {
      updateMaterial(editingMaterialId, material);
    } else {
      addMaterial(material);
    }
    
    setIsMaterialDialogOpen(false);
  });

  // Material Level handlers
  const handleAddLevel = (materialId: string) => {
    setCurrentMaterialId(materialId);
    setEditingMaterialLevelIndex(null);
    
    const material = config?.materials.find(m => m.id === materialId);
    const nextLevel = material ? material.levels.length + 1 : 1;
    
    levelForm.reset({
      level: nextLevel,
      name: '',
      bonuses: [],
      tierId: currencyTiers[0]?.id || '',
      amount: 0,
    });
    setIsLevelDialogOpen(true);
  };

  const handleEditLevel = (materialId: string, levelIndex: number) => {
    const material = config?.materials.find(m => m.id === materialId);
    if (!material || !material.levels[levelIndex]) return;
    
    setCurrentMaterialId(materialId);
    setEditingMaterialLevelIndex(levelIndex);
    
    const level = material.levels[levelIndex];
    levelForm.reset({
      level: level.level,
      name: level.name,
      bonuses: level.bonuses,
      tierId: level.value.tierId,
      amount: level.value.amount,
    });
    setIsLevelDialogOpen(true);
  };

  const handleDeleteLevel = (materialId: string, levelIndex: number) => {
    const material = config?.materials.find(m => m.id === materialId);
    if (!material) return;
    
    const updatedLevels = material.levels.filter((_, idx) => idx !== levelIndex);
    updateMaterial(materialId, { levels: updatedLevels });
  };

  const handleSaveLevel = levelForm.handleSubmit((data) => {
    if (!currentMaterialId) return;
    
    const material = config?.materials.find(m => m.id === currentMaterialId);
    if (!material) return;
    
    const newLevel: MaterialLevel = {
      level: data.level,
      name: data.name,
      bonuses: data.bonuses,
      value: {
        tierId: data.tierId,
        amount: data.amount,
      },
    };
    
    let updatedLevels: MaterialLevel[];
    if (editingMaterialLevelIndex !== null) {
      updatedLevels = material.levels.map((level, idx) =>
        idx === editingMaterialLevelIndex ? newLevel : level
      );
    } else {
      updatedLevels = [...material.levels, newLevel];
    }
    
    updateMaterial(currentMaterialId, { levels: updatedLevels });
    setIsLevelDialogOpen(false);
  });

  return {
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
  };
}
