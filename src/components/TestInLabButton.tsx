'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';

/**
 * "Test in lab" on a tile in the editor (platform staff only): copies this exact tile — kind,
 * constraints, sources, everything — onto a fresh one-tile lab board on the staffer's main character
 * (lib/lab), and opens the session. The original board is untouched. A mission tile can come along
 * as a mission (its own scoring and placement ladder kept, hidden until the lab announces it).
 */
export default function TestInLabButton({ tileId, mission = false }: { tileId: number; mission?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [keepMission, setKeepMission] = useState(mission);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/staff/lab/from-tile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tileId, keepMission: mission && keepMission }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? `Failed (${res.status})`);
      return;
    }
    // The lab lives on the apex, outside this clan's prefix: a full navigation, on purpose.
    window.location.href = `/staff/lab/${data.eventId}`;
  }

  return (
    <div className="mt-5 pt-4 border-t border-card-border">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
      >
        {busy ? 'Starting lab…' : '⚗ Test in lab'}
      </button>
      {mission && (
        <Checkbox
          checked={keepMission}
          onChange={setKeepMission}
          label="Keep it a mission"
          description="Copied hidden, with its claims, places and expiry; drop it from the lab's mission controls."
          className="mt-2 text-xs"
        />
      )}
      <p className="mt-1 text-[11px] text-text-muted">
        Copies this tile onto a private one-tile board on your own character. Nothing here changes.
      </p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
