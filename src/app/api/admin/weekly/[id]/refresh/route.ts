import { NextResponse } from 'next/server';
import { competitionForRequest } from '@/lib/eventScope';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { accounts, clanMemberships, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { fetchParticipantStat, type CompetitionType } from '@/lib/weekly';
import { checkRateSpike, describeRateSpike } from '@/lib/gainsValidation';
import { log } from '@/lib/logger';

// Sequential hiscores fetch for every participant — easily over a minute. Default
// Vercel function timeout is 15 s (Pro) / 10 s (Hobby), so without this the admin
// "Refresh" button gets killed mid-loop.
export const maxDuration = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  const comp = await competitionForRequest(request, compId).then((c) => (c ? [c] : []));
  if (comp.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // { rebaseline: true } resets every participant's baseline to null first; the refresh
  // loop below then backfills baseline = current REAL value. The repair path for a comp
  // whose baselines were poisoned (e.g. a boss the hiscores parser didn't know yet).
  const { rebaseline } = await request.json().catch(() => ({ rebaseline: false }));
  if (rebaseline === true) {
    await db.update(weeklyParticipants)
      .set({ baselineValue: null, currentValue: null, flagged: 0, flagReason: null })
      .where(eq(weeklyParticipants.competitionId, compId));
  }

  const participants = await db.select().from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, compId));

  let updated = 0;
  let markedUnranked = 0;
  const errors: string[] = [];
  const unrankedMemberIds = new Set<number>();
  const compType = comp[0].type as CompetitionType;

  for (const p of participants) {
    try {
      const result = await fetchParticipantStat(p.rsn, compType, comp[0].metric);
      const nowIso = new Date().toISOString();
      if (result.kind === 'value') {
        // Same negative-gains guard as the scheduled cron — refuse to overwrite a higher
        // existing value with a lower one, which is the canonical "someone else has this
        // RSN now" signal.
        if (p.currentValue !== null && result.value < p.currentValue) {
          log.warn('weekly-refresh.negative-gain', {
            rsn: p.rsn,
            competitionId: compId,
            previous: p.currentValue,
            fetched: result.value,
          });
          await db.update(weeklyParticipants)
            .set({ lastUpdated: nowIso })
            .where(eq(weeklyParticipants.id, p.id));
          errors.push(`Negative gain ignored for ${p.rsn}`);
          continue;
        }
        const updates: Record<string, unknown> = {
          currentValue: result.value,
          lastUpdated: nowIso,
        };
        if (p.baselineValue === null) updates.baselineValue = result.value;

        // Mirror the cron's implausible-gain flag — cumulative gain over elapsed comp time, not the
        // per-fetch delta (see src/lib/gainsValidation.ts).
        const baseForGain = p.baselineValue ?? (updates.baselineValue as number | undefined) ?? null;
        if (baseForGain !== null) {
          const spike = checkRateSpike({
            type: compType,
            metric: comp[0].metric,
            gained: result.value - baseForGain,
            sinceIso: comp[0].startDate,
            toIso: nowIso,
          });
          // Reconcile (set OR clear): unlike the auto sweep this is a deliberate admin action, so it
          // also clears a stale flag the check no longer trips — the one-click fix for rows the old
          // per-interval logic false-flagged.
          updates.flagged = spike.flagged ? 1 : 0;
          updates.flagReason = spike.flagged ? describeRateSpike(compType, spike) : null;
        }
        await db.update(weeklyParticipants).set(updates).where(eq(weeklyParticipants.id, p.id));
        updated++;
      } else if (result.kind === 'unranked') {
        if (p.clanMemberId != null) unrankedMemberIds.add(p.clanMemberId);
        await db.update(weeklyParticipants)
          .set({ lastUpdated: nowIso })
          .where(eq(weeklyParticipants.id, p.id));
        errors.push(`Unranked: ${p.rsn}`);
      } else {
        await db.update(weeklyParticipants)
          .set({ lastUpdated: nowIso })
          .where(eq(weeklyParticipants.id, p.id));
        errors.push(`Transient fail: ${p.rsn}`);
      }
    } catch (err) {
      log.warn('weekly-refresh.row-error', { rsn: p.rsn, compId }, err);
      errors.push(`Failed to fetch ${p.rsn}`);
    }
    await delay(1200);
  }

  if (unrankedMemberIds.size > 0) {
    const ids = Array.from(unrankedMemberIds);
    // Seat ids in, account rows out: the status belongs to the account, and a view cannot appear in
    // an UPDATE's WHERE — Postgres rejects the whole statement when it does.
    await db.update(accounts)
      .set({ status: 'unranked', statusLastChecked: new Date().toISOString() })
      .where(
        inArray(
          accounts.id,
          // clan-scope: global -- the id came from a row this request already established, so the clan is settled upstream.
          db.select({ id: clanMemberships.accountId }).from(clanMemberships).where(inArray(clanMemberships.id, ids)),
        ),
      );
    markedUnranked = ids.length;
  }

  return NextResponse.json({ updated, markedUnranked, total: participants.length, errors });
}
