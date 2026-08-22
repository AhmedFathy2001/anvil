import type { PartialDiscordDict } from './en';

// Suomi — Finnish.
//
// Komentojen nimet pysyvät englanniksi: suomalainenkin kirjoittaa yhä `/bingo board`, ja käännetty
// komennon nimi on komento, jota kukaan ei löydä. Sama koskee "Powered by Anvil" -merkintää. Kaikki
// muu — selitys, järjestys, miksi — on suomeksi.

const fi: PartialDiscordDict = {
  common: {
    noTeams: '_Ei vielä joukkueita._',
    moreOnSite: '+{n} lisää sivustolla',
    more: '+{n} lisää',
    bonusLegend:
      '⚡ tehtäväbonus — ansaitaan taulun kokonaispisteiden päälle, joten se lasketaan pisteisiin mutta ei prosenttiin.',
    visitingClansOne: '🤝 {names} on vieraileva klaani — tämä taulu on jaettu.',
    visitingClansMany: '🤝 {names} ovat vierailevia klaaneja — tämä taulu on jaettu.',
    visitingPlayersOne: '🤝 1 pelaaja vierailee toisesta klaanista.',
    visitingPlayersMany: '🤝 Vierailevia pelaajia muista klaaneista: {n}.',
    phaseRunning: 'käynnissä',
    phaseUpcoming: 'ei alkanut',
    phaseEnded: 'päättynyt',
    phaseDraft: 'luonnos',
    contextVisitingTeamsOne: 'klaanien välinen · 1 vieraileva joukkue',
    contextVisitingTeamsMany: 'klaanien välinen · vierailevia joukkueita: {n}',
    contextVisitingPlayersOne: '1 vieraileva pelaaja',
    contextVisitingPlayersMany: 'vierailevia pelaajia: {n}',
    shareButton: 'Jaa kanavalle',
    sharedBy: '-# Jakoi {who}',
    fieldFormat: 'Muoto',
    fieldTeams: 'Joukkueet',
    fieldPlayers: 'Pelaajat',
    fieldTilesDone: 'Ruutuja tehty',
    fieldTeamScore: 'Joukkueen pisteet',
    fieldYourTiles: 'Sinun ruutusi',
    fieldAccounts: 'Tilit',
    fieldRank: 'Sijoitus',
    fieldRoster: 'Kokoonpano',
    fieldScore: 'Pisteet',
  },

  board: {
    starts: 'Alkaa {when}.',
    ends: 'Päättyy {when}.',
    finished: 'Tämä taulu on päättynyt.',
    notScheduled: 'Ei vielä aikataulutettu.',
    hidden: 'Ruudut ovat yhä piilossa — taulu avautuu, kun staff paljastaa sen.',
  },

  leaderboard: { title: '🏆 {event} — tilanne' },

  rules: {
    title: '📜 {event} — näin se toimii',
    houseTitle: '📌 {clan} — talon säännöt',
    houseContinues: '**Säännöt jatkuvat** — lue ne kaikki osoitteessa',
    houseFull: 'Kaikki säännöt:',
    houseTrimmed: '-# Lyhennetty, jotta mahtuu Discordiin — pyydä staffilta koko säännöstö.',

    scoringPoints:
      '• **Pisteytys** — jokainen ruutu on omien pisteidensä arvoinen; joukkueen pisteet ovat sen suorittamien summa.',
    scoringTiles: '• **Pisteytys** — piste per ruutu; joukkueen pisteet ovat se, montako se on suorittanut.',
    tileRace:
      '• **Ruutukisa** — taulu on järjestetty rata. Etenette sitä pitkin; kauimmainen ruutunne on sijoituksenne.',
    revealScheduled:
      '• **Paljastukset** — ruudut avautuvat staffin asettaman aikataulun mukaan. Ruutu, jota et vielä näe, ei yksinkertaisesti ole auennut.',
    revealIntervalOne: '• **Paljastukset** — yksi ruutu arvotaan {order} {minutes} minuutin välein.',
    revealIntervalMany: '• **Paljastukset** — {n} ruutua arvotaan {order} {minutes} minuutin välein.',
    revealOrderRandom: 'satunnaisesti',
    revealOrderBoard: 'taulun järjestyksessä',
    revealBounty:
      '• **Palkkio** — tasan yksi ruutu on auki kerrallaan. Ensimmäisenä sen suorittava joukkue sulkee sen, ja seuraava arvotaan.',
    revealRotating:
      '• **Kierto** — {n} ruutua on auki yhtä aikaa; vanhimmat vanhenevat uusien tullessa. Suorita ne, kun ne ovat auki.',
    revealAll: '• **Paljastukset** — koko taulu on auki alusta asti.',
    notRevealed:
      '• **Ei vielä paljastettu** — staff avaa taulun, kun tapahtuma alkaa. Kukaan ei näe ruutuja sitä ennen.',
    lockout: '• **Lukitus** — ensimmäisenä ruudun suorittava joukkue vie sen. Kukaan muu ei voi enää pisteyttää sitä.',
    firstBonus: '• **Ensimmäisen bonus** — ruudun ensimmäisenä suorittava joukkue saa {amount} lisäpistettä.',
    decay:
      '• **Lasku** — ruutu on täydet pisteet auetessaan ja liukuu {pct} prosenttiin {hours} tunnissa. Nopeat suoritukset tuottavat enemmän.',
    growth:
      '• **Kasvu** — ruutu alkaa täydestä arvosta ja nousee {pct} prosenttiin {hours} tunnissa. Odottaminen tuottaa enemmän.',
    missions:
      '• **Tehtävät** — lisätavoitteita, jotka paljastetaan kesken tapahtuman, {when}. Kukaan ei näe tehtävää ennen sen julkistusta.',
    missionWhenInterval: '{minutes} minuutin välein',
    missionWhenScheduled: 'aikataulun mukaan',
    missionWhenManual: 'kun staff pudottaa ne',
    missionBonusNote:
      '-# Tehtäväpisteet ovat **bonus** — ne lisätään pisteisiisi mutta ei koskaan taulun kokonaissummaan, joten taulu ei voi pidentyä kesken tapahtuman.',
    missionAnnouncedCount: 'Julkistettu tähän mennessä: {announced}/{total}.',
    startProofStrict:
      '• **Aloituskuva** — jokainen pelaaja toimittaa yhden kuvakaappauksen aloituksen jälkeen, paikassa joka arvotaan aloitushetkellä. Kunnes toimitat omasi, lähetyksesi hylätään.',
    startProofFlag:
      '• **Aloituskuva** — jokainen pelaaja toimittaa yhden kuvakaappauksen aloituksen jälkeen, paikassa joka arvotaan aloitushetkellä. Kunnes toimitat omasi, kaikki lähettämäsi merkitään tarkistettavaksi.',
    startProofSession:
      '-# Kirjaudu ensin ulos ja takaisin sisään — hiscores tallentuu vain uloskirjautuessa, joten kuvasi täytyy ottaa {minutes} minuutin sisällä tuoreesta sisäänkirjautumisesta.',
    teamChoice: '• **Joukkueet** — valitset joukkueesi ilmoittautuessasi; staff hyväksyy sen.',
    captainInvites: '• **Joukkueet** — kapteenit jakavat itse kutsulinkkejä omalle puolelleen.',
    entryFee: '• **Osallistumismaksu** — {amount} per ilmoittautuminen.',
    prizePool: '• **Palkintopotti** — {amount} ja kasvaa jokaisella hyväksytyllä ilmoittautumisella.',

    trackingHeading: '**Näin saat suorituksen kirjatuksi**',
    trackingPlugin: '• **Anvil-lisäosalla** — se lähettää puolestasi. Ei muuta tekemistä kuin pelaaminen.',
    trackingHiscoresAll:
      '• **Ei lisäosaa?** Jokainen ruutu tässä luetaan **virallisesta hiscoresista**, joten ne eivät vaadi minkäänlaista klienttiä — mutta hiscores tallentuu vain kun **kirjaudut ulos**, ja päivittyy tasatunnein. Pelaa → kirjaudu ulos → odota tasatuntia.',
    trackingHiscoresSome:
      '• **Ei lisäosaa?** {n} näistä ruuduista luetaan **virallisesta hiscoresista**, joten ne eivät vaadi minkäänlaista klienttiä — mutta hiscores tallentuu vain kun **kirjaudut ulos**, ja päivittyy tasatunnein. Pelaa → kirjaudu ulos → odota tasatuntia.',
    trackingProofAll:
      '• **Dropit, tapot ja aikarajoitetut tehtävät** vaativat todisteen — tässä jokainen ruutu. Lisäosa arkistoi sen automaattisesti; ilman sitä lataat kuvakaappauksen itse {where}.',
    trackingProofSome:
      '• **Dropit, tapot ja aikarajoitetut tehtävät** vaativat todisteen — näistä {n}. Lisäosa arkistoi sen automaattisesti; ilman sitä lataat kuvakaappauksen itse {where}.',
    trackingWhereUrl: '**My Team** -sivulla osoitteessa {url}/team',
    trackingWhereNoUrl: 'My Team -sivulla',
    trackingKeepShot:
      '-# Ota joka tapauksessa itse kuvakaappaus kaikesta isosta — se ei maksa mitään ja ratkaisee jokaisen kiistan.',
  },

  me: {
    title: '👤 {who} — {event}',
    notEnteredTitle: '🔍 Et ole tällä taululla',
    notEntered: 'Et ole ilmoittautunut tapahtumaan **{event}**.',
    notEnteredWhere: 'Ilmoittautuminen ja profiilisi löytyvät osoitteesta {url}.',
    onTeam: 'Olet joukkueessa **{team}**.',
    onTeamRanked: 'Olet joukkueessa **{team}** — {place}/{total}.',
    noTeamYet: 'Olet ilmoittautunut, mutta et ole vielä joukkueessa.',
    finishedHiddenOne: 'Olet suorittanut 1 ruudun — nimet näkyvät, kun taulu paljastetaan.',
    finishedHiddenMany: 'Olet suorittanut {n} ruutua — nimet näkyvät, kun taulu paljastetaan.',
    finishedHeading: '**Suorittamasi ruudut**',
    nothingYet: 'Sinulle ei ole vielä kirjattu yhtään ruutua.',
  },

  team: {
    noTeamsTitle: '🔍 Ei vielä joukkueita',
    noTeamsBody: 'Tapahtumassa **{event}** ei ole vielä joukkueita.',
    noMatchTitle: '🔍 Ei tällaista joukkuetta',
    noMatch: 'Mikään joukkue tapahtumassa **{event}** ei vastaa hakua "{needle}".',
    noneOfYours: 'Et ole joukkueessa — kirjoita nimi hakeaksesi.',
    teamsList: '**Joukkueet:** {names}',
    standing: '{place}/{total} — {score}{bonus} · {pct}% taulusta.',
    bonusSuffix: ' (⚡+{n} tehtäväbonus)',
    visitingWholeTeam: '🤝 Vieraileva klaani: {names}',
    visitingSomeOne: '🤝 1 vieraileva pelaaja: {names}',
    visitingSomeMany: '🤝 Vierailevia pelaajia ({n}): {names}',
    recentHeading: '**Viimeisimmät ruudut**',
    hiddenBoard: 'Tapahtuman **{event}** ruutuja ei ole vielä paljastettu — joukkuekortit avautuvat, kun taulu avautuu.',
  },

  apply: {
    title: '📝 {event} — näin pääset mukaan',
    drafted: '**Olet mukana** — sinut on jo draftattu joukkueeseen. Ei muuta tehtävää kuin pelata.',
    approved: '**Olet ilmoittautunut ja hyväksytty.** Sinut sijoitetaan joukkueeseen ennen tapahtuman alkua.',
    pending: '**Ilmoittautumisesi on sisällä** ja odottaa staffin hyväksyntää. Ei muuta tehtävää.',
    open: '**Ilmoittautuminen on auki.**',
    notOpenYet: '**Ilmoittautuminen ei ole vielä auennut.**',
    eventStarted: '**Tapahtuma on alkanut**, joten ilmoittautuminen on suljettu. Kysy staffilta, mahtuuko vielä mukaan.',
    closed: '**Ilmoittautuminen on suljettu.**',
    closesIn: 'Se sulkeutuu {when}.',
    opensIn: 'Se aukeaa {when}.',
    fee: 'Osallistuminen maksaa {amount} — staff kertoo, minne lähetät sen.',
    feePerAccount: 'Osallistuminen maksaa {amount} per tili — staff kertoo, minne lähetät sen.',
    signUpAt: '**Ilmoittaudu:** {url}',
    noAccountUrl:
      '-# Anvil ei vielä tunne tiliäsi. Yhdistä RSN:si ensin osoitteessa {url}/profile — ilmoittautumiset kiinnittyvät tiliin, eivät Discord-nimeen.',
    noAccountNoUrl:
      '-# Anvil ei vielä tunne tiliäsi. Yhdistä RSN:si ensin profiilisivullasi — ilmoittautumiset kiinnittyvät tiliin, eivät Discord-nimeen.',
  },

  next: {
    title: '⏭️ {event} — mitä seuraavaksi',
    eventStarts: '🚩 Tapahtuma alkaa',
    eventEnds: '🏁 Tapahtuma päättyy',
    nextTile: '🎲 Seuraava ruutu arvotaan',
    nextMission: '⚡ Seuraava tehtävä',
    signupsClose: '📝 Ilmoittautuminen sulkeutuu',
    nothingEnded: 'Kellossa ei ole enää mitään — tämä taulu on päättynyt.',
    nothingScheduled: 'Mitään ei ole aikataulutettu. Staff pudottaa seuraavan, kun pudottaa.',
    hiddenMissionsOne: '-# 1 tehtävä on vielä tulossa, julkistetaan kun staff pudottaa sen.',
    hiddenMissionsMany: '-# Tehtäviä on vielä tulossa: {n}, julkistetaan kun staff pudottaa ne.',
  },

  help: {
    title: '🔨 Tämän Anvil voi kertoa sinulle',
    privateNote:
      '-# Vastaukset näkyvät vain sinulle. Käytä vastauksen alla olevaa **{share}**-painiketta lähettääksesi sen kanavalle.',
    subs: {
      board: 'Taulu joka on juuri nyt käynnissä',
      leaderboard: 'Joukkueiden tilanne',
      rules: 'Näin taulu toimii — pisteytys, paljastukset, todisteet ja klaanin talon säännöt',
      apply: 'Näin pääset mukaan — ilmoittautuminen, maksu ja oma tilanteesi',
      next: 'Mitä on tulossa — seuraava paljastus, tehtävä tai määräaika',
      me: 'Joukkueesi, ruutusi, sijoituksesi',
      help: 'Mitä Anvil voi kertoa täällä',
      team: 'Joukkueen kortti — pisteet, kokoonpano, viimeisimmät ruudut',
    },
    command: 'Anvil — tarkista klaanin taulu',
    optionTeamName: 'Joukkueen nimi (jätä tyhjäksi omalle joukkueellesi)',
  },

  rolePanel: {
    modalTitle:
      'Vielä yksi asia',
    modalLabel:
      'RuneScape-nimesi',
    modalPlaceholder:
      'Täsmälleen kuten pelissä',
    granted:
      '✅ Sinut on merkitty rooliin **{label}**.',
    optionGone:
      'Tuo painike on vanhentunut — pyydä staffia julkaisemaan paneeli uudelleen.',
    grantFailed:
      '⚠️ Roolisi eivät menneet läpi. Anvilin bottiroolin täytyy olla jakamiensa roolien **yläpuolella** — pyydä adminia tarkistamaan.',
    rsnSaved:
      '📋 Tallensin **{rsn}** RuneScape-nimeksesi.',
    rsnSavedRenamed:
      '📋 Tallensin **{rsn}** RuneScape-nimeksesi ja asetin kutsumanimesi samaksi.',
    rsnPending:
      '-# Moderaattorin täytyy vielä vahvistaa, että tili on sinun, ennen kuin se kelpaa tapahtumiin.',
    rsnInvalid:
      'Tuo ei näytä RuneScape-nimeltä — 1–12 merkkiä, täsmälleen kuten pelissä.',
    rsnTaken:
      '**{rsn}** on jo liitetty toiseen käyttäjään. Jos se on väärin, pyydä moderaattoria selvittämään.',
    failed:
      'Anvil ei saanut sitä valmiiksi. Admin voi tarkistaa sivuston lokit.',
  },

  errors: {
    dm: 'Aja tämä klaanisi Discord-palvelimella — taulukomennon täytyy tietää, mikä klaani kysyy.',
    wrongGuild:
      'Tämä botti on yhdistetty eri palvelimeen kuin klaanin **{clan}** Anvil. Pyydä adminia tarkistamaan palvelimen tunnus Integrations-kohdasta.',
    unknownCommand: 'Anvil ei vastaa komentoon {command} — kokeile {suggestion}.',
    unknownSub: 'Tuntematon komento. Kokeile {list}.',
    noBoards: 'Klaanilla **{clan}** ei ole vielä tauluja.',
    noBoardsStaff: 'Staff voi tehdä sellaisen osoitteessa {url}/admin/events/new.',
    failed: 'Anvil törmäsi virheeseen. Admin voi tarkistaa sivuston lokit.',
    unsupported: 'Tätä vuorovaikutustyyppiä ei vielä tueta.',
    shareExpired: 'Tuo vastaus on liian vanha jaettavaksi — aja komento uudelleen.',
  },
};

export default fi;
