import type { Fact, SourceKind } from '@/lib/pluginFacts/match';

const KINDS = new Set<SourceKind>(['npc', 'event', 'pvp', 'pickpocket', 'clog']);
const MAX_FACTS = 50;
const MAX_ITEMS = 100;
const str = (v: unknown, max = 96) => (typeof v === 'string' && v.length <= max ? v : null);
const int = (v: unknown, max = 2_147_483_647) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);

/** Only well-formed facts survive; anything else is dropped, never trusted. */
export function parseFacts(raw: unknown): Fact[] {
  if (!Array.isArray(raw)) return [];
  const out: Fact[] = [];
  for (const f of raw.slice(0, MAX_FACTS)) {
    if (!f || typeof f !== 'object') continue;
    const o = f as Record<string, unknown>;
    const kind = KINDS.has(o.kind as SourceKind) ? (o.kind as SourceKind) : null;
    if (o.k === 'loot' && kind && Array.isArray(o.items)) {
      const items = (o.items as unknown[])
        .slice(0, MAX_ITEMS)
        .filter((p): p is [number, number] => Array.isArray(p) && int(p[0], 1_000_000) != null && int(p[1]) != null)
        .map(([id, q]) => [id, q] as [number, number]);
      if (items.length) out.push({ k: 'loot', src: str(o.src), kind, items, party: int(o.party, 255), inf: str(o.inf, 48) });
    } else if (o.k === 'value' && kind && int(o.gp) != null) {
      out.push({ k: 'value', src: str(o.src), kind, gp: o.gp as number });
    } else if (o.k === 'kill' && o.n && typeof o.n === 'object') {
      const n: Record<string, number> = {};
      for (const [name, amount] of Object.entries(o.n as Record<string, unknown>).slice(0, 8)) {
        if (str(name) && int(amount, 10_000)) n[name] = amount as number;
      }
      const unv = Array.isArray(o.unv) ? (o.unv as unknown[]).map((x) => str(x)).filter((x): x is string => !!x) : undefined;
      if (Object.keys(n).length) out.push({ k: 'kill', n, unv, inf: str(o.inf, 48) });
    }
  }
  return out;
}
