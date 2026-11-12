'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { MotionImage } from '@/components/ProfileMedia';
import SupporterName from '@/components/SupporterName';
import type { Palette, Tone } from '@/lib/chatFeedRules';
import { ANVIL_COLORS, canCustomColors } from '@/lib/chatLook';
import { canAnimateProfileMedia, type ShownProfileMedia } from '@/lib/profileMediaRules';
import { TRANSPARENT_CHAT_BACKGROUND, tierCovers, type SupporterStyle } from '@/lib/supporterStyle';
import { SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';
import { OnlyYouNote, TIER_LABEL } from './_ui';

/**
 * The live preview on Settings → Profile & look: a profile card and a small in-game chatbox, drawn
 * from whatever the editors on the page hold right now (saved or not). Each editor publishes its
 * draft here; with no provider around them (anywhere else they're used) publishing is a no-op.
 *
 * It shows the person's CHOICE, whatever their tier: that is the point of trying before buying. What
 * everyone else sees is decided on the server, by the tier in force, on every read.
 */

export interface PreviewFlair {
  /** The tier the look is drawn at (the one being tried, or held). Null: a plain name. */
  tier: SupporterTierId | null;
  style: SupporterStyle | null;
}

export interface PreviewChat {
  palette: Palette;
  colors: Partial<Record<Tone, string>>;
  tagColor: string | null;
}

interface PreviewState {
  media: ShownProfileMedia;
  /** The Anvil display name's look (the profile card). */
  flair: PreviewFlair;
  /** The main character's look (its name in game chat). */
  chatFlair: PreviewFlair;
  chat: PreviewChat | null;
}

interface PreviewApi extends PreviewState {
  setMedia: (m: ShownProfileMedia) => void;
  setFlair: (f: PreviewFlair, character?: PreviewFlair) => void;
  setChat: (c: PreviewChat) => void;
}

const Ctx = createContext<PreviewApi | null>(null);

/** The preview's state, or null outside Profile & look. */
export function useLookPreview(): PreviewApi | null {
  return useContext(Ctx);
}

export function LookPreviewProvider({ initial, children }: { initial: PreviewState; children: ReactNode }) {
  const [media, setMedia] = useState(initial.media);
  const [flair, setFlairState] = useState(initial.flair);
  const [chatFlair, setChatFlair] = useState(initial.chatFlair);
  const [chat, setChat] = useState(initial.chat);
  const setFlair = useCallback((f: PreviewFlair, character?: PreviewFlair) => {
    setFlairState(f);
    setChatFlair(character ?? f);
  }, []);
  const api = useMemo(
    () => ({ media, flair, chatFlair, chat, setMedia, setFlair, setChat }),
    [media, flair, chatFlair, chat, setFlair],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const rank = (t: SupporterTierId) => SUPPORTER_TIER_ORDER.indexOf(t);
const DEFAULT_TAG = '#ffd700';
/** RuneScape's public-chat blue on the transparent chatbox. */
const PUBLIC_CHAT = '#9090ff';

/** The two previews, side by side where there's room, with one note for whatever only they can see. */
export function LookPreview({ name, rsn, held }: { name: string; rsn: string | null; held: SupporterTierId | null }) {
  const p = useLookPreview();
  if (!p) return null;
  const { media, flair, chatFlair, chat } = p;

  // What the preview shows that their tier doesn't cover yet.
  const gaps: { what: string; need: SupporterTierId }[] = [];
  if (flair.tier && !tierCovers(held, flair.tier)) gaps.push({ what: 'name colours', need: flair.tier });
  if ((media.avatar?.animated || media.banner?.animated) && !canAnimateProfileMedia(held)) gaps.push({ what: 'moving pictures', need: 'champion' });
  if (chat?.palette === 'custom' && !canCustomColors(held)) gaps.push({ what: 'chat line colours', need: 'supporter' });
  const need = gaps.reduce<SupporterTierId | null>((m, g) => (!m || rank(g.need) > rank(m) ? g.need : m), null);
  const what = gaps.map((g) => `${g.what} (${TIER_LABEL[g.need]})`).join(', ');

  const tone = (t: Tone) => (!chat || chat.palette === 'plain' ? '#ffffff' : (chat.palette === 'custom' && chat.colors[t]) || ANVIL_COLORS[t]);
  const tag = chat?.tagColor ?? DEFAULT_TAG;
  const who = rsn ?? name;

  return (
    <div className="rounded-xl border border-gold/30 bg-card-bg p-3 shadow-lg shadow-black/30" aria-label="Preview of your look">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-dim">Preview</p>
        <p className="text-[11.5px] text-text-dim">Updates as you change things</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* The profile card */}
        <div className="overflow-hidden rounded-lg border border-card-border bg-background/40">
          <div className="aspect-[3/1] bg-gradient-to-r from-gold/15 via-card-bg to-gold/10">
            {media.banner && (
              <MotionImage
                media={media.banner}
                className="h-full w-full object-cover"
                style={{ objectPosition: `50% ${media.banner.position}%` }}
              />
            )}
          </div>
          <div className="flex items-end gap-2.5 px-3 pb-3">
            <div className="-mt-6 shrink-0">
              {media.avatar ? (
                <MotionImage media={media.avatar} width={48} height={48} className="h-12 w-12 rounded-full border-2 border-gold/45 object-cover" />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-gold/45 bg-brown-dark text-lg font-bold text-gold-light">
                  {(name || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 pb-0.5">
              <SupporterName name={name} tier={flair.tier} style={flair.style} plain className="text-[15px] font-semibold" />
              <p className="text-[11.5px] text-text-dim">{flair.tier ? `Anvil ${TIER_LABEL[flair.tier]}` : 'Anvil member'}</p>
            </div>
          </div>
        </div>

        {/* A slice of the RuneLite chatbox */}
        <div
          className="min-w-0 rounded-lg border border-card-border px-2.5 py-2 font-mono text-[12px] leading-[1.55]"
          style={{ backgroundColor: TRANSPARENT_CHAT_BACKGROUND }}
          aria-label="In-game chat preview"
        >
          <p className="truncate">
            <SupporterName name={who} tier={chatFlair.tier} style={chatFlair.style} star={!!chatFlair.tier} plain className="font-semibold" />
            <span style={{ color: PUBLIC_CHAT }}>: gz on the pet!</span>
          </p>
          <p className="break-words">
            <span style={{ color: tag }}>[Anvil]</span> <span style={{ color: tone('drop') }}>{who} received a drop: Twisted bow (1.2b)</span>
          </p>
          <p className="break-words">
            <span style={{ color: tag }}>[Anvil]</span> <span style={{ color: tone('done') }}>Your team completed Barrows gloves</span>
          </p>
          <p className="break-words">
            <span style={{ color: tag }}>[Anvil]</span> <span style={{ color: tone('near') }}>2 more Vorkath kills for the tile</span>
          </p>
          <p className="break-words">
            <span style={{ color: tag }}>[Anvil]</span> <span style={{ color: tone('feed') }}>Team Red completed Fire cape</span>
          </p>
        </div>
      </div>
      {need && (
        <div className="mt-3">
          <OnlyYouNote need={need} held={held} what={what.charAt(0).toUpperCase() + what.slice(1)} />
        </div>
      )}
    </div>
  );
}
