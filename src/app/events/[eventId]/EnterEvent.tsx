'use client';

import Select from '@/components/Select';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import { parseStamp } from '@/lib/dbTime';

type Verdict =
  | { outcome: 'insider' }
  | { outcome: 'outsider'; needsApproval: boolean }
  | { outcome: 'refused'; reason: 'not-visible' | 'banned' | 'signed-out' };

interface EnterInfo {
  verdict: Verdict;
  options: { id: number; rsn: string }[];
  /** When their still-open request to the host clan was sent, if there is one. */
  pendingSince?: string | null;
  /** The host clan takes no guests at all. */
  guestsClosed?: boolean;
  /** Has any character at all, verified or not. */
  hasCharacter?: boolean;
  /** A creator-space event's "who can join" (lib/entryGates), said before anyone presses Join. */
  gate?: { summary: string; usesTwitch: boolean; twitchLinked: string | null; twitchAvailable: boolean } | null;
}

/** A refused gate, as the enter/sign-up routes send it. */
interface GateFail {
  summary: string;
  steps: string[];
  linkTwitch: boolean;
  transient: boolean;
}

/** Start linking Twitch, coming back to this very page. Built at click time, from where they are. */
function linkTwitchHref(): string {
  return `/api/auth/twitch/start?as=viewer&return=${encodeURIComponent(window.location.pathname)}`;
}

const TWITCH_BACK: Record<string, { ok: boolean; text: string }> = {
  linked: { ok: true, text: 'Twitch linked. Press Join again.' },
  taken: { ok: false, text: 'That Twitch account is already linked to another Anvil login.' },
  denied: { ok: false, text: 'Twitch linking cancelled.' },
  error: { ok: false, text: 'Couldn’t link Twitch. Try again.' },
};

/**
 * Entering an event hosted by a clan you are not in.
 *
 * The whole flow existed on the server and could not be reached: `/api/events/[eventId]/enter` —
 * guest admission, the ban check, the rate limit, the account picker — had no caller anywhere in the
 * app, and no test. A visitor who found a public board had no way in, which made "public" mean
 * "readable" and nothing more.
 *
 * The server decides WHETHER to render this (the viewer is an outsider who can see the event); this
 * asks the route what entering would involve, because the answer includes which of their characters
 * are eligible and only the route knows that. One GET, and only for the people it applies to.
 *
 * ONE VERB. The player-facing word for joining an event is "Sign up", here as on the sign-up page —
 * an outsider used to be told to "enter", sent to their profile, and then met "Sign up" everywhere
 * after. Underneath, pressing it still takes a guest seat through admit(); only the words changed.
 */
