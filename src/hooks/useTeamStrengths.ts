'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

// Staff-side TEAM strengths for the draft surfaces (balance-engine plan). One fetch of
// /api/admin/player-profiles per event. The ratings behind them stay on the server: no per-person
// rating or tier is ever sent to the browser (member privacy, even from their own clan admins), so
// the balance panel gets one strength per team and a pool headcount — nothing about any one player.

export interface TeamStrengths {
  /** Per-team projected strength (lib/draftMath strengthOf). */
  byTeam: Map<number, number>;
  /** People not on a team yet. */
  poolCount: number;
  /** True when nobody has history or marker bosses to rate by — the numbers would mean nothing. */
  nothingToRate: boolean;
  /** "Team B has nobody for CoX: CM" lines — the board's hard content a team can't cover. */
  coverage: string[];
}

export interface TeamStrengthsState {
  /** null while loading (or when disabled). */
  data: TeamStrengths | null;
  refetch: () => void;
}

export function useTeamStrengths({
  eventId,
  /** Signature of the current roster/assignments — a change refetches (ratings are pool-relative). */
  signature,
  enabled = true,
}: {
  eventId: number;
  signature: string;
  enabled?: boolean;
}): TeamStrengthsState {
  const [fetched, setFetched] = useState<TeamStrengths | null>(null);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const data = enabled ? fetched : null;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await clanFetch(`/api/admin/player-profiles?eventId=${eventId}`);
        if (!res.ok) return;
        const body = (await res.json()) as {
          teams: { teamId: number; strength: number }[];
          poolCount: number;
          nothingToRate: boolean;
          coverage?: string[];
        };
        if (!cancelled) {
          setFetched({
            byTeam: new Map(body.teams.map((t) => [t.teamId, t.strength])),
            poolCount: body.poolCount,
            nothingToRate: body.nothingToRate,
            coverage: body.coverage ?? [],
          });
        }
      } catch {
        /* leave the previous numbers on screen — this is advisory decoration, never a blocker */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, signature, enabled, nonce]);

  return useMemo(() => ({ data, refetch }), [data, refetch]);
}
