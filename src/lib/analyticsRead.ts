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
  MEMBER_ONBOARDING,
  computeFunnel,
  densifyDays,
  windowStart,
  type FunnelRow,
} from '@/lib/analyticsFunnels';

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

export interface AnalyticsOverview {
  days: number;
  headline: Headline;
  pageViews: DailyPoint[];
  visitorsByDay: DailyPoint[];
  topRoutes: RouteRow[];
  topActions: ActionRow[];
  conversion: Conversion;
  clanFunnel: FunnelRow[];
  memberFunnel: FunnelRow[];
  clanActivity: ClanActivityRow[];
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
      (u.plugin_token is not null or exists (select 1 from plugin_links pl where pl.user_id = u.id)) as plugin,
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

export async function analyticsOverview(days: number): Promise<AnalyticsOverview> {
  const from = windowStart(days);
  const [head, series, routes, actions, conv, cf, mf, clans] = await Promise.all([
    headline(),
    daily(from, days),
    topRoutes(from),
    topActions(from),
    conversion(from),
    clanFunnel(days),
    memberFunnel(days),
    clanActivity(),
  ]);
  return {
    days,
    headline: head,
    ...series,
    topRoutes: routes,
    topActions: actions,
    conversion: conv,
    clanFunnel: cf,
    memberFunnel: mf,
    clanActivity: clans,
  };
}
