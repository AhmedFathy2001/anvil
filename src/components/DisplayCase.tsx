import type { ReactNode } from 'react';

import ClanLink from '@/components/ClanLink';
import type { DisplayCaseEntry } from '@/lib/displayCase';
import { parseStamp } from '@/lib/supporterTiers';

// The display case on a profile: a row of the person's pinned best drops (Anvil Supporter). Pure
// render, shared by the public pages and the owner's editor, so what they arrange is what is shown.

export function caseGp(value: number | null): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}b`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString('en-GB');
}

/** Fixed locale and zone so the server and the browser print the same day. */
export function caseDate(stamp: string | null): string | null {
  const ms = parseStamp(stamp);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** One showcase card. `actions` is the owner's controls in the editor. */
export function DisplayCaseCard({
  entry,
  showRsn = true,
  actions,
}: {
  entry: Pick<DisplayCaseEntry, 'name' | 'icon' | 'when' | 'valueGp' | 'kc' | 'rsn' | 'source' | 'proofHref'>;
  showRsn?: boolean;
  actions?: ReactNode;
}) {
  const gp = caseGp(entry.valueGp);
  const when = caseDate(entry.when);
  return (
    <div className="relative flex h-full flex-col items-center rounded-xl border border-gold/25 bg-gradient-to-b from-gold/[0.07] to-transparent px-3 pb-3 pt-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-lg bg-brown-dark/60 ring-1 ring-card-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.icon} alt="" width={36} height={32} loading="lazy" decoding="async" className="[image-rendering:pixelated]" />
      </span>
      <span className="mt-2 line-clamp-2 text-[13px] font-medium leading-tight" title={entry.name}>
        {entry.name}
      </span>
      <span className="mt-1 flex flex-wrap justify-center gap-x-1.5 font-mono text-[10.5px] text-text-dim">
        {gp && <span className="text-gold-light">{gp}</span>}
        {entry.kc != null && <span>{entry.kc.toLocaleString('en-GB')} kc</span>}
        <span>{when ?? 'before tracking'}</span>
      </span>
      {showRsn && <span className="mt-0.5 truncate text-[11px] text-text-muted max-w-full">{entry.rsn}</span>}
      {entry.proofHref && (
        <ClanLink
          href={entry.proofHref}
          className="mt-1 text-[11px] text-gold/80 hover:text-gold hover:underline"
          title={entry.source ? `In the collection log: ${entry.source}` : 'In the collection log'}
        >
          Verified in log ↗
        </ClanLink>
      )}
      {actions}
    </div>
  );
}

/** The case as strangers see it. Renders nothing when empty. */
export default function DisplayCase({
  entries,
  title = 'Display case',
  showRsn = true,
  className = '',
}: {
  entries: DisplayCaseEntry[];
  title?: string;
  showRsn?: boolean;
  className?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <section className={className} aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-gold" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {entries.map((e) => (
          <li key={e.id}>
            <DisplayCaseCard entry={e} showRsn={showRsn} />
          </li>
        ))}
      </ul>
    </section>
  );
}
