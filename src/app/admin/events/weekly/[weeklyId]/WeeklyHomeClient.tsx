'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EventStage } from '@/lib/eventStage';
import type { WeeklyCounts } from '@/lib/weeklyStage';
import type { WeeklyStanding } from '@/lib/weeklyWorkspace';
import { STAGE_BLURB } from '@/lib/eventStage';
import { weeklyGain, weeklyMetricLabel } from '@/lib/weeklyLabels';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';
import WeeklyPrizeEditor from './WeeklyPrizeEditor';
import { totalPrizeGp, type WeeklyPrizes } from '@/lib/weeklyPrizes';
import { formatGp } from '@/lib/adminEventsFormat';
import { useDialog } from '@/components/Confirm';

/** Everything the prize card needs. */
interface PrizeContext {
  initial: WeeklyPrizes;
  cofferAvailable: number;
  settledAt: string | null;
  canEdit: boolean;
  /** False when the clan has never moved gp — the card says so rather than hiding. */
  hasCoffer: boolean;
}

interface Comp {
  id: number;
  title: string;
  type: string;
  metric: string;
  startDate: string;
  endDate: string;
  status: string;
}

/**
 * A weekly's home, in the same three stages a board event has.
 *
 * Before it opens the job is enrolment and baselines; while it runs it's the leaderboard and
 * whichever gains look wrong; once it's over it's the winner and telling people.
 */
