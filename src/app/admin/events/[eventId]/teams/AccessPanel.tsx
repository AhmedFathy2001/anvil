'use client';

import SettingsCard from '../settings/SettingsCard';
import { useSaveBar } from '../settings/SaveBar';
import { Segmented, SettingRow, Switch } from '../settings/controls';
import { useCallback, useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import { useDialog } from '@/components/Confirm';
import ClanPicker, { type PickedClan } from '@/components/ClanPicker';

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
  { value: 'clan', label: 'Your clan', hint: 'Only people on your member list — plus anyone, if your clan is public.' },
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

const CREATOR_VISIBILITY: { value: string; label: string; hint: string }[] = [
  { value: 'clan', label: 'Anyone with the link', hint: 'On your space’s page, and open to anyone you share it with.' },
  { value: 'invited', label: 'Invited only', hint: 'Hidden unless you invite them by name.' },
  { value: 'public', label: 'Anyone', hint: 'Listed and readable by anybody on Anvil.' },
];

const CREATOR_ENTRY: { value: string; label: string; hint: string }[] = [
  { value: 'open', label: 'Anyone', hint: 'Viewers join straight away.' },
  { value: 'approval', label: 'Ask me about everyone', hint: 'Every player lands in your queue first.' },
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
export default function AccessPanel({ eventId, creator = false }: { eventId: number; creator?: boolean }) {
  // A creator space (lib/creatorSpaces): no member list, no clans to invite, and `open` really is
  // open (outsiderNeedsApproval), so the choices are said in those words.
  const visibilityOptions = creator ? CREATOR_VISIBILITY : VISIBILITY;
  const entryOptions = creator ? CREATOR_ENTRY : ENTRY;
  // Drafts, saved together by the Save button — picking an option is not committing to it.
  const [visibility, setVisibility] = useState<string | null>(null);
  const [entry, setEntry] = useState<string | null>(null);
  const [advertised, setAdvertised] = useState(false);
  const [saved, setSaved] = useState<{ visibility: string | null; entry: string | null; advertised: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [guestPolicy, setGuestPolicy] = useState<string | null>(null);
  const [clanPublic, setClanPublic] = useState(true);
  const [pickedClan, setPickedClan] = useState<PickedClan | null>(null);
  // Inviting ONE PERSON. `event_invites` always took a clan or a person and the POST always accepted
  // `playerId`; what was missing was any way to turn a name into an id, so only half of inviting was
  // reachable from the product.
  const [mode, setMode] = useState<'clan' | 'person'>(creator ? 'person' : 'clan');
  const [rsn, setRsn] = useState('');
  const [lookup, setLookup] = useState<{ playerId: number; rsn: string; alreadyInvited: boolean } | null>(null);
  const [looked, setLooked] = useState(false);
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/events/${eventId}/invites`);
    if (!res.ok) return;
    const d = await res.json();
    setVisibility(d.visibility);
    setEntry(d.entry);
    setAdvertised(!!d.advertised);
    setSaved({ visibility: d.visibility, entry: d.entry, advertised: !!d.advertised });
    setInvites(d.invites ?? []);
    setGuestPolicy(d.guestPolicy ?? null);
    setClanPublic(d.clanPublic !== false);
  }, [eventId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const dirty =
    saved != null &&
    (visibility !== saved.visibility || (entry ?? 'open') !== (saved.entry ?? 'open') || advertised !== saved.advertised);

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility, entry: entry ?? 'open', advertised }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not save');
      setSaved({ visibility, entry: entry ?? 'open', advertised });
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!saved) return;
    setVisibility(saved.visibility);
    setEntry(saved.entry);
    setAdvertised(saved.advertised);
    setError(null);
  }

  async function invite() {
    const clanSlug = pickedClan?.slug;
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
      setPickedClan(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Exact name, exact answer — the route matches a normalised RSN and never a prefix. */
  async function findPerson() {
    const q = rsn.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setLooked(false);
    try {
      const res = await clanFetch(`/api/events/${eventId}/invites/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not look that up');
      setLookup(data?.match ?? null);
      setLooked(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function invitePerson() {
    if (!lookup) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: lookup.playerId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not invite');
      setRsn('');
      setLookup(null);
      setLooked(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number, name: string) {
    const ok = await confirm({
      title: `Remove the invite for ${name}?`,
      body: 'They won’t be able to see this board any more unless you invite them again.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
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

  // The tab's save bar (settings/SaveBar), after save/discard and before the early return.
  const inBar = useSaveBar('access', 'Who can see and enter', dirty, () => save(), () => discard());

  if (visibility == null) return null;

  // The guest-door warning belongs with "who can enter"; drawn in that section below.
  const guestsClosed = guestPolicy === 'closed' && !creator;

  return (
    <>
    <SettingsCard
      title="Who can see it"
      description={creator ? 'Your space page, the board and the sign-up page.' : 'The board, standings and sign-up page.'}
      flush
    >
      <SettingRow stack>
        <Segmented label="Who can see it" options={visibilityOptions} value={visibility} onChange={setVisibility} />
      </SettingRow>
      {/* Readable by anyone is not the same as advertised to everyone — a separate yes. Offered
          wherever a stranger can already read the board; never on an invite-only one. */}
      {visibility !== 'invited' && (
        <SettingRow
          title="List on Anvil"
          hint={
            <>
              Shows it on anvilosrs.com/events while it&rsquo;s upcoming or live.
              {!clanPublic && (
                <span className="mt-1 block text-accent-red">Your clan is private, so it won&rsquo;t be listed until the clan is public.</span>
              )}
            </>
          }
        >
          <Switch on={advertised} onChange={setAdvertised} label="List on Anvil" />
        </SettingRow>
      )}

      {((dirty && !inBar) || savedNote) && (
        <div className="flex items-center gap-3 border-t border-card-border px-5 py-3">
          {dirty ? (
            <>
              <span className="text-[12.5px] text-text-muted">Unsaved changes.</span>
              <button
                type="button"
                onClick={discard}
                disabled={saving}
                className="ml-auto text-[12.5px] text-text-muted hover:text-foreground hover:underline underline-offset-4"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-gold px-4 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <span className="text-[12.5px] text-accent-green-light">Saved.</span>
          )}
        </div>
      )}
      {!(visibility === 'invited' || invites.length > 0) && error && (
        <p className="px-5 pb-3 text-[12.5px] text-accent-red">{error}</p>
      )}

      {/* Only meaningful while the board is invite-only — but shown whenever invites EXIST, so
          switching to "Anyone" does not hide a list somebody may want to clean up. */}
      {(visibility === 'invited' || invites.length > 0) && (
        <div className="border-t border-card-border px-5 py-4">
          <div className="mb-2 text-[13px] font-semibold">Invited</div>
          {invites.length === 0 ? (
            <p className="mb-2.5 text-[12.5px] text-accent-red">
              {creator
                ? 'Nobody is invited yet, so only you and your staff can see this board.'
                : 'Nobody is invited yet, so nobody outside your clan can see this board.'}
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
                    onClick={() => revoke(i.id, i.clanName ?? i.playerName ?? 'them')}
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

          {/* A creator space invites people, never clans. */}
          {!creator && (
            <div className="mb-2 flex gap-1">
              {(['clan', 'person'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setLooked(false);
                    setLookup(null);
                  }}
                  className={`rounded-lg px-3 py-1 text-[12.5px] transition-colors ${
                    mode === m ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'
                  }`}
                >
                  {m === 'clan' ? 'A clan' : 'One person'}
                </button>
              ))}
            </div>
          )}

          {mode === 'person' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={rsn}
                onChange={(e) => {
                  setRsn(e.target.value);
                  setLooked(false);
                  setLookup(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && findPerson()}
                placeholder="Their exact RSN"
                className="flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
              />
              <button
                type="button"
                onClick={lookup ? invitePerson : findPerson}
                disabled={busy || !rsn.trim() || (looked && !lookup) || lookup?.alreadyInvited}
                className="shrink-0 rounded-lg bg-gold px-4 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                {busy ? '…' : lookup ? `Invite ${lookup.rsn}` : 'Find'}
              </button>
            </div>
          ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ClanPicker value={pickedClan} onChange={setPickedClan} disabled={busy} />
            <button
              type="button"
              onClick={invite}
              disabled={busy || !pickedClan}
              className="shrink-0 rounded-lg bg-gold px-4 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              Invite
            </button>
          </div>
          )}

          {/* Said plainly, because an exact-match lookup that finds nothing is indistinguishable from
              a typo, and the two want different next moves. */}
          {mode === 'person' && looked && !lookup && (
            <p className="mt-2 text-[12.5px] text-accent-red">
              Nobody on Anvil has verified that name. Check the spelling — it has to be exact.
            </p>
          )}
          {mode === 'person' && lookup?.alreadyInvited && (
            <p className="mt-2 text-[12.5px] text-text-muted">{lookup.rsn} is already invited.</p>
          )}
          {!creator && (
            <p className="mt-2 text-[12px] text-text-muted">
              An invited clan’s members can see this board and enter without being approved one by one.
              To have a clan run its own TEAM here, invite it as a co-host below instead.
            </p>
          )}
          {error && <p className="mt-2 text-[12.5px] text-accent-red">{error}</p>}
        </div>
      )}
    </SettingsCard>

    <SettingsCard
      title="Who can enter"
      description={creator ? 'Who can play once they can see it.' : 'Your roster always can. Anyone else waits for your yes on Sign-ups.'}
      flush
    >
      <SettingRow stack>
        <Segmented label="Who can enter" options={entryOptions} value={entry ?? 'open'} onChange={setEntry} />
        {/* The clan's own door is the stricter of the two and always wins in lib/guestAdmission —
            this setting could promise entry that the roster policy then refused, silently. */}
        {guestsClosed && (
          <p className="text-[12.5px] text-accent-red">
            Your clan is not taking guests, so nobody from outside can enter whatever this says. Change it under People → Who
            can join.
          </p>
        )}
      </SettingRow>
    </SettingsCard>
    </>
  );
}
