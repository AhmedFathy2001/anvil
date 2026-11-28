import crypto from 'crypto';

import { imageSigPayload, proxiedImageUrl } from '@/lib/displayImage';
import { requireSecret } from '@/lib/env';

// The server half of lib/displayImage: signs a pasted Discord attachment link for /api/discord-image
// and checks the signature there. The key never leaves the server, so call displayImageUrl only in
// server code (server components, loaders, routes) and hand client components the finished URL.

let key: Buffer | null = null;
/** A key of its own, derived from the admin session secret, so it signs nothing else. */
function imageKey(): Buffer {
  key ??= crypto.createHash('sha256').update(`anvil-discord-image:${requireSecret('ADMIN_SESSION_SECRET', 'dev-admin-secret')}`).digest();
  return key;
}

const sign = (payload: string) => crypto.createHmac('sha256', imageKey()).update(payload).digest('base64url');

/** What to put in an <img src> (or a link) for an image a member gave us: Discord attachments via the signed refresher. */
export function displayImageUrl<T extends string | null | undefined>(raw: T): T | string {
  return proxiedImageUrl(raw, sign);
}

/** Did we sign this attachment? Timing-safe; any malformed signature is simply no. */
export function imageSigValid(url: URL, sig: string | null | undefined): boolean {
  if (!sig || sig.length > 128) return false;
  const want = Buffer.from(sign(imageSigPayload(url)));
  const got = Buffer.from(sig);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
