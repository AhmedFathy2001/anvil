'use client';

import Link from 'next/link';
import { ActivityHeatmap, Bar } from '@/components/stats/Charts';
import type { ClanAnalytics, RosterEvent } from '@/lib/memberProfile';

// The clan above the roster: what it adds up to, when it's actually playing, and who's been at it
// this week. All of it comes off the same daily rows the profiles use — no extra queries per member,
// so this costs the same for forty members as for four hundred.

const EVENT_COPY: Record<string, { verb: string; tone: string }> = {
  joined: { verb: 'joined', tone: 'text-accent-green-light' },
  returned: { verb: 'came back', tone: 'text-accent-green-light' },
  left: { verb: 'left', tone: 'text-text-muted' },
  rank_changed: { verb: 'rank changed', tone: 'text-gold' },
  renamed: { verb: 'renamed', tone: 'text-gold' },
};

function relativeDay(iso: string): string {
  const then = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3">
      <div className="text-[11px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="text-xl font-bold text-gold tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ClanPulse({
  analytics,
  rosterLog,
}: {
  analytics: ClanAnalytics;
  rosterLog: RosterEvent[];
}) {
  const { memberCount, guestCount, totalEhp, totalEhb, activity, topWeek, activeThisWeek } = analytics;
  const hasActivity = activity.some((a) => a.value > 0);
  const tracked = memberCount + guestCount;
  const topHours = Math.max(...topWeek.map((t) => t.hours), 0.01);

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Tile label="Members" value={memberCount.toLocaleString()} sub={guestCount > 0 ? `+ ${guestCount} guests` : undefined} />
        <Tile
          label="Active this week"
          value={activeThisWeek.toLocaleString()}
          // Against everyone TRACKED, not just full members: guests show up in the activity rows too,
          // so dividing by the member count alone reported more than 100% of the clan playing.
          sub={tracked > 0 ? `${Math.round((activeThisWeek / tracked) * 100)}% of those tracked` : undefined}
        />
        <Tile label="Clan EHP" value={Math.round(totalEhp).toLocaleString()} sub="hours skilled" />
        <Tile label="Clan EHB" value={Math.round(totalEhb).toLocaleString()} sub="hours bossed" />
      </div>

      {/* Activity gets the full width: a year is 53 columns, which cannot fit a half-width column at
          a legible cell size — squeezing it produced a horizontal scrollbar inside a card, which is
          the worst of both (smaller AND hidden). The two shorter lists sit below it instead. */}
      <div className="border border-card-border rounded-xl bg-card-bg p-4 mb-4">
        <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
          Clan activity · last 12 months
        </div>
        {hasActivity ? (
          <ActivityHeatmap
            days={activity}
            ariaLabel="Clan-wide efficient hours gained per day over the last 12 months"
          />
        ) : (
          <p className="text-sm text-text-muted py-6 text-center">
            Nothing recorded yet — history starts building from the next hiscores sweep.
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
            Most hours this week
          </div>
          {topWeek.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">Nobody has gained hours yet this week.</p>
          ) : (
            <div className="space-y-2">
              {topWeek.map((t) => (
                <Link
                  key={t.rsn}
                  href={`/members/${encodeURIComponent(t.rsn)}`}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)_3.5rem] items-center gap-3 text-sm hover:text-gold"
                >
                  <span className="truncate">{t.rsn}</span>
                  <Bar value={t.hours} max={topHours} />
                  <span className="text-right tabular-nums text-text-muted">{t.hours.toFixed(1)}h</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">Roster changes</div>
          {rosterLog.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">No joins or leaves recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rosterLog.map((e, i) => {
                const copy = EVENT_COPY[e.type] ?? { verb: e.type, tone: 'text-text-muted' };
                return (
                  <div key={`${e.at}-${e.rsn}-${i}`} className="text-sm flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <Link href={`/members/${encodeURIComponent(e.rsn)}`} className="hover:text-gold">
                        {e.rsn}
                      </Link>{' '}
                      <span className={copy.tone}>{copy.verb}</span>
                      {e.detail && <span className="text-text-muted"> · {e.detail}</span>}
                    </span>
                    <span className="text-[11px] text-text-muted shrink-0">{relativeDay(e.at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
