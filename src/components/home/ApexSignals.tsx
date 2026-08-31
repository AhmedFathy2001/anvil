import ClanLink from '@/components/ClanLink';
import type { Arena, Career, NextMilestone, RecentMilestone, Seat, Streak } from '@/lib/apexHomeSignals';
import type { PlayerStanding } from '@/lib/clanLeaderboard';
import { compactXp } from '@/lib/apexHomeSignals';
import { milestoneMetricLabel } from '@/lib/constants';
import { activityFor } from '@/lib/hiscoresActivities';

/**
 * The apex home's "how am I doing" half.
 *
 * WHY THESE SHAPES. The page before this was five blocks of equal weight, each a heading over a
 * list, which is a page with no first thing to look at — and between events every one of those
 * lists was empty. Priority here is carried by SIZE and GROUND rather than by a repeated accent
 * bar: the arena glows and is large, the roster sits on the page ground, the career well is inset.
 * That gives the eye an order without a single extra label.
 */

// ── Section label ────────────────────────────────────────────────────────────────────────────────

/**
 * A quiet rule, not another accent bar.
 *
 * The old page put a gold tab beside five consecutive headings, which made every section look
 * equally important — the definition of the problem. These separate without competing, so the one
 * block that IS important can look it.
 */
export function Label({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="font-mono text-[0.64rem] font-medium uppercase tracking-[0.2em] whitespace-nowrap text-text-dim">
        {children}
      </h2>
      <span className="h-px flex-1 bg-card-border-soft" />
      {action}
    </div>
  );
}

// ── The arena ────────────────────────────────────────────────────────────────────────────────────

function hoursLeft(endDate: string): string {
  const ms = Date.parse(endDate.includes('T') ? endDate : endDate.replace(' ', 'T') + 'Z') - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'ending now';
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d ${h % 24}h left`;
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
};

/**
 * The live competition, as a race rather than a row.
 *
 * The standing used to be one line of text in a list. It is the most engaging thing the site knows
 * about you, so it gets the whole top of the page and an actual track: proportional bars against
 * the leader, so the gap is SEEN rather than described. A number you have to do arithmetic on is
 * not a motivator.
 */
export function ArenaHero({ arena }: { arena: Arena }) {
  const leader = Math.max(...arena.lanes.map((l) => l.gained), arena.gained, 1);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-card-border p-5 sm:p-7"
      style={{
        background:
          'radial-gradient(120% 100% at 8% 0%, rgba(210,104,60,0.15), transparent 55%),' +
          'radial-gradient(90% 90% at 100% 100%, rgba(224,170,30,0.08), transparent 60%),' +
          'linear-gradient(170deg, var(--card-bg-hover), var(--card-bg))',
      }}
    >
      {/* A hairline of heat. The forge is the product's own metaphor and the page never used it —
          stated once, here, and nowhere else. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #d2683c, var(--gold), transparent)' }}
      />

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[#d2683c]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live now · {arena.clanName}
          </p>
          <h2 className="display display-lg mt-2 text-[clamp(1.7rem,4vw,2.4rem)] font-semibold leading-[1.05]">
            {arena.title}
          </h2>
          <p className="mt-1 text-sm text-text-dim">
            {arena.fieldSize} racing · {hoursLeft(arena.endDate)}
          </p>
        </div>

        {/* Scale contrast IS the hierarchy: one enormous numeral, everything else small. */}
        <div className="ml-auto shrink-0 text-right">
          <div
            className="display text-[clamp(3.2rem,8vw,5rem)] font-bold leading-[0.85] tabular-nums"
            style={{
              background: 'linear-gradient(160deg, var(--foreground) 20%, var(--gold) 90%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {arena.position}
            <sup className="text-[0.28em] align-super text-gold-dark">{ordinal(arena.position)}</sup>
          </div>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-dim">
            of {arena.fieldSize}
          </p>
        </div>
      </div>

      <ol className="mt-6 flex flex-col gap-1.5">
        {arena.lanes.map((lane) => (
          <li
            key={`${lane.position}-${lane.rsn}`}
            className="grid grid-cols-[1.4rem_minmax(0,8rem)_1fr_4.2rem] items-center gap-3"
          >
            <span className={`text-right font-mono text-xs ${lane.you ? 'text-gold' : 'text-text-dim'}`}>
              {lane.position}
            </span>
            <span
              className={`truncate text-sm ${lane.you ? 'font-semibold text-foreground' : 'text-text-muted'}`}
            >
              {lane.rsn}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-black/40">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(3, Math.round((lane.gained / leader) * 100))}%`,
                  background: lane.you
                    ? 'linear-gradient(90deg, #d2683c, var(--gold))'
                    : 'linear-gradient(90deg, var(--gold-dark), #b98f43)',
                  boxShadow: lane.you ? '0 0 16px rgba(224,170,30,0.28)' : undefined,
                }}
              />
            </span>
            <span
              className={`text-right font-mono text-xs tabular-nums ${lane.you ? 'text-gold' : 'text-text-dim'}`}
            >
              {compactXp(lane.gained)}
            </span>
          </li>
        ))}
      </ol>

      {(arena.gapAhead !== null || arena.gapBehind !== null) && (
        <p className="mt-5 flex flex-wrap items-baseline gap-2 border-t border-card-border pt-4 text-sm text-text-muted">
          {arena.gapAhead !== null ? (
            <>
              <b className="display text-xl font-semibold text-gold">{compactXp(arena.gapAhead)}</b>
              <span>to {arena.position - 1}{ordinal(arena.position - 1)}</span>
            </>
          ) : (
            <span className="text-gold">Leading the field.</span>
          )}
          {arena.gapBehind !== null && (
            <>
              <span className="text-card-border">·</span>
              <span className="text-text-dim">
                {compactXp(arena.gapBehind)} clear of {arena.position + 1}
                {ordinal(arena.position + 1)}
              </span>
            </>
          )}
        </p>
      )}
    </section>
  );
}

