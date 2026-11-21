'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import type { PrizeCurrency } from '@/lib/competitionGame';
import { worldModeDef } from '@/lib/worldModes';

const HCW_ICON = worldModeDef('hardcore')?.icon ?? null;

/**
 * Main game / Hardcore Worlds: which of the clan's two pots the page shows.
 *
 * Only rendered when the clan keeps a Hardcore Worlds coffer. The choice lives in the URL (?pot=hcw)
 * so a reload, a shared link or the router.refresh() after every write lands on the same pot.
 */
export default function CofferPotTabs({ pot }: { pot: PrizeCurrency }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(next: PrizeCurrency) {
    if (next === pot) return;
    // The browser's own path: it already carries any clan prefix, so only the query changes.
    const path = window.location.pathname;
    startTransition(() => router.replace(next === 'hcw' ? `${path}?pot=hcw` : path, { scroll: false }));
  }

  return (
    <div
      role="tablist"
      aria-label="Which coffer"
      className={`inline-flex gap-1 rounded-xl border border-card-border p-1 ${pending ? 'opacity-70' : ''}`}
    >
      {(['gp', 'hcw'] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={pot === p}
          onClick={() => pick(p)}
          className={`min-h-9 rounded-lg px-3 text-sm inline-flex items-center gap-2 transition-colors ${
            pot === p ? 'bg-gold/15 text-foreground' : 'text-text-muted hover:text-foreground'
          }`}
        >
          {p === 'hcw' && HCW_ICON && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={HCW_ICON} alt="" className="w-4 h-4 object-contain" loading="lazy" />
          )}
          {p === 'hcw' ? 'Hardcore Worlds' : 'Main game'}
        </button>
      ))}
    </div>
  );
}
