// The gear calculator's data as everyone sees it: the dataset (a /staff refresh from the wiki, or the
// bundled src/data/gear*.json) with platform overrides and custom effect rules applied.
//
// PLATFORM ONLY, deliberately. The calculator is the one part of a guide that should give every clan
// the same answer — a clan tuning its own numbers would make "Advanced = 10.8 DPS" mean different
// things in different Discords.
//
// Cached per process and rebuilt when anything changes. The check is a cheap stamp query at most
// every STAMP_TTL, so an edit on /staff reaches every container within seconds without each request
// paying for a rebuild.

import { count, desc, max } from 'drizzle-orm';

import { db } from '@/db';
import { gearDatasets, gearOverrides } from '@/db/schema';
import { GEAR_DATA } from './data';
import { indexGear, type GearData, type GearIndex } from './summary';
import type { GearItem, Monster } from './engine';
import type { EffectRule } from './effects';

const STAMP_TTL = 15_000;

export interface GearSource {
  kind: 'bundled' | 'refresh';
  datasetId: number | null;
  refreshedAt: string | null;
  itemCount: number;
  monsterCount: number;
  overrides: number;
}

interface Cached {
  stamp: string;
  data: GearData;
  index: GearIndex;
  source: GearSource;
}

let cached: Cached | null = null;
let checkedAt = 0;
let building: Promise<Cached> | null = null;

export const monsterKeyOf = (m: Pick<Monster, 'n' | 'v'>) => (m.v ? `${m.n}#${m.v}` : m.n);

async function stamp(): Promise<string> {
  const [[ds], [ov]] = await Promise.all([
    db.select({ id: max(gearDatasets.id) }).from(gearDatasets),
    db.select({ n: count(), at: max(gearOverrides.updatedAt) }).from(gearOverrides),
  ]);
  return `${ds?.id ?? 'b'}:${ov?.n ?? 0}:${ov?.at ?? ''}`;
}

async function build(currentStamp: string): Promise<Cached> {
  const [latest] = await db.select().from(gearDatasets).orderBy(desc(gearDatasets.id)).limit(1);
  const overrides = await db.select().from(gearOverrides);

  const baseItems = (latest ? (latest.items as GearItem[]) : GEAR_DATA.items).map((i) => ({ ...i }));
  const baseMonsters = (latest ? (latest.monsters as Monster[]) : GEAR_DATA.monsters).map((m) => ({ ...m }));
  const itemById = new Map(baseItems.map((i) => [i.id, i]));
  const monsterByKey = new Map(baseMonsters.map((m) => [monsterKeyOf(m), m]));
  const rules: EffectRule[] = [];

  for (const o of overrides) {
    if (o.kind === 'item') {
      const id = Number(o.key);
      const existing = itemById.get(id);
      const merged = { ...(existing ?? {}), ...(o.data as Partial<GearItem>), id, ovr: 1 as const } as GearItem;
      if (o.hidden) merged.hid = 1;
      else delete merged.hid;
      // An addition must be complete enough to use; a patch can be partial.
      if (!existing && !(merged.n && merged.s && Array.isArray(merged.b))) continue;
      if (existing) Object.assign(existing, merged);
      else {
        baseItems.push(merged);
        itemById.set(id, merged);
      }
    } else if (o.kind === 'monster') {
      const existing = monsterByKey.get(o.key);
      const merged = { ...(existing ?? {}), ...(o.data as Partial<Monster>), ovr: 1 as const } as Monster;
      if (o.hidden) merged.hid = 1;
      else delete merged.hid;
      if (!existing && !(merged.n && merged.hp && Array.isArray(merged.lv) && Array.isArray(merged.d))) continue;
      if (existing) Object.assign(existing, merged);
      else {
        baseMonsters.push(merged);
        monsterByKey.set(o.key, merged);
      }
    } else if (o.kind === 'effect') {
      rules.push({ ...(o.data as unknown as EffectRule), id: o.key });
    }
  }

  baseItems.sort((a, b) => a.n.localeCompare(b.n));
  baseMonsters.sort((a, b) => a.n.localeCompare(b.n) || (a.v ?? '').localeCompare(b.v ?? ''));
  const data: GearData = { items: baseItems, monsters: baseMonsters, rules, version: currentStamp };
  return {
    stamp: currentStamp,
    data,
    index: indexGear(data),
    source: {
      kind: latest ? 'refresh' : 'bundled',
      datasetId: latest?.id ?? null,
      refreshedAt: latest?.createdAt ?? null,
      itemCount: baseItems.length,
      monsterCount: baseMonsters.length,
      overrides: overrides.length,
    },
  };
}

async function current(): Promise<Cached> {
  const now = Date.now();
  if (cached && now - checkedAt < STAMP_TTL) return cached;
  checkedAt = now;
  const s = await stamp();
  if (cached && cached.stamp === s) return cached;
  building ??= build(s).finally(() => {
    building = null;
  });
  cached = await building;
  return cached;
}

/** The effective data, for the API the calculator loads. */
export async function effectiveGear(): Promise<{ data: GearData; source: GearSource }> {
  const c = await current();
  return { data: c.data, source: c.source };
}

/** Lookups over the effective data, for server-side rendering (the Discord summary). */
export async function effectiveGearIndex(): Promise<GearIndex> {
  return (await current()).index;
}

/** After a write on this process: rebuild on the next read instead of waiting out the TTL. */
export function invalidateGear(): void {
  checkedAt = 0;
}
