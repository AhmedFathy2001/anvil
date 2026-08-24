import { NextResponse } from 'next/server';
import { db } from '@/db';
import { currentClan } from '@/lib/clanContext';
import { clanAuditLog, clanMemberships, clanRoster, verificationAttempts } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, eq } from 'drizzle-orm';
import { claimAccountForPerson } from '@/lib/accountClaim';
import { verifyUser } from '@/lib/auth';
import { fetchHiscoresSnapshot, snapshotXpMap } from '@/lib/hiscores';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';
import { admit } from '@/lib/guestAdmission';

/**
 * POST /api/auth/verify-stat-delta/check { attemptId }
 *
 * Re-fetches Hiscores, compares against the stored baseline, and on success links the character to
 * the person who proved it.
 *
 * TWO STEPS, AND ONLY THE FIRST IS COMPULSORY. Proving you own a character is a fact about you;
 * holding a seat is a fact about a clan. This used to do them as one, behind `requireClan()`, which
 * meant the only way to say who you were was to already be somewhere — the exact thing a new arrival
 * on the apex cannot do. Now the claim always happens and the seat happens when a clan named itself
 * in the URL, which is what doing it from inside a clan means.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });
  }
  // NOT requireClan(). Null on the apex is a legitimate answer here and selects the claim-only path
  // below, rather than 404ing the one flow a clanless person needs most.
  const clan = await currentClan();

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

  // ── The claim. Always, and it involves no clan. ─────────────────────────────────────────────
  //
  // `session.playerId`, not `session.userId`. Both branches of what used to be here wrote
  // `playerId: session.userId` — a LOGIN id into a PERSON column. The sequences diverged long ago
  // (on the preview data not one of sixty logins has id = player_id), so it did not fail: it
  // attached the freshly-proven character to a real, unrelated person.
  const claim = await claimAccountForPerson({
    playerId: session.playerId,
    rsn: attempt.rsn,
    rsnNormalized: attempt.rsnNormalized,
    method: 'stat_delta',
    // Hiscores movement proves somebody logged in and trained. It does not prove WHICH human, so a
    // mod still confirms — the plugin's account hash is the stronger signal and clears this.
    provisional: true,
    actorUserId: session.userId,
  });
  if (!claim.ok) {
    return NextResponse.json({ status: 'failed', reason: 'ownership_conflict' }, { status: 409 });
  }

  // ── The seat. Only where a clan asked. ──────────────────────────────────────────────────────
  if (!clan) {
    return NextResponse.json({
      status: 'succeeded',
      skill: best.skill,
      delta: best.delta,
      provisional: true,
      seated: false,
    });
  }

  // SCOPED TO THIS CLAN, and by ACCOUNT rather than by RSN string. The lookup here was
  // `findRosterSeat(eq(clanRoster.rsnNormalized, …))` with no clan filter at all — so somebody
  // verifying on clan A who held a departed seat on clan B had B's seat found, its `leftAt` cleared
  // and its `lastSeenInClan` stamped, while clan A got nothing and the response said success. That
  // is the same bug lib/auth.ts documents at its own auto-link, fixed there and not here.
  const existing = await findRosterSeat(
    and(eq(clanRoster.clanId, clan.id), eq(clanRoster.accountId, claim.accountId)),
  );

  let clanMemberId: number;
  if (existing) {
    await db
      .update(clanMemberships)
      .set({
        // An admin who removed somebody meant it; proving ownership is not an appeal.
        leftAt: existing.source === 'admin' ? existing.leftAt : null,
        lastSeenInClan: nowIso,
      })
      .where(eq(clanMemberships.id, existing.id));
    clanMemberId = existing.id;
  } else {
    // Linking a character is a claim about WHO YOU ARE, not a claim on this clan's roster. Under the
    // default policy this raises a request instead of seating them — and the account stays linked to
    // them either way, which is what they actually asked for.
    const admission = await admit({ clanId: clan.id, accountId: claim.accountId });
    if (admission.outcome !== 'seated') {
      return NextResponse.json(
        {
          status: 'succeeded',
          skill: best.skill,
          delta: best.delta,
          provisional: true,
          seated: false,
          admission: admission.outcome,
          note:
            admission.outcome === 'refused'
              ? 'Your character is linked. This clan is not taking guests.'
              : 'Your character is linked. Sent to this clan’s staff — you’ll appear once they accept.',
        },
        { status: 202 },
      );
    }
    clanMemberId = admission.seatId;
    await db
      .update(clanMemberships)
      .set({ lastSeenInClan: nowIso })
      .where(eq(clanMemberships.id, clanMemberId));
  }

  db.insert(clanAuditLog)
    .values({
      clanId: clan.id,
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

  // Now that a Discord-authenticated user owns this seat, give them their Discord roles + nickname.
  // Fire-and-forget; no-op if role sync is off.
  syncRolesForClanMemberFireAndForget(clanMemberId);

  return NextResponse.json({
    status: 'succeeded',
    skill: best.skill,
    delta: best.delta,
    provisional: true,
    seated: true,
  });
}
