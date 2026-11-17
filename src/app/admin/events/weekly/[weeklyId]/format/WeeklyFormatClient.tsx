'use client';

import { splitUnassigned } from '@/lib/splitUnassigned';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Checkbox from '@/components/Checkbox';
import GuideLink from '@/components/GuideLink';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import { TEAM_COLOURS, type CompetitionMode } from '@/lib/competitionTeams';

interface Team { id: number; name: string; colour: string }
interface Participant { id: number; rsn: string; teamId: number | null; /** Entered for this clan (not a clan it races against). */ host?: boolean }
interface Invite { id: number; status: string; name: string; slug: string }
interface Total { key: number; total: number; average: number; members: number; rank: number }

const MODE_OPTIONS = [
  { value: 'solo', label: 'Solo — everyone for themselves' },
  { value: 'teams', label: 'Teams — split the clan, team totals win' },
  { value: 'clans', label: 'Clan vs clan — clan totals win' },
];

const COLOUR_OPTIONS = TEAM_COLOURS.map((c) => ({ value: c, label: c, dot: c }));

const card = 'rounded-xl border border-card-border bg-card-bg p-4';
const btn = 'rounded-lg border border-card-border bg-brown-dark px-3 py-1.5 text-sm text-foreground hover:border-gold/60 disabled:opacity-50';
const goldBtn = 'rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50';

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <h2 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
      <span className="h-5 w-1 rounded-full bg-gold" />
      {children}
      {hint && <span className="text-xs font-normal text-text-muted">{hint}</span>}
    </h2>
  );
}

