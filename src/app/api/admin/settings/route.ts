import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { sendTestWebhook } from '@/lib/discord';

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhookSetting = await db.query.settings.findFirst({
    where: eq(settings.key, 'discord_webhook_url'),
  });

  return NextResponse.json({
    discord_webhook_url: webhookSetting?.value || '',
  });
}

export async function PUT(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { discord_webhook_url } = await request.json();

  if (discord_webhook_url !== undefined) {
    const existing = await db.query.settings.findFirst({
      where: eq(settings.key, 'discord_webhook_url'),
    });

    if (existing) {
      await db
        .update(settings)
        .set({ value: discord_webhook_url || null })
        .where(eq(settings.key, 'discord_webhook_url'));
    } else {
      await db.insert(settings).values({
        key: 'discord_webhook_url',
        value: discord_webhook_url || null,
      });
    }
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
