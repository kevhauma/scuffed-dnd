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
  const { storageAvailable, storageError } = useAppHydration();

  return (
    <AppShell>
      {storageAvailable ? (
        <>
          {storageError && <StorageNotice message={storageError} />}
          <Outlet />
        </>
      ) : (
        <StorageNotice message={storageError ?? ''} />
      )}
    </AppShell>
  );
}
