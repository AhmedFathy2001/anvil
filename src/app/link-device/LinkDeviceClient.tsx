'use client';

import { useState } from 'react';
import Input from '@/components/Input';

/** Code confirm + Approve/Deny for the plugin device sign-in. Success view tells the member to
 * return to RuneLite — the plugin's poll picks the approval up within seconds. */
export default function LinkDeviceClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'approved' | 'denied' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: 'approve' | 'deny') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/link-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setResult(action === 'approve' ? 'approved' : 'denied');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (result === 'approved') {
    return (
      <div className="rounded-lg border border-accent-green/40 bg-accent-green/10 p-4 text-sm">
        <p className="font-semibold text-accent-green-light">Client linked ✓</p>
        <p className="text-text-muted mt-1">
          You can close this tab and return to RuneLite — the plugin signs itself in within a few
          seconds.
        </p>
      </div>
    );
  }
  if (result === 'denied') {
    return (
      <div className="rounded-lg border border-card-border bg-brown-dark p-4 text-sm text-text-muted">
        Request denied. Nothing was linked.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="device-code">
        Code shown in RuneLite
      </label>
      <Input
        id="device-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="XXXX-XXXX"
        spellCheck={false}
        autoComplete="off"
        className="rounded-lg text-lg font-mono tracking-widest text-center uppercase"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => act('approve')}
          disabled={busy || code.trim().length < 8}
          className="flex-1 px-4 py-2 bg-gold text-brown-dark font-semibold rounded-lg text-sm hover:bg-yellow-500 transition-colors disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Approve'}
        </button>
        <button
          onClick={() => act('deny')}
          disabled={busy}
          className="px-4 py-2 border border-card-border rounded-lg text-sm text-text-muted hover:text-text transition-colors disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
