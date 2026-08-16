import type { Metadata } from 'next';
import Link from 'next/link';
import { EVENT_MODES } from '@/lib/eventModes';
import { getClanDisplayName, getFederationEnabled } from '@/lib/pluginConfig';
import { isSharedLoginAvailable } from '@/lib/discord-oauth';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { BotConsentDiagram, ProvisioningStatesDiagram, SetupStepsDiagram } from '../_components/Diagrams';

export const metadata: Metadata = {
  title: 'Running your first event — Anvil admin guide',
  description:
    "Set up a clan on Anvil and run a bingo end to end: Discord, roster sync, boards, tiles, teams and draft, launch, and what happens after the event ends.",
};

// Instance-specific copy (clan name, whether federation is on), so no static render.
export const dynamic = 'force-dynamic';

const SECTIONS = [
  { id: 'access', n: 1, title: 'Who can do what' },
  { id: 'setup', n: 2, title: 'Name the clan, connect Discord' },
  { id: 'channels', n: 3, title: 'Split posts across channels' },
  { id: 'roster', n: 4, title: 'Get your roster in' },
  { id: 'board', n: 5, title: 'Create your first board' },
  { id: 'tiles', n: 6, title: 'Fill the board' },
  { id: 'teams', n: 7, title: 'Teams and the draft' },
  { id: 'launch', n: 8, title: 'Launch and run it' },
  { id: 'after', n: 9, title: 'After the last tile' },
];

