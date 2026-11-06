'use client';

import { useState } from 'react';

import SupporterStylePicker from '@/components/SupporterStylePicker';
import type { SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';

export default function SupporterCharacterStyles({ tier, characters }: {
  tier: SupporterTierId;
  characters: { accountId: number; rsn: string; style: SupporterStyle | null }[];
}) {
  const sameInitially = characters.every((c) => JSON.stringify(c.style ?? {}) === JSON.stringify(characters[0]?.style ?? {}));
  const [mode, setMode] = useState<'all' | 'each'>(sameInitially ? 'all' : 'each');
  const first = characters[0];
  return (
    <div className="mt-4">
      <div className="inline-flex rounded-lg border border-card-border bg-background/40 p-1 text-[12.5px]">
        <button type="button" onClick={() => setMode('all')} className={`rounded-md px-3 py-1.5 ${mode === 'all' ? 'bg-gold/15 text-gold' : 'text-text-muted'}`}>Same for all</button>
        <button type="button" onClick={() => setMode('each')} className={`rounded-md px-3 py-1.5 ${mode === 'each' ? 'bg-gold/15 text-gold' : 'text-text-muted'}`}>Customize each</button>
      </div>
      {mode === 'all' && first ? (
        <SupporterStylePicker tier={tier} name="All your characters" accountId={first.accountId} initial={first.style} applyAll />
      ) : (
        <div className="space-y-3">
          {characters.map((c) => <SupporterStylePicker key={c.accountId} tier={tier} name={c.rsn} accountId={c.accountId} initial={c.style} />)}
        </div>
      )}
    </div>
  );
}
