import ClanLink from '@/components/ClanLink';
import { SITE } from '@/lib/site';

// Shared chrome + prose styling for the legal pages (terms / privacy / refunds). The child selectors
// style the plain semantic HTML in each page, so the pages themselves stay readable prose.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <ClanLink href="/" className="text-sm text-gold hover:text-gold-light">
        ← {SITE.name}
      </ClanLink>
      <article
        className="
          mt-6
          [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-gold [&_h1]:display
          [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground
          [&_h2]:scroll-mt-20
          [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-text-muted
          [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ul]:text-text-muted
          [&_li]:leading-relaxed
          [&_a]:text-gold [&_a:hover]:text-gold-light [&_a]:underline [&_a]:underline-offset-2
          [&_code]:rounded [&_code]:bg-card-bg [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]
          [&_strong]:text-foreground
        "
      >
        {children}
        <p className="mt-12 border-t border-card-border pt-6 text-sm text-text-muted/70">
          Last updated: {SITE.lastUpdated}. Questions? Email{' '}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </p>
      </article>
    </main>
  );
}
