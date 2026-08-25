/**
 * Identity (TICKET-AUTH-01)
 *
 * This root answers *who is this* and nothing else. **Authorization — who may touch which ruleset,
 * session and character — is v3 Req 32 and belongs to TICKET-AUTH-03**, which builds its guards on
 * top of what `currentAccount.ts` resolves. The split is deliberate: a library decides identity, and
 * no library decides access.
 */

export * from './account';
export * from './authRoutes';
export * from './authServer';
export * from './currentAccount';
export * from './paths';
export * from './signInRateLimit';
