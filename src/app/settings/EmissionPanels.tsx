'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Select from '@/components/Select';
import Input from '@/components/Input';
import LevelRulesEditor from '@/components/LevelRulesEditor';
import type { EmissionSettingsView, EmissionState } from '@/lib/emissionSettings';
import { CA_TIERS, QUEST_TIERS, NOTIFY_DEFAULTS, type NotifyPrefs } from '@/lib/notifyPrefs';
import type { LevelPostsChoice, MilestoneRules } from '@/lib/levelRules';

const KIND_LABELS: Record<string, string> = {
  rareDrops: 'Rare drops',
  pets: 'Pets',
  deaths: 'Deaths',
  combatAchievements: 'Combat achievements',
  levels: 'Levels & milestones',
  quests: 'Quests',
  diaries: 'Achievement diaries',
  collectionLog: 'Collection log',
  pvpKills: 'PvP kills',
};
const KINDS = Object.keys(KIND_LABELS);

const LEVEL_POSTS_OPTIONS: { value: LevelPostsChoice; label: string }[] = [
  { value: 'clan', label: 'Clan rules' },
  { value: 'ninetyNinesAndMax', label: 'Only 99s & max' },
  { value: 'off', label: 'Off' },
];

const STATE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'always', label: 'Always announce' },
  { value: 'never', label: 'Never' },
];

/** Shared state for the panels below: each PATCH returns the whole view, so they stay in step. */
function useEmissions(initial: EmissionSettingsView) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/emissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'That didn’t work.');
      else setView(data as EmissionSettingsView);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }
  return { view, setView, busy, error, patch };
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{error}</div>
  ) : null;
}

/**
 * "Where do my announcements go" — the account-wide half of lib/emissionRouting, on /settings.
 *
 * The distinction the copy leans on, because it is the one people get wrong: this is about the SOCIAL
 * stuff — drops, pets, deaths, combat achievements. A bingo submission is EVIDENCE and always reaches
 * the clan running the board; nothing here can send it somewhere else or hold it back.
 */
