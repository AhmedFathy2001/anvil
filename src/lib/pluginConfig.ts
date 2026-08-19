import { db } from '@/db';
import { events, tiles, weeklyCompetitions, settings } from '@/db/schema';
import { count, eq, inArray } from 'drizzle-orm';
import { BOSSES, COUNTER_TARGETS, FUN_DEATH_MESSAGES, weeklyMetricLabel } from '@/lib/constants';
import { DEFAULT_TIER_BANDS, normalizeTierBands, type TierBand } from '@/lib/tileFilter';
import { getItemMapping } from '@/lib/osrsItems';

// Shared builders for the plugin's read-bootstrap. These back both the standalone
// /api/plugin/schedule and /api/plugin/active-weekly routes (kept for older jars) and
// the merged GET /api/plugin/config response, so every consumer gets an identical shape.

export interface ScheduleBingo {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming';
  boardSize: number | null;
  tileCount: number;
  // Lets the plugin pick the right in-game view without a second fetch:
  //   format='tilerace' → race track; format='bingo' + scoringMode='points' → accordion;
  //   format='bingo' + scoringMode='tiles' → square grid.
  format: string;
  scoringMode: string;
}

export interface ScheduleWeekly {
  id: number;
  title: string;
  type: string;
  metric: string;
  /** The metric as a person writes it ("Phosani's Nightmare") — see weeklyMetricLabel. */
  metricLabel: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface PluginSchedule {
  bingos: ScheduleBingo[];
  weeklies: ScheduleWeekly[];
}

const SCHEDULE_CAP = 10;

// Active + upcoming bingo events and weekly competitions, sorted by start, capped so we
// don't ship the whole archive. Mirrors the original /api/plugin/schedule behavior.
export async function buildSchedule(): Promise<PluginSchedule> {
  const nowIso = new Date().toISOString();

  const [allEvents, allWeeklies] = await Promise.all([
    db.select().from(events),
    db.select().from(weeklyCompetitions),
  ]);

  const bingoCandidates = allEvents.filter(
    (e) => e.startDate && e.endDate && e.endDate > nowIso && !e.forceEndedAt,
  );

  // Tile counts per event in one query — avoids N+1 against the tiles table.
  const tileCountMap = new Map<number, number>();
  if (bingoCandidates.length > 0) {
    const tileCounts = await db
      .select({ eventId: tiles.eventId, count: count() })
      .from(tiles)
      .where(inArray(tiles.eventId, bingoCandidates.map((e) => e.id)))
      .groupBy(tiles.eventId);
    for (const row of tileCounts) tileCountMap.set(row.eventId, row.count);
  }

  const bingos: ScheduleBingo[] = bingoCandidates.map((e) => ({
    id: e.id,
    title: e.name,
    startDate: e.startDate!,
    endDate: e.endDate!,
    status: e.startDate! > nowIso ? 'upcoming' : 'active',
    boardSize: e.boardSize,
    tileCount: tileCountMap.get(e.id) ?? 0,
    format: e.format,
    scoringMode: e.scoringMode,
  }));

  const weeklies: ScheduleWeekly[] = allWeeklies
    .filter((w) => w.endDate > nowIso && w.status !== 'completed')
    .map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      metric: w.metric,
      metricLabel: weeklyMetricLabel(w.type, w.metric),
      status: w.status,
      startDate: w.startDate,
      endDate: w.endDate,
    }));

  const sortByStart = (a: { startDate: string }, b: { startDate: string }) =>
    a.startDate.localeCompare(b.startDate);

  bingos.sort(sortByStart);
  weeklies.sort(sortByStart);

  return {
    bingos: bingos.slice(0, SCHEDULE_CAP),
    weeklies: weeklies.slice(0, SCHEDULE_CAP),
  };
}

export interface ActiveWeekly {
  id: number;
  title: string;
  type: string;
  metric: string;
  metricLabel: string;
  startDate: string;
  endDate: string;
}

