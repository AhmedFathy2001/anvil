import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { userWebhooks } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';

export const dynamic = 'force-dynamic';

// The channel keys a personal destination may ask for — the social notify channels. Clips are not
// here: the plugin posts a clip straight to a webhook the user pasted into it, never through the
// server relay, so a personal clip webhook would never fire.
const KINDS = ['rareDrops', 'deaths', 'combatAchievements', 'pvpKills'] as const;

// A person may hold a handful of destinations, not hundreds — a cap keeps a runaway client honest.
const MAX_WEBHOOKS = 10;

/** POST /api/profile/webhooks — add one of the caller's own destinations. */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!isDiscordWebhookUrl(url)) {
    return NextResponse.json(
      { error: 'That is not a Discord webhook URL. Copy it from a channel’s Integrations → Webhooks.' },
      { status: 400 },
    );
  }

  const kinds = Array.isArray(body.kinds)
    ? body.kinds.filter((k: unknown): k is string => typeof k === 'string' && (KINDS as readonly string[]).includes(k))
    : [];
  if (kinds.length === 0) {
    return NextResponse.json({ error: 'Pick at least one kind of notification to send here.' }, { status: 400 });
  }

  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : null;
  const minRarity =
    body.minRarity == null || body.minRarity === ''
      ? null
      : Math.max(0, Math.floor(Number(body.minRarity) || 0));

  const existing = await db
    .select({ id: userWebhooks.id })
    .from(userWebhooks)
    .where(eq(userWebhooks.userId, session.userId));
  if (existing.length >= MAX_WEBHOOKS) {
    return NextResponse.json({ error: `That is the most webhooks one account can have (${MAX_WEBHOOKS}).` }, { status: 400 });
  }

  const [row] = await db
    .insert(userWebhooks)
    .values({ userId: session.userId, url, label, kinds: JSON.stringify(kinds), minRarity })
    .returning();

  return NextResponse.json({
    ok: true,
    webhook: { id: row.id, url: row.url, label: row.label, kinds, minRarity: row.minRarity },
  });
}
