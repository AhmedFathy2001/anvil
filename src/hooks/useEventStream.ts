"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { clanFetch } from '@/lib/clanFetch';

interface Completion {
  id: number;
  teamId: number;
  tileId: number;
  eventId: number;
  completedAt: string;
  // Frozen per-member KC/XP split for completed stat tiles — passed through to computeMemberBreakdown
  // so a finished tile's contribution split stays put. Shape matches StatContributionSnapshot.
  statContributions?: { goal: number; total: number; split: { playerId: number; gained: number }[] } | null;
}

interface Submission {
  id: number;
  tileId: number;
  teamId: number;
  playerId: number | null;
  creditPlayerId: number | null;
  amount: number;
  creditPlayerName: string | null;
  createdAt: string;
}

interface Tile {
  id: number;
  eventId: number;
  position: number;
  label: string;
  description: string | null;
  tileType: string;
  requiredAmount: number | null;
  trackedStat: string | null;
  statType: string | null;
  statGoal: number | null;
  trackingMode: string;
}

export interface EventStreamData {
  completions: Completion[];
  submissions: Submission[];
  tiles: Tile[];
}

interface UseEventStreamOptions {
  onUpdate?: (data: EventStreamData) => void;
  enabled?: boolean;
  interval?: number; // Polling interval in ms (default 30s)
}

/** How often the board is checked for changes. Cheap: an unchanged board answers 304. */
const PULSE_INTERVAL_MS = 10_000;
/** The longest the admin view goes without a full pull, whatever the pulse says. */
const FULL_REFRESH_MS = 5 * 60_000;

export function useEventStream(
  eventId: number,
  options: UseEventStreamOptions = {}
) {
  const { onUpdate, enabled = true, interval = 30000 } = options;
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep callback ref updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Ask the cheap pulse first; pull the three full payloads only when it says the board moved.
  //
  // These are an event's EVERY completion, submission and tile — the heaviest reads an admin page
  // makes — and they were re-downloaded on every tick whether or not anything had happened. The
  // pulse (api/events/[id]/pulse) answers 304 with no body while the board is unchanged, and is
  // collapsed server-side to one computation per ~5s across every viewer. So this can check MORE
  // often than before for less work. A full pull still happens at least every FULL_REFRESH_MS, in
  // case something the pulse does not fingerprint changed.
  // Two fingerprints: the board (completions, submissions, tiles) and stat progress (KC/XP from
  // plugin pushes and hiscores reads), which moves without touching the board token.
  const etagsRef = useRef<Record<string, string | null>>({ board: null, stats: null });
  const lastFullRef = useRef(0);

  const pullFull = useCallback(async () => {
    try {
      const [completionsRes, submissionsRes, tilesRes] = await Promise.all([
        clanFetch(`/api/events/${eventId}/completions`),
        clanFetch(`/api/events/${eventId}/submissions`),
        clanFetch(`/api/events/${eventId}/tiles`),
      ]);

      if (completionsRes.ok && submissionsRes.ok && tilesRes.ok) {
        const [completions, submissions, tiles] = await Promise.all([
          completionsRes.json(),
          submissionsRes.json(),
          tilesRes.json(),
        ]);

        lastFullRef.current = Date.now();
        setConnected(true);
        setLastUpdate(new Date());
        onUpdateRef.current?.({ completions, submissions, tiles });
      }
    } catch {
      setConnected(false);
    }
  }, [eventId]);

  /** Did either fingerprint move since last time? Updates the stored ETags as a side effect. */
  const pulseMoved = useCallback(async (): Promise<boolean> => {
    const parts: [string, string][] = [
      ['board', `/api/events/${eventId}/pulse`],
      ['stats', `/api/events/${eventId}/pulse?part=stats`],
    ];
    const results = await Promise.all(
      parts.map(async ([key, url]) => {
        const prev = etagsRef.current[key];
        const res = await clanFetch(url, { headers: prev ? { 'If-None-Match': prev } : undefined, cache: 'no-store' });
        if (res.status === 304) return false;
        if (!res.ok) return true; // can't tell — pull
        etagsRef.current[key] = res.headers.get('ETag');
        return prev !== null; // the first answer only seeds the token
      }),
    );
    return results.some(Boolean);
  }, [eventId]);

  const fetchData = useCallback(async (force = false) => {
    const due = Date.now() - lastFullRef.current >= FULL_REFRESH_MS;
    let moved = true;
    try {
      moved = await pulseMoved();
    } catch {
      // The pulse is an optimisation; if it fails, pull.
    }
    if (force || due || moved) await pullFull();
    else setConnected(true);
  }, [pulseMoved, pullFull]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchData(true);

    // Set up interval polling — against the pulse, so a tick on a quiet board costs a 304.
    intervalRef.current = setInterval(() => fetchData(), Math.min(interval, PULSE_INTERVAL_MS));

    // Visibility change handler - fetch when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };

    // Online handler - fetch when coming back online
    const handleOnline = () => {
      fetchData(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, fetchData, interval]);

  return {
    connected,
    lastUpdate,
    // After the page's own write: always a full pull, whatever the fingerprints say.
    refetch: () => fetchData(true),
  };
}
