'use client';

import { useEffect, useMemo, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Select, { type SelectOption } from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { applyRankRules, ruleMatches, type RankRule, type StaffSuggestion } from '@/lib/rankRules';

interface View {
  rules: RankRule[];
  order: string[];
  remove: boolean;
  rosterRanks: Record<string, number>;
  roles: { id: string; name: string; color: number }[];
  suggestions: { userId: number; name: string; rank: string; current: StaffSuggestion; suggested: StaffSuggestion }[];
}

const STAFF_LABEL: Record<StaffSuggestion, string> = {
  none: 'None',
  editor: 'Tile editor',
  moderator: 'Moderator',
  treasurer: 'Treasurer',
  admin: 'Admin',
};

const title = (rank: string) => rank.replace(/\b\w/g, (c) => c.toUpperCase());
const hex = (n: number) => (n ? `#${n.toString(16).padStart(6, '0')}` : undefined);

/**
 * Rank rules: give a Discord role when someone reaches an in-game rank (or any above it), adding up
 * as they climb, and optionally suggest site access for an admin to approve. Shows the clan's rank
 * ladder (reorderable — custom titles have no built-in order) and what each rank ends up with.
 */
export default function RankRulesPanel() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    void (async () => {
      const res = await clanFetch('/api/admin/discord/rank-rules');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setView(data);
      else setError(data.error ?? 'Could not load rank rules.');
    })();
  }, []);

  async function save(patch: Partial<Pick<View, 'rules' | 'order' | 'remove'>>) {
    if (!view) return;
    const before = view;
    setView({ ...view, ...patch });
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      // The ladder is saved with every rule change, so "or higher" never depends on a guess.
      const res = await clanFetch('/api/admin/discord/rank-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: view.order, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setView(data);
    } catch (e) {
      setView(before);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function applyNow() {
    setSaving(true);
    setNote(null);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/discord/sync-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'The sync did not run.');
      setNote('Roles updated for everyone in the clan.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function approve(s: View['suggestions'][number]) {
    setSaving(true);
    setError(null);
    try {
      const body = s.suggested === 'editor' ? { canEditTiles: true } : { role: s.suggested };
      const res = await clanFetch(`/api/admin/users/${s.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not go through.');
      setDismissed((d) => new Set(d).add(s.userId));
      setNote(`${s.name} is now ${STAFF_LABEL[s.suggested]}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const roleOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Pick a role…' }, ...(view?.roles ?? []).map((r) => ({ value: r.id, label: `@${r.name}`, dot: hex(r.color) }))],
    [view],
  );

  if (!view) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;

  const rankOptions: SelectOption[] = view.order.map((r) => ({ value: r, label: title(r) }));
  const roleName = (id: string) => view.roles.find((r) => r.id === id)?.name ?? 'a role';
  const updateRule = (id: string, patch: Partial<RankRule>) => void save({ rules: view.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const move = (i: number, dir: -1 | 1) => {
    const order = [...view.order];
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void save({ order });
  };
  const pending = view.suggestions.filter((s) => !dismissed.has(s.userId));

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-muted">
        When someone reaches a rank in game, they get a Discord role. Roles add up: passing a rank keeps the roles from
        every rank below it. Checked every time the roster syncs. People with several accounts count by their highest rank.
      </p>

      <ul className="space-y-2">
        {view.rules.map((r) => (
          <li key={r.id} className="space-y-2 rounded-xl border border-card-border bg-brown-light p-3">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
              <span>When rank is</span>
              <Select className="w-44" value={r.rank} options={rankOptions} onChange={(v) => updateRule(r.id, { rank: v })} ariaLabel="In-game rank" disabled={saving} />
              <Select
                className="w-32"
                value={r.mode}
                options={[
                  { value: 'up', label: 'or higher' },
                  { value: 'eq', label: 'exactly' },
                ]}
                onChange={(v) => updateRule(r.id, { mode: v as RankRule['mode'] })}
                ariaLabel="Exactly or higher"
                disabled={saving}
              />
              <span>→ give</span>
              <Select
                className="w-52"
                value={r.roleId ?? ''}
                options={roleOptions}
                onChange={(v) => updateRule(r.id, { roleId: v || null })}
                ariaLabel="Discord role"
                searchable
                disabled={saving}
              />
              <span>in Discord</span>
              <span className="ml-auto text-[12px]">{memberCount(view, r)}</span>
              <button
                type="button"
                aria-label="Remove rule"
                disabled={saving}
                onClick={() => void save({ rules: view.rules.filter((x) => x.id !== r.id) })}
                className="h-8 w-8 rounded-md border border-card-border text-text-muted hover:text-accent-red"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-dashed border-card-border-soft pt-2">
              <Checkbox
                checked={r.keep}
                disabled={saving}
                onChange={(keep) => updateRule(r.id, { keep })}
                label="Keep it after a demotion"
                description="Earned once, kept for good (a veteran badge)"
              />
              <label className="flex items-center gap-2 text-[12px] text-text-muted">
                Also suggest site access <span className="text-text-dim">(optional)</span>
                <Select
                  className="w-40"
                  value={r.staff}
                  options={(Object.keys(STAFF_LABEL) as StaffSuggestion[]).map((k) => ({ value: k, label: STAFF_LABEL[k] }))}
                  onChange={(v) => updateRule(r.id, { staff: v as StaffSuggestion })}
                  ariaLabel="Site access"
                  disabled={saving}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || view.order.length === 0}
          onClick={() =>
            void save({
              rules: [...view.rules, { id: `r${Date.now().toString(36)}`, rank: view.order[Math.min(3, view.order.length - 1)], mode: 'up', roleId: null, keep: false, staff: 'none' }],
            })
          }
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
        >
          + Add rule
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void applyNow()}
          className="rounded-lg border border-card-border px-4 py-2 text-sm text-text-muted hover:text-foreground disabled:opacity-50"
        >
          Apply to everyone now
        </button>
      </div>

      <div className="rounded-xl border border-card-border-soft bg-brown-dark p-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">Your rank ladder, and what each rank ends up with</span>
          <span className="text-[12px] text-text-muted">Highest first. Move a rank to fix its place.</span>
        </div>
        <ul>
          {view.order.map((rank, i) => {
            const got = applyRankRules(view.rules, view.order, rank);
            return (
              <li key={rank} className="flex flex-wrap items-center gap-2 border-t border-card-border-soft py-1.5 first:border-t-0">
                <span className="flex gap-1">
                  <button type="button" aria-label={`Move ${rank} up`} disabled={saving || i === 0} onClick={() => move(i, -1)} className="h-7 w-7 rounded border border-card-border text-[12px] disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Move ${rank} down`} disabled={saving || i === view.order.length - 1} onClick={() => move(i, 1)} className="h-7 w-7 rounded border border-card-border text-[12px] disabled:opacity-30">↓</button>
                </span>
                <span className="w-36 text-[13px] font-medium">{title(rank)}</span>
                <span className="w-20 text-[11px] text-text-muted">{view.rosterRanks[rank] ?? 0} people</span>
                {[...got.give].map((id) => (
                  <span key={id} className="rounded-full border border-gold/30 bg-gold/15 px-2.5 py-0.5 text-[12px] text-gold">@{roleName(id)}</span>
                ))}
                {got.staff !== 'none' && <span className="text-[11px] text-text-muted">+ site {STAFF_LABEL[got.staff].toLowerCase()} (suggested)</span>}
              </li>
            );
          })}
        </ul>
      </div>

      <Checkbox
        checked={view.remove}
        disabled={saving}
        onChange={(remove) => void save({ remove })}
        label="Take rule roles away when someone's rank drops"
        description="Unless the rule says to keep it."
      />

      {pending.length > 0 && (
        <div className="space-y-2 rounded-xl border border-gold/30 bg-gold/5 p-4">
          <div className="text-sm font-semibold">Site access your rank rules suggest</div>
          <p className="text-[12px] text-text-muted">Nothing changes until you approve. Approving uses the same checks as setting a role by hand.</p>
          <ul className="space-y-1.5">
            {pending.map((s) => (
              <li key={s.userId} className="flex flex-wrap items-center gap-3 text-[13px]">
                <span className="font-medium">{s.name}</span>
                <span className="text-text-muted">{title(s.rank)} · now {STAFF_LABEL[s.current].toLowerCase()} → {STAFF_LABEL[s.suggested]}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" disabled={saving} onClick={() => void approve(s)} className="rounded-lg bg-gold px-3 py-1.5 text-[12px] font-semibold text-brown-dark disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => setDismissed((d) => new Set(d).add(s.userId))} className="px-2 text-[12px] text-text-muted hover:text-foreground">Not now</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="text-[13px] text-accent-green-light">{note}</p>}
      {error && <p className="text-[13px] text-accent-red">{error}</p>}
    </div>
  );
}

function memberCount(view: View, rule: RankRule): string {
  if (!rule.roleId) return 'pick a role';
  let n = 0;
  for (const [rank, c] of Object.entries(view.rosterRanks)) if (ruleMatches(rule, rank, view.order)) n += c;
  return `matches ${n} ${n === 1 ? 'person' : 'people'} now`;
}
