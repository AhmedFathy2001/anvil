'use client';

import { useEffect, useState } from 'react';

// Federation "Connected plugins" surface (FEDERATION.md / WIRE §4). Lists the user's active
// federation tokens with a per-row Revoke and a Revoke-all, and lets them mint a new one (own
// issuance via the current web session). The raw token is shown exactly once at mint time — the
// server only ever stores its hash, so we can never re-display an existing token.
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
  const [minting, setMinting] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function mint() {
    setMinting(true);
    setError('');
    setFreshToken(null);
    setCopied(false);
    try {
      const res = await fetch('/api/federation/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Web-issued', scopes: ['board:read'] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create token');
      }
      const d = await res.json();
      setFreshToken(d.token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token');
    } finally {
      setMinting(false);
    }
  }

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

  async function copyFresh() {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select and copy manually');
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
        Federation tokens let a RuneLite plugin connect to this clan — including from a broker
        exchange when you play across clans. Each is long-lived and revocable; revoke one if a device
        is lost.
      </p>

      {freshToken && (
        <div className="mb-4 border border-gold/30 bg-gold/5 rounded-lg p-3">
          <p className="text-xs text-text-muted mb-2">
            New connection token — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <code className="flex-1 min-w-0 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm font-mono break-all text-foreground">
              {freshToken}
            </code>
            <button
              type="button"
              onClick={copyFresh}
              className="px-3 py-2 text-sm border border-gold/30 text-gold rounded-lg hover:bg-gold/10 transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {tokens === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : tokens.length === 0 ? (
        <div className="text-sm text-text-muted text-center py-6 border border-dashed border-card-border rounded-lg">
          No connected plugins yet.
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

      <div className="mt-4">
        <button
          type="button"
          onClick={mint}
          disabled={minting}
          className="px-3 py-2 text-sm border border-gold/30 text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
        >
          {minting ? 'Creating…' : 'Generate a connection token'}
        </button>
      </div>
    </section>
  );
}
