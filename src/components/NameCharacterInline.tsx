'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import { XpCheckInline } from '@/app/profile/LinkAccountClient';
import { discordStartHref } from '@/lib/discordStart';
import { readApplyName, validRsn, withApplyName } from '@/lib/rsnRules';

type Via = 'plugin' | 'xp' | 'staff';

const CHOICES: { via: Via; label: string; says: string }[] = [
  { via: 'plugin', label: 'I use the Anvil plugin', says: 'Sign in to the plugin and play once. You are added automatically.' },
  { via: 'xp', label: 'Verify with a quick XP gain', says: 'Gain 1,000 XP in one skill we pick, within 30 minutes. No plugin needed.' },
  { via: 'staff', label: 'Ask this clan’s staff to vouch for me', says: 'Their staff confirm the character is yours. You can sign up meanwhile; entries are held until they answer.' },
];

/**
 * Name your character right here and carry on, with no trip to Settings.
 *
 * Used where a signed-in person with no character meets a clan's door: the clan page's apply box
 * (`mode="apply"`: the application is filed with the name) and an event's enter and sign-up screens
 * (`mode="event"`: the character is linked and the screen moves on by itself). A signed-out visitor
 * sees the same box; pressing the button starts sign-in and brings them back with the name still in
 * it (carried in the address only as a validated in-game name, lib/rsnRules).
 *
 * A name that is ON the clan's in-game member list is not asked to apply at all: the plugin
 * recognises it on first play (the first-use link), and the box says so.
 */
