// Shared presentation pieces for the public /guide pages. Server components (no interactivity) so
// the guides stay static-ish and cheap; every guide uses these so the two pages can't drift into
// two different visual languages.

export interface LegendItem {
  n: number;
  label: string;
  body: React.ReactNode;
}

/** A numbered step in a guide. The number is the reading order, not decoration. */
export function Section({
  id,
  n,
  title,
  optional,
  children,
}: {
  id: string;
  n: number;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">
        Step {n}
        {optional && ' · optional'}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-6 bg-gold rounded-full" />
        <h2 className="text-2xl font-semibold">{title}</h2>
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
    <figure className="border border-card-border rounded-xl bg-card-bg p-4 my-6">
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
  const accent = tone === 'green' ? 'border-l-accent-green' : 'border-l-gold';
  return (
    <div className={`border border-card-border border-l-2 ${accent} rounded-r-lg bg-card-bg px-4 py-3`}>
      <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">{tag}</div>
      <div className="text-sm text-text-muted space-y-2">{children}</div>
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
    <div className="border border-card-border rounded-xl overflow-hidden">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-1 sm:gap-4 px-4 py-3 text-sm ${
            i % 2 ? 'bg-card-bg' : 'bg-tile-bg'
          }`}
        >
          <span className="text-gold/90 break-words">{r.term}</span>
          <span className="text-text-muted">{r.body}</span>
        </div>
      ))}
    </div>
  );
}

/** Sticky contents rail + the guide's masthead, shared so both guides frame identically. */
export function GuideShell({
  eyebrow,
  title,
  dek,
  facts,
  sections,
  children,
  footnote,
}: {
  eyebrow: string;
  title: string;
  dek: React.ReactNode;
  facts?: { strong: string; rest: string }[];
  sections: { id: string; n: number; title: string }[];
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 text-sm" aria-label="Contents">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">Contents</div>
          <ol className="space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex gap-2 px-2 py-1 rounded-md text-text-muted hover:text-foreground hover:bg-brown-light transition-colors"
                >
                  <span className="text-text-muted/70 tabular-nums">{s.n}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <article className="max-w-3xl">
        <header className="mb-10">
          <div className="text-[11px] uppercase tracking-widest text-gold mb-2">{eyebrow}</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{title}</h1>
          <p className="text-text-muted">{dek}</p>
          {facts && facts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5 text-xs">
              {facts.map((f) => (
                <span key={f.strong} className="border border-card-border rounded-full px-3 py-1 text-text-muted">
                  <span className="text-gold font-semibold">{f.strong}</span> {f.rest}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="space-y-14">{children}</div>

        {footnote && (
          <p className="text-xs text-text-muted mt-14 border-t border-card-border pt-5">{footnote}</p>
        )}
      </article>
    </div>
  );
}
