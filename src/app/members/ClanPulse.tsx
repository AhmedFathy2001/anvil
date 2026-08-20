'use client';

import { ActivityHeatmap } from '@/components/stats/Charts';
import type { ClanAnalytics, MemberListRow, RosterEvent } from '@/lib/memberProfile';
import ClanLink from '@/components/ClanLink';

// The clan above the roster: what's happening THIS WEEK first, what it all adds up to second. All of
// it comes off the same daily rows the profiles use — no extra queries per member, so this costs the
// same for forty members as for four hundred.
//
// The ordering is the point. This used to open with four identical stat tiles and a year-long
// heatmap: true, but static — a page you read once and never again. Leading with the week's leader,
// the margin, and a podium gives the same data a reason to be checked on a Tuesday.

const EVENT_COPY: Record<string, { verb: string; tone: string }> = {
  joined: { verb: 'joined', tone: 'text-accent-green-light' },
  returned: { verb: 'came back', tone: 'text-accent-green-light' },
  left: { verb: 'left', tone: 'text-text-muted' },
  rank_changed: { verb: 'rank changed', tone: 'text-gold' },
  renamed: { verb: 'renamed', tone: 'text-gold' },
};

/** Timeline dot colour per event — arrivals read as good news, admin changes as neutral gold. */
const EVENT_DOT: Record<string, string> = {
  joined: 'bg-accent-green-light',
  returned: 'bg-accent-green-light',
  rank_changed: 'bg-gold',
  renamed: 'bg-gold',
  left: 'bg-card-border',
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

/** First letters of the name, for the podium crest. */
function initials(rsn: string): string {
  const parts = rsn.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((w) => w[0]).join('') || rsn.slice(0, 1)).toUpperCase();
}

