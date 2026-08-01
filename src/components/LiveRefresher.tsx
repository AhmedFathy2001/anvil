'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';

/**
 * Drop-in semi-realtime refresher for a server-rendered page. Renders nothing; polls a cheap `url`
 * pulse (ETag → 304 when unchanged) on tab-focus and, while focused, a slow tick — and only calls
 * `router.refresh()` when the pulse actually moves. Use on pages whose data is entirely server props
 * (e.g. the weekly leaderboard); pages with their own client state should call useLiveRefresh directly
 * so they can refetch that state too.
 */
export default function LiveRefresher({
  url,
  intervalMs,
}: {
  url: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const onChange = useCallback(() => router.refresh(), [router]);
  useLiveRefresh({ url, onChange, intervalMs });
  return null;
}
