/**
 * What a clan's `visibility` column may say.
 *
 * PURE — no database import, deliberately, exactly as `lib/eventVisibility` is to `lib/eventAccess`.
 * Two callers need it that must not drag a connection pool in: a client component drawing the
 * toggle, and a test importing the vocabulary at module top level before the harness has pointed
 * DATABASE_URL at its own database. The db-backed question lives in `lib/clanAccess`.
 */
export type ClanVisibility = 'public' | 'members';

/**
 * `public` only when it says so. Anything unrecognised reads as the CLOSED answer, which is the same
 * rule the event vocabulary uses: a typo in a settings row should hide a clan, never expose one.
 */
export function clanVisibilityOf(value: string | null | undefined): ClanVisibility {
  return value === 'public' ? 'public' : 'members';
}

export function isClanVisibility(value: unknown): value is ClanVisibility {
  return value === 'public' || value === 'members';
}
