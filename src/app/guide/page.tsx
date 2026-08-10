import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Guides — Anvil',
  description: 'Setup guides for Anvil: the RuneLite plugin for players, and running an event for clan staff.',
};

const GUIDES = [
  {
    href: '/guide/plugin',
    eyebrow: 'For players',
    title: 'RuneLite plugin setup',
    blurb:
      'Install the plugin, connect it to this site, and let it submit your drops. Covers Discord notifications and OBS clips.',
    minutes: '~3 min setup',
  },
  {
    href: '/guide/admin',
    eyebrow: 'For clan staff',
    title: 'Running your first event',
    blurb:
      'Discord, roster sync, boards, tiles, teams and the draft, launching, and what to do once the event ends.',
    minutes: 'an evening, once',
  },
];

export default function GuidesPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        <h1 className="text-3xl font-bold">Guides</h1>
      </div>
      <p className="text-text-muted mb-8">
        Everything you need to get set up, written for the version of Anvil running right here.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {GUIDES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="group border border-card-border rounded-xl bg-card-bg p-5 hover:border-gold/40 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-widest text-gold mb-2">{g.eyebrow}</div>
            <div className="text-lg font-semibold mb-1 group-hover:text-gold-light transition-colors">
              {g.title}
            </div>
            <p className="text-sm text-text-muted mb-3">{g.blurb}</p>
            <div className="text-xs text-text-muted">{g.minutes}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
