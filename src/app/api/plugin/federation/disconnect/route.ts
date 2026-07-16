import { NextResponse } from 'next/server';
import { resolveFederationMember } from '@/lib/federationConnections';
import { disconnectMember } from '@/lib/federationConnect';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/plugin/federation/disconnect — a full federation logout for the member (WIRE §10.2).
// Discards the member's cached remote-clan tokens, clears the durable signed-in marker, and drops any
// in-flight device session, so /state reverts to { signedIn:false, connected:false } and the plugin
// re-offers "Connect clans". Authed by the member's EXISTING plugin account token; idempotent.
export async function POST(request: Request) {
  const member = await resolveFederationMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' },
      { status: 401 },
    );
  }

  // Cheap local writes (no outbound broker/clan calls), but still bound it so a stuck client can't spin.
  const rl = await rateLimit(request, 'federation-disconnect', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  await disconnectMember(member.userId);
  return NextResponse.json({ status: 'disconnected' }, { headers: rateLimitHeaders(rl) });
}
