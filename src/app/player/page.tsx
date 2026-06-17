import { redirect } from 'next/navigation';

// Player token login is retired for humans — everyone signs in with Discord and reaches
// their team via the unified "My Team" hub. The RuneLite plugin still uses per-player token
// links at /player/[playerToken], and /player/dashboard stays for any legacy token session.
export default function PlayerLoginRedirect() {
  redirect('/team');
}
