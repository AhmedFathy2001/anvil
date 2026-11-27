// The seeded boss profiles, by trip content key (lib/tripContent).
import type { BossProfile } from '../types';
import { COX } from './cox';
import { TOA } from './toa';
import { TOB } from './tob';
import { VORKATH } from './vorkath';
import { ZULRAH } from './zulrah';

export const PROFILES: Record<string, BossProfile> = { vorkath: VORKATH, zulrah: ZULRAH, toa: TOA, tob: TOB, cox: COX };
export const profileFor = (key: string): BossProfile | null => PROFILES[key] ?? null;
export { COX, TOA, TOB, VORKATH, ZULRAH };
