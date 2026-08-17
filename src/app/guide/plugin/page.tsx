import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getOAuthMode } from '@/lib/discord-oauth';
import { getClanDisplayName, getDiscordInviteUrl } from '@/lib/pluginConfig';
import { Chat, Figure, GuideShell, Note, Rows, Section } from '../_components/GuideUI';

export const metadata: Metadata = {
  title: 'RuneLite plugin setup — Anvil',
  description:
    'Install the Anvil RuneLite plugin, connect it to this site, and set up Discord notifications and OBS clips.',
};

// Public page, but the copy is instance-specific (site URL, clan name, which login this instance
// uses), so it can't be statically rendered at build time.
export const dynamic = 'force-dynamic';

/**
 * Canonical origin for the "paste this into Site URL" instruction. Same resolution order as
 * lib/request-origin (env first — Host is attacker-controllable), with a Host fallback that's
 * acceptable here because the value is only ever *displayed*, never redirected to. Local dev has
 * neither, so it degrades to the placeholder.
 */
async function siteOrigin(): Promise<string> {
  const fromEnv = (u: string | undefined): string | null => {
    if (!u) return null;
    try {
      return new URL(u).origin;
    } catch {
      return null;
    }
  };
  const configured = fromEnv(process.env.APP_URL) || fromEnv(process.env.DISCORD_REDIRECT_URI);
  if (configured) return configured;
  const h = await headers();
  const host = h.get('host');
  return host ? `https://${host}` : 'https://your-clan.example.com';
}

const SECTIONS = [
  { id: 'install', n: 1, title: 'Install the plugin' },
  { id: 'connect', n: 2, title: 'Connect to this site' },
  { id: 'accounts', n: 3, title: 'Link your accounts' },
  { id: 'working', n: 4, title: "Check it's working" },
  { id: 'bingo', n: 5, title: 'Bingo settings' },
  { id: 'notifications', n: 6, title: 'Discord notifications' },
  { id: 'clips', n: 7, title: 'Clips with OBS' },
  { id: 'trouble', n: 8, title: 'When something breaks' },
];