// The single live weekly competition (status = 'active'), or null. Mirrors the original
// /api/plugin/active-weekly behavior. Used by the plugin to decide auto-enroll on login.
export async function getActiveWeekly(): Promise<ActiveWeekly | null> {
  const active = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.status, 'active'),
  });
  if (!active) return null;
  return {
    id: active.id,
    title: active.title,
    type: active.type,
    metric: active.metric,
    metricLabel: weeklyMetricLabel(active.type, active.metric),
    startDate: active.startDate,
    endDate: active.endDate,
  };
}

export interface ActiveWeeklyMetric {
  id: number;
  type: 'skill' | 'boss' | 'efficiency';
  metric: string;
  startDate: string; // comp start — the elapsed-time anchor for the implausible-gain check
}

// EVERY live weekly competition's tracked metric — a SOTW and a BOTW can run at once, so this returns
// all `status='active'` comps (unlike getActiveWeekly's single). Used to (a) tell the plugin which
// skill/boss to push live via trackedKcNames/trackedSkillNames, and (b) credit live weekly gains in
// the plugin-stats ingest.
export async function getActiveWeeklyMetrics(): Promise<ActiveWeeklyMetric[]> {
  const rows = await db.query.weeklyCompetitions.findMany({
    where: eq(weeklyCompetitions.status, 'active'),
  });
  return rows.map((c) => ({
    id: c.id,
    type: c.type as 'skill' | 'boss' | 'efficiency',
    metric: c.metric,
    startDate: c.startDate,
  }));
}

export interface PluginWebhooks {
  // Discord webhook URLs the plugin posts to directly. Null when unset on the site.
  rareDrops: string | null;
  deaths: string | null;
  combatAchievements: string | null;
  pvpKills: string | null;
  clips: string | null;
  /** Seasonal (Leagues) worlds: every notification from one routes here instead of the above. */
  leagues: string | null;
}

export const WEBHOOK_SETTING_KEYS = [
  'webhook_rare_drops',
  'webhook_deaths',
  'webhook_combat_achievements',
  'webhook_pvp_kills',
  'webhook_clips',
  'webhook_leagues',
] as const;

// Plugin-posted notification destinations, read from the settings key/value table.
export async function getNotificationWebhooks(): Promise<PluginWebhooks> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, [...WEBHOOK_SETTING_KEYS]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    rareDrops: map.get('webhook_rare_drops') || null,
    deaths: map.get('webhook_deaths') || null,
    combatAchievements: map.get('webhook_combat_achievements') || null,
    pvpKills: map.get('webhook_pvp_kills') || null,
    clips: map.get('webhook_clips') || null,
    leagues: map.get('webhook_leagues') || null,
  };
}

// Newline-separated list settings the plugin reads. Edited on Admin → Integrations.
export const FUN_DEATHS_SETTING_KEY = 'fun_death_messages';
export const DEATH_TAUNTS_SETTING_KEY = 'death_taunts';
export const SPOON_TAUNTS_SETTING_KEY = 'spoon_taunts';
export const ALWAYS_NOTIFY_SETTING_KEY = 'always_notify_items';