export default function WeeklyFormatClient(props: {
  competitionId: number;
  ended: boolean;
  /** Before its start time: the only moment the entered list may be cleared in one go. */
  notStarted: boolean;
  initialMode: CompetitionMode;
  initialLateJoin: boolean;
  initialHostEntrants: 'all' | 'selected';
  initialTeams: Team[];
  initialParticipants: Participant[];
  initialInvites: Invite[];
  totals: Total[];
  canInvite: boolean;
}) {
  const { competitionId, ended, notStarted } = props;
  const router = useRouter();
  const dialog = useDialog();
  const [mode, setMode] = useState<CompetitionMode>(props.initialMode);
  const [lateJoin, setLateJoin] = useState(props.initialLateJoin);
  const [hostEntrants, setHostEntrants] = useState(props.initialHostEntrants);
  // Switching to "Selected people" before the start, with people already entered, is two decisions:
  // the switch, and what happens to that list. Nothing is saved until the second one is made.
  const [askEntrants, setAskEntrants] = useState(false);
  const [teams, setTeams] = useState(props.initialTeams);
  const [participants, setParticipants] = useState(props.initialParticipants);
  const [invites, setInvites] = useState(props.initialInvites);
  const [newTeam, setNewTeam] = useState('');
  const [slug, setSlug] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/admin/weekly/${competitionId}`;
  const totals = useMemo(() => new Map(props.totals.map((t) => [t.key, t])), [props.totals]);

  async function call(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Something went wrong.');
        return null;
      }
      return data as Record<string, unknown>;
    } finally {
      setBusy(false);
    }
  }

  function takeTeams(data: Record<string, unknown> | null) {
    if (!data) return;
    if (Array.isArray(data.teams)) setTeams(data.teams as Team[]);
    if (Array.isArray(data.participants)) setParticipants(data.participants as Participant[]);
  }

  async function saveMode(next: CompetitionMode, nextLateJoin = lateJoin) {
    if (next === mode && nextLateJoin === lateJoin) return;
    if (mode === 'clans' && next !== 'clans' && invites.some((i) => i.status === 'accepted')) {
      const ok = await dialog.confirm({
        title: 'Leave clan vs clan?',
        body: 'Players from the other clans are taken off this competition. Their clans stay invited if you switch back.',
      });
      if (!ok) return;
    }
    const data = await call(base, { method: 'PUT', body: JSON.stringify({ mode: next, teamLateJoin: nextLateJoin }) });
    if (data) {
      setMode(next);
      setLateJoin(nextLateJoin);
      router.refresh();
    }
  }

  const hostCount = participants.filter((p) => p.host !== false).length;
  const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

  async function saveHostEntrants(next: 'all' | 'selected', clear = false) {
    const data = await call(base, { method: 'PUT', body: JSON.stringify({ hostEntrants: next, ...(clear ? { clearEntrants: true } : {}) }) });
    if (!data) return;
    setHostEntrants(next);
    setAskEntrants(false);
    if (clear) setParticipants((list) => list.filter((p) => p.host === false));
    // Back to all members enters the roster on the server; show it.
    router.refresh();
  }

  const counts = useMemo(() => {
    const m = new Map<number | null, number>();
    for (const p of participants) m.set(p.teamId, (m.get(p.teamId) ?? 0) + 1);
    return m;
  }, [participants]);

  const teamOptions = [{ value: '', label: 'No team' }, ...teams.map((t) => ({ value: String(t.id), label: t.name, dot: t.colour }))];
  const shown = participants.filter((p) => !filter || p.rsn.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <section className={card}>
        <SectionTitle>Format</SectionTitle>
        <div className="max-w-md">
          <Select
            value={mode}
            onChange={(v) => saveMode((v as CompetitionMode) || 'solo')}
            ariaLabel="Competition format"
            options={MODE_OPTIONS}
            disabled={busy || ended}
          />
        </div>
        <div className="mt-3 max-w-md">
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">Who from your clan races</label>
          <Select
            value={askEntrants ? 'selected' : hostEntrants}
            onChange={(v) => {
              const next = v === 'selected' ? 'selected' : 'all';
              if (next === hostEntrants) {
                setAskEntrants(false);
                return;
              }
              // Before the start, with the roster already entered: ask what happens to that list
              // first. Nobody is removed, and nothing is saved, without an answer.
              if (next === 'selected' && notStarted && hostCount > 0) {
                setAskEntrants(true);
                return;
              }
              void saveHostEntrants(next);
            }}
            ariaLabel="Who from your clan races"
            options={[
              { value: 'all', label: 'All members — the roster is entered automatically' },
              { value: 'selected', label: 'Selected people — only the ones you add on Participants' },
            ]}
            disabled={busy || ended}
          />
        </div>
        {askEntrants && (
          <div role="group" aria-label="What happens to the people already entered" className="mt-3 max-w-xl rounded-lg border border-gold/30 bg-gold/[0.05] p-3">
            <p className="text-sm font-medium text-foreground">
              {people(hostCount)} from your clan {hostCount === 1 ? 'is' : 'are'} already entered. What should happen to them?
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Either way, nobody new is entered automatically from now on. You add and remove people on Participants.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={goldBtn} disabled={busy} onClick={() => saveHostEntrants('selected')}>
                Keep these {hostCount} as the starting list
              </button>
              <button type="button" className={btn} disabled={busy} onClick={() => saveHostEntrants('selected', true)}>
                Clear the list and pick from scratch
              </button>
              <button type="button" className={btn} disabled={busy} onClick={() => setAskEntrants(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {!askEntrants && hostEntrants === 'selected' && !ended && (
          <p className="mt-2 max-w-xl text-xs text-text-muted">
            {notStarted
              ? `Only the people you add race. ${hostCount === 0 ? 'Nobody is entered yet' : `${people(hostCount)} entered so far`}: add or remove people on Participants.`
              : `This competition has already started, so the ${people(hostCount)} entered so far stay in. Nobody new is entered automatically. To take someone out, remove them on Participants.`}
          </p>
        )}
        <p className="mt-2 text-xs text-text-muted">
          Every player can opt out of a competition themselves. Individual standings always show. Teams and clan vs clan add a ranking of totals on top, with an average per player
          so uneven sizes compare fairly.{' '}
          <GuideLink href="/guide/team-competitions">How team competitions work</GuideLink>
        </p>
      </section>

      {mode === 'teams' && (
        <>
          <section className={card}>
            <SectionTitle hint={`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}>Teams</SectionTitle>
            <div className="space-y-2">
              {teams.map((t) => {
                const tot = totals.get(t.id);
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-card-border/70 bg-brown-dark/40 p-2">
                    <div className="w-36">
                      <Select
                        value={t.colour}
                        onChange={async (colour) => takeTeams(await call(`${base}/teams`, { method: 'PATCH', body: JSON.stringify({ teamId: t.id, colour }) }))}
                        ariaLabel={`${t.name} colour`}
                        options={COLOUR_OPTIONS}
                        disabled={busy || ended}
                      />
                    </div>
                    <Input
                      defaultValue={t.name}
                      aria-label="Team name"
                      maxLength={40}
                      disabled={busy || ended}
                      onBlur={async (e) => {
                        const name = e.currentTarget.value.trim();
                        if (name && name !== t.name) takeTeams(await call(`${base}/teams`, { method: 'PATCH', body: JSON.stringify({ teamId: t.id, name }) }));
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-light px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                    />
                    <span className="text-xs text-text-muted">
                      {counts.get(t.id) ?? 0} players{tot ? ` · +${Math.round(tot.total).toLocaleString()} · ${Math.round(tot.average).toLocaleString()} avg · #${tot.rank}` : ''}
                    </span>
                    <button
                      type="button"
                      className={btn}
                      disabled={busy || ended}
                      onClick={async () => {
                        const ok = await dialog.confirm({ title: `Delete ${t.name}?`, body: 'Its players become unassigned.' });
                        if (ok) takeTeams(await call(`${base}/teams?teamId=${t.id}`, { method: 'DELETE' }));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>

            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newTeam.trim()) return;
                const data = await call(`${base}/teams`, { method: 'POST', body: JSON.stringify({ action: 'create', name: newTeam.trim() }) });
                if (data) {
                  takeTeams(data);
                  setNewTeam('');
                }
              }}
            >
              <Input
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                placeholder="New team name"
                maxLength={40}
                aria-label="New team name"
                disabled={busy || ended}
                className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-light px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
              <button type="submit" className={goldBtn} disabled={busy || ended || !newTeam.trim()}>
                Add team
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-card-border/60 pt-3">
              <button
                type="button"
                className={goldBtn}
                disabled={busy || ended || teams.length < 2}
                onClick={async () => {
                  const ok = await dialog.confirm({
                    title: 'Auto-balance teams?',
                    body: 'Everyone is re-split so team sizes differ by at most one and current levels/KC are as even as possible. Manual placements are replaced.',
                  });
                  if (ok) takeTeams(await call(`${base}/teams`, { method: 'POST', body: JSON.stringify({ action: 'autobalance' }) }));
                }}
              >
                Auto-balance by current level/KC
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy || ended || teams.length < 1 || (counts.get(null) ?? 0) === 0}
                onClick={async () => {
                  const n = counts.get(null) ?? 0;
                  const ok = await dialog.confirm({
                    title: `Split ${n} unassigned player${n === 1 ? '' : 's'} evenly?`,
                    body: 'They go to the smallest teams first. Players already on a team stay where they are.',
                    confirmLabel: 'Split them',
                  });
                  if (!ok) return;
                  const assignments = splitUnassigned(teams.map((t) => t.id), participants);
                  takeTeams(await call(`${base}/teams`, { method: 'POST', body: JSON.stringify({ action: 'assign', assignments }) }));
                }}
              >
                Split unassigned evenly
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy || ended || participants.every((p) => p.teamId == null)}
                onClick={async () => {
                  const placed = participants.filter((p) => p.teamId != null);
                  const ok = await dialog.confirm({
                    title: `Take ${placed.length} player${placed.length === 1 ? '' : 's'} off their teams?`,
                    body: 'Everyone becomes unassigned. Teams stay.',
                    confirmLabel: 'Clear all',
                  });
                  if (!ok) return;
                  const assignments = placed.map((p) => ({ participantId: p.id, teamId: null }));
                  takeTeams(await call(`${base}/teams`, { method: 'POST', body: JSON.stringify({ action: 'assign', assignments }) }));
                }}
              >
                Clear all
              </button>
              <Checkbox
                checked={lateJoin}
                onChange={(v) => saveMode(mode, v)}
                label="Late joiners go into the smallest team"
                className="text-sm text-foreground/80"
                disabled={busy || ended}
              />
            </div>
          </section>

          <section className={card}>
            <SectionTitle hint={`${counts.get(null) ?? 0} unassigned`}>Players</SectionTitle>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a player"
              aria-label="Find a player"
              className="mb-3 w-full max-w-sm rounded-lg border border-card-border bg-brown-light px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            />
            {participants.length === 0 ? (
              <p className="text-sm text-text-muted">
                {hostEntrants === 'selected'
                  ? 'Nobody is entered yet. Add people on Participants.'
                  : 'Nobody is entered yet — the roster is entered when the competition is created and on every sweep.'}
              </p>
            ) : (
              <div className="max-h-[28rem] divide-y divide-card-border/50 overflow-y-auto rounded-lg border border-card-border/70">
                {shown.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.rsn}</span>
                    <div className="w-44">
                      <Select
                        value={p.teamId == null ? '' : String(p.teamId)}
                        onChange={async (v) =>
                          takeTeams(
                            await call(`${base}/teams`, {
                              method: 'POST',
                              body: JSON.stringify({ action: 'assign', assignments: [{ participantId: p.id, teamId: v ? Number(v) : null }] }),
                            }),
                          )
                        }
                        ariaLabel={`Team for ${p.rsn}`}
                        options={teamOptions}
                        disabled={busy || ended}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {mode === 'clans' && (
        <section className={card}>
          <SectionTitle hint="your clan races too">Clans</SectionTitle>
          {invites.length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">No clans invited yet.</p>
          ) : (
            <div className="mb-3 space-y-2">
              {invites.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-card-border/70 bg-brown-dark/40 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {i.name} <span className="font-normal text-text-muted">/c/{i.slug}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      i.status === 'accepted'
                        ? 'bg-accent-green/15 text-accent-green-light'
                        : i.status === 'declined'
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-gold/15 text-gold'
                    }`}
                  >
                    {i.status === 'accepted' ? 'Racing' : i.status === 'declined' ? 'Declined' : 'Waiting for their admin'}
                  </span>
                  {props.canInvite && (
                    <button
                      type="button"
                      className={btn}
                      disabled={busy}
                      onClick={async () => {
                        const ok = await dialog.confirm({
                          title: i.status === 'accepted' ? `Remove ${i.name}?` : `Withdraw the invite to ${i.name}?`,
                          body: i.status === 'accepted' ? 'Their players leave this competition.' : undefined,
                        });
                        if (!ok) return;
                        const data = await call(`${base}/clans?inviteId=${i.id}`, { method: 'DELETE' });
                        if (data && Array.isArray(data.invites)) setInvites(data.invites as Invite[]);
                      }}
                    >
                      {i.status === 'accepted' ? 'Remove' : 'Withdraw'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {props.canInvite ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!slug.trim()) return;
                const data = await call(`${base}/clans`, { method: 'POST', body: JSON.stringify({ slug: slug.trim() }) });
                if (data && Array.isArray(data.invites)) {
                  setInvites(data.invites as Invite[]);
                  setSlug('');
                }
              }}
            >
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Clan address, e.g. theafkspot"
                aria-label="Clan address"
                disabled={busy || ended}
                className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-light px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
              <button type="submit" className={goldBtn} disabled={busy || ended || !slug.trim()}>
                Invite
              </button>
            </form>
          ) : (
            <p className="text-xs text-text-muted">Only an owner or admin can invite clans.</p>
          )}
          <p className="mt-2 text-xs text-text-muted">
            An owner or admin of the invited clan accepts from their admin (People page). Their whole roster then races for
            their clan; they can see the standings but can&rsquo;t change anything here.
          </p>
        </section>
      )}
    </div>
  );
}
