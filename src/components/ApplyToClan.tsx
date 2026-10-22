'use client';

import Select from '@/components/Select';
import { useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';

interface Info {
  signedIn: boolean;
  guestPolicy?: string;
  alreadyIn?: boolean;
  options: { id: number; rsn: string }[];
}

/**
 * Applying to a clan from its own page.
 *
 * This is the branch that used to render `null`: signed in, with no Discord invite configured. A
 * visitor saw "Sign in to apply", signed in, came back — and the button was gone, under a panel
 * still saying the clan was recruiting. Nothing anywhere accepted an application, so the promise
 * could not have been kept even by pressing it.
 *
 * Addressed by slug against /api/clans/[slug]/apply, which is a platform route — so this works the
 * same from the clan's own pages and from the directory.
 */
export default function ApplyToClan({
  slug,
  clanName,
  /**
   * What the button says. The default is recruiting language, because that is the panel it was
   * written for. The guest door passes its own: `admit()` only ever produces a GUEST seat (or a
   * request for one), so "Join" there would promise membership this cannot grant — that comes from
   * the clan's in-game roster.
   */
  labels,
}: {
  slug: string;
  clanName: string;
  labels?: { open: string; approval: string };
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The GET failed. Saying so beats an empty space under a panel that just invited them in.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/clans/${slug}/apply`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Info) => {
        if (!alive) return;
        setInfo(d);
        if (d.options.length === 1) setChosen(d.options[0].id);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loadFailed) {
    return (
      <span className="shrink-0 text-[13px] text-text-muted">
        Couldn’t load this right now —{' '}
        <button type="button" onClick={() => window.location.reload()} className="text-gold underline underline-offset-2 hover:text-gold-light">
          try again
        </button>
      </span>
    );
  }
  if (!info) return null;
  if (info.alreadyIn) return null; // they are already here; the panel above is not addressed to them

  if (done) return <span className="shrink-0 text-[13px] text-accent-green-light">{done}</span>;

  // Nothing to apply with. The fix is somewhere else, so say where rather than showing a dead button.
  if (info.options.length === 0) {
    return (
      <ClanLink
        href="/profile"
        className="shrink-0 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-center text-[13px] font-semibold text-gold transition-colors hover:bg-gold/20"
      >
        Verify a character first
      </ClanLink>
    );
  }

  async function apply() {
    if (chosen == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clans/${slug}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: chosen, message: `Applied from ${clanName}’s page.` }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not apply');
      setDone(data?.message ?? 'Sent.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {info.options.length > 1 && (
        <Select
          value={chosen != null ? String(chosen) : ''}
          onChange={(v) => setChosen(Number(v) || null)}
          placeholder="Which character?"
          ariaLabel="Which character"
          className="min-w-[10rem]"
          options={info.options.map((o) => ({ value: String(o.id), label: o.rsn }))}
        />
      )}
      <button
        type="button"
        onClick={apply}
        disabled={busy || chosen == null}
        className="shrink-0 rounded-lg bg-gold px-4 py-2 text-center text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
      >
        {busy
          ? 'Sending…'
          : info.guestPolicy === 'open'
            ? (labels?.open ?? 'Join')
            : (labels?.approval ?? 'Apply')}
      </button>
      {error && <span className="text-[12px] text-accent-red">{error}</span>}
    </div>
  );
}