// ── Streak ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Weeks in a row with something to show for them.
 *
 * A streak beats a cumulative total because it is LOSABLE — that is the entire mechanic. The week
 * in progress is drawn differently from a finished one so the thing at risk is visible.
 */
export function StreakBadge({ streak }: { streak: Streak }) {
  if (streak.current === 0 && streak.best === 0) return null;
  return (
    <div className="flex items-center gap-2.5">
      <span className="display text-2xl font-bold leading-none text-gold tabular-nums">{streak.current}</span>
      <span className="font-mono text-[0.58rem] uppercase leading-snug tracking-[0.12em] text-text-dim">
        week streak
        <br />
        best {streak.best}
        <span className="mt-1 flex gap-[3px]">
          {streak.weeks.map((on, i) => (
            <i
              key={i}
              className={`block h-2.5 w-1.5 rounded-[1px] ${
                i === streak.weeks.length - 1 && on
                  ? 'bg-emerald-400'
                  : on
                    ? 'bg-gold-dark'
                    : 'bg-card-border'
              }`}
            />
          ))}
        </span>
      </span>
    </div>
  );
}

// ── Roster ───────────────────────────────────────────────────────────────────────────────────────

export interface RosterCharacter {
  id: number;
  rsn: string;
  xpThisWeek: number;
  seats: Seat[];
  next?: NextMilestone;
}

/**
 * Characters as cards, with where each one plays.
 *
 * THE ONE THING NO PER-CLAN SITE CAN DRAW. A clan sees the accounts holding a seat with it; only
 * here does "you" mean the person, with every character and every clan each of them plays in.
 *
 * Member and guest are drawn differently on purpose — a filled chip is a home, a dashed one is a
 * visit — because that distinction is the whole membership model and a colour alone would not say
 * which is which.
 */
