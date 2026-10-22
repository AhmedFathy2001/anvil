import { redirect } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { getTierBands } from '@/lib/pluginConfig';
import { listAnvilTasks, taskOffers } from '@/lib/libraryTasks';
import LibraryTabs from './LibraryTabs';
import { clanHref } from '@/lib/clanPath';

export const dynamic = 'force-dynamic';

// The clan's reusable task catalogue. Same authority as tile authoring — an editor curating the
// library is doing the same job as an editor building a board, one step earlier.
export default async function TileLibraryPage() {
  const clan = await requireClan();
  const editor = await verifyTileEditorAnywhere();
  if (!editor) redirect(await clanHref('/admin/dashboard'));

  const tierBands = await getTierBands(clan.id);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-6 bg-gold rounded-full" />
        <h1 className="text-2xl font-bold">Task library</h1>
      </div>
      <p className="text-sm text-text-muted mb-6">
        Tasks you keep so you can reuse them on any board instead of writing them again. You don&rsquo;t need it
        to build a board. Anvil&rsquo;s library is a ready-made set Anvil keeps up to date; add the ones you want, or
        save tiles from a board&rsquo;s Tiles tab. Tasks are grouped by your clan&rsquo;s difficulty tiers.
      </p>
      <LibraryTabs tierBands={tierBands} seedTotal={(await listAnvilTasks()).length} offers={(await taskOffers(clan.id)).length} />
    </div>
  );
}
