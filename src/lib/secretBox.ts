// Symmetric encryption at rest (AES-256-GCM) for secrets we must store and read back — currently the
// per-clan credentials in `clan_secrets` (Discord bot tokens, webhook URLs), which are bearer
// credentials: anyone holding one can act as that clan.
//
// DESIGN: deliberately free of any `@/` import (no DB, Next, or config) so it stays unit-testable under
// Node's native TS type-stripping (`node --test`) with no bundler. The CALLER supplies the key material
// (an env secret) so this module never resolves config itself.
//
// History: extracted from lib/federationSecurity when federation was removed. Two deliberate changes
// came with the move — the wire prefix is now `enc1:` (nothing federation-specific about it), and
// decryptSecret is STRICT (see below).

import crypto from 'crypto';

const PREFIX = 'enc1:'; // encrypted-secret v1

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

/** Derive a stable 32-byte AES key from arbitrary key material (env secret). */
function deriveKey(keyMaterial: string): Buffer {
  return crypto.createHash('sha256').update(keyMaterial, 'utf8').digest();
}

/** Encrypt a secret for storage. Output: `enc1:<iv>:<tag>:<ct>` (base64url). */
export function encryptSecret(plaintext: string, keyMaterial: string): string {
  const key = deriveKey(keyMaterial);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ct.toString('base64url')}`;
}

/**
 * Decrypt a stored secret. A malformed, forged, or wrong-key ciphertext throws.
 *
 * STRICT by design: the federation version returned any unprefixed value as legacy plaintext, which was
 * a one-time rollout concession to rows written before encryption existed. There is no such legacy data
 * here, and keeping the passthrough would be a downgrade attack — anyone who can write to the settings
 * row could replace a ciphertext with plaintext and have it honoured. Unprefixed input is an error.
 */
export function decryptSecret(stored: string, keyMaterial: string): string {
  if (!stored.startsWith(PREFIX)) throw new SecretBoxError('secret is not encrypted');
  const rest = stored.slice(PREFIX.length);
  const [ivB64, tagB64, ctB64] = rest.split(':');
  if (!ivB64 || !tagB64 || !ctB64) throw new SecretBoxError('malformed encrypted secret');
  const key = deriveKey(keyMaterial);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
}
