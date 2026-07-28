'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// Draft-side balance advisory (balance-engine plan, Phase 4/5 UI). Renders on the Teams & Draft
// tab for the classic draft format: projected team-strength bars, the pool grouped into S/A/B/C
// tiers with capability hints, the balanceMode selector, and the admin "Balance teams" action.
// Everything is staff-facing information — the enforcement itself (tiered picks, dynamic order,
// greedy placement) lives server-side; this panel is how staff see and choose it.

interface ProfileRow {
  personKey: string;
  rsn: string;
  playerIds: number[];
  teamId: number | null;
  rating: number;
  band: 'wide' | 'medium' | 'tight';
  capabilityMarkers: { key: string; label: string; domain: string; kc: number }[];
  reliability: number | null;
  subbedOutBefore: boolean;
  evidenceEvents: number;
}

interface Props {
  eventId: number;
  rules: string | null | undefined; // events.rules JSON (parsed leniently server-side)
  teams: { id: number; name: string; color: string | null }[];
  /** Signature of current assignments — the panel refetches profiles when it changes. */
  playersSignature: string;
  draftStatus: string;
  editLocked: boolean;
  /** Called after auto-balance / mode change so the parent refreshes rosters. */
  onChanged: () => void;
}

const MODES = [
  { value: 'off', label: 'Off — classic draft', hint: 'No steering; the panel stays informational.' },
  { value: 'advisory', label: 'Advisory', hint: 'Show strength bars and tiers; enforce nothing.' },
  { value: 'tiered-snake', label: 'Tiered snake', hint: 'No second S/A-tier pick while a team has none.' },
  { value: 'dynamic-order', label: 'Dynamic order', hint: 'Weakest projected team picks next each round.' },
  { value: 'auto', label: 'Auto-balance', hint: 'Skip drafting — the Balance teams button forms rosters.' },
] as const;

const TIERS = ['S', 'A', 'B', 'C'] as const;
type Tier = (typeof TIERS)[number];

