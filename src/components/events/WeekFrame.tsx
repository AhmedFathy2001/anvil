import EventTimer from '@/components/EventTimer';
import CompetitionCard, { WeekGlyph } from '@/components/events/CompetitionCard';
import { hubKind } from '@/lib/hubKinds';
import { totalDays } from '@/lib/competitionInsights';
import { weeklyValueText } from '@/lib/eventsHub';
import type { WeeklyCard } from '@/lib/weeklyCards';

/**
 * The weeks that are running, under one header.
 *
 * A clan can run three weeklies at once, and they are not three unrelated events: they start
 * together, end together and are read together. So they share a frame and one countdown — but each
 * one is still a full card, because a Skill of the Week is not a sub-item of anything. Collapsing
 * them into rows beside the boards' cards was the version that read as "weeks are the small ones".
 *
 * Several windows at once is a real (if rare) state — a fortnight-long boss race overlapping the
 * weeks — so the frame groups by window rather than assuming one.
 */

const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function WeekFrame({ weeks }: { weeks: WeeklyCard[] }) {
  if (weeks.length === 0) return null;

  // Group by the window they share. Same start and end = same week.
  const windows = new Map<string, WeeklyCard[]>();
  for (const w of weeks) {
    const key = `${w.startDate}|${w.endDate}`;
    windows.set(key, [...(windows.get(key) ?? []), w]);
  }

  return (
    <div className="space-y-4">
      {[...windows.values()].map((group) => {
        const [first] = group;
        return (
          <section
            key={`${first.startDate}|${first.endDate}`}
            className="rounded-2xl border border-blue-400/25 bg-blue-400/[0.04] p-3 sm:p-4"
          >
            <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
              <h3 className="text-sm font-bold">
                {group.length === 1 ? 'This week' : `This week · ${group.length} running`}
              </h3>
              <span className="text-[11.5px] text-text-muted">
                {dateShort(first.startDate)} – {dateShort(first.endDate)}
              </span>
              <span className="ml-auto text-[11.5px]">
                <EventTimer
                  startDate={first.startDate}
                  endDate={first.endDate}
                  className="text-[11.5px] text-text-muted"
                />
              </span>
            </header>

            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(272px,1fr))]">
              {group.map((w) => (
                <CompetitionCard
                  key={w.id}
                  kind={w.kind}
                  href={`/weekly/${w.id}`}
                  name={w.name}
                  shape={`${w.metricLabel} · ${w.unit}`}
                  state={w.state}
                  startDate={w.startDate}
                  endDate={w.endDate}
                  entrants={`${w.entrants} entered`}
                  top={
                    w.top
                      ? {
                          name: w.top.tied ? `${w.top.rsn} (tied)` : w.top.rsn,
                          text: weeklyValueText(w.unit, w.top.value),
                        }
                      : null
                  }
                  glyph={<WeekGlyph days={w.days} totalDays={totalDays(w.startDate, w.endDate)} accent={hubKind(w.kind).accent} />}
                  iconUrl={w.iconUrl}
                  hideTimer
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
