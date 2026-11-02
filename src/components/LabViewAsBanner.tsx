'use client';

import { useState } from 'react';

/**
 * Shown on every page while platform staff view the site as a lab test user (lib/auth labViewAs):
 * who they are being, and the way back. Pinned to the bottom so no page can bury it.
 */
export default function LabViewAsBanner({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  async function stop() {
    setBusy(true);
    await fetch('/api/lab-view-as', { method: 'DELETE' }).catch(() => null);
    window.location.reload();
  }
  return (
    <div className="fixed inset-x-0 bottom-3 z-[100] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-amber-600 bg-amber-950/95 px-4 py-2 text-sm text-amber-100 shadow-lg">
        <span>
          Lab: viewing as <b>{name}</b>
        </span>
        <button
          type="button"
          onClick={() => void stop()}
          disabled={busy}
          className="rounded-full border border-amber-500/60 px-3 py-0.5 text-xs font-semibold hover:bg-amber-800/40 disabled:opacity-60"
        >
          {busy ? 'Switching…' : 'Switch back'}
        </button>
      </div>
    </div>
  );
}
