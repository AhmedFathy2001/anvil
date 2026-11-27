import { notFound } from 'next/navigation';

import { getItemMapping } from '@/lib/osrsItems';
import { contentFromKey } from '@/lib/tripContent';
import { sharedSetup } from '@/lib/tripSetups';
import SharedSetupView from './SharedSetupView';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Shared setup', robots: { index: false } };

/**
 * A trip setup someone shared by link (lib/tripSetups sharedSetup): the setup only, its gear,
 * inventory and rune pouch, with its bank tag to copy. Never whose it is, nor anything of their bank.
 */
export default async function SharedSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await sharedSetup(token);
  if (!shared) notFound();
  const mapping = await getItemMapping().catch(() => []);
  const byId = new Map(mapping.map((m) => [m.id, m.gameName ?? m.name]));
  const s = shared.setup;
  const inventory = (s.inventory ?? []).slice(0, 28);
  const names: Record<number, string> = {};
  for (const id of [...Object.values(s.gear), ...inventory.map((x) => x?.id), ...(s.runePouch ?? []).map((x) => x.id)]) {
    if (typeof id === 'number' && byId.has(id)) names[id] = byId.get(id)!;
  }
  const c = contentFromKey(shared.content);
  return (
    <div className="max-w-3xl mx-auto">
      <SharedSetupView name={shared.name || s.name} trip={c?.name ?? shared.content} gear={s.gear} inventory={inventory} runePouch={s.runePouch ?? []} spellbook={s.spellbook ?? null} names={names} />
    </div>
  );
}
