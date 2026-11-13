'use client';

import { useState } from 'react';

import ProfileLookEditor from '@/components/ProfileLookEditor';
import { clanFetch } from '@/lib/clanFetch';
import type { ShownProfileMedia } from '@/lib/profileMediaRules';
import type { SupporterTierId } from '@/lib/supporterTiers';

// Per-character avatar/banner (account_media), under the account-wide editor in Settings → Profile
// look. "Same for all" = every character wears your default;
// "Customize each" = per character, "Use my default" or its own pictures (same editor, same limits).

export interface CharacterLook {
  accountId: number;
  rsn: string;
  /** Only the character's OWN parts; a null part uses the default. */
  own: ShownProfileMedia;
}

const segment = (active: boolean) =>
  `rounded-md px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-gold/15 text-gold' : 'text-text-muted enabled:hover:text-text'}`;

export default function CharacterLookOverrides({
  characters,
  fallback,
  canUpload,
  canAnimate,
  held = null,
}: {
  /** Passed to each editor: see ProfileLookEditor. */
  canAnimate?: boolean;
  held?: SupporterTierId | null;
  characters: CharacterLook[];
  /** The person's default, previewed where a character has none of its own. */
  fallback: ShownProfileMedia;
  canUpload: boolean;
}) {
  const [owned, setOwned] = useState<Record<number, { avatar: boolean; banner: boolean }>>(() =>
    Object.fromEntries(characters.map((c) => [c.accountId, { avatar: !!c.own.avatar, banner: !!c.own.banner }])),
  );
  const customized = characters.filter((c) => owned[c.accountId]?.avatar || owned[c.accountId]?.banner);
  const [mode, setMode] = useState<'all' | 'each'>(customized.length ? 'each' : 'all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Bumped after a bulk reset so each row's editor remounts from what the server now holds.
  const [generation, setGeneration] = useState(0);

  async function clear(accountId: number, parts: { avatar: boolean; banner: boolean }): Promise<boolean> {
    const kinds = (['avatar', 'banner'] as const).filter((k) => parts[k]);
    for (const kind of kinds) {
      const res = await clanFetch(`/api/profile/media?kind=${kind}&accountId=${accountId}`, { method: 'DELETE' });
      if (!res.ok) return false;
    }
    setOwned((o) => ({ ...o, [accountId]: { avatar: false, banner: false } }));
    return true;
  }

  async function clearAll() {
    setError('');
    setBusy(true);
    try {
      for (const c of customized) {
        if (!(await clear(c.accountId, owned[c.accountId]))) {
          setError('Could not reset every character — try again.');
          return;
        }
      }
      setGeneration((g) => g + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="inline-flex rounded-lg border border-card-border bg-background/40 p-1 text-[12.5px]">
        <button type="button" disabled={busy} onClick={() => setMode('all')} className={segment(mode === 'all')}>Same for all</button>
        <button type="button" disabled={busy} onClick={() => setMode('each')} className={segment(mode === 'each')}>Customize each</button>
      </div>

      {mode === 'all' ? (
        <div className="mt-3 text-[13px] text-text-muted">
          {customized.length === 0 ? (
            <p>Every character of yours shows the avatar and banner above.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p>
                {customized.length === 1 ? `${customized[0].rsn} still has` : `${customized.length} characters still have`} pictures of
                their own.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void clearAll()}
                className="rounded-lg border border-card-border px-3 py-1.5 text-[13px] text-text transition-colors enabled:hover:border-gold/45 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Use my default on every character'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {characters.map((c) => (
            <CharacterRow
              key={`${c.accountId}:${generation}`}
              character={generation ? { ...c, own: { avatar: null, banner: null } } : c}
              fallback={fallback}
              canUpload={canUpload}
              canAnimate={canAnimate}
              held={held}
              owned={owned[c.accountId] ?? { avatar: false, banner: false }}
              onOwned={(o) => setOwned((prev) => ({ ...prev, [c.accountId]: o }))}
              onClear={() => clear(c.accountId, owned[c.accountId] ?? { avatar: false, banner: false })}
            />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function CharacterRow({
  character,
  fallback,
  canUpload,
  canAnimate,
  held,
  owned,
  onOwned,
  onClear,
}: {
  character: CharacterLook;
  fallback: ShownProfileMedia;
  canUpload: boolean;
  canAnimate?: boolean;
  held: SupporterTierId | null;
  owned: { avatar: boolean; banner: boolean };
  onOwned: (o: { avatar: boolean; banner: boolean }) => void;
  onClear: () => Promise<boolean>;
}) {
  const hasOwn = owned.avatar || owned.banner;
  const [open, setOpen] = useState(hasOwn);
  // Remounts the editor after "Use my default", so it starts from nothing of its own.
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function resetToDefault() {
    setError('');
    if (!hasOwn) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      if (await onClear()) {
        setOpen(false);
        setEditorKey((k) => k + 1);
      } else setError('Could not reset this character — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-card-border bg-background/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold">{character.rsn}</span>
        <div className="inline-flex rounded-lg border border-card-border bg-background/40 p-1 text-[12px]">
          <button type="button" disabled={busy} onClick={() => void resetToDefault()} className={segment(!open)}>
            {busy ? 'Working…' : 'Use my default'}
          </button>
          <button
            type="button"
            disabled={busy || (!canUpload && !hasOwn)}
            title={!canUpload && !hasOwn ? 'Pictures of its own come with Anvil Champion and Patron.' : undefined}
            onClick={() => setOpen(true)}
            className={segment(open)}
          >
            Its own
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {open && (
        <div className="mt-3">
          <ProfileLookEditor
            key={editorKey}
            initial={editorKey ? { avatar: null, banner: null } : character.own}
            canUpload={canUpload}
            canAnimate={canAnimate}
            held={held}
            name={character.rsn}
            accountId={character.accountId}
            fallback={fallback}
            onChange={onOwned}
          />
        </div>
      )}
    </div>
  );
}
