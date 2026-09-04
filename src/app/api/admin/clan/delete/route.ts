import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { clanGrant } from '@/lib/clanGrants';
import { requireClanFromRequest } from '@/lib/clanContext';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * Delete a clan, and everything that belongs to it.
 *
 * There was no way to do this at all. A clan created by mistake — a typo in the address, a duplicate
 * of one you already have, a test — stayed on the platform permanently, kept its slug reserved, and
 * kept its in-game name held against the clan that actually has that name.
 *
 * IT IS A HARD DELETE. Fifteen of the sixteen tables that reference a clan cascade, and the
 * sixteenth (teams.clan_id, the co-host tag on somebody else's board) is `set null`, which is
 * exactly right: a co-hosted event that outlives one of its guests should lose the tag, not the
 * event. So this is one statement and the database does the rest — no bespoke teardown that gets out
 * of step with the schema the next time a table is added.
 *
 * OWNER ONLY, read live from the grant rather than the session, so a stale token cannot delete a
 * clan somebody has since been removed from.
 *
 * The confirmation is the clan's SLUG, typed. Not a checkbox and not the display name: the slug is
 * unique, it is in the address bar, and two clans of the same display name are precisely the case
 * this endpoint exists to clean up — a confirmation you could satisfy from either of them is not a
 * confirmation.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const grant = await clanGrant(clan.id, session.userId);
  if (!grant?.isOwner) {
    return NextResponse.json({ error: 'Only the owner can delete a clan' }, { status: 403 });
  }

  // Cheap to attempt, catastrophic to get right by accident.
  const limited = await rateLimitByKey('clan-delete', String(session.userId), {
    limit: 5,
    windowMs: 3600_000,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const confirm = typeof body?.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';
  if (confirm !== clan.slug.toLowerCase()) {
    return NextResponse.json(
      { error: `Type the clan's address (${clan.slug}) to confirm.` },
      { status: 400 },
    );
  }

  // Said before the row is gone, because afterwards there is nothing left to say it about — the
  // clan's own audit log cascades with it, so this line in the deployment log is the record.
  console.warn(
    `[clan-delete] clan ${clan.id} (${clan.slug}) deleted by user ${session.userId}`,
  );

  await db.delete(clans).where(eq(clans.id, clan.id));

  // The caller is standing on a host that no longer resolves, so it has to be told where to go.
  return NextResponse.json({ ok: true, redirect: '/' });
}
