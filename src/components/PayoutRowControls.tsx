'use client';

import { useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

export interface PayoutRow {
  id: number;
  status: string;
  proofBlobUrl: string | null;
  paidAt: string | null;
}

interface Props {
  payout: PayoutRow;
  eventId: number;
  viewerRole: string;
  onChanged: () => void;
}

// Per-row payout actions: one-tap Mark paid (+ optional proof screenshot), Unpay, Delete. Mirrors
// SignupFeeControls but for outbound prize money — gated to admin/treasurer.
export default function PayoutRowControls({ payout, eventId, viewerRole, onChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const canPay = viewerRole === 'admin' || viewerRole === 'treasurer';
  const isPaid = payout.status === 'paid';
  const base = `/api/admin/events/${eventId}/payouts/${payout.id}`;

  async function act(url: string, key: string, method = 'POST', body?: unknown) {
    setBusy(key);
    setErr(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error || 'Action failed.');
        return;
      }
      onChanged();
    } catch {
      setErr('Network error.');
    } finally {
      setBusy(null);
    }
  }

  async function markPaid(withProof: boolean) {
    let proofUrl: string | undefined;
    if (withProof) {
      const file = fileRef.current?.files?.[0];
      if (file) {
        setBusy('pay');
        setErr(null);
        try {
          const fd = new FormData();
          fd.append('file', file);
          const up = await clanFetch(`/api/admin/events/${eventId}/payouts/upload`, { method: 'POST', body: fd });
          const upData = await up.json().catch(() => ({}));
          if (!up.ok) {
            setErr(upData.error || 'Upload failed.');
            setBusy(null);
            return;
          }
          proofUrl = upData.url;
        } catch {
          setErr('Upload failed.');
          setBusy(null);
          return;
        }
      }
    }
    setAttaching(false);
    await act(`${base}/pay`, 'pay', 'POST', proofUrl ? { proofUrl } : {});
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {payout.proofBlobUrl && (
          <a
            href={payout.proofBlobUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-gold underline decoration-gold/30 underline-offset-2"
          >
            proof →
          </a>
        )}

        {canPay && !isPaid && (
          <>
            <button
              onClick={() => markPaid(false)}
              disabled={busy !== null}
              className="text-xs font-medium px-3 py-1 rounded border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50"
            >
              {busy === 'pay' ? 'Saving…' : 'Mark paid'}
            </button>
            <button
              onClick={() => setAttaching((v) => !v)}
              disabled={busy !== null}
              className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors disabled:opacity-50"
            >
              {attaching ? 'Cancel proof' : '+ proof'}
            </button>
          </>
        )}

        {canPay && isPaid && (
          <button
            onClick={() => act(`${base}/unpay`, 'unpay')}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            {busy === 'unpay' ? '…' : 'Unpay'}
          </button>
        )}

        {canPay && (
          <button
            onClick={() => {
              if (confirm('Remove this payout row?')) act(base, 'delete', 'DELETE');
            }}
            disabled={busy !== null}
            className="text-xs font-medium px-2 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {busy === 'delete' ? '…' : 'Delete'}
          </button>
        )}
      </div>

      {attaching && (
        <div className="flex items-center gap-2 rounded-lg bg-brown-dark p-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="text-xs text-text-muted file:mr-2 file:rounded file:border-0 file:bg-card-bg file:px-2 file:py-1 file:text-xs file:text-foreground"
          />
          <button
            onClick={() => markPaid(true)}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50 shrink-0"
          >
            {busy === 'pay' ? 'Uploading…' : 'Mark paid + proof'}
          </button>
        </div>
      )}

      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
