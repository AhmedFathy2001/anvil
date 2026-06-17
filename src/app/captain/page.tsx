import { redirect } from 'next/navigation';

// Captain login is retired — captains now reach their team through the unified, Discord-
// authenticated "My Team" hub. The cookie-based /captain/[teamId] board stays for back-compat.
export default function CaptainLoginRedirect() {
  redirect('/team');
}
