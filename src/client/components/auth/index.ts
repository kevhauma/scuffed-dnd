/**
 * Signing in (TICKET-AUTH-01)
 *
 * The three surfaces v3 Req 30.8 asks for — sign-up, sign-in and sign-out — plus the hook that
 * says who is signed in, and (TICKET-AUTH-02) the provider buttons and the linked-identities view.
 * **Signing in is required to play at a table with other people, and for nothing else**
 * ([D6](../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)):
 * nothing in this folder gates a local-mode route, and the app works with none of it touched.
 */

export * from './AccountBadge';
export * from './AuthAlert';
export * from './AuthForm';
export * from './LinkedIdentities';
export * from './protectedRoutes';
export * from './providerLabel';
export * from './RequireAccount';
export * from './SocialSignInButtons';
export * from './signInDestination';
export * from './useAuth';
export * from './useAuthForm';
export * from './useLinkedIdentities';
export * from './useSocialProviders';
