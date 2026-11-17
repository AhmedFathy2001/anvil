// Account-sharing checks: which network each player's plugin connects from, on boards that opted in.
//
// Off unless the host turned on rules.sharingChecks, which the rules card and the sign-up page then
// tell every player. The plugin sends nothing new — every request already arrives with the address
// Cloudflare saw — and nothing here stores it: the network (IPv4 address, IPv6 /64) is HMAC'd with a
// key that includes the event, so two players' hashes can be compared inside one event and the value
// means nothing anywhere else. Staff see only "same network as X", "two countries" or "added late,
// from another country", never a hash. What those sightings add up to is lib/sharingRules: one
// person's own characters sharing a network is expected and is not a flag.

import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, events, integrityNetwork } from '@/db/schema';
import { getClientIp } from '@/lib/clientIp';
import { parseStamp } from '@/lib/dbTime';
import { requireSecret } from '@/lib/env';
import { parseEventRules } from '@/lib/eventRules';
import { log } from '@/lib/logger';
import { ownershipConfirmed, type SharingPlayer } from '@/lib/sharingRules';

/** One write per account per network this often — the plugin polls every 30 seconds. */
const NOTE_EVERY_MS = 10 * 60_000;
const MAX_SEEN = 50_000;
const seen = new Map<string, number>();

/** Hash a network for one event. Exported for tests. */
export function netHash(eventId: number, network: string): string {
  return crypto
    .createHmac('sha256', requireSecret('CODEWORD_SECRET', 'dev-codeword-secret'))
    .update(`network:${eventId}:${network}`)
    .digest('hex')
    .slice(0, 24);
}

/** Cloudflare's country code, or null for its "unknown" (XX) and Tor (T1) markers. */
export function countryOf(request: { headers: { get(name: string): string | null } }): string | null {
  const c = request.headers.get('cf-ipcountry')?.trim().toUpperCase();
  return c && /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
}

/** Note where this account's plugin is connecting from, for any opted-in running event. Never throws. */
export function noteNetwork(request: Request, accountId: number | null): void {
  try {
    if (!accountId) return;
    const network = getClientIp(request);
    if (network === 'unknown') return;
    const key = `${accountId}:${network}`;
    const now = Date.now();
    if (now - (seen.get(key) ?? 0) < NOTE_EVERY_MS) return;
    if (seen.size > MAX_SEEN) seen.clear();
    seen.set(key, now);
    void record(accountId, network, countryOf(request)).catch((err) => log.warn('integrity-network.failed', {}, err));
  } catch (err) {
    log.warn('integrity-network.failed', {}, err);
  }
}

async function record(accountId: number, network: string, country: string | null): Promise<void> {
  // clan-scope: global -- the account's own enrolments on running boards; each row stays in its event.
  const live = await db
    .select({ participantId: eventParticipants.id, eventId: events.id, rules: events.rules })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .where(and(eq(eventParticipants.accountId, accountId), eq(events.startNotified, 1), eq(events.endNotified, 0)));
  const nowIso = new Date().toISOString();
  for (const r of live) {
    if (!parseEventRules(r.rules).sharingChecks) continue;
    await db
      .insert(integrityNetwork)
      .values({ eventId: r.eventId, participantId: r.participantId, netHash: netHash(r.eventId, network), country, firstSeenAt: nowIso, lastSeenAt: nowIso })
      .onConflictDoUpdate({
        target: [integrityNetwork.eventId, integrityNetwork.participantId, integrityNetwork.netHash],
        set: { lastSeenAt: nowIso, country: sql`coalesce(excluded.country, ${integrityNetwork.country})` },
      });
  }
}

/**
 * Everybody enrolled on one board, with who owns each account as the site's own records have it
 * (lib/sharingRules AccountOwner). Ownership is the claim on the account, never anything read off a
 * network: `claimed` needs both the claim and a login behind the person, so a roster placeholder
 * that merely groups names is nobody's.
 */
export async function sharingRoster(eventId: number): Promise<SharingPlayer[]> {
  // clan-scope: this event -- callers have settled whose event it is; accounts are global by design.
  const rows = await db
    .select({
      id: eventParticipants.id,
      name: eventParticipants.name,
      teamId: eventParticipants.teamId,
      pickedAt: eventParticipants.pickedAt,
      snapshotAt: eventParticipants.snapshotAt,
      accountId: accounts.id,
      personId: accounts.playerId,
      claimedAt: accounts.claimedAt,
      verifiedAt: accounts.verifiedAt,
      provisional: accounts.provisional,
      verificationMethod: accounts.verificationMethod,
      // Spelled out: inside a select list drizzle renders a column bare, which a subquery misreads.
      hasLogin: sql<boolean>`exists (select 1 from "users" u where u."player_id" = "accounts"."player_id")`,
    })
    .from(eventParticipants)
    .leftJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .where(eq(eventParticipants.eventId, eventId));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    teamId: r.teamId,
    pickedMs: parseStamp(r.pickedAt),
    baselineMs: parseStamp(r.snapshotAt),
    owner: r.accountId == null
      ? null
      : {
          personId: r.personId,
          claimed: r.claimedAt != null && r.hasLogin === true,
          confirmed: ownershipConfirmed({ verifiedAt: r.verifiedAt, provisional: r.provisional, verificationMethod: r.verificationMethod }),
        },
  }));
}
