// Validating what /staff sends for an item or monster override. PURE.
//
// An override is a PATCH over the dataset entry (only the fields given change), or a whole new entry
// when the wiki doesn't have it yet. Numbers are clamped to what the game can plausibly hold, so a
// typo can't produce a 5,000-strength item that tops every upgrade route.

import type { GearItem, Monster } from './engine';
import { SLOTS, WEAPON_STYLES } from './tables';

const int = (v: unknown, lo: number, hi: number, label: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  return Math.max(lo, Math.min(hi, Math.round(n)));
};
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const ELEMENTS = ['air', 'water', 'earth', 'fire'] as const;

export function sanitizeItemPatch(raw: unknown, adding: boolean): Partial<GearItem> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<GearItem> = {};
  if (r.n !== undefined || adding) {
    const n = text(r.n, 80);
    if (!n) throw new Error('Give the item a name.');
    out.n = n;
  }
  if (r.s !== undefined || adding) {
    const s = text(r.s, 12);
    if (!(SLOTS as readonly string[]).includes(s)) throw new Error('Pick a valid slot.');
    out.s = s;
  }
  if (r.b !== undefined || adding) {
    if (!Array.isArray(r.b) || r.b.length !== 9) throw new Error('Bonuses must be 9 numbers: stab, slash, crush, magic, ranged, strength, ranged strength, magic damage %, prayer.');
    out.b = r.b.map((v, i) => int(v, -200, i === 7 ? 100 : 400, 'Each bonus'));
  }
  if (r.h2 !== undefined) {
    if (r.h2) out.h2 = 1;
  }
  if (r.df !== undefined) out.df = int(r.df, -1000, 3000, 'Defence total');
  if (r.sp !== undefined && r.sp !== null && r.sp !== '') out.sp = int(r.sp, 1, 10, 'Attack speed');
  if (r.c !== undefined && r.c !== null && r.c !== '') {
    const c = text(r.c, 30);
    if (!(c in WEAPON_STYLES)) throw new Error('Unknown weapon category.');
    out.c = c;
  }
  if (r.img !== undefined) {
    const img = text(r.img, 120);
    if (img && !/^[\w '().,+-]+\.(png|gif)$/i.test(img)) throw new Error('Icon must be a wiki image file name, like "Abyssal whip.png".');
    if (img) out.img = img;
  }
  return out;
}

export function sanitizeMonsterPatch(raw: unknown, adding: boolean): Partial<Monster> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<Monster> = {};
  if (r.n !== undefined || adding) {
    const n = text(r.n, 80);
    if (!n) throw new Error('Give the monster a name.');
    out.n = n;
  }
  if (r.v !== undefined) {
    const v = text(r.v, 60);
    if (v) out.v = v;
  }
  if (r.hp !== undefined || adding) out.hp = int(r.hp, 1, 100000, 'Hitpoints');
  if (r.cb !== undefined) out.cb = int(r.cb, 0, 10000, 'Combat level');
  if (r.lv !== undefined || adding) {
    if (!Array.isArray(r.lv) || r.lv.length !== 2) throw new Error('Levels must be [defence, magic].');
    out.lv = r.lv.map((v) => int(v, 0, 1000, 'Each level'));
  }
  if (r.mab !== undefined) out.mab = int(r.mab, -500, 1000, 'Magic attack bonus');
  if (r.d !== undefined || adding) {
    if (!Array.isArray(r.d) || r.d.length !== 7) throw new Error('Defences must be 7 numbers: stab, slash, crush, magic, light, standard, heavy ranged.');
    out.d = r.d.map((v) => int(v, -500, 1000, 'Each defence'));
  }
  if (r.a !== undefined) {
    const a = Array.isArray(r.a) ? r.a : typeof r.a === 'string' ? r.a.split(',') : [];
    out.a = a.map((x) => text(x, 30).toLowerCase()).filter(Boolean).slice(0, 10);
  }
  if (r.sz !== undefined) out.sz = int(r.sz, 1, 10, 'Size');
  if (r.fa !== undefined) out.fa = int(r.fa, 0, 100, 'Flat armour');
  if (r.ew !== undefined) {
    const ew = text(r.ew, 10).toLowerCase();
    if (ew && !(ELEMENTS as readonly string[]).includes(ew)) throw new Error('Weakness must be air, water, earth or fire.');
    if (ew) {
      out.ew = ew;
      out.ewp = int(r.ewp ?? 0, 0, 100, 'Weakness %');
    }
  }
  return out;
}
