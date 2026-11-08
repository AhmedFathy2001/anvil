// The name Anvil gives a channel it makes for one event ("Create a channel" on the event's Discord
// tab). Pure, so the page can show it and a test can pin it.
//
// Discord's text-channel rules: 1–100 characters, lowercase, no spaces (the client turns them into
// dashes), and most punctuation dropped. Letters and digits in any script are fine, so a non-English
// event name keeps its words instead of falling back to the default.

const MAX = 100;
const FALLBACK = 'event';

/** "Summer Bingo 2026!" → "summer-bingo-2026". Never empty. */
export function eventChannelSlug(name: string): string {
  const slug = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  // Leave room for a "-12" suffix, and never end on the dash a cut can leave behind.
  return slug.slice(0, MAX - 4).replace(/-+$/, '') || FALLBACK;
}

/**
 * The slug, or the first "-2", "-3"… after it that no channel in the server already has, so a new
 * channel never shares a name with one people already know. `taken` is compared lowercased.
 */
export function freeChannelName(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const name = `${base}-${i}`;
    if (!used.has(name)) return name;
  }
  return `${base}-${Date.now().toString(36)}`;
}
