import type { ReactNode } from 'react';

import { formatCompareValue, type CompareRow, type Leader } from '@/lib/compare';

// The pieces both /compare pages are built from: the empty-handed form, the headline table and the
// section frame. Server components — nothing here needs the browser; the form is a plain GET, so the
// result is a URL that can be pasted anywhere, which is the whole point of the page.

/** Gold for whoever leads the row; a tie or an unknown stays in the ordinary colour. */
/**
 * Each side keeps one colour down the whole page — gold on the left, steel on the right — so who's
 * winning reads at a glance, row after row, without matching numbers to names.
 */
export const SIDE = {
  a: { text: 'text-gold', bg: 'bg-gold', soft: 'bg-gold/15' },
  b: { text: 'text-[#8fb4d4]', bg: 'bg-[#8fb4d4]', soft: 'bg-[#8fb4d4]/15' },
} as const;

export function leadClass(side: 'a' | 'b', leader: Leader | null): string {
  if (leader === side) return `${SIDE[side].text} font-semibold`;
  if (leader === 'tie') return 'text-foreground';
  return 'text-text-muted';
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <span className="w-1 h-5 bg-gold rounded-full" />
        {children}
      </h2>
      {aside ? <div className="text-xs text-text-dim">{aside}</div> : null}
    </div>
  );
}

/** The share of the pair each side holds — the tug-of-war split. Unknown on either side ⇒ even. */
function shares(a: number | null, b: number | null): [number, number] {
  if (a == null || b == null || a + b <= 0) return [50, 50];
  const pa = Math.round((Math.max(0, a) / (Math.max(0, a) + Math.max(0, b))) * 100);
  return [pa, 100 - pa];
}

/**
 * The headline numbers as a tug of war: the bar splits by each side's share, the leader's number and
 * colour carry, so "553 vs 638 EHP" reads as a margin rather than two figures to subtract.
 */
