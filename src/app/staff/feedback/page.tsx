import FeedbackClient from './FeedbackClient';

export const dynamic = 'force-dynamic';

/**
 * Feedback and bug reports, across every clan.
 *
 * This lived in each clan's admin area, where it was somebody else's job on somebody else's screen:
 * the reports are about ANVIL, and on one site there is one product and one operator. A clan admin
 * could set a status and write private notes on a bug they cannot fix, then "elevate" it — a POST to
 * the separate Anvil.Admin control plane, forwarding a row to another service to tell it something
 * this database already holds, now that the operator reads this same database here.
 *
 * So the triage moved and the forwarding went away. What did NOT move is the intake: members still
 * report from their own clan at /feedback, and each row still carries the clan it came from, which
 * is the column that makes this list readable.
 */
export default function StaffFeedbackPage() {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Feedback &amp; bug reports
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        What people reported, from every clan on the platform.
      </p>
      <FeedbackClient />
    </div>
  );
}
