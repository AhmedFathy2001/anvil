// Shared presentation pieces for the public /guide pages. Server components (bar the one anchor
// control) so the guides stay static-ish and cheap; every guide uses these so the pages can't drift
// into several different visual languages.
//
// The type here follows the PRODUCT, deliberately. The guides were written when the app's own pages
// were larger and looser, and they kept a display scale — 4xl mastheads, 2xl section heads, a body
// a step above everything else on the site — that had since become the only place on Anvil that
// looked like that. Somebody arriving from the coffer page shouldn't feel they left the app. So:
// a gold h1 at the app's own size, section heads at the app's own 17px with the same gold bar,
// and rows that look like the lists everywhere else.
//
// These hold no copy of their own beyond what a caller passes in — the words live in _i18n, and the
// few bits of chrome these render themselves ("Contents", "Step 3 · optional") arrive as the
// `common` block of the active dictionary — passed explicitly, because RSC has no context and a
// factory that closes over them trips react-hooks/static-components.

import HeadingAnchor from './HeadingAnchor';

export interface LegendItem {
  n: number;
  label: string;
  body: React.ReactNode;
}

export interface SectionLabels {
  step: string;
  optional: string;
  /** Title/aria for the `#` beside a heading, and what it says once the link is on the clipboard. */
  copyLink: string;
  linkCopied: string;
}

/** A numbered step in a guide. The number is the reading order, not decoration. */
export function Section({
  id,
  n,
  title,
  optional,
  labels,
  children,
}: {
  id: string;
  n: number;
  title: string;
  optional?: boolean;
  labels: SectionLabels;
  children: React.ReactNode;
}) {
  return (
    // `scroll-mt` so a heading landed on by its own anchor clears the sticky site nav instead of
    // hiding under it — the whole point of a copyable link is that it arrives somewhere readable.
    <section id={id} className="group scroll-mt-24">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-text-muted">
        {labels.step} {n}
        {optional && ` · ${labels.optional}`}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
        <h2 className="text-[17px] font-bold sm:text-lg">{title}</h2>
        <HeadingAnchor id={id} label={labels.copyLink} copiedLabel={labels.linkCopied} />
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Screenshot in a dark frame + the numbered legend matching the gold boxes drawn on the image. */
export function Figure({
  src,
  alt,
  caption,
  width,
  height,
  legend,
}: {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  legend: LegendItem[];
}) {
  return (
    <figure className="my-6 rounded-xl border border-card-border bg-card-bg p-4">
      <figcaption className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
        {caption}
      </figcaption>
      <div className="rounded-lg bg-brown-dark border border-card-border p-3 overflow-x-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="mx-auto max-w-full h-auto rounded"
        />
      </div>
      <ol className="mt-4 space-y-2.5">
        {legend.map((item) => (
          <li key={item.n} className="flex gap-3 text-sm">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gold text-brown-dark font-bold text-xs grid place-items-center">
              {item.n}
            </span>
            <span className="text-text-muted min-w-0">
              <span className="text-foreground font-medium">{item.label}</span> — {item.body}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function Note({
  tag,
  tone = 'gold',
  children,
}: {
  tag: string;
  tone?: 'gold' | 'green';
  children: React.ReactNode;
}) {
  const accent = tone === 'green' ? 'border-s-accent-green' : 'border-s-gold';
  return (
    <div className={`rounded-xl border border-card-border border-s-2 ${accent} bg-card-bg px-4 py-3`}>
      <div className="mb-1 text-[11px] uppercase tracking-widest text-text-muted">{tag}</div>
      <div className="space-y-2 text-sm text-text-muted">{children}</div>
    </div>
  );
}

/** In-game chat transcript — the lines the plugin actually prints, verbatim. */
export function Chat({
  lines,
}: {
  lines: { text: string; tone?: 'plain' | 'gold' | 'green' | 'muted' }[];
}) {
  const color = (t?: string) =>
    t === 'gold'
      ? 'text-gold-light'
      : t === 'green'
        ? 'text-accent-green-light'
        : t === 'muted'
          ? 'text-text-muted'
          : 'text-foreground/80';
  return (
    <div className="rounded-lg bg-brown-dark border border-card-border px-4 py-3 font-mono text-[13px] leading-7 overflow-x-auto">
      {lines.map((l, i) => (
        <div key={i} className={color(l.tone)}>
          {l.text}
        </div>
      ))}
    </div>
  );
}

/** Two-column reference rows (message → what to do, setting → what it means). */
export function Rows({ rows }: { rows: { term: React.ReactNode; body: React.ReactNode }[] }) {
  return (
    <div className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-4"
        >
          <span className="break-words font-semibold text-gold">{r.term}</span>
          <span className="text-text-muted">{r.body}</span>
        </div>
      ))}
    </div>
  );
}

/** Sticky contents rail + the guide's masthead, shared so every guide frames identically. */
export function GuideShell({
  eyebrow,
  minutes,
  title,
  dek,
  facts,
  sections,
  children,
  footnote,
  locale,
  labels,
  languages,
  notice,
}: {
  eyebrow: string;
  /** Approximate reading time. Declared per page: these are JSX, so there's no body text to count
   *  at render without shipping a parser for a two-word label. */
  minutes?: number;
  title: string;
  dek: React.ReactNode;
  facts?: { strong: string; rest: string }[];
  sections: { id: string; n: number; title: string }[];
  children: React.ReactNode;
  footnote?: React.ReactNode;
  /** BCP-47 code and writing direction of the copy inside. Set on the article, not on <html>: a
   *  nested route can't reach the document element, and a correct `lang` here is what a screen
   *  reader and the browser's own text shaping actually read. */
  locale?: { code: string; dir: 'ltr' | 'rtl' };
  labels: { contents: string; minRead: string };
  /** The same page in every other language. Rendered above the contents rail. */
  languages?: React.ReactNode;
  /** Shown before the body — used to admit that a translation is incomplete. */
  notice?: React.ReactNode;
}) {
  return (
    <div
      className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10"
      lang={locale?.code}
      dir={locale?.dir}
    >
      <aside className="hidden lg:block">
        <nav className="sticky top-24 text-sm" aria-label={labels.contents}>
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
            {labels.contents}
          </div>
          <ol className="space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex gap-2 rounded-lg px-2 py-1.5 text-[13px] text-text-muted transition-colors hover:bg-brown-light/40 hover:text-foreground"
                >
                  <span className="tabular-nums text-text-muted/60">{s.n}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <article className="max-w-3xl">
        {languages}
        <header className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] uppercase tracking-widest text-gold/80">{eyebrow}</span>
            {minutes !== undefined && (
              <>
                <span className="text-[11px] text-text-muted/50" aria-hidden>·</span>
                <span className="text-[11px] uppercase tracking-widest text-text-muted">
                  {labels.minRead.replace('{n}', String(minutes))}
                </span>
              </>
            )}
          </div>
          <h1 className="mb-3 text-2xl font-bold text-gold sm:text-3xl">{title}</h1>
          <p className="text-sm text-text-muted">{dek}</p>
          {facts && facts.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 text-[11.5px]">
              {facts.map((f) => (
                <span
                  key={f.strong}
                  className="rounded-lg border border-card-border bg-card-bg px-2.5 py-1 text-text-muted"
                >
                  <span className="font-semibold text-gold">{f.strong}</span> {f.rest}
                </span>
              ))}
            </div>
          )}
        </header>

        {notice}

        <div className="space-y-12">{children}</div>

        {footnote && (
          <p className="mt-12 border-t border-card-border pt-5 text-xs text-text-muted">{footnote}</p>
        )}
      </article>
    </div>
  );
}
