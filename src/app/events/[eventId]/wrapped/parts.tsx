import type { ReactNode } from 'react';

import { itemIconUrl } from '@/lib/tileIcons';
import { formatHours, ordinal, shortNumber, type WrappedPlayer, type WrappedTeam, type WrappedTile } from '@/lib/eventWrappedRules';

// The page half of a Wrapped card: the same facts the picture carries, plus the ones it has no room
// for. Shown under the picture, and instead of it when the event is private (the picture would only
// be the plain Anvil card there).

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

function Item({ itemId, name, detail }: { itemId: number | null; name: string; detail?: string | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      {itemId != null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={itemIconUrl(itemId)} alt="" className="h-6 w-6 object-contain" />
      )}
      {name}
      {detail && <span className="text-text-muted font-normal">{detail}</span>}
    </span>
  );
}

export function CardImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={1200} height={630} className="w-full rounded-xl border border-card-border aspect-[1200/630] bg-card-bg" />
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg px-4 py-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-gold mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold mb-3">
      <span className="w-1 h-5 bg-gold" />
      {children}
    </h2>
  );
}

const GP_TILES = new Set(['value', 'valuetotal']);

/** A tile amount in the unit the tile counts in. */
function tileAmount(t: WrappedTile): string {
  if (t.statType === 'skill') return `${shortNumber(t.amount)} XP`;
  if (t.statType === 'boss') return `${t.amount.toLocaleString('en-US')} KC`;
  if (t.tileType && GP_TILES.has(t.tileType)) return `${shortNumber(t.amount)} gp`;
  return `×${t.amount.toLocaleString('en-US')}`;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** The big numbers: what they scored, how much they played, what they killed and trained. */
export function PlayerStats({ p }: { p: WrappedPlayer }) {
  const stats: { label: string; value: string; sub?: string | null }[] = [];
  if (p.unit !== 'tiles' && p.points > 0) {
    stats.push({
      label: 'Points scored',
      value: p.points.toLocaleString('en-US'),
      sub: p.teamShare != null && p.team ? `${Math.round(p.teamShare * 100)}% of ${p.team.name}` : null,
    });
  }
  if (p.tasks > 0) stats.push({ label: 'Tiles helped finish', value: p.tasks.toLocaleString('en-US') });
  if (p.minutesPlayed > 0) stats.push({ label: 'Time played', value: formatHours(p.minutesPlayed) });
  if (p.activeDays > 0) stats.push({ label: 'Days active', value: p.activeDays.toLocaleString('en-US') });
  if (p.kcGained > 0) stats.push({ label: 'Boss kills', value: p.kcGained.toLocaleString('en-US') });
  if (p.xpGained > 0) stats.push({ label: 'XP gained', value: shortNumber(p.xpGained) });
  if (p.submissions > 0) stats.push({ label: 'Turn-ins', value: p.submissions.toLocaleString('en-US') });
  if (p.lootGp > 0) stats.push({ label: 'Loot', value: `${shortNumber(p.lootGp)} gp` });
  if (stats.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Stat key={s.label} {...s} />
      ))}
    </div>
  );
}

/** Awards won, then the ones they came close in. */
export function PlayerAwards({ p }: { p: WrappedPlayer }) {
  if (p.awards.length === 0 && p.runnerUp.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {p.awards.map((a) => (
        <span key={a.title} className="rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-sm text-gold">
          {a.emoji} {a.title} <span className="text-text-muted">· {a.valueLabel}</span>
        </span>
      ))}
      {p.runnerUp.map((a) => (
        <span key={a.title} className="rounded-full border border-card-border px-3 py-1 text-sm text-text-muted">
          {ordinal(a.place)} for {a.emoji} {a.title} <span className="opacity-70">· {a.valueLabel}</span>
        </span>
      ))}
    </div>
  );
}

/** The one-liners: their grind, their best drop, their luck, their records. */
export function PlayerHighlights({ p }: { p: WrappedPlayer }) {
  const rows: ReactNode[] = [];
  const add = (label: string, body: ReactNode) => rows.push(<Fact key={`${label}-${rows.length}`} label={label}>{body}</Fact>);
  if (p.topBoss) add('Most killed', `${p.topBoss.name} · ${p.topBoss.kc.toLocaleString('en-US')} KC`);
  if (p.topSkill) add('Top skill', `${p.topSkill.name} · ${shortNumber(p.topSkill.xp)} XP`);
  if (p.biggestDrop) {
    add(
      'Biggest drop',
      <Item itemId={p.biggestDrop.itemId} name={p.biggestDrop.itemName} detail={p.biggestDrop.valueGp ? `${shortNumber(p.biggestDrop.valueGp)} gp` : null} />,
    );
  }
  for (const pet of p.pets) add('Pet', <Item itemId={pet.itemId} name={pet.itemName} />);
  if (p.spooned) add('Spooned', <Item itemId={p.spooned.itemId} name={p.spooned.itemName} detail={p.spooned.headline} />);
  if (p.dry) add('Dry', <Item itemId={p.dry.itemId} name={p.dry.itemName} detail={p.dry.headline} />);
  if (p.bestHaul) add('Best haul', `${shortNumber(p.bestHaul.gp)} gp${p.bestHaul.tile ? ` · ${p.bestHaul.tile}` : ''}`);
  if (p.fastestClear) add('Fastest clear', `${clock(p.fastestClear.seconds)}${p.fastestClear.tile ? ` · ${p.fastestClear.tile}` : ''}`);
  if (p.kills > 0) add('Kills turned in', p.kills.toLocaleString('en-US'));
  if (p.drops > 0) add('Drops turned in', p.drops.toLocaleString('en-US'));
  if (p.pvpKills > 0) add('PvP kills', p.pvpKills.toLocaleString('en-US'));
  if (p.caTasks > 0) add('Combat tasks', p.caTasks.toLocaleString('en-US'));
  if (p.cluesOpened > 0) add('Caskets opened', p.cluesOpened.toLocaleString('en-US'));
  if (p.biggestHit > 0) add('Biggest hit', p.biggestHit.toLocaleString('en-US'));
  if (p.deaths > 0) add('Deaths', p.deaths.toLocaleString('en-US'));
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionTitle>Highlights</SectionTitle>
      <div className="rounded-xl border border-card-border bg-card-bg divide-y divide-card-border">{rows}</div>
    </section>
  );
}

