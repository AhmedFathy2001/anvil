'use client';

import { useEffect, useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

type Status =
  | { state: 'idle' }
  | { state: 'pending'; code: string; expiresAt: string; channel?: string | null }
  | { state: 'linked'; username: string }
  | { state: 'taken' }
  | { state: 'expired' }
  | { state: 'error'; text: string };

/**
 * "Get Kick code" for a Kick-gated creator event (lib/gates/kick). Kick has no way to ask "is this
 * person a follower/sub", so the viewer types a one-time code in the host's Kick chat: that proves
 * who they are on Kick (and, with a sub badge, that they are subscribed). Polls until the webhook
 * has seen the code, then tells them to press Join again.
 */
export default function KickLinkCode({
  slug,
  compact = false,
  codeUrl = '/api/auth/kick/code',
  doneText = 'Press Join again.',
  onLinked,
}: {
  slug: string | null;
  compact?: boolean;
  /** Settings' Connected accounts issue codes from their own route, which names where to type it. */
  codeUrl?: string;
  doneText?: string;
  onLinked?: () => void;
}) {
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function getCode() {
    setBusy(true);
    setCopied(false);
    try {
      const res = await clanFetch(codeUrl, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.code !== 'string') {
        setStatus({ state: 'error', text: d.error || 'Couldn’t get a code. Try again.' });
        return;
      }
      setStatus({ state: 'pending', code: d.code, expiresAt: d.expiresAt, ...('channel' in d ? { channel: d.channel ?? null } : {}) });
      poll(d.code);
    } finally {
      setBusy(false);
    }
  }

  function poll(code: string) {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const res = await clanFetch(`/api/auth/kick/code?code=${encodeURIComponent(code)}`).catch(() => null);
      const d = res?.ok ? await res.json().catch(() => null) : null;
      if (!d || d.state === 'pending') return;
      if (timer.current) clearInterval(timer.current);
      if (d.state === 'linked') {
        setStatus({ state: 'linked', username: String(d.username ?? '') });
        onLinked?.();
      }
      else if (d.state === 'taken') setStatus({ state: 'taken' });
      else setStatus({ state: 'expired' });
    }, 3000);
  }

  // A settings code names its channel (the official Anvil one), or null: any connected streamer's chat.
  const channel = status.state === 'pending' && status.channel !== undefined ? status.channel : slug;
  const where = channel
    ? `${channel}’s Kick chat (kick.com/${channel})`
    : status.state === 'pending' && status.channel === null
      ? 'the Kick chat of any streamer who has connected Anvil'
      : 'the host’s Kick chat';

  if (status.state === 'pending') {
    return (
      <div className="w-full rounded-lg border border-gold/30 bg-brown-dark p-3 text-sm">
        <div>
          Type this in {where}:
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-gold/40 px-3 py-1.5 text-lg font-semibold tracking-wider text-gold">{status.code}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(status.code).then(() => setCopied(true), () => {});
            }}
            className="text-[12.5px] text-text-muted underline-offset-4 hover:text-gold hover:underline"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="mt-1 text-[12.5px] text-text-muted">Waiting for it to show up in chat… The code works once and expires in 10 minutes.</div>
      </div>
    );
  }

  const note =
    status.state === 'linked'
      ? { ok: true, text: `Kick linked${status.username ? ` as ${status.username}` : ''}. ${doneText}` }
      : status.state === 'taken'
        ? { ok: false, text: 'That Kick account is already linked to another Anvil login.' }
        : status.state === 'expired'
          ? { ok: false, text: 'That code expired. Get a new one.' }
          : status.state === 'error'
            ? { ok: false, text: status.text }
            : null;

  return (
    <div className={compact ? '' : 'w-full'}>
      {status.state !== 'linked' && (
        <button
          type="button"
          onClick={getCode}
          disabled={busy}
          className="rounded-xl border border-gold/40 px-4 py-2 text-sm text-gold transition-colors hover:border-gold disabled:opacity-50"
        >
          {busy ? 'Getting a code…' : 'Get Kick code'}
        </button>
      )}
      {note && <p className={`mt-1 text-[12.5px] ${note.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{note.text}</p>}
    </div>
  );
}
