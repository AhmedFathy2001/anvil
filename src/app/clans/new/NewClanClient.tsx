'use client';

import { useEffect, useState } from 'react';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';

/**
 * Create a clan.
 *
 * What this form is NOT any more is most of the story: no plan picker, no payment step, no Discord
 * application, no bot invite, no "we're building your site, check back in a few minutes". A clan is
 * a row, so it exists as soon as this succeeds and the button goes straight there.
 */
export default function NewClanClient({ apex, signedIn }: { apex: string; signedIn: boolean }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [inGameName, setInGameName] = useState('');
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Suggest the slug from the display name — or the in-game name when no display name is given, since
  // that is now the required field — until they edit the slug themselves, then leave it alone.
  useEffect(() => {
    if (touchedSlug) return;
    setSlug(
      (name || inGameName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32),
    );
  }, [name, inGameName, touchedSlug]);

  useEffect(() => {
    if (!slug) {
      setCheck(null);
      return;
    }
    // Debounced: this fires on every keystroke otherwise, and availability is a database read.
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clans?slug=${encodeURIComponent(slug)}`);
      if (res.ok) setCheck((await res.json()).slug ?? null);
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, inGameName }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      setDone(j.clan?.slug ?? slug);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    // THE PATH, NOT THE SUBDOMAIN. This handed out `${slug}.${apex}`, which still works — middleware
    // 301s it — but it is the old address, and this is the exact moment somebody forms their idea of
    // where their clan lives. Teaching them a URL that only redirects means every link they paste
    // into Discord for the next year costs a round trip and reads as the deprecated shape.
    const home = `/c/${done}`;
    return (
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <h2 className="text-xl font-semibold text-gold">Your clan is live.</h2>
        <p className="mt-2 text-sm text-gray-300">
          Nothing to wait for — it is already serving, at{' '}
          <code className="text-gold">{apex}{home}</code>. You are its owner.
        </p>
        <p className="mt-4 text-sm text-gray-300">
          Four things left: name it in Discord, point it at a channel, make a board, fill it. The
          wizard walks all four and knows which you have done.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {/* ClanLink, not a raw anchor, and it matters here more than almost anywhere: these cross
              from the apex INTO a clan, and ClanLink is what turns a clan change into a real
              navigation instead of a client route that would leave the app holding the apex's
              context while showing a clan's page. */}
          <ClanLink
            href={`${home}/admin/setup`}
            className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            Set it up
          </ClanLink>
          <ClanLink
            href={home}
            className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold transition-colors hover:border-gold"
          >
            Take a look first
          </ClanLink>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <p className="text-sm text-gray-300">
          Sign in with Discord first — a clan needs an owner, and that is how we know who you are.
        </p>
        <a
          href="/login?return=/clans/new"
          className="mt-4 inline-block rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold"
        >
          Sign in with Discord
        </a>
      </div>
    );
  }

  const slugBad = check != null && !check.ok;

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-card-border bg-card-bg p-6">
      <div>
        <label className="mb-1.5 block text-sm text-gray-300">In-game clan name</label>
        <Input
          value={inGameName}
          onChange={(e) => setInGameName(e.target.value)}
          required
          placeholder="The Afk Spot"
          className="rounded-xl px-4 py-2.5 outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Exactly as it appears in OSRS. Roster sync uses it to match your clan and refuses a roster
          from any other — so it&rsquo;s required, and it&rsquo;s what stops someone else&rsquo;s member
          list landing on your site.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-gray-300">
          Clan name <span className="text-gray-600">(optional)</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={inGameName || 'The Afk Spot'}
          className="rounded-xl px-4 py-2.5 outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Shown on your site and in Discord posts. Leave it blank to reuse your in-game clan name.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-gray-300">Address</label>
        <div className="flex items-center gap-1.5">
          {/* THE PATH, NOT A SUBDOMAIN. Clans live at {apex}/c/<slug> now; the old
              <slug>.<apex> form is gone (middleware only 301s it for old plugins). */}
          <span className="whitespace-nowrap text-sm text-gray-500">{apex}/c/</span>
          <Input
            value={slug}
            onChange={(e) => {
              setTouchedSlug(true);
              setSlug(e.target.value.toLowerCase());
            }}
            required
            className={`flex-1 rounded-xl border bg-brown-dark px-4 py-2.5 text-sm outline-none ${
              slugBad ? 'border-red-900 focus:border-red-700' : 'border-card-border focus:border-gold'
            }`}
          />
        </div>
        {check && (
          <p className={`mt-1 text-xs ${check.ok ? 'text-emerald-400' : 'text-red-300'}`}>
            {check.ok ? 'Available.' : check.message}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={busy || slugBad || !inGameName || !slug}
        className="rounded-xl border border-gold/40 px-5 py-2.5 text-sm text-gold disabled:opacity-40"
      >
        {busy ? 'Creating…' : 'Create clan'}
      </button>
    </form>
  );
}
