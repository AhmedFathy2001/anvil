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
    unreviewedNotice:
      'This {language} translation hasn’t been checked by a native speaker yet. If a sentence reads wrong, the [English page]({englishHref}) is the original — and [telling us](/feedback) is what gets it fixed.',
  },

  index: {
    metaTitle: 'Guides — Anvil',
    metaDescription:
      'Setup guides for Anvil: the RuneLite plugin for players, running an event for clan staff, and hosting a visiting clan.',
    title: 'Guides',
    dek: 'Everything you need to get set up, written for the version of Anvil running right here.',
    groups: {
      playing: 'Playing',
      running: 'Running an event',
      clan: 'Running the clan',
    },
    cards: {
      clan: {
        eyebrow: 'For anyone starting one',
        title: 'Start a clan',
        blurb:
          'Two names and an address, and it is live. Then Discord, your roster, and the first board.',
        minutes: '~4 min, free',
      },
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
      board: {
        eyebrow: 'For board builders',
        title: 'Building a board that tracks itself',
        blurb:
          'What each tile kind can actually see, bulk authoring by spreadsheet, and the mistakes that import cleanly and then never fire.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'For captains',
        title: 'Captain’s guide',
        blurb:
          'Reading the pool before the clock starts, draft day itself, and the parts of running a team that begin after it.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'For clan staff',
        title: 'Formats, and how tiles open',
        blurb:
          'Seven board shapes, five ways tiles become playable, and the three modifiers that decide what a completion is worth.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'For treasurers',
        title: 'Fees and payouts',
        blurb:
          'Charging an entry fee, collecting it, the second signature that settles it, and turning a pool into paid placements.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'For moderators',
        title: 'On the rota',
        blurb:
          'The queue, verifying submissions and accounts, keeping the roster honest, and the judgement calls that reach a person.',
        minutes: '~5 min',
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

  clan: {
    metaTitle: 'Start a clan — Anvil',
    metaDescription:
      'Create a clan on Anvil: name it, pick its address, connect Discord, sync your roster and run your first event.',
    eyebrow: 'Anvil · starting out',
    title: 'Start a clan',
    dek: 'Two names and an address, and your clan is live — free, and there is nothing to wait for. This is that, plus the four things worth doing straight afterwards.',
    facts: [
      { strong: 'Free', rest: 'no card, no trial' },
      { strong: 'Live', rest: 'the moment you submit' },
      { strong: '~4 min', rest: 'to a working clan' },
    ],
    footnote:
      'You can change every one of these later from Admin → Clan, except the address — that one is worth a moment’s thought now.',

    before: {
      title: 'Before you start',
      body: [
        'You need a Discord account, and that is the whole list. Sign in on `{apex}` first: a clan needs an owner, and signing in is how the site knows that is you. Start from **Start a clan** on the platform pages, or go straight to `{apex}/clans/new`.',
        'It costs nothing. There is no plan to pick, no card to enter, and no trial that expires and takes your board with it — a clan starts free and stays usable.',
      ],
      note: {
        tag: 'You will be its owner',
        body: 'Owner is the one role nobody can take from you, and it goes to whoever creates the clan. Add staff afterwards from Admin → Clan; see the {moderatorGuide}.',
      },
    },

    create: {
      title: 'Name it, and pick its address',
      intro:
        'Three fields, and only two real decisions. The form checks the address as you type and tells you before you submit.',
      fields: [
        {
          term: 'In-game clan name',
          body: 'Required, and it has to match OSRS **exactly**. This is not decoration: roster sync matches on it and refuses a roster reported under any other name. That is what stops somebody else’s member list landing on your site.',
        },
        {
          term: 'Clan name',
          body: 'Optional. What people see — on the site, and on every Discord post. Leave it blank and your in-game name is used for both.',
        },
        {
          term: 'Address',
          body: 'Your clan lives at `{apex}/c/your-slug`. It is suggested from the name you typed, you can edit it, and a handful of words are reserved. Pick one you will still like in a year: it is the link that ends up pinned in your Discord.',
        },
      ],
      note: {
        tag: 'The in-game name is a lock, not a label',
        body: 'If your clan renames in game, change it here too — until you do, roster sync refuses the new name. That is the check working, not a fault.',
      },
    },

    live: {
      title: 'It is live',
      body: [
        'Press **Create clan** and it exists. No provisioning, no queue, no “we are building your site, check back in a few minutes” — a clan is a row, so it is serving before the page finishes changing.',
        'You land on a choice of **Set it up**, which opens the wizard, or **Take a look first**. Nothing breaks if you wander off and come back tomorrow; the wizard remembers which steps you have done.',
      ],
    },

    setup: {
      title: 'The setup wizard',
      intro:
        'Four things stand between a fresh clan and a running event. The wizard walks them in order and skips whatever you have already done.',
      steps: [
        {
          term: 'Name it in Discord',
          body: 'Your display name, your in-game clan name, and an invite link to your server. The invite is what lets sign-up pages and guides point people at you.',
        },
        {
          term: 'Connect Discord',
          body: 'One shared bot, so there is no application to register and no token to paste. Approve it once and it can post to your channels and read your roles.',
        },
        {
          term: 'Give it a channel',
          body: 'An announcements channel for event posts. Optionally split the plugin’s feeds out: rare drops in one channel, deaths in another, so neither drowns the other.',
        },
        {
          term: 'Make a board',
          body: 'The first event. Pick a format, add tiles, open sign-ups — that is the {adminGuide}, and it is the longest of the four by a distance.',
        },
      ],
      after: [
        'You can skip the wizard entirely and do all of it from Admin → Clan later. It exists because the order matters when you have never done it: Discord before channels, channels before a board that wants to post to them.',
      ],
    },

    members: {
      title: 'Getting your members in',
      body: [
        'Nobody has to sign up, register, or be invited one at a time. Your roster comes from the game.',
      ],
      ways: [
        {
          term: 'Roster sync (do this one)',
          body: 'Open the clan window in game with the plugin running and press the **Anvil** button in its title bar. Your whole member list arrives with ranks intact, and it refuses a roster from a clan whose name does not match yours. Repeat it whenever people join or leave — see the {pluginGuide}.',
        },
        {
          term: 'They just play',
          body: 'Anyone running the plugin who logs in is recognised automatically. If they are not on the roster yet they are tracked as a **guest** — visible, countable, and one sync away from being a member.',
        },
        {
          term: 'By hand',
          body: 'Admin → Clan takes names one at a time, for the person on mobile or the official client who cannot run the plugin at all.',
        },
      ],
      note: {
        tag: 'Guests are not a problem to solve',
        body: 'A guest is simply somebody we have seen who is not on your roster — a visiting clan’s player, an alt, someone who joined this morning. They can play in events without ever becoming a member.',
      },
    },

    first: {
      title: 'Your first event',
      body: [
        'The shortest path to something happening: make a board, add a handful of tiles the plugin can see by itself, open sign-ups, and start it. Drops, kill counts and XP then file themselves.',
        'Two guides carry the weight here. The {adminGuide} runs start to finish — Discord, teams, launching, and what to do when it ends. The {boardGuide} is about tiles specifically: what each kind can actually detect, and the ones that import cleanly and then never fire.',
        'If you would rather not build a board at all in your first week, run a **Skill of the Week** or **Boss of the Week** instead. Everyone on the roster is enrolled automatically, the standings move off the hiscores, and there is nothing to author.',
      ],
    },

    together: {
      title: 'Events across several clans',
      body: [
        'An event does not have to belong to one clan. Several clans can run the same board together — two, or a dozen — with each side keeping its own roster, its own staff and its own half of the moderation.',
        'They can also share one pool of players rather than sitting on opposite sides of a scoreboard: one event, everybody in it, however the teams end up cut. Clan-versus-clan is one shape this takes, not the only one.',
        'Each visiting clan gets an invite link per team, so you never collect a single RSN by hand, and a seat that lets their own moderator approve their own members’ proof. The {clanVsClanGuide} covers hosting one.',
      ],
      note: {
        tag: 'Nothing to buy',
        body: 'Joining somebody else’s event is free, and so is hosting one. A clan that only ever turns up to other people’s boards never needs anything beyond its own free clan.',
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
        'You should also see the **Anvil side panel** fill in with your clans, your live events, your placing and the sync buttons — and an **Anvil** button appear in the title bar of your in-game Collection Log, next to WikiSync and RuneProfile.',
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
            label: 'Banner sound + volume',
            body: 'plays a sound with the banner. Nothing plays until you add at least one .wav yourself, via **Add clip** under “Banner sounds” in the Anvil side panel.',
          },
          {
            label: 'Distinct mission sound',
            body: 'gives a mission dropping — and someone claiming one — its own chime, so you can tell it from an ordinary tile completion without looking.',
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
        body: 'Pets and duplicate Champion’s scrolls need a manual screenshot. The plugin takes one for you and saves it to `.runelite/osrs-bingo-pending/` — **Copy folder path** in the Anvil side panel opens it — so you attach it on the site rather than hunting for a shot after the fact.',
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
      seeAlso:
        'Two of those roles have a page of their own: [On the rota]({moderatorGuide}) for what a moderator actually does with their evening, and [Fees and payouts]({feesGuide}) for the treasurer.',
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
      seeAlso:
        'Format is only half the decision — how tiles become playable is the other half, and the two compose. Both in full: [Formats, and how tiles open]({formatsGuide}).',
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
      seeAlso:
        'Which kind to reach for, how to write two hundred of them in a spreadsheet, and the mistakes that import cleanly and then never fire: [Building a board that tracks itself]({boardGuide}).',
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
      seeAlso:
        'Send your captains [the captain’s guide]({captainGuide}) before draft night — the war room is most useful in the days before, and nobody reads a new screen while a clock is running.',
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
  board: {
    metaTitle: 'Building a board — Anvil tile-authoring guide',
    metaDescription:
      'Author bingo tiles that credit themselves: what each tile kind can actually see, bulk authoring by spreadsheet, and the mistakes that fail silently.',
    eyebrow: 'Anvil · for board builders',
    title: 'Building a board that tracks itself',
    dek: 'A tile is a promise that something will be noticed. This is what each kind can actually see, how to write two hundred of them without losing your evening, and the handful of mistakes that fail quietly — the tile just never fires, and nobody finds out until day four.',
    facts: [
      { strong: '15 kinds', rest: 'one per tile, never mixed' },
      { strong: '1000 tiles', rest: 'per board, by spreadsheet' },
      { strong: 'Silent', rest: 'is how a bad tile fails' },
    ],
    footnote:
      'The spreadsheet format is specified in full in `docs/tile-authoring.md`, which is written for whoever (or whatever) is generating the rows. This page is the human half: which kind to reach for, and what goes wrong.',

    kinds: {
      title: 'One tile, one kind',
      body: [
        'Every tile is exactly one _kind_, and the kind is the whole question: it decides what the plugin or the hiscores sweep watches for, and therefore whether the tile can ever complete on its own. Mixing fields from two kinds is refused at the door rather than accepted and left broken.',
        'The kinds fall into three families, and the family matters more than the label:',
      ],
      families: [
        {
          term: 'Manual',
          body: 'a human looks at a screenshot and says yes. Always available, always works, always costs someone their evening. Use it for the things software cannot see.',
        },
        {
          term: 'Hiscores-polled',
          body: 'skill XP and boss kill-count, read from the official Hiscores on a 15-minute sweep. Needs no plugin, works for everyone on the roster — but only sees what the Hiscores track, and only after the player logs out.',
        },
        {
          term: 'Plugin-detected',
          body: 'everything else: drops, NPC kills, timed clears, diaries, combat tasks, laps, loot value. Credits within seconds and bakes a proof screenshot — but only for players actually running the plugin.',
        },
      ],
      kindsIntro: 'The full list, as the kind picker offers them:',
      /**
       * Per-kind label and one-liner. Keys match TileKindKey in lib/tileKinds, and the page falls
       * back to the app's own TILE_KIND_BADGES for anything missing — so a kind added to the picker
       * shows up here without an edit, in English until somebody translates it.
       */
      kindLabels: {
        standard: { label: '', blurb: '' },
        skill: { label: '', blurb: '' },
        boss: { label: '', blurb: '' },
        drop: { label: '', blurb: '' },
        collection: { label: '', blurb: '' },
        kill: { label: '', blurb: '' },
        lap: { label: '', blurb: '' },
        pvp: { label: '', blurb: '' },
        gain: { label: '', blurb: '' },
        timed: { label: '', blurb: '' },
        deathless: { label: '', blurb: '' },
        lms: { label: '', blurb: '' },
        value: { label: '', blurb: '' },
        diary: { label: '', blurb: '' },
        ca: { label: '', blurb: '' },
      },
      note: {
        tag: 'The plugin question, asked once',
        body: 'A plugin-detected tile is invisible to a player who does not run the plugin. That is not a bug you can configure away — nothing is watching. If a chunk of your clan plays on mobile or the official client, either keep those tiles off the critical path to a win, or pair them with a manual fallback and expect to verify screenshots.',
      },
    },

    pick: {
      title: 'Pick the kind that will actually fire',
      intro:
        'Most badly-behaved tiles are the right idea expressed as the wrong kind. The four that catch people:',
      rows: [
        {
          term: 'A boss KC goal',
          body: 'is **not** a kill tile. Kill tiles watch NPC deaths through the plugin; a KC goal is a hiscores number and needs `trackedStat` + `statType=boss` + `statGoal`. Use a kill tile for things the Hiscores never counted — cows, chickens, a specific slayer mob.',
        },
        {
          term: 'A collection-log slot',
          body: 'is a drop tile. Unlocking the log entry credits it, so the tile fires even on a duplicate the player already owned — which is usually what you meant.',
        },
        {
          term: '“Get one of each”',
          body: 'is a drop tile with an item list and **no** `requiredAmount`. Add a `requiredAmount` and it silently becomes “get any N of these” instead — the same row, a completely different tile.',
        },
        {
          term: 'A diary or combat task',
          body: 'only credits off the in-game completion message, which fires the moment the tier or task is finished. Anything a player already owns cannot re-fire — except a combat task, where **Settings → Combat Achievements → Repeat completion** lets them trigger it again.',
        },
      ],
      note: {
        tag: 'Composite boss tiles',
        body: 'A boss tile’s tracked stat may hold several Hiscores keys separated by commas, and gains sum across them. `chambersOfXeric,chambersOfXericChallengeMode` is one tile that counts CoX and CM together, which is nearly always what a raid tile means.',
      },
    },

    bulk: {
      title: 'Author in bulk, not in the browser',
      body: [
        'Clicking out a 25-tile grid is fine. Clicking out a 200-task Leagues board is not, and neither is proof-reading it afterwards. The Tiles tab has a round trip built for exactly this.',
      ],
      steps: [
        '**Download spreadsheet** on the event’s **Tiles** tab. You get an .xlsx of the board as it stands, with dropdowns, the item list and the column instructions on their own sheets.',
        'Edit it. One row per tile; row order is tile order.',
        '**Upload CSV / Excel** on the same tab. Only the **Tiles** sheet is read.',
      ],
      rules: [
        {
          term: 'The round trip is lossless',
          body: 'download and re-upload unchanged and nothing happens — matching rows are reported as unchanged and not even re-stamped. That makes the export safe to use as a backup before a big edit.',
        },
        {
          term: 'Rows map by position',
          body: 'row 1 is tile 1. Existing tiles are updated in place, and a column you leave out is left alone rather than blanked — so you can ship a two-column sheet that only edits points.',
        },
        {
          term: 'Only dynamic boards grow',
          body: 'extra rows create new tiles on a Leagues board or a tile race, before the event starts, up to 1000. A classic N×N grid is a fixed shape and ignores them. To generate hundreds of tasks, make it a Leagues event.',
        },
        {
          term: 'All or nothing',
          body: 'every row is validated first. One unresolvable item name fails the whole import, names the offenders, and changes nothing — you never get half a board.',
        },
        {
          term: 'Some fields lock at start',
          body: 'label, kind, required amount and item config are only applied before the event starts. Description, points, category and the optional flag stay editable throughout, so you can fix a typo mid-event without reopening the board.',
        },
      ],
    },

    traps: {
      title: 'The mistakes that fail silently',
      intro:
        'Every one of these imports cleanly, sits on the board looking correct, and never fires. They are worth a read-through before you upload rather than after.',
      rows: [
        {
          term: 'Skill and boss tiles are `type=standard`',
          body: 'there is no `type=skill`. The kind comes from `trackedStat` + `statType` + `statGoal` on an otherwise standard row. Writing `type=boss` is refused; writing `type=standard` and forgetting the stat columns is not — you get a manual tile nobody will ever approve.',
        },
        {
          term: 'Separators differ by column',
          body: '`items` uses semicolons (comma is the CSV delimiter). `targetNpcs` uses pipes. On a combat-task row pipes are the **only** option, because real task names contain commas — `Nylocas, On the Rocks` is one task.',
        },
        {
          term: 'Raid names are matched verbatim',
          body: 'a deathless or timed raid tile carries the mode as written in game: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. A near-miss spelling is a tile that never completes. Entry Mode clears never credit a base-raid tile; harder modes do.',
        },
        {
          term: 'Item names must be exact',
          body: 'in-game spelling, or the import fails and lists what it could not resolve. When a name is ambiguous, pin it as `Name#id` and stop guessing.',
        },
        {
          term: '`timeThresholdSeconds` means four things',
          body: 'a time cap on a timed tile, a placement cap on an LMS tile (1 = win), an exact party size on a deathless tile, and an exact raid party size on a drop tile. Same column, four meanings — check you are filling in the one your kind reads.',
        },
        {
          term: 'A required amount on the wrong kind',
          body: 'it belongs on drop, kill, gain, lap, PvP, deathless and LMS rows. On a stat or timed row it does nothing, and on a drop row it flips an item set into an any-N pool.',
        },
      ],
      note: {
        tag: 'Test one before you write two hundred',
        body: 'Author a single tile of the kind you are unsure about, reveal it on a throwaway event, and go do the thing. Five minutes there beats finding out on the clan’s bingo night that a whole category was dead.',
      },
    },

    points: {
      title: 'Points, tiers and whether it is fair',
      body: [
        'On a points-scored board every tile carries its own value, and those values map onto named difficulty bands — easy through elite — which you can edit under **Advanced settings** if your clan grades differently. The band is what players read; the number is what scores.',
        'Mark a tile **optional** and it stops counting toward the board total, which is how you add stretch goals without making a blackout impossible.',
        'When the board is full, run the **balance auditor** from the Tiles tab. It checks the structure and the effort spread and tells you where the board is lopsided — a category nobody can finish, a tier that is worth far more per hour than its neighbours — before players find those things for you and route around them.',
      ],
    },

    reveal: {
      title: 'Nobody sees it until you say so',
      body: [
        'New boards start hidden. Staff always see them; players see nothing at all until you reveal — so a board can be built in the open, over days, in a channel your members can read, without spoiling anything.',
        'That master switch is the floor for everything else. On a board with a reveal policy — scheduled, interval, bounty, rotating — the engine only starts flipping individual tiles once the board itself is revealed, so arming a board is always a deliberate act. Which policy to choose is its own page: [Formats and how tiles open]({formatsGuide}).',
        'Missions are the exception worth knowing: tiles authored up front but held back, announced mid-event from their own pool while the rest of the board stays visible.',
      ],
    },

    check: {
      title: 'Before you reveal',
      intro: 'Worth walking once per board. Most of it is five minutes.',
      items: [
        'every tile has the kind you meant, not the kind that imported cleanly',
        'raid modes, item names and task names match the in-game spelling character for character',
        'the plugin-detected tiles are not the only route to winning, if part of your clan plays without it',
        'points are set and the balance auditor is happy, or you disagree with it on purpose',
        'optional tiles are marked optional',
        'you have downloaded the spreadsheet once, as a backup you can re-upload',
      ],
      note: {
        tag: 'Who can do this',
        body: 'Board authoring is the one admin job with its own role. An **editor** can author tiles and nothing else, and can be scoped to specific boards — so a guest board-builder from another clan gets exactly the event you handed them and no access to anything else you run.',
      },
    },
  },

  captain: {
    metaTitle: 'Captain’s guide — Anvil',
    metaDescription:
      'Draft day and the weeks after it: reading the pool before the clock starts, making picks, and running your team’s roster, proof and fees.',
    eyebrow: 'Anvil · for captains',
    title: 'Captain’s guide',
    dek: 'You get handed a war room, a clock and twenty-five strangers’ sign-up forms. This is what all of it does, in the order you meet it — plus the parts of running a team that only start after the draft is over.',
    facts: [
      { strong: 'Snake order', rest: 'so late picks even out' },
      { strong: 'The clock', rest: 'never picks for you' },
      { strong: 'One tab', rest: 'runs your team all event' },
    ],
    footnote:
      'Everything here is what a captain sees. Fees, other teams’ rosters and the board before reveal are staff-side and stay that way, so nothing on this page will get you accused of looking at something you shouldn’t.',

    before: {
      title: 'What you get, and when',
      body: [
        'A host names you captain, which does two things: it seats you on the team as a player, and it opens the team’s surfaces to you. If the team page ever warns that you aren’t actually on the roster, take the fix it offers — a captain outside their own team is a state that confuses every screen downstream.',
        'From then on you have two places to be. **My Team** is your team’s hub, and it is where you spend the event. The **war room** is the draft-day screen, and it opens as soon as sign-ups do — long before draft night.',
      ],
      note: {
        tag: 'Go early',
        body: 'The war room is most useful in the days _before_ the draft, when you can read every sign-up form properly. On the night it becomes a stopwatch and you will not have time to read anything.',
      },
    },

    warroom: {
      title: 'Read the pool before the clock starts',
      body: [
        'The war room shows everyone who could be picked, with everything the site knows about them: what they play, the bosses they have real kill-counts at, how many past events they turned up for, and the answers they gave on the sign-up form.',
        'Those answers are **frozen as they were submitted**. Nobody edits their “hours per week” after seeing who got picked first, which is the entire reason they are worth reading.',
        'Build a **shortlist** while you read. It is private to you, it survives until draft night, and on the night it is the difference between picking from a list you already trust and picking whoever is at the top of the screen.',
      ],
      rows: [
        {
          term: 'Rating and tier',
          body: 'a summary of what someone has actually done, derived from their account history rather than from what they told you. Advisory — it is a starting point for a conversation, not a verdict.',
        },
        {
          term: 'Domains and markers',
          body: 'what they demonstrably do: raids, PvM, skilling, PvP. Useful for spotting the gap in your roster rather than taking the highest number four times.',
        },
        {
          term: 'Attendance',
          body: 'how often they finished past events they signed up for. The quietest number on the page and frequently the most predictive one.',
        },
      ],
    },

    draft: {
      title: 'Draft day',
      body: [
        'Picks run in **snake order**: with four teams the first round goes A, B, C, D and the second goes D, C, B, A, so picking last in one round means picking first in the next. Whoever drew the first pick pays for it a minute later.',
        'A person is one pick, not one account. Taking someone pulls every account they registered onto your team together — you never spend a second pick on somebody’s alt.',
      ],
      rows: [
        {
          term: 'The pick clock',
          body: 'if the host set one, you get that many seconds per turn. When it expires it does **not** pick for you — it unlocks the host’s ability to pick on your behalf, and says so on both screens. Nothing happens silently.',
        },
        {
          term: 'A narrowed list',
          body: 'some events run a balance mode. Depending on which, the strongest team may be blocked from taking another top-tier player while a rival has none, or capped on how far above the average its roster may go. If someone you wanted is greyed out, that is why, and it applies to everyone.',
        },
        {
          term: 'If you miss it',
          body: 'tell the host beforehand. They can pick for you from the same board, and a shortlist you left behind is the instruction they will follow.',
        },
      ],
      note: {
        tag: 'The roster locks when the draft starts',
        body: 'Once a draft is running, the set of teams and the pick order are frozen. If a team is missing or the order is wrong, it has to be fixed before the first pick, not after.',
      },
    },

    roster: {
      title: 'Your team hub, all event',
      intro:
        'On **My Team**, the **Manage this team** card holds everything you can do for your side. It ships collapsed; open it once and it stays where you put it.',
      rows: [
        {
          term: 'Roster',
          body: 'who is on the team and what they have contributed. The first place to look when someone asks why their drop didn’t count — an unlinked account shows up here.',
        },
        {
          term: 'Requests',
          body: 'people asking to join, on events that let players pick their own team. Only appears when there are any.',
        },
        {
          term: 'Proof',
          body: 'your team’s submissions and their screenshots. You are not the final approver — staff are — but you see what has been sent and can chase what hasn’t.',
        },
        {
          term: 'Fees',
          body: 'who on your team still owes an entry fee. You can mark one paid; confirming it is a staff job, deliberately.',
        },
        {
          term: 'Invite links',
          body: 'appears when the host has allowed captains to mint their own. One link seats whoever opens it directly onto your team. See [Hosting a visiting clan]({clanVsClanGuide}) for what the link actually does.',
        },
      ],
    },

    during: {
      title: 'Running it once it starts',
      body: [
        'Most of the event runs itself: the plugin credits what it can see and files a stamped screenshot for it. What is left is people, and that is the job.',
        'The things that genuinely need a captain: making sure everyone on your side has the plugin connected and their accounts linked before the whistle, because an unlinked alt contributes to nothing; noticing which tiles nobody has touched by the halfway point; and getting the manual tiles photographed before the last hour, when everyone tries at once.',
        'If the event asks for a starting shot, that is the one thing every player must do themselves in the first hours. Chase it early — a player without one has every credit flagged, or refused outright, depending on how the host set it.',
      ],
      note: {
        tag: 'Substitutions',
        body: 'Once an event is live, swapping someone out is admin-only, on purpose: contributions are already attached to people. Ask a host rather than reshuffling around it.',
      },
    },
  },

  formats: {
    metaTitle: 'Formats and how tiles open — Anvil',
    metaDescription:
      'The seven event formats, the five ways tiles can open, and the scoring modifiers — what each one does to how an event feels to play.',
    eyebrow: 'Anvil · for clan staff',
    title: 'Formats, and how tiles open',
    dek: 'Two decisions shape an event more than every tile in it: what shape the board is, and how tiles become playable. They are independent — any format can use any reveal policy — and together they are the difference between a week-long grind and a nightly race.',
    facts: [
      { strong: '7 formats', rest: 'the shape of the board' },
      { strong: '5 policies', rest: 'how tiles open' },
      { strong: '3 modifiers', rest: 'what a completion is worth' },
    ],
    footnote:
      'Format is fixed at creation but changeable afterwards from the event’s Overview tab; reveal policy and the scoring modifiers can be changed any time before the tiles they affect are revealed.',

    shape: {
      title: 'The shape of the board',
      intro:
        'The format decides how the board is scored and what the create form asks you for next. Everything else on this page composes on top of it.',
      note: {
        tag: 'Fixed grid or task list',
        body: 'A **classic** board is a true square, so “N of 5” means exactly 25 tiles and the count can never change. Everything else is a task list of any length, which is also the only kind of board a bulk spreadsheet import can grow. If you are generating a hundred tasks, that decision is made here.',
      },
    },

    reveal: {
      title: 'How tiles open',
      intro:
        'Independent of format. The event-level reveal switch is still the master gate — while a board is hidden, nothing is visible and none of these engines run, so you always arm a board deliberately.',
      rows: [
        {
          term: 'All at once',
          body: 'the classic. Every tile is playable the moment you reveal the board, and teams pick their own order. Choose this unless you have a reason not to.',
        },
        {
          term: 'Scheduled',
          body: 'each tile carries its own reveal time, set on the Tiles tab, and goes live as that time passes. A tile-of-the-hour board: it sets the tempo for you and needs the times authored up front.',
        },
        {
          term: 'Interval',
          body: 'the engine draws hidden tiles on a fixed interval — a batch every N minutes, at random or in board order. A bingo caller. Zero authoring beyond the tiles themselves, and the board reveals itself while you sleep.',
        },
        {
          term: 'Bounty',
          body: 'exactly one tile is open at a time, and the first team to finish it claims it — the tile closes and the next one is drawn immediately. Ruthless, very watchable, and unforgiving of time zones.',
        },
        {
          term: 'Rotating',
          body: 'a rolling window of a few open tiles: each draw opens new ones and expires the oldest. Unlike bounty, everybody can complete an open tile before it goes. Built for individual ladders.',
        },
      ],
      note: {
        tag: 'The time-zone question',
        body: 'Bounty and interval boards reward whoever happens to be awake. On a clan spread across the world, that is a real advantage handed out by the clock rather than by play. Rotating windows soften it — an open tile stays open for the length of the window, so a sleeping player still gets a shot at it.',
      },
    },

    scoring: {
      title: 'What a completion is worth',
      intro:
        'Three modifiers, all points-mode only, all frozen into the completion the moment it happens — so a change you make later never rewrites history.',
      rows: [
        {
          term: 'First-team bonus',
          body: 'extra points for the first team to finish each tile. The cheapest way to make an all-visible board feel like a race without changing anything else.',
        },
        {
          term: 'Decay',
          body: 'a tile’s value scales linearly from full at reveal to a target percentage after N hours, then holds. Below 100% it decays and rewards racing; above 100% it **grows**, which rewards clearing the old tasks everyone skipped. The growing direction is the one people forget exists.',
        },
        {
          term: 'Lockout',
          body: 'the first completion closes the tile for everyone else. Implied by bounty. On a board with a big spread in team strength this can end the contest early — it is at its best when the teams are close.',
        },
      ],
    },

    missions: {
      title: 'Missions: surprises mid-event',
      body: [
        'Missions are tiles authored up front and held back — announced from their own pool while the rest of the board stays visible. They are independent of the reveal policy, so a plain all-visible bingo can still have them.',
        'Drop them by hand when the board goes quiet, on a fixed interval, or on a per-mission schedule. Each mission carries its own scoring: its own lockout, bonus, decay and expiry, set per tile rather than for the event.',
        'They are the cheapest way to wake a board up on day five, which is the day every long event needs waking up.',
      ],
    },

    choose: {
      title: 'Choosing, in one page',
      intro: 'If you know the feeling you want, this is the shortest route to it.',
      rows: [
        { term: 'A normal clan bingo', body: 'Classic grid, all tiles visible. Add a first-team bonus if you want a little urgency.' },
        { term: 'Hundreds of tasks, scored by difficulty', body: 'Leagues, all visible. This is also the only shape a big spreadsheet import can grow into.' },
        { term: 'A week that builds toward something', body: 'Leagues with scheduled or interval reveal, so the board opens over the week instead of all at once.' },
        { term: 'An evening people watch live', body: 'Bounty. One tile, first team takes it, next tile immediately.' },
        { term: 'An individual competition, not a team one', body: 'Ladder with a rotating window and decay. Tasks come and go and nobody can bank them.' },
        { term: 'A race with a finish line', body: 'Tile race — an ordered track, and whoever gets furthest wins.' },
      ],
      outro:
        'Whatever you choose, the tiles themselves are the same job: see [Building a board that tracks itself]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Fees and payouts — Anvil treasurer guide',
    metaDescription:
      'Charging an entry fee, collecting it, the second signature that settles it, and turning the prize pool into paid-out placements.',
    eyebrow: 'Anvil · for treasurers',
    title: 'Fees and payouts',
    dek: 'Money is where clan events go wrong, and it goes wrong quietly: a fee somebody swears they paid, a pool nobody can reconcile, a prize split argued about after the winners have logged off. This is the path that leaves a record at every step.',
    facts: [
      { strong: '2 signatures', rest: 'settle a fee, by default' },
      { strong: 'Pool = added', rest: '+ fee × approved entries' },
      { strong: '1 row', rest: 'per person paid' },
    ],
    footnote:
      'Fees and payouts are the treasurer’s surface. A treasurer can do everything a moderator can, plus this; a moderator can mark a fee collected but never settle one.',

    set: {
      title: 'Setting the fee',
      body: [
        'The entry fee lives on the event, set when you create it or edited from its **Sign-ups** tab. A fee of nothing is a perfectly good answer — plenty of events run on a host-added pool alone.',
        'Two settings decide what the fee actually means, and they are easy to skip past:',
      ],
      rows: [
        {
          term: 'Per person or per account',
          body: 'on an event where people may enter several accounts, this decides whether they pay once or once each. Get it wrong and you will be refunding people.',
        },
        {
          term: 'Payment deadline',
          body: 'after it passes, unpaid sign-ups stop being your problem to chase and start being a decision. Set it earlier than you think — the day before the event is too late to replace someone.',
        },
      ],
      note: {
        tag: 'The pool follows the entries',
        body: 'The displayed prize pool is whatever you added by hand, plus the entry fee times the number of **approved** entries. It moves as sign-ups are approved and excluded, so the number on the page is always the one you could actually pay out.',
      },
    },

    collect: {
      title: 'Collecting',
      body: [
        'Fees are collected the way your clan already collects money — in game, in Discord, however you do it. Anvil’s job starts the moment it arrives: somebody with staff access marks it **paid**, and that stamps who says they took it and when.',
        'Players have a say too. A member can report who they paid and attach a screenshot, which is what turns “I definitely paid” into a record with two ends. When the player’s report and the collector’s claim name different people, that is a dispute the site can show you rather than one you find out about in an argument.',
      ],
      note: {
        tag: 'The proof is deleted on purpose',
        body: 'A payment screenshot is kept only until the fee is settled, then removed. It exists to resolve a disagreement, not to sit in storage for a year.',
      },
    },

    sign: {
      title: 'The second signature',
      body: [
        'A fee sits at **collected** until a _different_ staff member confirms it arrived. Whoever handled the money cannot also be the person who signs off that it turned up — that is the whole control, and it is why the site refuses a collector’s own confirmation rather than merely discouraging it.',
        'How many signatures a fee needs is a clan setting, from zero to five. Zero exists for a real reason: in a clan where the treasurer _is_ the owner, there is nobody else to sign, and “34 fees waiting on a second signature” becomes a queue that can never be cleared and permanently the loudest thing on the dashboard. At zero, marking a fee paid **is** the sign-off.',
        'Set it to one — the default — if you have two people. Set it to zero if you honestly do not, and set it higher only if your clan has both the staff and the reason.',
      ],
    },

    pay: {
      title: 'Paying out',
      body: [
        'When the event ends, the event’s **Payouts** tab turns the pool into a list of people. Generate it and you get one row per recipient, not per team: a winning team’s prize divides equally across its members so that paying out is a list of names and numbers rather than an arithmetic problem at midnight.',
        'Amounts start from a suggested split — winner-heavy, and the more paid places you set the flatter it gets — and every row is editable. The suggestion is a starting point, not a policy.',
        'Then pay them, ticking rows off as you go. The point is that a week later anybody can look at the list and see who was paid what, rather than reconstructing it from Discord scrollback.',
      ],
      note: {
        tag: 'Announce it once, from here',
        body: 'Payouts post to your Discord channels from the event itself, so the announcement and the record are the same thing. A prize announced by hand is a prize somebody will later claim never arrived.',
      },
    },

    disputes: {
      title: 'When the numbers disagree',
      intro: 'The four you will actually meet:',
      rows: [
        {
          term: 'They say they paid, nobody marked it',
          body: 'ask them to report the payment with a screenshot. That puts a named collector and a timestamp on the record, and the named person can confirm or deny it.',
        },
        {
          term: 'Two staff both think they took it',
          body: 'the player’s own report is the tiebreak — it names who they handed it to. Fix the collector, then settle it.',
        },
        {
          term: 'A fee is stuck waiting on a signature',
          body: 'either it is genuinely waiting on someone else, or your clan has fewer staff than the required-confirmations setting assumes. Lower the setting rather than confirming your own collection.',
        },
        {
          term: 'The pool changed after you told people',
          body: 'it tracks approved entries, so approving or excluding a sign-up moves it. Quote the pool at the moment sign-ups close, not the moment they open.',
        },
      ],
    },
  },

  moderator: {
    metaTitle: 'On the rota — Anvil moderator guide',
    metaDescription:
      'A moderator’s day on an Anvil clan site: the queue, verifying submissions and accounts, keeping the roster honest, and the judgement calls.',
    eyebrow: 'Anvil · for moderators',
    title: 'On the rota',
    dek: 'A moderator does the work that arrives whether or not an event is running: proof to look at, accounts to verify, a roster that drifts. This is what the queue is made of, and how to clear it without becoming the reason people wait.',
    facts: [
      { strong: 'No events', rest: 'a moderator can’t create or edit them' },
      { strong: 'One page', rest: 'says what needs you' },
      { strong: 'Approve fast', rest: 'a slow queue reads as a broken site' },
    ],
    footnote:
      'A moderator sees everything a member does plus the review surfaces. Creating and editing events, settings, staff and payouts are admin and treasurer jobs — if a button isn’t there, that’s why, and it’s deliberate.',

    what: {
      title: 'What the role is',
      intro:
        'Roles stack downward: everything a moderator can do, a treasurer and an admin can do too. What a moderator specifically owns:',
      canList: [
        'the roster: syncing it, adding people, promoting a guest',
        'account verifications — the XP challenge and manual review',
        'submissions and proof screenshots',
        'weekly competitions and the schedule',
        'feedback from members',
      ],
      cantIntro: 'What they cannot do, on purpose:',
      cantList: [
        'create or edit an event, or its tiles',
        'change clan settings or Discord wiring',
        'promote anyone, or touch staff',
        'settle a fee or run a payout',
      ],
    },

    queue: {
      title: 'Start at what needs you',
      body: [
        'The admin dashboard is not a summary of the site — it is a list of what is waiting, ordered by how much it matters, computed from real data rather than from counters that drift. If it says nothing needs you, nothing does.',
        'Work it top down. The items that reach the top are the ones with a person on the other end of them: someone who can’t sign up because their account isn’t verified, or whose drop hasn’t counted because nobody looked at it yet.',
      ],
    },

    submissions: {
      title: 'Submissions and proof',
      body: [
        'Most credits never reach you: the plugin sees the drop, files a screenshot stamped with the team and a UTC timestamp, and the tile completes. What lands in the queue is the manual tiles and anything the plugin flagged.',
        'The stamp is what makes a proof hard to argue with. A plugin screenshot carries the team and the moment baked into the picture, and with two-frame proof enabled a second frame a couple of seconds later shows the loot settled on the floor. A screenshot without any of that is a screenshot from a phone, which is fine — it just means you are the one doing the checking.',
      ],
      rows: [
        {
          term: 'Approve when it is plausible',
          body: 'you are not auditing a bank. If the picture shows the thing, the account is on the roster and the timestamp is inside the event, approve it and move on.',
        },
        {
          term: 'Reject with a reason',
          body: 'a rejection with no explanation comes back as a DM to you within the hour. Say what was missing so the second attempt is right.',
        },
        {
          term: 'A flagged submission is a question, not an accusation',
          body: 'the plugin flags what it could not fully confirm — most often a player who has not filed a starting shot. Read it as “look at this one”, not as “someone cheated”.',
        },
      ],
    },

    verify: {
      title: 'Verifying accounts',
      intro:
        'Nobody can sign up for an event without at least one verified account, so this queue directly blocks people from playing. It is the one worth clearing daily.',
      rows: [
        {
          term: 'Verified by plugin',
          body: 'the common case, and it needs nothing from you. Playing the account with the plugin connected links it automatically, and a stable account fingerprint means the link survives a name change.',
        },
        {
          term: 'Verify by XP',
          body: 'for players without the plugin. The site picks a random skill and they gain 1,000 XP in it within thirty minutes. It checks itself — you only see the ones that fail.',
        },
        {
          term: 'Manual review',
          body: 'hidden Hiscores, or an alt too fresh to appear on them. Someone submits an RSN with a note and you decide. Ask for a screenshot of the login screen if the note isn’t enough.',
        },
      ],
      note: {
        tag: 'Verified is not a member',
        body: 'Verifying an account says “this is really theirs”. It does not put them in the clan — clan membership comes only from an in-game roster sync or an admin adding them by hand. Someone verified but not on the roster is a **guest**: tracked, visible, and not a member. That is deliberate, and it is what stops anyone joining your clan by typing a name.',
      },
    },

    roster: {
      title: 'Keeping the roster true',
      body: [
        'The roster comes from one place: an admin runs a sync from the in-game clan list, with the **Anvil** button in the clan window’s title bar (or **Sync roster** in the plugin’s side panel). Everything else — verifications, links, sign-ups — hangs off it.',
        'So the maintenance job is small but real: run the sync after any recruitment round, promote the guests who have actually joined, and look at people the site has flagged as needing review rather than waiting for them to complain.',
      ],
      note: {
        tag: 'Last seen is not last played',
        body: 'A member’s last-seen-in-clan timestamp records the last roster sync that found them, not the last time they logged in. For “are they still playing”, read their live stats time instead — it is the one that moves on its own.',
      },
    },

    startshot: {
      title: 'Reviewing starting shots',
      body: [
        'On an event that requires one, every player has to file a screenshot taken after the event went live, at a location drawn at the start moment. Plugin captures with a verified keyword arrive already accepted, so in practice you are only looking at the players who uploaded by hand from a phone.',
        'What you are checking is small: the character is in the picture, the keyword is in the chatbox, and it is the keyword that player was actually given. The uploads count immediately and you review them after the fact, so nobody is blocked from playing while they wait for you.',
      ],
    },

    judgement: {
      title: 'The calls you will have to make',
      intro:
        'None of these have a right answer in software, which is why they reach a person.',
      rows: [
        {
          term: 'The proof is real but late',
          body: 'the drop happened inside the event and the screenshot came after it ended. Usually approve — check the stamp in the picture, not the upload time.',
        },
        {
          term: 'The account isn’t linked yet',
          body: 'the drop is genuine, the account is theirs, it just wasn’t added before they played. Get it linked, then approve. Do not make somebody re-do a raid over paperwork.',
        },
        {
          term: 'It looks staged',
          body: 'take it to an admin rather than rejecting it yourself. A rejection is a public accusation inside a small clan, and it should never be one person’s call made at speed.',
        },
        {
          term: 'You are in the event',
          body: 'you almost certainly are. Hand anything involving your own team to another moderator — not because you would be unfair, but because you shouldn’t have to prove you weren’t.',
        },
      ],
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
