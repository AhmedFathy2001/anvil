'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import AnnounceKindsEditor from '@/components/AnnounceKindsEditor';
import LevelRulesEditor from '@/components/LevelRulesEditor';
import type { ClanKinds } from '@/lib/notifyKinds';
import { MODE_CHANNEL_INHERITS, MODE_EVENTS_CHANNEL } from '@/lib/worldModes';
import Select, { type SelectOption } from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { DISCORD_FEEDS, FEED_TABS, effectiveKey, type DiscordFeed, type FeedTab } from '@/lib/discordFeeds';
import { CREATOR_HIDDEN_FEEDS, CREATOR_HIDDEN_FEED_TABS } from '@/lib/creatorSpaces';
import { useRevealTarget } from '@/components/HashReveal';
import { DEFAULT_LEVEL_RULES, DEFAULT_XP_RULES, levelHalf, type LevelRules, type MilestoneRules } from '@/lib/levelRules';
import { MIN_MODE_DROP_FLOOR, MIN_MODE_DROP_VALUE } from '@/lib/modeFilters';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import { valuesEqual } from '@/lib/unsavedChanges';

interface ModeRow {
  key: string;
  label: string;
  /** False for a mode the site named itself the first time a member played it. */
  known: boolean;
  id: string;
  hookKey: string;
  off: boolean;
  /** Leagues was switched off on the old row: its channel stays unused until it's switched on. */
  ownChannelIgnored: boolean;
  kindsOff: string[];
  /** The event kinds this mode has, in its own words (not every mode's). */
  events: { id: string; label: string }[];
  /** The mode's own drop rarity (1 in N); null = the main-game setting. */
  dropFloor: number | null;
  /** The mode's own drop minimum value (gp); null = the main-game setting. */
  dropMinValue: number | null;
  /** A drop needs both bars (blank ones aren't asked for); false = either. */
  dropBoth: boolean;
  /** The mode's own level rules; null = no level-ups from this mode. */
  levels: LevelRules | null;
  /** Its own channel setting per kind of post (MODE_CHANNELS id → setting key). */
  channelKeys: Record<string, string>;
  /** Its own milestone kinds, screenshots, patterns and templates; null = the main game's. */
  kindDefaults: ClanKinds | null;
  /** Its own death lines, one per line; '' = the main game's. */
  funDeaths: string;
  deathTaunts: string;
}

interface ModeChannel {
  id: string;
  label: string;
  help: string;
  filters: DiscordFeed['filters'] | null;
}

interface View {
  modes: {
    split: boolean;
    kinds: { id: string; label: string; event: boolean }[];
    rows: ModeRow[];
    main: { kindDefaults: ClanKinds; funDeaths: string; deathTaunts: string };
    channels: ModeChannel[];
  };
  feeds: DiscordFeed[];
  catchAlls: { site: string; game: string };
  keys: Record<string, { set: boolean; channelId: string | null }>;
  off: string[];
  channels: { enabled: boolean; channels: { id: string; name: string; parentName: string | null }[] };
}

type Put = (tag: string, body: Record<string, unknown>) => Promise<boolean>;

/**
 * A mode's own thresholds: drop rarity and value (`part` 'drops') or level milestones ('levels').
 * Each may be looser or stricter than the main game (lib/modeFilters); blank drop fields follow
 * the main game.
 */
