'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ClanLink from '@/components/ClanLink';
import LinkAccountClient from './LinkAccountClient';

// Adding a character, plugin FIRST.
//
// The plugin is the primary way and always was — it proves ownership with the account hash Jagex
// hands the client, which nobody can forge, so a character you log into just LINKS ITSELF and shows
// up here (lib/auth resolvePluginMember). The old form led with the XP-delta grind instead: type a
// name, train a random skill 1,000 XP, wait. That is the FALLBACK — for someone on mobile or the
// official client who can't run RuneLite — not the front door.
//
// So this leads with the token and "just play", watches for the first login the way ConnectCard
// does, and folds the by-name path away behind a disclosure for the people who actually need it.
export default function AddCharacterClient({ first = false }: { first?: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [heard, setHeard] = useState(false);
  // How many characters are linked right now, so a login that lands while this is open is seen as a
  // CHANGE rather than the baseline it's measured against.
  const baseline = useRef<number | null>(null);

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

  // Watch for the first ping the same way the locker's ConnectCard does: poll the cheap connection
  // beacon while the tab is visible, and the moment a new character lands hand over to a server
  // refresh (which re-renders the real list instead of a client guess at it).
  useEffect(() => {
    if (heard) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (!alive) return;
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/profile/connection', { cache: 'no-store' });
          if (res.ok) {
            const next = (await res.json()) as { linked: number };
            if (baseline.current == null) baseline.current = next.linked;
            else if (next.linked > baseline.current) {
              setHeard(true);
              router.refresh();
              return;
            }
          }
        } catch {
          /* a missed poll is covered by the next one */
        }
      }
      timer = setTimeout(poll, 10_000);
    };
    poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
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
        from the RuneLite plugin hub, paste your token once, and just play. Every account you log into links
        itself and appears here — no name to type, no XP to grind, and it stays yours in every clan you join.
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
        Goes in the plugin&rsquo;s <b className="text-foreground">Account Token</b> field — you never re-paste it.{' '}
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
            Listening for your next login… <b className="text-foreground">this page updates itself</b> the moment we
            see you.
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
            <LinkAccountClient manualReview={false} />
          </div>
        )}
      </div>
    </div>
  );
}
