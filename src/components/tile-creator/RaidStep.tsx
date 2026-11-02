'use client';

import { useState } from 'react';
import {
  RAID_OPTIONS,
  defaultRaidSelection,
  howItCountsLine,
  raidModeKey,
  raidTileConfig,
  raidTitle,
  type RaidSelection,
} from '@/lib/tileCreatorConfig';
import type { TaskCandidate } from '@/lib/taskMatch';
import { AmountField, ChoiceButton, CountsBanner, Eyebrow, PrimaryButton, StepHeader, CheckIcon } from './parts';

/**
 * Raids: modes as toggles instead of a free-text monster field. Builds the multi-key kill tile the
 * full editor would (lib/tileCreatorConfig raidTileConfig → lib/killSource), and says plainly which
 * engine counts it — Entry is the one mode the hiscores don't carry.
 */
export default function RaidStep({
  seed,
  amount: initialAmount,
  onBack,
  onNext,
}: {
  seed?: RaidSelection;
  amount: number | null;
  onBack: () => void;
  onNext: (candidate: TaskCandidate) => void;
}) {
  const [sel, setSel] = useState<RaidSelection>(seed ?? defaultRaidSelection(['cox', 'tob']));
  const [amount, setAmount] = useState<number | null>(initialAmount ?? 5);
  const n = amount && amount > 0 ? amount : 1;
  const res = raidTileConfig(sel, n);
  const how = res.ok ? howItCountsLine(res.config) : null;

  function next() {
    if (!res.ok || !how) return;
    onNext({
      key: `raid-${Object.keys(sel).filter((k) => sel[k]).sort().join('+')}`,
      source: 'raid',
      badge: 'Raids',
      title: res.title,
      titleTemplate: raidTitle(sel, 2).replace(/^2 /, '{n} '),
      titleOne: raidTitle(sel, 1),
      hint: how.text,
      engine: how.engine,
      verb: 'Clear',
      noun: 'raids',
      amountField: res.source === 'hiscores' ? 'statGoal' : 'requiredAmount',
      amount: n,
      config: res.config,
      flow: 'raids',
      seed: { raids: sel },
      category: 'bosses',
      score: 0,
      confident: true,
    });
  }

  return (
    <div>
      <StepHeader title="Raids" onBack={onBack} />
      <Eyebrow>Players must</Eyebrow>
      <div className="flex flex-wrap items-center gap-2 text-base mb-5">
        <span>Clear</span>
        <AmountField value={amount} onChange={setAmount} label="Clears needed" />
        <span>raids, any of:</span>
      </div>

      <div className="space-y-4 mb-5">
        {RAID_OPTIONS.map((raid) => (
          <fieldset key={raid.id} className="rounded-xl border border-card-border bg-brown-dark/40 p-3">
            <legend className="px-1 text-sm font-semibold">{raid.label}</legend>
            <div className="flex flex-wrap gap-2">
              {raid.modes.map((m) => {
                const k = raidModeKey(raid.id, m.id);
                const on = !!sel[k];
                return (
                  <ChoiceButton key={k} pressed={on} onClick={() => setSel((s) => ({ ...s, [k]: !on }))} className="flex items-center gap-1.5">
                    {on && <CheckIcon />}
                    {m.label}
                  </ChoiceButton>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {res.ok && how ? (
        <CountsBanner
          engine={how.engine}
          text={
            res.source === 'hiscores'
              ? 'Counts by itself from the hiscores. Nothing to upload. Entry Mode never counts here.'
              : 'Counts by itself: the plugin reads each raid’s completion line, because an Entry mode is ticked and Entry isn’t on the hiscores.'
          }
        />
      ) : (
        <p role="alert" className="text-sm text-red-300">{res.error}</p>
      )}
      <p className="mt-2 text-xs text-text-muted">
        Entry Mode never counts unless you tick it. Ticking an Entry mode switches the whole tile to the plugin’s count, since Entry isn’t on the hiscores.
      </p>

      <div className="mt-6 flex justify-end">
        <PrimaryButton onClick={next} disabled={!res.ok}>
          Next: points
        </PrimaryButton>
      </div>
    </div>
  );
}
