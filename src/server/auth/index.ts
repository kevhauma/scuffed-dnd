/**
 * Identity (TICKET-AUTH-01)
 *
 * This root answers two questions and keeps them apart. **Identity** — *who is this* — is Better
 * Auth's, resolved once per request by `currentAccount.ts`. **Authorization** — *may they touch this
 * ruleset, session or character* — is v3 Req 32, lives in [`guards.ts`](./guards.ts), and no library
 * decides it. That split is D3's whole reason for choosing a library for the first and writing the
 * second by hand.
 */

export * from './account';
export * from './authRoutes';
export * from './authServer';
export * from './currentAccount';
export * from './guards';
export * from './identityRules';
export * from './paths';
export * from './signInRateLimit';
export * from './socialProviders';
