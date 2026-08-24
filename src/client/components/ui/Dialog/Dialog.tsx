/**
 * Dialog Component
 *
 * Base modal: owns its own placement, closes on Escape, the backdrop, or its close button, and
 * keeps keyboard focus inside itself while it is open.
 *
 * The focus work is CR-13, and it lands here rather than in each dialog for the reason every base
 * component exists: `aria-modal="true"` is a *claim* that the rest of the page is inert, and the
 * browser does not enforce it. Without a trap, Tab walked straight out of the panel into the
 * obscured page behind it — every `*FormDialog` in the app inherited that, and one fix here fixes
 * all of them.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6; WAI-ARIA dialog pattern**
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Ornament } from '../Ornament/Ornament';
import {
  bodyStyles,
  closeButtonStyles,
  dialogStyles,
  headerStyles,
  overlayStyles,
  rivetStyles,
  titleStyles,
} from './Dialog.style';

/** Where the four studs sit on the header board */
const RIVET_POSITIONS = ['left-2 top-2', 'right-2 top-2', 'left-2 bottom-2', 'right-2 bottom-2'];

/**
 * What Tab can reach
 *
 * Deliberately not filtered by visibility: an element that is in the panel's markup but not on
 * screen is a case no dialog here has, and a `getComputedStyle` pass per keystroke to handle it
 * would cost more than it is worth.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Where Tab should put focus to keep it inside the panel, or `null` to let the browser have it
 *
 * Returning the destination rather than moving focus keeps the decision testable on its own and
 * the handler down to "if there is a destination, take it".
 *
 * @param panel - The dialog's panel
 * @param shiftKey - Whether the Tab was backwards
 * @returns The element to focus, or `null` when the browser's own next stop is already inside
 */
function tabDestination(panel: HTMLElement, shiftKey: boolean): HTMLElement | null {
  const focusable = focusableWithin(panel);
  const active = document.activeElement;

  // Nothing to move to, so moving anywhere means leaving — which is the thing being stopped. The
  // panel itself holds focus (it is `tabIndex={-1}`), so Tab has nowhere to go.
  if (focusable.length === 0) return panel;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  // Focus is outside the panel — from a click on the backdrop, say — so Tab re-enters rather than
  // continuing through the obscured page
  if (!panel.contains(active)) return shiftKey ? last : first;

  if (shiftKey && active === first) return last;
  if (!shiftKey && active === last) return first;

  return null;
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className = '' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** Where focus was when the dialog opened, so closing puts the User back where they were */
  const openerRef = useRef<Element | null>(null);

  // Move focus in on open, and put it back on close (CR-13). The first control in the *body* takes
  // it rather than the header's close button — a form dialog's first field is what the User came
  // for — and the panel itself takes it when the body has nothing focusable, so a screen reader
  // still announces the dialog rather than leaving focus on the page behind.
  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;
    (focusableWithin(bodyRef.current)[0] ?? panelRef.current)?.focus();

    return () => {
      const opener = openerRef.current;
      // Only if it is still on the page: a dialog opened from a row that the save then removed has
      // nowhere to go back to, and focusing a detached node silently drops focus onto `<body>`
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open]);

  // Escape closes; Tab cycles within the panel
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const destination = tabDestination(panel, event.shiftKey);
      if (!destination) return;

      event.preventDefault();
      destination.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const combinedDialogClassName = [
    dialogStyles,
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // The backdrop is decoration: clicking it is a shortcut, never the only way out — Escape is
    // handled above and the header carries a real close button. Comparing target to currentTarget
    // means only the backdrop itself dismisses, so the dialog needs no click handler of its own
    // just to stop propagation.
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismissal duplicates Escape and the close button
    <div
      className={overlayStyles}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* `tabIndex={-1}` so the panel can hold focus itself when it has no focusable content —
          programmatically focusable, never a Tab stop of its own */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={combinedDialogClassName}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={headerStyles}>
          {RIVET_POSITIONS.map((position) => (
            <Ornament key={position} variant="rivet" className={`${rivetStyles} ${position}`} />
          ))}
          <h2 className={titleStyles}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={closeButtonStyles}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        <div ref={bodyRef} className={bodyStyles}>
          {children}
        </div>
      </div>
    </div>
  );
}
