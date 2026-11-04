'use client';

import { useEffect, useId, useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';
import { compactXp, foldHref, fullProfileHref, seatLabel, type FoldCharacter } from '@/lib/characterFold';
import type { SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';

/**
 * Their characters, folded under the person: one line — "3 characters ▾" (on a character's view,
 * "· viewing Drenvox"), even for one — that opens a compact list, one row per character. Picking a
 * row opens that character's view (?account=<rsn>, a history entry, so Back returns) and folds the
 * list away again.
 *
 * A real disclosure button (aria-expanded / aria-controls), so it works from the keyboard and with a
 * screen reader; Escape folds it and gives focus back to the button.
 */
export default function CharacterFold({
  characters,
  selectedRsn,
  supporterTier = null,
  supporterStyle = null,
  space,
}: {
  characters: FoldCharacter[];
  selectedRsn: string | null;
  supporterTier?: SupporterTierId | null;
  supporterStyle?: SupporterStyle | null;
  /** A creator space's tab: its seats are event seats, and the label says so. */
  space: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The address as it is when the list opens. Read then, not at render: the profile's tabs rewrite
  // ?tab= in place (history.replaceState), and a row should open the other character on the tab you
  // are looking at now, not the one the page loaded with.
  const [search, setSearch] = useState<URLSearchParams | null>(null);
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    }
    // A tap anywhere else folds it too — on a phone there is no Escape key.
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (!button.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const selected = characters.find((c) => c.rsn === selectedRsn) ?? null;

  return (
    // A fragment inside the card's flex-wrap row: the button sits where the chips did, and the open
    // list takes a line of its own under the row (order-last, full basis) rather than pushing
    // "+ Add a character" aside.
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!open) setSearch(new URLSearchParams(window.location.search));
          setOpen(!open);
        }}
        className={`inline-flex max-w-full flex-wrap items-center gap-x-2 text-left rounded-2xl sm:rounded-full border bg-brown-dark/60 px-3 py-1 text-sm transition-colors hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
          open ? 'border-gold/60' : 'border-card-border'
        }`}
      >
        <span className="whitespace-nowrap font-medium">
          {characters.length} character{characters.length === 1 ? '' : 's'}
        </span>
        <span aria-hidden className={`text-[10px] text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
        {selected && (
          // Wraps rather than truncates: on a phone the selected name is the point of the line.
          <span className="min-w-0 break-words text-text-muted">
            · viewing{' '}
            <SupporterName
              name={selected.rsn}
              tier={supporterTier}
              style={supporterStyle}
              plain
              star={false}
              className="font-semibold text-foreground"
            />
          </span>
        )}
      </button>

      {open && (
        <div ref={list} id={listId} className="order-last basis-full">
        <ul
          aria-label="Your characters"
          className="sm:max-w-lg overflow-hidden rounded-xl border border-card-border bg-brown-dark/80 divide-y divide-card-border"
        >
          {characters.map((c) => {
            const isSelected = c.rsn === selectedRsn;
            return (
              <li key={c.accountId} className={isSelected ? 'bg-gold/[0.07]' : ''}>
                <ClanLink
                  // A push, not a replace: Back returns to the character you came from.
                  href={foldHref(c.rsn, search)}
                  aria-current={isSelected ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5 text-sm transition-colors hover:bg-card-bg-hover focus-visible:bg-card-bg-hover focus-visible:outline-none"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      c.playingIn ? 'bg-accent-green-light ring-2 ring-accent-green/25' : 'bg-transparent'
                    }`}
                    title={c.playingIn ? `Playing ${c.playingIn}` : undefined}
                    aria-hidden={!c.playingIn}
                  />
                  {c.playingIn && <span className="sr-only">Playing {c.playingIn}.</span>}
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <SupporterName
                        name={c.rsn}
                        tier={supporterTier}
                        style={supporterStyle}
                        plain
                        star={false}
                        className={`truncate ${isSelected ? 'font-semibold text-gold-light' : 'font-medium'}`}
                      />
                      <span
                        className={`shrink-0 rounded-full border px-1.5 text-[10.5px] ${
                          c.isPrimary ? 'border-gold-dark text-gold' : 'border-card-border text-text-muted'
                        }`}
                      >
                        {c.isPrimary ? 'main' : 'alt'}
                      </span>
                    </span>
                    <span className={`block text-[11.5px] ${c.seat ? 'text-text-muted' : 'text-text-dim'}`}>
                      {seatLabel(c.seat, space)}
                      {!c.verified && <span className="text-yellow-400"> · unverified</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[11.5px] tabular-nums text-text-muted">
                    {c.totalLevel != null && (
                      <span className="block text-foreground">
                        {c.totalLevel.toLocaleString()}
                        <span className="hidden sm:inline"> total</span>
                      </span>
                    )}
                    {c.totalXp != null && <span className="block">{compactXp(c.totalXp)} XP</span>}
                    {c.totalLevel == null && c.totalXp == null && <span className="block text-text-dim">no stats yet</span>}
                  </span>
                </ClanLink>
                {/* Each character's own doors, beside it rather than on the person's header: its
                    settings (sharing, main, clans, rename, remove) and the page others see. */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2.5 pl-[2.1rem] pr-3 text-[12px]">
                  <ClanLink
                    href={`/settings/characters/${c.accountId}`}
                    className="text-text-muted hover:text-gold"
                    aria-label={`Settings for ${c.rsn}`}
                  >
                    ⚙ Settings
                  </ClanLink>
                  <ClanLink
                    href={fullProfileHref(c, space)}
                    className="text-gold hover:underline"
                    aria-label={`${c.rsn}'s full profile`}
                  >
                    Full profile →
                  </ClanLink>
                </div>
              </li>
            );
          })}
        </ul>
        </div>
      )}
    </>
  );
}
