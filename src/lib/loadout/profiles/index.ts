// The seeded boss profiles, by trip content key (lib/tripContent).
import type { BossProfile } from '../types';
import { TOA } from './toa';
import { VORKATH } from './vorkath';
import { ZULRAH } from './zulrah';

export const PROFILES: Record<string, BossProfile> = { vorkath: VORKATH, zulrah: ZULRAH, toa: TOA };
export const profileFor = (key: string): BossProfile | null => PROFILES[key] ?? null;
export { TOA, VORKATH, ZULRAH };
