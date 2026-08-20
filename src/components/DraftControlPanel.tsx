'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ControlTeam, DraftControl } from '@/lib/draftControl';
import { clanFetch } from '@/lib/clanFetch';

// Staff steering for a draft that's already running.
//
// The pre-draft balance panel next door shows the same strengths but can only act while the draft
// hasn't started — which is the one moment nothing has gone wrong. This is the other half: the
// numbers kept live per pick, and the levers to fix what they show.
//
// Bars run from the AVERAGE roster, not from the leader. Six bars all ending near the right edge is
// exactly the picture you don't want when the question is who's ahead.

const POLL_MS = 4000;

const DOMAIN_LABEL: Record<string, string> = {
  raids: 'Raids',
  'endgame-pvm': 'Endgame',
  'midgame-pvm': 'Midgame',
  'wildy-pvp': 'Wildy',
};
const ALL_DOMAINS = Object.keys(DOMAIN_LABEL);

/** How far from the average a team can sit before the bar stops being reassuring. */
const WARN_PCT = 8;
const BAD_PCT = 15;
/**
 * Half-width of the deviation track, in pct. Fixed at 20 while the draft is close, then grown to
 * the furthest team: a pinned bar can't show that one roster is twice as far out as another, which
 * is the only thing the chart is for.
 */
function axisFor(devs: number[]): number {
  const furthest = Math.max(0, ...devs.map((d) => Math.abs(d)));
  return Math.max(20, Math.ceil(furthest / 10) * 10);
}

function severity(devPct: number): 'ok' | 'warn' | 'bad' {
  const d = Math.abs(devPct);
  return d >= BAD_PCT ? 'bad' : d >= WARN_PCT ? 'warn' : 'ok';
}

