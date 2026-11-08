'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { parseStamp } from '@/lib/dbTime';
import { timeLeftText } from '@/lib/eventChatRules';

interface Line {
  id: number;
  userId: number;
  rsn: string;
  body: string;
  teamId: number | null;
  teamOnly: boolean;
  /** 'all' | 'team:<id>' | 'announce' (lib/eventChatRules ChatChannel). */
  channel: string;
  fromStaff: boolean;
  createdAt: string;
  canSanction: boolean;
  canDelete: boolean;
}

interface Sanction {
  userId: number;
  name: string;
  kind: 'timeout' | 'ban';
  until: string | null;
  reason: string | null;
  byName: string | null;
  createdAt: string;
  canLift: boolean;
}

interface Data {
  chat: { open: boolean; closedWhy: string | null; paused: boolean };
  teams: { id: number; name: string; color: string | null }[];
  lines: Line[];
  sanctions: Sanction[];
}

/** How often the list refreshes itself while the tab is in view. */
const POLL_MS = 5_000;

const PRESETS: { id: '5m' | '1h' | '24h'; label: string }[] = [
  { id: '5m', label: '5 min' },
  { id: '1h', label: '1 hour' },
  { id: '24h', label: '24 hours' },
];

const btn = 'text-xs font-medium px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const quietBtn = `${btn} border-card-border text-text-muted hover:text-gold hover:border-gold/30`;
const dangerBtn = `${btn} border-accent-red/30 text-accent-red hover:bg-accent-red/10`;
const goldBtn = `${btn} border-gold/30 text-gold bg-gold/10 hover:bg-gold/20`;

