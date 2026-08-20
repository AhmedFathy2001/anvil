'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Textarea from '@/components/Textarea';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';

interface FeeRow {
  fee: {
    id: number;
    signupId: number;
    amount: number;
    status: string;
    collectedByUserId: number | null;
    collectedAt: string | null;
    reportedCollectorUserId: number | null;
    reportedAt: string | null;
    proofBlobUrl: string | null;
    confirmedByUserId: number | null;
    confirmedAt: string | null;
    notes: string | null;
  };
  signup: { id: number; status: string; signedUpAt: string };
  event: { id: number; name: string; startDate: string | null };
  player: {
    id: number;
    displayName: string;
    discordUsername: string | null;
  };
  account: { id: number; rsn: string };
  collector: { id: number; displayName: string; role: string } | null;
  reportedCollector: { id: number; displayName: string; role: string } | null;
}

type StatusFilter = 'open' | 'pending' | 'reported' | 'collected' | 'disputed' | 'confirmed' | 'all';

interface Props {
  viewerRole: string;
  viewerId: number;
}

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'reported', label: 'Reported' },
  { key: 'collected', label: 'Collected' },
  { key: 'disputed', label: 'Disputed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'all', label: 'All' },
];

export default function FeesQueueClient({ viewerRole, viewerId }: Props) {
  const isAdmin = viewerRole === 'admin';
  const canCollect = viewerRole === 'admin' || viewerRole === 'treasurer';

  const [filter, setFilter] = useState<StatusFilter>('open');
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    const res = await clanFetch(`/api/admin/fees?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.fees ?? []);
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(feeId: number, action: 'collect' | 'confirm' | 'reset', body?: unknown) {
    setActing(feeId);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/fees/${feeId}/${action}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed: ${action}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.fee.status] = (c[r.fee.status] ?? 0) + 1;
    return c;
  }, [rows]);

  // What THIS viewer can sign off in one go: collected fees someone else took in. Fees they
  // collected themselves are excluded for the same reason the button can't clear them — offering
  // "Confirm all (34)" and then settling none of them would be a lie.
  const confirmableByViewer = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.fee.status === 'collected' &&
          r.fee.collectedByUserId !== null &&
          r.fee.collectedByUserId !== viewerId,
      ).length,
    [rows, viewerId],
  );

  async function confirmAll() {
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await clanFetch('/api/admin/fees/confirm-all', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to confirm');
      const parts: string[] = [];
      if (data.confirmed) parts.push(`${data.confirmed} settled`);
      if (data.recorded) parts.push(`${data.recorded} awaiting more confirmations`);
      // Named explicitly, because "why is it still not zero?" is otherwise a mystery.
      if (data.awaitingOtherAdmin) {
        parts.push(`${data.awaitingOtherAdmin} you collected — another admin must sign those off`);
      }
      setNotice(parts.length ? parts.join(' · ') : 'Nothing to confirm.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gold">Sign-up Fees</h1>
          <p className="text-text-muted text-sm mt-1">
            {canCollect
              ? 'Collect fees, upload proof, and have an admin confirm.'
              : 'Read-only view. Treasurers and admins handle collection.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && confirmableByViewer > 0 && (
            <button
              onClick={confirmAll}
              disabled={bulkBusy}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gold text-brown-dark hover:bg-yellow-500 transition-colors disabled:opacity-50"
            >
              {bulkBusy ? 'Confirming…' : `Confirm all (${confirmableByViewer})`}
            </button>
          )}
          <ClanLink
            href="/admin/dashboard"
            className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Back
          </ClanLink>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              filter === f.key
                ? 'bg-gold/20 text-gold border border-gold/40'
                : 'border border-card-border text-text-muted hover:text-foreground hover:bg-brown-light'
            }`}
          >
            {f.label}
            {filter === f.key && rows.length > 0 && (
              <span className="ml-2 text-[10px] opacity-70">{rows.length}</span>
            )}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-4 text-sm text-green-400 border border-green-500/30 bg-green-500/10 rounded-lg p-3">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-card-border rounded-xl text-text-muted">
          {filter === 'open' ? 'No open fees. Nice.' : 'No fees match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <FeeCard
              key={row.fee.id}
              row={row}
              canCollect={canCollect}
              isAdmin={isAdmin}
              viewerId={viewerId}
              acting={acting === row.fee.id}
              onCollect={(proofUrl, notes) =>
                postAction(row.fee.id, 'collect', { proofUrl, notes })
              }
              onConfirm={() => postAction(row.fee.id, 'confirm')}
              onReset={() => postAction(row.fee.id, 'reset')}
            />
          ))}
        </div>
      )}

      <div className="mt-8 text-xs text-text-muted">
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className="mr-3 capitalize">
            {k}: {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeeCard({
  row,
  canCollect,
  isAdmin,
  viewerId,
  acting,
  onCollect,
  onConfirm,
  onReset,
}: {
  row: FeeRow;
  canCollect: boolean;
  isAdmin: boolean;
  viewerId: number;
  acting: boolean;
  onCollect: (proofUrl: string, notes?: string) => void;
  onConfirm: () => void;
  onReset: () => void;
}) {
  const [collectMode, setCollectMode] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { fee } = row;
  const reportedDifferent =
    fee.reportedCollectorUserId !== null &&
    fee.collectedByUserId !== null &&
    fee.reportedCollectorUserId !== fee.collectedByUserId;

  // Conflict-of-interest gate: an admin can confirm anyone else's collection but not
  // their own. This separation matches what the schema lets through and makes the rule
  // visible to the user (no surprise 401 when they click).
  const adminCanConfirm =
    isAdmin && fee.collectedByUserId !== null && fee.collectedByUserId !== viewerId;

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await clanFetch('/api/admin/fees/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      setProofUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="border border-card-border rounded-xl p-4 bg-card-bg">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{row.player.displayName}</span>
            {row.player.discordUsername && (
              <span className="text-xs text-text-muted">@{row.player.discordUsername}</span>
            )}
            <span className="text-xs text-text-muted">playing {row.account.rsn}</span>
            <FeeStatusBadge status={fee.status} />
            {row.signup.status === 'withdrawn' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-yellow-500/15 text-yellow-300 border-yellow-500/25 capitalize">
                withdrawn
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-1">
            <ClanLink
              href={`/admin/events/${row.event.id}`}
              className="hover:text-gold underline decoration-gold/30 underline-offset-2"
            >
              {row.event.name}
            </ClanLink>
            {' · '}signed up {new Date(row.signup.signedUpAt).toLocaleDateString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gold">{fee.amount.toLocaleString()}</div>
          <div className="text-[11px] text-text-muted">gp</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs">
        <div>
          <div className="text-text-muted uppercase tracking-wide">Player reported paid to</div>
          <div className="mt-1">
            {row.reportedCollector ? (
              <span>
                {row.reportedCollector.displayName}{' '}
                <span className="text-text-muted">({row.reportedCollector.role})</span>
                {fee.reportedAt && (
                  <span className="text-text-muted ml-1">
                    · {new Date(fee.reportedAt).toLocaleDateString()}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-text-muted">No report (optional)</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-text-muted uppercase tracking-wide">Collector claim</div>
          <div className="mt-1">
            {row.collector ? (
              <span>
                {row.collector.displayName}{' '}
                <span className="text-text-muted">({row.collector.role})</span>
                {fee.collectedAt && (
                  <span className="text-text-muted ml-1">
                    · {new Date(fee.collectedAt).toLocaleDateString()}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-text-muted">Not collected yet</span>
            )}
          </div>
        </div>
      </div>

      {reportedDifferent && (
        <div className="mt-3 text-xs rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 p-2">
          Mismatch: player&apos;s report and collector claim disagree.
        </div>
      )}

      {fee.proofBlobUrl && (
        <div className="mt-3">
          <a
            href={fee.proofBlobUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-gold underline decoration-gold/30 underline-offset-2"
          >
            View proof screenshot →
          </a>
        </div>
      )}

      {fee.notes && (
        <p className="mt-3 text-xs text-text-muted whitespace-pre-wrap">
          <span className="uppercase tracking-wide">Notes:</span> {fee.notes}
        </p>
      )}

      {fee.confirmedAt && (
        <div className="mt-3 text-xs text-accent-green-light">
          Confirmed {new Date(fee.confirmedAt).toLocaleString()}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-card-border flex flex-wrap gap-2">
        {canCollect && fee.status !== 'confirmed' && row.signup.status !== 'withdrawn' && !collectMode && (
          <button
            onClick={() => setCollectMode(true)}
            disabled={acting}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
          >
            {fee.collectedByUserId ? 'Re-collect / replace proof' : 'I collected this'}
          </button>
        )}

        {isAdmin && fee.status !== 'confirmed' && fee.collectedByUserId !== null && (
          adminCanConfirm ? (
            <button
              onClick={onConfirm}
              disabled={acting}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            >
              {acting ? 'Confirming…' : 'Confirm + delete proof'}
            </button>
          ) : (
            <span
              className="text-xs text-text-muted px-3 py-1.5"
              title="You collected this fee — another admin must confirm to keep separation of duties."
            >
              Awaiting another admin&apos;s confirmation
            </span>
          )
        )}

        {isAdmin && (fee.collectedByUserId !== null || fee.status === 'confirmed') && (
          <button
            onClick={() => {
              if (
                confirm(
                  fee.status === 'confirmed'
                    ? 'Reset this confirmed fee back to open? (Keeps player report.)'
                    : 'Reset collection state? Player report stays.',
                )
              ) {
                onReset();
              }
            }}
            disabled={acting}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>

      {/* Collect form */}
      {collectMode && (
        <div className="mt-4 pt-4 border-t border-card-border space-y-3">
          <div className="text-xs text-text-muted">
            Upload a screenshot of the in-game payment as proof. The image is auto-deleted
            once an admin confirms the collection.
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-xs"
          />
          {uploading && <div className="text-xs text-text-muted">Uploading…</div>}
          {uploadError && <div className="text-xs text-red-400">{uploadError}</div>}
          {proofUrl && (
            <div>
              <a
                href={proofUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-gold underline decoration-gold/30 underline-offset-2"
              >
                Preview uploaded proof →
              </a>
            </div>
          )}

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes (e.g. paid in chunks, late by 30m)…"
            rows={2}
            className="w-full px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-xs focus:outline-none focus:border-gold/60"
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!proofUrl) return;
                onCollect(proofUrl, notes.trim() || undefined);
                setCollectMode(false);
                setProofUrl(null);
                setNotes('');
              }}
              disabled={!proofUrl || acting || uploading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              {acting ? 'Saving…' : 'Confirm collection'}
            </button>
            <button
              onClick={() => {
                setCollectMode(false);
                setProofUrl(null);
                setNotes('');
                setUploadError(null);
              }}
              disabled={acting || uploading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-text-muted/15 text-text-muted border-text-muted/25',
    reported: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    collected: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
    confirmed: 'bg-accent-green/15 text-accent-green-light border-accent-green/25',
    disputed: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${map[status] ?? map.pending}`}
    >
      {status}
    </span>
  );
}
