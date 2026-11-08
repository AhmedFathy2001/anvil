// The guard for the owner-only money surface: /staff/money and /api/staff/money/*.
//
// Money is not a platform-role question. `root` can hand out Supporter time and attach purchases, but
// it does not get to see what Anvil earns; only the person with `users.is_owner` does. That column is
// protected (nobody can demote or delete it; only an ownership transfer moves it), so it is the one
// check that cannot be reached by promoting someone.
//
// Layers: the caller must be on the apex, hold a platform role (platformActor), AND have is_owner set
// on their row, read live, never from the session. Every rejection is the same 404, like the rest of
// /staff, so a staff member below owner learns nothing about this surface.

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { platformActor, type PlatformActor } from '@/lib/platformAccess';

/** Is this login the platform owner? Live read of the protected flag. */
export async function isPlatformOwner(userId: number): Promise<boolean> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { isOwner: true } });
  return row?.isOwner === true;
}

export async function ownerActor(): Promise<PlatformActor | null> {
  const actor = await platformActor('support');
  if (!actor) return null;
  return (await isPlatformOwner(actor.user.userId)) ? actor : null;
}

/** Page guard: the actor or null; the caller calls notFound(). */
export async function requireOwnerPage(): Promise<PlatformActor | null> {
  return ownerActor();
}

/** Route / server-action guard: the actor, or the 404 to return at once. */
export async function requireOwnerApi(): Promise<{ actor: PlatformActor } | { response: NextResponse }> {
  const actor = await ownerActor();
  if (!actor) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { actor };
}
