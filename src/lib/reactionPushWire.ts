import type { ReactionKind, ReactionSummary } from '@/lib/momentReactions';
import { REACT_LABEL, rowReactKinds } from '@/lib/pluginUi/feedUi';
import { whoText } from '@/lib/reactionWho';

// The live reaction update for the plugin panel's Feed (lib/panelRows emitReactionRows). Pure, so it is
// tested without a database (tests/reaction-push.test.ts).
//
//   {t:'rowsreact', feeds:[id…], id:'m<moment>', gz, gold, sad, sit, who?:{kind: line}}
//   + mineGz, mineGold, mineSad, mineSit on the copy sent to the reactor's own clients only
//
// Counts are absolute (not deltas), so a lost or doubled message heals on the next one. The plugin lays
// it over the row with that id in each list named, in place. Named `rows…` on purpose: every plugin that
// asks for panel rows passes `rows*` messages to its Feed and ignores the kinds it doesn't know, so an
// older one needs no capability of its own to be left alone.

export type ReactPush = {
  t: 'rowsreact';
  feeds: string[];
  id: string;
  gz: number;
  gold: number;
  sad: number;
  sit: number;
  /** Each chip's tooltip ("GZ · Mossy and Rikkert"), '' = nobody: only the row's kinds. */
  who?: Partial<Record<ReactionKind, string>>;
  mineGz?: boolean;
  mineGold?: boolean;
  mineSad?: boolean;
  mineSit?: boolean;
};

export function reactPushMessage(o: {
  feeds: string[];
  momentId: number;
  /** The moment's kind ('death', 'pet', …): which chips the row has (feedUi rowReactKinds). */
  momentKind: string;
  summary: ReactionSummary;
  /** Reactors per kind by name in the lists' scope (momentReactions reactorNames); omit for no tooltips. */
  who?: Partial<Record<ReactionKind, readonly (string | null)[]>> | null;
  /** The reactor's own copy: carries their mine flags. */
  mine?: boolean;
}): ReactPush {
  const s = o.summary;
  const out: ReactPush = { t: 'rowsreact', feeds: o.feeds, id: `m${o.momentId}`, gz: s.gz, gold: s.gold, sad: s.sad, sit: s.sit };
  if (o.who) {
    const who: Partial<Record<ReactionKind, string>> = {};
    for (const k of rowReactKinds(o.momentKind)) who[k] = whoText(REACT_LABEL[k], o.who[k] ?? []);
    out.who = who;
  }
  if (o.mine) {
    out.mineGz = s.mineGz;
    out.mineGold = s.mineGold;
    out.mineSad = s.mineSad;
    out.mineSit = s.mineSit;
  }
  return out;
}
