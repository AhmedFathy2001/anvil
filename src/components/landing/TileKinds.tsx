import { TILE_KIND_BADGES, type TileKindKey } from '@/lib/tileKinds';

/**
 * Everything a tile can watch for, as a grid.
 *
 * DERIVED FROM THE SOURCE, not retyped. `TILE_KIND_BADGES` is what the tile authoring surfaces
 * actually offer, so the landing's count is the real count and a new kind appears here the day it
 * ships. A hand-written list of fifteen would be a claim rather than a fact, and it would be wrong
 * within a release — this project has added four tile kinds in a month.
 *
 * The blurbs are rewritten for a stranger. The ones on `TILE_KIND_BADGES` are addressed to the
 * person building a board ("hiscores-polled", "plugin-detected"); somebody deciding whether to try
 * Anvil wants to know what it watches, not how.
 */
const COPY: Record<TileKindKey, { label: string; blurb: string }> = {
  drop: { label: 'Drops', blurb: 'N of an item, or any one from a pool' },
  boss: { label: 'Boss KC', blurb: 'Kill counts, straight off the hiscores' },
  skill: { label: 'Skill XP', blurb: 'Reach a level, or an experience goal' },
  collection: { label: 'Item sets', blurb: 'Several items, each with its own count' },
  kill: { label: 'NPC kills', blurb: 'Even ones the hiscores never tracked' },
  lap: { label: 'Agility laps', blurb: 'Laps, Sepulchre floors, full runs' },
  timed: { label: 'Timed clears', blurb: 'Inferno, raids, Colosseum — under a cap' },
  deathless: { label: 'Deathless', blurb: 'Raids finished with nobody dying' },
  pvp: { label: 'PvP kills', blurb: 'Anyone, a rival team, or a named bounty' },
  lms: { label: 'LMS', blurb: 'Place top-N in Last Man Standing' },
  value: { label: 'Loot value', blurb: 'A haul worth X gp, priced as it drops' },
  gain: { label: 'Gathering', blurb: 'Catch, cook or gather N of anything' },
  diary: { label: 'Diaries', blurb: 'Achievement diary tiers, as they complete' },
  ca: { label: 'Combat tasks', blurb: 'Combat achievements earned during the event' },
  standard: { label: 'Anything else', blurb: 'A captain marks it, with the proof attached' },
};

/** Reading order: the kinds people recognise first, with the manual fallback last. */
const ORDER: TileKindKey[] = [
  'drop', 'boss', 'skill', 'collection', 'kill',
  'lap', 'timed', 'deathless', 'pvp', 'lms',
  'value', 'gain', 'diary', 'ca', 'standard',
];

/** Every key, in reading order, with anything new appended rather than silently dropped. */
const KEYS = [
  ...ORDER,
  ...(Object.keys(TILE_KIND_BADGES) as TileKindKey[]).filter((k) => !ORDER.includes(k)),
];

export const TILE_KIND_COUNT = KEYS.length;

export default function TileKinds() {
  return (
    // 15 kinds is 5×3 exactly, which is why the grid is fixed rather than auto-fill: an auto-fill
    // track leaves a ragged last row at most widths, and a ragged row reads as an oversight.
    <div className="grid gap-px overflow-hidden rounded-2xl border border-card-border bg-card-border [grid-template-columns:repeat(2,1fr)] sm:[grid-template-columns:repeat(3,1fr)] xl:[grid-template-columns:repeat(5,1fr)]">
      {KEYS.map((k) => {
        const c = COPY[k] ?? { label: TILE_KIND_BADGES[k].label, blurb: TILE_KIND_BADGES[k].blurb };
        return (
          <div key={k} className="bg-card-bg p-3.5 transition-colors hover:bg-card-bg-hover sm:p-4">
            <b className="mb-1 block text-[13.5px] font-semibold">{c.label}</b>
            <span className="block text-[11.5px] leading-[1.45] text-text-muted [overflow-wrap:anywhere]">
              {c.blurb}
            </span>
          </div>
        );
      })}
    </div>
  );
}