function ModeFilters({ mode, put, disabled, part }: { mode: ModeRow; put: Put; disabled: boolean; part: 'drops' | 'levels' }) {
  const shown = (n: number | null) => (n == null ? '' : n.toLocaleString('en-US'));
  const clean = (t: string) => t.trim().replace(/[,_\s]/g, '');
  const [floor, setFloor] = useState(shown(mode.dropFloor));
  const [value, setValue] = useState(shown(mode.dropMinValue));
  const [both, setBoth] = useState(mode.dropBoth);
  const [levels, setLevels] = useState<MilestoneRules>({ ...DEFAULT_LEVEL_RULES, ...DEFAULT_XP_RULES, ...(mode.levels ?? {}) });
  const tag = `${mode.id}:filters`;
  const dropsChanged =
    clean(floor) !== clean(shown(mode.dropFloor)) || clean(value) !== clean(shown(mode.dropMinValue)) || both !== mode.dropBoth;
  // Two independent Save buttons, so two guards. Drops compare against the server view (refreshed by put).
  const [savedLevels, setSavedLevels] = useState<MilestoneRules>(levels);
  const levelsDirty = mode.levels != null && !valuesEqual(levels, savedLevels);
  useUnsavedChanges(dropsChanged);
  useUnsavedChanges(levelsDirty);

  return (
    <div className="space-y-4">
      {part === 'drops' && (
      <>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Drop thresholds</div>
        <p className="text-[12px] text-text-muted">
          Give {mode.label} its own bar for drops. It can be looser or stricter than the main game: a fresh
          character&apos;s 1 in 128 is worth a post when a main&apos;s isn&apos;t.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor={`${tag}:floor`} className="text-[13px] font-medium">
            Post drops rarer than 1 in…
          </label>
          <Input
            id={`${tag}:floor`}
            inputMode="numeric"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="Main game"
            disabled={disabled}
          />
          <p className="text-[11.5px] text-text-muted">At least 1 in {MIN_MODE_DROP_FLOOR}, so coin-flip drops never post.</p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${tag}:value`} className="text-[13px] font-medium">
            Post drops worth at least (gp)
          </label>
          <Input
            id={`${tag}:value`}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Main game"
            disabled={disabled}
          />
          <p className="text-[11.5px] text-text-muted">
            At least {MIN_MODE_DROP_VALUE.toLocaleString('en-US')} gp, so bones and rune piles stay out of the channel.
          </p>
        </div>
      </div>
      <Checkbox
        checked={both}
        disabled={disabled}
        onChange={setBoth}
        label="Drops need both bars"
        description={`Off = a drop posts if it clears either bar. On = it must clear both, the rarity and the value (a bar left blank isn't asked for).`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || !dropsChanged}
          onClick={() =>
            void put(mode.id, { mode: mode.key, dropFloor: clean(floor) || null, dropMinValue: clean(value) || null, dropBoth: both })
          }
          className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50"
        >
          Save drop thresholds
        </button>
        <UnsavedIndicator dirty={dropsChanged} />
        <p className="text-[11.5px] text-text-muted">
          Blank = same as the main game. Always-post items post whatever the bars say.
        </p>
      </div>
      <p className="text-[11.5px] text-text-muted">
        The always-post list, guaranteed drops and the kill count line are shared with the main game (In-game tab, Rare
        drops filters).
      </p>
      </>
      )}

      {part === 'levels' && (
      <div className="grid gap-3">
        <Checkbox
          checked={mode.levels != null}
          disabled={disabled}
          onChange={(on) =>
            void put(mode.id, { mode: mode.key, levels: on ? levelHalf(levels) : null }).then((ok) => {
              // Switching on saves the milestones as edited, so that is the new baseline.
              if (ok && on) setSavedLevels(levels);
            })
          }
          label={`Post level-ups from ${mode.label}`}
          description={`Off = none: ${mode.label} is a separate character, so its levels never post by default. On = the milestones below, instead of the main game's. Members who turned level posts off stay off.`}
        />
        {mode.levels != null && (
          <>
            <LevelRulesEditor value={levels} onChange={setLevels} disabled={disabled} levelsOnly />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  void put(mode.id, { mode: mode.key, levels: levelHalf(levels) }).then((ok) => {
                    if (ok) setSavedLevels(levels);
                  })
                }
                className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50"
              >
                Save level milestones
              </button>
              <UnsavedIndicator dirty={levelsDirty} />
            </div>
          </>
        )}
        <p className="text-[11.5px] text-text-muted">
          XP milestones are read off the main game&apos;s hiscores, so they only ever post for the main game.
        </p>
      </div>
      )}
    </div>
  );
}

