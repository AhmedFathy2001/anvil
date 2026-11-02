// The per-event "All proofs" feed (Admin → event → Proofs): reading its filters from a URL.
//
// Pure, so the parsing is tested without a database. The route (api/admin/events/[eventId]/proofs)
// turns the result into a query; the client builds the same params from its filter controls.

export const PROOF_FEED_PAGE_SIZE = 30;

export type ProofFlagFilter = 'all' | 'flagged' | 'unflagged';

export interface ProofFeedQuery {
  teamId: number | null;
  tileId: number | null;
  /** Matches the credited player OR the uploader — "proofs by Zezima" means either. */
  playerId: number | null;
  flag: ProofFlagFilter;
  /** 1-based. */
  page: number;
}

function positiveInt(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseProofFeedQuery(params: URLSearchParams): ProofFeedQuery {
  const flag = params.get('flag');
  return {
    teamId: positiveInt(params.get('team')),
    tileId: positiveInt(params.get('tile')),
    playerId: positiveInt(params.get('player')),
    flag: flag === 'flagged' || flag === 'unflagged' ? flag : 'all',
    page: positiveInt(params.get('page')) ?? 1,
  };
}

/** The inverse, for the client: only the params that differ from the defaults. */
export function proofFeedSearch(q: Partial<ProofFeedQuery>): string {
  const p = new URLSearchParams();
  if (q.teamId) p.set('team', String(q.teamId));
  if (q.tileId) p.set('tile', String(q.tileId));
  if (q.playerId) p.set('player', String(q.playerId));
  if (q.flag && q.flag !== 'all') p.set('flag', q.flag);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  return p.toString();
}

export function pageCount(total: number, pageSize = PROOF_FEED_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
