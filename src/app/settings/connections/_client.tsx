'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import KickLinkCode from '@/components/KickLinkCode';
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

/** Add or change the Medal profile (saved unverified). */
export function MedalProfileForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await post({ action: 'set', profile: value.trim() });
    setBusy(false);
    if (err) setError(err);
    else router.refresh();
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
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </form>
  );
}

/** Verify a Medal link: their code in a clip title, read back through Medal's API. */
export function MedalVerify({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function verify() {
    setBusy(true);
    setError('');
    const err = await post({ action: 'verify' });
    setBusy(false);
    if (err) setError(err);
    else router.refresh();
  }

  return (
    <div className="w-full rounded-lg border border-gold/30 bg-brown-dark p-3 text-[13px]">
      <p className="text-text-muted">
        To verify, put this code in the title of one of your public Medal clips (rename any recent one), then press Verify. You can
        rename it back afterwards.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-md border border-gold/40 px-3 py-1 text-base font-semibold tracking-wider text-gold">{code}</code>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => {})}
          className="text-[12.5px] text-text-muted underline-offset-4 hover:text-gold hover:underline"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={verify} disabled={busy} className={`${BTN} ml-auto`}>
          {busy ? 'Checking…' : 'Verify'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