// Reads a settings value stored as one entry per line, trimmed and blank-filtered.
async function getLineSetting(key: string): Promise<string[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (!row?.value) return [];
  return row.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Server-managed 1/100 fun-death pool. Admin-editable; falls back to the curated constant when
// the clan hasn't set its own.
export async function getFunDeathMessages(): Promise<string[]> {
  const custom = await getLineSetting(FUN_DEATHS_SETTING_KEY);
  return custom.length ? custom : FUN_DEATH_MESSAGES;
}

// Admin-set reaction lines appended to death / lucky-drop posts. Empty = use the plugin's baked-in
// defaults (the plugin substitutes its own list when these are empty).
export async function getDeathTaunts(): Promise<string[]> {
  return getLineSetting(DEATH_TAUNTS_SETTING_KEY);
}

export async function getSpoonTaunts(): Promise<string[]> {
  return getLineSetting(SPOON_TAUNTS_SETTING_KEY);
}

// Admin-managed list of item names that always post to the rare-drops channel (prestige drops
// the value/rarity thresholds miss). EXTENDS the plugin's baked-in defaults — the plugin unions
// both lists — so this only needs to hold extras (e.g. new ornament kits). One name per line.
export async function getAlwaysNotifyItems(): Promise<string[]> {
  return getLineSetting(ALWAYS_NOTIFY_SETTING_KEY);
}

// Prestige/notable items that ALWAYS post to the rare-drop channel — resolved to item ids so the plugin
// matches by ID (reliable for untradeables like a ToA Cursed phalanx that have no GE value to gate on and
// only ever matched by a fragile name compare). MIRRORS the plugin's baked-in ALWAYS_NOTIFY_FALLBACK
// (AnvilPlugin.java) — keep the two in sync; admins extend it via the always_notify_items setting.
const NOTABLE_ITEM_PATTERNS = [
  'infernal cape', "dizana's quiver", 'purifying sigil',
  'ancient blood ornament kit', 'sanguine ornament kit', 'holy ornament kit', 'sanguine dust',
  'metamorphic dust', 'twisted ancestral colour kit',
  'menaphite ornament kit', 'cursed phalanx', 'masori crafting kit',
  'vestige', 'quartz', "executioner's axe head", 'eye of the duke', "leviathan's lure", "siren's staff",
  'jar of', 'champion scroll', "champion's cape", 'enhanced crystal', 'blood shard', 'fire cape',
];

let notableIdCache: { ids: number[]; at: number; key: string } | null = null;
const NOTABLE_ID_TTL_MS = 5 * 60_000;

// Substring-resolve the notable name patterns (baked-in + admin) to the set of matching item ids — the same
// `.contains()` semantics the plugin used on names. Cached briefly (the list is essentially static); on an
// item-data outage it degrades to the last good set (or empty), and the plugin's name allowlist still covers.
export async function getAlwaysNotifyItemIds(): Promise<number[]> {
  const admin = await getLineSetting(ALWAYS_NOTIFY_SETTING_KEY);
  const patterns = [...NOTABLE_ITEM_PATTERNS, ...admin.map((s) => s.toLowerCase()).filter(Boolean)];
  const key = patterns.join('');
  if (notableIdCache && notableIdCache.key === key && Date.now() - notableIdCache.at < NOTABLE_ID_TTL_MS) {
    return notableIdCache.ids;
  }
  let items;
  try {
    items = await getItemMapping();
  } catch {
    return notableIdCache?.ids ?? [];
  }
  const ids = new Set<number>();
  for (const it of items) {
    const n = it.name.toLowerCase();
    for (const p of patterns) {
      if (p && n.includes(p)) {
        ids.add(it.id);
        break;
      }
    }
  }
  const out = [...ids];
  notableIdCache = { ids: out, at: Date.now(), key };
  return out;
}

// Whether rare-drop posts include the boss/raid kill count the drop landed on. Default on; the
// admin can switch it off from Admin → Integrations. Stored as the string 'off' when disabled.
export const SHOW_KILL_COUNT_SETTING_KEY = 'show_kill_count';

export async function getShowKillCount(): Promise<boolean> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, SHOW_KILL_COUNT_SETTING_KEY),
  });
  return row?.value !== 'off';
}

// Clan-wide floor on rarity-triggered drop posts, as 1-in-N. Members set their own threshold in the
// plugin, but a single member on a loose setting is enough to fill the channel with herb rolls off
// an ordinary slayer task — so the clan's floor wins where it's stricter (the plugin takes the max).
// Unset means "no clan floor"; the plugin's own default (1/10,000) then applies.
export const DROP_RARITY_FLOOR_SETTING_KEY = 'drop_rarity_floor';
export const DEFAULT_DROP_RARITY_FLOOR = 10_000;

