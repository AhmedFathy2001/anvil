'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDialog } from '@/components/Confirm';
import Radio from '@/components/Radio';
import SupporterName from '@/components/SupporterName';
import SupporterStylePicker from '@/components/SupporterStylePicker';
import { useLeaveGuard } from '@/components/UnsavedChanges';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  characterDefaultStyle,
  characterLookPlan,
  isDefaultSupporterStyle,
  supporterStyleKey,
  wornCharacterStyle,
  type CharacterLookRow,
} from '@/lib/characterNameLooks';
import { SURFACE_BACKGROUND, type SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';

type Character = CharacterLookRow & { rsn: string };
type Panel = { kind: 'shared' } | { kind: 'character'; accountId: number } | null;

const DEFAULT_BLOCKED = 'Characters wear the default look only by following your Anvil name, so pick another look here.';

/**
 * Name colours on Settings → Supporter, as one flow:
 *   1. the Anvil display name's look (users.supporter_style), edited in place;
 *   2. how the RuneScape characters wear colours: "Same as my Anvil name" (their rows are NULL) or
 *      "A separate look for my characters" (one look written into every row), edited in a panel;
 *   3. "Customize per character": each character opens its own panel with the same editor.
 * The mode is read off the stored rows (lib/characterNameLooks); nothing new is stored.
 */
export default function SupporterNameLooks({
  tier,
  name,
  accountStyle: initialAccountStyle,
  characters,
}: {
  tier: SupporterTierId;
  name: string;
  /** The Anvil name's look as worn (already gated to the tier). */
  accountStyle: SupporterStyle | null;
  /** Linked characters, primary first, with their stored look (null follows the Anvil name). */
  characters: Character[];
}) {
  const [accountStyle, setAccountStyle] = useState(initialAccountStyle);
  const [rows, setRows] = useState<Character[]>(characters);
  // The shared look the screen last showed, so an edit that leaves a tie doesn't swap it.
  const [prefer, setPrefer] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { confirm } = useDialog();
  const groupName = useId();

  const plan = useMemo(() => characterLookPlan(rows, prefer), [rows, prefer]);
  const sharedKey = plan.mode === 'separate' ? supporterStyleKey(plan.shared) : null;
  const shownMode = panel?.kind === 'shared' ? 'separate' : plan.mode;
  const showCharacters = rows.length > 0 && tier !== 'supporter';
  const defaultBlocked = isDefaultSupporterStyle(accountStyle) ? undefined : DEFAULT_BLOCKED;
  const close = useCallback(() => setPanel(null), []);

  async function followAnvilName() {
    if (plan.mode === 'same' || !rows[0]) return;
    const ok = await confirm({
      title: 'Use your Anvil name’s look on every character?',
      body: 'Every character goes back to the look of your Anvil name, including characters you customized. You can customize them again after.',
      confirmLabel: 'Use my Anvil name',
      tone: 'gold',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/supporter-style', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: rows[0].accountId, style: {}, allCharacters: true }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not save that.');
        return;
      }
      setPrefer(null);
      setRows((cur) => cur.map((r) => ({ ...r, style: null })));
    } catch {
      setError('Could not reach Anvil. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const open = panel?.kind === 'character' ? rows.find((r) => r.accountId === panel.accountId) ?? null : null;

  return (
    <div className="rounded-xl border border-card-border bg-black/10 p-4">
      <p className="mb-1 text-[13px] font-semibold">Your Anvil display name</p>
      <p className="mb-3 text-[12px] text-text-dim">
        The name on your Discord-linked account.{showCharacters && ' Your RuneScape characters can wear the same look or one of their own.'}
      </p>
      <SupporterStylePicker tier={tier} name={name} initial={initialAccountStyle} pageOnly onSaved={setAccountStyle} />

      {showCharacters && (
        <div className="mt-5 border-t border-card-border pt-4">
          <p className="mb-1 text-[13px] font-semibold">Your RuneScape characters</p>
          <p className="mb-3 text-[12px] text-text-dim">How your character names look in game chat, in the plugin panel and on boards.</p>

          <fieldset className="space-y-2" disabled={busy}>
            <legend className="sr-only">How your characters look</legend>
            <ModeOption
              name={groupName}
              checked={shownMode === 'same'}
              onChoose={() => void followAnvilName()}
              title="Same as my Anvil name"
              help="Your characters wear the look above and change with it."
            />
            <ModeOption
              name={groupName}
              checked={shownMode === 'separate'}
              onChoose={() => {
                if (plan.mode === 'same') setPanel({ kind: 'shared' });
              }}
              title="A separate look for my characters"
              help="One look for all of them, apart from your Anvil name."
            >
              {plan.mode === 'separate' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LookChip name={rows[0].rsn} tier={tier} style={plan.shared} />
                  <button
                    type="button"
                    onClick={() => setPanel({ kind: 'shared' })}
                    className="rounded-lg border border-card-border px-3 py-1.5 text-[13px] text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
                  >
                    Edit look
                  </button>
                </div>
              )}
            </ModeOption>
          </fieldset>
          {error && (
            <p role="alert" className="mt-2 text-[12.5px] text-red-400">
              {error}
            </p>
          )}

          <p className="mb-1 mt-5 text-[13px] font-semibold">Customize per character</p>
          <p className="mb-2 text-[12px] text-text-dim">Give one character a look of its own. Pick a character to open its editor.</p>
          <ul className="space-y-1.5">
            {rows.map((c) => {
              const status =
                c.style == null
                  ? 'Same as your Anvil name'
                  : plan.mode === 'separate' && !plan.customized.has(c.accountId)
                    ? 'Your characters’ look'
                    : 'Its own look';
              return (
                <li key={c.accountId}>
                  <button
                    type="button"
                    onClick={() => setPanel({ kind: 'character', accountId: c.accountId })}
                    className="flex w-full items-center gap-3 rounded-lg border border-card-border bg-background/30 px-3 py-2.5 text-left transition-colors hover:border-gold/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{c.rsn}</span>
                      <span className={`block text-[12px] ${plan.customized.has(c.accountId) ? 'text-gold' : 'text-text-dim'}`}>{status}</span>
                    </span>
                    <LookChip name={c.rsn} tier={tier} style={wornCharacterStyle(c, accountStyle)} />
                    <span aria-hidden className="text-text-dim">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {panel?.kind === 'shared' && rows[0] && (
        <LookPanel title="One look for all your characters" onClose={close}>
          {plan.customized.size > 0 && (
            <p className="mb-3 text-[12.5px] text-text-muted">
              Saving gives every character this look, including {plan.customized.size === 1 ? 'the one' : `the ${plan.customized.size}`} you
              customized.
            </p>
          )}
          <SupporterStylePicker
            tier={tier}
            name={rows[0].rsn}
            accountId={rows[0].accountId}
            applyAll
            framed={false}
            initial={plan.mode === 'separate' ? plan.shared : accountStyle}
            reset={null}
            defaultBlocked={defaultBlocked}
            onSaved={(style) => {
              setPrefer(style ? supporterStyleKey(style) : null);
              setRows((cur) => cur.map((r) => ({ ...r, style })));
            }}
          />
        </LookPanel>
      )}

      {open && (
        <LookPanel title={open.rsn} onClose={close}>
          <p className="mb-3 text-[12.5px] text-text-muted">
            {plan.mode === 'same'
              ? 'A look for this character only. Use the default to follow your Anvil name again.'
              : 'A look for this character only. Use the default to wear your characters’ look again.'}
          </p>
          <SupporterStylePicker
            key={open.accountId}
            tier={tier}
            name={open.rsn}
            accountId={open.accountId}
            framed={false}
            initial={wornCharacterStyle(open, accountStyle)}
            savedText={`Saved for ${open.rsn}.`}
            defaultBlocked={defaultBlocked}
            reset={{
              label: 'Use the default',
              send: characterDefaultStyle(plan),
              wears: plan.mode === 'same' ? accountStyle : plan.shared,
              disabled: !plan.customized.has(open.accountId),
            }}
            onSaved={(style) => {
              setPrefer(sharedKey);
              setRows((cur) => cur.map((r) => (r.accountId === open.accountId ? { ...r, style } : r)));
            }}
          />
        </LookPanel>
      )}
    </div>
  );
}

/** One of the two character choices: our radio, a title and a line of help, with room under it. */
function ModeOption({
  name,
  checked,
  onChoose,
  title,
  help,
  children,
}: {
  name: string;
  checked: boolean;
  onChoose: () => void;
  title: string;
  help: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-colors ${checked ? 'border-gold/50 bg-gold/[0.05]' : 'border-card-border'}`}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <Radio name={name} checked={checked} onChange={onChoose} className="mt-0.5" />
        <span>
          <span className="block text-[13.5px] font-medium">{title}</span>
          <span className="block text-[12px] text-text-dim">{help}</span>
        </span>
      </label>
      {children && <div className="pl-[1.625rem]">{children}</div>}
    </div>
  );
}

/** A name in a look, small, on the dark background most places draw it. */
function LookChip({ name, tier, style }: { name: string; tier: SupporterTierId; style: SupporterStyle | null }) {
  return (
    <span
      className="inline-flex max-w-[11rem] items-center rounded-md border border-card-border px-2 py-1"
      style={{ backgroundColor: SURFACE_BACKGROUND.dark }}
    >
      <SupporterName name={name} tier={tier} style={style} className="text-[12.5px] font-semibold" plain />
    </span>
  );
}

/**
 * The panel an editor opens in, over the page. Closing it (×, Escape, the backdrop) asks first
 * while its editor has unsaved changes; the Anvil name editor behind it doesn't count.
 */
function LookPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const leaveGuard = useLeaveGuard();
  // useModalA11y re-runs (and refocuses) whenever onClose changes, so the close it gets is stable.
  const guardRef = useRef(leaveGuard);
  useEffect(() => {
    guardRef.current = leaveGuard;
  });
  const guardedClose = useCallback(() => guardRef.current(onClose), [onClose]);
  const ref = useModalA11y<HTMLDivElement>({ onClose: guardedClose });
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-3 sm:p-8">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={guardedClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-xl rounded-2xl border border-gold/30 bg-card-bg shadow-2xl shadow-black/50 focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-card-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
            <h2 id={titleId} className="truncate font-semibold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={guardedClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-brown-light hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
