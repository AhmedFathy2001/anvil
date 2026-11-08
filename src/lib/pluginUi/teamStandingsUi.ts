/**
 * Team / clan-vs-clan standings for the plugin side panel (lib/competitionTeams).
 *
 * Two halves:
 *  - `weeklyGroupsPayload` — the data, added as `groups` to GET /api/plugin/weekly-leaderboard;
 *  - `yourGroupCard` / `groupStandingsNodes` — ready-made nodes for the panel to drop in when the
 *    Clan/Home tab is wired (homeUi/views are owned by the Clan-tab redesign; nothing here touches
 *    them). Pure: no database.
 */
import { count, card, gap, muted, row, text, type Color, type Node } from '@/lib/pluginUi/nodes';
import { ordinal } from '@/lib/competitionTeams';
import type { GroupStandingsView } from '@/lib/competitionTeamsDb';
import { EFFICIENCY_SCALE } from '@/lib/constants';

export interface WeeklyGroupRow {
  rank: number;
  name: string;
  colour: string | null;
  total: number;
  average: number;
  members: number;
  you: boolean;
  /** The group's best three players. */
  top: { rsn: string; gained: number }[];
}

export interface WeeklyGroupsPayload {
  mode: 'teams' | 'clans';
  /** 'team' | 'clan' — the noun the panel prints. */
  noun: 'team' | 'clan';
  /** Number of teams/clans. */
  of: number;
  /** The viewer's group, or null when the RSN is on none (unassigned / not entered). */
  you: (WeeklyGroupRow & { line: string }) | null;
  standings: WeeklyGroupRow[];
}

/** "+1.2M XP", "+340 KC", "+3.25 hrs". */
export function groupGain(type: string, n: number): string {
  const safe = Math.max(0, n);
  if (type === 'efficiency') return `+${(safe / EFFICIENCY_SCALE).toFixed(2)} hrs`;
  return `+${count(Math.round(safe))} ${type === 'skill' ? 'XP' : 'KC'}`;
}

const MAX_GROUPS = 16;

export function weeklyGroupsPayload(type: string, view: GroupStandingsView | null): WeeklyGroupsPayload | null {
  if (!view || view.mode === 'solo') return null;
  const noun = view.mode === 'clans' ? 'clan' : 'team';
  const standings: WeeklyGroupRow[] = view.groups.slice(0, MAX_GROUPS).map((g) => ({
    rank: g.rank,
    name: g.name,
    colour: g.colour,
    total: g.total,
    average: Math.round(g.average),
    members: g.members,
    you: g.isYours,
    top: g.entries.slice(0, 3).map((e) => ({ rsn: e.rsn, gained: e.gained })),
  }));
  const mine = view.groups.find((g) => g.isYours);
  const you = mine
    ? {
        ...standings.find((s) => s.rank === mine.rank)!,
        // "Your team: 2nd of 4 · +1.2M XP"
        line: `Your ${noun}: ${ordinal(mine.rank)} of ${view.groups.length} · ${groupGain(type, mine.total)}`,
      }
    : null;
  return { mode: view.mode, noun, of: view.groups.length, you, standings };
}

const hex = (c: string | null): Color => (c && /^#[0-9a-f]{6}$/i.test(c) ? (c as Color) : 'brand');

/** The top card: "Your team: 2nd of 4 · +1.2M XP" with the team name in its colour. */
export function yourGroupCard(type: string, g: WeeklyGroupsPayload): Node | null {
  if (!g.you) return null;
  return card([
    row(text(g.you.name, hex(g.you.colour)), undefined, text(groupGain(type, g.you.total), 'progress')),
    muted(`Your ${g.noun}: ${ordinal(g.you.rank)} of ${g.of} · ${groupGain(type, g.you.average)} avg/player`),
  ]);
}

/** Compact standings: one row per team/clan — rank, name (in colour), total; yours highlighted. */
export function groupStandingsNodes(type: string, g: WeeklyGroupsPayload, max = 8): Node[] {
  const rows = g.standings.slice(0, max).map((s) =>
    row(
      text(`${s.rank}. ${s.name}${s.you ? ' (you)' : ''}`, s.you ? 'brand' : hex(s.colour)),
      undefined,
      text(groupGain(type, s.total), s.you ? 'progress' : 'white'),
    ),
  );
  return [text(g.mode === 'clans' ? 'Clan standings' : 'Team standings', 'brand'), gap(4), ...rows];
}
