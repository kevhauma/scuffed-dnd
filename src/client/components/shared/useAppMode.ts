/**
 * App Mode Hook
 *
 * Keeps `useUIStore.mode` and the current route in agreement, and enforces the play-mode
 * configuration lock: while the app is in play mode, a `/config/*` route redirects to `/play`.
 *
 * See TICKET-NAV-01 for why the lock is a redirect rather than a read-only configuration UI.
 *
 * **Validates: Requirements 19.3, 19.4, 19.5, 19.6**
 */

import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { AppMode } from '../../stores/uiStore';
import { useUIStore } from '../../stores/uiStore';

/**
 * Which mode a path belongs to, or null for paths that belong to neither (the landing page)
 */
export function modeForPath(pathname: string): AppMode | null {
  if (pathname === '/play' || pathname.startsWith('/play/')) return 'play';
  if (pathname === '/config' || pathname.startsWith('/config/')) return 'config';
  // `/rulesets` is configuration mode's entry point since TICKET-RUL-01, so it belongs to that
  // mode — including under Requirement 19.6's lock. Picking which ruleset to edit is *reaching*
  // configuration, and leaving it outside the lock would be a door beside a locked door.
  if (pathname === '/rulesets' || pathname.startsWith('/rulesets/')) return 'config';
  return null;
}

export function useAppMode() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const mode = useUIStore((state) => state.mode);
  const setMode = useUIStore((state) => state.setMode);

  const routeMode = modeForPath(pathname);

  // While in play mode, configuration is out of reach — hiding the links alone would not
  // "prevent" modification when the URLs still work (Requirement 19.6).
  const isLockedOut = mode === 'play' && routeMode === 'config';

  useEffect(() => {
    if (isLockedOut) {
      navigate({ to: '/play', replace: true });
      return;
    }

    // Otherwise the route decides the mode, so the two can never disagree
    if (routeMode !== null && routeMode !== mode) {
      setMode(routeMode);
    }
  }, [isLockedOut, routeMode, mode, navigate, setMode]);

  const switchMode = (next: AppMode) => {
    setMode(next);
    navigate({ to: next === 'play' ? '/play' : '/config' });
  };

  return { mode, isLockedOut, switchMode };
}
