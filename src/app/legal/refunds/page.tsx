import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: `Refund & Cancellation Policy — ${SITE.name}`,
  description: `Refund and cancellation policy for ${SITE.productName}.`,
};

export default function RefundsPage() {
  return (
    <>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p>
        This policy explains how cancellations and refunds work for {SITE.name} subscriptions.
        Payments are handled by {SITE.paymentProcessor} as our Merchant of Record, so refunds are
        issued through {SITE.paymentProcessor}; its{' '}
        <a href={SITE.processorTermsUrl} target="_blank" rel="noopener noreferrer">
          Buyer Terms
        </a>{' '}
        also apply.
      </p>

      <h2>1. Free tier and trial</h2>
      <p>
        The core of {SITE.name} is free to use — you can create a clan and run events without paying.
        A paid subscription may start with a free trial as stated at checkout; you are not charged
        during the trial, and you can cancel any time before it ends to avoid being billed at all. We
        recommend trying a paid tier during the trial to make sure it fits your clan.
      </p>

      <h2>2. Cancelling</h2>
      <p>
        You can cancel your subscription at any time from the billing portal linked in your account.
        Cancellation stops future renewals and takes effect at the end of your current paid period.
        Your clan is not deleted — it simply returns to the free tier and keeps all of its data; only
        the paid limits and features end.
      </p>

      <h2>3. Refunds</h2>
      <p>
        Because the free tier and a free trial let you evaluate the service before paying, we
        generally do not refund subscription periods that have already started, and we do not provide
        partial refunds for unused time after a cancellation.
      </p>
      <p>
        That said, we want you to be treated fairly. If you were charged in error, experienced a
        significant service failure on our side, or were billed because of a clearly accidental
        renewal, contact us within <strong>14 days</strong> of the charge and we will review your case
        and, where appropriate, arrange a full or partial refund through {SITE.paymentProcessor}.
      </p>

      <h2>4. Custom tier</h2>
      <p>
        Custom (enterprise) arrangements may have their own billing and refund terms set out in a
        separate agreement; where they differ, that agreement governs.
      </p>

      <h2>5. How to request a refund</h2>
      <p>
        Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> with the email address
        used at checkout and your order or receipt details. Approved refunds are returned to your
        original payment method by {SITE.paymentProcessor}; the time to appear depends on your bank or
        card issuer.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        If you have a billing concern, please contact us first — we can usually resolve it faster than
        a chargeback. Filing a chargeback may result in suspension of the associated subscription
        while the dispute is investigated.
      </p>
    </>
  );
}