export async function getDropRarityFloor(): Promise<number> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, DROP_RARITY_FLOOR_SETTING_KEY),
  });
  const parsed = Number(row?.value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DROP_RARITY_FLOOR;
  // Never below the plugin's own hard minimum — a "floor" that loosens the gate would be a trap.
  return Math.max(1000, Math.round(parsed));
}

// --- Clan naming ----------------------------------------------------------------------------
// Two independent names, because the two jobs are different:
//   clan_name        — the DISPLAY name. What the site, the plugin sidebar, Discord posts and the
//                      federation directory call this clan. Free-form; rename at will.
//   clan_ingame_name — the EXACT in-game clan name, used only to gate the plugin's roster sync
//                      (/api/plugin/clan-sync). Blank = accept a sync from any clan.
// A clan whose OSRS clan is "Anvl CC" can therefore present itself as "The Anvil" everywhere.
export const CLAN_NAME_SETTING_KEY = 'clan_name';
export const CLAN_INGAME_NAME_SETTING_KEY = 'clan_ingame_name';

// The clan's display name — plugin sidebar (clan filter label + logged-out home card), the web
// home hero, guides, Discord posts, the federation directory. Resolution: settings row, provisioner
// env, caller-supplied fallback (pages use softer prose fallbacks like "your clan").
export async function getClanDisplayName(fallback = 'Anvil'): Promise<string> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, CLAN_NAME_SETTING_KEY) });
  return row?.value?.trim() || process.env.CLAN_NAME?.trim() || fallback;
}

// The exact in-game clan name the plugin's roster-sync payload must report. Null = unset, which
// means "accept a roster sync from whatever clan the admin is in".
//
// Deliberately does NOT fall back to clan_name: once the display name is free to drift from the
// in-game one, silently gating on it would reject every sync after a rename. Existing installs are
// backfilled from clan_name at boot (scripts/migrate.mjs) so their gate survives this split, and an
// admin who clears the field is opting into "any clan" on purpose.
export async function getInGameClanName(): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, CLAN_INGAME_NAME_SETTING_KEY),
  });
  return row?.value?.trim() || process.env.CLAN_INGAME_NAME?.trim() || null;
}

// Difficulty-tier bands (points → tier), stored as a JSON array under this key. Admin-editable so
// the bands can be retuned/renamed/added without a web *or* plugin release; served to the plugin
// in /api/plugin/config + /api/plugin/board and used by the web filters. Falls back to the curated
// default when unset or malformed.
export const TIER_BANDS_SETTING_KEY = 'tier_bands';

export async function getTierBands(): Promise<TierBand[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, TIER_BANDS_SETTING_KEY) });
  if (!row?.value) return DEFAULT_TIER_BANDS;
  try {
    const bands = normalizeTierBands(JSON.parse(row.value));
    return bands.length ? bands : DEFAULT_TIER_BANDS;
  } catch {
    return DEFAULT_TIER_BANDS;
  }
}

// ---------------------------------------------------------------------------
// Federation scalars (see docs/FEDERATION.md). Edited on Admin → Integrations;
// consumed by /api/federation/v1/* and (at L2) the /exchange + /events tracks.
// ---------------------------------------------------------------------------
export const FEDERATION_SHARED_CREDIT_KEY = 'federation_shared_credit';
export const FEDERATION_EXCHANGE_POLICY_KEY = 'federation_exchange_policy';
export const FEDERATION_ASSOCIATION_PUSH_KEY = 'federation_association_push';
export const FEDERATION_BROKER_TRUST_KEY = 'federation_broker_trust';
// Master site-relayed-federation switch (WIRE §10.1). 'on' | '' (off). One toggle federates every
// member of the clan; on enable the site registers with the broker and starts relaying. Read by the
// plugin-facing /api/plugin/federation/* endpoints; NEVER exposes the broker URL to the plugin.
export const FEDERATION_ENABLED_KEY = 'federation_enabled';
// Optional broker-URL override (WIRE §10.1). The broker URL is SERVER-SIDE config: env
// FEDERATION_BROKER_URL is the default (the pinned Anvil broker); this setting overrides it for a
// self-hoster pointing at a different broker. Deliberately server-side only — it is NEVER returned to
// the plugin (the plugin only ever calls its own home site).
export const FEDERATION_BROKER_URL_KEY = 'federation_broker_url';
// Per-clan opt-out for INBOUND relayed (cross-clan) credit writes (FEDERATION_SECURITY.md §3/priority
// #1). Default ON. When '' (off), POST /events refuses any relayed write from another home with a
// clean { credited:false, reason:'federation-writes-disabled' } — the clan still reads boards but takes
// no federated credit. A clan that trusts nobody's relay flips this off.
export const FEDERATION_ACCEPT_WRITES_KEY = 'federation_accept_writes';

