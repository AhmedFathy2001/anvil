// Which features Anvil has, and what counts as using each one.
//
// PURE. One list maps every feature to the page routes, actions and plugin panel views that mean
// "somebody used this"; lib/analyticsRead reads the rows, `rankFeatures` below turns them into the
// "Feature use" table on /staff/analytics. Event formats and tile kinds are read off their own
// catalogs (formatCatalog, tileKinds) so a new format shows up here without anyone remembering to.
//
// Privacy: nothing here stores anything. It names routes and actions that analytics_events already
// holds (route patterns, closed action names, small flags like `fmt` and `kind`) and counts them.
//
// Matching rules:
//   • a page is a route pattern; `/c/[clan]` and `/s/[clan]` prefixes are ignored, a trailing `/*`
//     matches everything under it;
//   • an action matches by name, optionally narrowed by one prop (`fmt`, `type`, `kind`) — that is how
//     "each event format" and "each tile kind" share the one `event.created` / `tile.created` name;
//   • a plugin entry is the path the plugin route is stored under, with `?v=<view>` for the panel.

import type { ActionName } from '@/lib/analyticsActions';
import { FORMAT_CARDS } from '@/lib/formatCatalog';
import { TILE_TYPES, tileKindLabel } from '@/lib/tileKinds';
import { SEPULCHRE_TARGETS } from '@/lib/constants';

export type VariantProp = 'fmt' | 'type' | 'kind';

export interface ActionMatch {
  name: ActionName;
  /** Narrow the action to rows whose prop equals `value`. Both or neither. */
  prop?: VariantProp;
  value?: string;
}

export interface FeatureDef {
  key: string;
  label: string;
  group: string;
  pages?: string[];
  actions?: ActionMatch[];
  plugin?: string[];
  /** False: tracked, but left out of the ranking (every board requires a submission). */
  ranked?: boolean;
}

const act = (...names: ActionName[]): ActionMatch[] => names.map((name) => ({ name }));

/** Event formats, one per card of the "What are you running?" picker. */
function formatFeatures(): FeatureDef[] {
  return FORMAT_CARDS.map((c): FeatureDef => {
    const match: ActionMatch = c.choice.weekly
      ? { name: 'weekly.created', prop: 'type', value: c.choice.weekly }
      : { name: 'event.created', prop: 'fmt', value: c.key };
    return { key: `format.${c.key}`, label: c.name, group: 'Event formats', actions: [match] };
  });
}

/** Tile kinds, as the board names them (tileKindLabel), one feature per distinct label. */
export function tileKindLabels(): string[] {
  const probes = [
    ...TILE_TYPES.map((tileType) => ({ tileType })),
    { tileType: 'lap', targetNpcs: [SEPULCHRE_TARGETS[0].name] },
    { tileType: 'drop', itemRequirements: '[]' },
    { trackedStat: 'x', statType: 'boss' },
    { trackedStat: 'x', statType: 'skill' },
    {},
  ];
  return [...new Set(probes.map((p) => tileKindLabel(p as Parameters<typeof tileKindLabel>[0])))];
}