export default async function PluginGuidePage() {
  const origin = await siteOrigin();
  const clanName = await getClanDisplayName('this clan');
  const discordInvite = await getDiscordInviteUrl();

  // Which login this instance uses decides one paragraph in step 2: a managed instance authenticates
  // Discord through the shared Anvil login (a visible hop to another domain, worth explaining before
  // someone thinks it's a phishing redirect); a BYO-app instance never leaves this site. 'none' means
  // Discord login isn't configured at all, so the in-plugin sign-in can't work — token only.
  const oauthMode = getOAuthMode();

  return (
    <GuideShell
      eyebrow="Anvil · RuneLite plugin"
      title="Player setup guide"
      sections={SECTIONS}
      minutes={7}
      dek={
        <>
          Install it, point it at {clanName}, and play. The plugin submits your bingo drops, posts your
          rare drops and deaths to Discord, and — if you run OBS — saves and posts clips of the moments
          worth re-watching.
        </>
      }
      facts={[
        { strong: '2 fields', rest: 'to get tracking' },
        { strong: '~3 min', rest: 'for the basic setup' },
        { strong: 'Clips', rest: 'need OBS + 5 more minutes' },
      ]}
      footnote="Screenshots are from a live setup — the account token, OBS address and Discord webhook are blanked out on purpose. Yours should stay just as private."
    >
          {/* ---------------------------------------------------------------- 1 */}
          <Section id="install" n={1} title="Install the plugin">
            <p className="text-text-muted">
              In RuneLite: <span className="text-foreground font-medium">Configuration</span> (the
              wrench) → <span className="text-foreground font-medium">Plugin Hub</span> → search{' '}
              <span className="text-foreground font-medium">Anvil</span> →{' '}
              <span className="text-foreground font-medium">Install</span>. The publisher is{' '}
              <code className="font-mono text-gold/90">AhmedFathy2001</code>.
            </p>
            <p className="text-text-muted">
              One plugin serves every clan — you point it at this site in the next step, so there is
              nothing clan-specific to download. Once installed, open{' '}
              <span className="text-foreground font-medium">Configuration → Anvil</span> to reach the
              settings panel shown throughout this guide.
            </p>
          </Section>

          {/* ---------------------------------------------------------------- 2 */}
          <Section id="connect" n={2} title="Connect to this site">
            <p className="text-text-muted">
              Only the <span className="text-foreground font-medium">Setup</span> section matters to
              get going. Everything else has sensible defaults.
            </p>

            <Figure
              src="/guide/plugin-setup.png"
              width={534}
              height={330}
              alt="The Anvil plugin's Setup section, with the Site URL and Account Token fields boxed"
              caption="Configuration → Anvil → Setup"
              legend={[
                {
                  n: 1,
                  label: 'Site URL',
                  body: (
                    <>
                      for {clanName} that&rsquo;s{' '}
                      <code className="font-mono text-gold/90 break-all">{origin}</code>. This ships
                      empty, so you must fill it in. No trailing slash needed, and{' '}
                      <code className="font-mono">https://</code> is added if you leave it off.
                    </>
                  ),
                },
                {
                  n: 2,
                  label: 'Account Token',
                  body: 'your personal key to this site. Either let the plugin fill it in for you (below), or paste it yourself. Treat it like a password.',
                },
              ]}
            />

            {oauthMode !== 'none' && (
              <>
                <h3 className="text-lg font-semibold pt-2">The easy way: sign in from the plugin</h3>
                <p className="text-text-muted">
                  With the Site URL set and the token still empty, the{' '}
                  <span className="text-foreground font-medium">Anvil side panel</span> shows a{' '}
                  <span className="text-foreground font-medium">Sign in with Discord</span> button.
                  Click it and the plugin walks you through it — no copying anything.
                </p>
                <ol className="list-decimal pl-5 text-text-muted space-y-1.5 text-sm">
                  <li>The panel shows a code and opens your browser on this site.</li>
                  <li>
                    Check the code on the page matches the one in RuneLite, then click{' '}
                    <span className="text-foreground font-medium">Approve</span>.
                  </li>
                  <li>
                    The panel says <em>Signed in</em> and fills the Account Token in for you.
                  </li>
                </ol>

                <Figure
                  src="/guide/site-link-device.png"
                  width={555}
                  height={370}
                  alt="The Link your RuneLite client page, with the code field and Approve button boxed"
                  caption="This site → /link-device"
                  legend={[
                    { n: 1, label: 'The code', body: 'it must match what the plugin is showing you right now.' },
                    {
                      n: 2,
                      label: 'Approve',
                      body: (
                        <>
                          only ever approve a code <em>your own</em> client is displaying. If someone
                          sent you a link or a code, deny it — approving would hand them your account.
                        </>
                      ),
                    },
                  ]}
                />

                <Note tag="Where this happens">
                  <p>
                    Everything in this flow stays on{' '}
                    <code className="font-mono text-gold/90 break-all">{origin}</code> — the code is
                    issued here, approved here with {clanName}&rsquo;s own Discord login, and the
                    token is handed back here. The plugin refuses to open any sign-in page that
                    isn&rsquo;t on the Site URL you typed.
                  </p>
                </Note>

                <p className="text-text-muted text-sm">
                  If the browser doesn&rsquo;t open on its own, the panel prints the address and the
                  code so you can open it manually. Codes expire after ten minutes — just press the
                  button again.
                </p>

                <h3 className="text-lg font-semibold pt-2">The manual way: copy your token</h3>
              </>
            )}

            <p className="text-text-muted">
              Log in with Discord and open <Link href="/profile" className="text-gold hover:text-gold-light">Profile</Link>, then
              scroll to the <span className="text-foreground font-medium">RuneLite plugin</span> card.
            </p>

            <Figure
              src="/guide/site-token.png"
              width={896}
              height={279}
              alt="The RuneLite plugin card on the profile page, with the token field and the Reveal, Copy and Rotate buttons boxed"
              caption="Profile → RuneLite plugin"
              legend={[
                {
                  n: 1,
                  label: 'Your token',
                  body: "hidden until you press Reveal. It's blanked out in this screenshot on purpose; never post yours in Discord.",
                },
                {
                  n: 2,
                  label: 'Copy / Rotate',
                  body: 'copy it into the plugin’s Account Token field. Rotate issues a new one and kills the old — use it if you ever think your token leaked.',
                },
              ]}
            />

            <Note tag="Good to know">
              <p>
                One token covers every event you&rsquo;re signed up for here — you never re-paste it
                per bingo.
              </p>
            </Note>
          </Section>

          {/* ---------------------------------------------------------------- 3 */}
          <Section id="accounts" n={3} title="Link your accounts — just play">
            <p className="text-text-muted">
              There&rsquo;s no link code to type. Once the token is in, whichever account you log into
              gets matched to your profile automatically.
            </p>
            <p className="text-text-muted">
              The plugin sends your in-game name plus a stable account fingerprint with every request,
              and the site matches on the fingerprint first — so your links survive a name change. Log
              into an alt once and it shows up on your Profile under{' '}
              <em>Accounts we noticed you playing</em> with a one-click{' '}
              <span className="text-foreground font-medium">Add</span>.
            </p>

            <Figure
              src="/guide/site-accounts.png"
              width={835}
              height={290}
              alt="The RuneScape Accounts card on the profile page listing accounts verified via plugin"
              caption="Profile → RuneScape Accounts"
              legend={[
                {
                  n: 1,
                  label: 'Your linked accounts',
                  body: 'anything marked “Verified via plugin” got there just by being played. Add as many alts as you like; one is your primary.',
                },
              ]}
            />

            <h3 className="text-lg font-semibold pt-2">Can&rsquo;t run the plugin?</h3>
            <p className="text-text-muted">
              On mobile or the official client, link on the website instead — Profile shows both
              options:
            </p>
            <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">
              <li>
                <span className="text-foreground font-medium">Verify by XP</span> — enter your RSN, the
                site picks a random skill, gain 1,000 XP in it within 30 minutes.
              </li>
              <li>
                <span className="text-foreground font-medium">Manual review</span> — for hidden
                Hiscores or fresh alts: submit your RSN with a note and a moderator approves it.
              </li>
            </ul>
            <p className="text-text-muted text-sm">
              Event sign-ups need at least one verified account, so get this done before you sign up.
            </p>
          </Section>

          {/* ---------------------------------------------------------------- 4 */}
          <Section id="working" n={4} title="Check it's working">
            <p className="text-text-muted">
              Log in and read your chat box. The plugin greets you when it&rsquo;s connected and an
              event is live.
            </p>
            <Chat
              lines={[
                { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
                { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
                { text: '…later, as things happen…', tone: 'muted' },
                { text: 'Tracked drop detected: Dragon warhammer (1/1)' },
                { text: 'Tracked kill: Zulrah (7/10)' },
              ]}
            />
            <p className="text-text-muted">
              You should also see the <span className="text-foreground font-medium">Anvil side panel</span>{' '}
              fill in with your event, your team and your tile progress, and a{' '}
              <span className="text-foreground font-medium">Bingo</span> tab appear inside your in-game
              Collection Log.
            </p>
            <Note tag="Guest vs member">
              <p>
                If chat says <em>Tracked as a guest</em>, you&rsquo;re being tracked but you&rsquo;re
                not on the clan roster yet. An admin fixes that by syncing the in-game clan roster —
                ask{' '}
                {discordInvite ? (
                  <a
                    href={discordInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:text-gold-light"
                  >
                    in Discord
                  </a>
                ) : (
                  'in Discord'
                )}
                .
              </p>
            </Note>
          </Section>

          {/* ---------------------------------------------------------------- 5 */}
          <Section id="bingo" n={5} title="Bingo settings">
            <p className="text-text-muted">
              These only matter while you&rsquo;re in an event. The defaults are fine — this is what
              each one actually does.
            </p>
            <Figure
              src="/guide/plugin-bingo.png"
              width={534}
              height={494}
              alt="The Bingo section of the plugin config with each setting boxed and numbered"
              caption="Configuration → Anvil → Bingo"
              legend={[
                {
                  n: 1,
                  label: 'Auto Submit Drops',
                  body: "screenshots and submits a tracked drop the moment it lands. Leave this on; it's the whole point.",
                },
                {
                  n: 2,
                  label: 'Show Overlay',
                  body: (
                    <>
                      draws a small <em>Anvil / Team / UTC date</em> panel in the top-left. It becomes
                      part of the picture in your proof screenshots, which is what makes a proof hard
                      to fake or back-date. It&rsquo;s off in this screenshot — turn it on if your clan
                      wants team and time visible on every proof.
                    </>
                  ),
                },
                {
                  n: 3,
                  label: 'Team completion popups',
                  body: 'a banner when anyone on your team finishes a tile. Several at once: the hardest gets the banner, the rest go to chat.',
                },
                {
                  n: 4,
                  label: 'Bingo tab in Collection Log',
                  body: 'puts your board inside the in-game Collection Log, alongside your saved proofs.',
                },
                {
                  n: 5,
                  label: 'Banner sound + volume',
                  body: 'plays a sound with the banner. Nothing plays until you add at least one .wav yourself, via the “Banner sounds” button in that Bingo tab.',
                },
                {
                  n: 6,
                  label: 'Two-frame drop proof',
                  body: 'bakes a second frame into the screenshot a couple of seconds later, once loot has settled on the floor. Keep it on; it saves arguments.',
                },
              ]}
            />

            <h3 className="text-foreground font-medium mt-6">Starting shot</h3>
            <p className="text-text-muted">
              Some events ask everyone for a <span className="text-foreground font-medium">starting
              shot</span>: one screenshot taken after the event goes live, at a location drawn at the
              start moment. It stops anyone from spending the week before the event stockpiling
              clues, caskets and kills to dump on the first day.
            </p>
            <p className="text-text-muted">
              If you run the plugin there is nothing to prepare. When the event starts you get a chat
              line telling you where to go, and the Anvil side panel shows a{' '}
              <span className="text-foreground font-medium">Take starting shot</span> button. Stand
              where it says, press it once, and you&rsquo;re done — the plugin captures the frame,
              stamps your RSN, team, the location and a keyword only your account gets onto it, and
              files it for you.
            </p>
            <p className="text-text-muted">
              On mobile, or without the plugin: open{' '}
              <span className="text-foreground font-medium">My Team</span> on this site, read your
              keyword off the starting-shot card, type it into the in-game chatbox, screenshot the
              game with your character and the keyword visible, and upload it on that same card.
            </p>
          </Section>

          {/* ---------------------------------------------------------------- 6 */}
          <Section id="notifications" n={6} title="Discord notifications">
            <p className="text-text-muted">
              These fire whether or not a bingo is running, and they post to the clan&rsquo;s channels.
              Which channel is set up here by the admins — you only choose <em>what</em> you post.
            </p>

            <Figure
              src="/guide/plugin-notify-drops.png"
              width={534}
              height={772}
              alt="The Deaths and kills and Drops and pets notification sections with each setting boxed and numbered"
              caption="Deaths & kills · Drops & pets"
              legend={[
                {
                  n: 1,
                  label: 'Notify on death',
                  body: 'posts to the clan deaths channel with a screenshot of the moment you died.',
                },
                {
                  n: 2,
                  label: 'Death message',
                  body: (
                    <>
                      your own line. <code className="font-mono">{'{name}'}</code> is replaced with your
                      RSN.
                    </>
                  ),
                },
                {
                  n: 3,
                  label: 'Notify on PvP kill',
                  body: 'a screenshot of the tick your target hits 0 HP. Off by default; on here.',
                },
                { n: 4, label: 'Notify on rare drops', body: 'the master switch for drop posts.' },
                {
                  n: 5,
                  label: 'Min drop value / Min drop rarity',
                  body: 'two independent routes to a post: worth at least this much (GE or high alch, whichever is higher), or rarer than 1-in-N (1/10,000 by default — looser settings fill the channel with herb rolls). Your clan can set a rarity floor that applies to everyone; yours still applies when it is stricter. Set either to 0 to switch that route off.',
                },
                { n: 6, label: 'Screenshot rare drops', body: 'attach the picture, not just the text.' },
                {
                  n: 7,
                  label: 'Loot key value',
                  body: 'a loot key posts once, as a single notification, when its whole contents clear this number.',
                },
                {
                  n: 8,
                  label: 'Notify on pets + Screenshot pets',
                  body: 'pets post to the rare-drops channel.',
                },
              ]}
            />

            <Figure
              src="/guide/plugin-notify-ca.png"
              width={534}
              height={364}
              alt="The Combat achievements notification section with each setting boxed and numbered"
              caption="Combat achievements · levels · diaries · quests"
              legend={[
                {
                  n: 1,
                  label: 'Notify on combat achievements',
                  body: 'tier clears always post when this is on.',
                },
                {
                  n: 2,
                  label: 'CA task min tier',
                  body: 'how noisy individual task completions are. Elite here; the default is Master. Set it to Grandmaster for only the rarest.',
                },
                {
                  n: 3,
                  label: 'Notify on 99s & high totals',
                  body: '99s, every 100 total levels from 1800 up, and max.',
                },
                { n: 4, label: 'Notify on diary completions', body: 'achievement-diary tiers.' },
                {
                  n: 5,
                  label: 'Announce quest completions',
                  body: 'at or above the difficulty you pick. “All quests” here; the default is Master & up.',
                },
              ]}
            />
          </Section>

          {/* ---------------------------------------------------------------- 7 */}
          <Section id="clips" n={7} title="Clips with OBS" optional>
            <p className="text-text-muted">
              Press one key and the last 30 seconds get saved and dropped into the clan&rsquo;s clips
              channel. It&rsquo;s off by default and needs OBS running — but it&rsquo;s the closest
              thing to a highlight reel your clan will get.
            </p>
            <p className="text-text-muted">
              How it works: OBS keeps a rolling <span className="text-foreground font-medium">replay buffer</span>{' '}
              of the last X seconds. Your hotkey tells OBS to flush that buffer to a file, and the
              plugin picks the file up and uploads it to a Discord webhook you paste in.
            </p>

            <Note tag="Where your video goes">
              <p>
                Clips upload <span className="text-foreground">straight from your PC to Discord</span>.
                They never pass through this site, and nothing is uploaded at all if you leave the
                webhook field blank — clips just stay on your machine.
              </p>
            </Note>

            <h3 className="text-lg font-semibold pt-2">A. Set up OBS (once)</h3>
            <ol className="list-decimal pl-5 text-text-muted space-y-2 text-sm">
              <li>
                You need <span className="text-foreground font-medium">OBS Studio 28 or newer</span> —
                the WebSocket server is built in from 28 onward, no extra download.
              </li>
              <li>
                Make sure OBS is actually capturing the game: a Game / Window / Display Capture source
                that shows RuneLite. If OBS can&rsquo;t see your client, your clips will be a black
                rectangle.
              </li>
              <li>
                <span className="text-foreground font-medium">Settings → Output</span> → tick{' '}
                <span className="text-foreground font-medium">Enable Replay Buffer</span>. (Simple
                output mode puts it on the Recording page; Advanced mode gives it its own tab.) Check
                your recording path has free space while you&rsquo;re there.
              </li>
              <li>
                <span className="text-foreground font-medium">Tools → WebSocket Server Settings</span> →
                tick <span className="text-foreground font-medium">Enable WebSocket server</span>. Note
                the <span className="text-foreground font-medium">Server Port</span> (4455 by default)
                and click <span className="text-foreground font-medium">Show Connect Info</span> for
                the password.
              </li>
            </ol>
            <p className="text-text-muted text-sm">
              You do <em>not</em> need to press &ldquo;Start Replay Buffer&rdquo; — the plugin starts it
              for you when it connects, and restarts it whenever you change the clip length.
            </p>

            <h3 className="text-lg font-semibold pt-2">B. Fill in the plugin</h3>
            <Figure
              src="/guide/plugin-clips.png"
              width={522}
              height={884}
              alt="The Clips section of the plugin config with each setting boxed and numbered; the OBS host and webhook URL are hidden"
              caption="Configuration → Anvil → Clips"
              legend={[
                {
                  n: 1,
                  label: 'Enable clip capture',
                  body: 'the master switch. Off, the plugin never talks to OBS at all.',
                },
                {
                  n: 2,
                  label: 'Capture clip hotkey',
                  body: 'set this or nothing will ever happen. Pick something you won’t hit by accident mid-raid.',
                },
                {
                  n: 3,
                  label: 'OBS host / port / password',
                  body: (
                    <>
                      <code className="font-mono">localhost</code> when OBS runs on the same PC as
                      RuneLite. If OBS is on another machine, put that machine&rsquo;s local IP here —
                      hidden in this screenshot — and let the port through its firewall. Port and
                      password come from <em>Show Connect Info</em>; leave the password blank if you
                      turned OBS authentication off.
                    </>
                  ),
                },
                {
                  n: 4,
                  label: 'Max auto-post size (MB)',
                  body: 'anything bigger is saved locally and quietly mentioned in chat instead of being posted. Match it to what your Discord server actually accepts; the plugin ships at 25.',
                },
                {
                  n: 5,
                  label: 'Clip length (seconds)',
                  body: 'how far back each clip reaches. This writes the buffer length into your OBS profile, so OBS needs that many seconds of runway before a full-length clip exists. Longer clips = bigger files; 30 is a good middle.',
                },
                {
                  n: 6,
                  label: 'Save clips as MP4',
                  body: 'MP4 previews and plays inline in Discord; MKV has to be downloaded first. Note this changes OBS’s recording format, which affects your normal recordings too. Turn it off to leave OBS alone.',
                },
                {
                  n: 7,
                  label: 'Clips Discord webhook URL',
                  body: 'where clips get posted — ask an admin for the clips-channel webhook. Blank = clips stay on your PC. Hidden here, and worth hiding: anyone with this URL can post to that channel.',
                },
                {
                  n: 8,
                  label: 'Post OBS-triggered clips too',
                  body: 'also handle saves triggered by OBS itself or by the “Save Replay Buffer for OBS” plugin. Leave it off if you run two RuneLite clients against one OBS, or every clip posts twice.',
                },
              ]}
            />

            <h3 className="text-lg font-semibold pt-2">C. Use it</h3>
            <p className="text-text-muted">
              Something funny happens → press your hotkey → the chat walks you through it:
            </p>
            <Chat
              lines={[
                { text: 'Saving clip...' },
                { text: 'Uploading clip to the clan Discord...' },
                { text: 'Clip posted to the clan Discord.', tone: 'green' },
              ]}
            />
            <Note tag="Reminder" tone="green">
              <p>
                The clip covers the seconds <em>before</em> you pressed the key — so press it after the
                moment, not during. You have the length of your buffer to react.
              </p>
            </Note>

            <h3 className="text-lg font-semibold pt-2">Clip messages, decoded</h3>
            <Rows
              rows={[
                {
                  term: <code className="font-mono text-[12.5px]">{"Clip capture: OBS isn't connected."}</code>,
                  body: 'OBS isn’t running, the WebSocket server is off, or the host/port/password don’t match. Fix it and press again — the plugin retries the connection on its own every 30 seconds.',
                },
                {
                  term: <code className="font-mono text-[12.5px]">{'OBS could not save the clip — is the Replay Buffer started?'}</code>,
                  body: 'The buffer isn’t running. Check Enable Replay Buffer in OBS output settings, then toggle Enable clip capture off and on.',
                },
                {
                  term: <code className="font-mono text-[12.5px]">{'Clip saved locally — paste a Clips Discord webhook URL…'}</code>,
                  body: 'Working as intended, you just have no webhook set. The file is in your OBS recording folder.',
                },
                {
                  term: <code className="font-mono text-[12.5px]">{'Clip saved locally (48MB) — too big to auto-post.'}</code>,
                  body: 'Shorten the clip length, lower your OBS recording quality, or raise the max size if your server accepts bigger files.',
                },
                {
                  term: <code className="font-mono text-[12.5px]">{'…but Discord didn’t accept the upload.'}</code>,
                  body: 'Too big, rate-limited, or the upload timed out. The file is still on your PC — post it by hand if it’s worth it.',
                },
              ]}
            />
          </Section>

          {/* ---------------------------------------------------------------- 8 */}
          <Section id="trouble" n={8} title="When something breaks">
            <p className="text-text-muted">
              The plugin tells you in chat when tracking has stopped — it waits about 90 seconds before
              complaining and repeats at most every 5 minutes.
            </p>
            <Rows
              rows={[
                {
                  term: <code className="font-mono text-[12.5px]">{'Anvil: your Account Token was rejected — tracking is OFF.'}</code>,
                  body: (
                    <>
                      The token is wrong or was rotated. Re-copy it from{' '}
                      <Link href="/profile#plugin-token" className="text-gold hover:text-gold-light">
                        Profile → RuneLite plugin
                      </Link>
                      , or clear the field and sign in from the plugin again.
                    </>
                  ),
                },
                {
                  term: <code className="font-mono text-[12.5px]">{"Anvil: can't reach the site — tracking is OFF."}</code>,
                  body: (
                    <>
                      Check the Site URL for typos — it should be{' '}
                      <code className="font-mono break-all">{origin}</code>. If it&rsquo;s right, the
                      site is probably down.
                    </>
                  ),
                },
                {
                  term: <code className="font-mono text-[12.5px]">{'…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.'}</code>,
                  body: 'That account isn’t linked yet. Add it from Profile → “Accounts we noticed you playing”.',
                },
                {
                  term: <code className="font-mono text-[12.5px]">{'Anvil: reconnected — tracking is back on.'}</code>,
                  body: 'Nothing. It recovered by itself.',
                },
              ]}
            />

            <h3 className="text-lg font-semibold pt-2">Still stuck? Send an admin a log</h3>
            <p className="text-text-muted">
              Type <code className="font-mono text-gold/90">::anvillog</code> in game chat (or set the{' '}
              <span className="text-foreground font-medium">Export debug log hotkey</span> in the
              plugin&rsquo;s Support section). It writes a log file to your{' '}
              <code className="font-mono">.runelite/anvil-debug</code> folder, opens the folder, and
              copies the path to your clipboard — send that file to an admin and they can see exactly
              what went wrong.
            </p>
            <Note tag="Missing proofs?">
              <p>
                Pets and duplicate Champion&rsquo;s scrolls need a manual screenshot. Those get saved to{' '}
                <code className="font-mono">.runelite/osrs-bingo-pending/</code> and show up as a{' '}
                <span className="text-foreground">Saved proofs</span> row in the Collection Log&rsquo;s
                Bingo tab.
              </p>
            </Note>
          </Section>
    </GuideShell>
  );
}
