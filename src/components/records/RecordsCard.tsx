import RecordsBoard from '@/components/records/RecordsBoard';
import { getAccountRecords } from '@/lib/records';

/**
 * A character's records: best day / week / month / year for each skill, boss and the two hours
 * metrics. Server component — loads its own rows so the profile's main fetch stays as it is.
 */
export default async function RecordsCard({ accountId }: { accountId: number }) {
  const rows = await getAccountRecords(accountId);
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-bold">Records</h2>
        <span className="text-xs text-text-muted">UTC days, Monday weeks</span>
      </div>
      <div className="border border-card-border rounded-xl bg-card-bg p-4">
        <RecordsBoard rows={rows} emptyText="No records yet. They're set as new gains come in, from when Anvil started tracking them." />
      </div>
    </section>
  );
}
