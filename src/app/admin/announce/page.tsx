import AnnounceClient from './AnnounceClient';

export const dynamic = 'force-dynamic';

export default function AdminAnnouncePage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Announce</h1>
        <p className="text-text-muted text-sm">
          Post a message to any Discord channel as the bot — long messages like rules are split
          automatically, and you can send it as an embed and optionally ping a role.
        </p>
      </header>
      <AnnounceClient />
    </div>
  );
}
