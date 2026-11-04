'use client';

import { useEffect, useMemo, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { clanFetch } from '@/lib/clanFetch';
import type { H2hCharacter, H2hPrefs, H2hView } from '@/lib/h2h';
import {
  DURATION_LABEL,
  H2H_BOSSES,
  H2H_DURATIONS,
  H2H_SKILLS,
  capLabel,
  describe,
  fmt,
  recordLabel,
  skillLabel,
  type H2hDuration,
  type H2hKind,
  type H2hRecord,
} from '@/lib/h2hRules';

interface Data {
  challenges: H2hView[];
  record: H2hRecord & { lastWin: { rsn: string; label: string; kind: H2hKind } | null };
  cap: number | null;
  open: number;
  prefs: H2hPrefs;
  characters: H2hCharacter[];
}

const KIND_CARDS: { kind: H2hKind; title: string; blurb: string }[] = [
  { kind: 'drop', title: 'First to a drop', blurb: 'Race to an item. The first one to land it wins.' },
  { kind: 'kc', title: 'Most kills', blurb: 'Most kills of one boss before the clock runs out.' },
  { kind: 'xp', title: 'Most XP', blurb: 'Most XP in one skill before the clock runs out.' },
];

async function send(path: string, method: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await clanFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? 'Something went wrong.' };
  } catch {
    return { ok: false, error: 'Couldn’t reach Anvil. Try again.' };
  }
}

function useNow(ms = 1000): number {
  const [now, setNow] = useState<number>(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [ms]);
  return now;
}

