'use client';

import type { PlayerRatings, RatedProfile, Tier } from '@/hooks/usePlayerRatings';

// The per-member rating chip on the draft surfaces: tier letter + a 0-100 score, with the whole
// "why" in the hover title (capability markers, past-event evidence, attendance, flags). Staff-only
// by construction — it renders nothing unless a `ratings` object is handed down, and only the admin
// Teams & Draft tab does that.
//
// Scores are pool-relative and advisory: they rank THIS event's pool against each other, they are
// not a permanent player score, and nothing in the draft is blocked by them.

const TIER_CLASS: Record<Tier, string> = {
  S: 'border-gold/50 text-gold bg-gold/10',
  A: 'border-gold/25 text-foreground/90 bg-gold/5',
  B: 'border-card-border text-text-muted',
  C: 'border-card-border text-text-muted',
};

const TIER_LABEL: Record<Tier, string> = {
  S: 'top 25% of this pool',
  A: 'upper-middle 25%',
  B: 'lower-middle 25%',
  C: 'bottom 25%',
};

/** 0..~1 rating → the 0-100 number people actually read. */
export const ratingScore = (profile: RatedProfile): number => Math.round(profile.rating * 100);

/** Thin/no history marker — the rating is a guess when nobody has played with them before. */
const bandGlyph = (profile: RatedProfile): string =>
  profile.band === 'tight' ? '' : profile.band === 'medium' ? '?' : '??';

export function ratingTooltip(profile: RatedProfile, tier: Tier): string {
  const lines = [
    `${profile.rsn} — rating ${ratingScore(profile)}/100 · tier ${tier} (${TIER_LABEL[tier]})`,
    profile.capabilityMarkers.length > 0
      ? `Capability: ${profile.capabilityMarkers
          .slice(0, 4)
          .map((m) => `${m.label} ${m.kc.toLocaleString()}kc`)
          .join(', ')}`
      : 'Capability: no marker bosses on the hiscores snapshot',
    profile.evidenceEvents > 0
      ? `Past events: ${profile.evidenceEvents} (recent avg ${Math.round(profile.evidence)} pts)`
      : 'Past events: none — rating is from stats alone',
    profile.reliability != null ? `Attendance history: ${Math.round(profile.reliability * 100)}%` : null,
    profile.subbedOutBefore ? 'Flag: subbed out of a past event' : null,
    profile.band !== 'tight'
      ? `Confidence: ${profile.band === 'medium' ? 'thin — one past event' : 'wide — no past events'}`
      : null,
    'Pool-relative and advisory — it never blocks a pick.',
  ];
  return lines.filter(Boolean).join('\n');
}

interface Props {
  ratings: PlayerRatings | null | undefined;
  playerId: number;
  /** 'chip' for cards/rows; 'inline' for tight lists (no background). */
  variant?: 'chip' | 'inline';
  className?: string;
}

export default function PlayerRatingBadge({ ratings, playerId, variant = 'chip', className = '' }: Props) {
  const entry = ratings?.ratingFor(playerId);
  if (!entry) return null;
  const { profile, tier } = entry;
  const glyph = bandGlyph(profile);
  return (
    <span
      title={ratingTooltip(profile, tier)}
      className={`shrink-0 font-mono tabular-nums cursor-help ${
        variant === 'chip'
          ? `text-[10px] px-1.5 py-0.5 rounded border ${TIER_CLASS[tier]}`
          : `text-[10px] ${tier === 'S' ? 'text-gold' : tier === 'A' ? 'text-foreground/70' : 'text-text-muted'}`
      } ${profile.subbedOutBefore || (profile.reliability != null && profile.reliability < 0.4) ? 'opacity-70' : ''} ${className}`}
    >
      {tier} {ratingScore(profile)}
      {glyph && <span className="opacity-60">{glyph}</span>}
    </span>
  );
}
