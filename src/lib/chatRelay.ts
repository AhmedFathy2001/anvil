// Chat relay, the site's half (the push server's is lib/push/relay): staff's switch, who a plugin
// relays as (signed into its push ticket), and the one thing ever stored — a line somebody reported.

import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, promoReports, users } from '@/db/schema';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { cleanName } from '@/lib/eventChatRules';
import { log } from '@/lib/logger';
import { getPlatformSetting, setPlatformSetting } from '@/lib/platformSettings';
import { playedCharacter, resolvePluginCharacter } from '@/lib/pluginAccount';
import { accountIcon, fcOwner, lineSigned, relayKey, RELAY_MAX, type RelayIdentity } from '@/lib/push/relay';

/** Staff's switch for the relay. ON unless staff turn it off ('false'). */
export const CHAT_RELAY_PLATFORM_KEY = 'chat_relay_enabled';

let cache: { on: boolean; at: number } | null = null;

export async function relayOn(fresh = false): Promise<boolean> {
  const now = Date.now();
  if (!fresh && cache && now - cache.at < 30_000) return cache.on;
  const on = (await getPlatformSetting(CHAT_RELAY_PLATFORM_KEY)) !== 'false';
  cache = { on, at: now };
  return on;
}

/** Off stops every relay at once (the push server hears it); new tickets carry no relay either way. */
export async function setRelayOn(on: boolean): Promise<void> {
  await setPlatformSetting(CHAT_RELAY_PLATFORM_KEY, on ? 'true' : 'false');
  cache = null;
  await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'relay', on })})`).catch((err: unknown) => log.warn('chat-relay.notify-failed', { message: (err as Error).message }));
}

/**
 * Who this plugin relays as: the character it is logged in on (theirs — resolvePluginCharacter), by
 * the name Anvil holds for that account (never the header's), its account-type icon, the clan whose
 * in-game roster lists it, `world` (the plugin's `?world=`: only the client can know it) and `fc`
 * (the plugin's `?fc=`: the friends chat owner it sits with, self-reported the same way). Null
 * when there is no such character, or the header names another one than the account it resolved to.
 */
export async function relayIdentity(request: Request, world: number | null, fc: string | null = null): Promise<RelayIdentity | null> {
  const character = await resolvePluginCharacter(request).catch(() => null);
  const played = playedCharacter(request);
  if (!character || !played) return null;
  // clan-scope: global -- the caller's own character, by the id resolvePluginCharacter just proved is theirs
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, character.accountId), columns: { rsn: true, rsnNormalized: true, accountType: true } });
  if (!account || account.rsnNormalized !== normalizeRsn(played.rsn)) return null;
  // clan-scope: global -- the one clan the caller's own character is a member of (one member seat per account)
  const seat = await db.query.clanMemberships.findFirst({
    where: and(eq(clanMemberships.accountId, character.accountId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)),
    columns: { clanId: true },
  });
  return { name: sanitizeRsn(account.rsn), icon: accountIcon(account.accountType), clanId: seat?.clanId ?? null, world: world != null && Number.isInteger(world) && world > 0 && world < 10_000 ? world : null, ...(fcOwner(fc) ? { fc: fcOwner(fc) } : {}) };
}

export interface RelayReport {
  c: unknown;
  n: unknown;
  x: unknown;
  at: unknown;
  u: unknown;
  k: unknown;
}

const KEY = () => relayKey(process.env.PLAYER_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-player-secret'));

/**
 * A relayed line reported by someone who received it. Only a line the push server signed is taken —
 * sender, name, channel, time and words all under the signature, so nobody can report words a player
 * never said or pin them on another name — and only that line is kept: it goes to the
 * platform's report queue (/staff/promotions) as a report of the sender's profile, with the line as
 * its snapshot. Repeats by the same person of the same line are one report.
 */
export async function reportRelayLine(reporterUserId: number, r: RelayReport): Promise<{ ok: true } | { ok: false; error: string }> {
  const at = Number(r.at);
  const u = Number(r.u);
  if (typeof r.c !== 'string' || typeof r.x !== 'string' || typeof r.n !== 'string' || !Number.isInteger(at) || !Number.isInteger(u)) return { ok: false, error: 'bad' };
  if (r.x.length > RELAY_MAX || !lineSigned(KEY(), u, r.n, r.c, r.x, at, r.k)) return { ok: false, error: 'unknown line' };
  // Old lines aren't evidence of anything current: a day is plenty to right-click one.
  if (Date.now() - at > 24 * 3_600_000) return { ok: false, error: 'too old' };
  // A 'person' report names the sender's person (players.id), as the profile report does.
  // clan-scope: global -- the sender's own user row, for their person id
  const sender = await db.query.users.findFirst({ where: eq(users.id, u), columns: { playerId: true } });
  const person = sender?.playerId;
  if (person == null) return { ok: false, error: 'unknown sender' };
  const snapshot = `[${r.c} chat, relayed ${new Date(at).toISOString()}] ${cleanName(r.n)}: ${r.x}`;
  // clan-scope: global -- the platform's own report queue; one open report per reporter per line
  const dupe = await db.query.promoReports.findFirst({
    where: and(eq(promoReports.targetType, 'person'), eq(promoReports.targetId, person), eq(promoReports.reporterUserId, reporterUserId), eq(promoReports.snapshot, snapshot)),
    columns: { id: true },
  });
  if (dupe) return { ok: true };
  await db.insert(promoReports).values({ clanId: null, targetType: 'person', targetId: person, category: 'other', reporterUserId, reason: 'Relayed in-game chat line', snapshot });
  return { ok: true };
}