export function AnnouncementsGeneral({ initial }: { initial: EmissionSettingsView }) {
  const { view, busy, error, patch } = useEmissions(initial);
  return (
    <div className="grid gap-5">
      <ErrorLine error={error} />
      <Checkbox
        checked={view.blockGuestEmissions}
        onChange={(v) => patch({ blockGuestEmissions: v })}
        disabled={busy}
        label="Keep my announcements out of clans I only guest in"
        description="Your own clan and your bingo boards are unaffected. Allow single clans on each character's page."
      />
      {/* Level posts in clan channels — stricter-only on top of each clan's own rules. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Level posts in clan channels</p>
          <p className="text-[12px] text-text-muted">
            Your clans decide which level-ups and XP milestones get posted; you can turn yours down, not up.
          </p>
        </div>
        <Select
          value={view.levelPostsClan}
          onChange={(v) => patch({ levelPostsClan: v })}
          options={LEVEL_POSTS_OPTIONS}
          disabled={busy}
          ariaLabel="Level posts in clan channels"
          className="w-48 shrink-0"
        />
      </div>
    </div>
  );
}

/**
 * One character's announcement routing, per clan: guest clans (and clans it was pointed at) with
 * their override, plus "also announce to" one of the person's member clans. Null when there is
 * nothing to choose — a character only in its own clan always announces there.
 */
export function CharacterAnnouncements({ initial, accountId }: { initial: EmissionSettingsView; accountId: number }) {
  const { view, busy, error, patch } = useEmissions(initial);
  const a = view.accounts.find((x) => x.accountId === accountId);
  if (!a) return null;
  const pointable = view.memberClans.filter(
    (mc) => mc.clanId !== a.memberClan?.clanId && !a.clans.some((c) => c.clanId === mc.clanId),
  );
  if (a.clans.length === 0 && pointable.length === 0) {
    return (
      <p className="text-[13px] text-text-muted">
        {a.memberClan ? <>Announces in {a.memberClan.name}, its own clan. Nothing else to choose.</> : <>Not in a clan, so nothing announces anywhere.</>}
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <ErrorLine error={error} />
      {a.memberClan && (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span>
            {a.memberClan.name} <span className="ml-1 text-[11px] text-text-muted">its own clan</span>
          </span>
          <span className="w-44 text-right text-[12px] text-text-muted">Always</span>
        </div>
      )}
      {a.clans.map((c) => (
        <div key={c.clanId} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[13px]">
            {c.name}
            <span className="ml-1.5 text-[11px] text-text-muted">{c.seat === 'guest' ? 'guest' : 'pointed here'}</span>
          </span>
          <Select
            value={c.state}
            onChange={(v) => patch({ accountId: a.accountId, clanId: c.clanId, state: v as EmissionState })}
            options={STATE_OPTIONS}
            disabled={busy}
            ariaLabel={`Announcements for ${a.rsn} in ${c.name}`}
            className="w-44 shrink-0"
          />
        </div>
      ))}
      {pointable.length > 0 && (
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[12px] text-text-muted">Also announce to a clan you&rsquo;re a member of:</span>
          <Select
            value=""
            onChange={(v) => v && patch({ accountId: a.accountId, clanId: Number(v), state: 'always' })}
            options={[{ value: '', label: 'Add…' }, ...pointable.map((mc) => ({ value: String(mc.clanId), label: mc.name }))]}
            disabled={busy}
            ariaLabel={`Point ${a.rsn} at a clan you are a member of`}
            className="w-44 shrink-0"
          />
        </div>
      )}
    </div>
  );
}

/** Personal Discord webhooks and the level rules that apply to them. */
export function WebhooksPanel({ initial }: { initial: EmissionSettingsView }) {
  const { view, setView, busy, error, patch } = useEmissions(initial);
  return (
    <div className="grid gap-5">
      <ErrorLine error={error} />
      <WebhookSection view={view} onChange={setView} />
      <PersonalLevelRules
        initial={view.personalLevelRules}
        hasLevelHook={view.webhooks.some((h) => h.kinds.includes('levels'))}
        busy={busy}
        onSave={(rules) => patch({ personalLevelRules: rules })}
      />
    </div>
  );
}

function WebhookSection({
  view,
  onChange,
}: {
  view: EmissionSettingsView;
  onChange: (v: EmissionSettingsView) => void;
}) {
  const [url, setUrl] = useState('');
  const [kinds, setKinds] = useState<Set<string>>(new Set(KINDS));
  const [minRarity, setMinRarity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The list is refreshed from the emissions view; keep a local copy so add/remove feel instant.
  const [hooks, setHooks] = useState(view.webhooks);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, kinds: [...kinds], minRarity: minRarity || null }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not add that.');
      else {
        setHooks((h) => [...h, data.webhook]);
        onChange({ ...view, webhooks: [...hooks, data.webhook] });
        setUrl('');
        setMinRarity('');
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/profile/webhooks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const next = hooks.filter((h) => h.id !== id);
      setHooks(next);
      onChange({ ...view, webhooks: next });
    }
  }

  return (
    <div>
            <p className="mb-3 mt-0.5 max-w-[70ch] text-[12.5px] text-text-muted">
        Send copies of your notifications to your own Discord channels, independent of any clan. Paste a
        webhook from a channel&rsquo;s Integrations → Webhooks.
      </p>

      {hooks.length > 0 && (
        <ul className="mb-3 grid gap-1.5">
          {hooks.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-card-border/60 bg-brown-dark/30 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[13px]">{h.label ?? maskUrl(h.url)}</span>
                <span className="block text-[11px] text-text-muted">
                  {h.kinds.map((k) => KIND_LABELS[k] ?? k).join(', ')}
                  {h.minRarity != null ? ` · ≥ ${h.minRarity.toLocaleString()} gp` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(h.id)}
                className="shrink-0 rounded-md border border-card-border px-2.5 py-1 text-[12px] text-text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2.5 rounded-lg border border-card-border/60 bg-brown-dark/30 p-3">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          className="text-xs"
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {KINDS.map((k) => (
            <Checkbox
              key={k}
              checked={kinds.has(k)}
              onChange={(on) =>
                setKinds((prev) => {
                  const next = new Set(prev);
                  if (on) next.add(k);
                  else next.delete(k);
                  return next;
                })
              }
              labelClassName="text-xs"
              label={KIND_LABELS[k]}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-text-muted">Only drops worth at least</span>
          <Input
            value={minRarity}
            onChange={(e) => setMinRarity(e.target.value)}
            inputMode="numeric"
            placeholder="any"
            className="w-28 text-xs"
          />
          <span className="text-[12px] text-text-muted">gp (optional)</span>
          <button
            type="button"
            onClick={add}
            disabled={busy || !url.trim() || kinds.size === 0}
            className="ml-auto rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            Add webhook
          </button>
        </div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}

/** "Level posts on my webhooks" — the same controls as a clan's, free to be looser than any clan's. */
function PersonalLevelRules({
  initial,
  hasLevelHook,
  busy,
  onSave,
}: {
  initial: MilestoneRules;
  hasLevelHook: boolean;
  busy: boolean;
  onSave: (rules: MilestoneRules) => void;
}) {
  const [rules, setRules] = useState(initial);
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);
  return (
    <details className="group/lvl rounded-lg border border-card-border/60 bg-brown-dark/30">
      <summary className="flex cursor-pointer list-none select-none items-center gap-2 px-3.5 py-2.5 text-sm font-medium">
        <span className="text-text-muted transition-transform group-open/lvl:rotate-90" aria-hidden>
          ▸
        </span>
        Level posts on my webhooks
      </summary>
      <div className="grid gap-4 px-3.5 pb-3.5">
        <p className="max-w-[70ch] text-[12px] text-text-muted">
          {hasLevelHook
            ? 'Which level-ups and XP milestones go to your own webhooks that take “Levels & milestones”. Independent of your clans.'
            : 'None of your webhooks takes “Levels & milestones” yet — these apply once one does.'}
        </p>
        <LevelRulesEditor value={rules} onChange={setRules} disabled={busy} />
        <div>
          <button
            type="button"
            onClick={() => onSave(rules)}
            disabled={busy || !dirty}
            className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </details>
  );
}

/** Show a webhook without its secret token — the id segment is enough to tell two apart. */
function maskUrl(url: string): string {
  const m = /webhooks\/(\d+)\//.exec(url);
  return m ? `Discord webhook …${m[1].slice(-4)}` : 'Discord webhook';
}

const CA_OPTIONS = [
  ...CA_TIERS.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() })),
  { value: 'OFF', label: 'Off' },
];
const QUEST_OPTIONS = [
  { value: 'ALL', label: 'All' },
  ...QUEST_TIERS.filter((t) => t !== 'ALL').map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() })),
  { value: 'OFF', label: 'Off' },
];

/** A whole-number field shown with thousands separators; commits on blur or Enter, not per keystroke. */
function CommitNumber({
  value,
  onCommit,
  min,
  disabled,
  ariaLabel,
}: {
  value: number;
  onCommit: (n: number) => void;
  /** Smallest value other than 0 (0 always means off). */
  min: number;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft === null) return;
    const digits = draft.replace(/[^0-9]/g, '');
    setDraft(null);
    let n = digits === '' ? 0 : Number(digits);
    if (n > 0 && n < min) n = min;
    if (n !== value) onCommit(n);
  }
  return (
    <Input
      value={draft ?? value.toLocaleString('en-US')}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      inputMode="numeric"
      disabled={disabled}
      aria-label={ariaLabel}
      className="w-36 shrink-0 text-right"
    />
  );
}

function PrefRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[12px] text-text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function PrefGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-4 w-1 bg-gold" aria-hidden />
        {title}
      </h3>
      {children}
    </div>
  );
}

