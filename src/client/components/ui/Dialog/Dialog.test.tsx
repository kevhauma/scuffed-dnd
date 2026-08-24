import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('does not render when open is false', () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Test Dialog">
        Content
      </Dialog>
    );
    expect(screen.queryByText('Test Dialog')).toBeNull();
  });

  it('renders when open is true', () => {
    render(
      <Dialog open={true} onClose={() => {}} title="Test Dialog">
        Content
      </Dialog>
    );
    expect(screen.getByText('Test Dialog')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="Test Dialog">
        Content
      </Dialog>
    );
    const closeButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    // The overlay is the outermost element Dialog renders; the dialog box inside it
    // stops propagation, so the click has to land on the overlay itself.
    const { container } = render(
      <Dialog open={true} onClose={onClose} title="Test Dialog">
        Content
      </Dialog>
    );
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when dialog content is clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="Test Dialog">
        Content
      </Dialog>
    );
    const content = screen.getByText('Content');
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('accepts className prop for positioning', () => {
    render(
      <Dialog open={true} onClose={() => {}} title="Test Dialog" className="custom-class">
        Content
      </Dialog>
    );
    const dialog = screen.getByText('Test Dialog').parentElement?.parentElement;
    expect(dialog?.className).toContain('custom-class');
  });

  /**
   * Focus management (CR-13)
   *
   * `aria-modal="true"` is a claim the browser does not enforce, so without these the Tab order
   * ran straight through the obscured page behind the overlay. Asserted on the primitive because
   * every `*FormDialog` in the app inherits whatever it does.
   */
  describe('focus management', () => {
    /** A dialog with three stops, so first, middle and last are distinguishable */
    const ThreeFields = ({ onClose = () => {} }: { onClose?: () => void }) => (
      <Dialog open={true} onClose={onClose} title="Test Dialog">
        <input aria-label="First" />
        <input aria-label="Second" />
        <button type="button">Save</button>
      </Dialog>
    );

    it('moves focus to the first control in the body, not the close button', () => {
      render(<ThreeFields />);

      expect(document.activeElement).toBe(screen.getByLabelText('First'));
    });

    it('focuses the panel itself when the body has nothing to focus', () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test Dialog">
          Content
        </Dialog>
      );

      expect(document.activeElement).toBe(screen.getByRole('dialog'));
    });

    it('wraps Tab from the last control back to the first', () => {
      render(<ThreeFields />);

      screen.getByRole('button', { name: 'Save' }).focus();
      fireEvent.keyDown(document, { key: 'Tab' });

      // The close button is the first stop in the panel — the header comes before the body
      expect(document.activeElement).toBe(screen.getByLabelText('Close dialog'));
    });

    it('wraps Shift+Tab from the first control back to the last', () => {
      render(<ThreeFields />);

      screen.getByLabelText('Close dialog').focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }));
    });

    it('pulls focus back in when Tab is pressed from outside the panel', () => {
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      render(<ThreeFields />);
      outside.focus();
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(document.activeElement).toBe(screen.getByLabelText('Close dialog'));
      outside.remove();
    });

    it('returns focus to whatever opened it', () => {
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();

      const { rerender } = render(<ThreeFields />);
      expect(document.activeElement).toBe(screen.getByLabelText('First'));

      rerender(
        <Dialog open={false} onClose={() => {}} title="Test Dialog">
          <input aria-label="First" />
        </Dialog>
      );

      expect(document.activeElement).toBe(opener);
      opener.remove();
    });
  });
});
