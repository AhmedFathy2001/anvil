import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { getBotCredentials } from '@/lib/discord-roles';
import { currentRouting, foreignWebhooksOf, readGuildWebhooks } from '@/lib/discordForeignWebhooks';

// GET — the server's webhooks that aren't Anvil's (Dink's, usually), plus where Anvil's plugin
// routing points now.
//   200 { enabled: true, ok: true, webhooks: [{ id, name, channelId, channelName }], current: [{ settingKey, channelId, channelName }] }
//   200 { enabled: false }                       — no bot / server connected
//   200 { enabled: true, ok: false, error }      — bot can't read webhooks (missing Manage Webhooks…)
export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const creds = await getBotCredentials(clan.id);
  if (!creds) return NextResponse.json({ enabled: false, ok: false, webhooks: [], current: [] });

  const read = await readGuildWebhooks(creds.botToken, creds.guildId);
  if (!read.ok) return NextResponse.json({ enabled: true, ok: false, error: read.error, webhooks: [], current: [] });

  const [webhooks, current] = await Promise.all([foreignWebhooksOf(read), currentRouting(clan.id, read)]);
  return NextResponse.json({ enabled: true, ok: true, webhooks, current });
}
