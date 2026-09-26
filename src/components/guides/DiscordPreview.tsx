'use client';

import { useMemo } from 'react';

import { renderGuide } from '@/lib/guideMarkdown';
import { renderGuideForDiscord, type GuideForDiscord } from '@/lib/guideDiscord';

/**
 * The guide as the bot will post it — rendered from the SAME function the poster uses
 * (lib/guideDiscord), so what an editor sees here is what the channel gets: the same message
 * boundaries, the same image placement, the same header and footer.
 */
export default function DiscordPreview({
  guide,
  origin,
  botName = 'Anvil',
}: {
  guide: GuideForDiscord;
  origin: string | null;
  botName?: string;
}) {
  const messages = useMemo(() => renderGuideForDiscord(guide, { origin }), [guide, origin]);

  return (
    <div className="rounded-lg bg-[#313338] p-3 font-[system-ui] text-[15px] leading-[1.375rem] text-[#dbdee1] sm:p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-[#949ba4]">
        <span>
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </span>
        <span>Discord preview</span>
      </div>
      {messages.map((m, i) => (
        <div key={i} className="group relative -mx-3 flex gap-3 px-3 py-1 hover:bg-black/10 sm:-mx-4 sm:px-4">
          <div className="w-10 shrink-0">
            {i === 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/icon-48.png" alt="" className="h-10 w-10 rounded-full bg-[#1e1f22] object-contain p-1" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {i === 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="font-medium text-[#f2f3f5]">{botName}</span>
                <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold leading-4 text-white">APP</span>
                <span className="text-xs text-[#949ba4]">Today</span>
              </div>
            )}
            {m.content && (
              <div className="whitespace-normal break-words [&_p]:my-0">{renderGuide(m.content, { theme: 'discord' })}</div>
            )}
            {m.embeds.length > 0 && (
              <div className={`mt-1 grid max-w-[420px] gap-1 ${m.embeds.length > 1 ? 'grid-cols-2' : ''}`}>
                {m.embeds.map((e, j) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={j}
                    src={e.image.url}
                    alt=""
                    className="max-h-[300px] w-full rounded object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
            <span
              className={`pointer-events-none absolute right-3 top-1 hidden text-[10px] group-hover:block ${
                m.content.length > 1900 ? 'text-amber-300' : 'text-[#949ba4]'
              }`}
            >
              {m.content.length}/2000
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
