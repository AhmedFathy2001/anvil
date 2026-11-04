'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Old links into the profile's settings drawers (`/profile#plugin-token`, `#link-account`, …) are
 * all over the guides in fifteen languages, in Discord messages and in people's bookmarks. Those
 * drawers are now /settings pages, so a fragment that names one is forwarded there. A fragment is
 * never sent to the server, which is why this has to happen in the browser.
 */
const MOVED: Record<string, string> = {
  '#plugin-token': '/settings/plugin',
  '#link-account': '/settings/add',
  '#detected-accounts': '/settings/add',
  '#account-security': '/settings/account',
  '#announcements': '/settings/announcements',
  '#profile-look': '/settings/look',
  '#display-case': '/settings/look',
};

export default function LegacyAnchors() {
  const router = useRouter();
  useEffect(() => {
    const go = () => {
      const to = MOVED[window.location.hash];
      if (to) router.replace(to);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [router]);
  return null;
}
