// One guide as a reader (or a clan editor) sees it: Anvil's pieces with a clan's changes laid on
// top. PURE — lib/guidePieces/store reads the rows and hands them here.
//
// Per Anvil piece: the clan's override wins if there is one, else Anvil's own; an override marked
// hidden removes the piece. Pieces the clan added of its own are included as they are. Every result
// says where it came from (`source`) and, for an override, whether Anvil has changed the piece since
// the clan wrote theirs (`anvilChanged`) — the clan editor's "Anvil updated this · take theirs /
// keep ours".
//
// Then the reader's filters: a section, a role and a variant (level, account, team size, raid
// level). Roles layer on the shared base: for the kinds a player has only one of (loadout,
// fallbacks, spec — SINGLE_KINDS) the most specific match in a section wins (the role's over '*',
// then the variant naming more of the reader over a broader one); every other kind adds up, base
// first. With no filters at all (the editor), everything is returned.

import { BASE_ROLE, SINGLE_KINDS, type PieceKind, type Variant } from './schema';

export interface AnvilPieceRow {
  id: number;
  guideId: number;
  sectionKey: string;
  roleKey: string;
  variant: Variant;
  kind: PieceKind;
  body: unknown;
  position: number;
  version: number;
  status: string;
}

export interface OverrideRow {
  id: number;
  clanId: number;
  /** Null: a piece the clan added of its own (or one whose Anvil piece was since deleted). */
  pieceId: number | null;
  guideId: number;
  sectionKey: string;
  roleKey: string;
  variant: Variant;
  kind: PieceKind;
  body: unknown | null;
  hidden: boolean;
  position: number | null;
  basedOnVersion: number | null;
  version: number;
}

export interface ResolvedPiece {
  /** Stable across both sources: "a<pieceId>" for an Anvil piece (overridden or not), "c<overrideId>" for a clan-added one. */
  key: string;
  pieceId: number | null;
  overrideId: number | null;
  source: 'anvil' | 'clan';
  section: string;
  role: string;
  variant: Variant;
  kind: PieceKind;
  body: unknown;
  position: number;
  /** The Anvil piece moved on after the clan wrote its version. */
  anvilChanged: boolean;
  anvilVersion: number | null;
  basedOnVersion: number | null;
  /** Only with `editor`: the clan hid this Anvil piece (body is Anvil's, for the "show again" view). */
  hidden?: boolean;
  /** Only with `drafts`: Anvil's draft, not yet shown to readers. */
  draft?: boolean;
}

export interface ResolveFilters {
  section?: string;
  /** The reader's role: '*' pieces plus this role's. Absent = every role (the editor). */
  role?: string;
  /** Who is reading. A key left out matches every variant on that key. */
  reader?: { level?: Variant['level']; account?: Variant['account']; teamSize?: number; raidLevel?: number };
  kinds?: PieceKind[];
  /** The editor's view: hidden pieces included (flagged), no role/variant collapsing. */
  editor?: boolean;
  /**
   * Anvil's drafts included (flagged). For the LIBRARY editor only: a clan editor's view must not set
   * it, or unreleased library work shows in every clan.
   */
  drafts?: boolean;
}

/** Does this piece's variant cover the reader? How many of its keys named them (for "most specific wins"). */
export function variantMatch(v: Variant, reader: ResolveFilters['reader'] = {}): { ok: boolean; score: number } {
  let score = 0;
  if (v.level) {
    if (reader.level && reader.level !== v.level) return { ok: false, score: 0 };
    if (reader.level) score++;
  }
  if (v.account) {
    if (reader.account && reader.account !== v.account) return { ok: false, score: 0 };
    if (reader.account) score++;
  }
  for (const k of ['teamSize', 'raidLevel'] as const) {
    const r = v[k];
    const x = reader[k];
    if (!r) continue;
    if (x != null && (x < r.min || x > r.max)) return { ok: false, score: 0 };
    if (x != null) score++;
  }
  return { ok: true, score };
}

