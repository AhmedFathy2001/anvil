import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { detachCharacter, reassignCharacter, resolveCharacterReport, settleRenameRequests } from '@/lib/characterReports';
import { renameCharacter } from '@/lib/characterRename';

/**
 * POST /api/staff/characters/[id] { action: 'detach' | 'reassign' | 'rename', toPlayerId?, toRsn?, note?, reportId? }
 *
 * The character tools clans no longer have (lib/characterReports). Staff only — support is read-only.
 * Passing `reportId` closes that report as resolved with the note, so acting and closing are one step.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;

  const accountId = Number((await params).id);
  if (!Number.isInteger(accountId) || accountId <= 0) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === 'string' ? body.note : null;
  const actor = gate.actor.user.userId;

  if (body?.action === 'detach') {
    if (!(await detachCharacter(accountId, actor, note))) {
      return NextResponse.json({ error: 'Nobody holds that character.' }, { status: 409 });
    }
  } else if (body?.action === 'reassign') {
    const toPlayerId = Number(body?.toPlayerId);
    if (!Number.isInteger(toPlayerId) || toPlayerId <= 0) {
      return NextResponse.json({ error: 'toPlayerId is required' }, { status: 400 });
    }
    const res = await reassignCharacter(accountId, toPlayerId, actor, note);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  } else if (body?.action === 'rename') {
    // The character takes the new name, absorbing a duplicate a roster sync made under it
    // (lib/characterRename) — the roster seat, event entry and baseline end up on one character.
    const toRsn = typeof body?.toRsn === 'string' ? body.toRsn : '';
    const res = await renameCharacter(accountId, toRsn, { actorUserId: actor, via: 'staff', note });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
    await settleRenameRequests(accountId, toRsn, 'approved', note || `Renamed to ${toRsn} by Anvil staff`);
  } else {
    return NextResponse.json({ error: "action must be 'detach', 'reassign' or 'rename'" }, { status: 400 });
  }

  const reportId = Number(body?.reportId);
  if (Number.isInteger(reportId) && reportId > 0) {
    // Only a report about THIS character — an id from another report must not be closed by acting here.
    await resolveCharacterReport(reportId, actor, 'resolved', note ?? body.action, accountId);
  }
  return NextResponse.json({ ok: true });
}
