import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { resolveClanFromRequest } from '@/lib/clanContext';
import {
  addPracticePlaceholders,
  addPracticeTilesFromBoard,
  deletePracticeBoard,
  dropPracticePlaceholders,
  endPracticeBoard,
  grantPracticeEditor,
  lowerPracticeTarget,
  practiceBoardInClan,
  PracticeError,
  resetPracticeProgress,
  resetPracticeTile,
} from '@/lib/practice';
import { PRACTICE_MAX_TILES, practiceRunning } from '@/lib/practiceRules';
import { postEventRules } from '@/lib/eventRulesPost';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// POST /api/admin/practice/<id> — the practice board's controls (lib/practice), by `action`:
//   reset                      every tile starts over
//   resetTile   { tileId }     one tile starts over
//   lower       { tileId, to } the practice copy's target goes down
//   addFromBoard { boardId, tileIds }   copy more tiles from one of the clan's boards
//   addBlank    { count }      blank tiles the library import fills (then `filled`)
//   filled                     the import is done: unfilled blanks go, the rules card posts
//   end                        end it now
//   delete                     delete it now (otherwise the sweep does, 7 days after it ends)
//
// Admins of THIS clan only, on THIS clan's practice board only. A helper on the board can view it
// (the page) but reaches none of this.

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const clan = await resolveClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const found = await practiceBoardInClan(clan.id, Number((await params).eventId));
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { event } = found;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;
  const running = practiceRunning(event);
  try {
    switch (action) {
      case 'delete':
        await deletePracticeBoard(event.id);
        return NextResponse.json({ ok: true, deleted: true });
      case 'end':
        if (running) await endPracticeBoard(event.id);
        return NextResponse.json({ ok: true });
    }
    // Everything else changes play, which an ended board no longer has.
    if (!running) return NextResponse.json({ error: 'This practice board has ended.' }, { status: 409 });
    switch (action) {
      case 'reset':
        await resetPracticeProgress(event.id);
        return NextResponse.json({ ok: true });
      case 'resetTile':
        await resetPracticeTile(event.id, Number(body.tileId));
        return NextResponse.json({ ok: true });
      case 'lower': {
        const to = Number(body.to);
        if (!Number.isInteger(to) || to < 1) return NextResponse.json({ error: 'Pick a number of at least 1.' }, { status: 400 });
        return NextResponse.json({ ok: true, ...(await lowerPracticeTarget(event.id, Number(body.tileId), to)) });
      }
      case 'addFromBoard': {
        const ids = Array.isArray(body.tileIds) ? body.tileIds.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
        if (ids.length === 0 || ids.length > PRACTICE_MAX_TILES) return NextResponse.json({ error: 'Pick some tiles.' }, { status: 400 });
        const added = await addPracticeTilesFromBoard(clan.id, event, Number(body.boardId), [...new Set(ids)]);
        return NextResponse.json({ ok: true, added });
      }
      case 'addBlank': {
        const n = Number(body.count);
        if (!Number.isInteger(n) || n < 1 || n > PRACTICE_MAX_TILES) return NextResponse.json({ error: 'Pick some tiles.' }, { status: 400 });
        await addPracticePlaceholders(event, n);
        // The import route authors tiles as a board editor: this admin gets the grant on this board.
        await grantPracticeEditor(event.id, session.userId);
        return NextResponse.json({ ok: true });
      }
      case 'filled':
        await dropPracticePlaceholders(event.id);
        if (found.board.webhookUrl) postEventRules(event.id, clan.id).catch((e) => log.warn('practice.rules-post-failed', { eventId: event.id }, e));
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof PracticeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
