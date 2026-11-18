import { sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';

// Who is on the plugin, for /staff/analytics (owner only).
//
// Two readings the page did not have. "Playing now" is the accounts whose plugin pushed stats in the
// last ten minutes (accounts.live_stats_at, stamped on every push): a player who is logged in and
// doing anything pushes more often than that, one standing still does not, so it is a floor, not a
// socket count. The version spread is the build each character was last seen on
// (account_plugin_seen, lib/pluginSeen), over the last seven days.

export interface PluginUsersNow {
  /** Accounts that pushed in the last 10 minutes / hour / day. */
  now: number;
  hour: number;
  day: number;
  versions: { version: string; accounts: number }[];
  /** Clans with anyone on the plugin in the last day, busiest now first. */
  clans: { id: number; name: string; now: number; hour: number; day: number }[];
}

async function rows<T>(query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return ((res as unknown as { rows?: T[] }).rows ?? (res as unknown as T[])) as T[];
}

const num = (v: unknown) => Number(v ?? 0);
const ago = (ms: number, now: number) => new Date(now - ms).toISOString();

/** Newest first by version number ("1.17.1" before "1.17.0" before "1.9.0"), unknown shapes last. */
export function byVersionDesc(a: string, b: string): number {
  const parts = (v: string) => v.split('.').map((n) => (/^\d+$/.test(n) ? Number(n) : -1));
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (y[i] ?? 0) - (x[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function pluginUsersNow(now: number = Date.now()): Promise<PluginUsersNow> {
  const m10 = ago(10 * 60_000, now);
  const h1 = ago(3_600_000, now);
  const d1 = ago(86_400_000, now);
  const d7 = ago(7 * 86_400_000, now);
  // clan-scope: global -- the platform owner's view across every clan.
  const [[head], versions, clans] = await Promise.all([
    rows<Record<string, number>>(sql`
      select count(*) filter (where live_stats_at >= ${m10}) as now,
             count(*) filter (where live_stats_at >= ${h1})  as hour,
             count(*)                                        as day
        from accounts
       where live_stats_at >= ${d1}
    `),
    rows<{ version: string; accounts: number }>(sql`
      select plugin_version as version, count(*) as accounts
        from account_plugin_seen
       where seen_at >= ${d7}
       group by plugin_version
    `),
    rows<Record<string, unknown>>(sql`
      select c.id, c.name,
             count(distinct a.id) filter (where a.live_stats_at >= ${m10}) as now,
             count(distinct a.id) filter (where a.live_stats_at >= ${h1})  as hour,
             count(distinct a.id)                                          as day
        from accounts a
        join clan_roster r on r.account_id = a.id
        join clans c on c.id = r.clan_id
       where a.live_stats_at >= ${d1}
       group by c.id, c.name
    `),
  ]);
  return {
    now: num(head?.now),
    hour: num(head?.hour),
    day: num(head?.day),
    versions: versions.map((v) => ({ version: String(v.version), accounts: num(v.accounts) })).sort((a, b) => byVersionDesc(a.version, b.version)),
    clans: clans
      .map((c) => ({ id: num(c.id), name: String(c.name), now: num(c.now), hour: num(c.hour), day: num(c.day) }))
      .sort((a, b) => b.now - a.now || b.hour - a.hour || b.day - a.day || a.name.localeCompare(b.name)),
  };
}
