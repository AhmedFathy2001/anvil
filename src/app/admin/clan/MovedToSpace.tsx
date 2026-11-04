'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useClanPrefixValue } from '@/components/ClanLink';

/**
 * A creator space's settings live at /admin/space. Old links (and the settings search) still say
 * /admin/clan#…, and a server redirect would drop the #anchor, so this hops over in the browser,
 * anchor and all.
 */
export default function MovedToSpace() {
  const router = useRouter();
  const prefix = useClanPrefixValue();
  useEffect(() => {
    router.replace(`${prefix}/admin/space${window.location.search}${window.location.hash}`);
  }, [router, prefix]);
  return <p className="text-sm text-text-muted">Opening your space settings…</p>;
}
