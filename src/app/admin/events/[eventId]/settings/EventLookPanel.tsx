'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ClanCrest from '@/components/ClanCrest';
import { clanFetch } from '@/lib/clanFetch';

/**
 * The event's icon and banner (lib/eventImage). Each saves the moment it's uploaded or removed.
 *
 * The icon preview is the real crest component fed the same fallback chain the rest of the site uses
 * — the event's own icon, else the clan's logo, else the generated crest — so what you see here is
 * what cards, the event header and Discord will show.
 */
export default function EventLookPanel({
  eventId,
  eventName,
  clanLogoUrl,
  initialIcon,
  initialBanner,
  initialBannerPosition,
}: {
  eventId: number;
  eventName: string;
  clanLogoUrl: string | null;
  initialIcon: string | null;
  initialBanner: string | null;
  initialBannerPosition: number | null;
}) {
  const router = useRouter();
  const [icon, setIcon] = useState(initialIcon);
  const [banner, setBanner] = useState(initialBanner);
  const [busy, setBusy] = useState<'icon' | 'banner' | null>(null);
  // Vertical focus, 0 (top) – 100 (bottom). Saved when the slider is let go, not on every tick.
  const [position, setPosition] = useState(initialBannerPosition ?? 50);
  const [savedPosition, setSavedPosition] = useState(initialBannerPosition ?? 50);
  const [error, setError] = useState<string | null>(null);

  async function savePosition() {
    if (position === savedPosition) return;
    setError(null);
    try {
      await save('bannerPosition', position === 50 ? null : position);
      setSavedPosition(position);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save(field: 'iconUrl' | 'bannerUrl' | 'bannerPosition', value: string | number | null) {
    const res = await clanFetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Could not save.');
    router.refresh();
  }

  async function upload(kind: 'icon' | 'banner', file: File) {
    setBusy(kind);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await clanFetch('/api/upload', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error ?? 'That upload did not work.');
      await save(kind === 'icon' ? 'iconUrl' : 'bannerUrl', data.url);
      if (kind === 'icon') setIcon(data.url);
      else setBanner(data.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: 'icon' | 'banner') {
    setBusy(kind);
    setError(null);
    try {
      await save(kind === 'icon' ? 'iconUrl' : 'bannerUrl', null);
      if (kind === 'icon') setIcon(null);
      else setBanner(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const picker = (kind: 'icon' | 'banner', has: boolean) => (
    <label className="inline-flex cursor-pointer items-center rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-gold/45 hover:text-foreground">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={busy !== null}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again (a retry) still fires a change.
          e.target.value = '';
          if (file) void upload(kind, file);
        }}
      />
      {busy === kind ? 'Uploading…' : has ? 'Replace' : 'Upload'}
    </label>
  );

  return (
    <section className="max-w-3xl border border-card-border rounded-xl p-5 bg-card-bg mb-6">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Look
      </h2>

      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <ClanCrest name={eventName} logoUrl={icon || clanLogoUrl} size={64} rounded="rounded-2xl" className="text-xl" />
          <div>
            <div className="text-sm font-semibold">Icon</div>
            <p className="text-xs text-text-muted mb-2">
              Square. Shown on event cards, the event page and Discord posts.{' '}
              {icon ? '' : clanLogoUrl ? 'Using your clan’s logo for now.' : 'Using your clan’s crest for now.'}
            </p>
            <div className="flex items-center gap-3">
              {picker('icon', !!icon)}
              {icon && (
                <button type="button" onClick={() => remove('icon')} disabled={busy !== null} className="text-xs text-text-muted hover:text-gold hover:underline underline-offset-4">
                  Remove — use the clan’s logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold">Banner</div>
          <p className="text-xs text-text-muted mb-2">
            Wide, 3:1 (e.g. 1500×500). Shown across the top of the event page and in link previews. The
            frame below is exactly what the event page shows — a 3:1 image fits whole; anything taller is
            cropped, and the slider picks which part stays.
          </p>
          <div className="mb-2 flex items-stretch gap-3">
            <div className="aspect-[3/1] min-w-0 flex-1 overflow-hidden rounded-lg border border-card-border bg-gradient-to-r from-gold/15 via-card-bg to-gold/10">
              {banner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner} alt="" className="h-full w-full object-cover" style={{ objectPosition: `50% ${position}%` }} />
              )}
            </div>
            {banner && (
              <div className="flex flex-col items-center gap-1 text-[10px] text-text-muted">
                <span>Top</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value))}
                  onPointerUp={() => void savePosition()}
                  onKeyUp={() => void savePosition()}
                  onBlur={() => void savePosition()}
                  aria-label="Which part of the banner shows"
                  className="flex-1 accent-gold [writing-mode:vertical-lr]"
                />
                <span>Bottom</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {picker('banner', !!banner)}
            {banner && (
              <button type="button" onClick={() => remove('banner')} disabled={busy !== null} className="text-xs text-text-muted hover:text-gold hover:underline underline-offset-4">
                Remove
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}
