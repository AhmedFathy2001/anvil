'use client';

// A themed <details> accordion for the Integrations "Advanced" groups. Collapsed by
// default so the page reads as a short Essentials list with optional depth underneath.
export default function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border border-card-border rounded-xl bg-card-bg/60 overflow-hidden"
    >
      <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none list-none hover:bg-card-bg-hover transition-colors">
        <span className="min-w-0">
          <span className="font-semibold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold/60 rounded-full" />
            {title}
          </span>
          {summary && <span className="block text-xs text-text-muted mt-1 ml-3">{summary}</span>}
        </span>
        <span className="text-text-muted text-sm shrink-0 transition-transform group-open:rotate-90">▸</span>
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>
    </details>
  );
}
