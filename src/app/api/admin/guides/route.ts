import { NextResponse } from 'next/server';

import { clanGuideActor, requireClanGuideEditorApi } from '@/lib/guideAccess';
import {
  GuideInputError,
  SHOW_LIBRARY_SETTING,
  copyFromLibrary,
  createGuide,
  guideCard,
  listClanGuides,
  listLibrary,
  pendingUpdates,
  showsLibrary,
} from '@/lib/guides';
import { setSetting } from '@/lib/settings';

// GET — this clan's guides, the library beside them (with what the clan already copied), and the
// library updates waiting on an answer.
export async function GET() {
  const actor = await clanGuideActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clanId = actor.clan.id;
  const [own, library, offers, showLibrary] = await Promise.all([
    listClanGuides(clanId),
    listLibrary(),
    pendingUpdates(clanId),
    showsLibrary(clanId),
  ]);
  const copyOf = new Map(own.filter((g) => g.sourceGuideId).map((g) => [g.sourceGuideId!, g.id]));
  return NextResponse.json({
    canEdit: actor.canEdit,
    showLibrary,
    guides: own.map(guideCard),
    library: library.map((g) => ({ ...guideCard(g), copyId: copyOf.get(g.id) ?? null })),
    offers,
  });
}

// POST — { action: 'create', title, … }, { action: 'copy', sourceId } or { action: 'copyMany', sourceIds }.
export async function POST(request: Request) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const { clan, user } = gate.actor;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    // Adopting the library in one go: copy every listed guide (already-copied ones return their copy).
    if (body.action === 'copyMany') {
      const ids = Array.isArray(body.sourceIds) ? body.sourceIds.map(Number).filter(Number.isInteger).slice(0, 100) : [];
      const copies = [];
      for (const id of ids) copies.push(guideCard(await copyFromLibrary(clan.id, id, user.userId)));
      return NextResponse.json({ guides: copies });
    }
    if (body.action === 'copy') {
      const guide = await copyFromLibrary(clan.id, Number(body.sourceId), user.userId);
      return NextResponse.json({ guide: guideCard(guide) });
    }
    const guide = await createGuide(clan.id, body, user.userId);
    return NextResponse.json({ guide: guideCard(guide) });
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

// PATCH — clan-level guide settings: { showLibrary }.
export async function PATCH(request: Request) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { showLibrary?: unknown } | null;
  if (typeof body?.showLibrary !== 'boolean') return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  await setSetting(gate.actor.clan.id, SHOW_LIBRARY_SETTING, body.showLibrary ? '1' : '0');
  return NextResponse.json({ ok: true });
}
