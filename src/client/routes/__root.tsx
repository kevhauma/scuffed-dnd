/**
 * Root Layout
 *
 * The app shell and the only hydration point: restores both persisted stores once per page load.
 *
 * **Validates: Requirements 19.1, 19.2, 19.3, 19.6, 17.3, 17.4, 22.1-22.6**
 */

import { TanStackDevtools } from '@tanstack/react-devtools';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import { AppShell } from '../components/shared/AppShell';
import { IncompatibleDataNotice } from '../components/shared/IncompatibleDataNotice';
import { SaveConflictBanner } from '../components/shared/SaveConflictBanner';
import { StorageFailureBanner } from '../components/shared/StorageFailureBanner';
import { StorageNotice } from '../components/shared/StorageNotice';
import { useAppHydration } from '../components/shared/useAppHydration';

import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Custom DnD Builder',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

export function RootLayout() {
  // The single hydration point for the whole app — every route renders inside this layout
  const { storageAvailable, storageError, incompatibleData } = useAppHydration();

  if (!storageAvailable) {
    return (
      <AppShell>
        <StorageNotice message={storageError ?? ''} />
      </AppShell>
    );
  }

  // Instead of the routes, not alongside them: no route can render — and so no route can save a
  // fresh ruleset — while data the User has not decided about is still in LocalStorage
  if (incompatibleData) {
    return (
      <AppShell>
        <IncompatibleDataNotice
          message={incompatibleData.message}
          onBackup={incompatibleData.downloadBackup}
          onStartFresh={incompatibleData.startFresh}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {storageError && <StorageNotice message={storageError} />}
      {/* Above the routes rather than instead of them (CR-11): a refused *write* leaves everything
          readable and exportable, so the app stays usable while the banner says what stopped */}
      <StorageFailureBanner />
      {/* Its server-side counterpart (TICKET-RUL-02). Beside rather than merged, because the two
          say opposite things about where the User's edit now is — see the banner's own header */}
      <SaveConflictBanner />
      <Outlet />
    </AppShell>
  );
}