export default function NameCharacterInline({
  slug,
  clanName,
  clanPath,
  mode,
  signedIn,
  returnPath,
  heading,
  applyLabel,
  ways,
}: {
  /** Which ways to confirm are offered, in order. Default: all three. */
  ways?: Via[];
  slug: string;
  clanName: string;
  /** The clan's address path (`/c/<slug>`), which is how the vouch request names its clan. */
  clanPath: string;
  mode: 'apply' | 'event';
  signedIn: boolean;
  /** Where sign-in returns to: this page. */
  returnPath: string;
  heading?: string;
  applyLabel?: string;
}) {
  const router = useRouter();
  const [rsn, setRsn] = useState('');
  const [via, setVia] = useState<Via>('plugin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onRoster, setOnRoster] = useState(false);
  const [done, setDone] = useState<{ via: Via; rsn: string; onRoster: boolean } | null>(null);
  const [seated, setSeated] = useState(false);
  // Did THIS visit's click choose the XP check? Only then does the check start by itself; a page
  // that merely remembers an earlier application shows the Start button and writes nothing on load.
  const [pressed, setPressed] = useState(false);

  // Back from sign-in with the name they typed, or a reload with an application already waiting.
  useEffect(() => {
    const carried = readApplyName(window.location.search);
    if (carried) setRsn(carried);
    if (!signedIn || mode !== 'apply') return;
    fetch(`/api/clans/${slug}/apply`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { intent?: { rsn: string; via: 'plugin' | 'xp' } | null } | null) => {
        if (d?.intent) setDone({ via: d.intent.via, rsn: d.intent.rsn, onRoster: false });
      })
      .catch(() => {});
  }, [signedIn, mode, slug]);

  // Is the typed name on this clan's in-game member list? Asked a moment after they stop typing.
  const name = validRsn(rsn);
  useEffect(() => {
    setOnRoster(false);
    if (!signedIn || !name || done) return;
    const t = setTimeout(() => {
      fetch(`/api/clans/${slug}/apply?rsn=${encodeURIComponent(name)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { named?: { rsn: string; onRoster: boolean } | null } | null) => {
          if (d?.named && d.named.rsn === name) setOnRoster(d.named.onRoster);
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [name, signedIn, slug, done]);

  // Once they are waiting on the plugin or the XP check, watch for the character becoming theirs:
  // the page then shows what it showed everyone else (the form, "you're in") by itself.
  useEffect(() => {
    if (!done || done.via === 'staff' || seated) return;
    const id = setInterval(() => {
      fetch(`/api/clans/${slug}/apply`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { alreadyIn?: boolean; options?: { rsn: string }[] } | null) => {
          if (!d) return;
          const mine = d.alreadyIn || (d.options ?? []).some((o) => o.rsn.toLowerCase() === done.rsn.toLowerCase());
          if (mine) {
            setSeated(true);
            router.refresh();
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [done, seated, slug, router]);

  async function go(chosen: Via = via) {
    setError(null);
    if (!name) {
      setError('Type your in-game name: 1 to 12 letters, numbers, spaces, hyphens or underscores.');
      return;
    }
    if (!signedIn) {
      // clan-prefix: platform -- the Discord start is the platform's; the return path is this page.
      window.location.href = discordStartHref(withApplyName(returnPath, name));
      return;
    }
    setBusy(true);
    setPressed(true);
    try {
      if (chosen === 'staff') {
        const res = await fetch('/api/auth/request-manual-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsn: name, clan: clanPath }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok && res.status !== 202) throw new Error(data?.error ?? 'Could not send that');
        setDone({ via: 'staff', rsn: name, onRoster: false });
        router.refresh();
        return;
      }
      if (mode === 'apply') {
        const res = await fetch(`/api/clans/${slug}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsn: name, via: chosen }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? 'Could not apply');
        setDone({ via: chosen, rsn: name, onRoster: !!data?.onRoster });
        return;
      }
      setDone({ via: chosen, rsn: name, onRoster });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pluginLinks = (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
      {/* clan-prefix: platform -- the guide and the sign-in code page are the platform's */}
      <a href="/guide/plugin" target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2 hover:text-gold-light">
        How to set up the plugin
      </a>
      <a href="/link-device" target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2 hover:text-gold-light">
        Enter the plugin’s sign-in code
      </a>
    </span>
  );

  if (seated && done) {
    return (
      <p className="text-[13px] text-accent-green-light">
        {done.rsn} is linked to you{mode === 'apply' ? `, and you’re in ${clanName}.` : '.'}
      </p>
    );
  }

  if (done) {
    const filed = mode === 'apply' && !done.onRoster;
    return (
      <div className="w-full space-y-2 text-[13px]" aria-live="polite">
        {done.onRoster ? (
          <p className="font-medium text-foreground">
            You’re already on {clanName}’s member list. Sign in to the Anvil plugin on {done.rsn} and play once: you’ll be recognised automatically.
          </p>
        ) : (
          <p className="font-medium text-foreground">
            {filed || done.via === 'staff' ? `Applied with ${done.rsn}.` : `${done.rsn} it is.`}
          </p>
        )}
        {done.via === 'plugin' && (
          <>
            {!done.onRoster && (
              <p className="text-text-muted">
                Next: sign in to the Anvil plugin and log in to {done.rsn}. {mode === 'apply' ? `You are added to ${clanName} automatically` : 'This page carries on by itself'}, usually within a
                minute of logging in. You can leave this page; nothing else is needed from you.
              </p>
            )}
            {pluginLinks}
          </>
        )}
        {done.via === 'xp' && (
          <>
            <p className="text-text-muted">
              Next: gain the XP below within 30 minutes. {mode === 'apply' ? `You are added to ${clanName}` : 'This page carries on'} as soon as the gain shows on the hiscores, usually a few minutes
              after you log out or hop worlds. The check keeps running if you leave this page.
            </p>
            <XpCheckInline rsn={done.rsn} autoStart={pressed} />
          </>
        )}
        {done.via === 'staff' && (
          <p className="text-text-muted">
            Next: {clanName}’s staff confirm {done.rsn} is yours. You can sign up for their events now; your entries are held until they answer, which is as soon as one of them
            next looks (ask in their Discord to hurry it). Signing in to the Anvil plugin on {done.rsn} confirms it at once instead.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setError(null);
          }}
          className="text-[12px] text-text-muted underline underline-offset-2 hover:text-foreground"
        >
          Use a different name or way
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {heading && <div className="text-sm font-semibold">{heading}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={rsn}
          onChange={(e) => setRsn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void go();
          }}
          placeholder="Your in-game name"
          aria-label="Your in-game name"
          maxLength={12}
          className="min-w-[11rem] flex-1 rounded-lg border border-card-border bg-brown-light px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
        />
        {!onRoster && (
          <button
            type="button"
            onClick={() => void go()}
            disabled={busy}
            className="shrink-0 rounded-lg bg-gold px-4 py-2 text-center text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Sending…' : (applyLabel ?? 'Apply')}
          </button>
        )}
      </div>
      {onRoster ? (
        <div className="space-y-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-[13px]">
          <p className="font-medium text-foreground">
            You’re already on {clanName}’s member list. Sign in to the Anvil plugin on that character and play once: you’ll be recognised automatically.
          </p>
          {pluginLinks}
          <p className="text-text-muted">
            No plugin?{' '}
            <button type="button" onClick={() => void go('xp')} disabled={busy} className="text-gold underline underline-offset-2 hover:text-gold-light">
              Verify with a quick XP gain
            </button>{' '}
            instead, or ask {clanName}’s staff to link the character to you from their member list.
          </p>
        </div>
      ) : (
        <div role="radiogroup" aria-label="How you will confirm the character" className="space-y-1">
          {CHOICES.filter((c) => !ways || ways.includes(c.via)).map((c) => (
            <button
              key={c.via}
              type="button"
              role="radio"
              aria-checked={via === c.via}
              onClick={() => setVia(c.via)}
              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-1.5 text-left text-[13px] transition-colors ${
                via === c.via ? 'border-gold/60 bg-gold/10' : 'border-card-border hover:border-gold/30'
              }`}
            >
              <span aria-hidden className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${via === c.via ? 'border-gold bg-gold' : 'border-text-muted'}`} />
              <span>
                <span className="font-medium text-foreground">{c.label}</span>
                <span className="block text-[12px] text-text-muted">{c.says}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {!signedIn && <p className="text-[12px] text-text-muted">Pressing {applyLabel ?? 'Apply'} signs you in with Discord first and brings you back here with the name kept.</p>}
      {error && <p className="text-[12px] text-accent-red">{error}</p>}
    </div>
  );
}
