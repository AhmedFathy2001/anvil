// The seeded boss profiles, by trip content key (lib/tripContent). A boss picked by hand on the
// trip card ("m:<monster key>") finds its profile by the monster's name (`monsters`).
import type { BossProfile } from '../types';
import { ARAXXOR, DUKE, LEVIATHAN, NEX, WHISPERER, YAMA } from './bosses';
import { COX } from './cox';
import { DOOM } from './doom';
import { TOA } from './toa';
import { TOB } from './tob';
import { VORKATH } from './vorkath';
import { ZULRAH } from './zulrah';

export const PROFILES: Record<string, BossProfile> = {
  vorkath: VORKATH,
  zulrah: ZULRAH,
  toa: TOA,
  tob: TOB,
  cox: COX,
  doom: DOOM,
  nex: NEX,
  araxxor: ARAXXOR,
  yama: YAMA,
  duke: DUKE,
  leviathan: LEVIATHAN,
  whisperer: WHISPERER,
};

/** "m:<monster key>" → the monster's name, lowercased. */
const monsterName = (key: string) => key.slice(2).split('#')[0].trim().toLowerCase();

export const profileFor = (key: string): BossProfile | null => {
  if (PROFILES[key]) return PROFILES[key];
  if (!key.startsWith('m:')) return null;
  const name = monsterName(key);
  return Object.values(PROFILES).find((p) => (p.monsters ?? []).some((m) => m.toLowerCase() === name)) ?? null;
};
export { ARAXXOR, COX, DOOM, DUKE, LEVIATHAN, NEX, TOA, TOB, VORKATH, WHISPERER, YAMA, ZULRAH };
