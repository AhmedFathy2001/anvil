// The piece editors' actors, from the session (for slice 2's routes). The clan is the request's clan
// context (lib/clanContext: the host / path), never anything in the body or query.

import { NextResponse } from 'next/server';

import { clanGuideActor, libraryActor } from '@/lib/guideAccess';

import { clanPieceActorFor, libraryPieceActorFor, type ClanPieceActor, type LibraryPieceActor } from './store';

/** A platform guide editor on the apex, or a 404 (as the rest of /staff). */
export async function requireLibraryPieceEditor(): Promise<{ actor: LibraryPieceActor } | { response: NextResponse }> {
  const lib = await libraryActor();
  const actor = lib?.canEdit ? await libraryPieceActorFor(lib.user.userId) : null;
  return actor ? { actor } : { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
}

/** This clan's guide editor, with the clan taken from the request's clan context. */
export async function requireClanPieceEditor(): Promise<{ actor: ClanPieceActor } | { response: NextResponse }> {
  const c = await clanGuideActor();
  if (!c) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const actor = c.canEdit ? await clanPieceActorFor(c.user.userId, c.clan.id) : null;
  if (!actor) return { response: NextResponse.json({ error: 'You need guide editing rights in this clan.' }, { status: 403 }) };
  return { actor };
}
