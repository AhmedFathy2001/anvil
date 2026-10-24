import ChatPatternsClient from './ChatPatternsClient';

export const dynamic = 'force-dynamic';

/**
 * The chat lines every plugin parses, and their live overrides (lib/chatPatterns). When Jagex
 * rewords a line, fix it here and every plugin on a release that advertises `chat-patterns` picks it
 * up within ~30 minutes — no hub release.
 */
export default function StaffChatPatternsPage() {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Chat patterns
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Each key is a line the plugin recognises. An override replaces the built-in regex for every plugin on its next
        poll (~30 min); the plugin re-checks it and keeps its default on anything it rejects, or that runs too long on a
        real line. Delete an override to go back to the built-in.
      </p>
      <ChatPatternsClient />
    </div>
  );
}
