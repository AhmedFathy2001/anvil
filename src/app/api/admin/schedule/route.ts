import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { listEventIndex } from '@/lib/eventIndex';
import { lifecycleSteps } from '@/lib/eventStage';
import { getEventRow, getStageCounts } from '@/lib/eventStageCounts';
import { atLeast } from '@/lib/clanRoles';

// GET — everything this clan runs, boards and weeklies together, for the admin schedule calendar.
// One shape for both (lib/eventIndex) rather than two lists the client has to reconcile; the
// weekly links land on their admin workspace, not the player page. Any admin/moderator may view.
export async function GET() {
  const user = await verifyUser();
  if (!user || (!atLeast(user.role, 'admin') && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const items = await listEventIndex();
  // Only a dated item can be plotted. The undated ones aren't dropped, though: a board with no
  // dates is exactly what a gap in the calendar is usually waiting for, so it rides along
  // separately and the page can offer to schedule it.
  const dated = items.filter((i) => i.startDate && i.endDate);
  const unscheduled = items.filter((i) => !i.startDate || !i.endDate);

  // What still has to happen before the next thing starts. Boards have a real lifecycle
  // (lib/eventStage) so we reuse it rather than inventing a second idea of "ready"; weeklies are
  // cron-driven and have nothing to prepare, so they get no checklist.
  const now = Date.now();
  const nextBoard = dated
    .filter((i) => i.kind === 'board' && i.status === 'upcoming' && Date.parse(i.startDate!) > now)
    .sort((a, b) => Date.parse(a.startDate!) - Date.parse(b.startDate!))[0];

  let prep: { key: string; steps: ReturnType<typeof lifecycleSteps> } | null = null;
  if (nextBoard) {
    const [row, counts] = await Promise.all([
      getEventRow(nextBoard.id),
      getStageCounts(nextBoard.id),
    ]);
    if (row) {
      prep = {
        key: `board-${nextBoard.id}`,
        // Only the steps that can still be done before the start line — Results and Payouts
        // belong to an event that has already run.
        steps: lifecycleSteps(row, counts, now).filter(
          (s) => s.key !== 'results' && s.key !== 'payouts',
        ),
      };
    }
  }

  return NextResponse.json({ items: dated, unscheduled, prep });
}
