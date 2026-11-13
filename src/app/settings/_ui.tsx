import type { ReactNode } from 'react';

import ClanLink from '@/components/ClanLink';
import type { SupporterTierId } from '@/lib/supporterTiers';

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

/**
 * One area of a settings page: a gold-barred heading, a line on what it covers, then its groups.
 * Each page holds a few of these (the areas that used to be pages of their own), so `id` is the
 * anchor the old address redirects to.
 */
export function SettingsPart({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mb-12 scroll-mt-24">
      <h2 id={`${id}-title`} className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <span className="h-5 w-1 shrink-0 bg-gold" aria-hidden />
        {title}
      </h2>
      {intro && <div className="mb-4 max-w-[70ch] text-[13.5px] text-text-muted">{intro}</div>}
      {!intro && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** "On this page": a strip of links to a page's parts, so a phone reader isn't left scrolling. */
export function PartJumps({ parts }: { parts: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="mb-8 flex flex-wrap items-center gap-x-1 gap-y-2 text-[13px]">
      <span className="mr-1 text-text-dim">On this page:</span>
      {parts.map((j) => (
        <a
          key={j.id}
          href={`#${j.id}`}
          className="rounded-full border border-card-border bg-card-bg px-2.5 py-0.5 text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
        >
          {j.label}
        </a>
      ))}
    </nav>
  );
}

export const TIER_LABEL: Record<SupporterTierId, string> = { supporter: 'Supporter', champion: 'Champion', patron: 'Patron' };

/** Where every "become a Supporter" button goes: the tier page with its checkout (as the plan block uses). */
export const SUPPORTER_HREF = '/supporter';

/**
 * Said beside a perk someone has picked but doesn't hold the tier for: it is saved and they see it
 * here, nobody else does yet. `held` decides "become" (no tier) or "upgrade".
 */
export function OnlyYouNote({ need, held, what }: { need: SupporterTierId; held: SupporterTierId | null; what?: string }) {
  const tier = TIER_LABEL[need];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2 text-[12.5px] text-text-muted">
      <span className="min-w-0 flex-[1_1_16rem]">
        {what ? <>{what}: only </> : 'Only '}you can see this — become a {tier} to show it everywhere. It&rsquo;s saved, so it applies
        the moment you do.
      </span>
      <ClanLink
        href={SUPPORTER_HREF}
        className="shrink-0 rounded-lg bg-gold px-3 py-1 text-[12.5px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
      >
        {held ? `Upgrade to ${tier}` : `Become a ${tier}`}
      </ClanLink>
    </div>
  );
}