export type SharedCredit = 'accept' | 'exclusive';
export type ExchangePolicy = 'auto-guest' | 'request-to-join' | 'reject';
export interface BrokerTrust {
  iss: string; // broker id / base URL (must match assertion `iss` at L2)
  jwksUrl: string; // where to fetch the broker's signing keys
}

// Cross-clan crediting opt-out (decision 1, WIRE §5). Default 'accept'. Read by POST /events, which
// rejects fanout.count > 1 with `200 {credited:false, reason:"exclusive"}` when set to 'exclusive'.
export async function getSharedCredit(): Promise<SharedCredit> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, FEDERATION_SHARED_CREDIT_KEY) });
  return row?.value === 'exclusive' ? 'exclusive' : 'accept';
}

// Guest-on-exchange policy (decision 4). Default 'auto-guest'. POST /exchange branches on this when
// the asserted discord_id isn't a member: auto-guest (inert guest + board:read token) / request-to-join
// (pending, no token) / reject (403).
export async function getExchangePolicy(): Promise<ExchangePolicy> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, FEDERATION_EXCHANGE_POLICY_KEY) });
  const v = row?.value;
  return v === 'request-to-join' || v === 'reject' ? v : 'auto-guest';
}

// Whether this instance tells the broker "discord_id X is a member here" (decision 2). Default OFF
// (self-host sovereignty); a clan we HOST is seeded 'on' at first boot instead — see
// seedManagedDefaults() in scripts/migrate.mjs, which writes the row only when it's absent, so a
// hosted clan that opts back out stays out. The outbound /assoc push
// (federation.ts pushAssociation, fired from /exchange and /token) is gated on this flag.
export async function getAssociationPush(): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, FEDERATION_ASSOCIATION_PUSH_KEY) });
  return row?.value === 'on';
}

// Brokers this instance trusts (WIRE §7). Stored as a JSON array of { iss, jwksUrl }. Empty = trust
// no broker (L2 disabled). Malformed entries are dropped rather than throwing. POST /exchange requires
// the assertion `iss` to be present here (and reads the matching jwksUrl to validate the signature).
export async function getBrokerTrust(): Promise<BrokerTrust[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, FEDERATION_BROKER_TRUST_KEY) });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (b): b is BrokerTrust =>
          !!b && typeof b.iss === 'string' && b.iss.length > 0 && typeof b.jwksUrl === 'string' && b.jwksUrl.length > 0,
      )
      .map((b) => ({ iss: b.iss, jwksUrl: b.jwksUrl }));
  } catch {
    return [];
  }
}

// Master site-relayed-federation switch (WIRE §10.1). Default OFF for a self-host; a clan we HOST is
// seeded 'on' at first boot (scripts/migrate.mjs seedManagedDefaults), because one connected network
// is what the hosted product sells. When on, the plugin-facing /api/plugin/federation/* endpoints
// relay to the broker + other clan sites server-to-server.
export async function getFederationEnabled(): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, FEDERATION_ENABLED_KEY) });
  return row?.value === 'on';
}

