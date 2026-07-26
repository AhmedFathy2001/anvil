import { NextResponse } from 'next/server';
import { resolveFederationMember, sharedInstancesForMember } from '@/lib/federationConnections';
import { resolvePluginMember } from '@/lib/auth';
import { buildState } from '@/lib/federationConnect';
import { jsonWithEtag } from '@/lib/httpEtag';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// GET /api/plugin/federation/state — the ONLY read the plugin makes for federation (WIRE §10.2). The
// plugin polls this and renders `clans[]`; it never touches the broker or another clan site. Authed
// by the member's EXISTING plugin account token (no new credential). Returns:
//   { enabled, connected, needsLogin, verificationUrl?, clans:[{ id, name, board, activity }] }
// where each clan's board + activity is fetched server-to-server and aggregated here. The broker URL
// and every clan URL/token stay server-side and are NEVER in this response.
export async function GET(request: Request) {
  const member = await resolveFederationMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' },
      { status: 401 },
    );
  }

  // §5 DoS: /state drives fan-out board/activity aggregation across every connected clan. The plugin
  // polls it, so the budget is generous, but a runaway/malicious poller can't hammer the outbound fetches.
  const rl = await rateLimit(request, 'federation-state', { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  // ?force=1 = the member clicked Refresh — bypass the 5-minute re-sync window (30s floor server-side).
  const force = new URL(request.url).searchParams.get('force') === '1';
  const state = await buildState(member.userId, { forceRefresh: force });

  // Per-ACCOUNT share flags for the sidebar's "Share my RSN" affordance: resolvable only when the
  // playing account itself resolves (X-RSN/X-Account-Hash → exact clan_members row). Logged out or
  // unlinked → shareEligible:false and the plugin hides the buttons.
  let shareEligible = false;
  let sharedSet: Set<string> | null = null;
  const playingMember = await resolvePluginMember(request);
  if (playingMember) {
    shareEligible = true;
    sharedSet = await sharedInstancesForMember(playingMember.clanMemberId);
  }
  const payload = {
    ...state,
    shareEligible,
    clans: state.clans.map((c) => ({ ...c, shared: sharedSet ? sharedSet.has(c.id) : false })),
  };
  // ETag/304: the plugin polls this frequently but the aggregate rarely changes between polls; an
  // unchanged poll returns 304 with no body (each clan board can be tens of KB). See lib/httpEtag.
  return jsonWithEtag(request, payload);
}