export default function WeeklyHomeClient({
  comp,
  stage,
  standings,
  counts,
  prizes,
}: {
  comp: Comp;
  stage: EventStage;
  standings: WeeklyStanding[];
  counts: WeeklyCounts;
  prizes: PrizeContext;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { confirm } = useDialog();
  const [message, setMessage] = useState('');

  const base = `/admin/events/weekly/${comp.id}`;
  const ranked = standings.filter((s) => !s.left || s.keepIfLeft);
  const podium = ranked.slice(0, 3);
  const missingBaselines = Math.max(0, counts.participants - counts.withBaseline);
  // What this competition currently promises to pay. Zero is a legitimate answer, not an omission.
  const prizeTotal = totalPrizeGp(prizes.initial);

  async function refresh(rebaseline = false) {
    if (rebaseline) {
    const ok = await confirm({
      title: 'Reset every baseline?',
      body:
        'Each participant is re-anchored to their hiscores value right now, so every gain recorded so far is wiped and the competition effectively restarts.',
      confirmLabel: 'Reset baselines',
    });
    if (!ok) return;
    }
    setRefreshing(true);
    setMessage('');
    try {
      const res = await clanFetch(`/api/admin/weekly/${comp.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebaseline }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Updated ${data.updated ?? 0} players.` : data.error || 'Refresh failed.');
      if (res.ok) router.refresh();
    } catch {
      setMessage('Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted -mt-2">{STAGE_BLURB[stage]}</p>

      {stage === 'build' && (
        <section className="border border-gold/30 rounded-xl bg-card-bg p-5 bg-gradient-to-br from-gold/[0.07] to-transparent">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Before it starts
          </h2>
          <div className="space-y-2">
            <ReadyRow
              done={counts.participants > 0}
              title={counts.participants > 0 ? `${counts.participants} people entered` : 'Nobody entered yet'}
              detail="Everyone on the roster is swept in automatically when the competition is created."
              href={`${base}/participants`}
              action="Roster"
            />
            <ReadyRow
              done={missingBaselines === 0 && counts.participants > 0}
              title={
                missingBaselines === 0 && counts.participants > 0
                  ? 'Everyone has a starting line'
                  : `${missingBaselines} without a baseline`
              }
              detail="Baselines are taken from the hiscores when it starts — you can capture them early."
              href={`${base}/baselines`}
              action="Baselines"
            />
            {/* THE ONLY ROW THAT IS A DECISION. The two above happen on their own — the roster is
                swept in at creation and the hiscores are read when it opens — so a checklist made
                of just those two is a checklist with nothing on it. Prizes are set here rather than
                on the create form, which means a competition can be made and run without anybody
                being told this page is where the money is decided. Optional, and said so: most
                clans pay nothing and should not see a red mark for it. */}
            <ReadyRow
              done={prizeTotal > 0}
              optional
              title={
                prizeTotal > 0
                  ? `Paying ${formatGp(prizeTotal)} gp`
                  : prizes.canEdit
                    ? 'No prizes set'
                    : 'No prizes set — a treasurer decides'
              }
              detail={
                prizes.canEdit
                  ? 'Set what each place pays out of the coffer. Leave it empty if this one is for bragging rights.'
                  : 'Only a treasurer or an admin can price a competition.'
              }
              href={`${base}#prizes`}
              action={prizes.canEdit ? 'Set prizes' : 'View'}
            />
          </div>
          <p className="text-xs text-text-muted mt-4">
            Starts <span suppressHydrationWarning>{new Date(comp.startDate).toLocaleString()}</span>. The lifecycle cron
            opens it on time — there&apos;s nothing to press.{' '}
            {/* The card states the start time, so it has to say where to change it — otherwise the
                answer is a rail item you have to already know about. */}
            <ClanLink href={`${base}/settings`} className="text-gold hover:underline">
              Wrong name or dates?
            </ClanLink>
          </p>
        </section>
      )}

      {counts.flagged > 0 && (
        <section className="border border-amber-400/40 rounded-xl bg-amber-400/10 p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="w-1 h-5 bg-amber-400 rounded-full" />
              Waiting on you
            </h2>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-400/20 text-amber-300">
              {counts.flagged} flagged
            </span>
          </div>
          <div className="space-y-2">
            {standings
              .filter((s) => s.flagged)
              .slice(0, 4)
              .map((s) => (
                <div key={s.participantId} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/20">
                  <span className="text-sm font-medium min-w-0 flex-1 truncate">{s.rsn}</span>
                  <span className="text-xs text-amber-300/90 truncate max-w-[50%]">{s.flagReason ?? 'implausible gain'}</span>
                </div>
              ))}
          </div>
          <p className="text-xs text-amber-200/80 mt-3">
            Usually the hiscores flushing a pre-competition grind on logout. Fixing the baseline puts the gain back
            where it belongs.
          </p>
          <ClanLink
            href={`${base}/baselines`}
            className="inline-block mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-400/20 text-amber-200 hover:bg-amber-400/30 transition-colors"
          >
            Fix baselines
          </ClanLink>
        </section>
      )}

      {stage === 'wrap' && podium.length > 0 && (
        <section className="border border-card-border rounded-xl bg-card-bg p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Winner
          </h2>
          <div className="grid grid-cols-3 gap-2 items-end">
            {[podium[1], podium[0], podium[2]].map((row, i) =>
              row ? (
                <div
                  key={row.participantId}
                  className={`rounded-lg border p-3 text-center ${
                    i === 1
                      ? 'border-gold/40 bg-gradient-to-b from-gold/15 to-gold/[0.04] pb-5'
                      : 'border-card-border bg-black/15'
                  }`}
                >
                  <div className="text-lg">{i === 1 ? '🥇' : i === 0 ? '🥈' : '🥉'}</div>
                  <div className="text-sm font-semibold mt-1 truncate">{row.rsn}</div>
                  <div className={`text-xs tabular-nums ${i === 1 ? 'text-gold' : 'text-text-muted'}`}>
                    {weeklyGain(comp.type, row.gained)}
                  </div>
                </div>
              ) : (
                <div key={`empty-${i}`} />
              ),
            )}
          </div>
        </section>
      )}

      <WeeklyPrizeEditor
        competitionId={comp.id}
        initial={prizes.initial}
        cofferAvailable={prizes.cofferAvailable}
        settledAt={prizes.settledAt}
        canEdit={prizes.canEdit}
        hasCoffer={prizes.hasCoffer}
      />

      <section className="border border-card-border rounded-xl bg-card-bg p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            {stage === 'wrap' ? 'Final leaderboard' : 'Leaderboard'}
          </h2>
          <span className="text-xs text-text-muted">
            {weeklyMetricLabel(comp.type, comp.metric)} gained · {counts.moving} of {counts.participants} scoring
          </span>
        </div>

        {ranked.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody is enrolled yet.</p>
        ) : (
          <div className="divide-y divide-card-border max-h-[28rem] overflow-y-auto">
            {ranked.slice(0, 25).map((row, i) => (
              <div key={row.participantId} className="grid grid-cols-[22px_1fr_auto] gap-3 items-center py-2 text-sm">
                <span className="text-xs text-text-muted/70 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex items-center gap-2">
                  <span className="truncate">{row.rsn}</span>
                  {row.flagged && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 flex-shrink-0">
                      flagged
                    </span>
                  )}
                  {row.left && row.keepIfLeft && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-text-muted flex-shrink-0">
                      left the clan
                    </span>
                  )}
                </span>
                <span className={`tabular-nums text-xs ${i === 0 ? 'text-gold' : 'text-text-muted'}`}>
                  {row.gained > 0 ? weeklyGain(comp.type, row.gained) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-card-border flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refresh(false)}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Pulling hiscores…' : 'Refresh now'}
          </button>
          <ClanLink
            href={`${base}/participants`}
            className="px-3 py-1.5 text-xs rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
          >
            Manage participants
          </ClanLink>
          <ClanLink
            href={`/weekly/${comp.id}`}
            className="px-3 py-1.5 text-xs rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
          >
            Player view ↗
          </ClanLink>
          {message && <span className="text-xs text-text-muted">{message}</span>}
        </div>
        <p className="text-[11px] text-text-muted/70 mt-2">
          Stats refresh themselves every 15 minutes — this is for when you don&apos;t want to wait.
        </p>
      </section>
    </div>
  );
}

function ReadyRow({
  done,
  title,
  detail,
  href,
  action,
  optional = false,
}: {
  done: boolean;
  title: string;
  detail: string;
  href: string;
  action: string;
  /** Nothing is wrong if this one is never ticked — most clans pay nothing. */
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-card-border bg-black/15">
      <span
        className={`w-6 h-6 rounded-full grid place-items-center text-xs flex-shrink-0 border ${
          done
            ? 'border-accent-green/50 text-accent-green bg-accent-green/10'
            : optional
              ? 'border-card-border/60 text-text-muted/50'
              : 'border-card-border text-text-muted'
        }`}
      >
        {done ? '✓' : optional ? '–' : '·'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-text-muted">{detail}</span>
      </span>
      <ClanLink
        href={href}
        className="px-2.5 py-1 text-xs rounded-lg border border-card-border hover:border-gold/50 hover:text-gold transition-colors whitespace-nowrap"
      >
        {action}
      </ClanLink>
    </div>
  );
}
