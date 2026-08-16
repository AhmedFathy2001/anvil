'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/Select';
import Textarea from '@/components/Textarea';
import Checkbox from '@/components/Checkbox';
import { parseEventRules, DEFAULT_START_PROOF, type StartProofMissing } from '@/lib/eventRules';

/**
 * Starting-shot control on the event Overview tab (lib/startProof).
 *
 * Two jobs in one panel: turn the rule on before the event (and choose how hard the belt is), then
 * — once the event goes live and the location is drawn — work the roster: who has filed a shot, who
 * hasn't, and accept/reject the ones that came in by hand. Plugin captures with a verified keyword
 * arrive already accepted, so in practice this list is the phone players and the stragglers.
 */

interface ProofRow {
  playerId: number;
  rsn: string;
  teamId: number | null;
  teamName: string | null;
  teamColor: string | null;
  expectedKeyword: string | null;
  proof: {
    id: number;
    imageUrl: string;
    source: string;
    keyword: string | null;
    keywordOk: boolean;
    capturedAt: string | null;
    status: 'pending' | 'accepted' | 'rejected';
    reviewNote: string | null;
    createdAt: string;
  } | null;
}

interface PanelData {
  required: boolean;
  onMissing: StartProofMissing | null;
  location: string | null;
  drawnAt: string | null;
  counts: { total: number; accepted: number; pending: number; rejected: number; missing: number };
  rows: ProofRow[];
}

const STATUS_CLS: Record<string, string> = {
  accepted: 'bg-accent-green/15 text-accent-green-light',
  pending: 'bg-yellow-500/15 text-yellow-300',
  rejected: 'bg-red-500/15 text-red-400',
};

