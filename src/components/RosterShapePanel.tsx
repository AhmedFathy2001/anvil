import { BOSSES } from '@/lib/constants';
import type { RosterShape } from '@/lib/rosterShape';

/**
 * A roster, drawn from what it said about itself.
 *
 * The sign-up form's answers — bosses, skills, hours, timezone — existed only as one card per
 * person, so nobody ever saw the group: where it's thin, whether it's all one timezone, how much
 * time is actually on the board. Three small readings answer that, and each is a bar chart because
 * the question is always "compared to the rest of this roster".
 *
 * Self-reported and frozen at sign-up, which the footer says out loud: it's what people TOLD you,
 * and a captain reading it as measurement would be reading it wrong.
 */

const BOSS_LABEL = new Map(BOSSES.map((b) => [b.key, b.label]));
const label = (key: string) => BOSS_LABEL.get(key) ?? key.replace(/^\w/, (c) => c.toUpperCase());

export default function RosterShapePanel({
  shape,
  gaps = [],
  title = 'Roster shape',
  note = 'from their sign-up answers',
  limit = 8,
  collapsed = false,
}: {
  shape: RosterShape;
  /** Bosses this board asks for that nobody named — the useful half of coverage. */
  gaps?: string[];
  title?: string;
  note?: string;
  limit?: number;
  /** Start shut, opened by its heading (a native <details>, so it needs no client code). */
  collapsed?: boolean;
}) {
  if (shape.answered === 0) return null;

  const bosses = shape.bosses.slice(0, limit);
  const skills = shape.skills.slice(0, limit);
  const maxTz = Math.max(1, ...shape.timezones.map((t) => t.players));

  const heading = (
    <div className="flex items-center gap-2 mb-1">
      <span className="w-1 h-5 bg-gold rounded-full" />
      <h2 className="text-lg font-bold">{title}</h2>
      <span className="text-xs text-text-muted">{note}</span>
    </div>
  );
  const body = (
    <>
      <p className="text-xs text-text-muted mb-4">
        <span className="text-foreground/80">{shape.activeHoursPerWeek.toLocaleString()}h</span> active
        {shape.afkHoursPerWeek > 0 && <> + {shape.afkHoursPerWeek.toLocaleString()}h AFK</>} a week across{' '}
        {shape.answered} {shape.answered === 1 ? 'person' : 'people'}
        {shape.answered < shape.size && <> ({shape.size - shape.answered} didn&apos;t answer)</>}.
      </p>

      {gaps.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
          <p className="text-xs text-yellow-300">
            <span className="font-semibold">Nobody runs:</span> {gaps.map(label).join(', ')} — and the board asks
            for {gaps.length === 1 ? 'it' : 'them'}.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {bosses.length > 0 && <Bars heading="Bosses they run" rows={bosses.map((b) => ({ name: label(b.key), value: b.count, pct: b.pct }))} suffix={`of ${shape.answered}`} />}
        {skills.length > 0 && <Bars heading="Skills they train" rows={skills.map((s) => ({ name: label(s.key), value: s.count, pct: s.pct }))} suffix={`of ${shape.answered}`} />}
      </div>

      {shape.timezones.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            When they play
          </h3>
          <div className="grid gap-1.5">
            {shape.timezones.map((t) => (
              <div key={t.tz ?? 'unstated'} className="flex items-center gap-2.5 text-xs">
                <span className={`w-16 shrink-0 font-mono ${t.tz ? '' : 'text-text-muted italic'}`}>
                  {t.tz ?? 'not said'}
                </span>
                <span className="h-2 flex-1 rounded-full bg-brown-dark overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-gold/70"
                    style={{ width: `${Math.round((t.players / maxTz) * 100)}%` }}
                  />
                </span>
                <span className="w-28 shrink-0 text-right text-text-muted">
                  {t.players} · {t.weeklyHours}h/wk
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-text-muted">
        Self-reported when they signed up — what people said they do, not what they&apos;ve done.
      </p>
    </>
  );

  if (collapsed) {
    return (
      <details className="group border border-card-border rounded-xl bg-card-bg">
        <summary className="list-none cursor-pointer select-none p-5 flex items-center gap-2 [&>div]:mb-0">
          <div className="flex-1 min-w-0">{heading}</div>
          <span className="text-text-muted transition-transform group-open:rotate-180" aria-hidden>▾</span>
        </summary>
        <div className="px-5 pb-5">{body}</div>
      </details>
    );
  }

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      {heading}
      {body}
    </section>
  );
}

/** One labelled bar list. Shares are of the people who answered, which the suffix names. */
function Bars({
  heading,
  rows,
  suffix,
}: {
  heading: string;
  rows: { name: string; value: number; pct: number }[];
  suffix: string;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">{heading}</h3>
      <div className="grid gap-1.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2.5 text-xs">
            <span className="w-28 shrink-0 truncate" title={r.name}>
              {r.name}
            </span>
            <span className="h-2 flex-1 rounded-full bg-brown-dark overflow-hidden">
              <span className="block h-full rounded-full bg-accent-green/70" style={{ width: `${r.pct}%` }} />
            </span>
            <span className="w-14 shrink-0 text-right text-text-muted tabular-nums">
              {r.value} <span className="sr-only">{suffix}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
