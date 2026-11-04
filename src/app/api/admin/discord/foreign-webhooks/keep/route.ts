import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { getBotCredentials } from '@/lib/discord-roles';
import { foreignWebhooksOf, readGuildWebhooks } from '@/lib/discordForeignWebhooks';
import { KEPT_WEBHOOKS_KEY, parseKept, toggleKept } from '@/lib/keptWebhooks';
import { getSetting, setSetting } from '@/lib/settings';

// POST { id: string, keep: boolean } — mark one of the server's non-Anvil webhooks as kept (it leaves
// the removal list) or bring it back. Only ids that are this clan's server's foreign webhooks right
// now are accepted, so a forged id can't be stored. Returns { kept: string[] }.
export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: unknown; keep?: unknown } | null;
  const id = typeof body?.id === 'string' && /^\d{1,25}$/.test(body.id) ? body.id : null;
  if (!id || typeof body?.keep !== 'boolean') return NextResponse.json({ error: 'Pick a webhook.' }, { status: 400 });

  const creds = await getBotCredentials(clan.id);
  if (!creds) return NextResponse.json({ error: 'Add the bot to your server first.' }, { status: 400 });
  const read = await readGuildWebhooks(creds.botToken, creds.guildId);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: 400 });
  const inServer = new Set((await foreignWebhooksOf(read)).map((w) => w.id));
  if (!inServer.has(id)) return NextResponse.json({ error: 'Not one of this server’s non-Anvil webhooks any more.' }, { status: 400 });

  const kept = toggleKept(parseKept(await getSetting(clan.id, KEPT_WEBHOOKS_KEY)), id, body.keep, inServer);
  await setSetting(clan.id, KEPT_WEBHOOKS_KEY, JSON.stringify(kept));
  return NextResponse.json({ kept });
}
