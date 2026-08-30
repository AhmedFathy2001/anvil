import { NextResponse } from 'next/server';
import { pluginClanAuthority, pluginTokenPerson, staffsAnyClan } from '@/lib/auth';
import { resolveClanFromRequest } from '@/lib/clanContext';

// GET /api/plugin/me
//
// "Should I show the admin panel?" — the probe the RuneLite plugin makes on startup to decide
// whether to offer clan-roster sync. The plugin sends its per-user account token as a Bearer header
// and reads one field, `isAdmin`; a 401 simply keeps the panel hidden.
//
// The question is per clan, and which clan depends on how the plugin is addressing us:
//
//   - the address NAMES one (a `/c/<slug>` prefix, or an old per-clan hostname) → that clan, exactly.
//   - the address names none (the canonical address) → any clan they are staff of. The roster push
//     that follows carries its own in-game clan name and is authorised against THAT clan, so this
//     only has to answer whether the button could ever do anything. Answering it against whichever
//     clan the token happened to resolve to would hide the button from somebody who administers a
//     different one of their clans.
//
// It used to ask `users.role === 'admin'`, a column the schema marks deprecated because a global
// role makes an admin of one clan an admin of all of them. It also meant that on the platform, where
// a new clan's owner gets `clan_staff.role = 'owner'` and no global role at all, this returned 401
// to every clan owner but the genesis account — so the sync button never appeared, and roster sync
// is the only route to both membership and in-game verification.
export async function GET(request: Request) {
  const auth = await pluginTokenPerson(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const addressed = await resolveClanFromRequest(request);
  const isAdmin = addressed
    ? await pluginClanAuthority(addressed.id, auth.userId, 'admin')
    : await staffsAnyClan(auth.userId, 'admin');

  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ isAdmin: true });
}
