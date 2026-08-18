import { redirect } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { getTierBands } from '@/lib/pluginConfig';
import { SEED_TASKS } from '@/lib/tileLibrary';
import TileLibraryClient from './TileLibraryClient';

export const dynamic = 'force-dynamic';

// The clan's reusable task catalogue. Same authority as tile authoring — an editor curating the
// library is doing the same job as an editor building a board, one step earlier.
export default async function TileLibraryPage() {
  const clan = await requireClan();
  const editor = await verifyTileEditorAnywhere();
  if (!editor) redirect('/admin/dashboard');

  const tierBands = await getTierBands(clan.id);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-6 bg-gold rounded-full" />
        <h1 className="text-2xl font-bold">Task library</h1>
      </div>
      <p className="text-sm text-text-muted mb-6">
        The pool your boards draw from. Add tiles from any board&rsquo;s Tiles tab, import a seed pack
        shared by another clan, and prune what doesn&rsquo;t suit you — a generated board is only as
        good as this list. Tiers come from your own difficulty bands, so retuning them re-sorts
        everything here.
      </p>
      <TileLibraryClient tierBands={tierBands} seedTotal={SEED_TASKS.length} />
    </div>
  );
}
