'use client';

import { useEffect, useState } from 'react';

import AnnounceKindsEditor from '@/components/AnnounceKindsEditor';
import { clanFetch } from '@/lib/clanFetch';
import { NO_CLAN_KINDS, type ClanKinds } from '@/lib/notifyKinds';

/** The clan's defaults for the newer kinds and per-kind screenshots, under the Milestones feed. */
export default function ClanKindDefaults() {
  const [value, setValue] = useState<ClanKinds | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void clanFetch('/api/admin/notify-kinds')
      .then((r) => r.json())
      .then((d) => setValue(d && d.kinds ? d : NO_CLAN_KINDS))
      .catch(() => setError('Could not load these settings.'));
  }, []);
  async function save(next: ClanKinds) {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/notify-kinds', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setValue(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!value) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;
  return (
    <div className="grid gap-2">
      {error && <p className="text-sm text-accent-red">{error}</p>}
      <AnnounceKindsEditor mode="clan" value={value} busy={busy} onSave={(v) => void save(v as ClanKinds)} />
    </div>
  );
}