export function resolvePieces(anvil: AnvilPieceRow[], overrides: OverrideRow[], filters: ResolveFilters = {}): ResolvedPiece[] {
  const byPiece = new Map<number, OverrideRow>();
  for (const o of overrides) if (o.pieceId != null) byPiece.set(o.pieceId, o);

  const all: ResolvedPiece[] = [];
  for (const p of anvil) {
    const draft = p.status !== 'published';
    if (draft && !filters.drafts) continue;
    const o = byPiece.get(p.id);
    const base = { pieceId: p.id, section: p.sectionKey, role: p.roleKey, variant: p.variant, kind: p.kind, anvilVersion: p.version, ...(draft ? { draft: true } : {}) };
    if (o?.hidden) {
      if (filters.editor) all.push({ ...base, key: `a${p.id}`, overrideId: o.id, source: 'clan', body: p.body, position: o.position ?? p.position, anvilChanged: (o.basedOnVersion ?? 0) < p.version, basedOnVersion: o.basedOnVersion, hidden: true });
      continue;
    }
    if (o && o.body != null) {
      all.push({ ...base, key: `a${p.id}`, overrideId: o.id, source: 'clan', body: o.body, position: o.position ?? p.position, anvilChanged: (o.basedOnVersion ?? 0) < p.version, basedOnVersion: o.basedOnVersion });
    } else {
      all.push({ ...base, key: `a${p.id}`, overrideId: null, source: 'anvil', body: p.body, position: p.position, anvilChanged: false, basedOnVersion: null });
    }
  }
  // Clan-added pieces. A hidden row whose Anvil piece is gone hides nothing; skip it.
  for (const o of overrides) {
    if (o.pieceId != null && anvil.some((p) => p.id === o.pieceId)) continue;
    if (o.hidden || o.body == null) continue;
    // An override of an Anvil piece that is a draft (or filtered out above) is not a clan-added piece.
    if (o.pieceId != null) continue;
    all.push({ key: `c${o.id}`, pieceId: null, overrideId: o.id, source: 'clan', section: o.sectionKey, role: o.roleKey, variant: o.variant, kind: o.kind, body: o.body, position: o.position ?? 0, anvilChanged: false, anvilVersion: null, basedOnVersion: null });
  }

  let out = all.filter((r) => (filters.section == null || r.section === filters.section) && (!filters.kinds || filters.kinds.includes(r.kind)));
  if (!filters.editor) {
    if (filters.role != null) out = out.filter((r) => r.role === BASE_ROLE || r.role === filters.role);
    const scored = out.map((r) => ({ r, m: variantMatch(r.variant, filters.reader) })).filter((x) => x.m.ok);
    // SINGLE_KINDS: per (section, kind), keep the most specific match only — when a role was asked
    // for. Without a role the reader sees each role's loadout side by side.
    const best = new Map<string, { r: ResolvedPiece; rank: number }>();
    const rank = (r: ResolvedPiece, score: number) => (r.role !== BASE_ROLE ? 100 : 0) + score;
    if (filters.role != null) {
      for (const { r, m } of scored) {
        if (!SINGLE_KINDS.has(r.kind)) continue;
        const k = `${r.section}\u0000${r.kind}`;
        const cur = best.get(k);
        const n = rank(r, m.score);
        if (!cur || n > cur.rank || (n === cur.rank && r.position < cur.r.position)) best.set(k, { r, rank: n });
      }
    }
    out = scored.filter(({ r }) => filters.role == null || !SINGLE_KINDS.has(r.kind) || best.get(`${r.section}\u0000${r.kind}`)?.r === r).map(({ r }) => r);
  }
  return out.sort((a, b) => a.position - b.position || (a.role === BASE_ROLE ? 0 : 1) - (b.role === BASE_ROLE ? 0 : 1) || a.key.localeCompare(b.key));
}
