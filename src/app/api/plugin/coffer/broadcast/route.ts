import { NextResponse } from 'next/server';

import { resolvePluginMember } from '@/lib/auth';
import { announce } from '@/lib/coffer';
import { recordCofferBroadcast } from '@/lib/cofferBroadcast';
import { labQuarantine } from '@/lib/lab';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * One plugin's report of the coffer line in its clan chat ("Nisbro has deposited 519 coins into the
 * coffer."). The plugin sends the line and the channel's name as it saw them; the site parses, matches
 * other members' reports of the same line, and books it once two people agree (lib/cofferBroadcast).
 */
export async function POST(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' }, { status: 401 });
  }
  const rl = await rateLimit(request, `plugin-coffer-chat:${member.userId}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const quarantined = await labQuarantine(request, member.accountId, 'coffer', body);
  if (quarantined) return quarantined;

  const line = typeof body.line === 'string' ? body.line.slice(0, 300) : '';
  const clanName = typeof body.clanName === 'string' ? body.clanName.slice(0, 80) : '';
  if (!line || !clanName) return NextResponse.json({ error: 'line and clanName are required' }, { status: 400 });

  const result = await recordCofferBroadcast({ clanId: member.clanId, clanMemberId: member.clanMemberId, rsn: member.rsn, line, clanName });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  for (const entry of result.booked) announce(member.clanId, entry);
  return NextResponse.json({ ok: true, outcome: result.outcome });
}
