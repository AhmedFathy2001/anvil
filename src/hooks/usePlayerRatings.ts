'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// Staff-side player ratings for the draft surfaces (balance-engine plan). One fetch of
// /api/admin/player-profiles per event, shared by everything on the Teams & Draft tab: the balance
// panel's strength bars AND the per-member badge that hangs off every pool card / roster row. The
// endpoint is admin-or-moderator gated, so this hook is only ever mounted on staff pages — public
// draft surfaces simply don't pass a ratings object down.

export type Tier = 'S' | 'A' | 'B' | 'C';

export interface RatedProfile {
  personKey: string;
  rsn: string;
  /** Every `players` row of this person in the event (multi-account people share one profile). */
  playerIds: number[];
  teamId: number | null;
  /** 0..~1, normalized within the rated pool. */
  rating: number;
  /** How much history backs the rating: 'wide' (0 prior events), 'medium' (1), 'tight' (2+). */
  band: 'wide' | 'medium' | 'tight';
  capability: number;
  capabilityMarkers: { key: string; label: string; domain: string; kc: number }[];
  domains: string[];
  activityKc: number | null;
  activityXp: number | null;
  evidence: number;
  evidenceEvents: number;
  reliability: number | null;
  subbedOutBefore: boolean;
}

export interface PlayerRatings {
  /** null while loading (or when disabled) — render "rating the pool…" rather than "no rating". */
  profiles: RatedProfile[] | null;
  tierByPersonKey: Map<string, Tier>;
  byPlayerId: Map<number, RatedProfile>;
  /** The person behind a `players` row, with their tier. Null when unrated (not in the pool yet). */
  ratingFor: (playerId: number) => { profile: RatedProfile; tier: Tier } | null;
  refetch: () => void;
}

const EMPTY: PlayerRatings = {
  profiles: null,
  tierByPersonKey: new Map(),
  byPlayerId: new Map(),
  ratingFor: () => null,
  refetch: () => {},
};

export const emptyRatings = EMPTY;

export function usePlayerRatings({
  eventId,
  /** Signature of the current roster/assignments — a change refetches (ratings are pool-relative). */
  signature,
  enabled = true,
}: {
  eventId: number;
  signature: string;
  enabled?: boolean;
}): PlayerRatings {
  const [fetched, setFetched] = useState<RatedProfile[] | null>(null);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  // Disabled pools read as "no ratings" without clearing state in an effect (cascading render).
  const profiles = enabled ? fetched : null;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/player-profiles?eventId=${eventId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setFetched(data.profiles as RatedProfile[]);
      } catch {
        /* leave the previous ratings on screen — this is advisory decoration, never a blocker */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, signature, enabled, nonce]);

  // Quartile tiers within the pool, mirroring lib/draftBalance — profiles arrive rating-sorted.
  const { byPlayerId, tierByPersonKey } = useMemo(() => {
    const byId = new Map<number, RatedProfile>();
    const tiers = new Map<string, Tier>();
    const n = profiles?.length ?? 0;
    profiles?.forEach((p, i) => {
      for (const id of p.playerIds) byId.set(id, p);
      const q = n <= 1 ? 0 : i / n;
      tiers.set(p.personKey, q < 0.25 ? 'S' : q < 0.5 ? 'A' : q < 0.75 ? 'B' : 'C');
    });
    return { byPlayerId: byId, tierByPersonKey: tiers };
  }, [profiles]);

  const ratingFor = useCallback(
    (playerId: number) => {
      const profile = byPlayerId.get(playerId);
      if (!profile) return null;
      return { profile, tier: tierByPersonKey.get(profile.personKey) ?? ('C' as Tier) };
    },
    [byPlayerId, tierByPersonKey],
  );

  return useMemo(
    () => ({ profiles, tierByPersonKey, byPlayerId, ratingFor, refetch }),
    [profiles, tierByPersonKey, byPlayerId, ratingFor, refetch],
  );
}
