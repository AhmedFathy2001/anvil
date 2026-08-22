import type { PartialDiscordDict } from './en';

// Nederlands — Dutch.
//
// De commandonamen blijven Engels: wie Nederlands leest, typt nog steeds `/bingo board`, en een
// vertaalde commandonaam is een commando dat niemand vindt. Hetzelfde geldt voor "Powered by
// Anvil". Al het andere — de uitleg, de volgorde, het waarom — staat in het Nederlands.

const nl: PartialDiscordDict = {
  common: {
    noTeams: '_Nog geen teams._',
    moreOnSite: '+{n} meer op de site',
    more: '+{n} meer',
    bonusLegend:
      '⚡ missiebonus — bovenop het bordtotaal verdiend, dus telt mee voor de score maar niet voor het percentage.',
    visitingClansOne: '🤝 {names} is een gastclan — dit bord wordt gedeeld.',
    visitingClansMany: '🤝 {names} zijn gastclans — dit bord wordt gedeeld.',
    visitingPlayersOne: '🤝 1 speler is te gast uit een andere clan.',
    visitingPlayersMany: '🤝 {n} spelers zijn te gast uit andere clans.',
    phaseRunning: 'loopt',
    phaseUpcoming: 'nog niet begonnen',
    phaseEnded: 'afgelopen',
    phaseDraft: 'concept',
    contextVisitingTeamsOne: 'clanoverstijgend · 1 gastteam',
    contextVisitingTeamsMany: 'clanoverstijgend · {n} gastteams',
    contextVisitingPlayersOne: '1 gastspeler',
    contextVisitingPlayersMany: '{n} gastspelers',
    shareButton: 'Deel in het kanaal',
    sharedBy: '-# Gedeeld door {who}',
    fieldFormat: 'Formaat',
    fieldTeams: 'Teams',
    fieldPlayers: 'Spelers',
    fieldTilesDone: 'Vakjes klaar',
    fieldTeamScore: 'Teamscore',
    fieldYourTiles: 'Jouw vakjes',
    fieldAccounts: 'Accounts',
    fieldRank: 'Plaats',
    fieldRoster: 'Selectie',
    fieldScore: 'Score',
  },

  board: {
    starts: 'Begint {when}.',
    ends: 'Eindigt {when}.',
    finished: 'Dit bord is afgelopen.',
    notScheduled: 'Nog niet ingepland.',
    hidden: 'De vakjes zijn nog verborgen — het bord gaat open zodra staff het vrijgeeft.',
  },

  leaderboard: { title: '🏆 {event} — stand' },

  rules: {
    title: '📜 {event} — zo werkt het',
    houseTitle: '📌 {clan} — huisregels',
    houseContinues: '**De regels gaan verder** — lees ze allemaal op',
    houseFull: 'Alle regels:',
    houseTrimmed: '-# Ingekort om in Discord te passen — vraag staff om het volledige reglement.',

    scoringPoints:
      '• **Punten** — elk vakje is zijn eigen punten waard; de score van een team is de som van wat het afmaakte.',
    scoringTiles: '• **Punten** — één punt per vakje; de score van een team is hoeveel het er afmaakte.',
    tileRace:
      '• **Vakjesrace** — het bord is een vaste route. Jullie schuiven erlangs op; jullie verste vakje is jullie positie.',
    revealScheduled:
      '• **Vrijgave** — vakjes gaan open volgens een schema van staff. Een vakje dat je nog niet ziet, is simpelweg nog niet open.',
    revealIntervalOne: '• **Vrijgave** — elke {minutes} minuten wordt {order} één vakje getrokken.',
    revealIntervalMany: '• **Vrijgave** — elke {minutes} minuten worden {order} {n} vakjes getrokken.',
    revealOrderRandom: 'willekeurig',
    revealOrderBoard: 'op bordvolgorde',
    revealBounty:
      '• **Premie** — er staat precies één vakje tegelijk open. Het eerste team dat het afmaakt sluit het, en het volgende wordt getrokken.',
    revealRotating:
      '• **Rotatie** — {n} vakjes staan tegelijk open; oudere verlopen zodra er nieuwe bij komen. Maak ze af zolang ze openstaan.',
    revealAll: '• **Vrijgave** — het hele bord staat vanaf het begin open.',
    notRevealed:
      '• **Nog niet vrijgegeven** — staff opent het bord bij de start van het event. Niemand ziet de vakjes daarvoor.',
    lockout: '• **Lockout** — het eerste team dat een vakje afmaakt, pakt het. Daarna kan niemand er nog voor scoren.',
    firstBonus: '• **Eerste-team-bonus** — het eerste team op een vakje krijgt {amount} extra punten.',
    decay:
      '• **Waardedaling** — een vakje is bij opening volledige punten waard en zakt in {hours} uur naar {pct}%. Vroeg afmaken levert meer op.',
    growth:
      '• **Waardestijging** — een vakje begint op volle waarde en klimt in {hours} uur naar {pct}%. Wachten levert meer op.',
    missions:
      '• **Missies** — extra doelen die tijdens het event worden vrijgegeven, {when}. Niemand ziet er één voordat hij is aangekondigd.',
    missionWhenInterval: 'elke {minutes} minuten',
    missionWhenScheduled: 'volgens een schema',
    missionWhenManual: 'wanneer staff ze eruit gooit',
    missionBonusNote:
      '-# Missiepunten zijn een **bonus** — ze komen bij jouw score maar nooit bij het bordtotaal, dus het bord kan tijdens het event niet langer worden.',
    missionAnnouncedCount: 'Tot nu toe {announced} van {total} aangekondigd.',
    startProofStrict:
      '• **Startfoto** — elke speler levert één screenshot in na de start, op een plek die op het startmoment wordt geloot. Tot je die van jou inlevert, wordt alles wat je instuurt geweigerd.',
    startProofFlag:
      '• **Startfoto** — elke speler levert één screenshot in na de start, op een plek die op het startmoment wordt geloot. Tot je die van jou inlevert, wordt alles wat je instuurt gemarkeerd voor controle.',
    startProofSession:
      '-# Log eerst uit en weer in — hiscores worden alleen bij uitloggen opgeslagen, dus je foto moet binnen {minutes} minuten na een verse login gemaakt zijn.',
    teamChoice: '• **Teams** — je kiest je team bij het aanmelden; staff keurt het goed.',
    captainInvites: '• **Teams** — de aanvoerders delen zelf uitnodigingslinks uit voor hun eigen kant.',
    entryFee: '• **Inschrijfgeld** — {amount} per aanmelding.',
    prizePool: '• **Prijzenpot** — {amount} en groeiend met elke goedgekeurde aanmelding.',

    trackingHeading: '**Zo krijg je het bijgeschreven**',
    trackingPlugin: '• **Met de Anvil-plugin** — die stuurt voor je in. Je hoeft niets te doen behalve spelen.',
    trackingHiscoresAll:
      '• **Geen plugin?** Elk vakje hier leest uit de **officiële hiscores**, dus die hebben helemaal geen client nodig — maar hiscores worden alleen opgeslagen als je **uitlogt**, en verversen op het hele uur. Spelen → uitloggen → wachten op het uur.',
    trackingHiscoresSome:
      '• **Geen plugin?** {n} van deze vakjes lezen uit de **officiële hiscores**, dus die hebben helemaal geen client nodig — maar hiscores worden alleen opgeslagen als je **uitlogt**, en verversen op het hele uur. Spelen → uitloggen → wachten op het uur.',
    trackingProofAll:
      '• **Drops, kills en vakjes op tijd** hebben bewijs nodig — hier elk vakje. De plugin legt het automatisch vast; zonder plugin upload je zelf een screenshot {where}.',
    trackingProofSome:
      '• **Drops, kills en vakjes op tijd** hebben bewijs nodig — {n} hiervan. De plugin legt het automatisch vast; zonder plugin upload je zelf een screenshot {where}.',
    trackingWhereUrl: 'bij **My Team** op {url}/team',
    trackingWhereNoUrl: 'op de pagina My Team',
    trackingKeepShot:
      '-# Maak sowieso je eigen screenshot van alles wat groot is — het kost niets en beslecht elke discussie.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Niet op dit bord',
    notEntered: 'Je bent niet aangemeld voor **{event}**.',
    notEnteredWhere: 'Aanmelden en je profiel staan op {url}.',
    onTeam: 'Je zit bij **{team}**.',
    onTeamRanked: 'Je zit bij **{team}** — {place} van {total}.',
    noTeamYet: 'Je bent aangemeld maar zit nog niet in een team.',
    finishedHiddenOne: 'Je hebt 1 vakje afgemaakt — de namen verschijnen zodra het bord is vrijgegeven.',
    finishedHiddenMany: 'Je hebt {n} vakjes afgemaakt — de namen verschijnen zodra het bord is vrijgegeven.',
    finishedHeading: '**Vakjes die je afmaakte**',
    nothingYet: 'Er is nog geen vakje aan jou toegeschreven.',
  },

  team: {
    noTeamsTitle: '🔍 Nog geen teams',
    noTeamsBody: '**{event}** heeft nog geen teams.',
    noMatchTitle: '🔍 Geen zo’n team',
    noMatch: 'Geen enkel team op **{event}** past bij "{needle}".',
    noneOfYours: 'Je zit niet in een team — noem er één om het op te zoeken.',
    teamsList: '**Teams:** {names}',
    standing: '{place} van {total} — {score}{bonus} · {pct}% van het bord.',
    bonusSuffix: ' (⚡+{n} missiebonus)',
    visitingWholeTeam: '🤝 Een gastclan: {names}',
    visitingSomeOne: '🤝 1 gastspeler: {names}',
    visitingSomeMany: '🤝 {n} gastspelers: {names}',
    recentHeading: '**Laatste vakjes**',
    hiddenBoard: 'De vakjes van **{event}** zijn nog niet vrijgegeven — teamkaarten gaan open met het bord.',
  },

  apply: {
    title: '📝 {event} — zo kom je erin',
    drafted: '**Je doet mee** — al gedraft in een team. Er valt niets meer te doen dan spelen.',
    approved: '**Je bent aangemeld en goedgekeurd.** Je wordt vóór de start in een team gezet.',
    pending: '**Je aanmelding staat er** en wacht op goedkeuring van staff. Meer hoef je niet te doen.',
    open: '**De aanmeldingen zijn open.**',
    notOpenYet: '**De aanmeldingen zijn nog niet open.**',
    eventStarted: '**Het event is begonnen**, dus de aanmeldingen zijn dicht. Vraag staff of er nog plek is.',
    closed: '**De aanmeldingen zijn gesloten.**',
    closesIn: 'Ze sluiten {when}.',
    opensIn: 'Ze openen {when}.',
    fee: 'Deelname kost {amount} — staff vertelt je waar je het heen stuurt.',
    feePerAccount: 'Deelname kost {amount} per account — staff vertelt je waar je het heen stuurt.',
    signUpAt: '**Aanmelden:** {url}',
    noAccountUrl:
      '-# Anvil kent je account nog niet. Koppel eerst je RSN op {url}/profile — aanmeldingen hangen aan een account, niet aan een Discord-naam.',
    noAccountNoUrl:
      '-# Anvil kent je account nog niet. Koppel eerst je RSN op je profielpagina — aanmeldingen hangen aan een account, niet aan een Discord-naam.',
  },

  next: {
    title: '⏭️ {event} — wat er nu komt',
    eventStarts: '🚩 Event begint',
    eventEnds: '🏁 Event eindigt',
    nextTile: '🎲 Volgend vakje getrokken',
    nextMission: '⚡ Volgende missie',
    signupsClose: '📝 Aanmeldingen sluiten',
    nothingEnded: 'Niets meer op de klok — dit bord is afgelopen.',
    nothingScheduled: 'Niets ingepland. Staff gooit het volgende eruit wanneer ze dat doen.',
    hiddenMissionsOne: '-# Er komt nog 1 missie, aangekondigd zodra staff hem eruit gooit.',
    hiddenMissionsMany: '-# Er komen nog {n} missies, aangekondigd zodra staff ze eruit gooit.',
  },

  help: {
    title: '🔨 Dit kan Anvil je vertellen',
    privateNote:
      '-# Antwoorden zijn alleen voor jou zichtbaar. Gebruik de knop **{share}** onder een antwoord om het in het kanaal te zetten.',
    subs: {
      board: 'Het bord dat nu loopt',
      leaderboard: 'Teamstand',
      rules: 'Zo werkt het bord — punten, vrijgave, bewijs, plus de huisregels van de clan',
      apply: 'Zo kom je erin — aanmelden, het inschrijfgeld, en hoe jij ervoor staat',
      next: 'Wat eraan komt — de volgende vrijgave, missie of deadline',
      me: 'Jouw team, jouw vakjes, jouw plaats',
      help: 'Wat Anvil je hier kan vertellen',
      team: 'De kaart van een team — score, selectie, laatste vakjes',
    },
    command: 'Anvil — bekijk het clanbord',
    optionTeamName: 'Teamnaam (laat leeg voor je eigen team)',
  },

  errors: {
    dm: 'Voer dit uit in de Discord-server van je clan — een bordcommando moet weten welke clan het vraagt.',
    wrongGuild:
      'Deze bot hangt aan een andere server dan de Anvil van **{clan}**. Vraag een admin om het server-ID onder Integrations te controleren.',
    unknownCommand: 'Anvil beantwoordt {command} niet — probeer {suggestion}.',
    unknownSub: 'Onbekend commando. Probeer {list}.',
    noBoards: '**{clan}** heeft nog geen borden.',
    noBoardsStaff: 'Staff kan er een maken op {url}/admin/events/new.',
    failed: 'Anvil liep tegen een fout aan. Een admin kan de logs van de site bekijken.',
    unsupported: 'Dat interactietype wordt nog niet ondersteund.',
    shareExpired: 'Dat antwoord is te oud om te delen — voer het commando opnieuw uit.',
  },
};

export default nl;
