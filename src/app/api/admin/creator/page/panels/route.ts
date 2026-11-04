import { NextResponse } from 'next/server';

import { auditSpacePage, spacePageGuard } from '@/lib/spacePage/guard';
import { createPanel, deletePanel, reorderPanels, setPanelHidden, updatePanel } from '@/lib/spacePage/store';

export const dynamic = 'force-dynamic';

// A creator space's "About" panels (lib/spacePage): up to eight, each a title, plain text, an
// optional still image (an upload through ../media) and an optional https link. Every save goes
// through the wording and link checks in lib/spacePage/rules.

function space(g: { clan: { id: number; slug: string } }) {
  return { id: g.clan.id, slug: g.clan.slug };
}

/** Add one. */
export async function POST(request: Request) {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;
  const body = await request.json().catch(() => null);
  const r = await createPanel(space(g), body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  auditSpacePage(g.clan.id, g.actorUserId, 'panel added', { id: r.value });
  return NextResponse.json({ id: r.value });
}

/** Edit one: { id, title, body, imageUrl, linkUrl, hidden? } — or just { id, hidden } to hide or show it. */
export async function PATCH(request: Request) {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (typeof body.hidden === 'boolean' && !('title' in body)) {
    if (!(await setPanelHidden(g.clan.id, id, body.hidden))) return NextResponse.json({ error: 'That panel is gone.' }, { status: 404 });
    auditSpacePage(g.clan.id, g.actorUserId, body.hidden ? 'panel hidden' : 'panel shown', { id });
    return NextResponse.json({ success: true });
  }
  const r = await updatePanel(space(g), id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  auditSpacePage(g.clan.id, g.actorUserId, 'panel edited', { id });
  return NextResponse.json({ success: true });
}

/** A new order: { ids: [...] }, every panel once. */
export async function PUT(request: Request) {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;
  const body = await request.json().catch(() => null);
  const r = await reorderPanels(g.clan.id, body?.ids);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ success: true });
}

/** ?id= */
export async function DELETE(request: Request) {
  const g = await spacePageGuard();
  if ('error' in g) return g.error;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || !(await deletePanel(g.clan.id, id))) return NextResponse.json({ error: 'That panel is gone.' }, { status: 404 });
  auditSpacePage(g.clan.id, g.actorUserId, 'panel deleted', { id });
  return NextResponse.json({ success: true });
}
