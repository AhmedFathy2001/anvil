import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// The player-link dashboard is retired with player links (see /api/player/login); "My Team" is the
// one team surface.
export default async function PlayerDashboardRetired() {
  redirect(await clanHref('/team'));
}
