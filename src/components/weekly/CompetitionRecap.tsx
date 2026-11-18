import type { CompetitionRecap, DeathTally, RecapDrop } from '@/lib/competitionRecap';
import type { CompetitionType } from '@/lib/competitionInsights';
import { ordinal } from '@/lib/yourTeam';

import { dateLabel, weekdayLabel, withUnit } from './format';

/**
 * A finished competition looked back on (lib/competitionRecap): the viewer's own week, the week in
 * numbers, who died where, and who was lucky. Each card leaves itself out when it has nothing to say,
 * so a skill week has no deaths card and an efficiency contest has only the numbers.
 */

const card = 'rounded-2xl border border-card-border bg-card-bg p-4 sm:p-5';
const heading = 'flex items-center gap-2 text-[17px] font-bold';
const bar = <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />;

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</div>
      {note && <div className="mt-0.5 truncate text-xs text-foreground/80">{note}</div>}
    </div>
  );
}

const splitWords = (t: DeathTally) => t.split.map((s) => `${s.count} ${s.source}`).join(', ');

/** The gold bar: the viewer's own week, now that it is over. */
export function RecapYourWeek({
  rsn,
  rank,
  of,
  gained,
  mine,
  days,
  type,
  unit,
}: {
  rsn: string;
  rank: number;
  of: number;
  gained: number;
  mine: NonNullable<CompetitionRecap['mine']>;
  days: string[];
  type: CompetitionType;
  unit: string;
}) {
  return (
    <section aria-label="Your week" className="mb-6 grid items-center gap-5 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4 sm:p-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold uppercase tracking-widest text-gold">Your week · {rsn}</div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-3xl font-bold leading-none tabular-nums">{ordinal(rank)}</span>
          <span className="text-sm text-text-muted">of {of.toLocaleString()}</span>
        </div>
        <div className="mt-2 text-sm tabular-nums text-foreground/90">+{withUnit(gained, type, unit)}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {mine.bestDay && <Stat label="Your best day" value={`+${withUnit(mine.bestDay.value, type, unit)}`} note={weekdayLabel(days[mine.bestDay.day])} />}
        {type !== 'efficiency' && <Stat label={type === 'skill' ? 'Pets' : 'Drops'} value={mine.drops.toLocaleString()} />}
        {type === 'boss' && <Stat label="Deaths" value={mine.deaths.toLocaleString()} />}
        {mine.killsPerDeath != null && <Stat label="Kills per death" value={mine.killsPerDeath.toLocaleString()} />}
      </div>
    </section>
  );
}

export function RecapNumbers({
  recap,
  clanTotal,
  days,
  type,
  unit,
}: {
  recap: CompetitionRecap;
  clanTotal: number;
  days: string[];
  type: CompetitionType;
  unit: string;
}) {
  const lead =
    recap.leadChanges == null || !recap.leader
      ? null
      : recap.leadChanges === 0
        ? { value: 'Never', note: `${recap.leader.rsn} led all the way` }
        : { value: recap.leadChanges === 1 ? 'Once' : `${recap.leadChanges} times`, note: `${recap.leader.rsn} led from ${weekdayLabel(days[recap.leader.sinceDay])}` };
  return (
    <section aria-label="The week in numbers" className={`${card} mb-6`}>
      <h2 className={heading}>
        {bar}
        The week in numbers
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={type === 'boss' ? 'Clan kills' : type === 'skill' ? 'Clan XP' : 'Clan hours'} value={withUnit(clanTotal, type, unit)} />
        {recap.biggestDay && <Stat label="Biggest day" value={`+${withUnit(recap.biggestDay.value, type, unit)}`} note={`${recap.biggestDay.rsn}, ${weekdayLabel(days[recap.biggestDay.day])}`} />}
        {lead && <Stat label="1st changed hands" value={lead.value} note={lead.note} />}
        {type !== 'efficiency' && recap.drops > 0 && (
          <Stat label={type === 'skill' ? 'Pets' : 'Drops'} value={recap.drops.toLocaleString()} note={type === 'boss' && recap.pets > 0 ? `${recap.pets} ${recap.pets === 1 ? 'pet' : 'pets'}` : null} />
        )}
        {recap.deaths > 0 && <Stat label="Deaths" value={recap.deaths.toLocaleString()} note={recap.killsPerDeath != null ? `one every ${recap.killsPerDeath.toLocaleString()} kills` : null} />}
      </div>
    </section>
  );
}

const MEDAL = ['text-gold-light', 'text-foreground/80', 'text-[#d9a273]'];

