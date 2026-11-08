'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Select from '@/components/Select';
import Input from '@/components/Input';
import LevelRulesEditor from '@/components/LevelRulesEditor';
import type { EmissionSettingsView, EmissionState } from '@/lib/emissionSettings';
import { CA_TIERS, QUEST_TIERS, NOTIFY_DEFAULTS, DROP_MINIMUMS, PLATFORM_DROP_DEFAULTS, type NotifyPrefs, type ShotHide } from '@/lib/notifyPrefs';
import type { LevelPostsChoice, MilestoneRules } from '@/lib/levelRules';
import { HOOK_KIND_LABELS } from '@/lib/webhookKinds';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import AnnounceKindsEditor from '@/components/AnnounceKindsEditor';
import type { PersonalKinds } from '@/lib/notifyKinds';

const KIND_LABELS: Record<string, string> = HOOK_KIND_LABELS;
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
  const [minValue, setMinValue] = useState('');
  const [minDropRarity, setMinDropRarity] = useState('');
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
        body: JSON.stringify({ url, kinds: [...kinds], minValue: minValue || null, minDropRarity: minDropRarity || null }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not add that.');
      else {
        setHooks((h) => [...h, data.webhook]);
        onChange({ ...view, webhooks: [...hooks, data.webhook] });
        setUrl('');
        setMinValue('');
        setMinDropRarity('');
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
        webhook from a channel&rsquo;s Integrations → Webhooks. Pick which kinds post to each one; a drop
        filter you leave blank follows your own drop settings.
      </p>

      {hooks.length > 0 && (
        <ul className="mb-3 grid gap-1.5">
          {hooks.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-card-border/60 bg-brown-dark/30 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[13px]">{h.label ?? maskUrl(h.url)}</span>
                <span className="block text-[11px] text-text-muted">
                  {h.kinds.map((k) => KIND_LABELS[k] ?? k).join(', ')}
                  {h.minValue != null ? ` · drops ≥ ${h.minValue.toLocaleString()} gp` : ''}
                  {h.minDropRarity != null ? ` · rarer than 1/${h.minDropRarity.toLocaleString()}` : ''}
                  {h.minDropMode ? ` · ${h.minDropMode === 'and' ? 'both' : 'either'}` : ''}
                </span>
                <HookFilters
                  hook={h}
                  onSaved={(next) => {
                    const list = hooks.map((x) => (x.id === h.id ? next : x));
                    setHooks(list);
                    onChange({ ...view, webhooks: list });
                  }}
                />
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
          <span className="text-[12px] text-text-muted">Drops worth at least</span>
          <Input
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            inputMode="numeric"
            placeholder="your setting"
            className="w-28 text-xs"
          />
          <span className="text-[12px] text-text-muted">gp, or rarer than 1 in</span>
          <Input
            value={minDropRarity}
            onChange={(e) => setMinDropRarity(e.target.value)}
            inputMode="numeric"
            placeholder="your setting"
            className="w-28 text-xs"
          />
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

/** One webhook's own drop filters. Blank = follow your drop settings above; saved on blur. */
function HookFilters({ hook, onSaved }: { hook: EmissionSettingsView['webhooks'][number]; onSaved: (h: EmissionSettingsView['webhooks'][number]) => void }) {
  const [value, setValue] = useState(hook.minValue != null ? String(hook.minValue) : '');
  const [rarity, setRarity] = useState(hook.minDropRarity != null ? String(hook.minDropRarity) : '');
  const [mode, setMode] = useState<'or' | 'and' | null>(hook.minDropMode);
  const [error, setError] = useState<string | null>(null);
  const clean = (v: string) => v.replace(/[^0-9]/g, '');
  async function save(nextMode: 'or' | 'and' | null = mode) {
    const next = nextMode;
    const minValue = clean(value) || null;
    const minDropRarity = clean(rarity) || null;
    if ((minValue ? Number(minValue) : null) === hook.minValue && (minDropRarity ? Number(minDropRarity) : null) === hook.minDropRarity && next === hook.minDropMode) return;
    const res = await fetch(`/api/profile/webhooks/${hook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minValue, minDropRarity, minDropMode: next }),
    });
    if (!res.ok) return setError('Could not save that.');
    setError(null);
    onSaved({ ...hook, minValue: minValue ? Number(minValue) : null, minDropRarity: minDropRarity ? Number(minDropRarity) : null, minDropMode: next });
  }
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
      Drops worth at least
      <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => save()} inputMode="numeric" placeholder="your setting" aria-label="Webhook min drop value" className="w-24 px-2 py-1 text-[11px]" />
      gp · rarer than 1 in
      <Input value={rarity} onChange={(e) => setRarity(e.target.value)} onBlur={() => save()} inputMode="numeric" placeholder="your setting" aria-label="Webhook min drop rarity" className="w-24 px-2 py-1 text-[11px]" />
      <Select
        value={mode ?? 'inherit'}
        onChange={(v) => {
          const m = v === 'and' || v === 'or' ? v : null;
          setMode(m);
          void save(m);
        }}
        options={[
          { value: 'inherit', label: 'Value or rarity: my setting' },
          { value: 'or', label: 'Value or rarity: either' },
          { value: 'and', label: 'Value and rarity: both' },
        ]}
        ariaLabel="Webhook value and rarity"
        className="w-52 shrink-0"
      />
      {error && <span className="text-red-400">{error}</span>}
    </span>
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
  useUnsavedChanges(dirty);
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSave(rules)}
            disabled={busy || !dirty}
            className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            Save
          </button>
          <UnsavedIndicator dirty={dirty} />
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

const formatGp = (n: number) => (n >= 1_000_000 && n % 1_000_000 === 0 ? `${n / 1_000_000}m` : n.toLocaleString('en-US'));

/**
 * A drop threshold that follows the clan's default until the person sets their own. Inheriting is stored
 * as null, so a later change to the clan default still reaches them; "Reset" goes back to it.
 */
function DropThresholdRow({
  title,
  hint,
  custom,
  defaults,
  fallback,
  format,
  min,
  disabled,
  ariaLabel,
  onCommit,
}: {
  title: string;
  hint: string;
  custom: number | null;
  defaults: { rsn: string; clanName: string | null; shown: number }[];
  fallback: number;
  format: (n: number) => string;
  min: number;
  disabled: boolean;
  ariaLabel: string;
  onCommit: (n: number | null) => void;
}) {
  const inGroups = defaults.filter((d) => d.clanName);
  const hasClan = inGroups.length > 0;
  const inherited = defaults[0]?.shown ?? fallback;
  const distinct = new Set(defaults.map((d) => d.shown)).size > 1;
  const resetLabel = hasClan ? 'Reset to clan default' : 'Reset to Anvil default';
  let status: string;
  if (custom != null) status = 'Custom';
  else if (!hasClan) status = `Using Anvil's default: ${format(inherited)}`;
  else if (distinct) status = `Using your clan's default: ${defaults.map((d) => `${d.rsn} ${format(d.shown)}`).join(' · ')}`;
  else status = `Using your clan's default: ${format(inherited)}`;
  return (
    <PrefRow title={title} hint={hint}>
      <div className="flex flex-col items-end gap-1">
        <CommitNumber value={custom ?? inherited} min={min} disabled={disabled} ariaLabel={ariaLabel} onCommit={onCommit} />
        <span className="flex items-center gap-2 text-[11.5px] text-text-muted">
          {status}
          {custom != null && (
            <button type="button" disabled={disabled} onClick={() => onCommit(null)} className="text-gold hover:underline disabled:opacity-50">
              {resetLabel}
            </button>
          )}
        </span>
      </div>
    </PrefRow>
  );
}

/**
 * "Post a drop when it's worth at least X or rarer than 1/Y", with a switch for "and". Follows the clan's
 * choice until the person picks; no clan means "or". Null = inherit, stored as absent.
 */
function DropModeRow({
  custom,
  defaults,
  value,
  rarity,
  disabled,
  onChange,
}: {
  custom: 'or' | 'and' | null;
  defaults: { rsn: string; clanName: string | null; value: number; rarity: number; mode: 'or' | 'and' }[];
  value: number | null;
  rarity: number | null;
  disabled: boolean;
  onChange: (m: 'or' | 'and' | null) => void;
}) {
  const hasClan = defaults.some((d) => d.clanName);
  const inherited = defaults[0]?.mode ?? PLATFORM_DROP_DEFAULTS.mode;
  const mode = custom ?? inherited;
  const v = value ?? defaults[0]?.value ?? PLATFORM_DROP_DEFAULTS.value;
  const r = rarity ?? defaults[0]?.rarity ?? PLATFORM_DROP_DEFAULTS.rarity;
  const gp = v <= 0 ? 'any value (off)' : `worth at least ${formatGp(v)}`;
  const rare = r <= 0 ? 'any rarity (off)' : `rarer than 1/${r.toLocaleString('en-US')}`;
  return (
    <PrefRow
      title="Value and rarity together"
      hint={`Post a drop when it's ${gp} ${mode === 'and' ? 'and' : 'or'} ${rare}.`}
    >
      <div className="flex flex-col items-end gap-1">
        <Checkbox
          checked={mode === 'and'}
          onChange={(on) => onChange(on ? 'and' : 'or')}
          disabled={disabled}
          label="Require both (and)"
          labelClassName="text-xs"
        />
        <span className="flex items-center gap-2 text-[11.5px] text-text-muted">
          {custom != null
            ? 'Custom'
            : hasClan
              ? `Using your clan's choice: ${inherited === 'and' ? 'both' : 'either'}`
              : "Using Anvil's choice: either"}
          {custom != null && (
            <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-gold hover:underline disabled:opacity-50">
              {hasClan ? 'Reset to clan default' : 'Reset to Anvil default'}
            </button>
          )}
        </span>
      </div>
    </PrefRow>
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

function PrefGroup({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  // `id` is a /settings search target (lib/memberSettingsIndex), so it scrolls clear of the header.
  return (
    <div id={id} className="grid scroll-mt-24 gap-4 rounded-lg">
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
  const hide = (key: keyof ShotHide, label: string, description?: string) => (
    <Checkbox
      checked={p.hide[key]}
      onChange={(v) => save({ hide: { ...p.hide, [key]: v } })}
      disabled={busy}
      label={label}
      description={description}
    />
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
        Your clan&rsquo;s own channel switches still apply on top of these. Changes reach your plugin within about a minute. To pause everything at once, untick <strong>Share clan posts</strong> in the Anvil plugin&rsquo;s RuneLite settings; your choices here stay as they are.
      </p>
      <ErrorLine error={error} />

      <PrefGroup title="Drops & pets" id="posts-drops">
        {toggle('drops', 'Rare drops', 'Post valuable or very rare drops to the clan drops channel.')}
        <DropThresholdRow
          title="Min drop value"
          hint="Post drops worth at least this, in gp (min 1,000,000; 0 = off)."
          custom={p.dropMin}
          defaults={view.dropDefaults.map((d) => ({ ...d, shown: d.value }))}
          fallback={PLATFORM_DROP_DEFAULTS.value}
          format={formatGp}
          min={DROP_MINIMUMS.value}
          disabled={busy}
          ariaLabel="Min drop value"
          onCommit={(n) => save({ dropMin: n })}
        />
        <DropThresholdRow
          title="Min drop rarity (1 in N)"
          hint="Also post drops rarer than 1 in N whatever their value (min 1000; 0 = off)."
          custom={p.rarity}
          defaults={view.dropDefaults.map((d) => ({ ...d, shown: d.rarity }))}
          fallback={PLATFORM_DROP_DEFAULTS.rarity}
          format={(n) => `1/${n.toLocaleString('en-US')}`}
          min={DROP_MINIMUMS.rarity}
          disabled={busy}
          ariaLabel="Min drop rarity"
          onCommit={(n) => save({ rarity: n })}
        />
        <DropModeRow
          custom={p.dropMode}
          defaults={view.dropDefaults}
          value={p.dropMin}
          rarity={p.rarity}
          disabled={busy}
          onChange={(m) => save({ dropMode: m })}
        />
        <PrefRow title="Loot key value" hint="Post a loot key whose contents total at least this, in gp (0 = off).">
          <CommitNumber value={p.keyMin} min={1} disabled={busy} ariaLabel="Loot key value" onCommit={(n) => save({ keyMin: n })} />
        </PrefRow>
        {toggle('pets', 'Pets', 'Post to the clan drops channel when you get a pet.')}
      </PrefGroup>

      <PrefGroup title="Deaths & PvP" id="posts-deaths">
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

      <PrefGroup title="Achievements" id="posts-achievements">
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

      <AnnounceKindsEditor mode="personal" value={p.announce} inherited={view.clanKinds} busy={busy} onSave={(a) => save({ announce: a as PersonalKinds })} />

      <PrefGroup title="Screenshot privacy" id="screenshot-privacy">
        <p className="max-w-[70ch] text-[12.5px] text-text-muted">
          Ticked chat is left out of every screenshot your plugin takes, bingo proofs and Discord posts alike. Game messages, broadcasts and Anvil&rsquo;s own lines always stay in.
        </p>
        {hide('pm', 'Private messages', 'Hide the split private-message box and “From / To” lines in the chatbox.')}
        {hide('public', 'Public chat', 'Hide what people around you say.')}
        {hide('clanOthers', 'Clan chat: others’ messages')}
        {hide('clanSelf', 'Clan chat: your own messages')}
        {hide('channel', 'Chat channel', 'Hide friends chat (the chat channel) lines.')}
        {hide('group', 'Group chat', 'Hide your group ironman channel.')}
      </PrefGroup>
    </div>
  );
}
