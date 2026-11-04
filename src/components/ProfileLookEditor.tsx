'use client';

import { useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { MotionImage } from '@/components/ProfileMedia';
import { clanFetch } from '@/lib/clanFetch';
import { MEDIA_LIMITS, type ProfileMediaKind, type ShownMedia, type ShownProfileMedia } from '@/lib/profileMediaRules';

// Your own avatar and banner, on "your account across Anvil" (Anvil Supporter: Champion and Patron).
// Uploads on choose — the server validates, re-encodes and stores it, and answers with what to show.
// Removing works at any tier, so somebody whose membership lapsed can still take theirs down.

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

export default function ProfileLookEditor({
  initial,
  canUpload,
  name,
}: {
  initial: ShownProfileMedia;
  /** Champion+ now. Without it, what they uploaded shows as a still and the pickers are hidden. */
  canUpload: boolean;
  name: string;
}) {
  const [avatar, setAvatar] = useState<ShownMedia | null>(initial.avatar);
  const [banner, setBanner] = useState<ShownMedia | null>(initial.banner);
  const [position, setPosition] = useState<number>(initial.banner?.position ?? 50);
  const [busy, setBusy] = useState<ProfileMediaKind | null>(null);
  const [error, setError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!canUpload && !avatar && !banner) {
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
      const res = await clanFetch(`/api/profile/media?kind=${kind}`, { method: 'DELETE' });
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
        body: JSON.stringify({ bannerPosition: pos === 50 ? null : pos }),
      });
    }, 400);
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      {!canUpload && (
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
        <div className="aspect-[4/1] min-w-0 flex-1 overflow-hidden rounded-lg border border-card-border bg-gradient-to-r from-gold/15 via-card-bg to-gold/10">
          {banner && <MotionImage media={banner} className="h-full w-full object-cover" style={{ objectPosition: `50% ${position}%` }} />}
        </div>
        {banner && (
          <div className="flex flex-col items-center gap-1 text-[10px] text-text-muted">
            <span>Top</span>
            <input
              type="range"
              min={0}
              max={100}
              value={position}
              onChange={(e) => moveBanner(Number(e.target.value))}
              aria-label="Which part of the banner shows"
              className="flex-1 accent-gold [writing-mode:vertical-lr]"
            />
            <span>Bottom</span>
          </div>
        )}
      </div>
      <Controls kind="banner" has={!!banner} busy={busy} canUpload={canUpload} onFile={upload} onRemove={remove} />
      <p className="mt-1 text-[12px] text-text-dim">
        PNG, JPEG, GIF or WebP, up to {MEDIA_LIMITS.banner.maxBytes / (1024 * 1024)} MB — a wide picture works best (about 1500×500).
      </p>

      <div className="mb-2 mt-5 text-[13px] font-medium">Avatar</div>
      <div className="flex items-center gap-4">
        {avatar ? (
          <MotionImage media={avatar} width={64} height={64} className="h-16 w-16 rounded-full border-2 border-gold/45 object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-gold/45 bg-gold/15 text-xl font-bold text-gold-light">
            {(name || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <Controls kind="avatar" has={!!avatar} busy={busy} canUpload={canUpload} onFile={upload} onRemove={remove} />
          <p className="mt-1 text-[12px] text-text-dim">
            Square, up to {MEDIA_LIMITS.avatar.maxBytes / (1024 * 1024)} MB. Without one, your Discord picture is used where it was before.
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
}: {
  kind: ProfileMediaKind;
  has: boolean;
  busy: ProfileMediaKind | null;
  canUpload: boolean;
  onFile: (kind: ProfileMediaKind, file: File) => Promise<void>;
  onRemove: (kind: ProfileMediaKind) => Promise<void>;
}) {
  const mine = busy === kind;
  return (
    <div className="flex items-center gap-3">
      {canUpload && (
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-card-border px-3 py-1.5 text-sm transition-colors hover:border-gold/45">
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={busy != null}
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
          disabled={busy != null}
          onClick={() => void onRemove(kind)}
          className="text-[13px] text-text-dim underline-offset-4 hover:text-gold hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      )}
    </div>
  );
}
