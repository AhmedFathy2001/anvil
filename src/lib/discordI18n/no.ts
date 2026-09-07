import type { PartialDiscordDict } from './en';

// Norsk — Norwegian.
//
// Kommandonavnene blir stående på engelsk: en nordmann skriver fortsatt `/bingo board`, og et
// oversatt kommandonavn er en kommando ingen finner. Det samme gjelder "Powered by Anvil". Alt
// annet — forklaringen, rekkefølgen, hvorfor — er på norsk.

const no: PartialDiscordDict = {
  common: {
    noTeams: '_Ingen lag ennå._',
    moreOnSite: '+{n} til på nettsiden',
    more: '+{n} til',
    synced: 'Synkronisert {when}',
    bonusLegend:
      '⚡ oppdragsbonus — tjent på toppen av brettets total, så den teller i poengsummen, men ikke i prosenten.',
    visitingClansOne: '🤝 {names} er en gjesteklan — dette brettet er delt.',
    visitingClansMany: '🤝 {names} er gjesteklaner — dette brettet er delt.',
    visitingPlayersOne: '🤝 1 spiller gjester fra en annen klan.',
    visitingPlayersMany: '🤝 {n} spillere gjester fra andre klaner.',
    phaseRunning: 'pågår',
    phaseUpcoming: 'ikke startet',
    phaseEnded: 'avsluttet',
    phaseDraft: 'utkast',
    contextVisitingTeamsOne: 'på tvers av klaner · 1 gjestelag',
    contextVisitingTeamsMany: 'på tvers av klaner · {n} gjestelag',
    contextVisitingPlayersOne: '1 gjestespiller',
    contextVisitingPlayersMany: '{n} gjestespillere',
    shareButton: 'Del i kanalen',
    sharedBy: '-# Delt av {who}',
    fieldFormat: 'Format',
    fieldTeams: 'Lag',
    fieldPlayers: 'Spillere',
    fieldTilesDone: 'Ruter fullført',
    fieldTeamScore: 'Lagets poeng',
    fieldYourTiles: 'Dine ruter',
    fieldAccounts: 'Kontoer',
    fieldRank: 'Plassering',
    fieldRoster: 'Tropp',
    fieldScore: 'Poeng',
  },

  stats: {
    rank: '#{rank} av {total} i {clan}',
  },

  board: {
    starts: 'Starter {when}.',
    ends: 'Slutter {when}.',
    finished: 'Dette brettet er ferdig.',
    notScheduled: 'Ikke planlagt ennå.',
    hidden: 'Rutene er fortsatt skjult — brettet åpnes når staff avslører det.',
  },

  leaderboard: { title: '🏆 {event} — stilling' },

  rules: {
    title: '📜 {event} — slik fungerer det',
    houseTitle: '📌 {clan} — husregler',
    houseContinues: '**Reglene fortsetter** — les alle på',
    houseFull: 'Alle regler:',
    houseTrimmed: '-# Forkortet for å få plass i Discord — spør staff om hele regelverket.',

    scoringPoints:
      '• **Poeng** — hver rute er verdt sine egne poeng; et lags poengsum er summen av det de har fullført.',
    scoringTiles: '• **Poeng** — ett poeng per rute; et lags poengsum er hvor mange de har fullført.',
    tileRace:
      '• **Ruteløp** — brettet er en fastsatt løype. Dere rykker fremover langs den; deres fjerneste rute er plasseringen deres.',
    revealScheduled:
      '• **Avsløringer** — ruter åpnes etter en plan satt av staff. En rute du ikke ser ennå, har rett og slett ikke åpnet.',
    revealIntervalOne: '• **Avsløringer** — én rute trekkes {order} hvert {minutes}. minutt.',
    revealIntervalMany: '• **Avsløringer** — {n} ruter trekkes {order} hvert {minutes}. minutt.',
    revealOrderRandom: 'tilfeldig',
    revealOrderBoard: 'i brettrekkefølge',
    revealBounty:
      '• **Dusør** — nøyaktig én rute er åpen om gangen. Det første laget som fullfører den, lukker den, og den neste trekkes.',
    revealRotating:
      '• **Rotasjon** — {n} ruter står åpne samtidig; de eldste utløper etter hvert som nye trekkes. Fullfør dem mens de er oppe.',
    revealAll: '• **Avsløringer** — hele brettet er åpent fra start.',
    notRevealed:
      '• **Ikke avslørt ennå** — staff åpner brettet når arrangementet starter. Ingen ser rutene før da.',
    lockout: '• **Lockout** — det første laget som fullfører en rute, tar den. Ingen andre kan få poeng for den etterpå.',
    firstBonus: '• **Førstebonus** — det første laget på en rute får {amount} ekstra poeng.',
    decay:
      '• **Fall** — en rute gir fulle poeng når den åpner, og glir til {pct}% over {hours} timer. Tidlige fullføringer gir mer.',
    growth:
      '• **Vekst** — en rute starter på full verdi og stiger til {pct}% over {hours} timer. Å vente gir mer.',
    missions:
      '• **Oppdrag** — ekstra mål som avsløres underveis, {when}. Ingen ser et før det annonseres.',
    missionWhenInterval: 'hvert {minutes}. minutt',
    missionWhenScheduled: 'etter en plan',
    missionWhenManual: 'når staff slipper dem',
    missionBonusNote:
      '-# Oppdragspoeng er en **bonus** — lagt til poengsummen din, men aldri til brettets total, så brettet kan ikke bli lengre underveis.',
    missionAnnouncedCount: '{announced} av {total} annonsert så langt.',
    startProofStrict:
      '• **Startbilde** — hver spiller leverer ett skjermbilde etter starten, på et sted trukket i startøyeblikket. Til du leverer ditt, avvises alt du sender inn.',
    startProofFlag:
      '• **Startbilde** — hver spiller leverer ett skjermbilde etter starten, på et sted trukket i startøyeblikket. Til du leverer ditt, merkes alt du sender inn for gjennomgang.',
    startProofSession:
      '-# Logg ut og inn igjen først — hiscores lagres bare ved utlogging, så bildet ditt må tas innen {minutes} minutter etter en fersk innlogging.',
    teamChoice: '• **Lag** — du velger lag når du melder deg på; staff godkjenner det.',
    captainInvites: '• **Lag** — kapteinene deler selv ut invitasjonslenker til sin egen side.',
    entryFee: '• **Deltakeravgift** — {amount} per påmelding.',
    prizePool: '• **Premiepott** — {amount} og økende for hver godkjente påmelding.',

    trackingHeading: '**Slik får du poeng**',
    trackingPlugin: '• **Med Anvil-pluginen** — den sender inn for deg. Det er ingenting å gjøre annet enn å spille.',
    trackingHiscoresAll:
      '• **Ingen plugin?** Hver eneste rute her leses fra de **offisielle hiscores**, så de krever ingen klient i det hele tatt — men hiscores lagres bare når du **logger ut**, og oppdateres på hel time. Spill → logg ut → vent på timen.',
    trackingHiscoresSome:
      '• **Ingen plugin?** {n} av disse rutene leses fra de **offisielle hiscores**, så de krever ingen klient i det hele tatt — men hiscores lagres bare når du **logger ut**, og oppdateres på hel time. Spill → logg ut → vent på timen.',
    trackingProofAll:
      '• **Drops, kills og ruter på tid** krever bevis — det gjelder hver eneste rute her. Pluginen arkiverer det automatisk; uten den laster du opp et skjermbilde selv {where}.',
    trackingProofSome:
      '• **Drops, kills og ruter på tid** krever bevis — {n} av disse. Pluginen arkiverer det automatisk; uten den laster du opp et skjermbilde selv {where}.',
    trackingWhereUrl: 'på **My Team** på {url}/team',
    trackingWhereNoUrl: 'på My Team-siden',
    trackingKeepShot:
      '-# Ta vare på ditt eget skjermbilde av alt stort uansett — det koster ingenting og avgjør enhver diskusjon.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Ikke med på dette brettet',
    notEntered: 'Du er ikke påmeldt **{event}**.',
    notEnteredWhere: 'Påmelding og profilen din finnes på {url}.',
    onTeam: 'Du er på **{team}**.',
    onTeamRanked: 'Du er på **{team}** — {place} av {total}.',
    noTeamYet: 'Du er påmeldt, men ikke satt på et lag ennå.',
    finishedHiddenOne: 'Du har fullført 1 rute — navnene vises når brettet avsløres.',
    finishedHiddenMany: 'Du har fullført {n} ruter — navnene vises når brettet avsløres.',
    finishedHeading: '**Ruter du har fullført**',
    nothingYet: 'Ingen ruter er kreditert deg ennå.',
  },

  team: {
    noTeamsTitle: '🔍 Ingen lag ennå',
    noTeamsBody: '**{event}** har ingen lag på seg ennå.',
    noMatchTitle: '🔍 Ingen slikt lag',
    noMatch: 'Ingen lag på **{event}** samsvarer med "{needle}".',
    noneOfYours: 'Du er ikke på et lag — skriv et navn for å slå det opp.',
    teamsList: '**Lag:** {names}',
    standing: '{place} av {total} — {score}{bonus} · {pct}% av brettet.',
    bonusSuffix: ' (⚡+{n} oppdragsbonus)',
    visitingWholeTeam: '🤝 En gjesteklan: {names}',
    visitingSomeOne: '🤝 1 gjestespiller: {names}',
    visitingSomeMany: '🤝 {n} gjestespillere: {names}',
    recentHeading: '**Siste ruter**',
    hiddenBoard: 'Rutene på **{event}** er ikke avslørt ennå — lagkortene åpnes når brettet gjør det.',
  },

  apply: {
    title: '📝 {event} — slik blir du med',
    drafted: '**Du er med** — allerede draftet til et lag. Ingenting igjen å gjøre annet enn å spille.',
    approved: '**Du er påmeldt og godkjent.** Du blir satt på et lag før arrangementet starter.',
    pending: '**Påmeldingen din er inne** og venter på at staff godkjenner den. Ikke noe mer å gjøre.',
    open: '**Påmeldingen er åpen.**',
    notOpenYet: '**Påmeldingen har ikke åpnet ennå.**',
    eventStarted: '**Arrangementet har startet**, så påmeldingen er stengt. Spør staff om det fortsatt er plass.',
    closed: '**Påmeldingen er stengt.**',
    closesIn: 'Den stenger {when}.',
    opensIn: 'Den åpner {when}.',
    fee: 'Det koster {amount} — staff sier hvor du sender det.',
    feePerAccount: 'Det koster {amount} per konto — staff sier hvor du sender det.',
    signUpAt: '**Meld deg på:** {url}',
    noAccountUrl:
      '-# Anvil kjenner ikke kontoen din ennå. Koble RSN-en din først på {url}/profile — påmeldinger henger på en konto, ikke på et Discord-navn.',
    noAccountNoUrl:
      '-# Anvil kjenner ikke kontoen din ennå. Koble RSN-en din først på profilsiden din — påmeldinger henger på en konto, ikke på et Discord-navn.',
  },

  next: {
    title: '⏭️ {event} — hva som kommer',
    eventStarts: '🚩 Arrangementet starter',
    eventEnds: '🏁 Arrangementet slutter',
    nextTile: '🎲 Neste rute trekkes',
    nextMission: '⚡ Neste oppdrag',
    signupsClose: '📝 Påmeldingen stenger',
    nothingEnded: 'Ingenting igjen på klokka — dette brettet er ferdig.',
    nothingScheduled: 'Ingenting planlagt. Staff slipper det neste når de slipper det.',
    hiddenMissionsOne: '-# 1 oppdrag gjenstår, annonseres når staff slipper det.',
    hiddenMissionsMany: '-# {n} oppdrag gjenstår, annonseres når staff slipper dem.',
  },

  help: {
    title: '🔨 Dette kan Anvil fortelle deg',
    privateNote:
      '-# Svarene er bare synlige for deg. Bruk **{share}**-knappen under et svar for å legge det i kanalen.',
    subs: {
      board: 'Brettet som går akkurat nå',
      leaderboard: 'Lagstilling',
      rules: 'Slik fungerer brettet — poeng, avsløringer, bevis, pluss klanens husregler',
      apply: 'Slik blir du med — påmelding, avgiften, og hvor du står',
      next: 'Hva som kommer — neste avsløring, oppdrag eller frist',
      me: 'Laget ditt, rutene dine, plasseringen din',
      help: 'Hva Anvil kan fortelle deg her inne',
      team: 'Et lags kort — poeng, tropp, siste ruter',
    },
    command: 'Anvil — sjekk klanens brett',
    optionTeamName: 'Lagnavn (la stå tomt for ditt eget lag)',
  },

  errors: {
    dm: 'Kjør den i klanens Discord-server — en brettkommando må vite hvilken klan som spør.',
    wrongGuild:
      'Denne boten er koblet til en annen server enn **{clan}** sin Anvil. Be en admin sjekke server-ID-en under Integrations.',
    unknownCommand: 'Anvil svarer ikke på {command} — prøv {suggestion}.',
    unknownSub: 'Ukjent kommando. Prøv {list}.',
    noBoards: '**{clan}** har ingen brett ennå.',
    noBoardsStaff: 'Staff kan lage ett på {url}/admin/events/new.',
    failed: 'Anvil støtte på en feil. En admin kan sjekke loggene til nettsiden.',
    unsupported: 'Den interaksjonstypen støttes ikke ennå.',
    shareExpired: 'Det svaret er for gammelt til å dele — kjør kommandoen på nytt.',
  },

  commands: {
    sotw: 'Skill of the Week — livestilling',
    botw: 'Boss of the Week — livestilling',
    eff: 'Effektivitet (EHP/EHB) — topplisten og din plassering',
    coffer: 'Klankisten — saldo, givere og staff legger til/fjerner',
    clog: 'Collection log — et medlems antall og klanens fremste samlere',
    luck: 'Drop-flaks — klanens tørreste og heldigste, eller et medlems',
    guide: 'Les en oppsettsguide — oversikten eller ett trinn, med en lenke',
  },

  multi: {
    liveTitle: '📋 Aktive brett',
    liveIntro: '{n} brett er aktive akkurat nå.',
    standingsTitle: '🏆 Aktuelle stillinger',
    standingsIntro: 'Stilling på tvers av {n} aktive brett.',
    teamsOne: '1 lag',
    teamsMany: '{n} lag',
    leader: 'ledet av {team} ({score})',
  },

  weekly: {
    sotwTitle: '📈 {title}',
    botwTitle: '⚔️ {title}',
    sotwEmpty: 'Ingen Skill of the Week kjører i {clan} akkurat nå.',
    botwEmpty: 'Ingen Boss of the Week kjører i {clan} akkurat nå.',
    ends: 'Slutter {when}.',
    noEntries: 'Ingen har meldt seg på ennå.',
    you: 'Du: {place} av {total}.',
    youNone: 'Du er ikke påmeldt — bli med via pluginen eller på nettsiden.',
    fieldMetric: 'Metrikk',
    fieldEntries: 'Påmeldte',
  },

  eff: {
    title: '⚡ Effektivitet — {metric}',
    empty: 'Ingen effektivitetsdata ennå — medlemmene trenger en stats-oppdatering først.',
    you: 'Du: #{rank} av {total}.',
    fieldRanked: 'Rangert',
  },

  coffer: {
    title: '💰 {clan} — kiste',
    none: 'Ingen kiste ennå — {clan} har ikke registrert noen gp-bevegelser.',
    available: 'Tilgjengelig',
    reserved: 'Reservert',
    pending: 'Venter',
    donorsHeading: '**Største givere**',
    recentHeading: '**Siste bevegelser**',
    needAccount:
      'Koble Anvil-kontoen din på nettsiden først — endringer i kisten henger på nettside-innloggingen din, ikke Discord-navnet ditt.',
    notStaff: 'Bare kasserere, admins og eiere kan flytte kisten.',
    badAmount: 'Oppgi et beløp som skal legges til eller fjernes, f.eks. `5m` eller `2500000`.',
    outOfRange: 'Det beløpet er utenfor gyldig område.',
    added: '✅ La til {amount} i kisten — {available} tilgjengelig nå.',
    removed: '✅ Fjernet {amount} fra kisten — {available} tilgjengelig nå.',
  },

  clog: {
    title: '📖 {who} — collection log',
    notSynced: '{who} har ikke synkronisert en collection log ennå — synkronisér den fra Anvil-pluginen.',
    rankLine: '#{rank} av {total} samlere i {clan}.',
    topHeading: '**Største samlere**',
    slots: 'Slots',
    collectors: 'Samlere',
  },

  luck: {
    boardsTitle: '🍀 {clan} — flaks',
    memberTitle: '🍀 {who} — flaks',
    dryHeading: '**Tørrest**',
    spoonedHeading: '**Heldigst**',
    emptyBoards: 'Ingen flaksdata ennå — medlemmene må synkronisere collection log-ene sine.',
    notSynced: '{who} har ikke synkronisert en collection log ennå.',
    totalLine: 'Totalt: {net} på tvers av {items} sporede drops.',
    fromLogs: 'Fra {n} synkroniserte logger.',
  },

  guide: {
    notFound: 'Jeg har ingen guide med det navnet.',
    stepsHeading: '**Trinn**',
    stepsField: 'Trinn',
    stepTitle: 'Trinn {n}/{total} — {title}',
    noSuchStep: 'Denne guiden har {total} trinn — velg et tall fra 1 til {total}.',
    readFull: '📖 Les hele guiden: {url}',
    openStep: '🔗 Åpne dette trinnet på siden: {url}',
    jumpHint: '-# Hopp til et trinn: `/guide topic:{topic} step:1`',
  },
};

export default no;
