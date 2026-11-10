'use client';

import { useState } from 'react';

import Input from '@/components/Input';

/** Name a character, confirm who it reaches, then go to the one-time checkout. */
export default function GiftForm({ initial }: { initial: string }) {
  const [rsn, setRsn] = useState(initial);
  const [found, setFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(go: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/supporter/gift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsn, go }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { name?: string; url?: string; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.name) {
      setFound(null);
      setError(data?.error ?? 'Could not check that name.');
      return;
    }
    setFound(data.name);
    if (go && data.url) window.location.href = data.url;
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void ask(!!found);
      }}
    >
      <label htmlFor="gift-rsn" className="text-sm font-medium">
        Their in-game name
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="gift-rsn"
          value={rsn}
          maxLength={12}
          autoComplete="off"
          placeholder="e.g. Zezima"
          className="min-w-[12rem] flex-1"
          onChange={(e) => {
            setRsn(e.target.value);
            setFound(null);
          }}
        />
        <button
          type="submit"
          disabled={busy || rsn.trim().length === 0}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {found ? `Gift to ${found}` : 'Find them'}
        </button>
      </div>
      {found && (
        <p className="text-[13px] text-text-muted">
          Next you pick a tier and length on Gumroad. You pay once; it never renews, and it lands on {found}&rsquo;s account
          straight away.
        </p>
      )}
      {error && <p className="text-[13px] text-red-400">{error}</p>}
    </form>
  );
}