function Chip({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-card-border rounded-lg bg-brown-dark/60 px-3.5 py-2 min-w-[5.5rem]">
      <div className="text-xl font-bold text-gold tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

/**
 * The week in one sentence.
 *
 * Deliberately not a template with blanks: a clan with one active member, or a dead week, or a
 * runaway leader are different stories, and a single phrasing would be wrong for two of the three.
 */
function headline(
  topWeek: { rsn: string; hours: number }[],
  allTimeLeader: MemberListRow | null,
): { lead: string; hours: string | null; tail: string; sub: string | null } {
  if (topWeek.length === 0) {
    return {
      lead: 'Quiet week on the hiscores —',
      hours: null,
      tail: 'nobody has banked an efficient hour yet.',
      sub: allTimeLeader ? `${allTimeLeader.rsn} still leads all-time with ${Math.round(allTimeLeader.ehp ?? 0)} EHP.` : null,
    };
  }

  const [first, second] = topWeek;
  const margin = second ? first.hours - second.hours : first.hours;
  const runaway = !second || margin > first.hours * 0.25;

  const sub =
    allTimeLeader && allTimeLeader.rsn !== first.rsn
      ? `${allTimeLeader.rsn} still owns the all-time board at ${Math.round(allTimeLeader.ehp ?? 0)} EHP.`
      : second
        ? `${second.rsn} is second on ${second.hours.toFixed(1)}h.`
        : null;

  return {
    lead: `${first.rsn} ${runaway ? 'is running away with the week —' : 'leads the week —'}`,
    hours: `${first.hours.toFixed(1)}h`,
    tail: second ? `forged, ${margin.toFixed(1)}h clear of ${second.rsn}.` : 'forged, and nobody else is close.',
    sub,
  };
}

export default function ClanPulse({
  analytics,
  members,
  rosterLog,
}: {
  analytics: ClanAnalytics;
  members: MemberListRow[];
  rosterLog: RosterEvent[];
}) {
  const { memberCount, guestCount, totalEhp, totalEhb, activity, topWeek, activeThisWeek, activeToday } = analytics;
  const hasActivity = activity.some((a) => a.value > 0);

  const allTimeLeader = members.reduce<MemberListRow | null>(
    (best, m) => ((m.ehp ?? 0) > (best?.ehp ?? -1) ? m : best),
    null,
  );
  const story = headline(topWeek, allTimeLeader);

  const podium = topWeek.slice(0, 3);
  const chasers = topWeek.slice(3);
  const chaseMax = Math.max(...topWeek.map((t) => t.hours), 0.01);

  // 2nd, 1st, 3rd — a podium reads from the middle out, not left to right.
  const order = [1, 0, 2].filter((i) => podium[i]);
  const plinth = ['h-[4.75rem] border-gold-dark', 'h-14', 'h-10'];

  return (
    <div className="mb-8">
      {/* ── The week, stated ─────────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-xl border border-card-border p-5 sm:p-6 mb-4"
        style={{
          background:
            'radial-gradient(120% 140% at 12% -20%, rgba(212,160,23,.16), transparent 55%), radial-gradient(90% 120% at 90% 0%, rgba(255,106,43,.09), transparent 60%), var(--card-bg)',
        }}
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex-1 min-w-[18rem]">
            {activeToday > 0 && (
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-orange-400">
                <span className="w-[7px] h-[7px] rounded-full bg-orange-400 animate-pulse" aria-hidden />
                {activeToday} playing today
              </span>
            )}
            <h2 className="text-xl sm:text-2xl font-bold leading-snug mt-2 text-balance">
              {story.lead} {story.hours && <span className="text-gold-light tabular-nums">{story.hours}</span>}{' '}
              {story.tail}
            </h2>
            {story.sub && <p className="text-sm text-text-muted mt-2">{story.sub}</p>}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Chip value={(memberCount + guestCount).toLocaleString()} label="tracked" />
            <Chip value={activeThisWeek.toLocaleString()} label="active 7d" />
            <Chip value={Math.round(totalEhp).toLocaleString()} label="clan EHP" />
            <Chip value={Math.round(totalEhb).toLocaleString()} label="clan EHB" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 mb-4">
        {/* ── Podium ─────────────────────────────────────────────────────────────────────────── */}
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted">
            This week · hours forged
          </div>

          {podium.length === 0 ? (
            <p className="text-sm text-text-muted py-10 text-center">
              Nobody has gained hours yet this week.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 items-end mt-4">
                {order.map((i) => {
                  const t = podium[i];
                  const first = i === 0;
                  return (
                    <ClanLink
                      key={t.rsn}
                      href={`/members/${encodeURIComponent(t.rsn)}`}
                      className="text-center group"
                    >
                      <span
                        className={`mx-auto mb-2 grid place-items-center rounded-xl font-bold ${
                          first
                            ? 'w-14 h-14 text-xl text-brown-dark border border-gold-light'
                            : 'w-11 h-11 text-base text-gold border border-card-border bg-tile-bg'
                        }`}
                        style={
                          first
                            ? {
                                background: 'linear-gradient(140deg, var(--gold-light), var(--gold-dark))',
                                boxShadow: '0 0 26px -6px rgba(240,201,64,.55)',
                              }
                            : undefined
                        }
                        aria-hidden
                      >
                        {initials(t.rsn)}
                      </span>
                      <span className="block text-sm font-medium truncate group-hover:text-gold transition-colors">
                        {t.rsn}
                      </span>
                      <span className={`block font-bold text-gold tabular-nums ${first ? 'text-xl' : 'text-base'}`}>
                        {t.hours.toFixed(1)}h
                      </span>
                      <span
                        className={`block mt-2 rounded-t-lg border border-b-0 border-card-border pt-1.5 text-[11px] text-text-muted ${plinth[i]}`}
                        style={{ background: 'linear-gradient(180deg, var(--brown-light), transparent)' }}
                      >
                        {i === 0 ? '1st' : i === 1 ? '2nd' : '3rd'}
                      </span>
                    </ClanLink>
                  );
                })}
              </div>

              {chasers.length > 0 && (
                <div className="border-t border-card-border pt-3 space-y-1.5">
                  {chasers.map((t, i) => (
                    <ClanLink
                      key={t.rsn}
                      href={`/members/${encodeURIComponent(t.rsn)}`}
                      className="grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,6rem)_3.25rem] items-center gap-3 text-sm hover:text-gold"
                    >
                      <span className="text-text-muted/60 tabular-nums text-xs">{i + 4}</span>
                      <span className="truncate">{t.rsn}</span>
                      <span className="h-1.5 rounded-full bg-tile-bg overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (t.hours / chaseMax) * 100)}%`,
                            background: 'linear-gradient(90deg, var(--gold-dark), var(--gold))',
                          }}
                        />
                      </span>
                      <span className="text-right tabular-nums text-text-muted">{t.hours.toFixed(1)}h</span>
                    </ClanLink>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Roster changes, as a timeline ──────────────────────────────────────────────────── */}
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">Roster changes</div>
          {rosterLog.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">No joins or leaves recorded yet.</p>
          ) : (
            <ol className="relative pl-4 max-h-72 overflow-y-auto pr-1">
              <span className="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-card-border" aria-hidden />
              {rosterLog.map((e, i) => {
                const copy = EVENT_COPY[e.type] ?? { verb: e.type, tone: 'text-text-muted' };
                return (
                  <li key={`${e.at}-${e.rsn}-${i}`} className="relative pl-3 pb-3.5 text-sm">
                    <span
                      className={`absolute -left-[16px] top-[7px] w-[7px] h-[7px] rounded-full border-2 border-card-bg ${
                        EVENT_DOT[e.type] ?? 'bg-card-border'
                      }`}
                      aria-hidden
                    />
                    <span className="float-right text-[11px] text-text-muted tabular-nums pl-2">
                      {relativeDay(e.at)}
                    </span>
                    <ClanLink href={`/members/${encodeURIComponent(e.rsn)}`} className="text-gold hover:underline">
                      {e.rsn}
                    </ClanLink>{' '}
                    <span className={copy.tone}>{copy.verb}</span>
                    {e.detail && <span className="text-text-muted"> · {e.detail}</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* The year-long heatmap keeps the full width — 53 columns cannot be squeezed into a half
          column at a legible cell size — but it now sits BELOW the week, where a slow-moving
          background number belongs. */}
      <div className="border border-card-border rounded-xl bg-card-bg p-4">
        <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
          Clan activity · last 12 months
        </div>
        {hasActivity ? (
          // 53 columns don't fit a phone: scroll the grid inside its own card rather than clipping
          // the last months off the right edge.
          <div className="overflow-x-auto">
          <ActivityHeatmap
            days={activity}
            ariaLabel="Clan-wide efficient hours gained per day over the last 12 months"
          />
          </div>
        ) : (
          <p className="text-sm text-text-muted py-6 text-center">
            Nothing recorded yet — history starts building from the next hiscores sweep.
          </p>
        )}
      </div>
    </div>
  );
}
