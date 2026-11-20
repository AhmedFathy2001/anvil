// The reads behind /staff/analytics.
//
// clan-scope: global -- every query here spans the platform on purpose; this is the operator's view.
// Each one still filters by `clan_id` the moment a clan-scoped view is wanted: the column is on every
// row, so a clan admin's slice is the same SQL with one more predicate.
//
// The funnels read the DOMAIN tables (clans, events, tiles, users, submissions), not analytics_events.
// Those rows go back to the start of each clan, so the funnels are true on day one rather than only
// for whatever was tracked after this shipped — and "created an event" is better evidenced by the
// event existing than by a log line saying it was.

import { sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { parseStamp } from '@/lib/dbTime';
import {
  CLAN_ONBOARDING,
  FIRST_EVENT_FLOW,
  FIRST_EVENT_TRACKED,
  MEMBER_ONBOARDING,
  NEW_EVENT_FLOW,
  computeFunnel,
  densifyDays,
  firstEventReached,
  windowStart,
  type FunnelRow,
} from '@/lib/analyticsFunnels';
import { type FeatureUsage, type UsageRow, rankFeatures, registryNames } from '@/lib/featureRegistry';

async function rows<T>(query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return ((res as unknown as { rows?: T[] }).rows ?? (res as unknown as T[])) as T[];
}

export interface Headline {
  visitors: { d1: number; d7: number; d30: number };
  users: { d1: number; d7: number; d30: number };
  clans: { d1: number; d7: number; d30: number };
  pluginUsers: { d1: number; d7: number; d30: number };
}

export interface DailyPoint {
  day: string;
  count: number;
}

export interface RouteRow {
  name: string;
  views: number;
  sessions: number;
}

/** One plugin endpoint: how many account-days used it, by how many accounts, in how many clans. */
export interface PluginRouteRow {
  name: string;
  accountDays: number;
  accounts: number;
  clans: number;
}

export interface ActionRow {
  name: string;
  count: number;
  users: number;
  clans: number;
}

export interface ClanActivityRow {
  id: number;
  slug: string;
  name: string;
  plan: string | null;
  status: string;
  lastActive: string | null;
  /** Whole days since `lastActive`; null when the clan has never shown up. */
  quietDays: number | null;
  views7d: number;
  actions7d: number;
  activeUsers7d: number;
  pluginUsers7d: number;
}

export interface Conversion {
  sessions: number;
  signedInSessions: number;
}

/** Join-button clicks on Discord cards (lib/discordJoin), per clan and per surface. */
export interface DiscordJoinRow {
  clan: string;
  src: string;
  clicks: number;
  /** Distinct signed-in clickers. */
  people: number;
}

export interface AnalyticsOverview {
  days: number;
  headline: Headline;
  pageViews: DailyPoint[];
  visitorsByDay: DailyPoint[];
  topRoutes: RouteRow[];
  topActions: ActionRow[];
  pluginRoutes: PluginRouteRow[];
  conversion: Conversion;
  clanFunnel: FunnelRow[];
  memberFunnel: FunnelRow[];
  clanActivity: ClanActivityRow[];
  discordJoins: DiscordJoinRow[];
  features: FeatureUsage[];
  newEventFlow: FunnelRow[];
  firstEventFlow: FunnelRow[];
}

const num = (v: unknown) => Number(v ?? 0);

async function headline(): Promise<Headline> {
  const d1 = windowStart(1);
  const d7 = windowStart(7);
  const d30 = windowStart(30);
  const [r] = await rows<Record<string, number>>(sql`
    select
      count(distinct session_id) filter (where kind = 'page' and ts >= ${d1})  as v1,
      count(distinct session_id) filter (where kind = 'page' and ts >= ${d7})  as v7,
      count(distinct session_id) filter (where kind = 'page')                  as v30,
      count(distinct user_id)    filter (where ts >= ${d1})                    as u1,
      count(distinct user_id)    filter (where ts >= ${d7})                    as u7,
      count(distinct user_id)                                                  as u30,
      count(distinct clan_id)    filter (where ts >= ${d1})                    as c1,
      count(distinct clan_id)    filter (where ts >= ${d7})                    as c7,
      count(distinct clan_id)                                                  as c30,
      count(distinct account_id) filter (where kind = 'plugin' and ts >= ${d1}) as p1,
      count(distinct account_id) filter (where kind = 'plugin' and ts >= ${d7}) as p7,
      count(distinct account_id) filter (where kind = 'plugin')                 as p30
    from analytics_events
    where ts >= ${d30}
  `);
  return {
    visitors: { d1: num(r?.v1), d7: num(r?.v7), d30: num(r?.v30) },
    users: { d1: num(r?.u1), d7: num(r?.u7), d30: num(r?.u30) },
    clans: { d1: num(r?.c1), d7: num(r?.c7), d30: num(r?.c30) },
    pluginUsers: { d1: num(r?.p1), d7: num(r?.p7), d30: num(r?.p30) },
  };
}

async function daily(from: string, days: number) {
  const r = await rows<{ day: string; views: number; visitors: number }>(sql`
    select left(ts, 10) as day, count(*) as views, count(distinct session_id) as visitors
      from analytics_events
     where kind = 'page' and ts >= ${from}
     group by 1
  `);
  return {
    pageViews: densifyDays(r.map((x) => ({ day: x.day, count: num(x.views) })), days),
    visitorsByDay: densifyDays(r.map((x) => ({ day: x.day, count: num(x.visitors) })), days),
  };
}

async function topRoutes(from: string): Promise<RouteRow[]> {
  const r = await rows<{ name: string; views: number; sessions: number }>(sql`
    select name, count(*) as views, count(distinct session_id) as sessions
      from analytics_events
     where kind = 'page' and ts >= ${from}
     group by name
     order by views desc
     limit 25
  `);
  return r.map((x) => ({ name: x.name, views: num(x.views), sessions: num(x.sessions) }));
}

async function discordJoins(from: string): Promise<DiscordJoinRow[]> {
  // Clicks, and how many distinct signed-in people made them. Signed-out clicks carry no identity at
  // all (nothing is fingerprinted to count them), so most of the column is the first one.
  const r = await rows<{ clan: string | null; src: string | null; n: number; people: number }>(sql`
    select c.name as clan, e.props->>'src' as src, count(*) as n,
           count(distinct e.user_id) as people
      from analytics_events e
      left join clans c on c.id = e.clan_id
     where e.kind = 'action' and e.name = 'discord.join' and e.ts >= ${from}
     group by c.name, e.props->>'src'
     order by n desc
     limit 50
  `);
  return r.map((x) => ({ clan: x.clan ?? 'Anvil', src: x.src ?? '?', clicks: num(x.n), people: num(x.people) }));
}

async function topActions(from: string): Promise<ActionRow[]> {
  const r = await rows<{ name: string; n: number; users: number; clans: number }>(sql`
    select name, count(*) as n, count(distinct user_id) as users, count(distinct clan_id) as clans
      from analytics_events
     where kind = 'action' and ts >= ${from}
     group by name
     order by n desc
  `);
  return r.map((x) => ({ name: x.name, count: num(x.n), users: num(x.users), clans: num(x.clans) }));
}

/**
 * The plugin's own paths. Rows are one per (account, route, day), so the count is account-days, not
 * requests — a board polled every 30 seconds by one player all day is one, the same as a single
 * goal edit. That's the question: which features people use, not which endpoints are chatty.
 */
async function pluginRoutes(from: string): Promise<PluginRouteRow[]> {
  const r = await rows<{ name: string; n: number; accounts: number; clans: number }>(sql`
    select name, count(*) as n, count(distinct account_id) as accounts, count(distinct clan_id) as clans
      from analytics_events
     where kind = 'plugin' and name <> 'plugin.active' and ts >= ${from}
     group by name
     order by accounts desc, n desc
     limit 40
  `);
  return r.map((x) => ({ name: x.name.replace(/^\/api\/plugin/, ''), accountDays: num(x.n), accounts: num(x.accounts), clans: num(x.clans) }));
}

async function conversion(from: string): Promise<Conversion> {
  const [r] = await rows<{ sessions: number; signed: number }>(sql`
    select count(distinct session_id) as sessions,
           count(distinct session_id) filter (where user_id is not null) as signed
      from analytics_events
     where kind = 'page' and ts >= ${from}
  `);
  return { sessions: num(r?.sessions), signedInSessions: num(r?.signed) };
}

/**
 * Cut-offs for the domain tables are by DAY, not to the second: their stamps come in two formats
 * (lib/dbTime — `T` and space), and a date prefix compares the same way against both.
 */
const dayOf = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

async function clanFunnel(days: number): Promise<FunnelRow[]> {
  const nowIso = new Date().toISOString();
  const r = await rows<{ event: boolean; tiles: boolean; started: boolean }>(sql`
    select
      exists (select 1 from events e where e.clan_id = c.id) as event,
      exists (select 1 from tiles t join events e on e.id = t.event_id where e.clan_id = c.id) as tiles,
      exists (select 1 from events e where e.clan_id = c.id and e.start_date is not null and e.start_date <= ${nowIso}) as started
    from clans c
    where c.created_at >= ${dayOf(days)}
  `);
  return computeFunnel(
    CLAN_ONBOARDING,
    r.map((x) => ['created', ...(x.event ? ['event'] : []), ...(x.tiles ? ['tiles'] : []), ...(x.started ? ['started'] : [])]),
  );
}

async function memberFunnel(days: number): Promise<FunnelRow[]> {
  const r = await rows<{ character: boolean; plugin: boolean; submission: boolean }>(sql`
    select
      exists (select 1 from accounts a where a.player_id = u.player_id) as character,
      (u.plugin_token_hash is not null or exists (select 1 from plugin_links pl where pl.user_id = u.id)) as plugin,
      exists (
        select 1 from submissions s
          join event_participants ep on ep.id = s.player_id
          join accounts a on a.id = ep.account_id
         where a.player_id = u.player_id
      ) as submission
    from users u
    where u.created_at >= ${dayOf(days)} and u.banned = false
  `);
  return computeFunnel(
    MEMBER_ONBOARDING,
    r.map((x) => [
      'signedIn',
      ...(x.character ? ['character'] : []),
      ...(x.plugin ? ['plugin'] : []),
      ...(x.submission ? ['submission'] : []),
    ]),
  );
}

/**
 * Every clan with its recent pulse, quietest first among the ones that have been active at all —
 * the table is for spotting a clan going cold, so a clan that has never shown up sorts last rather
 * than burying the ones that stopped.
 */
async function clanActivity(): Promise<ClanActivityRow[]> {
  const d7 = windowStart(7);
  const r = await rows<Record<string, unknown>>(sql`
    with recent as (
      select clan_id,
             count(*) filter (where kind = 'page' and ts >= ${d7})              as views7d,
             count(*) filter (where kind = 'action' and ts >= ${d7})            as actions7d,
             count(distinct user_id) filter (where ts >= ${d7})                 as users7d,
             count(distinct account_id) filter (where kind = 'plugin' and ts >= ${d7}) as plugin7d,
             max(ts)                                                            as last_active
        from analytics_events
       where clan_id is not null
       group by clan_id
    )
    select c.id, c.slug, c.name, c.plan, c.status,
           r.last_active, coalesce(r.views7d, 0) as views7d, coalesce(r.actions7d, 0) as actions7d,
           coalesce(r.users7d, 0) as users7d, coalesce(r.plugin7d, 0) as plugin7d
      from clans c
      left join recent r on r.clan_id = c.id
     order by r.last_active desc nulls last, c.name
  `);
  const now = Date.now();
  return r.map((x) => {
    const last = parseStamp((x.last_active as string | null) ?? null);
    return {
      id: num(x.id),
      slug: String(x.slug),
      name: String(x.name),
      plan: (x.plan as string | null) ?? null,
      status: String(x.status ?? ''),
      lastActive: (x.last_active as string | null) ?? null,
      views7d: num(x.views7d),
      actions7d: num(x.actions7d),
      activeUsers7d: num(x.users7d),
      pluginUsers7d: num(x.plugin7d),
      quietDays: last == null ? null : Math.floor((now - last) / 86_400_000),
    };
  });
}

/**
 * Everything the "Feature use" table needs, from one grouped read of the last 90 days: the rows for
 * the registry's own pages, plugin paths and every action, grouped by who and which day so the
 * distinct clans and people can be counted in `rankFeatures` (pure, tested) rather than in SQL that
 * could not tell one feature's actions from another's.
 */
async function featureUsage(period: number): Promise<FeatureUsage[]> {
  const names = registryNames();
  const pageMatch = [
    ...names.exact.map((p) => sql`name = ${p}`),
    ...names.prefixes.map((p) => sql`(name = ${p} or name like ${`${p}/%`})`),
  ];
  const r = await rows<{
    kind: 'page' | 'action' | 'plugin';
    name: string;
    fmt: string | null;
    type: string | null;
    tile_kind: string | null;
    clan_id: number | null;
    user_id: number | null;
    account_id: number | null;
    day: string;
    n: number;
  }>(sql`
    select kind, name, props->>'fmt' as fmt, props->>'type' as type, props->>'kind' as tile_kind,
           clan_id, user_id, account_id, left(ts, 10) as day, count(*) as n
      from analytics_events
     where ts >= ${windowStart(Math.max(90, period * 2))}
       and (kind = 'action'
            or (kind = 'plugin' and name in (${sql.join(names.plugin.map((p) => sql`${p}`), sql`, `)}))
            or (kind = 'page' and (${sql.join(pageMatch, sql` or `)})))
     group by 1, 2, 3, 4, 5, 6, 7, 8, 9
  `);
  const usage: UsageRow[] = r.map((x) => ({
    kind: x.kind,
    name: x.name,
    fmt: x.fmt,
    type: x.type,
    tileKind: x.tile_kind,
    clanId: x.clan_id == null ? null : num(x.clan_id),
    userId: x.user_id == null ? null : num(x.user_id),
    accountId: x.account_id == null ? null : num(x.account_id),
    day: x.day,
    n: num(x.n),
  }));
  return rankFeatures(usage, new Date(), undefined, period);
}

/**
 * The new-event flow: which steps each clan reached in the window, from the action rows written where
 * each step is served. The first step anchors the funnel (a clan enters it by reaching it), as in
 * every other funnel here.
 */
async function newEventFlow(days: number): Promise<FunnelRow[]> {
  const keys = NEW_EVENT_FLOW.steps.map((s) => s.key);
  const r = await rows<{ clan_id: number; names: string[] }>(sql`
    select clan_id, array_agg(distinct name) as names
      from analytics_events
     where kind = 'action' and clan_id is not null and ts >= ${windowStart(days)}
       and name in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})
     group by clan_id
  `);
  return computeFunnel(NEW_EVENT_FLOW, r.map((x) => x.names));
}

/**
 * New owner -> first running event, per clan created in the window, read from the DOMAIN tables like
 * clanFunnel above, so it is true for clans made before the tracking shipped. Each step uses the
 * same fact the setup checklist does (lib/setupStatus): the verified stamp on the clan, a plugin
 * report for someone who runs it, more than one live member seat, an event, and a tile somebody
 * wrote rather than a board's blank placeholder (the rule in lib/writtenTiles, spelled out in SQL).
 * Tracked actions only fill in for a record that is gone (lib/analyticsFunnels firstEventReached).
 * Creator spaces are left out: they have no in-game name to verify and no roster.
 */
async function firstEventFlow(days: number): Promise<FunnelRow[]> {
  const r = await rows<{
    verified: boolean;
    plugin: boolean;
    members: number | string;
    event: boolean;
    tile: boolean;
    starts: (string | null)[] | null;
    tracked: string[] | null;
  }>(sql`
    select
      (c.ingame_name_verified_at is not null) as verified,
      exists (
        select 1 from clan_staff cs
          join users u on u.id = cs.user_id
          join accounts a on a.player_id = u.player_id
         where cs.clan_id = c.id and a.live_stats_at is not null
      ) as plugin,
      (select count(*) from clan_memberships m where m.clan_id = c.id and m.left_at is null and m.kind = 'member') as members,
      exists (select 1 from events e where e.clan_id = c.id) as event,
      exists (
        select 1 from tiles t join events e on e.id = t.event_id
         where e.clan_id = c.id and t.parent_tile_id is null
           and not (t.label ~ '^Tile [0-9]+$' and t.tile_type = 'standard' and t.tracked_stat is null)
      ) as tile,
      (select array_agg(e.start_date) from events e where e.clan_id = c.id and e.start_date is not null) as starts,
      (select array_agg(distinct ae.name) from analytics_events ae
        where ae.kind = 'action' and ae.clan_id = c.id
          and ae.name in (${sql.join(Object.values(FIRST_EVENT_TRACKED).map((k) => sql`${k}`), sql`, `)})) as tracked
    from clans c
    where c.created_at >= ${dayOf(days)} and c.kind <> 'creator'
  `);
  const now = Date.now();
  return computeFunnel(
    FIRST_EVENT_FLOW,
    r.map((x) =>
      firstEventReached(
        {
          verified: !!x.verified,
          plugin: !!x.plugin,
          // The owner alone is a roster of one (lib/setupStatus).
          members: Number(x.members) > 1,
          event: !!x.event,
          tile: !!x.tile,
          // Start stamps come in two formats (lib/dbTime), so they are parsed, never compared as text.
          started: (x.starts ?? []).some((d) => {
            const at = parseStamp(d);
            return at != null && at <= now;
          }),
        },
        x.tracked ?? [],
      ),
    ),
  );
}

/** Every active clan with where it said it found Anvil and how many events it has made (lib/featureRegistry sourcesThatStay). */
export async function clanSources(): Promise<{ id: number; foundVia: string | null; events: number }[]> {
  const r = await rows<{ id: number; found_via: string | null; events: number }>(sql`
    select c.id, c.found_via,
           (select count(*) from events e where e.clan_id = c.id) + (select count(*) from weekly_competitions w where w.clan_id = c.id) as events
      from clans c
     where c.status = 'active'
  `);
  return r.map((x) => ({ id: num(x.id), foundVia: x.found_via, events: num(x.events) }));
}

export async function analyticsOverview(days: number): Promise<AnalyticsOverview> {
  const from = windowStart(days);
  const [head, series, routes, actions, plugin, conv, cf, mf, clans, joins, features, newEvent, firstEvent] = await Promise.all([
    headline(),
    daily(from, days),
    topRoutes(from),
    topActions(from),
    pluginRoutes(from),
    conversion(from),
    clanFunnel(days),
    memberFunnel(days),
    clanActivity(),
    discordJoins(from),
    featureUsage(days),
    newEventFlow(days),
    firstEventFlow(days),
  ]);
  return {
    days,
    headline: head,
    ...series,
    topRoutes: routes,
    topActions: actions,
    pluginRoutes: plugin,
    conversion: conv,
    clanFunnel: cf,
    memberFunnel: mf,
    clanActivity: clans,
    discordJoins: joins,
    features,
    newEventFlow: newEvent,
    firstEventFlow: firstEvent,
  };
}
