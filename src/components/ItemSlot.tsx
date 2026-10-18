/* eslint-disable @next/next/no-img-element -- tiny pixel sprites; next/image would smooth them */

// OSRS item sprites (from the OSRS wiki) shown in an inventory-style slot. The admin area's icons:
// they stand for features and formats — never for a clan, a person or Anvil itself, whose own images
// always win.

export const SPRITES = {
  fireCape: { src: '/osrs/fire-cape.png', w: 28, h: 30 },
  zenyte: { src: '/osrs/zenyte-shard.png', w: 17, h: 30 },
  graceful: { src: '/osrs/graceful-hood.png', w: 18, h: 23 },
  dagger: { src: '/osrs/dragon-dagger.png', w: 14, h: 26 },
  casket: { src: '/osrs/casket.png', w: 29, h: 26 },
  emblem: { src: '/osrs/emblem.png', w: 15, h: 25 },
  bandos: { src: '/osrs/bandos-chestplate.png', w: 20, h: 28 },
  stats: { src: '/osrs/stats.png', w: 25, h: 23 },
  coins: { src: '/osrs/coins.png', w: 30, h: 29 },
  petRock: { src: '/osrs/pet-rock.png', w: 23, h: 21 },
  hammer: { src: '/osrs/hammer.png', w: 23, h: 29 },
  clue: { src: '/osrs/clue.png', w: 31, h: 27 },
  ring: { src: '/osrs/ring.png', w: 18, h: 22 },
  tinderbox: { src: '/osrs/tinderbox.png', w: 30, h: 28 },
  teleport: { src: '/osrs/teleport.png', w: 28, h: 28 },
  // Not an item: Discord's own mark, for the Discord page. A vector, so it scales without pixelating.
  discord: { src: '/icons/discord.svg', w: 22, h: 17 },
} as const;

export type SpriteName = keyof typeof SPRITES;

/** A bare sprite at its natural pixel size (or an integer multiple). */
export function Sprite({ name, scale = 1, className = '' }: { name: SpriteName; scale?: number; className?: string }) {
  const s = SPRITES[name];
  return (
    <img
      src={s.src}
      alt=""
      width={s.w * scale}
      height={s.h * scale}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

/** A sprite sitting in an inventory slot. `size` is the slot's edge in px. */
export default function ItemSlot({ name, size = 40, scale }: { name: SpriteName; size?: number; scale?: number }) {
  const s = SPRITES[name];
  // Fit by default: as large as an integer multiple allows inside ~75% of the slot.
  const fit = scale ?? Math.max(1, Math.floor((size * 0.75) / Math.max(s.w, s.h)));
  return (
    <span className="item-slot" style={{ width: size, height: size }} aria-hidden="true">
      <Sprite name={name} scale={fit} />
    </span>
  );
}
