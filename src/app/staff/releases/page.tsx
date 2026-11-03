import { requirePlatformPage } from '@/lib/platformAccess';
import { ANNOUNCEMENTS_WEBHOOK_KEY, getPlatformSetting, listPublishedReleases, loadReleaseFiles } from '@/lib/releases';
import ClanLink from '@/components/ClanLink';
import AnnouncementsWebhook from './AnnouncementsWebhook';

export const dynamic = 'force-dynamic';

/**
 * Releases: what shipped, and where it was announced.
 *
 * The words are written in the repo (releases/<version>.md) and approved before promote.sh will ship
 * production; a production build announces its own release once it is live. This page is the record
 * and the one setting (#anvil-announcements). Nothing here publishes on a click.
 */
export default async function StaffReleasesPage() {
  await requirePlatformPage('support');
  const [published, bundled, hook] = await Promise.all([
    listPublishedReleases(),
    loadReleaseFiles(),
    getPlatformSetting(ANNOUNCEMENTS_WEBHOOK_KEY),
  ]);
  const shipped = new Set(published.map((p) => p.version));
  const waiting = bundled.filter((b) => !shipped.has(b.version));
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Releases
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Written in <code>releases/&lt;version&gt;.md</code>, approved before promoting, announced once by the
        production build that ships it. <ClanLink href="/changelog" className="text-gold hover:text-gold-light">Public changelog</ClanLink>
      </p>

      <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-2 font-semibold">#anvil-announcements</h2>
        <AnnouncementsWebhook isSet={!!hook} />
      </section>

      {waiting.length > 0 && (
        <section className="mb-6 rounded-xl border border-gold/35 bg-gold/[0.05] p-5">
          <h2 className="mb-2 font-semibold">In this build, not announced yet</h2>
          <ul className="grid gap-1 text-sm">
            {waiting.map((w) => (
              <li key={w.version}>
                {w.version} · {w.title}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-dim">Announced by the next lifecycle tick on production once #anvil-announcements is set; beta never announces.</p>
        </section>
      )}

      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-3 font-semibold">Shipped</h2>
        {published.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing yet.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {published.map((p) => (
              <li key={p.version} className="flex flex-wrap justify-between gap-2">
                <span>
                  <b>{p.version}</b> · {p.note.title}
                </span>
                <span className="text-text-dim">{p.publishedAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
