import { NextResponse } from 'next/server';
import { resolveFederationMember } from '@/lib/federationConnections';
import { connectMember } from '@/lib/federationConnect';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST /api/plugin/federation/connect — the ONLY write the plugin makes for federation (WIRE §10.2).
// One host, unchanged posture: the plugin calls its own home site; the home site does all broker +
// clan traffic server-to-server. Authed by the member's EXISTING plugin account token.
//
// Trusted home (hosted): zero-click — the site vouches for the member to the broker and exchanges
// assertions at each clan → { status: "connected" }.
// Self-host home: the broker won't accept a self-host identity claim, so the member does a one-time
// device-code Discord login on the broker's own domain → { status: "login", verificationUrl }. The
// plugin opens verificationUrl in a browser and re-polls (subsequent /connect or /state completes it).
export async function POST(request: Request) {
  const member = await resolveFederationMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' },
      { status: 401 },
    );
  }

  // Gently rate-limit: /connect drives outbound broker + clan calls. The plugin only calls it on the
  // member pressing "Connect" (or polling a pending self-host login), so a small budget is ample.
  const rl = await rateLimit(request, 'federation-connect', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const result = await connectMember(member.userId, member.discordId);

  switch (result.status) {
    case 'connected':
      return NextResponse.json({ status: 'connected', clans: result.count ?? 0 }, { headers: rateLimitHeaders(rl) });
    case 'login':
      return NextResponse.json(
        { status: 'login', verificationUrl: result.verificationUrl },
        { headers: rateLimitHeaders(rl) },
      );
    case 'disabled':
      return NextResponse.json({ error: 'Federation is not enabled on this clan' }, { status: 409, headers: rateLimitHeaders(rl) });
    case 'unconfigured':
      return NextResponse.json({ error: 'Federation broker is not configured' }, { status: 409, headers: rateLimitHeaders(rl) });
  }
}