export function Roster({ characters }: { characters: RosterCharacter[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {characters.map((c) => {
        const home = c.seats.find((s) => s.kind === 'member');
        return (
          <article
            key={c.id}
            className="relative flex flex-col gap-3.5 overflow-hidden rounded-xl border border-card-border bg-card-bg p-4"
          >
            {/* The home clan tints the card's foot, so the roster is scannable by colour first. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
              style={{ background: home ? 'var(--gold-dark)' : 'var(--card-border)' }}
            />

            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-card-border bg-black/25 font-serif text-lg text-text-muted">
                {c.rsn.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.95rem] font-semibold leading-tight">{c.rsn}</p>
                <p className="mt-0.5 font-mono text-[0.56rem] uppercase tracking-[0.13em] text-text-dim">
                  {home ? home.clanName : 'No home clan'}
                </p>
              </div>
              <span className="ml-auto text-right">
                <b className="font-mono text-base tabular-nums">{compactXp(c.xpThisWeek)}</b>
                <span className="block font-mono text-[0.53rem] uppercase tracking-[0.12em] text-text-dim">
                  xp / wk
                </span>
              </span>
            </div>

            {c.seats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.seats.map((s) => (
                  <ClanLink
                    key={s.clanId}
                    // The canonical clan address. `/c/` is a platform root, so ClanLink passes it
                    // through untouched — which is what makes it right here: this page is the apex,
                    // and the clan being linked to is frequently not the one the reader is "in".
                    href={`/c/${s.clanSlug}`}
                    className={
                      s.kind === 'member'
                        ? 'inline-flex items-center gap-1.5 rounded-md bg-gold/10 px-2 py-0.5 text-xs text-gold'
                        : 'inline-flex items-center gap-1.5 rounded-md border border-dashed border-card-border px-2 py-0.5 text-xs text-text-dim'
                    }
                  >
                    {s.clanName}
                    <span className="font-mono text-[0.55rem] uppercase tracking-wider opacity-70">
                      {s.kind === 'member' ? 'member' : 'guest'}
                    </span>
                  </ClanLink>
                ))}
              </div>
            )}

            {c.next && (
              <div className="border-t border-card-border-soft pt-3">
                <div className="mb-1.5 flex justify-between text-[0.74rem] text-text-dim">
                  <span className="text-text-muted">{c.next.label}</span>
                  <span>{compactXp(c.next.remaining)} to go</span>
                </div>
                <span className="block h-1.5 overflow-hidden rounded-full bg-black/35">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round(c.next.progress * 100)}%`,
                      background: 'linear-gradient(90deg, var(--gold-dark), var(--gold))',
                    }}
                  />
                </span>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

// ── Career ───────────────────────────────────────────────────────────────────────────────────────

/**
 * What you have done across every clan you have ever played for.
 *
 * On its own plane — an inset well rather than another card — because it is the only block on the
 * page that is not about this week. It is also the thing a single-clan site structurally cannot
 * show, which is the argument for the platform existing at all.
 */
export function CareerWell({ career }: { career: Career }) {
  const cells: { label: string; value: string; note?: string }[] = [
    {
      label: 'Events played',
      value: String(career.events),
      note: career.clanNames.length > 1 ? `across ${career.clanNames.length} clans` : career.clanNames[0],
    },
    {
      label: 'Tiles finished',
      value: String(career.tilesFinished),
      note: career.tilesContributed > 0 ? `${career.tilesContributed} contributed to` : undefined,
    },
    { label: 'Active days', value: String(career.activeDays) },
  ];

  return (
    <div className="rounded-2xl border border-card-border-soft bg-black/25 p-5">
      <dl className="grid gap-6 sm:grid-cols-3">
        {cells.map((c) => (
          <div key={c.label}>
            <dt className="mb-1.5 font-mono text-[0.57rem] uppercase tracking-[0.14em] text-text-dim">
              {c.label}
            </dt>
            <dd className="display text-3xl font-semibold leading-none tabular-nums">
              {c.value}
              {c.note && <small className="mt-1.5 block text-xs font-normal text-text-dim">{c.note}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Lately ───────────────────────────────────────────────────────────────────────────────────────

function milestoneLine(m: RecentMilestone): { badge: string; text: string } {
  // NOT `charAt(0).toUpperCase()`. That turned a hiscores key into a slightly different key —
  // "chambersOfXeric" read as "ChambersOfXeric" on the front page — because upper-casing a letter is
  // not translation. The boss table knows the English name; this asks it.
  const metric = milestoneMetricLabel(m.kind, m.metric, (k) => activityFor(k)?.label ?? null);
  switch (m.kind) {
    case 'level':
      return { badge: String(m.threshold), text: `${m.threshold} ${metric}` };
    case 'kc':
      return { badge: 'KC', text: `${m.threshold.toLocaleString()} ${metric}` };
    case 'ehp':
      return { badge: 'EHP', text: `${m.threshold.toLocaleString()} efficient hours` };
    case 'ehb':
      return { badge: 'EHB', text: `${m.threshold.toLocaleString()} efficient boss hours` };
    default:
      return { badge: compactXp(m.threshold), text: `${compactXp(m.threshold)} ${metric || 'XP'}` };
  }
}

function ago(iso: string): string {
  const t = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'today';
  if (days < 7) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

/** Thresholds already detected and dated by the stats sweep. This only reads them. */
export function Lately({ milestones }: { milestones: RecentMilestone[] }) {
  return (
    <ul className="flex flex-col">
      {milestones.map((m, i) => {
        const { badge, text } = milestoneLine(m);
        return (
          <li
            key={`${m.rsn}-${m.kind}-${m.metric}-${m.threshold}-${i}`}
            className="grid grid-cols-[1.7rem_1fr_auto] items-center gap-3 border-b border-card-border-soft py-2.5 last:border-b-0 text-sm"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-gold-dark/60 bg-black/25 font-mono text-[0.6rem] font-semibold text-gold">
              {badge}
            </span>
            <span className="min-w-0 truncate">
              <b className="font-semibold">{text}</b>
              <span className="ml-1.5 text-xs text-text-dim">· {m.rsn}</span>
            </span>
            <span className="font-mono text-[0.66rem] text-text-dim">{ago(m.noticedAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Where you stand ──────────────────────────────────────────────────────────────────────────────

/**
 * The viewer's placing on the platform table, and the gap that makes it a target.
 *
 * A RANK WITHOUT ITS GAP IS TRIVIA. "14th" is a fact you read once; "14th — 40K off 13th" is
 * something to go and do, and the difference between the two is one number.
 *
 * This could not have existed until characters were public by default (drizzle/0080). Before it,
 * every account on the first real database was unshared and the platform's own leaderboard had zero
 * rows in it — a record of a hundred and sixty-one active players that nobody, including them, could
 * read.
 */
export function Standing({ standing }: { standing: PlayerStanding }) {
  const top = standing.rank === 1;
  const pct = standing.field > 1 ? ((standing.field - standing.rank) / (standing.field - 1)) * 100 : 100;

  return (
    <ClanLink
      href="/leaderboard"
      className="group flex items-center gap-5 rounded-2xl border border-card-border bg-card-bg px-5 py-4 transition-colors hover:border-gold/40 hover:bg-card-bg-hover"
    >
      <div className="shrink-0 text-center">
        <div
          className="display text-[clamp(2rem,5vw,2.8rem)] font-bold leading-[0.85] tabular-nums"
          style={{
            background: 'linear-gradient(160deg, var(--foreground) 20%, var(--gold) 90%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {standing.rank}
          <sup className="align-super text-[0.3em] text-gold-dark">{ordinal(standing.rank)}</sup>
        </div>
        <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-text-dim">
          of {standing.field.toLocaleString()}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {top ? (
            <span className="font-semibold text-gold">Nobody on Anvil gained more this week.</span>
          ) : (
            <>
              <b className="display text-lg font-semibold text-gold">{compactXp(standing.gapAhead ?? 0)}</b>
              <span className="text-text-muted"> to {standing.rank - 1}{ordinal(standing.rank - 1)}</span>
            </>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-text-dim">
          {standing.rsn} · {compactXp(standing.xpGained)} this week
        </p>
        {/* The same proportional bar the arena uses, so "close" looks close. */}
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-black/40">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.max(4, Math.round(pct))}%`,
              background: 'linear-gradient(90deg, #d2683c, var(--gold))',
            }}
          />
        </span>
      </div>

      <span className="hidden shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-dim transition-colors group-hover:text-gold sm:block">
        Records →
      </span>
    </ClanLink>
  );
}
