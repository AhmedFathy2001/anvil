import type { ReactNode } from 'react';

export interface PreviewEmbed {
  author?: { name: string };
  title?: string;
  description?: string;
  fields?: { name: string; value: string }[];
}

/** Discord's bold and its relative time, and nothing else: enough to read a sample post on the site. */
function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|<t:\d+:R>)/g).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    const time = /^<t:(\d+):R>$/.exec(part);
    if (time) {
      const hours = Math.round((Number(time[1]) * 1000 - Date.now()) / 3_600_000);
      return <span key={i}>{hours >= 48 ? `in ${Math.round(hours / 24)} days` : `in ${Math.max(1, hours)} hours`}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

/** A sample competition post drawn the way Discord lays an embed out. Made-up players; nothing is sent. */
export default function CompetitionPostPreview({ embed }: { embed: PreviewEmbed }) {
  return (
    <div className="max-w-xl rounded-md border border-card-border border-l-4 border-l-gold bg-brown-dark px-4 py-3 text-[13px] leading-relaxed">
      {embed.author && <div className="text-[12px] font-medium text-text-muted">{embed.author.name}</div>}
      {embed.title && <div className="mt-0.5 break-words font-semibold text-foreground">{embed.title}</div>}
      {embed.description && <p className="mt-1 whitespace-pre-line break-words text-text-muted">{rich(embed.description)}</p>}
      {(embed.fields ?? []).map((f) => (
        <div key={f.name} className="mt-2.5">
          <div className="text-[12px] font-semibold text-foreground">{f.name}</div>
          <div className="whitespace-pre-line break-words text-text-muted">{rich(f.value)}</div>
        </div>
      ))}
    </div>
  );
}