/** A mode's own death lines. Blank = the main game's, which the placeholder shows. */
function ModeDeathLines({ mode, main, put, disabled }: { mode: ModeRow; main: View['modes']['main']; put: Put; disabled: boolean }) {
  const [fun, setFun] = useState(mode.funDeaths);
  const [taunts, setTaunts] = useState(mode.deathTaunts);
  const dirty = fun.trim() !== mode.funDeaths.trim() || taunts.trim() !== mode.deathTaunts.trim();
  useUnsavedChanges(dirty);
  const tag = `${mode.id}:deaths`;
  const firstLines = (text: string, fallback: string) => {
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    return lines.length ? `Main game's:\n${lines.slice(0, 4).join('\n')}` : fallback;
  };
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Death lines</div>
        <p className="text-[12px] text-text-muted">
          {mode.label}&apos;s own death lines. A blank box uses the main game&apos;s.
        </p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${tag}:fun`} className="text-[13px] font-medium">
          Death one-liners (1 in 100 chance)
        </label>
        <Textarea
          id={`${tag}:fun`}
          rows={4}
          value={fun}
          onChange={(e) => setFun(e.target.value)}
          placeholder={firstLines(main.funDeaths, "Anvil's one-liners")}
          disabled={disabled}
          className="font-mono"
        />
        <p className="text-[11.5px] text-text-muted">Replaces the whole death message on a rare roll. Use {'{name}'} for the player. One per line.</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${tag}:taunts`} className="text-[13px] font-medium">
          Death reaction lines
        </label>
        <Textarea
          id={`${tag}:taunts`}
          rows={4}
          value={taunts}
          onChange={(e) => setTaunts(e.target.value)}
          placeholder={firstLines(main.deathTaunts, "Anvil's reaction lines")}
          disabled={disabled}
          className="font-mono"
        />
        <p className="text-[11.5px] text-text-muted">Added to every death post when a member has “Funny lines” on in the plugin. One per line.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || !dirty}
          onClick={() => void put(mode.id, { mode: mode.key, funDeaths: fun, deathTaunts: taunts })}
          className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50"
        >
          Save death lines
        </button>
        <UnsavedIndicator dirty={dirty} />
      </div>
    </div>
  );
}

/**
 * A mode's milestone kinds, screenshots, chat patterns and message templates: the same editor as
 * the main game's Milestones filters. Until saved, it shows (and the mode follows) the main game's.
 */
function ModeKinds({ mode, main, put, disabled }: { mode: ModeRow; main: ClanKinds; put: Put; disabled: boolean }) {
  const own = mode.kindDefaults != null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-text-muted">
          {own
            ? `${mode.label} has its own milestone settings, screenshots and message templates.`
            : `${mode.label} follows the main game's milestone settings, screenshots and message templates. Saving here gives it its own.`}
        </p>
        {own && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void put(mode.id, { mode: mode.key, kindDefaults: null })}
            className="rounded-lg border border-card-border px-3 py-1 text-[12px] hover:border-gold/50 disabled:opacity-50"
          >
            Follow the main game again
          </button>
        )}
      </div>
      <AnnounceKindsEditor
        key={JSON.stringify(mode.kindDefaults ?? main)}
        mode="clan"
        value={mode.kindDefaults ?? main}
        busy={disabled}
        onSave={(v) => void put(mode.id, { mode: mode.key, kindDefaults: v })}
      />
    </div>
  );
}

