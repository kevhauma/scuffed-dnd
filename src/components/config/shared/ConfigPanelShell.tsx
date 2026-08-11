/**
 * Configuration Panel Shell
 *
 * The frame every configuration section shares: the no-ruleset notice, the header card carrying a
 * title, a description and the section's add controls, the amber notes saying what has to exist
 * elsewhere first, and the blocked-delete dialog every panel mounts.
 *
 * It was written out longhand in eight panels while `BaseSkillPanel` did the same job for two more
 * — and the two had already drifted apart (h3 against h4, `gap-6` against `space-y-6`), which is
 * the visual consistency Requirement 21.7 asks for going quietly wrong. One frame, eleven callers
 * (TICKET-DX-05).
 *
 * **This is a feature component, not a base one.** It composes `Card` / `Text` from
 * `components/ui` and owns every layout class here; no primitive gained a margin or a heading size
 * for it (Requirements 21.3, 21.5).
 *
 * What it deliberately does *not* own: the list, the cards, the form dialogs, and anything a
 * single section needs — those arrive as `children`, `actions` or `headerExtra`. A shell with a
 * boolean per panel would hide the differences rather than share the frame.
 *
 * **Validates: Requirements 21.4, 21.5, 21.7**
 */

import type { ReactNode } from 'react';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { BlockedDeleteDialog } from './BlockedDeleteDialog';
import type { BlockedDelete } from './useGuardedDelete';

/**
 * Why a configuration section cannot be drawn
 *
 * Kept apart from the shell rather than folded into it as a flag, because a panel has to return
 * *before* building its children: `children` is evaluated at the call site, so a panel that reads
 * `config.materials` would still throw. The early return is also what narrows `config` for
 * TypeScript inside the panel.
 */
export function NoConfigurationNotice() {
  return (
    <Card className="p-6">
      <Text variant="body-secondary">
        No configuration loaded. Please initialize a configuration first.
      </Text>
    </Card>
  );
}

export interface ConfigPanelShellProps {
  /** The section's name — rendered as the page's `h2` */
  title: string;
  /** One line on what this section is for, beneath the title */
  description: ReactNode;
  /**
   * The section's own add controls, opposite the title.
   *
   * A `ReactNode` rather than a label/handler pair because Items offers two buttons, and one slot
   * that expresses both beats two props that express one each.
   */
  actions?: ReactNode;
  /**
   * What has to exist elsewhere before this section is usable — one amber note each.
   *
   * Strings rather than nodes: the box around them was itself copied seven times, so the shell
   * owns the box and the caller owns only the sentence.
   */
  prerequisites?: string[];
  /** Section-specific content inside the header card, below the title row */
  headerExtra?: ReactNode;
  /** A delete the store refused, or null (TICKET-REF-02) */
  blocked?: BlockedDelete | null;
  onCloseBlocked?: () => void;
  children?: ReactNode;
}

export function ConfigPanelShell({
  title,
  description,
  actions,
  prerequisites,
  headerExtra,
  blocked = null,
  onCloseBlocked,
  children,
}: ConfigPanelShellProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Text variant="h4" as="h2" className="mb-2">
              {title}
            </Text>
            <Text variant="body-secondary">{description}</Text>
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>

        {prerequisites?.map((prerequisite) => (
          <div
            key={prerequisite}
            className="mt-4 p-4 bg-amber/10 border border-amber rounded"
            role="note"
          >
            <Text variant="body-small" className="text-ink-700">
              {prerequisite}
            </Text>
          </div>
        ))}

        {headerExtra}
      </Card>

      {children}

      {onCloseBlocked && <BlockedDeleteDialog blocked={blocked} onClose={onCloseBlocked} />}
    </div>
  );
}