export default function DraftControlPanel({
  eventId,
  onChanged,
}: {
  eventId: number;
  /** Called after any action so the parent's draft state refetches too. */
  onChanged: () => void;
}) {
  const [data, setData] = useState<DraftControl | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ personKey: string; playerIds: number[]; rsn: string } | null>(null);
  // Ticks so the countdown moves between polls; the server still decides what's overdue.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/draft-control`);
      if (res.ok) setData((await res.json()) as DraftControl);
    } catch {
      /* the next tick covers it */
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const act = useCallback(
    async (key: string, body: Record<string, unknown>) => {
      setBusy(key);
      setNote(null);
      try {
        const res = await clanFetch(`/api/admin/events/${eventId}/draft-control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNote(payload.error ?? 'That did not go through.');
          return false;
        }
        await load();
        onChanged();
        return true;
      } finally {
        setBusy(null);
      }
    },
    [eventId, load, onChanged],
  );

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((t) => [t.teamId, t])), [data]);

  if (!data) {
    return (
      <div className="border border-card-border rounded-xl bg-card-bg p-4 text-sm text-text-muted">
        Reading the draft…
      </div>
    );
  }
  if (data.draftStatus !== 'active' && data.draftStatus !== 'paused') return null;

  const spreadTone =
    data.spreadPct >= 25 ? 'text-red-400' : data.spreadPct >= 10 ? 'text-yellow-400' : 'text-accent-green-light';
  const onTheClock = data.currentTeamId != null ? teamById.get(data.currentTeamId) ?? null : null;
  const axis = axisFor(data.teams.map((t) => t.deviationPct));

  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4 sm:p-5 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h3 className="text-base font-bold">Draft control</h3>
        <span className="text-xs text-text-muted">
          round {data.round + 1} · pick {data.currentPickNumber + 1} · {data.poolRemaining} left
          {onTheClock ? ` · ${onTheClock.name} on the clock` : ''}
        </span>
        {data.draftStatus === 'paused' && (
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
            paused
          </span>
        )}
      </div>

      {data.unrated && (
        <p className="text-xs text-yellow-200/90 border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-3 py-2">
          Nobody in this pool has an enrollment snapshot, so every rating is identical — the bars and
          tiers below mean nothing yet.
        </p>
      )}

      {/* ── Team power ─────────────────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <span className={`font-mono text-2xl font-bold ${spreadTone}`}>{data.spreadPct}%</span>
          <span className="text-xs text-text-muted">
            spread — strongest vs weakest. Under 10% reads as even; over 25% and the board usually shows it.
          </span>
        </div>

        <div className="grid grid-cols-[110px_minmax(0,1fr)_56px] sm:grid-cols-[130px_minmax(0,1fr)_72px_56px] gap-2.5 px-2.5 mb-1 font-mono text-[10px] text-text-muted">
          <span />
          <span className="flex justify-between">
            <span>&minus;{axis}%</span>
            <span>average roster</span>
            <span>+{axis}%</span>
          </span>
          <span className="hidden sm:block">tiers</span>
          <span className="text-right">vs avg</span>
        </div>

        <div className="grid gap-1.5">
          {[...data.teams]
            .sort((a, b) => b.deviationPct - a.deviationPct)
            .map((t) => (
              <TeamRow
                key={t.teamId}
                team={t}
                onTheClock={data.currentTeamId === t.teamId}
                axis={axis}
                onMoveTarget={moving}
                onDrop={async (target) => {
                  if (!moving) return;
                  const ok = await act('move', {
                    action: 'move',
                    playerIds: moving.playerIds,
                    teamId: target,
                  });
                  if (ok) setMoving(null);
                }}
                onPick={(person) => setMoving(person)}
                movingKey={moving?.personKey ?? null}
                busy={busy === 'move'}
              />
            ))}
        </div>
        <p className="text-[11px] text-text-muted mt-2">
          Strength is Σ rating^1.5 over each roster, measured against the average team — not against
          the leader, so a small gap looks small and a real one doesn&rsquo;t hide.
        </p>
      </div>

      {moving && (
        <div className="flex items-center gap-2 flex-wrap text-sm border border-gold/35 bg-gold/[0.06] rounded-lg px-3 py-2">
          <span>
            Moving <b>{moving.rsn}</b> — pick the team to move them to.
          </span>
          <button
            type="button"
            onClick={() => setMoving(null)}
            className="ml-auto text-xs text-text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── The fix ────────────────────────────────────────────────────────────────────────── */}
      {data.suggestedSwap && (
        <div className="border border-yellow-500/35 bg-yellow-500/[0.07] rounded-xl px-3.5 py-3 flex items-center gap-3 flex-wrap">
          <div className="text-sm min-w-0">
            Swap <b>{data.suggestedSwap.give}</b> ({teamById.get(data.suggestedSwap.giveTeamId)?.name ?? 'team'})
            with <b>{data.suggestedSwap.take}</b> ({teamById.get(data.suggestedSwap.takeTeamId)?.name ?? 'team'}).
            <div className="font-mono text-[11.5px] text-text-muted mt-0.5">
              spread {data.suggestedSwap.spreadBeforePct}% → {data.suggestedSwap.spreadAfterPct}% · both rosters
              keep their size
            </div>
          </div>
          <button
            type="button"
            disabled={busy === 'swap'}
            onClick={() => {
              const give = data.teams
                .flatMap((t) => t.roster)
                .find((p) => p.rsn === data.suggestedSwap?.give);
              const take = data.teams
                .flatMap((t) => t.roster)
                .find((p) => p.rsn === data.suggestedSwap?.take);
              if (!give || !take) {
                setNote('Could not resolve that pair — refresh and try again.');
                return;
              }
              void act('swap', { action: 'swap', give: give.playerIds, take: take.playerIds });
            }}
            className="ml-auto shrink-0 text-xs font-semibold px-3 py-1.5 bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
          >
            {busy === 'swap' ? 'Applying…' : 'Apply swap'}
          </button>
        </div>
      )}

      {/* ── The pick clock ─────────────────────────────────────────────────────────────────── */}
      {data.pickSeconds > 0 && data.draftStatus === 'active' && onTheClock && (
        <div
          className={`rounded-xl border px-3.5 py-3 flex items-center gap-3 flex-wrap ${
            data.pickOverdue ? 'border-red-500/40 bg-red-500/[0.07]' : 'border-card-border bg-brown-dark/40'
          }`}
        >
          <div className="text-sm min-w-0">
            <b>{onTheClock.name}</b> {data.pickOverdue ? 'is out of time' : 'is on the clock'}
            <div className="text-xs text-text-muted mt-0.5">
              {data.pickDueAt
                ? data.pickOverdue
                  ? 'You can take their pick — it uses their own shortlist, not your judgement.'
                  : `${Math.max(0, Math.ceil((Date.parse(data.pickDueAt) - now) / 1000))}s left of ${data.pickSeconds}s`
                : `${data.pickSeconds}s per pick — the clock starts once the first pick lands.`}
            </div>
          </div>
          {data.pickOverdue && (
            <button
              type="button"
              disabled={busy === 'pick-for'}
              onClick={() => void act('pick-for', { action: 'pick-for' })}
              className="ml-auto shrink-0 text-xs font-semibold px-3 py-1.5 bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
            >
              {busy === 'pick-for' ? 'Picking…' : 'Pick for them'}
            </button>
          )}
        </div>
      )}

      {/* ── Forced balance ─────────────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h4 className="text-sm font-bold">Restrict what captains can pick</h4>
          <span className="text-[11px] text-text-muted">off by default · applies from the next pick</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { mode: 'off', label: 'Off', hint: 'No steering.' },
            { mode: 'tiered-snake', label: 'Tier coverage', hint: 'No second S or A while another team has none.' },
            {
              mode: 'spread-cap',
              label: `Cap the spread at ${data.balanceSpreadCapPct}%`,
              hint: 'A captain may only take someone who keeps their team within the cap of the average roster, measured per pick so picking first in a round is not penalised. A team already past it may only take from the lowest-rated left.',
            },
            { mode: 'dynamic-order', label: 'Weakest picks next', hint: 'Reorders turns instead of filtering.' },
          ].map((m) => (
            <button
              key={m.mode}
              type="button"
              title={m.hint}
              disabled={busy === 'balance-mode'}
              onClick={() => void act('balance-mode', { action: 'balance-mode', mode: m.mode })}
              className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors disabled:opacity-50 ${
                data.balanceMode === m.mode
                  ? 'bg-gold text-brown-dark border-gold'
                  : 'border-card-border text-text-muted hover:text-foreground hover:border-gold/40'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {(data.balanceMode === 'tiered-snake' || data.balanceMode === 'spread-cap') && (
          <div className="mt-2.5 text-xs text-text-muted">
            {data.teams.some((t) => t.lockedCount > 0) ? (
              <>
                Locked right now:{' '}
                {data.teams
                  .filter((t) => t.lockedCount > 0)
                  .map((t) => `${t.name} (${t.lockedCount})`)
                  .join(', ')}
                . Captains are told which rule and why, not handed a silently shorter list.
              </>
            ) : data.balanceMode === 'spread-cap' ? (
              'Armed — nobody is locked at the moment, because no team is far enough ahead for the cap to bite.'
            ) : (
              'Armed — nobody is locked at the moment, because no team is ahead on S or A yet.'
            )}
          </div>
        )}
      </div>

      {/* ── Resume ─────────────────────────────────────────────────────────────────────────── */}
      {data.draftStatus === 'paused' && (
        <div className="border border-yellow-500/30 bg-yellow-500/[0.06] rounded-xl px-3.5 py-3">
          <h4 className="text-sm font-bold mb-1">Resume</h4>
          <p className="text-xs text-text-muted mb-2.5">
            Resuming in order repeats the mistake when the reason you paused was a pick landing on the
            wrong team. Name who picks next and the order rotates so it&rsquo;s true — everyone still
            picks once per round.
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              disabled={busy === 'resume'}
              onClick={() => void act('resume', { action: 'resume' })}
              className="text-xs font-semibold px-3 py-1.5 border border-card-border rounded-lg hover:border-gold/40 transition-colors disabled:opacity-50"
            >
              Resume in order
            </button>
            <span className="text-xs text-text-muted">or resume from:</span>
            {data.teams.map((t) => (
              <button
                key={t.teamId}
                type="button"
                disabled={busy === 'resume'}
                onClick={() => void act('resume', { action: 'resume', teamId: t.teamId })}
                className="text-xs font-semibold px-2.5 py-1.5 border border-card-border rounded-lg hover:border-gold/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Pick log ───────────────────────────────────────────────────────────────────────── */}
      {data.picks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-bold">Picks</h4>
            <span className="text-[11px] text-text-muted">swing = what it did to the spread</span>
          </div>
          <div className="grid max-h-64 overflow-y-auto">
            {data.picks.map((p) => (
              <div
                key={p.pickNumber}
                className="grid grid-cols-[34px_20px_minmax(0,1fr)_auto] gap-2.5 items-center py-1.5 text-[12.5px] border-b border-card-border/50 last:border-b-0"
              >
                <span className="font-mono text-[11px] text-text-muted">{p.pickNumber + 1}</span>
                <span className="font-mono text-[10px] text-text-muted">{p.tier ?? '—'}</span>
                <span className="truncate">
                  <b>{p.rsn}</b>
                  <span className="text-text-muted"> → {p.teamName ?? 'a team'}</span>
                </span>
                <span
                  className={`font-mono text-[11px] ${
                    p.swing > 0 ? 'text-red-400' : p.swing < 0 ? 'text-accent-green-light' : 'text-text-muted'
                  }`}
                >
                  {p.swing > 0 ? '+' : ''}
                  {p.swing}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {note && <p className="text-sm text-red-400">{note}</p>}
    </div>
  );
}

function TeamRow({
  team,
  axis,
  onTheClock,
  movingKey,
  onMoveTarget,
  onDrop,
  onPick,
  busy,
}: {
  team: ControlTeam;
  axis: number;
  onTheClock: boolean;
  movingKey: string | null;
  onMoveTarget: { personKey: string } | null;
  onDrop: (teamId: number) => void;
  onPick: (person: { personKey: string; playerIds: number[]; rsn: string }) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = severity(team.deviationPct);
  const width = Math.min(Math.abs(team.deviationPct), axis) / (axis * 2); // fraction of the full track
  const fill = tone === 'bad' ? 'bg-red-400' : tone === 'warn' ? 'bg-yellow-400' : 'bg-text-muted';
  const missing = ALL_DOMAINS.filter((d) => !team.domains.includes(d));

  return (
    <div className={`rounded-lg border ${onTheClock ? 'border-gold/40' : 'border-card-border'} bg-brown-dark/40`}>
      <div className="grid grid-cols-[110px_minmax(0,1fr)_56px] sm:grid-cols-[130px_minmax(0,1fr)_72px_56px] gap-2.5 items-center px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 min-w-0 text-left text-[13px] font-bold hover:text-gold-light"
        >
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: team.color }} />
          <span className="truncate">{team.name}</span>
        </button>

        <div className="relative h-5 rounded bg-brown-dark overflow-hidden">
          <span className="absolute left-1/2 top-0.5 bottom-0.5 w-px bg-card-border" />
          <span
            className={`absolute top-1 bottom-1 rounded-sm ${fill}`}
            style={
              team.deviationPct >= 0
                ? { left: '50%', width: `${width * 100}%` }
                : { right: '50%', width: `${width * 100}%` }
            }
          />
        </div>

        <div className="hidden sm:flex gap-1">
          {(['S', 'A', 'B', 'C'] as const).map((t) => (
            <span
              key={t}
              className={`font-mono text-[10px] rounded px-1 border ${
                team.tiers[t] > 0 ? 'text-foreground border-gold-dark' : 'text-text-muted border-card-border'
              }`}
            >
              {t}
              {team.tiers[t]}
            </span>
          ))}
        </div>

        <span
          className={`font-mono text-[12px] text-right ${
            tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-yellow-400' : 'text-text-muted'
          }`}
        >
          {team.deviationPct > 0 ? '+' : ''}
          {team.deviationPct}%
        </span>
      </div>

      {/* Move target — only offered while a move is in flight, so the row isn't a button by default. */}
      {onMoveTarget && (
        <div className="px-2.5 pb-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDrop(team.teamId)}
            className="w-full text-xs font-semibold border border-dashed border-gold/40 text-gold-light rounded-lg py-1.5 hover:bg-gold/10 transition-colors disabled:opacity-50"
          >
            Move here
          </button>
        </div>
      )}

      {open && (
        <div className="px-2.5 pb-2.5 grid gap-1">
          {team.roster.length === 0 ? (
            <p className="text-xs text-text-muted">Nobody drafted yet.</p>
          ) : (
            team.roster.map((p) => (
              <div
                key={p.personKey}
                className={`flex items-center gap-2 text-xs border rounded px-2 py-1.5 ${
                  movingKey === p.personKey ? 'border-gold/50 bg-gold/10' : 'border-card-border bg-card-bg'
                }`}
              >
                <span className="font-mono text-[10px] text-text-muted w-3">{p.tier ?? '—'}</span>
                <span className="truncate">{p.rsn}</span>
                {p.pickNumber != null && (
                  <span className="font-mono text-[10px] text-text-muted">#{p.pickNumber + 1}</span>
                )}
                <button
                  type="button"
                  onClick={() => onPick({ personKey: p.personKey, playerIds: p.playerIds, rsn: p.rsn })}
                  className="ml-auto text-[11px] text-text-muted hover:text-gold-light"
                >
                  Move →
                </button>
              </div>
            ))
          )}
          {missing.length > 0 && (
            <p className="text-[11px] text-text-muted mt-1">
              No coverage: {missing.map((d) => DOMAIN_LABEL[d]).join(', ')} — strength says how good a
              roster is, coverage says whether it can attempt the board at all.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
