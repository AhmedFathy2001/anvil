import { useId } from 'react';

import ClanLink from '@/components/ClanLink';
import BoostHereButton from '@/components/BoostHereButton';
import { badgeLabel, badgeTitle, boostNameClass, type BoostBadge, type WallEntry } from '@/lib/clanBoostRules';

/**
 * Clan boost pieces (lib/clanBoosts): the gem, the "Boosted" badge, the Booster mark on a character,
 * the badge chips, the boosters wall and the clan page's boost panel. Visibility only: nothing here
 * ranks, scores or seats anyone.
 */

/** The boost gem, in the Patron gradient. */
export function BoostGem({ size = 13, title }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.5" stopColor="#ff7ab8" />
          <stop offset="1" stopColor="#7a8cff" />
        </linearGradient>
      </defs>
      <path d="M12 1.5 20.5 9 12 22.5 3.5 9Z" fill={`url(#${id})`} />
      <path d="M3.5 9h17M12 1.5 9 9l3 13.5L15 9Z" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** "Boosted · Level 2" on a clan (hero, Clan Hall card, search). Nothing at level 0. */
export function BoostedBadge({ level, compact = false }: { level: number; compact?: boolean }) {
  if (level <= 0) return null;
  return (
    <span
      title={`This clan's members boost it to Level ${level}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ff7ab8]/35 bg-[#ff7ab8]/[0.08] px-2 py-0.5 text-[11px] font-medium text-[#ffb3d6]"
    >
      <BoostGem size={11} />
      {compact ? `L${level}` : <>Boosted · Level {level}</>}
    </span>
  );
}

/** A clan's name in its boost gradient (Level 1) or moving gradient (Level 2+). */
export function BoostedClanName({ name, level, className = '' }: { name: string; level: number; className?: string }) {
  const cls = boostNameClass(level);
  return <span className={`${cls} ${className}`.trim()}>{name}</span>;
}

/** The Booster mark beside a character who boosts this clan. */
export function BoosterMark({ count = 1 }: { count?: number }) {
  const label = count > 1 ? `Boosts this clan ×${count}` : 'Boosts this clan';
  return (
    <span title={label} className="inline-flex shrink-0 items-center">
      <BoostGem size={12} title={label} />
    </span>
  );
}

export function BoostBadgeChips({ badges }: { badges: BoostBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={`${b.kind}-${b.kind === 'tenure' ? b.months : b.kind === 'levelup' ? b.level : ''}`}
          title={badgeTitle(b)}
          className="rounded-full border border-card-border bg-brown-light/50 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted"
        >
          {badgeLabel(b)}
        </span>
      ))}
    </span>
  );
}

const sinceText = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Who boosts this clan: one row per character, most boosts then longest. */
export function BoostersWall({ wall, max = 12 }: { wall: WallEntry[]; max?: number }) {
  if (wall.length === 0) return null;
  // Names stripped on the server for this viewer (lib/clanBoostRules wallForViewer): a count only.
  if (wall.some((e) => e.rsn == null)) {
    const total = wall.reduce((n, e) => n + e.boosts, 0);
    return (
      <p className="flex items-center gap-2 text-[13.5px] text-text-muted">
        <BoostGem size={13} />
        {wall.length === 1 ? 'One member boosts' : `${wall.length} members boost`} this clan
        {total > wall.length ? ` (${total} boosts)` : ''}.
      </p>
    );
  }
  const shown = wall.slice(0, max);
  return (
    <ul className="divide-y divide-card-border-soft">
      {shown.map((e) => (
        <li key={e.seatId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <BoostGem size={13} />
          <ClanLink href={`/members/${encodeURIComponent(e.rsn ?? '')}`} className="min-w-0 truncate text-[14px] font-medium hover:text-gold">
            {e.rsn}
          </ClanLink>
          <BoostBadgeChips badges={e.badges} />
          <span className="ml-auto whitespace-nowrap text-[12px] text-text-muted">
            {e.boosts > 1 && <b className="mr-1 font-semibold text-foreground">×{e.boosts}</b>}
            since {sinceText(e.since)}
          </span>
        </li>
      ))}
      {wall.length > max && <li className="py-2 text-[12px] text-text-dim">and {wall.length - max} more</li>}
    </ul>
  );
}

export interface BoostPanelViewer {
  /** The viewer's eligible member seat here, when they have a free slot to put on it. */
  boostSeatId: number | null;
  /** Their own boosts already on this clan. */
  mine: number;
  /** A sentence for a Supporter who can't boost here yet (seat too new, no free slot). */
  note: string | null;
}

/**
 * The clan page's boost panel. Members see the level and how far the next one is, and (a Supporter
 * with a free slot and a seat old enough) a Boost button; visitors see the badge and the wall only.
 * Renders nothing for a clan nobody boosts, unless the viewer could start it.
 */
export function ClanBoostPanel({
  level,
  counted,
  progress,
  graceEndsAt,
  wall,
  member,
  viewer,
}: {
  level: number;
  counted: number;
  progress: { next: number; need: number; have: number } | null;
  graceEndsAt: number | null;
  wall: WallEntry[];
  /** The viewer holds a seat here (the progress line is for the clan's own people). */
  member: boolean;
  viewer: BoostPanelViewer | null;
}) {
  const canBoost = !!viewer?.boostSeatId;
  if (counted === 0 && level === 0 && !canBoost && !viewer?.note) return null;
  return (
    <section className="mt-9 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gold" />
        <h2 className="text-[16.5px] font-semibold">Boosters</h2>
        <BoostedBadge level={level} />
        {member && (
          <span className="ml-auto text-[12.5px] text-text-muted">
            {progress ? (
              <>
                <b className="font-semibold tabular-nums text-foreground">{progress.have}</b> of {progress.need} to Level {progress.next}
              </>
            ) : (
              `${counted} boosts · top level`
            )}
          </span>
        )}
      </div>
      {member && progress && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-sm bg-brown-light" aria-hidden>
          <span
            className="block h-full rounded-sm bg-gradient-to-r from-[#ffd27a] via-[#ff7ab8] to-[#7a8cff]"
            style={{ width: `${Math.min(100, Math.round((progress.have / progress.need) * 100))}%` }}
          />
        </div>
      )}
      {member && graceEndsAt && (
        <p className="mb-3 text-[12.5px] text-text-muted">
          Below Level {level} now: its perks stay until {sinceText(graceEndsAt)}.
        </p>
      )}
      <BoostersWall wall={wall} />
      {wall.length === 0 && member && <p className="text-[13px] text-text-muted">Nobody boosts this clan yet.</p>}
      {(canBoost || viewer?.note || (viewer && viewer.mine > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-card-border pt-3 text-[13px]">
          {viewer!.mine > 0 && (
            <span className="text-text-muted">
              You boost this clan{viewer!.mine > 1 ? ` ×${viewer!.mine}` : ''}.
            </span>
          )}
          {viewer!.note && <span className="text-text-muted">{viewer!.note}</span>}
          {canBoost && <BoostHereButton seatId={viewer!.boostSeatId!} />}
          <ClanLink href="/settings/boosts" className="ml-auto text-text-muted hover:text-gold">
            Your boosts →
          </ClanLink>
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-text-dim">Boosts are looks only: they never change a rank, a score or a seat.</p>
    </section>
  );
}
