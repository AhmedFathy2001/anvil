import type { PartialDiscordDict } from './en';

// Svenska — Swedish.
//
// Kommandonamnen står kvar på engelska: en svensk skriver fortfarande `/bingo board`, och ett
// översatt kommandonamn är ett kommando ingen hittar. Detsamma gäller "Powered by Anvil". Allt
// annat — förklaringen, ordningen, varför — är på svenska.

const sv: PartialDiscordDict = {
  common: {
    noTeams: '_Inga lag än._',
    moreOnSite: '+{n} till på sajten',
    more: '+{n} till',
    bonusLegend:
      '⚡ uppdragsbonus — tjänas ovanpå brädans total, så den räknas in i poängen men inte i procenten.',
    visitingClansOne: '🤝 {names} är en gästklan — den här brädan är delad.',
    visitingClansMany: '🤝 {names} är gästklaner — den här brädan är delad.',
    visitingPlayersOne: '🤝 1 spelare gästar från en annan klan.',
    visitingPlayersMany: '🤝 {n} spelare gästar från andra klaner.',
    phaseRunning: 'pågår',
    phaseUpcoming: 'inte startad',
    phaseEnded: 'avslutad',
    phaseDraft: 'utkast',
    contextVisitingTeamsOne: 'över klangränser · 1 gästlag',
    contextVisitingTeamsMany: 'över klangränser · {n} gästlag',
    contextVisitingPlayersOne: '1 gästspelare',
    contextVisitingPlayersMany: '{n} gästspelare',
    shareButton: 'Dela i kanalen',
    sharedBy: '-# Delat av {who}',
    fieldFormat: 'Format',
    fieldTeams: 'Lag',
    fieldPlayers: 'Spelare',
    fieldTilesDone: 'Rutor klara',
    fieldTeamScore: 'Lagets poäng',
    fieldYourTiles: 'Dina rutor',
    fieldAccounts: 'Konton',
    fieldRank: 'Placering',
    fieldRoster: 'Trupp',
    fieldScore: 'Poäng',
  },

  board: {
    starts: 'Startar {when}.',
    ends: 'Slutar {when}.',
    finished: 'Den här brädan är avslutad.',
    notScheduled: 'Inte inplanerad än.',
    hidden: 'Rutorna är fortfarande dolda — brädan öppnas när staff avslöjar den.',
  },

  leaderboard: { title: '🏆 {event} — ställning' },

  rules: {
    title: '📜 {event} — så funkar det',
    houseTitle: '📌 {clan} — husregler',
    houseContinues: '**Reglerna fortsätter** — läs alla på',
    houseFull: 'Alla regler:',
    houseTrimmed: '-# Nedkortat för att rymmas i Discord — be staff om hela regelverket.',

    scoringPoints:
      '• **Poäng** — varje ruta är värd sina egna poäng; ett lags poäng är summan av det de klarat.',
    scoringTiles: '• **Poäng** — ett poäng per ruta; ett lags poäng är hur många de klarat.',
    tileRace:
      '• **Rutrace** — brädan är en fastlagd bana. Ni avancerar längs den; er längsta ruta är er placering.',
    revealScheduled:
      '• **Avslöjanden** — rutor öppnas enligt ett schema som staff satt. En ruta du inte ser än har helt enkelt inte öppnats.',
    revealIntervalOne: '• **Avslöjanden** — en ruta dras {order} var {minutes}:e minut.',
    revealIntervalMany: '• **Avslöjanden** — {n} rutor dras {order} var {minutes}:e minut.',
    revealOrderRandom: 'slumpmässigt',
    revealOrderBoard: 'i brädordning',
    revealBounty:
      '• **Prisjakt** — exakt en ruta är öppen åt gången. Första laget som klarar den stänger den, och nästa dras.',
    revealRotating:
      '• **Rotation** — {n} rutor står öppna samtidigt; de äldsta löper ut när nya dras. Klara dem medan de är uppe.',
    revealAll: '• **Avslöjanden** — hela brädan är öppen från start.',
    notRevealed:
      '• **Inte avslöjad än** — staff öppnar brädan när eventet börjar. Ingen ser rutorna före dess.',
    lockout: '• **Lockout** — första laget som klarar en ruta tar den. Ingen annan kan få poäng för den sedan.',
    firstBonus: '• **Förstabonus** — första laget på en ruta får {amount} extra poäng.',
    decay:
      '• **Nedtrappning** — en ruta ger fulla poäng när den öppnas och glider till {pct}% under {hours} timmar. Tidiga klar ger mer.',
    growth:
      '• **Upptrappning** — en ruta börjar på fullt värde och stiger till {pct}% under {hours} timmar. Att vänta ger mer.',
    missions:
      '• **Uppdrag** — extra mål som avslöjas under eventet, {when}. Ingen ser ett innan det annonseras.',
    missionWhenInterval: 'var {minutes}:e minut',
    missionWhenScheduled: 'enligt ett schema',
    missionWhenManual: 'när staff släpper dem',
    missionBonusNote:
      '-# Uppdragspoäng är en **bonus** — läggs till din poäng men aldrig till brädans total, så brädan kan inte bli längre under eventet.',
    missionAnnouncedCount: '{announced} av {total} annonserade hittills.',
    startProofStrict:
      '• **Startbild** — varje spelare lämnar in en skärmbild efter starten, på en plats som dras i startögonblicket. Tills du lämnat in din avvisas allt du skickar in.',
    startProofFlag:
      '• **Startbild** — varje spelare lämnar in en skärmbild efter starten, på en plats som dras i startögonblicket. Tills du lämnat in din flaggas allt du skickar in för granskning.',
    startProofSession:
      '-# Logga ut och in först — hiscores sparas bara vid utloggning, så din bild måste tas inom {minutes} minuter från en färsk inloggning.',
    teamChoice: '• **Lag** — du väljer lag när du anmäler dig; staff godkänner det.',
    captainInvites: '• **Lag** — lagkaptenerna delar själva ut inbjudningslänkar till sin egen sida.',
    entryFee: '• **Anmälningsavgift** — {amount} per anmälan.',
    prizePool: '• **Prispott** — {amount} och växande för varje godkänd anmälan.',

    trackingHeading: '**Så får du poäng**',
    trackingPlugin: '• **Med Anvil-pluginet** — det skickar in åt dig. Det finns inget att göra utom att spela.',
    trackingHiscoresAll:
      '• **Inget plugin?** Varenda ruta här läses från de **officiella hiscores**, så de kräver ingen klient alls — men hiscores sparas bara när du **loggar ut**, och uppdateras varje hel timme. Spela → logga ut → vänta på timmen.',
    trackingHiscoresSome:
      '• **Inget plugin?** {n} av dessa rutor läses från de **officiella hiscores**, så de kräver ingen klient alls — men hiscores sparas bara när du **loggar ut**, och uppdateras varje hel timme. Spela → logga ut → vänta på timmen.',
    trackingProofAll:
      '• **Drops, kills och rutor på tid** kräver bevis — det gäller varenda ruta här. Pluginet arkiverar det automatiskt; utan det laddar du upp en skärmbild själv {where}.',
    trackingProofSome:
      '• **Drops, kills och rutor på tid** kräver bevis — {n} av dessa. Pluginet arkiverar det automatiskt; utan det laddar du upp en skärmbild själv {where}.',
    trackingWhereUrl: 'på **My Team** på {url}/team',
    trackingWhereNoUrl: 'på My Team-sidan',
    trackingKeepShot:
      '-# Spara en egen skärmbild av allt stort ändå — det kostar ingenting och avgör varje diskussion.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Inte med på den här brädan',
    notEntered: 'Du är inte anmäld till **{event}**.',
    notEnteredWhere: 'Anmälan och din profil finns på {url}.',
    onTeam: 'Du är i **{team}**.',
    onTeamRanked: 'Du är i **{team}** — {place} av {total}.',
    noTeamYet: 'Du är anmäld men inte placerad i ett lag än.',
    finishedHiddenOne: 'Du har klarat 1 ruta — namnen visas när brädan avslöjas.',
    finishedHiddenMany: 'Du har klarat {n} rutor — namnen visas när brädan avslöjas.',
    finishedHeading: '**Rutor du klarat**',
    nothingYet: 'Inga rutor är krediterade dig än.',
  },

  team: {
    noTeamsTitle: '🔍 Inga lag än',
    noTeamsBody: '**{event}** har inga lag på sig än.',
    noMatchTitle: '🔍 Inget sådant lag',
    noMatch: 'Inget lag på **{event}** matchar "{needle}".',
    noneOfYours: 'Du är inte i ett lag — skriv ett namn för att slå upp det.',
    teamsList: '**Lag:** {names}',
    standing: '{place} av {total} — {score}{bonus} · {pct}% av brädan.',
    bonusSuffix: ' (⚡+{n} uppdragsbonus)',
    visitingWholeTeam: '🤝 En gästklan: {names}',
    visitingSomeOne: '🤝 1 gästspelare: {names}',
    visitingSomeMany: '🤝 {n} gästspelare: {names}',
    recentHeading: '**Senaste rutorna**',
    hiddenBoard: 'Rutorna på **{event}** är inte avslöjade än — lagkorten öppnas när brädan gör det.',
  },

  apply: {
    title: '📝 {event} — så kommer du med',
    drafted: '**Du är med** — redan draftad till ett lag. Inget kvar att göra utom att spela.',
    approved: '**Du är anmäld och godkänd.** Du placeras i ett lag innan eventet börjar.',
    pending: '**Din anmälan är inne** och väntar på att staff godkänner den. Inget mer att göra.',
    open: '**Anmälan är öppen.**',
    notOpenYet: '**Anmälan har inte öppnat än.**',
    eventStarted: '**Eventet har börjat**, så anmälan är stängd. Fråga staff om det finns plats kvar.',
    closed: '**Anmälan är stängd.**',
    closesIn: 'Den stänger {when}.',
    opensIn: 'Den öppnar {when}.',
    fee: 'Det kostar {amount} — staff säger var du skickar det.',
    feePerAccount: 'Det kostar {amount} per konto — staff säger var du skickar det.',
    signUpAt: '**Anmäl dig:** {url}',
    noAccountUrl:
      '-# Anvil känner inte till ditt konto än. Koppla ditt RSN först på {url}/profile — anmälningar hänger på ett konto, inte på ett Discord-namn.',
    noAccountNoUrl:
      '-# Anvil känner inte till ditt konto än. Koppla ditt RSN först på din profilsida — anmälningar hänger på ett konto, inte på ett Discord-namn.',
  },

  next: {
    title: '⏭️ {event} — vad som kommer härnäst',
    eventStarts: '🚩 Eventet börjar',
    eventEnds: '🏁 Eventet slutar',
    nextTile: '🎲 Nästa ruta dras',
    nextMission: '⚡ Nästa uppdrag',
    signupsClose: '📝 Anmälan stänger',
    nothingEnded: 'Inget kvar på klockan — den här brädan är avslutad.',
    nothingScheduled: 'Inget inplanerat. Staff släpper nästa sak när de släpper den.',
    hiddenMissionsOne: '-# 1 uppdrag återstår, annonseras när staff släpper det.',
    hiddenMissionsMany: '-# {n} uppdrag återstår, annonseras när staff släpper dem.',
  },

  help: {
    title: '🔨 Det här kan Anvil berätta',
    privateNote:
      '-# Svaren syns bara för dig. Använd knappen **{share}** under ett svar för att lägga det i kanalen.',
    subs: {
      board: 'Brädan som pågår just nu',
      leaderboard: 'Lagställning',
      rules: 'Så funkar brädan — poäng, avslöjanden, bevis, plus klanens husregler',
      apply: 'Så kommer du med — anmälan, avgiften, och var du står',
      next: 'Vad som kommer — nästa avslöjande, uppdrag eller deadline',
      me: 'Ditt lag, dina rutor, din placering',
      help: 'Vad Anvil kan berätta härinne',
      team: 'Ett lags kort — poäng, trupp, senaste rutorna',
    },
    command: 'Anvil — kolla klanens bräda',
    optionTeamName: 'Lagnamn (lämna tomt för ditt eget lag)',
  },

  rolePanel: {
    modalTitle:
      'En sak till',
    modalLabel:
      'Ditt RuneScape-namn',
    modalPlaceholder:
      'Exakt som det står i spelet',
    granted:
      '✅ Du är upplagd som **{label}**.',
    optionGone:
      'Den knappen är föråldrad — be staff lägga upp panelen igen.',
    grantFailed:
      '⚠️ Dina roller sattes inte. Anvils botroll måste ligga **ovanför** rollerna den delar ut — be en admin kolla.',
    rsnSaved:
      '📋 Sparade **{rsn}** som ditt RuneScape-namn.',
    rsnSavedRenamed:
      '📋 Sparade **{rsn}** som ditt RuneScape-namn och satte ditt smeknamn till samma sak.',
    rsnPending:
      '-# En moderator måste fortfarande bekräfta att kontot är ditt innan det räknas i event.',
    rsnInvalid:
      'Det ser inte ut som ett RuneScape-namn — 1 till 12 tecken, exakt som i spelet.',
    rsnTaken:
      '**{rsn}** är redan kopplat till någon annan. Stämmer det inte, be en moderator reda ut det.',
    failed:
      'Anvil kunde inte slutföra det. En admin kan kolla sajtens loggar.',
  },

  errors: {
    dm: 'Kör den i din klans Discord-server — ett brädkommando måste veta vilken klan som frågar.',
    wrongGuild:
      'Den här boten är kopplad till en annan server än **{clan}**s Anvil. Be en admin kolla server-id:t under Integrations.',
    unknownCommand: 'Anvil svarar inte på {command} — prova {suggestion}.',
    unknownSub: 'Okänt kommando. Prova {list}.',
    noBoards: '**{clan}** har inga brädor än.',
    noBoardsStaff: 'Staff kan skapa en på {url}/admin/events/new.',
    failed: 'Anvil stötte på ett fel. En admin kan kolla sajtens loggar.',
    unsupported: 'Den interaktionstypen stöds inte än.',
    shareExpired: 'Det svaret är för gammalt för att dela — kör kommandot igen.',
  },
};

export default sv;
