'use client';

import { useCallback, useEffect, useState } from 'react';
import ClanLink from '@/components/ClanLink';

/**
 * The two values the reader came here to paste, in the guide itself.
 *
 * The token is fetched only in the signed-in browser. It is never rendered into the public guide's
 * server HTML, and stays blurred until the reader deliberately reveals or copies it.
 */
export default function PluginSetupValues({ origin, tokenLabel }: { origin: string; tokenLabel: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<'origin' | 'token' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/profile/plugin-token', { cache: 'no-store' })
      .then(async (response) => {
        if (!alive) return;
        if (response.status === 401) {
          setSignedOut(true);
          return;
        }
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.token) setToken(data.token);
        else setError(data.error || 'Could not load your token here.');
      })
      .catch(() => alive && setError('Could not load your token here.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const copy = useCallback(async (kind: 'origin' | 'token', value: string) => {
    if (kind === 'token') setRevealed(true);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000);
    } catch {
      setError('Copy failed — reveal the value and copy it manually.');
    }
  }, []);

  return (
    <div className="my-5 rounded-xl border border-gold/30 bg-gold/[0.04] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gold/80">
        Your setup values
      </div>

      <SetupRow label="Site URL">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-card-border bg-brown-dark px-3 py-2 font-mono text-sm text-foreground">
          {origin}
        </code>
        <CopyButton copied={copied === 'origin'} onClick={() => copy('origin', origin)} />
      </SetupRow>

      <div className="mt-3 border-t border-card-border pt-3">
        {loading ? (
          <p className="text-sm text-text-muted">Checking whether you&rsquo;re signed in…</p>
        ) : signedOut ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-text-muted">Sign in with Discord to show your personal token here.</span>
            <ClanLink
              href="/profile#plugin-token"
              className="rounded-lg bg-gold px-3 py-2 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Sign in and show token
            </ClanLink>
          </div>
        ) : token ? (
          <SetupRow label={tokenLabel}>
            <code
              onClick={() => setRevealed(true)}
              title={revealed ? undefined : 'Click to reveal'}
              className={`min-w-0 flex-1 cursor-pointer break-all rounded-lg border border-card-border bg-brown-dark px-3 py-2 font-mono text-sm ${
                revealed ? 'text-foreground' : 'select-none text-text-muted'
              }`}
              style={revealed ? undefined : { filter: 'blur(5px)' }}
            >
              {token}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              className="rounded-lg border border-card-border px-3 py-2 text-sm transition-colors hover:border-gold/40"
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
            <CopyButton copied={copied === 'token'} onClick={() => copy('token', token)} />
          </SetupRow>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-red-400">{error || 'Could not load your token here.'}</span>
            <ClanLink href="/profile#plugin-token" className="text-gold hover:text-gold-light">
              Open token settings →
            </ClanLink>
          </div>
        )}
      </div>

      {error && token && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <p className="mt-3 text-xs text-text-muted">
        Treat the token like a password.{' '}
        <ClanLink href="/profile#plugin-token" className="text-gold hover:text-gold-light">
          Open token settings
        </ClanLink>{' '}
        to rotate it if it leaks.
      </p>
    </div>
  );
}

function SetupRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gold/30 px-3 py-2 text-sm text-gold transition-colors hover:bg-gold/10"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
