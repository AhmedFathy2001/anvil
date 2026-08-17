import { NextResponse } from 'next/server';
import { and, count, eq, isNotNull, isNull, lt, min } from 'drizzle-orm';
import { db } from '@/db';
import { getSettingText } from '@/lib/settings';
import { clanMembers, completions, events, submissions, weeklyCompetitions } from '@/db/schema';
import { getClanDisplayName, getPublicShowcase } from '@/lib/pluginConfig';
import { APP_VERSION } from '@/lib/serverInfo';

/**
 * Public "this clan runs Anvil" summary — the feed behind the operator's Clans-on-Anvil page
 * (anvilosrs.com/clans). Unauthenticated on purpose: the control plane polls it across the fleet
 * without holding a per-clan credential, and a self-hoster can point anything at it.
 *
 * ONLY aggregates and the clan's own public identity ship here — counts, first-activity date, the
 * display name and the Discord invite that already sits in the site nav. No RSNs, no Discord ids,
 * no event/tile names, nothing member-scoped: this is the one route on the site that answers to
 * strangers with no rate limit in front of it, so it must stay boring on purpose.
 *
 * Opt out with the `public_showcase` setting (Advanced settings), which flips this to
 * `{ listed: false }` and nothing else.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getPublicShowcase())) {
    // 200, not 404: "this instance exists and declines to be listed" is a different answer from
    // "there is no Anvil here", and the poller stores the two differently.
    return NextResponse.json({ listed: false }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  }

  const [
    [members],
    [eventRows],
    [finishedRows],
    [tileRows],
    [proofRows],
    [weeklyRows],
    [firstEvent],
    [firstMember],
    inviteRow,
  ] = await Promise.all([
    // Active roster: still in the clan (no leftAt) and not a guest.
    db
      .select({ n: count() })
      .from(clanMembers)
      .where(and(isNull(clanMembers.leftAt), eq(clanMembers.isGuest, 0))),
    db.select({ n: count() }).from(events),
    db
      .select({ n: count() })
      .from(events)
      .where(and(isNotNull(events.endDate), lt(events.endDate, new Date().toISOString()))),
    db.select({ n: count() }).from(completions),
    db.select({ n: count() }).from(submissions),
    db.select({ n: count() }).from(weeklyCompetitions),
    db.select({ at: min(events.createdAt) }).from(events),
    db.select({ at: min(clanMembers.joinedAt) }).from(clanMembers),
    getSettingText('discord_invite_url'),
  ]);

  // "Running Anvil since" — the oldest thing in the DB that a human caused. Events first (a clan
  // that has run one has really used it); the roster is the fallback for a clan mid-setup.
  const since = [firstEvent?.at, firstMember?.at].filter(Boolean).sort()[0] ?? null;

  return NextResponse.json(
    {
      listed: true,
      name: await getClanDisplayName(''),
      discordInviteUrl: inviteRow,
      since,
      version: APP_VERSION,
      stats: {
        members: members?.n ?? 0,
        events: eventRows?.n ?? 0,
        eventsFinished: finishedRows?.n ?? 0,
        tilesCompleted: tileRows?.n ?? 0,
        proofs: proofRows?.n ?? 0,
        weeklies: weeklyRows?.n ?? 0,
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
