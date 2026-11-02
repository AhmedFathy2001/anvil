import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { listCharacterReports, resolveCharacterReport, settleRenameRequests } from '@/lib/characterReports';
import { revertCharacterReport } from '@/lib/characterReportActions';
import { applyWrongClanMove, wrongClanMoveView } from '@/lib/wrongClan';
import { db } from '@/db';
import { characterReports } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** The platform's queue of characters clans have raised. Support may read it. */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const status = new URL(request.url).searchParams.get('status') === 'all' ? 'all' : 'open';
  const items = await listCharacterReports({ status });
  // A player's wrong-clan report: whether "Make <clan> their home" can be offered (lib/wrongClan).
  const withMove = await Promise.all(
    items.map(async (r) =>
      r.kind === 'wrong_clan' && r.status === 'open' && r.clan
        ? { ...r, wrongClan: await wrongClanMoveView(r.account.id, r.clan.id) }
        : r,
    ),
  );
  return NextResponse.json({ items: withMove });
}

/**
 * POST { id, action: 'wrong_clan_move', resolution? } — carry out a player's wrong-clan report: the
 * clan it names becomes the character's member clan, the current one keeps them as a guest, and the
 * report closes (lib/wrongClan applyWrongClanMove). Refused for an unverified clan or a gone seat.
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || body?.action !== 'wrong_clan_move') {
    return NextResponse.json({ error: "id and action 'wrong_clan_move' are required" }, { status: 400 });
  }
  const res = await applyWrongClanMove(id, gate.actor.user.userId, typeof body?.resolution === 'string' ? body.resolution : null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}

/**
 * Close a report — resolved (something was done; for one a clan owner already applied, "approved"),
 * dismissed (nothing needed doing), or reverted (undo what a clan owner applied — idempotent, and
 * recorded with who did it; lib/characterReportActions).
 */
export async function PATCH(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  const status = body?.status;
  if (!Number.isInteger(id) || (status !== 'resolved' && status !== 'dismissed' && status !== 'reverted')) {
    return NextResponse.json({ error: 'id and status (resolved | dismissed | reverted) are required' }, { status: 400 });
  }
  if (status === 'reverted') {
    const res = await revertCharacterReport(id, gate.actor.user.userId, typeof body?.resolution === 'string' ? body.resolution : null);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
    return NextResponse.json({ ok: true, already: res.already });
  }
  const ok = await resolveCharacterReport(id, gate.actor.user.userId, status, typeof body?.resolution === 'string' ? body.resolution : null);
  if (!ok) return NextResponse.json({ error: 'That report is not open.' }, { status: 409 });
  // A rename turned down here answers the player's own request on their profile too.
  if (status === 'dismissed') {
    const [r] = await db.select().from(characterReports).where(eq(characterReports.id, id));
    if (r?.kind === 'rename') {
      await settleRenameRequests(r.accountId, r.requestedRsn, 'denied', typeof body?.resolution === 'string' && body.resolution.trim() ? body.resolution.trim() : 'Not applied by Anvil staff');
    }
  }
  return NextResponse.json({ ok: true });
}