export default async function AdminGuidePage() {
  const clanName = await getClanDisplayName('your clan');
  const federationEnabled = await getFederationEnabled();
  // Hosted instances are marked by the provisioner (ANVIL_SHARED_LOGIN + a broker URL); a self-host
  // can't declare it. Only they went through the purchase → setup → build path, so only they get the
  // paragraph about it.
  const hosted = isSharedLoginAvailable();

  return (
    <GuideShell
      eyebrow="Anvil · for clan staff"
      title="Running your first event"
      sections={SECTIONS}
      minutes={8}
      dek={
        <>
          The whole path, in the order you&rsquo;ll actually walk it: get {clanName} configured, get the
          roster in, build a board, draft teams, start the thing, and hand out the prizes. Roughly an
          evening&rsquo;s work for a first bingo — minutes for the second.
        </>
      }
      facts={[
        { strong: '4 steps', rest: 'in the setup wizard' },
        { strong: '7 formats', rest: 'to build a board from' },
        { strong: '1 button', rest: 'to sync the clan roster' },
      ]}
      footnote={
        <>
          This guide tracks the app as it ships today. If a screen here doesn&rsquo;t match what
          you&rsquo;re looking at, the app is right and the guide is stale —{' '}
          <Link href="/feedback" className="text-gold hover:text-gold-light">
            tell us
          </Link>{' '}
          and we&rsquo;ll fix it.
        </>
      }
    >
      {/* ------------------------------------------------------------------ 1 */}
      <Section id="access" n={1} title="Who can do what">
        <p className="text-text-muted">
          Everyone signs in with Discord — there are no passwords. The first admin is seeded from the
          server config; after that, an admin promotes people from{' '}
          <span className="text-foreground font-medium">Clan → Members &amp; staff</span>. Roles stack
          downward: everything a moderator can do, a treasurer and an admin can do too.
        </p>
        <Rows
          rows={[
            {
              term: 'Admin',
              body: 'full access — events, tiles, teams, settings, staff, payouts. Give this to as few people as the clan can stand.',
            },
            {
              term: 'Treasurer',
              body: 'everything a moderator can do, plus sign-up fees and payouts.',
            },
            {
              term: 'Moderator',
              body: 'the day-to-day: roster, verifications, weekly competitions, schedule, feedback. Cannot create or edit events.',
            },
            {
              term: 'Editor',
              body: 'tile authoring only. Grant it globally, or scope it to specific boards so a guest board-builder can only touch the event you handed them.',
            },
            { term: 'Member', body: 'plays; no admin surface at all.' },
          ]}
        />
        <Note tag="Owner">
          <p>
            One account is the owner. It can&rsquo;t be demoted by anyone else and is the only role
            that can hand ownership on — so losing an argument with a co-admin can never cost you the
            clan.
          </p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 2 */}
      <Section id="setup" n={2} title="Name the clan, connect Discord">
        <p className="text-text-muted">
          <span className="text-foreground font-medium">System → Setup</span> is a four-step wizard,
          and the dashboard keeps the same four as a checklist until they&rsquo;re done: name the clan,
          connect Discord, create an event, add tiles. Status is computed from real data, so a step
          only ticks when it&rsquo;s genuinely finished.
        </p>
        <SetupStepsDiagram />
        <p className="text-text-muted">
          For Discord you have two routes, and they compose: give Anvil a{' '}
          <span className="text-foreground font-medium">bot</span> and it can create webhooks, sync
          roles and nicknames, and build private team channels for you; give it a single{' '}
          <span className="text-foreground font-medium">webhook URL</span> and it can post
          announcements and nothing else. Start with the webhook if you want to be live in two minutes,
          add the bot when you want the automation.
        </p>
        <BotConsentDiagram />
        <Note tag="Bot permissions">
          <p>
            The bot needs <em>Manage Webhooks</em>, <em>Manage Roles</em>, <em>Manage Channels</em> and{' '}
            <em>Manage Nicknames</em>, and its role must sit <em>above</em> the roles it manages in your
            server&rsquo;s role list. Discord silently refuses otherwise.
          </p>
        </Note>
        {hosted && (
          <>
            <p className="text-text-muted">
              On a hosted plan you met that screen once already: adding the bot during setup is how
              Anvil learned which server is yours, so there was never a server ID to copy. The same
              link is here whenever you want to move the bot to a different server.
            </p>
            <ProvisioningStatesDiagram />
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------------ 3 */}
      <Section id="channels" n={3} title="Split posts across channels">
        <p className="text-text-muted">
          Everything posts to one master announcements channel by default. When that gets noisy, open{' '}
          <span className="text-foreground font-medium">System → Advanced settings → Webhooks</span>{' '}
          and give the loud categories their own homes — bingo events, weekly competitions, rare drops,
          deaths, PvP kills, combat achievements, clips. Anything left blank falls back to the master
          channel, so you can split one category at a time.
        </p>
        <p className="text-text-muted">
          With the bot connected you never touch a webhook URL: pick a channel from the dropdown and
          press <span className="text-foreground font-medium">Create webhook</span>. On a busy event
          you can add a second webhook to the same channel — Anvil rotates between them so Discord&rsquo;s
          rate limit doesn&rsquo;t swallow posts.
        </p>
        <Note tag="The clips channel is different">
          <p>
            Clip videos upload straight from each player&rsquo;s PC to Discord — they never pass through
            this site. So the clips webhook you set here is the one you <em>hand out</em>: members paste
            it into their plugin themselves. Everything else on this page is server-side and members
            never see it.
          </p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 4 */}
      <Section id="roster" n={4} title="Get your roster in">
        <p className="text-text-muted">
          Clan membership comes from one place: an in-game roster sync. Install the{' '}
          <Link href="/guide/plugin" className="text-gold hover:text-gold-light">
            Anvil RuneLite plugin
          </Link>{' '}
          on an <em>admin&rsquo;s</em> account, open the in-game Collection Log&rsquo;s{' '}
          <span className="text-foreground font-medium">Bingo</span> tab, and press{' '}
          <span className="text-foreground font-medium">Sync clan roster</span>. That pushes your actual
          in-game clan list to the site in one click.
        </p>
        <p className="text-text-muted">
          Anyone who links or verifies an account on the website without being on that roster is a{' '}
          <span className="text-foreground font-medium">guest</span> — tracked, visible, but not a
          member until an admin promotes them or the next roster sync picks them up. That&rsquo;s
          deliberate: it means nobody can self-promote into your clan by typing a name.
        </p>
        <p className="text-text-muted">
          You can also add someone by hand from{' '}
          <span className="text-foreground font-medium">Clan → Members &amp; staff</span>, including
          signing them up to an event on their behalf when they can&rsquo;t reach the site.
        </p>
      </Section>

      {/* ------------------------------------------------------------------ 5 */}
      <Section id="board" n={5} title="Create your first board">
        <p className="text-text-muted">
          <span className="text-foreground font-medium">Events → All events → New event</span>. Pick a
          format first — it decides how the board is scored and what the rest of the form asks you for.
        </p>
        <Rows rows={EVENT_MODES.map((m) => ({ term: m.label, body: m.blurb }))} />
        <p className="text-text-muted">
          Then set the dates, the sign-up window, and whether sign-ups carry a fee. Start from a
          template if you&rsquo;d rather not start from an empty grid — the gallery holds both the
          built-in presets and any board you&rsquo;ve saved as a template before.
        </p>
        <Note tag="Dates are UTC">
          <p>
            Every timestamp in Anvil is stored and compared in UTC, and rendered in each visitor&rsquo;s
            local time. Set the end time you mean; the site will show a Brit and an Aussie two different
            clocks for the same moment.
          </p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 6 */}
      <Section id="tiles" n={6} title="Fill the board">
        <p className="text-text-muted">
          The event&rsquo;s <span className="text-foreground font-medium">Tiles</span> tab is where a
          board becomes a bingo. Each tile is one <em>kind</em> of task, and the kind decides what the
          plugin watches for: a drop, a boss kill-count, skill XP, an NPC kill, a timed clear, an
          achievement diary, a Combat Achievement, a collection-log unlock, a PvP kill, an inventory
          gain, or a deathless run. Manual tiles — the ones a human verifies from a screenshot — are
          always an option too.
        </p>
        <p className="text-text-muted">
          For a full board, author in bulk: export the sheet, fill it in a spreadsheet, and import it
          back. CSV and .xlsx both round-trip, and rows map to positions, so you can rewrite a whole
          25-tile grid in one paste.
        </p>
        <Rows
          rows={[
            {
              term: 'Difficulty tiers',
              body: 'point values map to named bands (easy → elite). Edit the bands in Advanced settings if your clan grades differently.',
            },
            {
              term: 'Balance auditor',
              body: 'checks a finished board for structural problems and lopsided effort before players ever see it.',
            },
            {
              term: 'Hidden until reveal',
              body: 'new boards start hidden. Staff always see them; players see nothing until you reveal — so a board can be built in the open without spoiling it.',
            },
          ]}
        />
      </Section>

      {/* ------------------------------------------------------------------ 7 */}
      <Section id="teams" n={7} title="Teams and the draft">
        <p className="text-text-muted">
          The <span className="text-foreground font-medium">Teams &amp; Draft</span> tab adapts to the
          format you chose: a format that doesn&rsquo;t use teams skips straight past it. For a normal
          team bingo you create the teams, decide who captains them, and either assign players yourself
          or run a live draft.
        </p>
        <p className="text-text-muted">
          Captains draft from the sign-up pool in your chosen order, and each captain sees the answers
          people gave on the sign-up form — frozen as they were submitted, so nobody edits their
          &ldquo;hours per week&rdquo; after being picked.
        </p>
        <Note tag="The draft locks the roster">
          <p>
            Once a draft starts, the set of teams and the pick order are frozen. Add the team you forgot{' '}
            <em>before</em> you press start, not after.
          </p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 8 */}
      <Section id="launch" n={8} title="Launch and run it">
        <p className="text-text-muted">
          Reveal the tiles, then start the event. Anvil refuses to start a board that isn&rsquo;t ready —
          a draft still in progress, or players with no team — and tells you which. If you know better
          (a scrim, a re-run, a board you&rsquo;re testing), you can force it.
        </p>
        <p className="text-text-muted">
          From then on it mostly runs itself. The plugin auto-credits everything it can see and posts
          proof screenshots stamped with the team and a UTC timestamp. What lands in your lap is:
        </p>
        <Rows
          rows={[
            {
              term: 'Submissions to verify',
              body: 'manual tiles and anything the plugin flagged. Approve or reject with the proof in front of you.',
            },
            {
              term: 'Stats',
              body: 'the event’s Stats tab shows per-player contribution — useful when a team argues about carries.',
            },
            {
              term: 'Announcements',
              body: 'System → Announce posts a message to your channels mid-event without you writing a webhook by hand.',
            },
          ]}
        />
        <Note tag="Mid-event surprises">
          <p>
            You can drop a <span className="text-foreground">mission</span> onto a live bingo — a hidden
            bonus tile that gets announced when you fire it, optionally decaying in value or expiring.
            It&rsquo;s the cheapest way to wake a board up on day five.
          </p>
        </Note>
        <Note tag="Stopping pre-event stacking">
          <p>
            Turn on <span className="text-foreground">Starting shot</span> (event → Overview) and every
            player has to file one screenshot taken after the event goes live, at a location Anvil draws
            at the start moment — so nobody can be sat on a week of banked clues and caskets at T0. The
            location is announced with the start; each player&rsquo;s keyword is personal, derived from
            the draw, and doesn&rsquo;t exist until the event starts, so it can&rsquo;t be staged in
            advance by anyone.
          </p>
          <p>
            Plugin users press one button. Everyone else types their keyword in-game and uploads on My
            Team. You choose what happens to a credit from someone who hasn&rsquo;t filed: flag it for
            review (default) or refuse it until they do. The same Overview panel is the review list —
            plugin captures with a verified keyword arrive already accepted, so in practice you&rsquo;re
            only eyeballing the phone players.
          </p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 9 */}
      <Section id="after" n={9} title="After the last tile">
        <p className="text-text-muted">
          When the clock runs out the board freezes and the event locks — points, contributions and
          who-did-what are all frozen as they stood. If you need to fix something afterwards, an admin
          can unlock it deliberately.
        </p>
        <Rows
          rows={[
            {
              term: 'Payouts',
              body: 'the event’s Payouts tab turns the prize pool into a list of who gets what, tracked as you pay it out.',
            },
            {
              term: 'Recap',
              body: 'a public recap page with the final standings and end-of-event superlatives — biggest drop, most kills, and the rest.',
            },
            {
              term: 'Survey',
              body: 'ask the clan what they thought. Build it on the Survey tab; players answer once the event ends and only staff see the results.',
            },
            {
              term: 'Save as template',
              body: 'keep the board you just built. Next bingo starts from it instead of an empty grid.',
            },
          ]}
        />
        {federationEnabled && (
          <p className="text-text-muted">
            With federation on, members can also connect to other Anvil clans from the plugin — handy
            for cross-clan events, and entirely opt-in per member.
          </p>
        )}
        <p className="text-text-muted">
          Then point your members at the{' '}
          <Link href="/guide/plugin" className="text-gold hover:text-gold-light">
            player setup guide
          </Link>{' '}
          and start planning the next one.
        </p>
      </Section>
    </GuideShell>
  );
}
