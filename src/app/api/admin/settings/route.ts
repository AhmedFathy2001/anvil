import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { sendTestWebhook } from '@/lib/discord';
import { getAssociationPush, getFederationEnabled } from '@/lib/pluginConfig';
import { ensureRegisteredWithBroker, pushAllMemberAssociations } from '@/lib/federation';
import { publicOrigin } from '@/lib/request-origin';

const EXPOSED_KEYS = [
  'discord_webhook_url',
  'discord_webhook_bingo',
  'discord_webhook_weekly',
  'discord_webhook_signups',
  // Display name (site, plugin, Discord posts, federation directory) vs the exact in-game clan
  // name the roster sync must report. Independent on purpose — see lib/pluginConfig.ts.
  'clan_name',
  'clan_ingame_name',
  // Public Discord invite shown in the nav + home quick links. Hidden when blank.
  'discord_invite_url',
  // Role pinged on bingo event start/finish posts. Blank = no ping.
  'discord_member_ping_role_id',
  'webhook_rare_drops',
  'webhook_deaths',
  'webhook_combat_achievements',
  'webhook_pvp_kills',
  'webhook_clips',
  'always_notify_items',
  'show_kill_count',
  // Clan-wide floor (1-in-N) on rarity-triggered drop posts; members can be stricter, not looser.
  'drop_rarity_floor',
  'fun_death_messages',
  'death_taunts',
  'spoon_taunts',
  // Discord role/nickname sync (bot-driven). The remaining role-map keys
  // (discord_rank_role_map, discord_default_role_*, discord_guest_role_*) stay
  // out of this whitelist — they need the guild-roles picker, not a plain text box.
  'discord_role_sync_enabled',
  'discord_guild_id',
  'discord_auto_match_rank_by_name',
  'discord_nickname_sync_enabled',
  'discord_nickname_overwrite',
  // Discord team channels (bot-driven, see lib/discord-teams.ts): per-team roles +
  // locked voice/text channels, plus the two shared role IDs every event reuses.
  'discord_team_sync_enabled',
  'discord_bingo_role_id',
  'discord_captain_role_id',
  // Advisory flag set when the owner finishes (or dismisses) the first-run Setup wizard.
  // Gates the auto-open + dashboard checklist only; real step status is computed live in
  // lib/setupStatus.ts.
  'setup_completed',
  // How many distinct staff confirmations a paid fee needs before it settles (default 1).
  'fee_confirmations_required',
  // Federation scalars (docs/FEDERATION.md). Enums/bool/JSON stored as text; read back via the
  // typed helpers in lib/pluginConfig.ts. The signing key, instance id and broker verification
  // token are deliberately NOT here — the signing private key must never be API-readable.
  'federation_shared_credit', // 'accept' | 'exclusive'
  'federation_exchange_policy', // 'auto-guest' | 'request-to-join' | 'reject'
  'federation_association_push', // 'on' | '' (off)
  'federation_broker_trust', // JSON array of { iss, jwksUrl }
  // Site-relayed federation (WIRE §10). The master switch; the inbound-relayed-write kill-switch; and
  // an optional broker-URL override (server-side config, admin-only — NEVER surfaced to any plugin).
  'federation_enabled', // 'on' | '' (off) — master switch
  'federation_accept_writes', // 'on' | 'off' — accept INBOUND cross-clan relayed credit writes (default on)
  'federation_broker_url', // optional override of the FEDERATION_BROKER_URL env default
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

  // Snapshot the prior federation state so we can detect the transitions that need broker work.
  const wasFederationEnabled = await getFederationEnabled();
  const wasAssociationPush = await getAssociationPush();

  const body = (await request.json()) as Partial<Record<ExposedKey, string | null>>;
  for (const key of EXPOSED_KEYS) {
    const raw = body[key];
    if (raw === undefined) continue;
    const value = typeof raw === 'string' ? raw.trim() : raw;
    await upsertSetting(key, value ? value : null);
  }

  // Broker reconcile (WIRE §10.1). Registering tells the broker we're here and — the part that
  // silently matters — adds it to brokerTrust[], which is what lets other clans' relayed /exchange
  // calls be accepted at all.
  //
  // This used to fire ONLY on the off→on edge, which made a failed enable permanent: an instance
  // whose one register attempt failed (broker down, or FEDERATION_BROKER_URL missing from the
  // container at the time) was left federation-on with an empty trust list, 403ing every inbound
  // exchange, with no way for an admin to retry. The whole call is idempotent — the broker upserts
  // and the trust entry dedupes — so ANY save that leaves federation on now re-asserts it, and
  // re-saving the Federation tab is a real repair. Best-effort + fire-and-forget throughout: a broker
  // hiccup must never fail saving settings.
  const touchedFederation =
    body.clan_name !== undefined || EXPOSED_KEYS.some((k) => k.startsWith('federation_') && body[k] !== undefined);
  const nowEnabled = await getFederationEnabled();

  if (nowEnabled) {
    if (touchedFederation) {
      void ensureRegisteredWithBroker(publicOrigin(request)).catch(() => {});
    }
    // Advertise the whole roster when the clan (re-)joins the network, and equally when it turns
    // "make this clan easy to find" on while already federated — that consent is what association
    // push waits for, and without a backfill here nobody is advertised until their next login.
    const joined = !wasFederationEnabled;
    const startedSharing = (await getAssociationPush()) && !wasAssociationPush;
    if (joined || startedSharing) {
      void pushAllMemberAssociations().catch(() => {});
    }
  } else if (body.federation_enabled !== undefined) {
    // Leaving the network: tell the broker to stop advertising us and retract our member
    // associations. Fires on EVERY off-save (not just the transition) so a re-save can repair a
    // missed/failed notify; idempotent + fire-and-forget broker-side. The inbound federation
    // routes also refuse while disabled, so other homes drop us even before the broker syncs.
    void ensureRegisteredWithBroker(publicOrigin(request), 'off').catch(() => {});
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
