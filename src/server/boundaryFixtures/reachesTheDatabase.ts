/**
 * Violates `queries-belong-to-repositories` (TICKET-DX-08)
 *
 * A server module outside `db/` and `repositories/` holding both halves of a query: the connection
 * and the query builder. This is what makes a schema change unbounded — the columns are named in
 * as many places as someone once found convenient, rather than in one directory.
 */

import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';

export const aQueryOutsideARepository = { eq, getDatabase };
