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
//
// For translators: Anvil's own on-screen labels stay English in every locale. Discord's UI labels
// (menus, settings, permission names: "Copy Server ID", "Server Settings → Roles", "Manage Webhooks")
// follow Discord's own translation for that language — what the reader's Discord client shows — and
// stay English where Discord isn't localized (Arabic, for one).

export const en = {
  common: {
    contents: 'Contents',
    step: 'Step',
    optional: 'optional',
    minRead: '{n} min read',
    copyLink: 'Copy a link to this section',
    linkCopied: 'Link copied',
    language: 'Language',
    legalPaid: 'Money questions: [Refunds](/legal/refunds) and [Terms](/legal/terms).',
    legalPrivacy: 'How your data is handled: [Privacy policy](/legal/privacy).',
    aboutLine: 'Who is behind Anvil? Read [About](/about).',
    partialNotice:
      'This guide is only partly translated into {language}. Anything not yet translated is shown in English.',
    backToGuides: 'All guides',
    unreviewedNotice:
      'This {language} translation hasn’t been checked by a native speaker yet. If a sentence reads wrong, the [English page]({englishHref}) is the original — and [telling us](/feedback) is what gets it fixed.',
    support: {
      lead: 'Stuck, or something looks wrong?',
      link: 'Ask in the Anvil support Discord',
    },
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
      streamers: 'Streamers',
    },
    // The index has two tabs: "Using Anvil" (the setup guides above) and the in-game guides module's
    // library (/guides). `ingame.title` doubles as the second tab's label. The library guides are
    // content, not dictionary — they are never translated, and `ingame.language` says so.
    anvilTab: 'Using Anvil',
    ingame: {
      title: 'In-game guides',
      dek: 'Raids, bosses, skilling and money makers from the Anvil library — the same guides the plugin shows in-game and the bot posts to Discord.',
      browse: 'Browse all guides',
      language: 'These guides aren\'t translated: they read as written, whatever language this page is in.',
      empty: 'The Anvil library has no published guides yet. Check back soon.',
      placeholder: 'Search in-game guides — try "zulrah", "raids" or "money"',
      readTime: '{n} min read',
      metaTitle: 'In-game OSRS guides — Anvil',
      metaDescription: 'Raids, bossing, skilling and money-making guides from the Anvil library, readable on the site, in-game through the RuneLite plugin, and in Discord.',
    },
    search: {
      placeholder: 'Search the guides — try "webhook", "tiles", or "drops not showing"',
      results: '{n} guides',
      empty: 'Nothing matched. Try a plainer word — "tiles", "payout", "bot" — or browse the list below.',
      clear: 'Clear search',
    },
    cards: {
      switching: {
        eyebrow: 'Moving to Anvil',
        title: 'Switching from other plugins and trackers',
        blurb:
          'Anvil posts your drops to Discord and runs your weekly competitions. Five steps for staff, two for players.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'For anyone starting one',
        title: 'Start a clan',
        blurb:
          'Two names and an address, and it is live. Then Discord, your roster, and the first board.',
        minutes: '~4 min, free',
      },
      discord: {
        eyebrow: 'For whoever runs the server',
        title: 'Anvil in Discord',
        blurb:
          'One invite, then the channels each feed posts to, roles, slash commands, and what to check when it stops.',
        minutes: '~5 min',
      },
      plugin: {
        eyebrow: 'For players',
        title: 'RuneLite plugin setup',
        blurb:
          'Install the plugin, sign in from its side panel, and let it submit your drops. Covers Discord notifications and player lookup.',
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
      coffer: {
        eyebrow: 'For treasurers',
        title: 'The clan coffer',
        blurb:
          'One pot for the clan’s gp: what goes in, the three ways it pays prizes out, and who is allowed to move it.',
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
      tiles: {
        eyebrow: 'For players',
        title: 'Tile rules and limitations',
        blurb:
          'What a tile needs from you before you start (a game setting, the plugin, a synced log, a hiscores rank) and what it can’t track.',
        minutes: '~4 min',
      },
      commands: {
        eyebrow: 'For every member',
        title: 'Slash commands',
        blurb:
          'Every command the bot answers in Discord, what each option does, worked examples, and what to check when one doesn’t show up.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'For streamers',
        title: 'Hosting events for your viewers',
        blurb:
          'No clan needed. Make a space, share one link, pick who can join (followers, subs, Discord roles) and put the board on stream.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'For viewers',
        title: 'Joining a streamer’s event',
        blurb:
          'Got a link from a stream? Sign in, add your character, press Join. What to do for follower- or sub-only events.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'For clans that stream',
        title: 'Streaming for clans',
        blurb:
          'Let your viewers play one event without joining the clan. Turn on Streaming, then open an event to viewers.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'For clan staff',
        title: 'Your people: roster, guests and who can join',
        blurb:
          'Where members come from, what the Roster tab’s filters mean, join requests and Needs review, the three Who can join settings, and removing or banning someone.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'For owners and admins',
        title: 'Staff roles: who can do what',
        blurb:
          'Owner, admin, treasurer and moderator: what each one reaches, how to make someone a moderator, who can grant which role, and jobs that cover one event.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'For players',
        title: 'Anvil Supporter: tiers and perks',
        blurb:
          'Supporter, Champion and Patron: name colours, the star, profile pictures, the display case, friend events and clan boosts, how billing works and what happens if you stop.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'For players',
        title: 'The side panel, tab by tab',
        blurb:
          'Clan, Feed, You, Lookup and the gear: what each tab shows, event chat, GZ and Sad reactions, and the settings that put the feed and Supporter colours into your game.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'For Supporters and clan staff',
        title: 'Boosting a clan',
        blurb:
          'Placing and moving a boost, the three levels and what each one unlocks, the clan’s name colours, gifted boosts, and booster marks and badges.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'For players',
        title: 'Your profile, Wrapped and Compare',
        blurb: 'Your profile, each character’s public page and your person page, who can see them, monthly and event Wrapped cards, and comparing two characters.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'For players',
        title: 'Settings, page by page',
        blurb: 'Discord posts and screenshot privacy, the in-game chat feed, devices, your own webhooks, who sees your characters, each character, and ownership claims.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'For players',
        title: 'Challenges and friends events',
        blurb: 'Challenge one player to a drop, kills or XP race, and host a private board for your friends behind one invite link.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'For players and clans',
        title: 'Finding clans, events and leaderboards',
        blurb: 'The Clan Hall, comparing two clans, the weekly leaderboard, the public events list, and pages for in-game clans not on Anvil.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'For players and clan staff',
        title: 'In-game guides',
        blurb: 'Reading the guide library by level, proposing a new guide or an edit, and keeping your clan’s own copies.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'For clan staff and players',
        title: 'Skill and Boss of the Week',
        blurb: 'Scheduling a weekly competition, repeating and rotating it, starting lines, prizes, ending early, and what players see.',
        minutes: '~4 min',
      },
      teamComps: {
        eyebrow: 'For clan staff and players',
        title: 'Team competitions',
        blurb: 'Skill and boss competitions as teams or clan vs clan: setting them up, inviting clans, how totals and averages work, and what players see.',
        minutes: '~4 min',
      },
      luckRecords: {
        eyebrow: 'For players',
        title: 'Drop odds, luck and records',
        blurb: 'What the odds on a drop tile mean, how luck is worked out, and where your best day, week, month and year show up.',
        minutes: '~3 min',
      },
      clanEvents: {
        eyebrow: 'For clan staff',
        title: 'Clan events and the schedule',
        blurb: 'Masses, raid nights and meetups: weekly repeats, “I’m going” and sign-ups, Discord reminders, payouts, surveys, and finding gaps in the schedule.',
        minutes: '~4 min',
      },
    },

  },

  switching: {
    metaTitle: 'Switching from other plugins and trackers — Anvil',
    metaDescription:
      'Move your clan to Anvil: set up the Discord channels, sync the clan list, start Skill or Boss of the Week, and tell your members.',
    eyebrow: 'Moving to Anvil',
    title: 'Switching from other plugins and trackers',
    dek: 'Anvil posts your clan’s drops and achievements to Discord. It also keeps your clan list and runs weekly competitions.',

    staff: {
      title: 'If you run the clan',
      body: [
        '**Let the bot set up your channels.** Go to Admin → Discord → **Set it up for me**. Pick one channel or a few. If another plugin was posting somewhere, tick _Use the same channels_. Nothing moves for your members.',
        '**Sync your clan list.** In RuneLite, open the Anvil plugin’s settings. Turn on **Keep the clan roster in sync**. One admin does this once, in game. This replaces any clan list you kept elsewhere.',
        '**Start a Skill or Boss of the Week.** Go to Admin → All events → **+ New event**, and pick Skill of the Week or Boss of the Week. Everyone on the clan list is in it automatically. This replaces competitions you ran elsewhere.',
        '**Tell your members.** Go to Admin → Discord → **Tell your members** → **Post it**. The bot posts the player steps for you.',
        '**A week later, clean up.** Go to Admin → Discord → **Remove old webhooks from other plugins**, tick the ones to go, press **Remove … webhooks** and then **Yes, remove them**. After that, nothing can post twice. Press **Keep** on any you want to leave alone.',
      ],
    },

    player: {
      title: 'If you’re a player',
      body: [
        '**Install Anvil.** In RuneLite, open the Plugin Hub, search for Anvil and press **Install**. Then sign in with Discord from the Anvil side panel.',
        '**Turn off your old plugin’s notifications** so nothing posts twice. Or uninstall it, if you don’t use it for anything else.',
        '**That’s it.** There is nothing else to set up.',
      ],
    },

    questions: {
      title: 'Questions',
      intro: 'The ones clans ask most:',
      rows: [
        {
          term: 'Does Anvil track kill counts, slayer tasks and personal bests?',
          body: 'Yes. Anvil tracks kill counts, slayer tasks and personal bests itself, so there is nothing else to keep running.',
        },
        {
          term: 'Do players paste a webhook anywhere?',
          body: 'No. The clan sets the channels on the site.',
        },
        {
          term: 'Want posts in your own server too?',
          body: 'Go to your profile → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
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
      'You can change every one of these later from Admin → **Clan settings**, except the address — that one is worth a moment’s thought now.',

    before: {
      title: 'Before you start',
      body: [
        'You need a Discord account, and that is the whole list. Sign in on `{apex}` first: a clan needs an owner, and signing in is how the site knows that is you. Start from **Start a clan** on the platform pages, or go straight to `{apex}/clans/new`.',
        'It costs nothing. There is no plan to pick, no card to enter, and no trial that expires and takes your board with it — a clan starts free and stays usable.',
        'Big clans can move up a plan later from **Plan and billing** in Admin. Everything you pay for on Anvil — a clan, a creator space or your own Supporter membership — is on [your billing page](/portal).',
      ],
      note: {
        tag: 'You will be its owner',
        body: 'Owner is the one role nobody can take from you, and it goes to whoever creates the clan. Add staff afterwards from Admin → **People** → **Staff & roles**; see [On the rota]({moderatorGuide}).',
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
        'Three steps stand between a fresh clan and a running event, and the wizard walks them in order, skipping whatever you have already done. The board comes straight after.',
      steps: [
        {
          term: 'Your clan',
          body: 'Your display name, your in-game clan name, and an invite link to your server. The invite is what lets sign-up pages and guides point people at you.',
        },
        {
          term: 'Connect Discord',
          body: 'One shared bot, so there is no application to register and no token to paste. Press **Connect your bot** and approve it once, then pick **A few channels** or **Just one channel** and press **Set it up for me** — the bot makes the channels for you.',
        },
        {
          term: 'Bring your members in',
          body: 'Install the plugin, sign in with Discord, then open your clan window in game and press the **Anvil** button in its title bar. Nobody can sign up for an event until your member list is in.',
        },
        {
          term: 'Make a board',
          body: 'The wizard ends on **Create your first event →**. Pick a format, add tiles, open sign-ups — that is [Running your first event]({adminGuide}), and it is the longest step by a distance.',
        },
      ],
      after: [
        'You can skip the wizard entirely with **Skip setup** and do all of it later from Admin → **Clan settings** and Admin → **Discord**. It exists because the order matters when you have never done it: Discord before channels, members before a board they need to sign up for.',
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
          body: 'Open the clan window in game with the plugin running and press the **Anvil** button in its title bar. Your whole member list arrives with ranks intact, and it refuses a roster from a clan whose name does not match yours. Repeat it whenever people join or leave — see the [player setup guide]({pluginGuide}).',
        },
        {
          term: 'They ask to join',
          body: 'Signing in or playing with the plugin never gives anyone a seat by itself. If the plugin sees someone playing in your in-game clan before your roster has them, it files a join request for them, and anyone else can ask with **Apply** on your clan page. Staff answer both at the top of the **Roster** tab, and **Who can join** decides whether they wait for a yes, get in straight away, or cannot ask at all. Someone who plays a character already on your roster is confirmed under **Needs review** instead. The details are in [Your people]({peopleGuide}).',
        },
        {
          term: 'By hand',
          body: 'Admin → **People** → **+ Add Manually** takes names one at a time, for the person on mobile or the official client who cannot run the plugin at all.',
        },
      ],
      note: {
        tag: 'Guests are not a problem to solve',
        body: 'A guest plays in your events without being in your in-game clan: a visiting clan’s player, a friend, an alt. They get a seat when staff approve their request, or straight away if **Who can join** is set to **Let anyone in**. They are tracked and can enter events, and they do not count towards your plan. Someone who joins you in game becomes a member on the next roster sync.',
      },
    },

    first: {
      title: 'Your first event',
      body: [
        'The shortest path to something happening: make a board, add a handful of tiles the plugin can see by itself, open sign-ups, and start it. Drops, kill counts and XP then file themselves.',
        'Two guides carry the weight here. [Running your first event]({adminGuide}) runs start to finish — Discord, teams, launching, and what to do when it ends. [Building a board that tracks itself]({boardGuide}) is about tiles specifically: what each kind can actually detect, and the ones that import cleanly and then never fire.',
        'If you would rather not build a board at all in your first week, run a **Skill of the Week** or **Boss of the Week** instead. Everyone on the roster is enrolled automatically, the standings move off the hiscores, and there is nothing to author.',
      ],
    },

    together: {
      title: 'Events across several clans',
      body: [
        'An event does not have to belong to one clan. Several clans can run the same board together — two, or a dozen — with each side keeping its own roster, its own staff and its own half of the moderation.',
        'They can also share one pool of players rather than sitting on opposite sides of a scoreboard: one event, everybody in it, however the teams end up cut. Clan-versus-clan is one shape this takes, not the only one.',
        'Each visiting clan gets an invite link per team, so you never collect a single RSN by hand, and a seat that lets their own moderator approve their own members’ proof. [Hosting a visiting clan]({clanVsClanGuide}) covers hosting one.',
      ],
      note: {
        tag: 'Nothing to buy',
        body: 'Joining somebody else’s event is free, and so is hosting one. A clan that only ever turns up to other people’s boards never needs anything beyond its own free clan.',
      },
    },

    boosts: {
      title: 'Clan boosts',
      body: [
        'Members who pay for Anvil Supporter at **Champion** (one boost) or **Patron** (two) can boost the clan from their own **Settings → Clan boosts**. A boost counts once their seat in the clan is 14 days old, and no more than two count from one person.',
        'You see where you stand on Admin → **Clan settings** → **Boosts**: the clan’s level, how many boosts are counting and how many more the next level needs. Level 1 takes 3 boosts, Level 2 takes 8 and Level 3 takes 15. If boosts fall below a level, its perks stay for a week first.',
        'Level 1 puts a **Boosted** badge on your clan page, Clan Hall card and in search, lists you above unboosted clans in the Clan Hall and gives your name a gradient. Level 2 adds a spot in the Clan Hall’s Featured row, plays your animated banner and unlocks a **Recruiting line**: one sentence, up to 140 characters, shown to visitors. Level 3 adds a Spotlight at the top of the Clan Hall and one **Recruitment post in the Anvil Discord** a month, up to 500 characters, sent once with **Post to the Anvil Discord**, with a link to your clan page and nobody pinged.',
      ],
      note: {
        tag: 'Looks only',
        body: 'Boosts change how the clan looks and where it is listed. They never change a rank, a score, your seats or your plan.',
      },
    },

    features: {
      title: 'Features and plan',
      intro:
        'Admins can switch whole parts of Anvil on or off under **Features**. Off hides them from the menus; nothing is deleted.',
      rows: [
        { term: 'Events', body: '**Skill & Boss of the Week** (on), **Surprise-task formats** (off), **Missions** (off), **Post-event survey** (off).' },
        { term: 'Money', body: '**Sign-up fees** (on), **Clan coffer** (off).' },
        { term: 'Discord & plugin', body: '**Post to Discord** (on), **Death & fun messages** (off), **Clan Hall card**, showing who is online in your Discord on your public clan page (on).' },
      ],
      outro:
        '**Plan and billing** shows your plan, how many members you have against its size, and the bigger plans. If you pay, **Manage subscription and invoices** is there too.',
    },
  },

  discord: {
    metaTitle: 'Anvil in Discord — Anvil',
    metaDescription:
      'Connect the Anvil bot to your Discord server: one invite, the channels each feed posts to, role and nickname sync, slash commands, and what to check when it goes quiet.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil in Discord',
    dek: 'One bot, one invite, and no application to register. This is what it posts, where it posts it, what it can change in your server — and what to look at on the day it stops.',
    facts: [
      { strong: 'One bot', rest: 'shared, nothing to create' },
      { strong: '~5 min', rest: 'invite to first post' },
      { strong: 'Opt-in', rest: 'every feed is off until you point it somewhere' },
    ],
    footnote:
      'Everything here lives on Admin → **Discord**: the quick setup at the top, then **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands and Post without a bot.',

    bot: {
      title: 'One bot, already built',
      body: [
        'There is no Discord application to create, no token to generate and no secret to paste. Anvil runs one bot and every clan shares it, so connecting is an invite and nothing else.',
        'You can still bring your own — paste a token under **Use your own bot instead (advanced)** and it is used instead. Worth it only if you want the bot to wear your clan’s name and avatar in the member list; everything in this guide works the same either way.',
      ],
      permissions: [
        {
          term: 'View Channels, Send Messages, Embed Links, Attach Files',
          body: 'The basics. Without these it is in your server and silent.',
        },
        {
          term: 'Manage Webhooks',
          body: 'So **Set it up for me** and **Post here** can make webhooks for you instead of you copying URLs out of Discord by hand, and so Anvil can find old webhooks for you to remove.',
        },
        {
          term: 'Manage Roles',
          body: 'Only if you turn role sync on. It can then hand out the roles you map — and it can never touch a role above its own, which is Discord’s rule, not ours.',
        },
        {
          term: 'Manage Nicknames',
          body: 'Only if you turn nickname sync on, so a member’s server nickname can be set to their RSN.',
        },
        {
          term: 'Manage Channels',
          body: 'For per-team private channels during a draft, and for guides posted as a new category or forum. Skip it and everything else still works.',
        },
        {
          term: 'Manage Threads, Send Messages in Threads',
          body: 'For guides posted to a forum: writing inside the post, and removing the post again — Discord won’t let a bot delete even its own forum post without it.',
        },
        {
          term: 'Change Nickname',
          body: 'Only if you give the bot your clan’s name under **Connection → Bot appearance in your server**. It changes the bot’s name in your server only.',
        },
      ],
      note: {
        tag: 'It asks for them all at once',
        body: 'Discord has no way to ask for a permission later, so the invite link requests the full set and the features you never enable simply never use theirs. Re-running the invite link is also how you repair a permission somebody removed.',
      },
    },

    connect: {
      title: 'Connecting it',
      intro:
        'Two things, in this order. The bot has to be in your server, and Anvil has to know which server is yours.',
      steps: [
        {
          term: 'Invite the bot',
          body: 'Admin → **Discord** → **Connect your Discord server** (or **Add Anvil to Discord**). Discord asks which server to add Anvil to and sends you back here, so you cannot add it to the wrong one by accident. Later, **Invite / re-invite the bot** is under **More settings → Connection**.',
        },
        {
          term: 'Set the server ID',
          body: 'Only if the button can’t do it: open **Can’t use the button? Enter the server ID**, right-click your server icon in Discord → **Copy Server ID** (needs Developer Mode on, under Discord’s own Advanced settings), paste it into **Your Discord server’s ID** and press **Save**. This is the field that makes the connection specific to you.',
        },
      ],
      after: [
        'The panel then tells you the truth rather than your intent: whether the bot is actually a member of that server, and which permissions it is missing. A green line there is worth more than a saved form.',
      ],
      note: {
        tag: 'The server ID is the whole binding',
        body: 'A guild belongs to exactly one clan on Anvil, and slash commands from a server nobody has claimed are refused rather than guessed at. Until you set it, the bot is invited and idle.',
      },
    },

    channels: {
      title: 'Set up webhooks',
      body: [
        'Anvil posts through **webhooks**, one per channel, and every one of them is optional. Nothing posts anywhere until you point a feed at a channel — a fresh clan is silent by design rather than by accident.',
        'With the Anvil bot in your server, **Set it up for me** at the top of **Admin → Discord** makes the channels and points every feed at them. To do it by hand, open **More settings → What goes where** and start with the **Catch-all channel** on **Clan & events**, then the **In-game catch-all** on **In-game (plugin)**: pick a channel from the dropdown and it saves. Without the bot, open that Discord channel’s **Edit Channel → Integrations → Webhooks**, create one, copy its URL, choose **Paste a webhook…** in the dropdown, paste it and press **Save**. A webhook URL can post to its channel, so treat it like a password; if it leaks, delete it in Discord and create a new one. **Test**, and **Add another** to rotate busy posts between two webhooks, are under **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Catch-all channel',
          body: 'The main one, on the **Clan & events** tab. Event starts and endings, sign-ups opening, standings, weekly results — anything the site posts without a channel of its own. Set this and nothing else and you have a working clan.',
        },
        {
          term: 'In-game catch-all',
          body: 'On the **In-game (plugin)** tab: where anything from the game goes when it has no channel of its own. Set this second.',
        },
        {
          term: 'Milestones & more',
          body: 'On the **In-game (plugin)** tab. Slayer, clues, speedruns, kill counts, BA gambles and custom chat messages post here, once players switch them on. Its **Filters** button sets what your clan gives members by default. Players’ own templates and private kinds are in [Settings, page by page]({settingsGuide}).',
        },
        {
          term: 'The split feeds',
          body: 'Event posts, boards you co-host, Skill & boss of the week and clan calendar events can split from the catch-all; rare drops, pets, collection log, levels, combat achievements, quests, diaries, deaths and PvP kills can split from the in-game catch-all. Roster changes, sign-up approvals and the coffer ledger sit on **Staff only**. Blank split feeds fall back to their catch-all. The coffer is the exception: blank means no money posts at all. Leagues and other modes have their own **Game modes** tab.',
        },
      ],
      note: {
        tag: 'Split deaths off first',
        body: 'Deaths are the highest-volume feed on most boards and the one that buries everything else. If you only split one thing, split that.',
      },
    },

    roles: {
      title: 'Roles and nicknames',
      body: [
        'Both syncs are off until you enable them under **Admin → Discord → Roles & nicknames**, and both are driven by the roster. Turn on **Enable Discord role sync**, leave **Auto-match in-game rank → Discord role by name** on, select any general **Member roles** and **Guest roles**, save, then press **Sync roles & nicknames now**. Every person also needs a linked Discord identity; the sync report names anyone it could not resolve.',
      ],
      ways: [
        {
          term: 'Role sync',
          body: 'For automatic rank matching, the Discord role name must match the in-game clan rank: `Owner`, `Deputy Owner`, `Coordinator`, `Overseer`, `General`, `Captain`, `Lieutenant`, `Sergeant`, `Corporal` or `Recruit`. Custom ranks work too when their Discord role uses that same name. Matching ignores letter case and treats underscores like spaces, but extra words do not match: `General` works; `OSRS General` does not. Member and guest roles are picked separately, so their names can be anything.',
        },
        {
          term: 'Nickname sync',
          body: 'Sets a member’s server nickname to their RSN. It fills in a blank nickname by default and can be told to overwrite one someone chose themselves — which is the setting to think about before enabling, not after.',
        },
      ],
      note: {
        tag: 'The bot’s role has to sit above the ones it manages',
        body: 'Discord refuses to let any bot touch a role at or above its own. Drag the Anvil role above every rank, member and guest role under **Server Settings → Roles**, then save the Anvil settings and run **Sync roles & nicknames now**. Nothing needs re-inviting.',
      },
    },

    commands: {
      title: 'Slash commands',
      body: [
        'The bot answers `/bingo` in your server (the board, the standings, the rules, your own card) plus clan commands like `/sotw`, `/stats` and `/coffer`. They read the live site, so nobody has to leave Discord to check where they stand. [Every command and its options]({commandsGuide}) has its own page.',
        'They appear a minute or so after the bot joins. If they never appear at all, the invite granted the bot but not its commands — the two are separate permissions and an older invite link only asked for one. Re-run **Invite / re-invite the bot** under **Connection** on the Discord page; it does not kick the bot or reset anything.',
      ],
      note: {
        tag: 'It replies in each person’s own language',
        body: 'By default the bot answers in whatever language that member has their Discord set to, falling back to English. Pick a single language under **Bot language** to override that for everyone — which is also the only way to get Arabic, since Discord has no Arabic client language to detect.',
      },
    },

    posts: {
      title: 'What it posts, and when',
      body: [
        'Two sources, and it is worth knowing which is which when something looks wrong.',
        'The **site** posts events: a board opening, sign-ups, a start, standings, the result. Those fire from Anvil itself and keep working whether or not anybody has the plugin.',
        'The **plugin** posts what happens in game: drops, pets, deaths, levels, collection log slots, combat achievements. Those only exist for members running it, so a quiet drops channel usually means a quiet plugin rather than a broken webhook.',
      ],
      note: {
        tag: 'Nothing posts twice',
        body: 'A drop that completes a tile is one post, not one from the plugin and another from the board.',
      },
    },

    modes: {
      title: 'Leagues, Deadman and other modes',
      body: [
        'Leagues, Deadman, hardcore and other modes run on their own worlds with their own characters. Their posts are always labelled and never count toward boards or competitions. They have their own tab: **Admin → Discord → What goes where → Game modes**. A mode appears there the first time a member plays it.',
        'Each mode has a switch and a **To** channel. Turn on **Send game-mode posts to their own channels** to use those channels; leave it off and every mode posts to the normal channels, still labelled. The **Posts** button on a mode’s row lists every kind it sends — the usual ones and the mode’s own events — each with its own switch.',
        'Under that list, **Custom thresholds** make a mode post less than the main game. **Post drops rarer than 1 in…** (at least 2) and **Post drops worth at least (gp)** (at least 1,000) set their own floors (blank = same as the main game), then press **Save drop thresholds**: always-post items still post, but drops that only count for their value don’t. **Use its own level milestones** posts a level-up only if it matches both sets of rules.',
      ],
      note: {
        tag: 'Stricter, never looser',
        body: 'A mode’s filters can only take posts away. The plugin has already applied your main-game settings, so nothing a mode filter does can bring a post back.',
      },
    },

    cleanup: {
      title: 'Old webhooks from other plugins or bots',
      body: [
        'With the bot in your server, the Discord page lists every webhook in it that isn’t Anvil’s. **Coming from other plugins?** offers **Use the same channels**, so **Set it up for me** posts where your old feeds did and nothing moves for your members.',
        'Once your members are on Anvil, go to **Remove old webhooks from other plugins**, tick the ones to go and press **Remove … webhooks**, then **Yes, remove them**. That deletes them in Discord for good — it cannot be undone.',
        'The list holds any webhook that isn’t Anvil’s, not just another plugin’s. One you want to keep, like another bot’s feed? Press **Keep** and it leaves the list; **Show kept** and **Put back** bring it back. Keeping only hides it here — nothing changes in Discord.',
      ],
      note: {
        tag: 'Needs Manage Webhooks',
        body: 'The bot reads your server’s webhooks to find them. Without _Manage Webhooks_ on its role, the page says it can’t see them.',
      },
    },

    drops: {
      title: 'Drop thresholds',
      body: [
        'Anvil starts at **1m gp** or **1 in 1,000**. A drop posts when it meets either one. Nobody can set their own numbers below those, and 0 switches one off.',
        'Set your clan’s defaults under **Admin → Discord → What goes where → Drops**: **Default minimum drop value (gp)**, **Default: post drops rarer than 1 in…** and **Require both**. Turn on **Require both** and a drop must meet the value **and** the rarity.',
        'Each character follows the default of the clan it is a member of, and Anvil’s default if it has none. Players can pick their own numbers in **Settings**. It shows **Using clan default** or **Custom**, and **Reset** goes back.',
        '**Hard floor: never post drops more common than 1 in…** is the strict one. Members can’t go looser than it in your clan’s channels. Their own webhooks can.',
      ],
      note: {
        tag: 'More on the player side',
        body: 'Players’ own numbers, templates and webhooks are in [Settings, page by page]({settingsGuide}).',
      },
    },

    pools: {
      title: 'More webhooks for busy channels',
      body: [
        'One webhook can only send so fast. For a busy event, add more webhooks to the same channel. Press **Busy channel? Let the bot add … more webhooks** (it needs **Manage Webhooks**), or paste several webhook links into the channel’s box. Anvil suggests more when you have 50 or more players, a lot of posts per minute, or Discord has recently said “slow down”. Up to 10 is plenty.',
        'Anvil takes turns between them. If Discord says “slow down” for one, that webhook rests for a moment and the next one takes the post. If one is deleted or stops working, it is skipped for 10 minutes. Posts keep flowing, as long as one webhook works.',
        'All of them must point at the same channel. Anvil warns you if they don’t. Use **Test** to check one, or **Stop posting here** to remove it.',
      ],
      note: {
        tag: 'Same channel, same posts',
        body: 'More webhooks never post twice. They only share the work. The same idea is in [Drop thresholds](#drops) above and the admin side in [Running the event]({adminGuide}).',
      },
    },

    announce: {
      title: 'Post to Discord',
      body: [
        'Admins can post as the bot from **Post to Discord**, under **Clan** in the admin menu. Pick a **Channel**, write the **Message** and press **Send message**. Long text, like a rulebook, is split into several messages by itself.',
        '**Send as an embed** is on by default and adds an optional **Title** and an **Accent colour**; turn it off for plain text. **Ping** picks a role, or @everyone, to mention, and Anvil asks before it sends.',
        'Every post you send is listed under **Sent from here**. **Edit** changes it in Discord without pinging again, and **Delete** removes it.',
      ],
      note: {
        tag: 'Admins only, with the bot',
        body: 'It posts as Anvil’s bot, so connect your server first. Moderators don’t see it. It is the **Post to Discord** switch under **Clan settings → Features**; switched off, it leaves the menu.',
      },
    },

    quiet: {
      title: 'When it goes quiet',
      body: [
        'In order, because each one rules out the next:',
      ],
      checks: [
        {
          term: 'Is the bot actually in the server?',
          body: '**Connection** on the Discord page says so directly. "Token valid" and "in your server" are different facts and the first does not imply the second — with a shared bot the token is always valid.',
        },
        {
          term: 'Is the server ID right?',
          body: 'A wrong-but-real ID looks exactly like a right one until you notice the posts are going somewhere else.',
        },
        {
          term: 'Is the webhook still there?',
          body: 'Deleting a Discord channel deletes its webhook, and Anvil keeps the dead URL. Pick a channel for it again under **What goes where**.',
        },
        {
          term: 'Is the bot’s role high enough?',
          body: 'For role or nickname sync, put the bot above every role it manages, check that each person has linked Discord, and check rank-role names exactly as listed above. Save first, then run **Sync roles & nicknames now**; its skipped list tells you who still needs linking.',
        },
      ],
      note: {
        tag: 'It cannot greet people who join',
        body: 'Discord only reports joins over a gateway connection, which a shared bot does not hold for every server. So there is no "welcome" post — put the sign-up link in a #roles or #start-here channel instead, which is where people look anyway.',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite plugin setup — Anvil',
    metaDescription:
      'Install the Anvil RuneLite plugin, sign in from its side panel, and set up Discord notifications.',
    eyebrow: 'Anvil · RuneLite plugin',
    title: 'Player setup guide',
    dek: 'Install it, sign in, and play. The plugin submits your bingo drops, posts your rare drops, deaths and milestones to Discord, and lets you look up anyone from a right-click.',
    facts: [
      { strong: '1 button', rest: 'to get tracking' },
      { strong: '~3 min', rest: 'for the basic setup' },
      { strong: 'Right-click', rest: 'to look anyone up' },
    ],
    footnote:
      'Screenshots are from a live setup — the account token is blanked out on purpose. Yours should stay just as private.',

    install: {
      title: 'Install the plugin',
      body: [
        'In RuneLite: **Configuration** (the wrench) → **Plugin Hub** → search **Anvil** → **Install**. The publisher is `AhmedFathy2001`.',
        'One plugin serves every clan — it always connects to `anvilosrs.com`, and signing in (next step) is what ties it to you and your clans. There is nothing clan-specific to download and no address to type in. Once installed, an **Anvil** button appears in the RuneLite sidebar, and its settings live under **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Sign in',
      intro: 'Open the **Anvil** panel from the RuneLite sidebar and click **Sign in with Discord**. Your browser opens on `anvilosrs.com`; approve the code there and the plugin signs itself in — nothing to type, nothing to copy, and nothing to fill in under settings.',
      panelFigure: {
        caption: 'RuneLite → the Anvil button',
        alt: "RuneLite's sidebar icons, with the Anvil button at the foot of the strip ringed",
        legend: [
          {
            label: 'The Anvil button',
            body: 'down the side of the RuneLite window, at the bottom of the icon strip. Click it to open the panel. It appears as soon as the plugin is installed and switched on — and you can drag it up the strip if you would rather have it near the top.',
          },
        ],
      },
      signInFigure: {
        caption: 'The Anvil panel',
        alt: 'The Anvil panel with the Sign in with Discord button and the site it connects to ringed',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'only shows while this computer is signed out. Click it and the rest happens in your browser.',
          },
          {
            label: 'Connects to',
            body: 'always `anvilosrs.com` — the only site the plugin talks to, and the one your token belongs to.',
          },
          {
            label: 'Paste a token instead',
            body: 'the fallback, if the browser step won’t work for you — see the end of this step.',
          },
        ],
      },
      easySteps: [
        'Click **Sign in with Discord**. The panel shows a short code and opens your browser on `anvilosrs.com`.',
        'Log in with Discord there if you aren’t already, check the code on the page matches the one in RuneLite, then click **Approve**.',
        'Back in RuneLite, the top of the panel says _Signed in_ — and, once you log in, which character it’s tracking. That’s it.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'The Link your RuneLite client page, with the code field and Approve button boxed',
        legend: [
          { label: 'The code', body: 'it must match what the plugin is showing you right now.' },
          {
            label: 'Approve',
            body: 'only ever approve a code _your own_ client is displaying. If someone sent you a link or a code, deny it — approving would hand them your account.',
          },
        ],
      },
      directNote: {
        tag: 'Where this happens',
        body: [
          'Everything in this flow stays on `anvilosrs.com` — the code is issued there, you approve it there with your own Discord login, and the token goes straight back to the plugin. The plugin only ever opens sign-in pages on `anvilosrs.com`, so a sign-in link that points anywhere else did not come from it.',
        ],
      },
      federationAside:
        'Not to be confused with **Connect clans** in the side panel — that’s the separate, optional button that links you to other Anvil clans, and it only appears once you’re already signed in here.',
      manualFallback:
        'If the browser doesn’t open on its own, the panel prints the address and the code so you can open it manually. Codes expire after ten minutes — just press the button again.',
      manualHeading: 'Fallback: paste your token by hand',
      manualIntro:
        'If signing in from the plugin won’t work for you, copy your token below (or from [Profile → plugin token](/profile#plugin-token), where you can also rotate it), then click **Paste a token instead** under the sign-in button in the Anvil panel and paste it there.',
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
            body: 'copy it, then use **Paste a token instead** in the Anvil panel. Rotate issues a new one and kills the old — use it if you ever think your token leaked.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Use the sidebar day to day',
        body: [
          'The **Anvil sidebar is your main workspace**: sign in and out there, see your clans and live events, browse and claim tiles, follow progress, take starting shots, run syncs and open support tools. **Configuration → Anvil**, shown below, is only for preferences — there’s no token in it. To sign this computer out, open the **⋯** menu next to your name at the top of the panel. One sign-in covers every event you’re signed up for — you never redo it per bingo.',
        ],
      },
    },

    accounts: {
      title: 'Link your accounts',
      body: [
        'Once the token is in, accounts you play appear on your profile automatically. A brand-new account can link immediately; an account already on a clan roster needs one ownership check first, because a public RuneScape name is not proof that the person holding the token owns it.',
        'For that first link, use [the quick XP check](/profile#link-account) or ask a clan moderator to approve it under [accounts we noticed](/profile#detected-accounts). After it is proven, the plugin stores its stable account fingerprint, follows future name changes, and recognises it automatically on every login.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'The RuneScape Accounts card on the profile page listing accounts verified via plugin',
        legend: [
          {
            label: 'Your linked accounts',
            body: 'anything marked “Verified via plugin” is linked and will be recognised automatically. Established roster accounts may ask for a one-time XP or moderator check first.',
          },
        ],
      },
      noPluginHeading: 'Can’t run the plugin?',
      noPluginIntro:
        'On mobile or the official client, use [Profile → account linking](/profile#link-account) instead:',
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
        'You should also see the **Anvil side panel** fill in with your clans, your live events, your placing and the sync buttons — and an **Anvil** button appear in the title bar of your in-game Collection Log.',
      guestNote: {
        tag: 'Guest vs member',
        body: 'If chat says _Tracked as a guest_, you’re being tracked but you’re not on the clan roster yet. An admin fixes that by syncing the in-game clan roster — ask {discordLink}.',
        discordWord: 'in Discord',
      },
      panelHeading: 'The side panel',
      panelBody: [
        'Four tabs and a gear. **Clan** is your events and your clan: every live and upcoming bingo and weekly competition with where you stand. **Feed** is your clan’s and boards’ big moments as they happen, with event chat. **You** is your own profile, and **Lookup** finds anyone else’s, player or clan. The gear holds syncing and your banner sounds.',
        'Every tab, event chat, reactions and the settings that put the feed and Supporter colours into your game are in [The side panel, tab by tab]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'The Anvil side panel’s three tabs side by side: the Clan tab with events and the clan’s week, the You tab with your collection log, and the Lookup tab showing another player’s card',
      },
      lookupHeading: 'Look anyone up',
      lookupBody:
        'Right-click a player — standing next to you, or by name in chat, your friends list or the clan panel — and pick **Anvil** to open their card in the side panel’s **Lookup** tab. Your own is the **You** tab.',
      lookupFigure: {
        caption: 'Right-click a name → Anvil',
        alt: 'A player’s right-click menu in game with an Anvil entry under Lookup',
      },
      lookupSettingNote:
        'Choose where the **Anvil** entry shows under **Player lookup** in the plugin’s settings. On a name in chat it is never the left-click option, so clicking a name still does what the game does.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'The Player lookup section of the Anvil settings with each setting boxed and numbered',
        legend: [
          { label: 'Anvil lookup on players', body: 'the master switch. Off hides the entry everywhere.' },
          { label: 'Players in the world', body: 'right-clicking a player standing near you.' },
          { label: 'Chatbox and private messages', body: 'names in the chatbox and in private chat.' },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'the name lists: your clan and guest-clan members, the friends chat channel, your friends and ignore lists and the raid party panel.',
          },
        ],
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
            label: 'Show Overlay',
            body: 'draws a small _Anvil / Team / UTC date_ panel in the top-left. It becomes part of the picture in your proof screenshots, which is what makes a proof hard to fake or back-date. It’s off in this screenshot — turn it on if your clan wants team and time visible on every proof.',
          },
          {
            label: 'Team completion popups',
            body: 'a banner when anyone on your team finishes a tile. Several at once: the hardest gets the banner, the rest go to chat.',
          },
          {
            label: 'My tile popups',
            body: 'a popup when your own drop moves a tile along or finishes it. Off, it still tracks — just quietly.',
          },
          {
            label: 'Banner sound + volume',
            body: 'plays a sound with the banner. Nothing plays until you add at least one .wav yourself, via **Add clip** under “Banner sounds” in the Anvil side panel. Missions have a folder of their own — add a clip under **Mission sounds** and they play it instead of the built-in chime that keeps them from sounding like a finished tile.',
          },
          {
            label: 'Auto starting shot',
            body: 'takes an event’s starting shot for you the moment you stand on its pinned spot. Off, you press **Take starting shot** in the side panel yourself.',
          },
        ],
      },
      teamsHeading: 'Teams',
      teamsBody:
        'The **Teams** button on an event lists its teams ranked, with yours on top. Open one for its roster, captain first, or search for a player across every team — click a name to look them up.',
      teamsFigure: {
        caption: 'Event → Teams',
        alt: 'The Teams page listing an event’s teams with points and member counts, next to one team’s roster with its captain first',
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
        'These fire whether or not a bingo is running, and they post to the clan’s channels. Which channel is set up here by the admins — you only choose _what_ you post. In the next plugin update these choices move to the website, under **Settings → Discord posts & screenshots**, and follow you to every computer. On the same page, **Screenshot privacy** picks which chat (private messages, public chat, clan chat) is hidden in every screenshot the plugin takes. The plugin keeps two switches under **Notifications**: **Share clan posts** pauses every main-game post at once, and **Share seasonal activity** does the same on Leagues, Deadman and other seasonal worlds.',
      examplesFigure: {
        caption: 'What a post looks like',
        alt: 'Two Discord posts from Anvil: a Grandmaster combat task with points and progress to the next unlock, and a death with its message, each with a screenshot of the moment',
      },
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
            body: 'a drop posts when it is worth at least this much (GE or high alch, whichever is higher) or rarer than 1-in-N. Anvil starts at 1m and 1/1,000. Your clan can set its own defaults for its members, and until you set a number yourself you follow your clan\'s; **Reset to clan default** (or **Reset to Anvil default** if you have no clan) goes back to following it. A clan can also set a hard rarity floor, which only applies to posts in that clan’s own channels. Your number can’t go looser than it there, and it never changes the value limit. Set either number to 0 to switch it off.',
          },
          {
            label: 'Value and rarity together',
            body: 'by default a drop posts when it meets the value **or** the rarity. Turn on **Require both** and it must meet the value **and** the rarity. Your clan can choose this default for its members; until you choose, you follow it, and with no clan it is either one. Each of your own webhooks can also set its own minimum value, rarity and either/both; anything it leaves blank follows your settings.',
          },
          {
            label: 'Loot key value',
            body: 'a loot key posts once, as a single notification, when its whole contents clear this number.',
          },
          { label: 'Notify on pets', body: 'pets post to the rare-drops channel.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'The Combat achievements notification section with each setting boxed and numbered',
        legend: [
          {
            label: 'CA post tier',
            body: 'the lowest task tier that posts; tier clears post too. The default is Master; Grandmaster posts only the rarest, **Off** posts none. Bingo CA tiles count either way.',
          },
          { label: 'Notify on collection log slots', body: 'every new collection-log slot.' },
          {
            label: 'Notify on level milestones',
            body: 'level-ups your clan has chosen to announce — by default 99s, every 100 total levels from 1800, and max. Your clan’s admins set the rules; you can post less (or set your own rules for your personal webhooks) from your profile’s Announcements.',
          },
          { label: 'Notify on diary completions', body: 'achievement-diary tiers, with a screenshot.' },
          {
            label: 'Quest post tier',
            body: 'quests at or above the difficulty you pick, from All (every quest) up to Grandmaster; **Off** posts none. The default is Master. Bingo quest tiles count either way.',
          },
        ],
      },
    },

    trouble: {
      title: 'When something breaks',
      intro:
        'The plugin tells you in chat when tracking has stopped — it waits about 90 seconds before complaining and repeats at most every 5 minutes.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'The token is wrong or was rotated. Open the **⋯** menu at the top of the Anvil panel, press **Sign out**, then **Sign in with Discord** again — or use **Paste a token instead** with a fresh token from [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'The plugin can’t reach `anvilosrs.com`. Check your internet connection, and any firewall or VPN that might be blocking RuneLite. If that’s all fine, the site is probably down for a moment — the plugin reconnects by itself.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'That account isn’t linked yet. Open [Profile → accounts we noticed](/profile#detected-accounts) to add it or start the ownership check.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nothing. It recovered by itself.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'Someone else linked this character on Anvil first, so nothing counts for it from your login. If it really is yours, press **This is my account** in the panel’s **You** tab and pass the quick XP check. Then the current owner is asked, or Anvil staff decide. You never learn who they are. Follow it under [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Still stuck? Send an admin a log',
      logBody:
        'Send an admin your RuneLite log: `client.log` in the `.runelite/logs` folder in your user folder (on Windows, paste `%USERPROFILE%\\.runelite\\logs` into the Explorer address bar). The plugin writes what it saw and why into it, so they can see exactly what went wrong.',
      missingNote: {
        tag: 'Missing proofs?',
        body: 'Pets and duplicate Champion’s scrolls need a manual screenshot. The plugin takes one for you and saves it to `.runelite/osrs-bingo-pending/` — **Copy folder path** in the Anvil side panel opens it — so you attach it on the site rather than hunting for a shot after the fact.',
      },
    },
    limits: {
      title: 'Known limitations',
      intro:
        'A few things can’t be tracked perfectly — almost always because of what the game itself reports, not Anvil. The fix is the same every time: screenshot it and submit it manually.',
      rows: [
        {
          term: 'Barraging and other multi-target kills',
          body: 'Kill counts come from what the game reports per kill, and multi-target spells like Ice Barrage make it miss some, so **KC can come out lower** than you killed. RuneLite’s own Loot Tracker undercounts the same way — it’s a game-engine limit, not an Anvil bug.',
        },
        {
          term: 'Combat achievements you’ve done before',
          body: 'Turn on **repeat completion** in the game’s Combat Achievements settings. Without it the game won’t announce a task you’ve already completed, and the plugin can only credit what the game announces.',
        },
        {
          term: 'The Yama contract combat achievement',
          body: 'The game doesn’t announce this one again even with repeat completion on, so the plugin never sees it. Screenshot it and submit it manually.',
        },
        {
          term: 'Gathering tiles without the plugin',
          body: 'Item counts — a number of fish, ores, logs — aren’t on the hiscores, so only the plugin tracks them. Without it, screenshot every inventory; or, if the item shows in the Loot Tracker, screenshot it reset to 0 at the start and again at the end.',
        },
        {
          term: 'Implings, fish, ores and other item gains',
          body: 'Catching implings and gathering items (fish, ores and anything else counted by what lands in your inventory) **sometimes doesn’t track correctly, even with the plugin**. Keep screenshots as you go, and if a count looks short, report it and submit the difference manually.',
        },
        {
          term: 'Fish barrels, log baskets and other storage',
          body: 'Item-gain tiles count only what lands in your inventory **straight from the source** — a fishing spot, a rock, a tree. Anything taken out of storage (emptying a fish barrel, log basket, coal or gem bag, herb sack), bought from a shop, withdrawn from the bank or picked up off the ground **does not count**. That keeps a tile honest: otherwise the same fish could be filled into a barrel and emptied out again forever. If you gather into a barrel or basket, those catches aren’t counted.',
        },
        {
          term: 'Duplicate pets and champion’s scrolls',
          body: 'When you already own the pet or scroll, the game only says you have a **“funny feeling”** — it never names which one. The plugin works it out from what you just killed or trained, credits the tile, and **flags it for staff to check**. When it can’t tell — two pets from the same source, or a pet with no kill or skill behind it (Bloodhound from a master clue, a gambled Jad or Zuk pet, Chompy chick) — it saves the screenshot to **Saved proofs** for you to submit manually.',
        },
      ],
    },

    screen: {
      title: 'On screen while you play',
      intro: 'What the plugin draws and prints while you play, and the setting behind each.',
      rows: [
        {
          term: 'Pinned tiles',
          body: 'open a tile in the side panel and press **Track on screen** (up to 3). With **Pinned tiles in one panel** on, they share one small panel: each tile’s name, your team’s progress, and lines like _3/5 runs_ or which parts of a combo are done. Off, each gets its own bigger widget with your teammates and the other teams. Alt-drag to move it. Right-click it for **Unpin** or **Unpin all**. A finished tile shows **Done**, then unpins itself.',
        },
        {
          term: 'The starting shot card',
          body: 'while an event is waiting for your starting shot, a **Starting shot needed** card at the top of the screen says where to go and shows each check in green or red: the relog, how long your session has been, how many squares you are from the spot. A hint arrow and a world map pin (**Anvil starting shot**) lead you there. With **Auto starting shot** on it is taken the moment everything is green; then the card says **You’re tracked** and goes. Setting: **Starting shot guide**.',
        },
        {
          term: 'Banners',
          body: '**Tile complete!** when your team finishes a tile, your own drop’s progress on a tile, and **New mission!**. Settings: **Team completion popups** and **My tile popups**.',
        },
        {
          term: 'Vestige rolls',
          body: 'at the Desert Treasure II bosses, each unique prints a line with where you are in the vestige rotation, like _Roll 2 of 4_ or _the next unique is the vestige_. It says _(estimated)_ until it has seen you get a vestige. No setting; it runs with or without an event.',
        },
        {
          term: 'Lookup type-ahead',
          body: 'typing in the **Lookup** box finishes the name for you, from your recent lookups, friends, clanmates online and players nearby. **Enter** accepts. It reads your own client only; nothing is sent.',
        },
        {
          term: 'Chat colours',
          body: '**[Anvil] tag colour** and **Message colour** under **Chat messages**. Until you pick, they turn dark gold and black on an opaque chatbox so they stay readable. Hover a Supporter’s name in chat to see their tier, like _Anvil Patron_.',
        },
      ],
    },

    sync: {
      title: 'Profile sync, and what else it sends',
      intro:
        'The **Profile sync** settings fill your Anvil profile. All four are on to start:',
      rows: [
        {
          term: 'Sync collection log',
          body: 'each collection-log page you open is sent to your profile.',
        },
        {
          term: 'Sync the whole log on open',
          body: 'opening the collection log sends all of it, not just the page you look at. To do it on demand, press the **Anvil** button in the collection log’s title bar, or **Sync profile** in the side panel while the log is open. Chat confirms it: _Profile synced — N collection log slots._',
        },
        {
          term: 'Sync personal bests',
          body: 'boss and raid times are sent as you set them.',
        },
        {
          term: 'Import existing bests once',
          body: 'once per character, copies the personal bests RuneLite already saved on your computer: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Share highlights with the clan',
          body: 'your pets, big drops, deaths, combat tasks, level milestones, new log slots, diaries and quests appear on your clan site’s feed, and in the chat feed of players who can see them. New log slots, diaries and quests also appear on the feed of every live board you are on.',
        },
      ],
      outro:
        'Three more things are sent without a setting of their own. **Who killed you**: the monster or player that had you targeted in your last 15 seconds is named on the feed. **Game counters**: some kill tiles count a number the game keeps, like Tithe Farm points, Giants’ Foundry reputation, Doom delves or slayer streaks; only rises count. **Leagues, Deadman and other modes**: on those worlds, the game’s own lines about relics, areas and tasks are sent so your clan can post them in its mode channel.',
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
      { strong: '5 steps', rest: 'on the setup checklist' },
      { strong: '7 formats', rest: 'to build a board from' },
      { strong: '1 button', rest: 'to sync the clan roster' },
    ],
    footnote:
      'This guide tracks the app as it ships today. If a screen here doesn’t match what you’re looking at, the app is right and the guide is stale — [tell us](/feedback) and we’ll fix it.',

    access: {
      title: 'Who can do what',
      intro:
        'Everyone signs in with Discord — there are no passwords. The first admin is the owner, whoever created the clan; after that, an admin promotes people from **People → Staff & roles**. Roles stack downward: everything a moderator can do, a treasurer and an admin can do too.',
      rows: [
        {
          term: 'Admin',
          body: 'full access — events, tiles, teams, settings, staff, payouts. Give this to as few people as the clan can stand.',
        },
        { term: 'Treasurer', body: 'everything a moderator can do, plus sign-up fees and payouts.' },
        {
          term: 'Moderator',
          body: 'the day-to-day: roster, verifications, proofs to check, weekly competitions, the schedule and clan events. Cannot create or edit events.',
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
        '**Settings → Finish setup** is a short wizard (it stays in the menu until you’re done), and the dashboard keeps a five-step checklist until it’s done: name the clan, connect Discord, load your members, create an event, add tiles. Status is computed from real data, so a step only ticks when it’s genuinely finished.',
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
        'Everything posts to one catch-all channel by default. When that gets noisy, open **Discord → What goes where** and give the loud categories their own homes — event posts, weekly competitions, rare drops, deaths, PvP kills, combat achievements. Anything left blank falls back to its catch-all, so you can split one category at a time.',
        'With the bot connected you never touch a webhook URL: pick a channel from the row’s dropdown and it saves. On a busy event you can add a second webhook with **Add another** under **Post without a bot** — Anvil rotates between them so Discord’s rate limit doesn’t swallow posts.',
      ],
      clipsNote: {
        tag: 'The clips channel is different',
        body: 'Clip videos upload straight from each player’s PC to Discord — they never pass through this site. So the clips webhook you set here is the one you _hand out_: members paste it into their plugin themselves. Everything else on this page is server-side and members never see it.',
      },
    },

    roster: {
      title: 'Get your roster in',
      body: [
        'Clan membership comes from one place: an in-game roster sync. Install the [Anvil RuneLite plugin]({pluginGuide}) on an _admin’s_ account, open your in-game clan window, and press the **Anvil** button in its title bar. That pushes your actual in-game clan list to the site in one click.',
        'Signing in, linking a character or playing with the plugin never puts anyone on the roster. If the plugin sees someone playing in your in-game clan before the roster has them, it files a join request; anyone else can ask with **Apply** on your clan page. Staff answer requests at the top of **People → Roster**, and **People → Who can join** decides whether people wait for a yes, get a guest seat straight away, or cannot ask at all. That’s deliberate: nobody joins your clan by typing its name. The whole picture is in [Your people]({peopleGuide}).',
        'You can also add someone by hand from **People → + Add Manually**, and sign them up to an event on their behalf with **Add member** on the event’s **Sign-ups** page when they can’t reach the site.',
      ],
    },

    board: {
      title: 'Create your first board',
      intro:
        '**Events → All events → + New event**. Pick a format first — it decides how the board is scored and what the rest of the form asks you for.',
      formats: {
        classic: { label: 'Classic bingo', blurb: 'A square N×N grid — teams complete tiles in any order, each worth 1.' },
        leagues: { label: 'Point Hunt', blurb: 'A task list where each tile carries a point value — any number of tiles.' },
        race: { label: 'Tile race', blurb: 'An ordered track — teams reach tiles in sequence; furthest reached wins. The host can branch it into routes that split and merge — finishing a tile picks your way.' },
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
        'The event’s **Board & tiles** page is where a board becomes a bingo. Each tile is one _kind_ of task, and the kind decides what the plugin watches for: a drop, a boss kill-count, skill XP, an NPC kill, a timed clear, an achievement diary, a Combat Achievement, a collection-log unlock, a PvP kill, an inventory gain, or a deathless run. Manual tiles — the ones a human verifies from a screenshot — are always an option too.',
        'For a full board, author in bulk: export the sheet, fill it in a spreadsheet, and import it back. CSV and .xlsx both round-trip, and rows map to positions, so you can rewrite a whole 25-tile grid in one paste.',
      ],
      rows: [
        {
          term: 'Difficulty tiers',
          body: 'point values map to named bands (easy → elite). Edit the bands in **Clan settings → Rules & scoring → Difficulty & balance** if your clan grades differently.',
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
        'The **Teams & draft** page adapts to the format you chose: a format that doesn’t use teams skips straight past it. For a normal team bingo you create the teams, decide who captains them, and either assign players yourself or run a live draft.',
        'Captains draft from the sign-up pool in your chosen order, and each captain sees the answers people gave on the sign-up form — frozen as they were submitted, so nobody edits their “hours per week” after being picked.',
      ],
      placementIntro:
        'You don’t have to draft. **Team placement**, on the create form and the **Sign-ups** tab, decides where each new sign-up lands:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'each person who signs up joins the team with the fewest players. You only choose how many teams. Good for big public events.',
        },
        {
          term: 'Players pick',
          body: 'you make the teams first, and each player picks one on the sign-up form. Set a limit per team to keep them even.',
        },
        {
          term: 'Host drafts',
          body: 'everyone waits in a pool until you or your captains draft them or assign them by hand. Best when you know the players.',
        },
        {
          term: 'Solo',
          body: 'no teams at all. Every player is on their own, named after their character, and the standings rank players.',
        },
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
          body: '**Post to Discord** (under **Clan** in the menu) posts a message to any channel as the bot mid-event without you writing a webhook by hand.',
        },
      ],
      missionNote: {
        tag: 'Mid-event surprises',
        body: 'You can drop a **mission** onto a live bingo — a hidden bonus tile that gets announced when you fire it, optionally decaying in value or expiring. It’s the cheapest way to wake a board up on day five.',
      },
      startProofNote: {
        tag: 'Stopping pre-event stacking',
        body: [
          'Turn on **Starting shot** (event → Home → **Extras**) and every player has to file one screenshot taken after the event goes live, at a location Anvil draws at the start moment — so nobody can be sat on a week of banked clues and caskets at T0. The location is announced with the start; each player’s keyword is personal, derived from the draw, and doesn’t exist until the event starts, so it can’t be staged in advance by anyone.',
          'Pin the spots on the world map (the pool editor has one) and the plugin checks players are actually standing there instead of just being told to. You can also require a **fresh session** — 15 minutes by default: hiscores only save when a player logs out, so making everyone relog right before their shot is what makes the starting totals behind every XP and KC tile honest.',
          'Plugin users press one button. Everyone else types their keyword in-game and uploads on My Team. You choose what happens to a credit from someone who hasn’t filed: flag it for review (default) or refuse it until they do. The same panel on the event’s Home is the review list — plugin captures with a verified keyword arrive already accepted, so in practice you’re only eyeballing the phone players.',
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
          body: 'the event’s **Prizes** page turns the prize pool into a list of who gets what, tracked as you pay it out.',
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
          term: 'Save as a template',
          body: 'keep the board you just built, from the event’s **Settings → More**. Next bingo starts from it instead of an empty grid.',
        },
      ],
      federation:
        'With federation on, members can also connect to other Anvil clans from the plugin — handy for cross-clan events, and entirely opt-in per member.',
      outro: 'Then point your members at the [player setup guide]({pluginGuide}) and start planning the next one.',
    },

    survey: {
      title: 'Ask the players',
      intro:
        'Switch on **Post-event survey** under **Features**, then open the event’s **Survey** page.',
      body: [
        'Under **Build**, add questions: **Rating (1–5)**, **Free text**, **Choose one** or **Choose many**, each optionally **Required**. Or load a template: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** or **Skilling / social**. **Preview the participant view** shows it as a player will.',
        'It opens when the event ends, to approved participants only, and they can change their answers later. **Results** shows answers **By question** or **By person**. It is not anonymous: staff see who said what.',
      ],
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

    teamCompsLine: 'Want clans to race on skills or bosses instead? See [Team competitions]({teamCompsGuide}).',

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
        'Open your event and go to the **Teams & draft** page. Create one team per clan you’ve invited and name it after them — the name is what their players see on the sign-up form, so “Ironforge” beats “Team 2”.',
        'You do _not_ need to run a draft. Invite links and a draft are alternatives: a draft distributes a shared sign-up pool, a link seats people directly. On a pure clan-v-clan most hosts create the teams, hand out one link each, and never open the draft at all.',
        'Then open the team itself — **Teams & draft → the team** — which is where both of the next two steps live.',
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
        caption: 'Event → Teams & draft → the team → Team staff',
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
        caption: 'Event → Teams & draft → the team → Invite links',
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

    cohost: {
      title: 'If you are the co-host',
      intro:
        'Everything above is the host’s side. The visiting clan’s staff get their own page for the event, **Co-hosted with <host>**. The host keeps the dates, the draft, the teams and who can see it.',
      rows: [
        {
          term: 'Your clan’s sign-ups',
          body: '**Approve**, **Reject** or **Withdraw** your own clan’s players. You never see or touch the host’s.',
        },
        {
          term: 'The board',
          body: 'you can edit only if the host gave your staff that. Otherwise you can **Suggest a tile**: the tile, details and points, up to 25 waiting at once. Each shows as **waiting**, **accepted ✓** or **turned down** with the host’s reason.',
        },
        {
          term: 'Your team',
          body: '**Manage** your clan’s team.',
        },
        {
          term: 'Discord',
          body: 'your admins choose what reaches your own server: **Everything shared**, **Big moments** or **Nothing**, which channel, who gets pinged, and whether your players get the **@Bingo player** role.',
        },
      ],
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
        kill: { label: '', blurb: 'N kills of any boss or monster. Counted from the hiscores when every monster on the tile is on them, otherwise by the plugin as you play (chickens, cows, slayer mobs).' },
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
          term: 'A boss list plus one off-hiscores monster',
          body: 'is a plugin tile for **all** of it. A Kills tile is counted from the hiscores only when every monster on it is on them; add a chicken to four GWD bosses and the whole tile needs the plugin. If some of your clan play without it, keep the hiscores bosses on their own tile.',
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
        'Clicking out a 25-tile grid is fine. Clicking out a 200-task Point Hunt board is not, and neither is proof-reading it afterwards. The Tiles tab has a round trip built for exactly this.',
      ],
      steps: [
        '**Download spreadsheet** on the event’s **Board & tiles** page. You get an .xlsx of the board as it stands, with dropdowns, the item list and the column instructions on their own sheets.',
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
          body: 'extra rows create new tiles on a Point Hunt board or a tile race, before the event starts, up to 1000. A classic N×N grid is a fixed shape and ignores them. To generate hundreds of tasks, make it a Point Hunt event.',
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
        'On a points-scored board every tile carries its own value, and those values map onto named difficulty bands — easy through elite — which you can edit under **Rules & scoring** if your clan grades differently. The band is what players read; the number is what scores.',
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

    library: {
      title: 'The task library and suggestions',
      body: [
        'Tile editors have **Task library** in the admin menu: your clan’s saved tasks, and Anvil’s own library to copy from. **⬇ Export pack** saves your tasks as a file and **⬆ Import pack** loads one, which is how a board moves between clans.',
        'Found a mistake in Anvil’s library, or a task it is missing? Press **Suggest a fix** on the task, or **Suggest a new task**. Anvil reviews it and the answer shows under **Your suggestions**: **Waiting for review**, **Approved** or **Not taken**, with a note. You can have 5 waiting. An approved fix reaches every clan copy that still follows the library.',
      ],
    },

    stats: {
      title: 'Starting stats and late joiners',
      intro:
        'XP and kill-count tiles compare each player’s stats now with their **starting stats**, taken when the event starts. The event’s **Stats** page is where you check and fix them:',
      rows: [
        {
          term: 'Capture starting stats',
          body: 'before the start it only warms up the hiscores; the starting line itself is taken at the start. After the start the button becomes **Capture late joiners**, for players added since. It can run once every 30 minutes.',
        },
        {
          term: 'Update now',
          body: 'refreshes the standings from the latest numbers. They also refresh every hour on their own.',
        },
        {
          term: 'Fix baseline',
          body: 'per player: change one skill or boss starting number by hand. Use it when a grind from before the event was counted, because the player didn’t log out before it started.',
        },
        {
          term: 'Reset all starting stats',
          body: 'tucked under **Danger zone**: takes everyone’s starting line again from their stats now, wiping every gain so far. Only for an event that started by mistake.',
        },
      ],
      outro:
        'Below that, **Member breakdown** shows who on each team did what, and **Stat tile standings** every player’s start and current numbers on each XP or kill tile.',
    },

    race: {
      title: 'Tile race tracks',
      intro: 'On a tile race board you build a track instead of a grid. Tiles sit on numbered steps, and a team moves along them.',
      body: [
        'Open **Tiles** and use the **Route** section. Pick a template (**Diamond** is the default), add your tiles to the steps and press **Save route**. Every tile you link must sit on the next step.',
        'Roads can split and merge, but there is one finish. At a fork you choose whether finishing a tile sets the road, or the captain picks it and locks it in. The full list of choices, and what players see, is in [Formats, and how tiles open]({formatsGuide}).',
      ],
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
      'Format is fixed at creation but changeable afterwards from the event’s Settings → Event tab; reveal policy and the scoring modifiers can be changed any time before the tiles they affect are revealed.',

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

    race: {
      title: 'Tile race routes',
      intro: 'A tile race is a track of numbered steps. Teams move from step to step, and whoever gets furthest wins. The host can turn the track into a map with roads that split and join.',
      body: [
        'Every route has one start, roads that can split and merge, and one finish. Every road is the same length. A team’s progress is the road it has walked so far.',
      ],
      rows: [
        { term: 'By achievement', body: 'every tile after your current one is open. The first one a team finishes sets its road, and the others close for that team.' },
        { term: 'Choose and lock in', body: 'the captain (or team staff) picks the next tile with **Pick this road** before anything counts. Only the pick is open. A pick can’t be undone, except by an admin reset.' },
        { term: 'Bank early finishes', body: 'off by default, so only tiles open on a team’s road count. Turn it on and a finish on a tile the team hasn’t reached yet is kept. It completes when the road gets there. It never skips a team ahead or opens anything early.' },
      ],
      steps: [
        'Open the event’s **Tiles** page and find **Route**.',
        'Pick a **Route template** and press **Apply template**. **Diamond** is the default: one start, two roads, one finish. **Two roads**, **Braid**, **Straight line** and **Free** (no links) are there too.',
        'Choose **How a team’s road is set at a fork**: by achievement, or choose and lock in.',
        'Add or move steps with **+ Step before**, **Move step earlier/later** and **Remove step**, then press **Save route**.',
        'If the event is already live, Anvil asks what to do with finishes the new route cuts off: **Keep** them or **Roll back**.',
      ],
      outro: 'Players see a **Race track** on the event page, with a gold **You** marker on their own team’s tile. **Fullscreen board** makes it big, and **Esc** closes it. In the plugin, the side panel shows **Your road** and **After that**.',
    },

    choose: {
      title: 'Choosing, in one page',
      intro: 'If you know the feeling you want, this is the shortest route to it.',
      rows: [
        { term: 'A normal clan bingo', body: 'Classic grid, all tiles visible. Add a first-team bonus if you want a little urgency.' },
        { term: 'Hundreds of tasks, scored by difficulty', body: 'Point Hunt, all visible. This is also the only shape a big spreadsheet import can grow into.' },
        { term: 'A week that builds toward something', body: 'Point Hunt with scheduled or interval reveal, so the board opens over the week instead of all at once.' },
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
      'Fees and payouts are the treasurer’s surface. A treasurer can do everything a moderator can, plus this; a plain moderator does not see the fees pages at all.',

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
        {
          term: 'Guest fee',
          body: 'what players who aren’t members of a clan running the board pay. Leave it blank and guests pay the member fee. To charge one player a different amount, press **Change this player’s fee** on their row in **Sign-ups**.',
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
        'Chasing is one button: **Remind unpaid** on Admin → **Fees** sends a Discord DM to everyone on that event who still owes.',
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
        'How many signatures a fee needs is a clan setting (**Clan settings → Rules & scoring → Fee sign-off**), from zero to five. Zero exists for a real reason: in a clan where the treasurer _is_ the owner, there is nobody else to sign, and “34 fees waiting on a second signature” becomes a queue that can never be cleared and permanently the loudest thing on the dashboard. At zero, marking a fee paid **is** the sign-off.',
        'Set it to one — the default — if you have two people. Set it to zero if you honestly do not, and set it higher only if your clan has both the staff and the reason.',
      ],
    },

    pay: {
      title: 'Paying out',
      body: [
        'When the event ends, the event’s **Prizes** page turns the pool into a list of people. Generate it and you get one row per recipient, not per team: a winning team’s prize divides equally across its members so that paying out is a list of names and numbers rather than an arithmetic problem at midnight.',
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

  coffer: {
    metaTitle: 'The clan coffer — Anvil treasurer guide',
    metaDescription:
      'The clan’s pot of gp on Anvil: recording donations and crediting the people who gave them, the three ways a prize gets paid, who may move the money, and what happens when the pot is short.',
    eyebrow: 'Anvil · for treasurers',
    title: 'The clan coffer',
    dek: 'Most clans keep their gp in somebody’s bank and their record of it in somebody’s memory. The coffer is one pot with a line for every movement — who gave it, what it was promised to, and who actually sent it.',
    facts: [
      { strong: '3 numbers', rest: 'held, committed, free to promise' },
      { strong: '3 ways out', rest: 'weeklies, mission tiles, a board’s pool' },
      { strong: 'Treasurer', rest: 'or admin — never rank alone' },
    ],
    footnote:
      'Everything here is Admin → **Coffer**, except the prize ladders, which live on the thing being paid for. The public half is `/coffer`: the balance, the top donors and the recent movements, for members.',

    what: {
      title: 'What it is',
      body: [
        'A ledger, not a wallet. Anvil never holds your gp — it stays wherever your clan already keeps it — so the coffer is the record of what came in, what has been promised and what has actually been handed over. Its usefulness is that the promise and the payment are two different lines.',
        'The page leads with three numbers, and they are three because they answer three different questions:',
      ],
      rows: [
        {
          term: 'Held',
          body: 'approved donations and adjustments. What the clan has been given, minus what it has written off.',
        },
        {
          term: 'Committed',
          body: 'gp a prize has claimed — won but not yet sent, plus any pool set aside for a board. Spoken for, even if it is still in somebody’s bank.',
        },
        {
          term: 'Free to promise',
          body: 'held minus committed. The only number a new prize is checked against, because the alternative is promising the same 50m to two winners while a treasurer is asleep.',
        },
      ],
      note: {
        tag: 'A pending donation counts toward nothing',
        body: 'Somebody typing “I gave 100m” is a claim about the past, not gp in a bank. It sits outside all three numbers until staff recognise it, so it can never fund a prize that then cannot be paid.',
      },
    },

    inbound: {
      title: 'Getting gp in',
      body: [
        'The RuneLite plugin handles the ordinary route automatically: open the in-game Clan Coffer and Anvil records deposits and coffer-to-bank transfers from its real coin balance. Deposits fund the ledger; banking coins only changes custody and does not mark them spent. The first look is only a baseline — it never pretends the person who opened it donated everything already inside.',
        'Manual records remain for anything that happened while nobody had the plugin open. A member reports their own donation from `/coffer` and it waits for staff to believe it; a treasurer records one that already arrived, and their typing it **is** the approval.',
        'Either way it is credited to a **person**. That matters more than it looks: the top-donor list on the public page is the only thanks most donors ever get, and gp that arrives as “the clan” thanks nobody.',
      ],
      rows: [
        {
          term: 'Open the coffer in game',
          body: 'with Anvil enabled and signed in (Profile sync → **Sync Clan Coffer** is on by default). A matching game message credits your own deposit or coffer-to-bank transfer to you; changes seen after a gap are reconciled without naming the observer. A transfer to your bank stays in the Anvil balance until staff record an actual payout or spend. Admin → Coffer shows the last physical amount and when it was seen.',
        },
        {
          term: 'A member reports one',
          body: 'from the public coffer page, with a screenshot if they have one. It lands pending and shows up in your queue. Approving it is what makes it real money.',
        },
        {
          term: 'You record one',
          body: 'Admin → Coffer → **Record a donation**. Search the roster for who gave it, put an amount against their name, done. Guests can be credited too — somebody who is not a full member can still have paid into the pot.',
        },
        {
          term: 'Several people together',
          body: 'pick all of them, type the total and press **Split … ways**, then adjust any share by hand. It writes one line each rather than one line with a list, so each of them shows up in the top donors under their own name.',
        },
      ],
      note: {
        tag: 'An adjustment is the other thing',
        body: '**Correct the pot** is for gp that moved outside all of this — seeding the pot, spending it on something Anvil never saw, fixing a mistake. It belongs to nobody by design, and it is deliberately not how you record a gift.',
      },
    },

    out: {
      title: 'The three ways it pays out',
      intro:
        'Every prize on Anvil comes out of this one pot, and each route decides winners differently. Set the ladder where the thing being won lives — the coffer never asks who won anything.',
      rows: [
        {
          term: 'A weekly, on its own page',
          body: 'a Skill or Boss of the Week carries a place ladder: first gets this, second gets that. It settles **once** when the competition ends, off the final standings — nothing changes hands while it is running. Set it while creating the competition, or later from the competition’s own page.',
        },
        {
          term: 'A mission tile, on the board',
          body: 'missions pay in the order people finish, so their ladder is claimed rather than settled: the first team to clear it takes first place’s gp. Set it in the tile’s reward section, on any board that allows missions.',
        },
        {
          term: 'A board’s prize pool',
          body: 'a bingo divides its own pot across placements, so the coffer just hands it one number. Event → **Prizes** → *From the clan coffer*. It joins the entry fees and anything you added by hand, and the split across places is set on that same page. You also choose whether the coffer **holds** that gp now or only records the promise — it has not left yet, and a board six weeks out does not need half the pot frozen until then.',
        },
      ],
      note: {
        tag: 'People finishing level',
        body: 'A weekly ladder can **split ties**: everyone tied pools the places they occupy and takes an equal share, so three people on 40 kc each take a third of first, second and third rather than the first of them taking the lot. Leave it off and the board’s own order decides. Either is defensible — deciding after the results are in is not.',
      },
    },

    who: {
      title: 'Who can move it',
      intro:
        'Money is its own permission, not a rank. A moderator can approve a submission and never touch the pot, and that is deliberate rather than an oversight.',
      rows: [
        {
          term: 'Treasurer or admin',
          body: 'the whole ledger: record and approve donations, adjust the pot, set prize ladders, mark a prize sent. The owner counts as an admin here.',
        },
        {
          term: 'A moderator',
          body: 'none of it. They will not see the coffer page at all — collecting money is the treasurer’s job, and rank alone has never conferred it.',
        },
        {
          term: 'A board treasurer',
          body: 'one event’s money: its fees, its payouts, its prize pool. Granted per board, which is how a visiting clan runs its own half of a clan-v-clan without being handed your ledger. They cannot touch the clan-wide coffer.',
        },
        {
          term: 'Any member',
          body: 'can report a donation and read the public page. That is the whole of it.',
        },
      ],
      note: {
        tag: 'Tell the clan, in a channel',
        body: 'Point the **Coffer ledger** at a Discord channel under Admin → Discord → What goes where → **Staff only** and every movement posts with the balance it leaves behind. It is the one feed with no fallback: leave it blank and nothing about the money is posted anywhere. See [Anvil in Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'When the pot is short',
      body: [
        'A prize bigger than the coffer is not refused. It is recorded as **owed and not funded** — a real line on the ledger with a winner’s name on it — because the alternative is a winner with nothing and no record that anything was ever promised.',
        'So the fix is the ordinary one: get gp in, then pay it. What you should not do is quietly edit the ladder afterwards; the ledger already says what was advertised, and the two disagreeing is worse than being short.',
      ],
      note: {
        tag: 'Nothing is sent by Anvil',
        body: 'Every prize ends as a person handing over gp in game and ticking a row. The ledger’s job is to make sure that row exists, that it says who and how much, and that a week later nobody has to reconstruct it from Discord scrollback.',
      },
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
        'the roster: adding and removing people, and answering join requests ([Your people]({peopleGuide}))',
        'account verifications — the XP challenge and manual review',
        'submissions and proof screenshots',
        'weekly competitions and the schedule',
        'clan calendar events',
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
          body: 'after the first ownership check, playing with the plugin recognises the account automatically and a stable account fingerprint keeps the link through name changes. A roster account with no existing fingerprint uses the XP check or a moderator vouch once.',
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
        body: 'Verifying an account says “this is really theirs”. It does not put them in the clan. Membership comes only from an in-game roster sync or staff adding them by hand, and a guest seat only from a join request staff approve (or straight away, if the clan lets anyone in). That is deliberate, and it is what stops anyone joining your clan by typing a name.',
      },
    },

    roster: {
      title: 'Keeping the roster true',
      body: [
        'The roster comes from one place: an admin runs a sync from the in-game clan list, with the **Anvil** button in the clan window’s title bar (or **Sync roster** in the plugin’s side panel). Everything else — verifications, links, sign-ups — hangs off it.',
        'So the maintenance job is small but real: ask an admin to run the sync after any recruitment round (it turns guests who joined in game into members), answer the join requests at the top of the **Roster** tab, and work through **Needs review** rather than waiting for people to complain. See [Your people]({peopleGuide}).',
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

  commands: {
    metaTitle: 'Discord slash commands — Anvil',
    metaDescription:
      'Every Anvil slash command — /bingo, /sotw, /botw, /eff, /coffer, /stats and /guide — with each option explained, examples, who can use what, and fixes for commands that don’t appear.',
    eyebrow: 'Anvil · in Discord',
    title: 'Slash commands',
    dek: 'Type `/` in your clan’s Discord and Anvil answers from the live site: the board, the standings, your own card, the weeklies, the coffer and anybody’s stats. This page is the full list, generated from the commands the bot actually registers, so it is never out of date.',
    facts: [
      { strong: 'Private', rest: 'answers only you can see, with a Share button' },
      { strong: 'Your language', rest: 'whatever your Discord is set to' },
      { strong: 'Read-only', rest: 'except /coffer add and remove' },
    ],
    footnote:
      'Setting the bot up in the first place is the [Discord guide](/guide/discord). This page is about using it.',

    using: {
      title: 'How a command works',
      body: [
        'Type `/` in any channel the bot can see and pick an Anvil command from the list. Discord then shows its options as boxes to fill in: press Tab or click one to add it. Options in `<angle brackets>` below are required; options in `[square brackets]` are optional and you can leave them out.',
        'Every answer is **private**: only you see it, so checking the board ten times a day bothers nobody. If it is worth showing the channel, press **Share to channel** under the answer. The shared copy is rebuilt at that moment, so standings shared later are the standings as they are then.',
      ],
      rows: [
        { term: 'Required', body: '`<amount>` — Discord will not send the command until it is filled in.' },
        { term: 'Optional', body: '`[member]` — leave it out and the command answers about you, your team or the whole clan.' },
        { term: 'A list', body: 'pick one of the values Discord offers; you can’t type your own.' },
        { term: 'Type to search', body: 'start typing and pick from the suggestions, such as boss names or your own accounts.' },
        { term: 'A member', body: 'pick someone from the server, the same as an @mention.' },
      ],
      note: {
        tag: 'Commands only work in your clan’s server',
        body: 'Every answer is about one clan, and a DM has no clan to answer about. That is why the commands don’t appear in DMs.',
      },
    },

    bingo: {
      title: 'Board commands: /bingo',
      intro:
        '`/bingo` is about one board. When several boards are live, **board** and **leaderboard** list them all; the rest answer about the board that is running, then the next one to start, then the one that just ended.',
    },

    clan: {
      title: 'Clan commands',
      intro:
        'These answer about the clan rather than a board, so they work whether or not a bingo is running: the weeklies, efficiency, the coffer, anybody’s stats, and the setup guides.',
    },

    options: {
      title: 'Options you’ll see everywhere',
      intro: 'A few options mean the same thing on every command that has them:',
      rows: [
        {
          term: '`member`',
          body: 'someone else in the server. Leave it out to ask about yourself. It finds their Anvil account through the Discord login they used on the site, so it only works for members who have signed in to Anvil once.',
        },
        {
          term: '`account`',
          body: 'which of that person’s OSRS accounts, for people with alts. Type to pick; leave it out for their main.',
        },
        {
          term: '`page`',
          body: 'a boss or activity, typed to search: `Zulrah`, `Theatre of Blood`, `Tempoross`. Leave it out for the overall view.',
        },
        {
          term: '`language`',
          body: 'answer this one time in a different language. By default you get the language your Discord is set to, or the clan’s chosen bot language.',
        },
        {
          term: '`amount`',
          body: 'gp the friendly way: `5m`, `2.5b`, `500k`, or a plain number like `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Who can use what',
      body: [
        'Anyone in the server can run every read-only command. What you see is what a member would see: a board whose tiles aren’t revealed yet stays hidden in Discord too, even for staff.',
        'Commands that answer about **you** (`/bingo me`, `/stats` with no member) need to know which Anvil account is yours. They find it through the Discord login you used on the site, so sign in to Anvil with Discord once and they work from then on.',
      ],
      rows: [
        { term: 'Everyone', body: 'every command except `/coffer add` and `/coffer remove`.' },
        {
          term: 'Treasurers, admins, owners',
          body: '`/coffer add` and `/coffer remove`. Checked against your role **on the Anvil site**, never your Discord role, because a rank in a chat server has never meant control of the clan’s money.',
        },
      ],
    },

    trouble: {
      title: 'When a command doesn’t work',
      intro: 'The usual causes, roughly in the order they happen:',
      rows: [
        {
          term: 'No Anvil commands in the list',
          body: 'the bot was invited without its commands — that is a separate permission, and older invite links only asked for one. An admin re-runs **Invite / re-invite the bot** from Admin → Discord → **Connection**. It doesn’t kick the bot or reset anything. Newly added commands can take up to an hour to appear.',
        },
        {
          term: '“The application did not respond”',
          body: 'Anvil was briefly unreachable, usually mid-update. Run it again a few seconds later.',
        },
        {
          term: '“Not on this board” about yourself',
          body: 'either you haven’t entered this board, or Anvil can’t match your Discord to your account. Sign in to the site with this Discord account and check your profile.',
        },
        {
          term: 'A member’s stats come back empty',
          body: 'they haven’t signed in to Anvil with Discord yet, or their account’s hiscores haven’t been read yet. Try again with the `account` option, or ask them to sign in once.',
        },
        {
          term: '`/coffer add` says you can’t',
          body: 'your role on the Anvil site isn’t treasurer, admin or owner, or this Discord isn’t the account you sign in to the site with.',
        },
      ],
    },

    labels: {
      options: 'Options',
      noOptions: 'No options — just run it.',
      example: 'Example',
      examples: 'Examples',
      required: 'required',
      optional: 'optional',
      choices: 'Choices',
      range: 'from {min} to {max}',
      kinds: {
        text: 'text',
        number: 'number',
        member: 'a member',
        choice: 'pick from a list',
        search: 'type to search',
        yesno: 'yes or no',
      },
    },

    // Keyed by the command path. Every registered command must have one (tests/discord-command-guide).
    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'The board running right now. Until the board is revealed, tile names stay hidden here too.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Team standings, with points or tiles depending on how the board scores.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'How this board scores (read off the event itself, so it is always right), then your clan’s own house rules.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'How to get in: sign-ups, the fee, and where your own sign-up stands.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'What’s coming next: a tile reveal, a mission, or a deadline.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Your team, your place, and the tiles credited to you.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'A short list of what the bot answers, inside Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'A team’s card: score, roster and recent tiles. Leave the name out for your own team.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Every active Skill of the Week, the top of each, and where you rank.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Every active Boss of the Week and its live standings.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'The clan’s efficiency leaderboard and your rank in it. Efficient hours played by default; pick hours bossed for bossing.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'The coffer’s balance, the top donors, and the latest movements.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Treasurers, admins and owners only. Records gp coming in; it is also posted to the coffer feed channel.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Treasurers, admins and owners only. Refuses to take the coffer below zero; record that on the coffer page if you mean it.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'One account at a glance: combat and total level, hours played and hours bossed, collection log count and personal bests.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Every skill’s level and XP.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Hours played and hours bossed, and which skills and bosses they come from.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Collection log progress overall, or one boss’s page.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Personal bests. Raids keep a time per mode and team size, so use `mode` and `size` to find the run you mean.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'How lucky the account has been across the drops Anvil tracks.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'The clan’s biggest collection logs.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'The clan’s driest and luckiest members.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'A setup guide inside Discord: the list of steps, or one step with a link straight to it on the site.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'One of the clan’s game guides (raids, bossing, money making…): start typing its name and pick it from the list.',
      },
    } as Record<string, { examples: string[]; tip: string }>,
  },

  // /guide/tiles. Only the page's frame lives here: the entries themselves come from the registry
  // the tiles read (lib/tileRequirements), in English, so the guide can never say something the
  // site doesn't enforce. Each entry's anchor is its registry id — the tile's "Why?" links.
  tiles: {
    metaTitle: 'Tile rules and limitations — Anvil',
    metaDescription:
      'What each kind of bingo tile needs from you (game settings, the RuneLite plugin, a synced collection log, a hiscores rank) and the limits of what it can track.',
    eyebrow: 'Anvil · for players',
    title: 'Tile rules and limitations',
    dek: 'Every tile lists what it needs from you and what it can’t do. This page explains each line; the **Why?** links on a tile land here.',
    needs: 'Needs',
    limit: 'Good to know',
    checked: 'The tile checks this for you',
    englishOnly: 'The rules below are in English for now, so they always match what the site actually does.',
  },

  // /guide/creators — the host's guide for a creator space (lib/creatorSpaces). Written for somebody
  // who has never used Anvil and has no clan: short sentences, the button names as they appear, and
  // nothing the code does not do. Limits and perks mirror lib/creatorCatalog.
  creators: {
    metaTitle: 'Host an OSRS bingo for your viewers — Anvil',
    metaDescription:
      'Run an Old School RuneScape bingo or tile race for your stream, no clan needed: make a space, share one link, choose who can join (Twitch, Kick, YouTube or Discord), and put the board on stream with OBS.',
    eyebrow: 'For streamers and creators',
    title: 'Hosting events for your viewers',
    dek: 'A creator space lets you run a bingo for your stream. You don’t need an in-game clan. You make one event, share one link, and your viewers join.',
    facts: [
      { strong: 'No clan', rest: 'needed' },
      { strong: 'Free', rest: 'to start' },
      { strong: 'One link', rest: 'for your chat' },
    ],

    what: {
      title: 'What a creator space is',
      body: [
        'It is your own page on Anvil, at `{apex}/c/your-name`. You run events there for your viewers.',
        'It is not a clan. There is no clan list, no ranks and no weekly competitions. Anyone who joins your event plays that event. Nothing else.',
        'Viewers sign in with Discord, add their RuneScape character, and press **Join**. The Anvil RuneLite plugin then counts their drops by itself.',
      ],
    },

    create: {
      title: 'Make your space',
      body: [
        'Go to [{apex}/host](/host) and sign in with Discord.',
        'Type a name for your space. Your channel name is a good pick. Your link is made from the name. Press **change link** if you want a different one.',
        'Press **Create my space**. You get one space per Discord account.',
      ],
    },

    first: {
      title: 'Make your first event',
      body: [
        'Right after you make your space, you land on **Create your first event**. Later, use **+ New event** at the top of **Your events**.',
        '**Name.** What your viewers will see.',
        '**What kind?** Pick a card. **Team bingo** is a 5×5 grid and Anvil splits players into teams for you. **Solo bingo** is the same grid, every player for themselves. **Team race** is tasks in order: the team furthest along wins.',
        '**Ready-made tiles** gives you a mix of easy to hard tasks you can change later. **Blank, I’ll write my own** starts empty.',
        '**Who can join?** Leave it on **Anyone**, or pick who may join. See step 5.',
        '**When?** Pick the start and end dates. Or leave it empty and start the event yourself when you are ready.',
        'Press **Create event**. Then press **Copy invite link**.',
      ],
    },

    share: {
      title: 'Share the link',
      body: [
        'Paste the invite link in your stream chat, your Discord or your socials. That link is all your viewers need.',
        'You can copy it again any time: **Your events** → **Copy invite link** next to the event.',
        'Want the bot to answer `!join` in chat with the link? See step 9.',
      ],
    },

    who: {
      title: 'Choose who can join',
      body: [
        'Every event starts open to **Anyone**. To keep it for your community, open the event’s **Settings** → **Viewers** → **Who can join?** and pick one or more choices. The same choices are on the first-event screen.',
        'If you pick more than one, **any one of them is enough**. A follower OR a server booster gets in.',
      ],
      intro: 'Each choice, and what a viewer has to do:',
      rows: [
        {
          term: 'Anyone',
          body: 'Anyone with the link joins straight away.',
        },
        {
          term: 'Twitch followers',
          body: 'The viewer presses **Link Twitch** on the event page and signs in with Twitch. Anvil checks they follow you.',
        },
        {
          term: 'Twitch subs',
          body: 'Same as followers, but they must be subscribed. Pick the lowest tier: **Tier 1 or higher**, **Tier 2 or higher** or **Tier 3**. Prime subs count as tier 1. Your channel must be a Twitch affiliate or partner.',
        },
        {
          term: 'Kick followers',
          body: 'Kick won’t tell apps who follows you, so Anvil counts people who follow _after_ you connect Kick. Followed before that? The viewer unfollows and follows again. Is your Kick chat followers-only? Turn on **My Kick chat is followers-only** in the **Kick channel** box. Then a viewer who types their Anvil code in your chat counts as a follower.',
        },
        {
          term: 'Kick subs',
          body: 'Subs Anvil saw after you connected Kick count by themselves. Anyone else presses **Get Kick code** and types the code (it looks like `ANVIL-7F3K9Q`) in your Kick chat, and Anvil sees their sub badge. Kick has no sub tiers.',
        },
        {
          term: 'YouTube subscribers',
          body: 'The viewer presses **Check my YouTube subscription** and signs in with Google. Their subscriptions must be public on YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'The viewer types their Anvil code in your YouTube live chat. So members can only join **while you are live**.',
        },
        {
          term: 'Discord role',
          body: 'People with a role you pick in your Discord server (up to 5 roles). Connect your server first: **Discord (optional)** in the menu.',
        },
        {
          term: 'Server boosters',
          body: 'People boosting your Discord server. Needs your server connected too.',
        },
      ],
      note: {
        tag: 'Good to know',
        body: 'Connect your channel first (step 7), or the Twitch, Kick and YouTube choices stay greyed out. One Twitch, Kick or YouTube account can get only one player into each event. Your staff, and people you invite by name, skip the checks.',
      },
    },

    approve: {
      title: 'Say yes to each player (optional)',
      body: [
        'Want to pick who plays? Open the event’s **Settings** → **Viewers** → **Who can enter** and choose **Ask me about everyone**. Press **Save changes**.',
        'Now viewers press **Ask to join** instead of **Join**. They still have to pass your **Who can join?** choices first.',
        'Their requests show on **Your events** as **N waiting for you**. Click it, or open the event’s **Sign-ups** tab. The list at the top is called **Waiting for your yes**. Accept or turn down each one.',
      ],
    },

    channels: {
      title: 'Connect your Twitch, Kick or YouTube',
      body: [
        'Open **Settings** in the menu. In the **Twitch channel**, **YouTube channel** or **Kick channel** box, press **Connect Twitch**, **Connect YouTube** or **Connect Kick**, and sign in as your channel.',
        'Each channel you connect shows on your page as a **verified** link. You can’t type a link in by hand: signing in is how Anvil knows the channel is yours.',
        'A channel can be connected to one place on Anvil. If it is already on another space or clan you run, Anvil asks if you want to move it.',
      ],
    },

    overlay: {
      title: 'Put the board on stream (OBS)',
      body: [
        'On **Your events**, press **Stream overlay** next to the event, then **Make overlay links**.',
        'You get three links. **Standings**: the top teams and how far along they are. **Feed**: the latest drops and finished tiles. **Board**: the board, with finished tiles marked.',
        'Pick a **Text size** (S, M, L or XL) before you copy. Then press **Copy** next to the one you want.',
      ],
      stepsTitle: 'Add it to OBS',
      steps: [
        'In OBS, under **Sources**, press **+** and pick **Browser**.',
        'Paste the link in **URL**.',
        'Set a size, for example 800 × 600. Leave **Custom CSS** empty.',
        'Press **OK**. It updates by itself every few seconds.',
      ],
      tipsTag: 'Good to know',
      tips: [
        'Add `&limit=10`, `&title=0` or `&align=right` to the end of a link to change it.',
        'The overlay shows what your public event page shows. Hidden standings and hidden tiles stay hidden on stream too.',
        '**Reset link** makes new links and stops the old ones. Use it if a link leaks. You have to paste the new links into OBS again.',
        'A small “Powered by Anvil” badge (the Anvil logo and anvilosrs.com) sits in the corner. On the Gold plan you can hide it in **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join in your chat',
      body: [
        'Open **Settings** → **!join in Twitch chat** and turn it on.',
        'When a viewer types `!join`, the Anvil bot (Anvil_OSRS) replies with the link to your open event. It answers once every 30 seconds at most, however many people type it.',
        'It only answers in a channel you connected in step 7. For Kick, turn on **!join in Kick chat** in the **Kick channel** box.',
        'No event open? It says so: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'If your chat blocks links (Twitch’s **Block hyperlinks** or AutoMod), the bot’s reply gets held. Type `/vip anvil_osrs` or `/mod anvil_osrs` in your chat once so its link gets through.',
        'Working on an event? **Space settings** in the event’s menu takes you back to these switches. So does **Switch it on in your settings** under **Who can join?**.',
      ],
    },

    page: {
      title: 'Make your page yours',
      body: [
        'Your page is what people see at `{apex}/c/your-name`, along with your events. Open **Settings** → **Your page**. Each part has its own save button.',
      ],
      items: [
        '**Bio.** A few lines about you and your streams. Links that start with `https://` can be clicked.',
        '**Logo and banner.** Press **Upload a logo** or **Upload a banner**. The banner goes across the top of your page, so make it wide (3:1, for example 1500 × 500). PNG, JPEG, GIF or WebP. Both may be animated.',
        '**Panels.** Up to 8 cards under your events, like the panels under a Twitch channel. Press **+ Add a panel** and give it a title and some text. A picture and a link are optional. Use the arrows to change the order.',
        '**Schedule.** When you usually go live, in your own time zone. Visitors see each time on their own clock.',
        '**Featured.** One clip pinned to the top of your page. Pick one of your stream highlights (next step), or paste a clip link from Twitch, YouTube, Kick or Medal.',
        'Press **Preview your page** to see it the way visitors do.',
      ],
      note: {
        tag: 'Jagex’s rules',
        body: 'Everything on your page must follow Jagex’s rules: no gold or account selling, no gambling, no bots and no private servers. Anvil checks your words and links when you save. If Anvil staff hide your page after a report, your settings say so. Ask on the Anvil Discord if you think it’s a mistake.',
      },
    },

    highlights: {
      title: 'Stream highlights',
      body: [
        'With your Twitch or YouTube channel connected, Anvil catches the big moments of your events while you are live. The switches are in **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** is on as soon as you connect. While you are live on Twitch, Anvil makes a clip when one of your events starts, when a team clears the board or wins, and when your own character gets a rare drop or a pet. On YouTube it saves a link to that second of your stream instead. Kick has no highlights yet.',
        'The clips show under **Highlights** on the event page and on your page. You can pin one as your **Featured** clip (step 10).',
        '**Let Anvil feature clips from my events in its own promotion** stays off until you turn it on. Then Anvil may share a clip on its own pages and socials, and always credits you.',
        'Your players can clip their own big moments too. They turn on **Clip my stream when I hit a big moment** under their Twitch account in **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Get listed on Anvil',
      body: [
        'Your space is unlisted when you make it. Only people with your link can find it.',
        'Open **Settings** → **Advertise on Anvil** and turn it on. Your space shows in Anvil’s creators list, and your new events show on `{apex}/events`.',
        'To list one event only, open its **Settings** → **Viewers** → **List on Anvil**. It shows while the event is upcoming or live.',
        'An event with no dates shows under **Open to join**, marked “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Plans and limits',
      body: [
        'Your plan sets how many players can be in your events at once. Events whose dates overlap share that number; events on different dates get it each. A player in two overlapping events counts twice. Everything else is the same on every plan: the board, the plugin tracking, the overlay and Discord.',
        'Your plan card is on **Your events**. To compare plans, see [pricing](/pricing#creators). To change or cancel what you pay, go to [your billing page](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Up to 50 players at once across your events. One event at a time. Discord role and booster checks.' },
        { term: 'Bronze', body: 'Up to 150 players at once across your events. Twitch, Kick and YouTube checks.' },
        { term: 'Silver', body: 'Up to 300 players at once across your events. More than one event at a time. `!join` in chat. Shown first in the list.' },
        { term: 'Gold', body: 'Up to 1,000 players at once across your events. Hide the Anvil mark on your overlay.' },
        { term: 'Partner', body: 'No player cap. Set up with Anvil directly — get in touch.' },
      ],
      note: {
        tag: 'Right now',
        body: 'Everyone still gets in while Anvil is growing, even past your plan’s numbers. The limits start later, with notice. Your plan card shows how close you are.',
      },
    },

    faq: {
      title: 'Questions',
      intro: 'The ones streamers ask most:',
      rows: [
        {
          term: 'Do my viewers need a clan?',
          body: 'No. They need a Discord account and an OSRS character. Send them the [viewer guide]({joiningGuide}).',
        },
        {
          term: 'Do they need the RuneLite plugin?',
          body: 'For drops and kills, yes. The plugin sends them in by itself. A few tiles read the hiscores instead.',
        },
        {
          term: 'A viewer says “The host’s Twitch connection isn’t working”.',
          body: 'Twitch stopped accepting your connection. Open **Settings** and press **Reconnect Twitch**. The same goes for Kick and YouTube.',
        },
        {
          term: 'Can somebody else help me run it?',
          body: 'Yes. Open **Players** → **Staff & roles**, add them, and pick what each of them can do.',
        },
        {
          term: 'I run an in-game clan too.',
          body: 'Then you may not need a space. A public clan can turn on **Streaming** instead. See [streaming for clans]({streamingGuide}).',
        },
        {
          term: 'Can I make a second space?',
          body: 'One space per Discord account for now. Get in touch if you need another.',
        },
        {
          term: 'Where are my space’s settings?',
          body: 'Press **Settings** in the menu. From inside an event, press **Space settings** in the event’s menu.',
        },
        {
          term: 'What does the **Report** button on my page do?',
          body: 'Anyone signed in can report your page, a panel, an event or a highlight to Anvil staff. Reports go to staff only. If staff hide your bio, panels, schedule or featured clip, your settings say so.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — for a viewer who clicked a streamer's link. Assumes nothing:
  // no clan, no Anvil account, maybe no RuneLite plugin. The words on the buttons are verbatim from
  // app/events/[eventId]/EnterEvent, YoutubeGate and components/KickLinkCode.
  joiningStream: {
    metaTitle: 'Joining a streamer’s OSRS bingo — Anvil',
    metaDescription:
      'Got a link from a streamer? Sign in with Discord, add your OSRS character, press Join. What to do for follower or sub-only events on Twitch, Kick or YouTube, and how your drops count.',
    eyebrow: 'For viewers',
    title: 'Joining a streamer’s event',
    dek: 'A streamer shared a link. Here is how to get on the board. You don’t need a clan.',
    facts: [
      { strong: '~2 min', rest: 'to join' },
      { strong: 'No clan', rest: 'needed' },
    ],

    join: {
      title: 'Join in four steps',
      body: [
        '**Open the link** the streamer shared. Or type `!join` in their chat and the bot posts it.',
        '**Sign in with Discord.** That is your Anvil account. Nothing to fill in.',
        '**Add your character.** Press **Add my character** and type your RuneScape name. If it says **Prove it’s mine**, follow the steps on your profile. The [plugin guide]({pluginGuide}) shows how.',
        '**Press Join.** Pick your character if you have more than one. You see **You’re in!** when it worked.',
      ],
    },

    gated: {
      title: 'Events for followers or subs',
      body: [
        'Some events are only for the streamer’s community. The join card says who, for example “Open to followers of somename on Twitch”.',
        'Press **Join** anyway. If you are not let in yet, the card lists what to do. Do one of them, then press **Join** again.',
      ],
      intro: 'What to do for each kind:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Press **Link Twitch** and sign in with Twitch. Anvil asks for no permissions. Then press **Join** again.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Press **Get Kick code**. Type the code (like `ANVIL-7F3K9Q`) in the streamer’s Kick chat within 10 minutes. Each code works once. Then press **Join** again.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Press **Check my YouTube subscription** and sign in with Google. Pick the account you watch with. Your subscriptions must be public in YouTube’s privacy settings.',
        },
        {
          term: 'YouTube member',
          body: 'Press **Link my YouTube account**, then type your code in the YouTube live chat and press **check the chat**. This only works while the streamer is live.',
        },
        {
          term: 'Discord role or booster',
          body: 'Join the streamer’s Discord server and get the role (or boost it). Anvil checks with the Discord account you signed in with.',
        },
      ],
      note: {
        tag: 'Approval',
        body: 'Some streamers say yes to each player. Then the button says **Ask to join**, and you see **Waiting for the host** until they answer.',
      },
    },

    plugin: {
      title: 'Install the Anvil plugin',
      body: [
        'Your drops and kills count through the Anvil plugin for RuneLite. Install it from the Plugin Hub and sign in with Discord from its side panel.',
        'The [plugin guide]({pluginGuide}) walks you through it in about three minutes.',
      ],
    },

    play: {
      title: 'Play',
      body: [
        'That’s it. Play as normal. When you get a drop or a kill the board needs, the plugin sends it in by itself.',
        'Open the event link any time to see the board and the standings. You are playing this one event only: you are not joining a clan.',
      ],
    },

    accounts: {
      title: 'Your connected accounts',
      body: [
        'The Twitch, YouTube and Kick accounts you linked are in [Settings → Connected accounts](/settings/connections). You can link them there before you join, too.',
        'Unlink one any time. Events you already joined keep you. A gated event you join later asks you to link again.',
        'Linked Twitch, YouTube and Kick accounts show on your profile with a verified tick: you proved they are yours. Turn off **Show on my profile** to hide one. A Medal link is different. You paste it yourself, so it has no tick.',
        'Stream on Twitch yourself? Turn on **Clip my stream when I hit a big moment** under your Twitch account. While you are live in a streamer’s event, Anvil clips your rare drops, pets and finished tiles.',
      ],
    },

    faq: {
      title: 'Questions',
      intro: 'When something says no:',
      rows: [
        {
          term: '“This event is full”',
          body: 'There’s no room for more players. Only the streamer can make room — let them know.',
        },
        {
          term: 'I’m subbed but it won’t let me in.',
          body: 'Check you linked the same account you subscribe with. On Twitch, look at **Your Twitch** on the join card. On Kick, type a fresh code in their chat: Anvil reads the sub badge on that message. On YouTube, make your subscriptions public and check again.',
        },
        {
          term: 'I followed on Kick but it says I didn’t.',
          body: 'Anvil only sees follows made after the streamer connected Kick. Unfollow and follow again, then press **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'One Twitch (or Kick, or YouTube) account gets one player in. Somebody else already joined with it.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube or Discord had a hiccup. Wait a minute and press **Join** again.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'This one is on the streamer. Tell them to reconnect their channel on Anvil.',
        },
        {
          term: 'My drops aren’t showing.',
          body: 'Check the plugin is installed and signed in, and that you joined with the character you are playing. See the [plugin guide]({pluginGuide}).',
        },
        {
          term: 'Where can I find more events like this?',
          body: '[The events page](/events) lists events anyone can join, including streamers’ events that are open right now.',
        },
        {
          term: 'Something on a streamer’s page breaks the rules.',
          body: 'Press **Report** on the page, the event or the highlight. Pick what’s wrong and press **Send**. It goes to Anvil staff only. The streamer is never told who reported it.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — a public clan turning on Streaming (lib/streamingSwitch). Only what
  // is different from a creator space; the shared tools point at the creators guide.
  streamingClans: {
    metaTitle: 'Streaming your clan’s events — Anvil',
    metaDescription:
      'Let your stream’s viewers join one of your clan’s OSRS events without joining the clan: turn on Streaming, open an event to viewers, and choose which viewers get in.',
    eyebrow: 'For clans that stream',
    title: 'Streaming for clans',
    dek: 'Your clan streams its events? Let viewers play one event without joining your clan.',

    on: {
      title: 'Turn on Streaming',
      body: [
        'Go to Admin → **Clan settings** → **Profile** and turn on **Streaming**.',
        'Only a public clan can stream. Viewers have to open your event page, and a private clan hides it from them. A clan with Streaming on can’t go private until you turn it off.',
        'Once it is on, connect your Twitch, YouTube or Kick channel right below it.',
      ],
    },

    event: {
      title: 'Open an event to viewers',
      body: [
        'Every event stays **Members only** until you say otherwise. That is how it worked before.',
        'Open the event’s **Settings** → **Entry & co-hosts** → **Who can join?** and pick **Members and viewers**. Then choose **Which viewers?**: anyone, or followers, subs, a Discord role and so on. Press **Save**.',
        'These checks are for viewers only. Your clan members always get in, as before.',
      ],
    },

    viewers: {
      title: 'What viewers are',
      body: [
        'A viewer who joins is an **event player**. They play that one event.',
        'They are not clan members and not guests. They never land on your clan list, and they get no rank.',
        'You can see everyone who joined this way under **People** → **Past viewers**.',
        'A regular you want to keep? **Make guest** on their row turns them into a clan guest, so they can join any of your events open to guests, not just this one. **Make a guest a viewer again** turns a guest back into a viewer of one event.',
      ],
    },

    tools: {
      title: 'Your stream tools',
      body: [
        'The streamer tools work the same as in a creator space: verified channel links, **Who can join?** checks, the OBS overlay and `!join` in chat.',
        'The overlay links for a clan event are in the event’s **Settings** → **Stream** → **Stream overlay**. `!join` and the overlay mark are under **Clan settings** → **Profile** → **Streaming**.',
        'The [creator guide]({creatorsGuide}) explains each one step by step.',
        'Stream highlights work here too: with Twitch or YouTube connected, Anvil clips the big moments of events open to viewers. `!join` in Kick chat has its own switch in the **Kick channel** box.',
      ],
    },

    faq: {
      title: 'Questions',
      intro: 'The short answers:',
      rows: [
        {
          term: 'Do viewers count toward our member limit?',
          body: 'No. They are event players, not members. The streamer limits count players at once across the events you run (see the [creator guide]({creatorsGuide})).',
        },
        {
          term: 'Will `!join` send people to a members-only event?',
          body: 'No. It only points at an event open to viewers.',
        },
        {
          term: 'Should I make a creator space instead?',
          body: 'Only if you have no clan. A space is for streamers without an in-game clan.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Your people: roster, guests and who can join — Anvil',
    metaDescription:
      'Where an Anvil clan’s roster comes from, what Members, Guests, Roster only, Departed and Quiet mean, how join requests and Needs review work, the three Who can join settings, and removing or banning someone.',
    eyebrow: 'Anvil · for clan staff',
    title: 'Your people: roster, guests and who can join',
    dek: 'Everyone under Admin → **People** got there one of four ways: the in-game clan list named them, staff approved them, the clan lets anyone in, or somebody added them by hand. This is how each one works, what the Roster tab is telling you, and what to check when someone is in the wrong place.',
    facts: [
      { strong: 'In-game roster', rest: 'the only automatic way to become a member' },
      { strong: 'Signing in', rest: 'never puts anyone on the roster' },
      { strong: 'Two queues', rest: 'on two different tabs' },
    ],
    footnote:
      'Everything here is under Admin → **People**. Roster and Needs review are moderator work. **Who can join** and **Staff & roles** are admin-only tabs. For who can do what across the whole admin area, see [Staff roles: who can do what]({staffGuide}).',

    roster: {
      title: 'Where the roster comes from',
      body: [
        'The roster is your in-game clan list, copied onto the site. An admin sends it from RuneLite with the Anvil plugin: press the **Anvil** button in the clan window’s title bar, or **Sync roster** in the plugin’s side panel. Everyone on the list arrives as a **member**, with their in-game rank. Only someone with the Admin role on the site can send it. Anyone else is told so in game.',
        'A sync is the only thing that makes someone a member by itself. Someone who leaves the clan in game is marked as departed by the next sync, and someone who rejoins comes back on the sync after that. Their history stays either way.',
        'Every other seat is a **guest** seat: someone who plays in your events without being in your in-game clan. Guests are tracked and can enter events. They are not members, and they do not count towards your plan.',
      ],
      note: {
        tag: 'Signing in never puts anyone on the roster',
        body: 'Signing in with Discord, linking a character or playing with the plugin does not give anyone a seat. If the plugin sees someone whose in-game clan is yours but who is not on the roster yet, it asks for them (see step 3). Anyone else just has an Anvil account with no clan. That is what stops a stranger joining your clan by typing its name.',
      },
    },

    filters: {
      title: 'Reading the Roster tab',
      intro:
        'The bar at the top splits the roster into **Members**, **Guests** and **Departed**. Click a segment to filter by it. The chips under it cut the list further:',
      rows: [
        {
          term: 'Active',
          body: 'members still on the roster. Guests and departed people are left out.',
        },
        {
          term: 'Quiet 7d+',
          body: 'members the plugin has not seen play for seven days or more. Someone who has never used the plugin is not in here, because there is nothing to judge them by. Their **Last played** reads **no plugin data** instead.',
        },
        {
          term: 'Guests',
          body: 'current guest seats: people who play in your events but are not in your in-game clan.',
        },
        {
          term: 'Roster only',
          body: 'current members and guests with no site account behind them yet. Normal for anyone who has never signed in with Discord. They stay on the roster; they sign in and link the character when they want to sign up for something.',
        },
        {
          term: 'Departed',
          body: 'people who left in game, or whom staff removed. Their results and history stay.',
        },
        {
          term: 'All',
          body: 'everyone above.',
        },
      ],
      outro:
        'The **Source** column says how each seat started: **Clan sync**, **Added manually**, or **Applied or self-reported**. **Last played** comes from the plugin, not from the roster sync.',
      note: {
        tag: 'Rank and role are different things',
        body: 'The two dropdowns beside the chips filter by in-game rank and by site role. The rank is whatever the game reports. The site role is what an admin sets under **Staff & roles**. One never sets the other.',
      },
    },

    review: {
      title: 'Join requests and Needs review',
      intro: 'Two kinds of people wait for a yes, and they wait on different tabs.',
      rows: [
        {
          term: 'Asking to join',
          body: 'at the top of the **Roster** tab, shown only while someone is waiting. A request comes from the site (they pressed **Apply** on your clan page, or tried to enter one of your events) or from the plugin (it saw them playing in your in-game clan before the roster had them). Each row says which, and whether they are a member of another clan. **Approve** gives them a guest seat. **Decline** tells them, by Discord DM when your bot can reach them. Tick several to answer them at once.',
        },
        {
          term: 'Awaiting confirmation',
          body: 'on **Needs review**. People who linked one of your roster characters by gaining XP on it, by asking, or by playing it with the plugin. They can already play while they wait. Check the Discord name matches the character, then press **Approve**. **Not our member** takes the character off your list and leaves it with its owner. **Report to Anvil** is for a character that is not theirs.',
        },
        {
          term: 'Claim requests',
          body: 'also on **Needs review**. Someone played a character that is already an established member here, so Anvil would not link it to them by itself. If you know it is them, press **Yes, that’s them**; if not, **Not them**. A character that has only ever been in your clan is linked straight away. One that is also in another clan goes to Anvil to decide.',
        },
      ],
      note: {
        tag: 'The badge does not count join requests',
        body: 'The number on **Needs review**, and on **People** in the sidebar, counts Awaiting confirmation and Claim requests. Join requests are not in it, so look at the top of the Roster tab as well.',
      },
    },

    policy: {
      title: 'Who can join',
      intro:
        'Admin → People → **Who can join** holds three settings, and only admins see the tab. The one that decides how outsiders get in is **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'the default. Someone who applies, or whom the plugin picks up from your in-game clan, waits as a join request until staff approve them. Nobody gets a seat without a yes.',
        },
        {
          term: 'Let anyone in',
          body: 'asking is enough. They get a guest seat straight away and no request is filed. Good for an open event, noisy otherwise.',
        },
        {
          term: 'No guests',
          body: 'only your own members play. Players from other clans cannot enter your events or ask to join, and the plugin files nothing for them.',
        },
      ],
      outro:
        '**Who can see this clan** is **Anyone** (a board link works for whoever you send it to) or **Members only** (everyone else sees the clan’s card and an invitation to apply). **List in the Clan Hall** puts the clan on the public list of clans. Turning it off does not make the clan private.',
      note: {
        tag: 'None of these touch your members',
        body: 'The roster sync seats members whatever these say. Your own staff are never treated as guests either: a staff member’s character gets a member seat without a request.',
      },
    },

    manual: {
      title: 'Adding someone by hand',
      body: [
        'Roster → **+ Add Manually** puts one character on the roster. Fill in the **RSN**, and optionally their **Discord ID** and **Rank**. Tick **Add as guest** for someone who is not in your in-game clan. Moderators and admins can both do this.',
        'Use it for someone the sync cannot see yet, such as a recruit who joined after the last sync. The seat is marked **Added manually**, and the sync treats it as your decision: if you later remove a seat you added by hand, the next sync does not bring it back.',
        'Adding someone to the roster does not sign them up for an event. For that, open the event’s **Sign-ups** tab and use **Add member**. That one is admin-only.',
      ],
    },

    removing: {
      title: 'Removing and banning',
      intro: 'Each roster row has an actions menu. These do different things:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'they stay on the list and can still be entered into events, but stop counting as a member. **Promote to member** reverses it.',
        },
        {
          term: 'Remove from roster',
          body: 'marks them as departed. Their history and results stay. If they are still in your in-game clan, the next roster sync can add them back.',
        },
        {
          term: 'Not our member',
          body: 'on Needs review, for a character someone linked that is not in your clan. It comes off your list and stays with its owner.',
        },
        {
          term: 'Ban from this clan',
          body: 'ends every seat the person has here, alts included, removes any staff role and board jobs they hold in this clan, and stops them coming back: the roster sync, the plugin and join requests all refuse them until the ban is lifted. Their Anvil account and their other clans are not touched. Admins only, for someone with a site account and a role below admin, from the row menu, from **Staff & roles**, or for several people at once. Lifting a ban does not put them back; they rejoin in game or you add them.',
        },
      ],
      note: {
        tag: 'A ban also removes their staff role',
        body: 'Banning someone ends their seats and takes away their staff role and any board editor or board treasurer jobs on this clan’s boards. Lifting the ban does not give those back: set the role again on Staff & roles if they should have it.',
      },
    },

    faq: {
      title: 'Common questions',
      intro: 'What usually explains someone in the wrong place.',
      rows: [
        {
          term: 'Someone in the clan is missing',
          body: 'Run a roster sync first: the list only changes when an admin sends it. Then check **Departed**, in case they were removed, and whether they are banned; the sync skips anyone banned here and reports who it skipped. If the clan is over its plan and the grace period has ended, a sync stops adding new members until you upgrade or trim the roster.',
        },
        {
          term: 'Someone shows as a guest but is in the clan',
          body: 'Usually they are still a member of another clan on Anvil. A character can be a member of one clan at a time, so the sync seats them here as a guest and makes them a member on the first sync after they leave the other clan. Otherwise they came in through a join request, or someone demoted them or added them as a guest. Run a sync, or use **Promote to member**.',
        },
        {
          term: 'Someone signed in but is not on the roster',
          body: 'That is expected. Signing in creates an Anvil account, not a seat. They appear when the sync lists them, when you approve their request, or when you add them by hand.',
        },
        {
          term: 'Names like #Player1234',
          body: 'RuneLite shows a placeholder like that for a moment while a player logs in, and for clan members it cannot name. Anvil ignores those names now: the sync skips them, the plugin files no request for them, and old requests under one are hidden. If one is still on your roster, it is an old row. **Remove from roster** clears it.',
        },
        {
          term: 'A removed member keeps coming back',
          body: 'Removing someone does not change the in-game clan, so the next sync adds them back while the game still lists them. Remove them in game, or ban them here.',
        },
        {
          term: 'A moderator cannot see Who can join',
          body: 'It is an admin-only tab, like Staff & roles. See [Staff roles: who can do what]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Staff roles: who can do what — Anvil',
    metaDescription:
      'The clan roles on Anvil (owner, admin, treasurer, moderator, member), what each one can reach, how to make someone a moderator, who can grant which role, and the jobs that cover one event.',
    eyebrow: 'Anvil · for owners and admins',
    title: 'Staff roles: who can do what',
    dek: 'Five roles, set per clan under Admin → People → **Staff & roles**. A role here gives nothing in any other clan, and nobody can hand out a role at or above their own. This page is the whole map: what each role reaches, how to give one out, and the jobs that cover a single event.',
    facts: [
      { strong: 'Per clan', rest: 'a role here means nothing elsewhere' },
      { strong: 'Below your own', rest: 'is all you can grant' },
      { strong: 'Owner', rest: 'moves only by transfer' },
    ],
    footnote:
      'Roles are checked again on every page load, so a change applies on the person’s next click; they do not need to sign out. For the roster itself, see [Your people]({peopleGuide}). For a moderator’s day, see [On the rota]({moderatorGuide}).',

    roles: {
      title: 'The roles',
      intro: 'Everyone who signs in with Discord starts as a plain **Member**. Above that:',
      rows: [
        {
          term: 'Owner',
          body: 'the person who created the clan, until they hand it on. Everything an admin can do, plus transferring ownership and deleting the clan. There is exactly one, and nobody can demote, remove or ban them.',
        },
        {
          term: 'Admin',
          body: 'everything except handing over the clan: events and boards, settings, Discord, staff and the clan’s money.',
        },
        {
          term: 'Treasurer',
          body: 'fees, the coffer and prizes, on top of everything a moderator does: the roster, proofs, competitions, the Schedule and Needs review.',
        },
        {
          term: 'Moderator',
          body: 'newcomers, the roster, proofs, weekly competitions and clan events. No events or boards, no settings, no staff and no money.',
        },
        {
          term: 'Member',
          body: 'no staff job. Plays, signs up, and can report a donation to the coffer.',
        },
      ],
      outro:
        'Two boxes sit under the role on Staff & roles, for anyone below admin, plain members included. **Can build bingo boards** opens the Tiles tab of every board and the Task library. **Can write guides** lets them write the clan’s guides. Admins have both already.',
    },

    assign: {
      title: 'Making someone a moderator',
      intro:
        'They need to have signed in with Discord and linked a character that is on your roster, as a member or a guest. Then:',
      steps: [
        'Open Admin → **People** → **Staff & roles**.',
        'The list opens on **Staff**. Switch to **Members** or **All accounts** and search for their name.',
        'In the **Role** column, pick **Moderator: newcomers, roster, sign-ups, proofs**. It saves as soon as you pick it.',
        'If they should build boards too, tick **Can build bingo boards**.',
      ],
      outro:
        'Not signed in yet? Find their character on the **Roster** tab, open its menu and choose **Set role**. That saves the role against the character. They get it the first time they sign in and link it, or, if they are waiting on Needs review, when a moderator approves them.',
      note: {
        tag: 'Taking it away',
        body: 'Set the role back to **Member**. Changing someone’s role also removes any board jobs they had on this clan’s boards (see step 5), so add those again afterwards if they should keep them.',
      },
    },

    who: {
      title: 'Who can grant what',
      intro:
        'Staff & roles is an admin-only tab, and every change on it is checked against two rules: you can only give a role below your own, and you can only change someone whose role is below your own.',
      rows: [
        {
          term: 'The owner',
          body: 'can give or take away Admin, Treasurer and Moderator.',
        },
        {
          term: 'An admin',
          body: 'can give or take away Treasurer and Moderator. An admin cannot make another admin, change another admin, or change their own role.',
        },
        {
          term: 'Treasurers and moderators',
          body: 'cannot change anyone’s role. The tab is hidden from them.',
        },
        {
          term: 'Nobody',
          body: 'can change the owner’s role, remove them or ban them. The clan also always keeps one admin: the last one cannot be demoted.',
        },
      ],
      note: {
        tag: 'Handing over the clan',
        body: 'Only the owner can, and only to someone who is already an admin: that admin’s row gets a **Make owner** action. For safety it takes 3 days, like changing a bank PIN: a banner on every admin page says when it happens, you can **Cancel** until then, they can **Decline**, and Anvil staff are told and can stop it. When the 3 days are up they become the owner and you become an ordinary admin. Only the new owner can transfer it back.',
      },
    },

    table: {
      title: 'Who can do what',
      intro:
        'What each role reaches in the admin area. “If ticked” means the **Can build bingo boards** or **Can write guides** box on Staff & roles.',
      areaLabel: 'Area',
      columns: ['Owner', 'Admin', 'Treasurer', 'Moderator', 'Member'],
      rows: [
        { area: 'Dashboard', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Events: create, edit, teams, sign-ups, launch', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Board tiles and the Task library', cells: ['Yes', 'Yes', 'If ticked', 'If ticked', 'If ticked'] },
        { area: 'Proofs to check', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Weekly competitions', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Clan events', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Schedule', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Roster: view, add, remove', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Join requests and Needs review', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Ban someone from the clan', cells: ['Yes', 'Below admin', 'No', 'No', 'No'] },
        { area: 'Staff & roles', cells: ['Yes', 'Below admin', 'No', 'No', 'No'] },
        { area: 'Who can join', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Coffer and prize ladders', cells: ['Yes', 'Yes', 'Yes', 'No', 'No'] },
        { area: 'Fees: mark collected', cells: ['Yes', 'Yes', 'Yes', 'No', 'No'] },
        { area: 'Fees: confirm (the second signature)', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Discord settings', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Post to Discord', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Clan settings: Profile, Features, Rules & scoring, Boosts', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Plan and billing', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Guides', cells: ['Write', 'Write', 'Read; write if ticked', 'Read; write if ticked', 'Write if ticked'] },
        { area: 'Activity log', cells: ['Yes', 'Yes', 'Yes', 'Yes', 'No'] },
        { area: 'Sync the roster from RuneLite', cells: ['Yes', 'Yes', 'No', 'No', 'No'] },
        { area: 'Transfer ownership, delete the clan', cells: ['Yes', 'No', 'No', 'No', 'No'] },
      ],
      note: {
        tag: 'Hidden is not the same as allowed',
        body: 'The sidebar only lists what your role can use, but the check that counts runs on the server. Typing the address of a page your role cannot use sends you back to the dashboard, and the action behind it is refused.',
      },
    },

    event: {
      title: 'Jobs on one event',
      intro:
        'Some jobs cover a single event instead of the clan. An admin gives them on the event itself, and they reach that event and nothing else, so they are safe to give to a plain member.',
      rows: [
        {
          term: 'Board editor',
          body: 'builds and edits that board’s tiles. Given under the event’s **Settings** → **Staff** → **Board staff**, or with **Boards…** in a person’s actions on Staff & roles. A member given one sees only their boards in the admin area.',
        },
        {
          term: 'Board treasurer',
          body: 'collects that board’s fees and runs its payouts, without reaching the clan coffer. In the admin area they see only their own boards, and only each board’s **Sign-ups** and **Prizes** tabs. Given under **Board staff** as well.',
        },
        {
          term: 'Team staff',
          body: 'runs one team: its roster, its submissions and proof, and marking its players’ fees paid. They cannot touch another team, edit the board, make draft picks or sub anyone out once the event is live. Added on the team’s page under **Team staff**. This is how a visiting clan’s moderator runs their half of a clan-v-clan.',
        },
        {
          term: 'Captain',
          body: 'named by the host for one team. Everything team staff can do, plus making the team’s draft picks.',
        },
      ],
      note: {
        tag: 'A clan role replaces board jobs',
        body: 'Giving someone a clan role, or changing it, removes their board editor and board treasurer jobs on this clan’s boards. Staff & roles warns you first when board jobs are all they have. Add them again afterwards if they should keep them.',
      },
    },

    safety: {
      title: 'Keeping it safe',
      intro: 'These hold however the roles are set.',
      rows: [
        {
          term: 'The owner is protected',
          body: 'their row on Staff & roles reads **Protected**. Their role cannot be changed and they cannot be banned. Ownership only moves when they transfer it.',
        },
        {
          term: 'Admins cannot remove each other',
          body: 'an admin can neither demote nor ban another admin, one at a time or several at once. When two admins disagree, the owner decides. A ban also takes away the person’s staff role and board jobs in this clan.',
        },
        {
          term: 'Money takes two people',
          body: 'when a fee needs confirming, the confirmation has to come from an admin other than whoever marked it collected. How many confirmations a fee needs, from zero to five, is set under **Clan settings** → **Rules & scoring** → **Fee sign-off**. An admin who is the only one handling money can still force a fee closed, with a separate button.',
        },
        {
          term: 'What a moderator cannot do',
          body: 'create or edit events, change settings or Discord, give anyone a role (themselves included), or touch the clan’s money.',
        },
        {
          term: 'It is all on the record',
          body: 'role changes, ownership transfers, bans and answered join requests are written to the **Activity log**, which every staff member can read.',
        },
        {
          term: 'Discord roles are separate',
          body: 'Anvil’s role sync matches Discord roles to **in-game ranks**, not to site roles. Making someone a moderator here gives them nothing in your Discord server, and a moderator role you gave out in Discord by hand is left alone. The one bot command that changes anything, adding to the coffer with `/coffer`, checks the site role: treasurer, admin or owner.',
        },
      ],
    },

    log: {
      title: 'The activity log',
      body: [
        '**Activity log** in the admin menu lists the newest 200 changes, and every staff member can read it: joins, leaves, renames and verifications, ownership transfers, captains made and removed, sign-ups approved or turned down, fees confirmed, features switched and settings changed. **Filter by event type** narrows it.',
        'It is also where duplicates get tidied. **Merge two members** folds a duplicate into the real one, and **Suspected renames** lists name changes Anvil spotted for you to confirm or reject.',
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter: tiers and perks — Anvil',
    metaDescription:
      'What Anvil Supporter, Champion and Patron each get: name colours and the star, gold GZ, animated avatar and banner, the display case, friend events, head-to-head, event chat and clan boosts. How Gumroad billing works and what happens when you cancel.',
    eyebrow: 'Anvil · for players',
    title: 'Anvil Supporter: tiers and perks',
    dek: 'Anvil Supporter is a personal subscription that pays for Anvil’s servers. It comes in three tiers, each with everything the one below has. Every perk is looks or hosting room: tracking, events, scoring and your own stats stay free for everyone, and nothing here changes what an event counts.',
    facts: [
      { strong: 'From $1 a month', rest: 'or $10 a year' },
      { strong: 'Looks only', rest: 'never a score, a rank or an item' },
      { strong: 'Nothing deleted', rest: 'when you stop' },
    ],
    footnote:
      'Everything here is set on the website under **Settings** → **Supporter**, **Profile look** and **Clan boosts**. For boosts in detail, see [Boosting a clan]({boostsGuide}). For where your colours show in RuneLite, see [The side panel, tab by tab]({panelGuide}).',

    tiers: {
      title: 'The three tiers',
      intro: 'Prices are on the **Anvil Supporter** page, `/supporter`. A yearly plan costs ten months.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 a month or $10 a year. A gold name and a star, a gold GZ, a display case with 4 slots, and you can host a friend event.',
        },
        {
          term: 'Champion',
          body: '$2 a month or $20 a year. A gradient name from our presets (or one colour of your own), your own avatar and banner (animated if you like), 8 display case slots, faster event chat and 1 clan boost.',
        },
        {
          term: 'Patron',
          body: '$5 a month or $50 a year. Your own gradient of up to 4 colours, and it moves, 12 display case slots, no wait in event chat, 2 friend events at once and 2 clan boosts.',
        },
      ],
      note: {
        tag: 'Time from invites',
        body: 'Under Settings → Supporter you get an invite link. When a friend you invited pays, you earn free months; the reward lands two weeks after their first payment. Time earned this way gives every perk of its tier except clan boosts.',
      },
    },

    compare: {
      title: 'What each tier gets',
      intro: 'The same table as on the Supporter page, plus the chat perks.',
      table: {
        areaLabel: 'Perk',
        columns: ['Free', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Name colours', cells: ['—', 'Gold', 'Presets or one colour of your own', 'Presets or up to four colours, moving'] },
          { area: 'Star by your name', cells: ['—', 'Yes', 'Yes', 'Yes'] },
          { area: 'Gold GZ', cells: ['—', 'Yes', 'Yes', 'Yes'] },
          { area: 'Animated avatar and banner', cells: ['—', '—', 'Yes', 'Yes'] },
          { area: 'Display case', cells: ['—', '4 slots', '8 slots', '12 slots'] },
          { area: 'Friend events (at once · players)', cells: ['Join only', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Head-to-head challenges', cells: ['1 active', '5 active', 'Unlimited', 'Unlimited'] },
          { area: 'Event chat: wait between lines', cells: ['5 s', '3 s', '1 s', 'None'] },
          { area: 'Clan boosts', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Under **Settings** → **In-game chat** there are three more: your own chat feed colours (Supporter), choosing what your login brief covers (Champion), and a star by your name in other players’ chat feeds (Patron).',
    },

    names: {
      title: 'Name colours',
      intro:
        'Set them under **Settings** → **Supporter**, in **Your name’s look**. The preview shows your name on a dark background and on a light one.',
      rows: [
        {
          term: 'Supporter',
          body: 'solid gold. There is nothing to pick.',
        },
        {
          term: 'Champion',
          body: 'one of the preset gradients (**Classic**, the default, **Ember**, **Ocean**, **Aurora**, **Rose gold** or **Toxic**), or **Your own**: one static colour. Across all your characters you can use at most two different colours of your own.',
        },
        {
          term: 'Patron',
          body: 'every preset plus **Prism**, the Patron default, or **Your own** with one to four colours. One colour stays still; two to four make a gradient that moves left to right.',
        },
      ],
      outro:
        'Start with **Your Anvil display name**, the name on your Discord-linked account, and press **Save**. **Reset to default** goes back to your tier’s colours. Under **Your RuneScape characters**, keep **Same as my Anvil name** or choose **A separate look for my characters**, which opens an editor for one look on all of them. To give one character its own look, pick it under **Customize per character**. Its editor opens on its own, and **Use the default** puts it back.',
      note: {
        tag: 'Dark and light backgrounds',
        body: 'The site, the plugin panel and Discord are dark; the game’s solid chatbox is light. Anvil adjusts your colours so they stay readable on each. If you want a different look on one of them, switch on **Set a separate look for dark backgrounds** or **for light backgrounds**. That look is shown exactly as you picked it, with no contrast fix, and the preview warns you when it is hard to read.',
      },
    },

    where: {
      title: 'Where your flair shows',
      intro: 'Your colours and the star go wherever your name does:',
      rows: [
        {
          term: 'On the site',
          body: 'boards, rosters, profiles, your own name in the top bar, and your character names. The star wears your colours.',
        },
        {
          term: 'In the plugin panel',
          body: 'the Feed, event chat, cards and the **Tracking** line. A Patron’s gradient slides; each player can stop it with **Animated names**.',
        },
        {
          term: 'In game',
          body: 'for other players who use the Anvil plugin: public, clan, friends and private chat, clan broadcasts, login notices, friends and clan lists, and the right-click menu (never on PvP worlds or in the Wilderness). In game chat, the star is a Patron’s.',
        },
        {
          term: 'In Discord',
          body: 'a star beside your name on Anvil’s posts, drawn in your own colours if you picked some.',
        },
        {
          term: 'Gold GZ',
          body: 'on a clanmate’s drop in your clan’s feed on the site, your GZ can be gold. Only Supporters can give one.',
        },
      ],
      note: {
        tag: 'Only on characters proven to be yours',
        body: 'Colours show only on characters the plugin has confirmed are yours, on the site and in game. To keep them off your names in other people’s game chat, untick **Show my colours on my characters’ names in game chat** under Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banner and display case',
      intro: 'All three are under **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar & banner',
          body: 'Champion and Patron. Upload your own; a GIF or WebP stays animated. They show on your card, your profile and every character of yours, on the site and in the plugin. A banner can be up to 6 MB and at least 600×150; an avatar up to 2 MB.',
        },
        {
          term: 'Per character',
          body: 'give one character its own banner or avatar, or both. It replaces your default on that character’s pages and plugin card only.',
        },
        {
          term: 'Display case',
          body: 'your best drops, kill counts and times pinned to your profile: 4 slots for Supporter, 8 for Champion, 12 for Patron. Pins from characters you don’t share stay private.',
        },
      ],
    },

    hosting: {
      title: 'Friend events, head-to-head and chat',
      intro: 'The perks that give you more room to play, rather than a look:',
      rows: [
        {
          term: 'Friend events',
          body: 'run your own bingo, solo bingo or race for friends from **Host an event for your friends**, tracked by the plugin like a clan event. Friends join with your invite link. Supporter: 1 live event, 10 players. Champion: 1 event, 25 players. Patron: 2 at a time, 50 players between them. Anyone can join one.',
        },
        {
          term: 'Head-to-head',
          body: 'challenge a friend from their profile: first to a drop, or most kills or XP in 1 hour, 24 hours or 7 days. Bragging rights only. Free players can have 1 open at a time, Supporters 5, Champions and Patrons as many as they like.',
        },
        {
          term: 'Event chat',
          body: 'how long you wait between lines: 5 seconds without a tier, 3 for Supporters, 1 for Champions, none for Patrons. When a board’s chat gets busy, everyone waits 10 seconds, Patrons too.',
        },
        {
          term: 'Clan boosts',
          body: 'Champion 1, Patron 2, while you pay. See [Boosting a clan]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Paying, changing and cancelling',
      intro: 'Anvil Supporter is billed through Gumroad, monthly or yearly.',
      steps: [
        'Sign in on Anvil and open `/supporter`.',
        'Press **Choose Supporter**, **Choose Champion** or **Choose Patron**. Gumroad’s checkout opens, with monthly or yearly billing.',
        'Pay. Your perks switch on as soon as Gumroad tells Anvil, and your tier shows on the Supporter page as **Your tier**.',
      ],
      outro:
        'To change tier, use **Change tier** under Settings → Supporter. To cancel or update your card, use **Manage on Gumroad** there. A cancelled membership keeps every perk until the end of the term you paid for.',
      note: {
        tag: 'Always start from /supporter',
        body: 'The **Choose** button carries a code that tells Anvil which account paid. Anvil never matches a payment by email, so buying from Gumroad directly, without that button, leaves the payment unlinked. If that happened, ask in the Anvil Discord and staff can attach it to your account by hand.',
      },
    },

    lapse: {
      title: 'Moving down or stopping',
      intro:
        'Nothing you set is deleted. Every perk is checked against the tier you have right now, so it switches off on its own and comes back as soon as you renew.',
      rows: [
        {
          term: 'Name colours',
          body: 'your saved choice stays stored. You wear your new tier’s colours, or none, until a tier that allows it comes back.',
        },
        {
          term: 'Avatar & banner',
          body: 'below Champion, they show their still first frame instead of moving.',
        },
        {
          term: 'Display case',
          body: 'shows the first pins your tier allows and hides the rest. With no tier it is hidden; the pins wait for you.',
        },
        {
          term: 'Clan boosts',
          body: 'your oldest boosts keep counting and the rest are paused, not removed.',
        },
      ],
      note: {
        tag: 'A temporary upgrade from Anvil staff',
        body: 'Staff can give someone a higher tier for a while, for example as a thank-you. It sits on top of what you pay and never changes your subscription. Settings → Supporter shows **A gift from Anvil** and when it ends; after that you are back on your paid tier. A gift only gives clan boost slots when staff include them.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'The Anvil side panel, tab by tab — Anvil',
    metaDescription:
      'What each tab of the Anvil RuneLite side panel shows (Clan, Feed, You, Lookup and the gear), how event chat and Feed reactions work, and the plugin settings for the feed in game chat, Supporter colours and animated names.',
    eyebrow: 'Anvil · for players',
    title: 'The side panel, tab by tab',
    dek: 'The Anvil button in RuneLite’s sidebar opens a panel with four tabs and a gear: **Clan**, **Feed**, **You**, **Lookup** and ⚙. Most of what it shows comes from the site, so it stays current without a plugin update. A few things below are marked as coming in the next plugin update.',
    facts: [
      { strong: 'Four tabs', rest: 'and a gear for syncing and settings' },
      { strong: 'Event chat', rest: 'in the Feed tab' },
      { strong: 'GZ, Sad, Sit', rest: 'on Feed rows' },
    ],
    footnote:
      'Installing the plugin and signing in is in [RuneLite plugin setup]({pluginGuide}). Supporter colours, the star and the chat perks are explained in [Anvil Supporter: tiers and perks]({supporterGuide}).',

    header: {
      title: 'The top of the panel',
      intro: 'Above the tabs sit the title, **Refresh** and the account line.',
      rows: [
        {
          term: 'Refresh',
          body: 'reloads the panel, the Feed tab included. It reads **Refreshing…** while it works. In the next plugin update it also reloads You and Lookup, so a new avatar or banner shows at once, and it no longer blanks the Feed tab.',
        },
        {
          term: 'Tracking',
          body: 'the line under the title names the character being tracked, in its Supporter colours if it has some. **Not my account…** stops tracking a character someone else plays on this computer; **Track again** undoes it.',
        },
        {
          term: 'The account menu',
          body: 'the ⋯ link opens **View my profile on Anvil**, **Not my account…** and **Sign out…**. In the next plugin update it also has **Become a Supporter**, or **Your Supporter perks** if you already are one.',
        },
        {
          term: 'Season progress',
          body: 'in the next plugin update, on Leagues, Deadman and other seasonal worlds, a line reads **Sharing season progress · Turn off**. It sends your relics, areas and tasks (with a screenshot) to your clan; your clan chooses on the website what gets posted. **Turn on** shares it again. The same switch is **Share seasonal activity** in the plugin settings.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Your events and your clan. In a creator’s space the tab says **Space**.',
      rows: [
        {
          term: 'The clan dropdown',
          body: 'shown when you play in more than one clan or space. **All clans** (the default) shows everything you are playing, live event first. Picking one clan narrows the panel to it and files your submissions there.',
        },
        {
          term: 'Up next',
          body: 'a gold card at the top that points at the one thing worth doing now, such as joining an event, answering a survey or taking your starting shot.',
        },
        {
          term: 'Events',
          body: 'every live and upcoming board, Skill or Boss of the Week and clan event, with where you stand. Then **Your other boards**, **Also live** and **Your clan**.',
        },
        {
          term: 'A board',
          body: 'open one for its standings (the top three and your own lines, with **View all** for the rest), teams, missions, recent activity, the nearest tiles and **View all tiles**. Its **Feed** and **Chat** buttons open that board in the Feed tab.',
        },
        {
          term: 'Rank moves',
          body: 'a green **▲** or coral **▼** with a number next to a name shows how far it has moved since the day began.',
        },
        {
          term: 'A clan event',
          body: '**I’m going**, **Sign me up** or **Answer the survey**, depending on the event.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Your clan’s and boards’ big moments, live: drops, pets, achievements, quests, deaths and finished tiles.',
      rows: [
        {
          term: 'Whose feed',
          body: 'the dropdown at the top lists **Clan ·** each clan you are a member of and **Event ·** each live board you are on. It opens on your board if you have one, otherwise your clan.',
        },
        {
          term: 'Filters',
          body: '**All**, **Tiles** (boards only), **Drops**, **Pets**, **Achievements**, **Deaths**, **Milestones** (slayer, clues, kill counts and the like, once players switch them on), and **My team** on a board where you are on a team. A clan feed also has a game-mode activity button for Leagues and other modes.',
        },
        {
          term: 'New rows',
          body: 'arrive on their own. If you have scrolled away, a **↑ N new** pill takes you back to them.',
        },
      ],
      note: {
        tag: 'Not the same as the in-game chat feed',
        body: 'The Feed tab works whatever your plugin settings say. **Show feed in game chat** (step 8) is the separate setting that also prints it in your chatbox.',
      },
    },

    reactions: {
      title: 'Reactions',
      intro: 'Each row in the Feed has its reaction under it:',
      rows: [
        {
          term: 'GZ',
          body: 'on drops, pets and achievements. The count shows next to it, such as **GZ 3**.',
        },
        {
          term: 'Sad and Sit',
          body: 'on deaths, instead of GZ. Sit is the game’s way of telling someone who died to sit down.',
        },
        {
          term: 'Who can react',
          body: 'on a clan feed, clanmates. On a board, the players on it and the host’s staff; when a board hides its standings, players can react only to their own team’s rows.',
        },
        {
          term: 'Who reacted',
          body: 'hover a reaction to see names, such as “GZ · Mossy and 3 others”. Click it again to take yours back.',
        },
      ],
      note: {
        tag: 'In the next plugin update',
        body: 'Reactions become pill buttons, tinted when one is yours, and other people’s reactions update live for everyone watching, including on your other open clients. Today the count changes when you react or when the Feed reloads. Gold GZ, the Supporter reaction, is given on the website’s feeds; the Feed tab has GZ, Sad and Sit.',
      },
    },

    chat: {
      title: 'Event chat',
      intro:
        'A board with chat turned on has a **Feed / Chat** switch at the top of the Feed tab, for the players on that board and the host’s staff. The board page in the Clan tab has a **Chat** button too.',
      rows: [
        {
          term: 'Everyone or your team',
          body: 'Pick a channel with the chips at the top: **All teams** for the whole board, **My team** for your team only, and **Announcements**, where only the host and mods can post. Each chip shows a count of lines you haven’t read. Lines from the host and mods are marked **HOST** or **MOD**.',
        },
        {
          term: 'Sending',
          body: 'type in the box and press Enter. Lines are up to 200 characters, and only the host and mods can post links.',
        },
        {
          term: 'How often',
          body: 'the wait between your lines follows your Supporter tier: 5 seconds without one, 3 for Supporters, 1 for Champions, none for Patrons. The line under the box says what yours is. Staff never wait.',
        },
        {
          term: 'Slow mode',
          body: 'when a board’s chat gets very busy, everyone waits at least 10 seconds for a minute, Patrons included. Nobody can send more than 10 lines in 10 seconds.',
        },
        {
          term: 'Moderation',
          body: 'the host and mods can right-click a line to **Delete message** or **Mute** someone, and pause the chat with **Pause chat**. A pause stops everyone but staff from posting, except in **Announcements**. **Mute** in the panel is a ban that lasts until it is lifted on the moderation page. There you can also give a timeout of 5 minutes, 1 hour or 24 hours (or any time from 1 minute to 30 days), which closes every channel for that person, and filter the chat by channel.',
        },
      ],
      outro:
        'A run of lines from one person shares one name and time, until there is a 5-minute gap. Chat is kept for 7 days after the event ends.',
    },

    you: {
      title: 'You and Lookup',
      intro: 'Two tabs for player cards: yours, and anyone else’s.',
      rows: [
        {
          term: 'You',
          body: 'your own card for the character you are logged in on: banner and avatar, **Display case**, and the **Stats**, **Bosses** and **Log** tabs (the collection log down to each page’s items, plus clues, times and combat achievements). Below it, any **Head-to-head** challenge waiting for you (**Accept** or **Decline**) and your **Goals**, with **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'switch between **Players** and **Clans**, type a name and press Enter. **Recent** lists your last few. Right-click anyone in game and pick **Anvil** to land here.',
        },
        {
          term: 'Compare',
          body: 'on someone else’s card, **Compare with me** lines the two of you up skill by skill, boss by boss and page by page. A clan’s card has **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'The gear tab',
      intro: 'Syncing and settings, rather than things to look at:',
      rows: [
        {
          term: 'Sync profile',
          body: 'sends your collection log and best times to Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'clan admins only: sends the in-game clan member list to the site. If the plugin cannot read your clan, it says **Join your clan channel to sync the roster** instead.',
        },
        {
          term: 'Banner sounds',
          body: '**Add clip** for the sound a banner plays, **Copy folder path** to manage them, and **Add mission clip** for missions.',
        },
        {
          term: 'Become a Supporter',
          body: 'in the next plugin update, a ★ link at the bottom opens the Supporter page, or reads **Your Supporter perks** if you already are one.',
        },
      ],
    },

    settings: {
      title: 'Settings that change what you see',
      intro:
        'In RuneLite’s configuration for Anvil, under **Chat messages**. All are on to start with.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'also prints the feed in your chatbox as it happens: big drops, pets and achievements from boards whose host turned it on and clans you guest in, your teammates’ tile progress, and other teams’ finished tiles.',
        },
        {
          term: 'Supporter names in chat',
          body: 'Supporters’ colours (and a Patron’s star) in public, clan, friends and private chat, and on your friends list and channel member lists. The list of names is downloaded from Anvil; nothing about who you see is sent.',
        },
        {
          term: 'Animated names',
          body: 'lets a Patron’s gradient slide in the panel, the Feed and event chat. Off keeps it still. In the next plugin update it also covers boosted clan names and animated banners in the panel.',
        },
        {
          term: 'Supporter names in menus',
          body: 'Supporters’ colours on their name when you right-click them, never on PvP worlds or in the Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'on, a Supporter’s colours replace a name colour another plugin set, such as Player Indicators. Off leaves those names alone.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Boosting a clan — Anvil',
    metaDescription:
      'How Anvil clan boosts work: who has them, placing and moving a boost, the three boost levels and what each one unlocks, the clan’s name colours, gifted boosts, and booster marks and badges.',
    eyebrow: 'Anvil · for Supporters and clan staff',
    title: 'Boosting a clan',
    dek: 'A paying Champion or Patron can put a boost on a clan they are a member of. Enough boosts from a clan’s members raise it a level, and each level changes how the clan looks and where it is listed. Boosts are looks only: they never change a rank, a score, a seat or the clan’s plan.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosts while you pay' },
      { strong: 'Levels at 3, 8 and 15', rest: 'counted boosts' },
      { strong: 'Once a week', rest: 'a boost can move' },
    ],
    footnote:
      'Members place boosts under **Settings** → **Clan boosts**. Clan staff see the level and its options under Admin → **Clan settings** → **Boosts**. For the tiers themselves, see [Anvil Supporter: tiers and perks]({supporterGuide}).',

    what: {
      title: 'Who has boosts',
      intro: 'Boosts come with a paid membership:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosts.' },
        {
          term: 'Supporter',
          body: 'none. Neither does time earned through invites. A temporary upgrade from Anvil staff gives slots only when staff include them.',
        },
      ],
      outro:
        'Boosts belong to you, not to a character: three characters in three clans still share one set. **Settings** → **Clan boosts** only appears in your settings while you are a Supporter or still have a boost placed.',
    },

    place: {
      title: 'Placing and moving a boost',
      intro: 'You place your own boosts; nobody can place one for you.',
      steps: [
        'Open **Settings** → **Clan boosts**. **Your boosts** lists what you have placed and any **Free slot**.',
        'Under **Clans you can boost**, press **Boost** beside a clan. You can also press **Boost this clan** in the Boosters section of the clan’s own page.',
        'To move one, use **Move to…** on its row and pick another clan. **Remove** takes it off.',
      ],
      rows: [
        {
          term: 'A member seat, 14 days old',
          body: 'each boost rides on a member seat one of your characters holds in the in-game clan. A guest seat cannot carry one. The seat counts from whichever is earlier: when Anvil first saw it, or when the game says the character joined. Until then the clan’s row says how many days are left.',
        },
        {
          term: 'One row per clan',
          body: 'the list shows each clan once, and Anvil picks the character the boost rides on: your main where it can, otherwise the longest-held seat. The clan sees that character only, never your other ones.',
        },
        {
          term: 'Once a week',
          body: 'a placed boost can move 7 days after you placed it. A removed boost’s slot opens again on the same date, so removing and placing again is no shortcut. If the character it rode on left the clan, you can move it at once.',
        },
      ],
      note: {
        tag: 'What the labels mean',
        body: '**counting**: it counts toward the clan’s level. **paused**: your tier now has fewer slots than you placed, so your oldest boosts keep counting and the rest wait. **seat gone**: the character it rode on is no longer a member there; move it. **over the 2-per-person cap**: the clan already counts two of yours.',
      },
    },

    levels: {
      title: 'Levels',
      intro:
        'A clan’s level comes from its counted boosts. At most two boosts from any one person count toward one clan, so a level always means several members chose it.',
      rows: [
        { term: 'Level 1', body: '3 counted boosts.' },
        { term: 'Level 2', body: '8 counted boosts.' },
        { term: 'Level 3', body: '15 counted boosts.' },
      ],
      outro:
        'Members see the progress on the clan’s page, for example “5 of 8 to Level 2”. A clan that rises gets the new level at once.',
      note: {
        tag: 'A week of grace',
        body: 'When boosts fall below a level, the clan keeps that level’s perks for 7 days. Admin → Clan settings → Boosts shows when they end. If members boost it back in time, nothing changes.',
      },
    },

    perks: {
      title: 'What each level unlocks',
      intro: 'Each level keeps everything from the one below.',
      rows: [
        {
          term: 'Level 1',
          body: 'a **Boosted** badge on the clan page, its Clan Hall card and in search; a place above unboosted clans in the Clan Hall and its search results; and the clan name in a gradient.',
        },
        {
          term: 'Level 2',
          body: 'a spot in the Clan Hall’s **Featured** row; the clan’s animated banner plays (below Level 2 it shows its still frame); a recruiting line for visitors; and the name’s gradient moves.',
        },
        {
          term: 'Level 3',
          body: 'the **Spotlight** at the very top of the Clan Hall, and one recruitment post a month in the Anvil Discord, written by the clan.',
        },
      ],
      note: {
        tag: 'The clan logo is not a perk',
        body: 'An animated logo (a GIF or WebP clan image) plays at any level. Only the banner waits for Level 2.',
      },
    },

    colours: {
      title: 'The clan’s name colours',
      intro:
        'From Level 1 the clan’s name wears Anvil’s gradient. Owners and admins can choose their own under Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'One to four colours',
          body: 'one colour is a static name; two to four make a gradient. From Level 2 a gradient moves.',
        },
        {
          term: 'Dark and light backgrounds',
          body: 'as with Supporter names, Anvil adjusts the colours to stay readable on dark backgrounds (the site, the plugin panel, Discord) and light ones (the game’s solid chatbox). Switch on a separate look for either and it is shown exactly as chosen.',
        },
        {
          term: 'Reset to Anvil',
          body: 'goes back to Anvil’s palette.',
        },
      ],
      outro:
        'The colours stay saved if the clan drops below Level 1, and come back when it returns. The plugin picks up a change on its next refresh.',
    },

    staff: {
      title: 'For clan staff',
      intro:
        'Admin → **Clan settings** → **Boosts** is for owners and admins. Staff cannot place boosts for members; members place their own.',
      rows: [
        {
          term: 'The level',
          body: 'the clan’s level, how many boosts are counting, how many more reach the next level, and any grace week.',
        },
        {
          term: 'Recruiting line',
          body: 'Level 2. One sentence, up to 140 characters, shown to people who are not in the clan on your clan page and Clan Hall card.',
        },
        {
          term: 'Recruitment post in the Anvil Discord',
          body: 'Level 3. Once a calendar month, 20 to 500 characters, written by you and posted when you press **Post it**, with a link to your clan page. Mentions are removed and nobody is pinged. You can’t edit it or send another until next month.',
        },
        {
          term: 'Boosters',
          body: 'the list of characters boosting the clan.',
        },
      ],
      note: {
        tag: 'Gifted boosts from Anvil',
        body: 'Anvil staff can gift a clan a level, for a set time or with no end. The gift adds only the boosts the clan is missing to reach that level, shown as **Anvil gift** on the clan’s Boosters list. Each real boost from a member replaces one gifted boost, and a clan already above the gifted level keeps its own. When the gift ends, the clan falls back to the level its members’ boosts give it.',
      },
    },

    boosters: {
      title: 'Booster marks and badges',
      intro: 'What a booster gets in the clan they boost:',
      rows: [
        {
          term: 'The Booster mark',
          body: 'a small gem beside their character in that clan’s roster, feed and Discord posts. Hover it for “Boosts this clan”.',
        },
        {
          term: 'The Boosters wall',
          body: 'on the clan page: one row per character, most boosts first, then the longest standing.',
        },
        {
          term: 'Badges',
          body: '**First booster** for whoever placed the clan’s first boost ever; **1 month**, **3 months**, **6 months** and **1 year** of boosting without a break; and **Level-up 1**, **2** or **3** for the boost that lifted the clan to that level.',
        },
      ],
      note: {
        tag: 'Moving starts the clock again',
        body: 'Badges for time count from the character’s earliest boost that is still counting, so moving or removing a boost starts them over. Your profile lists the clans you boost, once per clan.',
      },
    },
  },

  profile: {
    metaTitle: 'Your profile, Wrapped and Compare — Anvil',
    metaDescription:
      'The pages Anvil keeps about you: your profile, each character’s public page, your person page, monthly and yearly Wrapped, event Wrapped cards, and comparing two characters side by side.',
    eyebrow: 'Anvil · for players',
    title: 'Your profile, Wrapped and Compare',
    dek: 'Anvil keeps one page for **you** and one for **each character** you play. This is what is on them, who can open them, and the Wrapped cards that come out at the end of every month and every event.',
    facts: [
      { strong: 'Shared by default', rest: 'turn any character private in one switch' },
      { strong: 'Monthly Wrapped', rest: 'out on the 1st of the next month' },
      { strong: 'Event Wrapped', rest: 'out when the event ends' },
    ],
    footnote:
      'Every switch mentioned here is explained where it lives in [Settings, page by page]({settingsGuide}).',

    pages: {
      title: 'Your pages',
      intro: 'Four pages, each answering a different question:',
      rows: [
        {
          term: 'Your profile',
          body: '[/profile](/profile), only ever seen by you. Pick a character from the chips at the top to see its levels, bosses, collection log and events. Captains also get a **Captain’s deck** here.',
        },
        {
          term: 'A character’s page',
          body: '`/p/<name>`: one character, readable by anyone with the link while it is shared. It shows skills, bosses, the collection log and personal bests, and on purpose leaves out your clan standings, your event history and your Discord name.',
        },
        {
          term: 'Your person page',
          body: '`/u/…`: all your shared characters on one page, with your display case and the streaming accounts you chose to show. It only exists if you turn on **Show that my characters are one person**.',
        },
        {
          term: 'A clan’s member page',
          body: '`/c/<clan>/members/<name>`: the same character as one clan sees it, reached from that clan’s **Members** list. A private clan shows its members only to its own people.',
        },
      ],
    },

    sharing: {
      title: 'Who can see what',
      body: [
        'Every character starts **shared**: its page opens for anyone with the link, and it can appear on leaderboards and to other clans. Turn one off under **Who sees my characters** in Settings and its page answers _not found_ for everyone except you. You see **Private — only you can see this page.** with a **Share it →** link.',
        'A shared page has **Copy link** under the name. Signed-in visitors who think a page is abusive can press **Report this profile**.',
        'Per character, Settings also lets you hide which in-game clan it is in (**Show my in-game clan**), so it leaves that character’s page and that clan’s Anvil page.',
      ],
    },

    wrapped: {
      title: 'Your monthly and yearly Wrapped',
      body: [
        'Every month, each character gets a Wrapped card: **XP gained**, **Boss kills**, **New slots** in the collection log, **Efficient** hours, **PBs**, plus pets and the biggest drop. It comes out on the **1st of the following month** (UTC). Until then only you can open it, as a preview.',
        'The year gets one too, at `/p/<name>/wrapped/<year>`, from **1 December**. `/p/<name>/wrapped` always takes you to the newest one there is.',
        'Press **Copy link to your Wrapped** to share it. Pasted into Discord it unfurls as a picture of the card. A private character’s Wrapped opens only for you, and its link previews as a plain Anvil card.',
      ],
      note: {
        tag: 'An empty month',
        body: 'If nothing reached Anvil that month (no XP, kills, log slots or PBs), the card says so instead of showing zeros. Play with the plugin, or let the hiscores catch you, and next month fills in.',
      },
    },

    events: {
      title: 'Event Wrapped',
      body: [
        'When a board ends, every player and every team gets a card. Open the event’s **Wrapped** page: **Your card** is at the top, then **Teams** (rank, score and players) and **Players**. Press **Open and share your card**, then **Copy share link**.',
        'Before the end you see **Cards aren’t out yet**. Staff can open a preview early, so they can check the cards before players see them.',
        'The card pictures only show for a public clan’s event that wasn’t invite-only. For any other event the link still works for the people who can see that event, and previews as a plain Anvil card.',
      ],
    },

    compare: {
      title: 'Compare two characters',
      body: [
        'Open [Compare](/compare) and type two names. You get skills, bosses and collection-log pages side by side. The leader on each count is in gold. Below that are an analysis, per-skill XP, every boss either of you has killed, and each log page item by item: both have it, neither, or only one of you. **Swap sides** flips them.',
        'Only shared characters can be compared. A private one, or a name Anvil doesn’t know, comes back as _not on Anvil, or not shared_. You can always compare your own private characters while signed in.',
      ],
    },
    news: {
      title: 'What’s new and the changelog',
      body: [
        '[What’s new](/whats-new) shows what changed on Anvil, newest first. When you are signed in it starts with **For you**, the news that matters for your tier and your clan, then **Everything new**. Things that need a plugin update say **Coming in the next plugin update**.',
        'The [changelog](/changelog) lists every release with its news, highlights, and what is **New**, **Improved** and **Fixed**.',
        'When a release goes out, its news is posted in the Anvil Discord and in your clan’s Anvil updates, and the plugin shows a line when you log in. Small fixes are bundled into the next post.',
      ],
    },
  },

  settings: {
    metaTitle: 'Settings, page by page — Anvil',
    metaDescription:
      'Every page under Anvil Settings: Discord posts and screenshot privacy, the in-game chat feed, plugin connection and devices, your own webhooks, who sees your characters, Supporter and profile look, streaming accounts, each character, and ownership claims.',
    eyebrow: 'Anvil · for players',
    title: 'Settings, page by page',
    dek: '[Settings](/settings) is where your own choices live: what you post, what you see in game, who can see your characters. Choices made here follow you to every computer you play on.',
    facts: [
      { strong: 'Search box', rest: 'on the first page finds any setting' },
      { strong: 'One page per character', rest: 'under Characters' },
      { strong: '10 webhooks', rest: 'of your own' },
    ],
    footnote:
      'Your profile pages are explained in [Your profile, Wrapped and Compare]({profileGuide}); the plugin’s own settings in [RuneLite plugin setup]({pluginGuide}).',

    find: {
      title: 'Finding a setting',
      body: [
        'The first page, **Overview & search**, has a search box. Type what you want in your own words, like _private messages_, _rare drop value_, _death message_, _name colour_ or _plugin token_, and it takes you to the right switch.',
        'The menu down the side has two groups. **Account** holds the pages below. **Characters** has one page per character you have linked (your main is marked **main**), then **Add character**. A number on **Add character** means Anvil has seen you play characters you haven’t linked yet.',
      ],
    },

    posts: {
      title: 'Discord posts & screenshots',
      intro:
        'What the plugin posts about you to your clans’ Discord channels, and what it hides in screenshots. These choices are read by the next plugin update. Until you have it, the same switches in the plugin’s own settings decide.',
      rows: [
        {
          term: 'What your plugin posts',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** and **Diary completions** start on; **PvP kills** starts off.',
        },
        {
          term: 'The numbers',
          body: '**Min drop value** (1m to start, at least 1m, 0 turns it off), **Min drop rarity (1 in N)** (1 in 1,000 to start), **Value and rarity together** (either one to start, or require both), **Loot key value** (1m), a **Death message** of up to 200 characters where `{name}` becomes your name, and the lowest **Combat task tier** and **Quest tier** that post (Master to start). The value, the rarity and the either/both choice follow your clan\'s defaults until you set your own; **Reset to clan default** goes back to following them.',
        },
        {
          term: 'Where your posts go',
          body: '**Keep my announcements out of clans I only guest in**, and **Level posts in clan channels**: **Clan rules**, **Only 99s & max** or **Off**. **Per character** lists each character with a **Clans →** link to switch posting off for one clan.',
        },
        {
          term: 'Screenshots per kind',
          body: 'choose for each kind (**Rare drops**, **Pets**, **Deaths**, **Collection log**, **Combat tasks**, **Achievement diaries**, **Levels**, **Player kills**) whether its post carries a screenshot. All start on. Your clan can set a default for its members; until you change one you follow it, and **Reset** goes back to it. Bingo proofs are always captured, whatever you choose: they are your evidence.',
        },
        {
          term: 'More to announce',
          body: '**Slayer** (every Nth task), **Clue scrolls** (from the tier you pick), **Speedruns** (personal bests only, or every time), **Kill count** (every N kills), **BA gambles** (every N gambles) and **Custom chat messages** (game messages that match your own patterns, where `*` is any text and `#` any number; up to 10). All start off. Your clan can turn them on as a default for its members, and you can turn any of them on or off for yourself; **Reset to clan default** goes back to following your clan. They post to your clan\'s **Milestones & more** channel and to your own webhooks that take them; your own patterns only post to your own webhooks.',
        },
        {
          term: 'Private: Grand Exchange, trades, group storage, other plugins',
          body: '**Grand Exchange** (finished offers worth at least the amount you set), **Player trades** (what you gave and got), **Group storage** (what you put in or took out) and **Other plugins** (RuneLite plugins you name may post through Anvil). They start off, only you can turn them on, your clan can never turn them on for you, and they only post to your own webhooks: tick the kind on the webhook you want them in.',
        },
        {
          term: 'Message templates',
          body: 'change the first line of any post: **Loot**, **Pet**, **Collection log**, **Combat tasks**, **Achievement diary**, **Quests**, **Levels**, **Death**, **Player kills**, **Slayer**, **Clue scrolls**, **Speedruns**, **Kill count**, **BA gambles**, and for you alone **Grand Exchange**, **Player trades** and **Group storage**. Click a placeholder such as `{player}` or `{item}` to add it; the preview fills in sample values. Each kind has its own placeholders, and anything else in braces stays as you typed it. Up to 200 characters; mentions and links are never posted. Untouched, a post reads as it always has; your clan can set its own, and **Reset to clan default** goes back to it.',
        },
        {
          term: 'Screenshot privacy',
          body: 'tick the chat that is left out of every screenshot the plugin takes, proofs and Discord posts alike: **Private messages** (ticked to start), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** and **Group chat**. Game messages and Anvil’s own lines always stay in.',
        },
      ],
      note: {
        tag: 'Board tiles are never affected',
        body: 'Switching a post off only stops the Discord post. Drops, kills and achievements still count on any board you are playing.',
      },
    },

    chat: {
      title: 'In-game chat feed',
      intro:
        'What the plugin prints in your chatbox when the plugin setting **Show feed in game chat** is on.',
      rows: [
        {
          term: 'Where from',
          body: '**Boards I play on**, and **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'What',
          body: 'drops worth at least an amount you pick, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, and combat achievements, levels, quests and diaries.',
        },
        {
          term: 'When you log in',
          body: '**A short brief in chat**: what happened while you were away. Champions choose what it covers.',
        },
        {
          term: 'Colours',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)**, or **My own colours** for Supporters.',
        },
      ],
    },

    login: {
      title: 'Plugin connection, login & devices',
      intro: 'Where the plugin and the website are signed in, and how to sign them out.',
      rows: [
        {
          term: 'Plugin connection',
          body: 'your plugin token, for the rare case you paste it by hand. Normally **Sign in with Discord** in the side panel does this for you.',
        },
        {
          term: 'Login & devices',
          body: 'every computer the plugin is signed in on, as **RuneLite sign-in 1**, **2**… with when it was made and last used. **Revoke** signs one out, for example a computer you sold. **Enter a code** links another computer. **Sessions** signs you out of the website everywhere.',
        },
        {
          term: 'Clan billing',
          body: 'clan owners get **Open portal →** here, for the clan’s billing.',
        },
      ],
    },

    webhooks: {
      title: 'Your Discord webhooks',
      body: [
        'Your posts can also go to a Discord server of your own: a private channel, a friends’ server, anywhere you can make a webhook. Paste the webhook link, tick what it gets (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), optionally set a minimum drop value and rarity just for it, and press **Add webhook**. On a webhook that takes **Rare drops**, you can change those later and pick **Value or rarity: my setting**, **either** or **both**. Anything left blank follows your own settings, and a webhook may be looser than your clan’s hard floor.',
        'You can have up to 10. Only Discord webhook links are accepted, and a saved one is shown masked, so a screenshot of this page doesn’t leak it. **Level posts on my webhooks** sets your own level rules for them, separate from your clan’s.',
      ],
    },

    privacy: {
      title: 'Who sees my characters',
      intro: 'Your characters are shared to start with. Three switches change that:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'one switch per character. On (the start), its page is **Public**. Off, it is **Only its clans**: its clans still see it in their rosters and events, nobody else does, and it leaves leaderboards.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'with two or more characters, this makes your person page, which lists your shared characters together. Off, nobody can tell they are all you.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'whether the home page lists other clans’ open boards for you to look at.',
        },
      ],
    },

    look: {
      title: 'Supporter, profile look, streaming and boosts',
      intro: 'How you look on Anvil, and the accounts and perks behind it.',
      rows: [
        {
          term: 'Supporter & name colours',
          body: 'your tier, your perks and your invite link: bring friends and earn free months. Tiers are explained in [Anvil Supporter]({supporterGuide}).',
        },
        {
          term: 'Profile look',
          body: 'avatar and banner (animated from Champion), different ones per character if you like, and the **Display case**: 4, 8 or 12 pins by tier.',
        },
        {
          term: 'Streaming accounts',
          body: '**Twitch**, **YouTube**, **Kick** and **Medal**. Each shows whether it is verified, with a switch to show it on your profile. Verified accounts are what let you into follower and subscriber events.',
        },
        {
          term: 'Clan boosts',
          body: 'only shown once you can boost: your slots, where they are placed and the clans you can boost. See [Boosting a clan]({boostsGuide}).',
        },
      ],
    },

    characters: {
      title: 'Each character',
      intro:
        'Under **Characters**, every character has its own page: its type, whether it is verified, and links to its public page and full profile.',
      rows: [
        {
          term: 'Visibility',
          body: '**Show to other clans and on leaderboards**, and **Show my in-game clan**.',
        },
        {
          term: 'Clans',
          body: 'each clan and space it is in, as **member** or **guest**, with **Announce drops & achievements** per clan and **Leave**. If Anvil has it in the wrong clan, **Which clan is it really in?** tells staff.',
        },
        {
          term: 'Character',
          body: '**Make main**, ask for a rename after a name change, or **Remove** it from your account. Its past results stay where they are.',
        },
        {
          term: 'Add character',
          body: 'play a character once with the plugin signed in and it links itself. On mobile or the official client, link it by name. **We noticed you playing** lists the ones Anvil has seen; **Not mine** dismisses one.',
        },
      ],
    },

    claims: {
      title: 'Ownership claims',
      body: [
        'If a character is linked to someone else’s Anvil account but is really yours, press **This is my account** in the plugin side panel’s **You** tab. You prove you play it with a quick XP check, then the current holder is asked. You never learn who they are, and they never learn who you are.',
        'Your claims show **XP check**, **open**, and then how they ended: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** or **closed**. **Withdraw** cancels one.',
        'When someone claims one of yours, it shows under **Claims on your characters** with **Approve** or **Object — it’s mine**. An unverified character moves after 7 days unless you object. A verified one only ever moves if you approve it.',
      ],
    },
  },

  weekly: {
    metaTitle: 'Skill and Boss of the Week — Anvil',
    metaDescription:
      'Running a Skill of the Week, Boss of the Week or efficiency race on Anvil: scheduling one, repeating and rotating it, starting lines, adding and removing people, prizes, ending early, and what players see.',
    eyebrow: 'Anvil · for clan staff and players',
    title: 'Skill and Boss of the Week',
    dek: 'A weekly competition is the low-effort event: no tiles to write, no teams and no sign-ups. Everyone on the roster is entered when it starts, and the winner is whoever gains the most before it ends.',
    facts: [
      { strong: 'No tiles, no teams', rest: 'one leaderboard' },
      { strong: 'Entered at start', rest: 'the whole roster, automatically' },
      { strong: 'Up to 10 prize places', rest: 'paid from the coffer' },
    ],
    footnote:
      'Boards (bingo) are in [Running your first event]({adminGuide}); prizes and the coffer in [The clan coffer]({cofferGuide}).',

    schedule: {
      title: 'Schedule one',
      intro: 'Five choices, and the defaults are fine for most clans:',
      steps: [
        'Open **Schedule** in the admin menu and press **+ Schedule event** (moderators can use **Schedule a competition**).',
        'Pick the kind: **Skill of the Week** (XP gained), **Boss of the Week** (kills gained) or **Efficiency race** (hours played or hours bossed gained).',
        'Under **What is measured**, pick the skill or boss. To change it every week, add more under **Then rotate through**. Leave that empty to repeat the same one.',
        'Choose when it **Runs**: **This weekend**, **One week**, or your own dates. It always needs an end, because it scores the gains between start and end.',
        'Leave **Repeat every week** on and the next one starts the moment this one ends, with the same length and prizes. Tick **Guests race too** if your clan’s guests should be on the board.',
      ],
      outro:
        'There is nothing else to set up. Starting numbers come from the hiscores when it begins.',
    },

    counting: {
      title: 'How it counts',
      body: [
        'Each player’s gain is their stat now minus their stat when the competition started (their **starting line**). Highest gain wins; a tie is listed by name, and prizes can be split between tied places.',
        'Starting lines are taken from the hiscores. After that, the plugin’s live updates keep the board current between hiscore checks, so players with the plugin move up the board as they play.',
        'A number that goes down is ignored, and a gain that looks impossible is **flagged** for staff rather than counted or cut.',
      ],
      note: {
        tag: 'Players: log out before it starts',
        body: 'The hiscores only save your stats when you log out. If you grind right up to the start without logging out, your starting line is taken from before that grind and the grind counts as gain. Staff will usually catch it and fix your starting line, so log out once before it starts.',
      },
    },

    manage: {
      title: 'Running it',
      intro: 'Open the competition from **Schedule** or the dashboard. It has a home page and three tabs:',
      rows: [
        {
          term: 'Home',
          body: 'the **Leaderboard** (top 25, with how many are scoring), **flagged** gains, anyone who **left the clan**, and the prizes. When it ends, the winners and **Final leaderboard**.',
        },
        {
          term: 'Starting lines',
          body: 'every player’s **Started at**, **Now** and **Gained**. Correct a starting line by hand when a pre-competition grind was counted, and the leaderboard follows. **Pull current stats** refreshes everyone; **Reset baselines** starts everyone again from their hiscores now and wipes all gains.',
        },
        {
          term: 'Participants',
          body: 'the whole roster is already in. **Add someone** takes one name per line, for a guest or an account not on the roster yet. Removing a player removes their standing; adding them back gives them a new starting line. **Leave one each** cleans up a person entered on several characters. You can also drop every guest at once.',
        },
        {
          term: 'Settings',
          body: 'name, dates, **Repeat every week**, and **Status** (only to unstick one; it moves along on its own). Admins can **Delete** it, along with its participants and standings.',
        },
      ],
    },

    prizes: {
      title: 'Prizes and ending',
      body: [
        'Set prizes for up to 10 places, paid from the clan coffer. You choose whether a player with no gain can be paid and whether tied places share their prizes. How the money moves is in [The clan coffer]({cofferGuide}).',
        'It ends on its own at the time you set. **End now** stops it early: gains stop counting at once, and the results post to Discord with prizes settled within 15 minutes.',
      ],
    },

    players: {
      title: 'For players',
      body: [
        'You don’t sign up. If you are on the clan roster when it starts, you are in. Find it on your clan’s **Events** page, in the plugin side panel’s **Clan** tab with where you stand, and in Discord when it starts and ends.',
        'Each competition has its own page with the live leaderboard and how the race went day by day. A private clan shows it only to its own members.',
        'Playing with the plugin keeps your number live. Without it you still count, just at the speed of the hiscores.',
      ],
    },
    teamsLine: 'Want teams, or clans racing each other, on a skill or boss? Set the **Format** when you schedule it. See [Team competitions]({teamCompsGuide}).',
  },

  teamComps: {
    metaTitle: 'Team competitions — Anvil',
    metaDescription:
      'Run a Skill or Boss of the Week as teams or clan vs clan on Anvil: splitting players into teams, inviting other clans, how totals and averages score, late joiners, and what players see.',
    eyebrow: 'Anvil · for clan staff and players',
    title: 'Team competitions',
    dek: 'Every skill or boss competition has a Format. Solo is the default and works as it always did. Pick Teams to split your clan into sides, or Clan vs clan to race other clans on the same skill or boss.',
    facts: [
      { strong: 'Three formats', rest: 'Solo, Teams, Clan vs clan' },
      { strong: 'Totals decide it', rest: 'with an average per player' },
      { strong: 'One host edits', rest: 'partner clans watch' },
    ],
    footnote:
      'Skill and Boss of the Week basics are in [Skill and Boss of the Week]({weeklyGuide}). Want clans to race on bingo boards instead? See [Hosting a visiting clan]({clanVsClanGuide}).',

    teams: {
      title: 'Set up teams',
      intro: 'Teams split your own clan into sides. It takes about a minute:',
      steps: [
        'Schedule a competition as usual. Set **Format** to **Teams**.',
        'Type your team names. Everyone entered is split evenly by their current level or kill count, so the sides start fair.',
        'Leave **Late joiners go into the smallest team** on if people may arrive after the start. Turn it off to keep teams fixed.',
        'To change anything later, open the competition and choose **Teams** in its admin sidebar. There you can:',
      ],
      rows: [
        { term: 'Rename and recolour', body: 'give each team a name and a colour players will recognise.' },
        { term: 'Add and delete teams', body: 'start with two and add a third, or remove one you no longer need.' },
        { term: 'Move a player', body: 'send someone to another team. Handy for friends who want to play together.' },
        { term: 'Auto-balance', body: 'press **Auto-balance by current level/KC** to re-split everyone evenly.' },
        { term: 'Late joiners', body: 'switch the late-joiner option on or off. With it on, new players join the smallest team.' },
      ],
      note: {
        tag: 'No team, no problem',
        body: 'A player with no team still counts on the individual board. They just don’t add to any team total.',
      },
      outro: 'A repeating competition carries its teams over to the next week and balances them again.',
    },

    clans: {
      title: 'Set up clan vs clan',
      intro: 'Clan vs clan lets other clans join your competition, as many as you like. You are the host, and the other clans are partners.',
      steps: [
        'As an admin or higher in the host clan, set **Format** to **Clan vs clan**.',
        'Invite the other clans by their address. Do it on the create form, or later on the competition’s **Clans** page.',
        'The invited clan’s owner or admin accepts or declines on their **People** page or **Events** list. A moderator can’t. Nobody from that clan is entered until it accepts.',
        'When it accepts, it chooses who races: **All members** of its roster, or **Selected people** it picks. It can change this later from the same card.',
      ],
      body: [
        'The partner clan can follow the standings on its own site at `/c/<slug>/weekly/<id>`. It is read-only. Only the host edits the competition.',
        'To drop a clan, remove it on the **Clans** page. Its players come off the board.',
        'A repeating competition sends fresh invites every week, so each clan has to say yes again.',
        'Getting unwanted invites? Choose **Decline & block this clan** on the invite. That clan’s later invites are turned away quietly, and you can unblock it in **Settings → Blocked clans**.',
      ],
      note: {
        tag: 'Share the address',
        body: 'A clan’s address is the short name in its web address. Ask the other clan’s admin for it before you invite them.',
      },
    },

    scoring: {
      title: 'How it scores',
      body: [
        'A team or clan total is the sum of its members’ gains. Gains are counted the same way as on the individual board.',
        'Next to each total you also see an **average per player**, so a team of 8 and a team of 12 can still be compared.',
        'If two totals tie, the one that reached it first ranks higher.',
      ],
    },

    players: {
      title: 'What players see',
      body: [
        'The competition page shows the team or clan standings first. Open any of them to see its players. Your own team or clan is highlighted.',
        'Discord posts at the start, halfway and end show the standings. In clan vs clan they go to every clan’s channel, and yours is marked **← you**.',
        'In the plugin side panel, you can see where your team places.',
        'There is nothing to sign up for. If your clan enters all members and you are on the roster, you are in. If it picks people, you are in once picked.',
        'Don’t want to take part? Press **Opt out** next to **You’re in**, on the competition page, the Events list or in the plugin. You come off the board for that one competition, and you can opt back in while it runs.',
      ],
    },

    faq: {
      title: 'Questions',
      intro: 'The ones clan staff and players ask most:',
      rows: [
        {
          term: 'Our teams are different sizes. Is that unfair?',
          body: 'Not by itself. Totals decide the ranking, but each team also shows an average per player, so you can see how a smaller team is really doing.',
        },
        {
          term: 'What about people who join late?',
          body: 'With the late-joiner switch on, they join the smallest team. With it off, they count only on the individual board. You can always move them by hand on the **Teams** page.',
        },
        {
          term: 'Can the other clan edit our competition?',
          body: 'No. Partner clans see the standings read-only. Only the host clan can change the competition.',
        },
        {
          term: 'Can I sit one competition out?',
          body: 'Yes. Press **Opt out** on the competition page, the Events list or in the plugin. Only that competition is affected, and you can opt back in while it is running.',
        },
        {
          term: 'How many clans can race?',
          body: 'As many as you invite, up to 50 in one competition. Each clan sees its own side marked in the standings and in its Discord posts.',
        },
        {
          term: 'Another clan keeps inviting us. Can we stop it?',
          body: 'Yes. An owner or admin chooses **Decline & block this clan** on the invite. Its later invites are turned away without telling them. Unblock it any time in **Settings → Blocked clans**.',
        },
        {
          term: 'If we agree once, are we signed up every week?',
          body: 'No. A repeating competition sends new invites each week, and an owner or admin has to accept each one.',
        },
      ],
    },
  },

  luckRecords: {
    metaTitle: 'Drop odds, luck and records — Anvil',
    metaDescription:
      'What the odds line on a drop tile means, how Anvil works out luck (spooned, dry or on rate), what efficient hours are, and where your best day, week, month and year are kept.',
    eyebrow: 'Anvil · for players',
    title: 'Drop odds, luck and records',
    dek: 'Anvil can tell you how rare a drop is, how long it usually takes and how lucky you have been. It can also remember your best days. This page explains the numbers.',
    facts: [
      { strong: 'Rates', rest: 'come from the OSRS Wiki' },
      { strong: 'Luck', rest: 'expected kills against your real ones' },
      { strong: 'Records', rest: 'include history from when Anvil started tracking you' },
    ],
    footnote:
      'Your own pages are in [Your profile, Wrapped and Compare]({profileGuide}). Switches are in [Settings, page by page]({settingsGuide}).',

    odds: {
      title: 'The odds on a drop tile',
      intro: 'Open a drop tile and you see up to eight lines, one per item that has known odds. A line looks like this:',
      body: [
        '`Item: 1 in 512 from Boss · ~512 kills ≈ 9.4 h at 55/h`',
        'If the item can be rolled more than once per kill, it also says **(×2 rolls)**. If Anvil doesn’t know how fast people kill that boss, the hours part is left out.',
      ],
      rows: [
        { term: '1 in N', body: 'the chance of the drop on one kill, from the source that is quickest to get it.' },
        { term: 'Expected kills', body: 'the average number of kills it takes. It is worked out from the odds and the number of rolls.' },
        { term: 'Hours', body: 'expected kills divided by how many kills an hour people usually manage. It is a guide, not a promise.' },
      ],
      note: {
        tag: 'Average, not a limit',
        body: 'Half of all players get it before the expected kills, and some need far more. Use it to judge how big a tile is, not to say when it will land.',
      },
    },

    luck: {
      title: 'Luck: spooned, dry or on rate',
      body: [
        'Luck compares the kills you have done with the kills it should take. If you have the drop in fewer kills than expected, you are **spooned**. If you have done a lot of kills and still have nothing, you are **dry**. In between, you are **on rate**.',
        'Anvil marks you **dry** or **spooned** only when it is unusual: about a one in twenty chance or rarer. It shows how many you have against how many were expected, and how far ahead or owed you are.',
        'The **Luck** tab on the Members page lists the driest and luckiest people in your clan. Plugin posts for rare drops can also carry a luck line, such as a top percentage or how many players would have had it by now.',
      ],
    },

    source: {
      title: 'Where the numbers come from',
      body: [
        'Drop rates come from the OSRS Wiki and are refreshed every day. Kill rates for the hours come from the Wiki’s money-making guides. Where a rate is a careful estimate, Anvil treats it as one.',
        'If a rate looks wrong, the Wiki is the place to fix it. Anvil picks up the change.',
      ],
    },

    records: {
      title: 'Records and efficient hours',
      body: [
        'Anvil keeps your best **day**, **week**, **month** and **year** for skill XP, boss kills and efficient hours. Days are UTC and weeks start on Monday.',
        'Records go back to when Anvil started tracking your account: the first time you open them, Anvil fills them in from your daily history, then keeps them up to date. A record only changes when you beat your old best.',
        'You see your own on your character’s page, under **Records**. Your clan’s record holders are on **Members → Records**.',
        '**Efficient hours played** is how long your gains would take at good training methods, so a fast skill and a slow one can be compared. **Efficient hours bossed** does the same for kills. The rates come from the OSRS Wiki, and ironman accounts use their own rates.',
      ],
    },
  },

  clanEvents: {
    metaTitle: 'Clan events and the schedule — Anvil',
    metaDescription:
      'Scheduling clan events on Anvil: masses, trips and meetups, weekly repeats, “I’m going” and sign-ups with places, questions and fees, Discord posts and reminders, payouts, surveys, and the schedule that shows gaps.',
    eyebrow: 'Anvil · for clan staff',
    title: 'Clan events and the schedule',
    dek: 'Not everything is a board. A clan event is a mass, a raid night, a drop party or a meetup: a time and a place, posted to Discord and reminded, with as much or as little sign-up as you want.',
    facts: [
      { strong: 'Once or every week', rest: 'with an optional end date' },
      { strong: 'Three ways to join', rest: 'info, “I’m going”, or sign-ups' },
      { strong: 'Reminder', rest: '15 minutes before, then at the start' },
    ],
    footnote:
      'Weekly competitions are in [Skill and Boss of the Week]({weeklyGuide}); fees and prizes in [Fees and payouts]({feesGuide}). Reminder posts use your clan’s message templates, explained in [Settings, page by page]({settingsGuide}).',

    create: {
      title: 'Schedule one',
      intro: 'Open **Clan events** in the admin menu and fill in the form:',
      rows: [
        {
          term: 'Name, time, length',
          body: '**Name**, **Starts (your time)** in your own time zone, and **Minutes**.',
        },
        {
          term: 'Repeats',
          body: '**Just once** or **Every week**, with an optional **Until** date.',
        },
        {
          term: 'Where',
          body: '**Where**, **World** and **Host**, plus a picture: pick a boss or skill, or upload your own.',
        },
        {
          term: 'Details',
          body: 'gear, requirements, what to bring.',
        },
        {
          term: 'Who’s coming',
          body: '**Just information** (no button, no count), **“I’m going”** (one tap, shows a count) or **Sign-ups** (places, questions and a fee).',
        },
        {
          term: 'Discord',
          body: '**Post to** a channel (or the clan default), optional **Chat**, **Guide** and **Voice** channels to link, and whether to ping the member role on the announcement, the reminder and the start.',
        },
      ],
      outro: 'Press **Schedule it**. Payouts and a survey are added from the event’s own page afterwards.',
    },

    discord: {
      title: 'What Discord sees',
      body: [
        'The announcement goes up when you schedule it and is edited in place whenever you change something, so there is never a stale copy. A repeating event is marked **every week**.',
        'Fifteen minutes before, it posts **Starting in 15 minutes**, and at the start **Starting now**. If you move the time, the reminders move with it. Calling it off (**Cancel**) marks the post **Cancelled**, so nobody turns up.',
      ],
    },

    manage: {
      title: 'Sign-ups, fees and payouts',
      intro: 'Open the event to change what it uses. Everything starts off:',
      rows: [
        {
          term: 'Sign-ups',
          body: 'with **Places** (blank for no limit), when **Sign-ups close**, and **Sign-up questions**. **You approve each one** makes every sign-up wait for staff.',
        },
        {
          term: '“I’m going” button',
          body: 'off makes it information only: no button or count on the site, in the plugin or in Discord.',
        },
        {
          term: 'Entry fee',
          body: 'turns sign-ups on. Add gp of your own to the pot under **Added to the pot**.',
        },
        {
          term: 'Payouts',
          body: 'the pot is the fees plus anything you added. Name **Who** gets what and **For** what, and mark each one **Paid**. Anvil warns you if you pay out more than the pot.',
        },
        {
          term: 'Survey afterwards',
          body: 'opens once it ends. Only staff see the answers. If it took sign-ups, only the people who signed up are asked.',
        },
        {
          term: 'A weekly event',
          body: '**Every week is…** **Its own** (sign-ups, pot and survey each week) or **One run** (one sign-up, pot and survey for the whole series).',
        },
      ],
    },

    players: {
      title: 'What members see',
      body: [
        'The event page shows **When**, **Where**, **Host**, **Discord**, **Entry** and **Prizes**, with **Live now** while it is on. Members press **I’m going** or **Sign me up**, or **Ask to sign up** when staff approve each one. It is also in the plugin side panel’s **Clan** tab, with the same buttons.',
        'Only members of the clan can say they are going or sign up.',
      ],
    },

    calendar: {
      title: 'The schedule',
      body: [
        '**Schedule** puts boards, weekly competitions and clan events on one calendar, with a filter for each.',
        'Any stretch of two or more days with nothing on is marked as a gap, with **Fill the gap** to schedule something there. Use it to keep the clan busy between big events instead of letting a quiet fortnight slip by.',
      ],
    },
  },

  challenges: {
    metaTitle: 'Challenges and friends events — Anvil',
    metaDescription:
      'Head-to-head challenges on Anvil (first to a drop, most kills or most XP in 1 hour, 24 hours or 7 days) and Supporter friends events: private boards for your friends behind one invite link.',
    eyebrow: 'Anvil · for players',
    title: 'Challenges and friends events',
    dek: 'Two ways to play against people you know without a clan event: a **challenge** is one player against one other, and a **friends event** is a private board for a group, behind an invite link.',
    facts: [
      { strong: '1 hour to 7 days', rest: 'per challenge' },
      { strong: 'Bragging rights', rest: 'no stakes, no gp' },
      { strong: 'Up to 50 friends', rest: 'per friends event, by tier' },
    ],
    footnote:
      'Tiers and what each one hosts are in [Anvil Supporter: tiers and perks]({supporterGuide}).',

    start: {
      title: 'Challenge someone',
      intro: 'You need a verified character, and so do they.',
      steps: [
        'Open [Challenges](/challenges), or press **Challenge <name>** on a player’s profile.',
        'Under **Who**, type their name, and under **Playing as**, pick your own character. It has to be verified.',
        'Pick the race: **First to a drop** (up to 5 items, all monster drops), **Most kills** of a boss, or **Most XP** in one skill or overall.',
        'Pick the time limit: **1 hour**, **24 hours** or **7 days**. Tick **OK to show the result publicly** if you don’t mind it being seen; it is only public if you both tick it.',
      ],
      outro:
        'They get a notification and a Discord message, and have 24 hours to **Accept**, **Decline** or **Decline and block**. The clock starts when they accept.',
    },

    rules: {
      title: 'How it is decided',
      intro: 'Anvil settles it on its own, within a minute of the end.',
      rows: [
        {
          term: 'Kills and XP',
          body: 'both starting lines are taken when it is accepted; whoever gains more by the end wins, and equal gains are a tie. Hiscores and the plugin both count, whichever is higher.',
        },
        {
          term: 'First to a drop',
          body: 'the first of you to get one of the items wins, there and then. Drops are only seen by the plugin, so both of you need it running. Nobody gets one in time: a tie.',
        },
        {
          term: 'Calling it off',
          body: 'you can withdraw your own challenge until it is answered. Once it is running, it only stops if both of you agree.',
        },
      ],
    },

    limits: {
      title: 'Limits and saying no',
      body: [
        'Open challenges (waiting or running, sent or received) are limited by tier: **1** free, **5** for Supporters, unlimited for Champions and Patrons. Anyone can start up to 20 a day, and only one at a time with the same person.',
        'Don’t want any? **Turn away all new challenges**, or block one person when you decline. Whoever challenges you sees the same refusal either way, so they can’t tell they were blocked.',
        'The page keeps **Your record** (wins, losses and ties), what is **Open now** and **Your limit**.',
      ],
    },

    friends: {
      title: 'Host a friends event',
      body: [
        'Any Supporter, Champion or Patron can run a private board for friends from [Host](/host) → **Host for friends** → **New friends event**. It is a full board: bingo or a tile race, tracked by the plugin, with the same setup as a creator’s event.',
        'Send the **Invite link**; it is the only way in. Friends open it, sign in with Discord and press **Open the event**. Joining is always free. If the link leaks, make a new one: the old one stops working and everyone already in stays in.',
        'A friends event is never listed anywhere on Anvil, and needs no clan.',
      ],
      table: {
        areaLabel: 'Tier',
        columns: ['Players', 'Running at once'],
        rows: [
          { area: 'Supporter', cells: ['10', '1'] },
          { area: 'Champion', cells: ['25', '1'] },
          { area: 'Patron', cells: ['50', '2'] },
        ],
      },
      note: {
        tag: 'If your tier ends',
        body: 'Friends already in stay in. New friends can’t join past your new limit, and you can’t start another until you are back under it.',
      },
    },
  },

  clanHall: {
    metaTitle: 'Finding clans, events and leaderboards — Anvil',
    metaDescription:
      'Finding an OSRS clan on Anvil’s Clan Hall, comparing two clans, the weekly player and clan leaderboards, the public events list, and in-game clan pages for clans not on Anvil.',
    eyebrow: 'Anvil · for players and clans',
    title: 'Finding clans, events and leaderboards',
    dek: 'Anvil’s public pages for looking around: the **Clan Hall** to find a clan, the **Events** list to find something to join, and the **Leaderboard** to see who is gaining most.',
    facts: [
      { strong: 'Clan Hall', rest: 'public clans only' },
      { strong: 'Leaderboard', rest: 'this week, 30 days, all time' },
      { strong: 'Events', rest: 'only what the host advertised' },
    ],
    footnote:
      'To get your own clan listed, see [Start a clan]({clanGuide}); boosted clans are featured, see [Boosting a clan]({boostsGuide}).',

    hall: {
      title: 'The Clan Hall',
      body: [
        '[Clan Hall](/clans) lists every public clan. Search by name or tagline, then narrow it to **Taking members** or **Open to challenges**. **Most active** (the order it opens in) puts clans whose members gained most this week first; **Biggest** sorts by members.',
        'Each card says whether the clan is **Recruiting** and how it takes guests: **Guests welcome**, **Guests by approval** or **No guests**. Boosted clans get the featured rows at the top, and creators have a row of their own.',
      ],
      note: {
        tag: 'Not listed?',
        body: 'Only clans set to public appear, and a clan can turn off its listing in its settings. Private clans are never in the Clan Hall, the leaderboard or comparisons.',
      },
    },

    compare: {
      title: 'Compare two clans',
      body: [
        '[Compare clans](/compare/clans) puts any two listed clans side by side. To compare two characters instead, use [Compare](/compare).',
      ],
    },

    board: {
      title: 'The leaderboard',
      body: [
        '[Leaderboard](/leaderboard) ranks players and clans by experience, efficient hours and bossing over **This week**, **30 days** or **All time**. Players can be narrowed to **Regular**, **Ironman**, **Hardcore**, **Ultimate** or **Group** accounts.',
        'Clans are ranked by the XP their members gained. Only verified clans listed in the Clan Hall appear. A guest’s gains count for their own clan, not the one they guest in.',
      ],
    },

    events: {
      title: 'Find an event to join',
      body: [
        '[Events](/events) lists what is live and coming up across Anvil. Filter by **Live now**, **Open to join** or **Starting this week**, by format or **Solo**, by **Anyone can join** or **Ask or meet a rule**, and by **Clans** or **Creators**. **Join** takes you to sign up.',
        'Only events whose host turned on **Advertise on Anvil** appear. Members-only and invite-only events never do.',
      ],
    },

    ghost: {
      title: 'In-game clans not on Anvil',
      body: [
        'A character’s page names the in-game clan it is in. If that clan isn’t on Anvil, the link opens a plain page listing the Anvil players who are in it and chose to show it. It is not that clan’s roster, and nothing on it makes anyone a member.',
        'If it is your clan, **Bring your clan to Anvil** sets one up. Once it is a public Anvil clan, the link goes straight to it.',
      ],
    },
  },

  guideLibrary: {
    metaTitle: 'In-game guides: reading, proposing and clan copies — Anvil',
    metaDescription:
      'The Anvil guide library: raid, boss, skilling and money-making guides on the site, in game and in Discord. Reading by level, proposing a new guide or an edit, and how a clan copies and edits library guides.',
    eyebrow: 'Anvil · for players and clan staff',
    title: 'In-game guides',
    dek: 'Besides these how-to pages, Anvil keeps a library of game guides: raids, bosses, skilling and money makers. Anyone can read them, anyone signed in can suggest one, and a clan can keep its own copies.',
    facts: [
      { strong: 'Three levels', rest: 'Beginner, Intermediate, Advanced' },
      { strong: 'Anyone can propose', rest: 'staff review every one' },
      { strong: '/guide', rest: 'posts one in Discord' },
    ],
    footnote: 'Slash commands are in [Slash commands]({commandsGuide}).',

    read: {
      title: 'Reading a guide',
      body: [
        'Open the **In-game guides** tab on the guides page, or [/guides](/guides) on your clan’s site. A clan’s list has its own guides plus any library guides it hasn’t copied.',
        'Many guides have a level switch at the top: **Beginner**, **Intermediate** and **Advanced**. The parts for other levels fold away, so a first-timer and a speed-runner read the same page.',
        'In Discord, `/guide` and the start of a name posts a guide’s card with a link to the full page.',
      ],
    },

    propose: {
      title: 'Suggest a guide or an edit',
      body: [
        'Signed in, open [Propose a guide](/guides/propose) to write a new one, or suggest an edit to an existing library guide. Tell the reviewer what you changed and why; you can show your changes against the current guide before sending.',
        'Press **Send for review**. [My guide proposals](/guides/proposals) shows each one as **pending**, **approved**, **rejected** or **withdrawn**, with the reviewer’s note once it is answered. While it is pending you can edit or **Withdraw** it. You can have 5 waiting at a time.',
        'Nothing goes live until Anvil’s guide editors approve it. An approved edit also updates every clan copy that hasn’t been changed.',
      ],
    },

    clan: {
      title: 'Your clan’s guides',
      intro: 'Admins, and moderators allowed to write guides, manage them under **Guides** in the admin menu.',
      rows: [
        {
          term: 'Show library guides on our site',
          body: 'on: library guides you haven’t copied show on your Guides page too, always current.',
        },
        {
          term: 'Copy to our guides',
          body: 'makes a clan copy. It **follows library** until you edit it, picking up every library change.',
        },
        {
          term: 'Editing a copy',
          body: 'makes it **customised**, the clan’s own. When the library guide changes later, it shows **update available**: take the new version or keep yours.',
        },
        {
          term: 'New guide',
          body: 'writes one only your clan has, like your own raid rules or a mass guide.',
        },
      ],
      note: {
        tag: 'Posting them',
        body: 'Guides can be posted to a Discord channel, and those posts are edited in place when the guide changes.',
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
