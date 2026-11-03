'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Select from '@/components/Select';
import { BRIEF_ITEMS, gp, MIN_VALUE_CHOICES, TONES, type BriefItem, type ChatFeedPrefs, type Tone } from '@/lib/chatFeedRules';
import { ANVIL_COLORS, canCustomColors, canShapeBrief } from '@/lib/chatLook';
import type { SupporterTierId } from '@/lib/supporterTiers';

type Prefs = ChatFeedPrefs & { tier?: SupporterTierId | null };

const TONE_LABELS: Record<Tone, string> = {
  done: 'Tile done',
  near: 'Progress and rank',
  drop: 'Drops and pets',
  feed: "Other teams' tiles",
  warn: 'Warnings and failures',
  info: 'Everything else',
};
const BRIEF_LABELS: Record<BriefItem, string> = {
  bingo: 'Your live bingo: team place, tiles nearly done',
  weekly: 'Live competitions: your place and the gap',
  tiles: 'Names of the tiles nearly done',
  clanEvents: 'Clan events today',
  goals: 'Your closest goal',
};

const CA_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'easy', label: 'Easy and up' },
  { value: 'medium', label: 'Medium and up' },
  { value: 'hard', label: 'Hard and up' },
  { value: 'elite', label: 'Elite and up' },
  { value: 'master', label: 'Master and up' },
  { value: 'grandmaster', label: 'Grandmaster only' },
];
const MAJOR_OPTIONS = (major: string) => [
  { value: 'major', label: major },
  { value: 'off', label: 'Off' },
];

/**
 * "In-game chat feed" — what other players' drops and achievements show in YOUR RuneLite chat
 * (lib/chatFeed). The plugin's own switch turns the whole feed on or off; this picks what is in it.
 */
