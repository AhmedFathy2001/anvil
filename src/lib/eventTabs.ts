import { eventHasStarted } from '@/lib/completionGate';
import { chatAccess, chatUnread, type ChatAccess } from '@/lib/eventChat';
import type { ChatChannel } from '@/lib/eventChatRules';
import type { ScopedEvent } from '@/lib/eventScope';
import { standingsScopeForSession } from '@/lib/standingsAccess';

/** Which of the event's pages the viewer gets a tab for (components/events/EventTabs). */
export type EventTabsData = { stats: boolean; live: boolean; moderate: boolean; unread: boolean };

/**
 * The event tab bar's tabs for one viewer, shared by the event page and its Stats, Feed & chat and
 * Moderate pages so the bar is the same everywhere:
 * - Stats once the board has started, unless the standings are curtained for this viewer;
 * - Feed & chat for the board's players and the host's staff (lib/eventChat chatAccess member);
 * - Moderate for chat staff, at the host's own address only (a co-host's role says nothing here);
 * - `unread` when a chat channel they can read has lines after their read marker. Skipped on the
 *   Feed & chat page itself, which marks what it shows as read.
 * Callers that already hold the chat access or the curtain pass them in to save the reads.
 */
export async function eventTabsFor(
  event: ScopedEvent,
  opts: {
    userId: number | null;
    apiPrefix: string | null;
    active: 'board' | 'stats' | 'live' | 'chat';
    access?: ChatAccess | null;
    curtained?: boolean;
  },
): Promise<EventTabsData> {
  const access = opts.access !== undefined ? opts.access : opts.userId ? await chatAccess(event.id, opts.userId) : null;
  const started = eventHasStarted(event);
  const curtained =
    opts.curtained !== undefined ? opts.curtained : started ? (await standingsScopeForSession(event)).hidden : false;
  const live = !!access?.member;

  let unread = false;
  if (live && access?.open && opts.userId && opts.active !== 'live') {
    const channels: ChatChannel[] = ['all', 'announce'];
    if (!access.solo && access.teamId != null) channels.unshift(`team:${access.teamId}`);
    const counts = await chatUnread(access, opts.userId, channels).catch(() => new Map<ChatChannel, number>());
    unread = [...counts.values()].some((n) => n > 0);
  }

  return {
    stats: started && !curtained,
    live,
    moderate: !opts.apiPrefix && event.chatEnabled && !!access?.staff,
    unread,
  };
}
