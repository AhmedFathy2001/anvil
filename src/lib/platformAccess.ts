// The guard for platform surfaces — /staff and /api/staff.
//
// TWO RULES, AND THEY ARE THE WHOLE POINT OF THIS FILE.
//
// 1. A clan role grants NOTHING here. Being owner of a clan — even the only clan — is not platform
//    capability. The check reads `users.platform_role` and never looks at clan_staff, so there is no
//    path by which administering a clan becomes administering the platform.
//
// 2. It reads the role LIVE, from the row, never from the session cookie. The cookie is minted once
//    and lives for weeks; a demotion has to take effect on the next request, not on the next login.
//    (Sessions do carry `platformRole`, but only so the nav can decide whether to show a link. It is
//    never the thing that authorizes anything.)
//
// APEX ONLY. These surfaces exist on the clanless apex and 404 on a clan host. Not decoration: a
// clan host serving /staff would read as "staff of this clan", which is exactly the conflation rule
// 1 exists to prevent — and it would give a plausible-looking URL to phish an operator with.
//
// Middleware cannot do any of this. It runs at the edge with no database, so it cannot read a live
// role, and it never covers /api/* at all. Every route guards itself.

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { verifyUser, type UserPayload } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { hasPlatformRole, type PlatformRole } from '@/lib/clanRoles';
import { platformRoleOf } from '@/lib/clanGrants';

export interface PlatformActor {
  user: UserPayload;
  role: PlatformRole;
}

/**
 * The caller, if they hold at least `min` on the platform AND are on the apex. Null otherwise —
 * every rejection collapses to the same null so a caller cannot tell "wrong host" from "no role"
 * from "not signed in", and callers render the same 404 for all three.
 */
export async function platformActor(min: PlatformRole = 'support'): Promise<PlatformActor | null> {
  const host = (await headers()).get('host');
  if (!isApexHost(host)) return null;

  const user = await verifyUser();
  if (!user) return null;

  // Live, from the row. The session's copy is for rendering, not for deciding.
  const role = await platformRoleOf(user.userId);
  if (!hasPlatformRole(role, min)) return null;

  return { user, role };
}

/**
 * Page guard. Returns the actor or null; the caller calls notFound().
 *
 * 404 rather than 403 on purpose — an unauthorized visitor learns nothing about whether /staff is
 * even a thing here. There is no legitimate flow that lands a non-operator on these pages, so
 * there is nothing to explain to them.
 */
export async function requirePlatformPage(min: PlatformRole = 'support'): Promise<PlatformActor | null> {
  return platformActor(min);
}

/**
 * Route guard. Either the actor, or the response to return immediately:
 *
 *   const gate = await requirePlatformApi('staff');
 *   if ('response' in gate) return gate.response;
 *   // gate.actor is authorized from here
 */
export async function requirePlatformApi(
  min: PlatformRole = 'support',
): Promise<{ actor: PlatformActor } | { response: NextResponse }> {
  const actor = await platformActor(min);
  if (!actor) {
    // Same 404 as the pages, for the same reason: /api/staff/* does not confirm its own existence.
    return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { actor };
}

/**
 * Support is READ-ONLY, and this is where that is enforced rather than remembered.
 *
 * The role exists so someone can answer "why can't this member see the board" without being able to
 * change anything while they look. Any handler that writes asks for 'staff' or higher; passing
 * 'support' to a mutating route is the bug this signature is shaped to make obvious.
 */
export const CAN_WRITE: PlatformRole = 'staff';
/** Granting platform roles is root's alone — otherwise 'staff' is self-promoting. */
export const CAN_GRANT: PlatformRole = 'root';
