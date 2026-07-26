'use client';

import { useEffect, useState } from 'react';

// Federation "Connected plugins" surface (FEDERATION.md / WIRE §4). A read-only list of the user's
// active federation connections with per-row Revoke + Revoke-all. Connecting is done from the plugin's
// Sign in (device-code) flow — there's no manual web mint, so this never displays a raw token.
interface FederationToken {
  tokenId: string;
  label: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export default function ConnectedPluginsClient() {
  const [tokens, setTokens] = useState<FederationToken[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/auth/my-plugin-tokens');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTokens(Array.isArray(data.federationTokens) ? data.federationTokens : []);
    } catch {
      setError('Failed to load connected plugins');
      setTokens([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(tokenId: string) {
    if (!confirm('Revoke this connection? The plugin using it will stop working immediately.')) return;
    setBusy(true);
    try {
      await fetch(`/api/auth/my-plugin-tokens?federationTokenId=${encodeURIComponent(tokenId)}`, {
        method: 'DELETE',
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    if (!tokens?.length) return;
    if (!confirm('Revoke ALL federation connections? Every plugin using one stops working immediately.')) return;
    setBusy(true);
    try {
      await fetch('/api/auth/my-plugin-tokens?federationRevokeAll=1', { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="text-lg font-semibold">Connected plugins</h2>
        </div>
        {tokens && tokens.length > 0 && (
          <button
            type="button"
            onClick={revokeAll}
            disabled={busy}
            className="text-xs px-2 py-1 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            Revoke all
          </button>
        )}
      </div>

      <p className="text-sm text-text-muted mb-4">
        The RuneLite plugins linked to your account show up here — whether you connected one directly or
        by playing in another connected clan. To connect a plugin, open the Anvil plugin and click{' '}
        <span className="text-foreground/80">Sign in</span> — no copying needed. Use this list to see
        what&apos;s connected and disconnect anything you don&apos;t recognise, or if you lose a device.
      </p>

      {tokens === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : tokens.length === 0 ? (
        <div className="text-sm text-text-muted text-center py-6 border border-dashed border-card-border rounded-lg">
          No plugins connected yet — open the Anvil plugin and click{' '}
          <span className="text-foreground/80">Sign in</span> to connect one.
        </div>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => (
            <li
              key={t.tokenId}
              className="flex items-center justify-between gap-3 px-3 py-2.5 border border-card-border rounded-lg bg-brown-dark/40"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{t.label || 'Plugin connection'}</div>
                <div className="text-xs text-text-muted truncate">
                  {t.scopes.join(', ') || 'board:read'} · added{' '}
                  {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ' · never used'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revoke(t.tokenId)}
                disabled={busy}
                className="shrink-0 px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </section>
  );
}
