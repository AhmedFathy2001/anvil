import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { auditSpacePage, spacePageGuard } from '@/lib/spacePage/guard';
import { setBio, setFeatured, setSchedule, spacePageForAdmin } from '@/lib/spacePage/store';
import { POLICY_NOTE } from '@/lib/spacePage/rules';

export const dynamic = 'force-dynamic';

/**
 * "Your page" in a creator space's settings (lib/spacePage): the bio, the banner's focus, the weekly
 * schedule and the featured clip. Panels and pictures have their own routes beside this one.
 */
export async function GET() {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;
  // clan-scope: this space's own row.
  const row = await db.query.clans.findFirst({ where: eq(clans.id, g.clan.id), columns: { logoUrl: true, bannerUrl: true, bannerPosition: true, name: true } });
  return NextResponse.json({
    ...(await spacePageForAdmin(g.clan.id)),
    name: row?.name ?? g.clan.name,
    logoUrl: row?.logoUrl ?? null,
    bannerUrl: row?.bannerUrl ?? null,
    bannerPosition: row?.bannerPosition ?? null,
    policy: POLICY_NOTE,
  });
}

export async function PATCH(request: Request) {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const changed: string[] = [];
  if ('bio' in body) {
    const r = await setBio(g.clan.id, body.bio);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    changed.push('bio');
  }
  if ('bannerPosition' in body) {
    const pos = body.bannerPosition;
    if (pos !== null && (typeof pos !== 'number' || !Number.isFinite(pos) || pos < 0 || pos > 100)) {
      return NextResponse.json({ error: 'bannerPosition must be a number from 0 to 100, or null' }, { status: 400 });
    }
    await db.update(clans).set({ bannerPosition: pos == null ? null : Math.round(pos) }).where(eq(clans.id, g.clan.id));
    changed.push('bannerPosition');
  }
  if ('schedule' in body) {
    const s = (body.schedule ?? {}) as { tz?: unknown; slots?: unknown };
    const r = await setSchedule(g.clan.id, s.tz, s.slots);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    changed.push('schedule');
  }
  if ('featured' in body) {
    const r = await setFeatured(g.clan.id, body.featured);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    changed.push('featured');
  }
  if (changed.length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  auditSpacePage(g.clan.id, g.actorUserId, 'creator page edited', changed);
  return NextResponse.json({ success: true });
}
