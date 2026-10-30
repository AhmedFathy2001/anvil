// The Discord channels a clan event points people at: where to chat, where its guide lives, and the
// voice channel to join. Each is picked from the clan's own server and kept with its name as it was
// then, so the site and the plugin can say "#mass-chat" without asking Discord on every read.
//
// Pure — no database — so tests/clan-event-modules.test.ts reads it directly.

export const CHANNEL_SLOTS = ['chat', 'guide', 'voice'] as const;
export type ChannelSlot = (typeof CHANNEL_SLOTS)[number];

export interface PickedChannel {
  id: string;
  name: string;
}

export type ClanEventChannels = Partial<Record<ChannelSlot, PickedChannel>>;

export const CHANNEL_SLOT_LABELS: Record<ChannelSlot, string> = { chat: 'Chat', guide: 'Guide', voice: 'Voice' };

const SNOWFLAKE = /^\d{17,20}$/;

/** Submitted channels made safe: a slot keeps only a real channel id and a short name, or is dropped. */
export function parseChannels(raw: unknown): ClanEventChannels | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: ClanEventChannels = {};
  for (const slot of CHANNEL_SLOTS) {
    const v = (raw as Record<string, unknown>)[slot];
    if (!v || typeof v !== 'object') continue;
    const id = String((v as { id?: unknown }).id ?? '');
    if (!SNOWFLAKE.test(id)) continue;
    const name = String((v as { name?: unknown }).name ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, 100);
    out[slot] = { id, name: name || 'channel' };
  }
  return Object.keys(out).length ? out : null;
}

/** The slots that are set, in a fixed order. */
export function channelList(c: ClanEventChannels | null | undefined): { slot: ChannelSlot; channel: PickedChannel }[] {
  return CHANNEL_SLOTS.flatMap((slot) => (c?.[slot] ? [{ slot, channel: c[slot]! }] : []));
}

/** "Chat <#1> · Voice <#3>" — Discord turns each mention into a link (a voice one joins). */
export function channelMentions(c: ClanEventChannels | null | undefined): string | null {
  const list = channelList(c);
  return list.length ? list.map(({ slot, channel }) => `${CHANNEL_SLOT_LABELS[slot]} <#${channel.id}>`).join(' · ') : null;
}
