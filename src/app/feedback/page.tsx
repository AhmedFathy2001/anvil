import { verifyUser } from '@/lib/auth';
import FeedbackForm from './FeedbackForm';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const session = await verifyUser();
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Feedback &amp; bug reports</h1>
      <p className="text-text-muted text-sm mb-6">
        Found a bug or have an idea? Tell us — it goes straight to the clan admins.
      </p>
      {session ? (
        <FeedbackForm />
      ) : (
        <div className="border border-card-border rounded-xl p-6 text-center text-text-muted">
          <p className="mb-3">Please sign in to send feedback.</p>
          <ClanLink
            href="/login?return=/feedback"
            className="inline-block text-sm font-medium px-4 py-2 rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-colors"
          >
            Sign in
          </ClanLink>
        </div>
      )}
    </div>
  );
}
