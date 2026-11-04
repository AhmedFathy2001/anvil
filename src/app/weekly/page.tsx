import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';
import { currentClan } from '@/lib/clanContext';
import { creatorPublicAway } from '@/lib/creatorGuard';

/**
 * The weekly index is the Events hub now.
 *
 * A Skill of the Week has a start, an end, entrants, a leaderboard and a winner — it was only ever
 * a separate page because it is a separate table. The hub lists boards and weeks together and
 * filters by kind, so this route keeps working for anything already linked in Discord and sends it
 * there. `/weekly/[id]` is untouched: a week still has its own page.
 */
export default async function WeeklyIndexPage() {
  // A creator space has no weeklies: straight to its home, not via its events list.
  await creatorPublicAway('/weekly', await currentClan());
  redirect(await clanHref('/events'));
}
