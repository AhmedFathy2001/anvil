'use client';

import { useEffect, useState } from 'react';
import ClanLink from '@/components/ClanLink';
import DateRangeField from '@/components/DateRangeField';
import Input from '@/components/Input';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import type { TileCsvRow } from '@/lib/csvTiles';
import { starterCount } from '@/lib/starterTiles';
import EntryGatePicker from '@/components/EntryGatePicker';
import type { EntryGates, GateOptions } from '@/lib/entryGates';

/**
 * Three formats, as big cards. Each maps to an existing event mode on its default size; the full
 * wizard (/admin/events/new?format=…) is where every other choice lives.
 */
const FORMATS = [
  // Teams are balanced automatically (the API's default for a new team board), so nobody is asked.
  { key: 'classic', title: 'Team bingo', line: 'A 5×5 grid of tasks. Players are split into teams for you.', format: 'bingo', scoringMode: 'tiles', size: 5, placement: undefined },
  { key: 'solo', title: 'Solo bingo', line: 'The same grid, every player for themselves. Great on stream.', friendsLine: 'The same grid, every player for themselves. Great for a small group.', format: 'bingo', scoringMode: 'tiles', size: 5, placement: 'solo' },
  { key: 'race', title: 'Team race', line: 'Tasks in order. The team furthest along wins.', format: 'tilerace', scoringMode: 'tiles', size: 10, placement: undefined },
] as const;

type FormatKey = (typeof FORMATS)[number]['key'];

interface Starter {
  boardId: number | null;
  title: string | null;
  rows: TileCsvRow[];
}

