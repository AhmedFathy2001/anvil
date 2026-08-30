import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';
import type { ClanStanding } from '@/lib/clanLeaderboard';

/**
 * Clans measured against each other — on three axes at once.
 *
 * WHY NOT A METRIC TOGGLE. The page already knew the interesting part: "XP is how much was done, EHP
 * how many hours of it, and EHB how much of that was bossing. A clan can lead one and be nowhere on
 * another, and that contrast IS the interesting part." But it then hid two thirds of that behind a
 * toggle, so seeing the contrast meant clicking three times and remembering. The contrast is the
 * page, so it has to be visible without interaction.
 *
 * THE THREE ARE NOT THREE RANKINGS. They answer different questions and only one of them is a
 * volume, which is why they are drawn differently:
 *
 *   HOW MUCH   — experience gained, against the leader. A ranking, and the least interesting one,
 *                because it mostly measures roster size.
 *   HOW MANY   — the share of the roster that actually played. The page's own thesis: 20 of 30 is a
 *                clan, 20 of 300 is a mailing list.
 *   WHAT KIND  — the bossing share of those hours. This is what makes two clans with identical
 *                totals obviously different places to join.
 *
 * The last two are percentages of themselves, not of the leader, so a small clan is not drawn as a
 * failed large one.
 */

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
// ClanStanding.ehpGained/ehbGained are ALREADY hours — lib/clanLeaderboard divides the stored milli
// units by EFFICIENCY_SCALE on the way out. Dividing again here turned 3,000 hours into 3 and a real
// bossing figure into 0, which the ratio column never showed because the double division cancels in
// a ratio. Only the absolute readouts were wrong, and only in the leaders strip.
const hours = (h: number) => Math.round(h).toLocaleString();

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Who tops each axis. Four questions with four different answers is the whole argument. */
function leaders(rows: ClanStanding[]) {
  const best = <T,>(by: (c: ClanStanding) => T, cmp: (a: T, b: T) => number) =>
    rows.length === 0 ? null : rows.slice().sort((a, b) => cmp(by(b), by(a)))[0];

  const num = (a: number, b: number) => a - b;
  return [
    { label: 'Most experience', clan: best((c) => c.xpGained, num), read: (c: ClanStanding) => `${compact(c.xpGained)} xp` },
    { label: 'Most hours', clan: best((c) => c.ehpGained, num), read: (c: ClanStanding) => `${hours(c.ehpGained)}h played` },
    { label: 'Most bossing', clan: best((c) => c.ehbGained, num), read: (c: ClanStanding) => `${hours(c.ehbGained)}h bossing` },
    {
      // Deliberately gated on a real roster: one active member out of one is 100% and would top this
      // every week, which would make the column meaningless.
      label: 'Best turnout',
      clan: best((c) => (c.members >= 10 ? c.actives / c.members : 0), num),
      read: (c: ClanStanding) => `${pct(c.actives, c.members)}% of the roster`,
    },
  ].filter((l) => l.clan);
}

export default function ClanShapes({ rows }: { rows: ClanStanding[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-text-muted">
        Nothing to show yet. Clans appear here once they are verified and their members start
        reporting through the plugin.
      </div>
    );
  }

  const topXp = Math.max(...rows.map((r) => r.xpGained), 1);
  const board = leaders(rows);

  return (
    <div className="flex flex-col gap-7">
      {/* The argument, stated before the table rather than left to be inferred from it. */}
      {board.length > 1 && (
        <div className="grid gap-px overflow-hidden rounded-xl border border-card-border bg-card-border sm:grid-cols-2 lg:grid-cols-4">
          {board.map((l) => (
            <ClanLink
              key={l.label}
              href={`/c/${l.clan!.slug}`}
              className="group bg-card-bg p-3.5 transition-colors hover:bg-card-bg-hover"
            >
              <p className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-text-dim">{l.label}</p>
              <p className="mt-1.5 flex items-center gap-2">
                <ClanCrest name={l.clan!.name} size={20} />
                <span className="truncate text-sm font-semibold group-hover:text-gold">{l.clan!.name}</span>
              </p>
              <p className="mt-1 font-mono text-[0.7rem] text-gold-dark">{l.read(l.clan!)}</p>
            </ClanLink>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-card-border">
        {/* Column headings only once, so the rows below can be dense without being cryptic. */}
        <div className="hidden grid-cols-[2rem_minmax(0,1fr)_9rem_9rem_9rem] gap-4 border-b border-card-border bg-black/20 px-4 py-2.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-text-dim lg:grid">
          <span />
          <span>Clan</span>
          <span>Experience</span>
          <span>Turnout</span>
          <span>Bossing share</span>
        </div>

        {rows.map((c, i) => {
          const turnout = pct(c.actives, c.members);
          // What fraction of the hours they played were spent bossing. The number that says what
          // KIND of clan this is, where the totals only say how big.
          const bossing = pct(c.ehbGained, c.ehpGained);

          return (
            <ClanLink
              key={c.clanId}
              href={`/c/${c.slug}`}
              className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-4 border-b border-card-border-soft px-4 py-3 last:border-b-0 transition-colors hover:bg-card-bg-hover lg:grid-cols-[2rem_minmax(0,1fr)_9rem_9rem_9rem]"
            >
              <span className="text-right font-mono text-xs text-text-dim tabular-nums">{i + 1}</span>

              <span className="flex min-w-0 items-center gap-2.5">
                <ClanCrest name={c.name} size={24} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block font-mono text-[0.62rem] text-text-dim">
                    {c.actives} of {c.members} played
                  </span>
                </span>
              </span>

              {/* HOW MUCH — against the leader, because volume only means anything comparatively. */}
              <Axis
                value={`${compact(c.xpGained)}`}
                fill={Math.max(2, pct(c.xpGained, topXp))}
                tone="gold"
              />

              {/* HOW MANY — of itself. A 28-member clan at 93% is not a small failure. */}
              <Axis value={`${turnout}%`} fill={turnout} tone="green" />

              {/* WHAT KIND — of itself, and the axis that most changes who should join. */}
              <Axis
                value={c.ehpGained > 0 ? `${bossing}%` : '—'}
                fill={c.ehpGained > 0 ? bossing : 0}
                tone="ember"
              />
            </ClanLink>
          );
        })}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  gold: 'linear-gradient(90deg, var(--gold-dark), var(--gold))',
  green: 'linear-gradient(90deg, #2f6b40, #56b06c)',
  ember: 'linear-gradient(90deg, #8a4324, #d2683c)',
};

/**
 * One measurement: a number and how full it is.
 *
 * Hidden below `lg` rather than stacked. Three bars wrapped onto a phone become a wall, and the
 * "x of y played" line under the clan name already carries the most important of them.
 */
function Axis({ value, fill, tone }: { value: string; fill: number; tone: keyof typeof TONES }) {
  return (
    <span className="hidden lg:block">
      <span className="mb-1 block text-right font-mono text-[0.72rem] tabular-nums text-text-muted">
        {value}
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-black/40">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, fill))}%`, background: TONES[tone] }}
        />
      </span>
    </span>
  );
}
