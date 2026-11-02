'use client';

import { useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { atLeast } from '@/lib/clanRoles';
import { useDialog } from '@/components/Confirm';

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
  /** Priced by hand (an invite discount, a comp) — fee changes on the board leave it alone. */
  customAmount?: boolean;
}

interface Props {
  fee: SignupFee;
  viewerRole: string;
  viewerId: number;
  confirmationsRequired: number;
  onChanged: () => void;
  /** Where this fee's moves go — a board fee's by default; a clan event's lives under its own route. */
  apiBase?: string;
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
    // Written off when the board closed: never paid, nobody chasing it. Deliberately quiet —
    // it's a settled fact, not something to act on.
    case 'closed':
      return { label: 'Closed', cls: 'bg-text-muted/10 text-text-muted border-card-border' };
    default:
      return { label: 'Unpaid', cls: 'bg-text-muted/15 text-text-muted border-text-muted/25' };
  }
}

// Inline fee collection on a signup row. Replaces the old standalone /admin/fees queue:
// one-tap Mark paid (+ optional proof), a Confirm vote that tallies toward the required
// count, Dispute, and an admin Reset.
export default function SignupFeeControls({ fee, viewerRole, viewerId, confirmationsRequired, onChanged, apiBase = '/api/admin/fees' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm } = useDialog();
  const [err, setErr] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  // Pricing this one entry by hand. Only board fees have the route for it.
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState(String(fee.amount));

  // atLeast, not equality: an owner outranks admin, and `=== 'admin'` left them unable to settle.
  const isAdmin = atLeast(viewerRole, 'admin');
  const canCollect = isAdmin || viewerRole === 'treasurer';
  const canConfirm = isAdmin;
  const canDispute = isAdmin || ['treasurer', 'moderator', 'editor'].includes(viewerRole);
  const canReset = isAdmin;
  const canPrice = isAdmin && apiBase === '/api/admin/fees';

  const b = bucket(fee.status);
  const isPaid = fee.status === 'collected';
  const isConfirmed = fee.status === 'confirmed';
  const isDisputed = fee.status === 'disputed';
  // A written-off fee has no live actions — only an admin Reset, for the one that was closed by
  // mistake or paid late.
  const isClosed = fee.status === 'closed';
  const collectedByViewer = fee.collectedByUserId === viewerId;
  const confirmsLeft = Math.max(0, confirmationsRequired - fee.confirmationsCount);
  // A clan that requires no second signature has nobody for the collector to be separate from, so
  // "you collected this — needs another admin" would be a dead end rather than a control.
  const needsSecondSignature = confirmationsRequired > 0;

  async function act(url: string, key: string, body?: unknown): Promise<boolean> {
    setBusy(key);
    setErr(null);
    try {
      const res = await clanFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error || 'Action failed.');
        return false;
      }
      onChanged();
      return true;
    } catch {
      setErr('Network error.');
      return false;
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
          const up = await clanFetch('/api/admin/fees/upload', { method: 'POST', body: fd });
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
    await act(`${apiBase}/${fee.id}/collect`, 'collect', proofUrl ? { proofUrl } : {});
  }

  return (
    <div className="border-t border-card-border pt-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-text-muted uppercase tracking-wide">Fee</span>
        <span className="font-medium">{fee.amount.toLocaleString()} gp</span>
        {fee.customAmount && (
          <span className="text-text-muted" title="Set by hand for this player; board fee changes leave it alone">
            (custom)
          </span>
        )}
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
        {canCollect && !isConfirmed && !isClosed && (
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
        {canConfirm && isPaid && !isClosed && !(collectedByViewer && needsSecondSignature) && (
          <button
            onClick={() => act(`${apiBase}/${fee.id}/confirm`, 'confirm')}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
          >
            {busy === 'confirm'
              ? '…'
              : confirmsLeft > 1
                ? `Confirm (${fee.confirmationsCount}/${confirmationsRequired})`
                : needsSecondSignature
                  ? 'Confirm'
                  : 'Settle'}
          </button>
        )}

        {/* Settle anyway — the override for a signature that is never coming.
            A one-admin clan collects its own fees, so the separation-of-duties rule leaves those
            fees open forever with nothing but a sentence explaining why. This closes one outright,
            and the audit line records that it was settled without a second signature. */}
        {canConfirm && isPaid && !isClosed && needsSecondSignature && (collectedByViewer || confirmsLeft > 0) && (
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Settle this fee now?',
                body: collectedByViewer
                  ? 'You collected it yourself, so nobody else is signing it off — the second pair of eyes is skipped.'
                  : `The remaining ${confirmsLeft} confirmation${confirmsLeft === 1 ? '' : 's'} ${confirmsLeft === 1 ? 'is' : 'are'} skipped.`,
                confirmLabel: 'Settle it',
              });
              if (ok) {
                act(`${apiBase}/${fee.id}/confirm`, 'force', { force: true });
              }
            }}
            disabled={busy !== null}
            title="Skip the confirmation rule for this one fee"
            className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-50"
          >
            {busy === 'force' ? '…' : 'Settle anyway'}
          </button>
        )}

        {/* Dispute */}
        {canDispute && !isConfirmed && !isDisputed && !isClosed && (
          <button
            onClick={() => act(`${apiBase}/${fee.id}/dispute`, 'dispute')}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {busy === 'dispute' ? '…' : 'Dispute'}
          </button>
        )}

        {/* Reset — admin escape hatch */}
        {canReset && (isPaid || isConfirmed || isDisputed || isClosed) && (
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Reset this fee back to unpaid?',
                body: 'The uploaded proof and any confirmations are cleared, and the player owes it again.',
                confirmLabel: 'Reset',
              });
              if (ok) act(`${apiBase}/${fee.id}/reset`, 'reset');
            }}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>

      {canPrice && !isClosed && !editingAmount && (
        <button
          onClick={() => {
            setAmountInput(String(fee.amount));
            setEditingAmount(true);
          }}
          className="text-xs text-text-muted underline decoration-card-border underline-offset-2 hover:text-gold"
        >
          Change this player&apos;s fee
        </button>
      )}

      {editingAmount && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brown-dark p-2">
          <input
            type="number"
            min={0}
            step={100000}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            aria-label="Fee for this player in gp"
            className="w-36 px-2 py-1 rounded bg-card-bg border border-card-border text-xs focus:outline-none focus:border-gold/60"
          />
          <span className="text-xs text-text-muted">gp</span>
          <button
            onClick={async () => {
              const n = Number(amountInput);
              if (amountInput.trim() === '' || !Number.isInteger(n) || n < 0) {
                setErr('Enter a whole number of gp.');
                return;
              }
              if (await act(`${apiBase}/${fee.id}/amount`, 'amount', { amount: n })) setEditingAmount(false);
            }}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
          >
            {busy === 'amount' ? 'Saving…' : 'Save'}
          </button>
          {fee.customAmount && (
            <button
              onClick={async () => {
                if (await act(`${apiBase}/${fee.id}/amount`, 'standard', { amount: null })) setEditingAmount(false);
              }}
              disabled={busy !== null}
              title="Back to the member or guest fee, and back under board fee changes"
              className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {busy === 'standard' ? '…' : 'Use standard fee'}
            </button>
          )}
          <button
            onClick={() => setEditingAmount(false)}
            disabled={busy !== null}
            className="text-xs text-text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

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
