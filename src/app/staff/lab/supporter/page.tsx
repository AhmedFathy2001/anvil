import ClanLink from '@/components/ClanLink';

import SupporterLabClient from './SupporterLabClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Supporter lab' };

/**
 * The Supporter test bench (lib/labSupporter): give yourself any tier for a day, and fill the hidden
 * lab clan with test clanmates' drops to try the plugin's Recent drops, GZ and gold GZ.
 */
export default function StaffLabSupporterPage() {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Supporter lab
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Try every Supporter tier without paying, and the plugin&rsquo;s drops feed without waiting for a pet.{' '}
        <ClanLink href="/staff/lab" className="text-gold hover:underline">Back to the tile lab</ClanLink>
      </p>
      <SupporterLabClient />
    </div>
  );
}
