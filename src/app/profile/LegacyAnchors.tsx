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
  '#plugin-token': '/settings/in-game#plugin-token',
  '#link-account': '/settings/characters#link-account',
  '#detected-accounts': '/settings/characters#detected',
  '#account-security': '/settings/account#login',
  '#announcements': '/settings/posts#discord-posts',
  '#profile-look': '/settings/profile#avatar-banner',
  '#display-case': '/settings/profile#display-case',
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
