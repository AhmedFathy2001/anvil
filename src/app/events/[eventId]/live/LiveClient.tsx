'use client';

/* eslint-disable @next/next/no-img-element -- tiny pixel sprites; next/image would smooth them */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import Input from '@/components/Input';
import MomentReactions from '@/components/MomentReactions';
import Select from '@/components/Select';
import { TenureBadge } from '@/components/SupporterName';
import { clanFetch } from '@/lib/clanFetch';
import type { LiveChatState, LiveFeedState, LiveSeat } from '@/lib/liveData';
import { FEED_PAGE, clockLabel, type LiveChatLine, type LiveFeedRow, type LiveIcon, type LiveInk } from '@/lib/liveView';
import { TENURE_LADDER } from '@/lib/supporterTiers';

/** How often the page asks "anything new?" while it is in view and the push socket is down (a 304 when nothing moved). */
const POLL_MS = 5_000;
/**
 * With the socket up, a slow check all the same: a few changes reach nobody by push (a sanction on
 * someone else, a team line to Anvil staff who aren't the host's), and a 304 costs next to nothing.
 */
const SAFETY_POLL_MS = 60_000;
/** A burst of pushes (a raid's drops) is one check. */
const PUSH_GATHER_MS = 300;
/** Reconnect backoff: doubling from the first to the last; a socket that lived a while starts over. */
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 60_000;
const SOCKET_SETTLED_MS = 30_000;
const INFO_BLUE = '#6fb6ff';

type Tab = 'feed' | 'chat';

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await clanFetch(path, { cache: 'no-store', ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || 'Couldn’t load that. Try again in a moment.');
  return body as T;
}

