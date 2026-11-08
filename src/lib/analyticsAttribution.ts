// First-touch attribution and the owner-only reads built on it.
//
// clan-scope: global -- owner-only, spans the platform on purpose.
//
// The writes are fire-and-forget like every recorder here (lib/analytics): losing a source costs a
// row on a chart, never a sign-up.

import { sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { userFirstTouch } from '@/db/schema';
import { windowStart, computeFunnel, funnelFromCounts, CLAN_OWNER_JOURNEY, PLAYER_JOURNEY, SUPPORTER_JOURNEY, INVITE_JOURNEY, type FunnelRow } from '@/lib/analyticsFunnels';
import { isSessionId } from '@/lib/analyticsPattern';
import { conversionRate } from '@/lib/analyticsSource';
import { log } from '@/lib/logger';

async function rows<T>(query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return ((res as unknown as { rows?: T[] }).rows ?? (res as unknown as T[])) as T[];
}
const num = (v: unknown) => Number(v ?? 0);

// ── Writes ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Store a new account's first-touch source, once. The visit is found by the tab's session id (carried
 * through sign-in in a ten-minute state cookie): the first page view of that tab holds the source the
 * beacon worked out. Bounded to the last two days of rows so the lookup rides the ts index.
 */
export function recordFirstTouch(userId: number, sessionId: string | null | undefined): void {
  void (async () => {
    let found: Record<string, unknown> | null = null;
    if (isSessionId(sessionId)) {
      const [r] = await rows<{ props: Record<string, unknown> | null }>(sql`
        select props from analytics_events
         where kind = 'page' and ts >= ${windowStart(2)} and session_id = ${sessionId}
           and props->>'src' is not null
         order by id limit 1
      `);
      found = r?.props ?? null;
    }
    const str = (k: string) => (typeof found?.[k] === 'string' ? (found[k] as string) : null);
    await db
      .insert(userFirstTouch)
      .values({
        userId,
        source: str('src') ?? 'unknown',
        medium: str('um'),
        campaign: str('uc'),
        referrerHost: str('rh'),
        ref: str('rf'),
      })
      .onConflictDoNothing();
  })().catch((err: unknown) => log.warn('analytics.first-touch-failed', {}, err));
}

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────

export interface NamedCount { name: string; count: number; sessions?: number }
export interface SourceRow { source: string; visits: number; conversions: Record<ConversionKind, number>; total: number; rate: number }
export interface ConversionRow { ts: string; kind: ConversionKind; source: string; clan: string | null }
export interface ClanJourneyRow { id: number; name: string; created: string; steps: Record<string, string | null> }

export const CONVERSION_KINDS = ['clan.created', 'creator.created', 'clan.purchased', 'supporter.purchased', 'plugin.linked'] as const;
export type ConversionKind = (typeof CONVERSION_KINDS)[number];

export interface OwnerOverview {
  entryPages: NamedCount[];
  exitPages: NamedCount[];
  referrers: NamedCount[];
  devices: NamedCount[];
  avgSeconds: Record<string, number>;
  sources: SourceRow[];
  latest: ConversionRow[];
  clanOwner: FunnelRow[];
  player: FunnelRow[];
  supporter: FunnelRow[];
  invite: FunnelRow[];
  clanJourney: ClanJourneyRow[];
}

async function sessionEnds(from: string, dir: 'asc' | 'desc'): Promise<NamedCount[]> {
  const order = dir === 'asc' ? sql`asc` : sql`desc`;
  const r = await rows<{ name: string; n: number }>(sql`
    select name, count(*) as n from (
      select distinct on (session_id) name
        from analytics_events
       where kind = 'page' and session_id is not null and ts >= ${from}
       order by session_id, id ${order}
    ) s group by name order by n desc limit 15
  `);
  return r.map((x) => ({ name: x.name, count: num(x.n) }));
}

async function props(from: string, key: 'rh' | 'vp', limit: number): Promise<NamedCount[]> {
  // The key is one of two literals above, never input — and an untyped parameter makes `->>` ambiguous.
  const k = sql.raw(`'${key}'`);
  const r = await rows<{ name: string; n: number; s: number }>(sql`
    select props->>${k} as name, count(*) as n, count(distinct session_id) as s
      from analytics_events
     where kind = 'page' and ts >= ${from} and props->>${k} is not null
     group by 1 order by s desc limit ${limit}
  `);
  return r.map((x) => ({ name: x.name, count: num(x.n), sessions: num(x.s) }));
}

