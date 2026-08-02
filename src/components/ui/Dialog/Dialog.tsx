import type React from 'react';
import { useEffect } from 'react';
import {
  bodyStyles,
  closeButtonStyles,
  dialogStyles,
  headerStyles,
  overlayStyles,
  titleStyles,
} from './Dialog.style';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className = '' }: DialogProps) {
  // Handle escape key to close dialog
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
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
      <div className={combinedDialogClassName} role="dialog" aria-modal="true" aria-label={title}>
        <div className={headerStyles}>
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
        <div className={bodyStyles}>{children}</div>
      </div>
    </div>
  );
}
