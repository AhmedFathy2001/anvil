import AnnounceClient from './AnnounceClient';
import { requireClan } from '@/lib/clanContext';
import { requireFeature } from '@/lib/clanFeatures';

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncePage() {
  const clan = await requireClan();
  await requireFeature(clan.id, 'announce', '/admin/dashboard');
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="display display-lg text-4xl sm:text-[44px] font-semibold leading-tight">Post to Discord</h1>
        <p className="text-text-muted mt-2 text-[15px]">
          Post a message to any Discord channel as the bot. Long messages like rules are split
          automatically, and you can send it as an embed and optionally ping a role.
        </p>
      </header>
      <AnnounceClient />
    </div>
  );
}
