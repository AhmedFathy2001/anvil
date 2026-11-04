'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useDialog } from '@/components/Confirm';
import Select from '@/components/Select';
import { BTN, BTN_DANGER } from '../_client';

async function call(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch('/api/profile/boosts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error || 'That didn’t work.';
}

/** "Boost" on a clan you can boost. */
export function PlaceBoost({ seatId, disabled, why }: { seatId: number; disabled: boolean; why: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      {error && <span className="max-w-[28ch] text-right text-xs text-red-400">{error}</span>}
      <button
        type="button"
        className={BTN}
        disabled={busy || disabled}
        title={disabled && why ? why : undefined}
        onClick={async () => {
          setBusy(true);
          setError('');
          const err = await call({ action: 'place', seatId });
          setBusy(false);
          if (err) setError(err);
          else router.refresh();
        }}
      >
        {busy ? '…' : 'Boost'}
      </button>
    </>
  );
}

/** Move (to another clan you can boost) and Remove, for one placed boost. */
export function BoostActions({
  boostId,
  canMove,
  movableOn,
  targets,
  clanName,
}: {
  boostId: number;
  canMove: boolean;
  /** When it may move, if not yet. */
  movableOn: string | null;
  targets: { seatId: number; label: string }[];
  clanName: string;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const err = await call(body);
    setBusy(false);
    if (err) setError(err);
    else {
      setMoving(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <span className="max-w-[28ch] text-right text-xs text-red-400">{error}</span>}
      {moving ? (
        <>
          <Select
            value={target}
            onChange={setTarget}
            options={targets.map((t) => ({ value: String(t.seatId), label: t.label }))}
            placeholder="Move to…"
            ariaLabel="Move this boost to"
            className="w-56"
          />
          <button type="button" className={BTN} disabled={busy || !target} onClick={() => void run({ action: 'move', boostId, seatId: Number(target) })}>
            {busy ? '…' : 'Move'}
          </button>
          <button type="button" className={BTN} disabled={busy} onClick={() => setMoving(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={BTN}
            disabled={busy || !canMove || targets.length === 0}
            title={!canMove && movableOn ? `Can move on ${movableOn}` : targets.length === 0 ? 'No other clan you can boost yet' : undefined}
            onClick={() => setMoving(true)}
          >
            Move
          </button>
          <button
            type="button"
            className={BTN_DANGER}
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: `Remove your boost from ${clanName}?`,
                body: canMove
                  ? 'The slot is free again straight away.'
                  : `The slot stays locked until ${movableOn}: a boost can move once a week, and removing counts as a move.`,
                confirmLabel: 'Remove',
              });
              if (ok) await run({ action: 'remove', boostId });
            }}
          >
            Remove
          </button>
        </>
      )}
    </div>
  );
}