/** "Copy from main game": the in-game tab's filters into this mode, channels only when ticked. */
function ModeCopyFromMain({ mode, put, disabled }: { mode: ModeRow; put: Put; disabled: boolean }) {
  const [channels, setChannels] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-card-border bg-brown-dark px-4 py-3">
      <div className="min-w-0 flex-[1_1_260px]">
        <div className="text-[13px] font-medium">Copy from main game</div>
        <p className="text-[12px] text-text-muted">
          Start {mode.label} from your In-game settings: which posts are on, drop thresholds, level milestones, death lines,
          milestone kinds, screenshots and message templates. {mode.label}&apos;s own events keep their switches.
        </p>
      </div>
      <Checkbox
        checked={channels}
        disabled={disabled}
        onChange={setChannels}
        label="Also copy channels"
        description="Each kind then posts where the same main-game post does."
      />
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-muted">Replace {mode.label}&apos;s settings?</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              void put(mode.id, { mode: mode.key, copyFromMain: true, channels }).then((ok) => {
                if (ok) setConfirming(false);
              })
            }
            className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50"
          >
            Copy
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="px-2 text-[13px] text-text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-card-border px-3.5 py-1.5 text-[13px] hover:border-gold/50 disabled:opacity-50"
        >
          Copy from main game
        </button>
      )}
    </div>
  );
}

const PASTE = '__paste__';
const FALLBACK = '__fallback__';

/**
 * Admin → Discord, "What goes where": every kind of post, on or off, and the channel it lands in —
 * its own, or the one it falls back to, said out loud instead of left to guess. `filters` renders
 * a feed's own settings (drop floors, level rules, death lines) under its row.
 */
