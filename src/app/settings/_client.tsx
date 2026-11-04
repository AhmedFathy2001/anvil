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
  'rounded-lg border border-card-border bg-card-bg-hover px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-gold/40 disabled:opacity-50';
export const BTN_DANGER =
  'rounded-lg border border-accent-red/40 px-3 py-1.5 text-[13px] text-accent-red transition-colors hover:bg-accent-red/10 disabled:opacity-50';

export interface NavCharacter {
  accountId: number;
  rsn: string;
  isPrimary: boolean;
}

const ACCOUNT_ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/settings/account', label: 'Login & devices', icon: '⏻' },
  { href: '/settings/plugin', label: 'Plugin token', icon: '⚿' },
  { href: '/settings/announcements', label: 'Announcements', icon: '📣' },
  { href: '/settings/webhooks', label: 'Discord webhooks', icon: '⌁' },
  { href: '/settings/chat', label: 'In-game chat', icon: '💬' },
  { href: '/settings/connections', label: 'Connected accounts', icon: '⇄' },
  { href: '/settings/privacy', label: 'Privacy', icon: '◐' },
  { href: '/settings/look', label: 'Profile look', icon: '▣' },
  { href: '/settings/supporter', label: 'Supporter', icon: '★' },
];

/**
 * The left rail: account sections, then one entry per character. On a phone it becomes a row of
 * chips that scrolls sideways above the page, so the page itself never does.
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

  return (
    <nav aria-label="Settings" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:sticky lg:top-20 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0">
      {heading('Account')}
      {ACCOUNT_ITEMS.map((i) => item(i.href, path === i.href, <>{icon(i.icon)}{i.label}</>))}
      {item(
        '/settings/claims',
        path === '/settings/claims',
        <>
          {icon('⚑')}
          Ownership claims
          {claims > 0 && <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-semibold text-brown-dark">{claims}</span>}
        </>,
      )}
      {heading('Characters')}
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
      {item(
        '/settings/add',
        path === '/settings/add',
        <>
          {icon('+')}
          <span className="text-gold">Add character</span>
          {pending > 0 && <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-semibold text-brown-dark">{pending}</span>}
        </>,
      )}
    </nav>
  );
}
