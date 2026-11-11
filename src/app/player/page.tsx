import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Player-link login is retired (see /api/player/login): everyone signs in with Discord and reaches
// their team via the unified "My Team" hub.
export default async function PlayerLoginRedirect() {
  redirect(await clanHref('/team'));
}
