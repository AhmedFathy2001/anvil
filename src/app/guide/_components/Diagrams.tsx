// Diagrams for the admin guide: the four-step setup wizard, the shape of Discord's add-a-bot consent
// screen, and the states a hosted clan site passes through before it's live.
//
// Drawn with divs + a little inline SVG in the site's own theme tokens — deliberately NOT screenshots.
// The plugin screenshots under /public/guide are real captures of OUR software; Discord's dialogs are
// Discord's artwork and their UI shifts, so their screens get sketched instead. A sketch also survives
// a redesign, which a screenshot doesn't.
//
// Same idea as BoardShape: pure markup, no images, inherits the theme. Everything decorative is
// aria-hidden and every figure carries a caption, so the content survives without the drawing.

function Figure({
  caption,
  label,
  children,
}: {
  caption: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="border border-card-border rounded-xl bg-card-bg p-4 my-6">
      <div role="img" aria-label={label}>
        {children}
      </div>
      <figcaption className="mt-3 text-xs text-text-muted leading-relaxed">{caption}</figcaption>
    </figure>
  );
}

/** Short chevron between steps; points down when the row stacks. */
function Arrow({ vertical }: { vertical?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 12"
      className={`shrink-0 text-card-border h-3 w-6 ${vertical ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path d="M0 6h20M15 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ── The setup wizard ─────────────────────────────────────────────────────────────────────────────

/** Glyphs for each step's screen: a field, a connection, a board, a filled board. */
function StepGlyph({ kind }: { kind: 'field' | 'link' | 'board' | 'tiles' }) {
  if (kind === 'field') {
    return (
      <span className="flex h-6 w-full items-center rounded border border-card-border bg-brown-dark px-1.5" aria-hidden>
        <span className="h-2 w-10 rounded-sm bg-text-muted/40" />
        <span className="ml-0.5 h-3 w-px bg-gold" />
      </span>
    );
  }
  if (kind === 'link') {
    return (
      <span className="flex h-6 w-full items-center gap-1.5" aria-hidden>
        <span className="h-5 w-5 shrink-0 rounded-lg bg-text-muted/30" />
        <Arrow />
        <span className="h-5 w-5 shrink-0 rounded-lg border border-gold/50 bg-gold/20" />
      </span>
    );
  }
  const filled = kind === 'tiles' ? [0, 1, 3] : [];
  return (
    <span className="grid h-6 w-fit grid-cols-3 gap-[3px]" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-[2px] ${
            filled.includes(i) ? 'bg-gold border border-gold' : 'border border-card-border bg-brown-dark/60'
          }`}
        />
      ))}
    </span>
  );
}

const SETUP_STEPS: { n: number; title: string; body: string; glyph: 'field' | 'link' | 'board' | 'tiles' }[] = [
  { n: 1, title: 'Name the clan', body: 'What members see across the site.', glyph: 'field' },
  { n: 2, title: 'Connect Discord', body: 'A webhook, a bot, or both.', glyph: 'link' },
  { n: 3, title: 'Create an event', body: 'Pick a format; it shapes the rest.', glyph: 'board' },
  { n: 4, title: 'Add tiles', body: 'By hand, from a template, or a spreadsheet.', glyph: 'tiles' },
];

