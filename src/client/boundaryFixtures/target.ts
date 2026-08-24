/**
 * What a `server/` → `client/` violation points at (TICKET-DX-07)
 *
 * Stands in for the whole browser half of the tree: a store, a component, `localStorage`. The
 * server has none of it.
 */

export const CLIENT_VALUE = 'something only a browser has';
