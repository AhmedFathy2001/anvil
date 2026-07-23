// Device-code sign-in for the plugin (RFC 8628 shape, HOME-NATIVE — the broker is never involved,
// so this works identically for hosted, networked self-host, and fully-standalone instances).
// The plugin: POST /api/plugin/auth/start → open /link-device in the member's browser (plugin pins
// the URL to its CONFIGURED home origin) → poll /api/plugin/auth/poll → account token, exactly once.
//
// Security properties, in one place:
//  - the long device_code never touches disk (SHA-256 only); the short user_code is display-only
//  - approval requires a full web session AND confirming the code the plugin displays — the page
//    copy warns against approving codes you didn't start ("device-flow phishing" is the classic
//    attack here; the member typing/na-confirming THEIR client's code is the countermeasure)
//  - single-use: redeemed/denied/expired codes are dead; slow_down pacing bounds the poll loop
//  - no local listener plugin-side — completion is detected purely by polling the home site

import crypto from 'crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { pluginDeviceCodes } from '@/db/schema';

export const DEVICE_CODE_TTL_S = 600; // 10 minutes to find a browser and click Approve
export const DEVICE_POLL_INTERVAL_S = 5;

// No vowels (no accidental words), no ambiguous glyphs (0/O, 1/I/L).
const USER_CODE_ALPHABET = 'BCDFGHJKMNPQRSTVWXYZ23456789';

export function hashDeviceCode(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function randomUserCode(): string {
  const pick = () => USER_CODE_ALPHABET[crypto.randomInt(USER_CODE_ALPHABET.length)];
  const half = () => pick() + pick() + pick() + pick();
  return `${half()}-${half()}`;
}

/** Uppercase + strip everything outside the alphabet, re-insert the dash — tolerant of user typing. */
export function normalizeUserCode(input: string): string | null {
  const bare = input.toUpperCase().replace(new RegExp(`[^${USER_CODE_ALPHABET}]`, 'g'), '');
  if (bare.length !== 8) return null;
  return `${bare.slice(0, 4)}-${bare.slice(4)}`;
}

export interface MintedDeviceCode {
  deviceCode: string;
  userCode: string;
  interval: number;
  expiresIn: number;
}

/** Mint a fresh pending device code. Opportunistically GCs long-dead rows so the short user-code
 * namespace stays roomy; retries the (unlikely) user_code collision against live rows. */
export async function mintDeviceCode(): Promise<MintedDeviceCode> {
  const nowMs = Date.now();
  // GC anything expired over an hour ago — keeps the table tiny with zero scheduling.
  await db
    .delete(pluginDeviceCodes)
    .where(lt(pluginDeviceCodes.expiresAt, new Date(nowMs - 3600_000).toISOString()))
    .catch(() => {});

  const deviceCode = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(nowMs + DEVICE_CODE_TTL_S * 1000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const userCode = randomUserCode();
    try {
      await db.insert(pluginDeviceCodes).values({
        deviceCodeHash: hashDeviceCode(deviceCode),
        userCode,
        expiresAt,
        interval: DEVICE_POLL_INTERVAL_S,
      });
      return { deviceCode, userCode, interval: DEVICE_POLL_INTERVAL_S, expiresIn: DEVICE_CODE_TTL_S };
    } catch (e) {
      // user_code unique collision with a live row — re-roll. Anything else is real.
      if (attempt === 4) throw e;
    }
  }
  throw new Error('unreachable');
}

/** Bind the logged-in member to a pending code (approve) or kill it (deny). Returns false when the
 * code is unknown, already resolved, or expired — the page shows a generic "code not found". */
export async function resolveUserCode(
  userCode: string,
  userId: number,
  action: 'approve' | 'deny',
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const updated = await db
    .update(pluginDeviceCodes)
    .set(action === 'approve' ? { status: 'approved', userId } : { status: 'denied' })
    .where(
      and(
        eq(pluginDeviceCodes.userCode, userCode),
        eq(pluginDeviceCodes.status, 'pending'),
        sql`${pluginDeviceCodes.expiresAt} > ${nowIso}`,
      ),
    )
    .returning({ id: pluginDeviceCodes.id });
  return updated.length > 0;
}
