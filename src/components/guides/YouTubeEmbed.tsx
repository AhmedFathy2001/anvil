'use client';

import { useState } from 'react';

import { fmtStart, youTubeEmbedUrl, youTubePoster, type YouTubeRef } from '@/lib/youtube';

/**
 * A guide's video: a poster until clicked, then our fixed youtube-nocookie player. Nothing is
 * requested from YouTube's player host before the click (the poster is a plain image).
 */
export default function YouTubeEmbed({ video, title }: { video: YouTubeRef; title?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="my-3 aspect-video w-full max-w-xl overflow-hidden rounded-lg border border-card-border bg-black/40">
      {on ? (
        <iframe
          src={youTubeEmbedUrl(video)}
          title={title ?? 'YouTube video'}
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group relative block h-full w-full" aria-label={`Play video${video.start ? ` from ${fmtStart(video.start)}` : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={youTubePoster(video)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-gold ring-1 ring-gold/60">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[11px] text-text-muted">
            Plays from YouTube when clicked{video.start ? ` · from ${fmtStart(video.start)}` : ''}
          </span>
        </button>
      )}
    </div>
  );
}
