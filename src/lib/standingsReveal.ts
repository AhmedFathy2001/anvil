// The "standings revealed" moment (lib/standingsVisibility).
//
// While the curtain is down, progress posts to shared channels are DROPPED at the Discord choke
// point (lib/discord sendEventBingoWebhook) rather than queued: replaying a week of tile completions
// the moment the curtain lifts would bury the channel and tell nobody anything the table doesn't.
// What the channel gets instead is ONE post when the standings come back, with the leaderboard.
//
// HOW IT KNOWS. The curtain can lift three ways — the host's date passes, the event ends, or a host
// switches the rule back to live mid-event — and only the first leaves the rule in place to look
// at. So the lifecycle tick (every minute) leaves a marker in `settings` while it sees a curtain
// down, and when it next finds that event with its curtain up it deletes the marker. The DELETE …
// RETURNING is the claim: exactly one tick gets the row back, so exactly one post goes out, and a
// box that was down at reveal time still posts when it comes back. No migration — the settings
// table is keyed (clan, key) and this is one short-lived row per hidden event.
//
// At the END of the event the marker is cleared without a post: the end post already carries the
// final standings, and two leaderboards a minute apart would be one too many.

import { and, eq, ilike, inArray, like, sql } from 'drizzle-orm';

import { db } from '@/db';
import { events, settings } from '@/db/schema';
import { notifyEventStatsPost } from '@/lib/discord';
import { field, type DiscordEmbedField } from '@/lib/discordEmbeds';
import { log } from '@/lib/logger';
import { invalidateSettings } from '@/lib/settings';
import { getTeamStandings } from '@/lib/statStandings';
import { hasStandingsCurtain, standingsHidden } from '@/lib/standingsVisibility';
import { isEventEnded } from '@/lib/survey';

const MARKER_PREFIX = 'standings_curtain:';
const markerKey = (eventId: number) => `${MARKER_PREFIX}${eventId}`;

const MEDALS = ['🥇', '🥈', '🥉'];

/** The leaderboard, as an embed field list. Exported for the test of its shape. */
export function revealFields(
  standings: { name: string; score: number; unit: string }[],
): DiscordEmbedField[] {
  if (!standings.length) return [];
  const lines = [...standings]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((s, i) => `${MEDALS[i] ?? `**#${i + 1}**`} **${s.name}** — ${s.score.toLocaleString('en-US')} ${s.unit}`);
  return [field('📊 Standings', lines.join('\n'), false)];
}

/**
 * Tell the plugin push server the board reads differently now (lib/push/hub rebuilds the team and
 * tile views it holds on an `events` change). A reveal is a change of the CLOCK, not of any row, so
 * no trigger would fire for it by itself. Best-effort: a plugin's next poll catches up regardless.
 */
async function announcePushChange(eventId: number): Promise<void> {
  await db
    .execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'events', e: eventId })})`)
    .catch(() => {});
}

/** Post the reveal for one event: one embed with the current leaderboard. */
async function postReveal(event: typeof events.$inferSelect): Promise<void> {
  const standings = await getTeamStandings(event.id, event.scoringMode);
  await notifyEventStatsPost({
    post: 'standingsRevealed',
    clanId: event.clanId,
    eventId: event.id,
    eventName: event.name,
    title: '🙈 Standings revealed',
    description: 'The curtain is up — here is how the race really stands. Every team’s progress is visible again.',
    fields: revealFields(standings),
  });
  log.info('standings-reveal.posted', { eventId: event.id });
}

/**
 * One lifecycle tick: mark events whose curtain is down, and announce the ones whose curtain has
 * just come up. Never throws.
 */
export async function runStandingsReveals(nowMs = Date.now()): Promise<void> {
  // clan-scope: global -- the lifecycle cron walks every clan's events; each post goes to that event's own clans.
  const curtained = await db
    .select()
    .from(events)
    .where(and(eq(events.endNotified, 0), ilike(events.rules, '%"visibility":"at-%')));
  // Events holding a marker, whatever their rule says now — the "switched back to live" case.
  // clan-scope: global -- markers are per event; the event row names its own clan.
  const marked = await db
    .select({ clanId: settings.clanId, key: settings.key })
    .from(settings)
    .where(like(settings.key, `${MARKER_PREFIX}%`));
  const markedIds = marked
    .map((m) => Number(m.key.slice(MARKER_PREFIX.length)))
    .filter((id) => Number.isInteger(id) && id > 0);
  const extraIds = markedIds.filter((id) => !curtained.some((e) => e.id === id));
  // clan-scope: global -- see above.
  const extra = extraIds.length ? await db.select().from(events).where(inArray(events.id, extraIds)) : [];

  // A marker whose event was deleted: tidy it away.
  for (const m of marked) {
    const id = Number(m.key.slice(MARKER_PREFIX.length));
    if (!curtained.some((e) => e.id === id) && !extra.some((e) => e.id === id)) {
      await db.delete(settings).where(and(eq(settings.clanId, m.clanId), eq(settings.key, m.key))).catch(() => {});
    }
  }

  for (const event of [...curtained, ...extra]) {
    try {
      if (hasStandingsCurtain(event) && standingsHidden(event, nowMs)) {
        if (!markedIds.includes(event.id)) {
          await db
            .insert(settings)
            .values({ clanId: event.clanId, key: markerKey(event.id), value: new Date(nowMs).toISOString() })
            .onConflictDoNothing();
          invalidateSettings(event.clanId);
        }
        continue;
      }
      if (!markedIds.includes(event.id)) continue;
      // The curtain is up and was down last time we looked. Claim the reveal.
      const claimed = await db
        .delete(settings)
        .where(and(eq(settings.clanId, event.clanId), eq(settings.key, markerKey(event.id))))
        .returning({ key: settings.key });
      invalidateSettings(event.clanId);
      if (claimed.length === 0) continue;
      await announcePushChange(event.id);
      // Ended (the end post has the final table) or never started (nothing to reveal): no post.
      if (isEventEnded(event) || !event.startNotified) continue;
      await postReveal(event);
    } catch (err) {
      log.warn('standings-reveal.failed', { eventId: event.id, err: String(err) });
    }
  }
}
