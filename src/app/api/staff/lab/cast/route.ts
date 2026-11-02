import { NextResponse } from 'next/server';

import { LAB_VIEW_AS_COOKIE, signLabViewAs } from '@/lib/auth';
import { sessionCookieDomain } from '@/lib/clanContext';
import { CLAN_ROLES, type ClanRole } from '@/lib/clanRoles';
import { ensureTestUser, isTestUser, labClanRole, listTestUsers, setLabClanRole } from '@/lib/labCast';
import { LAB_TIERS, setLabTier } from '@/lib/labSupporter';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

// /api/staff/lab/cast — the lab's test users (lib/labCast) and your standing in the lab clan.
// GET: the test users with their tiers, and your lab clan role. POST {action}:
//   'add-user' {name}           a new test user (named Lab~<name>)
//   'user-tier' {userId, tier}  a test user's Supporter tier (null = none), for a day
//   'clan-role' {role}          your own role in the lab clan, owner down to member
//   'view-as' {userId}          browse the site as that test user (4 hours; the banner switches back)

export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  return NextResponse.json({ users: await listTestUsers(), clanRole: await labClanRole(gate.actor.user.userId) });
}

export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const me = gate.actor.user.userId;
  let body: { action?: unknown; name?: unknown; userId?: unknown; tier?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const testUser = async () => (Number.isInteger(body.userId) && (await isTestUser(body.userId as number)) ? (body.userId as number) : null);

  switch (body.action) {
    case 'add-user': {
      if (typeof body.name !== 'string' || !(await ensureTestUser(me, body.name))) {
        return NextResponse.json({ error: 'Pick a name of letters and digits (a real character may already have it).' }, { status: 400 });
      }
      break;
    }
    case 'user-tier': {
      const id = await testUser();
      const tier = LAB_TIERS.find((t) => t === body.tier) ?? null;
      if (!id || (body.tier != null && !tier)) return NextResponse.json({ error: 'Not a test user' }, { status: 400 });
      await setLabTier(id, tier);
      break;
    }
    case 'clan-role': {
      const role = CLAN_ROLES.find((r) => r === body.role) as ClanRole | undefined;
      if (!role) return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
      await setLabClanRole(me, role);
      break;
    }
    case 'view-as': {
      const id = await testUser();
      if (!id) return NextResponse.json({ error: 'Only lab test users can be viewed as.' }, { status: 400 });
      const res = NextResponse.json({ ok: true });
      const domain = sessionCookieDomain();
      res.cookies.set(LAB_VIEW_AS_COOKIE, signLabViewAs(me, id), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 4 * 3600,
        ...(domain ? { domain } : {}),
      });
      return res;
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json({ users: await listTestUsers(), clanRole: await labClanRole(me) });
}
