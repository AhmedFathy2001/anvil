'use client';

import { useState } from 'react';

import { InventoryGrid, PaperDoll, RunePouchBox, StonePanel, type Names } from '@/components/guides/osrs';
import type { InvItem } from '@/lib/guideTiers';
import { bankTagString, type EquipSlot } from '@/lib/runeliteExport';

export default function SharedSetupView({
  name,
  trip,
  gear,
  inventory,
  runePouch,
  spellbook,
  names,
}: {
  name: string;
  trip: string;
  gear: Record<string, number>;
  inventory: (InvItem | null)[];
  runePouch: InvItem[];
  spellbook: number | null;
  names: Names;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const tag = bankTagString({ name, gear: gear as Partial<Record<EquipSlot, number>>, inventory, runePouch, ...(spellbook != null ? { spellbook } : {}) });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopied('Copied. In the game, right-click a bank tag tab and import it.');
    } catch {
      setCopied(tag);
    }
  };
  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-text-muted">A shared {trip} setup</p>
        <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <span className="h-7 w-1 rounded-full bg-gold" />
          {name}
        </h1>
      </div>
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-card-border bg-card-bg p-4">
        <StonePanel className="inline-flex p-2.5">
          <PaperDoll gear={gear} hasQuiver={false} twoHanded={false} names={names} size={38} />
        </StonePanel>
        <div className="flex flex-col gap-2">
          <InventoryGrid inventory={inventory} names={names} size={32} />
          {runePouch.length > 0 && <RunePouchBox runes={runePouch} divine={runePouch.length > 3} names={names} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={copy} className="inline-flex min-h-10 items-center rounded-lg bg-gold px-4 text-sm font-semibold text-brown-dark hover:bg-gold-light">
          Copy bank tag
        </button>
        {copied && <span className="break-all text-xs text-text-muted">{copied}</span>}
      </div>
    </div>
  );
}