export default function StartProofAdminPanel({
  event,
}: {
  event: { id: number; rules?: string | null };
}) {
  const router = useRouter();
  const rules = parseEventRules(event.rules);

  const [enabled, setEnabled] = useState(rules.startProof != null);
  const [onMissing, setOnMissing] = useState<StartProofMissing>(rules.startProof?.onMissing ?? 'flag');
  const [autoAccept, setAutoAccept] = useState(rules.startProof?.autoAcceptPlugin ?? true);
  const [locations, setLocations] = useState((rules.startProof?.locations ?? []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [data, setData] = useState<PanelData | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/events/${event.id}/start-proofs`);
    if (res.ok) setData(await res.json());
  }, [event.id]);

  useEffect(() => {
    if (rules.startProof != null) void load();
  }, [load, rules.startProof]);

  async function saveConfig() {
    setSaving(true);
    setMsg('');
    try {
      const startProof = enabled
        ? {
            ...DEFAULT_START_PROOF,
            onMissing,
            autoAcceptPlugin: autoAccept,
            locations: locations.split('\n').map((l) => l.trim()).filter(Boolean),
          }
        : null;
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: { ...rules, startProof } }),
      });
      if (res.ok) {
        setMsg('Saved.');
        router.refresh();
        if (enabled) void load();
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function review(proofId: number, status: 'accepted' | 'rejected') {
    setBusyId(proofId);
    try {
      await fetch(`/api/admin/events/${event.id}/start-proofs/${proofId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function clear(proofId: number) {
    setBusyId(proofId);
    try {
      await fetch(`/api/admin/events/${event.id}/start-proofs/${proofId}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function redraw() {
    setMsg('');
    const res = await fetch(`/api/admin/events/${event.id}/start-proofs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'redraw' }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(`New location: ${d.location}. Everyone's keyword changed — announce it again.`);
      await load();
    } else {
      setMsg(d.error || 'Could not re-draw.');
    }
  }

  const counts = data?.counts;

  return (
    <div className="min-w-0 mb-6">
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Starting shot
      </h2>
      <p className="text-sm text-text-muted mb-3">
        Everyone photographs themselves at a location drawn the moment the event goes live — so nobody
        can be parked on stacked content at the start. Plugin users press a button; everyone else types
        a personal keyword in-game and uploads the screenshot.
      </p>

      <div className="border border-card-border rounded-xl bg-card-bg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            aria-pressed={enabled}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-gold' : 'bg-card-border'}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
          <span className="text-sm">Require a starting shot</span>
        </div>

        {enabled && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-text-muted block mb-1">If someone submits without one</span>
                <Select
                  value={onMissing}
                  onChange={(v) => setOnMissing(v as StartProofMissing)}
                  options={[
                    { value: 'flag', label: 'Take it, flag it for review' },
                    { value: 'reject', label: 'Refuse it until they upload' },
                  ]}
                  ariaLabel="Missing starting shot behaviour"
                />
              </label>
              <Checkbox
                checked={autoAccept}
                onChange={setAutoAccept}
                label="Auto-accept plugin captures with a matching keyword"
                className="text-sm sm:mt-5"
              />
            </div>

            <label className="block">
              <span className="text-xs text-text-muted block mb-1">
                Location pool — one per line. Leave empty to draw from the built-in list.
              </span>
              <Textarea
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
                rows={3}
                placeholder={'Varrock fountain\nEdgeville bank'}
              />
            </label>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded-lg bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-xs text-text-muted">{msg}</span>}
        </div>

        {data?.required && !data.drawnAt && (
          <p className="text-xs text-text-muted border-t border-card-border pt-3">
            The location is drawn when the event starts — until then there is nothing for anyone to
            photograph, and no keyword exists for anyone to leak.
          </p>
        )}

        {data?.drawnAt && counts && (
          <div className="border-t border-card-border pt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                Everyone is at <strong className="text-gold">{data.location}</strong>
              </span>
              <span className="text-text-muted">
                {counts.accepted}/{counts.total} accepted
                {counts.pending > 0 && <> · {counts.pending} to review</>}
                {counts.missing > 0 && <> · {counts.missing} missing</>}
                {counts.rejected > 0 && <> · {counts.rejected} rejected</>}
              </span>
              {counts.accepted + counts.pending + counts.rejected === 0 && (
                <button
                  type="button"
                  onClick={redraw}
                  title="Draw a different location — only possible while nobody has filed a shot"
                  className="text-[11px] px-2 py-0.5 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40"
                >
                  Re-draw location
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-card-border">
              {data.rows.map((r) => (
                <div key={r.playerId} className="flex items-center gap-3 py-2">
                  {r.proof ? (
                    <a href={r.proof.imageUrl} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.proof.imageUrl}
                        alt={`${r.rsn} starting shot`}
                        className="w-16 h-10 object-cover rounded border border-card-border"
                      />
                    </a>
                  ) : (
                    <div className="w-16 h-10 rounded border border-dashed border-card-border shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {r.teamColor && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.teamColor }} />
                      )}
                      {r.rsn}
                    </div>
                    <div className="text-[11px] text-text-muted truncate">
                      {r.proof ? (
                        <>
                          {r.proof.source === 'plugin' ? 'Plugin' : 'Uploaded'}
                          {r.proof.keywordOk && <span className="text-accent-green-light"> · keyword verified</span>}
                          {r.expectedKeyword && !r.proof.keywordOk && <> · expects {r.expectedKeyword}</>}
                        </>
                      ) : (
                        <>
                          Nothing filed{r.expectedKeyword && <> · expects {r.expectedKeyword}</>}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.proof && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[r.proof.status]}`}>
                        {r.proof.status}
                      </span>
                    )}
                    {r.proof && r.proof.status !== 'accepted' && (
                      <button
                        type="button"
                        disabled={busyId === r.proof.id}
                        onClick={() => review(r.proof!.id, 'accepted')}
                        className="text-[11px] px-2 py-0.5 rounded border border-accent-green/40 text-accent-green-light hover:bg-accent-green/10 disabled:opacity-50"
                      >
                        Accept
                      </button>
                    )}
                    {r.proof && r.proof.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={busyId === r.proof.id}
                        onClick={() => review(r.proof!.id, 'rejected')}
                        className="text-[11px] px-2 py-0.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    {r.proof && (
                      <button
                        type="button"
                        disabled={busyId === r.proof.id}
                        onClick={() => clear(r.proof!.id)}
                        title="Delete the shot so they upload a fresh one"
                        className="text-[11px] px-2 py-0.5 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
