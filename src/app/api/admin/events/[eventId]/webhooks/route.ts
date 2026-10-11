import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { eventWebhooks, teams } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { isEventPostKind, parseEventPostKinds } from '@/lib/eventWebhookKinds';
import { sendEventHookTest } from '@/lib/discord';

/**
 * An event's extra webhooks (lib/eventWebhooks): more channels that get a copy of this board's posts,
 * each picking which kinds, optionally for one team only. Host staff only — a co-host already gets
 * its own copy through the co-host fan-out.
 *
 * The URL is a secret (anyone holding it can post as the hook), so it is only ever echoed back
 * masked, and only Discord webhook URLs are accepted: the server posts to it, and anything else
 * would be a way to make it fetch an arbitrary address.
 */

const MAX_HOOKS_PER_EVENT = 25;

function mask(url: string): string {
  const m = url.match(/\/webhooks\/(\d+)\/([\w-]+)/);
  if (!m) return 'Discord webhook';
  return `…/webhooks/${m[1]}/${m[2].slice(0, 4)}…`;
}

async function scope(eventIdRaw: string) {
  const eventId = Number(eventIdRaw);
  if (!Number.isInteger(eventId)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  const user = await verifyAdminOrModerator();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) } as const;
  const clan = await requireClan();
  const event = await eventInClan(clan.id, eventId);
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  return { eventId, user } as const;
}

function cleanKinds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const kinds = [...new Set(raw.filter(isEventPostKind))];
  return kinds.length > 0 ? kinds : null;
}

/** A team id that belongs to THIS event, or null for "whole event"; false = bad input. */
async function cleanTeam(eventId: number, raw: unknown): Promise<number | null | false> {
  if (raw == null || raw === '') return null;
  if (!Number.isInteger(raw)) return false;
  const row = await db.query.teams.findFirst({
    where: and(eq(teams.id, raw as number), eq(teams.eventId, eventId)),
    columns: { id: true },
  });
  return row ? row.id : false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const rows = await db.select().from(eventWebhooks).where(eq(eventWebhooks.eventId, s.eventId)).orderBy(eventWebhooks.id);
  return NextResponse.json({
    hooks: rows.map((r) => ({
      id: r.id,
      label: r.label,
      teamId: r.teamId,
      kinds: parseEventPostKinds(r.kinds),
      url: mask(r.url),
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // { testId } — send a sample post to one hook so the admin can see it lands.
  if (Number.isInteger(body.testId)) {
    const hook = await db.query.eventWebhooks.findFirst({
      where: and(eq(eventWebhooks.id, body.testId as number), eq(eventWebhooks.eventId, s.eventId)),
    });
    if (!hook) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ok = await sendEventHookTest(s.eventId, hook.url, parseEventPostKinds(hook.kinds), hook.teamId);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'Discord did not accept the test post — check the webhook still exists.' }, { status: 502 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!isDiscordWebhookUrl(url)) {
    return NextResponse.json({ error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/…).' }, { status: 400 });
  }
  const kinds = cleanKinds(body.kinds);
  if (!kinds) return NextResponse.json({ error: 'Pick at least one kind of post.' }, { status: 400 });
  const teamId = await cleanTeam(s.eventId, body.teamId);
  if (teamId === false) return NextResponse.json({ error: 'That team is not on this event.' }, { status: 400 });
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : null;

  const existing = await db.select({ id: eventWebhooks.id }).from(eventWebhooks).where(eq(eventWebhooks.eventId, s.eventId));
  if (existing.length >= MAX_HOOKS_PER_EVENT) {
    return NextResponse.json({ error: `An event can have at most ${MAX_HOOKS_PER_EVENT} extra webhooks.` }, { status: 400 });
  }

  const [row] = await db
    .insert(eventWebhooks)
    .values({ eventId: s.eventId, teamId, url, label, kinds: JSON.stringify(kinds), createdByUserId: s.user.userId })
    .returning();
  return NextResponse.json({ hook: { id: row.id, label: row.label, teamId: row.teamId, kinds, url: mask(row.url) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!Number.isInteger(body.id)) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const set: Partial<typeof eventWebhooks.$inferInsert> = {};
  if ('kinds' in body) {
    const kinds = cleanKinds(body.kinds);
    if (!kinds) return NextResponse.json({ error: 'Pick at least one kind of post.' }, { status: 400 });
    set.kinds = JSON.stringify(kinds);
  }
  if ('teamId' in body) {
    const teamId = await cleanTeam(s.eventId, body.teamId);
    if (teamId === false) return NextResponse.json({ error: 'That team is not on this event.' }, { status: 400 });
    set.teamId = teamId;
  }
  if ('label' in body) set.label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : null;
  if (Object.keys(set).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const [row] = await db
    .update(eventWebhooks)
    .set(set)
    .where(and(eq(eventWebhooks.id, body.id as number), eq(eventWebhooks.eventId, s.eventId)))
    .returning();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ hook: { id: row.id, label: row.label, teamId: row.teamId, kinds: parseEventPostKinds(row.kinds), url: mask(row.url) } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId);
  if ('error' in s) return s.error;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await db.delete(eventWebhooks).where(and(eq(eventWebhooks.id, id), eq(eventWebhooks.eventId, s.eventId)));
  return NextResponse.json({ ok: true });
}
