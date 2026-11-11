import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import SupportContact from '@/app/legal/SupportContact';

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
          <strong>Connected streaming accounts (Twitch, Kick, YouTube):</strong> only if you connect
          one. See section 4a for exactly what is read and kept.
        </li>
        <li>
          <strong>Technical:</strong> log data such as IP address, request metadata, and error
          diagnostics, used to operate and secure the service.
        </li>
        <li>
          <strong>Fair-play checks:</strong> to help a clan&rsquo;s staff spot boosted or shared
          accounts in its events, we compare the hiscores, personal bests and play times the plugin
          and hiscores already give us. On events whose organiser turns on account-sharing checks (the
          event&rsquo;s rules say so), we also record which network and country the plugin connects
          from: never the IP address itself, only a code that can be matched within that one event,
          and Cloudflare&rsquo;s country guess. These results are shown to the clan&rsquo;s staff only.
          They are reasons for a person to take a look, never an automatic penalty.
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
          <strong>Twitch Interactive, Inc., Kick Streaming Pty Ltd and Google LLC (YouTube)</strong> —
          only when you connect an account on one of them; see section 4a.
        </li>
        <li>
          <strong>Jagex Hiscores</strong> — public OSRS Hiscores are queried to refresh competition
          stats; we send RuneScape names you provide.
        </li>
      </ul>

      <h2>4a. Connected streaming accounts (Twitch, Kick, YouTube)</h2>
      <p>
        Streamers can limit who joins their events to their followers, subscribers or channel members,
        and can let a chat bot answer <code>!join</code> with their event link. Connecting an account is
        always optional and something you start yourself.
      </p>
      <ul>
        <li>
          <strong>If you join a streamer&rsquo;s event as a viewer:</strong> we use your sign-in only to
          learn which account is yours and whether you follow, subscribe to or are a member of that
          streamer&rsquo;s channel. We keep your account&rsquo;s ID and name, and that yes/no answer with
          the time we checked. We do not keep your access token: it is used once and then revoked.
        </li>
        <li>
          <strong>If you connect your own channel as a host:</strong> we keep your channel&rsquo;s ID and
          name and an access token, encrypted, so we can check your followers or subscribers when
          someone joins, and (if you turn it on) reply to <code>!join</code> in your chat. On Kick we also
          receive your channel&rsquo;s chat messages, follows and subscriptions as they happen; we keep only
          the follow and subscription facts and codes typed to link an account, never the chat itself.
        </li>
        <li>
          <strong>Never shared or sold.</strong> This information is used only to decide who may join the
          events you take part in or host. It is not shown to anyone else, used for advertising, or
          passed to other parties.
        </li>
        <li>
          <strong>Removing it:</strong> disconnect the account in {SITE.name} at any time and we delete
          the stored ID, name, tokens and checks. You can also revoke {SITE.name}&rsquo;s access from the
          platform itself (for Google, at{' '}
          <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">
            Google security settings
          </a>
          ).
        </li>
      </ul>
      <p>
        <strong>YouTube.</strong> {SITE.name} uses YouTube API Services. By connecting a YouTube account
        you agree to the{' '}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
          YouTube Terms of Service
        </a>
        , and Google&rsquo;s handling of your data is covered by the{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google Privacy Policy
        </a>
        . We request read-only access (<code>youtube.readonly</code>) and use it only to read your
        channel&rsquo;s ID and name, whether you subscribe to a host&rsquo;s channel, and, while a host is
        live, the author of a chat message containing your joining code. {SITE.name}&rsquo;s use of
        information received from Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including its Limited Use requirements.
      </p>

      <h2>4b. How we protect your data</h2>
      <p>
        We treat the access tokens and account details from connected accounts (including data
        received from Google APIs) as sensitive data, and protect them as follows:
      </p>
      <ul>
        <li>
          <strong>Encryption in transit:</strong> all traffic to {SITE.name} uses HTTPS (TLS), with HSTS
          enforced, and every request we make to Google, Twitch and Kick is made over HTTPS.
        </li>
        <li>
          <strong>Encryption at rest:</strong> the only tokens we store (a host&rsquo;s connected channel)
          are encrypted with AES-256-GCM before they are written to the database. The encryption key is
          kept separately from the database, so a copy of the database or its backups alone cannot be
          used to read them.
        </li>
        <li>
          <strong>Minimal data, minimal time:</strong> we request only read-only access
          (<code>youtube.readonly</code> for YouTube). A viewer&rsquo;s token is used for a single check
          and revoked straight away, never stored. A subscription or membership check is trusted for one
          day and then checked again. Disconnecting an account deletes its stored ID, name, tokens and
          checks.
        </li>
        <li>
          <strong>Restricted access:</strong> our servers are not reachable directly from the internet:
          web traffic arrives only through Cloudflare, and a firewall blocks every other inbound
          connection except restricted administrative access. The database is reachable only from our own
          application. Only the operator of {SITE.name} has administrative access to production systems.
        </li>
        <li>
          <strong>No human reading:</strong> no person reads data received from Google APIs unless you ask
          us to (for example, for support), it is needed for security purposes such as investigating
          abuse, or the law requires it.
        </li>
        <li>
          <strong>No other use:</strong> data received from Google APIs is never sold, used for
          advertising, transferred to other parties, or used to develop or train AI or machine-learning
          models.
        </li>
        <li>
          <strong>Incidents:</strong> if a security breach affects your data, we will revoke the affected
          tokens and notify you and, where required, the relevant authorities without undue delay.
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
      <p>
        Images attached to an event — drop and completion screenshots, starting shots, and sign-up fee
        and payout payment proofs — are deleted 90 days after the event ends. The event&rsquo;s records
        (its results, and who submitted or completed what and when) are kept. Before then, a clan&rsquo;s
        organisers can download the whole event, images included, as an archive. Payment-proof
        screenshots may be removed sooner, once the payment they show has been confirmed. Daily database
        backups are kept for 14 days.
      </p>
      <p>
        Network codes and countries recorded for account-sharing checks are deleted 30 days after the
        event ends.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, export, delete, or
        restrict processing of your personal data, and to object to certain processing. To exercise
        these rights, <SupportContact />. If a request concerns data a
        clan holds about its members, we may direct it to the clan operator who controls that data.
        You may also lodge a complaint with your local data-protection authority.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use strictly necessary cookies to keep you signed in and to operate the service. We do not
        use advertising cookies. Our payment provider may set cookies during checkout as described in
        their privacy notice.
      </p>

      <p className="font-semibold text-gray-200">Visit statistics</p>
      <p>
        To see how the site is used and where people get stuck, we count page views ourselves, in our
        own database. We record the kind of page (for example &ldquo;an event page&rdquo;, never the
        address you typed or a player name), the website you arrived from (the site name only), whether
        your screen is a phone, tablet or desktop, and roughly how long you stayed on a page. A random
        number held in your browser tab, which disappears when you close it, links one visit&rsquo;s
        pages together; it is not a cookie and is not stored on your device afterwards. When you sign
        in or take a step such as creating a clan or linking the plugin, we may attach your account to
        that step, and when you create an account we note once where you first came from. No third
        parties receive any of this, nothing is used for advertising, and we keep it for up to 400
        days. If your browser sends Do Not Track or Global Privacy Control, we do not count your visits.
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
        For any privacy question or request, <SupportContact />.
      </p>
    </>
  );
}
