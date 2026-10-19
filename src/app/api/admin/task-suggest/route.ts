import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { suggestTasks } from '@/lib/taskSuggest';

// GET /api/admin/task-suggest?q=100 zulrah → ready-to-track tile setups for the editor's
// "What's the task?" box. Tile-authoring support, so editors reach it as well as admins.
export async function GET(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 80);
  return NextResponse.json(await suggestTasks(clan.id, q));
}
