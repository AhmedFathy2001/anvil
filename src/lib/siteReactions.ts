// The reactions under the site's moment feeds (components/MomentsFeed): the same GZ / Sad / Sit the
// plugin panel's Feed gives, read and given on the clan's Members → Lately and an event's page.
//
// Who sees what (decided to match the panel, which shows reaction chips only to those who may react):
//   - Anyone who can read the page sees the COUNTS.
//   - Only someone who may react there (lib/reactionAccess: a clanmate on a clan's feed; a player
//     or the host's staff on a board) sees WHO gave them, and can give their own. A public visitor,
//     or a member of another clan, never gets reactor names.
// Names are character names there (lib/momentReactions reactorNames), never a Discord name.

import { type ReactionKind, type ReactionSummary, NO_REACTIONS, isClanMember, reactionSummaries, reactorNames, tallyOf } from '@/lib/momentReactions';
import { chatAccess } from '@/lib/eventChat';
import { REACT_LABEL, rowReactKinds } from '@/lib/pluginUi/feedUi';
import { whoText } from '@/lib/reactionWho';
import { supporterForUser } from '@/lib/supporter';

export interface SiteReactionChip {
  kind: ReactionKind;
  label: string;
  n: number;
  mine: boolean;
  /** "GZ · Mossy and Rikkert" — only for a viewer who may react here. */
  who?: string;
}

/** Where the feed is read: a clan's own, or a board (with its host clan, for staff names). */
export type SiteReactionScope = { clanId: number } | { eventId: number; hostClanId: number };

export interface SiteReactions {
  /** The viewer may press them (and is shown who gave them). */
  canReact: boolean;
  /** What the toggle posts with the moment: which feed it was pressed in. */
  target: { clanId: number } | { eventId: number };
  byMoment: Record<number, SiteReactionChip[]>;
}

const GOLD_LABEL = 'Gold GZ';

/**
 * A row's chips: what it offers (rowReactKinds), plus a gold GZ beside a GZ when someone gave one or
 * the viewer is a Supporter who could. A chip nobody pressed is kept only when the viewer can press it.
 */
export function chipsFor(
  momentKind: string,
  s: ReactionSummary,
  o: { canReact: boolean; canGold: boolean; who?: Partial<Record<ReactionKind, (string | null)[]>> },
): SiteReactionChip[] {
  const kinds: ReactionKind[] = [...rowReactKinds(momentKind)];
  if (kinds.includes('gz') && (s.gold > 0 || (o.canReact && o.canGold))) kinds.push('gold');
  const out: SiteReactionChip[] = [];
  for (const kind of kinds) {
    const { n, mine } = tallyOf(s, kind);
    if (n === 0 && !o.canReact) continue;
    if (kind === 'gold' && n === 0 && !o.canGold) continue;
    const label = kind === 'gold' ? GOLD_LABEL : REACT_LABEL[kind];
    const who = o.canReact && o.who ? whoText(label, o.who[kind] ?? []) : '';
    out.push({ kind, label, n, mine, ...(who ? { who } : {}) });
  }
  return out;
}

/** Whether this viewer may react in this feed: the same rule as lib/reactionAccess. */
async function mayReact(scope: SiteReactionScope, userId: number | null): Promise<boolean> {
  if (userId == null) return false;
  if ('clanId' in scope) return isClanMember(userId, scope.clanId);
  return !!(await chatAccess(scope.eventId, userId))?.member;
}

export async function siteReactions(
  moments: readonly { id: number; kind: string }[],
  scope: SiteReactionScope,
  userId: number | null,
): Promise<SiteReactions> {
  const ids = moments.map((m) => m.id).filter((id) => id > 0);
  const canReact = await mayReact(scope, userId);
  const [summaries, canGold, who] = await Promise.all([
    reactionSummaries(ids, userId),
    canReact && userId != null ? supporterForUser(userId).then((s) => !!s).catch(() => false) : Promise.resolve(false),
    // Names only for someone who may react here: a public visitor gets the counts alone.
    canReact ? reactorNames(ids, scope) : Promise.resolve(null),
  ]);
  const byMoment: Record<number, SiteReactionChip[]> = {};
  for (const m of moments) {
    if (m.id <= 0) continue;
    const chips = chipsFor(m.kind, summaries.get(m.id) ?? NO_REACTIONS, { canReact, canGold, who: who?.get(m.id) });
    if (chips.length) byMoment[m.id] = chips;
  }
  return { canReact, target: 'clanId' in scope ? { clanId: scope.clanId } : { eventId: scope.eventId }, byMoment };
}
