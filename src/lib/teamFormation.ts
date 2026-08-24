/**
 * How teams form when more than one clan plays one board.
 *
 * PURE — no database import, the same split as eventVisibility/eventAccess and clanVisibility/
 * clanAccess. A client component drawing the choice needs the vocabulary and must not drag a
 * connection pool in with it.
 */
export const TEAM_FORMATIONS = ['draft', 'per_clan'] as const;
export type TeamFormation = (typeof TEAM_FORMATIONS)[number];

export function isTeamFormation(v: unknown): v is TeamFormation {
  return v === 'draft' || v === 'per_clan';
}

/**
 * Anything unrecognised reads as `draft`.
 *
 * The OPEN answer, deliberately, which is the opposite of how the visibility vocabularies fall back
 * — and for the opposite reason. There, a typo that exposes a clan is the dangerous outcome, so the
 * fallback closes. Here the dangerous outcome is a board that cannot be played at all: `per_clan`
 * puts people on a team only when their clan was invited, so a typo would leave everyone else with
 * nowhere to sit. Falling back to the shape that has always worked is the safe direction.
 */
export function teamFormationOf(v: string | null | undefined): TeamFormation {
  return v === 'per_clan' ? 'per_clan' : 'draft';
}

export const FORMATION_META: Record<
  TeamFormation,
  { label: string; blurb: string; how: string }
> = {
  draft: {
    label: 'Draft across everyone',
    blurb: 'One pool of every player from every clan. Captains pick.',
    how: 'Sign-ups gather, you set captains, and the draft runs as it always has — a player’s clan decides nothing about which team they land on.',
  },
  per_clan: {
    label: 'One team per clan',
    blurb: 'Each invited clan is a team. No draft.',
    how: 'A player joins the team belonging to the clan they came from, the moment they enter. Nobody picks, and nobody drafts from a rival’s roster.',
  },
};
