'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WeeklyStanding } from '@/lib/weeklyWorkspace';
import { weeklyGain, weeklyStatValue } from '@/lib/weeklyLabels';
import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';
import { doubleEntries, surplusSeats, type EntrantSeat } from '@/lib/weeklyEntrants';

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
  const { confirm } = useDialog();
  const [message, setMessage] = useState('');
  const [names, setNames] = useState('');
  const [editing, setEditing] = useState<{ id: number; rsn: string; value: string } | null>(null);
  const [search, setSearch] = useState('');

  const visible = search.trim()
    ? standings.filter((s) => s.rsn.toLowerCase().includes(search.trim().toLowerCase()))
    : standings;

  // ONE HUMAN, TWO CHARACTERS. The fanout walks seats — (account × clan) — so somebody whose main
  // is a member and whose alt was pinged in as a guest enters twice and races themselves. Nothing
  // said so anywhere, and with prizes coming out of the coffer it is the difference between one
  // person taking first and the same person taking first and third.
  const seats: EntrantSeat[] = standings.map((r) => ({
    participantId: r.participantId,
    rsn: r.rsn,
    playerId: r.playerId,
    kind: r.kind,
    left: r.left,
  }));
  const doubles = doubleEntries(seats);
  const surplus = surplusSeats(seats);
  // Which rows are the SECOND (or third) seat of somebody already in — the ones a "one entry each"
  // pass would drop. Kept as a set so the table can mark them without re-deriving per row.
  const surplusIds = new Set(surplus);
  const enteredGuests = standings.filter((r) => r.kind === 'guest' && !r.left);

  async function removeParticipants(ids: number[], said: string) {
    if (ids.length === 0) return;
    await call(
      `/api/admin/weekly/${competitionId}/participants`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: ids }),
      },
      said,
    );
  }

  async function removeOne(row: WeeklyStanding) {
    const ok = await confirm({
      title: `Take ${row.rsn} out of this competition?`,
      body:
        row.gained > 0
          ? `They have ${weeklyGain(type, row.gained)} on the board and it goes with them. Adding them back later starts a fresh starting line, which is not the same as never having left.`
          : 'They come off the entry list. Adding them back later starts a fresh starting line.',
      confirmLabel: 'Take them out',
    });
    if (!ok) return;
    await removeParticipants([row.participantId], `${row.rsn} removed.`);
  }

  async function dropEveryGuest() {
    const ids = enteredGuests.map((g) => g.participantId);
    const scoring = enteredGuests.filter((g) => g.gained > 0).length;
    const ok = await confirm({
      title: `Take all ${ids.length} guest${ids.length === 1 ? '' : 's'} out?`,
      body:
        scoring > 0
          ? `${scoring} of them ${scoring === 1 ? 'has' : 'have'} already scored, and those standings go with them. Members are untouched.`
          : 'Members are untouched. Guests who join later are not re-entered automatically.',
      confirmLabel: 'Take them out',
    });
    if (!ok) return;
    await removeParticipants(ids, `${ids.length} guest${ids.length === 1 ? '' : 's'} removed.`);
  }

  async function keepOnePerPerson() {
    const ok = await confirm({
      title: `Leave one entry each for ${doubles.length} ${doubles.length === 1 ? 'person' : 'people'}?`,
      body:
        'Their member character is kept where they have one, otherwise the first by name — never whichever is winning. Dropping the losing character would quietly rewrite the standings.',
      confirmLabel: 'Leave one each',
    });
    if (!ok) return;
    await removeParticipants(surplus, `${surplus.length} extra ${surplus.length === 1 ? 'entry' : 'entries'} removed.`);
  }

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
    if (rebaseline) {
    const ok = await confirm({
      title: 'Reset every baseline?',
      body:
        'Each participant is re-anchored to their hiscores value right now, so every gain recorded so far is wiped and the competition effectively restarts.',
      confirmLabel: 'Reset baselines',
    });
    if (!ok) return;
    }
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

      {/* THE THING THE FANOUT CANNOT SEE. Enrollment walks seats, so one person with two characters
          is two entrants. Stated here rather than fixed silently: whether an alt should race is a
          decision about what this competition MEANS, and it belongs to whoever runs the clan. */}
      {mode === 'participants' && doubles.length > 0 && (
        <section className="rounded-xl border border-amber-400/40 bg-amber-400/[0.08] p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <span className="h-5 w-1 rounded-full bg-amber-400" />
            {doubles.length} {doubles.length === 1 ? 'person is' : 'people are'} entered more than once
          </h2>
          <p className="mb-3 text-sm text-amber-100/90">
            Entry is per character, so somebody whose main is on the roster and whose alt turned up as
            a guest is racing themselves. They can take two places — and two prizes.
          </p>
          <ul className="mb-3 space-y-1.5">
            {doubles.slice(0, 6).map((d) => (
              <li key={d.playerId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                {d.seats.map((seat, i) => (
                  <span key={seat.participantId} className="flex items-baseline gap-1.5">
                    {i > 0 && <span className="text-amber-200/50">+</span>}
                    <span className={i === 0 ? 'font-medium' : 'text-amber-100/80'}>{seat.rsn}</span>
                    <span className="text-[10px] uppercase tracking-wide text-amber-200/60">
                      {seat.kind ?? 'seat'}
                    </span>
                  </span>
                ))}
              </li>
            ))}
            {doubles.length > 6 && (
              <li className="text-xs text-amber-200/70">and {doubles.length - 6} more</li>
            )}
          </ul>
          <button
            type="button"
            onClick={keepOnePerPerson}
            disabled={busy}
            className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/15 disabled:opacity-50"
          >
            Leave one entry each
          </button>
        </section>
      )}

      <section className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-card-border flex-wrap">
          <h2 className="flex flex-wrap items-baseline gap-2 text-sm font-bold">
            <span>
              {standings.length} {standings.length === 1 ? 'entry' : 'entries'}
            </span>
            {enteredGuests.length > 0 && (
              <span className="text-[11px] font-normal text-text-muted">
                {enteredGuests.length} guest{enteredGuests.length === 1 ? '' : 's'}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {/* The blanket includeGuests switch is decided once, at creation, and never revisited.
                This is the other half: drop the guests after the fact without re-typing the name of
                every member you did want. */}
            {mode === 'participants' && enteredGuests.length > 0 && (
              <button
                type="button"
                onClick={dropEveryGuest}
                disabled={busy}
                className="whitespace-nowrap rounded-lg border border-card-border px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
              >
                Drop all guests
              </button>
            )}
            {message && <span className="text-xs text-text-muted">{message}</span>}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a name…"
              className="rounded-lg py-1.5 text-xs"
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
                      {row.kind === 'guest' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 whitespace-nowrap">
                          guest
                        </span>
                      )}
                      {surplusIds.has(row.participantId) && (
                        <span
                          title="Another character of the same person is already entered"
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 whitespace-nowrap"
                        >
                          2nd entry
                        </span>
                      )}
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
                        <Input
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          autoFocus
                          className="w-28 border-gold px-2 py-1 text-right text-xs"
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
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {row.left ? (
                          <button
                            type="button"
                            onClick={() => toggleKeep(row)}
                            disabled={busy}
                            title="They left the clan mid-competition — does their score still count?"
                            className="px-2 py-1 text-xs rounded-md border border-card-border hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
                          >
                            {row.keepIfLeft ? 'Drop' : 'Keep in'}
                          </button>
                        ) : (
                          <span className="text-xs text-text-muted/60">
                            {row.gained > 0 ? 'scoring' : 'no gain yet'}
                          </span>
                        )}
                        {/* Removal, which had no control at all: the fanout could add everybody and
                            the add box could add anybody, and nothing could take one entrant out. */}
                        <button
                          type="button"
                          onClick={() => removeOne(row)}
                          disabled={busy}
                          aria-label={`Remove ${row.rsn} from this competition`}
                          title="Take them out of this competition"
                          className="px-2 py-1 text-xs rounded-md border border-card-border text-text-muted/70 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </span>
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
