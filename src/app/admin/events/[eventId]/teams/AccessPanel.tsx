'use client';

import { useCallback, useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';

interface Invite {
  id: number;
  clanId: number | null;
  playerId: number | null;
  note: string | null;
  clanName: string | null;
  clanSlug: string | null;
  playerName: string | null;
}

const VISIBILITY: { value: string; label: string; hint: string }[] = [
  { value: 'clan', label: 'Your clan', hint: 'Only people with a seat here — plus anyone, if your clan is public.' },
  { value: 'invited', label: 'Invited only', hint: 'Hidden unless you invite their clan, or them by name.' },
  { value: 'public', label: 'Anyone', hint: 'Listed and readable by anybody on Anvil.' },
];

// Neither of these lets a stranger seat themselves — that setting existed, and a seat is a row on
// your roster. What they choose between is how the people you have ALREADY said yes to are treated.
const ENTRY: { value: string; label: string; hint: string }[] = [
  {
    value: 'open',
    label: 'Clans and people I invited',
    hint: 'They just play. Anyone else has to ask, and you answer.',
  },
  {
    value: 'approval',
    label: 'Ask me about everyone',
    hint: 'Even an invited clan’s players land in your queue first.',
  },
];

/**
 * Who may see this event, and who may enter it.
 *
 * `/api/events/[eventId]/invites` had no caller anywhere in the app. That made `visibility:
 * 'invited'` a state an event could be put INTO with no way to invite anybody to it — and the
 * multi-clan create flow sets exactly that on every co-hosted board it makes. An event could be
 * invisible to precisely the clans it was built for, with no screen that could say so or fix it.
 *
 * Both halves live here because they are one question asked twice: seeing and entering diverge on
 * purpose (a public board with approval entry is the ordinary cross-clan case), and an admin setting
 * one without seeing the other is how you end up with a board nobody can find.
 */
export default function AccessPanel({ eventId }: { eventId: number }) {
  const [visibility, setVisibility] = useState<string | null>(null);
  const [entry, setEntry] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [guestPolicy, setGuestPolicy] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/events/${eventId}/invites`);
    if (!res.ok) return;
    const d = await res.json();
    setVisibility(d.visibility);
    setEntry(d.entry);
    setInvites(d.invites ?? []);
    setGuestPolicy(d.guestPolicy ?? null);
  }, [eventId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function patch(field: 'visibility' | 'entry', value: string) {
    const prev = field === 'visibility' ? visibility : entry;
    if (field === 'visibility') setVisibility(value);
    else setEntry(value);
    const res = await clanFetch(`/api/events/${eventId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      if (field === 'visibility') setVisibility(prev);
      else setEntry(prev);
    }
  }

  async function invite() {
    const clanSlug = slug.trim().toLowerCase();
    if (!clanSlug) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanSlug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not invite');
      setSlug('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/invites`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Could not remove that invite');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (visibility == null) return null;

  return (
    <section className="mb-6 rounded-2xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Who can see and enter this</h2>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        <Choice title="Who can see it" options={VISIBILITY} value={visibility} onPick={(v) => patch('visibility', v)} />
        <div>
          <Choice title="Who can enter it" options={ENTRY} value={entry ?? 'open'} onPick={(v) => patch('entry', v)} />
          {/* The clan's own door is the stricter of the two and always wins in lib/guestAdmission —
              this setting could promise entry that the roster policy then refused, silently. */}
          {guestPolicy === 'closed' && (
            <p className="mt-2 text-[12.5px] text-accent-red">
              Your clan is not taking guests, so nobody from outside can enter whatever this says.
              Change it under Clan → Access.
            </p>
          )}
        </div>
      </div>

      {/* Only meaningful while the board is invite-only — but shown whenever invites EXIST, so
          switching to "Anyone" does not hide a list somebody may want to clean up. */}
      {(visibility === 'invited' || invites.length > 0) && (
        <div className="border-t border-card-border px-5 py-4">
          <div className="mb-2 text-[13px] font-semibold">Invited</div>
          {invites.length === 0 ? (
            <p className="mb-2.5 text-[12.5px] text-accent-red">
              Nobody is invited yet, so nobody outside your clan can see this board.
            </p>
          ) : (
            <ul className="mb-2.5 flex flex-wrap gap-2">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center gap-2 rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-[12.5px]"
                >
                  <span>{i.clanName ?? i.playerName ?? 'Someone'}</span>
                  {i.clanSlug && <span className="font-mono text-[11px] text-text-muted">c/{i.clanSlug}</span>}
                  <button
                    type="button"
                    onClick={() => revoke(i.id)}
                    disabled={busy}
                    aria-label={`Remove ${i.clanName ?? i.playerName ?? 'invite'}`}
                    className="text-text-muted transition-colors hover:text-accent-red disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus-within:border-gold/50">
              <span className="font-mono text-[13px] text-text-muted">anvilosrs.com/c/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && invite()}
                placeholder="clan-slug"
                className="flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-text-muted/50"
              />
            </div>
            <button
              type="button"
              onClick={invite}
              disabled={busy || !slug.trim()}
              className="shrink-0 rounded-lg bg-gold px-4 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              Invite
            </button>
          </div>
          <p className="mt-2 text-[12px] text-text-muted">
            An invited clan’s members can see this board and enter without being approved one by one.
            To have a clan run its own TEAM here, invite it as a co-host below instead.
          </p>
          {error && <p className="mt-2 text-[12.5px] text-accent-red">{error}</p>}
        </div>
      )}
    </section>
  );
}

function Choice({
  title,
  options,
  value,
  onPick,
}: {
  title: string;
  options: { value: string; label: string; hint: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold">{title}</div>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                active ? 'border-gold/50 bg-gold/[0.06]' : 'border-card-border bg-background hover:border-gold/30'
              }`}
            >
              <input
                type="radio"
                name={title}
                checked={active}
                onChange={() => onPick(o.value)}
                className="mt-0.5 h-4 w-4 accent-gold"
              />
              <span>
                <span className={`block text-[13.5px] font-medium ${active ? 'text-gold' : ''}`}>{o.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-text-muted">{o.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
