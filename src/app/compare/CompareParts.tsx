import type { ReactNode } from 'react';

import { formatCompareValue, type CompareRow, type Leader } from '@/lib/compare';

// The pieces both /compare pages are built from: the empty-handed form, the headline table and the
// section frame. Server components — nothing here needs the browser; the form is a plain GET, so the
// result is a URL that can be pasted anywhere, which is the whole point of the page.

/** Gold for whoever leads the row; a tie or an unknown stays in the ordinary colour. */
export function leadClass(side: 'a' | 'b', leader: Leader | null): string {
  if (leader === side) return 'text-gold font-semibold';
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

/** a | label | b, the leader's number in gold. */
export function HeadlineTable({ rows }: { rows: CompareRow[] }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border-soft">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5">
          <div className={`text-right font-mono text-lg tabular-nums ${leadClass('a', r.leader)}`}>
            {formatCompareValue(r.a, r.format)}
          </div>
          <div className="min-w-[7.5rem] text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            {r.label}
          </div>
          <div className={`font-mono text-lg tabular-nums ${leadClass('b', r.leader)}`}>
            {formatCompareValue(r.b, r.format)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Two names and a button, as a GET to the same page.
 *
 * `missing` lists names that were asked for and did not resolve. The wording is the same for "no
 * such character" and "exists but its owner has not shared it" on purpose: telling those apart would
 * disclose exactly what the owner withheld — the same reason /p/<rsn> 404s for both.
 */
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
