'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ClanLink from '@/components/ClanLink';

// The one job of a member's first visit: get the plugin talking to us.
//
// This replaces the old three-step checklist plus a separate "RuneLite plugin" section. Everything
// that used to be a form (manual linking, rotation, ignored accounts) moved to the drawer at the
// bottom of the page — what's left is one token, one button, and a beacon that watches for the
// first ping so nobody has to guess whether it worked or reload the page to find out.

interface Props {
  /** Clan name, set only on a brand-new member's first landing (?welcome=1 from the OAuth callback). */
  welcomeTo: string | null;
  /** Already signed in with Discord — step one is done before they get here. */
  discordUsername: string | null;
  /** Accounts already linked, so a half-set-up member sees the right step highlighted. */
  linkedCount: number;
  verifiedCount: number;
  detectedCount: number;
  connected: boolean;
}

type Beacon = { connected: boolean; linked: number; verified: number; detected: number };

export default function ConnectCard({
  welcomeTo,
  discordUsername,
  linkedCount,
  verifiedCount,
  detectedCount,
  connected,
}: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [heard, setHeard] = useState(false);
  // Seeded from what the server just rendered, so a ping that lands between paint and the first
  // poll still counts as a change rather than becoming the baseline it's compared against.
  const baseline = useRef<Beacon>({
    connected,
    linked: linkedCount,
    verified: verifiedCount,
    detected: detectedCount,
  });

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

  // The beacon. Poll while the tab is visible; stop the moment something lands and hand over to a
  // server refresh, which re-renders the real page state rather than a client guess at it.
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
            const next = (await res.json()) as Beacon;
            const prev = baseline.current;
            baseline.current = next;
            const changed =
              next.connected !== prev.connected ||
              next.linked !== prev.linked ||
              next.verified !== prev.verified ||
              next.detected !== prev.detected;
            if (changed) {
              if (!alive) return;
              setHeard(true);
              router.refresh();
              return;
            }
          }
        } catch {
          /* a missed poll is not worth an error message — the next one covers it */
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

  const tokenDone = connected || verifiedCount > 0;

  return (
    <section
      id="connect"
      className="rounded-2xl border border-gold/35 p-5 sm:p-6 mt-5"
      style={{
        background:
          'radial-gradient(90% 160% at 6% 0%, rgba(255,106,43,0.09), transparent 60%), rgba(212,160,23,0.05)',
      }}
    >
      {welcomeTo && (
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold/85 mb-1.5">
          Welcome to {welcomeTo}
        </div>
      )}
      <h2 className="text-xl font-bold tracking-tight">
        {linkedCount > 0 ? 'Finish connecting your account' : 'Connect your account'}
      </h2>
      <p className="text-sm text-text-muted mt-1.5 mb-5 max-w-[62ch]">
        One token, once. Paste it into the Anvil plugin and just play — every account you log into links
        itself, your drops get tracked, and this page fills in on its own.
      </p>

      <ol className="grid">
        <Step n={1} done title="Signed in with Discord" last={false}>
          You&rsquo;re in{discordUsername ? <> as <b className="text-foreground">@{discordUsername}</b></> : null}.
        </Step>

        <Step n={2} done={tokenDone} title="Copy your token" last={false}>
          Goes in the plugin&rsquo;s <b className="text-foreground">Account Token</b> field. It works for every
          event — you never re-paste it.
          <div className="flex flex-wrap gap-2 mt-2.5 max-w-[640px]">
            <code
              onClick={() => setRevealed(true)}
              title={revealed ? undefined : 'Click to reveal'}
              className={`flex-1 min-w-[220px] px-3 py-2.5 bg-brown-dark border border-card-border rounded-lg text-sm font-mono truncate ${
                revealed ? 'text-foreground' : 'text-text-muted select-none cursor-pointer'
              }`}
              style={revealed ? undefined : { filter: 'blur(5px)' }}
            >
              {loading ? 'loading…' : token ?? '—'}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="px-3 py-2.5 text-sm font-semibold border border-card-border rounded-lg hover:border-gold/40 transition-colors"
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
            <button
              type="button"
              onClick={copy}
              disabled={!token}
              className="px-4 py-2.5 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
            >
              {copied ? 'Copied' : 'Copy token'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </Step>

        <Step n={3} done={connected} title="Log in to the game" last>
          Install <b className="text-foreground">Anvil</b> from the RuneLite plugin hub, paste the token, log
          in.{' '}
          <ClanLink href="/guide/plugin" className="text-gold hover:text-gold-light">
            Setup guide with screenshots →
          </ClanLink>
          {!connected && (
            <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-dashed border-card-border bg-brown-dark/50 px-3 py-2.5 text-sm text-text-muted">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
              {heard ? (
                <span>Something came through — loading your locker…</span>
              ) : (
                <span>
                  Listening for your first login… <b className="text-foreground">this page updates itself</b> the
                  moment we see you.
                </span>
              )}
            </div>
          )}
        </Step>
      </ol>

      <p className="text-xs text-text-muted mt-4">
        Playing on mobile or the official client?{' '}
        <a href="#account-security" className="text-gold hover:text-gold-light">
          Link by name instead
        </a>{' '}
        — gain a little XP and we&rsquo;ll verify it from the hiscores.
      </p>
    </section>
  );
}

function Step({
  n,
  done,
  title,
  last,
  children,
}: {
  n: number;
  done?: boolean;
  title: string;
  last: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[30px_minmax(0,1fr)] gap-3.5 pb-5 last:pb-0">
      {!last && (
        <span
          className="absolute left-[14px] top-[30px] bottom-1 w-0.5"
          style={{ background: 'linear-gradient(180deg, var(--card-border), transparent)' }}
        />
      )}
      <span
        className={`relative z-10 w-[30px] h-[30px] rounded-full grid place-items-center text-[13px] font-bold border ${
          done
            ? 'bg-accent-green/15 text-accent-green-light border-accent-green/35'
            : 'bg-gold/15 text-gold-light border-gold/30'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-text-muted mt-0.5">{children}</div>
      </div>
    </li>
  );
}
