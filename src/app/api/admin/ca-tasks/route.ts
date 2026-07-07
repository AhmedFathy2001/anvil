import { NextResponse } from 'next/server';
import { verifyTileEditor } from '@/lib/auth';
import caData from '@/data/combatAchievements.json';

// Serves the bundled Combat Achievement task dataset (src/data/combatAchievements.json, built by
// scripts/build-ca-dataset.mjs) to the admin CA-tile task picker. The full list is small enough
// (~640 tasks) that the client fetches it once and filters locally — no query param needed.
// Admin-only (tile editors). The data is static and version-controlled, so it's cheap to import.

const tasks = (caData.tasks as { name: string; monster: string | null; tier: string; type: string | null }[])
  .map(({ name, monster, tier, type }) => ({ name, monster, tier, type }));

export async function GET() {
  const editor = await verifyTileEditor();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    tiers: caData.tiers,
    tasks,
    generatedAt: (caData as { generatedAt?: string }).generatedAt ?? null,
  });
}
