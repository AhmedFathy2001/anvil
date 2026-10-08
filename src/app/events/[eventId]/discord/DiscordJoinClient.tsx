'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clanFetch, clanPrefixFromLocation } from '@/lib/clanFetch';
import type { PlayerJoinView } from '@/lib/eventDiscord';

/**
 * The player's side: which server, which team, their verification code, and the two ways in —
 * "add me automatically" (opt-in guilds.join) or a single-use invite made on demand for them.
 */
export default function DiscordJoinClient({ eventId, returnTo }: { eventId: number; returnTo: string }) {
  const [view, setView] = useState<PlayerJoinView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const autoTried = useRef(false);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/events/${eventId}/discord-join`);
    const data = await res.json().catch(() => null);
    if (res.ok) setView(data);
    else setError(data?.error ?? 'Could not load your event server.');
  }, [eventId]);

  const check = useCallback(async () => {
    setBusy('check');
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/discord-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not check');
      if (data.status !== 'joined') {
        setError(data.error ?? 'You’re not in the server yet. Join with your invite first, then press this again.');
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [eventId, load]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from the auto-join consent screen: add them straight away.
  useEffect(() => {
    if (autoTried.current || !view?.available || view.status === 'joined') return;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auto') === '1' && view.hasAutoJoinGrant) {
      autoTried.current = true;
      check();
    }
  }, [view, check]);

  async function getInvite() {
    setBusy('invite');
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/discord-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not create your invite');
      setInviteUrl(data.url);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!view) {
    return error ? <p className="text-accent-red">{error}</p> : <p className="text-text-muted">Loading…</p>;
  }
  if (!view.available) {
    return <div className="rounded-xl border border-dashed border-card-border p-6 text-center text-text-muted">{view.reason}</div>;
  }

  const joined = view.status === 'joined';
  // Back to this same page afterwards, path prefix included, so a /c/<slug> clan returns home.
  const autoHref = `/api/auth/discord/start?join=1&return=${encodeURIComponent(`${clanPrefixFromLocation()}${returnTo}?auto=1`)}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border border-card-border bg-card-bg p-4">
        {view.server?.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.server.iconUrl} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-card-border" />
        )}
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{view.server?.name ?? 'Event server'}</div>
          <div className="text-[13px] text-text-muted">
            Team <span className="font-semibold text-text">{view.teamName ?? '—'}</span>
            {view.hostNames && view.hostNames.length > 0 && <> · run by {view.hostNames.join(' & ')}</>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
        <div className="text-[12px] uppercase tracking-wide text-text-muted">Your verification code</div>
        <div className="mt-1 font-mono text-2xl font-bold tracking-widest text-gold">{view.code}</div>
        <p className="mt-2 text-[12.5px] text-text-muted">
          If the Anvil bot DMed you, its message shows this same code. If a DM shows a different code, or contains a Discord invite link, it is not from Anvil. Anvil never asks for your password, 2FA codes or a QR scan.
        </p>
      </div>

      {joined ? (
        <div className="rounded-xl border border-accent-green/40 bg-accent-green/10 p-4 text-accent-green-light">
          You’re in <strong>{view.server?.name ?? 'the event server'}</strong> with your team role. See you there.
        </div>
      ) : (
        <div className="space-y-3">
          {view.autoJoinAvailable && (
            <div className="rounded-xl border border-card-border p-4">
              <div className="font-semibold">Add me automatically</div>
              <p className="mb-3 text-[12.5px] text-text-muted">
                Discord will ask you to let Anvil “join servers for you”. Anvil only uses this to add you to the event servers you play in, with your team role.
              </p>
              {view.hasAutoJoinGrant ? (
                <button onClick={check} disabled={!!busy} className="rounded-md bg-gold px-3 py-1.5 text-[13px] font-semibold text-black disabled:opacity-50">
                  {busy === 'check' ? 'Adding you…' : 'Add me now'}
                </button>
              ) : (
                // clan-prefix: platform — /api/auth/discord/start is the platform's, and this is a real
                // navigation: it hands off to Discord's consent screen.
                <a href={autoHref} className="inline-block rounded-md bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400">
                  Allow and add me
                </a>
              )}
            </div>
          )}

          <div className="rounded-xl border border-card-border p-4">
            <div className="font-semibold">Join with an invite</div>
            <p className="mb-3 text-[12.5px] text-text-muted">
              A single-use invite made just for you, valid for 24 hours. Your team role is added within a minute or two after you join, or straight away when you press “I’ve joined”.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={getInvite} disabled={!!busy} className="rounded-md border border-card-border px-3 py-1.5 text-[13px] disabled:opacity-50">
                {busy === 'invite' ? 'Creating…' : inviteUrl ? 'Open my invite again' : 'Get my invite'}
              </button>
              <button onClick={check} disabled={!!busy} className="rounded-md border border-card-border px-3 py-1.5 text-[13px] disabled:opacity-50">
                {busy === 'check' ? 'Checking…' : 'I’ve joined'}
              </button>
            </div>
            {inviteUrl && <p className="mt-2 break-all font-mono text-[12px] text-text-muted">{inviteUrl}</p>}
          </div>
        </div>
      )}

      {error && <p className="text-[13px] text-accent-red">{error}</p>}
    </div>
  );
}
