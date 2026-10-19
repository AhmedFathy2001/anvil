'use client';

import { useState } from 'react';
import TileLibraryClient from './TileLibraryClient';
import AnvilLibraryBrowser from './AnvilLibraryBrowser';
import type { TierBand } from '@/lib/tileFilter';

/** "Your library" and "Anvil's library", side by side. Importing remounts yours so it shows the new rows. */
export default function LibraryTabs({ tierBands, seedTotal, offers }: { tierBands: TierBand[]; seedTotal: number; offers: number }) {
  const [tab, setTab] = useState<'mine' | 'anvil'>('mine');
  const [mineKey, setMineKey] = useState(0);
  const tabCls = (on: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg border transition-colors ${on ? 'border-gold/50 bg-gold/10 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`;
  return (
    <div>
      <div className="flex gap-2 mb-5" role="tablist">
        <button role="tab" aria-selected={tab === 'mine'} className={tabCls(tab === 'mine')} onClick={() => setTab('mine')}>
          Your library
        </button>
        <button role="tab" aria-selected={tab === 'anvil'} className={tabCls(tab === 'anvil')} onClick={() => setTab('anvil')}>
          Anvil&apos;s library
          {offers > 0 && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">{offers} updated</span>}
        </button>
      </div>
      {tab === 'mine' ? (
        <TileLibraryClient key={mineKey} tierBands={tierBands} seedTotal={seedTotal} />
      ) : (
        <AnvilLibraryBrowser tierBands={tierBands} onImported={() => setMineKey((k) => k + 1)} />
      )}
    </div>
  );
}
