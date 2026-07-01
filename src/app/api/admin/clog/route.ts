import { NextResponse } from 'next/server';
import { verifyTileEditor } from '@/lib/auth';
import clogData from '@/data/clog.json';

// Serves the bundled collection-log dataset (src/data/clog.json, built by scripts/build-clog-dataset.mjs)
// to the admin "generate tiles from a collection log page" flow.
//   • GET                    → { activities: [{ name, count }] } for the page picker
//   • GET ?activity=<name>   → { activity, items: [{ id, name }] } for the exclusion checklist
// Admin-only (tile editors). The data is static and version-controlled, so it's cheap to import.

const activities = clogData.activities as Record<string, { id: number; name: string }[]>;
// Item IDs the plugin can't drop-track (shop/points/gamble rewards) — see build-clog-dataset.mjs.
const manualOnly = new Set<number>((clogData as { manualOnlyIds?: number[] }).manualOnlyIds ?? []);

export async function GET(request: Request) {
  const editor = await verifyTileEditor();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activityParam = new URL(request.url).searchParams.get('activity');
  if (activityParam) {
    const items = activities[activityParam];
    if (!items) {
      return NextResponse.json({ error: 'Unknown collection log page' }, { status: 404 });
    }
    return NextResponse.json({
      activity: activityParam,
      items: items.map((it) => ({ ...it, manualOnly: manualOnly.has(it.id) })),
    });
  }

  const list = Object.entries(activities)
    .map(([name, items]) => ({
      name,
      count: items.length,
      manualCount: items.filter((it) => manualOnly.has(it.id)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({
    activities: list,
    generatedAt: (clogData as { generatedAt?: string }).generatedAt ?? null,
  });
}
