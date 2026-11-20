'use client';

import { useState } from 'react';

import DialogFrame from '@/components/DialogFrame';
import Textarea from '@/components/Textarea';
import { clanFetch } from '@/lib/clanFetch';
import { ownerMessageDraft, STAFF_MESSAGE_MAX } from '@/lib/staffMessageText';

/**
 * "Message owner": a draft Discord DM to a clan's owner that staff edit and send (lib/staffMessage).
 * The draft starts from why the clan is on the list; nothing is sent until Send is pressed.
 */
export default function MessageOwnerButton({
  clanId,
  clanName,
  why,
  welcome = false,
  className = '',
}: {
  clanId: number;
  clanName: string;
  /** The reason the clan is being looked at, to open the draft with. */
  why: string | null;
  /** A hello to a clan that has just been made, in place of the note about a problem. */
  welcome?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const first = ownerMessageDraft(clanName, why, welcome);
  const [text, setText] = useState(first);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | 'discord' | 'email'>(null);

  async function send(close: () => void, via: 'discord' | 'email') {
    setBusy(true);
    setError(null);
    const res = await clanFetch(`/api/staff/clans/${clanId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, via }),
    });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not send that.');
    setSent(via);
    setOpen(false);
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setText(first);
          setError(null);
          setOpen(true);
        }}
        className={`min-h-10 whitespace-nowrap rounded-lg border border-card-border px-3 text-sm text-gray-200 transition-colors hover:border-gold/50 hover:text-gold ${className}`}
      >
        {sent ? `Sent by ${sent === 'email' ? 'email' : 'Discord'} · again` : welcome ? 'Say hello' : 'Message owner'}
      </button>
      {open && (
        <DialogFrame
          dirty={text !== first}
          onClose={() => setOpen(false)}
          ariaLabel={`Message the owner of ${clanName}`}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          panelClassName="w-full max-w-lg rounded-2xl border border-card-border bg-card-bg p-5"
        >
          {(close) => (
            <>
              <h2 className="text-lg font-bold">Message the owner of {clanName}</h2>
              <p className="mt-1 text-sm text-text-muted">Send it as a Discord DM from the Anvil bot, or by email when their DMs are closed. A DM reply comes back to the bot&rsquo;s DMs, so say where to reach you if you want an answer elsewhere.</p>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                maxLength={STAFF_MESSAGE_MAX}
                aria-label="Message"
                className="mt-3 w-full"
              />
              <div className="mt-1 text-right text-xs tabular-nums text-text-muted">
                {text.length.toLocaleString()} of {STAFF_MESSAGE_MAX.toLocaleString()}
              </div>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={close} className="min-h-10 rounded-lg border border-card-border px-4 text-sm text-gray-200">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  onClick={() => void send(close, 'email')}
                  className="min-h-10 rounded-lg border border-card-border px-4 text-sm text-gray-200 hover:border-gold/50 hover:text-gold disabled:opacity-50"
                >
                  Send by email
                </button>
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  onClick={() => void send(close, 'discord')}
                  className="min-h-10 rounded-lg bg-gold px-4 text-sm font-bold text-brown-dark hover:bg-gold-light disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Send on Discord'}
                </button>
              </div>
            </>
          )}
        </DialogFrame>
      )}
    </>
  );
}
