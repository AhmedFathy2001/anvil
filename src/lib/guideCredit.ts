// Writer credit: who a guide helped, and who gets the credit. PURE.
//
// CREDIT = USE. A writer's credit for a month is the real players their LIVE pieces helped that
// month, however long ago the piece was written: a mature guide keeps paying its author, and nothing
// rewards churning or rewriting.
//
// EDITS EARN FOR THEIR DELTA. A reviewer tags an accepted edit fix / clarification / substantive.
//   fix, clarification — a small fixed credit, once per piece per month however many there were;
//   substantive (and updating a stale piece) — a share of the piece's reach (SUBSTANTIVE_SHARE, split
//   among that piece's substantive editors). The original author keeps their whole share.
// REAL PLAYERS ONLY. A reached account counts 1 when the plugin confirmed activity (kc on the boss,
// the setup seen worn), less when it only voted, ~0 when it is brand new, and 0 when it is the
// writer's own (same person). One clan's share of a piece's reach above CLAN_CAP counts nothing.
// CLAWBACK. A reverted edit, a hidden piece, or a setup that lost its place to an alternative stops
// earning — they simply aren't live.
// SHOW LESS OF THE NUMBER. Writers see their rank and an impact BAND; "top writers" is a featured
// group with no order (featuredWriters), and the monthly reward is a curator's pick from it.

export type EditTag = 'fix' | 'clarification' | 'substantive' | 'upkeep';
export const EDIT_TAGS: { key: EditTag; label: string }[] = [
  { key: 'fix', label: 'Fix (typo, wrong number)' },
  { key: 'clarification', label: 'Clarification' },
  { key: 'substantive', label: 'Substantive (changes what players do)' },
  { key: 'upkeep', label: 'Upkeep (brings a stale piece up to date)' },
];

/** A thing someone wrote that players can use: a setup, a step, a tip, a whole guide or route. */
export interface Piece {
  id: string;
  authorUserId: number | null;
  /** The author's person (players.id), to spot their own characters. */
  authorPlayerId?: number | null;
  /** Live = shown and not superseded (hidden, reverted, or replaced by an alternative → false). */
  live: boolean;
  /** Filled a Wanted request first. */
  firstToWrite?: boolean;
  /** Month it went live ("YYYY-MM"). */
  createdMonth?: string;
}

export interface Edit {
  pieceId: string;
  userId: number;
  tag: EditTag;
  /** Undone later (its revision reverted): earns nothing. */
  reverted?: boolean;
  /** "YYYY-MM" it was accepted. */
  month: string;
}

/** One account that used a piece (this month). */
export interface Reach {
  pieceId: string;
  accountId: number;
  /** The person behind it (players.id), when known. */
  playerId?: number | null;
  clanId?: number | null;
  /** Days since the account was first seen. */
  ageDays: number;
  /** Plugin-confirmed: kc on the boss, or the setup seen worn ('auto'). */
  confirmed: boolean;
  /** A manual "used it" vote. */
  voted: boolean;
}

export const FIX_CREDIT = 2;
export const SUBSTANTIVE_SHARE = 0.2;
export const FIRST_TO_WRITE_BONUS = 50;
/** A clan may supply at most this share of a piece's reach (at least CLAN_FLOOR accounts' worth). */
export const CLAN_CAP = 0.25;
const CLAN_FLOOR = 3;
const NEW_ACCOUNT_DAYS = 14;

/** How much one account's use is worth before the clan cap. */
export function reachWeight(r: Reach, authorPlayerId: number | null | undefined): number {
  if (authorPlayerId != null && r.playerId != null && r.playerId === authorPlayerId) return 0;
  const base = r.confirmed ? 1 : r.voted ? 0.4 : 0;
  if (!base) return 0;
  return r.ageDays < NEW_ACCOUNT_DAYS ? base * 0.05 : base;
}

/** A piece's weighted reach: distinct accounts, each weighted, one clan's excess counted at 0. */
export function pieceReach(piece: Piece, reach: Reach[]): number {
  const byAccount = new Map<number, Reach>();
  for (const r of reach) {
    if (r.pieceId !== piece.id) continue;
    const prev = byAccount.get(r.accountId);
    // One account, its best evidence.
    if (!prev || reachWeight(r, piece.authorPlayerId) > reachWeight(prev, piece.authorPlayerId)) byAccount.set(r.accountId, r);
  }
  const rows = [...byAccount.values()].map((r) => ({ r, w: reachWeight(r, piece.authorPlayerId) })).filter((x) => x.w > 0);
  const total = rows.reduce((a, x) => a + x.w, 0);
  const byClan = new Map<number, number>();
  for (const x of rows) if (x.r.clanId != null) byClan.set(x.r.clanId, (byClan.get(x.r.clanId) ?? 0) + x.w);
  let out = 0;
  const cap = Math.max(CLAN_FLOOR, total * CLAN_CAP);
  for (const x of rows) {
    const clanTotal = x.r.clanId != null ? byClan.get(x.r.clanId)! : 0;
    out += x.r.clanId != null && clanTotal > cap ? (x.w * cap) / clanTotal : x.w;
  }
  return out;
}

