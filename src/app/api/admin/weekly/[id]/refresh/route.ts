import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { clanMembers, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { fetchParticipantStat } from '@/lib/weekly';
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

  const comp = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  if (comp.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participants = await db.select().from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, compId));

  let updated = 0;
  let markedUnranked = 0;
  const errors: string[] = [];
  const unrankedMemberIds = new Set<number>();
  const compType = comp[0].type as 'skill' | 'boss';

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

        // Mirror the cron's implausible-jump flag (see src/lib/gainsValidation.ts).
        if (p.currentValue !== null) {
          const spike = checkRateSpike({
            type: compType,
            metric: comp[0].metric,
            delta: result.value - p.currentValue,
            fromIso: p.lastUpdated,
            toIso: nowIso,
          });
          if (spike.flagged) {
            updates.flagged = 1;
            updates.flagReason = describeRateSpike(compType, spike);
          }
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
    await db.update(clanMembers)
      .set({ status: 'unranked', statusLastChecked: new Date().toISOString() })
      .where(inArray(clanMembers.id, ids));
    markedUnranked = ids.length;
  }

  return NextResponse.json({ updated, markedUnranked, total: participants.length, errors });
}
