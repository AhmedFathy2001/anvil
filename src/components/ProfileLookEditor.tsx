'use client';

import { useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { MotionImage } from '@/components/ProfileMedia';
import { clanFetch } from '@/lib/clanFetch';
import { MEDIA_LIMITS, type ProfileMediaKind, type ShownMedia, type ShownProfileMedia } from '@/lib/profileMediaRules';
import Slider from '@/components/Slider';

// Your own avatar and banner, on "your account across Anvil" (Anvil Supporter: Champion and Patron).
// Uploads on choose — the server validates, re-encodes and stores it, and answers with what to show.
// Removing works at any tier, so somebody whose membership lapsed can still take theirs down.

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

export default function ProfileLookEditor({
  initial,
  canUpload,
  name,
  accountId,
  fallback,
  onChange,
}: {
  /** For a character (`accountId`): ONLY its own override parts; a null part uses the default. */
  initial: ShownProfileMedia;
  /** Champion+ now. Without it, what they uploaded shows as a still and the pickers are hidden. */
  canUpload: boolean;
  name: string;
  /** Edit this character's own override (account_media) instead of the person's default. */
  accountId?: number;
  /** The person's default, previewed (dimmed) where the character has no picture of its own. */
  fallback?: ShownProfileMedia | null;
  /** Which parts the character now has of its own, after each upload or removal. */
  onChange?: (own: { avatar: boolean; banner: boolean }) => void;
}) {
  const forCharacter = accountId != null;
  const [avatar, setAvatarState] = useState<ShownMedia | null>(initial.avatar);
  const [banner, setBannerState] = useState<ShownMedia | null>(initial.banner);
  const own = useRef({ avatar: !!initial.avatar, banner: !!initial.banner });
  const setAvatar = (m: ShownMedia | null) => {
    setAvatarState(m);
    own.current = { ...own.current, avatar: !!m };
    onChange?.(own.current);
  };
  const setBanner = (m: ShownMedia | null) => {
    setBannerState(m);
    own.current = { ...own.current, banner: !!m };
    onChange?.(own.current);
  };
  // A character with no picture of its own previews the default, dimmed, so the owner sees what shows.
  const shownBanner = banner ?? (forCharacter ? fallback?.banner ?? null : null);
  const shownAvatar = avatar ?? (forCharacter ? fallback?.avatar ?? null : null);
  const [position, setPosition] = useState<number>(initial.banner?.position ?? 50);
  const [busy, setBusy] = useState<ProfileMediaKind | null>(null);
  const [error, setError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!canUpload && !avatar && !banner && !forCharacter) {
    return (
      <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-text-muted">
        Your own avatar and banner — animated if you like — come with{' '}
        <ClanLink href="/supporter" className="text-gold hover:text-gold-light">
          Anvil Champion and Patron
        </ClanLink>
        .
      </p>
    );
  }

  async function upload(kind: ProfileMediaKind, file: File) {
    setError('');
    const lim = MEDIA_LIMITS[kind];
    // The server checks all of this again; this just saves somebody a slow upload to be told no.
    if (file.size > lim.maxBytes) {
      setError(`That file is too large — at most ${lim.maxBytes / (1024 * 1024)} MB.`);
      return;
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use a PNG, JPEG, GIF or WebP image.');
      return;
    }
    setBusy(kind);
    try {
      const body = new FormData();
      body.append('kind', kind);
      body.append('file', file);
      if (forCharacter) body.append('accountId', String(accountId));
      const res = await clanFetch('/api/profile/media', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.still !== 'string') {
        setError(typeof data.error === 'string' ? data.error : 'That upload did not work.');
        return;
      }
      const shown: ShownMedia = { src: data.url, still: data.still, animated: !!data.animated };
      if (kind === 'avatar') setAvatar(shown);
      else {
        setBanner(shown);
        setPosition(50);
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: ProfileMediaKind) {
    setError('');
    setBusy(kind);
    try {
      const res = await clanFetch(`/api/profile/media?kind=${kind}${forCharacter ? `&accountId=${accountId}` : ''}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not remove that — try again.');
        return;
      }
      if (kind === 'avatar') setAvatar(null);
      else setBanner(null);
    } finally {
      setBusy(null);
    }
  }

  function moveBanner(pos: number) {
    setPosition(pos);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void clanFetch('/api/profile/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forCharacter ? { accountId, bannerPosition: pos === 50 ? null : pos } : { bannerPosition: pos === 50 ? null : pos }),
      });
    }, 400);
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      {!canUpload && (avatar || banner) && (
        <p className="mb-3 text-[13px] text-text-muted">
          Your membership no longer includes your own pictures, so they show as a still frame. Remove them here, or{' '}
          <ClanLink href="/supporter" className="text-gold hover:text-gold-light">
            come back as a Champion
          </ClanLink>{' '}
          to bring the motion back.
        </p>
      )}

      <div className="mb-2 text-[13px] font-medium">Banner</div>
      <div className="mb-2 flex items-stretch gap-3">
        <div className="aspect-[3/1] min-w-0 flex-1 overflow-hidden rounded-lg border border-card-border bg-gradient-to-r from-gold/15 via-card-bg to-gold/10">
          {shownBanner && (
            <MotionImage
              media={shownBanner}
              className={`h-full w-full object-cover ${banner ? '' : 'opacity-45'}`}
              style={{ objectPosition: `50% ${banner ? position : (fallback?.banner?.position ?? 50)}%` }}
            />
          )}
        </div>
        {banner && (
          <div className="flex flex-col items-center gap-1 text-[10px] text-text-muted">
            <span>Top</span>
            <Slider
              orientation="vertical"
              min={0}
              max={100}
              value={position}
              onChange={moveBanner}
              ariaLabel="Which part of the banner shows"
              className="flex-1"
            />
            <span>Bottom</span>
          </div>
        )}
      </div>
      {forCharacter && !banner && <p className="mb-2 text-[12px] text-text-dim">{shownBanner ? 'Using your default banner.' : 'Using your default (none set).'}</p>}
      <Controls kind="banner" has={!!banner} busy={busy} canUpload={canUpload} onFile={upload} onRemove={remove} removeLabel={forCharacter ? 'Use my default' : 'Remove'} />
      <p className="mt-1 text-[12px] text-text-dim">
        PNG, JPEG, GIF or WebP, up to {MEDIA_LIMITS.banner.maxBytes / (1024 * 1024)} MB — wide, 3:1 (e.g. 1500×500), shows whole.
      </p>

      <div className="mb-2 mt-5 text-[13px] font-medium">Avatar</div>
      <div className="flex items-center gap-4">
        {shownAvatar ? (
          <MotionImage
            media={shownAvatar}
            width={64}
            height={64}
            className={`h-16 w-16 rounded-full border-2 border-gold/45 object-cover ${avatar ? '' : 'opacity-45'}`}
          />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-gold/45 bg-gold/15 text-xl font-bold text-gold-light">
            {(name || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <Controls kind="avatar" has={!!avatar} busy={busy} canUpload={canUpload} onFile={upload} onRemove={remove} removeLabel={forCharacter ? 'Use my default' : 'Remove'} />
          <p className="mt-1 text-[12px] text-text-dim">
            Square, up to {MEDIA_LIMITS.avatar.maxBytes / (1024 * 1024)} MB.{' '}
            {forCharacter
              ? avatar
                ? 'Shown on this character only.'
                : 'Using your default avatar.'
              : 'Without one, your Discord picture is used where it was before.'}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <p className="mt-4 text-[12px] text-text-dim">
        Animated GIF and WebP move on your profile and your own card; lists everywhere else show the first frame, and so does
        anyone whose device asks for reduced motion.
      </p>
    </div>
  );
}

function Controls({
  kind,
  has,
  busy,
  canUpload,
  onFile,
  onRemove,
  removeLabel = 'Remove',
}: {
  removeLabel?: string;
  kind: ProfileMediaKind;
  has: boolean;
  busy: ProfileMediaKind | null;
  canUpload: boolean;
  onFile: (kind: ProfileMediaKind, file: File) => Promise<void>;
  onRemove: (kind: ProfileMediaKind) => Promise<void>;
}) {
  const mine = busy === kind;
  // One upload or removal at a time across both pictures (they share `busy`), so while either runs
  // every control here is off, and looks it.
  const off = busy != null;
  return (
    <div className="flex items-center gap-3">
      {canUpload && (
        <label
          aria-disabled={off || undefined}
          className={`inline-flex items-center rounded-lg border border-card-border px-3 py-1.5 text-sm transition-colors ${
            off ? (mine ? 'cursor-wait' : 'cursor-not-allowed opacity-50') : 'cursor-pointer hover:border-gold/45'
          }`}
        >
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={off}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared so choosing the same file again still fires.
              e.target.value = '';
              if (file) void onFile(kind, file);
            }}
          />
          {mine ? 'Working…' : has ? 'Replace' : 'Choose an image'}
        </label>
      )}
      {has && (
        <button
          type="button"
          disabled={off}
          onClick={() => void onRemove(kind)}
          className="text-[13px] text-text-dim underline-offset-4 enabled:hover:text-gold enabled:hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        >
          {removeLabel}
        </button>
      )}
    </div>
  );
}
