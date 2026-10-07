'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ClanLink from '@/components/ClanLink';
import LinkAccountClient from './LinkAccountClient';

// Adding a character, plugin FIRST.
//
// The plugin is the primary discovery path: a character you play shows up here without typing its
// name. A safe new account can link immediately; an established roster identity still uses the
// XP-delta or moderator check because the client-reported name/hash are not authenticated. The old
// form led with that XP flow for everybody, including accounts with no prior identity to protect.
//
// So this leads with the token and "play once", watches for the first login the way ConnectCard
// does, and folds the by-name path away behind a disclosure for the people who actually need it.
export default function AddCharacterClient({
  first = false,
  suggestedRsn = '',
  linkedCount = 0,
  detectedCount = 0,
}: {
  first?: boolean;
  /**
   * A name we already believe is theirs, from `?connect=` — the apex home's "that's me".
   *
   * It opens the by-name path rather than the plugin one on purpose: somebody who arrived by
   * clicking a suggestion is at a browser, not in game, and the token flow would ask them to go and
   * be somewhere else before anything happens.
   */
  suggestedRsn?: string;
  /** Server-rendered baselines keep a ping between paint and the first poll from disappearing. */
  linkedCount?: number;
  detectedCount?: number;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(Boolean(suggestedRsn));
  const [heard, setHeard] = useState(false);
  // Both outcomes count. A safe first-use play becomes linked immediately; a protected roster row
  // becomes a detected account that needs the XP/mod check. Watching only `linked` made the latter
  // sit on "Listening…" forever even though the plugin had arrived successfully.
  const baseline = useRef({ linked: linkedCount, detected: detectedCount });

  useEffect(() => {
    let alive = true;
    fetch('/api/profile/plugin-token')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.token) setToken(d.token);
        else setError(d.error || 'Could not load your token');
      })
      .catch(() => alive && setError('Could not load your token'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    baseline.current = { linked: linkedCount, detected: detectedCount };
    setHeard(false);
  }, [linkedCount, detectedCount]);

  // Watch for the first ping the same way the locker's ConnectCard does. Two seconds keeps the
  // browser feeling connected to RuneLite, and an immediate visibility/focus poll covers the common
  // flow where somebody pastes the token, plays, then comes back to this tab.
  useEffect(() => {
    if (heard) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let polling = false;
    const poll = async () => {
      if (!alive || polling) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (document.visibilityState === 'visible') {
        polling = true;
        try {
          const res = await fetch('/api/profile/connection', { cache: 'no-store' });
          if (res.ok) {
            const next = (await res.json()) as { linked: number; detected: number };
            const prev = baseline.current;
            baseline.current = next;
            if (next.linked !== prev.linked || next.detected !== prev.detected) {
              setHeard(true);
              router.refresh();
              return;
            }
          }
        } catch {
          /* a missed poll is covered by the next one */
        } finally {
          polling = false;
        }
      }
      timer = setTimeout(poll, 2_000);
    };
    const pollWhenVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    poll();
    document.addEventListener('visibilitychange', pollWhenVisible);
    window.addEventListener('focus', pollWhenVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', pollWhenVisible);
      window.removeEventListener('focus', pollWhenVisible);
    };
  }, [heard, router]);

  const copy = useCallback(async () => {
    if (!token) return;
    setRevealed(true);
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — reveal it and copy manually');
    }
  }, [token]);

  return (
    <div>
      <p className="mb-3 max-w-[62ch] text-sm text-text-muted">
        The easy way{first ? '' : ', and the one to reach for'}: install <b className="text-foreground">Anvil</b>{' '}
        from the RuneLite Plugin Hub, click <b className="text-foreground">Sign in with Discord</b> in its sidebar panel once, and
        play the account. It appears here automatically;
        new accounts link immediately, while an account already on a roster asks for a one-time XP or moderator check.
      </p>

      <div className="flex max-w-[640px] flex-wrap gap-2">
        <code
          onClick={() => setRevealed(true)}
          title={revealed ? undefined : 'Click to reveal'}
          className={`min-w-[220px] flex-1 truncate rounded-lg border border-card-border bg-brown-dark px-3 py-2.5 font-mono text-sm ${
            revealed ? 'text-foreground' : 'cursor-pointer select-none text-text-muted'
          }`}
          style={revealed ? undefined : { filter: 'blur(5px)' }}
        >
          {loading ? 'loading…' : token ?? '—'}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="rounded-lg border border-card-border px-3 py-2.5 text-sm font-semibold transition-colors hover:border-gold/40"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <button
          type="button"
          onClick={copy}
          disabled={!token}
          className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy token'}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}

      <p className="mt-2 text-xs text-text-muted">
        Sign-in not working? Paste this into the plugin&rsquo;s <b className="text-foreground">Account Token</b>{' '}
        setting instead — you never re-paste it.{' '}
        <ClanLink href="/guide/plugin" className="text-gold hover:text-gold-light">
          Setup guide →
        </ClanLink>
      </p>

      <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-dashed border-card-border bg-brown-dark/50 px-3 py-2.5 text-sm text-text-muted">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-yellow-400" />
        {heard ? (
          <span>A character came through — loading…</span>
        ) : (
          <span>
            Waiting for RuneLite… <b className="text-foreground">log in or hop worlds once</b> and this page
            updates within a few seconds.
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-card-border pt-3">
        {!showManual ? (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-sm text-gold hover:text-gold-light"
          >
            On mobile or the official client? Link by name instead →
          </button>
        ) : (
          <div>
            <p className="mb-3 max-w-[62ch] text-sm text-text-muted">
              No plugin — prove it is yours by training. We snapshot the hiscores, pick a skill, and verify the
              XP you gain in it.
            </p>
            <LinkAccountClient manualReview={false} initialRsn={suggestedRsn} />
          </div>
        )}
      </div>
    </div>
  );
}
