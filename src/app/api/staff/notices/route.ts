import { eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clans, users } from '@/db/schema';
import { createNotice, staffNoticeList, withdrawNotice } from '@/lib/notices';
import { noticeFieldsFrom } from '@/lib/noticeRules';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

export const dynamic = 'force-dynamic';

// Notices from Anvil (lib/notices), written on /staff/notices.

export async function GET() {
  const gate = await requirePlatformApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json({ notices: await staffNoticeList() });
}

/**
 * POST — a new notice. `audience` is 'everyone' | 'admins' | 'supporters' | 'tier:champion' |
 * 'tier:patron' | 'clan' | 'user'; for 'clan' send `clanSlug`, for 'user' send `person` (an Anvil user
 * id or a Discord username), resolved here so the form never has to know ids.
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  let audience = typeof body.audience === 'string' ? body.audience : '';
  if (audience === 'clan') {
    const slug = String(body.clanSlug ?? '').trim().toLowerCase();
    // clan-scope: global -- platform staff picking any clan by its address.
    const clan = slug ? await db.query.clans.findFirst({ where: eq(clans.slug, slug), columns: { id: true } }) : null;
    if (!clan) return NextResponse.json({ error: 'No clan at that address.' }, { status: 400 });
    audience = `clan:${clan.id}`;
  } else if (audience === 'user') {
    const q = String(body.person ?? '').trim().replace(/^@/, '');
    const asId = /^\d{1,9}$/.test(q) ? Number(q) : null;
    const person = q
      ? await db.query.users.findFirst({
          where: asId ? eq(users.id, asId) : or(eq(users.discordUsername, q.toLowerCase()), eq(users.discordId, q)),
          columns: { id: true },
        })
      : null;
    if (!person) return NextResponse.json({ error: 'Nobody on Anvil with that id or Discord username.' }, { status: 400 });
    audience = `user:${person.id}`;
  }

  // Only the fields a notice has, each type-checked; never the request body spread in (lib/noticeRules).
  const input = noticeFieldsFrom(body as Record<string, unknown>, audience);
  const result = await createNotice(input, gate.actor.user.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}

/** PATCH { id, action: 'withdraw' } — take a notice down everywhere (kept for the record). */
export async function PATCH(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (body?.action !== 'withdraw' || !Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  await withdrawNotice(id);
  return NextResponse.json({ ok: true });
}
