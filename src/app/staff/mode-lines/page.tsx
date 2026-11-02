import ModeLinesClient from './ModeLinesClient';

export const dynamic = 'force-dynamic';

/**
 * Game-mode event lines (lib/modeLines): the patterns that turn a Leagues or Deadman chat line into a
 * post, and the lines players saw that none of them knew.
 */
export default function StaffModeLinesPage() {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Game-mode lines
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        On Leagues, Deadman and other game-mode worlds the plugin sends the highlighted game messages here. A line a
        pattern knows becomes a post (relic, area, pact, task…). A line that starts &ldquo;Congratulations&rdquo; or
        &ldquo;You&apos;ve unlocked&rdquo; is posted as it stands. Everything else waits below, most-seen first, for a
        pattern or a dismissal. Changes reach the next line within a minute; no plugin release.
      </p>
      <ModeLinesClient />
    </div>
  );
}
