import { notPractice } from '@/lib/practiceScope';
import { db } from '@/db';
import { getSettingMap } from '@/lib/settings';
import { accounts, clanKickChannels, clanTwitchChannels, clanYoutubeChannels, clanMemberships, clanStaff, clans, eventSignups, events, tiles, users } from '@/db/schema';
import { and, asc, count, eq, isNotNull, isNull, notInArray } from 'drizzle-orm';
import { creatorSetupSteps, isCreatorSpace } from '@/lib/creatorSpaces';
import { writtenTile } from '@/lib/writtenTiles';
import type { FlowView } from '@/lib/guidedFlow';
import { clanSetupFlow } from '@/lib/guidedFlows/clanSetup';

// The five "zero-to-first-bingo" milestones a fresh clan needs to hit. Step status is
// always computed live from real data (settings + counts) so the dashboard checklist and
// the wizard's Done screen can never disagree or go stale. The `setup_completed` flag is
// only advisory — it decides whether we auto-open the wizard / show the card, never
// whether a step is "done".

export interface SetupStep {
  key: 'clan' | 'discord' | 'members' | 'event' | 'tiles' | 'share' | 'stream';
  label: string;
  hint: string;
  done: boolean;
  href: string;
  /** Shown, but not counted towards "all done" (a creator space's Discord step). */
  optional?: boolean;
}

export interface SetupStatus {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  /** The owner finished or dismissed the wizard at least once. */
  dismissed: boolean;
  /** Brand-new clan: nothing meaningful configured, never dismissed. */
  isFresh: boolean;
  /**
   * The dashboard already sent this clan to the wizard once. Separate from `dismissed`, which also
   * hides the checklist card — the card should stay until the owner closes it, the redirect should not.
   */
  wizardShown: boolean;
  /**
   * Managed clan: the control-plane provisioner handed us CLAN_NAME (seeded into settings by
   * migrate.mjs), so identity fields were collected at sign-up rather than typed here. The wizard
   * uses this to word its "already filled in for you" notice.
   */
  provisioned: boolean;
  /** A creator space (lib/creatorSpaces): its own checklist, and no setup wizard. */
  creator: boolean;
  /**
   * The owner's guide strip (lib/guidedFlows/clanSetup), built from the facts read here: the one the
   * dashboard, the sidebar and /admin/setup all show. Null for a creator space, which has no wizard.
   */
  guide: FlowView | null;
  /** Prefill values for the wizard, so it opens showing whatever is already set. */
  values: {
    clanName: string;
    inGameClanName: string;
    inviteUrl: string;
    webhookUrl: string;
    pluginWebhook: string;
    rareDrops: string;
    deaths: string;
    /** Has a roster push proved this is the in-game clan it names (lib/clanVerification)? */
    verified: boolean;
    /** Live member seats. The owner alone is 1, so "loaded" means more than that. */
    memberCount: number;
    /** Somebody who runs this clan has the plugin signed in (a character of theirs has reported in). */
    pluginSeen: boolean;
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
  'setup_wizard_shown',
];

export async function getSetupStatus(clanId: number): Promise<SetupStatus> {
  const map = await getSettingMap(clanId, WANTED_KEYS);
  const get = (k: string) => map.get(k) || '';

  // The COLUMN is the name, and the setting is the mirror — see getClanDisplayName. Reading only
  // the setting meant a clan created through /clans/new, which types its name into the form and
  // stores it on the row, opened its own checklist to "Name your clan — not done".
  // The in-game name is the SAME bug one field over, and it was still live: creation asks for it,
  // requires it, and writes it to the row, but the wizard read only the mirror — so a clan created
  // through /clans/new opened step 1 with an empty "In-game clan name" over a row that had it, and
  // saving that empty box would have been believed.
  const row = await db.query.clans.findFirst({
    where: eq(clans.id, clanId),
    columns: { name: true, inGameName: true, ingameNameVerifiedAt: true, kind: true },
  });
  if (isCreatorSpace(row)) return creatorSetupStatus(clanId, map, row?.name ?? '');
  const clanName = row?.name?.trim() || get('clan_name');
  const inGameClanName = row?.inGameName?.trim() || get('clan_ingame_name');
  const webhookUrl = get('discord_webhook_url');
  const dismissed = !!get('setup_completed');

  // BOTH COUNTS ARE THIS CLAN'S. They had no clan filter, which was correct exactly once — when a
  // deployment WAS a clan and `from(events)` could only mean these events. On one platform it
  // counted everybody's, so a brand-new clan with nothing in it opened the checklist with two of
  // four steps already ticked and the wizard's Done screen congratulating it. Tiles reach their clan
  // through their event; there is no tiles.clan_id to filter on.
  const [[ec], [tc], [mc], pluginRows, [firstEvent]] = await Promise.all([
    // A practice board (lib/practice) is not the clan's first event.
    db.select({ c: count() }).from(events).where(and(eq(events.clanId, clanId), notPractice())),
    db
      .select({ c: count() })
      .from(tiles)
      .innerJoin(events, eq(tiles.eventId, events.id))
      .where(and(eq(events.clanId, clanId), notPractice(), writtenTile, isNull(tiles.parentTileId))),
    // Live member seats — guests from other clans don't make a roster.
    db
      .select({ c: count() })
      .from(clanMemberships)
      .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'member'))),
    // Has the plugin reached us from anyone who runs this clan? `live_stats_at` is stamped on the
    // account by the plugin's own reports (the same fact lib/onboarding's plugin step reads).
    db
      .select({ id: accounts.id })
      .from(clanStaff)
      .innerJoin(users, eq(users.id, clanStaff.userId))
      .innerJoin(accounts, eq(accounts.playerId, users.playerId))
      .where(and(eq(clanStaff.clanId, clanId), isNotNull(accounts.liveStatsAt)))
      .limit(1),
    db.select({ id: events.id }).from(events).where(and(eq(events.clanId, clanId), notPractice())).orderBy(asc(events.id)).limit(1),
  ]);
  const pluginSeen = pluginRows.length > 0;
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
    // The owner alone is a roster of one — the same line the dashboard's "member list is empty" uses.
    // Without members nobody can sign up, which a clan only found out when its first event sat empty.
    {
      key: 'members',
      label: 'Load your members',
      hint: 'Install the Anvil RuneLite plugin, open your clan window and press the Anvil button. Sign-ups need it.',
      done: (mc?.c ?? 0) > 1,
      // The wizard, not the roster page: the roster page shows an empty list and no way to fill it,
      // while the wizard opens at its in-game step with the three things to do.
      href: '/admin/setup',
    },
    {
      key: 'event',
      label: 'Create your first event',
      hint: 'Spin up a bingo board, Point Hunt board, or tile race.',
      done: eventsCount > 0,
      href: '/admin/events/new',
    },
    {
      key: 'tiles',
      label: 'Add tiles to a board',
      hint: 'Fill your board with the tasks players will chase.',
      done: tilesCount > 0,
      href: firstEvent ? `/admin/events/${firstEvent.id}/tiles` : '/admin/events',
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
    creator: false,
    guide: clanSetupFlow({
      clanName,
      inGameClanName,
      pluginSeen,
      verified: row?.ingameNameVerifiedAt != null,
      memberCount: mc?.c ?? 0,
      hasEvent: eventsCount > 0,
    }),
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
    wizardShown: !!get('setup_wizard_shown'),
    provisioned,
    values: {
      clanName,
      inGameClanName,
      inviteUrl: get('discord_invite_url'),
      webhookUrl,
      pluginWebhook: get('webhook_plugin_default'),
      rareDrops: get('webhook_rare_drops'),
      deaths: get('webhook_deaths'),
      verified: row?.ingameNameVerifiedAt != null,
      memberCount: mc?.c ?? 0,
      pluginSeen,
    },
  };
}

