import { NextResponse } from 'next/server';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { getActiveWeekly } from '@/lib/pluginConfig';

// GET — returns the currently active weekly competition in THIS clan (if any). Used by older plugin
// builds to decide whether to auto-enroll the signed-in player on login. Newer builds read the same
// data merged into GET /api/plugin/config; kept for backward compat. Read-only.
//
// The clan comes from the request — `<slug>.anvilosrs.com` for the jars in the field, or the
// `/c/<slug>` prefix — because it cannot come from the caller: this endpoint takes no token, and
// never has. Which is exactly why the missing filter mattered. Naming a clan's address is the only
// standing it has ever asked for, and that is unchanged; what changed is that "this deployment" used
// to mean one clan and now means all of them.
//
// No clan named → null, the same answer as "nothing running". An older jar treats null as "no
// competition" and carries on; a 404 would surface as a connection failure for a question that
// simply has no answer on the apex.
export async function GET(request: Request) {
  const clan = await resolveClanFromRequest(request);
  if (!clan) return NextResponse.json(null);
  return NextResponse.json(await getActiveWeekly(clan.id));
}
