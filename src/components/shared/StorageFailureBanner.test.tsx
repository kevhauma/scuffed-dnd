/**
 * Storage Failure Banner Tests
 *
 * The visible half of CR-11: a write LocalStorage refused used to be an exception nobody caught
 * and a User told nothing. What is asserted here is that the banner appears only when there is a
 * failure to report, says which kind it was, and can be put away.
 *
 * **Validates: Requirements 17.1, 17.2**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '../../stores/uiStore';
import { StorageFailureBanner } from './StorageFailureBanner';

/** What `storage.ts` throws when `setItem` reports the quota, recognised by `name` */
const quotaError = () => Object.assign(new Error('quota exceeded'), { name: 'StorageQuotaError' });

describe('StorageFailureBanner', () => {
  beforeEach(() => {
    useUIStore.setState({ storageFailure: null });
  });

  it('should render nothing while every write is landing', () => {
    const { container } = render(<StorageFailureBanner />);

    expect(container.firstChild).toBeNull();
  });

  it('should name a full store and tell the User to export', () => {
    useUIStore.getState().reportStorageFailure(quotaError());

    render(<StorageFailureBanner />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Browser Storage Is Full')).toBeDefined();
    expect(screen.getByText(/Export your ruleset/)).toBeDefined();
  });

  it('should say the change was not applied, since the store refuses rather than half-writes', () => {
    useUIStore.getState().reportStorageFailure(new Error('something else went wrong'));

    render(<StorageFailureBanner />);

    expect(screen.getByText('Changes Are Not Being Saved')).toBeDefined();
    expect(screen.getByText(/still matches what is stored/)).toBeDefined();
  });

  it('should go away when dismissed', () => {
    useUIStore.getState().reportStorageFailure(quotaError());

    const { container } = render(<StorageFailureBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(container.firstChild).toBeNull();
    expect(useUIStore.getState().storageFailure).toBeNull();
  });
});