/** Who died where. The top three stand together, so nobody carries it alone. */
export function RecapDeaths({ board, metricLabel }: { board: NonNullable<CompetitionRecap['deathBoard']>; metricLabel: string }) {
  return (
    <section aria-label="Deaths" className={`${card} mb-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={heading}>
          {bar}
          Deaths
        </h2>
        <span className="text-xs text-text-muted">at {metricLabel}</span>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {board.top.map((t, i) => (
          <div key={t.rsn} className="min-w-0 rounded-xl border border-card-border p-3 text-center">
            <div className={`text-[11px] font-bold uppercase tracking-widest ${MEDAL[i]}`}>{ordinal(i + 1)}</div>
            <div className="mt-1 truncate text-base font-bold">
              {t.rsn}
              {t.mine && <span className="ml-1.5 text-[10px] font-bold text-accent-green">YOU</span>}
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-red-300">{t.count.toLocaleString()}</div>
            {t.split.length > 1 && <div className="mt-0.5 truncate text-xs text-text-muted">{splitWords(t)}</div>}
          </div>
        ))}
      </div>
      {board.me && (
        <p className="mt-3 text-sm text-foreground/90">
          You died {board.me.count === 1 ? 'once' : `${board.me.count} times`}
          {board.me.split.length > 1 ? `: ${splitWords(board.me)}.` : board.me.split[0] ? ` to ${board.me.split[0].source}.` : '.'}
        </p>
      )}

      {board.bySource.length > 1 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-card-border text-xs text-text-muted">
                <th className="py-2 pr-3 font-semibold">Boss</th>
                <th className="py-2 pr-3 text-right font-semibold">Deaths</th>
                <th className="py-2 font-semibold">Died most</th>
              </tr>
            </thead>
            <tbody>
              {board.bySource.map((s) => (
                <tr key={s.source} className="border-b border-card-border/60">
                  <td className="py-2 pr-3 font-semibold">{s.source}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{s.deaths.toLocaleString()}</td>
                  <td className="py-2">
                    {s.most.rsn} <span className="text-text-muted">· {s.most.count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 space-y-1 text-sm text-foreground/90">
        {board.cleanest && (
          <p>
            <b>Cleanest week:</b> {board.cleanest.rsn}, {board.cleanest.kills.toLocaleString()} kills and{' '}
            {board.cleanest.deaths === 0 ? 'no deaths' : board.cleanest.deaths === 1 ? '1 death' : `${board.cleanest.deaths} deaths`}.
          </p>
        )}
        {board.worstDay && (
          <p>
            <b>Worst day:</b> {board.worstDay.rsn} died {board.worstDay.count} times{board.worstDay.source ? ` to ${board.worstDay.source}` : ''} on {weekdayLabel(board.worstDay.day)}.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-text-muted">Deaths are counted for players running the plugin.</p>
    </section>
  );
}

function DropLine({ d }: { d: RecapDrop }) {
  const detail = [d.rarity && d.rarity >= 100 ? `1 in ${d.rarity.toLocaleString()}` : null, d.kc ? `${d.kc.toLocaleString()} KC` : null].filter(Boolean).join(' · ');
  return (
    <li className="flex items-baseline justify-between gap-3 border-t border-card-border/60 py-2 text-sm">
      <span className="min-w-0">
        <b>{d.rsn}</b> got {d.itemName}
        {d.source ? ` from ${d.source}` : ''}
        {detail && <span className="ml-1.5 text-text-muted">{detail}</span>}
      </span>
      <span className="shrink-0 text-xs text-text-muted">{dateLabel(d.day)}</span>
    </li>
  );
}

function Fact({ label, who, note }: { label: string; who: string; note: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-card-border p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 truncate text-[15px] font-semibold">{who}</div>
      <div className="truncate text-xs text-foreground/80">{note}</div>
    </div>
  );
}

/** Luckiest and driest read the same on a boss week and on an item hunt. */
export function LuckFacts({ rarest, luckiest, driest }: { rarest?: RecapDrop | null; luckiest: { rsn: string; drops: number; kills: number } | null; driest: { rsn: string; kills: number } | null }) {
  if (!rarest && !luckiest && !driest) return null;
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {rarest && <Fact label="Rarest drop" who={rarest.rsn} note={`${rarest.itemName}, 1 in ${(rarest.rarity ?? 0).toLocaleString()}`} />}
      {luckiest && <Fact label="Luckiest" who={luckiest.rsn} note={`${luckiest.drops} ${luckiest.drops === 1 ? 'drop' : 'drops'} in ${luckiest.kills.toLocaleString()} kills`} />}
      {driest && <Fact label="Driest" who={driest.rsn} note={`${driest.kills.toLocaleString()} kills, no drop`} />}
    </div>
  );
}

export function RecapLuck({ luck, total, feedHref, pets }: { luck: NonNullable<CompetitionRecap['luck']>; total: number; feedHref: React.ReactNode; pets: boolean }) {
  return (
    <section aria-label="Drops and luck" className={`${card} mb-6`}>
      <h2 className={heading}>
        {bar}
        {pets ? 'Pets' : 'Drops and luck'}
      </h2>
      <div className="mt-3">
        <LuckFacts rarest={luck.rarest} luckiest={luck.luckiest} driest={luck.driest} />
      </div>
      <ul className="mt-3">
        {luck.list.map((d, i) => (
          <DropLine key={`${d.rsn}-${d.itemName}-${d.day}-${i}`} d={d} />
        ))}
      </ul>
      {total > luck.list.length && <div className="mt-2 text-sm">{feedHref}</div>}
    </section>
  );
}
