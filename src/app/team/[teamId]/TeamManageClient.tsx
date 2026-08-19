'use client';

import { useCallback, useEffect, useState } from 'react';
import TeamInvitePanel from '@/components/TeamInvitePanel';

// The manager's half of a team page: who's on it, what their proof looks like, whose fee is still
// owed, and the links that put people on it. Shown to the captain and to anyone holding a staff seat
// on this team — which is how a visiting clan's moderator runs their own side of a clan-v-clan
// without an admin account here.
//
// It opens SHUT. A captain came to look at the board; the summary line carries the only numbers that
// would have made them open it (who's on, what's owed), so the tools stay one click away instead of
// three cards deep.

interface RosterRow {
  playerId: number;
  name: string;
  rsn: string | null;
  pickNumber: number | null;
  frozenAt: string | null;
  lastSeen: string | null;
}

interface ProofRow {
  id: number;
  tileLabel: string;
  by: string | null;
  amount: number;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
}

/** Somebody asking to join this team on a team-choice event (rules.teamChoice). */
interface RequestRow {
  id: number;
  rsn: string;
  displayName: string | null;
  signedUpAt: string;
  profile: { notes?: string; timezone?: string };
}

interface FeeRow {
  id: number;
  amount: number;
  status: string;
  rsn: string;
  displayName: string | null;
  collectedAt: string | null;
}

const FEE_STYLE: Record<string, string> = {
  pending: 'text-yellow-400 border-yellow-500/30',
  reported: 'text-blue-400 border-blue-500/30',
  collected: 'text-blue-400 border-blue-500/30',
  confirmed: 'text-accent-green-light border-accent-green/30',
  disputed: 'text-red-400 border-red-500/30',
};

