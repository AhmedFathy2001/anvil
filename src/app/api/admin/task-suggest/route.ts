import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { starterTasks, suggestTasks } from '@/lib/taskSuggest';

// GET /api/admin/task-suggest?q=100 zulrah → ready-to-track tile setups for the tile creator and the
// editor's "What's the task?" box. ?starters=1 → a few tasks off the clan's past boards (its library)
// for the creator's start screen. Tile-authoring support, so editors reach it as well as admins.
export async function GET(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const params = new URL(request.url).searchParams;
  if (params.get('starters') === '1') return NextResponse.json(await starterTasks(clan.id));
  const q = (params.get('q') ?? '').slice(0, 120);
  return NextResponse.json(await suggestTasks(clan.id, q));
}
