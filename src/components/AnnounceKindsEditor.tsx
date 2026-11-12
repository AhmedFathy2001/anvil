'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import Select from '@/components/Select';
import TemplatesEditor from '@/components/TemplatesEditor';
import {
  CLUE_TIERS,
  EXT_SOURCE_LIMITS,
  NO_CLAN_KINDS,
  NO_PERSONAL_KINDS,
  PATTERN_LIMITS,
  patternProblem,
  resolveKind,
  resolveShot,
  SHOT_KEYS,
  type ClanKinds,
  type KindSetting,
  type NewKind,
  type PersonalKinds,
  type ShotKind,
  type Source,
} from '@/lib/notifyKinds';

/**
 * The newer announcement kinds and per-kind screenshots (lib/notifyKinds), for a player on
 * /settings/announcements or a clan on its Discord page. A player sees what their clan's default gives
 * them until they change something; "Reset" goes back to it. A clan sets the default for its members
 * and never sees the private kinds: those are each player's own.
 */

const SHOT_LABELS: Record<ShotKind, string> = {
  drops: 'Rare drops',
  pets: 'Pets',
  deaths: 'Deaths',
  clog: 'Collection log',
  ca: 'Combat tasks',
  diaries: 'Achievement diaries',
  levels: 'Levels',
  pvp: 'Player kills',
  quests: 'Quests',
};

const KIND_TEXT: Record<NewKind, { title: string; hint: string }> = {
  slayer: { title: 'Slayer', hint: 'Post when you finish a Slayer task.' },
  clues: { title: 'Clue scrolls', hint: 'Post each clue scroll you complete.' },
  speedruns: { title: 'Speedruns', hint: 'Post boss, raid and minigame times.' },
  kc: { title: 'Kill count', hint: 'Post kill count milestones.' },
  ba: { title: 'BA gambles', hint: 'Post Barbarian Assault gamble milestones.' },
  custom: { title: 'Custom chat messages', hint: 'Post game messages that match your own patterns.' },
  ge: { title: 'Grand Exchange', hint: 'Post finished buy and sell offers. Only to your own webhooks.' },
  trade: { title: 'Player trades', hint: 'Post what you gave and got in a trade. Only to your own webhooks.' },
  storage: { title: 'Group storage', hint: 'Post what you put in or took out of your group storage. Only to your own webhooks.' },
  ext: { title: 'Other plugins', hint: 'Let other RuneLite plugins you name post through Anvil. Only to your own webhooks.' },
};

const SHARED_KINDS: NewKind[] = ['slayer', 'clues', 'speedruns', 'kc', 'ba', 'custom'];
const PRIVATE: NewKind[] = ['ge', 'trade', 'storage', 'ext'];
const TIER_OPTIONS = CLUE_TIERS.map((t) => ({ value: t, label: `${t[0].toUpperCase()}${t.slice(1)} and up` }));

type Value = PersonalKinds | ClanKinds;

