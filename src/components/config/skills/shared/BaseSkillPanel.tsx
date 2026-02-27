/**
 * Base Skill Panel Component
 * 
 * Generic panel component that can be reused for all skill types.
 * Accepts render props for customization.
 */

import type { ReactNode } from 'react';
import { Button } from '../../../ui/Button/Button';
import { Card } from '../../../ui/Card/Card';
import { Dialog } from '../../../ui/Dialog/Dialog';
import { Text } from '../../../ui/Text/Text';

interface BaseSkillPanelProps<T> {
  title: string;
  description: string;
  addButtonText: string;
  emptyMessage: string;
  skills: T[];
  isDialogOpen: boolean;
  deleteWarning: string | null;
  onAdd: () => void;
  onCloseDialog: () => void;
  onCloseWarning: () => void;
  renderSkillCard: (skill: T) => ReactNode;
  renderFormDialog: () => ReactNode;
}

export function BaseSkillPanel<T extends { code: string }>({
  title,
  description,
  addButtonText,
  emptyMessage,
  skills,
  isDialogOpen,
  deleteWarning,
  onAdd,
  onCloseDialog,
  onCloseWarning,
  renderSkillCard,
  renderFormDialog,
}: BaseSkillPanelProps<T>) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <Text variant="h3" as="h2" className="mb-2">{title}</Text>
            <Text variant="body-secondary">{description}</Text>
          </div>
          <Button variant="primary" onClick={onAdd}>
            {addButtonText}
          </Button>
        </div>
      </Card>

      {/* Skills List */}
      {skills.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            {emptyMessage}
          </Text>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <div key={skill.code}>
              {renderSkillCard(skill)}
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      {renderFormDialog()}

      {/* Delete Warning Dialog */}
      <Dialog
        open={!!deleteWarning}
        onClose={onCloseWarning}
        title="Cannot Delete Skill"
      >
        <div className="space-y-4">
          <Text variant="body" className="whitespace-pre-line">{deleteWarning}</Text>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onCloseWarning}>
              OK
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
