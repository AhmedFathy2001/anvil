'use client';

import { useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';

/** The join card's YouTube facts (lib/gates/youtubeDb youtubeJoinInfo), sent with GET /enter. */
export interface YoutubeGateInfo {
  available: boolean;
  checked: string | null;
  chatCode: string | null;
  linked: string | null;
  usesSub: boolean;
  usesMember: boolean;
}

const BACK: Record<string, { ok: boolean; text: string }> = {
  subscribed: { ok: true, text: 'Subscription confirmed. Press Join.' },
  linked: { ok: true, text: 'YouTube account linked. Now type your code in the live chat.' },
  taken: { ok: false, text: 'That YouTube account is already linked to another Anvil login.' },
  notsub: { ok: false, text: 'That YouTube channel isn’t subscribed to the host. Subscribe, then check again.' },
  private: { ok: false, text: 'YouTube wouldn’t show your subscriptions. Make them public in YouTube’s privacy settings, then check again.' },
  nochannel: { ok: false, text: 'That Google account has no YouTube channel. Pick the account you watch with.' },
  scopes: { ok: false, text: 'Google didn’t give Anvil the permission it asked for. Try again and press Allow.' },
  denied: { ok: false, text: 'YouTube check cancelled.' },
  error: { ok: false, text: 'Couldn’t check YouTube. Try again.' },
};

/**
 * The YouTube half of a creator event's join card: "Check my subscription" (a Google sign-in that
 * reads one thing and is revoked) and, for a members gate, the viewer's chat code with a Check
 * button. Renders nothing for events without a YouTube rule.
 */
export default function YoutubeGate({
  eventId,
  info,
  fail,
}: {
  eventId: number;
  info: YoutubeGateInfo | null | undefined;
  /** What the last refused Join asked for, if anything. */
  fail?: { verify?: boolean; chatCode?: boolean } | null;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const back = new URLSearchParams(window.location.search).get('youtube');
    if (!back || !BACK[back]) return;
    setNote(BACK[back]);
    const u = new URL(window.location.href);
    u.searchParams.delete('youtube');
    window.history.replaceState(null, '', u.toString());
  }, []);

  if (!info?.available || (!info.usesSub && !info.usesMember)) return note ? <Note note={note} /> : null;

  function verify() {
    window.location.assign(
      `/api/auth/youtube/start?as=viewer&event=${eventId}&return=${encodeURIComponent(window.location.pathname)}`,
    );
  }

  async function checkChat() {
    setBusy(true);
    setNote(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/gate/youtube-chat`, { method: 'POST' });
      const d = await res.json().catch(() => null);
      setNote({ ok: !!d?.ok, text: d?.message ?? d?.error ?? 'Couldn’t check. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const showVerify = info.usesSub && (fail?.verify || !info.checked);
  const wantsCode = info.usesMember && !!info.chatCode && (fail?.chatCode || !info.usesSub);
  // The code only counts typed from the linked account, so linking comes first.
  const showLink = wantsCode && !info.linked && !showVerify;
  const showCode = wantsCode && !!info.linked;

  return (
    <div className="w-full space-y-2 text-sm">
      {(info.linked || info.checked) && (
        <div className="text-[12.5px] text-text-dim">Your YouTube: {info.linked ?? info.checked}</div>
      )}
      {showLink && (
        <button
          type="button"
          onClick={verify}
          className="rounded-xl border border-gold/40 px-4 py-2 text-gold transition-colors hover:border-gold"
        >
          Link my YouTube account (for the members check)
        </button>
      )}
      {showVerify && (
        <button
          type="button"
          onClick={verify}
          className="rounded-xl border border-gold/40 px-4 py-2 text-gold transition-colors hover:border-gold"
        >
          {info.checked ? 'Check my YouTube subscription again' : 'Check my YouTube subscription'}
        </button>
      )}
      {showCode && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted">Members: while the host is live, from {info.linked} type</span>
          <code className="rounded bg-brown-dark px-2 py-0.5 font-semibold text-gold">{info.chatCode}</code>
          <span className="text-text-muted">in the YouTube chat, then</span>
          <button
            type="button"
            onClick={checkChat}
            disabled={busy}
            className="rounded-xl border border-gold/40 px-3 py-1.5 text-gold transition-colors hover:border-gold disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'check the chat'}
          </button>
        </div>
      )}
      {note && <Note note={note} />}
    </div>
  );
}

function Note({ note }: { note: { ok: boolean; text: string } }) {
  return <p className={`w-full text-[12.5px] ${note.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{note.text}</p>;
}
