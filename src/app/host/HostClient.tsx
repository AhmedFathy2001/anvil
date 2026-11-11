'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';
import { suggestSlug } from '@/lib/creatorSpaces';

/**
 * The "Host an event" form. Pressing create makes the space and goes straight to its event wizard —
 * there is no setup screen in between, because a creator space has nothing to set up first.
 */
export default function HostClient({
  apex,
  signedIn,
  plan = null,
  billing = 'monthly',
  defaultName,
  defaultSlug,
}: {
  apex: string;
  signedIn: boolean;
  /** A paid creator tier picked on /pricing: after creating, go to the space's plan card, not the wizard. */
  plan?: string | null;
  billing?: 'monthly' | 'yearly';
  defaultName: string;
  defaultSlug: string;
}) {
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(defaultSlug);
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [editSlug, setEditSlug] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The address follows the name until they edit it themselves.
  useEffect(() => {
    if (!touchedSlug) setSlug(suggestSlug(name));
  }, [name, touchedSlug]);

  useEffect(() => {
    if (!slug) {
      setCheck(null);
      return;
    }
    const t = setTimeout(async () => {
      // Apex-only availability check, shared with the create-a-clan form.
      const res = await fetch(`/api/clans?kind=creator&slug=${encodeURIComponent(slug)}`);
      if (res.ok) setCheck((await res.json()).slug ?? null);
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      // A full navigation, not a client route: this crosses from the apex into the new space.
      const made = j.slug ?? slug;
      window.location.assign(
        plan
          ? `/s/${made}/admin/dashboard${billing === 'yearly' ? '?billing=yearly' : ''}#plan`
          : (j.next ?? `/s/${made}/admin/events/first`),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    const q = new URLSearchParams();
    if (plan) q.set('plan', plan);
    if (plan && billing === 'yearly') q.set('billing', 'yearly');
    const returnTo = `/host${q.size ? `?${q}` : ''}`;
    return (
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <p className="text-base text-text-muted">Sign in with Discord to make your space.</p>
        <a
          // eslint-disable-next-line clan-scope/clan-prefix -- platform: /host and /login are apex pages
          href={`/login?return=${encodeURIComponent(returnTo)}`}
          className="mt-4 block w-full rounded-xl bg-gold px-6 py-4 text-center text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light"
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
        <label htmlFor="host-name" className="mb-1.5 block text-base font-medium">
          What should we call your space?
        </label>
        <Input
          id="host-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={64}
          placeholder="Your channel name"
          className="rounded-xl px-4 py-3 text-base outline-none"
        />
        {/* The link follows the name; changing it is tucked away. */}
        <div className="mt-2 text-[13px] text-text-muted">
          {editSlug ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-text-dim">{apex}/c/</span>
              <Input
                id="host-slug"
                aria-label="Your link"
                value={slug}
                onChange={(e) => {
                  setTouchedSlug(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                className={`min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm outline-none ${slugBad ? 'border-red-900' : ''}`}
              />
            </div>
          ) : (
            <>
              Your link: <span className="text-foreground">{apex}/c/{slug || '…'}</span>{' '}
              <button type="button" onClick={() => setEditSlug(true)} className="text-gold hover:text-gold-light">
                change link
              </button>
            </>
          )}
          {slugBad && (
            <p className="mt-1 text-accent-red">
              {check?.message}{' '}
              {!editSlug && (
                <button type="button" onClick={() => setEditSlug(true)} className="underline">
                  Pick another link
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      {/* No typed channel links: a space links only to channels it connects (and so proves) from its
          settings once it exists (lib/creatorSpaces verifiedStreamLinks). */}
      <p className="text-[13px] text-text-muted">
        You can connect your Twitch, YouTube or Kick channel from your space&apos;s settings afterwards. It shows on your
        page as verified.
      </p>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      <button
        type="submit"
        disabled={busy || !name.trim() || !slug || slugBad}
        className="w-full rounded-xl bg-gold px-6 py-4 text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create my space'}
      </button>
    </form>
  );
}