/**
 * A creator space's checklist: make an event, share it, and optionally connect Discord. No roster
 * step, no in-game name, and never the setup wizard (that is all in-game clan configuration) —
 * `isFresh` is false and `wizardShown` true, so the dashboard never redirects there.
 */
async function creatorSetupStatus(clanId: number, map: Map<string, string | null>, name: string): Promise<SetupStatus> {
  const get = (k: string) => map.get(k) || '';
  // Sign-ups from someone who does not run the space — the evidence the link went somewhere. The
  // staff's own characters first, then every sign-up on a seat that is not one of them.
  const staffAccounts = await db
    .select({ id: accounts.id })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .innerJoin(accounts, eq(accounts.playerId, users.playerId))
    .where(eq(clanStaff.clanId, clanId));
  const staffIds = staffAccounts.map((r) => r.id);
  const [[ec], [sc], [tw], [ki], [yt]] = await Promise.all([
    db.select({ c: count() }).from(events).where(and(eq(events.clanId, clanId), notPractice())),
    db
      .select({ c: count() })
      .from(eventSignups)
      .innerJoin(events, eq(events.id, eventSignups.eventId))
      .innerJoin(clanMemberships, eq(clanMemberships.id, eventSignups.clanMemberId))
      .where(
        staffIds.length
          ? and(eq(events.clanId, clanId), notInArray(clanMemberships.accountId, staffIds))
          : eq(events.clanId, clanId),
      ),
    db.select({ id: clanTwitchChannels.clanId }).from(clanTwitchChannels).where(eq(clanTwitchChannels.clanId, clanId)).limit(1),
    db.select({ id: clanKickChannels.clanId }).from(clanKickChannels).where(eq(clanKickChannels.clanId, clanId)).limit(1),
    db.select({ id: clanYoutubeChannels.clanId }).from(clanYoutubeChannels).where(eq(clanYoutubeChannels.clanId, clanId)).limit(1),
  ]);
  const webhookUrl = get('discord_webhook_url');
  const steps = creatorSetupSteps({
    eventsCount: ec?.c ?? 0,
    outsideSignups: sc?.c ?? 0,
    discordConnected: !!webhookUrl || !!get('discord_invite_url'),
    streamConnected: !!(tw || ki || yt),
  });
  const counted = steps.filter((st) => !st.optional);
  const completedCount = counted.filter((st) => st.done).length;
  return {
    creator: true,
    guide: null,
    steps,
    completedCount,
    totalCount: counted.length,
    allDone: completedCount === counted.length,
    dismissed: !!get('setup_completed'),
    isFresh: false,
    wizardShown: true,
    provisioned: true,
    values: {
      clanName: name,
      inGameClanName: '',
      inviteUrl: get('discord_invite_url'),
      webhookUrl,
      pluginWebhook: get('webhook_plugin_default'),
      rareDrops: get('webhook_rare_drops'),
      deaths: get('webhook_deaths'),
      verified: false,
      memberCount: 0,
      pluginSeen: false,
    },
  };
}
