/**
 * Base Skill Panel Component
 *
 * Generic panel component that can be reused for all skill types.
 * Accepts render props for customization.
 *
 * The form dialog's open state is **not** a prop here: `renderFormDialog()` is the caller's own
 * closure, so it already has it. Two props that carried it were accepted and silently dropped
 * until TICKET-DX-02 removed them.
 *
 * **Validates: Requirements 2.1, 4.1, 5.1, 21.1-21.5**
 */

import type { ReactNode } from 'react';
import { Button } from '../../../ui/Button/Button';
import { Card } from '../../../ui/Card/Card';
import { Text } from '../../../ui/Text/Text';
import { BlockedDeleteDialog } from '../../shared/BlockedDeleteDialog';
import type { BlockedDelete } from '../../shared/useGuardedDelete';

interface BaseSkillPanelProps<T> {
  title: string;
  description: string;
  addButtonText: string;
  emptyMessage: string;
  skills: T[];
  /** A delete the store refused, or null — TICKET-REF-02 */
  blocked: BlockedDelete | null;
  onAdd: () => void;
  onCloseBlocked: () => void;
  renderSkillCard: (skill: T) => ReactNode;
  renderFormDialog: () => ReactNode;
}

export function BaseSkillPanel<T extends { code: string }>({
  title,
  description,
  addButtonText,
  emptyMessage,
  skills,
  blocked,
  onAdd,
  onCloseBlocked,
  renderSkillCard,
  renderFormDialog,
}: BaseSkillPanelProps<T>) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <Text variant="h3" as="h2" className="mb-2">
              {title}
            </Text>
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
            <div key={skill.code}>{renderSkillCard(skill)}</div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      {renderFormDialog()}

      {/* Refused-delete dialog (TICKET-REF-02) */}
      <BlockedDeleteDialog blocked={blocked} onClose={onCloseBlocked} />
    </div>
  );
}
