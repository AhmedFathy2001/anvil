import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import type { ClanFocus, ClanRequirements } from '@/lib/clanHome';

/**
 * The clan's public profile — the face a stranger sees at /c/<slug> (lib/clanHome, PublicClanHome).
 *
 * ADMIN only, like the Access tab: what a clan advertises about itself is a clan-level decision, not
 * something a moderator running one event should reword. Separate from /policy because these are
 * cosmetic/discovery fields, not the who-can-see-me gate.
 */

const FOCUS: readonly ClanFocus[] = ['pvm', 'skilling', 'pvp', 'social', 'ironman'];

function cleanRequirements(raw: unknown): ClanRequirements {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: ClanRequirements = {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined);
  const t = num(r.minTotal);
  if (t != null) out.minTotal = t;
  const e = num(r.minEhp);
  if (e != null) out.minEhp = e;
  if (typeof r.region === 'string' && r.region.trim()) out.region = r.region.trim().slice(0, 40);
  if (typeof r.timezone === 'string' && r.timezone.trim()) out.timezone = r.timezone.trim().slice(0, 40);
  return out;
}

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await db.query.clans.findFirst({
    where: eq(clans.id, clan.id),
    columns: { tagline: true, description: true, focus: true, recruiting: true, openToChallenges: true, requirements: true },
  });

  return NextResponse.json({
    tagline: row?.tagline ?? '',
    description: row?.description ?? '',
    focus: Array.isArray(row?.focus) ? row!.focus : [],
    recruiting: row?.recruiting ?? false,
    openToChallenges: row?.openToChallenges ?? false,
    requirements: cleanRequirements(row?.requirements),
  });
}

export async function PATCH(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await verifyUser();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if ('tagline' in body) {
    patch.tagline = typeof body.tagline === 'string' && body.tagline.trim() ? body.tagline.trim().slice(0, 120) : null;
  }
  if ('description' in body) {
    patch.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 2000) : null;
  }
  if ('focus' in body) {
    const focus = Array.isArray(body.focus)
      ? [...new Set(body.focus.filter((f: unknown): f is ClanFocus => typeof f === 'string' && (FOCUS as readonly string[]).includes(f)))]
      : [];
    patch.focus = focus;
  }
  if ('recruiting' in body) patch.recruiting = !!body.recruiting;
  if ('openToChallenges' in body) patch.openToChallenges = !!body.openToChallenges;
  if ('requirements' in body) patch.requirements = cleanRequirements(body.requirements);

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  await db.update(clans).set(patch).where(eq(clans.id, clan.id));

  db.insert(clanAuditLog)
    .values({
      clanId: clan.id,
      eventType: 'clan_profile_changed',
      actorUserId: actor?.userId ?? null,
      newValue: JSON.stringify(Object.keys(patch)),
      notes: 'public clan profile edited',
    })
    .catch(() => {});

  return NextResponse.json({ success: true });
}
