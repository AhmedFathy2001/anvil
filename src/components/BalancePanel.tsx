'use client';

import { useMemo, useState } from 'react';
import type { TeamStrengthsState } from '@/hooks/useTeamStrengths';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';

// Draft-side balance advisory (balance-engine plan, Phase 4/5 UI). Renders on the Teams & Draft
// tab for the classic draft format: projected team-strength bars, the balanceMode selector, and the
// admin "Balance teams" action. The enforcement itself (tiered picks, dynamic order, greedy
// placement) lives server-side; this panel is how staff see and choose it.
//
// TEAM-level only. No per-player rating or tier is shown to anyone — member privacy, even from
// their own clan admins — so the strengths come from the page-level useTeamStrengths hook already
// summed per team on the server.

interface Props {
  eventId: number;
  rules: string | null | undefined; // events.rules JSON (parsed leniently server-side)
  teams: { id: number; name: string; color: string | null }[];
  /** Per-team strengths (page-level hook), with a refetch for after balancing. */
  strengths: TeamStrengthsState;
  draftStatus: string;
  editLocked: boolean;
  /** Called after auto-balance / mode change so the parent refreshes rosters. */
  onChanged: () => void;
}

const MODES = [
  { value: 'off', label: 'Off — classic draft', hint: 'No steering; the panel stays informational.' },
  { value: 'advisory', label: 'Advisory', hint: 'Show strength bars; enforce nothing.' },
  { value: 'tiered-snake', label: 'Tiered snake', hint: 'No second top pick while another team has none.' },
  { value: 'dynamic-order', label: 'Dynamic order', hint: 'Weakest projected team picks next each round.' },
  { value: 'auto', label: 'Auto-balance', hint: 'Skip drafting — the Balance teams button forms rosters.' },
] as const;

