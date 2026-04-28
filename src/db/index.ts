import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  throw new Error(
    'DB config: set TURSO_DATABASE_URL (or DATABASE_URL) — the app cannot boot without a database URL.',
  );
}

// Local file databases (libsql `file:` scheme) don't need an auth token; remote Turso always does.
const isRemote = url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('wss://');
if (process.env.NODE_ENV === 'production' && isRemote && !authToken) {
  throw new Error(
    'DB config: TURSO_AUTH_TOKEN (or DATABASE_AUTH_TOKEN) is required in production for remote Turso databases.',
  );
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
