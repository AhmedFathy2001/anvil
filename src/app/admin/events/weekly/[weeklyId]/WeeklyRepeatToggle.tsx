'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';

/**
 * "Repeat every week" for a competition that already exists. Off stops the series: the next week is
 * only ever made from one that still says repeat (lib/weeklyRepeat). The rotation it was created
 * with is kept as it was.
 */
export default function WeeklyRepeatToggle({
  competitionId,
  initial,
  rotationLabels,
}: {
  competitionId: number;
  initial: { rotation: string[] | null } | null;
  rotationLabels: string[];
}) {
  const [on, setOn] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function toggle(next: boolean) {
    setSaving(true);
    setError('');
    setOn(next);
    const res = await clanFetch(`/api/admin/weekly/${competitionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repeat: next ? { rotation: initial?.rotation ?? null } : null }),
    });
    setSaving(false);
    if (!res.ok) {
      setOn(!next);
      setError('That didn’t save. Try again.');
    }
  }

  return (
    <section className="rounded-xl border border-gold/25 bg-gold/[0.05] p-4 mb-6 space-y-2">
      <Checkbox
        checked={on}
        onChange={toggle}
        disabled={saving}
        label="Repeat every week"
        description={
          on
            ? rotationLabels.length > 1
              ? `When this one ends the next starts straight away, rotating through ${rotationLabels.join(', ')}.`
              : 'When this one ends the next starts straight away, the same length, with the same prizes.'
            : 'Off: this is the last one in the series.'
        }
        className="text-sm"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
