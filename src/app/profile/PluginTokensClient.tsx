'use client';

import { useEffect, useState } from 'react';

interface PluginToken {
  id: number;
  token: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function PluginTokensClient() {
  const [tokens, setTokens] = useState<PluginToken[] | null>(null);
  const [revealedId, setRevealedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/auth/my-plugin-tokens');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load tokens');
        setTokens([]);
        return;
      }
      setTokens(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setTokens([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void load();
  }, []);

  async function copyToken(id: number, token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // Fallback if clipboard API unavailable — reveal so user can manually copy.
      setRevealedId(id);
    }
  }

  async function revoke(id: number) {
    if (!confirm('Revoke this token? The plugin using it will stop working until you re-link.')) return;
    try {
      const res = await fetch(`/api/auth/my-plugin-tokens?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Could not revoke');
        return;
      }
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
  }

  if (tokens === null) {
    return <div className="text-sm text-text-muted">Loading…</div>;
  }

  if (tokens.length === 0) {
    return (
      <p className="text-xs text-text-muted">
        No plugin tokens yet. Use the Link Account flow above to mint one.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        Long-lived admin plugin tokens. If your plugin lost its config — reinstall, new machine,
        different RuneLite profile, or anything else — copy the token directly into the plugin&apos;s
        &ldquo;Admin plugin token&rdquo; field instead of generating a fresh link code.
      </p>
      {error && (
        <div className="text-red-400 text-sm mb-2 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
          {error}
        </div>
      )}
      <div className="space-y-2">
        {tokens.map((t) => {
          const revealed = revealedId === t.id;
          const copied = copiedId === t.id;
          const masked = `${t.token.slice(0, 4)}${'•'.repeat(20)}${t.token.slice(-4)}`;
          return (
            <div
              key={t.id}
              className="border border-card-border rounded-lg p-3 bg-brown-dark/40"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-medium text-sm text-text-muted">Admin token</div>
                <div className="text-[11px] text-text-muted">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt && ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <code
                  className={`font-mono text-xs px-2 py-1 rounded bg-brown-dark border border-card-border min-w-0 flex-1 truncate ${
                    revealed ? 'text-foreground' : 'text-text-muted'
                  }`}
                  title={revealed ? t.token : 'click reveal to view'}
                >
                  {revealed ? t.token : masked}
                </code>
                <button
                  onClick={() => setRevealedId(revealed ? null : t.id)}
                  className="text-xs px-2 py-1 border border-card-border rounded hover:border-gold/40 transition-colors shrink-0"
                >
                  {revealed ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={() => copyToken(t.id, t.token)}
                  className="text-xs px-2 py-1 border border-gold/30 text-gold hover:bg-gold/10 rounded transition-colors shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => revoke(t.id)}
                  className="text-xs px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                >
                  Revoke
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