const TILE_LIMIT = 12;

/** Every tile they put work into: finished ones first, biggest share first. */
export function PlayerTiles({ p }: { p: WrappedPlayer }) {
  if (p.tiles.length === 0) return null;
  const row = (t: WrappedTile, i: number) => (
    <div key={`${t.label}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
      <span className={`text-sm w-4 shrink-0 ${t.completed ? 'text-accent-green-light' : 'text-text-muted/50'}`}>{t.completed ? '✓' : '·'}</span>
      <span className={`text-sm truncate ${t.completed ? '' : 'text-text-muted'}`}>{t.label}</span>
      <span className="ml-auto text-sm font-medium tabular-nums shrink-0">{tileAmount(t)}</span>
    </div>
  );
  const head = p.tiles.slice(0, TILE_LIMIT);
  const rest = p.tiles.slice(TILE_LIMIT);
  return (
    <section>
      <SectionTitle>
        Tiles they worked <span className="text-xs font-normal text-text-muted">{p.tiles.filter((t) => t.completed).length} finished</span>
      </SectionTitle>
      <div className="rounded-xl border border-card-border bg-card-bg divide-y divide-card-border">
        {head.map(row)}
        {rest.length > 0 && (
          <details>
            <summary className="cursor-pointer px-4 py-2.5 text-sm text-text-muted hover:text-gold">Show {rest.length} more</summary>
            <div className="divide-y divide-card-border border-t border-card-border">{rest.map((t, i) => row(t, i + TILE_LIMIT))}</div>
          </details>
        )}
      </div>
    </section>
  );
}

/** Everything on a player's page below the picture. Also the whole page on a private event. */
export function PlayerFacts({ p }: { p: WrappedPlayer }) {
  return (
    <div className="space-y-8">
      <PlayerStats p={p} />
      <PlayerAwards p={p} />
      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <PlayerHighlights p={p} />
        <PlayerTiles p={p} />
      </div>
    </div>
  );
}

export function TeamFacts({ t }: { t: WrappedTeam }) {
  return (
    <div className="space-y-4">
      {t.awards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {t.awards.map((a) => (
            <span key={`${a.title}-${a.winner}`} className="rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-sm text-gold">
              {a.emoji} {a.title} <span className="text-text-muted">· {a.winner}</span>
            </span>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-card-border bg-card-bg divide-y divide-card-border">
        {t.of > 1 && <Fact label="Finished">{ordinal(t.rank)} of {t.of}</Fact>}
        <Fact label={t.unit === 'tiles' ? 'Tiles' : 'Points'}>{t.score.toLocaleString()}</Fact>
        <Fact label="Players">{t.members.toLocaleString()}</Fact>
        {t.mvp && <Fact label="MVP">{t.mvp}</Fact>}
        {t.minutesPlayed > 0 && <Fact label="Time played">{formatHours(t.minutesPlayed)}</Fact>}
        {t.kcGained > 0 && <Fact label="Boss kills">{t.kcGained.toLocaleString()}</Fact>}
        {t.xpGained > 0 && <Fact label="XP gained">{t.xpGained.toLocaleString()}</Fact>}
        {t.biggestDrop && (
          <Fact label="Biggest drop">
            <Item
              itemId={t.biggestDrop.itemId}
              name={t.biggestDrop.itemName}
              detail={t.biggestDrop.valueGp ? `${shortNumber(t.biggestDrop.valueGp)} gp` : null}
            />
          </Fact>
        )}
        {t.pets.length > 0 && <Fact label="Pets">{t.pets.map((p) => p.itemName).join(', ')}</Fact>}
        {t.deaths > 0 && <Fact label="Deaths">{t.deaths.toLocaleString()}</Fact>}
      </div>
    </div>
  );
}

export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="max-w-xl mx-auto mt-10 border border-dashed border-card-border rounded-xl p-8 text-center">
      <p className="text-lg font-semibold mb-1">{title}</p>
      {children && <div className="text-sm text-text-muted">{children}</div>}
    </div>
  );
}
