'use client';

import { useState } from 'react';

/**
 * Make a plugin token for one RuneLite client and show it — once.
 *
 * Tokens are stored only as hashes, so there is no "your token" to fetch and display any more: the
 * site never kept it. Each press mints a new one for one more client (pasting it signs nobody else
 * out), shown here until the page is left. Lost it? Make another.
 */
export default function NewPluginToken({ cta = 'Make a token', primary = false }: { cta?: string; primary?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
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
      setError('Copy failed — select it and copy by hand.');
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
        <code className="flex-1 min-w-[220px] px-3 py-2.5 bg-brown-dark border border-card-border rounded-lg text-sm font-mono break-all text-foreground select-all">
          {token}
        </code>
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2.5 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors"
        >
          {copied ? 'Copied' : 'Copy token'}
        </button>
      </div>
      <p className="text-xs text-text-muted mt-1.5">
        Shown once — Anvil keeps only a fingerprint of it. Paste it now; if you lose it, make another.
      </p>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
