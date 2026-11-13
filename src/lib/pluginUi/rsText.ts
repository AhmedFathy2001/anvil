/**
 * Text the panel draws in the RuneScape fonts. Those fonts lack a few typographic characters (– ‘ ’ “ ”
 * in small/regular, ‹ › → ← • in all three), and a label holding one falls back to the system font on
 * the plugin side. Swapping them for the plain characters keeps the panel in the game's own font; real
 * symbols (✓ ↗ ▸ …) are left alone and still use the fallback.
 */
const SWAP: Record<string, string> = { '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '‹': '<', '›': '>', '→': '->', '←': '<-', '•': '·' };
const RE = /[–‘’“”‹›→←•]/g;

export function rsText<T>(v: T): T {
  if (typeof v === 'string') return v.replace(RE, (c) => SWAP[c]) as T;
  if (Array.isArray(v)) return v.map(rsText) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = rsText(x);
    return out as T;
  }
  return v;
}
