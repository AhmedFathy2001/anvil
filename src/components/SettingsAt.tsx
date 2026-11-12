'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * `?at=<section>` (an old Settings address redirected here, app/settings/_legacy): becomes the
 * page's #fragment, unless the old link already carried one of its own, which wins. The address bar
 * ends up as the plain page plus the fragment. Mounted after HashReveal, which scrolls and rings it.
 */
export default function SettingsAt() {
  const pathname = usePathname();
  useEffect(() => {
    const url = new URL(window.location.href);
    const at = url.searchParams.get('at');
    if (!at || !/^[a-z0-9-]{1,64}$/.test(at)) return;
    url.searchParams.delete('at');
    if (!url.hash) url.hash = at;
    history.replaceState(history.state, '', url.toString());
  }, [pathname]);
  return null;
}
