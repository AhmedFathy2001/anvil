// OSRS chat styling, stripped at the door.
//
// The game marks text up in two ways and the plugin only ever removed one. RuneLite's `<col=…>` /
// `<img=…>` markup is the familiar form; the other is Jagex's older `@tag@` colour codes (`@red@`,
// `@dre@`, …), which now include named ones sitting inline with the text — a Combat Achievement
// completion line arrives as "…combat task: @ach_comp@Phantom Muspah Speed-Chaser." The plugin's
// parse captured the code along with the task name, so it reached the Discord post, the wiki link
// built from it, and the CA tile matcher (which compares names with equals(), so a board naming a
// specific task quietly stopped crediting).
//
// The plugin fix is released; this is the same strip on OUR side of the wire, because a hub release
// reaches players on the plugin-hub's schedule and every client already installed keeps sending the
// raw string until then. Server-side it costs one regex per ingest and stays correct afterwards —
// a stripped string is idempotent, so both layers doing it is not a conflict.
//
// Never content. No RSN, item, boss, activity or task name in OSRS contains either form.

/**
 * Both markup forms. The `@` half is deliberately narrow — short and alphanumeric between the two
 * markers — so a lone `@` in ordinary text needs a second one close behind it to be touched at all.
 */
const CHAT_TAG = /<[^>]*>|@[A-Za-z0-9_]{1,20}@/g;

/** True when a string still carries styling — the cleanup pass's filter. */
export function hasChatTags(value: string): boolean {
  CHAT_TAG.lastIndex = 0;
  return CHAT_TAG.test(value);
}

/** A string with its styling removed. Non-strings pass through untouched. */
export function stripChatTags<T>(value: T): T {
  return typeof value === 'string' ? (value.replace(CHAT_TAG, '') as unknown as T) : value;
}

/**
 * The same strip over a whole JSON value, in place of the caller naming every field.
 *
 * The notification relay forwards an embed the PLUGIN composed — title, description, fields, the
 * wiki URL built from the item or task name — so the tag can be in any of them, and next release it
 * could be somewhere new. Walking the object keeps the relay honest without it having to know the
 * shape of an embed, which is not its job.
 *
 * Keys are left alone: they are ours, they are never styled, and rewriting one would change the
 * shape of the payload rather than clean it.
 */
export function stripChatTagsDeep<T>(value: T): T {
  if (typeof value === 'string') return stripChatTags(value);
  if (Array.isArray(value)) return value.map(stripChatTagsDeep) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = stripChatTagsDeep(inner);
    }
    return out as unknown as T;
  }
  return value;
}
