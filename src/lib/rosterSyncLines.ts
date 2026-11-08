/**
 * The chat lines a roster sync prints in game, written here so the plugin only prints them. Same
 * words the plugin used to compose from the counts (AnvilPlugin.syncClanRoster before `say`).
 *
 * `auto` is the background sync's line (empty when nothing moved); `manual` is the button's report;
 * `warn` goes out in the warning tone on either.
 */
export interface RosterChange {
  type: string;
  rsn: string;
  oldRsn?: string | null;
  oldRank?: string | null;
  newRank?: string | null;
}

export interface RosterSyncSay {
  auto: string[];
  manual: string[];
  warn: string[];
}

const CHANGE_CAP = 12;
const REFUSED_CAP = 6;

function changeLine(c: RosterChange): string | null {
  switch (c.type) {
    case 'joined':
      return `${c.rsn} joined the clan.`;
    case 'left':
      return `${c.rsn} left the clan.`;
    case 'returned':
      return `${c.rsn} returned to the clan.`;
    case 'renamed':
      return `${c.oldRsn ?? '?'} is now known as ${c.rsn}.`;
    case 'rank_changed':
      return `${c.rsn} is now ${c.newRank ?? 'ranked'}${c.oldRank != null ? ` (was ${c.oldRank})` : ''}.`;
    default:
      return null;
  }
}

export function rosterSyncSay(r: {
  added: number;
  updated: number;
  markedLeft: number;
  returned: number;
  renamed: number;
  changes: RosterChange[];
  refusedNewMembers: string[];
}): RosterSyncSay {
  const moved = [
    r.added > 0 ? `${r.added} joined` : null,
    r.returned > 0 ? `${r.returned} returned` : null,
    r.markedLeft > 0 ? `${r.markedLeft} left` : null,
    r.renamed > 0 ? `${r.renamed} renamed` : null,
  ].filter((p): p is string => p != null);
  const auto = moved.length ? [`Clan roster updated: ${moved.join(', ')}.`] : [];

  const manual = [`Clan roster synced: +${r.added} added · ${r.updated} updated · ${r.markedLeft} left`];
  const lines = r.changes.map(changeLine).filter((l): l is string => l != null);
  manual.push(...lines.slice(0, CHANGE_CAP));
  if (r.changes.length > CHANGE_CAP) manual.push(`...and ${r.changes.length - CHANGE_CAP} more changes (see Discord audit feed).`);

  const warn: string[] = [];
  if (r.refusedNewMembers.length) {
    const names = r.refusedNewMembers.slice(0, REFUSED_CAP).join(', ');
    const more = r.refusedNewMembers.length > REFUSED_CAP ? ` and ${r.refusedNewMembers.length - REFUSED_CAP} more` : '';
    warn.push(`Not added (plan limit): ${names}${more}.`);
  }
  return { auto, manual, warn };
}
