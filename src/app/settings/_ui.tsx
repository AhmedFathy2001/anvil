import type { ReactNode } from 'react';

/**
 * The settings page's layout pieces: a page title, titled groups, and rows of "what this is · the
 * control". Server components only — every control inside is its own client island.
 *
 * One shape for every setting on purpose. These used to live in five drawers on three pages, each
 * styled the way its page happened to be, and the visual difference read as a difference in kind.
 */
export function SettingsTitle({ title, badge, children }: { title: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="display text-2xl font-semibold tracking-tight">{title}</h1>
        {badge}
      </div>
      {children && <div className="mt-1 max-w-[70ch] text-[13.5px] text-text-muted">{children}</div>}
    </header>
  );
}

export function SettingsGroup({
  title,
  id,
  note,
  children,
}: {
  title: string;
  id?: string;
  /** A line under the list, for the one thing a reader would otherwise wonder about. */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-7 scroll-mt-24">
      <h2 className="mb-2 ml-0.5 text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-dim">{title}</h2>
      <div className="divide-y divide-card-border-soft rounded-xl border border-card-border bg-card-bg">{children}</div>
      {note && <p className="mt-2 ml-0.5 text-[12.5px] text-text-muted">{note}</p>}
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  locked,
}: {
  label: ReactNode;
  description?: ReactNode;
  /** The control: a switch, a button, a select. */
  children?: ReactNode;
  /** A premium tier this needs, shown as a chip beside the label. */
  locked?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
          {label}
          {locked && <TierChip tier={locked} />}
        </div>
        {description && <div className="mt-0.5 text-[12.5px] text-text-muted">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** A block inside a group that is not a single row: a list, a form, an embedded editor. */
export function SettingsBlock({ children }: { children: ReactNode }) {
  return <div className="px-4 py-4">{children}</div>;
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'green' | 'gold' | 'yellow' }) {
  const cls =
    tone === 'green'
      ? 'border-accent-green/50 bg-accent-green/10 text-accent-green-light'
      : tone === 'gold'
        ? 'border-gold-dark bg-gold/10 text-gold'
        : tone === 'yellow'
          ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
          : 'border-card-border text-text-muted';
  return <span className={`whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-normal ${cls}`}>{children}</span>;
}

/** "Supporter" / "Champion" / "Patron" — the tier a locked perk needs. */
export function TierChip({ tier }: { tier: string }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-gold-dark bg-gold/10 px-2 py-px font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
      {tier}
    </span>
  );
}
