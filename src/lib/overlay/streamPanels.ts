// Channel panels: the images a streamer puts in their Twitch or Kick "About" section, each linking to
// a page of the event. Pure (no database) so the card and the route agree on kinds, links and names.
//
// Drawn at 640×200 — Twitch and Kick show panels 320 px wide, so this is the 2× image they scale down.

export const PANEL_KINDS = ['join', 'board', 'standings'] as const;
export type PanelKind = (typeof PANEL_KINDS)[number];

export const PANEL_WIDTH = 640;
export const PANEL_HEIGHT = 200;

export function isPanelKind(v: unknown): v is PanelKind {
  return typeof v === 'string' && (PANEL_KINDS as readonly string[]).includes(v);
}

export const PANEL_META: Record<PanelKind, { kicker: string; title: string; label: string; path: (eventId: number) => string }> = {
  join: { kicker: 'Play with us', title: 'Join the event', label: 'Join', path: (id) => `/events/${id}/signup` },
  board: { kicker: 'Live progress', title: 'The board', label: 'Board', path: (id) => `/events/${id}` },
  standings: { kicker: 'Who is winning', title: 'Standings', label: 'Standings', path: (id) => `/events/${id}/stats` },
};

/** `viewer-bingo-join.png`. Only [a-z0-9-] reaches the header; an all-symbol name falls back to the id. */
export function panelFileName(eventName: string, eventId: number, kind: PanelKind): string {
  const slug = eventName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return `${slug || `event-${eventId}`}-${kind}.png`;
}

/** The event name as drawn: one line, cut with an ellipsis past what fits at the panel's size. */
export function panelEventName(name: string, max = 34): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