function clock(stamp: string): string {
  const t = parseStamp(stamp);
  return t == null ? '' : new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ChatModClient({ eventId }: { eventId: number }) {
  const dialog = useDialog();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('every');
  const [q, setQ] = useState('');
  const [timeoutFor, setTimeoutFor] = useState<Line | null>(null);
  const [preset, setPreset] = useState<'5m' | '1h' | '24h' | 'custom'>('5m');
  const [customMin, setCustomMin] = useState(30);
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const query = useRef('');

  const base = `/api/events/${eventId}/chat-mod`;

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'every') params.set('ch', filter);
    if (q.trim()) params.set('q', q.trim());
    const key = params.toString();
    query.current = key;
    try {
      const res = await clanFetch(`${base}?${key}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (query.current !== key) return; // a newer search is on its way
      if (!res.ok) throw new Error(body.error || 'Could not load the chat');
      setData(body);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [base, filter, q]);

  // Search waits for a pause in typing; the list keeps itself fresh while the tab is in view.
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  async function act(payload: Record<string, unknown>, done?: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await clanFetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'That didn’t work');
      if (done) dialog.notify(done);
      await load();
      return true;
    } catch (err) {
      dialog.notify((err as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(line: Line) {
    await act({ action: 'delete', id: line.id }, 'Message removed');
  }

  async function ban(line: Line) {
    const why = await dialog.ask({
      title: `Ban ${line.rsn} from this event’s chat?`,
      body: 'They can still read it, but can’t send anything until a moderator lifts the ban. Their message box tells them why.',
      label: 'Reason (optional, for the audit log)',
      placeholder: 'e.g. spamming after a warning',
      confirmLabel: 'Ban',
      tone: 'danger',
    });
    if (why === null) return;
    await act({ action: 'ban', userId: line.userId, reason: why }, `${line.rsn} is banned from this chat`);
  }

  async function submitTimeout() {
    if (!timeoutFor) return;
    const ok = await act(
      {
        action: 'timeout',
        userId: timeoutFor.userId,
        ...(preset === 'custom' ? { minutes: customMin } : { preset }),
        reason,
      },
      `${timeoutFor.rsn} is timed out`,
    );
    if (ok) {
      setTimeoutFor(null);
      setReason('');
    }
  }

  async function lift(s: Sanction) {
    const ok = await dialog.confirm({
      title: `Lift ${s.name}’s ${s.kind === 'ban' ? 'ban' : 'timeout'}?`,
      body: 'They can talk in this event’s chat again straight away.',
      confirmLabel: 'Lift',
      tone: 'gold',
    });
    if (ok) await act({ action: 'lift', userId: s.userId }, `${s.name} can chat again`);
  }

  async function togglePause() {
    if (!data) return;
    await act({ action: 'pause', paused: !data.chat.paused }, data.chat.paused ? 'Chat resumed' : 'Chat paused');
  }

  const teamName = new Map((data?.teams ?? []).map((t) => [t.id, t]));
  const filterOptions = [
    { value: 'every', label: 'Every channel' },
    { value: 'all', label: 'All teams channel' },
    { value: 'announce', label: 'Announcements' },
    ...(data?.teams ?? []).map((t) => ({ value: `team:${t.id}`, label: `Team channel: ${t.name}`, dot: t.color ?? undefined })),
    { value: 'staff', label: 'Said by host & mods' },
  ];

  return (
    <div className="space-y-6">
      {/* Status and pause */}
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-gold" />
              <h2 className="text-base font-semibold text-foreground">Chat status</h2>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {!data
                ? 'Loading…'
                : !data.chat.open
                  ? data.chat.closedWhy ?? 'Chat is off for this event.'
                  : data.chat.paused
                    ? 'Paused: read-only for everyone except the host and mods.'
                    : 'Open: the board’s players can talk.'}
            </p>
          </div>
          {data?.chat.open && (
            <button type="button" disabled={busy} onClick={togglePause} className={data.chat.paused ? goldBtn : quietBtn} title="Read-only for everyone until resumed">
              {data.chat.paused ? 'Resume chat' : 'Pause chat'}
            </button>
          )}
        </div>
      </section>

      {/* Who's kept out */}
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="text-base font-semibold text-foreground">Timeouts and bans</h2>
        </div>
        {!data ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : data.sanctions.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody is timed out or banned.</p>
        ) : (
          <ul className="divide-y divide-card-border/60">
            {data.sanctions.map((s) => {
              const until = s.until ? parseStamp(s.until) : null;
              return (
                <li key={s.userId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">{s.name}</span>{' '}
                      <span className={s.kind === 'ban' ? 'text-accent-red' : 'text-gold'}>
                        {s.kind === 'ban' ? 'banned until lifted' : until ? `timed out, ${timeLeftText(until - now).replace(' more', '')} left` : 'timed out'}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {s.byName ? `by ${s.byName} · ` : ''}
                      {clock(s.createdAt)}
                      {s.reason ? ` · “${s.reason}”` : ''}
                    </div>
                  </div>
                  {s.canLift ? (
                    <button type="button" disabled={busy} onClick={() => lift(s)} className={quietBtn}>
                      Lift
                    </button>
                  ) : (
                    <span className="text-xs text-text-muted/60" title="Only someone above them on staff can lift this">
                      Higher staff only
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Messages */}
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="text-base font-semibold text-foreground">Recent messages</h2>
          <span className="text-xs text-text-muted/60">updates every few seconds</span>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages or names" aria-label="Search messages" />
          <Select value={filter} onChange={setFilter} options={filterOptions} ariaLabel="Which messages" />
        </div>

        {timeoutFor && (
          <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-4">
            <p className="text-sm font-semibold text-foreground">Time out {timeoutFor.rsn}</p>
            <p className="mb-3 text-xs text-text-muted">They can read the chat but can’t send until it runs out. Their message box says how long is left.</p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPreset(p.id)} className={preset === p.id ? goldBtn : quietBtn}>
                  {p.label}
                </button>
              ))}
              <button type="button" onClick={() => setPreset('custom')} className={preset === 'custom' ? goldBtn : quietBtn}>
                Custom
              </button>
              {preset === 'custom' && (
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  <NumberInput value={customMin} onChange={setCustomMin} min={1} max={43_200} fallback={30} className="w-24" aria-label="Minutes" />
                  minutes
                </span>
              )}
            </div>
            <div className="mt-3">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Reason (optional, for the audit log)" aria-label="Reason" />
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={submitTimeout} className={goldBtn}>
                Time out
              </button>
              <button type="button" onClick={() => setTimeoutFor(null)} className={quietBtn}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-xs text-accent-red">{error}</p>}
        {!data ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : data.lines.length === 0 ? (
          <p className="text-sm text-text-muted">{q.trim() || filter !== 'every' ? 'No messages match.' : 'Nobody has said anything yet.'}</p>
        ) : (
          <ul className="divide-y divide-card-border/60">
            {data.lines.map((l) => {
              const team = l.teamId != null ? teamName.get(l.teamId) : null;
              return (
                <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-[1_1_18rem]">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                      <span className="font-semibold text-foreground text-sm">{l.rsn}</span>
                      {l.fromStaff && <span className="rounded bg-gold/15 px-1.5 text-[10px] font-semibold text-gold">STAFF</span>}
                      {team && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: team.color ?? undefined }} />
                          {team.name}
                        </span>
                      )}
                      {l.channel === 'announce' && <span className="rounded bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-300">ANNOUNCEMENT</span>}
                      {l.channel.startsWith('team:') && <span className="rounded bg-card-border/60 px-1.5 text-[10px] font-semibold">TEAM CHANNEL</span>}
                      <span>{clock(l.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-foreground/90">{l.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {l.canDelete && (
                      <button type="button" disabled={busy} onClick={() => remove(l)} className={quietBtn}>
                        Delete
                      </button>
                    )}
                    {l.canSanction && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setTimeoutFor(l);
                            setPreset('5m');
                            setReason('');
                          }}
                          className={quietBtn}
                        >
                          Timeout
                        </button>
                        <button type="button" disabled={busy} onClick={() => ban(l)} className={dangerBtn}>
                          Ban
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
