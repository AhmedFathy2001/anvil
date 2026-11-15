import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { atLeast } from '@/lib/clanRoles';
import { deletedAccountClanBans, liftDeletedAccountClanBan } from '@/lib/deletedAccountBans';

// This clan's bans on accounts that have since been deleted (lib/deletedAccountBans).
//
// A ban outlives the account it was set on: if the same Discord account signs in again it is banned
// from this clan again. There is no person left to show, so each is listed as "Deleted account"
// with its date and the clan's own reason, and can be lifted here. Once that Discord account has
// signed in again the ban is an ordinary one on a person with no character here, and stays on this
// list (kind 'returned') so it can still be lifted. Admin only, like every other ban.

export async function GET(request: Request) {
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ bans: await deletedAccountClanBans(clan.id) });
}

// DELETE { id, kind } — lift it. That Discord account can then sign in and join like anyone else.
export async function DELETE(request: Request) {
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { id?: unknown; kind?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const kind = body?.kind === 'returned' ? 'returned' : 'deleted';

  // Matched on this clan as well as the id: another clan's ban is not this clan's to lift.
  if (!(await liftDeletedAccountClanBan(clan.id, id, actor.userId, kind))) {
    return NextResponse.json({ error: 'That ban is no longer there.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