async function avgSeconds(from: string): Promise<Record<string, number>> {
  const r = await rows<{ name: string; ms: number }>(sql`
    select name, avg((props->>'ms')::numeric) as ms
      from analytics_events
     where kind = 'leave' and ts >= ${from} and props->>'ms' is not null
     group by name
  `);
  return Object.fromEntries(r.map((x) => [x.name, Math.round(num(x.ms) / 1000)]));
}

/**
 * Conversions by FIRST-TOUCH source: each conversion action is credited to the source stored for the
 * person who did it. A clan purchase would credit the clan's creator; unattributed people (accounts
 * from before this shipped) read `unknown`, so the table adds up rather than silently shrinking.
 */
async function sources(from: string): Promise<SourceRow[]> {
  const kinds = sql.join(CONVERSION_KINDS.map((k) => sql`${k}`), sql`, `);
  const [visits, conv] = await Promise.all([
    rows<{ src: string; n: number }>(sql`
      select props->>'src' as src, count(*) as n from analytics_events
       where kind = 'page' and ts >= ${from} and props->>'src' is not null group by 1
    `),
    rows<{ src: string; name: string; n: number }>(sql`
      select coalesce(f.source, 'unknown') as src, e.name, count(*) as n
        from analytics_events e
        left join user_first_touch f on f.user_id = coalesce(e.user_id, (select cc.user_id from analytics_events cc where cc.clan_id = e.clan_id and cc.name = 'clan.created' limit 1))
       where e.kind = 'action' and e.ts >= ${from} and e.name in (${kinds})
       group by 1, 2
    `),
  ]);
  const map = new Map<string, SourceRow>();
  const row = (source: string): SourceRow => {
    let r = map.get(source);
    if (!r) {
      r = { source, visits: 0, conversions: { 'clan.created': 0, 'creator.created': 0, 'clan.purchased': 0, 'supporter.purchased': 0, 'plugin.linked': 0 }, total: 0, rate: 0 };
      map.set(source, r);
    }
    return r;
  };
  for (const v of visits) row(v.src).visits = num(v.n);
  for (const c of conv) {
    const r = row(c.src);
    r.conversions[c.name as ConversionKind] = num(c.n);
    r.total += num(c.n);
  }
  for (const r of map.values()) r.rate = conversionRate(r.total, r.visits);
  return [...map.values()].sort((a, b) => b.total - a.total || b.visits - a.visits);
}

async function latestConversions(): Promise<ConversionRow[]> {
  const r = await rows<{ ts: string; name: string; src: string | null; clan: string | null }>(sql`
    select e.ts, e.name, f.source as src, c.name as clan
      from analytics_events e
      left join user_first_touch f on f.user_id = coalesce(e.user_id, (select cc.user_id from analytics_events cc where cc.clan_id = e.clan_id and cc.name = 'clan.created' limit 1))
      left join clans c on c.id = e.clan_id
     where e.kind = 'action' and e.name in ('clan.created', 'creator.created', 'supporter.purchased', 'clan.purchased')
     order by e.id desc limit 30
  `);
  return r.map((x) => ({ ts: x.ts, kind: x.name as ConversionKind, source: x.src ?? 'unknown', clan: x.clan }));
}

/** Distinct actors that did each action in the window: userIds, or clan ids for the owner journey. */
async function actors(from: string, col: 'user_id' | 'clan_id', names: string[]): Promise<Map<string, Set<number>>> {
  const c = col === 'user_id' ? sql`user_id` : sql`clan_id`;
  const list = sql.join(names.map((n) => sql`${n}`), sql`, `);
  const r = await rows<{ name: string; id: number }>(sql`
    select distinct name, ${c} as id from analytics_events
     where kind = 'action' and ts >= ${from} and name in (${list}) and ${c} is not null
  `);
  const out = new Map<string, Set<number>>();
  for (const x of r) (out.get(x.name) ?? out.set(x.name, new Set()).get(x.name)!).add(num(x.id));
  return out;
}

