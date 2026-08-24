/**
 * Storage Notice Tests
 *
 * **Validates: Requirements 17.5**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorageNotice } from './StorageNotice';

describe('StorageNotice', () => {
  it('should show the heading and the message it is given', () => {
    render(<StorageNotice message="Browser storage is unavailable." />);

    expect(screen.getByText('Storage Unavailable')).toBeDefined();
    expect(screen.getByText('Browser storage is unavailable.')).toBeDefined();
  });

  it('should accept layout classes from its caller', () => {
    const { container } = render(<StorageNotice message="Nope." className="mt-8" />);

    expect(container.firstElementChild?.className).toContain('mt-8');
  });
});