// Whether this clan accepts INBOUND relayed cross-clan credit writes (FEDERATION_SECURITY.md §3).
// Default ON — absent setting ⇒ accept. Only an explicit '' (off) opts the clan out.
export async function getAcceptFederatedWrites(): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, FEDERATION_ACCEPT_WRITES_KEY) });
  const v = row?.value; // default (no row) = accept; explicit '' / 'off' = opt out
  return v !== '' && v !== 'off';
}

// --- Public showcase listing ------------------------------------------------------------------
// Opt-OUT flag for the "Clans on Anvil" page on the Anvil site (anvilosrs.com/clans): when on, the
// unauthenticated GET /api/public/showcase serves this clan's name + a handful of aggregate counts
// so the operator's page can show who actually runs Anvil. Never any member, RSN or Discord data —
// see the route for the exact payload.
//
// Default ON (absent row ⇒ listed), because the page only ever reaches instances the operator hosts
// or that already advertise themselves in the federation directory. Stored as the explicit strings
// 'on'/'off': the settings PUT folds '' to NULL, which would read back as the default.
export const PUBLIC_SHOWCASE_KEY = 'public_showcase';

export async function getPublicShowcase(): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, PUBLIC_SHOWCASE_KEY) });
  const v = row?.value; // default (no row) = listed; explicit 'off' opts out
  return v !== 'off';
}

// Resolve the broker base URL (server-side ONLY — never sent to the plugin; WIRE §10.1). A DB setting
// override wins (self-hoster pointing elsewhere), else the FEDERATION_BROKER_URL env default (the
// pinned Anvil broker). Trailing slashes trimmed. Null when neither is set (federation can't connect).
export async function getBrokerBaseUrl(): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, FEDERATION_BROKER_URL_KEY) });
  const raw = (row?.value?.trim() || process.env.FEDERATION_BROKER_URL?.trim() || '').replace(/\/+$/, '');
  return raw || null;
}

/**
 * Activity names to probe when importing a member's existing personal bests.
 *
 * RuneLite's chat-commands plugin stores each best under `personalbest.<rsprofile>.<activity>`, in
 * the RS-profile config scope. A plugin can read that scope by key but cannot enumerate it — the
 * only listing API reads the main profile — so the import has to know what to ask for. These are
 * the names the game itself uses (lowercased), which is what chat-commands keys on.
 *
 * Raid and party activities also exist as "<name> N players" variants; the plugin appends those
 * rather than us shipping every combination.
 */
export function personalBestActivities(): string[] {
  const names = new Set<string>();
  for (const boss of BOSSES) {
    const label = boss.label.toLowerCase();
    names.add(label);
    // RuneLite files the PB under the name the game prints, which drops the article:
    // "The Whisperer" on the hiscores is stored as "whisperer".
    if (label.startsWith('the ')) names.add(label.slice(4));
    for (const alias of boss.aliases ?? []) names.add(alias.toLowerCase());
  }
  // Awakened DT2 variants keep their own PB, but they aren't on the hiscores so BOSSES has no entry.
  for (const target of COUNTER_TARGETS) {
    if (target.name.toLowerCase().endsWith('(awakened)')) names.add(target.name.toLowerCase());
  }
  // Timed content that isn't a hiscores boss, so it has no BOSSES entry to come from.
  for (const extra of [
    'gauntlet', 'corrupted gauntlet', 'the gauntlet', 'the corrupted gauntlet',
    'fight caves', 'inferno', 'fortis colosseum', 'colosseum',
    'barbarian assault', 'fragment of seren', 'zalcano',
    'agility pyramid', 'ape atoll agility', 'hallowed sepulchre',
    'hallowed sepulchre floor 1', 'hallowed sepulchre floor 2', 'hallowed sepulchre floor 3',
    'hallowed sepulchre floor 4', 'hallowed sepulchre floor 5',
    'guardians of the rift', 'tempoross', 'wintertodt',
  ]) {
    names.add(extra);
  }
  return [...names].sort();
}