function tileKindFeatures(): FeatureDef[] {
  return tileKindLabels().map((label) => ({
    key: `tile.${label.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    label: `${label} tile`,
    group: 'Tile kinds',
    actions: [{ name: 'tile.created', prop: 'kind', value: label }],
  }));
}

export const FEATURES: readonly FeatureDef[] = [
  { key: 'weekly', label: 'Weekly competitions', group: 'Competitions', pages: ['/weekly', '/weekly/[id]', '/admin/events/weekly/*'], actions: act('weekly.joined', 'weekly.optedout'), plugin: ['/api/plugin/weekly-leaderboard'] },
  { key: 'challenges', label: 'Head-to-head challenges', group: 'Competitions', pages: ['/challenges'], actions: act('challenge.sent', 'challenge.accepted'), plugin: ['/api/plugin/ui?v=h2h'] },
  { key: 'coffer', label: 'Clan coffer', group: 'Money', pages: ['/coffer', '/admin/coffer'], actions: act('coffer.donated'), plugin: ['/api/plugin/coffer'] },
  { key: 'fees', label: 'Entry fees', group: 'Money', pages: ['/admin/fees', '/admin/events/[eventId]/fees'], actions: act('fee.paid') },
  { key: 'payouts', label: 'Payouts and prizes', group: 'Money', pages: ['/admin/events/[eventId]/payouts', '/admin/events/[eventId]/prize-pool'], actions: act('payout.paid') },
  { key: 'draft', label: 'Team draft', group: 'Teams', pages: ['/events/[eventId]/draft'], actions: act('draft.started', 'draft.pick') },
  { key: 'balance', label: 'Auto-balance', group: 'Teams', actions: act('team.balanced') },
  { key: 'guides', label: 'Guides (public)', group: 'Guides', pages: ['/guide', '/guide/*'] },
  { key: 'guides-ingame', label: 'Guides (in-game library)', group: 'Guides', pages: ['/guides', '/guides/*', '/admin/guides', '/admin/guides/*'], actions: act('guide.created', 'guide.copied') },
  { key: 'compare', label: 'Compare', group: 'Players', pages: ['/compare', '/compare/clans'], plugin: ['/api/plugin/ui?v=compare', '/api/plugin/ui?v=clan-compare'] },
  { key: 'chat', label: 'Chat feed', group: 'Social', pages: ['/events/[eventId]/chat', '/admin/events/[eventId]/chat-feed', '/settings/chat'], plugin: ['/api/plugin/ui?v=feed', '/api/plugin/chat-relay'] },
  { key: 'looks', label: 'Supporter looks', group: 'Social', pages: ['/settings/look', '/settings/look/[key]', '/settings/supporter'], actions: act('supporter.purchased') },
  { key: 'creator', label: 'Streaming and creator tools', group: 'Creators', pages: ['/host', '/host/friends', '/admin/space', '/admin/events/[eventId]/settings/stream'], actions: act('creator.created') },
  { key: 'discord', label: 'Discord posts', group: 'Discord', pages: ['/admin/integrations', '/admin/events/[eventId]/discord', '/events/[eventId]/discord'], actions: act('discord.posted', 'discord.join') },
  { key: 'tasklib', label: 'Task library', group: 'Boards', pages: ['/admin/tile-library'], actions: act('tasks.drawn') },
  { key: 'boardlib', label: 'Board library', group: 'Boards', actions: act('board.library') },
  { key: 'import', label: 'Tile import', group: 'Boards', actions: act('tiles.imported') },
  { key: 'surveys', label: 'Surveys', group: 'Events', pages: ['/events/[eventId]/survey', '/admin/events/[eventId]/survey', '/clan-events/[id]/survey'], actions: act('survey.answered') },
  { key: 'proofreview', label: 'Proof review', group: 'Events', pages: ['/admin/proofs', '/admin/proofs/[eventId]', '/admin/events/[eventId]/proofs'], actions: act('proof.reviewed') },
  // Tracked, never ranked: every board needs proof, so it would top every list and say nothing.
  { key: 'submissions', label: 'Proof submission', group: 'Events', actions: act('submission.created', 'submission.removed'), ranked: false },
  ...formatFeatures(),
  ...tileKindFeatures(),
];

// ── Matching ────────────────────────────────────────────────────────────────────────────────────

/** A route pattern without the clan or space prefix: `/c/[clan]/coffer` is `/coffer`. */
export function stripClanPrefix(pattern: string): string {
  const out = pattern.replace(/^\/[cs]\/\[clan\](?=\/|$)/, '');
  return out === '' ? '/' : out;
}

/** One analytics row, already grouped: what the read hands to `rankFeatures`. */
export interface UsageRow {
  kind: 'page' | 'action' | 'plugin';
  name: string;
  fmt?: string | null;
  type?: string | null;
  tileKind?: string | null;
  clanId: number | null;
  userId: number | null;
  accountId: number | null;
  /** `YYYY-MM-DD`, UTC. */
  day: string;
  n: number;
}

export interface Matcher {
  features: readonly FeatureDef[];
  exact: Map<string, number>;
  prefixes: [string, number][];
  actions: Map<string, [ActionMatch, number][]>;
  plugin: Map<string, number>;
}

export function buildMatcher(features: readonly FeatureDef[] = FEATURES): Matcher {
  const m: Matcher = { features, exact: new Map(), prefixes: [], actions: new Map(), plugin: new Map() };
  features.forEach((f, i) => {
    for (const p of f.pages ?? []) {
      if (p.endsWith('/*')) m.prefixes.push([p.slice(0, -2), i]);
      else if (!m.exact.has(p)) m.exact.set(p, i);
    }
    for (const a of f.actions ?? []) m.actions.set(a.name, [...(m.actions.get(a.name) ?? []), [a, i]]);
    for (const p of f.plugin ?? []) if (!m.plugin.has(p)) m.plugin.set(p, i);
  });
  return m;
}

/** The feature a row counts toward, or null. A row counts toward at most one. */
export function featureOf(m: Matcher, row: UsageRow): number | null {
  if (row.kind === 'page') {
    const p = stripClanPrefix(row.name);
    const hit = m.exact.get(p);
    if (hit !== undefined) return hit;
    for (const [prefix, i] of m.prefixes) if (p === prefix || p.startsWith(`${prefix}/`)) return i;
    return null;
  }
  if (row.kind === 'plugin') return m.plugin.get(row.name) ?? null;
  const cands = m.actions.get(row.name);
  if (!cands) return null;
  const variant: Record<VariantProp, string | null | undefined> = { fmt: row.fmt, type: row.type, kind: row.tileKind };
  for (const [a, i] of cands) {
    if (!a.prop) return i;
    if (variant[a.prop] === a.value) return i;
  }
  return null;
}

/** Names the read must fetch: exact page patterns (both prefixes), prefix patterns, plugin paths. */
export function registryNames(features: readonly FeatureDef[] = FEATURES) {
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  const plugin = new Set<string>();
  for (const f of features) {
    for (const p of f.pages ?? []) {
      const set = p.endsWith('/*') ? prefixes : exact;
      const base = p.endsWith('/*') ? p.slice(0, -2) : p;
      for (const pre of ['', '/c/[clan]', '/s/[clan]']) set.add(base === '/' ? pre || '/' : `${pre}${base}`);
    }
    for (const p of f.plugin ?? []) plugin.add(p);
  }
  return { exact: [...exact], prefixes: [...prefixes], plugin: [...plugin] };
}

// ── Ranking ─────────────────────────────────────────────────────────────────────────────────────

export interface FeatureUsage {
  key: string;
  label: string;
  group: string;
  clans: number;
  people: number;
  uses7: number;
  uses30: number;
  /** Uses in the 30 days before the last 30. */
  prev30: number;
  /** Change of the last 30 days against the 30 before, as a fraction; null when there was nothing before. */
  trend: number | null;
  /** `YYYY-MM-DD` of the most recent use inside the rows given, or null. */
  lastUsed: string | null;
}

const DAY_MS = 86_400_000;

/** Whole days between a `YYYY-MM-DD` and today (UTC); 0 is today. */
export function ageInDays(day: string, now: Date): number {
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.floor((today - Date.parse(`${day}T00:00:00Z`)) / DAY_MS);
}

/** Last 30 days against the 30 before: +0.5 is half again as many. Null with no earlier uses. */
export function trendOf(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

/**
 * Every ranked feature with its numbers, most used (last 30 days) first. A feature with no rows is
 * still listed, with zeros and no last-used day, so the "not used in 90 days" list can name it.
 * Rows older than 90 days are ignored. Unranked features (proof submission) never appear.
 */
export function rankFeatures(rows: Iterable<UsageRow>, now: Date = new Date(), features: readonly FeatureDef[] = FEATURES): FeatureUsage[] {
  const m = buildMatcher(features);
  const acc = features.map(() => ({
    clans: new Set<number>(),
    people: new Set<string>(),
    uses7: 0,
    uses30: 0,
    prev30: 0,
    last: null as string | null,
  }));
  for (const row of rows) {
    const i = featureOf(m, row);
    if (i === null || features[i].ranked === false) continue;
    const age = ageInDays(row.day, now);
    if (age < 0 || age >= 90) continue;
    const a = acc[i];
    if (a.last === null || row.day > a.last) a.last = row.day;
    if (age < 7) a.uses7 += row.n;
    if (age < 30) {
      a.uses30 += row.n;
      if (row.clanId != null) a.clans.add(row.clanId);
      if (row.userId != null) a.people.add(`u${row.userId}`);
      else if (row.accountId != null) a.people.add(`a${row.accountId}`);
    } else if (age < 60) a.prev30 += row.n;
  }
  return features
    .map((f, i): FeatureUsage => {
      const a = acc[i];
      return {
        key: f.key,
        label: f.label,
        group: f.group,
        clans: a.clans.size,
        people: a.people.size,
        uses7: a.uses7,
        uses30: a.uses30,
        prev30: a.prev30,
        trend: trendOf(a.uses30, a.prev30),
        lastUsed: a.last,
      };
    })
    .filter((_, i) => features[i].ranked !== false)
    .sort((x, y) => y.uses30 - x.uses30 || y.people - x.people || x.label.localeCompare(y.label));
}

/** Features with no use in the last 90 days of the rows given. */
export function unusedFeatures(usage: FeatureUsage[]): FeatureUsage[] {
  return usage.filter((u) => u.lastUsed === null);
}
