import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { isClanVisibility } from '@/lib/clanVisibility';
import { isGuestPolicy } from '@/lib/guestAdmission';
import { getSettingMap, setSetting } from '@/lib/settings';

/**
 * Who may see this clan, and how somebody gets in.
 *
 * THESE EXISTED AND COULD NOT BE SET. `clans.visibility`, `clans.guest_policy` and the
 * `public_showcase` setting each shipped with a column, a default and code that reads them — and no
 * way for an admin to change any of them. Three decisions the product asks a clan to make, made
 * once by a migration and then frozen.
 *
 * Two of them are columns on `clans` and one is a settings row, which is why this route exists at
 * all rather than the three joining the key-value settings API: `visibility` and `guest_policy` are
 * read on the hot path (every page load asks whether you may see this clan), and a column is the
 * right home for that. The route hides the split so the page does not have to know.
 *
 * ADMIN, not moderator. Each of these changes who can reach the clan, which is the same class of
 * decision as handing out a staff seat.
 */

const SHOWCASE = 'public_showcase';

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await db.query.clans.findFirst({
    where: eq(clans.id, clan.id),
    columns: { visibility: true, guestPolicy: true },
  });
  const settings = await getSettingMap(clan.id, [SHOWCASE]);

  return NextResponse.json({
    visibility: row?.visibility ?? 'public',
    guestPolicy: row?.guestPolicy ?? 'approval',
    // Absent means on — the same default getPublicShowcase applies.
    listed: (settings.get(SHOWCASE) || 'on') !== 'off',
  });
}

export async function PATCH(request: Request) {
  const clan = await requireClan();
  // `verifyAdmin` answers the gate; the session carries who is doing it, for the audit line below.
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await verifyUser();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  const patch: { visibility?: string; guestPolicy?: string } = {};

  if ('visibility' in body) {
    // Rejected rather than coerced. `clanVisibilityOf` reads anything unrecognised as PRIVATE, so
    // quietly accepting a typo here would hide the clan from everyone and look like a bug in the
    // page rather than in the request.
    if (!isClanVisibility(body.visibility)) {
      return NextResponse.json({ error: 'Visibility must be public or members' }, { status: 400 });
    }
    patch.visibility = body.visibility;
  }

  if ('guestPolicy' in body) {
    if (!isGuestPolicy(body.guestPolicy)) {
      return NextResponse.json({ error: 'Guest policy must be approval, open or closed' }, { status: 400 });
    }
    patch.guestPolicy = body.guestPolicy;
  }

  if (Object.keys(patch).length > 0) {
    await db.update(clans).set(patch).where(eq(clans.id, clan.id));
  }

  if ('listed' in body) {
    await setSetting(clan.id, SHOWCASE, body.listed ? 'on' : 'off');
  }

  // WORTH RECORDING. Turning a clan private, or shutting the door on guests, changes what everybody
  // outside it can see — and the person who wonders why the board stopped being reachable should be
  // able to find out when it changed and who changed it.
  await db
    .insert(clanAuditLog)
    .values({
      clanId: clan.id,
      eventType: 'clan_policy_changed',
      actorUserId: actor?.userId ?? null,
      newValue: JSON.stringify({
        ...patch,
        ...('listed' in body ? { listed: !!body.listed } : {}),
      }),
      notes: 'who may see the clan, and how guests get in',
    })
    .catch(() => {});

  return NextResponse.json({ success: true });
}
