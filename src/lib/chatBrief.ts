// The login brief: one or two chat lines the plugin prints once per login, so somebody who never
// opens the side panel still hears where they stand. Pure — app/api/plugin/brief gathers the facts.
//
//   Bingo X is live: your team is 2nd of 5, 3 tiles nearly done · SOTW Mining: 9th, 1.2M XP to 8th
//
// Everyone gets bingo + weekly; Champions choose what goes in (lib/chatLook effectiveBrief).

import type { BriefItem, Tone } from '@/lib/chatFeedRules';

export interface BriefLine {
  tone: Tone;
  text: string;
}

export interface BriefFacts {
  bingo: { name: string; rank: number | null; teams: number; nearly: string[] } | null;
  weeklies: { label: string; unit: 'XP' | 'KC' | 'h'; rank: number | null; gained: number; ahead: number | null }[];
  clanEvents: { title: string; startsInMin: number }[];
  goal: { text: string; pct: number } | null;
}

const ord = (n: number) => {
  const v = n % 100;
  return `${n}${['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th'}`;
};

export function amount(n: number, unit: 'XP' | 'KC' | 'h'): string {
  if (unit === 'h') return `${(n / 1000).toFixed(1)}h`;
  if (unit === 'KC') return `${Math.round(n).toLocaleString('en-US')} KC`;
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M XP`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K XP`;
  return `${Math.round(n)} XP`;
}

function when(min: number): string {
  if (min <= 0) return 'on now';
  if (min < 60) return `in ${min}m`;
  return `in ${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}`;
}

/** At most this long per line: the chatbox wraps past it and a brief that wraps reads as a wall. */
const MAX_LINE = 150;

export function composeBrief(items: BriefItem[], f: BriefFacts): BriefLine[] {
  const first: string[] = [];
  const second: string[] = [];
  let tone: Tone = 'info';
  const want = new Set(items);

  if (want.has('bingo') && f.bingo) {
    const b = f.bingo;
    const parts = [b.rank != null ? `your team is ${ord(b.rank)}${b.teams > 1 ? ` of ${b.teams}` : ''}` : null];
    if (b.nearly.length) parts.push(`${b.nearly.length} tile${b.nearly.length === 1 ? '' : 's'} nearly done`);
    first.push(`${b.name} is live${parts.some(Boolean) ? `: ${parts.filter(Boolean).join(', ')}` : ''}`);
    if (b.nearly.length) tone = 'near';
  }
  if (want.has('weekly')) {
    for (const w of f.weeklies.slice(0, 2)) {
      if (w.rank == null) first.push(`${w.label}: not on the board yet`);
      else if (w.gained <= 0) first.push(`${w.label}: ${ord(w.rank)} with ${amount(0, w.unit)}`);
      else if (w.rank === 1) first.push(`${w.label}: leading with ${amount(w.gained, w.unit)}`);
      else first.push(`${w.label}: ${ord(w.rank)}${w.ahead != null ? `, ${amount(Math.max(1, w.ahead - w.gained), w.unit)} to ${ord(w.rank - 1)}` : ''}`);
    }
  }
  if (want.has('tiles') && f.bingo?.nearly.length) second.push(`Nearly done: ${f.bingo.nearly.slice(0, 3).join(', ')}`);
  if (want.has('clanEvents')) for (const e of f.clanEvents.slice(0, 2)) second.push(`${e.title} ${when(e.startsInMin)}`);
  if (want.has('goals') && f.goal) second.push(`Goal: ${f.goal.text} (${Math.round(f.goal.pct)}%)`);

  const fit = (parts: string[]) => {
    let line = '';
    for (const p of parts) {
      const next = line ? `${line} · ${p}` : p;
      if (next.length > MAX_LINE) break;
      line = next;
    }
    return line;
  };
  const out: BriefLine[] = [];
  const a = fit(first);
  const b = fit(second);
  if (a) out.push({ tone, text: a });
  if (b) out.push({ tone: 'info', text: b });
  return out;
}
