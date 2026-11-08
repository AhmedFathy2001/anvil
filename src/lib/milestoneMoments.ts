/**
 * The clan feed's rows for the newer line kinds (lib/notifyKinds): Slayer tasks, clue scrolls,
 * speedruns, kill counts, BA gambles and the clan's own chat patterns. Stored as moment kind
 * 'milestone' with `sourceKind` naming which one, `quantity` the number the line carried, `itemName`
 * what it was about and `tier` a clue tier or 'pb'. A player's own patterns and the private kinds
 * never become rows (the notify route only records shared, vetted lines).
 *
 * Pure: the parse runs on the vetted, capped line.
 */

export const MILESTONE_KIND = 'milestone';
export const MILESTONE_SUBS = ['slayer', 'clues', 'speedruns', 'kc', 'ba', 'custom'] as const;
export type MilestoneSub = (typeof MILESTONE_SUBS)[number];

export interface MilestoneFacts {
  sub: MilestoneSub;
  itemName: string;
  quantity: number;
  tier: string | null;
}

const num = (v: string | undefined) => (v ? Number(v.replace(/,/g, '')) : 0);
const clamp = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** A vetted line → what the row stores, or null for a kind that never makes a row. */
export function milestoneOf(kind: string, line: string): MilestoneFacts | null {
  switch (kind) {
    case 'slayer': {
      const m = /completed ([\d,]+) tasks?/i.exec(line);
      return { sub: 'slayer', itemName: 'Slayer task', quantity: num(m?.[1]), tier: null };
    }
    case 'clues': {
      const m = /completed ([\d,]+) (\w+) treasure trails?/i.exec(line);
      return { sub: 'clues', itemName: (m?.[2] ?? 'clue').toLowerCase(), quantity: num(m?.[1]), tier: (m?.[2] ?? '').toLowerCase() || null };
    }
    case 'speedruns': {
      const pb = /new personal best/i.test(line);
      const what = line.replace(/\s*\(new personal best\)\s*/i, ' ').replace(/[.\s]+$/, '').trim();
      return { sub: 'speedruns', itemName: clamp(what, 80), quantity: 1, tier: pb ? 'pb' : null };
    }
    case 'kc': {
      const m = /^your (.{1,80}) count is: ([\d,]+)/i.exec(line);
      return { sub: 'kc', itemName: m ? `${m[1]} count` : 'kill count', quantity: num(m?.[2]), tier: null };
    }
    case 'ba': {
      const m = /(\w+ level )?gamble count: ([\d,]+)/i.exec(line);
      return { sub: 'ba', itemName: `${m?.[1] ?? ''}gambles`.trim(), quantity: num(m?.[2]), tier: null };
    }
    case 'custom':
      return { sub: 'custom', itemName: clamp(line, 100), quantity: 1, tier: null };
  }
  return null;
}

type Row = { sourceKind?: string | null; itemName: string | null; quantity: number; tier?: string | null };
const n = (q: number) => q.toLocaleString('en-US');
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The panel Feed's title. */
export function milestoneTitle(m: Row): string {
  const what = m.itemName ?? '';
  switch (m.sourceKind) {
    case 'slayer':
      return m.quantity > 0 ? `Slayer task · ${n(m.quantity)} streak` : 'Slayer task';
    case 'clues':
      return `${cap(what)} clue${m.quantity > 0 ? ` · ${n(m.quantity)}` : ''}`;
    case 'speedruns':
      return m.tier === 'pb' ? `PB: ${what}` : what;
    case 'kc':
      return `${cap(what)} ${n(m.quantity)}`;
    case 'ba':
      return `${n(m.quantity)} ${what}`;
    default:
      return what;
  }
}

/** The site feed's sentence, after the name. */
export function milestoneSentence(m: Row): string {
  const what = m.itemName ?? '';
  switch (m.sourceKind) {
    case 'slayer':
      return m.quantity > 0 ? `finished a Slayer task (${n(m.quantity)} in a row)` : 'finished a Slayer task';
    case 'clues':
      return `completed a ${what} clue scroll${m.quantity > 0 ? ` (${n(m.quantity)} total)` : ''}`;
    case 'speedruns':
      return m.tier === 'pb' ? `set a new personal best: ${what}` : `posted a time: ${what}`;
    case 'kc':
      return `reached ${n(m.quantity)} ${what}`;
    case 'ba':
      return `reached ${n(m.quantity)} ${what}`;
    default:
      return `saw “${what}”`;
  }
}

/** Clue scroll item per tier, for the row's picture. */
export const CLUE_ITEM: Record<string, number> = { beginner: 23182, easy: 2677, medium: 2801, hard: 2722, elite: 12073, master: 19835 };
