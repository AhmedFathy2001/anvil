// The guides, in words.
//
// English is the source of truth: every other locale is a partial of this shape, overlaid key by
// key at read time (see ./index). Keep the structure — nesting, key names, array lengths — stable,
// because a translator's file is matched against it. Renaming a key silently drops that string back
// to English in every language at once.
//
// Copy uses the inline markup from ./rich: **UI label**, _emphasis_, `verbatim`, [link](/href), and
// {value} for something the page fills in (site URL, clan name). Anything structural — image paths,
// sizes, which section is conditional — stays in the page, not here.

export const en = {
  common: {
    contents: 'Contents',
    step: 'Step',
    optional: 'optional',
    minRead: '{n} min read',
    language: 'Language',
    partialNotice:
      'This guide is only partly translated into {language}. Anything not yet translated is shown in English.',
    backToGuides: 'All guides',
  },

  index: {
    metaTitle: 'Guides — Anvil',
    metaDescription:
      'Setup guides for Anvil: the RuneLite plugin for players, running an event for clan staff, and hosting a visiting clan.',
    title: 'Guides',
    dek: 'Everything you need to get set up, written for the version of Anvil running right here.',
    cards: {
      plugin: {
        eyebrow: 'For players',
        title: 'RuneLite plugin setup',
        blurb:
          'Install the plugin, connect it to this site, and let it submit your drops. Covers Discord notifications and OBS clips.',
        minutes: '~3 min setup',
      },
      admin: {
        eyebrow: 'For clan staff',
        title: 'Running your first event',
        blurb:
          'Discord, roster sync, boards, tiles, teams and the draft, launching, and what to do once the event ends.',
        minutes: 'an evening, once',
      },
      clanVsClan: {
        eyebrow: 'For hosts',
        title: 'Hosting a visiting clan',
        blurb:
          'Clan-v-clan without collecting a single RSN by hand: one invite link per team, and a seat that lets their moderator run their own half.',
        minutes: '~5 min per team',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite plugin setup — Anvil',
    metaDescription:
      'Install the Anvil RuneLite plugin, connect it to this site, and set up Discord notifications and OBS clips.',
    eyebrow: 'Anvil · RuneLite plugin',
    title: 'Player setup guide',
    dek: 'Install it, point it at {clanName}, and play. The plugin submits your bingo drops, posts your rare drops and deaths to Discord, and — if you run OBS — saves and posts clips of the moments worth re-watching.',
    facts: [
      { strong: '2 fields', rest: 'to get tracking' },
      { strong: '~3 min', rest: 'for the basic setup' },
      { strong: 'Clips', rest: 'need OBS + 5 more minutes' },
    ],
    footnote:
      'Screenshots are from a live setup — the account token, OBS address and Discord webhook are blanked out on purpose. Yours should stay just as private.',

    install: {
      title: 'Install the plugin',
      body: [
        'In RuneLite: **Configuration** (the wrench) → **Plugin Hub** → search **Anvil** → **Install**. The publisher is `AhmedFathy2001`.',
        'One plugin serves every clan — you point it at this site in the next step, so there is nothing clan-specific to download. Once installed, open **Configuration → Anvil** to reach the settings panel shown throughout this guide.',
      ],
    },

    connect: {
      title: 'Connect to this site',
      intro: 'Only the **Setup** section matters to get going. Everything else has sensible defaults.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: "The Anvil plugin's Setup section, with the Site URL and Account Token fields boxed",
        legend: [
          {
            label: 'Site URL',
            body: 'for {clanName} that’s `{origin}`. This ships empty, so you must fill it in. No trailing slash needed, and `https://` is added if you leave it off.',
          },
          {
            label: 'Account Token',
            body: 'your personal key to this site. Either let the plugin fill it in for you (below), or paste it yourself. Treat it like a password.',
          },
        ],
      },
      easyHeading: 'The easy way: sign in from the plugin',
      easyIntro:
        'With the Site URL set and the token still empty, the **Anvil side panel** shows a **Sign in with Discord** button. Click it and the plugin walks you through it — no copying anything.',
      easySteps: [
        'The panel shows a code and opens your browser on this site.',
        'Check the code on the page matches the one in RuneLite, then click **Approve**.',
        'The panel says _Signed in_ and fills the Account Token in for you.',
      ],
      linkFigure: {
        caption: 'This site → /link-device',
        alt: 'The Link your RuneLite client page, with the code field and Approve button boxed',
        legend: [
          { label: 'The code', body: 'it must match what the plugin is showing you right now.' },
          {
            label: 'Approve',
            body: 'only ever approve a code _your own_ client is displaying. If someone sent you a link or a code, deny it — approving would hand them your account.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Why a second domain appears',
        body: [
          'Approving happens here, on `{origin}`. If you’re not signed into the site yet, the login step routes through Anvil’s shared Discord login on `anvilosrs.com` to confirm your Discord identity, then lands you straight back here — that’s the same login you get from the Login button on this site, not part of the plugin flow.',
          'The plugin itself only ever talks to `{origin}`: it refuses to open any sign-in page that isn’t on the Site URL you typed.',
        ],
      },
      directNote: {
        tag: 'Where this happens',
        body: [
          'Everything in this flow stays on `{origin}` — the code is issued here, approved here with {clanName}’s own Discord login, and the token is handed back here. The plugin refuses to open any sign-in page that isn’t on the Site URL you typed, so nothing in this step reaches another Anvil instance.',
        ],
      },
      federationAside:
        'Not to be confused with **Connect clans** in the side panel — that’s the separate, optional button that links you to other Anvil clans, and it only appears once you’re already signed in here.',
      manualFallback:
        'If the browser doesn’t open on its own, the panel prints the address and the code so you can open it manually. Codes expire after ten minutes — just press the button again.',
      manualHeading: 'The manual way: copy your token',
      manualIntro:
        'Log in with Discord and open [Profile](/profile), then scroll to the **RuneLite plugin** card.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'The RuneLite plugin card on the profile page, with the token field and the Reveal, Copy and Rotate buttons boxed',
        legend: [
          {
            label: 'Your token',
            body: 'hidden until you press Reveal. It’s blanked out in this screenshot on purpose; never post yours in Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'copy it into the plugin’s Account Token field. Rotate issues a new one and kills the old — use it if you ever think your token leaked.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Good to know',
        body: ['One token covers every event you’re signed up for here — you never re-paste it per bingo.'],
      },
    },

    accounts: {
      title: 'Link your accounts — just play',
      body: [
        'There’s no link code to type. Once the token is in, whichever account you log into gets matched to your profile automatically.',
        'The plugin sends your in-game name plus a stable account fingerprint with every request, and the site matches on the fingerprint first — so your links survive a name change. Log into an alt once and it shows up on your Profile under _Accounts we noticed you playing_ with a one-click **Add**.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'The RuneScape Accounts card on the profile page listing accounts verified via plugin',
        legend: [
          {
            label: 'Your linked accounts',
            body: 'anything marked “Verified via plugin” got there just by being played. Add as many alts as you like; one is your primary.',
          },
        ],
      },
      noPluginHeading: 'Can’t run the plugin?',
      noPluginIntro:
        'On mobile or the official client, link on the website instead — Profile shows both options:',
      noPluginOptions: [
        '**Verify by XP** — enter your RSN, the site picks a random skill, gain 1,000 XP in it within 30 minutes.',
        '**Manual review** — for hidden Hiscores or fresh alts: submit your RSN with a note and a moderator approves it.',
      ],
      signupNote: 'Event sign-ups need at least one verified account, so get this done before you sign up.',
    },

    working: {
      title: 'Check it’s working',
      intro: 'Log in and read your chat box. The plugin greets you when it’s connected and an event is live.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…later, as things happen…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'You should also see the **Anvil side panel** fill in with your event, your team and your tile progress, and a **Bingo** tab appear inside your in-game Collection Log.',
      guestNote: {
        tag: 'Guest vs member',
        body: 'If chat says _Tracked as a guest_, you’re being tracked but you’re not on the clan roster yet. An admin fixes that by syncing the in-game clan roster — ask {discordLink}.',
        discordWord: 'in Discord',
      },
    },

    bingo: {
      title: 'Bingo settings',
      intro:
        'These only matter while you’re in an event. The defaults are fine — this is what each one actually does.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'The Bingo section of the plugin config with each setting boxed and numbered',
        legend: [
          {
            label: 'Auto Submit Drops',
            body: 'screenshots and submits a tracked drop the moment it lands. Leave this on; it’s the whole point.',
          },
          {
            label: 'Show Overlay',
            body: 'draws a small _Anvil / Team / UTC date_ panel in the top-left. It becomes part of the picture in your proof screenshots, which is what makes a proof hard to fake or back-date. It’s off in this screenshot — turn it on if your clan wants team and time visible on every proof.',
          },
          {
            label: 'Team completion popups',
            body: 'a banner when anyone on your team finishes a tile. Several at once: the hardest gets the banner, the rest go to chat.',
          },
          {
            label: 'Bingo tab in Collection Log',
            body: 'puts your board inside the in-game Collection Log, alongside your saved proofs.',
          },
          {
            label: 'Banner sound + volume',
            body: 'plays a sound with the banner. Nothing plays until you add at least one .wav yourself, via the “Banner sounds” button in that Bingo tab.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'bakes a second frame into the screenshot a couple of seconds later, once loot has settled on the floor. Keep it on; it saves arguments.',
          },
        ],
      },
      startHeading: 'Starting shot',
      startBody: [
        'Some events ask everyone for a **starting shot**: one screenshot taken after the event goes live, at a location drawn at the start moment. It stops anyone from spending the week before the event stockpiling clues, caskets and kills to dump on the first day.',
        'If you run the plugin there is nothing to prepare. When the event starts you get a chat line telling you where to go, and the Anvil side panel shows a **Take starting shot** button. Stand where it says, press it once, and you’re done — the plugin captures the frame, stamps your RSN, team, the location and a keyword only your account gets onto it, and files it for you.',
        'Two things it checks before it files anything, so you fix them in-game rather than in a Discord argument afterwards. If the host pinned the spot on the map, the plugin knows how far away you are and tells you rather than sending a shot from the wrong side of Gielinor. And if the event asks for a fresh session, you need to **log out and back in** before taking it: your hiscores are only saved when you log out, so a relog right before the shot is what makes your starting totals — and therefore every XP and KC tile — correct.',
        'On mobile, or without the plugin: open **My Team** on this site, read your keyword off the starting-shot card, type it into the in-game chatbox, screenshot the game with your character and the keyword visible, and upload it on that same card. That upload counts immediately — you can play the moment it’s in, staff review it after the fact. Log out and back in first if the card asks you to.',
      ],
    },

    notifications: {
      title: 'Discord notifications',
      intro:
        'These fire whether or not a bingo is running, and they post to the clan’s channels. Which channel is set up here by the admins — you only choose _what_ you post.',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'The Deaths and kills and Drops and pets notification sections with each setting boxed and numbered',
        legend: [
          { label: 'Notify on death', body: 'posts to the clan deaths channel with a screenshot of the moment you died.' },
          { label: 'Death message', body: 'your own line. `{name}` is replaced with your RSN.' },
          { label: 'Notify on PvP kill', body: 'a screenshot of the tick your target hits 0 HP. Off by default; on here.' },
          { label: 'Notify on rare drops', body: 'the master switch for drop posts.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'two independent routes to a post: worth at least this much (GE or high alch, whichever is higher), or rarer than 1-in-N (1/10,000 by default — looser settings fill the channel with herb rolls). Your clan can set a rarity floor that applies to everyone; yours still applies when it is stricter. Set either to 0 to switch that route off.',
          },
          { label: 'Screenshot rare drops', body: 'attach the picture, not just the text.' },
          {
            label: 'Loot key value',
            body: 'a loot key posts once, as a single notification, when its whole contents clear this number.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pets post to the rare-drops channel.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'The Combat achievements notification section with each setting boxed and numbered',
        legend: [
          { label: 'Notify on combat achievements', body: 'tier clears always post when this is on.' },
          {
            label: 'CA task min tier',
            body: 'how noisy individual task completions are. Elite here; the default is Master. Set it to Grandmaster for only the rarest.',
          },
          { label: 'Notify on 99s & high totals', body: '99s, every 100 total levels from 1800 up, and max.' },
          { label: 'Notify on diary completions', body: 'achievement-diary tiers.' },
          {
            label: 'Announce quest completions',
            body: 'at or above the difficulty you pick. “All quests” here; the default is Master & up.',
          },
        ],
      },
    },

    clips: {
      title: 'Clips with OBS',
      intro: [
        'Press one key and the last 30 seconds get saved and dropped into the clan’s clips channel. It’s off by default and needs OBS running — but it’s the closest thing to a highlight reel your clan will get.',
        'How it works: OBS keeps a rolling **replay buffer** of the last X seconds. Your hotkey tells OBS to flush that buffer to a file, and the plugin picks the file up and uploads it to a Discord webhook you paste in.',
      ],
      privacyNote: {
        tag: 'Where your video goes',
        body: 'Clips upload **straight from your PC to Discord**. They never pass through this site, and nothing is uploaded at all if you leave the webhook field blank — clips just stay on your machine.',
      },
      obsHeading: 'A. Set up OBS (once)',
      obsSteps: [
        'You need **OBS Studio 28 or newer** — the WebSocket server is built in from 28 onward, no extra download.',
        'Make sure OBS is actually capturing the game: a Game / Window / Display Capture source that shows RuneLite. If OBS can’t see your client, your clips will be a black rectangle.',
        '**Settings → Output** → tick **Enable Replay Buffer**. (Simple output mode puts it on the Recording page; Advanced mode gives it its own tab.) Check your recording path has free space while you’re there.',
        '**Tools → WebSocket Server Settings** → tick **Enable WebSocket server**. Note the **Server Port** (4455 by default) and click **Show Connect Info** for the password.',
      ],
      obsAside:
        'You do _not_ need to press “Start Replay Buffer” — the plugin starts it for you when it connects, and restarts it whenever you change the clip length.',
      fillHeading: 'B. Fill in the plugin',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'The Clips section of the plugin config with each setting boxed and numbered; the OBS host and webhook URL are hidden',
        legend: [
          { label: 'Enable clip capture', body: 'the master switch. Off, the plugin never talks to OBS at all.' },
          {
            label: 'Capture clip hotkey',
            body: 'set this or nothing will ever happen. Pick something you won’t hit by accident mid-raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` when OBS runs on the same PC as RuneLite. If OBS is on another machine, put that machine’s local IP here — hidden in this screenshot — and let the port through its firewall. Port and password come from _Show Connect Info_; leave the password blank if you turned OBS authentication off.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'anything bigger is saved locally and quietly mentioned in chat instead of being posted. Match it to what your Discord server actually accepts; the plugin ships at 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'how far back each clip reaches. This writes the buffer length into your OBS profile, so OBS needs that many seconds of runway before a full-length clip exists. Longer clips = bigger files; 30 is a good middle.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 previews and plays inline in Discord; MKV has to be downloaded first. Note this changes OBS’s recording format, which affects your normal recordings too. Turn it off to leave OBS alone.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'where clips get posted — ask an admin for the clips-channel webhook. Blank = clips stay on your PC. Hidden here, and worth hiding: anyone with this URL can post to that channel.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'also handle saves triggered by OBS itself or by the “Save Replay Buffer for OBS” plugin. Leave it off if you run two RuneLite clients against one OBS, or every clip posts twice.',
          },
        ],
      },
      useHeading: 'C. Use it',
      useIntro: 'Something funny happens → press your hotkey → the chat walks you through it:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Reminder',
        body: 'The clip covers the seconds _before_ you pressed the key — so press it after the moment, not during. You have the length of your buffer to react.',
      },
      decodedHeading: 'Clip messages, decoded',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS isn’t running, the WebSocket server is off, or the host/port/password don’t match. Fix it and press again — the plugin retries the connection on its own every 30 seconds.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'The buffer isn’t running. Check Enable Replay Buffer in OBS output settings, then toggle Enable clip capture off and on.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Working as intended, you just have no webhook set. The file is in your OBS recording folder.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Shorten the clip length, lower your OBS recording quality, or raise the max size if your server accepts bigger files.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Too big, rate-limited, or the upload timed out. The file is still on your PC — post it by hand if it’s worth it.',
        },
      ],
    },

    trouble: {
      title: 'When something breaks',
      intro:
        'The plugin tells you in chat when tracking has stopped — it waits about 90 seconds before complaining and repeats at most every 5 minutes.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'The token is wrong or was rotated. Re-copy it from [Profile → RuneLite plugin](/profile#plugin-token), or clear the field and sign in from the plugin again.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Check the Site URL for typos — it should be `{origin}`. If it’s right, the site is probably down.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'That account isn’t linked yet. Add it from Profile → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nothing. It recovered by itself.',
        },
      ],
      logHeading: 'Still stuck? Send an admin a log',
      logBody:
        'Type `::anvillog` in game chat (or set the **Export debug log hotkey** in the plugin’s Support section). It writes a log file to your `.runelite/anvil-debug` folder, opens the folder, and copies the path to your clipboard — send that file to an admin and they can see exactly what went wrong.',
      missingNote: {
        tag: 'Missing proofs?',
        body: 'Pets and duplicate Champion’s scrolls need a manual screenshot. Those get saved to `.runelite/osrs-bingo-pending/` and show up as a **Saved proofs** row in the Collection Log’s Bingo tab.',
      },
    },
  },

  admin: {
    metaTitle: 'Running your first event — Anvil admin guide',
    metaDescription:
      'Set up a clan on Anvil and run a bingo end to end: Discord, roster sync, boards, tiles, teams and draft, launch, and what happens after the event ends.',
    eyebrow: 'Anvil · for clan staff',
    title: 'Running your first event',
    dek: 'The whole path, in the order you’ll actually walk it: get {clanName} configured, get the roster in, build a board, draft teams, start the thing, and hand out the prizes. Roughly an evening’s work for a first bingo — minutes for the second.',
    facts: [
      { strong: '4 steps', rest: 'in the setup wizard' },
      { strong: '7 formats', rest: 'to build a board from' },
      { strong: '1 button', rest: 'to sync the clan roster' },
    ],
    footnote:
      'This guide tracks the app as it ships today. If a screen here doesn’t match what you’re looking at, the app is right and the guide is stale — [tell us](/feedback) and we’ll fix it.',

    access: {
      title: 'Who can do what',
      intro:
        'Everyone signs in with Discord — there are no passwords. The first admin is seeded from the server config; after that, an admin promotes people from **Clan → Members & staff**. Roles stack downward: everything a moderator can do, a treasurer and an admin can do too.',
      rows: [
        {
          term: 'Admin',
          body: 'full access — events, tiles, teams, settings, staff, payouts. Give this to as few people as the clan can stand.',
        },
        { term: 'Treasurer', body: 'everything a moderator can do, plus sign-up fees and payouts.' },
        {
          term: 'Moderator',
          body: 'the day-to-day: roster, verifications, weekly competitions, schedule, feedback. Cannot create or edit events.',
        },
        {
          term: 'Editor',
          body: 'tile authoring only. Grant it globally, or scope it to specific boards so a guest board-builder can only touch the event you handed them.',
        },
        { term: 'Member', body: 'plays; no admin surface at all.' },
      ],
      ownerNote: {
        tag: 'Owner',
        body: 'One account is the owner. It can’t be demoted by anyone else and is the only role that can hand ownership on — so losing an argument with a co-admin can never cost you the clan.',
      },
    },

    setup: {
      title: 'Name the clan, connect Discord',
      intro:
        '**System → Setup** is a four-step wizard, and the dashboard keeps the same four as a checklist until they’re done: name the clan, connect Discord, create an event, add tiles. Status is computed from real data, so a step only ticks when it’s genuinely finished.',
      discord:
        'For Discord you have two routes, and they compose: give Anvil a **bot** and it can create webhooks, sync roles and nicknames, and build private team channels for you; give it a single **webhook URL** and it can post announcements and nothing else. Start with the webhook if you want to be live in two minutes, add the bot when you want the automation.',
      permsNote: {
        tag: 'Bot permissions',
        body: 'The bot needs _Manage Webhooks_, _Manage Roles_, _Manage Channels_ and _Manage Nicknames_, and its role must sit _above_ the roles it manages in your server’s role list. Discord silently refuses otherwise.',
      },
      hosted:
        'On a hosted plan you met that screen once already: adding the bot during setup is how Anvil learned which server is yours, so there was never a server ID to copy. The same link is here whenever you want to move the bot to a different server.',
    },

    channels: {
      title: 'Split posts across channels',
      body: [
        'Everything posts to one master announcements channel by default. When that gets noisy, open **System → Advanced settings → Webhooks** and give the loud categories their own homes — bingo events, weekly competitions, rare drops, deaths, PvP kills, combat achievements, clips. Anything left blank falls back to the master channel, so you can split one category at a time.',
        'With the bot connected you never touch a webhook URL: pick a channel from the dropdown and press **Create webhook**. On a busy event you can add a second webhook to the same channel — Anvil rotates between them so Discord’s rate limit doesn’t swallow posts.',
      ],
      clipsNote: {
        tag: 'The clips channel is different',
        body: 'Clip videos upload straight from each player’s PC to Discord — they never pass through this site. So the clips webhook you set here is the one you _hand out_: members paste it into their plugin themselves. Everything else on this page is server-side and members never see it.',
      },
    },

    roster: {
      title: 'Get your roster in',
      body: [
        'Clan membership comes from one place: an in-game roster sync. Install the [Anvil RuneLite plugin]({pluginGuide}) on an _admin’s_ account, open the in-game Collection Log’s **Bingo** tab, and press **Sync clan roster**. That pushes your actual in-game clan list to the site in one click.',
        'Anyone who links or verifies an account on the website without being on that roster is a **guest** — tracked, visible, but not a member until an admin promotes them or the next roster sync picks them up. That’s deliberate: it means nobody can self-promote into your clan by typing a name.',
        'You can also add someone by hand from **Clan → Members & staff**, including signing them up to an event on their behalf when they can’t reach the site.',
      ],
    },

    board: {
      title: 'Create your first board',
      intro:
        '**Events → All events → New event**. Pick a format first — it decides how the board is scored and what the rest of the form asks you for.',
      formats: {
        classic: { label: 'Classic bingo', blurb: 'A square N×N grid — teams complete tiles in any order, each worth 1.' },
        leagues: { label: 'Leagues bingo', blurb: 'A task list where each tile carries a point value — any number of tiles.' },
        race: { label: 'Tile race', blurb: 'An ordered track — teams reach tiles in sequence; furthest reached wins.' },
        showdown: {
          label: 'Showdown',
          blurb:
            'Tiles stay hidden until their scheduled moment — set each reveal time on the Tiles tab. Points-scored, DMM All Stars style.',
        },
        luckydraw: {
          label: 'Lucky draw',
          blurb: 'A bingo caller: hidden tiles go live in random draws on a fixed interval. Points-scored.',
        },
        bounty: {
          label: 'Bounty hunt',
          blurb:
            'One open tile at a time — the first team to finish it claims the points and the next bounty is drawn.',
        },
        ladder: {
          label: 'Ladder',
          blurb:
            'A points-scored task list ranked as an individual leaderboard (teams optional). Tasks rotate — progressive, one-at-a-time or a rotating window — and can decay in value. Monthly-ladder style.',
        },
      },
      outro:
        'Then set the dates, the sign-up window, and whether sign-ups carry a fee. Start from a template if you’d rather not start from an empty grid — the gallery holds both the built-in presets and any board you’ve saved as a template before.',
      utcNote: {
        tag: 'Dates are UTC',
        body: 'Every timestamp in Anvil is stored and compared in UTC, and rendered in each visitor’s local time. Set the end time you mean; the site will show a Brit and an Aussie two different clocks for the same moment.',
      },
    },

    tiles: {
      title: 'Fill the board',
      body: [
        'The event’s **Tiles** tab is where a board becomes a bingo. Each tile is one _kind_ of task, and the kind decides what the plugin watches for: a drop, a boss kill-count, skill XP, an NPC kill, a timed clear, an achievement diary, a Combat Achievement, a collection-log unlock, a PvP kill, an inventory gain, or a deathless run. Manual tiles — the ones a human verifies from a screenshot — are always an option too.',
        'For a full board, author in bulk: export the sheet, fill it in a spreadsheet, and import it back. CSV and .xlsx both round-trip, and rows map to positions, so you can rewrite a whole 25-tile grid in one paste.',
      ],
      rows: [
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
      ],
    },

    teams: {
      title: 'Teams and the draft',
      body: [
        'The **Teams & Draft** tab adapts to the format you chose: a format that doesn’t use teams skips straight past it. For a normal team bingo you create the teams, decide who captains them, and either assign players yourself or run a live draft.',
        'Captains draft from the sign-up pool in your chosen order, and each captain sees the answers people gave on the sign-up form — frozen as they were submitted, so nobody edits their “hours per week” after being picked.',
      ],
      lockNote: {
        tag: 'The draft locks the roster',
        body: 'Once a draft starts, the set of teams and the pick order are frozen. Add the team you forgot _before_ you press start, not after.',
      },
      visitingClans:
        'Playing another clan rather than drafting your own? A visiting side fields its own roster through one link, and their moderator runs it without an admin account here — see [Hosting a visiting clan]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Launch and run it',
      body: [
        'Reveal the tiles, then start the event. Anvil refuses to start a board that isn’t ready — a draft still in progress, or players with no team — and tells you which. If you know better (a scrim, a re-run, a board you’re testing), you can force it.',
        'From then on it mostly runs itself. The plugin auto-credits everything it can see and posts proof screenshots stamped with the team and a UTC timestamp. What lands in your lap is:',
      ],
      rows: [
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
      ],
      missionNote: {
        tag: 'Mid-event surprises',
        body: 'You can drop a **mission** onto a live bingo — a hidden bonus tile that gets announced when you fire it, optionally decaying in value or expiring. It’s the cheapest way to wake a board up on day five.',
      },
      startProofNote: {
        tag: 'Stopping pre-event stacking',
        body: [
          'Turn on **Starting shot** (event → Overview) and every player has to file one screenshot taken after the event goes live, at a location Anvil draws at the start moment — so nobody can be sat on a week of banked clues and caskets at T0. The location is announced with the start; each player’s keyword is personal, derived from the draw, and doesn’t exist until the event starts, so it can’t be staged in advance by anyone.',
          'Pin the spots on the world map (the pool editor has one) and the plugin checks players are actually standing there instead of just being told to. You can also require a **fresh session** — 15 minutes by default: hiscores only save when a player logs out, so making everyone relog right before their shot is what makes the starting totals behind every XP and KC tile honest.',
          'Plugin users press one button. Everyone else types their keyword in-game and uploads on My Team. You choose what happens to a credit from someone who hasn’t filed: flag it for review (default) or refuse it until they do. The same Overview panel is the review list — plugin captures with a verified keyword arrive already accepted, so in practice you’re only eyeballing the phone players.',
        ],
      },
    },

    after: {
      title: 'After the last tile',
      intro:
        'When the clock runs out the board freezes and the event locks — points, contributions and who-did-what are all frozen as they stood. If you need to fix something afterwards, an admin can unlock it deliberately.',
      rows: [
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
      ],
      federation:
        'With federation on, members can also connect to other Anvil clans from the plugin — handy for cross-clan events, and entirely opt-in per member.',
      outro: 'Then point your members at the [player setup guide]({pluginGuide}) and start planning the next one.',
    },
  },

  clanVsClan: {
    metaTitle: 'Hosting a visiting clan — Anvil host guide',
    metaDescription:
      'Run a clan-v-clan on Anvil: give each visiting clan an invite link that seats their players on one team, and a staff seat so their own moderator runs their half.',
    eyebrow: 'Anvil · for hosts',
    title: 'Hosting a visiting clan',
    dek: 'You host the board; they field the roster. This is the path that avoids collecting a dozen RSNs in a DM — one link per team, and a seat that lets their own moderator run their half of the event.',
    facts: [
      { strong: '1 link', rest: 'per visiting team' },
      { strong: '0 admin seats', rest: 'handed to outsiders' },
      { strong: '~5 min', rest: 'per clan you invite' },
    ],
    footnote:
      'Screenshots are from a live setup on a test board — invite tokens and Discord names are blanked out. A real link is worth guarding: anyone holding it can take a seat on that team while it is live.',

    shape: {
      title: 'What you’re setting up',
      body: [
        'A clan-v-clan is an ordinary event with one difference: half the players aren’t in your clan and never will be. They can’t be roster-synced in, you don’t want to promote them, and you certainly don’t want to sign twenty of them up by hand and then drag each one onto the right team.',
        'Two pieces solve that, and they’re independent — use either, or both.',
      ],
      rows: [
        {
          term: 'An invite link',
          body: 'a URL you mint once for one team. Whoever opens it signs in, fills in the normal sign-up form, and lands on that team already approved — no draft pool, no approval queue.',
        },
        {
          term: 'A team staff seat',
          body: 'a named person who can run _that one team_ — its roster, its submissions and proof, its fees — without an admin account here, and without taking the captain’s seat off whoever is actually playing.',
        },
      ],
      note: {
        tag: 'What an invite is not',
        body: 'It is not a login and not a shortcut past verification. Whoever opens it still signs in with Discord and still needs a verified RSN, exactly like any other sign-up. The only things the link decides are _which team_ the sign-up joins and that it needs nobody’s approval.',
      },
    },

    team: {
      title: 'Make the team first',
      body: [
        'Open your event and go to the **Teams & Draft** tab. Create one team per clan you’ve invited and name it after them — the name is what their players see on the sign-up form, so “Ironforge” beats “Team 2”.',
        'You do _not_ need to run a draft. Invite links and a draft are alternatives: a draft distributes a shared sign-up pool, a link seats people directly. On a pure clan-v-clan most hosts create the teams, hand out one link each, and never open the draft at all.',
        'Then open the team itself — **Teams & Draft → the team** — which is where both of the next two steps live.',
      ],
      captainNote: {
        tag: 'Captain first',
        body: 'Name the visiting side’s captain before you hand out the link, so the team page has an owner from the start. Naming a captain also seats them on the team; if the card warns you they aren’t on the roster, take the fix it offers.',
      },
    },

    staff: {
      title: 'Hand their moderator a seat',
      body: [
        'The **Team staff** panel on the team page is how the visiting clan’s own moderator gets to work without you granting them anything on your site. Press **Add someone**, search for them, add a note like “Ironforge’s mod” so the next admin knows why they’re there, and press **Give a seat**.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → the team → Team staff',
        alt: 'The Team staff panel with one seat granted and the add-someone search open',
        legend: [
          {
            label: 'Add someone',
            body: 'opens the search. Only people who have signed in here with Discord at least once can appear — see the note below.',
          },
          {
            label: 'The note',
            body: 'free text, 120 characters. Write which clan they are from. Seats outlive the event in the list, and “who is this person” is the question you will have in three months.',
          },
          {
            label: 'Remove',
            body: 'takes the seat back immediately. Do this when the event ends — a seat is not automatically time-limited.',
          },
        ],
      },
      canDo: 'What a seat can do, on that team only:',
      canDoList: [
        'see and manage the team’s roster',
        'handle its submissions and proof',
        'mark its players’ fees paid',
        'mint invite links for it, if you turn that on (next step but one)',
      ],
      cantDo: 'What it can never do:',
      cantDoList: [
        'touch any other team',
        'edit the board or its tiles',
        'make draft picks',
        'sub anyone out once the event is live',
      ],
      note: {
        tag: 'They must sign in here once first',
        body: 'The search only lists accounts with a linked Discord — a seat is attached to a person who can actually log in. So send the visiting moderator to this site, have them press **Login** once, and _then_ grant the seat. If they don’t appear in the search, that login hasn’t happened yet.',
      },
    },

    link: {
      title: 'Mint the invite link',
      body: [
        'Still on the team page, the **Invite links** panel makes the link. Two fields decide what the link promises, and both take `0` to mean “don’t promise anything”.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → the team → Invite links',
        alt: 'The Invite links panel with the seats and expiry fields, the Make a link button, and one live link listed',
        legend: [
          {
            label: 'Seats and expiry',
            body: 'how many people the link may seat (up to 100) and how long it stays good for (up to 30 days). Set the seats to the roster size they promised you and the link closes itself when they’re all in; set an expiry when the link is going into a public Discord. `0` in either field means no limit.',
          },
          {
            label: 'Make a link',
            body: 'mints it and copies it to your clipboard straight away. Paste it to them before you do anything else.',
          },
          {
            label: 'The live list',
            body: 'every link this team has out, with how many have joined and how many seats are left. **Copy** grabs it again; **Turn off** kills it for good.',
          },
        ],
      },
      shape: 'The link looks like `{origin}/events/{eventId}/join/{token}` — one line, safe to paste into a Discord message.',
      note: {
        tag: 'Sensible defaults',
        body: 'For a clan-v-clan where you’ve agreed a roster with one moderator, leave both fields at `0` and let them run it. Reach for seats and expiry when the link is going somewhere you don’t control.',
      },
      revoke:
        'Turning a link off is instant and does not remove anyone who already joined — they are ordinary players on that team now. To take someone off, use the team’s roster.',
    },

    captains: {
      title: 'Let them mint their own links',
      body: [
        'By default only a host can make links, and a captain who tries is told so. That default is right for a normal clan event — a captain handing out seats would be filling a roster nobody approved — and wrong for a clan-v-clan, where the visiting side knows its own roster better than you do.',
        'The switch is on the same **Invite links** panel: **Let captains make their own links**. It applies to _every team in this event_, not just the one you’re looking at, which is what you want when both sides are visiting clans.',
        'With it on, the team’s captain and anyone holding a staff seat can mint links themselves from **My Team → Invite links**. They get the same panel you do, minus the switch.',
      ],
      figure: {
        caption: 'My Team → the team → Invite links',
        alt: 'The captain-side Invite links tab on the team hub, with the seats and expiry fields and one live link',
        legend: [
          {
            label: 'Same panel, captain’s view',
            body: 'mint, copy, turn off. If the host hasn’t turned the switch on, this reads “Only a host can make links for this event” and the fields are gone.',
          },
          {
            label: 'The live list',
            body: 'a captain who can’t mint still sees the links their team has out — so they can ask you for another instead of assuming none exist.',
          },
        ],
      },
    },

    player: {
      title: 'What their players see',
      intro: 'Worth walking once yourself before you hand the link out, so you can answer questions about it.',
      steps: [
        'They open the link. If they’re not signed in, they sign in with Discord first and come straight back — the link isn’t lost on the way.',
        'They land on the ordinary sign-up form, with a banner reading **You’re joining {teamExample} by invite**. Same questions, same account picker, same fee as anyone else.',
        'On submit they are on that team, approved. No host action, no draft.',
      ],
      figure: {
        caption: 'The sign-up form, opened through an invite link',
        alt: 'The event sign-up form with a banner saying the player is joining a named team by invite',
        legend: [
          {
            label: 'The invite banner',
            body: 'names the team they are about to join. If it names the wrong team, they have the wrong link — stop and check before submitting.',
          },
          {
            label: 'The rest of the form',
            body: 'unchanged. A verified RSN is still required, sign-up questions are still asked, and a sign-up fee still applies.',
          },
        ],
      },
      note: {
        tag: 'Already signed up?',
        body: 'If someone signed up normally first and is sitting in the pool, opening the link moves them onto the team instead of creating a second entry. Someone already approved onto another team is left alone — move them from the roster instead.',
      },
    },

    dead: {
      title: 'When a link stops working',
      intro:
        'A refused link explains itself on the page rather than 404ing, so the person holding it can tell you which of these it is.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Someone pressed **Turn off**. Mint a fresh one — an old link never comes back.',
        },
        {
          term: 'This invite has expired.',
          body: 'It hit the hours you set. Mint another, with `0` hours this time if the expiry isn’t earning its keep.',
        },
        {
          term: 'This invite is full.',
          body: 'Every seat is taken. Raise it by minting a new link with more seats — the seat count is fixed once a link exists.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'The only one that can fix itself. Check the event’s sign-up window: opened yet, deadline passed, or the event already started.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'A link from another board got pasted. Check the event id in the URL matches the one you meant.',
        },
      ],
      checklist: 'Before the event, walk this list once per visiting clan:',
      checklistItems: [
        'their team exists and is named after them',
        'their captain is named and seated',
        'their moderator has signed in here and holds a staff seat',
        'the link is minted, copied, and actually delivered to a human',
        'the sign-up window is open for as long as they need it',
      ],
      note: {
        tag: 'When it’s over',
        body: 'Turn the links off and remove the staff seats. Neither expires on its own, and a live link on a finished event is just a loose end.',
      },
    },
  },
};

export type GuideDict = typeof en;

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** What a locale file exports: as much or as little of `en` as it has translated. */
export type PartialGuideDict = DeepPartial<GuideDict>;

export default en;
