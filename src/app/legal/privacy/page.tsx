import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: `Privacy Policy — ${SITE.name}`,
  description: `How ${SITE.productName} collects, uses, and protects personal data.`,
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        This Privacy Policy explains how {SITE.legalEntity} (&ldquo;{SITE.name}&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and protects personal data when you use{' '}
        {SITE.name}, our platform for running Old School RuneScape clan events at {SITE.domain}.
      </p>

      <h2>1. Who we are</h2>
      <p>
        {SITE.legalEntity} is the data controller for account and billing data described below. For
        the clan data you and your members put into the platform, you (the clan operator) are the
        controller and we act as your processor, storing and processing it on your behalf.
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li>
          <strong>Account &amp; contact:</strong> your email address and the Discord identity you
          sign in with (Discord user ID, username, avatar).
        </li>
        <li>
          <strong>Billing:</strong> subscription tier and status, and limited transaction metadata.
          Payment-card details are collected and processed by {SITE.paymentProcessor} — we do not
          see or store full card numbers.
        </li>
        <li>
          <strong>Clan data (processed on your behalf):</strong> roster and player information your
          clan enters (such as RuneScape names and Discord IDs), event and competition data, and
          images uploaded as drop or fee proof.
        </li>
        <li>
          <strong>Discord bot interactions:</strong> when someone runs one of the bot&rsquo;s slash
          commands (such as <code>/bingo</code>) in a server the bot has been added to, Discord sends
          us the command used, its arguments, the server and channel it was run in, and the Discord
          user ID of the person who ran it. The user ID is used to look that person up on the
          clan&rsquo;s roster so the reply is about them; the interaction itself is not stored, and
          the bot does not read ordinary chat messages.
        </li>
        <li>
          <strong>Technical:</strong> log data such as IP address, request metadata, and error
          diagnostics, used to operate and secure the service.
        </li>
      </ul>

      <h2>3. How we use data</h2>
      <ul>
        <li>To run, maintain, and back up the platform and your clan&rsquo;s data on it.</li>
        <li>To process subscriptions, prevent fraud, and provide support.</li>
        <li>To communicate service, billing, and security notices.</li>
        <li>To secure, monitor, and improve the service, and to comply with legal obligations.</li>
      </ul>
      <p>
        Our legal bases (where the GDPR applies) are performance of our contract with you, our
        legitimate interests in operating and securing the service, and compliance with legal
        obligations.
      </p>

      <h2>4. Service providers (sub-processors)</h2>
      <p>We share data with the following providers only as needed to run the service:</p>
      <ul>
        <li>
          <strong>{SITE.paymentProcessor}</strong> — payments, billing, and tax as Merchant of
          Record. See its{' '}
          <a href={SITE.processorPrivacyUrl} target="_blank" rel="noopener noreferrer">
            privacy notice
          </a>
          .
        </li>
        <li>
          <strong>Hetzner Online GmbH</strong> — server hosting (Germany / EU).
        </li>
        <li>
          <strong>Cloudflare, Inc.</strong> — DNS, network/security, and R2 object storage for
          uploaded media.
        </li>
        <li>
          <strong>Discord, Inc.</strong> — authentication (login) and, where you enable it, bot
          integrations for your clan.
        </li>
        <li>
          <strong>Jagex Hiscores</strong> — public OSRS Hiscores are queried to refresh competition
          stats; we send RuneScape names you provide.
        </li>
      </ul>

      <h2>5. International transfers</h2>
      <p>
        Our servers are located in the EU. Some providers above may process data in other countries;
        where required, such transfers rely on appropriate safeguards such as Standard Contractual
        Clauses.
      </p>

      <h2>6. Retention</h2>
      <p>
        We keep account and billing data for as long as your subscription is active and as required
        for legal, tax, and accounting purposes afterward. Your clan&rsquo;s data is retained while
        your clan exists on the platform; if you delete your clan we keep it for a short grace period
        to allow export, then delete it along with associated backups. Ending a paid subscription
        does not delete your clan&rsquo;s data — it returns to the free tier.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, export, delete, or
        restrict processing of your personal data, and to object to certain processing. To exercise
        these rights, email{' '}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. If a request concerns data a
        clan holds about its members, we may direct it to the clan operator who controls that data.
        You may also lodge a complaint with your local data-protection authority.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use strictly necessary cookies to keep you signed in and to operate the service. We do not
        use advertising cookies. Our payment provider may set cookies during checkout as described in
        their privacy notice.
      </p>

      <h2>9. Children</h2>
      <p>
        The service is not directed to children under 16. We do not knowingly collect personal data
        from children under 16. If you believe a child has provided us data, contact us and we will
        remove it.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy from time to time. Material changes will be communicated by email or
        in-app, and the &ldquo;last updated&rdquo; date below will change.
      </p>

      <h2>11. Contact</h2>
      <p>
        For any privacy question or request, email{' '}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </>
  );
}
