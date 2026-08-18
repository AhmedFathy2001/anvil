'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';

// The member-facing half of the starting shot (lib/startProof): what to do, where to stand, the
// keyword only this player gets, and the upload. Shown until the shot is accepted.

interface Props {
  eventId: number;
  eventName: string;
  playerId: number;
  rsn: string;
  location: string;
  keyword: string;
  /** The drawn spot's coordinates, when the host pinned it on the map. Null = label only. */
  spot?: { x: number; y: number; radius: number } | null;
  /** Minutes the game session may have been running when the shot is taken. 0 = not asked for. */
  maxSessionMinutes?: number;
  status: 'pending' | 'accepted' | 'rejected' | null;
  reviewNote?: string | null;
  /** True when the plugin can do this for them — hides the manual steps behind a "or do it by hand". */
  pluginHint?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Waiting on staff', cls: 'bg-yellow-500/15 text-yellow-300' },
  accepted: { label: 'Accepted', cls: 'bg-accent-green/15 text-accent-green-light' },
  rejected: { label: 'Rejected — re-take it', cls: 'bg-red-500/15 text-red-400' },
};

export default function StartProofCard(props: Props) {
  const [status, setStatus] = useState(props.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function upload(url: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${props.eventId}/start-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url, playerId: props.playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Upload failed — try again.');
        return;
      }
      setStatus(data.status ?? 'pending');
    } catch {
      setError('Upload failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const badge = status ? STATUS_BADGE[status] : null;
  const done = status === 'pending' || status === 'accepted';

  return (
    <div className="border border-gold/40 rounded-xl bg-card-bg p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-gold">📸 Starting shot</div>
          <div className="text-xs text-text-muted truncate">
            {props.eventName} — {props.rsn}
          </div>
        </div>
        {badge && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
        )}
      </div>

      {status === 'rejected' && props.reviewNote && (
        <p className="text-xs text-red-400 mb-3">Staff note: {props.reviewNote}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="border border-card-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Stand here</div>
          <div className="text-sm font-medium">{props.location}</div>
          {props.spot && (
            <div className="text-[11px] text-text-muted font-mono mt-0.5">
              {props.spot.x}, {props.spot.y} · within {props.spot.radius} squares
            </div>
          )}
        </div>
        <div className="border border-card-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Your keyword</div>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono font-semibold text-gold">{props.keyword}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(props.keyword);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {done ? (
        <p className="text-sm text-text-muted">
          {status === 'accepted'
            ? "You're clear — good luck."
            : 'Shot received. Staff will look at it; you can keep playing in the meantime.'}
        </p>
      ) : (
        <>
          <ol className="text-xs text-text-muted space-y-1 mb-3 list-decimal list-inside">
            {props.pluginHint && (
              <li className="text-gold/90">
                Using the plugin? Press <strong>Take starting shot</strong> in the Anvil panel and you&apos;re done.
              </li>
            )}
            {!!props.maxSessionMinutes && props.maxSessionMinutes > 0 && (
              <li>
                <strong>Log out and back in</strong>, then take the shot within {props.maxSessionMinutes} minutes —
                your hiscores only save when you log out, and that&apos;s what sets your starting totals.
              </li>
            )}
            <li>Go to <strong>{props.location}</strong>.</li>
            <li>Type your keyword in the in-game chatbox (don&apos;t send it — typing is enough).</li>
            <li>Screenshot the game with the keyword and your character visible, then upload it here.</li>
          </ol>
          <ImageUpload onImageSelected={upload} />
          {saving && <p className="text-xs text-text-muted mt-2">Saving…</p>}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </>
      )}
    </div>
  );
}
