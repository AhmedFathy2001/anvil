// Who may react to which feed row, with what — one rule for the plugin panel (lib/pluginUi/views
// react-row) and the site (/api/moments/[id]/react), so the two can't drift.
//
//   - A clan's row: a clanmate (a live member seat in the clan). The lab clan also lets plugin staff
//     testing it (the caller says so with `labStaff`).
//   - A board's row: anyone playing on it, or the host's staff. Behind hidden standings a player
//     reacts only to their own team's rows (the only ones they're shown).
//   - Any row: only the kinds it offers (GZ on a drop, pet or achievement; Sad / Sit on a death),
//     and a gold GZ only from an Anvil Supporter.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { chatAccess, type ChatSeatPick } from '@/lib/eventChat';
import { REACTION_KINDS, type ReactionKind, boardMoment, clanMomentKind, isClanMember } from '@/lib/momentReactions';
import { rowReactKinds } from '@/lib/pluginUi/feedUi';
import { standingsHidden } from '@/lib/standingsVisibility';
import { supporterForUser } from '@/lib/supporter';

export type ReactTarget = { clanId: number } | { eventId: number };

export type ReactVerdict = { ok: true; kind: ReactionKind } | { ok: false; status: 400 | 403 | 404; error: string };

export const REACT_ERRORS = {
  bad: 'Couldn’t react to that.',
  notClanmate: 'Only clanmates can GZ these drops.',
  notPlayer: 'Only this event’s players can react here.',
  gold: 'Gold GZs are an Anvil Supporter reaction.',
  notInClan: 'That drop isn’t in this clan’s feed.',
  notInEvent: 'That isn’t in this event’s feed.',
} as const;

/** The kind as a ReactionKind, or null when it isn't one. */
export function reactionKind(raw: unknown): ReactionKind | null {
  return REACTION_KINDS.find((k) => k === raw) ?? null;
}

/** May this login give `kind` on this moment, read in this clan's / board's feed? */
export async function checkReaction(
  userId: number,
  target: ReactTarget,
  momentId: number,
  rawKind: unknown,
  opts: { labStaff?: boolean; seat?: ChatSeatPick | null } = {},
): Promise<ReactVerdict> {
  const kind = reactionKind(rawKind);
  if (!kind || !Number.isInteger(momentId) || momentId <= 0) return { ok: false, status: 400, error: REACT_ERRORS.bad };
  const gold = async () => kind === 'gold' && !(await supporterForUser(userId));
  // Gold rides on a GZ; everything else must be one this row offers (no GZ on a death, no Sit on a pet).
  const offered = (momentKind: string) => (rowReactKinds(momentKind) as string[]).includes(kind === 'gold' ? 'gz' : kind);

  if ('clanId' in target) {
    if (!opts.labStaff && !(await isClanMember(userId, target.clanId))) return { ok: false, status: 403, error: REACT_ERRORS.notClanmate };
    if (await gold()) return { ok: false, status: 403, error: REACT_ERRORS.gold };
    const momentKind = await clanMomentKind(momentId, target.clanId);
    if (momentKind == null) return { ok: false, status: 404, error: REACT_ERRORS.notInClan };
    if (!offered(momentKind)) return { ok: false, status: 400, error: REACT_ERRORS.bad };
    return { ok: true, kind };
  }

  const access = await chatAccess(target.eventId, userId, opts.seat);
  if (!access?.member) return { ok: false, status: 403, error: REACT_ERRORS.notPlayer };
  const m = await boardMoment(momentId, target.eventId);
  if (!m) return { ok: false, status: 404, error: REACT_ERRORS.notInEvent };
  // Behind the curtain a player sees only their own team's rows; the host's staff see all.
  if (!access.staff && m.teamId !== access.teamId) {
    // clan-scope: global -- by the board id chatAccess just admitted the viewer to.
    const ev = await db.query.events.findFirst({ where: eq(events.id, target.eventId) });
    if (!ev || standingsHidden(ev)) return { ok: false, status: 404, error: REACT_ERRORS.notInEvent };
  }
  if (await gold()) return { ok: false, status: 403, error: REACT_ERRORS.gold };
  if (!offered(m.kind)) return { ok: false, status: 400, error: REACT_ERRORS.bad };
  return { ok: true, kind };
}
