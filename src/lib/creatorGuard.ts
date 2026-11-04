// Keeping a creator space out of the in-game-clan parts of the admin area.
//
// The list of what is hidden lives in lib/creatorSpaces (pure, tested); this is the server half that
// acts on it — a redirect for pages, a 400 for APIs.

import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { currentClan, requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import { CREATOR_NOT_AVAILABLE, creatorHidesAdminPath, isCreatorSpace, type CreatorHiddenAdminPath } from '@/lib/creatorSpaces';

/**
 * For a page on the hidden list: send a creator space to its dashboard.
 *
 * app/admin/layout already does this on a full load, but a layout is not re-run when the browser
 * moves between pages under it, so each hidden page asks again. The argument is typed off the list,
 * so a page cannot guard itself with a path the list does not hold.
 */
export async function creatorAway(path: CreatorHiddenAdminPath): Promise<void> {
  if (!creatorHidesAdminPath(path)) return;
  if (isCreatorSpace(await requireClan())) redirect(await clanHref('/admin/dashboard'));
}

/**
 * For an API that only makes sense on an in-game clan and changes something: a 400 for a creator
 * space, null for everyone else. `clan` is whatever the route already resolved.
 */
export function refuseCreatorSpace(clan: { kind?: string | null } | null | undefined): NextResponse | null {
  if (!isCreatorSpace(clan)) return null;
  return NextResponse.json({ error: CREATOR_NOT_AVAILABLE }, { status: 400 });
}

/** The same, for a route that has not resolved its clan yet (or resolves it later, after auth). */
export async function refuseForCreatorSpace(): Promise<NextResponse | null> {
  return refuseCreatorSpace(await currentClan());
}