export default function TeamManageClient({ teamId }: { teamId: number }) {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [proof, setProof] = useState<ProofRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [eventStarted, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'roster' | 'requests' | 'proof' | 'fees' | 'invites'>('roster');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rosterRes, feesRes, requestsRes] = await Promise.all([
        fetch(`/api/team/${teamId}/roster`),
        fetch(`/api/team/${teamId}/fees`),
        fetch(`/api/team/${teamId}/requests`),
      ]);
      if (rosterRes.ok) {
        const data = await rosterRes.json();
        setRoster(data.roster ?? []);
        setProof(data.proof ?? []);
        setStarted(!!data.eventStarted);
      }
      if (feesRes.ok) setFees((await feesRes.json()).fees ?? []);
      // Empty on a drafted event — nobody can request a team there, so the tab just never appears.
      if (requestsRes.ok) setRequests((await requestsRes.json()).requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const removePlayer = async (playerId: number, name: string) => {
    if (!confirm(`Take ${name} off this team? They go back to the event pool, not out of the event.`)) return;
    setBusy(playerId);
    setError(null);
    try {
      const res = await fetch(`/api/team/${teamId}/roster?playerId=${playerId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not remove them');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const answerRequest = async (signupId: number, action: 'approve' | 'decline', name: string) => {
    if (action === 'decline' && !confirm(`Turn down ${name}'s request? They stay in the event — they just aren't on this team.`)) {
      return;
    }
    setBusy(signupId);
    setError(null);
    try {
      const res = await fetch(`/api/team/${teamId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not answer that request');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (feeId: number) => {
    setBusy(feeId);
    setError(null);
    try {
      const res = await fetch(`/api/team/${teamId}/fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not mark that paid');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const owed = fees.filter((f) => f.status === 'pending' || f.status === 'disputed').length;

  // What the card says about itself while shut — the numbers that decide whether to open it.
  const summary = [
    `${roster.length} on the roster`,
    requests.length > 0 ? `${requests.length} waiting to join` : null,
    owed > 0 ? `${owed} fee${owed === 1 ? '' : 's'} owed` : null,
    proof.length > 0 ? `${proof.length} proof` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-semibold">Manage this team</h2>
        <span className="text-sm text-text-muted truncate">
          {loading ? '' : summary}
          {owed > 0 && <span className="text-yellow-400"> ·</span>}
        </span>
        <span className={`ml-auto text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>

      {!open ? null : (
      <>
      <div className="flex items-center gap-2 flex-wrap mb-4 mt-4">
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              ['roster', `Roster · ${roster.length}`],
              ...(requests.length > 0 ? ([['requests', `Requests · ${requests.length}`]] as const) : []),
              ['proof', `Proof · ${proof.length}`],
              ['fees', owed > 0 ? `Fees · ${owed} owed` : `Fees · ${fees.length}`],
              ['invites', 'Invite links'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${
                tab === key
                  ? 'bg-gold text-brown-dark border-gold'
                  : 'border-card-border text-text-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <>
          {tab === 'roster' && (
            <div className="grid gap-1.5">
              {roster.length === 0 ? (
                <p className="text-sm text-text-muted">Nobody on this team yet.</p>
              ) : (
                roster.map((r) => (
                  <div
                    key={r.playerId}
                    className="flex items-center gap-2.5 border border-card-border rounded-lg bg-brown-dark/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.name}
                        {r.frozenAt && <span className="text-xs text-yellow-400 ml-2">subbed out</span>}
                      </div>
                      {r.pickNumber != null && (
                        <div className="text-[11px] text-text-muted font-mono">pick {r.pickNumber + 1}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busy === r.playerId || eventStarted}
                      title={
                        eventStarted
                          ? 'The event has started — an admin subs people out, which keeps scoring history straight'
                          : 'Take them off this team, back to the event pool'
                      }
                      onClick={() => removePlayer(r.playerId, r.name)}
                      className="ml-auto shrink-0 text-xs px-2.5 py-1.5 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
              {eventStarted && (
                <p className="text-xs text-text-muted mt-1">
                  The event is live, so the roster is fixed here — subbing someone out changes what
                  their tiles scored, so it stays with the host.
                </p>
              )}
            </div>
          )}

          {tab === 'requests' && (
            <div className="grid gap-1.5">
              {requests.length === 0 ? (
                <p className="text-sm text-text-muted">Nobody is waiting to join.</p>
              ) : (
                requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2.5 border border-card-border rounded-lg bg-brown-dark/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.rsn}
                        {r.displayName && r.displayName !== r.rsn && (
                          <span className="text-text-muted font-normal"> · {r.displayName}</span>
                        )}
                      </div>
                      {r.profile.notes && (
                        <div className="text-[11px] text-text-muted truncate">{r.profile.notes}</div>
                      )}
                    </div>
                    <div className="ml-auto flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => answerRequest(r.id, 'approve', r.rsn)}
                        className="text-xs font-semibold px-2.5 py-1 rounded border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => answerRequest(r.id, 'decline', r.rsn)}
                        className="text-xs font-medium px-2.5 py-1 rounded border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Not this time
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'proof' && (
            <div className="grid gap-1.5">
              {proof.length === 0 ? (
                <p className="text-sm text-text-muted">No submissions from this team yet.</p>
              ) : (
                proof.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border border-card-border rounded-lg bg-brown-dark/40 px-3 py-2"
                  >
                    {p.imageUrl ? (
                      <a href={p.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.imageUrl}
                          alt=""
                          width={44}
                          height={44}
                          className="w-11 h-11 object-cover rounded border border-card-border"
                        />
                      </a>
                    ) : (
                      <span className="w-11 h-11 shrink-0 rounded border border-dashed border-card-border grid place-items-center text-[10px] text-text-muted">
                        none
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.tileLabel}</div>
                      <div className="text-[11px] text-text-muted truncate">
                        {p.by ?? 'someone'}
                        {p.amount > 1 && ` · ×${p.amount}`}
                        {p.note && ` · ${p.note}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'fees' && (
            <div className="grid gap-1.5">
              {fees.length === 0 ? (
                <p className="text-sm text-text-muted">This event has no sign-up fee.</p>
              ) : (
                fees.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2.5 border border-card-border rounded-lg bg-brown-dark/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.rsn}</div>
                      <div className="text-[11px] text-text-muted">
                        {(f.amount / 1_000_000).toFixed(1)}M
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                        FEE_STYLE[f.status] ?? 'text-text-muted border-card-border'
                      }`}
                    >
                      {f.status}
                    </span>
                    {f.status !== 'confirmed' && (
                      <button
                        type="button"
                        disabled={busy === f.id}
                        onClick={() => markPaid(f.id)}
                        className="ml-auto shrink-0 text-xs font-semibold px-2.5 py-1.5 border border-gold/40 text-gold rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-50"
                      >
                        {busy === f.id ? 'Saving…' : 'Mark paid'}
                      </button>
                    )}
                  </div>
                ))
              )}
              <p className="text-xs text-text-muted mt-1">
                Marking paid records you as the collector. If the player later names someone else, it
                flags as disputed for the host — same as when a treasurer does it.
              </p>
            </div>
          )}

          {/* The links live here rather than in a card of their own: it's the same job as the roster
              tab — deciding who is on this team — and a captain who can't mint still sees what's out. */}
          {tab === 'invites' && <TeamInvitePanel teamId={teamId} bare />}
        </>
      )}

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </>
      )}
    </section>
  );
}