async function journeys(from: string) {
  const [owners, players, counts] = await Promise.all([
    actors(from, 'clan_id', ['clan.created', 'discord.connected', 'roster.synced', 'event.created', 'event.started']),
    actors(from, 'user_id', ['auth.login', 'plugin.linked', 'submission.created', 'signup.submitted']),
    rows<{ name: string; n: number }>(sql`
      select name, count(*) as n from analytics_events
       where kind = 'action' and ts >= ${from}
         and name in ('supporter.viewed', 'supporter.checkout', 'supporter.purchased', 'invite.opened', 'invite.joined')
       group by name
    `),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.name, num(x.n)]));
  const get = (m: Map<string, Set<number>>, n: string) => m.get(n) ?? new Set<number>();

  const keys: [string, string][] = [['created', 'clan.created'], ['discord', 'discord.connected'], ['roster', 'roster.synced'], ['event', 'event.created'], ['started', 'event.started']];
  const cohort = [...get(owners, 'clan.created')];
  const clanOwner = computeFunnel(CLAN_OWNER_JOURNEY, cohort.map((id) => keys.filter(([, n]) => get(owners, n).has(id)).map(([k]) => k)));

  const pk: [string, string][] = [['signedIn', 'auth.login'], ['plugin', 'plugin.linked'], ['credit', 'submission.created'], ['joined', 'signup.submitted']];
  const player = computeFunnel(PLAYER_JOURNEY, [...get(players, 'auth.login')].map((id) => pk.filter(([, n]) => get(players, n).has(id)).map(([k]) => k)));

  return {
    clanOwner,
    player,
    supporter: funnelFromCounts(SUPPORTER_JOURNEY, [c['supporter.viewed'] ?? 0, c['supporter.checkout'] ?? 0, c['supporter.purchased'] ?? 0]),
    invite: funnelFromCounts(INVITE_JOURNEY, [c['invite.opened'] ?? 0, c['invite.joined'] ?? 0]),
  };
}

/** Per clan: when each owner-journey step first happened (the drill-down under the owner funnel). */
async function clanJourney(from: string): Promise<ClanJourneyRow[]> {
  const base = await rows<{ id: number; name: string; ts: string }>(sql`
    select c.id, c.name, e.ts from analytics_events e join clans c on c.id = e.clan_id
     where e.kind = 'action' and e.name = 'clan.created' and e.ts >= ${from} order by e.id desc limit 100
  `);
  if (base.length === 0) return [];
  const ids = sql.join(base.map((b) => sql`${num(b.id)}`), sql`, `);
  const r = await rows<{ id: number; step: string; ts: string }>(sql`
    select clan_id as id, name as step, min(ts) as ts from analytics_events
     where kind = 'action' and clan_id in (${ids})
       and name in ('discord.connected', 'roster.synced', 'event.created', 'event.started')
     group by clan_id, name
  `);
  const out = new Map<number, ClanJourneyRow>(
    base.map((b) => [num(b.id), { id: num(b.id), name: b.name, created: b.ts, steps: { discord: null, roster: null, event: null, started: null } }]),
  );
  const slot: Record<string, string> = { 'discord.connected': 'discord', 'roster.synced': 'roster', 'event.created': 'event', 'event.started': 'started' };
  for (const x of r) {
    const row = out.get(num(x.id));
    if (row) row.steps[slot[x.step]] = x.ts;
  }
  return [...out.values()];
}

export async function ownerOverview(days: number): Promise<OwnerOverview> {
  const from = windowStart(days);
  const [entry, exit, refs, dev, avg, src, latest, j, cj] = await Promise.all([
    sessionEnds(from, 'asc'),
    sessionEnds(from, 'desc'),
    props(from, 'rh', 15),
    props(from, 'vp', 3),
    avgSeconds(from),
    sources(from),
    latestConversions(),
    journeys(from),
    clanJourney(from),
  ]);
  return { entryPages: entry, exitPages: exit, referrers: refs, devices: dev, avgSeconds: avg, sources: src, latest, ...j, clanJourney: cj };
}
