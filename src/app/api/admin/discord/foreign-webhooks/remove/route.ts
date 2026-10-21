import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { foreignWebhooksOf, readGuildWebhooks } from '@/lib/discordForeignWebhooks';
import { log } from '@/lib/logger';

const MAX_IDS = 100;

// POST { ids: string[] } — delete webhooks that aren't Anvil's. The guild's list is re-read first
// and only ids that are in THIS clan's server AND still foreign are deleted, so a stale or forged
// id can never reach another server's webhook or one Anvil posts through.
// Returns { results: [{ id, ok, error? }] }.
export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(payload?.ids)
    ? [...new Set(payload.ids.filter((v): v is string => typeof v === 'string' && /^\d{1,25}$/.test(v)))]
    : [];
  if (ids.length === 0) return NextResponse.json({ error: 'Pick at least one webhook.' }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: `At most ${MAX_IDS} at a time.` }, { status: 400 });

  const creds = await getBotCredentials(clan.id);
  if (!creds) return NextResponse.json({ error: 'Add the bot to your server first.' }, { status: 400 });

  const read = await readGuildWebhooks(creds.botToken, creds.guildId);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: 400 });
  const foreign = new Set((await foreignWebhooksOf(read)).map((w) => w.id));

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    if (!foreign.has(id)) {
      results.push({ id, ok: false, error: 'Not one of this server’s non-Anvil webhooks any more.' });
      continue;
    }
    const res = await discordRest(creds.botToken, `/webhooks/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 404) results.push({ id, ok: true });
    else results.push({ id, ok: false, error: res.status === 403 ? 'The bot isn’t allowed to remove this one.' : `Discord ${res.status}` });
  }

  const user = await verifyUser();
  log.info('discord.foreign-webhooks.removed', {
    clanId: clan.id,
    guildId: creds.guildId,
    userId: user?.userId ?? null,
    removed: results.filter((r) => r.ok).map((r) => r.id),
    failed: results.filter((r) => !r.ok).length,
  });
  return NextResponse.json({ results });
}
