// The website's Feed & chat page (app/events/[eventId]/live): the shapes its rows and lines travel in,
// and the little the browser works out itself. Pure and light enough for the client bundle; the
// mapping from the panel's data is lib/liveRows (tests/live-view.test.ts covers both).

import type { ChatChannel } from '@/lib/eventChatRules';

/** A name's colours: solid, or a gradient (moving for a Patron). */
export interface LiveInk {
  color: string;
  grad?: string[];
  move?: boolean;
  /** Their tenure badge (the panel's glyph, 'tenure-1'…'tenure-6'), drawn before the name. */
  glyph?: string;
}

/** A row's picture: an image, or the panel's glyph in its colour. */
export type LiveIcon = { src: string; alt: string } | { glyph: 'check' | 'star' | 'chevron-right'; color: string | null };

export interface LiveFeedRow {
  /** The panel row's id: `m<moment>` or `t<tile>:<team>`. */
  id: string;
  /** The moment behind the row (reactions go on it); null for a finished tile. */
  momentId: number | null;
  /** The moment's kind, or 'tile'. */
  kind: string;
  title: string;
  /** The title's colour by kind (purple for a pet, coral for a death…); null = plain. */
  titleColor: string | null;
  icon: LiveIcon;
  who: string;
  /** A Supporter's colours; else the name is in `whoColor` (their team's), else muted. */
  ink: LiveInk | null;
  whoColor: string | null;
  /** The team (or the game mode) after the name. */
  tag: { label: string; color: string | null } | null;
  value: string | null;
  /** ISO time. */
  at: string;
  /** The viewer's team's. */
  mine: boolean;
}

export interface LiveChatLine {
  id: number;
  who: string;
  ink: LiveInk | null;
  /** HOST / MOD, or the sender's team. */
  tag: { label: string; color: string | null } | null;
  body: string;
  /** ISO time. */
  at: string;
  /** Said by the viewer (any of their characters). */
  mine: boolean;
  /** The viewer may delete this line and mute its sender (staff who outrank them). */
  canMod: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A panel colour as CSS: a hex as is; the panel's named colours mapped; 'muted' and the like are null. */
export function cssColor(c: string | null | undefined): string | null {
  if (!c) return null;
  if (HEX.test(c)) return c;
  if (c === 'done') return '#5fd35f';
  if (c === 'brand') return '#ff981f';
  if (c === 'error') return '#ff7a6b';
  return null;
}

/** A stored stamp ("2026-11-09 14:05:00", UTC) or an ISO time, as ISO. */
export function isoStamp(stamp: string): string {
  if (!stamp) return stamp;
  if (stamp.includes('T')) return stamp;
  return `${stamp.replace(' ', 'T')}Z`;
}

const GLYPH = /^tenure-[1-6]$/;

export function inkOf(ink: { color: string; grad?: readonly string[]; move?: boolean; glyph?: string | null } | null | undefined): LiveInk | null {
  if (!ink || !HEX.test(ink.color)) return null;
  const grad = (ink.grad ?? []).filter((c) => HEX.test(c));
  return {
    color: ink.color,
    ...(grad.length >= 2 ? { grad, ...(ink.move ? { move: true } : {}) } : {}),
    ...(ink.glyph && GLYPH.test(ink.glyph) ? { glyph: ink.glyph } : {}),
  };
}

/** The channel switch's segment for a channel: 'team' for any team's. */
export type LiveChanKey = 'team' | 'all' | 'announce';
export const chanKey = (ch: ChatChannel): LiveChanKey => (ch.startsWith('team:') ? 'team' : ch === 'announce' ? 'announce' : 'all');

/** Who may see the page at all, said to everyone else. */
export const LIVE_NO_ACCESS = 'Only this event’s players can see its feed and chat.';

/** Feed rows per "Load more", and the most one list will hold. */
export const FEED_PAGE = 40;
export const FEED_MAX = 400;

/** How many Feed rows to send for a requested count: a whole page, within the cap. */
export function feedCount(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < FEED_PAGE) return FEED_PAGE;
  return Math.min(FEED_MAX, Math.ceil(n / FEED_PAGE) * FEED_PAGE);
}

/** A line's time: "14:05" today, "Nov 8 · 14:05" before. */
export function clockLabel(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const today = new Date(now);
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}
