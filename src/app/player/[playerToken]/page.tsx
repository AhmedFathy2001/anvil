import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Player links are retired (see /api/player/login). An old link lands on "My Team", where a Discord
// sign-in finds the same team.
export default async function PlayerLinkRetired() {
  redirect(await clanHref('/team'));
}
