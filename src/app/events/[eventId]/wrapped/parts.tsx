import type { ReactNode } from 'react';

import { itemIconUrl } from '@/lib/tileIcons';
import { formatHours, ordinal, shortNumber, type WrappedPlayer, type WrappedTeam } from '@/lib/eventWrappedRules';

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

export function PlayerFacts({ p }: { p: WrappedPlayer }) {
  return (
    <div className="space-y-4">
      {p.awards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.awards.map((a) => (
            <span key={a.title} className="rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-sm text-gold">
              {a.emoji} {a.title} <span className="text-text-muted">· {a.valueLabel}</span>
            </span>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-card-border bg-card-bg divide-y divide-card-border">
        {p.team && <Fact label="Team">{p.team.name}{p.team.of > 1 && ` · ${ordinal(p.team.rank)} of ${p.team.of}`}</Fact>}
        {p.placeInTeam && <Fact label="On the team">{ordinal(p.placeInTeam.rank)} of {p.placeInTeam.of}</Fact>}
        {p.minutesPlayed > 0 && <Fact label="Time played">{formatHours(p.minutesPlayed)}</Fact>}
        {p.tilesFinished > 0 && <Fact label="Tiles finished">{p.tilesFinished.toLocaleString()}</Fact>}
        {p.kcGained > 0 && <Fact label="Boss kills">{p.kcGained.toLocaleString()}</Fact>}
        {p.topBoss && <Fact label="Most killed">{p.topBoss.name} · {p.topBoss.kc.toLocaleString()} KC</Fact>}
        {p.xpGained > 0 && <Fact label="XP gained">{p.xpGained.toLocaleString()}</Fact>}
        {p.topSkill && <Fact label="Top skill">{p.topSkill.name} · {shortNumber(p.topSkill.xp)} XP</Fact>}
        {p.biggestDrop && (
          <Fact label="Biggest drop">
            <Item
              itemId={p.biggestDrop.itemId}
              name={p.biggestDrop.itemName}
              detail={p.biggestDrop.valueGp ? `${shortNumber(p.biggestDrop.valueGp)} gp` : null}
            />
          </Fact>
        )}
        {p.pets.map((pet, i) => (
          <Fact key={`${pet.itemName}-${i}`} label="Pet">
            <Item itemId={pet.itemId} name={pet.itemName} />
          </Fact>
        ))}
        {p.spooned && (
          <Fact label="Spooned">
            <Item itemId={p.spooned.itemId} name={p.spooned.itemName} detail={p.spooned.headline} />
          </Fact>
        )}
        {p.dry && (
          <Fact label="Dry">
            <Item itemId={p.dry.itemId} name={p.dry.itemName} detail={p.dry.headline} />
          </Fact>
        )}
        {p.biggestHit > 0 && <Fact label="Biggest hit">{p.biggestHit.toLocaleString()}</Fact>}
        {p.deaths > 0 && <Fact label="Deaths">{p.deaths.toLocaleString()}</Fact>}
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
