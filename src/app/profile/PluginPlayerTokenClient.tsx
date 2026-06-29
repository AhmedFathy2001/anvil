'use client';

import { useEffect, useState } from 'react';

export default function PluginPlayerTokenClient() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/profile/plugin-token')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.token) setToken(d.token);
        else setError(d.error || 'Failed to load token');
      })
      .catch(() => alive && setError('Failed to load token'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  async function rotate() {
    if (!confirm('Rotate your plugin token? Your RuneLite plugin will stop working until you paste the new token into its config.')) return;
    setRotating(true);
    setError('');
    setCopied(false);
    const res = await fetch('/api/profile/plugin-token', { method: 'POST' });
    if (!res.ok) {
      setError('Rotate failed');
      setRotating(false);
      return;
    }
    const data = await res.json();
    setToken(data.token);
    setRevealed(true);
    setRotating(false);
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select and copy manually');
    }
  }

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div>
      <p className="text-sm text-text-muted mb-3">
        Paste this into your RuneLite plugin&rsquo;s <span className="text-foreground">Account Token</span> field.
        It works across every event you&rsquo;re signed up for — no need to re-paste each event.
        Rotate if you ever suspect it&rsquo;s leaked.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <code
          className={`flex-1 min-w-0 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm font-mono break-all ${
            revealed ? 'text-foreground' : 'text-text-muted select-all'
          }`}
          style={revealed ? undefined : { filter: 'blur(5px)' }}
          onClick={() => setRevealed(true)}
          title={revealed ? '' : 'Click to reveal'}
        >
          {token ?? '—'}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="px-3 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <button
          type="button"
          onClick={copy}
          disabled={!token}
          className="px-3 py-2 text-sm border border-gold/30 text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={rotate}
          disabled={rotating}
          className="px-3 py-2 text-sm border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {rotating ? 'Rotating…' : 'Rotate'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
