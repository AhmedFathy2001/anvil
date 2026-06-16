import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { sendTestWebhook } from '@/lib/discord';

const EXPOSED_KEYS = [
  'discord_webhook_url',
  'discord_webhook_weekly',
  'clan_name',
  'webhook_rare_drops',
  'webhook_deaths',
  'webhook_combat_achievements',
  'always_notify_items',
  'fun_death_messages',
  'death_taunts',
  'spoon_taunts',
] as const;
type ExposedKey = (typeof EXPOSED_KEYS)[number];

async function upsertSetting(key: string, value: string | null) {
  const existing = await db.query.settings.findFirst({
    where: eq(settings.key, key),
  });
  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
}

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, string> = {};
  for (const key of EXPOSED_KEYS) out[key] = map.get(key) || '';
  return NextResponse.json(out);
}

export async function PUT(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Partial<Record<ExposedKey, string | null>>;
  for (const key of EXPOSED_KEYS) {
    const raw = body[key];
    if (raw === undefined) continue;
    const value = typeof raw === 'string' ? raw.trim() : raw;
    await upsertSetting(key, value ? value : null);
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, webhook_url } = await request.json();

  if (action === 'test') {
    if (!webhook_url) {
      return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
    }
    const success = await sendTestWebhook(webhook_url);
    if (success) {
      return NextResponse.json({ success: true, message: 'Test message sent successfully!' });
    } else {
      return NextResponse.json({ error: 'Failed to send test message. Check your webhook URL.' }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
