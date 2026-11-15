// The facts behind the "Getting started" guide strips (lib/guidedFlows/memberStart), read for one
// person. Each is something the site already works out; this only gathers them in one place so the
// home page, the clan home and the profile show the same strip.

import { sql } from 'drizzle-orm';

import { db } from '@/db';
import type { FlowView } from '@/lib/guidedFlow';
import { clanlessStartFlow, memberStartFlow } from '@/lib/guidedFlows/memberStart';
import { countLiveTeamInvolvements } from '@/lib/myTeamNav';
import { onboardingState } from '@/lib/onboarding';

/**
 * Has a proof of theirs ever landed on a board? The member-onboarding funnel's own definition
 * (lib/analyticsRead): a submission by a participant that is one of this person's characters.
 */
async function hasAnyProof(playerId: number | null): Promise<boolean> {
  if (playerId == null) return false;
  // clan-scope: global -- the subject is a PERSON, whose characters play in any clan.
  const res = await db.execute(sql`
    select exists (
      select 1 from submissions s
        join event_participants ep on ep.id = s.player_id
        join accounts a on a.id = ep.account_id
       where a.player_id = ${playerId}
    ) as proof
  `);
  const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as { proof?: boolean }[];
  return rows[0]?.proof === true;
}

/**
 * The strip for somebody who is in a clan, or on a clan's pages. Null once they have got started
 * (a proof has landed), which is decided by the one cheap read, so a settled member's pages pay for
 * nothing more.
 */
export async function memberStartGuide(
  userId: number,
  playerId: number | null,
  /** `insider`: drawn on a clan's own pages for somebody who belongs there, seat or staff. */
  opts: { eventsHref?: string; teamHref?: string; insider?: boolean } = {},
): Promise<FlowView | null> {
  try {
    if (await hasAnyProof(playerId)) return null;
    const [state, involvements] = await Promise.all([onboardingState(userId, playerId), countLiveTeamInvolvements(userId)]);
    const done = (key: string) => state.steps.find((s) => s.key === key)?.done === true;
    const view = memberStartFlow({
      inClan: done('clan') || opts.insider === true,
      pluginConnected: done('plugin'),
      hasCharacter: done('character'),
      inEvent: involvements > 0,
      hasProof: false,
      eventsHref: opts.eventsHref,
      teamHref: opts.teamHref,
    });
    return view.complete ? null : view;
  } catch {
    // A guide is never worth a broken page.
    return null;
  }
}

/** The strip for somebody in no clan. `openEvents` is the public feed their home page already loaded (null: not loaded here). */
export async function clanlessStartGuide(userId: number, playerId: number | null, openEvents: number | null): Promise<FlowView | null> {
  try {
    const [state, involvements, proof] = await Promise.all([
      onboardingState(userId, playerId),
      countLiveTeamInvolvements(userId),
      hasAnyProof(playerId),
    ]);
    const step = (key: string) => state.steps.find((s) => s.key === key);
    const view = clanlessStartFlow({
      hasCharacter: step('character')?.done === true,
      inClan: step('clan')?.done === true,
      clanSkipped: step('clan')?.skipped === true,
      intent: state.intent,
      inEvent: involvements > 0 || proof,
      openEvents,
    });
    return view.complete ? null : view;
  } catch {
    return null;
  }
}
