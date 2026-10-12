import { sql } from 'drizzle-orm';

import { db } from '@/db';

/**
 * Carry everything a character has ONTO another account, before the duplicate is deleted.
 *
 * A rename absorbs the duplicate holding the new name — usually a roster row the clan sync made under
 * the new name, which the sweep then polled. That row is where the CURRENT hiscores, the daily history
 * since the rename, the log and the bests often are; deleting it cascaded all of that away, and the
 * character came out of the rename with no snapshot, no bosses and no history.
 *
 * Merge rules, per table, so nothing a player earned is lost:
 *   - the hiscores snapshot and the account's stats columns: whichever side has more overall XP;
 *   - days, milestones, log items, log counters, goals, competition snapshots, progress lists: union
 *     (rows ours lacks move across; ours wins a clash);
 *   - personal bests: the faster time; progress counters: the higher value;
 *   - the log header: whichever side has more slots.
 */
export async function carryAccountStats(fromId: number, toId: number): Promise<void> {
  if (fromId === toId) return;
  // clan-scope: global -- one character's own stats, moved between two of its account rows.
  await db.transaction(async (tx) => {
    // ── Hiscores snapshot + stats columns: the more advanced side wins ──────────────────────────
    await tx.execute(sql`
      UPDATE accounts t SET
        stats_overall_xp = f.stats_overall_xp,
        stats_activities = f.stats_activities,
        stats_miss_streak = f.stats_miss_streak,
        stats_next_due_at = f.stats_next_due_at,
        stats_polled_at = f.stats_polled_at,
        account_type = COALESCE(t.account_type, f.account_type),
        account_type_at = COALESCE(t.account_type_at, f.account_type_at)
      FROM accounts f
      WHERE t.id = ${toId} AND f.id = ${fromId}
        AND COALESCE(f.stats_overall_xp, -1) > COALESCE(t.stats_overall_xp, -1)`);
    await tx.execute(sql`
      DELETE FROM account_stat_snapshots s USING accounts t, accounts f
      WHERE s.account_id = ${toId} AND t.id = ${toId} AND f.id = ${fromId}
        AND EXISTS (SELECT 1 FROM account_stat_snapshots x WHERE x.account_id = ${fromId})
        AND t.stats_overall_xp IS NOT DISTINCT FROM f.stats_overall_xp`);
    await tx.execute(sql`
      UPDATE account_stat_snapshots SET account_id = ${toId}
      WHERE account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM account_stat_snapshots x WHERE x.account_id = ${toId})`);

    // ── Unions: rows ours lacks move across ──────────────────────────────────────────────────────
    await tx.execute(sql`
      UPDATE member_daily_stats f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM member_daily_stats t WHERE t.account_id = ${toId} AND t.day = f.day)`);
    await tx.execute(sql`
      UPDATE member_milestones f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM member_milestones t WHERE t.account_id = ${toId}
          AND t.kind = f.kind AND t.metric IS NOT DISTINCT FROM f.metric AND t.threshold = f.threshold)`);
    await tx.execute(sql`
      UPDATE member_clog_items f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM member_clog_items t WHERE t.account_id = ${toId} AND t.item_id = f.item_id)`);
    await tx.execute(sql`
      UPDATE member_clog_kc f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM member_clog_kc t WHERE t.account_id = ${toId}
          AND t.page_name = f.page_name AND t.label = f.label)`);
    await tx.execute(sql`
      UPDATE player_goals f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM player_goals t WHERE t.account_id = ${toId} AND t.kind = f.kind AND t.metric = f.metric)`);
    await tx.execute(sql`
      UPDATE player_snapshots f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM player_snapshots t WHERE t.account_id = ${toId}
          AND t.weekly_competition_id IS NOT DISTINCT FROM f.weekly_competition_id AND t.kind = f.kind)`);
    await tx.execute(sql`
      UPDATE member_progress_items f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM member_progress_items t WHERE t.account_id = ${toId} AND t.category = f.category)`);

    // ── Personal bests: the faster time wins a clash ────────────────────────────────────────────
    await tx.execute(sql`
      UPDATE member_personal_bests t SET centis = f.centis, achieved_at = f.achieved_at, updated_at = f.updated_at
      FROM member_personal_bests f
      WHERE t.account_id = ${toId} AND f.account_id = ${fromId}
        AND t.activity = f.activity AND t.team_size = f.team_size AND f.centis < t.centis`);
    await tx.execute(sql`
      UPDATE member_personal_bests f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM member_personal_bests t WHERE t.account_id = ${toId}
          AND t.activity = f.activity AND t.team_size = f.team_size)`);

    // ── Progress counters: the higher value wins a clash ────────────────────────────────────────
    await tx.execute(sql`
      UPDATE member_progress t SET value = f.value, updated_at = f.updated_at
      FROM member_progress f
      WHERE t.account_id = ${toId} AND f.account_id = ${fromId} AND t.key = f.key AND f.value > t.value`);
    await tx.execute(sql`
      UPDATE member_progress f SET account_id = ${toId}
      WHERE f.account_id = ${fromId}
        AND NOT EXISTS (SELECT 1 FROM member_progress t WHERE t.account_id = ${toId} AND t.key = f.key)`);

    // ── Log header: the fuller side, recounted once the items have merged ───────────────────────
    await tx.execute(sql`
      UPDATE member_clog SET account_id = ${toId}
      WHERE account_id = ${fromId} AND NOT EXISTS (SELECT 1 FROM member_clog x WHERE x.account_id = ${toId})`);
    await tx.execute(sql`
      UPDATE member_clog SET obtained = (SELECT count(*) FROM member_clog_items i WHERE i.account_id = ${toId})
      WHERE account_id = ${toId}
        AND obtained < (SELECT count(*) FROM member_clog_items i WHERE i.account_id = ${toId})`);
  });
}
