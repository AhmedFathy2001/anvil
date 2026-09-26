// Who may write which guides. Two axes, kept apart exactly like everything else on the platform:
//
//   LIBRARY guides (clan_id null) — platform authority only. `users.platform_guide_editor`, or
//     platform staff/root. Apex only, and a rejection is a 404, same as the rest of /staff.
//   CLAN guides — that clan's grant only: admins, or a moderator-tier seat with `can_edit_guides`.
//
// Neither implies the other. Writing the library does not let you touch a clan's copy, and running a
// clan does not let you edit the library it copies from. Both are read LIVE from the rows.

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser, type UserPayload } from '@/lib/auth';
import { isApexHost, currentClan, type ClanContext } from '@/lib/clanContext';
import { clanGrant } from '@/lib/clanGrants';
import { hasPlatformRole } from '@/lib/clanRoles';

export interface LibraryActor {
  user: UserPayload;
  /** May edit (staff+, or the guide-editor flag). Support can look but not write. */
  canEdit: boolean;
  /** May grant the guide-editor flag — root, like every other platform grant. */
  canGrant: boolean;
  platformRole: string;
}

/** Can this user write the Anvil library? Pure over the row, for the nav and the guards alike. */
export function canEditLibrary(row: { platformRole?: string | null; platformGuideEditor?: boolean | null }): boolean {
  return row.platformGuideEditor === true || hasPlatformRole(row.platformRole ?? 'none', 'staff');
}

/**
 * The caller as a library author/reader, or null. Null for wrong host, no session, and no authority
 * alike — callers render the same 404 for all three.
 */
export async function libraryActor(): Promise<LibraryActor | null> {
  const host = (await headers()).get('host');
  if (!isApexHost(host)) return null;
  const user = await verifyUser();
  if (!user) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.userId),
    columns: { platformRole: true, platformGuideEditor: true },
  });
  if (!row) return null;
  const canEdit = canEditLibrary(row);
  // Support may read the library's admin view (it is read-only for them); anyone else needs the flag.
  if (!canEdit && !hasPlatformRole(row.platformRole, 'support')) return null;
  return { user, canEdit, canGrant: hasPlatformRole(row.platformRole, 'root'), platformRole: row.platformRole };
}

export async function requireLibraryEditorApi(): Promise<{ actor: LibraryActor } | { response: NextResponse }> {
  const actor = await libraryActor();
  if (!actor || !actor.canEdit) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { actor };
}

export interface ClanGuideActor {
  user: UserPayload;
  clan: ClanContext;
  canEdit: boolean;
}

/** The caller as this clan's guide author, or null. Staff without the capability read only. */
export async function clanGuideActor(): Promise<ClanGuideActor | null> {
  const clan = await currentClan();
  if (!clan) return null;
  const user = await verifyUser();
  if (!user) return null;
  const grant = await clanGrant(clan.id, user.userId);
  const canEdit = grant?.canEditGuides === true || (user.actingAs != null && user.canEditGuides);
  const isStaff = user.role !== 'member' && user.role !== 'editor';
  if (!canEdit && !isStaff) return null;
  return { user, clan, canEdit };
}

export async function requireClanGuideEditorApi(): Promise<{ actor: ClanGuideActor } | { response: NextResponse }> {
  const actor = await clanGuideActor();
  if (!actor) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!actor.canEdit) {
    return { response: NextResponse.json({ error: 'You need guide editing rights in this clan.' }, { status: 403 }) };
  }
  return { actor };
}