export default function DiscordFeedsPanel({
  filters,
  creator = false,
}: {
  filters?: Partial<Record<NonNullable<DiscordFeed['filters']>, ReactNode>>;
  /** A creator space: no weekly, calendar, roster, coffer or co-host rows, and no Game modes tab (lib/creatorSpaces). */
  creator?: boolean;
}) {
  const [rawView, setView] = useState<View | null>(null);
  const view = useMemo(
    () => (rawView && creator ? { ...rawView, feeds: rawView.feeds.filter((f) => !CREATOR_HIDDEN_FEEDS.includes(f.id)) } : rawView),
    [rawView, creator],
  );
  const feedTabs = creator
    ? FEED_TABS.filter((t) => !CREATOR_HIDDEN_FEED_TABS.includes(t.id)).map((t) =>
        t.id === 'clan' ? { ...t, label: 'Events', blurb: 'What the site posts about your events.' }
        : t.id === 'game' ? { ...t, blurb: 'What players do in game, sent by the Anvil plugin.' }
        : t,
      )
    : FEED_TABS;
  const [tab, setTab] = useState<FeedTab>('clan');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  // One open filters panel inside an open game mode (`<mode id>:<kind>`).
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [wantMode, setWantMode] = useState<string | null>(null);
  // A pasted webhook URL is an unsaved draft until its Save lands; Cancel closes the row and clears the flag.
  const pasteDirty = !!pasting && pasted.trim() !== '';
  useUnsavedChanges(pasteDirty);

  // Deep links (the settings search, other pages): #discord-feeds-<tab> opens that tab,
  // #discord-feed-<id> the tab holding that row, #discord-feed-<id>-filters its filters too, and
  // #discord-mode-<key> a game mode's row with its posts and filters. HashReveal then rings it.
  useRevealTarget((id) => {
    const tabId = /^discord-feeds-(\w+)$/.exec(id)?.[1];
    if (tabId && feedTabs.some((t) => t.id === tabId)) {
      setTab(tabId as FeedTab);
      return;
    }
    const row = /^discord-feed-(\w+?)(-filters)?$/.exec(id);
    if (row) {
      const feed = DISCORD_FEEDS.find((f) => f.id === row[1]);
      if (feed && feedTabs.some((t) => t.id === feed.tab)) {
        setTab(feed.tab);
        if (row[2]) setOpen(feed.id);
      }
      return;
    }
    const mode = /^discord-mode-(.+)$/.exec(id)?.[1];
    if (mode && feedTabs.some((t) => t.id === 'modes')) {
      setTab('modes');
      setWantMode(mode);
    }
  });
  // A mode's row is keyed by its own id, known only once the view has loaded.
  useEffect(() => {
    const row = wantMode ? rawView?.modes.rows.find((m) => m.key === wantMode) : null;
    if (!row) return;
    setOpen(row.id);
    setWantMode(null);
  }, [wantMode, rawView]);

  const load = useCallback(async () => {
    const res = await clanFetch('/api/admin/discord/feeds');
    const data = await res.json().catch(() => ({}));
    if (res.ok) setView(data);
    else setError(data.error ?? 'Could not load your channels.');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function put(tag: string, body: Record<string, unknown>) {
    setBusy(tag);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/discord/feeds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setView(data);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const channelName = useCallback(
    (id: string | null) => {
      if (!id) return null;
      const c = view?.channels.channels.find((x) => x.id === id);
      return c ? `#${c.name}` : 'a channel';
    },
    [view],
  );

  /** "#drops", or "a pasted webhook", or null when the setting is blank. */
  const keyLabel = useCallback(
    (key: string) => {
      const k = view?.keys[key];
      if (!k?.set) return null;
      return channelName(k.channelId) ?? 'a pasted webhook';
    },
    [view, channelName],
  );

  const serverOptions: SelectOption[] = useMemo(
    () =>
      (view?.channels.channels ?? []).map((c) => ({
        value: c.id,
        label: `#${c.name}`,
        keywords: c.parentName ? [c.parentName.toLowerCase()] : undefined,
      })),
    [view],
  );

  if (!view) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;

  const isSet = (key: string) => !!view.keys[key]?.set;
  const off = new Set(view.off);
  const catchAllKey = tab === 'game' ? view.catchAlls.game : view.catchAlls.site;
  const rows = view.feeds.filter((f) => f.tab === tab);
  const tabInfo = feedTabs.find((t) => t.id === tab)!;
  const modeHookKeys = new Set(view.modes.rows.flatMap((m) => [m.hookKey, ...Object.values(m.channelKeys)]));

  /** The Select for one setting: its channel, the fallback, any server channel, or paste. */
  // A render helper, not a component: a component declared in here would remount (and close) on every render.
  function channelPicker(settingKey: string, fallbackLabel: string, ariaLabel: string) {
    const k = view!.keys[settingKey];
    const value = k?.set ? (k.channelId && view!.channels.channels.some((c) => c.id === k.channelId) ? k.channelId : PASTE) : FALLBACK;
    const options: SelectOption[] = [
      { value: FALLBACK, label: fallbackLabel },
      ...serverOptions,
      { value: PASTE, label: k?.set && value === PASTE ? 'A pasted webhook' : 'Paste a webhook…' },
    ];
    return (
      <Select
        className="w-60"
        value={value}
        options={options}
        ariaLabel={ariaLabel}
        disabled={busy !== null}
        searchable
        onChange={(v) => {
          if (v === FALLBACK) void put(settingKey, { key: settingKey, clear: true });
          else if (v === PASTE) setPasting(settingKey);
          else void put(settingKey, { key: settingKey, channelId: v });
        }}
      />
    );
  }

  /** The inline "paste a webhook" row under whichever row asked for it. */
  function pasteRow(settingKey: string, label: string) {
    if (pasting !== settingKey) return null;
    return (
      <div className="flex flex-wrap gap-2 px-5 pb-3.5">
        <Input
          type="url"
          className="flex-1"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          aria-label={`${label} webhook URL`}
        />
        <button
          type="button"
          disabled={busy !== null || !pasted.trim()}
          onClick={() =>
            void put(settingKey, { key: settingKey, webhookUrl: pasted.trim() }).then((ok) => {
              if (ok) {
                setPasting(null);
                setPasted('');
              }
            })
          }
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
        >
          Save
        </button>
        <UnsavedIndicator dirty={pasteDirty} />
        <button type="button" onClick={() => setPasting(null)} className="px-3 text-sm text-text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    );
  }

  /**
   * One mode's posts, laid out like the In-game tab: each kind on or off, its own channel (falling
   * back to the mode's channel, then the kind it inherits from, then the normal channel), and the
   * same filters the main game has, stored for this mode.
   */
  function modeChannelRows(m: ModeRow, ownSet: boolean) {
    const { split, channels, main } = view!.modes;
    const disabled = busy !== null;
    const toggleKind = (id: string, on: boolean) =>
      void put(m.id, { mode: m.key, kindsOff: on ? m.kindsOff.filter((x) => x !== id) : [...m.kindsOff, id] });
    return channels
      .filter((c) => c.id !== MODE_EVENTS_CHANNEL || m.events.length > 0)
      .map((c) => {
        const isEvents = c.id === MODE_EVENTS_CHANNEL;
        const key = m.channelKeys[c.id];
        const on = isEvents ? m.events.some((e) => !m.kindsOff.includes(e.id)) : !m.kindsOff.includes(c.id);
        const inheritedKey = MODE_CHANNEL_INHERITS[c.id] ? m.channelKeys[MODE_CHANNEL_INHERITS[c.id]] : undefined;
        // Where the same post goes on the main game (mode events land with combat achievements there).
        const normalFeed = view!.feeds.find((f) => f.id === (isEvents ? 'combatAchievements' : c.id));
        const normalKey = normalFeed && !off.has(normalFeed.id) ? effectiveKey(normalFeed, isSet) : null;
        const modeFallback = split ? (ownSet ? m.hookKey : inheritedKey && isSet(inheritedKey) ? inheritedKey : null) : null;
        const fallbackLabel = modeFallback ? `Same as ${keyLabel(modeFallback)}` : 'The normal channel';
        const target = split && isSet(key) ? key : modeFallback ?? normalKey;
        const where = m.off ? 'Mode is off' : !on ? 'Off' : target ? `Posts to ${keyLabel(target)}` : 'Posts nowhere';
        const subId = `${m.id}:${c.id}`;
        const filterBody =
          isEvents ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {m.events.map((e) => (
                <Checkbox
                  key={e.id}
                  checked={!m.kindsOff.includes(e.id)}
                  disabled={disabled}
                  onChange={(v) => toggleKind(e.id, v)}
                  label={e.label}
                />
              ))}
            </div>
          ) : c.filters === 'drops' ? (
            <ModeFilters key={`${m.dropFloor}:${m.dropMinValue}:${m.dropBoth}`} mode={m} put={put} disabled={disabled} part="drops" />
          ) : c.filters === 'levels' ? (
            <ModeFilters key={JSON.stringify(m.levels)} mode={m} put={put} disabled={disabled} part="levels" />
          ) : c.filters === 'deaths' && filters?.deaths ? (
            <ModeDeathLines key={`${m.funDeaths}\u0001${m.deathTaunts}`} mode={m} main={main} put={put} disabled={disabled} />
          ) : c.filters === 'milestones' ? (
            <ModeKinds mode={m} main={main.kindDefaults} put={put} disabled={disabled} />
          ) : null;
        return (
          <li key={c.id} className="border-b border-card-border-soft last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
              <div className="min-w-0 flex-[1_1_240px]">
                {isEvents ? (
                  <div>
                    <div className="text-sm font-medium">{c.label}</div>
                    <div className="text-xs text-text-muted">{c.help} Switch each one under Events.</div>
                  </div>
                ) : (
                  <Checkbox checked={on} disabled={disabled} onChange={(v) => toggleKind(c.id, v)} label={c.label} description={c.help} />
                )}
              </div>
              <div className={`flex items-center gap-2 text-[12px] text-text-muted ${split ? '' : 'opacity-50'}`}>
                To
                {channelPicker(key, fallbackLabel, `${m.label} ${c.label} channel`)}
              </div>
              <div className="w-40 text-[12px] text-text-muted">{busy === key ? 'Saving…' : where}</div>
              {filterBody && (
                <button
                  type="button"
                  aria-expanded={openSub === subId}
                  onClick={() => setOpenSub(openSub === subId ? null : subId)}
                  className="min-h-9 rounded-lg border border-card-border px-3 text-[13px] hover:border-gold/50"
                >
                  {isEvents ? 'Events' : 'Filters'} {openSub === subId ? '▴' : '▾'}
                </button>
              )}
            </div>
            {pasteRow(key, `${m.label} ${c.label}`)}
            {openSub === subId && filterBody && (
              <div className="space-y-4 border-t border-card-border-soft bg-brown-light px-4 py-4">{filterBody}</div>
            )}
          </li>
        );
      });
  }

  /** The Game modes tab: one row per mode, each with its own channel and the kinds it posts. */
  function modeList() {
    const { split, kinds, rows: modes } = view!.modes;
    return (
      <ul className="rounded-xl border border-card-border bg-card-bg">
        {modes.map((m) => {
          const ownSet = isSet(m.hookKey) && !m.ownChannelIgnored;
          // Only this mode's kinds: the usual posts plus the events it actually has.
          const mine = [...kinds.filter((k) => !k.event), ...m.events.map((e) => ({ ...e, event: true }))];
          const posting = mine.filter((k) => !m.kindsOff.includes(k.id)).length;
          const where = m.off
            ? 'Off'
            : posting === 0
              ? 'Every kind is off'
              : split && ownSet
                ? `Posts to ${keyLabel(m.hookKey)}`
                : split && Object.values(m.channelKeys).some(isSet)
                  ? 'Posts to its own channels'
                  : 'Posts to the normal channels';
          return (
            <li key={m.key} id={`discord-mode-${m.key}`} className="scroll-mt-24 border-b border-card-border-soft last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
                <div className="min-w-0 flex-[1_1_280px]">
                  <Checkbox
                    checked={!m.off}
                    disabled={busy !== null}
                    onChange={(on) => void put(m.id, { mode: m.key, off: !on })}
                    label={m.known ? m.label : `${m.label} (new)`}
                    description={
                      m.known
                        ? `Posts from ${m.label} worlds.`
                        : `A mode your members started playing that Anvil hadn't seen before. Posts from it are labelled "${m.label}".`
                    }
                  />
                </div>
                <div className={`flex items-center gap-2 text-[12px] text-text-muted ${split ? '' : 'opacity-50'}`}>
                  To
                  {channelPicker(m.hookKey, 'The normal channels', `${m.label} channel`)}
                </div>
                <div className="w-40 text-[12px] text-text-muted">{busy === m.id || busy === m.hookKey ? 'Saving…' : where}</div>
                <button
                  type="button"
                  aria-expanded={open === m.id}
                  onClick={() => setOpen(open === m.id ? null : m.id)}
                  className="min-h-9 rounded-lg border border-card-border px-3 text-[13px] hover:border-gold/50"
                >
                  Posts {posting}/{mine.length}
                  {m.dropFloor != null || m.dropMinValue != null || m.levels != null || m.kindDefaults != null ? ' · own filters' : ''} {open === m.id ? '▴' : '▾'}
                </button>
              </div>
              {pasteRow(m.hookKey, m.label)}
              {open === m.id && (
                <div className="space-y-4 border-t border-card-border-soft bg-brown-light px-5 py-4">
                  <ModeCopyFromMain mode={m} put={put} disabled={busy !== null} />
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Posts and channels</div>
                    <p className="mb-2 text-[12px] text-text-muted">
                      Like the In-game tab, for {m.label} only. A kind with no channel of its own goes to {m.label}&apos;s channel
                      above, and with none set there to the normal channel for it.
                    </p>
                    <ul className="rounded-lg border border-card-border bg-card-bg">
                      {modeChannelRows(m, ownSet)}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {tab === 'modes' ? (
        <div className="rounded-xl border border-card-border bg-brown-dark p-4">
          <Checkbox
            checked={view.modes.split}
            disabled={busy !== null}
            onChange={(on) => void put('modesSplit', { modesSplit: on })}
            label="Send game-mode posts to their own channels"
            description="On: each mode below posts to the channel you pick for it (or the normal channels if you pick none). Off: every mode posts to the normal channels, still labelled."
          />
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-brown-dark p-4">
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="text-[14px] font-semibold">{tab === 'game' ? 'In-game catch-all' : 'Catch-all channel'}</div>
          <div className="text-[12px] text-text-muted">
            {tab === 'game'
              ? 'Every in-game post without a channel of its own goes here.'
              : 'Every clan and event post without a channel of its own goes here.'}
          </div>
        </div>
        {channelPicker(catchAllKey, 'Nowhere (not set)', 'Catch-all channel')}
      </div>
      )}

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-card-border">
        {feedTabs.map((t) => {
          const list = view.feeds.filter((f) => f.tab === t.id);
          const total = t.id === 'modes' ? view.modes.rows.length : list.length;
          const live =
            t.id === 'modes'
              ? view.modes.rows.filter((m) => !m.off && m.kindsOff.length < view.modes.kinds.length).length
              : list.filter((f) => !off.has(f.id) && effectiveKey(f, isSet)).length;
          return (
            <button
              key={t.id}
              id={`discord-feeds-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-h-11 px-4 text-sm font-medium ${tab === t.id ? 'text-gold' : 'text-text-muted hover:text-foreground'}`}
            >
              {t.label} <span className="font-normal text-text-muted">· {live}/{total} posting</span>
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-text-muted">{tabInfo.blurb}</p>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}

      {tab === 'modes' ? modeList() : (
      <ul className="rounded-xl border border-card-border bg-card-bg">
        {rows.map((f) => {
          const eff = effectiveKey(f, isSet);
          const isOff = off.has(f.id);
          const firstFallback = f.fallback.find(isSet);
          const fallbackLabel = f.fallback.length === 0 ? 'Nowhere (off)' : firstFallback ? `Same as ${keyLabel(firstFallback)}` : 'Nowhere yet (set the catch-all)';
          const where = isOff ? 'Off' : eff ? `Posts to ${keyLabel(eff)}` : 'Posts nowhere';
          return (
            <li key={f.id} id={`discord-feed-${f.id}`} className="scroll-mt-24 border-b border-card-border-soft last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
                <div className="min-w-0 flex-[1_1_280px]">
                  {f.off === 'perPost' ? (
                    <div>
                      <div className="text-sm font-medium">{f.label}</div>
                      <div className="text-xs text-text-muted">{f.help}</div>
                    </div>
                  ) : (
                    <Checkbox
                      checked={!isOff}
                      disabled={busy !== null}
                      onChange={(on) => void put(f.id, { feed: f.id, off: !on })}
                      label={f.label}
                      description={f.help}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-text-muted">
                  To
                  {channelPicker(f.key, fallbackLabel, `${f.label} channel`)}
                </div>
                <div className="w-40 text-[12px] text-text-muted">{busy === f.id || busy === f.key ? 'Saving…' : where}</div>
                {f.filters && filters?.[f.filters] && (
                  <button
                    type="button"
                    aria-expanded={open === f.id}
                    onClick={() => setOpen(open === f.id ? null : f.id)}
                    className="min-h-9 rounded-lg border border-card-border px-3 text-[13px] hover:border-gold/50"
                  >
                    Filters {open === f.id ? '▴' : '▾'}
                  </button>
                )}
              </div>
              {pasteRow(f.key, f.label)}
              {open === f.id && f.filters && (
                <div id={`discord-feed-${f.id}-filters`} className="scroll-mt-24 space-y-4 border-t border-card-border-soft bg-brown-light px-5 py-4">{filters?.[f.filters]}</div>
              )}
            </li>
          );
        })}
      </ul>
      )}
      {pasting && !rows.some((f) => f.key === pasting) && !modeHookKeys.has(pasting) && (
        <div className="flex flex-wrap gap-2">
          <Input type="url" className="flex-1" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="https://discord.com/api/webhooks/…" aria-label="Catch-all webhook URL" />
          <button
            type="button"
            disabled={busy !== null || !pasted.trim()}
            onClick={() =>
              void put(pasting, { key: pasting, webhookUrl: pasted.trim() }).then((ok) => {
                if (ok) {
                  setPasting(null);
                  setPasted('');
                }
              })
            }
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
          >
            Save
          </button>
          <UnsavedIndicator dirty={pasteDirty} />
        </div>
      )}
    </div>
  );
}
