/**
 * Root Layout Tests
 *
 * The root layout is the app's single hydration point (TICKET-IO-01), so these assert that it
 * calls the hydration hook and that unavailable storage replaces the routed content with one
 * clear message.
 *
 * `useAppHydration` is mocked — it has its own test file, and mocking it keeps this test about
 * the layout's behaviour rather than about storage.
 *
 * **Validates: Requirements 17.3, 17.4, 17.5**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AppHydration } from '../components/shared/useAppHydration';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router'
  );
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
    Outlet: () => <div data-testid="outlet" />,
  };
});

vi.mock('../components/shared/useAppHydration', () => ({
  useAppHydration: vi.fn(),
}));

import { useAppHydration } from '../components/shared/useAppHydration';
import { RootLayout } from './__root';

const hydration = (overrides: Partial<AppHydration> = {}): AppHydration => ({
  storageAvailable: true,
  isHydrated: true,
  storageError: null,
  ...overrides,
});

describe('RootLayout', () => {
  beforeEach(() => {
    vi.mocked(useAppHydration).mockReturnValue(hydration());
  });

  it('should hydrate the app and render the routed content', () => {
    render(<RootLayout />);

    expect(useAppHydration).toHaveBeenCalled();
    expect(screen.getByTestId('outlet')).toBeDefined();
    expect(screen.queryByText('Storage Unavailable')).toBeNull();
  });

  it('should replace the routed content with one message when storage is unavailable', () => {
    vi.mocked(useAppHydration).mockReturnValue(
      hydration({ storageAvailable: false, storageError: 'Browser storage is unavailable.' })
    );

    render(<RootLayout />);

    expect(screen.getByText('Storage Unavailable')).toBeDefined();
    expect(screen.getByText('Browser storage is unavailable.')).toBeDefined();
    expect(screen.queryByTestId('outlet')).toBeNull();
  });

  it('should show a read failure above the routed content when storage still works', () => {
    vi.mocked(useAppHydration).mockReturnValue(
      hydration({ storageError: 'Saved data could not be read: corrupted' })
    );

    render(<RootLayout />);

    expect(screen.getByText(/Saved data could not be read/)).toBeDefined();
    expect(screen.getByTestId('outlet')).toBeDefined();
  });
});
