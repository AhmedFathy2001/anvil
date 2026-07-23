import { NextResponse } from 'next/server';
import { resolvePluginMember } from '@/lib/auth';
import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getConnectionsForUser, setAccountShare } from '@/lib/federationConnections';
import { getFederationEnabled } from '@/lib/pluginConfig';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// POST /api/plugin/federation/share — share (or stop sharing) the CURRENTLY-PLAYED account's RSN
// with one connected clan. Per-ACCOUNT by design: the member must be logged into the account in-game
// (resolvePluginMember scopes to the exact clan_members row via X-RSN/X-Account-Hash) and each of
// their accounts is shared with each clan individually — never user-wide, never clan-wide.
// Body: { instanceId, action: 'share' | 'unshare' }. The share reaches the remote on the next
// exchange relay (the plugin follows up with a forced refresh, so within seconds in practice).
export async function POST(request: Request) {
  if (!(await getFederationEnabled())) {
    return NextResponse.json({ error: 'Federation is off on this site.' }, { status: 403 });
  }

  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Log in in-game first — sharing is per account, from the account being shared.' },
      { status: 401 },
    );
  }

  const rl = await rateLimit(request, 'federation-share', { limit: 30, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let body: { instanceId?: string; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const instanceId = typeof body.instanceId === 'string' ? body.instanceId.trim() : '';
  const share = body.action !== 'unshare';
  if (!instanceId) return NextResponse.json({ error: 'instanceId required' }, { status: 422 });

  // Only clans this member is actually connected to are shareable targets — an arbitrary UUID is not.
  const connections = await getConnectionsForUser(member.userId);
  if (!connections.some((c) => c.instanceId === instanceId)) {
    return NextResponse.json({ error: 'Not a connected clan.' }, { status: 404 });
  }

  // Only a VERIFIED account leaves the home — an unverified link is not an identity we can attest.
  const row = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.id, member.clanMemberId),
    columns: { verifiedAt: true },
  });
  if (share && !row?.verifiedAt) {
    return NextResponse.json(
      { error: 'Verify this account on the site first — only verified accounts can be shared.' },
      { status: 403 },
    );
  }

  await setAccountShare(member.userId, member.clanMemberId, instanceId, share);
  log.info('federation.share', { userId: member.userId, clanMemberId: member.clanMemberId, instanceId, share });
  return NextResponse.json({ ok: true, shared: share });
}
