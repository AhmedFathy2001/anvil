// What the bot says, in English — the source of truth every other language overlays.
//
// Same shape as the guide dictionaries in app/guide/_i18n: one object of strings, `{name}` for
// interpolation, and locale files that fill in as much as they have. Deliberately NOT `as const` —
// literal types would make every translated string a type error.
//
// What stays English no matter the locale:
//   - "Powered by Anvil" and the command names themselves (`/bingo board`). A member reading a
//     Danish answer still types the English command, and a translated command name is a command
//     nobody can find.
//   - Anything quoting the site's own UI. Same rule as the guides.
//
// Plural handling is deliberately two-form (`one` / `other`). Languages with three or more plural
// classes — Polish, Arabic, Russian — should phrase the `other` form so it reads correctly with any
// numeral (a trailing "count: {n}" construction, or a form that covers the whole range) rather than
// pick one class and be wrong for the rest.

export const en = {
  common: {
    /** Standings table with nothing in it yet. */
    noTeams: '_No teams yet._',
    moreOnSite: '+{n} more on the site',
    more: '+{n} more',
    bonusLegend:
      '⚡ mission bonus — earned on top of the board total, so it counts toward the score but not the percentage.',
    visitingClansOne: '🤝 {names} is a visiting clan — this board is shared.',
    visitingClansMany: '🤝 {names} are visiting clans — this board is shared.',
    visitingPlayersOne: '🤝 1 player is visiting from other clans.',
    visitingPlayersMany: '🤝 {n} players are visiting from other clans.',
    /** The provenance subtext under every answer: clan · board · phase. */
    phaseRunning: 'running',
    phaseUpcoming: 'not started',
    phaseEnded: 'ended',
    phaseDraft: 'draft',
    contextVisitingTeamsOne: 'cross-clan · 1 visiting team',
    contextVisitingTeamsMany: 'cross-clan · {n} visiting teams',
    contextVisitingPlayersOne: '1 visiting player',
    contextVisitingPlayersMany: '{n} visiting players',
    /** The button that turns a private answer into a channel post. */
    shareButton: 'Share to channel',
    sharedBy: '-# Shared by {who}',
    fieldFormat: 'Format',
    fieldTeams: 'Teams',
    fieldPlayers: 'Players',
    fieldTilesDone: 'Tiles done',
    fieldTeamScore: 'Team score',
    fieldYourTiles: 'Your tiles',
    fieldAccounts: 'Accounts',
    fieldRank: 'Rank',
    fieldRoster: 'Roster',
    fieldScore: 'Score',
  },

  board: {
    title: '📋 {event}',
    starts: 'Starts {when}.',
    ends: 'Ends {when}.',
    finished: 'This board has finished.',
    notScheduled: 'Not scheduled yet.',
    hidden: 'Tiles are still hidden — the board reveals when staff open it.',
  },

  leaderboard: {
    title: '🏆 {event} — standings',
  },

  rules: {
    title: '📜 {event} — how it works',
    houseTitle: '📌 {clan} — house rules',
    houseContinues: '**The rules continue** — read them all at',
    houseFull: 'Full rules:',
    houseTrimmed: '-# Trimmed to fit Discord — ask staff for the full ruleset.',

    scoringPoints:
      '• **Scoring** — each tile is worth its own points; a team’s score is the sum of what it finished.',
    scoringTiles: '• **Scoring** — one point per tile; a team’s score is how many it finished.',
    tileRace:
      '• **Tile race** — the board is an ordered track. You advance along it; your furthest tile is your position.',
    revealScheduled:
      '• **Reveals** — tiles open on a schedule set by staff. A tile you can’t see yet simply hasn’t opened.',
    revealIntervalOne: '• **Reveals** — a tile is drawn {order} every {minutes} minutes.',
    revealIntervalMany: '• **Reveals** — {n} tiles are drawn {order} every {minutes} minutes.',
    revealOrderRandom: 'at random',
    revealOrderBoard: 'in board order',
    revealBounty:
      '• **Bounty** — exactly one tile is open at a time. The first team to finish it closes it and the next is drawn.',
    revealRotating:
      '• **Rotating** — {n} tiles stay open at once; older ones expire as new ones draw. Finish them while they’re up.',
    revealAll: '• **Reveals** — the whole board is open from the start.',
    notRevealed:
      '• **Not revealed yet** — staff open the board when the event starts. Nobody can see the tiles before then.',
    lockout: '• **Lockout** — the first team to finish a tile takes it. Nobody else can score it after that.',
    firstBonus: '• **First-finish bonus** — the first team on a tile earns {amount} extra points.',
    decay:
      '• **Decay** — a tile is worth full points when it opens and slides to {pct}% over {hours}h. Early finishes score more.',
    growth: '• **Growth** — a tile starts at full value and climbs to {pct}% over {hours}h. Waiting scores more.',
    missions: '• **Missions** — extra objectives revealed mid-event, {when}. Nobody sees one before it’s announced.',
    missionWhenInterval: 'every {minutes} minutes',
    missionWhenScheduled: 'on a schedule',
    missionWhenManual: 'when staff drop them',
    missionBonusNote:
      '-# Mission points are a **bonus** — added to your score but never to the board total, so the board can’t get longer mid-event.',
    missionAnnouncedCount: '{announced} of {total} announced so far.',
    startProofStrict:
      '• **Starting shot** — every player files one screenshot after the start, at a location drawn at the start moment. Until you file yours, submissions are refused.',
    startProofFlag:
      '• **Starting shot** — every player files one screenshot after the start, at a location drawn at the start moment. Until you file yours, anything you submit is flagged for review.',
    startProofSession:
      '-# Log out and back in first — hiscores only save on logout, so your shot must be within {minutes} minutes of a fresh login.',
    teamChoice: '• **Teams** — you pick your team when you sign up; staff approve it.',
    captainInvites: '• **Teams** — captains hand out invite links for their own side.',
    entryFee: '• **Entry fee** — {amount} per entry.',
    prizePool: '• **Prize pool** — {amount} and rising with each approved entry.',

    trackingHeading: '**Getting credit**',
    trackingPlugin: '• **With the Anvil plugin** — it submits for you. Nothing to do but play.',
    trackingHiscoresAll:
      '• **No plugin?** Every tile here reads from the **official hiscores**, so they need no client at all — but hiscores only save when you **log out**, and refresh on the hour. Play → log out → wait for the hour.',
    trackingHiscoresSome:
      '• **No plugin?** {n} of these tiles read from the **official hiscores**, so they need no client at all — but hiscores only save when you **log out**, and refresh on the hour. Play → log out → wait for the hour.',
    trackingProofAll:
      '• **Drops, kills and timed tasks** need evidence — every tile here. The plugin files it automatically; without it, upload a screenshot yourself {where}.',
    trackingProofSome:
      '• **Drops, kills and timed tasks** need evidence — {n} of these. The plugin files it automatically; without it, upload a screenshot yourself {where}.',
    trackingWhereUrl: 'on **My Team** at {url}/team',
    trackingWhereNoUrl: 'on the My Team page',
    trackingKeepShot:
      '-# Keep your own screenshot of anything big either way — it costs nothing and settles any dispute.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Not on this board',
    notEntered: 'You aren’t entered in **{event}**.',
    notEnteredWhere: 'Sign-ups and your profile live at {url}.',
    onTeam: 'You’re on **{team}**.',
    onTeamRanked: 'You’re on **{team}** — {place} of {total}.',
    noTeamYet: 'You’re entered but not on a team yet.',
    finishedHiddenOne: 'You’ve finished 1 tile — names show once the board is revealed.',
    finishedHiddenMany: 'You’ve finished {n} tiles — names show once the board is revealed.',
    finishedHeading: '**Tiles you finished**',
    nothingYet: 'No tiles credited to you yet.',
  },

  team: {
    title: '🛡️ {team}',
    noTeamsTitle: '🔍 No teams yet',
    noTeamsBody: '**{event}** has no teams on it yet.',
    noMatchTitle: '🔍 No such team',
    noMatch: 'No team on **{event}** matches "{needle}".',
    noneOfYours: 'You’re not on a team — name one to look it up.',
    teamsList: '**Teams:** {names}',
    standing: '{place} of {total} — {score}{bonus} · {pct}% of the board.',
    bonusSuffix: ' (⚡+{n} mission bonus)',
    visitingWholeTeam: '🤝 A visiting clan: {names}',
    visitingSomeOne: '🤝 1 visiting player: {names}',
    visitingSomeMany: '🤝 {n} visiting players: {names}',
    recentHeading: '**Recent tiles**',
    hiddenBoard: 'Tiles on **{event}** aren’t revealed yet — team cards open when the board does.',
  },

  apply: {
    title: '📝 {event} — getting in',
    drafted: '**You’re in** — already drafted onto a team. Nothing left to do but play.',
    approved: '**You’re signed up and approved.** You’ll be placed on a team before the event starts.',
    pending: '**Your sign-up is in** and waiting on staff to approve it. Nothing more to do.',
    open: '**Sign-ups are open.**',
    notOpenYet: '**Sign-ups haven’t opened yet.**',
    eventStarted: '**The event has started**, so sign-ups are closed. Ask staff if there is still room.',
    closed: '**Sign-ups are closed.**',
    closesIn: 'They close {when}.',
    opensIn: 'They open {when}.',
    fee: 'Entry is {amount} — staff will tell you where to send it.',
    feePerAccount: 'Entry is {amount} per account — staff will tell you where to send it.',
    signUpAt: '**Sign up:** {url}',
    noAccountUrl:
      '-# Anvil doesn’t know your account yet. Link your RSN first at {url}/profile — sign-ups attach to an account, not a Discord name.',
    noAccountNoUrl:
      '-# Anvil doesn’t know your account yet. Link your RSN first on your profile page — sign-ups attach to an account, not a Discord name.',
  },

  next: {
    title: '⏭️ {event} — what’s next',
    eventStarts: '🚩 Event starts',
    eventEnds: '🏁 Event ends',
    nextTile: '🎲 Next tile drawn',
    nextMission: '⚡ Next mission',
    signupsClose: '📝 Sign-ups close',
    nothingEnded: 'Nothing left on the clock — this board has finished.',
    nothingScheduled: 'Nothing scheduled. Staff drop the next thing when they drop it.',
    hiddenMissionsOne: '-# 1 mission still to come, announced when staff drop them.',
    hiddenMissionsMany: '-# {n} missions still to come, announced when staff drop them.',
  },

  help: {
    title: '🔨 What Anvil can tell you',
    privateNote: '-# Answers are only visible to you. Use the **{share}** button under one to post it in the channel.',
    /** Per-subcommand blurbs. Keys are the subcommand names Discord registers. */
    subs: {
      board: 'The board that is running right now',
      leaderboard: 'Team standings',
      rules: 'How this board works — scoring, reveals, proof, plus the clan house rules',
      apply: 'How to get in — sign-ups, the fee, and where you stand',
      next: 'What’s coming — the next reveal, mission, or deadline',
      me: 'Your team, your tiles, your standing',
      help: 'What Anvil can tell you in here',
      team: 'A team’s card — score, roster, recent tiles',
    },
    /** The top-level `/bingo` description in Discord's own picker. */
    command: 'Anvil — check the clan board',
    optionTeamName: 'Team name (leave blank for your own team)',
  },

  rolePanel: {
    modalTitle: 'One more thing',
    modalLabel: 'Your RuneScape name',
    modalPlaceholder: 'Exactly as it appears in game',
    granted: '✅ You’re set up as **{label}**.',
    /** The option was edited or removed since the panel was posted. */
    optionGone: 'That button is out of date — ask staff to repost the panel.',
    grantFailed:
      '⚠️ Your roles didn’t apply. Anvil’s bot role has to sit **above** the roles it hands out — ask an admin to check.',
    rsnSaved: '📋 Saved **{rsn}** as your RuneScape name.',
    rsnSavedRenamed: '📋 Saved **{rsn}** as your RuneScape name, and set your nickname to match.',
    rsnPending: '-# A moderator still has to confirm the account is yours before it counts for events.',
    rsnInvalid: 'That doesn’t look like a RuneScape name — 1 to 12 characters, exactly as in game.',
    rsnTaken:
      '**{rsn}** is already linked to someone else. If that’s wrong, ask a moderator to sort it out.',
    failed: 'Anvil couldn’t finish that. An admin can check the site logs.',
  },

  errors: {
    dm: 'Run this in your clan’s Discord server — a board command needs to know which clan is asking.',
    wrongGuild:
      'This bot is connected to a different server than **{clan}**’s Anvil. Ask an admin to check the server ID under Integrations.',
    unknownCommand: 'Anvil doesn’t answer {command} — try {suggestion}.',
    unknownSub: 'Unknown command. Try {list}.',
    noBoards: '**{clan}** has no boards yet.',
    noBoardsStaff: 'Staff can make one at {url}/admin/events/new.',
    failed: 'Anvil hit an error answering that. An admin can check the site logs.',
    unsupported: 'That interaction type is not supported yet.',
    shareExpired: 'That answer is too old to share — run the command again.',
  },
};

export type DiscordDict = typeof en;

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** What a locale file exports: as much or as little of `en` as it has translated. */
export type PartialDiscordDict = DeepPartial<DiscordDict>;

export default en;