export default function LiveClient({
  eventId,
  initialTab,
  seats,
  chatOpen,
}: {
  eventId: number;
  initialTab: Tab;
  /** The viewer's seats when they hold more than one: "Speaking as". */
  seats: LiveSeat[];
  chatOpen: boolean;
}) {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [seat, setSeat] = useState<number | null>(seats[0]?.id ?? null);

  const [feed, setFeed] = useState<LiveFeedState | null>(null);
  const [filter, setFilter] = useState('all');
  const [count, setCount] = useState(FEED_PAGE);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [chat, setChat] = useState<LiveChatState | null>(null);
  const [where, setWhere] = useState<{ f: string; tm: number | null }>({ f: 'team', tm: null });
  const [chatError, setChatError] = useState<string | null>(null);
  // When the lists were last read: times read "14:05" today and "Nov 8 · 14:05" before.
  const [now, setNow] = useState(0);

  const base = `/api/events/${eventId}/live`;
  const seatQ = seat != null ? `&seat=${seat}` : '';

  // ── Loading ──────────────────────────────────────────────────────────────────────────────────
  const feedKey = useRef('');
  const loadFeed = useCallback(
    async (f: string, n: number) => {
      const key = `${f}:${n}:${seat}`;
      feedKey.current = key;
      try {
        const data = await getJson<LiveFeedState>(`${base}/feed?f=${encodeURIComponent(f)}&n=${n}${seatQ}`);
        if (feedKey.current !== key) return;
        setNow(Date.now());
        setFeed(data);
        setFeedError(null);
      } catch (err) {
        if (feedKey.current === key) setFeedError((err as Error).message);
      }
    },
    [base, seat, seatQ],
  );

  const chatKey = useRef('');
  const loadChat = useCallback(
    async (to: { f: string; tm: number | null }, left?: string) => {
      const key = `${to.f}:${to.tm}:${seat}`;
      chatKey.current = key;
      const qs = new URLSearchParams({ f: to.f });
      if (to.tm != null) qs.set('tm', String(to.tm));
      if (left) qs.set('rd', left);
      try {
        const data = await getJson<LiveChatState>(`${base}/chat?${qs}${seatQ}`);
        if (chatKey.current !== key) return;
        setNow(Date.now());
        setChat(data);
        setChatError(null);
      } catch (err) {
        if (chatKey.current === key) setChatError((err as Error).message);
      }
    },
    [base, seat, seatQ],
  );

  // The open tab loads when it opens, and again whenever its filter, channel or seat changes.
  useEffect(() => {
    if (tab !== 'feed') return;
    const t = setTimeout(() => void loadFeed(filter, count), 0);
    return () => clearTimeout(t);
  }, [tab, filter, count, loadFeed]);
  useEffect(() => {
    if (tab !== 'chat' || !chatOpen) return;
    const t = setTimeout(() => void loadChat(where), 0);
    return () => clearTimeout(t);
  }, [tab, where, chatOpen, loadChat]);

  // Keep the tab in the address, so a link (or the plugin's "open on the website") lands on it.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (tab === 'chat') url.searchParams.set('tab', 'chat');
      else url.searchParams.delete('tab');
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* the address is decoration */
    }
  }, [tab]);

  // ── Live updates ─────────────────────────────────────────────────────────────────────────────
  //
  // The push socket (push/server.ts, a web ticket from api/events/[id]/live/ticket) says WHEN something
  // moved; the pulse says WHAT: a push only triggers the same ETag'd pulse check the poll makes, which
  // refetches the half that changed. The socket's panel rows are the plugin's shapes (feed ids, run
  // collapsing, chips), and the website's lists are built by the site (lib/liveData), so applying
  // them here would be a second copy of that logic — and a refetch keeps the curtain's rules where
  // they are. While the socket is down the page polls every few seconds; nothing at all while hidden.
  const latest = useRef({ tab, filter, count, where, loadFeed, loadChat });
  useEffect(() => {
    latest.current = { tab, filter, count, where, loadFeed, loadChat };
  });
  const marks = useRef<{ c: string | null; f: string | null; etag: string | null }>({ c: null, f: null, etag: null });
  /** Drops the socket and dials again with a fresh ticket (after "Only my team's chat" changes its rooms). */
  const reconnect = useRef<() => void>(() => {});
  useEffect(() => {
    marks.current = { c: null, f: null, etag: null };
    let stopped = false;
    let busy = false;
    let again = false;
    const tick = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      try {
        const res = await clanFetch(`${base}/pulse?${seatQ.slice(1)}`, {
          cache: 'no-store',
          headers: marks.current.etag ? { 'If-None-Match': marks.current.etag } : undefined,
        });
        if (res.status === 304 || !res.ok) return;
        marks.current.etag = res.headers.get('ETag');
        const p = (await res.json()) as { c: string; f: string };
        const was = marks.current;
        const now = latest.current;
        // The first answer only seeds the marks: the open tab has just loaded.
        if (was.c != null && was.c !== p.c && now.tab === 'chat' && chatOpen) void now.loadChat(now.where);
        if (was.f != null && was.f !== p.f && now.tab === 'feed') void now.loadFeed(now.filter, now.count);
        marks.current = { ...marks.current, c: p.c, f: p.f };
      } catch {
        /* the next tick tries again */
      } finally {
        busy = false;
        // A push that landed mid-check is checked again, so it never waits for the next poll.
        if (again) {
          again = false;
          void tick();
        }
      }
    };

    // The poll: every few seconds while the socket is down, a slow safety check while it's up.
    let socketUp = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePoll = () => {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = stopped ? null : setTimeout(() => void tick().finally(schedulePoll), socketUp ? SAFETY_POLL_MS : POLL_MS);
    };

    // The socket.
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let gatherTimer: ReturnType<typeof setTimeout> | null = null;
    let retryMs = RETRY_MIN_MS;
    /** No push server here (404), or this browser has no WebSocket: poll only, for this page's life. */
    let noPush = typeof WebSocket === 'undefined';
    const setUp = (up: boolean) => {
      if (socketUp === up) return;
      socketUp = up;
      schedulePoll();
    };
    const pushed = () => {
      if (gatherTimer) return;
      gatherTimer = setTimeout(() => {
        gatherTimer = null;
        void tick();
      }, PUSH_GATHER_MS);
    };
    const retry = (ms: number) => {
      if (stopped || noPush || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, ms);
    };
    const backoff = () => {
      const ms = retryMs;
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      retry(ms);
    };
    let dialing = false;
    const connect = async () => {
      if (stopped || noPush || ws || dialing || document.visibilityState !== 'visible') return;
      dialing = true;
      let pass: { url: string; ticket: string };
      try {
        const res = await clanFetch(`${base}/ticket?${seatQ.slice(1)}`, { cache: 'no-store' });
        if (res.status === 404) {
          noPush = true;
          return;
        }
        if (!res.ok) return backoff();
        pass = (await res.json()) as { url: string; ticket: string };
      } catch {
        return backoff();
      } finally {
        dialing = false;
      }
      if (stopped || ws || document.visibilityState !== 'visible') return;
      let sock: WebSocket;
      try {
        const u = new URL(pass.url);
        u.searchParams.set('ticket', pass.ticket);
        sock = new WebSocket(u.toString());
      } catch {
        return backoff();
      }
      ws = sock;
      let openedAt = 0;
      sock.onopen = () => {
        openedAt = Date.now();
        setUp(true);
        // Whatever moved while the socket was down.
        void tick();
      };
      sock.onmessage = (e) => {
        let t: unknown;
        try {
          t = (JSON.parse(String(e.data)) as { t?: unknown }).t;
        } catch {
          return;
        }
        if (t !== 'hello') pushed();
      };
      sock.onclose = (e) => {
        if (ws !== sock) return;
        ws = null;
        setUp(false);
        if (stopped) return;
        if (openedAt && Date.now() - openedAt > SOCKET_SETTLED_MS) retryMs = RETRY_MIN_MS;
        // 4001: the ticket ran out or the roster moved — ask for a fresh one straight away.
        if (e.code === 4001) retry(250);
        else backoff();
      };
    };
    const hangUp = () => {
      const sock = ws;
      ws = null;
      setUp(false);
      sock?.close(1000, 'page');
    };
    reconnect.current = () => {
      hangUp();
      retryMs = RETRY_MIN_MS;
      void connect();
    };

    // Hidden: no socket and no poll. Back in view: check at once, and dial again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void tick();
        void connect();
      } else hangUp();
    };

    void tick();
    void connect();
    schedulePoll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      for (const t of [pollTimer, retryTimer, gatherTimer]) if (t) clearTimeout(t);
      reconnect.current = () => {};
      hangUp();
    };
  }, [base, seatQ, chatOpen]);

  // ── Chat actions ───────────────────────────────────────────────────────────────────────────
  async function post(payload: Record<string, unknown>): Promise<string | null> {
    try {
      await getJson(`${base}/chat?${seatQ.slice(1)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }

  function openChannel(key: string, tm: number | null) {
    const left = chat?.channel;
    const to = { f: key, tm: key === 'team' ? tm : null };
    setWhere(to);
    // The channel just left counts as read to its newest line (its lines arrived while it was open).
    void loadChat(to, left);
  }

  async function remove(line: LiveChatLine) {
    const ok = await dialog.confirm({
      title: 'Delete this message?',
      body: `${line.who}: “${line.body}” is removed for everyone, in game too.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const error = await post({ action: 'delete', id: line.id });
    dialog.notify(error ?? 'Message removed', error ? 'error' : 'ok');
    await loadChat(where);
  }

  async function mute(line: LiveChatLine) {
    const ok = await dialog.confirm({
      title: `Mute ${line.who}?`,
      body: 'They can still read this event’s chat, but can’t send anything until a moderator lifts it on the moderation page.',
      confirmLabel: 'Mute',
      tone: 'danger',
    });
    if (!ok) return;
    const error = await post({ action: 'mute', id: line.id });
    dialog.notify(error ?? `${line.who} is muted in this chat`, error ? 'error' : 'ok');
    await loadChat(where);
  }

  async function toggleOwnTeam() {
    if (!chat?.ownTeam) return;
    const error = await post({ action: 'own-team', on: !chat.ownTeam.on });
    if (error) dialog.notify(error, 'error');
    // Which teams the socket hears follows the switch: a fresh ticket.
    else reconnect.current();
    await loadChat(where);
  }

  async function togglePause() {
    if (!chat) return;
    const error = await post({ action: 'pause', on: !chat.paused });
    dialog.notify(error ?? (chat.paused ? 'Chat resumed' : 'Chat paused'), error ? 'error' : 'ok');
    await loadChat(where);
  }

  return (
    <div className="space-y-4">
      {seats.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">Speaking as</span>
          <Select
            className="min-w-0 flex-1 sm:max-w-xs"
            ariaLabel="Which of your characters is speaking"
            value={String(seat ?? '')}
            onChange={(v) => setSeat(Number(v))}
            options={seats.map((s) => ({ value: String(s.id), label: s.team ? `${s.name} · ${s.team}` : s.name }))}
          />
        </div>
      )}

      <Segments
        label="Feed or chat"
        items={[
          { key: 'feed', label: 'Feed', on: tab === 'feed' },
          { key: 'chat', label: 'Chat', on: tab === 'chat' },
        ]}
        onPick={(k) => setTab(k as Tab)}
      />

      {tab === 'feed' ? (
        <FeedPane
          now={now}
          feed={feed}
          error={feedError}
          filter={filter}
          loadingMore={loadingMore}
          onFilter={(f) => {
            setFilter(f);
            setCount(FEED_PAGE);
          }}
          onMore={async () => {
            setLoadingMore(true);
            const n = count + FEED_PAGE;
            setCount(n);
            await loadFeed(filter, n);
            setLoadingMore(false);
          }}
        />
      ) : !chatOpen ? (
        <Card>
          <p className="px-4 py-8 text-center text-sm text-text-muted">{chat?.closedWhy ?? 'Chat is off for this event.'}</p>
        </Card>
      ) : (
        <ChatPane
          now={now}
          chat={chat}
          error={chatError}
          onChannel={openChannel}
          onTeam={(tm) => openChannel('team', tm)}
          onOwnTeam={toggleOwnTeam}
          onPause={togglePause}
          onDelete={remove}
          onMute={mute}
          onSend={async (msg) => {
            if (!chat) return 'Still loading.';
            const error = await post({ action: 'send', msg, to: chat.channel });
            if (!error) await loadChat(where);
            return error;
          }}
        />
      )}
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-card-border bg-card-bg ${className}`}>{children}</section>;
}

function SectionBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
      <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h2>
      {right}
    </div>
  );
}

/** The panel's segmented switch: Feed | Chat, and the chat's channels. */
function Segments({
  label,
  items,
  onPick,
}: {
  label: string;
  items: { key: string; label: string; on: boolean; n?: number; blue?: boolean }[];
  onPick: (key: string) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl border border-card-border bg-brown-dark p-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={it.on}
          onClick={() => onPick(it.key)}
          className={`flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 text-[13px] font-semibold sm:gap-1.5 sm:px-2 sm:text-sm transition-colors ${
            it.on ? 'border border-gold/40 bg-gold/15 text-gold' : 'border border-transparent text-text-muted hover:text-foreground'
          }`}
        >
          <span className="truncate">{it.label}</span>
          {!!it.n && it.n > 0 && (
            <span
              className="shrink-0 rounded-full px-1.5 py-px font-mono text-[10.5px] leading-4 text-brown-dark"
              style={{ background: it.blue ? INFO_BLUE : 'var(--color-gold, #ff981f)' }}
            >
              {it.n > 99 ? '99+' : it.n}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
        on ? 'border-gold/50 bg-gold/15 text-gold' : 'border-card-border bg-brown-dark text-text-muted hover:border-gold/30 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

/** A name in its Supporter colours (moving for a Patron), else the colour given, else muted. */
function InkName({ name, ink, color, className = '' }: { name: string; ink: LiveInk | null; color?: string | null; className?: string }) {
  // A Supporter's tenure badge before the name, in their colour (the panel's own art).
  const step = ink?.glyph ? TENURE_LADDER.find((t) => t.glyph === ink.glyph)?.id : undefined;
  const badge = step ? <TenureBadge step={step} color={ink?.grad?.[0] ?? ink?.color ?? '#ffd35c'} stops={ink?.grad ?? null} decorative /> : null;
  if (ink?.grad && ink.grad.length >= 2) {
    const stops = ink.move ? [...ink.grad, ink.grad[0]] : ink.grad;
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        {badge}
        <span className={`${ink.move ? 'supporter-name-patron' : 'supporter-name-champion'} truncate font-semibold ${className}`} style={{ backgroundImage: `linear-gradient(90deg, ${stops.join(', ')})` }}>
          {name}
        </span>
      </span>
    );
  }
  const c = ink?.color ?? color ?? null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {badge}
      <span className={`truncate font-semibold ${c ? '' : 'text-foreground'} ${className}`} style={c ? { color: c } : undefined}>
        {name}
      </span>
    </span>
  );
}

function Tag({ tag }: { tag: { label: string; color: string | null } | null }) {
  if (!tag) return null;
  return (
    <span className="shrink-0 truncate text-[11px] font-semibold" style={{ color: tag.color ?? undefined }}>
      {tag.label}
    </span>
  );
}

function RowIcon({ icon, tint }: { icon: LiveIcon; tint: string | null }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-brown-dark"
      style={tint ? { background: `${tint}1f`, borderColor: `${tint}55` } : undefined}
    >
      {'src' in icon ? (
        <img src={icon.src} alt="" className="max-h-7 max-w-7 object-contain [image-rendering:pixelated]" loading="lazy" />
      ) : icon.glyph === 'star' ? (
        <span style={{ color: icon.color ?? undefined }}>★</span>
      ) : (
        <span className="text-sm font-bold" style={{ color: icon.color ?? undefined }}>✓</span>
      )}
    </span>
  );
}

// ── The Feed ─────────────────────────────────────────────────────────────────────────────────

function FeedPane({
  now,
  feed,
  error,
  filter,
  loadingMore,
  onFilter,
  onMore,
}: {
  now: number;
  feed: LiveFeedState | null;
  error: string | null;
  filter: string;
  loadingMore: boolean;
  onFilter: (f: string) => void;
  onMore: () => void;
}) {
  return (
    <Card>
      <SectionBar title="Live" right={<span className="text-xs text-text-muted">drops, pets and finished tiles from every team</span>} />
      {feed && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {feed.filters.map((f) => (
            <Chip key={f.id} label={f.label} on={filter === f.id} onClick={() => onFilter(f.id)} />
          ))}
        </div>
      )}
      {error && <p className="px-4 pb-3 text-sm text-red-400">{error}</p>}
      {!feed && !error && <p className="px-4 py-8 text-center text-sm text-text-muted">Loading…</p>}
      {feed && feed.rows.length === 0 && <p className="border-t border-card-border px-4 py-8 text-center text-sm text-text-muted">{feed.empty}</p>}
      {feed && feed.rows.length > 0 && (
        <ul className="divide-y divide-card-border border-t border-card-border">
          {feed.rows.map((r) => (
            <FeedRowItem key={r.id} row={r} now={now} reactions={feed.reactions} />
          ))}
        </ul>
      )}
      {feed?.more && (
        <div className="border-t border-card-border p-3">
          <button
            type="button"
            onClick={onMore}
            disabled={loadingMore}
            className="min-h-10 w-full rounded-lg border border-card-border text-sm font-medium text-text-muted transition-colors hover:border-gold/30 hover:text-gold disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </Card>
  );
}

function FeedRowItem({ row, now, reactions }: { row: LiveFeedRow; now: number; reactions: LiveFeedState['reactions'] }) {
  const chips = row.momentId != null ? reactions?.byMoment[row.momentId] : undefined;
  return (
    <li className={`flex items-start gap-3 px-4 py-2.5 ${row.mine ? 'border-l-2 border-l-gold/70 bg-gold/[0.03]' : ''}`}>
      <RowIcon icon={row.icon} tint={row.titleColor} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`min-w-0 flex-1 truncate text-sm font-medium ${row.titleColor ? '' : 'text-foreground'}`} style={row.titleColor ? { color: row.titleColor } : undefined}>
            {row.title}
          </span>
          {row.value && <span className="shrink-0 font-mono text-xs text-gold">{row.value}</span>}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
          <InkName name={row.who} ink={row.ink} color={row.whoColor} className={row.ink || row.whoColor ? '' : '!text-text-muted'} />
          <Tag tag={row.tag} />
          <span className="ml-auto shrink-0 font-mono text-[10.5px]">{clockLabel(row.at, now)}</span>
        </div>
        {chips && reactions && row.momentId != null && (
          <div className="mt-1.5">
            <MomentReactions key={JSON.stringify(chips)} momentId={row.momentId} chips={chips} canReact={reactions.canReact} target={reactions.target} />
          </div>
        )}
      </div>
    </li>
  );
}

// ── The chat ─────────────────────────────────────────────────────────────────────────────────

function ChatPane({
  now,
  chat,
  error,
  onChannel,
  onTeam,
  onOwnTeam,
  onPause,
  onDelete,
  onMute,
  onSend,
}: {
  now: number;
  chat: LiveChatState | null;
  error: string | null;
  onChannel: (key: string, tm: number | null) => void;
  onTeam: (tm: number) => void;
  onOwnTeam: () => void;
  onPause: () => void;
  onDelete: (line: LiveChatLine) => void;
  onMute: (line: LiveChatLine) => void;
  onSend: (msg: string) => Promise<string | null>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lines = chat ? [...chat.lines].reverse() : [];
  const lastId = lines.length ? lines[lines.length - 1].id : 0;

  // Follow new lines while the reader is at the bottom; leave them be while they scroll back.
  useLayoutEffect(() => {
    if (!stick.current) return;
    const box = listRef.current;
    if (box && box.scrollHeight > box.clientHeight) box.scrollTop = box.scrollHeight;
    else endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lastId, chat?.channel]);

  const onScroll = () => {
    const box = listRef.current;
    if (box) stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  };

  if (!chat) {
    return (
      <Card>
        <p className={`px-4 py-8 text-center text-sm ${error ? 'text-red-400' : 'text-text-muted'}`}>{error ?? 'Loading…'}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Segments
        label="Channel"
        items={chat.channels.map((c) => ({ key: c.key, label: c.label, on: c.on, n: c.n, blue: c.key === 'all' }))}
        onPick={(k) => onChannel(k, chat.team)}
      />
      {(chat.teamPicks?.length || chat.ownTeam || chat.staff) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chat.teamPicks?.map((t) => <Chip key={t.id} label={t.name} on={t.on} onClick={() => onTeam(t.id)} />)}
          <span className="ml-auto flex items-center gap-3">
            {chat.ownTeam && (
              <button type="button" onClick={onOwnTeam} title={chat.ownTeam.tip} className="min-h-9 text-xs text-text-muted transition-colors hover:text-gold">
                {chat.ownTeam.label}
              </button>
            )}
            {chat.staff && (
              <button
                type="button"
                onClick={onPause}
                title={chat.paused ? 'Let everyone talk again' : 'Read-only for everyone until resumed'}
                className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                  chat.paused ? 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20' : 'border-card-border text-text-muted hover:border-gold/30 hover:text-gold'
                }`}
              >
                {chat.paused ? 'Resume chat' : 'Pause chat'}
              </button>
            )}
          </span>
        </div>
      )}

      <Card className="md:flex md:max-h-[70vh] md:flex-col">
        <SectionBar title={chat.channels.find((c) => c.on)?.label ?? 'Chat'} right={<span className="text-xs" style={{ color: INFO_BLUE }}>Live</span>} />
        {error && <p className="px-4 pb-2 text-sm text-red-400">{error}</p>}
        <div ref={listRef} onScroll={onScroll} className="border-t border-card-border md:min-h-0 md:flex-1 md:overflow-y-auto">
          {lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">{chat.empty}</p>
          ) : (
            <ul className="py-1">
              {lines.map((l) => (
                <ChatLineItem key={l.id} line={l} now={now} onDelete={onDelete} onMute={onMute} />
              ))}
            </ul>
          )}
          <div ref={endRef} />
        </div>
        <div className="sticky bottom-0 z-10 rounded-b-xl border-t border-card-border bg-card-bg px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static">
          {chat.lock ? <LockLine lock={chat.lock} /> : <Composer key={chat.channel} chat={chat} onSend={onSend} />}
        </div>
      </Card>
    </div>
  );
}

