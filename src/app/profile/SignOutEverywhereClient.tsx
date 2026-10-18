'use client';

import { useState } from 'react';

import { useDialog } from '@/components/Confirm';

/**
 * Sign out of every device at once — the answer to "I signed in on a friend's PC" or "someone has my
 * session". Plain sign-out only clears this browser; this invalidates every session the login holds.
 * The plugin token is separate and has its own rotate button above.
 */
export default function SignOutEverywhereClient() {
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOutEverywhere() {
    const ok = await confirm({
      title: 'Sign out everywhere?',
      body: 'Every browser signed in as you — this one included — is signed out. Sign back in with Discord whenever you like.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      // Platform route, not clan-scoped: the session belongs to the person, not to any clan.
      const res = await fetch('/api/auth/logout-everywhere', { method: 'POST' });
      if (!res.ok) {
        setError('Could not do that — try again.');
        return;
      }
      window.location.href = '/';
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="font-semibold text-sm">Sign out everywhere</div>
      <p className="text-xs text-text-muted mt-0.5 mb-3 max-w-[70ch]">
        Signed in on a computer that isn&rsquo;t yours, or think someone else has your session? This ends
        every session on every device.
      </p>
      {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
      <button
        type="button"
        onClick={signOutEverywhere}
        disabled={busy}
        className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-red-900 hover:text-red-300 disabled:opacity-50"
      >
        {busy ? 'Signing out…' : 'Sign out everywhere'}
      </button>
    </div>
  );
}
