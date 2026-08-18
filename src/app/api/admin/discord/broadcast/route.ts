import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { listBroadcastTargets, sendBotMessage } from '@/lib/discord-broadcast';

// GET — channels the bot can post to + roles it could ping, for the Announce form.
export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await listBroadcastTargets(clan.id);
  return NextResponse.json(data);
}

// POST — send a message (optionally an embed, optionally pinging a role) to a channel.
export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { channelId, title, body, asEmbed, colorHex, mentionRoleId } = payload as Record<string, unknown>;
  if (typeof channelId !== 'string' || !channelId) {
    return NextResponse.json({ error: 'Select a channel.' }, { status: 400 });
  }
  if (typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Enter a message.' }, { status: 400 });
  }

  const report = await sendBotMessage({
    clanId: clan.id,
    channelId,
    title: typeof title === 'string' ? title : undefined,
    body,
    asEmbed: asEmbed !== false, // default to embed
    colorHex: typeof colorHex === 'string' ? colorHex : undefined,
    mentionRoleId: typeof mentionRoleId === 'string' && mentionRoleId ? mentionRoleId : null,
  });

  if (!report.ok) return NextResponse.json({ error: report.reason || 'Send failed' }, { status: 400 });
  return NextResponse.json({ success: true, report });
}
