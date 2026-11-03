'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';

export default function EventChatSwitch({ initial, canWrite }: { initial: boolean; canWrite: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: boolean) {
    setSaving(true);
    setError(null);
    setEnabled(next);
    try {
      const res = await fetch('/api/staff/event-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
    } catch (err) {
      setEnabled(!next);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-card-border bg-card-bg p-5">
      <Checkbox
        checked={enabled}
        disabled={saving || !canWrite}
        onChange={save}
        label="Event chat is available on Anvil"
        description="Untick to close every event's chat straight away. Open chat boxes grey out straight away."
      />
      {!canWrite && <p className="mt-2 text-xs text-text-muted">Only staff can change this.</p>}
      {error && <p className="mt-2 text-xs text-accent-red">{error}</p>}
    </section>
  );
}