function ChatLineItem({ line, now, onDelete, onMute }: { line: LiveChatLine; now: number; onDelete: (l: LiveChatLine) => void; onMute: (l: LiveChatLine) => void }) {
  return (
    <li className={`group relative px-4 py-1.5 ${line.mine ? 'bg-gold/[0.05]' : ''} hover:bg-white/[0.02]`}>
      <div className="flex min-w-0 items-baseline gap-1.5 text-xs">
        {line.tag && <Tag tag={line.tag} />}
        <InkName name={line.who} ink={line.ink} className="text-[13px]" />
        <span className="shrink-0 font-mono text-[10.5px] text-text-muted">{clockLabel(line.at, now)}</span>
        {line.canMod && (
          <span className="ml-auto flex shrink-0 gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <button type="button" onClick={() => onDelete(line)} className="rounded px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-accent-red/10 hover:text-accent-red" title="Delete message">
              Delete
            </button>
            <button type="button" onClick={() => onMute(line)} className="rounded px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-accent-red/10 hover:text-accent-red" title={`Mute ${line.who}`}>
              Mute
            </button>
          </span>
        )}
      </div>
      <p className="break-words text-sm text-foreground [overflow-wrap:anywhere]">{line.body}</p>
    </li>
  );
}

function LockLine({ lock }: { lock: NonNullable<LiveChatState['lock']> }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-center ${lock.warn ? 'border-[#ff7a6b]/40 bg-[#ff7a6b]/10' : 'border-card-border bg-brown-dark'}`}>
      <p className={`text-sm font-medium ${lock.warn ? 'text-[#ff7a6b]' : 'text-text-muted'}`}>{lock.locked}</p>
      {lock.sub && <p className="mt-0.5 text-xs text-text-muted">{lock.sub}</p>}
    </div>
  );
}

function Composer({ chat, onSend }: { chat: LiveChatState; onSend: (msg: string) => Promise<string | null> }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setError(null);
    const err = await onSend(msg);
    setSending(false);
    if (err) setError(err);
    else setText('');
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={submit}>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          maxLength={chat.max}
          placeholder={chat.prompt}
          aria-label={chat.prompt}
          enterKeyHint="send"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-lg text-base sm:text-sm"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="min-h-11 shrink-0 rounded-lg border border-gold/40 bg-gold/15 px-4 text-sm font-semibold text-gold transition-colors hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
        {error ? <span className="min-w-0 flex-1 text-[#ff7a6b]">{error}</span> : <span className="min-w-0 flex-1 truncate text-text-muted">{chat.pace}</span>}
        <span className="shrink-0 font-mono text-text-muted">
          {text.length}/{chat.max}
        </span>
      </div>
    </form>
  );
}
