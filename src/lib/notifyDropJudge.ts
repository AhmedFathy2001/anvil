import { dropRarity, judgeDropFor, type CandidateItem, type DropCandidate, type DropVerdict } from '@/lib/notifyDrops';
import { characterClanDrops, dropHookFilters } from '@/lib/notifyDefaults';
import { itemNameIndex } from '@/lib/notifyDropItems';
import { getNotifyPrefs } from '@/lib/notifyPrefsStore';
import { clanPluginSettings } from '@/lib/pluginConfigEnrolled';
import { pluginModeThresholds } from '@/lib/worldModeStore';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 128) => (typeof v === 'string' ? v.slice(0, max) : null);

/** A drop candidate off the notify body, or null when it isn't one. */
export function parseCandidate(raw: unknown): DropCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.items) || o.items.length === 0 || o.items.length > 50) return null;
  const items: CandidateItem[] = [];
  for (const it of o.items) {
    const i = (it ?? {}) as Record<string, unknown>;
    const qty = num(i.qty);
    const value = num(i.value);
    const name = str(i.name);
    if (!name || qty == null || qty < 1 || value == null || value < 0) return null;
    items.push({ id: num(i.id), name, qty: Math.round(qty), value: Math.round(value) });
  }
  return {
    rsn: str(o.rsn, 12),
    source: str(o.source),
    sourceKind: str(o.sourceKind, 32),
    kc: num(o.kc),
    items,
    key: o.key === true,
    note: str(o.note, 512),
    notable: o.notable === 'loot' || o.notable === 'unlock' ? o.notable : null,
  };
}

/**
 * Judge a drop the plugin's screenshot gate let through (facts.judge): the post's facts and which of the
 * person's destinations take it, or null when nothing in it posts. The addressed clan's floor and guaranteed list, the person's prefs, and this
 * world's mode thresholds — what the plugin used to read off its own config to decide the same thing.
 */
export async function judgeDropRequest(
  request: Request,
  clanId: number,
  userId: number,
  accountId: number | null,
  facts: unknown,
): Promise<DropVerdict | null> {
  const candidate = parseCandidate(facts);
  if (!candidate) return null;
  const [prefs, settings, mode, names, hooks] = await Promise.all([
    getNotifyPrefs(userId),
    clanPluginSettings(clanId),
    pluginModeThresholds(request, { userId, addressedClanId: clanId, accountId: async () => accountId }),
    itemNameIndex(),
    dropHookFilters(userId),
  ]);
  const clan = await characterClanDrops(accountId, clanId, settings.dropRarityFloor);
  return judgeDropFor(candidate, {
    prefs,
    clan,
    mode,
    guaranteed: settings.facts?.guaranteed,
    nameOf: names.nameOf,
  }, hooks);
}

/**
 * A named pet's drop rate, filled in here off the same tables as rare drops (the plugin used to price it
 * itself). Unchanged facts when it already has one, or when there's nothing to price it by.
 */
export async function withPetRarity(facts: unknown): Promise<unknown> {
  if (!facts || typeof facts !== 'object') return facts;
  const o = facts as Record<string, unknown>;
  const itemId = num(o.itemId);
  const name = str(o.name);
  const source = str(o.source);
  if (o.dropRate != null || itemId == null || itemId <= 0 || !name || !source) return facts;
  const { nameOf } = await itemNameIndex();
  // A pet the server files under a killable monster is by definition an npc drop.
  const rate = dropRarity(str(o.sourceKind, 32) ?? 'npc', source, { id: itemId, name, qty: 1 }, nameOf);
  return rate != null && rate > 0 ? { ...o, dropRate: rate } : facts;
}