/** Each writer's credit for one month. */
export function monthlyCredit(month: string, pieces: Piece[], edits: Edit[], reach: Reach[]): Map<number, number> {
  const out = new Map<number, number>();
  const add = (u: number | null | undefined, n: number) => {
    if (u == null || !n) return;
    out.set(u, (out.get(u) ?? 0) + n);
  };
  for (const p of pieces) {
    if (!p.live) continue;
    const r = pieceReach(p, reach);
    add(p.authorUserId, r);
    if (p.firstToWrite && p.createdMonth === month) add(p.authorUserId, FIRST_TO_WRITE_BONUS);
    const live = edits.filter((e) => e.pieceId === p.id && !e.reverted && e.userId !== p.authorUserId);
    // Substantive editors share a slice of the reach; the author's share is untouched.
    const subs = [...new Set(live.filter((e) => e.tag === 'substantive' || e.tag === 'upkeep').map((e) => e.userId))];
    for (const u of subs) add(u, (r * SUBSTANTIVE_SHARE) / subs.length);
    // Small fixes: a fixed credit once per editor per piece in the month they were accepted.
    const fixers = new Set(live.filter((e) => (e.tag === 'fix' || e.tag === 'clarification') && e.month === month && !subs.includes(e.userId)).map((e) => e.userId));
    for (const u of fixers) add(u, FIX_CREDIT);
  }
  return out;
}

// ── Ranks, bands, the featured group ───────────────────────────────────────────────────────────

export const WRITER_RANKS = [
  { key: 'contributor', label: 'Contributor', min: 1, quill: 'bronze' },
  { key: 'writer', label: 'Guide writer', min: 1_000, quill: 'silver' },
  { key: 'master', label: 'Master writer', min: 10_000, quill: 'gold' },
] as const;
export type WriterRank = (typeof WRITER_RANKS)[number];

/** A writer's rank from lifetime players helped; null below the first. */
export function writerRank(lifetime: number): WriterRank | null {
  let r: WriterRank | null = null;
  for (const x of WRITER_RANKS) if (lifetime >= x.min) r = x;
  return r;
}

/** The next rank and how far there is to go (for "3,600 to go"). */
export function nextRank(lifetime: number): { rank: WriterRank; toGo: number } | null {
  const next = WRITER_RANKS.find((x) => lifetime < x.min);
  return next ? { rank: next, toGo: Math.ceil(next.min - lifetime) } : null;
}

const BANDS = [
  [1, 50],
  [50, 500],
  [500, 1_000],
  [1_000, 5_000],
  [5_000, 10_000],
  [10_000, 50_000],
] as const;

/** "1–5k players" rather than a live exact number. */
export function impactBand(n: number): string {
  if (n < 1) return 'No players yet';
  const k = (x: number) => (x >= 1000 ? `${x / 1000}k` : String(x));
  for (const [lo, hi] of BANDS) if (n < hi) return `${k(lo)}–${k(hi)} players`;
  return '50k+ players';
}

/** Players helped as shown on a byline: a band, never a running exact count. */
export const helpedLine = (n: number) => `${impactBand(n)} helped`;

/**
 * This month's featured writers: the top `size` by credit (ties by id), returned in NAME order so
 * the page shows a group, not a 1-2-3 table. Credit under `min` never features.
 */
export function featuredWriters(credit: Map<number, number>, names: Map<number, string>, size = 10, min = 5): number[] {
  const top = [...credit.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, size)
    .map(([u]) => u);
  return top.sort((a, b) => (names.get(a) ?? '').localeCompare(names.get(b) ?? '') || a - b);
}

/** Curator powers: platform staff, a guide editor, or a Master writer. */
export function canCurate(u: { platformStaff?: boolean; guideEditor?: boolean; lifetime?: number }): boolean {
  return !!u.platformStaff || !!u.guideEditor || (u.lifetime ?? 0) >= WRITER_RANKS[2].min;
}

// ── Contributors on a byline ─────────────────────────────────────────────────────────────────

export type ContributionKind = 'author' | 'setup' | 'step' | 'edit' | 'revision' | 'tip';
export interface Contribution {
  userId: number;
  name: string;
  kind: ContributionKind;
  /** Reach of the piece it touched (weighted players), when known. */
  reach?: number;
  /** For an edit: its tag. */
  tag?: EditTag;
  /** Earliest time, ISO, for ties. */
  at?: string;
}

const KIND_WEIGHT: Record<ContributionKind, number> = { author: 1000, setup: 300, step: 120, edit: 0, revision: 20, tip: 10 };
const TAG_WEIGHT: Record<EditTag, number> = { substantive: 100, upkeep: 100, clarification: 15, fix: 10 };

