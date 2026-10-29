import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { discordBroadcasts } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { deleteBotMessages, editBotMessage } from '@/lib/discord-broadcast';

/** One past Post to Discord message: edit it in place, or delete it from Discord. Admins only. */

async function scope(idRaw: string) {
  const id = Number(idRaw);
  if (!Number.isInteger(id)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const clan = await requireClan();
  const [row] = await db
    .select()
    .from(discordBroadcasts)
    .where(and(eq(discordBroadcasts.id, id), eq(discordBroadcasts.clanId, clan.id), isNull(discordBroadcasts.deletedAt)))
    .limit(1);
  if (!row) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  return { row, clanId: clan.id } as const;
}

/** { title?, body, asEmbed?, colorHex? } — the channel and the ping stay as they were. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope((await params).id);
  if ('error' in s) return s.error;
  const p = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof p.body !== 'string' || !p.body.trim()) return NextResponse.json({ error: 'Enter a message.' }, { status: 400 });
  const title = typeof p.title === 'string' && p.title.trim() ? p.title.trim() : null;
  const asEmbed = typeof p.asEmbed === 'boolean' ? p.asEmbed : s.row.asEmbed;
  const colorHex = typeof p.colorHex === 'string' ? p.colorHex : s.row.colorHex;

  const report = await editBotMessage({
    clanId: s.clanId,
    channelId: s.row.channelId,
    messageIds: s.row.messageIds,
    title: title ?? undefined,
    body: p.body,
    asEmbed,
    colorHex: colorHex ?? undefined,
  });
  const [row] = await db
    .update(discordBroadcasts)
    .set({ ...(report.ok ? { title, body: p.body, asEmbed, colorHex, editedAt: new Date() } : {}), messageIds: report.messageIds ?? s.row.messageIds })
    .where(eq(discordBroadcasts.id, s.row.id))
    .returning();
  if (!report.ok) return NextResponse.json({ error: report.reason ?? 'Discord would not take the edit.' }, { status: 400 });
  return NextResponse.json({ broadcast: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope((await params).id);
  if ('error' in s) return s.error;
  const r = await deleteBotMessages(s.clanId, s.row.channelId, s.row.messageIds);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
  await db.update(discordBroadcasts).set({ deletedAt: new Date() }).where(eq(discordBroadcasts.id, s.row.id));
  return NextResponse.json({ ok: true });
}