export function HeadlineTable({ rows }: { rows: CompareRow[] }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg px-4 py-2 sm:px-6">
      {rows.map((r) => {
        const [pa, pb] = shares(r.a, r.b);
        return (
          <div key={r.label} className="py-2.5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3">
              <div className={`text-right font-mono text-lg tabular-nums ${leadClass('a', r.leader)}`}>
                {formatCompareValue(r.a, r.format)}
              </div>
              <div className="min-w-[6.5rem] text-center text-[11px] tracking-wide text-text-dim">{r.label}</div>
              <div className={`font-mono text-lg tabular-nums ${leadClass('b', r.leader)}`}>
                {formatCompareValue(r.b, r.format)}
              </div>
            </div>
            <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-brown-light/60" aria-hidden>
              <div className={`${SIDE.a.bg} ${r.leader === 'a' ? '' : 'opacity-40'}`} style={{ width: `${pa}%` }} />
              <div className="w-0.5 bg-background" />
              <div className={`${SIDE.b.bg} ${r.leader === 'b' ? '' : 'opacity-40'}`} style={{ width: `${pb}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The verdict strip under the names: who took more skills, bosses and log pages. Ties are skipped
 * rather than shown as "0–0".
 */
export function Scoreboard({ items }: { items: { label: string; a: number; b: number }[] }) {
  const shown = items.filter((i) => i.a + i.b > 0);
  if (shown.length === 0) return null;
  return (
    <div className="mx-auto mb-6 flex w-fit flex-wrap justify-center gap-2">
      {shown.map((i) => (
        <div key={i.label} className="flex items-center gap-2 rounded-full border border-card-border bg-card-bg px-3.5 py-1.5 text-sm">
          <span className={`font-mono font-semibold tabular-nums ${i.a > i.b ? SIDE.a.text : 'text-text-muted'}`}>{i.a}</span>
          <span className="text-xs text-text-dim">{i.label}</span>
          <span className={`font-mono font-semibold tabular-nums ${i.b > i.a ? SIDE.b.text : 'text-text-muted'}`}>{i.b}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A mirrored row: both sides' bars grow OUT from a centre column holding the icon and the name, so a
 * long list reads as two silhouettes against each other. `scale` maps a value to 0–100 (bosses use a
 * log scale — one 1,369-kill boss would otherwise flatten everything under it).
 */
export function MirrorRow({
  icon,
  label,
  a,
  b,
  leader,
  scale,
  format,
}: {
  icon: ReactNode;
  label: ReactNode;
  a: number | null;
  b: number | null;
  leader: Leader | null;
  scale: (n: number) => number;
  format: (n: number | null) => string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,13rem)_minmax(0,1fr)] items-center gap-3 px-3 py-1.5 sm:px-4">
      <div className="flex items-center justify-end gap-2">
        <span className={`shrink-0 font-mono text-sm tabular-nums ${leadClass('a', leader)}`}>{format(a)}</span>
        <div className="flex h-2 w-full max-w-[14rem] justify-end overflow-hidden rounded-l-full bg-brown-light/40" aria-hidden>
          <div className={`h-full ${SIDE.a.bg} ${leader === 'a' ? '' : 'opacity-40'}`} style={{ width: `${a ? Math.max(2, scale(a)) : 0}%` }} />
        </div>
      </div>
      <div className="flex min-w-0 items-center justify-center gap-2 text-center text-sm">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-2 w-full max-w-[14rem] overflow-hidden rounded-r-full bg-brown-light/40" aria-hidden>
          <div className={`h-full ${SIDE.b.bg} ${leader === 'b' ? '' : 'opacity-40'}`} style={{ width: `${b ? Math.max(2, scale(b)) : 0}%` }} />
        </div>
        <span className={`shrink-0 font-mono text-sm tabular-nums ${leadClass('b', leader)}`}>{format(b)}</span>
      </div>
    </div>
  );
}

export function CompareForm({
  action,
  a,
  b,
  missing,
  noun,
  placeholderA,
  placeholderB,
  maxLength,
}: {
  action: string;
  a: string;
  b: string;
  missing: string[];
  noun: 'player' | 'clan';
  placeholderA: string;
  placeholderB: string;
  maxLength: number;
}) {
  const input =
    'w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-dim focus:border-gold focus:outline-none';
  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-5">
      {missing.length > 0 && (
        <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm">
          {missing.map((name) => (
            <p key={name}>
              <span className="font-semibold">{name}</span>{' '}
              {noun === 'player' ? 'is not on Anvil, or is not shared.' : 'is not on Anvil, or is not listed publicly.'}
            </p>
          ))}
        </div>
      )}
      {/* clan-prefix: platform -- /compare is the apex's; a comparison belongs to no one clan */}
      <form method="get" action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <label className="block text-xs text-text-muted">
          {noun === 'player' ? 'First player' : 'First clan'}
          <input
            name="a"
            defaultValue={a}
            placeholder={placeholderA}
            maxLength={maxLength}
            required
            autoComplete="off"
            className={`mt-1 ${input}`}
          />
        </label>
        <span className="hidden pb-2 text-center font-mono text-xs uppercase tracking-widest text-text-dim sm:block">vs</span>
        <label className="block text-xs text-text-muted">
          {noun === 'player' ? 'Second player' : 'Second clan'}
          <input
            name="b"
            defaultValue={b}
            placeholder={placeholderB}
            maxLength={maxLength}
            required
            autoComplete="off"
            className={`mt-1 ${input}`}
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Compare
        </button>
      </form>
    </div>
  );
}

/** A remote game sprite, or an empty slot of the same size so the columns stay aligned. */
export function Sprite({ src }: { src: string | null }) {
  if (!src) return <span className="h-5 w-5" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote game sprites, tiny and cached
    <img src={src} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 object-contain [image-rendering:pixelated]" />
  );
}