export interface Contributor {
  userId: number;
  name: string;
  impact: number;
  kinds: ContributionKind[];
}

/** Everyone credited on a guide, by impact (ties: who came first). Derived, never typed by hand. */
export function contributors(list: Contribution[]): Contributor[] {
  const by = new Map<number, Contributor & { at: string }>();
  for (const c of list) {
    const w = (c.kind === 'edit' ? TAG_WEIGHT[c.tag ?? 'fix'] : KIND_WEIGHT[c.kind]) + (c.kind === 'author' || c.kind === 'setup' || c.kind === 'step' ? (c.reach ?? 0) : (c.reach ?? 0) * (c.tag === 'substantive' ? SUBSTANTIVE_SHARE : 0));
    const cur = by.get(c.userId) ?? { userId: c.userId, name: c.name, impact: 0, kinds: [], at: c.at ?? '9' };
    cur.impact += w;
    if (!cur.kinds.includes(c.kind)) cur.kinds.push(c.kind);
    if ((c.at ?? '9') < cur.at) cur.at = c.at!;
    by.set(c.userId, cur);
  }
  return [...by.values()].sort((a, b) => b.impact - a.impact || a.at.localeCompare(b.at)).map(({ at: _at, ...c }) => c);
}

/** Escape a name for Discord markdown, and break mentions. */
export function discordName(name: string): string {
  return name.replace(/([*_~`|>#\\[\]()<:])/g, '\\$1').replace(/@/g, '@\u200b').slice(0, 40);
}

/** "Written by X, Y and N others" (plain words; names escaped when `discord`). */
export function writtenByLine(list: Contributor[], discord = false, shown = 2): string {
  if (!list.length) return '';
  const nm = (c: Contributor) => (discord ? discordName(c.name) : c.name);
  const head = list.slice(0, shown).map(nm);
  const rest = list.length - head.length;
  if (rest <= 0) return `Written by ${head.length > 1 ? `${head.slice(0, -1).join(', ')} and ${head[head.length - 1]}` : head[0]}`;
  return `Written by ${head.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`;
}

/** A clan copy's credit: the library's authors and the clan's own editors, kept apart. */
export function copyCreditLine(library: Contributor[], clanEditors: Contributor[], clanName: string, discord = false): string {
  const nm = (c: Contributor) => (discord ? discordName(c.name) : c.name);
  const cn = discord ? discordName(clanName) : clanName;
  const lib = library.length ? `Based on Anvil's guide by ${nm(library[0])}${library.length > 1 ? ` +${library.length - 1}` : ''}` : "Based on Anvil's guide";
  if (!clanEditors.length) return lib;
  return `${lib} · edited for ${cn} by ${clanEditors.slice(0, 2).map(nm).join(', ')}${clanEditors.length > 2 ? ` +${clanEditors.length - 2}` : ''}`;
}

/** "by X +N" for cards and plugin rows. */
export const byShort = (list: Contributor[]) => (list.length ? `by ${list[0].name}${list.length > 1 ? ` +${list.length - 1}` : ''}` : '');

// ── "Used it" votes and the community setup ranking ────────────────────────────────────────────

/**
 * One vote's weight for ranking a community setup. No kc on the guide's boss = no vote (it is "used
 * it", not "like"): 1 kc ≈ 0.3, 10 ≈ 0.65, 100+ = 1. A vote from the author's own clan counts half,
 * and an automatic record (the plugin saw the setup worn at the boss) counts full whatever the kc.
 */
export function voteWeight(v: { kc: number; sameClan?: boolean; source?: 'manual' | 'auto'; self?: boolean }): number {
  if (v.self) return 0;
  const kcW = v.source === 'auto' ? 1 : v.kc >= 1 ? Math.min(1, 0.3 + Math.log10(v.kc) * 0.35) : 0;
  return Math.round(kcW * (v.sameClan ? 0.5 : 1) * 1000) / 1000;
}

/** Community setups ranked by kc-weighted distinct users (ties: more voters, then older first). */
export function rankByVotes<T extends { id: number; createdAt: string }>(items: T[], votes: { itemId: number; userId: number; weight: number }[]): (T & { score: number; voters: number })[] {
  const score = new Map<number, Map<number, number>>();
  for (const v of votes) {
    const m = score.get(v.itemId) ?? new Map<number, number>();
    m.set(v.userId, Math.max(m.get(v.userId) ?? 0, v.weight));
    score.set(v.itemId, m);
  }
  return items
    .map((it) => {
      const m = score.get(it.id) ?? new Map<number, number>();
      return { ...it, score: [...m.values()].reduce((a, w) => a + w, 0), voters: [...m.values()].filter((w) => w > 0).length };
    })
    .sort((a, b) => b.score - a.score || b.voters - a.voters || a.createdAt.localeCompare(b.createdAt));
}