function left(iso: string | null, now: number): string {
  if (!iso || !now) return '';
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'calling it…';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ${Math.floor((ms % 60_000) / 1000)}s left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)}d ${h % 24}h left`;
}

export default function ChallengesClient({ initial, presetOpponent }: { initial: Data; presetOpponent: string }) {
  const [data, setData] = useState<Data>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  async function reload() {
    const res = await clanFetch('/api/challenges', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setData((await res.json()) as Data);
  }

  // Live progress: the scores move while either of you plays.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  async function act(id: number, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const out = await send(`/api/challenges/${id}`, 'POST', body);
    if (!out.ok) setError(out.error ?? null);
    await reload();
    setBusy(false);
  }

  const invites = data.challenges.filter((c) => c.status === 'pending' && c.side === 'opponent');
  const waiting = data.challenges.filter((c) => c.status === 'pending' && c.side === 'challenger');
  const active = data.challenges.filter((c) => c.status === 'active');
  const history = data.challenges.filter((c) => c.status !== 'pending' && c.status !== 'active');

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">Head-to-head</p>
        <h1 className="display display-lg mt-1 text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">Challenge a friend</h1>
        <p className="mt-2 max-w-[60ch] text-text-muted">
          First to a drop, or most kills or XP in a set time. Anvil tracks you both and calls the winner. Just for
          bragging rights, never for stakes.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Figure label="Your record" value={recordLabel(data.record)} />
          <Figure label="Open now" value={data.cap == null ? `${data.open}` : `${data.open} / ${data.cap}`} />
          <Figure label="Your limit" value={capLabel(data.cap)} />
        </div>
        {data.record.lastWin && (
          <p className="mt-3 text-sm text-text-muted">
            Last win: <span className="text-gold">Won vs {data.record.lastWin.rsn}</span> · {data.record.lastWin.label}
          </p>
        )}
      </header>

      {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {invites.length > 0 && (
        <Section title="Waiting on you">
          {invites.map((c) => (
            <Invite key={c.id} c={c} now={now} busy={busy} act={act} />
          ))}
        </Section>
      )}

      {active.length > 0 && (
        <Section title="Running">
          {active.map((c) => (
            <Running key={c.id} c={c} now={now} busy={busy} act={act} />
          ))}
        </Section>
      )}

      <NewChallenge data={data} presetOpponent={presetOpponent} onSent={reload} />

      {waiting.length > 0 && (
        <Section title="Sent">
          {waiting.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
              <div>
                <div className="font-semibold">vs {c.them.rsn}</div>
                <div className="text-sm text-text-muted">{c.sentence}</div>
                <div className="text-xs text-text-dim">Waiting for an answer{now ? ` · ${left(c.respondBy, now)}` : ''}</div>
              </div>
              <button type="button" disabled={busy} onClick={() => act(c.id, { action: 'cancel' })} className="text-sm text-text-dim hover:text-gold disabled:opacity-50">
                Withdraw
              </button>
            </div>
          ))}
        </Section>
      )}

      {history.length > 0 && (
        <Section title="History">
          {history.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold">
                  {c.outcome === 'won' ? (
                    <span className="text-accent-green-light">Won vs {c.them.rsn}</span>
                  ) : c.outcome === 'lost' ? (
                    <span>Lost to {c.them.rsn}</span>
                  ) : c.outcome === 'tie' ? (
                    <span className="text-gold">Tied with {c.them.rsn}</span>
                  ) : (
                    <span className="text-text-muted">
                      vs {c.them.rsn} · {c.status === 'declined' ? 'declined' : c.status === 'expired' ? 'expired' : 'called off'}
                    </span>
                  )}
                </div>
                <div className="text-sm text-text-muted">{c.resultLine ?? c.sentence}</div>
              </div>
              {c.status === 'finished' && (
                <label className="flex items-center gap-2 text-xs text-text-dim" title="Shown on both profiles and to your clans only when you both say yes">
                  <input type="checkbox" checked={c.myPublic} disabled={busy} onChange={(e) => act(c.id, { action: 'public', public: e.target.checked })} />
                  {c.isPublic ? 'Public' : c.myPublic ? 'Public once they agree' : 'Show publicly'}
                </label>
              )}
            </div>
          ))}
        </Section>
      )}

      <Settings prefs={data.prefs} onChange={reload} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span className="h-5 w-1 bg-gold" />
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[20px] tabular-nums">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
    </div>
  );
}

type Act = (id: number, body: Record<string, unknown>) => Promise<void>;

function Invite({ c, now, busy, act }: { c: H2hView; now: number; busy: boolean; act: Act }) {
  const [pub, setPub] = useState(false);
  return (
    <div className="rounded-xl border border-gold/40 bg-card-bg px-4 py-3">
      <div className="font-semibold">{c.them.rsn} challenged you</div>
      <div className="text-sm text-text-muted">{c.sentence}</div>
      <div className="mt-1 text-xs text-text-dim">Just for bragging rights{now ? ` · ${left(c.respondBy, now)} to answer` : ''}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => act(c.id, { action: 'accept', public: pub })} className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50">
          Accept
        </button>
        <button type="button" disabled={busy} onClick={() => act(c.id, { action: 'decline' })} className="rounded-lg border border-card-border px-3 py-1.5 text-sm hover:border-gold/40 disabled:opacity-50">
          Decline
        </button>
        <button type="button" disabled={busy} onClick={() => act(c.id, { action: 'decline', block: true })} className="text-xs text-text-dim hover:text-gold disabled:opacity-50" title={`Decline, and refuse any more challenges from ${c.them.rsn}`}>
          Decline and block
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs text-text-dim">
          <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
          OK to show the result publicly
        </label>
      </div>
    </div>
  );
}

function Running({ c, now, busy, act }: { c: H2hView; now: number; busy: boolean; act: Act }) {
  const top = Math.max(1, c.me.score, c.them.score);
  return (
    <div className="rounded-xl border border-card-border bg-card-bg px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-semibold">vs {c.them.rsn}</div>
        <div className="font-mono text-xs text-text-dim">{left(c.endsAt, now)}</div>
      </div>
      <div className="text-sm text-text-muted">{c.sentence}</div>
      {c.kind === 'drop' ? (
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>You: {c.me.hitAt ? <span className="text-accent-green-light">got it</span> : <span className="text-text-dim">not yet</span>}</div>
          <div>{c.them.rsn}: {c.them.hitAt ? <span className="text-accent-green-light">got it</span> : <span className="text-text-dim">not yet</span>}</div>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          <Bar label="You" value={c.me.score} top={top} unit={c.kind === 'kc' ? 'kills' : 'XP'} lead />
          <Bar label={c.them.rsn} value={c.them.score} top={top} unit={c.kind === 'kc' ? 'kills' : 'XP'} />
        </div>
      )}
      <div className="mt-2 flex justify-end">
        {c.cancelAsked === 'them' ? (
          <button type="button" disabled={busy} onClick={() => act(c.id, { action: 'cancel' })} className="text-xs text-gold hover:underline disabled:opacity-50">
            {c.them.rsn} asked to call it off · agree
          </button>
        ) : c.cancelAsked === 'me' ? (
          <span className="text-xs text-text-dim">You asked to call it off · waiting on {c.them.rsn}</span>
        ) : (
          <button type="button" disabled={busy} onClick={() => act(c.id, { action: 'cancel' })} className="text-xs text-text-dim hover:text-gold disabled:opacity-50">
            Ask to call it off
          </button>
        )}
      </div>
    </div>
  );
}

function Bar({ label, value, top, unit, lead }: { label: string; value: number; top: number; unit: string; lead?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{fmt(value)} {unit}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-black/30">
        <div className={lead ? 'h-full bg-gold' : 'h-full bg-text-muted'} style={{ width: `${Math.round((value / top) * 100)}%` }} />
      </div>
    </div>
  );
}

function NewChallenge({ data, presetOpponent, onSent }: { data: Data; presetOpponent: string; onSent: () => Promise<void> }) {
  const [opponent, setOpponent] = useState(presetOpponent);
  const [check, setCheck] = useState<{ ok: boolean; rsn?: string; error?: string } | null>(null);
  const [accountId, setAccountId] = useState<number>(data.characters[0]?.accountId ?? 0);
  const [kind, setKind] = useState<H2hKind | null>(null);
  const [statKey, setStatKey] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [itemHits, setItemHits] = useState<{ id: number; name: string }[]>([]);
  const [item, setItem] = useState<{ id: number; name: string } | null>(null);
  const [duration, setDuration] = useState<H2hDuration>(1440);
  const [pub, setPub] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const searching = kind === 'drop' && itemQuery.trim().length >= 2 && item?.name !== itemQuery;
  const hits = searching ? itemHits : [];
  const shownCheck = opponent.trim() ? check : null;

  // Is this somebody who can be challenged? Asked as they stop typing.
  useEffect(() => {
    const name = opponent.trim();
    if (name.length < 1) return;
    const t = setTimeout(async () => {
      const res = await clanFetch(`/api/challenges/targets?rsn=${encodeURIComponent(name)}`).catch(() => null);
      setCheck(res?.ok ? await res.json() : null);
    }, 400);
    return () => clearTimeout(t);
  }, [opponent]);

  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(async () => {
      const res = await clanFetch(`/api/challenges/targets?item=${encodeURIComponent(itemQuery.trim())}`).catch(() => null);
      setItemHits(res?.ok ? ((await res.json()).items ?? []) : []);
    }, 300);
    return () => clearTimeout(t);
  }, [itemQuery, searching]);

  const label = useMemo(() => {
    if (kind === 'drop') return item?.name ?? '';
    if (kind === 'kc') return H2H_BOSSES.find((b) => b.key === statKey)?.label ?? '';
    if (kind === 'xp') return statKey ? (statKey === 'overall' ? 'Overall' : skillLabel(statKey)) : '';
    return '';
  }, [kind, item, statKey]);

  const ready = !!shownCheck?.ok && accountId > 0 && !!kind && !!label;
  const full = data.cap != null && data.open >= data.cap;

  if (data.characters.length === 0) {
    return (
      <Section title="New challenge">
        <p className="rounded-xl border border-dashed border-card-border px-4 py-3 text-sm text-text-muted">
          Verify one of your characters first (connect the Anvil plugin and log in to it), so Anvil can track you.
        </p>
      </Section>
    );
  }

  async function submit() {
    if (!ready || !kind) return;
    setBusy(true);
    setMsg(null);
    const out = await send('/api/challenges', 'POST', {
      accountId,
      opponentRsn: opponent.trim(),
      kind,
      statKey: kind === 'drop' ? undefined : statKey,
      itemIds: kind === 'drop' && item ? [item.id] : undefined,
      durationMin: duration,
      public: pub,
    });
    setBusy(false);
    if (!out.ok) {
      setMsg({ ok: false, text: out.error ?? 'Couldn’t send it.' });
      return;
    }
    setMsg({ ok: true, text: `Sent. ${check?.rsn ?? opponent} has 24 hours to accept.` });
    setKind(null);
    setItem(null);
    setItemQuery('');
    setStatKey('');
    await onSent();
  }

  return (
    <Section title="New challenge">
      <div className="space-y-5 rounded-xl border border-card-border bg-card-bg p-4">
        {full && (
          <p className="text-sm text-text-muted">
            You have {data.open} open, your limit.{' '}
            <ClanLink href="/supporter" className="text-gold hover:underline">Supporters get more</ClanLink>.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-text-dim">Who</span>
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value.slice(0, 12))}
              placeholder="Their RSN"
              className="mt-1 w-full rounded-lg border border-card-border bg-black/20 px-3 py-2"
            />
            {shownCheck && (
              <span className={`mt-1 block text-xs ${shownCheck.ok ? 'text-accent-green-light' : 'text-text-dim'}`}>
                {shownCheck.ok ? `${shownCheck.rsn} is on Anvil` : shownCheck.error}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-text-dim">Playing as</span>
            <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-card-border bg-black/20 px-3 py-2">
              {data.characters.map((c) => (
                <option key={c.accountId} value={c.accountId}>{c.rsn}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {KIND_CARDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => {
                setKind(k.kind);
                setStatKey('');
              }}
              className={`rounded-xl border px-4 py-4 text-left transition-colors ${kind === k.kind ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/40'}`}
            >
              <div className="font-semibold">{k.title}</div>
              <div className="mt-1 text-sm text-text-muted">{k.blurb}</div>
            </button>
          ))}
        </div>

        {kind === 'drop' && (
          <label className="relative block">
            <span className="text-xs uppercase tracking-[0.12em] text-text-dim">Item</span>
            <input
              value={itemQuery}
              onChange={(e) => {
                setItemQuery(e.target.value.slice(0, 40));
                setItem(null);
              }}
              placeholder="e.g. Dragon pickaxe"
              className="mt-1 w-full rounded-lg border border-card-border bg-black/20 px-3 py-2"
            />
            {hits.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-card-border bg-card-bg shadow-lg">
                {hits.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setItem(i);
                        setItemQuery(i.name);
                        setItemHits([]);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gold/10"
                    >
                      {i.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
        )}
        {kind === 'kc' && (
          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-text-dim">Boss</span>
            <select value={statKey} onChange={(e) => setStatKey(e.target.value)} className="mt-1 w-full rounded-lg border border-card-border bg-black/20 px-3 py-2">
              <option value="">Pick a boss…</option>
              {H2H_BOSSES.map((b) => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </select>
          </label>
        )}
        {kind === 'xp' && (
          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-text-dim">Skill</span>
            <select value={statKey} onChange={(e) => setStatKey(e.target.value)} className="mt-1 w-full rounded-lg border border-card-border bg-black/20 px-3 py-2">
              <option value="">Pick a skill…</option>
              {H2H_SKILLS.map((s) => (
                <option key={s} value={s}>{s === 'overall' ? 'Overall (all skills)' : skillLabel(s)}</option>
              ))}
            </select>
          </label>
        )}

        {kind && (
          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-text-dim">{kind === 'drop' ? 'Time limit' : 'How long'}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {H2H_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${duration === d ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/40'}`}
                >
                  {DURATION_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={!ready || busy || full}
            onClick={submit}
            className="rounded-lg bg-gold px-4 py-2 font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-40"
          >
            {ready && kind ? `Challenge ${check?.rsn}: ${describe(kind, label, duration)}` : 'Send challenge'}
          </button>
          <label className="flex items-center gap-2 text-xs text-text-dim" title="Shown on both profiles and to your clans only when you both say yes">
            <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
            OK to show the result publicly
          </label>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-accent-green-light' : 'text-red-300'}`}>{msg.text}</p>}
        <p className="text-xs text-text-dim">
          Counts only what happens after they accept. Kills and XP come from the Anvil plugin, with the OSRS hiscores as a
          backup; drops need the plugin running. No stakes, no prizes: just the win.
        </p>
      </div>
    </Section>
  );
}

function Settings({ prefs, onChange }: { prefs: H2hPrefs; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function put(body: Record<string, unknown>) {
    setBusy(true);
    await send('/api/challenges/prefs', 'PUT', body);
    await onChange();
    setBusy(false);
  }
  return (
    <section className="rounded-xl border border-card-border px-4 py-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={prefs.closed} disabled={busy} onChange={(e) => put({ closed: e.target.checked })} />
        Turn away all new challenges
      </label>
      {prefs.blocked.length > 0 && (
        <div className="mt-2 flex items-center gap-3 text-text-muted">
          {prefs.blocked.length} {prefs.blocked.length === 1 ? 'person' : 'people'} blocked
          <button type="button" disabled={busy} onClick={() => put({ unblock: 'all' })} className="text-xs text-gold hover:underline disabled:opacity-50">
            Unblock all
          </button>
        </div>
      )}
    </section>
  );
}