export default function BalancePanel({ eventId, rules, teams, playersSignature, draftStatus, editLocked, onChanged }: Props) {
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
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

  const fetchProfiles = useCallback(async () => {
    const res = await fetch(`/api/admin/player-profiles?eventId=${eventId}`);
    if (res.ok) {
      const data = await res.json();
      setProfiles(data.profiles as ProfileRow[]);
    }
  }, [eventId]);

  useEffect(() => {
    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when assignments change
  }, [fetchProfiles, playersSignature]);

  // Mirror of the server's quartile tiering (lib/draftBalance) — profiles arrive rating-sorted.
  const tierByPerson = useMemo(() => {
    const map = new Map<string, Tier>();
    const n = profiles?.length ?? 0;
    profiles?.forEach((p, i) => {
      const q = n <= 1 ? 0 : i / n;
      map.set(p.personKey, q < 0.25 ? 'S' : q < 0.5 ? 'A' : q < 0.75 ? 'B' : 'C');
    });
    return map;
  }, [profiles]);

  const strengths = useMemo(() => {
    const map = new Map<number, number>(teams.map((t) => [t.id, 0]));
    for (const p of profiles ?? []) {
      if (p.teamId == null || !map.has(p.teamId)) continue;
      map.set(p.teamId, (map.get(p.teamId) ?? 0) + Math.pow(p.rating, 1.5));
    }
    return map;
  }, [profiles, teams]);
  const maxStrength = Math.max(0.0001, ...strengths.values());
  const spreadPct = useMemo(() => {
    const vals = [...strengths.values()].filter(() => teams.length >= 2);
    if (vals.length < 2) return null;
    const max = Math.max(...vals);
    return max > 0 ? Math.round(((max - Math.min(...vals)) / max) * 100) : 0;
  }, [strengths, teams.length]);

  const pool = (profiles ?? []).filter((p) => p.teamId == null);
  const canAutoBalance = !editLocked && draftStatus === 'none' && teams.length >= 2 && pool.length > 0;

  const setMode = async (value: string) => {
    setBusy('mode');
    setNote(null);
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = rules ? (JSON.parse(rules) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: { ...parsed, balanceMode: value } }),
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
      const res = await fetch(`/api/admin/events/${eventId}/auto-balance`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNote(data?.error ?? 'Auto-balance failed.');
      } else {
        setNote(`Placed ${data.placed} — projected spread now ${data.spreadPct}%.`);
        onChanged();
        fetchProfiles();
      }
    } finally {
      setBusy(null);
    }
  };

  const bandGlyph = (p: ProfileRow) =>
    p.band === 'tight' ? '' : p.band === 'medium' ? ' ·?' : ' ·??';

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
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={editLocked || busy === 'mode' || draftStatus === 'active'}
            className="text-xs bg-transparent border border-card-border rounded-lg px-2 py-1.5 text-text-muted disabled:opacity-50"
            title={MODES.find((m) => m.value === mode)?.hint}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button onClick={() => setCollapsed((c) => !c)} className="text-xs text-text-muted hover:text-foreground">
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      {note && <p className="text-xs text-text-muted mt-2">{note}</p>}
      <p className="text-xs text-text-muted mt-1">
        Projected roster strength from each player&apos;s past-event history — advisory only.{' '}
        {MODES.find((m) => m.value === mode)?.hint}
      </p>

      {/* Plain-language key for the shorthand below — the whole reason this used to read as gibberish. */}
      {!collapsed && (
        <p className="text-[11px] text-text-muted/80 mt-2 leading-relaxed">
          <span className="text-foreground/70">Tiers</span> rank players strongest → weakest:{' '}
          <span className="text-gold">S</span> = top 25%, then A, B, <span>C</span> = bottom 25% (so{' '}
          <span className="text-foreground/70">S×3</span> means three top-tier players). The{' '}
          <span className="text-foreground/70">number</span> is each team&apos;s projected strength — higher
          is a stronger roster on paper.
        </p>
      )}

      {!collapsed && profiles == null && <p className="text-xs text-text-muted mt-3">Rating the pool…</p>}

      {!collapsed && profiles != null && (
        <div className="mt-4 space-y-4">
          {teams.length > 0 && (
            <div className="space-y-1.5">
              {teams.map((t) => {
                const s = strengths.get(t.id) ?? 0;
                const teamTiers = (profiles ?? []).filter((p) => p.teamId === t.id);
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
                      title="Projected strength — the team's combined member ratings. Higher is stronger on paper."
                    >
                      {(s * 100).toFixed(0)}
                    </span>
                    <span
                      className="text-text-muted/80 whitespace-nowrap shrink-0"
                      title={
                        TIERS.map((tier) => {
                          const c = teamTiers.filter((p) => tierByPerson.get(p.personKey) === tier).length;
                          return c > 0 ? `${c} ${tier}-tier` : null;
                        })
                          .filter(Boolean)
                          .join(', ') || 'No players yet'
                      }
                    >
                      {TIERS.map((tier) => {
                        const c = teamTiers.filter((p) => tierByPerson.get(p.personKey) === tier).length;
                        return c > 0 ? `${tier}×${c} ` : '';
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {pool.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1.5">
                Undrafted players, tagged with their tier — <span className="text-text-muted/80">? = thin history, ?? = no history</span> behind the rating
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pool.map((p) => {
                  const tier = tierByPerson.get(p.personKey) ?? 'C';
                  const marker = p.capabilityMarkers[0]?.label;
                  const flags = [
                    p.subbedOutBefore ? 'subbed out before' : null,
                    p.reliability != null && p.reliability < 0.4 ? 'low attendance history' : null,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <span
                      key={p.personKey}
                      title={`${p.rsn} — tier ${tier}${marker ? ` · ${marker}` : ''}${flags ? ` · ${flags}` : ''}`}
                      className={`text-xs px-2 py-0.5 rounded-lg border ${
                        tier === 'S'
                          ? 'border-gold/40 text-gold'
                          : tier === 'A'
                            ? 'border-gold/20 text-foreground/90'
                            : 'border-card-border text-text-muted'
                      } ${flags ? 'opacity-70' : ''}`}
                    >
                      {tier} · {p.rsn}
                      {marker ? ` · ${marker}` : ''}
                      {bandGlyph(p)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
