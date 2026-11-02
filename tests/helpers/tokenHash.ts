// How a plugin token is stored: SHA-256 hex (lib/auth hashPluginToken). Tests seed users and links
// with this, never the plain token — the plain columns are retired (drizzle/0166).
import { createHash } from 'node:crypto';

export function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
