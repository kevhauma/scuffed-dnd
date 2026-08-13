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
 * Since TICKET-DX-05 the frame comes from `ConfigPanelShell` rather than being written out here —
 * this stays as the *skills* specialisation of it (an id-keyed list rendered into a
 * three-column grid), which is what the two skill panels actually share beyond the frame. Before
 * that, this rendered an `h3` title in a `gap-6` column while the other eight panels rendered an
 * `h4` in a `space-y-6` one; adopting the shell settles that (Requirement 21.7).
 *
 * **Validates: Requirements 2.1, 4.1, 5.1, 21.1-21.5, 21.7**
 */

import type { ReactNode } from 'react';
import { Button } from '../../../ui/Button/Button';
import { ConfigEmptyState } from '../../shared/ConfigEmptyState';
import { ConfigPanelShell } from '../../shared/ConfigPanelShell';
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

export function BaseSkillPanel<T extends { id: string }>({
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
    <ConfigPanelShell
      title={title}
      description={description}
      actions={
        <Button variant="primary" onClick={onAdd}>
          {addButtonText}
        </Button>
      }
      blocked={blocked}
      onCloseBlocked={onCloseBlocked}
    >
      {skills.length === 0 ? (
        <ConfigEmptyState message={emptyMessage} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <div key={skill.id}>{renderSkillCard(skill)}</div>
          ))}
        </div>
      )}

      {renderFormDialog()}
    </ConfigPanelShell>
  );
}
