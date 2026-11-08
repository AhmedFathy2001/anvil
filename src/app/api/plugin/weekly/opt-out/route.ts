import { NextResponse } from 'next/server';

import { resolvePluginMember } from '@/lib/auth';
import { competitionForClan, entryStatus, setOptOut } from '@/lib/competitionTeamsDb';

/**
 * The panel's "You're in · Opt out" for a weekly competition. Authenticated by the plugin token: it
 * flips the logged-in CHARACTER (resolvePluginMember), never an RSN the request names. The
 * competition must be visible to that character's clan (own, or an accepted clan-vs-clan one).
 *
 * POST { competitionId, optOut: boolean } → { entered, optedOut }
 */
export async function POST(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) return NextResponse.json({ error: 'Sign in with the plugin first.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = Number(body?.competitionId);
  if (!Number.isInteger(id) || typeof body?.optOut !== 'boolean') {
    return NextResponse.json({ error: 'competitionId and optOut are required' }, { status: 400 });
  }
  if (!(await competitionForClan(member.clanId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const r = await setOptOut(id, { accountId: member.accountId }, body.optOut);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(await entryStatus(id, { accountId: member.accountId }));
}
