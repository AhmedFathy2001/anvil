import type { ReactNode } from 'react';

/**
 * One setting on a settings tab: its name and what it does on the left, its controls on the right,
 * a quiet rule between sections. Every panel on every tab is drawn by this, so they all share one
 * width, one heading style and one rhythm — the old page stacked three different card styles at
 * three different widths.
 *
 * `flush` is for panels whose rows carry their own padding and dividers (lists of clans, gates).
 */
export default function SettingsCard({
  id,
  title,
  description,
  aside,
  flush = false,
  tone,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Small extra under the description: a status chip, a link. */
  aside?: ReactNode;
  flush?: boolean;
  tone?: 'danger';
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="grid scroll-mt-28 gap-x-10 gap-y-3 border-b border-card-border/60 pb-7 md:grid-cols-[13.5rem_minmax(0,1fr)]"
    >
      <div className="min-w-0">
        <h2 className={`text-[15px] font-semibold ${tone === 'danger' ? 'text-red-400' : ''}`}>{title}</h2>
        {description && <div className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{description}</div>}
        {aside && <div className="mt-2.5">{aside}</div>}
      </div>
      <div
        className={`min-w-0 rounded-xl border bg-card-bg ${tone === 'danger' ? 'border-red-500/30' : 'border-card-border'} ${flush ? '' : 'p-5'}`}
      >
        {children}
      </div>
    </section>
  );
}
