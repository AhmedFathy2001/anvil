import { db } from '@/db';
import { getSettingMap } from '@/lib/settings';
import { clans, events, tiles } from '@/db/schema';
import { count, eq } from 'drizzle-orm';

// The four "zero-to-first-bingo" milestones a fresh clan needs to hit. Step status is
// always computed live from real data (settings + counts) so the dashboard checklist and
// the wizard's Done screen can never disagree or go stale. The `setup_completed` flag is
// only advisory — it decides whether we auto-open the wizard / show the card, never
// whether a step is "done".

export interface SetupStep {
  key: 'clan' | 'discord' | 'event' | 'tiles';
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

export interface SetupStatus {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  /** The owner finished or dismissed the wizard at least once. */
  dismissed: boolean;
  /** Brand-new clan: nothing meaningful configured, never dismissed — safe to auto-open once. */
  isFresh: boolean;
  /**
   * Managed clan: the control-plane provisioner handed us CLAN_NAME (seeded into settings by
   * migrate.mjs), so identity fields were collected at sign-up rather than typed here. The wizard
   * uses this to word its "already filled in for you" notice.
   */
  provisioned: boolean;
  /** Prefill values for the wizard, so it opens showing whatever is already set. */
  values: {
    clanName: string;
    inGameClanName: string;
    inviteUrl: string;
    webhookUrl: string;
    pluginWebhook: string;
    rareDrops: string;
    deaths: string;
  };
}

const WANTED_KEYS = [
  'clan_name',
  'clan_ingame_name',
  'discord_webhook_url',
  'discord_invite_url',
  'webhook_plugin_default',
  'webhook_rare_drops',
  'webhook_deaths',
  'setup_completed',
];

export async function getSetupStatus(clanId: number): Promise<SetupStatus> {
  const map = await getSettingMap(clanId, WANTED_KEYS);
  const get = (k: string) => map.get(k) || '';

  // The COLUMN is the name, and the setting is the mirror — see getClanDisplayName. Reading only
  // the setting meant a clan created through /clans/new, which types its name into the form and
  // stores it on the row, opened its own checklist to "Name your clan — not done".
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { name: true } });
  const clanName = row?.name?.trim() || get('clan_name');
  const webhookUrl = get('discord_webhook_url');
  const dismissed = !!get('setup_completed');

  // BOTH COUNTS ARE THIS CLAN'S. They had no clan filter, which was correct exactly once — when a
  // deployment WAS a clan and `from(events)` could only mean these events. On one platform it
  // counted everybody's, so a brand-new clan with nothing in it opened the checklist with two of
  // four steps already ticked and the wizard's Done screen congratulating it. Tiles reach their clan
  // through their event; there is no tiles.clan_id to filter on.
  const [[ec], [tc]] = await Promise.all([
    db.select({ c: count() }).from(events).where(eq(events.clanId, clanId)),
    db
      .select({ c: count() })
      .from(tiles)
      .innerJoin(events, eq(tiles.eventId, events.id))
      .where(eq(events.clanId, clanId)),
  ]);
  const eventsCount = ec?.c ?? 0;
  const tilesCount = tc?.c ?? 0;

  const steps: SetupStep[] = [
    {
      key: 'clan',
      label: 'Name your clan',
      hint: 'The display name shown across the site and in Discord posts.',
      done: !!clanName,
      href: '/admin/setup',
    },
    {
      key: 'discord',
      label: 'Connect Discord',
      hint: 'Let Anvil post event announcements to your server.',
      done: !!webhookUrl,
      href: '/admin/setup',
    },
    {
      key: 'event',
      label: 'Create your first event',
      hint: 'Spin up a bingo board, Leagues board, or tile race.',
      done: eventsCount > 0,
      href: '/admin/events/new',
    },
    {
      key: 'tiles',
      label: 'Add tiles to a board',
      hint: 'Fill your board with the tasks players will chase.',
      done: tilesCount > 0,
      href: '/admin/events',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  // Every clan now arrives named — /clans/new asks for it and stores it on the row — so the old
  // "no clan name" freshness test never fires for anybody, and "no webhook yet + never dismissed"
  // is the signal for all of them. The wizard then opens past the steps already done.
  //
  // This used to read process.env.CLAN_NAME, which is a PER-DEPLOYMENT variable in an app that is no
  // longer one deployment per clan: set at all, it would have declared every clan on the platform
  // provisioner-managed, including ones created here thirty seconds ago.
  const provisioned = !!clanName;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    allDone: completedCount === steps.length,
    dismissed,
    // Never dismissed and nothing wired to Discord yet. The old third clause was `(!clanName ||
    // provisioned)`, which distinguished a clan that had typed its name from one the provisioner
    // named for it — a distinction with no cases left now that creation always asks. Kept as a
    // tautology it would read like a condition, so it is gone.
    isFresh: !dismissed && !webhookUrl,
    provisioned,
    values: {
      clanName,
      inGameClanName: get('clan_ingame_name'),
      inviteUrl: get('discord_invite_url'),
      webhookUrl,
      pluginWebhook: get('webhook_plugin_default'),
      rareDrops: get('webhook_rare_drops'),
      deaths: get('webhook_deaths'),
    },
  };
}
