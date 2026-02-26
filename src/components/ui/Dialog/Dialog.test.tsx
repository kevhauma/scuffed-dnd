import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    render(
      <Dialog open={true} onClose={onClose} title="Test Dialog">
        Content
      </Dialog>
    );
    const overlay = screen.getByText('Test Dialog').parentElement?.parentElement;
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
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
});
