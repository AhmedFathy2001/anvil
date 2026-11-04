import { redirect } from 'next/navigation';

import { verifyUser } from '@/lib/auth';

/**
 * The signed-in person for a Settings page, or off to sign in. The layout redirects too, but a page
 * renders alongside its layout, not after it: a page that assumed a session (`verifyUser()!`) threw
 * "Cannot read properties of null (reading 'playerId')" for a signed-out visitor instead.
 */
export async function settingsSession() {
  const session = await verifyUser();
  if (!session) redirect('/login?return=%2Fsettings');
  return session;
}
