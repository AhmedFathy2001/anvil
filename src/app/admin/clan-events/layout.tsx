import { creatorAway } from '@/lib/creatorGuard';

export const dynamic = 'force-dynamic';

// Clan events are in-game (a mass, a hangout, shown in the plugin's Clan tab), so a creator space is
// sent to its dashboard (lib/creatorSpaces CREATOR_HIDDEN_ADMIN_PATHS).
export default async function ClanEventsLayout({ children }: { children: React.ReactNode }) {
  await creatorAway('/admin/clan-events');
  return <>{children}</>;
}
