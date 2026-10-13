// Deleting a clan outright — the platform's last resort, past archiving.
//
// One DELETE on `clans`; the schema's cascades take the rest (events and everything under them,
// seats, staff, settings, weeklies, guides, the clan's own audit log). Characters are NOT the clan's
// (the clan/character boundary): accounts and players stay, and only this clan's seats on them go.
//
// It runs in a transaction so a delete that something blocks leaves nothing half-gone. The blocker
// in practice is event_signups.clan_member_id (ON DELETE RESTRICT): a seat signed up to ANOTHER
// clan's event — a co-hosted one — cannot be removed out from under that event. That is reported
// rather than forced; the other clan's board is not ours to rewrite.
//
// Media in object storage is not touched here; it ages out with the retention sweep.

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';

export interface DeletedClan {
  id: number;
  slug: string;
  name: string;
  /** What went with it, for the operator's confirmation and the platform log. */
  counts: { seats: number; events: number; weeklies: number };
}

export class ClanDeleteBlocked extends Error {
  constructor(readonly detail: string) {
    super(`Clan delete blocked: ${detail}`);
  }
}

const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
const pgDetail = (e: unknown): string =>
  (e as { detail?: string }).detail ?? (e as { cause?: { detail?: string } }).cause?.detail ?? String(e);

/**
 * Delete the clan and everything that cascades from it, then record it in the platform log (a row
 * with no clan, since the clan's own log just went with it). Null when there is no such clan.
 */
export async function deleteClan(clanId: number, actorUserId: number | null, reason: string): Promise<DeletedClan | null> {
  try {
    return await db.transaction(async (tx) => {
      const clan = await tx.query.clans.findFirst({ where: eq(clans.id, clanId) });
      if (!clan) return null;

      // clan-scope: this clan only -- counted before they cascade away.
      const [c] = (
        await tx.execute(sql`
          select
            (select count(*)::int from clan_memberships where clan_id = ${clanId}) as seats,
            (select count(*)::int from events where clan_id = ${clanId}) as events,
            (select count(*)::int from weekly_competitions where clan_id = ${clanId}) as weeklies
        `)
      ).rows as { seats: number; events: number; weeklies: number }[];
      const counts = { seats: Number(c?.seats ?? 0), events: Number(c?.events ?? 0), weeklies: Number(c?.weeklies ?? 0) };

      await tx.delete(clans).where(eq(clans.id, clanId));

      await tx.insert(clanAuditLog).values({
        clanId: null,
        eventType: 'platform_clan_deleted',
        actorUserId,
        oldValue: JSON.stringify({ id: clan.id, slug: clan.slug, name: clan.name, customDomain: clan.customDomain, ...counts }),
        newValue: null,
        notes: reason,
      });

      return { id: clan.id, slug: clan.slug, name: clan.name, counts };
    });
  } catch (e) {
    if (pgCode(e) === '23503') throw new ClanDeleteBlocked(pgDetail(e));
    throw e;
  }
}
