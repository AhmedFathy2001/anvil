import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Player token login is retired for humans — everyone signs in with Discord and reaches
// their team via the unified "My Team" hub. The RuneLite plugin still uses per-player token
// links at /player/[playerToken], and /player/dashboard stays for any legacy token session.
export default async function PlayerLoginRedirect() {
  redirect(await clanHref('/team'));
}
