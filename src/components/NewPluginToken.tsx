'use client';

import { useState } from 'react';

import Input from '@/components/Input';

/** What the field holds while the token is hidden: a fixed run of dots, so not even its length shows. */
const MASK = '•'.repeat(32);

/**
 * Make a plugin token for one RuneLite client and show it — once.
 *
 * Tokens are stored only as hashes, so there is no "your token" to fetch and display any more: the
 * site never kept it. Each press mints a new one for one more client (pasting it signs nobody else
 * out), kept here until the page is left. Lost it? Make another.
 *
 * Hidden by default: it signs in as the person, and this page is often on a stream or a shared
 * screen. While hidden the field holds dots, not the token, so it cannot be selected or read out of
 * the page; Copy works either way. The token is never logged.
 */
export default function NewPluginToken({ cta = 'Make a token', primary = false }: { cta?: string; primary?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');

  async function make() {
    setBusy(true);
    setError('');
    try {
      // Platform route, not clan-scoped: tokens belong to the person.
      const res = await fetch('/api/profile/plugin-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'new' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setError(res.status === 401 ? 'Sign in first.' : data.error || 'Could not make a token.');
        return;
      }
      setRevealed(false);
      setToken(data.token);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setRevealed(true);
      setError('Copy failed. The token is shown now: select it and copy by hand.');
    }
  }

  if (!token) {
    return (
      <div>
        <button
          type="button"
          onClick={make}
          disabled={busy}
          className={
            primary
              ? 'px-4 py-2.5 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50'
              : 'px-3 py-2 text-sm border border-gold/30 text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50'
          }
        >
          {busy ? 'Making…' : cta}
        </button>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          readOnly
          value={revealed ? token : MASK}
          aria-label={revealed ? 'Your new plugin token' : 'Your new plugin token, hidden'}
          autoComplete="off"
          spellCheck={false}
          onFocus={(e) => revealed && e.currentTarget.select()}
          className="flex-1 min-w-[220px] w-auto py-2.5 rounded-lg font-mono"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          className="px-3 py-2.5 text-sm border border-gold/30 text-gold rounded-lg hover:bg-gold/10 transition-colors"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2.5 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors"
        >
          {copied ? 'Copied' : 'Copy token'}
        </button>
      </div>
      <p className="text-xs text-text-muted mt-1.5">
        Made once and hidden until you press Reveal. Copy works without revealing it. Anvil keeps only a fingerprint of it, so paste it now; if you lose it, make another.
      </p>
      <p className="text-xs text-text-muted mt-1">
        This token signs in as you, so treat it like a password. If it leaks, press <b>Revoke all</b> in your
        plugin settings.
      </p>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
