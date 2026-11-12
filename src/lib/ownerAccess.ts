// The guard for the platform's top-level surfaces: /staff/money, /staff/analytics and their APIs.
//
// Platform root alone. Root is the top of the platform roles (support < staff < root) and only root can
// grant roles, so this cannot be reached by promoting someone below it. (users.is_owner is a CLAN
// owner's protection and plays no part here.) Every rejection is the same 404, like the rest of /staff.
import { NextResponse } from 'next/server';

import { platformActor, type PlatformActor } from '@/lib/platformAccess';

export async function ownerActor(): Promise<PlatformActor | null> {
  return platformActor('root');
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