export function SetupStepsDiagram() {
  return (
    <Figure
      label="The four setup steps: name the clan, connect Discord, create an event, add tiles"
      caption="System → Setup, and the same four as a dashboard checklist. Each step ticks off real data, not a box you clicked — so a half-finished board still reads as unfinished."
    >
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {SETUP_STEPS.map((s, i) => (
          <li key={s.n} className="flex min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center">
            <div className="border border-card-border rounded-lg bg-tile-bg p-3 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold text-[10px] font-bold text-brown-dark">
                  {s.n}
                </span>
                <span className="min-w-0 text-xs font-semibold leading-tight">{s.title}</span>
              </div>
              <div className="mt-2">
                <StepGlyph kind={s.glyph} />
              </div>
              <div className="mt-2 text-[11px] leading-snug text-text-muted">{s.body}</div>
            </div>
            {i < SETUP_STEPS.length - 1 && (
              <>
                <span className="hidden sm:block">
                  <Arrow />
                </span>
                <span className="self-center sm:hidden">
                  <Arrow vertical />
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </Figure>
  );
}

// ── The bot-invite consent screen ────────────────────────────────────────────────────────────────

const BOT_PERMISSIONS = [
  'Manage Webhooks — create the channels’ webhooks for you',
  'Manage Channels — build private team channels',
  'Manage Roles — keep clan roles in step',
  'Manage Nicknames — set nicknames to RSNs',
  'View Channels & Send Messages',
  // Granted as a SCOPE rather than a permission, so Discord lists it separately on the real screen —
  // but it's one more line to tick past, which is all this sketch is teaching. Without it the bot
  // works perfectly and its slash commands simply never appear, with nothing explaining why.
  'Create commands — the /bingo slash commands',
];

/**
 * What Discord shows when you add the bot, sketched. The parts worth recognising are the server
 * picker and that Authorize is the last click — not the exact pixels, which are Discord's to change.
 */
export function BotConsentDiagram() {
  return (
    <Figure
      label="Sketch of Discord's add-a-bot screen: a server picker, the permissions Anvil asks for, and an Authorize button"
      caption="Whichever server you pick here is the one Anvil manages. If the bot later can't rename someone or build a channel, it's almost always the role order, not this screen."
    >
      <div className="mx-auto max-w-sm border border-card-border rounded-lg bg-brown-dark p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold text-sm font-bold text-brown-dark" aria-hidden>
            A
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Anvil</div>
            <div className="text-[11px] text-text-muted">wants to access your server</div>
          </div>
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-widest text-text-muted">Add to server</div>
        <div className="mt-1 flex items-center justify-between border border-gold/40 rounded-md bg-gold/[0.07] px-2.5 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-4 w-4 shrink-0 rounded-full bg-text-muted/30" aria-hidden />
            <span className="truncate text-xs">your clan’s server</span>
          </span>
          <svg viewBox="0 0 12 8" className="h-2 w-3 shrink-0 text-text-muted" aria-hidden>
            <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <ul className="mt-3 space-y-1.5">
          {BOT_PERMISSIONS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[11px] leading-snug text-text-muted">
              <span className="mt-[3px] grid h-3 w-3 shrink-0 place-items-center rounded-sm bg-card-border text-[8px] text-gold" aria-hidden>
                ✓
              </span>
              <span className="min-w-0">{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="rounded-md px-3 py-1.5 text-[11px] text-text-muted" aria-hidden>
            Cancel
          </span>
          <span className="rounded-md bg-gold px-3 py-1.5 text-[11px] font-semibold text-brown-dark" aria-hidden>
            Authorize
          </span>
        </div>
      </div>
    </Figure>
  );
}

// ── Provisioning states (hosted clans) ───────────────────────────────────────────────────────────

const STATES: { title: string; body: string; tone: 'wait' | 'work' | 'live' }[] = [
  { title: 'Paid', body: 'The sale clears and your setup link works.', tone: 'wait' },
  { title: 'Setup', body: 'Name the clan, sign in with Discord, add the bot.', tone: 'work' },
  { title: 'Building', body: 'Your container, database and address are created.', tone: 'work' },
  { title: 'Live', body: 'This site — and you log in as its owner.', tone: 'live' },
];

const DOT: Record<'wait' | 'work' | 'live', string> = {
  wait: 'border-card-border bg-tile-bg',
  work: 'border-gold/60 bg-gold/20',
  live: 'border-gold bg-gold',
};

export function ProvisioningStatesDiagram() {
  return (
    <Figure
      label="Four states a hosted clan passes through: paid, setup, building, live"
      caption="How this site came to exist. Nothing is built until setup is finished — which is why a clan that bought a plan and never opened the setup link has no site to log into."
    >
      <ol className="flex flex-col gap-3 sm:flex-row">
        {STATES.map((s, i) => (
          <li key={s.title} className="flex min-w-0 flex-1 items-start gap-2 sm:block">
            <div className="flex shrink-0 items-center gap-2 sm:w-full">
              <span className={`h-3 w-3 shrink-0 rounded-full border ${DOT[s.tone]}`} aria-hidden />
              {/* The rail runs between dots, so the last state doesn't trail one. */}
              {i < STATES.length - 1 && <span className="hidden h-px flex-1 bg-card-border sm:block" aria-hidden />}
            </div>
            <div className="min-w-0 sm:mt-2">
              <div className="text-xs font-semibold">{s.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-text-muted">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </Figure>
  );
}
