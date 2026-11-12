'use client';

import ClanLink from '@/components/ClanLink';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { useDialog } from '@/components/Confirm';
import SupporterName from '@/components/SupporterName';
import type { SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';
import { clanFetch } from '@/lib/clanFetch';

/** The on/off switch every boolean setting uses. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible name — the visible label sits in the row beside it. */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-accent-green' : 'bg-tile-border'
      }`}
    >
      <span
        className={`absolute top-[3px] h-4 w-4 rounded-full bg-foreground transition-[left] ${checked ? 'left-[19px]' : 'left-[3px]'}`}
      />
    </button>
  );
}

/**
 * A switch that writes one boolean to one endpoint, then re-renders the page from the server.
 * `field` is the body key the endpoint reads; `invert` is for endpoints that store the opposite
 * of what the row says (e.g. the row reads "Show", the column is `hidden`).
 */
export function SettingSwitch({
  url,
  method = 'PATCH',
  field,
  checked,
  label,
  invert = false,
  extra,
}: {
  url: string;
  method?: 'PATCH' | 'PUT' | 'POST';
  field: string;
  checked: boolean;
  label: string;
  invert?: boolean;
  extra?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [on, setOn] = useState(checked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(next: boolean) {
    const before = on;
    setOn(next);
    setBusy(true);
    setError('');
    try {
      const res = await clanFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extra, [field]: invert ? !next : next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'That didn’t save.');
      }
      router.refresh();
    } catch (e) {
      setOn(before);
      setError(e instanceof Error ? e.message : 'That didn’t save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <span className="text-xs text-red-400">{error}</span>}
      <Switch checked={on} onChange={save} disabled={busy} label={label} />
    </>
  );
}

/**
 * A button that sends one request. With `confirm`, asks first (for the things that end something).
 * On success it refreshes, or goes to `then` when the thing it acted on no longer exists here.
 */
export function ActionButton({
  url,
  method = 'POST',
  body,
  children,
  tone = 'default',
  confirm,
  then,
}: {
  url: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  children: ReactNode;
  tone?: 'default' | 'danger';
  confirm?: { title: string; body: string; confirmLabel: string };
  then?: string;
}) {
  const router = useRouter();
  const { confirm: ask } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    if (confirm && !(await ask(confirm))) return;
    setBusy(true);
    setError('');
    try {
      const res = await clanFetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'That didn’t work.');
      }
      if (then) router.push(then);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <span className="max-w-[28ch] text-right text-xs text-red-400">{error}</span>}
      <button type="button" onClick={run} disabled={busy} className={tone === 'danger' ? BTN_DANGER : BTN}>
        {busy ? '…' : children}
      </button>
    </>
  );
}

export const BTN =
  'rounded-lg border border-card-border bg-card-bg-hover px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-card-border';
export const BTN_DANGER =
  'rounded-lg border border-accent-red/40 px-3 py-1.5 text-[13px] text-accent-red transition-colors hover:bg-accent-red/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent';

export interface NavCharacter {
  accountId: number;
  rsn: string;
  isPrimary: boolean;
}

// Five pages, each named for what it holds. The old addresses (/settings/profile#look, /settings/in-game#chat-feed, …)
// redirect to the section that holds them now (app/settings/_legacy), so the plugin's links and old
// bookmarks still land.
const PAGES: { href: string; label: string; icon: string }[] = [
  { href: '/settings/profile', label: 'Profile & look', icon: '▣' },
  { href: '/settings/characters', label: 'Characters', icon: '♟' },
  { href: '/settings/in-game', label: 'In game', icon: '⚿' },
  { href: '/settings/posts', label: 'Posts & alerts', icon: '📣' },
  { href: '/settings/account', label: 'Account', icon: '⏻' },
];

/**
 * The left rail: the five pages, then one entry per character. On a phone it becomes a row of chips
 * that scrolls sideways above the page, so the page itself never does.
 */
export function SettingsNav({
  characters,
  pending,
  claims = 0,
  flair = null,
}: {
  characters: NavCharacter[];
  pending: number;
  /** "This is my account" claims on their characters waiting for their answer (lib/ownershipClaims). */
  claims?: number;
  /** Their Supporter look, worn by their characters' names (inside a link, so `plain`). */
  flair?: { tier: SupporterTierId | null; style: SupporterStyle | null } | null;
}) {
  const path = usePathname();
  const item = (href: string, active: boolean, children: ReactNode, extra = '') => (
    <ClanLink
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] transition-colors ${
        active ? 'bg-card-bg text-foreground shadow-[inset_3px_0_0_var(--gold)]' : 'text-text-muted hover:bg-card-bg hover:text-foreground'
      } ${extra}`}
    >
      {children}
    </ClanLink>
  );
  const icon = (glyph: string) => (
    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border border-tile-border bg-tile-bg text-[11px] text-gold" aria-hidden>
      {glyph}
    </span>
  );
  const heading = (text: string) => (
    <div className="mb-1.5 mt-4 hidden px-2.5 text-[11px] uppercase tracking-[0.08em] text-text-dim first:mt-0 lg:block">{text}</div>
  );
  const badge = (n: number) =>
    n > 0 ? <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-semibold text-brown-dark">{n}</span> : null;

  return (
    <nav aria-label="Settings" className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden scroll-quiet px-4 pb-2 lg:sticky lg:top-20 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0">
      {item('/settings', path === '/settings', <>{icon('⌂')}Overview & search</>)}
      {heading('Settings')}
      {PAGES.map((p) =>
        item(
          p.href,
          path === p.href,
          <>
            {icon(p.icon)}
            {p.label}
            {p.href === '/settings/characters' && badge(claims + pending)}
          </>,
        ),
      )}
      {characters.length > 0 && heading('Your characters')}
      {characters.map((c) => {
        const href = `/settings/characters/${c.accountId}`;
        return item(
          href,
          path === href,
          <>
            {icon(c.rsn.slice(0, 1).toUpperCase())}
            <SupporterName name={c.rsn} tier={flair?.tier} style={flair?.style} plain className="truncate" />
            {c.isPrimary && <span className="ml-auto rounded-full border border-gold-dark px-1.5 text-[10px] text-gold">main</span>}
          </>,
        );
      })}
    </nav>
  );
}
