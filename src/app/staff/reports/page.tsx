import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

/**
 * Characters clans have raised with Anvil (lib/characterReports).
 *
 * Clans manage who sits on their roster; who OWNS a character is the platform's call, because a
 * character follows its person into every clan they play in. This is where those calls are made.
 */
export default function StaffReportsPage() {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Character reports
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Characters clans have asked Anvil to look at: disputed links, claims they vouch for, wrong owners.
      </p>
      <ReportsClient />
    </div>
  );
}
