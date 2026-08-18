import { caTierName, type ProgressView } from '@/lib/memberProgress';

/**
 * Quest points, combat achievements and diaries — the account progress the hiscores never carry
 * (lib/memberProgress), pushed by the plugin.
 *
 * Only rows that exist are drawn. A member whose plugin predates a key gets no line for it rather
 * than a zero, because "0 quest points" and "we have never been told" are different facts and only
 * one of them is about the player.
 */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-xl font-bold text-gold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
    </div>
  );
}

export default function AccountProgress({ progress }: { progress: ProgressView[] }) {
  if (progress.length === 0) return null;

  const find = (key: string) => progress.find((p) => p.key === key);
  const qp = find('questPoints');
  const caPoints = find('caPoints');
  const caTier = find('caTier');
  const diaries = progress.filter((p) => p.group === 'diaries');
  const diaryDone = diaries.reduce((sum, d) => sum + d.value, 0);
  const diaryTotal = diaries.reduce((sum, d) => sum + (d.max ?? 0), 0);

  return (
    <section className="mb-6">
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Account progress
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {qp && <Stat label="Quest points" value={qp.value.toLocaleString()} />}
        {caPoints && (
          <Stat
            label="Combat achievements"
            value={`${caPoints.value.toLocaleString()} pts`}
            sub={caTier ? `${caTierName(caTier.value)} cleared` : null}
          />
        )}
        {diaries.length > 0 && (
          <Stat label="Diaries" value={`${diaryDone}/${diaryTotal}`} sub="regions × tiers" />
        )}
        {find('diaryElite') && (
          <Stat
            label="Elite diaries"
            value={`${find('diaryElite')!.value}/${find('diaryElite')!.max ?? 12}`}
          />
        )}
      </div>
      {diaries.length > 0 && (
        <p className="text-[11px] text-text-muted mt-2">
          Karamja&apos;s easy, medium and hard tiers aren&apos;t machine-readable, so they sit outside
          this count.
        </p>
      )}
    </section>
  );
}
