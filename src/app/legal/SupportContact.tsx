import { SITE } from '@/lib/site';

/**
 * How to reach us, as a phrase rather than an address.
 *
 * The legal pages each hard-coded "email {contactEmail}", so the channel was welded into five
 * sentences and could only be changed by rewriting all of them — which is how they came to name a
 * mailbox that did not exist (see lib/site). A phrase keeps the verb with the channel: it reads
 * "email help@anvilosrs.com" when there is a mailbox and "message us on Discord" when there is not,
 * and the sentences around it are true either way.
 */
export default function SupportContact({ capitalise = false }: { capitalise?: boolean }) {
  if (SITE.contactEmail) {
    return (
      <>
        {capitalise ? 'Email' : 'email'} <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
      </>
    );
  }
  return (
    <>
      {capitalise ? 'Message' : 'message'} us on{' '}
      <a href={SITE.supportDiscord} target="_blank" rel="noopener noreferrer">
        Discord
      </a>
    </>
  );
}
