/**
 * Stripping OSRS chat markup that the plugin can't.
 *
 * The game wraps the clickable name in some completion messages — combat achievements are the one
 * that bit — in an "@component@" marker, e.g. `@ach_comp@This Is Madness`. It is NOT an angle-bracket
 * tag, so the plugin's `<...>`-stripper (AnvilPlugin: `msg.replaceAll("<[^>]*>", "")`) leaves it
 * behind, and the raw marker rides into the forwarded Discord embed's title and wiki URL — which is
 * where a clan sees `⚔️ @ach_comp@This Is Madness` instead of `⚔️ This Is Madness`.
 *
 * Fixed HERE, on the server, rather than in the plugin: the marker is already on thousands of
 * installed clients that will not update for months, and `/api/plugin/notify` is a pure relay, so
 * one strip on the way out repairs every one of them at once — the same reason routing and the
 * seasonal stamp live server-side. When the plugin is eventually taught to strip it too, this
 * becomes a harmless second line of defence.
 *
 * The pattern is a lowercase token between two @ — `@ach_comp@`, and defensively any sibling the
 * game adds (`@ach_diary@`, …). It cannot occur in a real task name (they have no @) or in ordinary
 * notification text, so the strip is safe to apply to whatever the plugin sent.
 */

const GAME_MARKUP = /@[a-z][a-z0-9_]*@/g;

/** Remove `@component@` markers from one string, tidying the whitespace and punctuation they leave.
 *  Null/undefined pass straight through, so callers holding an optional field need no guard. */
export function stripGameMarkup<T extends string | null | undefined>(text: T): T {
  if (text == null) return text;
  const cleaned = text.replace(GAME_MARKUP, '');
  if (cleaned === text) return text; // untouched — don't disturb spacing on the common case
  return cleaned
    .replace(/\s{2,}/g, ' ') // "⚔️  This" → "⚔️ This"
    .replace(/\s+([.,!?;:])/g, '$1') // stray space before punctuation the marker sat in front of
    .trim() as T;
}

/**
 * Recursively strip markers from every string in a plugin-sent payload (an embed, its fields, its
 * author/footer). Returns a new object; the input is not mutated. Non-string leaves pass through.
 */
export function stripGameMarkupDeep<T>(value: T): T {
  if (typeof value === 'string') return stripGameMarkup(value) as unknown as T;
  if (Array.isArray(value)) return value.map(stripGameMarkupDeep) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripGameMarkupDeep(v);
    }
    return out as T;
  }
  return value;
}