export default function FirstEventClient({
  suggestedName,
  first,
  creator = false,
  friends = null,
}: {
  suggestedName: string;
  first: boolean;
  /** A creator space: offer "Who can join?" (lib/entryGates). */
  creator?: boolean;
  /** A Supporter's friends host (lib/friendEventRules): private, invite link only, capped by their tier. */
  friends?: { playersCap: number; tierName: string } | null;
}) {
  // "Who can join?" — null is Anyone. Options load only for a creator space.
  const [gates, setGates] = useState<EntryGates | null>(null);
  const [gateOpts, setGateOpts] = useState<GateOptions | null>(null);
  const [gateNote, setGateNote] = useState<string | null>(null);
  useEffect(() => {
    if (!creator) return;
    let live = true;
    clanFetch('/api/admin/creator/gates')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GateOptions | null) => live && d && setGateOpts(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [creator]);
  const [name, setName] = useState(suggestedName);
  const [startIso, setStartIso] = useState('');
  const [endIso, setEndIso] = useState('');
  const [pick, setPick] = useState<FormatKey>('solo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  const [copied, setCopied] = useState(false);
  // Ready-made tiles (lib/starterTiles) unless the host asks for a blank board. Keyed by format so
  // flipping between cards doesn't refetch.
  const [useStarter, setUseStarter] = useState(true);
  const [starters, setStarters] = useState<Partial<Record<FormatKey, Starter | 'none'>>>({});
  const fmt = FORMATS.find((x) => x.key === pick)!;
  const starter = starters[pick];

  useEffect(() => {
    if (starters[pick]) return;
    let live = true;
    const f = FORMATS.find((x) => x.key === pick)!;
    clanFetch(`/api/admin/library/starter?format=${f.format}&size=${f.size}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Starter | null) => {
        if (!live) return;
        const ok = d && Array.isArray(d.rows) && d.rows.length === starterCount(f.format, f.size);
        setStarters((m) => ({ ...m, [pick]: ok ? d : 'none' }));
      })
      .catch(() => live && setStarters((m) => ({ ...m, [pick]: 'none' })));
    return () => {
      live = false;
    };
  }, [pick, starters]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const f = fmt;
    const tiles = useStarter && starter && starter !== 'none' ? starter : null;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          boardSize: f.size,
          format: f.format,
          scoringMode: f.scoringMode,
          ...(f.placement ? { teamPlacement: f.placement } : {}),
          ...(startIso ? { startDate: startIso } : {}),
          ...(endIso ? { endDate: endIso } : {}),
          ...(tiles ? { tileLabels: tiles.rows.map((r) => r.label ?? '') } : {}),
        }),
      });
      const data: { id?: number; error?: string; invitePath?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setError(data.error || 'That didn’t work. Try again.');
        return;
      }
      // Tracking config rides in through the shared importer (the create API only speaks labels),
      // exactly like the full wizard. A failed import still leaves a named board, never a lost event.
      if (tiles) {
        await clanFetch(`/api/events/${data.id}/tiles/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: tiles.rows }),
        }).catch(() => {});
        if (tiles.boardId != null) {
          await clanFetch(`/api/admin/library/boards/${tiles.boardId}/use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: data.id }),
          }).catch(() => {});
        }
      }
      // Who can join rides on its own route (it is checked against the space's Twitch and Discord
      // there). A refusal still leaves the event made — open to anyone — and says so.
      if (gates) {
        const g = await clanFetch(`/api/events/${data.id}/gate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gates }),
        }).catch(() => null);
        if (!g?.ok) {
          const d = await g?.json().catch(() => null);
          setGateNote(`${d?.error ?? 'Who can join wasn’t saved.'} Anyone can join for now — change it in the event’s settings.`);
        }
      }
      setCreated(data.id);
      setInvitePath(data.invitePath ?? null);
      setFilled(Boolean(tiles));
    } finally {
      setBusy(false);
    }
  }

  if (created != null) {
    // A friends event's link is its private invite (/f/<token>, on the apex); everyone else's is the board.
    const link = invitePath ? `${window.location.origin}${invitePath}` : `${window.location.origin}${clanUrl(`/events/${created}`)}`;
    return (
      <div className="mx-auto max-w-xl py-6">
        <div className="rounded-2xl border border-gold/30 bg-card-bg p-8 text-center">
          <h1 className="display text-3xl font-semibold">Your event is ready</h1>
          <p className="mt-2 text-text-muted">
            {friends ? 'Send this link to your friends. Only people with it can join.' : 'Share this link on stream or in Discord.'}
          </p>
          {gateNote && <p className="mt-2 text-sm text-accent-red">{gateNote}</p>}
          <p className="mt-4 break-all rounded-lg bg-brown-dark px-3 py-2 font-mono text-sm text-foreground">{link}</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="mt-5 w-full rounded-xl bg-gold px-6 py-4 text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
        <p className="mt-4 text-center text-[13px] text-text-dim">
          <ClanLink href={`/admin/events/${created}`} className="hover:text-gold">
            {filled ? 'Change your tiles' : 'Fill in your tiles'}
          </ClanLink>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="mx-auto max-w-2xl py-2">
      <h1 className="display text-3xl font-semibold sm:text-4xl">
        {friends ? 'New friends event' : first ? 'Create your first event' : 'New event'}
      </h1>
      {friends && (
        <p className="mt-2 text-text-muted">
          Private, by invite link only. As a {friends.tierName} you can have up to {friends.playersCap} players across
          friends events that run at the same time.
        </p>
      )}

      <div className="mt-6">
        <label htmlFor="ev-name" className="mb-1.5 block text-base font-medium">
          Name
        </label>
        <Input
          id="ev-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="rounded-xl px-4 py-3 text-base"
        />
      </div>

      <div className="mt-6">
        <div className="mb-1.5 text-base font-medium">What kind?</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {FORMATS.map((f) => {
            const on = pick === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => setPick(f.key)}
                className={`rounded-xl border p-5 text-left transition-colors ${
                  on ? 'border-gold bg-gold/10' : 'border-card-border bg-card-bg hover:border-gold/40'
                }`}
              >
                <span className={`block text-lg font-semibold ${on ? 'text-gold' : ''}`}>{f.title}</span>
                {/* A friends event is nobody's stream (lib/friendEventRules): its own words where they differ. */}
                <span className="mt-1 block text-sm text-text-muted">{friends && 'friendsLine' in f ? f.friendsLine : f.line}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 text-base font-medium">Tiles</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([true, false] as const).map((v) => {
            const on = useStarter === v;
            const none = v && starter === 'none';
            return (
              <button
                key={String(v)}
                type="button"
                aria-pressed={on}
                disabled={none}
                onClick={() => setUseStarter(v)}
                className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
                  on && !none ? 'border-gold bg-gold/10' : 'border-card-border bg-card-bg hover:border-gold/40'
                }`}
              >
                <span className={`block font-semibold ${on && !none ? 'text-gold' : ''}`}>
                  {v ? 'Ready-made tiles' : 'Blank, I’ll write my own'}
                </span>
                <span className="mt-1 block text-sm text-text-muted">
                  {!v
                    ? 'Start empty and fill every tile yourself.'
                    : none
                      ? 'None ready for this kind yet.'
                      : 'A ready mix of easy to hard tasks. Change any tile later.'}
                </span>
              </button>
            );
          })}
        </div>
        {useStarter && starter && starter !== 'none' && (
          <p className="mt-2 text-[13px] text-text-dim" title={starter.rows.map((r) => r.label).join(', ')}>
            {starter.title ? `${starter.title}: ` : ''}
            {starter.rows
              .slice(0, 4)
              .map((r) => r.label)
              .join(', ')}
            {starter.rows.length > 4 ? `, and ${starter.rows.length - 4} more` : ''}
          </p>
        )}
      </div>

      {gateOpts && (
        <div className="mt-6">
          <div className="mb-1.5 text-base font-medium">Who can join?</div>
          <EntryGatePicker value={gates} onChange={setGates} options={gateOpts} />
        </div>
      )}

      <div className="mt-6">
        <div className="mb-1.5 text-base font-medium">When?</div>
        <DateRangeField
          startIso={startIso}
          endIso={endIso}
          onChange={({ startIso: a, endIso: b }) => {
            setStartIso(a);
            setEndIso(b);
          }}
          allowOpenEnded
        />
        <p className="mt-1.5 text-[13px] text-text-dim">Leave it empty to start it yourself.</p>
      </div>

      {error && <p className="mt-4 text-sm text-accent-red">{error}</p>}

      <button
        type="submit"
        disabled={busy || !name.trim() || (useStarter && starter === undefined)}
        className="mt-8 w-full rounded-xl bg-gold px-6 py-4 text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create event'}
      </button>

      <p className="mt-4 text-center text-[13px]">
        <ClanLink href={`/admin/events/new?format=${pick}`} className="text-text-muted hover:text-gold">
          More options
        </ClanLink>
      </p>
    </form>
  );
}
