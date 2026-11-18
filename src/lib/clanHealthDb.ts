import { sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { clanServers, type ClanServers } from '@/lib/botGuilds';
import { billingStatus } from '@/lib/clanBilling';
import { clanHealth, type ClanHealth } from '@/lib/clanHealth';
import { allClans, type ClanRow } from '@/lib/platformView';

// The facts lib/clanHealth judges a clan by that the clan row does not carry: who was on the plugin
// this week and last, what is running and what is still to come, and when anyone was last seen.
// Three grouped reads over every clan, for the staff clans list.

export interface ClanActivity {
  plugin7d: number;
  pluginPrev7d: number;
  lastActiveAt: string | null;
  /** Boards and competitions running now, and still to start. */
  running: number;
  scheduled: number;
  /** Competitions ever created (boards are counted on the clan row). */
  competitions: number;
}

async function rows<T>(query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return ((res as unknown as { rows?: T[] }).rows ?? (res as unknown as T[])) as T[];
}

const num = (v: unknown) => Number(v ?? 0);

export async function clanActivity(now: number = Date.now()): Promise<Map<number, ClanActivity>> {
  const iso = new Date(now).toISOString();
  const d7 = new Date(now - 7 * 86_400_000).toISOString();
  const d14 = new Date(now - 14 * 86_400_000).toISOString();
  // Two timestamp formats live in the date columns ("2026-11-18 08:00:00" and ISO): a space swapped
  // for the T makes them compare as one.
  const at = (col: string) => sql.raw(`replace(${col}, ' ', 'T')`);
  // clan-scope: global -- the platform's own view across every clan (/staff/clans).
  const [seen, boards, weeks] = await Promise.all([
    rows<Record<string, unknown>>(sql`
      select clan_id,
             count(distinct account_id) filter (where kind = 'plugin' and ts >= ${d7}) as plugin7d,
             count(distinct account_id) filter (where kind = 'plugin' and ts >= ${d14} and ts < ${d7}) as plugin_prev,
             max(ts) as last_active
        from analytics_events
       where clan_id is not null
       group by clan_id
    `),
    rows<Record<string, unknown>>(sql`
      select clan_id,
             count(*) filter (where start_date is not null and ${at('start_date')} <= ${iso} and force_ended_at is null
                              and (end_date is null or ${at('end_date')} > ${iso})) as running,
             count(*) filter (where start_date is not null and ${at('start_date')} > ${iso} and force_ended_at is null) as scheduled
        from events
       group by clan_id
    `),
    rows<Record<string, unknown>>(sql`
      select clan_id,
             count(*) as total,
             count(*) filter (where status <> 'completed' and ${at('start_date')} <= ${iso} and ${at('end_date')} > ${iso}) as running,
             count(*) filter (where status <> 'completed' and ${at('start_date')} > ${iso}) as scheduled
        from weekly_competitions
       group by clan_id
    `),
  ]);
  const out = new Map<number, ClanActivity>();
  const get = (id: number) => {
    let a = out.get(id);
    if (!a) out.set(id, (a = { plugin7d: 0, pluginPrev7d: 0, lastActiveAt: null, running: 0, scheduled: 0, competitions: 0 }));
    return a;
  };
  for (const r of seen) {
    const a = get(num(r.clan_id));
    a.plugin7d = num(r.plugin7d);
    a.pluginPrev7d = num(r.plugin_prev);
    a.lastActiveAt = (r.last_active as string | null) ?? null;
  }
  for (const r of boards) {
    const a = get(num(r.clan_id));
    a.running += num(r.running);
    a.scheduled += num(r.scheduled);
  }
  for (const r of weeks) {
    const a = get(num(r.clan_id));
    a.running += num(r.running);
    a.scheduled += num(r.scheduled);
    a.competitions = num(r.total);
  }
  return out;
}

/** A clan's health (lib/clanHealth) with the facts the staff pages show beside it. */
export type ClanHealthRow = ClanHealth & { plugin7d: number; lastActiveAt: string | null; billing: string; running: number };

/**
 * Every clan with how it is doing: the one read behind the staff clans list, its export and the
 * Today page, so the three can never judge a clan differently.
 */
export async function clansWithHealth(now: number = Date.now()): Promise<{ clans: ClanRow[]; health: Record<number, ClanHealthRow>; servers: ClanServers }> {
  const [clans, activity, servers] = await Promise.all([
    allClans(),
    clanActivity(now).catch(() => new Map<number, ClanActivity>()),
    clanServers().catch((): ClanServers => ({ known: false, servers: [], missing: [] })),
  ]);
  const botMissing = new Set(servers.missing.map((m) => m.id));
  const health: Record<number, ClanHealthRow> = {};
  for (const c of clans) {
    const a = activity.get(c.id);
    const b = billingStatus(c, now);
    health[c.id] = {
      ...clanHealth(
        {
          createdAt: c.createdAt,
          members: c.members,
          memberCap: c.memberCap,
          plugin7d: a?.plugin7d ?? 0,
          pluginPrev7d: a?.pluginPrev7d ?? 0,
          eventsTotal: c.events + (a?.competitions ?? 0),
          running: a?.running ?? 0,
          scheduled: a?.scheduled ?? 0,
          lastActiveAt: a?.lastActiveAt ?? null,
          billing: b.state,
          billingDaysLeft: b.daysLeft,
          botMissing: botMissing.has(c.id),
        },
        now,
      ),
      plugin7d: a?.plugin7d ?? 0,
      lastActiveAt: a?.lastActiveAt ?? null,
      billing: b.state,
      running: a?.running ?? 0,
    };
  }
  return { clans, health, servers };
}
