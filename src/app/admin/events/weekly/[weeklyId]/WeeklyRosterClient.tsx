'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WeeklyStanding } from '@/lib/weeklyWorkspace';
import { weeklyGain, weeklyStatValue } from '@/lib/weeklyLabels';

/**
 * The two roster surfaces of a weekly, which are the same table read two ways.
 *
 * 'participants' answers who's in — add someone by name, re-include a leaver, see who's scoring.
 * 'baselines' answers whether their numbers can be trusted — the starting line, the current value,
 * and the implausible-gain flags that mean the hiscores flushed a pre-competition grind.
 */
export default function WeeklyRosterClient({
  competitionId,
  type,
  standings,
  mode,
}: {
  competitionId: number;
  type: string;
  standings: WeeklyStanding[];
  mode: 'participants' | 'baselines';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [names, setNames] = useState('');
  const [editing, setEditing] = useState<{ id: number; rsn: string; value: string } | null>(null);
  const [search, setSearch] = useState('');

  const visible = search.trim()
    ? standings.filter((s) => s.rsn.toLowerCase().includes(search.trim().toLowerCase()))
    : standings;

  async function call(url: string, init: RequestInit, okMessage: string) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(okMessage);
        router.refresh();
      } else {
        setMessage(data.error || 'That did not work.');
      }
    } catch {
      setMessage('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function addNames() {
    const rsns = names
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (rsns.length === 0) return;
    await call(
      `/api/admin/weekly/${competitionId}/participants`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rsns }) },
      `Added ${rsns.length} name${rsns.length === 1 ? '' : 's'}.`,
    );
    setNames('');
  }

  async function toggleKeep(row: WeeklyStanding) {
    await call(
      `/api/admin/weekly/${competitionId}/participants`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: row.participantId, keepIfLeft: !row.keepIfLeft }),
      },
      row.keepIfLeft ? `${row.rsn} dropped from the standings.` : `${row.rsn} kept in the standings.`,
    );
  }

  async function saveBaseline() {
    if (!editing) return;
    const value = Number(editing.value);
    if (!Number.isFinite(value) || value < 0) {
      setMessage('Baseline must be a non-negative number.');
      return;
    }
    await call(
      `/api/admin/weekly/${competitionId}/participants`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: editing.id, baselineValue: value }),
      },
      `${editing.rsn}'s starting line corrected.`,
    );
    setEditing(null);
  }

  async function refresh(rebaseline: boolean) {
    if (rebaseline && !confirm('Reset every baseline to the current hiscores value? Gains so far are wiped.')) return;
    await call(
      `/api/admin/weekly/${competitionId}/refresh`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rebaseline }) },
      rebaseline ? 'Baselines reset from the hiscores.' : 'Stats pulled.',
    );
  }

  return (
    <div className="space-y-5">
      {mode === 'participants' ? (
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Add someone
          </h2>
          <p className="text-sm text-text-muted mb-3">
            Everyone on the roster is entered automatically. Add a name here for someone the sweep missed — a guest,
            or an account that isn&apos;t on the roster yet.
          </p>
          <div className="flex flex-wrap gap-2 items-start">
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={2}
              placeholder="One RSN per line"
              className="flex-1 min-w-[220px] bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={addNames}
              disabled={busy || !names.trim()}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-gold hover:bg-gold-light text-brown-dark transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </section>
      ) : (
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Starting lines
          </h2>
          <p className="text-sm text-text-muted mb-3">
            A gain is the difference between someone&apos;s stat now and their stat when the competition started. If the
            hiscores flushed a pre-competition grind on logout, the baseline is too low and the gain is wrong — correct
            it here and the leaderboard follows.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refresh(false)}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
            >
              Pull current stats
            </button>
            <button
              type="button"
              onClick={() => refresh(true)}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              Reset every baseline
            </button>
          </div>
        </section>
      )}

      <section className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-card-border flex-wrap">
          <h2 className="text-sm font-bold">
            {standings.length} {standings.length === 1 ? 'person' : 'people'}
          </h2>
          <div className="flex items-center gap-2">
            {message && <span className="text-xs text-text-muted">{message}</span>}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a name…"
              className="bg-brown-dark border border-card-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-text-muted/70">
                <th className="text-left font-medium px-4 py-2">Player</th>
                {mode === 'baselines' && <th className="text-right font-medium px-3 py-2">Started at</th>}
                {mode === 'baselines' && <th className="text-right font-medium px-3 py-2">Now</th>}
                <th className="text-right font-medium px-3 py-2">Gained</th>
                <th className="text-right font-medium px-3 py-2">{mode === 'baselines' ? 'Fix' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.participantId} className="border-t border-card-border/70 hover:bg-white/[0.02]">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{row.rsn}</span>
                      {row.flagged && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 whitespace-nowrap">
                          flagged
                        </span>
                      )}
                      {row.left && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            row.keepIfLeft ? 'bg-white/[0.06] text-text-muted' : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {row.keepIfLeft ? 'left · kept' : 'left the clan'}
                        </span>
                      )}
                    </span>
                    {row.flagged && row.flagReason && (
                      <span className="block text-[11px] text-amber-300/80 mt-0.5">{row.flagReason}</span>
                    )}
                  </td>

                  {mode === 'baselines' && (
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-text-muted">
                      {editing?.id === row.participantId ? (
                        <input
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          autoFocus
                          className="w-28 bg-brown-dark border border-gold rounded px-2 py-1 text-right text-xs"
                        />
                      ) : (
                        weeklyStatValue(type, row.baselineValue)
                      )}
                    </td>
                  )}
                  {mode === 'baselines' && (
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-text-muted">
                      {weeklyStatValue(type, row.currentValue)}
                    </td>
                  )}

                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {row.gained > 0 ? weeklyGain(type, row.gained) : <span className="text-text-muted/60">—</span>}
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {mode === 'baselines' ? (
                      editing?.id === row.participantId ? (
                        <span className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={saveBaseline}
                            disabled={busy}
                            className="px-2 py-1 text-xs rounded-md border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="px-2 py-1 text-xs rounded-md border border-card-border text-text-muted"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              id: row.participantId,
                              rsn: row.rsn,
                              value: String(row.baselineValue ?? row.currentValue ?? 0),
                            })
                          }
                          className="px-2 py-1 text-xs rounded-md border border-card-border hover:border-gold/50 hover:text-gold transition-colors"
                        >
                          Edit
                        </button>
                      )
                    ) : row.left ? (
                      <button
                        type="button"
                        onClick={() => toggleKeep(row)}
                        disabled={busy}
                        className="px-2 py-1 text-xs rounded-md border border-card-border hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
                      >
                        {row.keepIfLeft ? 'Drop' : 'Keep in'}
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted/60">{row.gained > 0 ? 'scoring' : 'no gain yet'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
