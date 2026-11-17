'use client';

import { useEffect, useState } from 'react';
import { useDialog } from '@/components/Confirm';
import ClanLink from '@/components/ClanLink';
import NewPluginToken from '@/components/NewPluginToken';

/**
 * The person's plugin tokens. There is nothing to reveal: tokens are stored only as hashes, so each
 * is shown once, when it is made. What lives here is making another (for one more client) and the
 * panic button — revoking every token, which signs every client out.
 */
export default function PluginPlayerTokenClient() {
  const { confirm } = useDialog();
  const [count, setCount] = useState<number | null>(null);
  const [signIns, setSignIns] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/profile/plugin-token')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setCount(typeof d.tokens === 'number' ? d.tokens : 0);
        setSignIns(typeof d.signIns === 'number' ? d.signIns : 0);
      })
      .catch(() => alive && setError('Could not load your tokens'));
    return () => {
      alive = false;
    };
  }, []);

  async function revokeAll() {
    const ok = await confirm({
      title: 'Sign every RuneLite client out?',
      body: 'Every plugin token you hold stops working immediately. Each client goes quiet until you sign in from its sidebar panel again.',
      confirmLabel: 'Revoke all',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/profile/plugin-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke' }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Could not revoke them — try again.');
      return;
    }
    setCount(0);
    setSignIns(0);
  }

  return (
    <div>
      <p className="text-sm text-text-muted mb-3">
        The plugin fills this in for you when you click <span className="text-foreground">Sign in with Discord</span> in
        its sidebar panel. If that doesn&rsquo;t work, make a token and use{' '}
        <span className="text-foreground">Paste a token instead</span> in that panel. It works across every event
        you&rsquo;re signed up for, and is shown only once.
        {count != null && (
          <>
            {' '}
            You have <span className="text-foreground">{count}</span> active {count === 1 ? 'token' : 'tokens'}
            {signIns > 0 && (
              <>
                : your main one and {signIns} {signIns === 1 ? 'sign-in' : 'sign-ins'} made from the panel, which you can revoke one by one under{' '}
                <ClanLink href="/settings/account#plugin-sign-ins" className="text-gold hover:text-gold-light">
                  Account → Plugin sign-ins
                </ClanLink>
              </>
            )}
            .
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex-1 min-w-[260px]">
          <NewPluginToken />
        </div>
        {count != null && count > 0 && (
          <button
            type="button"
            onClick={revokeAll}
            disabled={busy}
            className="px-3 py-2 text-sm border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {busy ? 'Revoking…' : 'Revoke all'}
          </button>
        )}
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
