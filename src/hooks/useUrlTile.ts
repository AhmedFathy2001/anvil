'use client';

import { useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseTileParam, tileUrlStep } from '@/lib/urlTile';

/**
 * The open tile, read from and written to `?tile=ID`. The address is the single source of truth:
 * a click pushes one history entry, Back closes, a deep link opens, and closing a deep-linked
 * tile just clears the parameter.
 *
 * The history calls pass `null` as the state ON PURPOSE. Next patches pushState/replaceState and
 * only tells `useSearchParams` about the new address when the state is NOT its own (`__NA`).
 * Passing `window.history.state` back in looks tidy but makes Next skip the update, so the
 * address changes and nothing re-renders (the dialog never opened, and never closed). Next
 * copies its own state onto the entry itself.
 */
export function useUrlTile(isKnownTile: (id: number) => boolean): [number | null, (id: number | null) => void] {
  const searchParams = useSearchParams();
  const fromUrl = parseTileParam(searchParams.get('tile'));
  const selected = fromUrl != null && isKnownTile(fromUrl) ? fromUrl : null;
  // Did WE push the history entry for the open tile? Then closing steps back over it.
  const pushed = useRef(false);
  const setSelected = useCallback((id: number | null) => {
    const step = tileUrlStep(window.location.href, id, pushed.current);
    if (step.kind === 'back') {
      pushed.current = false;
      window.history.back();
    } else if (step.kind === 'push') {
      pushed.current = true;
      window.history.pushState(null, '', step.url);
    } else {
      window.history.replaceState(null, '', step.url);
    }
  }, []);
  return [selected, setSelected];
}
