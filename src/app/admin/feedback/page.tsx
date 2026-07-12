import FeedbackAdminClient from './FeedbackAdminClient';

export const dynamic = 'force-dynamic';

// Staff triage for user-submitted bug reports & feedback. The API gates to admin/moderator; on
// managed hosting each item can be elevated to the central operator.
export default function AdminFeedbackPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gold mb-1 flex items-center gap-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        Feedback &amp; bug reports
      </h1>
      <p className="text-text-muted text-sm mb-6">
        What your members reported. Set a status, jot private notes, and — on managed hosting —
        elevate anything the Anvil operator should see.
      </p>
      <FeedbackAdminClient />
    </div>
  );
}
