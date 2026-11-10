'use client';

import { useState } from 'react';
import { CheckboxBox } from '@/components/Checkbox';

/** "Show me on the supporters wall at anvilosrs.com/supporter" (users.supporter_wall). Default on. */
export default function SupporterWallToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/profile/supporter-wall', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shown: next }),
    }).catch(() => null);
    if (res?.ok) setOn(next);
    else setError('Could not save.');
    setBusy(false);
  }

  return (
    <label className="flex w-full items-center gap-2 text-[13px] text-text-muted">
      <CheckboxBox checked={on} disabled={busy} onChange={(e) => void change(e.target.checked)} />
      Show me on the supporters wall at anvilosrs.com/supporter
      {error && <span className="text-red-400">{error}</span>}
    </label>
  );
}