export default function BalancePanel({ eventId, rules, teams, strengths: strengthState, draftStatus, editLocked, onChanged }: Props) {
  const loaded = strengthState.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const mode = useMemo(() => {
    try {
      const parsed = rules ? (JSON.parse(rules) as { balanceMode?: string }) : null;
      return parsed?.balanceMode && MODES.some((m) => m.value === parsed.balanceMode) ? parsed.balanceMode : 'off';
    } catch {
      return 'off';
    }
  }, [rules]);

  // When balancing is Off (the default for almost every event) this panel is just a wall of numbers
  // nobody asked for — start collapsed so it doesn't dominate the tab. One click expands it, and
  // turning any mode on opens it (see setMode). NOT collapsed on a locked (finished) event: the
  // whole tab sits inside a disabled <fieldset> there, which also disables the Show toggle — so a
  // collapsed panel would be permanently stuck shut. Show it open (read-only) instead.
  const [collapsed, setCollapsed] = useState(mode === 'off' && !editLocked);

  const strengths = useMemo(
    () => new Map<number, number>(teams.map((t) => [t.id, loaded?.byTeam.get(t.id) ?? 0])),
    [loaded, teams],
  );
  const maxStrength = Math.max(0.0001, ...strengths.values());
  const spreadPct = useMemo(() => {
    const vals = [...strengths.values()].filter(() => teams.length >= 2);
    if (vals.length < 2) return null;
    const max = Math.max(...vals);
    return max > 0 ? Math.round(((max - Math.min(...vals)) / max) * 100) : 0;
  }, [strengths, teams.length]);

  const poolCount = loaded?.poolCount ?? 0;
  const canAutoBalance = !editLocked && draftStatus === 'none' && teams.length >= 2 && poolCount > 0;

  const setMode = async (value: string) => {
    setBusy('mode');
    setNote(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Only this key; the API merges it over the stored rules.
        body: JSON.stringify({ rules: { balanceMode: value } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNote(data?.error ?? 'Could not save the balance mode.');
      } else {
        // Turning a mode on reveals the detail; switching back to Off tucks it away again.
        setCollapsed(value === 'off');
        onChanged();
      }
    } finally {
      setBusy(null);
    }
  };

  const autoBalance = async () => {
    setBusy('auto');
    setNote(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/auto-balance`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNote(data?.error ?? 'Auto-balance failed.');
      } else {
        setNote(`Placed ${data.placed} — projected spread now ${data.spreadPct}%.`);
        onChanged();
        strengthState.refetch();
      }
    } finally {
      setBusy(null);
    }
  };

  // Nothing to rate anyone on yet — no past events, no marker-boss kill counts. The panel would show
  // a 0% spread and five balancing modes that have nothing to work with, so it says that in a line
  // instead. Left alone once a mode is on, so it can be switched back off.
  if (loaded?.nothingToRate && mode === 'off') {
    return (
      <p className="text-xs text-text-muted">
        Team balance: nobody in this pool has played an Anvil event or has boss kill counts to go on yet, so
        there&apos;s nothing to rate teams by. After your first event, this can suggest fairer teams.
      </p>
    );
  }

  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span className="w-1 h-4 bg-gold rounded-full" />
          Team balance
          {spreadPct != null && (
            <span
              className={`text-xs font-medium ${spreadPct >= 25 ? 'text-red-400' : 'text-text-muted'}`}
              title="Strength gap between the strongest and weakest team. Lower is more balanced; turns red at 25%+."
            >
              spread {spreadPct}%
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {canAutoBalance && (
            <button
              onClick={autoBalance}
              disabled={!!busy}
              className="text-xs font-medium bg-gold/10 text-gold border border-gold/25 px-3 py-1.5 rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50"
            >
              {busy === 'auto' ? 'Balancing…' : 'Balance teams'}
            </button>
          )}
          <Select
            value={mode}
            onChange={setMode}
            disabled={editLocked || busy === 'mode' || draftStatus === 'active'}
            options={MODES.map((m) => ({ value: m.value, label: m.label }))}
            ariaLabel="Balance mode"
            className="w-44"
          />
          <button onClick={() => setCollapsed((c) => !c)} className="text-xs text-text-muted hover:text-foreground">
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      {note && <p className="text-xs text-text-muted mt-2">{note}</p>}
      <p className="text-xs text-text-muted mt-1">
        Projected roster strength from the players&apos; past-event history — advisory only.{' '}
        {MODES.find((m) => m.value === mode)?.hint}
      </p>

      {/* Plain-language key for the number beside each bar. */}
      {!collapsed && (
        <p className="text-[11px] text-text-muted/80 mt-2 leading-relaxed">
          The number beside a <span className="text-foreground/70">team bar</span> is that roster&apos;s projected
          strength. Individual players are never rated on screen.
        </p>
      )}

      {!collapsed && loaded == null && <p className="text-xs text-text-muted mt-3">Rating the pool…</p>}

      {!collapsed && loaded != null && (
        <div className="mt-4 space-y-4">
          {teams.length > 0 && (
            <div className="space-y-1.5">
              {teams.map((t) => {
                const s = strengths.get(t.id) ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <span className="w-28 truncate" title={t.name}>
                      {t.name}
                    </span>
                    <div className="flex-1 h-2 rounded bg-card-border/50 overflow-hidden">
                      <div
                        className="h-full rounded bg-gold/70"
                        style={{ width: `${Math.round((s / maxStrength) * 100)}%` }}
                      />
                    </div>
                    <span
                      className="w-10 text-right text-text-muted"
                      title="Projected strength — the team's combined strength on paper. Higher is stronger on paper."
                    >
                      {(s * 100).toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {poolCount > 0 && <p className="text-xs text-text-muted">{poolCount} players still in the pool.</p>}
          {(loaded?.coverage.length ?? 0) > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <p className="text-xs font-medium text-amber-300">Coverage gaps on this board</p>
              <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                {loaded!.coverage.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
