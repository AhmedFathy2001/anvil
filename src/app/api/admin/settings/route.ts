import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { getSetting, setSetting, getSettingMap } from '@/lib/settings';
import { verifyAdmin } from '@/lib/auth';
import { sendTestWebhook } from '@/lib/discord';

const EXPOSED_KEYS = [
  'discord_webhook_url',
  'discord_webhook_bingo',
  'discord_webhook_weekly',
  'discord_webhook_signups',
  // Display name (site, plugin, Discord posts) vs the exact in-game clan
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
  'webhook_leagues',
  'leagues_icon_url',
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
  // Opt-in: settle collected fees when an event ends (skips the second-admin sign-off).
  'fee_autoconfirm_on_event_end',
  // Whether GET /api/public/showcase serves this clan's name + aggregate counts to the operator's
  // public "clans on Anvil" page. 'on' | 'off' — default on (see getPublicShowcase).
  'public_showcase',
] as const;
type ExposedKey = (typeof EXPOSED_KEYS)[number];

export async function GET() {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only the exposed keys, rather than selecting the whole table and filtering in JS: secrets live
  // in the same table, and reading them into memory to throw them away is a needless exposure.
  const map = await getSettingMap(clan.id, [...EXPOSED_KEYS]);
  const out: Record<string, string> = {};
  for (const key of EXPOSED_KEYS) out[key] = map.get(key) || '';
  return NextResponse.json(out);
}

export async function PUT(request: Request) {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Partial<Record<ExposedKey, string | null>>;
  for (const key of EXPOSED_KEYS) {
    const raw = body[key];
    if (raw === undefined) continue;
    const value = typeof raw === 'string' ? raw.trim() : raw;
    await setSetting(clan.id, key, value ? value : null);
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
