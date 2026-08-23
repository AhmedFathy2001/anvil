import { itemIconUrl } from '@/lib/tileIcons';
import { TILE_KIND_BADGES, type TileKindKey } from '@/lib/tileKinds';

/**
 * Everything a tile can watch for, as a grid.
 *
 * DERIVED FROM THE SOURCE, not retyped. `TILE_KIND_BADGES` is what the tile authoring surfaces
 * actually offer, so the landing's count is the real count and a new kind appears here the day it
 * ships. A hand-written list of fifteen would be a claim rather than a fact, and it would be wrong
 * within a release — this project has added four tile kinds in a month.
 *
 * THE SAME SPRITES THE GAME USES. Items come from RuneLite's export of the game cache and the
 * abstract kinds from the wiki's own skill and status icons, which is exactly where a real board
 * gets its tile art (lib/tileIcons). A page selling "if it happens in game, it counts" should be
 * drawn out of the game rather than out of an icon set nobody recognises. Every URL below was
 * fetched before it shipped.
 *
 * The blurbs are rewritten for a stranger. The ones on `TILE_KIND_BADGES` are addressed to the
 * person building a board ("hiscores-polled", "plugin-detected"); somebody deciding whether to try
 * Anvil wants to know what it watches, not how.
 */
const WIKI = 'https://oldschool.runescape.wiki/images/';

const COPY: Record<TileKindKey, { label: string; blurb: string; icon: string }> = {
  drop: { label: 'Drops', blurb: 'N of an item, or any one from a pool', icon: itemIconUrl(4151) },
  boss: { label: 'Boss KC', blurb: 'Kill counts, straight off the hiscores', icon: itemIconUrl(20997) },
  skill: { label: 'Skill XP', blurb: 'Reach a level, or an experience goal', icon: `${WIKI}Stats_icon.png` },
  collection: { label: 'Item sets', blurb: 'Several items, each with its own count', icon: itemIconUrl(11832) },
  kill: { label: 'NPC kills', blurb: 'Even ones the hiscores never tracked', icon: `${WIKI}Slayer_icon.png` },
  lap: { label: 'Agility laps', blurb: 'Laps, Sepulchre floors, full runs', icon: `${WIKI}Agility_icon.png` },
  timed: { label: 'Timed clears', blurb: 'Inferno, raids, Colosseum — under a cap', icon: itemIconUrl(21295) },
  deathless: { label: 'Deathless', blurb: 'Raids finished with nobody dying', icon: `${WIKI}Hitpoints_icon.png` },
  pvp: { label: 'PvP kills', blurb: 'Anyone, a rival team, or a named bounty', icon: `${WIKI}Skull_(status)_icon.png` },
  lms: { label: 'LMS', blurb: 'Place top-N in Last Man Standing', icon: itemIconUrl(12746) },
  value: { label: 'Loot value', blurb: 'A haul worth X gp, priced as it drops', icon: itemIconUrl(995) },
  gain: { label: 'Gathering', blurb: 'Catch, cook or gather N of anything', icon: `${WIKI}Fishing_icon.png` },
  diary: { label: 'Diaries', blurb: 'Achievement diary tiers, as they complete', icon: `${WIKI}Achievement_Diaries_icon.png` },
  ca: { label: 'Combat tasks', blurb: 'Combat achievements earned during the event', icon: `${WIKI}Combat_Achievements_icon.png` },
  standard: { label: 'Anything else', blurb: 'A captain marks it, with the proof attached', icon: itemIconUrl(19835) },
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
        const c = COPY[k];
        const label = c?.label ?? TILE_KIND_BADGES[k].label;
        const blurb = c?.blurb ?? TILE_KIND_BADGES[k].blurb;
        return (
          <div
            key={k}
            className="group flex gap-3 bg-card-bg p-3.5 transition-colors hover:bg-card-bg-hover sm:p-4"
          >
            {c && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.icon}
                alt=""
                width={26}
                height={26}
                loading="lazy"
                className="mt-0.5 h-[26px] w-[26px] shrink-0 object-contain opacity-70 drop-shadow-md transition-opacity group-hover:opacity-100"
              />
            )}
            <span className="min-w-0">
              <b className="mb-1 block text-[13.5px] font-semibold">{label}</b>
              <span className="block text-[11.5px] leading-[1.45] text-text-muted [overflow-wrap:anywhere]">
                {blurb}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
