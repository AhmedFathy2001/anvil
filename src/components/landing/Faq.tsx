import type { Faq as FaqItem } from '@/lib/answers';

/**
 * Questions and answers, open by default.
 *
 * Plain <details> so it works without JavaScript and every answer is in the server HTML — the text
 * a crawler reads must be the text the FAQPage markup claims (lib/jsonLd faqLd). Open by default
 * because hidden-until-clicked text is weighted lower, and these answers ARE the content.
 */
export default function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-card-border overflow-hidden rounded-2xl border border-card-border bg-card-bg">
      {items.map((f) => (
        <details key={f.q} open className="group px-5 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
            <h3 className="m-0 text-[15px] font-semibold">{f.q}</h3>
            <span aria-hidden className="mt-0.5 text-gold transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
