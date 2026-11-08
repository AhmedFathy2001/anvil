// The guard for OWNER-ONLY platform surfaces — today /staff/analytics and /api/staff/analytics.
//
// Narrower than lib/platformAccess on purpose: a platform role (support, staff, root) is not the
// owner flag, and numbers about who finds Anvil and what they pay for are the owner's. The flag is
// read LIVE from `users.is_owner`, never from the session (which carries a per-clan notion of owner
// that means something else), and every refusal collapses to the same 404.

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser, type UserPayload } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { ownerGate } from '@/lib/ownerGate';

export async function ownerActor(): Promise<{ user: UserPayload } | null> {
  const onApex = isApexHost((await headers()).get('host'));
  const user = onApex ? await verifyUser() : null;
  if (!user) return null;
  // clan-scope: global -- the owner flag is a platform fact about one account.
  const row = await db.query.users.findFirst({ where: eq(users.id, user.userId), columns: { isOwner: true } });
  return ownerGate({ onApex, signedIn: true, isOwner: row?.isOwner === true }) ? { user } : null;
}

/** Page guard: the actor, or null (the caller renders notFound()). */
export const requireOwnerPage = ownerActor;

/** Route guard: the actor, or the 404 to return. */
export async function requireOwnerApi(): Promise<{ actor: { user: UserPayload } } | { response: NextResponse }> {
  const actor = await ownerActor();
  return actor ? { actor } : { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
}
