// Keeping a creator space out of the in-game-clan parts of the admin area.
//
// The list of what is hidden lives in lib/creatorSpaces (pure, tested); this is the server half that
// acts on it — a redirect for pages, a 400 for APIs.

import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { clanPrefix, currentClan, requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import {
  CREATOR_NOT_AVAILABLE,
  creatorHidesAdminPath,
  creatorPublicRedirect,
  isCreatorSpace,
  type CreatorHiddenAdminPath,
  type CreatorHiddenPublicPath,
} from '@/lib/creatorSpaces';

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
 * For a player-facing page an in-game clan has and a creator space does not (the roster, weeklies,
 * the coffer, in-game clan events — lib/creatorSpaces CREATOR_HIDDEN_PUBLIC_PATHS): send a visitor
 * to the space's home. `clan` is whatever the page already resolved; an ordinary clan is untouched.
 */
export async function creatorPublicAway(
  path: CreatorHiddenPublicPath,
  clan: { kind?: string | null } | null | undefined,
): Promise<void> {
  if (!isCreatorSpace(clan)) return;
  // The prefix IS the home (`/c/<slug>`). Not clanHref('/'): a bare '/' takes no prefix, so that
  // would land on the apex.
  const to = creatorPublicRedirect(path, clan, await clanPrefix());
  if (to) redirect(to); // clan-prefix: platform -- `to` IS the request's clan prefix (the space's home)
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