/** "What your plugin posts" — the switches and floors that used to be RuneLite config items. */
export function PluginPostsPanel({ initial }: { initial: EmissionSettingsView }) {
  const { view, busy, error, patch } = useEmissions(initial);
  const p = view.notifyPrefs;
  const save = (change: Partial<NotifyPrefs>) => patch({ notifyPrefs: change });
  const toggle = (key: 'drops' | 'pets' | 'deaths' | 'pvp' | 'clog' | 'levels' | 'diaries', label: string, description?: string) => (
    <Checkbox checked={p[key]} onChange={(v) => save({ [key]: v })} disabled={busy} label={label} description={description} />
  );
  const [deathMsg, setDeathMsg] = useState<string | null>(null);
  function commitDeathMsg() {
    if (deathMsg === null) return;
    const next = deathMsg.trim();
    setDeathMsg(null);
    if (next !== p.deathMsg) save({ deathMsg: next || NOTIFY_DEFAULTS.deathMsg });
  }
  return (
    <div className="grid gap-6">
      <p className="max-w-[70ch] text-[12.5px] text-text-muted">
        Your clan&rsquo;s own channel switches still apply on top of these. Changes reach your plugin within about a minute.
      </p>
      <ErrorLine error={error} />

      <PrefGroup title="Drops & pets">
        {toggle('drops', 'Rare drops', 'Post valuable or very rare drops to the clan drops channel.')}
        <PrefRow title="Min drop value" hint="Post drops worth at least this, in gp (min 1,000,000; 0 = off).">
          <CommitNumber value={p.dropMin} min={1_000_000} disabled={busy} ariaLabel="Min drop value" onCommit={(n) => save({ dropMin: n })} />
        </PrefRow>
        <PrefRow title="Min drop rarity (1 in N)" hint="Also post drops rarer than 1 in N whatever their value (min 1000; 0 = off).">
          <CommitNumber value={p.rarity} min={1000} disabled={busy} ariaLabel="Min drop rarity" onCommit={(n) => save({ rarity: n })} />
        </PrefRow>
        <PrefRow title="Loot key value" hint="Post a loot key whose contents total at least this, in gp (0 = off).">
          <CommitNumber value={p.keyMin} min={1} disabled={busy} ariaLabel="Loot key value" onCommit={(n) => save({ keyMin: n })} />
        </PrefRow>
        {toggle('pets', 'Pets', 'Post to the clan drops channel when you get a pet.')}
      </PrefGroup>

      <PrefGroup title="Deaths & PvP">
        {toggle('deaths', 'Deaths', 'Post a screenshot to the clan deaths channel when you die.')}
        <PrefRow title="Death message" hint="Use {name} for your RSN.">
          <Input
            value={deathMsg ?? p.deathMsg}
            onChange={(e) => setDeathMsg(e.target.value)}
            onBlur={commitDeathMsg}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            maxLength={200}
            disabled={busy}
            aria-label="Death message"
            className="w-full sm:w-72"
          />
        </PrefRow>
        {toggle('pvp', 'PvP kills', 'Post a screenshot to the clan PvP channel when you kill a player.')}
      </PrefGroup>

      <PrefGroup title="Achievements">
        {toggle('clog', 'Collection log slots', 'Post every new collection-log slot to the clan achievements channel.')}
        {toggle('levels', 'Level milestones', 'Post level milestones (your clan’s rules) to the clan and your own webhooks.')}
        {toggle('diaries', 'Diary completions')}
        <PrefRow title="Combat task tier" hint="Post combat tasks at or above this tier, plus tier clears; Off posts none.">
          <Select
            value={p.ca}
            onChange={(v) => save({ ca: v as NotifyPrefs['ca'] })}
            options={CA_OPTIONS}
            disabled={busy}
            ariaLabel="Combat task tier"
            className="w-48 shrink-0"
          />
        </PrefRow>
        <PrefRow title="Quest tier" hint="Post quests at or above this difficulty; Off posts none.">
          <Select
            value={p.quests}
            onChange={(v) => save({ quests: v as NotifyPrefs['quests'] })}
            options={QUEST_OPTIONS}
            disabled={busy}
            ariaLabel="Quest tier"
            className="w-48 shrink-0"
          />
        </PrefRow>
      </PrefGroup>
    </div>
  );
}