export default function EnterEvent({
  eventId,
  signupFee,
  signupsOpen,
  creator = false,
}: {
  eventId: number;
  signupFee: number | null;
  /** The sign-up window is open, so the sign-up page is somewhere to send them. */
  signupsOpen: boolean;
  /** A creator space's event (lib/creatorSpaces): one big Join button, plain words, sign-up included. */
  creator?: boolean;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<EnterInfo | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    clanFetch(`/api/events/${eventId}/enter`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EnterInfo | null) => {
        if (!alive || !d) return;
        setInfo(d);
        // One character is the common case; pre-select it so entering is one press, not two.
        if (d.options.length === 1) setChosen(d.options[0].id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [eventId]);

  if (!info) return null;
  if (creator) return <CreatorJoin eventId={eventId} info={info} signupsOpen={signupsOpen} signupFee={signupFee} />;
  const { verdict, options } = info;

  // The server already filtered to outsiders, but a verdict can change between render and fetch —
  // somebody accepted into the clan in another tab — so trust the route's answer over the reason we
  // were mounted.
  if (verdict.outcome === 'insider') return null;

  if (verdict.outcome === 'refused') {
    if (verdict.reason === 'banned') {
      return (
        <Card tone="muted">
          <div className="font-semibold">You can’t sign up for this one</div>
          <div className="text-sm text-text-muted">This clan has barred you from its events.</div>
        </Card>
      );
    }
    return null; // signed-out and not-visible are the page's own business, not this card's
  }

  async function enter() {
    if (chosen == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: chosen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not sign up');
      if (data?.pending) {
        setPending(data.message ?? 'Sent to the host.');
        return;
      }
      // Seated: they now hold a guest seat here, so the ordinary sign-up banner takes over. The
      // server has to re-render for that, and it is the same page — refresh rather than navigate.
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (pending || info.pendingSince) {
    return (
      <Card tone="info">
        <div className="min-w-0">
          <div className="font-semibold">Waiting on the host</div>
          <div className="text-sm text-text-muted">
            {pending ?? `You asked on ${requestedDay(info.pendingSince!)}. You’ll be able to sign up once they accept.`}
          </div>
        </div>
      </Card>
    );
  }

  if (info.guestsClosed) {
    return (
      <Card tone="muted">
        <div className="min-w-0">
          <div className="font-semibold">This clan isn’t taking guests</div>
          <div className="text-sm text-text-muted">Only its own members can play. Ask the host clan if you think that should change.</div>
        </div>
      </Card>
    );
  }

  // Nothing to sign up with. Say which door to go through rather than showing an empty picker.
  //
  // No character at all, while sign-ups are open: the sign-up page links one inline, so send them
  // there. A character that is not verified yet is fixed on the profile — the sign-up page would only
  // send them back here.
  if (options.length === 0) {
    const toSignup = signupsOpen && !info.hasCharacter;
    return (
      <Card tone="info">
        <div className="min-w-0">
          <div className="font-semibold">{toSignup ? 'Sign up for this event' : 'Verify a character to sign up'}</div>
          <div className="text-sm text-text-muted">
            {toSignup
              ? 'You’ll link your character on the sign-up page, then join as a guest of the hosting clan.'
              : 'Signing up for someone else’s event needs a character you have proved is yours.'}
          </div>
        </div>
        <ClanLink
          href={toSignup ? `/events/${eventId}/signup` : '/profile'}
          className="shrink-0 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
        >
          {toSignup ? 'Sign up' : 'Verify on your profile'}
        </ClanLink>
      </Card>
    );
  }

  const asks = verdict.needsApproval;

  return (
    <Card tone="info">
      <div className="min-w-0">
        <div className="font-semibold">{asks ? 'Ask to sign up for this event' : 'Sign up for this event'}</div>
        <div className="text-sm text-text-muted">
          {asks
            ? 'The host reviews entries from outside the clan.'
            : 'You’ll join as a guest of the host.'}
          {signupFee ? ` Sign-up fee: ${signupFee.toLocaleString()} gp.` : ''}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {options.length > 1 && (
          <Select
            value={chosen != null ? String(chosen) : ''}
            onChange={(v) => setChosen(Number(v) || null)}
            placeholder="Which character?"
            ariaLabel="Which character"
            className="min-w-[10rem]"
            options={options.map((o) => ({ value: String(o.id), label: o.rsn }))}
          />
        )}
        <button
          type="button"
          onClick={enter}
          disabled={busy || chosen == null}
          className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
        >
          {busy ? 'Sending…' : asks ? 'Ask to sign up' : 'Sign up'}
        </button>
      </div>
      {error && <p className="w-full text-[12.5px] text-accent-red">{error}</p>}
    </Card>
  );
}

/**
 * The creator-space join card: ONE button. Pressing it takes the seat AND signs them up, so a viewer
 * never meets the two-step "enter, then sign up" a clan event has. Plain words only. If the sign-up
 * needs anything more (questions, several characters), they land on the sign-up page instead.
 */
function CreatorJoin({
  eventId,
  info,
  signupsOpen,
  signupFee,
}: {
  eventId: number;
  info: EnterInfo;
  signupsOpen: boolean;
  signupFee: number | null;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<number | null>(info.options.length === 1 ? info.options[0].id : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'joined' | 'asked'>(info.pendingSince ? 'asked' : 'idle');
  // The host's gate said no (lib/entryGates): what to do, step by step.
  const [gateFail, setGateFail] = useState<GateFail | null>(null);
  // Back from linking Twitch (?twitch=linked…): say how it went, then drop the marker.
  const [twitchNote, setTwitchNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const back = new URLSearchParams(window.location.search).get('twitch');
    if (!back || !TWITCH_BACK[back]) return;
    setTwitchNote(TWITCH_BACK[back]);
    const u = new URL(window.location.href);
    u.searchParams.delete('twitch');
    window.history.replaceState(null, '', u.toString());
  }, []);
  const { verdict, options } = info;

  if (verdict.outcome === 'insider') return null;
  if (verdict.outcome === 'refused') {
    if (verdict.reason !== 'banned') return null;
    return (
      <Card tone="muted">
        <div className="font-semibold">You can’t join this one</div>
        <div className="text-sm text-text-muted">The host has blocked you from their events.</div>
      </Card>
    );
  }

  if (state === 'joined') {
    return (
      <div className="mb-6 rounded-xl border border-accent-green/40 bg-accent-green/10 p-5">
        <div className="text-lg font-semibold text-accent-green-light">You’re in!</div>
        <p className="mt-1 text-sm text-text-muted">
          Install the Anvil plugin in RuneLite to start tracking — your drops and kills then count by themselves.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <ClanLink
            href="/guide/plugin"
            className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            How to install the plugin
          </ClanLink>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold transition-colors hover:border-gold"
          >
            See the board
          </button>
        </div>
      </div>
    );
  }

  if (state === 'asked') {
    return (
      <Card tone="info">
        <div className="min-w-0">
          <div className="font-semibold">Waiting for the host</div>
          <div className="text-sm text-text-muted">You asked to join. You’ll be able to play as soon as they say yes.</div>
        </div>
      </Card>
    );
  }

  if (!signupsOpen) return null;

  // No character they have proved is theirs: that is the one thing to do first.
  if (options.length === 0) {
    return (
      <Card tone="info">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Join this event</div>
          <div className="text-sm text-text-muted">
            {info.hasCharacter ? 'First, prove your RuneScape character is yours.' : 'First, add your RuneScape character.'}
          </div>
        </div>
        <ClanLink
          href={info.hasCharacter ? '/profile' : `/events/${eventId}/signup`}
          className="shrink-0 rounded-xl bg-gold px-6 py-3 text-base font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          {info.hasCharacter ? 'Prove it’s mine' : 'Add my character'}
        </ClanLink>
      </Card>
    );
  }

  const asks = verdict.needsApproval;

  async function join() {
    if (chosen == null) return;
    setBusy(true);
    setError(null);
    setGateFail(null);
    setTwitchNote(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: chosen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok && data?.gate) {
        setGateFail(data.gate as GateFail);
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? 'Could not join');
      if (data?.pending) {
        setState('asked');
        return;
      }
      if (typeof data?.seatId === 'number') {
        const signup = await clanFetch(`/api/events/${eventId}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clanMemberIds: [data.seatId] }),
        });
        if (signup.ok) {
          setState('joined');
          return;
        }
        const s = await signup.json().catch(() => null);
        if (s?.gate) {
          setGateFail(s.gate as GateFail);
          return;
        }
      }
      // The event asks for more than one press can give (questions, several characters).
      router.push(clanUrl(`/events/${eventId}/signup`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="info">
      <div className="min-w-0">
        <div className="text-lg font-semibold">{asks ? 'Ask to join this event' : 'Join this event'}</div>
        <div className="text-sm text-text-muted">
          {info.gate ? info.gate.summary : asks ? 'The host says yes to each player.' : 'One click and you’re playing.'}
          {info.gate && asks ? ' The host also says yes to each player.' : ''}
          {signupFee ? ` Entry: ${signupFee.toLocaleString()} gp.` : ''}
        </div>
        {info.gate?.twitchLinked && (
          <div className="mt-0.5 text-[12.5px] text-text-dim">Your Twitch: {info.gate.twitchLinked}</div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Linking first saves a round trip when the gate is Twitch-only. */}
        {info.gate?.usesTwitch && info.gate.twitchAvailable && !info.gate.twitchLinked && !gateFail?.linkTwitch && (
          <button
            type="button"
            onClick={() => window.location.assign(linkTwitchHref())}
            className="rounded-xl border border-gold/40 px-4 py-3 text-base text-gold transition-colors hover:border-gold"
          >
            Link Twitch
          </button>
        )}
        {options.length > 1 && (
          <Select
            value={chosen != null ? String(chosen) : ''}
            onChange={(v) => setChosen(Number(v) || null)}
            placeholder="Which character?"
            ariaLabel="Which character"
            className="min-w-[10rem]"
            options={options.map((o) => ({ value: String(o.id), label: o.rsn }))}
          />
        )}
        <button
          type="button"
          onClick={join}
          disabled={busy || chosen == null}
          className="rounded-xl bg-gold px-6 py-3 text-base font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? 'Joining…' : asks ? 'Ask to join' : 'Join'}
        </button>
      </div>
      {gateFail && (
        <div className="w-full rounded-lg border border-accent-red/40 bg-accent-red/10 p-3 text-sm">
          <div className="font-semibold">{gateFail.summary}</div>
          {gateFail.steps.length > 0 && (
            <>
              <div className="mt-1 text-text-muted">
                {gateFail.transient
                  ? 'We couldn’t check just now:'
                  : gateFail.steps.length > 1
                    ? 'Do one of these, then press Join again:'
                    : 'Do this, then press Join again:'}
              </div>
              <ul className="mt-1 list-disc pl-5">
                {gateFail.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {gateFail.linkTwitch && (
            <button
              type="button"
              onClick={() => window.location.assign(linkTwitchHref())}
              className="mt-3 inline-block rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Link Twitch
            </button>
          )}
        </div>
      )}
      {twitchNote && (
        <p className={`w-full text-[12.5px] ${twitchNote.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{twitchNote.text}</p>
      )}
      {error && <p className="w-full text-[12.5px] text-accent-red">{error}</p>}
    </Card>
  );
}

/** "19 October" from the request's DB stamp (lib/dbTime reads both stamp formats). */
function requestedDay(stamp: string): string {
  const ms = parseStamp(stamp);
  return ms == null ? 'an earlier visit' : new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

function Card({ tone, children }: { tone: 'info' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'muted' ? 'border-card-border bg-brown-dark' : 'border-gold/30 bg-gold/10';
  return (
    <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${cls}`}>
      {children}
    </div>
  );
}
