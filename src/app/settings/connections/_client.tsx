'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import KickLinkCode from '@/components/KickLinkCode';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import { clanFetch } from '@/lib/clanFetch';
import { BTN } from '../_client';

const MEDAL_URL = '/api/profile/connected-accounts/medal';

/** "Get Kick code" from settings: the code goes in the official Anvil Kick channel's chat. */
export function KickLinker() {
  const router = useRouter();
  return (
    <KickLinkCode
      slug={null}
      codeUrl="/api/profile/connected-accounts/kick-code"
      doneText="It’s on your settings now."
      onLinked={() => router.refresh()}
    />
  );
}

async function post(body: Record<string, unknown>): Promise<string | null> {
  const res = await clanFetch(MEDAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return null;
  const j = (await res?.json().catch(() => null)) as { error?: string } | null;
  return j?.error || 'That didn’t work.';
}

/** Add or change the Medal profile (a plain link, like a social handle). */
export function MedalProfileForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? '');
  // The profile as last saved; the field is dirty while it differs.
  const [saved, setSaved] = useState(current ?? '');
  const dirty = value.trim() !== saved.trim();
  useUnsavedChanges(dirty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await post({ action: 'set', profile: value.trim() });
    setBusy(false);
    if (err) setError(err);
    else {
      setSaved(value.trim());
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="flex w-full flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        placeholder="medal.tv/users/12345678"
        aria-label="Your Medal profile link"
        className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-dark px-3 py-1.5 text-[13px] focus:border-gold/50 focus:outline-none"
      />
      <button type="submit" disabled={busy || !value.trim()} className={BTN}>
        {busy ? '…' : current ? 'Change' : 'Add'}
      </button>
      <UnsavedIndicator dirty={dirty} />
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </form>
  );
}
