import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: `Terms of Service — ${SITE.name}`,
  description: `The terms that govern use of ${SITE.productName}.`,
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of {SITE.name}, a platform for
        running Old School RuneScape clan events operated by {SITE.legalEntity} (&ldquo;{SITE.name}
        &rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), available at {SITE.domain}. By creating an
        account, subscribing, or using the service you agree to these Terms. If you do not agree, do
        not use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        {SITE.name} is a platform for managing bingo events, rosters, weekly competitions, cross-clan
        events, and related features for your clan, together with a companion RuneLite plugin. Any
        clan can create a space and use the core features for free; a paid subscription unlocks higher
        limits and premium features. The Anvil application itself is open source, and this hosted
        platform is the option to have us run and maintain it for you.
      </p>

      <h2>2. Not affiliated with Jagex</h2>
      <p>
        {SITE.name} is an independent, third-party tool. It is not created by, endorsed by, or
        affiliated with Jagex Ltd. &ldquo;Old School RuneScape&rdquo; and &ldquo;RuneScape&rdquo; are
        trademarks of Jagex Ltd. You are responsible for ensuring your use of {SITE.name} and the
        companion plugin complies with the rules of any third-party game or service.
      </p>

      <h2>3. Eligibility and accounts</h2>
      <p>
        You must be at least 16 years old, or the age of digital consent in your country, to purchase
        a subscription. You are responsible for activity under your account and for keeping your login
        (Discord-based authentication) secure. You must provide accurate billing and contact
        information.
      </p>

      <h2>4. Free tier, subscriptions, billing, and trials</h2>
      <p>
        {SITE.name} is free to use, with paid tiers described on our <a href="/pricing">pricing page</a>{' '}
        that raise limits (such as the maximum active-roster member count) and unlock premium
        features. Paid tiers are sold on a recurring monthly subscription. A paid subscription may
        begin with a free trial as stated at checkout; you will not be charged until the trial ends,
        and you may cancel any time before then to avoid charges.
      </p>
      <p>
        <strong>
          Payments are processed by {SITE.paymentProcessor}, our authorized reseller and Merchant of
          Record.
        </strong>{' '}
        When you purchase a subscription, your order is fulfilled by {SITE.paymentProcessor}, and its{' '}
        <a href={SITE.processorTermsUrl} target="_blank" rel="noopener noreferrer">
          Buyer Terms
        </a>{' '}
        also apply to the transaction. {SITE.paymentProcessor} collects and remits any applicable
        sales tax or VAT. We do not receive or store your full payment-card details.
      </p>
      <p>
        Subscriptions renew automatically each billing period until cancelled. You can change tier or
        cancel at any time through the billing portal linked in your account; cancellation takes
        effect at the end of the current paid period, after which your clan returns to the free tier
        and keeps its data. Prices may change with advance notice, and any change applies from your
        next renewal.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for anything unlawful, or to store or distribute unlawful content.</li>
        <li>
          Upload content you do not have the right to share, or that is malicious, infringing, or
          harmful.
        </li>
        <li>
          Attempt to break, overload, reverse-engineer, or gain unauthorized access to the service,
          other clans&rsquo; data, or our infrastructure.
        </li>
        <li>Resell or sublicense the hosted service without our written permission.</li>
      </ul>
      <p>
        We may suspend or remove clans that violate these rules or that put our infrastructure or
        other customers at risk.
      </p>

      <h2>6. The Discord bot</h2>
      <p>
        {SITE.name} provides a Discord bot that a clan adds to its own server. Adding it is optional,
        and a clan can remove it at any time from that server&rsquo;s settings; nothing else about
        your clan on the platform depends on it.
      </p>
      <p>
        The bot posts announcements a clan configures (events, drops, results), can create channels,
        roles and webhooks where a clan grants those permissions, and answers slash commands such as{' '}
        <code>/bingo</code> with read-only information about that clan&rsquo;s board. It does not read
        ordinary chat messages. Slash-command replies are visible only to the person who ran the
        command unless they choose to share one.
      </p>
      <p>
        The server owner controls what the bot may do through Discord&rsquo;s own permission system.
        You are responsible for the permissions you grant it and for what your clan configures it to
        post.
      </p>

      <h2>7. Your data and content</h2>
      <p>
        You and your clan members retain ownership of the data you put into the platform (roster
        information, event data, uploaded screenshots, and similar). You grant us the limited rights
        needed to store, back up, and operate the platform on your behalf. Because Anvil is open
        source, you may export your data and self-host at any time. See our{' '}
        <a href="/legal/privacy">Privacy Policy</a> for how we handle personal data.
      </p>

      <h2>8. Service availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service. We may perform
        maintenance, deploy updates to the underlying application, and make reasonable changes to the
        service. We are not liable for downtime caused by factors outside our reasonable control.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may cancel at any time. We may suspend or terminate your subscription for non-payment,
        breach of these Terms, or to comply with the law. On termination we will, for a reasonable
        period, make your data available for export before deletion, except where we are required to
        retain or remove it.
      </p>

      <h2>10. Disclaimers and limitation of liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; without warranties of any kind to the extent
        permitted by law. To the maximum extent permitted by law, our total liability for any claim
        relating to the service is limited to the amount you paid us for the service in the three
        months before the claim. We are not liable for indirect, incidental, or consequential
        damages, or for loss of data beyond our obligation to maintain reasonable backups.
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be communicated by email or
        in-app. Continued use after changes take effect constitutes acceptance.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of {SITE.jurisdiction}, without regard to conflict-of-law
        rules. Mandatory consumer-protection rights in your country of residence still apply.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> or reach us on{' '}
        <a href={SITE.supportDiscord} target="_blank" rel="noopener noreferrer">
          Discord
        </a>
        .
      </p>
    </>
  );
}
