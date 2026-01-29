"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface Completion {
  id: number;
  teamId: number;
  tileId: number;
  eventId: number;
  completedAt: string;
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
  womCompetitionId: number | null;
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

  const fetchData = useCallback(async () => {
    try {
      const [completionsRes, submissionsRes, tilesRes] = await Promise.all([
        fetch(`/api/events/${eventId}/completions`),
        fetch(`/api/events/${eventId}/submissions`),
        fetch(`/api/events/${eventId}/tiles`),
      ]);

      if (completionsRes.ok && submissionsRes.ok && tilesRes.ok) {
        const [completions, submissions, tiles] = await Promise.all([
          completionsRes.json(),
          submissionsRes.json(),
          tilesRes.json(),
        ]);

        setConnected(true);
        setLastUpdate(new Date());
        onUpdateRef.current?.({ completions, submissions, tiles });
      }
    } catch {
      setConnected(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchData();

    // Set up interval polling
    intervalRef.current = setInterval(fetchData, interval);

    // Visibility change handler - fetch when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };

    // Online handler - fetch when coming back online
    const handleOnline = () => {
      fetchData();
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
    refetch: fetchData,
  };
}
