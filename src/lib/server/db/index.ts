import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { TURSO_URL, TURSO_AUTH_TOKEN } from '$env/static/private';

const client = createClient({
	url: TURSO_URL || 'file:placeholder.db',
	authToken: TURSO_AUTH_TOKEN || ''
});

export const db = drizzle(client, { schema });