export default function AnnounceKindsEditor({
  mode,
  value,
  inherited = NO_CLAN_KINDS,
  busy,
  onSave,
}: {
  mode: 'personal' | 'clan';
  /** What is stored: absent = inherit. */
  value: Value;
  /** A player's clan default (none = Anvil's). */
  inherited?: ClanKinds;
  busy: boolean;
  onSave: (next: Value) => void;
}) {
  const personal: PersonalKinds = mode === 'personal' ? (value as PersonalKinds) : NO_PERSONAL_KINDS;
  const clan: ClanKinds = mode === 'personal' ? inherited : (value as ClanKinds);
  const hasClan = mode === 'personal' && (Object.keys(inherited.kinds).length > 0 || Object.keys(inherited.shots).length > 0 || inherited.patterns.length > 0 || Object.keys(inherited.templates ?? {}).length > 0);
  const own = (s: Source) => (mode === 'personal' ? s === 'custom' : s === 'clan');
  const status = (custom: boolean) => (custom ? 'Custom' : mode === 'clan' ? "Using Anvil's default" : hasClan ? 'Using clan default' : "Using Anvil's default");
  const resetLabel = mode === 'personal' && hasClan ? 'Reset to clan default' : "Reset to Anvil's default";

  const setKind = (kind: NewKind, change: Partial<KindSetting> | null) => {
    const kinds = { ...value.kinds } as Record<string, KindSetting>;
    if (change === null) delete kinds[kind];
    else kinds[kind] = { ...({ on: null, shot: null } as KindSetting), ...kinds[kind], ...change };
    onSave({ ...value, kinds } as Value);
  };
  const setShot = (k: ShotKind, v: boolean | null) => {
    const shots = { ...value.shots };
    if (v === null) delete shots[k];
    else shots[k] = v;
    onSave({ ...value, shots } as Value);
  };

  const kindBlock = (kind: NewKind) => {
    const r = resolveKind(kind, personal, clan);
    const custom = Object.values(r.sources).some(own) && kind in value.kinds;
    const t = KIND_TEXT[kind];
    return (
      <div className="grid gap-2 rounded-lg border border-card-border bg-card-bg/60 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Checkbox checked={r.on} onChange={(v) => setKind(kind, { on: v })} disabled={busy} label={t.title} description={t.hint} />
          <span className="flex items-center gap-2 text-[11.5px] text-text-muted">
            {status(custom)}
            {custom && (
              <button type="button" disabled={busy} onClick={() => setKind(kind, null)} className="text-gold hover:underline disabled:opacity-50">
                {resetLabel}
              </button>
            )}
          </span>
        </div>
        {r.on && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-7 text-[12.5px]">
            <Checkbox checked={r.shot} onChange={(v) => setKind(kind, { shot: v })} disabled={busy} label="Attach a screenshot" labelClassName="text-xs" />
            {(kind === 'kc' || kind === 'ba' || kind === 'slayer') && (
              <label className="flex items-center gap-2 text-xs text-text-muted">
                {kind === 'slayer' ? 'Every Nth task' : kind === 'kc' ? 'Every N kills' : 'Every N gambles'}
                <NumberBox value={r.every} min={1} disabled={busy} ariaLabel={`${t.title}: every N`} onCommit={(n) => setKind(kind, { every: n })} />
              </label>
            )}
            {kind === 'clues' && (
              <Select value={r.tier} onChange={(v) => setKind(kind, { tier: v as KindSetting['tier'] })} options={TIER_OPTIONS} disabled={busy} ariaLabel="Lowest clue tier" className="w-44" />
            )}
            {kind === 'speedruns' && (
              <Checkbox checked={r.pbOnly} onChange={(v) => setKind(kind, { pbOnly: v })} disabled={busy} label="Personal bests only" labelClassName="text-xs" />
            )}
            {kind === 'ge' && (
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Offers worth at least (gp)
                <NumberBox value={r.min} min={0} disabled={busy} ariaLabel="Grand Exchange minimum value" onCommit={(n) => setKind(kind, { min: n })} />
              </label>
            )}
          </div>
        )}
        {kind === 'custom' && r.on && (
          <TextList
            items={value.patterns}
            max={PATTERN_LIMITS.count}
            maxLength={PATTERN_LIMITS.max}
            placeholder="e.g. You have a funny feeling*"
            help={
              mode === 'clan'
                ? 'Matching game messages from any member post to your clan channel. * matches any text, # any number. Case is ignored.'
                : `Matching game messages post to your own webhooks${clan.patterns.length ? `; your clan's ${clan.patterns.length} pattern(s) also apply` : ''}. * matches any text, # any number. Case is ignored.`
            }
            problem={patternProblem}
            disabled={busy}
            onChange={(patterns) => onSave({ ...value, patterns } as Value)}
          />
        )}
        {kind === 'ext' && r.on && mode === 'personal' && (
          <TextList
            items={personal.extSources}
            max={EXT_SOURCE_LIMITS.count}
            maxLength={EXT_SOURCE_LIMITS.max}
            placeholder="Plugin name"
            help="Only these plugins can post, at most a few a minute. Plugin authors: send a PluginMessage with namespace anvil, name announce and data {source, text}."
            problem={(s) => (s.trim() ? null : 'Enter a name.')}
            disabled={busy}
            onChange={(extSources) => onSave({ ...personal, extSources })}
          />
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-6">
      <Group title="Screenshots" id="posts-screenshots">
        <p className="max-w-[70ch] text-[12.5px] text-text-muted">
          Whether each announcement carries a screenshot. Bingo proofs are always captured, whatever you choose here: they are your evidence.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SHOT_KEYS.map((k) => {
            const r = resolveShot(k, personal, clan);
            const custom = own(r.source);
            return (
              <div key={k} className="flex flex-wrap items-center justify-between gap-2">
                <Checkbox checked={r.shot} onChange={(v) => setShot(k, v)} disabled={busy} label={SHOT_LABELS[k]} labelClassName="text-sm" />
                <span className="flex items-center gap-2 text-[11px] text-text-muted">
                  {status(custom)}
                  {custom && (
                    <button type="button" disabled={busy} onClick={() => setShot(k, null)} className="text-gold hover:underline disabled:opacity-50">
                      Reset
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Group>
      <Group title="Message templates" id="posts-templates">
        <TemplatesEditor
          mode={mode}
          value={value.templates ?? {}}
          inherited={clan.templates ?? {}}
          hasClan={hasClan}
          busy={busy}
          onSave={(templates) => onSave({ ...value, templates } as Value)}
        />
      </Group>
      <Group title="More to announce" id="posts-more">
        <p className="max-w-[70ch] text-[12.5px] text-text-muted">
          {mode === 'clan'
            ? 'Defaults for your members. They post to your Milestones channel, and each member can still change their own.'
            : 'Off unless you or your clan turn them on. They post to your clan’s Milestones channel and to your own webhooks that take them.'}
        </p>
        {SHARED_KINDS.map((k) => (
          <div key={k}>{kindBlock(k)}</div>
        ))}
      </Group>
      {mode === 'personal' ? (
        <Group title="Private" id="posts-private">
          <p className="max-w-[70ch] text-[12.5px] text-text-muted">
            Only you can turn these on, and they only go to your own webhooks; your clan never sees them. Tick the kind on the webhook you want them in.
          </p>
          {PRIVATE.map((k) => (
            <div key={k}>{kindBlock(k)}</div>
          ))}
        </Group>
      ) : (
        <p className="text-[12.5px] text-text-muted">Grand Exchange offers, trades, group storage and other plugins&rsquo; posts are each member&rsquo;s own choice and never post to clan channels.</p>
      )}
    </div>
  );
}

function Group({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="grid scroll-mt-24 gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-4 w-1 bg-gold" aria-hidden />
        {title}
      </h3>
      {children}
    </div>
  );
}

function NumberBox({ value, min, disabled, ariaLabel, onCommit }: { value: number; min: number; disabled: boolean; ariaLabel: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft === null) return;
    const digits = draft.replace(/[^0-9]/g, '');
    setDraft(null);
    const n = Math.max(min, digits === '' ? min : Number(digits));
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
      className="w-28 px-2 py-1 text-right text-xs"
    />
  );
}

function TextList({
  items,
  max,
  maxLength,
  placeholder,
  help,
  problem,
  disabled,
  onChange,
}: {
  items: string[];
  max: number;
  maxLength: number;
  placeholder: string;
  help: string;
  problem: (s: string) => string | null;
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  function add() {
    const v = draft.trim();
    const why = problem(v) ?? (items.some((x) => x.toLowerCase() === v.toLowerCase()) ? 'Already added.' : null);
    if (why) return setErr(why);
    setErr(null);
    setDraft('');
    onChange([...items, v]);
  }
  return (
    <div className="grid gap-2 pl-7">
      <p className="text-[11.5px] text-text-muted">{help}</p>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((x) => (
            <li key={x} className="flex items-center gap-1.5 rounded-md border border-card-border px-2 py-0.5 text-xs">
              <code>{x}</code>
              <button type="button" disabled={disabled} onClick={() => onChange(items.filter((y) => y !== x))} aria-label={`Remove ${x}`} className="text-text-muted hover:text-red-400">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length < max ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={placeholder}
            className="w-full px-2 py-1 text-xs sm:w-72"
          />
          <button type="button" disabled={disabled || !draft.trim()} onClick={add} className="rounded-md border border-gold/40 px-2.5 py-1 text-xs text-gold hover:bg-gold/10 disabled:opacity-50">
            Add
          </button>
        </div>
      ) : (
        <p className="text-[11.5px] text-text-muted">That&rsquo;s the most ({max}).</p>
      )}
      {err && <p className="text-[11.5px] text-red-400">{err}</p>}
    </div>
  );
}
