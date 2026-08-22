import type { PartialDiscordDict } from './en';

// Dansk — Danish.
//
// Kommandonavnene selv bliver på engelsk: en dansker skriver stadig `/bingo board`, og et oversat
// kommandonavn er en kommando, ingen kan finde. Det samme gælder "Powered by Anvil". Alt andet —
// forklaringen, rækkefølgen, hvorfor — er på dansk.

const da: PartialDiscordDict = {
  common: {
    noTeams: '_Ingen hold endnu._',
    moreOnSite: '+{n} mere på siden',
    more: '+{n} mere',
    bonusLegend:
      '⚡ missionsbonus — optjent oven på brættets total, så den tæller med i scoren, men ikke i procenten.',
    visitingClansOne: '🤝 {names} er en gæsteklan — dette bræt er delt.',
    visitingClansMany: '🤝 {names} er gæsteklaner — dette bræt er delt.',
    visitingPlayersOne: '🤝 1 spiller er på besøg fra en anden klan.',
    visitingPlayersMany: '🤝 {n} spillere er på besøg fra andre klaner.',
    phaseRunning: 'i gang',
    phaseUpcoming: 'ikke startet',
    phaseEnded: 'afsluttet',
    phaseDraft: 'kladde',
    contextVisitingTeamsOne: 'på tværs af klaner · 1 gæstehold',
    contextVisitingTeamsMany: 'på tværs af klaner · {n} gæstehold',
    contextVisitingPlayersOne: '1 gæstespiller',
    contextVisitingPlayersMany: '{n} gæstespillere',
    shareButton: 'Del i kanalen',
    sharedBy: '-# Delt af {who}',
    fieldFormat: 'Format',
    fieldTeams: 'Hold',
    fieldPlayers: 'Spillere',
    fieldTilesDone: 'Felter klaret',
    fieldTeamScore: 'Holdets score',
    fieldYourTiles: 'Dine felter',
    fieldAccounts: 'Konti',
    fieldRank: 'Placering',
    fieldRoster: 'Trup',
    fieldScore: 'Score',
  },

  board: {
    starts: 'Starter {when}.',
    ends: 'Slutter {when}.',
    finished: 'Dette bræt er slut.',
    notScheduled: 'Ikke planlagt endnu.',
    hidden: 'Felterne er stadig skjulte — brættet åbner, når staff afslører det.',
  },

  leaderboard: { title: '🏆 {event} — stilling' },

  rules: {
    title: '📜 {event} — sådan virker det',
    houseTitle: '📌 {clan} — husregler',
    houseContinues: '**Reglerne fortsætter** — læs dem alle på',
    houseFull: 'Alle regler:',
    houseTrimmed: '-# Forkortet for at passe i Discord — spørg staff om hele regelsættet.',

    scoringPoints:
      '• **Point** — hvert felt er sine egne point værd; et holds score er summen af det, de har klaret.',
    scoringTiles: '• **Point** — ét point pr. felt; et holds score er, hvor mange de har klaret.',
    tileRace:
      '• **Feltræs** — brættet er en fastlagt bane. I rykker frem ad den; jeres fjerneste felt er jeres placering.',
    revealScheduled:
      '• **Afsløringer** — felter åbner efter en plan lagt af staff. Et felt, du ikke kan se endnu, er simpelthen ikke åbnet.',
    revealIntervalOne: '• **Afsløringer** — ét felt trækkes {order} hvert {minutes}. minut.',
    revealIntervalMany: '• **Afsløringer** — {n} felter trækkes {order} hvert {minutes}. minut.',
    revealOrderRandom: 'tilfældigt',
    revealOrderBoard: 'i brætrækkefølge',
    revealBounty:
      '• **Dusør** — præcis ét felt er åbent ad gangen. Det første hold, der klarer det, lukker det, og det næste trækkes.',
    revealRotating:
      '• **Rotation** — {n} felter er åbne ad gangen; de ældste udløber, efterhånden som nye trækkes. Klar dem, mens de er oppe.',
    revealAll: '• **Afsløringer** — hele brættet er åbent fra start.',
    notRevealed:
      '• **Ikke afsløret endnu** — staff åbner brættet, når eventet starter. Ingen kan se felterne før da.',
    lockout: '• **Lockout** — det første hold, der klarer et felt, tager det. Ingen andre kan score det bagefter.',
    firstBonus: '• **Førstebonus** — det første hold på et felt får {amount} ekstra point.',
    decay:
      '• **Fald** — et felt giver fulde point, når det åbner, og glider til {pct}% over {hours} timer. Tidlige klar giver mere.',
    growth:
      '• **Vækst** — et felt starter ved fuld værdi og stiger til {pct}% over {hours} timer. At vente giver mere.',
    missions:
      '• **Missioner** — ekstra mål, der afsløres undervejs, {when}. Ingen ser en, før den er annonceret.',
    missionWhenInterval: 'hvert {minutes}. minut',
    missionWhenScheduled: 'efter en plan',
    missionWhenManual: 'når staff smider dem',
    missionBonusNote:
      '-# Missionspoint er en **bonus** — lagt til din score, men aldrig til brættets total, så brættet kan ikke blive længere undervejs.',
    missionAnnouncedCount: '{announced} af {total} annonceret indtil videre.',
    startProofStrict:
      '• **Startbillede** — hver spiller afleverer ét screenshot efter starten, på et sted trukket i startøjeblikket. Indtil du afleverer dit, afvises alt, du indsender.',
    startProofFlag:
      '• **Startbillede** — hver spiller afleverer ét screenshot efter starten, på et sted trukket i startøjeblikket. Indtil du afleverer dit, markeres alt, du indsender, til gennemsyn.',
    startProofSession:
      '-# Log ud og ind igen først — hiscores gemmes kun ved logout, så dit billede skal være inden for {minutes} minutter efter et frisk login.',
    teamChoice: '• **Hold** — du vælger dit hold, når du melder dig til; staff godkender det.',
    captainInvites: '• **Hold** — anførerne deler selv invitationslinks ud til deres egen side.',
    entryFee: '• **Deltagergebyr** — {amount} pr. tilmelding.',
    prizePool: '• **Præmiepulje** — {amount} og stigende for hver godkendt tilmelding.',

    trackingHeading: '**Sådan får du point**',
    trackingPlugin: '• **Med Anvil-pluginnet** — det indsender for dig. Der er intet at gøre andet end at spille.',
    trackingHiscoresAll:
      '• **Intet plugin?** Hvert eneste felt her læses fra de **officielle hiscores**, så de kræver slet ingen klient — men hiscores gemmes kun, når du **logger ud**, og opdateres på hele timer. Spil → log ud → vent på timen.',
    trackingHiscoresSome:
      '• **Intet plugin?** {n} af disse felter læses fra de **officielle hiscores**, så de kræver slet ingen klient — men hiscores gemmes kun, når du **logger ud**, og opdateres på hele timer. Spil → log ud → vent på timen.',
    trackingProofAll:
      '• **Drops, kills og felter på tid** kræver bevis — det gælder hvert eneste felt her. Pluginnet arkiverer det automatisk; uden det uploader du selv et screenshot {where}.',
    trackingProofSome:
      '• **Drops, kills og felter på tid** kræver bevis — {n} af disse. Pluginnet arkiverer det automatisk; uden det uploader du selv et screenshot {where}.',
    trackingWhereUrl: 'på **My Team** på {url}/team',
    trackingWhereNoUrl: 'på My Team-siden',
    trackingKeepShot:
      '-# Gem selv et screenshot af alt stort uanset hvad — det koster ingenting og afgør enhver diskussion.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Ikke på dette bræt',
    notEntered: 'Du er ikke tilmeldt **{event}**.',
    notEnteredWhere: 'Tilmelding og din profil findes på {url}.',
    onTeam: 'Du er på **{team}**.',
    onTeamRanked: 'Du er på **{team}** — {place} af {total}.',
    noTeamYet: 'Du er tilmeldt, men er ikke på et hold endnu.',
    finishedHiddenOne: 'Du har klaret 1 felt — navnene vises, når brættet afsløres.',
    finishedHiddenMany: 'Du har klaret {n} felter — navnene vises, når brættet afsløres.',
    finishedHeading: '**Felter du har klaret**',
    nothingYet: 'Ingen felter er krediteret dig endnu.',
  },

  team: {
    noTeamsTitle: '🔍 Ingen hold endnu',
    noTeamsBody: '**{event}** har ingen hold på sig endnu.',
    noMatchTitle: '🔍 Intet sådant hold',
    noMatch: 'Intet hold på **{event}** matcher "{needle}".',
    noneOfYours: 'Du er ikke på et hold — skriv et navn for at slå det op.',
    teamsList: '**Hold:** {names}',
    standing: '{place} af {total} — {score}{bonus} · {pct}% af brættet.',
    bonusSuffix: ' (⚡+{n} missionsbonus)',
    visitingWholeTeam: '🤝 En gæsteklan: {names}',
    visitingSomeOne: '🤝 1 gæstespiller: {names}',
    visitingSomeMany: '🤝 {n} gæstespillere: {names}',
    recentHeading: '**Seneste felter**',
    hiddenBoard: 'Felterne på **{event}** er ikke afsløret endnu — holdkort åbner, når brættet gør.',
  },

  apply: {
    title: '📝 {event} — sådan kommer du med',
    drafted: '**Du er med** — allerede draftet til et hold. Der er ikke andet tilbage end at spille.',
    approved: '**Du er tilmeldt og godkendt.** Du bliver sat på et hold, før eventet starter.',
    pending: '**Din tilmelding er inde** og venter på, at staff godkender den. Der er ikke mere at gøre.',
    open: '**Tilmeldingen er åben.**',
    notOpenYet: '**Tilmeldingen er ikke åbnet endnu.**',
    eventStarted: '**Eventet er startet**, så tilmeldingen er lukket. Spørg staff, om der stadig er plads.',
    closed: '**Tilmeldingen er lukket.**',
    closesIn: 'Den lukker {when}.',
    opensIn: 'Den åbner {when}.',
    fee: 'Det koster {amount} — staff fortæller dig, hvor du sender det hen.',
    feePerAccount: 'Det koster {amount} pr. konto — staff fortæller dig, hvor du sender det hen.',
    signUpAt: '**Tilmeld dig:** {url}',
    noAccountUrl:
      '-# Anvil kender ikke din konto endnu. Forbind dit RSN først på {url}/profile — tilmeldinger hænger på en konto, ikke på et Discord-navn.',
    noAccountNoUrl:
      '-# Anvil kender ikke din konto endnu. Forbind dit RSN først på din profilside — tilmeldinger hænger på en konto, ikke på et Discord-navn.',
  },

  next: {
    title: '⏭️ {event} — hvad er det næste',
    eventStarts: '🚩 Eventet starter',
    eventEnds: '🏁 Eventet slutter',
    nextTile: '🎲 Næste felt trækkes',
    nextMission: '⚡ Næste mission',
    signupsClose: '📝 Tilmeldingen lukker',
    nothingEnded: 'Intet tilbage på uret — dette bræt er slut.',
    nothingScheduled: 'Intet planlagt. Staff smider det næste, når de smider det.',
    hiddenMissionsOne: '-# 1 mission mangler stadig, annonceres når staff smider den.',
    hiddenMissionsMany: '-# {n} missioner mangler stadig, annonceres når staff smider dem.',
  },

  help: {
    title: '🔨 Det her kan Anvil fortælle dig',
    privateNote:
      '-# Svarene kan kun ses af dig. Brug knappen **{share}** under et svar for at lægge det i kanalen.',
    subs: {
      board: 'Brættet der kører lige nu',
      leaderboard: 'Holdstilling',
      rules: 'Sådan virker brættet — point, afsløringer, beviser, plus klanens husregler',
      apply: 'Sådan kommer du med — tilmelding, gebyr, og hvor du står',
      next: 'Hvad der kommer — næste afsløring, mission eller deadline',
      me: 'Dit hold, dine felter, din placering',
      help: 'Hvad Anvil kan fortælle dig herinde',
      team: 'Et holds kort — score, trup, seneste felter',
    },
    command: 'Anvil — tjek klanens bræt',
    optionTeamName: 'Holdnavn (lad stå tomt for dit eget hold)',
  },

  errors: {
    dm: 'Kør den i din klans Discord-server — en brætkommando skal vide, hvilken klan der spørger.',
    wrongGuild:
      'Denne bot er forbundet til en anden server end **{clan}**s Anvil. Bed en admin tjekke server-id’et under Integrations.',
    unknownCommand: 'Anvil svarer ikke på {command} — prøv {suggestion}.',
    unknownSub: 'Ukendt kommando. Prøv {list}.',
    noBoards: '**{clan}** har ingen brætter endnu.',
    noBoardsStaff: 'Staff kan lave et på {url}/admin/events/new.',
    failed: 'Anvil løb ind i en fejl. En admin kan tjekke sidens logs.',
    unsupported: 'Den interaktionstype understøttes ikke endnu.',
    shareExpired: 'Det svar er for gammelt til at dele — kør kommandoen igen.',
  },
};

export default da;
