'use client';

import { useRef, useState } from 'react';

export interface SignupFee {
  id: number;
  amount: number;
  status: string;
  collectedByUserId: number | null;
  reportedCollectorUserId: number | null;
  proofBlobUrl: string | null;
  confirmedAt: string | null;
  confirmationsCount: number;
  notes: string | null;
}

interface Props {
  fee: SignupFee;
  viewerRole: string;
  viewerId: number;
  confirmationsRequired: number;
  onChanged: () => void;
}

// Friendly buckets over the raw fee statuses. Non-technical staff think "has it been
// paid?", not "pending vs reported vs collected".
function bucket(status: string): { label: string; cls: string } {
  switch (status) {
    case 'collected':
      return { label: 'Paid', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25' };
    case 'confirmed':
      return { label: 'Confirmed', cls: 'bg-accent-green/15 text-accent-green-light border-accent-green/25' };
    case 'disputed':
      return { label: 'Disputed', cls: 'bg-red-500/15 text-red-400 border-red-500/25' };
    default:
      return { label: 'Unpaid', cls: 'bg-text-muted/15 text-text-muted border-text-muted/25' };
  }
}

// Inline fee collection on a signup row. Replaces the old standalone /admin/fees queue:
// one-tap Mark paid (+ optional proof), a Confirm vote that tallies toward the required
// count, Dispute, and an admin Reset.
export default function SignupFeeControls({ fee, viewerRole, viewerId, confirmationsRequired, onChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const canCollect = viewerRole === 'admin' || viewerRole === 'treasurer';
  const canConfirm = viewerRole === 'admin';
  const canDispute = ['admin', 'treasurer', 'moderator', 'editor'].includes(viewerRole);
  const canReset = viewerRole === 'admin';

  const b = bucket(fee.status);
  const isPaid = fee.status === 'collected';
  const isConfirmed = fee.status === 'confirmed';
  const isDisputed = fee.status === 'disputed';
  const collectedByViewer = fee.collectedByUserId === viewerId;
  const confirmsLeft = Math.max(0, confirmationsRequired - fee.confirmationsCount);

  async function act(url: string, key: string, body?: unknown) {
    setBusy(key);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setBusy('collect');
        setErr(null);
        try {
          const fd = new FormData();
          fd.append('file', file);
          const up = await fetch('/api/admin/fees/upload', { method: 'POST', body: fd });
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
    await act(`/api/admin/fees/${fee.id}/collect`, 'collect', proofUrl ? { proofUrl } : {});
  }

  return (
    <div className="border-t border-card-border pt-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-text-muted uppercase tracking-wide">Fee</span>
        <span className="font-medium">{fee.amount.toLocaleString()} gp</span>
        <span className={`px-1.5 py-0.5 rounded-full border font-medium ${b.cls}`}>{b.label}</span>
        {isPaid && confirmationsRequired > 1 && (
          <span className="text-text-muted">
            {fee.confirmationsCount}/{confirmationsRequired} confirmations
          </span>
        )}
        {isConfirmed && fee.confirmedAt && (
          <span className="text-text-muted">on {new Date(fee.confirmedAt).toLocaleDateString()}</span>
        )}
        {fee.proofBlobUrl && (
          <a
            href={fee.proofBlobUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-gold underline decoration-gold/30 underline-offset-2"
          >
            proof →
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Mark paid — for unpaid or disputed fees */}
        {canCollect && !isConfirmed && (
          <>
            <button
              onClick={() => markPaid(false)}
              disabled={busy !== null}
              className="text-xs font-medium px-3 py-1 rounded border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50"
            >
              {busy === 'collect' ? 'Saving…' : isPaid ? 'Re-mark paid' : 'Mark paid'}
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

        {/* Confirm vote */}
        {canConfirm && isPaid && (
          collectedByViewer ? (
            <span className="text-xs text-text-muted px-2 py-1">You collected this — needs another admin</span>
          ) : (
            <button
              onClick={() => act(`/api/admin/fees/${fee.id}/confirm`, 'confirm')}
              disabled={busy !== null}
              className="text-xs font-medium px-3 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
            >
              {busy === 'confirm'
                ? '…'
                : confirmsLeft > 1
                  ? `Confirm (${fee.confirmationsCount}/${confirmationsRequired})`
                  : 'Confirm'}
            </button>
          )
        )}

        {/* Dispute */}
        {canDispute && !isConfirmed && !isDisputed && (
          <button
            onClick={() => act(`/api/admin/fees/${fee.id}/dispute`, 'dispute')}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {busy === 'dispute' ? '…' : 'Dispute'}
          </button>
        )}

        {/* Reset — admin escape hatch */}
        {canReset && (isPaid || isConfirmed || isDisputed) && (
          <button
            onClick={() => {
              if (confirm('Reset this fee back to unpaid? Any proof and confirmations are cleared.')) {
                act(`/api/admin/fees/${fee.id}/reset`, 'reset');
              }
            }}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>

      {attaching && (
        <div className="flex items-center gap-2 rounded-lg bg-brown-dark p-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="min-w-0 flex-1 text-xs text-text-muted file:mr-2 file:rounded file:border-0 file:bg-card-bg file:px-2 file:py-1 file:text-xs file:text-foreground"
          />
          <button
            onClick={() => markPaid(true)}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50 shrink-0"
          >
            {busy === 'collect' ? 'Uploading…' : 'Mark paid + proof'}
          </button>
        </div>
      )}

      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
