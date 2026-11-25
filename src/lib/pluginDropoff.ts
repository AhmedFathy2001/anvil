import { sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';

// Who keeps playing but stopped using the plugin — the platform owner's analytics.
//
// Three stamps on an account say how somebody plays:
//   live_stats_at    — the plugin pushed (they were in game with it on);
//   stats_changed_at — the hiscores sweep saw their stats move (they played, however);
//   unseen_play_at   — the sweep saw gains the plugin had NOT pushed (they played away from it).
// So over the last two weeks: pushes and nothing unseen = plugin only; pushes AND unseen play = the
// plugin plus somewhere else (mobile most likely); unseen play and no push lately, but pushes before =
// stopped using the plugin; play and never a push = never had it. Mobile-only players who never used
// the plugin land in that last bucket — the hiscores can't say which client moved them.

export const DROPOFF_WINDOW_DAYS = 14;

export interface PluginDropoff {
  pluginOnly: number;
  pluginAndElsewhere: number;
  stopped: number;
  neverPlugin: number;
  /** Still playing, no plugin for two weeks: the ones whose last push was most recent first. */
  recentStoppers: { rsn: string; clans: string; lastPush: string; lastPlay: string }[];
}

async function rows<T>(query: SQL): Promise<T[]> {
  const r = (await db.execute(query)) as unknown as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}
const num = (v: unknown) => Number(v ?? 0);

export async function pluginDropoff(now: number = Date.now()): Promise<PluginDropoff> {
  const since = new Date(now - DROPOFF_WINDOW_DAYS * 86_400_000).toISOString();
  // clan-scope: global -- the platform owner's view across every clan.
  const [[head], stoppers] = await Promise.all([
    rows<Record<string, unknown>>(sql`
      select count(*) filter (where live_stats_at >= ${since} and (unseen_play_at is null or unseen_play_at < ${since})) as plugin_only,
             count(*) filter (where live_stats_at >= ${since} and unseen_play_at >= ${since})                              as both,
             count(*) filter (where live_stats_at < ${since} and unseen_play_at >= ${since})                               as stopped,
             count(*) filter (where live_stats_at is null and stats_changed_at >= ${since})                                as never
        from accounts
       where erased_at is null
         and (live_stats_at >= ${since} or stats_changed_at >= ${since} or unseen_play_at >= ${since})
    `),
    rows<Record<string, unknown>>(sql`
      select a.rsn, a.live_stats_at as last_push, a.unseen_play_at as last_play,
             coalesce(string_agg(distinct c.name, ', '), '') as clans
        from accounts a
        left join clan_roster r on r.account_id = a.id and r.left_at is null
        left join clans c on c.id = r.clan_id
       where a.erased_at is null and a.live_stats_at < ${since} and a.unseen_play_at >= ${since}
       group by a.id, a.rsn, a.live_stats_at, a.unseen_play_at
       order by a.live_stats_at desc
       limit 40
    `),
  ]);
  return {
    pluginOnly: num(head?.plugin_only),
    pluginAndElsewhere: num(head?.both),
    stopped: num(head?.stopped),
    neverPlugin: num(head?.never),
    recentStoppers: stoppers.map((s) => ({ rsn: String(s.rsn), clans: String(s.clans ?? ''), lastPush: String(s.last_push), lastPlay: String(s.last_play) })),
  };
}
