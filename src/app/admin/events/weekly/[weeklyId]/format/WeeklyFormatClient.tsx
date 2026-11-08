'use client';

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
interface Participant { id: number; rsn: string; teamId: number | null }
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
  initialMode: CompetitionMode;
  initialLateJoin: boolean;
  initialHostEntrants: 'all' | 'selected';
  initialTeams: Team[];
  initialParticipants: Participant[];
  initialInvites: Invite[];
  totals: Total[];
  canInvite: boolean;
}) {
  const { competitionId, ended } = props;
  const router = useRouter();
  const dialog = useDialog();
  const [mode, setMode] = useState<CompetitionMode>(props.initialMode);
  const [lateJoin, setLateJoin] = useState(props.initialLateJoin);
  const [hostEntrants, setHostEntrants] = useState(props.initialHostEntrants);
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
            value={hostEntrants}
            onChange={async (v) => {
              const next = v === 'selected' ? 'selected' : 'all';
              if (await call(base, { method: 'PUT', body: JSON.stringify({ hostEntrants: next }) })) setHostEntrants(next);
            }}
            ariaLabel="Who from your clan races"
            options={[
              { value: 'all', label: 'All members — the roster is entered automatically' },
              { value: 'selected', label: 'Selected people — only the ones you add on Participants' },
            ]}
            disabled={busy || ended}
          />
        </div>
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
              <p className="text-sm text-text-muted">Nobody is entered yet — the roster is entered when the competition is created and on every sweep.</p>
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