export default function ChatFeedDrawer() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile/chat-feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrefs(d))
      .catch(() => setError('Could not load your chat feed settings.'));
  }, []);

  async function save(change: Partial<Prefs>) {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, ...change });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/chat-feed', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      });
      if (!res.ok) throw new Error();
      setPrefs(await res.json());
    } catch {
      setPrefs(before);
      setError('That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group mt-3 rounded-xl border border-card-border bg-card-bg">
      <summary className="flex cursor-pointer list-none select-none items-center gap-2.5 px-5 py-4 font-semibold">
        <span className="text-text-muted transition-transform group-open:rotate-90" aria-hidden>
          ▸
        </span>
        In-game chat feed
        <span className="text-xs font-normal text-text-muted">other players&rsquo; drops in your RuneLite chat</span>
      </summary>

      <div className="grid gap-5 px-5 pb-5">
        <p className="max-w-[70ch] text-[13px] text-text-muted">
          What shows in your chat when the feed is on in the Anvil plugin (Configuration → Anvil → Chat feed).
          Each thing shows once, even when it reaches you more than one way, and never when your own clan&rsquo;s
          broadcast already showed it.
        </p>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{error}</div>}
        {!prefs ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <>
            <div className="grid gap-3">
              <p className="text-sm font-medium">Where from</p>
              <Checkbox
                checked={prefs.events}
                disabled={busy}
                onChange={(v) => save({ events: v })}
                label="Boards I play on"
                description="When the host turns the chat feed on: every team's drops and completed tiles."
              />
              <Checkbox
                checked={prefs.guests}
                disabled={busy}
                onChange={(v) => save({ guests: v })}
                label="Clans I'm guesting in, and my clan's guests"
                description="While you sit in a clan's guest channel you see its members' drops, and your clan sees its guests'. Only in clans that turned this on."
              />
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-medium">What</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox checked={prefs.drops} disabled={busy} onChange={(v) => save({ drops: v })} label="Drops worth at least" />
                <Select
                  value={String(prefs.minValue)}
                  onChange={(v) => save({ minValue: Number(v) })}
                  options={MIN_VALUE_CHOICES.map((n) => ({ value: String(n), label: gp(n) }))}
                  disabled={busy || !prefs.drops}
                  ariaLabel="Lowest drop value"
                  className="w-32 shrink-0"
                />
              </div>
              <Checkbox checked={prefs.pets} disabled={busy} onChange={(v) => save({ pets: v })} label="Pets" />
              <Checkbox checked={prefs.clog} disabled={busy} onChange={(v) => save({ clog: v })} label="New collection log slots" />
              <Checkbox checked={prefs.tiles} disabled={busy} onChange={(v) => save({ tiles: v })} label="Other teams' completed tiles" />
              <Checkbox checked={prefs.modes} disabled={busy} onChange={(v) => save({ modes: v })} label="Leagues, Deadman and other game-mode unlocks" />
              <Row label="Combat achievements">
                <Select value={prefs.ca} onChange={(v) => save({ ca: v as ChatFeedPrefs['ca'] })} options={CA_OPTIONS} disabled={busy} ariaLabel="Combat achievements" className="w-44 shrink-0" />
              </Row>
              <Row label="Levels">
                <Select value={prefs.levels} onChange={(v) => save({ levels: v as ChatFeedPrefs['levels'] })} options={MAJOR_OPTIONS('99s and maxing')} disabled={busy} ariaLabel="Levels" className="w-44 shrink-0" />
              </Row>
              <Row label="Quests and diaries">
                <Select value={prefs.quests} onChange={(v) => save({ quests: v as ChatFeedPrefs['quests'] })} options={MAJOR_OPTIONS('Quest cape and elite diaries')} disabled={busy} ariaLabel="Quests and diaries" className="w-44 shrink-0" />
              </Row>
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-medium">When you log in</p>
              <Checkbox
                checked={prefs.login}
                disabled={busy}
                onChange={(v) => save({ login: v })}
                label="A short brief in chat"
                description="One or two lines: where your team stands, what's nearly done, your place in a live competition."
              />
              {prefs.login && (
                <div className="grid gap-2 pl-1">
                  <p className="text-xs text-text-muted">
                    {canShapeBrief(prefs.tier) ? 'What it covers:' : 'Champions choose what it covers:'}
                  </p>
                  {BRIEF_ITEMS.map((b) => (
                    <Checkbox
                      key={b}
                      checked={prefs.brief.includes(b)}
                      disabled={busy || !canShapeBrief(prefs.tier)}
                      onChange={(v) => save({ brief: v ? [...prefs.brief, b] : prefs.brief.filter((x) => x !== b) })}
                      label={BRIEF_LABELS[b]}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-medium">Colours</p>
              <Row label="Anvil lines in chat">
                <Select
                  value={prefs.palette}
                  onChange={(v) => save({ palette: v as ChatFeedPrefs['palette'] })}
                  options={[
                    { value: 'anvil', label: 'By type (Anvil colours)' },
                    { value: 'plain', label: "One colour (the plugin's own)" },
                    { value: 'custom', label: canCustomColors(prefs.tier) ? 'My own colours' : 'My own colours (Supporter)' },
                  ]}
                  disabled={busy}
                  ariaLabel="Chat colours"
                  className="w-56 shrink-0"
                />
              </Row>
              {prefs.palette !== 'plain' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {TONES.map((t) => (
                    <ToneSwatch
                      // Keyed on the colour too, so a saved or reset colour starts a fresh draft.
                      key={`${t}${(prefs.palette === 'custom' && prefs.colors[t]) || ANVIL_COLORS[t]}`}
                      label={TONE_LABELS[t]}
                      value={(prefs.palette === 'custom' && prefs.colors[t]) || ANVIL_COLORS[t]}
                      editable={prefs.palette === 'custom' && canCustomColors(prefs.tier) && !busy}
                      onSave={(c) => save({ colors: { ...prefs.colors, [t]: c } })}
                    />
                  ))}
                </div>
              )}
              {prefs.palette === 'custom' && !canCustomColors(prefs.tier) && (
                <p className="text-xs text-text-muted">
                  Your own colours are a Supporter perk. Until then the plugin uses the Anvil colours.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function ToneSwatch({ label, value, editable, onSave }: { label: string; value: string; editable: boolean; onSave: (c: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex items-center gap-2.5 rounded-lg border border-card-border px-3 py-2 text-sm">
      <input
        type="color"
        value={draft}
        disabled={!editable}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
        className="h-6 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-default"
        aria-label={`${label} colour`}
      />
      <span style={{ color: draft }} className="truncate">
        {label}
      </span>
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">{label}</p>
      {children}
    </div>
  );
}
