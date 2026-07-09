import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, verificationAttempts } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { fetchHiscoresSnapshot, snapshotXpMap } from '@/lib/hiscores';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';

// POST /api/auth/verify-stat-delta/check { attemptId }
// Re-fetches Hiscores, compares against the stored baseline. On success, marks the
// attempt completed and creates/updates the corresponding clan_members row as
// verified-but-provisional (mod must confirm). On failure or expiry, returns a
// status the UI can render.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });
  }

  const rl = await rateLimit(request, 'stat-delta-check', { limit: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many checks — slow down.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { attemptId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const attemptId = Number(body.attemptId);
  if (!Number.isFinite(attemptId) || attemptId <= 0) {
    return NextResponse.json({ error: 'attemptId is required' }, { status: 400 });
  }

  const attempt = await db.query.verificationAttempts.findFirst({
    where: and(
      eq(verificationAttempts.id, attemptId),
      eq(verificationAttempts.userId, session.userId),
    ),
  });
  if (!attempt) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  }

  if (attempt.completedAt) {
    return NextResponse.json({
      status: attempt.succeeded ? 'succeeded' : 'failed',
      reason: attempt.failureReason,
    });
  }

  const nowIso = new Date().toISOString();
  if (new Date(attempt.expiresAt).getTime() <= Date.now()) {
    await db
      .update(verificationAttempts)
      .set({ completedAt: nowIso, succeeded: 0, failureReason: 'expired' })
      .where(eq(verificationAttempts.id, attempt.id));
    return NextResponse.json({ status: 'failed', reason: 'expired' });
  }

  let baselineRaw: Record<string, number | string>;
  try {
    baselineRaw = JSON.parse(attempt.baselineSnapshot);
  } catch {
    return NextResponse.json({ status: 'failed', reason: 'corrupt_baseline' }, { status: 500 });
  }

  // _target is the specific skill the user must train. Older attempts (before this was
  // added) won't have one — fall back to "any skill" so they don't break.
  const targetSkill = typeof baselineRaw._target === 'string' ? baselineRaw._target : null;
  const baseline: Record<string, number> = {};
  for (const [k, v] of Object.entries(baselineRaw)) {
    if (k !== '_target' && typeof v === 'number') baseline[k] = v;
  }

  const snapshot = await fetchHiscoresSnapshot(attempt.rsn);
  if (!snapshot) {
    return NextResponse.json({ status: 'pending', reason: 'hiscores_unavailable' });
  }
  const current = snapshotXpMap(snapshot);

  // Only credit XP gained in the target skill. Coincidental gains in OTHER skills don't
  // count — that's the whole point of the targeted version.
  let best: { skill: string; delta: number } | null = null;
  if (targetSkill) {
    const baseXp = baseline[targetSkill];
    const currentXp = current[targetSkill];
    if (typeof baseXp === 'number' && typeof currentXp === 'number') {
      const delta = currentXp - baseXp;
      if (delta > 0) best = { skill: targetSkill, delta };
    }
  } else {
    // Legacy "any skill" fallback for old attempts that pre-date the targetSkill change.
    for (const [skill, currentXp] of Object.entries(current)) {
      const baseXp = baseline[skill];
      if (typeof baseXp !== 'number') continue;
      const delta = currentXp - baseXp;
      if (delta > 0 && (!best || delta > best.delta)) best = { skill, delta };
    }
  }

  if (!best || best.delta < attempt.minDelta) {
    return NextResponse.json({
      status: 'pending',
      targetSkill,
      bestSkill: best?.skill ?? null,
      bestDelta: best?.delta ?? 0,
      minDelta: attempt.minDelta,
    });
  }

  // Success — mark attempt completed and create/update the clan member.
  await db
    .update(verificationAttempts)
    .set({ completedAt: nowIso, succeeded: 1 })
    .where(eq(verificationAttempts.id, attempt.id));

  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, attempt.rsnNormalized),
  });

  let clanMemberId: number;
  if (existing) {
    if (existing.userId && existing.userId !== session.userId) {
      // Race: ownership changed between start and check. Fail safely.
      return NextResponse.json(
        { status: 'failed', reason: 'ownership_conflict' },
        { status: 409 },
      );
    }
    const claimingGhost = existing.userId == null;
    await db
      .update(clanMembers)
      .set({
        userId: session.userId,
        verifiedAt: nowIso,
        verificationMethod: 'stat_delta',
        provisional: 1,
        claimedAt: claimingGhost ? nowIso : existing.claimedAt,
        leftAt: existing.source === 'manual' ? existing.leftAt : null,
        lastSeenInClan: nowIso,
      })
      .where(eq(clanMembers.id, existing.id));
    clanMemberId = existing.id;
    if (claimingGhost) {
      db.insert(clanAuditLog)
        .values({
          clanMemberId,
          eventType: 'claimed',
          newValue: JSON.stringify({ userId: session.userId, rsn: attempt.rsn }),
          actorUserId: session.userId,
        })
        .catch(() => {});
    }
  } else {
    const inserted = await db
      .insert(clanMembers)
      .values({
        rsn: attempt.rsn,
        rsnNormalized: attempt.rsnNormalized,
        source: 'manual',
        // Verification proves account ownership, not clan membership. Start as a guest;
        // clan-sync promotes to member (isGuest=0) only when the in-game roster includes them.
        isGuest: 1,
        lastSeenInClan: nowIso,
        userId: session.userId,
        verifiedAt: nowIso,
        verificationMethod: 'stat_delta',
        provisional: 1,
        claimedAt: nowIso,
      })
      .returning({ id: clanMembers.id });
    clanMemberId = inserted[0].id;
  }

  // First account becomes primary if user has no other primary.
  const userAccounts = await db.query.clanMembers.findMany({
    where: and(eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)),
    columns: { id: true, isPrimary: true },
  });
  if (!userAccounts.some((a) => a.isPrimary === 1)) {
    await db.update(clanMembers).set({ isPrimary: 1 }).where(eq(clanMembers.id, clanMemberId));
  }

  db.insert(clanAuditLog)
    .values({
      clanMemberId,
      eventType: 'verified',
      newValue: JSON.stringify({
        method: 'stat_delta',
        skill: best.skill,
        delta: best.delta,
        provisional: true,
      }),
      actorUserId: session.userId,
      notes: 'Pending mod confirmation',
    })
    .catch(() => {});

  // Now that a Discord-authenticated user owns this clan member, give them their Discord roles
  // + nickname. Fire-and-forget; no-op if role sync is off. This is why members who verified via
  // XP used to never get their role until an admin ran a manual sweep.
  syncRolesForClanMemberFireAndForget(clanMemberId);

  return NextResponse.json({
    status: 'succeeded',
    skill: best.skill,
    delta: best.delta,
    provisional: true,
  });
}
