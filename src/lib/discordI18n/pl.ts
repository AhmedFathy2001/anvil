import type { PartialDiscordDict } from './en';

// Polski — Polish.
//
// Nazwy komend zostają po angielsku: kto czyta po polsku, i tak wpisuje `/bingo board`, a
// przetłumaczona nazwa komendy to komenda, której nikt nie znajdzie. To samo dotyczy „Powered by
// Anvil”. Cała reszta — wyjaśnienie, kolejność, powody — jest po polsku.
//
// Polski ma trzy formy liczby mnogiej, a słownik ma dwie. Formy `Many` są więc pisane tak, żeby
// czytały się poprawnie z każdym liczebnikiem — zwykle przez konstrukcję „rzecz: {n}”.

const pl: PartialDiscordDict = {
  common: {
    noTeams: '_Jeszcze nie ma drużyn._',
    moreOnSite: 'więcej na stronie: +{n}',
    more: 'więcej: +{n}',
    bonusLegend:
      '⚡ bonus za misję — zdobyty ponad sumę planszy, więc liczy się do wyniku, ale nie do procentów.',
    visitingClansOne: '🤝 {names} to klan z zewnątrz — ta plansza jest wspólna.',
    visitingClansMany: '🤝 {names} to klany z zewnątrz — ta plansza jest wspólna.',
    visitingPlayersOne: '🤝 1 gracz jest tu gościnnie z innego klanu.',
    visitingPlayersMany: '🤝 Graczy gościnnie z innych klanów: {n}.',
    phaseRunning: 'trwa',
    phaseUpcoming: 'nie wystartowało',
    phaseEnded: 'zakończone',
    phaseDraft: 'szkic',
    contextVisitingTeamsOne: 'międzyklanowe · 1 drużyna z zewnątrz',
    contextVisitingTeamsMany: 'międzyklanowe · drużyn z zewnątrz: {n}',
    contextVisitingPlayersOne: '1 gracz z zewnątrz',
    contextVisitingPlayersMany: 'graczy z zewnątrz: {n}',
    shareButton: 'Wyślij na kanał',
    sharedBy: '-# Udostępnił(a) {who}',
    fieldFormat: 'Format',
    fieldTeams: 'Drużyny',
    fieldPlayers: 'Gracze',
    fieldTilesDone: 'Pola zaliczone',
    fieldTeamScore: 'Wynik drużyny',
    fieldYourTiles: 'Twoje pola',
    fieldAccounts: 'Konta',
    fieldRank: 'Miejsce',
    fieldRoster: 'Skład',
    fieldScore: 'Wynik',
  },

  board: {
    starts: 'Start {when}.',
    ends: 'Koniec {when}.',
    finished: 'Ta plansza jest zakończona.',
    notScheduled: 'Jeszcze nie zaplanowana.',
    hidden: 'Pola są wciąż ukryte — plansza otworzy się, gdy staff ją odsłoni.',
  },

  leaderboard: { title: '🏆 {event} — tabela' },

  rules: {
    title: '📜 {event} — jak to działa',
    houseTitle: '📌 {clan} — zasady klanu',
    houseContinues: '**Zasady mają ciąg dalszy** — przeczytaj wszystkie na',
    houseFull: 'Pełne zasady:',
    houseTrimmed: '-# Skrócone, żeby zmieściły się w Discordzie — poproś staff o pełny regulamin.',

    scoringPoints:
      '• **Punktacja** — każde pole jest warte własne punkty; wynik drużyny to suma tego, co ukończyła.',
    scoringTiles: '• **Punktacja** — jeden punkt za pole; wynik drużyny to liczba ukończonych pól.',
    tileRace:
      '• **Wyścig po polach** — plansza to ustalona trasa. Posuwacie się po niej; najdalsze pole to wasza pozycja.',
    revealScheduled:
      '• **Odsłanianie** — pola otwierają się według harmonogramu ustawionego przez staff. Pola, którego jeszcze nie widzisz, po prostu jeszcze nie otwarto.',
    revealIntervalOne: '• **Odsłanianie** — co {minutes} min losowane jest {order} jedno pole.',
    revealIntervalMany: '• **Odsłanianie** — co {minutes} min losowanych jest {order} pól w liczbie {n}.',
    revealOrderRandom: 'losowo',
    revealOrderBoard: 'w kolejności planszy',
    revealBounty:
      '• **Nagroda** — otwarte jest dokładnie jedno pole naraz. Pierwsza drużyna, która je ukończy, zamyka je, a następne zostaje wylosowane.',
    revealRotating:
      '• **Rotacja** — otwartych naraz jest pól: {n}; najstarsze wygasają, gdy pojawiają się nowe. Kończcie je, póki są dostępne.',
    revealAll: '• **Odsłanianie** — cała plansza jest otwarta od startu.',
    notRevealed:
      '• **Jeszcze nie odsłonięta** — staff otwiera planszę, gdy wydarzenie się zaczyna. Wcześniej nikt nie widzi pól.',
    lockout: '• **Wyłączność** — pierwsza drużyna, która ukończy pole, bierze je. Nikt inny już go nie zapunktuje.',
    firstBonus: '• **Bonus za pierwszeństwo** — pierwsza drużyna na polu dostaje {amount} punktów ekstra.',
    decay:
      '• **Spadek wartości** — pole daje pełne punkty w chwili otwarcia i schodzi do {pct}% w ciągu {hours} godz. Szybkie ukończenie daje więcej.',
    growth:
      '• **Wzrost wartości** — pole startuje z pełnej wartości i rośnie do {pct}% w ciągu {hours} godz. Czekanie daje więcej.',
    missions:
      '• **Misje** — dodatkowe cele odsłaniane w trakcie wydarzenia, {when}. Nikt nie widzi misji przed jej ogłoszeniem.',
    missionWhenInterval: 'co {minutes} min',
    missionWhenScheduled: 'według harmonogramu',
    missionWhenManual: 'gdy staff je wypuści',
    missionBonusNote:
      '-# Punkty za misje to **bonus** — dochodzą do twojego wyniku, ale nigdy do sumy planszy, więc plansza nie może wydłużyć się w trakcie.',
    missionAnnouncedCount: 'Ogłoszono dotąd: {announced} z {total}.',
    startProofStrict:
      '• **Zdjęcie startowe** — każdy gracz składa jeden zrzut ekranu po starcie, w miejscu wylosowanym w chwili startu. Dopóki nie złożysz swojego, wszystko, co wysyłasz, jest odrzucane.',
    startProofFlag:
      '• **Zdjęcie startowe** — każdy gracz składa jeden zrzut ekranu po starcie, w miejscu wylosowanym w chwili startu. Dopóki nie złożysz swojego, wszystko, co wysyłasz, jest oznaczane do sprawdzenia.',
    startProofSession:
      '-# Najpierw wyloguj się i zaloguj ponownie — hiscores zapisują się dopiero przy wylogowaniu, więc zdjęcie musi powstać w ciągu {minutes} min od świeżego logowania.',
    teamChoice: '• **Drużyny** — wybierasz drużynę przy zapisie; staff ją zatwierdza.',
    captainInvites: '• **Drużyny** — kapitanowie sami rozdają linki z zaproszeniem dla swojej strony.',
    entryFee: '• **Wpisowe** — {amount} za zapis.',
    prizePool: '• **Pula nagród** — {amount} i rośnie z każdym zatwierdzonym zapisem.',

    trackingHeading: '**Jak zaliczyć**',
    trackingPlugin: '• **Z pluginem Anvil** — wysyła za ciebie. Nie ma nic do roboty poza graniem.',
    trackingHiscoresAll:
      '• **Nie masz pluginu?** Każde pole tutaj czyta z **oficjalnych hiscores**, więc nie wymaga żadnego klienta — ale hiscores zapisują się dopiero, gdy **się wylogujesz**, i odświeżają o pełnej godzinie. Graj → wyloguj się → poczekaj na godzinę.',
    trackingHiscoresSome:
      '• **Nie masz pluginu?** Pól czytających z **oficjalnych hiscores** jest tu {n} — nie wymagają żadnego klienta, ale hiscores zapisują się dopiero, gdy **się wylogujesz**, i odświeżają o pełnej godzinie. Graj → wyloguj się → poczekaj na godzinę.',
    trackingProofAll:
      '• **Dropy, zabójstwa i zadania na czas** wymagają dowodu — tutaj każde pole. Plugin archiwizuje go automatycznie; bez niego sam wgrywasz zrzut ekranu {where}.',
    trackingProofSome:
      '• **Dropy, zabójstwa i zadania na czas** wymagają dowodu — takich pól jest {n}. Plugin archiwizuje go automatycznie; bez niego sam wgrywasz zrzut ekranu {where}.',
    trackingWhereUrl: 'na **My Team** pod adresem {url}/team',
    trackingWhereNoUrl: 'na stronie My Team',
    trackingKeepShot:
      '-# Tak czy siak zachowaj własny zrzut wszystkiego, co ważne — nic nie kosztuje, a rozstrzyga każdy spór.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Nie ma cię na tej planszy',
    notEntered: 'Nie jesteś zapisany na **{event}**.',
    notEnteredWhere: 'Zapisy i twój profil są na {url}.',
    onTeam: 'Jesteś w **{team}**.',
    onTeamRanked: 'Jesteś w **{team}** — {place} z {total}.',
    noTeamYet: 'Jesteś zapisany, ale nie masz jeszcze drużyny.',
    finishedHiddenOne: 'Ukończyłeś 1 pole — nazwy pokażą się, gdy plansza zostanie odsłonięta.',
    finishedHiddenMany: 'Ukończonych pól: {n} — nazwy pokażą się, gdy plansza zostanie odsłonięta.',
    finishedHeading: '**Pola, które ukończyłeś**',
    nothingYet: 'Nie zaliczono ci jeszcze żadnego pola.',
  },

  team: {
    noTeamsTitle: '🔍 Jeszcze nie ma drużyn',
    noTeamsBody: '**{event}** nie ma jeszcze żadnych drużyn.',
    noMatchTitle: '🔍 Nie ma takiej drużyny',
    noMatch: 'Żadna drużyna na **{event}** nie pasuje do „{needle}”.',
    noneOfYours: 'Nie jesteś w drużynie — podaj nazwę, żeby ją sprawdzić.',
    teamsList: '**Drużyny:** {names}',
    standing: '{place} z {total} — {score}{bonus} · {pct}% planszy.',
    bonusSuffix: ' (⚡+{n} bonusu za misję)',
    visitingWholeTeam: '🤝 Klan z zewnątrz: {names}',
    visitingSomeOne: '🤝 1 gracz z zewnątrz: {names}',
    visitingSomeMany: '🤝 Graczy z zewnątrz ({n}): {names}',
    recentHeading: '**Ostatnie pola**',
    hiddenBoard: 'Pola na **{event}** nie są jeszcze odsłonięte — karty drużyn otworzą się razem z planszą.',
  },

  apply: {
    title: '📝 {event} — jak wejść',
    drafted: '**Jesteś w środku** — już wybrany do drużyny w drafcie. Zostało tylko grać.',
    approved: '**Jesteś zapisany i zatwierdzony.** Trafisz do drużyny przed startem wydarzenia.',
    pending: '**Twój zapis jest w środku** i czeka na zatwierdzenie przez staff. Nic więcej nie musisz robić.',
    open: '**Zapisy są otwarte.**',
    notOpenYet: '**Zapisy jeszcze się nie otworzyły.**',
    eventStarted: '**Wydarzenie już wystartowało**, więc zapisy są zamknięte. Zapytaj staff, czy jest jeszcze miejsce.',
    closed: '**Zapisy są zamknięte.**',
    closesIn: 'Zamykają się {when}.',
    opensIn: 'Otwierają się {when}.',
    fee: 'Wejście kosztuje {amount} — staff powie ci, gdzie to wysłać.',
    feePerAccount: 'Wejście kosztuje {amount} za konto — staff powie ci, gdzie to wysłać.',
    signUpAt: '**Zapisz się:** {url}',
    noAccountUrl:
      '-# Anvil nie zna jeszcze twojego konta. Najpierw podepnij swój RSN na {url}/profile — zapisy wiszą na koncie, a nie na nazwie z Discorda.',
    noAccountNoUrl:
      '-# Anvil nie zna jeszcze twojego konta. Najpierw podepnij swój RSN na swojej stronie profilu — zapisy wiszą na koncie, a nie na nazwie z Discorda.',
  },

  next: {
    title: '⏭️ {event} — co dalej',
    eventStarts: '🚩 Start wydarzenia',
    eventEnds: '🏁 Koniec wydarzenia',
    nextTile: '🎲 Losowanie kolejnego pola',
    nextMission: '⚡ Kolejna misja',
    signupsClose: '📝 Zamknięcie zapisów',
    nothingEnded: 'Nic już nie tyka — ta plansza jest zakończona.',
    nothingScheduled: 'Nic nie zaplanowano. Staff wypuści kolejną rzecz, kiedy ją wypuści.',
    hiddenMissionsOne: '-# Została jeszcze 1 misja, ogłoszona gdy staff ją wypuści.',
    hiddenMissionsMany: '-# Pozostałych misji: {n}, ogłaszane gdy staff je wypuści.',
  },

  help: {
    title: '🔨 Oto co Anvil może ci powiedzieć',
    privateNote:
      '-# Odpowiedzi widzisz tylko ty. Użyj przycisku **{share}** pod odpowiedzią, żeby wrzucić ją na kanał.',
    subs: {
      board: 'Plansza, która trwa właśnie teraz',
      leaderboard: 'Tabela drużyn',
      rules: 'Jak działa plansza — punktacja, odsłanianie, dowody i zasady klanu',
      apply: 'Jak wejść — zapisy, wpisowe i twoja sytuacja',
      next: 'Co nadchodzi — najbliższe odsłonięcie, misja albo termin',
      me: 'Twoja drużyna, twoje pola, twoje miejsce',
      help: 'Co Anvil może ci tutaj powiedzieć',
      team: 'Karta drużyny — wynik, skład, ostatnie pola',
    },
    command: 'Anvil — sprawdź planszę klanu',
    optionTeamName: 'Nazwa drużyny (zostaw puste dla własnej)',
  },

  errors: {
    dm: 'Uruchom to na serwerze Discord swojego klanu — komenda o planszy musi wiedzieć, który klan pyta.',
    wrongGuild:
      'Ten bot jest podłączony do innego serwera niż Anvil klanu **{clan}**. Poproś admina o sprawdzenie ID serwera w Integrations.',
    unknownCommand: 'Anvil nie odpowiada na {command} — spróbuj {suggestion}.',
    unknownSub: 'Nieznana komenda. Spróbuj {list}.',
    noBoards: '**{clan}** nie ma jeszcze żadnych plansz.',
    noBoardsStaff: 'Staff może utworzyć planszę na {url}/admin/events/new.',
    failed: 'Anvil natrafił na błąd przy odpowiadaniu. Admin może sprawdzić logi strony.',
    unsupported: 'Ten typ interakcji nie jest jeszcze obsługiwany.',
    shareExpired: 'Ta odpowiedź jest za stara, żeby ją udostępnić — uruchom komendę ponownie.',
  },
};

export default pl;
