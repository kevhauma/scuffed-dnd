/**
 * What a `client/` → `server/` violation points at (TICKET-DX-07)
 *
 * Stands in for the thing that makes this the one boundary whose failure leaks rather than
 * untidies: a signing key, a database handle, a provider secret.
 */

export const SERVER_VALUE = 'something that must never reach a browser';
