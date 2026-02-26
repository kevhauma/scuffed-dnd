import React, { useEffect } from 'react';
import { overlayStyles, dialogStyles, headerStyles, titleStyles, closeButtonStyles, bodyStyles } from './Dialog.style';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className = '',
}: DialogProps) {
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
    <div className={overlayStyles} onClick={onClose}>
      <div className={combinedDialogClassName} onClick={(e) => e.stopPropagation()}>
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
        <div className={bodyStyles}>
          {children}
        </div>
      </div>
    </div>
  );
}
