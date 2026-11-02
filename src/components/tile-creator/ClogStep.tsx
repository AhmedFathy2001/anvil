'use client';

import { useContext, useState } from 'react';
import { AuthoringApiContext } from '@/components/AuthoringApi';
import ClogTileFields from '@/components/ClogTileFields';
import { clogTileCandidate, type TaskCandidate } from '@/lib/taskMatch';
import { PrimaryButton, StepHeader } from './parts';

/**
 * Collection log: new slots (any page, chosen pages or hand-picked items) or finishing pages. The
 * same fields as the full editor — pages expand into an item checklist, all on, untick to exclude.
 */
export default function ClogStep({
  seed,
  amount: initialAmount,
  onBack,
  onNext,
}: {
  seed?: { mode: 'slots' | 'complete'; pages: string[]; itemIds: number[] };
  amount: number | null;
  onBack: () => void;
  onNext: (candidate: TaskCandidate) => void;
}) {
  const lookupApi = useContext(AuthoringApiContext);
  const [mode, setMode] = useState<'slots' | 'complete'>(seed?.mode ?? 'slots');
  const [pages, setPages] = useState<string[]>(seed?.pages ?? []);
  const [itemIds, setItemIds] = useState<number[]>(seed?.itemIds ?? []);
  const [amount, setAmount] = useState<string>(initialAmount != null ? String(initialAmount) : '');
  const n = parseInt(amount, 10);
  const ready = mode === 'slots' ? Number.isInteger(n) && n >= 1 && (pages.length === 0 || itemIds.length > 0) : itemIds.length > 0;

  return (
    <div>
      <StepHeader title="Collection log" onBack={onBack} />
      <ClogTileFields
        lookupApi={lookupApi}
        mode={mode}
        onMode={setMode}
        pages={pages}
        onPages={setPages}
        itemIds={itemIds}
        onItemIds={setItemIds}
        amount={amount}
        onAmount={setAmount}
      />
      <PrimaryButton
        className="mt-4 w-full"
        disabled={!ready}
        onClick={() => {
          const c = clogTileCandidate({ mode, pages, itemIds }, mode === 'slots' ? n : null);
          // "N of the pages" on a whole-page tile rides the requirement the editor would send.
          if (mode === 'complete' && Number.isInteger(n) && n >= 1) c.config = { ...c.config, requiredAmount: n };
          onNext(c);
        }}
      >
        Next
      </PrimaryButton>
    </div>
  );
}
