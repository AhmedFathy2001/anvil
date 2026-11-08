import type { PartialGuideDict } from './en';

// Suomi — Finnish.
//
// Sama käytäntö kuin kaikissa muissakin kielitiedostoissa: kaikki, mitä lukija NÄKEE ruudullaan
// Anvilissa, RuneLitessä ja OBS:ssä, jää englanniksi — RuneLiten ja OBS:n valikot, pluginin omat
// chat-rivit, ja Anvilin omat hallintapaneelin nimikkeet, jotka ovat englanniksi kunnes sekin pinta
// käännetään. Käännetty "Tracked drop detected" on rivi, jota kukaan ei löydä uudestaan. Kaikki muu
// — selitys, järjestys, miksi — on suomea. Discordin omat nimikkeet (valikot, asetukset, oikeudet)
// sen sijaan noudattavat Discordin virallista suomennosta — sitä, mitä suomeksi asetettu Discord
// näyttää; jos Discordia ei olisi käännetty, ne jäisivät englanniksi.

const fi: PartialGuideDict = {
  common: {
    contents: 'Sisältö',
    step: 'Vaihe',
    optional: 'valinnainen',
    minRead: '{n} min lukuaika',
    copyLink: 'Kopioi linkki tähän kohtaan',
    linkCopied: 'Linkki kopioitu',
    language: 'Kieli',
    partialNotice:
      'Tämä opas on käännetty {language} vain osittain. Kääntämättä jäänyt osuus näkyy englanniksi.',
    backToGuides: 'Kaikki oppaat',
    unreviewedNotice:
      'Kukaan äidinkielinen puhuja ei ole vielä lukenut tätä {language} käännöstä läpi. Jos jokin lause tuntuu väärältä, [englanninkielinen sivu]({englishHref}) on alkuperäinen — ja [ilmoittaminen](/feedback) on se, mikä saa sen korjatuksi.',
    support: {
      lead: 'Jumissa, tai näyttääkö jokin väärältä?',
      link: 'Kysy Anvilin tuki-Discordissa',
    },
  },

  index: {
    metaTitle: 'Oppaat — Anvil',
    metaDescription:
      'Näin pääset alkuun Anvilin kanssa: RuneLite-plugin pelaajille, tapahtuman pyörittäminen klaanin henkilökunnalle, ja vierailevan klaanin isännöinti.',
    title: 'Oppaat',
    dek: 'Kaikki mitä tarvitset päästäksesi alkuun, kirjoitettuna juuri sille Anvilin versiolle, joka pyörii täällä.',
    groups: {
      playing: 'Pelaaminen',
      running: 'Tapahtuman pyörittäminen',
      clan: 'Klaanin pyörittäminen',
      streamers: 'Striimaajille',
    },
    anvilTab: 'Anvilin käyttö',
    ingame: {
      title: 'Pelioppaat',
      dek: 'Raidit, bossit, skillaus ja rahanteko Anvil-kirjastosta — samat oppaat, jotka plugin näyttää pelissä ja botti julkaisee Discordissa.',
      browse: 'Selaa kaikkia oppaita',
      language: 'Näitä oppaita ei ole käännetty: ne näkyvät sellaisina kuin ne on kirjoitettu, olipa tämän sivun kieli mikä tahansa.',
      empty: 'Anvil-kirjastossa ei ole vielä julkaistuja oppaita. Palaa pian.',
      placeholder: 'Hae pelioppaista — kokeile "zulrah", "raids" tai "money"',
      readTime: '{n} min lukuaika',
      metaTitle: 'OSRS-pelioppaat — Anvil',
      metaDescription: 'Raid-, bossi-, skillaus- ja rahanteko-oppaat Anvil-kirjastosta — luettavissa sivustolla, pelissä RuneLite-pluginin kautta ja Discordissa.',
    },
    search: {
      placeholder: 'Hae oppaista — kokeile "webhook", "ruudut" tai "dropit eivät näy"',
      results: '{n} opasta',
      empty: 'Ei osumia. Kokeile tavallisempaa sanaa — "ruudut", "maksu", "botti" — tai selaa alla olevaa listaa.',
      clear: 'Tyhjennä haku',
    },
    cards: {
      tiles: {
        eyebrow: 'Pelaajille',
        title: 'Ruutujen säännöt ja rajoitukset',
        blurb: 'Mitä ruutu vaatii sinulta ennen aloitusta (peliasetus, plugin, synkronoitu loki, hiscores-sijoitus) ja mitä se ei pysty seuraamaan.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'Sille joka hoitaa palvelinta',
        title: 'Anvil Discordissa',
        blurb: 'Yksi kutsu, sitten kanavat joille kukin syöte julkaisee, roolit, kauttaviivakomennot ja mitä tarkistaa kun se hiljenee.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Siirtyminen Anviliin',
        title: 'Siirtyminen muista lisäosista ja seurantatyökaluista',
        blurb:
          'Anvil postaa dropit Discordiin ja pyörittää viikoittaisia kilpailuja. Viisi vaihetta henkilökunnalle, kaksi pelaajille.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'Sinulle joka perustat sellaisen',
        title: 'Perusta klaani',
        blurb: 'Kaksi nimeä ja osoite, ja se on pystyssä. Sitten Discord, jäsenlista ja ensimmäinen taulu.',
        minutes: '~4 min, ilmainen',
      },
      plugin: {
        eyebrow: 'Pelaajille',
        title: 'RuneLite-pluginin käyttöönotto',
        blurb:
          'Asenna plugin, kirjaudu sisään sen sivupaneelista ja anna sen lähettää dropit puolestasi. Kattaa myös Discord-ilmoitukset ja pelaajahaun.',
        minutes: '~3 min käyttöönotto',
      },
      board: {
        eyebrow: 'Taulun rakentajille',
        title: 'Rakenna taulu, joka seuraa itse itseään',
        blurb:
          'Mitä kukin ruututyyppi oikeasti näkee, massatuonti taulukkolaskennalla, ja virheet jotka menevät sisään siististi eivätkä sitten koskaan laukea.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Kapteeneille',
        title: 'Kapteenin opas',
        blurb:
          'Poolin lukeminen ennen kellon käynnistymistä, itse draft-päivä, ja ne joukkueen vetämisen osat jotka alkavat vasta sen jälkeen.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Klaanin henkilökunnalle',
        title: 'Formaatit ja ruutujen avautuminen',
        blurb:
          'Seitsemän taulun muotoa, viisi tapaa saada ruudut pelattaviksi, ja kolme kerrointa jotka ratkaisevat suorituksen arvon.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Rahastonhoitajille',
        title: 'Maksut ja palkintojen jako',
        blurb:
          'Osallistumismaksun asettaminen, sen kerääminen, toinen allekirjoitus joka sulkee sen, ja potin muuttaminen maksetuiksi sijoituksiksi.',
        minutes: '~5 min',
      },
      coffer: {
        eyebrow: 'Rahastonhoitajille',
        title: 'Klaanin kassa',
        blurb:
          'Yksi kassa klaanin gp:lle: mitä sinne tulee, kolme tapaa maksaa palkintoja, ja kuka saa siihen koskea.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Moderaattoreille',
        title: 'Vuorossa',
        blurb:
          'Jono, todisteiden ja tilien tarkistus, jäsenlistan pitäminen rehellisenä, ja harkinta joka päätyy ihmiselle.',
        minutes: '~5 min',
      },
      admin: {
        eyebrow: 'Klaanin henkilökunnalle',
        title: 'Näin pyörität ensimmäisen tapahtumasi',
        blurb:
          'Discord, jäsenlista, taulut, ruudut, joukkueet ja draft, käynnistys — ja mitä teet kun tapahtuma on ohi.',
        minutes: 'yksi ilta, kerran',
      },
      clanVsClan: {
        eyebrow: 'Isännille',
        title: 'Vierailevan klaanin isännöinti',
        blurb:
          'Klaani vastaan klaani ilman että kerää yhtäkään RSN:ää käsin: yksi kutsulinkki joukkuetta kohden, ja paikka jolla heidän oma moderaattorinsa hoitaa oman puoliskonsa.',
        minutes: '~5 min joukkuetta kohden',
      },
      commands: {
        eyebrow: 'Jokaiselle jäsenelle',
        title: 'Kauttaviivakomennot',
        blurb:
          'Jokainen komento, johon botti vastaa Discordissa, mitä kukin valinta tekee, valmiit esimerkit, ja mitä tarkistaa kun jokin komento ei näy.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'Striimaajille',
        title: 'Tapahtumia katsojillesi',
        blurb:
          'Klaania ei tarvita. Tee oma tila, jaa yksi linkki, valitse kuka voi liittyä (seuraajat, tilaajat, Discord-roolit) ja tuo taulu striimiin.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'Katsojille',
        title: 'Striimaajan tapahtumaan liittyminen',
        blurb:
          'Sait linkin striimistä? Kirjaudu sisään, lisää hahmosi ja paina Join. Mitä tehdä seuraajille tai tilaajille tarkoitetuissa tapahtumissa.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'Striimaaville klaaneille',
        title: 'Striimaus klaaneille',
        blurb:
          'Anna katsojiesi pelata yhtä tapahtumaa liittymättä klaaniin. Laita Streaming päälle ja avaa sitten tapahtuma katsojille.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'Klaanin henkilökunnalle',
        title: 'Väkesi: jäsenlista, vieraat ja kuka saa liittyä',
        blurb:
          'Mistä jäsenet tulevat, mitä Roster-välilehden suodattimet tarkoittavat, liittymispyynnöt ja Needs review, Who can join -kohdan kolme asetusta sekä jonkun poistaminen tai porttikielto.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'Omistajille ja ylläpitäjille',
        title: 'Henkilökunnan roolit: kuka saa tehdä mitä',
        blurb:
          'Omistaja, ylläpitäjä, rahastonhoitaja ja moderaattori: mihin kukin pääsee, miten jostakusta tehdään moderaattori, kuka voi antaa minkäkin roolin, ja yhtä tapahtumaa koskevat tehtävät.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'Pelaajille',
        title: 'Anvil Supporter: tasot ja edut',
        blurb:
          'Supporter, Champion ja Patron: nimen värit, tähti, profiilikuvat, vitriini, kaveritapahtumat ja klaanin boostit, miten laskutus toimii ja mitä tapahtuu, jos lopetat.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'Pelaajille',
        title: 'Sivupaneeli välilehti kerrallaan',
        blurb:
          'Clan, Feed, You, Lookup ja ratas: mitä kukin välilehti näyttää, tapahtumachat, GZ- ja Sad-reaktiot sekä asetukset, jotka tuovat syötteen ja Supporter-värit peliisi.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'Supportereille ja klaanin henkilökunnalle',
        title: 'Klaanin boostaaminen',
        blurb:
          'Boostin asettaminen ja siirtäminen, kolme tasoa ja mitä kukin avaa, klaanin nimen värit, lahjoitetut boostit sekä boostaajien merkit ja kunniamerkit.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'Pelaajille',
        title: 'Profiilisi, Wrapped ja Compare',
        blurb: 'Profiilisi, jokaisen hahmon julkinen sivu ja henkilösivusi, kuka niitä näkee, kuukausittaiset ja tapahtumakohtaiset Wrapped-kortit sekä kahden hahmon vertailu.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'Pelaajille',
        title: 'Asetukset sivu kerrallaan',
        blurb: 'Discord-julkaisut ja kuvakaappausten yksityisyys, pelin sisäinen chat-syöte, laitteet, omat webhookit, kuka näkee hahmosi, jokainen hahmo ja omistajuusvaateet.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'Pelaajille',
        title: 'Haasteet ja kaveritapahtumat',
        blurb: 'Haasta yksi pelaaja drop-, tappo- tai XP-kisaan, ja isännöi yksityistä taulua kavereillesi yhden kutsulinkin takana.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'Pelaajille ja klaaneille',
        title: 'Klaanien, tapahtumien ja tulostaulujen etsiminen',
        blurb: 'Clan Hall, kahden klaanin vertailu, viikkotulostaulu, julkinen tapahtumalista ja sivut peliklaaneille, jotka eivät ole Anvilissa.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'Pelaajille ja klaanin henkilökunnalle',
        title: 'Peliohjeet',
        blurb: 'Ohjekirjaston selaaminen tason mukaan, uuden ohjeen tai muokkausehdotuksen tekeminen ja klaanisi omien kopioiden ylläpito.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'Klaanin henkilökunnalle ja pelaajille',
        title: 'Skill- ja Boss of the Week',
        blurb: 'Viikoittaisen kilpailun ajastaminen, toistaminen ja kierrättäminen, aloituslukemat, palkinnot, lopettaminen ajoissa ja se, mitä pelaajat näkevät.',
        minutes: '~4 min',
      },
      clanEvents: {
        eyebrow: 'Klaanin henkilökunnalle',
        title: 'Klaanitapahtumat ja aikataulu',
        blurb: 'Massat, raidi-illat ja tapaamiset: viikkotoistot, “I’m going” ja ilmoittautumiset, Discord-muistutukset, maksut, kyselyt ja aikataulun aukkojen löytäminen.',
        minutes: '~4 min',
      },
    },
  },

  switching: {
    metaTitle: 'Siirtyminen muista lisäosista ja seurantatyökaluista — Anvil',
    metaDescription:
      'Siirrä klaanisi Anviliin: määritä Discord-kanavat, synkronoi klaanilista, aloita Skill tai Boss of the Week ja kerro jäsenillesi.',
    eyebrow: 'Siirtyminen Anviliin',
    title: 'Siirtyminen muista lisäosista ja seurantatyökaluista',
    dek: 'Anvil julkaisee klaanisi dropit ja saavutukset Discordiin. Se myös ylläpitää klaanilistaa ja ajaa viikoittaiset kilpailut.',

    staff: {
      title: 'Jos johdat klaania',
      body: [
        '**Anna botin määrittää kanavat.** Mene kohtaan Admin → Discord → **Set it up for me**. Valitse yksi kanava tai useampi. Jos jokin muu lisäosa julkaisi jonnekin, rastita _Use the same channels_. Jäsenillesi ei muutu mikään.',
        '**Synkronoi klaanilista.** Avaa Anvil-lisäosan asetukset RuneLitessa. Laita päälle **Keep the clan roster in sync**. Yksi admin tekee tämän kerran pelissä. Tämä korvaa muualla pitämäsi klaanilistan.',
        '**Aloita Skill tai Boss of the Week.** Mene kohtaan Admin → All events → **+ New event** ja valitse Skill of the Week tai Boss of the Week. Kaikki klaanilistalla olevat ovat mukana automaattisesti. Tämä korvaa muualla järjestämäsi kilpailut.',
        '**Kerro jäsenillesi.** Mene kohtaan Admin → Discord → **Tell your members** → **Post it**. Botti postaa pelaajien ohjeet puolestasi.',
        '**Viikon päästä: siivoa.** Mene kohtaan Admin → Discord → **Remove old webhooks from other plugins**, rastita poistettavat, paina **Remove … webhooks** ja sitten **Yes, remove them**. Sen jälkeen mikään ei voi postautua kahdesti. Paina **Keep** niiden kohdalla, jotka haluat jättää rauhaan.',
      ],
    },

    player: {
      title: 'Jos olet pelaaja',
      body: [
        '**Asenna Anvil.** Avaa RuneLitessa Plugin Hub, hae Anvil ja paina **Install**. Kirjaudu sitten sisään Discordilla Anvilin sivupaneelista.',
        '**Laita vanhan lisäosasi ilmoitukset pois päältä**, ettei mikään postaudu kahdesti. Tai poista lisäosa, jos et käytä sitä mihinkään muuhun.',
        '**Siinä kaikki.** Muuta asennettavaa ei ole.',
      ],
    },

    questions: {
      title: 'Kysymyksiä',
      intro: 'Yleisimmät, joita klaanit kysyvät:',
      rows: [
        {
          term: 'Tarkkaileeko Anvil kill countteja, slayer-tehtäviä ja henkilökohtaisia ennätyksiä?',
          body: 'Kyllä. Anvil seuraa kill countteja, slayer-tehtäviä ja henkilökohtaisia ennätyksiä itse, joten mitään muuta ei tarvitse pitää käynnissä.',
        },
        {
          term: 'Pitääkö pelaajien liittää webhook jonnekin?',
          body: 'Ei. Klaani valitsee kanavat sivustolla.',
        },
        {
          term: 'Haluatko postaukset myös omalle palvelimellesi?',
          body: 'Mene profiiliisi → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Perusta klaani — Anvil',
    metaDescription: 'Luo klaani Anvilissa: nimeä se, valitse osoite, yhdistä Discord, synkronoi jäsenlista ja pidä ensimmäinen tapahtumasi.',
    eyebrow: 'Anvil · aloittaminen',
    title: 'Perusta klaani',
    dek: 'Kaksi nimeä ja osoite, ja klaanisi on pystyssä — ilmaiseksi, eikä mitään tarvitse odottaa. Tässä on se, ja lisäksi ne neljä asiaa jotka kannattaa tehdä heti perään.',
    facts: [
      {
        strong: 'Ilmainen',
        rest: 'ei korttia, ei kokeilujaksoa',
      },
      {
        strong: 'Pystyssä',
        rest: 'sillä hetkellä kun lähetät',
      },
      {
        strong: '~4 min',
        rest: 'toimivaan klaaniin',
      },
    ],
    footnote: 'Kaikkea tätä voi muuttaa myöhemmin kohdasta Admin → **Clan settings**, paitsi osoitetta — sitä kannattaa miettiä hetki nyt.',
    before: {
      title: 'Ennen kuin aloitat',
      body: [
        'Tarvitset Discord-tilin, ja siinä on koko lista. Kirjaudu ensin sisään osoitteessa `{apex}`: klaanilla pitää olla omistaja, ja kirjautuminen on se, mistä sivusto tietää sen olevan sinä. Aloita platform-sivujen kohdasta **Perusta klaani**, tai mene suoraan osoitteeseen `{apex}/clans/new`.',
        'Se ei maksa mitään. Ei pakettia valittavana, ei korttia syötettävänä eikä kokeilujaksoa joka päättyy ja vie taulusi mukanaan — klaani alkaa ilmaisena ja pysyy käytettävänä.',
        'Isot klaanit voivat myöhemmin siirtyä isompaan pakettiin Adminin kohdasta **Plan and billing**. Kaikki, mistä maksat Anvilissa — klaani, creator-tila tai oma Supporter-jäsenyytesi — löytyy [laskutussivultasi](/portal).',
      ],
      note: {
        tag: 'Sinusta tulee sen omistaja',
        body: 'Omistaja on se yksi rooli jota kukaan ei voi ottaa sinulta, ja se menee sille joka luo klaanin. Lisää henkilökuntaa jälkeenpäin kohdasta Admin → **People** → **Staff & roles**; katso [Vuorolistalla]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Nimeä se ja valitse osoite',
      intro: 'Kolme kenttää ja vain kaksi todellista päätöstä. Lomake tarkistaa osoitteen kirjoittaessasi ja kertoo ennen lähettämistä.',
      fields: [
        {
          term: 'Klaanin nimi pelissä',
          body: 'Pakollinen, ja sen on vastattava OSRS:ää **täsmälleen**. Tämä ei ole koristetta: jäsenlistan synkronointi täsmää siihen ja hylkää jäsenlistan joka ilmoitetaan millä tahansa muulla nimellä. Juuri se estää jonkun toisen jäsenlistaa päätymästä sivustollesi.',
        },
        {
          term: 'Klaanin nimi',
          body: 'Valinnainen. Se mitä ihmiset näkevät — sivustolla ja jokaisessa Discord-julkaisussa. Jätä tyhjäksi, niin pelinimeäsi käytetään molempiin.',
        },
        {
          term: 'Osoite',
          body: 'Klaanisi asuu osoitteessa `{apex}/c/sinun-slug`. Se ehdotetaan kirjoittamasi nimen pohjalta, voit muokata sitä, ja kourallinen sanoja on varattu. Valitse sellainen josta pidät vielä vuoden päästä: se on linkki joka päätyy kiinnitetyksi Discordiisi.',
        },
      ],
      note: {
        tag: 'Pelinimi on lukko, ei nimilappu',
        body: 'Jos klaanisi vaihtaa nimeä pelissä, vaihda se täälläkin — siihen asti synkronointi hylkää uuden nimen. Se on tarkistus toiminnassa, ei vika.',
      },
    },
    live: {
      title: 'Se on pystyssä',
      body: [
        'Paina **Luo klaani**, ja se on olemassa. Ei valmistelua, ei jonoa, ei ”rakennamme sivustoasi, palaa muutaman minuutin päästä” — klaani on rivi, joten se palvelee jo ennen kuin sivu ehtii vaihtua.',
        'Päädyt valintaan: **Aseta se** avaa ohjatun toiminnon, tai **Katsele ensin**. Mikään ei mene rikki jos poistut ja palaat huomenna; ohjattu toiminto muistaa mitkä vaiheet olet tehnyt.',
      ],
    },
    setup: {
      title: 'Ohjattu käyttöönotto',
      intro: 'Kolme vaihetta erottaa tuoreen klaanin käynnissä olevasta tapahtumasta, ja ohjattu toiminto käy ne järjestyksessä ja ohittaa sen minkä olet jo tehnyt. Taulu tulee heti perään.',
      steps: [
        {
          term: 'Klaanisi',
          body: 'Näyttönimesi, klaanin nimi pelissä ja kutsulinkki palvelimellesi. Kutsu on se, minkä avulla ilmoittautumissivut ja oppaat voivat ohjata ihmisiä luoksesi.',
        },
        {
          term: 'Yhdistä Discord',
          body: 'Yksi jaettu botti, joten ei sovellusta rekisteröitävänä eikä tokenia liitettävänä. Paina **Connect your bot** ja hyväksy se kerran, valitse sitten **A few channels** tai **Just one channel** ja paina **Set it up for me** — botti tekee kanavat puolestasi.',
        },
        {
          term: 'Tuo jäsenesi mukaan',
          body: 'Asenna lisäosa, kirjaudu sisään Discordilla, avaa sitten pelissä klaani-ikkunasi ja paina sen otsikkopalkin **Anvil**-painiketta. Kukaan ei voi ilmoittautua tapahtumaan ennen kuin jäsenlistasi on sisällä.',
        },
        {
          term: 'Tee taulu',
          body: 'Ohjattu toiminto päättyy painikkeeseen **Create your first event →**. Valitse muoto, lisää ruudut, avaa ilmoittautuminen — se on [Ensimmäisen tapahtuman pitäminen]({adminGuide}), ja selvästi pisin vaihe.',
        },
      ],
      after: [
        'Voit ohittaa ohjatun toiminnon kokonaan painikkeella **Skip setup** ja tehdä kaiken myöhemmin kohdista Admin → **Clan settings** ja Admin → **Discord**. Se on olemassa koska järjestys merkitsee kun ei ole koskaan tehnyt tätä: Discord ennen kanavia, jäsenet ennen taulua johon heidän pitää ilmoittautua.',
      ],
    },
    members: {
      title: 'Jäsenten saaminen mukaan',
      body: [
        'Kenenkään ei tarvitse ilmoittautua, rekisteröityä tai tulla kutsutuksi yksitellen. Jäsenlistasi tulee pelistä.',
      ],
      ways: [
        {
          term: 'Jäsenlistan synkronointi (tee tämä)',
          body: 'Avaa pelissä klaani-ikkuna lisäosan ollessa käynnissä ja paina otsikkopalkin **Anvil**-painiketta. Koko jäsenlistasi saapuu arvoineen, ja lista klaanista jonka nimi ei täsmää omaasi hylätään. Toista se kun väkeä tulee tai lähtee — katso [pelaajan asennusopas]({pluginGuide}).',
        },
        {
          term: 'He pyytävät päästä mukaan',
          body: 'Sisäänkirjautuminen tai pluginilla pelaaminen ei koskaan anna kenellekään paikkaa itsestään. Jos plugin näkee jonkun pelaavan pelin klaanissasi ennen kuin jäsenlistallasi on hänet, se tekee hänen puolestaan liittymispyynnön, ja kuka tahansa muu voi pyytää klaanisivusi **Apply**-painikkeella. Henkilökunta vastaa molempiin **Roster**-välilehden yläosassa, ja **Who can join** ratkaisee, odottavatko he hyväksyntää, pääsevätkö he heti sisään vai eivätkö he voi pyytää lainkaan. Joku, joka pelaa jäsenlistallasi jo olevaa hahmoa, vahvistetaan sen sijaan kohdassa **Needs review**. Yksityiskohdat ovat oppaassa [Väkesi]({peopleGuide}).',
        },
        {
          term: 'Käsin',
          body: 'Admin → **People** → **+ Add Manually** ottaa nimiä yksitellen, sitä varten joka pelaa mobiililla tai virallisella clientilla eikä voi ajaa lisäosaa lainkaan.',
        },
      ],
      note: {
        tag: 'Vieraat eivät ole ratkaistava ongelma',
        body: 'Vieras pelaa tapahtumissasi olematta pelin klaanissasi: vierailevan klaanin pelaaja, kaveri, alt. He saavat paikan, kun henkilökunta hyväksyy heidän pyyntönsä, tai heti, jos **Who can join** on asetettu tilaan **Let anyone in**. Heitä seurataan ja he voivat osallistua tapahtumiin, eivätkä he kuluta tilauksesi paikkoja. Joku, joka liittyy klaaniisi pelissä, tulee jäseneksi seuraavassa jäsenlistan synkronoinnissa.',
      },
    },
    first: {
      title: 'Ensimmäinen tapahtumasi',
      body: [
        'Lyhin tie siihen että jotain tapahtuu: tee taulu, lisää kourallinen ruutuja jotka lisäosa näkee itse, avaa ilmoittautuminen ja aloita. Dropit, tappomäärät ja XP kirjaavat sitten itsensä.',
        'Kaksi opasta kantaa tässä kuorman. [Ensimmäisen tapahtuman pitäminen]({adminGuide}) kulkee alusta loppuun — Discord, joukkueet, käynnistys ja mitä tehdä kun se päättyy. [Taulu joka seuraa itseään]({boardGuide}) käsittelee nimenomaan ruutuja: mitä kukin laji oikeasti pystyy havaitsemaan, ja ne jotka tuodaan siististi eivätkä sitten koskaan laukea.',
        'Jos et halua rakentaa taulua lainkaan ensimmäisellä viikolla, pidä sen sijaan **Skill of the Week** tai **Boss of the Week**. Kaikki listalla ovat automaattisesti mukana, tilanne tulee hiscoresista, eikä mitään tarvitse kirjoittaa.',
      ],
    },
    together: {
      title: 'Tapahtumat useiden klaanien kesken',
      body: [
        'Tapahtuman ei tarvitse kuulua yhdelle klaanille. Useat klaanit voivat pitää samaa taulua yhdessä — kaksi tai tusina — kunkin puolen säilyttäessä oman jäsenlistansa, oman henkilökuntansa ja oman puolikkaansa valvonnasta.',
        'Ne voivat myös jakaa yhden pelaajajoukon sen sijaan että istuisivat pistetaulun vastakkaisilla puolilla: yksi tapahtuma, kaikki mukana, riippumatta siitä miten joukkueet lopulta jaetaan. Klaani vastaan klaani on yksi muoto tästä, ei ainoa.',
        'Jokainen vieraileva klaani saa kutsulinkin joukkuetta kohden, joten et koskaan kerää yhtäkään RSN:ää käsin, ja paikan jolla heidän oma valvojansa voi hyväksyä omien jäsentensä todisteet. [Vierailevan klaanin isännöinti]({clanVsClanGuide}) käsittelee sellaisen järjestämistä.',
      ],
      note: {
        tag: 'Mitään ei tarvitse ostaa',
        body: 'Toisen tapahtumaan osallistuminen on ilmaista, ja sellaisen järjestäminen myös. Klaani joka vain ilmestyy muiden tauluille ei koskaan tarvitse muuta kuin oman ilmaisen klaaninsa.',
      },
    },
    boosts: {
      title: 'Klaanin boostit',
      body: [
        'Jäsenet, jotka maksavat Anvil Supporterista tasolla **Champion** (yksi boosti) tai **Patron** (kaksi), voivat boostata klaania omista asetuksistaan kohdasta **Settings → Clan boosts**. Boosti lasketaan, kun heidän paikkansa klaanissa on 14 päivää vanha, eikä yhdeltä ihmiseltä lasketa enempää kuin kaksi.',
        'Näet tilanteesi kohdasta Admin → **Clan settings** → **Boosts**: klaanin tason, montako boostia lasketaan ja montako lisää seuraava taso vaatii. Taso 1 vaatii 3 boostia, taso 2 vaatii 8 ja taso 3 vaatii 15. Jos boostit putoavat tason alle, sen edut pysyvät vielä viikon.',
        'Taso 1 lisää **Boosted**-merkin klaanisivullesi, Clan Hall -kortillesi ja hakuun, listaa klaanisi boostaamattomien klaanien yläpuolelle Clan Hallissa ja antaa klaanisi nimelle liukuvärin. Taso 2 lisää paikan Clan Hallin Featured-rivillä, toistaa animoidun bannerisi ja avaa rekrytointirivin (**Recruiting line**): yksi lause, enintään 140 merkkiä, joka näytetään vierailijoille. Taso 3 lisää Spotlightin Clan Hallin yläreunaan ja yhden rekrytointijulkaisun kuukaudessa Anvilin Discordiin (**Recruitment post in the Anvil Discord**): enintään 500 merkkiä, lähetetään kerran painikkeella **Post to the Anvil Discord**, mukana linkki klaanisivullesi, eikä ketään pingata.',
      ],
      note: {
        tag: 'Vain ulkonäköä',
        body: 'Boostit muuttavat sitä, miltä klaani näyttää ja missä se listataan. Ne eivät koskaan muuta rankkia, pisteitä, paikkojasi tai tilaustasi.',
      },
    },
    features: {
      title: 'Ominaisuudet ja paketti',
      intro: 'Ylläpitäjät voivat kytkeä kokonaisia Anvilin osia päälle tai pois kohdassa **Features**. Pois päältä ne piiloutuvat valikoista, mitään ei poisteta.',
      rows: [
        {
          term: 'Tapahtumat',
          body: '**Skill & Boss of the Week** (päällä), **Surprise-task formats** (pois), **Missions** (pois), **Post-event survey** (pois).',
        },
        {
          term: 'Raha',
          body: '**Sign-up fees** (päällä), **Clan coffer** (pois).',
        },
        {
          term: 'Discord ja lisäosa',
          body: '**Post to Discord** (päällä), **Death & fun messages** (pois), **Clan Hall card**, joka näyttää kuka on paikalla Discordissasi julkisella klaanisivullasi (päällä).',
        },
      ],
      outro: '**Plan and billing** näyttää pakettisi, kuinka monta jäsentä sinulla on sen kokoon nähden, ja isommat paketit. Jos maksat, myös **Manage subscription and invoices** on siellä.',
    },
  },

  discord: {
    metaTitle: 'Anvil Discordissa — Anvil',
    metaDescription: 'Yhdistä Anvil-botti Discord-palvelimellesi: yksi kutsu, kanavat joille kukin syöte julkaisee, rooli- ja nimimerkkisynkronointi, kauttaviivakomennot ja mitä tarkistaa kun se hiljenee.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil Discordissa',
    dek: 'Yksi botti, yksi kutsu, eikä sovellusta rekisteröitävänä. Tässä on mitä se julkaisee, minne se julkaisee, mitä se saa muuttaa palvelimellasi — ja mitä katsoa sinä päivänä kun se lakkaa.',
    facts: [
      {
        strong: 'Yksi botti',
        rest: 'jaettu, ei mitään luotavaa',
      },
      {
        strong: '~5 min',
        rest: 'kutsusta ensimmäiseen julkaisuun',
      },
      {
        strong: 'Valinnainen',
        rest: 'jokainen syöte on pois kunnes osoitat sen jonnekin',
      },
    ],
    footnote: 'Kaikki tämä on kohdassa Admin → **Discord**: pika-asetukset ylimpänä, sitten **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands ja Post without a bot.',
    bot: {
      title: 'Yksi botti, jo rakennettu',
      body: [
        'Ei Discord-sovellusta luotavana, ei tokenia luotavana eikä salaisuutta liitettävänä. Anvil ajaa yhtä bottia jonka jokainen klaani jakaa, joten yhdistäminen on kutsu eikä mitään muuta.',
        'Voit silti tuoda omasi — liitä token kohtaan **Use your own bot instead (advanced)**, niin sitä käytetään sen sijaan. Kannattaa vain jos haluat botin kantavan klaanisi nimeä ja kuvaa jäsenlistassa; kaikki tässä oppaassa toimii samoin kummin päin tahansa.',
      ],
      permissions: [
        {
          term: 'Näytä kanavat, Lähetä viestejä, Upota linkkejä, Liitä tiedostoja',
          body: 'Perusta. Ilman näitä se on palvelimellasi ja vaiti.',
        },
        {
          term: 'Hallitse webhookeja',
          body: 'Jotta **Set it up for me** ja **Post here** voivat tehdä webhookit puolestasi sen sijaan että kopioisit URL-osoitteita käsin Discordista, ja jotta Anvil voi löytää vanhat webhookit poistettaviksi.',
        },
        {
          term: 'Hallitse rooleja',
          body: 'Vain jos otat roolisynkronoinnin käyttöön. Silloin se voi jakaa kartoittamasi roolit — eikä se voi koskaan koskea omaansa ylempään rooliin, mikä on Discordin sääntö, ei meidän.',
        },
        {
          term: 'Hallitse lempinimiä',
          body: 'Vain jos otat nimimerkkisynkronoinnin käyttöön, jotta jäsenen palvelinnimimerkki voidaan asettaa hänen RSN:kseen.',
        },
        {
          term: 'Hallitse kanavia',
          body: 'Joukkueiden yksityisiin kanaviin draftin aikana sekä oppaisiin, jotka julkaistaan uutena kategoriana tai foorumina. Ilman sitä kaikki muu toimii silti.',
        },
        {
          term: 'Hallitse ketjuja, Lähetä viestejä ketjuihin',
          body: 'Foorumiin julkaistuja oppaita varten: julkaisuun kirjoittamiseen ja sen poistamiseen — ilman tätä Discord ei anna botin poistaa edes omaa foorumijulkaisuaan.',
        },
        {
          term: 'Vaihda lempinimi',
          body: 'Vain jos annat botille klaanisi nimen kohdassa **Connection → Bot appearance in your server**. Se muuttaa botin nimen vain teidän palvelimellanne.',
        },
      ],
      note: {
        tag: 'Se pyytää kaikkia kerralla',
        body: 'Discord ei voi pyytää oikeutta jälkikäteen, joten kutsulinkki pyytää koko setin, ja ne ominaisuudet joita et koskaan ota käyttöön eivät koskaan käytä omiaan. Kutsulinkin avaaminen uudelleen on myös tapa korjata oikeus jonka joku poisti.',
      },
    },
    connect: {
      title: 'Yhdistäminen',
      intro: 'Kaksi asiaa, tässä järjestyksessä. Botin on oltava palvelimellasi, ja Anvilin on tiedettävä mikä palvelin on sinun.',
      steps: [
        {
          term: 'Kutsu botti',
          body: 'Admin → **Discord** → **Connect your Discord server** (tai **Add Anvil to Discord**). Discord kysyy, mille palvelimelle Anvil lisätään, ja palauttaa sinut tänne, joten et voi lisätä sitä väärään vahingossa. Myöhemmin **Invite / re-invite the bot** löytyy kohdasta **More settings → Connection**.',
        },
        {
          term: 'Aseta palvelintunnus',
          body: 'Vain jos painike ei onnistu: avaa **Can’t use the button? Enter the server ID**, napsauta palvelimesi kuvaketta Discordissa hiiren oikealla → **Kopioi palvelimen ID** (vaatii, että Kehittäjätila on päällä Discordin omissa asetuksissa kohdassa Lisäasetukset), liitä se kenttään **Your Discord server’s ID** ja paina **Save**. Tämä kenttä tekee yhteydestä nimenomaan sinun.',
        },
      ],
      after: [
        'Paneeli kertoo sitten totuuden aikeesi sijaan: onko botti todella tuon palvelimen jäsen ja mitä oikeuksia siltä puuttuu. Vihreä rivi siellä on enemmän arvoinen kuin tallennettu lomake.',
      ],
      note: {
        tag: 'Palvelintunnus on koko sidos',
        body: 'Palvelin kuuluu Anvilissa täsmälleen yhdelle klaanille, ja kauttaviivakomennot palvelimelta jota kukaan ei ole ottanut omakseen hylätään sen sijaan että arvattaisiin. Kunnes asetat sen, botti on kutsuttu ja toimeton.',
      },
    },
    channels: {
      title: 'Webhookien määritys',
      body: [
        'Anvil julkaisee **webhookien** kautta, yksi per kanava, ja jokainen niistä on valinnainen. Mitään ei julkaista minnekään ennen kuin osoitat syötteen kanavalle — tuore klaani on hiljainen tarkoituksella, ei vahingossa.',
        'Kun Anvil-botti on palvelimellasi, **Set it up for me** sivun **Admin → Discord** yläosassa tekee kanavat ja osoittaa jokaisen syötteen niihin. Jos teet sen käsin, avaa **More settings → What goes where** ja aloita kanavasta **Catch-all channel** välilehdellä **Clan & events**, sitten **In-game catch-all** välilehdellä **In-game (plugin)**: valitse kanava pudotusvalikosta, niin se tallentuu. Ilman bottia avaa Discord-kanavan **Muokkaa kanavaa → Integraatiot → Webhookit**, luo webhook, kopioi sen URL, valitse pudotusvalikosta **Paste a webhook…**, liitä se ja paina **Save**. Webhook-URL voi julkaista kanavalleen, joten käsittele sitä salasanana; jos se vuotaa, poista se Discordissa ja luo uusi. **Test** sekä **Add another**, jolla vilkkaat julkaisut kierrätetään kahden webhookin välillä, löytyvät kohdasta **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Yleiskanava (Catch-all channel)',
          body: 'Tärkein, välilehdellä **Clan & events**. Tapahtumien alut ja loput, ilmoittautumisen avautuminen, tilanteet, viikkotulokset — kaikki mitä sivusto julkaisee ilman omaa kanavaa. Aseta tämä äläkä mitään muuta, niin sinulla on toimiva klaani.',
        },
        {
          term: 'Pelin yleiskanava (In-game catch-all)',
          body: 'Välilehdellä **In-game (plugin)**: minne kaikki pelistä tuleva menee kun sillä ei ole omaa kanavaa. Aseta tämä toisena.',
        },
        {
          term: 'Eriytetyt syötteet',
          body: 'Tapahtumajulkaisut, yhdessä isännöimäsi taulut, Skill & boss of the week ja klaanikalenterin tapahtumat voi erottaa yleiskanavasta; harvinaiset dropit, lemmikit, collection log, tasot, combat achievementit, questit, diaryt, kuolemat ja PvP-tapot voi erottaa pelin yleiskanavasta. Jäsenlistan muutokset, ilmoittautumisten hyväksynnät ja kassan kirjanpito ovat välilehdellä **Staff only**. Tyhjiksi jätetyt erilliset syötteet putoavat takaisin omaan yleiskanavaansa. Kassa on poikkeus: tyhjä tarkoittaa, ettei rahasta julkaista mitään. Leaguesilla ja muilla pelimuodoilla on oma välilehtensä **Game modes**.',
        },
      ],
      note: {
        tag: 'Eriytä kuolemat ensin',
        body: 'Kuolemat ovat useimmilla tauluilla suurivolyymisin syöte ja se joka hautaa kaiken muun. Jos eriytät vain yhden asian, eriytä se.',
      },
    },
    roles: {
      title: 'Roolit ja nimimerkit',
      body: [
        'Molemmat synkronoinnit ovat pois käytöstä, kunnes otat ne käyttöön kohdassa **Admin → Discord → Roles & nicknames**, ja molempia ohjaa jäsenlista. Laita **Enable Discord role sync** päälle, jätä **Auto-match in-game rank → Discord role by name** päälle, valitse mahdolliset yleiset **Member roles** ja **Guest roles**, tallenna ja paina sitten **Sync roles & nicknames now**. Jokaisella henkilöllä pitää myös olla yhdistetty Discord-tili; synkronointiraportti nimeää kaikki, joita se ei pystynyt tunnistamaan.',
      ],
      ways: [
        {
          term: 'Roolisynkronointi',
          body: 'Kartoita pelin arvot Discord-rooleihin, niin Anvil pitää ne linjassa. Lisäksi on erilliset roolit jäsenille, vieraille, kapteeneille ja käynnissä olevalle tapahtumalle, joten voit pingata oikeat ihmiset ylläpitämättä listaa käsin.',
        },
        {
          term: 'Nimimerkkisynkronointi',
          body: 'Asettaa jäsenen palvelinnimimerkin hänen RSN:kseen. Oletuksena se täyttää tyhjän nimimerkin ja sille voi käskeä korvata itse valitun — se on asetus jota kannattaa miettiä ennen, ei jälkeen.',
        },
      ],
      note: {
        tag: 'Botin roolin on oltava hallitsemiensa yläpuolella',
        body: 'Discord ei anna minkään botin koskea omaansa vastaavaan tai ylempään rooliin, ja se kieltäytyy siitä hiljaa sinun päästäsi — synkronointi ei silloin yksinkertaisesti tee mitään. Vedä Anvil-rooli ylös kohdassa **Palvelimen asetukset → Roolit**, niin se alkaa toimia; mitään ei tarvitse kutsua uudelleen.',
      },
    },
    commands: {
      title: 'Kauttaviivakomennot',
      body: [
        'Botti vastaa palvelimellasi komentoon `/bingo` (taulu, tilanne, säännöt, oma korttisi) sekä klaanikomentoihin kuten `/sotw`, `/stats` ja `/coffer`. Ne lukevat sivustoa reaaliajassa, joten kenenkään ei tarvitse poistua Discordista nähdäkseen tilanteensa. [Jokaisella komennolla ja sen valinnoilla]({commandsGuide}) on oma sivunsa.',
        'Ne ilmestyvät noin minuutin kuluttua botin liittymisestä. Jos ne eivät ilmesty lainkaan, kutsu myönsi botin muttei sen komentoja — ne ovat kaksi erillistä oikeutta, ja vanhempi kutsulinkki pyysi vain toista. Aja **Invite / re-invite the bot** uudelleen Discord-sivun kohdasta **Connection**; se ei poista bottia eikä nollaa mitään.',
      ],
      note: {
        tag: 'Se vastaa kunkin omalla kielellä',
        body: 'Oletuksena botti vastaa sillä kielellä jonka kyseinen jäsen on asettanut Discordiinsa, englanti varalla. Valitse yksi kieli kohdasta **Botin kieli** ohittaaksesi tämän kaikilta — se on myös ainoa tie arabiaan, koska Discordissa ei ole arabiankielistä clientkieltä havaittavaksi.',
      },
    },
    posts: {
      title: 'Mitä se julkaisee ja milloin',
      body: [
        'Kaksi lähdettä, ja kannattaa tietää kumpi on kumpi kun jokin näyttää väärältä.',
        '**Sivusto** julkaisee tapahtumista: taulun avautuminen, ilmoittautuminen, aloitus, tilanteet, tulos. Ne lähtevät Anvilista itsestään ja toimivat riippumatta siitä onko kenelläkään lisäosaa.',
        '**Lisäosa** julkaisee mitä pelissä tapahtuu: dropit, lemmikit, kuolemat, tasot, collection log -paikat, combat achievementit. Ne ovat olemassa vain sitä ajaville jäsenille, joten hiljainen drop-kanava tarkoittaa yleensä hiljaista lisäosaa eikä rikkinäistä webhookia.',
      ],
      note: {
        tag: 'Mitään ei julkaista kahdesti',
        body: 'Droppi joka täydentää ruudun on yksi julkaisu, ei yksi lisäosalta ja toinen taululta.',
      },
    },
    modes: {
      title: 'Leagues, Deadman ja muut pelimuodot',
      body: [
        'Leagues, Deadman, hardcore ja muut pelimuodot pyörivät omilla maailmoillaan omilla hahmoillaan. Niiden julkaisut on aina merkitty, eivätkä ne koskaan laske tauluihin tai kilpailuihin. Niillä on oma välilehtensä: **Admin → Discord → What goes where → Game modes**. Pelimuoto ilmestyy sinne, kun joku jäsen pelaa sitä ensimmäisen kerran.',
        'Jokaisella pelimuodolla on kytkin ja **To**-kanava. Laita **Send game-mode posts to their own channels** päälle käyttääksesi noita kanavia; jos jätät sen pois päältä, jokainen pelimuoto julkaisee tavallisille kanaville, yhä merkittynä. Pelimuodon rivin **Posts**-painike listaa kaikki sen lähettämät julkaisutyypit — tavalliset ja pelimuodon omat tapahtumat — ja jokaisella on oma kytkimensä.',
        'Listan alla **Custom filters** saavat pelimuodon julkaisemaan vähemmän kuin pääpeli. **Post drops rarer than 1 in…** asettaa oman harvinaisuusrajan (tyhjä = sama kuin pääpelissä): aina julkaistavat esineet julkaistaan silti, mutta dropit, jotka lasketaan vain arvonsa vuoksi, eivät. **Use its own level milestones** julkaisee tason nousun vain, jos se täyttää molemmat sääntökokonaisuudet.',
      ],
      note: {
        tag: 'Tiukempi, ei koskaan löysempi',
        body: 'Pelimuodon suodattimet voivat vain karsia julkaisuja. Lisäosa on jo soveltanut pääpelin asetuksesi, joten mikään pelimuodon suodatin ei voi tuoda julkaisua takaisin.',
      },
    },
    cleanup: {
      title: 'Vanhat webhookit muilta lisäosilta tai boteilta',
      body: [
        'Kun botti on palvelimellasi, Discord-sivu listaa sen jokaisen webhookin, joka ei ole Anvilin. **Coming from other plugins?** tarjoaa vaihtoehdon **Use the same channels**, jolloin **Set it up for me** julkaisee sinne, minne vanhat syötteesi julkaisivat, eikä jäsenillesi siirry mikään.',
        'Kun jäsenesi ovat Anvilissa, mene kohtaan **Remove old webhooks from other plugins**, rastita poistettavat ja paina **Remove … webhooks**, sitten **Yes, remove them**. Se poistaa ne Discordista lopullisesti — sitä ei voi perua.',
        'Listassa on jokainen webhook, joka ei ole Anvilin, ei pelkästään muiden lisäosien. Onko joukossa jokin, jonka haluat pitää, kuten toisen botin syöte? Paina **Keep**, niin se poistuu listalta; **Show kept** ja **Put back** tuovat sen takaisin. Pitäminen vain piilottaa sen täällä — Discordissa mikään ei muutu.',
      ],
      note: {
        tag: 'Vaatii Hallitse webhookeja -oikeuden',
        body: 'Botti lukee palvelimesi webhookit löytääkseen ne. Ilman _Hallitse webhookeja_ -oikeutta sen roolissa sivu kertoo, ettei se näe niitä.',
      },
    },
    announce: {
      title: 'Julkaise Discordiin',
      body: [
        'Adminit voivat julkaista bottina kohdasta **Post to Discord**, joka on ylläpitovalikossa kohdan **Clan** alla. Valitse **Channel**, kirjoita **Message** ja paina **Send message**. Pitkä teksti, kuten sääntökirja, jaetaan itsestään useaksi viestiksi.',
        '**Send as an embed** on oletuksena päällä ja lisää valinnaisen otsikon (**Title**) ja korostusvärin (**Accent colour**); ota se pois päältä, jos haluat pelkkää tekstiä. **Ping** valitsee roolin, tai @everyonen, joka mainitaan, ja Anvil kysyy ennen lähettämistä.',
        'Jokainen lähettämäsi julkaisu näkyy kohdassa **Sent from here**. **Edit** muuttaa sitä Discordissa pingaamatta uudelleen, ja **Delete** poistaa sen.',
      ],
      note: {
        tag: 'Vain adminit, botin kanssa',
        body: 'Se julkaisee Anvilin bottina, joten yhdistä palvelimesi ensin. Moderaattorit eivät näe sitä. Se on **Post to Discord** -kytkin kohdassa **Clan settings → Features**; pois päältä se katoaa valikosta.',
      },
    },
    quiet: {
      title: 'Kun se hiljenee',
      body: [
        'Järjestyksessä, koska kukin sulkee pois seuraavan:',
      ],
      checks: [
        {
          term: 'Onko botti todella palvelimella?',
          body: '**Connection** Discord-sivulla kertoo sen suoraan. ”Token kelpaa” ja ”palvelimellasi” ovat eri asioita, eikä ensimmäinen tarkoita toista — jaetulla botilla token on aina kelvollinen.',
        },
        {
          term: 'Onko palvelintunnus oikein?',
          body: 'Väärä mutta aito tunnus näyttää täsmälleen oikealta, kunnes huomaat julkaisujen menevän muualle.',
        },
        {
          term: 'Onko webhook yhä olemassa?',
          body: 'Discord-kanavan poistaminen poistaa sen webhookin, ja Anvil säilyttää kuolleen URL-osoitteen. Valitse sille kanava uudelleen kohdassa **What goes where**.',
        },
        {
          term: 'Onko botin rooli tarpeeksi korkealla?',
          body: 'Vain rooli- ja nimimerkkisynkronoinnille — katso yllä. Tämä on se joka epäonnistuu hiljaa.',
        },
      ],
      note: {
        tag: 'Se ei voi toivottaa liittyviä tervetulleiksi',
        body: 'Discord ilmoittaa liittymisistä vain gateway-yhteyden kautta, jota jaettu botti ei pidä auki jokaiselle palvelimelle. Siksi ei ole ”tervetuloa”-julkaisua — laita ilmoittautumislinkki sen sijaan #roolit- tai #aloita-tästä-kanavalle, josta ihmiset joka tapauksessa katsovat.',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite-pluginin käyttöönotto — Anvil',
    metaDescription:
      'Asenna Anvilin RuneLite-plugin, kirjaudu sisään sen sivupaneelista ja ota käyttöön Discord-ilmoitukset.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Käyttöönotto-opas pelaajille',
    dek: 'Asenna se, kirjaudu sisään ja pelaa. Plugin lähettää bingo-droppisi, postaa harvinaiset dropit, kuolemat ja virstanpylväät Discordiin ja antaa sinun hakea kenet tahansa hiiren oikealla.',
    facts: [
      { strong: '1 painike', rest: 'ja seuranta on käynnissä' },
      { strong: '~3 min', rest: 'perusasetuksiin' },
      { strong: 'Oikea klikkaus', rest: 'hakee kenet tahansa' },
    ],
    footnote:
      'Kuvakaappaukset ovat oikeasta asennuksesta — tilin token on peitetty tarkoituksella. Omasi kuuluu pysyä yhtä yksityisenä.',

    install: {
      title: 'Asenna plugin',
      body: [
        'RuneLitessä: **Configuration** (jakoavain) → **Plugin Hub** → hae **Anvil** → **Install**. Julkaisija on `AhmedFathy2001`.',
        'Yksi plugin palvelee kaikkia klaaneja — se yhdistää aina osoitteeseen `anvilosrs.com`, ja sisäänkirjautuminen (seuraava vaihe) on se, mikä liittää sen sinuun ja klaaneihisi. Mitään klaanikohtaista ei tarvitse ladata eikä mitään osoitetta kirjoittaa. Asennuksen jälkeen RuneLiten sivupalkkiin ilmestyy **Anvil**-painike, ja asetukset löytyvät kohdasta **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Kirjaudu sisään',
      intro: 'Avaa **Anvil**-paneeli RuneLiten sivupalkista ja klikkaa **Sign in with Discord**. Selain avautuu osoitteeseen `anvilosrs.com`; hyväksy koodi siellä, niin plugin kirjautuu itse sisään — ei mitään kirjoitettavaa, ei mitään kopioitavaa eikä mitään täytettävää asetuksissa.',
      panelFigure: {
        caption: 'RuneLite → Anvil-painike',
        alt: 'RuneLiten sivupalkin kuvakkeet, joissa Anvil-painike rivin alalaidassa on ympyröity',
        legend: [
          {
            label: 'Anvil-painike',
            body: 'RuneLite-ikkunan reunassa, kuvakerivin alimmaisena. Napsauta sitä avataksesi paneelin. Se ilmestyy heti, kun lisäosa on asennettu ja päällä — ja voit raahata sen ylemmäs riviin, jos haluat sen lähemmäs yläreunaa.',
          },
        ],
      },
      signInFigure: {
        caption: 'Anvil-paneeli',
        alt: 'Anvil-paneeli, jossa Sign in with Discord -painike ja sivusto johon se yhdistää on ympyröity',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'näkyy vain niin kauan kuin tämä tietokone on kirjautunut ulos. Napsauta sitä, ja loput tapahtuu selaimessasi.',
          },
          {
            label: 'Connects to',
            body: 'aina `anvilosrs.com` — ainoa sivusto, jonka kanssa plugin keskustelee, ja se, johon tokenisi kuuluu.',
          },
          {
            label: 'Paste a token instead',
            body: 'varakeino, jos selainvaihe ei toimi sinulla — katso tämän vaiheen loppu.',
          },
        ],
      },
      easySteps: [
        'Klikkaa **Sign in with Discord**. Paneeli näyttää lyhyen koodin ja avaa selaimen osoitteeseen `anvilosrs.com`.',
        'Kirjaudu siellä Discordilla, jos et ole jo kirjautunut, tarkista että sivun koodi vastaa RuneLitessa näkyvää ja klikkaa sitten **Approve**.',
        'Takaisin RuneLitessa paneelin yläosassa lukee _Signed in_ — ja peliin kirjauduttuasi myös se, mitä hahmoa seurataan. Siinä kaikki.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Link your RuneLite client -sivu, jossa koodikenttä ja Approve-painike on kehystetty',
        legend: [
          { label: 'Koodi', body: 'sen on vastattava sitä, mitä plugin näyttää sinulle juuri nyt.' },
          {
            label: 'Approve',
            body: 'hyväksy vain koodi, jonka _oma_ asiakasohjelmasi näyttää. Jos joku lähetti sinulle linkin tai koodin, hylkää se — hyväksyminen luovuttaisi heille tilisi.',
          },
        ],
      },
      directNote: {
        tag: 'Missä tämä tapahtuu',
        body: [
          'Koko tämä kulku pysyy osoitteessa `anvilosrs.com` — koodi myönnetään siellä, hyväksyt sen siellä omalla Discord-kirjautumisellasi, ja token palautetaan suoraan pluginille. Plugin avaa kirjautumissivuja vain osoitteessa `anvilosrs.com`, joten muualle osoittava kirjautumislinkki ei ole peräisin siltä.',
        ],
      },
      federationAside:
        'Ei pidä sekoittaa sivupaneelin **Connect clans** -painikkeeseen — se on erillinen, vapaaehtoinen painike joka yhdistää sinut muihin Anvil-klaaneihin, ja se ilmestyy vasta kun olet jo kirjautunut täällä.',
      manualFallback:
        'Jos selain ei aukea itsestään, paneeli tulostaa osoitteen ja koodin, jotta voit avata sen käsin. Koodit vanhenevat kymmenessä minuutissa — paina vain painiketta uudelleen.',
      manualHeading: 'Varakeino: liitä token käsin',
      manualIntro:
        'Jos kirjautuminen pluginista ei toimi sinulla, kopioi tokenisi alta (tai kohdasta [Profile → plugin token](/profile#plugin-token), jossa voit myös vaihtaa sen), klikkaa sitten Anvil-paneelissa kirjautumispainikkeen alla olevaa **Paste a token instead** -linkkiä ja liitä se sinne.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'Profiilisivun RuneLite plugin -kortti, jossa token-kenttä sekä Reveal-, Copy- ja Rotate-painikkeet on kehystetty',
        legend: [
          {
            label: 'Tokenisi',
            body: 'piilotettu kunnes painat Reveal. Se on peitetty tässä kuvakaappauksessa tarkoituksella; älä koskaan julkaise omaasi Discordissa.',
          },
          {
            label: 'Copy / Rotate',
            body: 'kopioi se ja käytä sitten **Paste a token instead** -toimintoa Anvil-paneelissa. Rotate myöntää uuden ja tappaa vanhan — käytä sitä jos epäilet tokenisi vuotaneen.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Käytä sivupaneelia päivittäin',
        body: ['**Anvilin sivupaneeli on pääasiallinen työtilasi**: kirjaudu siellä sisään ja ulos, katso klaanisi ja aktiiviset tapahtumat, selaa ja lunasta ruutuja, seuraa edistymistä, ota aloituskuvia, suorita synkronointeja ja avaa tukityökalut. Alla näkyvä **Configuration → Anvil** on vain asetuksia varten — siinä ei ole tokenia. Kirjataksesi tämän tietokoneen ulos avaa **⋯**-valikko nimesi vierestä paneelin yläosassa. Yksi kirjautuminen kattaa kaikki tapahtumat, joihin olet ilmoittautunut — sitä ei tarvitse tehdä uudelleen jokaista bingoa varten.'],
      },
    },

    accounts: {
      title: 'Yhdistä tilisi',
      body: [
        'Kun token on asetettu, pelaamasi tilit näkyvät profiilissasi automaattisesti. Täysin uusi tili voidaan yhdistää heti; jo klaanin jäsenlistalla oleva tili vaatii ensin omistajuustarkistuksen, koska julkinen RuneScape-nimi ei todista omistajaa.',
        'Tee ensimmäinen yhdistäminen [nopealla XP-tarkistuksella](/profile#link-account) tai pyydä klaanin moderaattoria hyväksymään tili kohdassa [havaitut tilit](/profile#detected-accounts). Sen jälkeen pysyvä tilisormenjälki seuraa nimenvaihdoksia ja tunnistaa tilin automaattisesti.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Profiilisivun RuneScape Accounts -kortti, jossa on listattu pluginin kautta vahvistetut tilit',
        legend: [
          {
            label: 'Yhdistetyt tilisi',
            body: 'kaikki merkinnällä “Verified via plugin” on yhdistetty ja tunnistetaan automaattisesti. Valmiiksi klaanin listalla oleva tili voi ensin vaatia kertaluonteisen XP- tai moderaattoritarkistuksen.',
          },
        ],
      },
      noPluginHeading: 'Etkö voi käyttää pluginia?',
      noPluginIntro:
        'Mobiililla tai virallisella asiakasohjelmalla käytä [Profile → account linking](/profile#link-account):',
      noPluginOptions: [
        '**Verify by XP** — syötä RSN:si, sivusto valitsee satunnaisen taidon, ja sinun on ansaittava siinä 1 000 XP 30 minuutin sisällä.',
        '**Manual review** — piilotetuille Hiscoresille tai aivan uusille alt-tileille: lähetä RSN:si huomautuksen kera, ja moderaattori hyväksyy sen.',
      ],
      signupNote:
        'Tapahtumiin ilmoittautuminen vaatii vähintään yhden vahvistetun tilin, joten hoida tämä ennen kuin ilmoittaudut.',
    },

    working: {
      title: 'Tarkista että se toimii',
      intro:
        'Kirjaudu sisään ja lue chat-ikkunaa. Plugin tervehtii sinua kun se on yhdistetty ja tapahtuma on käynnissä.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…myöhemmin, kun asioita tapahtuu…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Näet myös **Anvilin sivupaneelin** täyttyvän klaaneistasi, käynnissä olevista tapahtumista, sijoituksestasi ja synkronointipainikkeista — ja pelin Collection Login otsikkopalkkiin ilmestyy **Anvil**-painike.',
      guestNote: {
        tag: 'Vieras vai jäsen',
        body: 'Jos chat sanoo _Tracked as a guest_, sinua seurataan mutta et ole vielä klaanin jäsenlistalla. Ylläpitäjä korjaa sen synkronoimalla jäsenlistan pelistä — kysy {discordLink}.',
        discordWord: 'Discordissa',
      },
      panelHeading: 'Sivupaneeli',
      panelBody: [
        'Neljä välilehteä ja ratas. **Clan** on tapahtumasi ja klaanisi: jokainen käynnissä oleva ja tuleva bingo ja viikkokilpailu sijoituksinesi. **Feed** on klaanisi ja taulujesi suuret hetket sitä mukaa kuin ne tapahtuvat, tapahtumachatin kanssa. **You** on oma profiilisi, ja **Lookup** löytää kenen tahansa muun, pelaajan tai klaanin. Rattaasta löytyvät synkronointi ja banneriäänesi.',
        'Jokainen välilehti, tapahtumachat, reaktiot ja asetukset, jotka tuovat syötteen ja Supporter-värit peliisi, ovat oppaassa [Sivupaneeli välilehti kerrallaan]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Anvilin sivupaneelin kolme välilehteä rinnakkain: Clan-välilehti tapahtumineen ja klaanin viikkoineen, You-välilehti, jossa on Collection Logisi, ja Lookup-välilehti, jossa näkyy toisen pelaajan kortti',
      },
      lookupHeading: 'Hae kenet tahansa',
      lookupBody:
        'Napsauta pelaajaa hiiren oikealla — vieressäsi tai nimeä chatissa, kaverilistassa tai klaanipaneelissa — ja valitse **Anvil** avataksesi hänen korttinsa sivupaneelin **Lookup**-välilehdellä. Omasi on **You**-välilehti.',
      lookupFigure: {
        caption: 'Oikea napsautus nimeen → Anvil',
        alt: 'Pelaajan oikean napsautuksen valikko pelissä, jossa Anvil-kohta on Lookupin alla',
      },
      lookupSettingNote:
        'Valitse pluginin asetusten kohdasta **Player lookup**, missä **Anvil**-valinta näkyy. Chatissa nimen kohdalla se ei ole koskaan vasemman klikkauksen toiminto, joten nimen klikkaaminen tekee yhä sen, mitä peli tekee.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Anvilin asetusten Player lookup -osio, jossa jokainen asetus on kehystetty ja numeroitu',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'pääkytkin. Pois päältä se piilottaa valinnan kaikkialta.',
          },
          {
            label: 'Players in the world',
            body: 'oikea klikkaus lähelläsi seisovaan pelaajaan.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'nimet chatboxissa ja yksityisviesteissä.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'nimilistat: klaanisi ja vierasklaanin jäsenet, friends chat -kanava, kaveri- ja estolistasi sekä raidiporukan paneeli.',
          },
        ],
      },
    },

    bingo: {
      title: 'Bingo-asetukset',
      intro:
        'Näillä on merkitystä vain kun olet mukana tapahtumassa. Oletusarvot ovat hyvät — tässä on mitä kukin niistä oikeasti tekee.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Pluginin asetusten Bingo-osio, jossa jokainen asetus on kehystetty ja numeroitu',
        legend: [
          {
            label: 'Show Overlay',
            body: 'piirtää pienen _Anvil / joukkue / UTC-päivämäärä_ -paneelin vasempaan yläkulmaan. Siitä tulee osa todistekuvakaappaustesi kuvaa, ja juuri se tekee todisteen väärentämisestä tai taannehtivasta päiväämisestä vaikeaa. Se on pois päältä tässä kuvassa — laita se päälle jos klaanisi haluaa joukkueen ja ajan näkyviin jokaiseen todisteeseen.',
          },
          {
            label: 'Team completion popups',
            body: 'banneri kun kuka tahansa joukkueestasi saa ruudun valmiiksi. Useita kerralla: vaikein saa bannerin, loput menevät chattiin.',
          },
          {
            label: 'My tile popups',
            body: 'ponnahdusikkuna, kun oma droppisi vie ruutua eteenpäin tai saa sen valmiiksi. Pois päältä seuranta jatkuu — vain hiljaa.',
          },
          {
            label: 'Banner sound + volume',
            body: 'soittaa äänen bannerin kanssa. Mitään ei kuulu, ennen kuin lisäät itse vähintään yhden .wav-tiedoston kohdasta **Add clip** “Banner sounds” -otsikon alla Anvilin sivupaneelissa. Tehtävillä on oma kansionsa — lisää klippi kohtaan **Mission sounds**, niin ne soittavat sen sisäänrakennetun äänen sijaan, joka erottaa ne valmiista ruudusta.',
          },
          {
            label: 'Auto starting shot',
            body: 'ottaa tapahtuman aloituskuvan puolestasi heti, kun seisot sen kiinnitetyssä paikassa. Pois päältä painat itse **Take starting shot** sivupaneelissa.',
          },
        ],
      },
      teamsHeading: 'Joukkueet',
      teamsBody:
        'Tapahtuman **Teams**-painike listaa sen joukkueet sijoitusjärjestyksessä, omasi ylimpänä. Avaa joukkue nähdäksesi sen kokoonpanon, kapteeni ensimmäisenä, tai hae pelaajaa kaikista joukkueista — napsauta nimeä hakeaksesi hänet.',
      teamsFigure: {
        caption: 'Event → Teams',
        alt: 'Teams-sivu, jossa tapahtuman joukkueet pisteineen ja jäsenmäärineen, vieressä yhden joukkueen kokoonpano kapteeni ensimmäisenä',
      },
      startHeading: 'Aloituskuva',
      startBody: [
        'Jotkin tapahtumat vaativat kaikilta **aloituskuvan**: yhden kuvakaappauksen otettuna sen jälkeen kun tapahtuma on alkanut, paikassa joka arvotaan aloitushetkellä. Se estää ketään käyttämästä tapahtumaa edeltävää viikkoa cluejen, arkkujen ja tappojen varastointiin ensimmäisenä päivänä kaadettavaksi.',
        'Jos käytät pluginia, mitään ei tarvitse valmistella. Kun tapahtuma alkaa, saat chat-rivin joka kertoo minne mennä, ja Anvilin sivupaneeli näyttää **Take starting shot** -painikkeen. Mene siihen paikkaan, paina kerran, ja olet valmis — plugin ottaa kuvan, leimaa siihen RSN:si, joukkueesi, paikan ja salasanan jonka vain sinun tilisi saa, ja arkistoi sen puolestasi.',
        'Kaksi asiaa se tarkistaa ennen kuin arkistoi mitään, jotta korjaat ne pelissä eikä Discord-kiistassa jälkikäteen. Jos isäntä on kiinnittänyt paikan kartalle, plugin tietää kuinka kaukana olet ja kertoo siitä sen sijaan että lähettäisi kuvan väärältä puolelta Gielinoria. Ja jos tapahtuma vaatii tuoreen istunnon, sinun on **kirjauduttava ulos ja takaisin sisään** ennen kuvan ottamista: hiscores tallentuu vain uloskirjautuessa, joten uudelleenkirjautuminen juuri ennen kuvaa on se, mikä tekee aloituslukemistasi — ja siten jokaisesta XP- ja KC-ruudusta — oikeat.',
        'Mobiililla tai ilman pluginia: avaa **My Team** tällä sivustolla, lue salasanasi aloituskuvakortilta, kirjoita se pelin chattiin, ota kuvakaappaus jossa sekä hahmosi että salasana näkyvät, ja lataa se samalle kortille. Lataus lasketaan heti — voit pelata sillä hetkellä kun se on sisällä, ja henkilökunta tarkistaa sen jälkikäteen. Kirjaudu ensin ulos ja sisään jos kortti pyytää sitä.',
      ],
    },

    notifications: {
      title: 'Discord-ilmoitukset',
      intro:
        'Nämä lähtevät riippumatta siitä onko bingo käynnissä, ja ne julkaistaan klaanin kanaviin. Minkä kanavan ylläpitäjät määrittävät täällä — sinä valitset vain _mitä_ julkaiset. Seuraavassa lisäosan päivityksessä nämä valinnat siirtyvät verkkosivulle kohtaan **Settings → Discord posts & screenshots**, ja ne seuraavat sinua jokaiselle tietokoneelle. Samalla sivulla **Screenshot privacy** valitsee, mikä chat (yksityisviestit, julkinen chat, klaanichat) piilotetaan jokaisesta lisäosan ottamasta kuvakaappauksesta. Lisäosaan jää kaksi kytkintä kohtaan **Notifications**: **Share clan posts** keskeyttää kaikki pääpelin julkaisut kerralla, ja **Share seasonal activity** tekee saman Leaguesissa, Deadmanissa ja muissa kausimaailmoissa.',
      examplesFigure: {
        caption: 'Tältä julkaisu näyttää',
        alt: 'Kaksi Anvilin Discord-julkaisua: Grandmaster-taistelutehtävä pisteineen ja edistyminen seuraavaan avaukseen sekä kuolema viesteineen, kummassakin kuvakaappaus hetkestä',
      },
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Ilmoitusosiot Deaths and kills ja Drops and pets, joissa jokainen asetus on kehystetty ja numeroitu',
        legend: [
          {
            label: 'Notify on death',
            body: 'julkaisee klaanin kuolemakanavaan kuvakaappauksen siitä hetkestä jolloin kuolit.',
          },
          { label: 'Death message', body: 'oma rivisi. `{name}` korvataan RSN:lläsi.' },
          {
            label: 'Notify on PvP kill',
            body: 'kuvakaappaus siitä tickistä jolloin kohteesi osuu 0 HP:hen. Pois päältä oletuksena; päällä tässä.',
          },
          { label: 'Notify on rare drops', body: 'droppi-julkaisujen pääkytkin.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'pudotus julkaistaan, kun sen arvo on vähintään tämä (GE tai high alch, kumpi on korkeampi) tai se on harvinaisempi kuin 1/N. Anvil alkaa arvosta 1m ja 1/1,000. Klaanisi voi asettaa omat oletuksensa jäsenilleen, ja kunnes asetat oman numeron, seuraat klaanisi numeroa; **Palauta klaanin oletus** (tai **Palauta Anvilin oletus**, jos sinulla ei ole klaania) palauttaa seuraamisen. Klaani voi myös asettaa kovan harvinaisuusrajan omille kanavilleen, jonka alle oma numerosi ei voi mennä. Aseta jompikumpi numero nollaan kytkeäksesi sen pois.',
          },
          {
            label: 'Arvo ja harvinaisuus yhdessä',
            body: 'oletuksena pudotus julkaistaan, kun se täyttää arvoehdon **tai** harvinaisuusehdon. Kytke päälle **Vaadi molemmat**, jolloin sen on täytettävä arvoehto **ja** harvinaisuusehto. Klaanisi voi valita tämän oletuksen jäsenilleen; kunnes valitset itse, seuraat sitä, ja ilman klaania se on jompikumpi. Jokainen omista webhookeistasi voi myös asettaa oman vähimmäisarvonsa, harvinaisuutensa ja joko/molemmat-valintansa; kaikki mitä se jättää tyhjäksi, seuraa asetuksiasi.',
          },
          {
            label: 'Loot key value',
            body: 'loot key julkaistaan kerran, yhtenä ilmoituksena, kun sen koko sisältö ylittää tämän luvun.',
          },
          { label: 'Notify on pets', body: 'petit julkaistaan harvinaisten droppien kanavaan.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Ilmoitusosio Combat achievements, jossa jokainen asetus on kehystetty ja numeroitu',
        legend: [
          {
            label: 'CA post tier',
            body: 'alin tehtävätaso, joka julkaistaan; suoritetut tasot julkaistaan myös. Oletus on Master; Grandmaster julkaisee vain harvinaisimmat, **Off** ei mitään. Bingon CA-ruudut lasketaan joka tapauksessa.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'jokainen uusi paikka collection logissa.',
          },
          {
            label: 'Notify on level milestones',
            body: 'tasonnousut, jotka klaanisi on päättänyt ilmoittaa — oletuksena 99:t, joka 100. kokonaistaso 1800:sta alkaen sekä max. Klaanisi ylläpitäjät asettavat säännöt; voit julkaista vähemmän (tai tehdä omat sääntösi henkilökohtaisille webhookeillesi) profiilisi Announcements-kohdasta.',
          },
          {
            label: 'Notify on diary completions',
            body: 'achievement diary -tasot, kuvakaappauksen kera.',
          },
          {
            label: 'Quest post tier',
            body: 'questit valitsemastasi vaikeustasosta ylöspäin, All (jokainen quest) -tasosta Grandmasteriin; **Off** ei julkaise mitään. Oletus on Master. Bingon quest-ruudut lasketaan joka tapauksessa.',
          },
        ],
      },
    },

    trouble: {
      title: 'Kun jokin menee rikki',
      intro:
        'Plugin kertoo chatissa kun seuranta on pysähtynyt — se odottaa noin 90 sekuntia ennen valittamista ja toistaa korkeintaan 5 minuutin välein.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token on väärä tai se on kierrätetty. Avaa **⋯**-valikko Anvil-paneelin yläosassa, paina **Sign out** ja sitten uudelleen **Sign in with Discord** — tai käytä **Paste a token instead** -toimintoa tuoreella tokenilla kohdasta [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Plugin ei tavoita osoitetta `anvilosrs.com`. Tarkista internetyhteytesi sekä mahdollinen palomuuri tai VPN, joka voi estää RuneLiten. Jos kaikki on kunnossa, sivusto on luultavasti hetken alhaalla — plugin yhdistää uudelleen itsestään.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Tiliä ei ole vielä yhdistetty. Avaa [Profile → havaitut tilit](/profile#detected-accounts) lisätäksesi sen tai aloittaaksesi omistajuustarkistuksen.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ei mitään. Se korjaantui itsestään.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'Joku muu yhdisti tämän hahmon Anviliin ensin, joten kirjautumisestasi ei lasketa sille mitään. Jos hahmo todella on sinun, paina paneelin **You**-välilehdellä **This is my account** ja tee nopea XP-tarkistus. Sen jälkeen nykyiseltä omistajalta kysytään, tai Anvilin henkilökunta päättää. Et koskaan saa tietää, kuka hän on. Seuraa asiaa kohdassa [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Yhä jumissa? Lähetä ylläpitäjälle loki',
      logBody:
        'Lähetä ylläpitäjälle RuneLite-lokisi: `client.log` käyttäjäkansiosi `.runelite/logs`-kansiossa (Windowsissa liitä `%USERPROFILE%\\.runelite\\logs` Resurssienhallinnan osoiteriville). Plugin kirjoittaa siihen, mitä se näki ja miksi, joten he näkevät tarkalleen mikä meni pieleen.',
      missingNote: {
        tag: 'Puuttuuko todisteita?',
        body: 'Lemmikit ja toistuvat Champion’s scrollit vaativat käsin otetun kuvakaappauksen. Plugin ottaa sen puolestasi ja tallentaa kansioon `.runelite/osrs-bingo-pending/` — **Copy folder path** Anvilin sivupaneelissa avaa sen — joten liität sen sivustolle sen sijaan että etsisit kuvaa jälkikäteen.',
      },
    },
    limits: {
      title: 'Tunnetut rajoitukset',
      intro:
        'Muutamia asioita ei voi seurata täydellisesti — lähes aina sen vuoksi, mitä itse peli raportoi, ei Anvilin. Korjaus on joka kerta sama: ota kuvakaappaus ja lähetä se käsin.',
      rows: [
        {
          term: 'Barraging ja muut usean kohteen tapot',
          body: 'Tappomäärät (KC) tulevat siitä, mitä peli raportoi kustakin taposta, ja usean kohteen loitsut kuten Ice Barrage saavat sen ohittamaan osan, joten **KC voi jäädä pienemmäksi** kuin mitä olet tappanut. RuneLiten oma Loot Tracker alilaskee samalla tavalla — kyse on pelimoottorin rajoituksesta, ei Anvilin viasta.',
        },
        {
          term: 'Combat Achievementit, jotka olet tehnyt aiemmin',
          body: 'Ota pelin Combat Achievements -asetuksista käyttöön **repeat completion**. Ilman sitä peli ei ilmoita tehtävästä, jonka olet jo suorittanut, ja plugin voi hyvittää vain sen, minkä peli ilmoittaa.',
        },
        {
          term: 'Yama-sopimuksen Combat Achievement',
          body: 'Peli ei ilmoita tätä uudelleen edes repeat completionin ollessa päällä, joten plugin ei koskaan näe sitä. Ota kuvakaappaus ja lähetä se käsin.',
        },
        {
          term: 'Keräilyruudut ilman pluginia',
          body: 'Esinemääriä — tietty määrä kaloja, malmeja, tukkeja — ei ole hiscoresissa, joten vain plugin seuraa niitä. Ilman sitä ota kuvakaappaus jokaisesta inventaariosta; tai jos esine näkyy Loot Trackerissa, kuvakaappaus nollattuna 0:aan alussa ja uudestaan lopussa.',
        },
        {
          term: 'Implingit, kalat, malmit ja muut esineiden saannit',
          body: 'Implingien pyydystäminen ja esineiden kerääminen (kalat, malmit ja kaikki muu, mikä lasketaan siitä, mitä inventoryysi päätyy) **ei toisinaan seuraudu oikein edes pluginin kanssa**. Säilytä kuvakaappauksia matkan varrella, ja jos määrä näyttää liian pieneltä, ilmoita siitä ja lähetä erotus käsin.',
        },
        {
          term: 'Kalatynnyrit, tukkikorit ja muu säilytys',
          body: 'Esinekertymäruudut laskevat vain sen, mikä tulee repun sisään **suoraan lähteestä** — kalapaikasta, kivestä, puusta. Mitään, mikä otetaan säilytyksestä (kalatynnyrin, tukkikorin, hiili- tai jalokivipussin tai yrttisäkin tyhjentäminen), ostetaan kaupasta, nostetaan pankista tai poimitaan maasta, **ei lasketa**. Näin ruutu pysyy reiluna: muuten saman kalan voisi täyttää tynnyriin ja tyhjentää loputtomasti. Suoraan tynnyriin tai koriin kerättyjä saaliita ei lasketa.',
        },
        {
          term: "Tuplapetit ja champion's scrollit",
          body: 'Kun sinulla on jo pet tai scroll, peli sanoo vain, että sinulla on **”funny feeling”** — se ei koskaan kerro mikä. Plugin päättelee sen siitä, mitä juuri tapoit tai treenasit, hyvittää ruudun ja **merkitsee sen staffin tarkistettavaksi**. Jos se ei voi olla varma — kaksi pettiä samasta lähteestä tai pet, jonka takana ei ole tappoa tai skilliä (Bloodhound master cluesta, uhrattu Jad- tai Zuk-pet, Chompy chick) — kuvakaappaus tallentuu **Saved proofs** -kohtaan, jotta voit lähettää sen käsin.',
        },
      ],
    },
    screen: {
      title: 'Näytöllä pelatessa',
      intro: 'Mitä lisäosa piirtää ja tulostaa pelatessasi, ja asetus jokaisen takana.',
      rows: [
        {
          term: 'Kiinnitetyt ruudut',
          body: 'avaa ruutu sivupaneelissa ja paina **Track on screen** (enintään 3). Kun **Pinned tiles in one panel** on päällä, ne jakavat yhden pienen paneelin: jokaisen ruudun nimi, tiimisi edistyminen ja rivit kuten _3/5 runs_ tai mitkä combon osat ovat valmiina. Pois päältä jokaisella on oma isompi widgetinsä tiimiläisillesi ja muille tiimeille. Siirrä Alt-vedolla. Napsauta oikealla **Unpin** tai **Unpin all**. Valmis ruutu näyttää **Done** ja irtoaa itsestään.',
        },
        {
          term: 'Aloituslaukauskortti',
          body: 'kun tapahtuma odottaa aloituslaukaustasi, ruudun yläreunassa oleva kortti **Starting shot needed** kertoo minne mennä ja näyttää jokaisen tarkistuksen vihreänä tai punaisena: uudelleenkirjautuminen, session kesto ja kuinka monta ruutua olet kohdasta. Vihjenuoli ja maailmakartan merkki (**Anvil starting shot**) johtavat sinne. Kun **Auto starting shot** on päällä, laukaus otetaan heti kun kaikki on vihreää; sitten kortissa lukee **You’re tracked** ja lähtö käynnistyy. Asetus: **Starting shot guide**.',
        },
        {
          term: 'Bannerit',
          body: '**Tile complete!** kun tiimisi valmistaa ruudun, oman dropin edistyminen ruudulla ja **New mission!**. Asetukset: **Team completion popups** ja **My tile popups**.',
        },
        {
          term: 'Vestige-kierrokset',
          body: 'Desert Treasure II -bosseissa jokainen uniikki tulostaa rivin, joka kertoo missä olet vestige-kierrossa, kuten _Roll 2 of 4_ tai _the next unique is the vestige_. Siinä lukee _(estimated)_, kunnes se on nähnyt sinun saavan vestigen. Ei asetusta; toimii tapahtumalla tai ilman.',
        },
        {
          term: 'Lookup-ehdotukset',
          body: 'kun kirjoitat **Lookup**-kenttään, nimi täydentyy viimeisimmistä hauistasi, kavereista, paikalla olevista klaanilaisista ja lähellä olevista pelaajista. **Enter** hyväksyy. Se lukee vain oman asiakkaasi tiedot; mitään ei lähetetä.',
        },
        {
          term: 'Chat-värit',
          body: '**[Anvil] tag colour** ja **Message colour** kohdassa **Chat messages**. Kunnes valitset, ne ovat tummankultaisia ja mustia läpinäkyvällä chat-laatikolla, jotta ne pysyvät luettavina. Vie hiiri Supporterin nimen päälle chatissa nähdäksesi tason, kuten _Anvil Patron_.',
        },
      ],
    },
    sync: {
      title: 'Profiilin synkronointi ja muu, mitä se lähettää',
      intro: '**Profile sync** -asetukset täyttävät Anvil-profiilisi. Kaikki neljä ovat alussa päällä:',
      rows: [
        {
          term: 'Synkronoi kokoelmaloki',
          body: 'jokainen avaamasi kokoelmalokin sivu lähetetään profiiliisi.',
        },
        {
          term: 'Synkronoi koko loki avattaessa',
          body: 'kokoelmalokin avaaminen lähettää kaiken, ei vain katsomaasi sivua. Halutessasi käsin paina kokoelmalokin otsikkopalkin **Anvil**-painiketta tai sivupaneelin **Sync profile** -painiketta lokin ollessa auki. Chat vahvistaa sen: _Profile synced — N collection log slots._',
        },
        {
          term: 'Synkronoi henkilökohtaiset ennätykset',
          body: 'boss- ja raidiajat lähetetään heti kun asetat ne.',
        },
        {
          term: 'Tuo olemassa olevat ennätykset kerran',
          body: 'kerran hahmoa kohden kopioi ennätykset, jotka RuneLite on jo tallentanut tietokoneellesi: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Jaa kohokohdat klaanin kanssa',
          body: 'lemmikkisi, isot dropit, kuolemat, taistelutehtävät, tasotavoitteet, uudet lokipaikat ja päiväkirjat ilmestyvät klaanisi sivuston syötteeseen ja niiden pelaajien chat-syötteeseen, jotka näkevät ne.',
        },
      ],
      outro: 'Kolme asiaa lähetetään ilman omaa asetustaan. **Kuka tappoi sinut**: syötteessä nimetään hirviö tai pelaaja, joka oli kohdistettuna sinuun viimeisen 15 sekunnin aikana. **Pelin laskurit**: jotkin tapporuudut laskevat pelin pitämän luvun, kuten Tithe Farm -pisteet, Giants’ Foundry -maine, Doom-delvet tai slayer-putket; vain nousut lasketaan. **Leagues, Deadman ja muut moodit**: näillä maailmoilla pelin omat rivit reliikeistä, alueista ja tehtävistä lähetetään, jotta klaanisi voi julkaista ne moodikanavallaan.',
    },
  },

  admin: {
    metaTitle: 'Näin pyörität ensimmäisen tapahtumasi — Anvilin ylläpito-opas',
    metaDescription:
      'Pystytä klaani Anvilille ja pyöritä bingo alusta loppuun: Discord, jäsenlista, taulut, ruudut, joukkueet ja draft, käynnistys, ja mitä tapahtuu kun tapahtuma päättyy.',
    eyebrow: 'Anvil · klaanin henkilökunnalle',
    title: 'Näin pyörität ensimmäisen tapahtumasi',
    dek: 'Koko polku siinä järjestyksessä jossa sen oikeasti kuljet: saa {clanName} konfiguroitua, saa jäsenlista sisään, rakenna taulu, draftaa joukkueet, käynnistä koko homma ja jaa palkinnot. Suunnilleen illan työ ensimmäiselle bingolle — minuutteja toiselle.',
    facts: [
      { strong: '5 vaihetta', rest: 'käyttöönoton tarkistuslistalla' },
      { strong: '7 formaattia', rest: 'joista rakentaa taulu' },
      { strong: '1 painike', rest: 'jäsenlistan synkronointiin' },
    ],
    footnote:
      'Tämä opas seuraa sovellusta sellaisena kuin se on tänään. Jos jokin näkymä täällä ei vastaa sitä mitä katsot, sovellus on oikeassa ja opas vanhentunut — [kerro meille](/feedback), niin korjaamme sen.',

    access: {
      title: 'Kuka saa tehdä mitä',
      intro:
        'Kaikki kirjautuvat sisään Discordilla — salasanoja ei ole. Ensimmäinen ylläpitäjä on omistaja, eli se joka loi klaanin; sen jälkeen ylläpitäjä ylentää muita kohdasta **People → Staff & roles**. Roolit pinoutuvat alaspäin: kaiken minkä moderaattori voi, voi myös rahastonhoitaja ja ylläpitäjä.',
      rows: [
        {
          term: 'Admin',
          body: 'täysi pääsy — tapahtumat, ruudut, joukkueet, asetukset, henkilökunta, maksut. Anna se niin harvalle kuin klaani kestää.',
        },
        { term: 'Treasurer', body: 'kaiken minkä moderaattori voi, sekä osallistumismaksut ja palkintojen maksun.' },
        {
          term: 'Moderator',
          body: 'arjen työ: jäsenlista, vahvistukset, tarkistettavat todisteet, viikkokilpailut, aikataulu ja klaanikalenterin tapahtumat. Ei voi luoda tai muokata tapahtumia.',
        },
        {
          term: 'Editor',
          body: 'pelkkä ruutujen laatiminen. Anna se globaalisti, tai rajaa se tiettyihin tauluihin, jotta vieraileva taulunrakentaja pääsee vain siihen tapahtumaan jonka annoit heille.',
        },
        { term: 'Member', body: 'pelaa; ei näe ylläpitopintaa lainkaan.' },
      ],
      seeAlso:
        'Kahdella noista rooleista on oma sivunsa: [Vuorossa]({moderatorGuide}) siitä mitä moderaattori oikeasti tekee illallaan, ja [Maksut ja palkintojen jako]({feesGuide}) rahastonhoitajalle.',
      ownerNote: {
        tag: 'Omistaja',
        body: 'Yksi tili on omistaja. Kukaan muu ei voi alentaa sitä, ja se on ainoa rooli joka voi luovuttaa omistajuuden eteenpäin — joten riidan häviäminen toiselle ylläpitäjälle ei voi koskaan maksaa sinulle klaania.',
      },
    },

    setup: {
      title: 'Nimeä klaani, yhdistä Discord',
      intro:
        '**Settings → Finish setup** on lyhyt velho (se pysyy valikossa kunnes olet valmis), ja työpöytä pitää viiden vaiheen tarkistuslistan kunnes ne on tehty: nimeä klaani, yhdistä Discord, lataa jäsenet, luo tapahtuma, lisää ruudut. Tila lasketaan oikeasta datasta, joten vaihe kuittautuu vasta kun se on aidosti valmis.',
      discord:
        'Discordiin on kaksi reittiä, ja ne täydentävät toisiaan: anna Anvilille **botti**, niin se voi luoda webhookeja, synkronoida rooleja ja nimimerkkejä sekä rakentaa yksityisiä joukkuekanavia; anna sille yksi **webhook-osoite**, niin se voi julkaista ilmoituksia eikä mitään muuta. Aloita webhookista jos haluat olla pystyssä kahdessa minuutissa, ja lisää botti kun haluat automatiikan.',
      permsNote: {
        tag: 'Botin oikeudet',
        body: 'Botti tarvitsee oikeudet _Hallitse webhookeja_, _Hallitse rooleja_, _Hallitse kanavia_ ja _Hallitse lempinimiä_, ja sen roolin on oltava _yläpuolella_ hallitsemiaan rooleja palvelimesi roolilistassa. Muuten Discord kieltäytyy hiljaisesti.',
      },
      hosted:
        'Ylläpidetyllä tilauksella kohtasit tuon näkymän jo kerran: botin lisääminen käyttöönoton aikana oli tapa jolla Anvil sai tietää mikä palvelin on teidän, joten palvelin-ID:tä ei koskaan tarvinnut kopioida. Sama linkki on täällä kun haluat siirtää botin toiselle palvelimelle.',
    },

    channels: {
      title: 'Jaa julkaisut useaan kanavaan',
      body: [
        'Kaikki julkaistaan oletuksena yhteen yleiskanavaan. Kun se käy meluisaksi, avaa **Discord → What goes where** ja anna äänekkäille kategorioille omat kotinsa — tapahtumajulkaisut, viikkokilpailut, harvinaiset dropit, kuolemat, PvP-tapot, combat achievementit. Kaikki minkä jätät tyhjäksi putoaa takaisin omaan yleiskanavaansa, joten voit erottaa yhden kategorian kerrallaan.',
        'Botin ollessa yhdistettynä et koskaan koske webhook-osoitteeseen: valitse kanava rivin pudotusvalikosta, niin se tallentuu. Kiireisessä tapahtumassa voit lisätä toisen webhookin painikkeella **Add another** kohdassa **Post without a bot** — Anvil vuorottelee niiden välillä, jottei Discordin nopeusraja niele julkaisuja.',
      ],
      clipsNote: {
        tag: 'Leikekanava on erilainen',
        body: 'Leikevideot ladataan suoraan kunkin pelaajan koneelta Discordiin — ne eivät koskaan kulje tämän sivuston kautta. Siksi täällä asettamasi leike-webhook on se jonka _jaat ulos_: jäsenet liittävät sen itse pluginiinsa. Kaikki muu tällä sivulla tapahtuu palvelimella, eivätkä jäsenet näe sitä koskaan.',
      },
    },

    roster: {
      title: 'Saa jäsenlistasi sisään',
      body: [
        'Klaanijäsenyys tulee yhdestä paikasta: pelinsisäisestä jäsenlistan synkronoinnista. Asenna [Anvilin RuneLite-plugin]({pluginGuide}) _ylläpitäjän_ tilille, avaa pelin klaani-ikkunasi, ja paina sen otsikkopalkin **Anvil**-painiketta. Se työntää todellisen klaanilistanne pelistä sivustolle yhdellä klikkauksella.',
        'Sisäänkirjautuminen, hahmon yhdistäminen tai pluginilla pelaaminen ei koskaan lisää ketään jäsenlistalle. Jos plugin näkee jonkun pelaavan pelin klaanissanne ennen kuin jäsenlistalla on hänet, se tekee liittymispyynnön; kuka tahansa muu voi pyytää klaanisivunne **Apply**-painikkeella. Henkilökunta vastaa pyyntöihin kohdan **People → Roster** yläosassa, ja **People → Who can join** ratkaisee, odottavatko ihmiset hyväksyntää, saavatko he vieraspaikan heti vai eivätkö he voi pyytää lainkaan. Se on tarkoituksellista: kukaan ei liity klaaniinne kirjoittamalla sen nimen. Koko kuva on oppaassa [Väkesi]({peopleGuide}).',
        'Voit myös lisätä jonkun käsin kohdasta **People → + Add Manually**, ja ilmoittaa hänet tapahtumaan hänen puolestaan painikkeella **Add member** tapahtuman **Sign-ups**-sivulla, kun hän ei pääse sivustolle.',
      ],
    },

    board: {
      title: 'Luo ensimmäinen taulusi',
      intro:
        '**Events → All events → + New event**. Valitse formaatti ensin — se ratkaisee miten taulu pisteytetään ja mitä loput lomakkeesta sinulta kysyy.',
      formats: {
        classic: {
          label: 'Klassinen bingo',
          blurb: 'Neliömäinen N×N-ruudukko — joukkueet suorittavat ruudut vapaassa järjestyksessä, kukin arvoltaan 1.',
        },
        leagues: {
          label: 'Leagues-bingo',
          blurb: 'Tehtävälista jossa jokaisella ruudulla on oma pistearvonsa — ruutuja niin monta kuin haluat.',
        },
        race: {
          label: 'Ruutukisa',
          blurb: 'Järjestetty rata — joukkueet saavuttavat ruudut peräkkäin; pisimmälle päässyt voittaa. Järjestäjä voi haarauttaa sen reiteiksi, jotka jakautuvat ja yhtyvät — suorittamanne ruutu valitsee reittinne.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Ruudut pysyvät piilossa aikataulunsa mukaiseen hetkeen — aseta kunkin paljastusaika Tiles-välilehdellä. Pisteytetty, DMM All Stars -tyyliin.',
        },
        luckydraw: {
          label: 'Onnenarvonta',
          blurb: 'Bingokuuluttaja: piilotetut ruudut avautuvat satunnaisissa arvonnoissa kiinteällä välillä. Pisteytetty.',
        },
        bounty: {
          label: 'Palkkionmetsästys',
          blurb:
            'Yksi avoin ruutu kerrallaan — ensimmäinen joukkue joka saa sen valmiiksi vie pisteet, ja seuraava palkkio arvotaan.',
        },
        ladder: {
          label: 'Tikapuut',
          blurb:
            'Pisteytetty tehtävälista järjestettynä yksilölliseksi tulostauluksi (joukkueet valinnaisia). Tehtävät kiertävät — asteittain, yksi kerrallaan, tai liukuvassa ikkunassa — ja voivat laskea arvoltaan. Kuukausitikapuiden tyyliin.',
        },
      },
      outro:
        'Aseta sitten päivämäärät, ilmoittautumisikkuna, ja onko ilmoittautumisessa maksu. Aloita pohjasta jos et halua aloittaa tyhjästä ruudukosta — galleriassa on sekä sisäänrakennetut pohjat että jokainen taulu jonka olet aiemmin tallentanut pohjaksi.',
      seeAlso:
        'Formaatti on vain puolet päätöksestä — ruutujen pelattavaksi tuleminen on toinen puoli, ja ne kaksi yhdistyvät. Molemmat kokonaisuudessaan: [Formaatit ja ruutujen avautuminen]({formatsGuide}).',
      utcNote: {
        tag: 'Päivämäärät ovat UTC:tä',
        body: 'Jokainen aikaleima Anvilissa tallennetaan ja verrataan UTC-ajassa, ja näytetään kunkin kävijän paikallisessa ajassa. Aseta se päättymisaika jonka tarkoitat; sivusto näyttää britille ja australialaiselle kaksi eri kellonaikaa samasta hetkestä.',
      },
    },

    tiles: {
      title: 'Täytä taulu',
      body: [
        'Tapahtuman **Board & tiles** -sivu on se paikka jossa taulusta tulee bingo. Jokainen ruutu on yhtä _tyyppiä_ oleva tehtävä, ja tyyppi ratkaisee mitä plugin tarkkailee: droppia, bossin tappomäärää, taidon XP:tä, NPC-tappoa, aikarajassa suorittamista, achievement diarya, Combat Achievementia, collection log -avausta, PvP-tappoa, esinesaalista, tai kuolematonta suoritusta. Manuaaliset ruudut — ne jotka ihminen vahvistaa kuvakaappauksesta — ovat myös aina vaihtoehto.',
        'Täyttä taulua varten laadi ruudut massana: vie taulukko ulos, täytä se taulukkolaskennassa, ja tuo takaisin. Sekä CSV että .xlsx kulkevat molempiin suuntiin, ja rivit vastaavat paikkoja, joten voit kirjoittaa koko 25 ruudun ruudukon uusiksi yhdellä liittämisellä.',
      ],
      rows: [
        {
          term: 'Vaikeusasteet',
          body: 'pistearvot kääntyvät nimetyiksi kaistoiksi (easy → elite). Muokkaa kaistoja kohdassa **Clan settings → Rules & scoring → Difficulty & balance** jos klaanisi luokittelee toisin.',
        },
        {
          term: 'Tasapainotarkastaja',
          body: 'tarkistaa valmiin taulun rakenteellisten ongelmien ja vinon työmäärän varalta ennen kuin pelaajat edes näkevät sen.',
        },
        {
          term: 'Piilossa kunnes paljastat',
          body: 'uudet taulut alkavat piilotettuina. Henkilökunta näkee ne aina; pelaajat eivät näe mitään ennen kuin paljastat — joten taulu voidaan rakentaa avoimesti ilman että se pilaantuu.',
        },
      ],
      seeAlso:
        'Minkä tyypin valita, miten kirjoittaa kaksisataa niistä taulukkolaskennassa, ja virheet jotka menevät sisään siististi eivätkä sitten koskaan laukea: [Rakenna taulu, joka seuraa itse itseään]({boardGuide}).',
    },

    teams: {
      title: 'Joukkueet ja draft',
      body: [
        'Sivu **Teams & draft** mukautuu valitsemaasi formaattiin: formaatti joka ei käytä joukkueita ohittaa sen kokonaan. Tavallisessa joukkuebingossa luot joukkueet, päätät kuka kutakin kapteenoi, ja joko jaat pelaajat itse tai pidät live-draftin.',
        'Kapteenit draftaavat ilmoittautuneiden poolista valitsemassasi järjestyksessä, ja jokainen kapteeni näkee vastaukset jotka ihmiset antoivat ilmoittautumislomakkeella — jäädytettyinä sellaisina kuin ne lähetettiin, jottei kukaan muokkaa “tuntejaan viikossa” tultuaan valituksi.',
      ],
      placementIntro:
        'Draftia ei ole pakko pitää. **Team placement** luontilomakkeella ja **Sign-ups**-välilehdellä ratkaisee, mihin kukin uusi ilmoittautunut päätyy:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'jokainen ilmoittautuja liittyy joukkueeseen, jossa on vähiten pelaajia. Valitset vain joukkueiden määrän. Hyvä isoihin julkisiin tapahtumiin.',
        },
        {
          term: 'Players pick',
          body: 'teet joukkueet ensin, ja jokainen pelaaja valitsee yhden ilmoittautumislomakkeella. Aseta joukkuekohtainen raja, niin joukkueet pysyvät tasaisina.',
        },
        {
          term: 'Host drafts',
          body: 'kaikki odottavat poolissa, kunnes sinä tai kapteenisi draftaatte heidät tai jaatte heidät käsin. Paras, kun tunnet pelaajat.',
        },
        {
          term: 'Solo',
          body: 'ei joukkueita lainkaan. Jokainen pelaaja pelaa yksin hahmonsa nimellä, ja tilanne järjestää pelaajat.',
        },
      ],
      lockNote: {
        tag: 'Draft lukitsee joukkueet',
        body: 'Heti kun draft on käynnissä, sekä joukkueet että valintajärjestys ovat jäässä. Lisää unohtamasi joukkue _ennen_ kuin painat käynnistä, ei sen jälkeen.',
      },
      seeAlso:
        'Lähetä kapteeneillesi [kapteenin opas]({captainGuide}) ennen draft-iltaa — sotahuone on arvokkaimmillaan sitä edeltävinä päivinä, eikä kukaan lue uutta näkymää kellon käydessä.',
      visitingClans:
        'Pelaatteko toista klaania vastaan sen sijaan että draftaisitte omanne? Vieraileva puoli asettaa oman joukkueensa yhden linkin kautta, ja heidän moderaattorinsa hoitaa sen ilman ylläpitotiliä täällä — katso [Vierailevan klaanin isännöinti]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Käynnistä ja pyöritä',
      body: [
        'Paljasta ruudut, ja käynnistä sitten tapahtuma. Anvil kieltäytyy käynnistämästä taulua joka ei ole valmis — draft yhä kesken, tai pelaajia ilman joukkuetta — ja kertoo kumpi. Jos tiedät paremmin (harjoituskisa, uusinta, testaamasi taulu), voit pakottaa sen.',
        'Sen jälkeen se pyörii pääosin itsestään. Plugin hyvittää automaattisesti kaiken minkä näkee ja julkaisee todistekuvat joukkueella ja UTC-aikaleimalla leimattuina. Sinun syliisi jää:',
      ],
      rows: [
        {
          term: 'Tarkistettavat lähetykset',
          body: 'manuaaliset ruudut ja kaikki minkä plugin on merkinnyt. Hyväksy tai hylkää todiste edessäsi.',
        },
        {
          term: 'Tilastot',
          body: 'tapahtuman Stats-välilehti näyttää pelaajakohtaisen panoksen — hyödyllistä kun joukkue kiistelee siitä kuka kantoi ketä.',
        },
        {
          term: 'Ilmoitukset',
          body: '**Post to Discord** (valikossa kohdan **Clan** alla) julkaisee viestin mille tahansa kanavalle bottina kesken tapahtuman ilman että kirjoitat webhookia käsin.',
        },
      ],
      missionNote: {
        tag: 'Yllätyksiä kesken tapahtuman',
        body: 'Voit pudottaa **tehtävän** käynnissä olevaan bingoon — piilotetun bonusruudun joka ilmoitetaan kun laukaiset sen, ja joka voi haluttaessa laskea arvoltaan tai vanheta. Se on halvin tapa herättää taulu viidentenä päivänä.',
      },
      startProofNote: {
        tag: 'Etukäteisvarastoinnin pysäyttäminen',
        body: [
          'Laita **Starting shot** päälle (tapahtuma → Home → **Extras**), niin jokaisen pelaajan on toimitettava yksi kuvakaappaus otettuna sen jälkeen kun tapahtuma on alkanut, paikassa jonka Anvil arpoo aloitushetkellä — jottei kukaan istu viikon verran säästetyillä cluilla ja arkuilla nollahetkellä. Paikka ilmoitetaan käynnistyksen yhteydessä; kunkin pelaajan salasana on henkilökohtainen, johdettu arvonnasta, eikä sitä ole olemassa ennen tapahtuman alkua, joten kukaan ei voi lavastaa sitä etukäteen.',
          'Kiinnitä paikat maailmankartalle (pooliedittorissa on sellainen), niin plugin tarkistaa että pelaajat oikeasti seisovat siellä sen sijaan että heille vain kerrottiin. Voit myös vaatia **tuoreen istunnon** — oletuksena 15 minuuttia: hiscores tallentuu vain kun pelaaja kirjautuu ulos, joten kaikkien pakottaminen kirjautumaan uudelleen juuri ennen kuvaansa on se, mikä tekee jokaisen XP- ja KC-ruudun takana olevista aloituslukemista rehelliset.',
          'Pluginin käyttäjät painavat yhtä painiketta. Kaikki muut kirjoittavat salasanansa pelissä ja lataavat kuvan My Team -sivulla. Sinä valitset mitä tapahtuu hyvitykselle joltakulta joka ei ole toimittanut: merkitse se tarkistettavaksi (oletus) tai kiellä se kunnes he toimittavat. Sama paneeli tapahtuman Home-sivulla on tarkistuslista — pluginin ottamat kuvat vahvistetulla salasanalla saapuvat jo hyväksyttyinä, joten käytännössä katsot vain mobiilipelaajia.',
        ],
      },
    },

    after: {
      title: 'Viimeisen ruudun jälkeen',
      intro:
        'Kun kello loppuu, taulu jäätyy ja tapahtuma lukkiutuu — pisteet, panokset ja kuka-teki-mitä jäädytetään sellaisina kuin ne olivat. Jos jotain on korjattava jälkeenpäin, ylläpitäjä voi avata sen tarkoituksella.',
      rows: [
        {
          term: 'Palkintojen maksu',
          body: 'tapahtuman **Prizes**-sivu muuttaa palkintopotin listaksi siitä kuka saa mitäkin, ja seuraa maksuja sitä mukaa kun maksat.',
        },
        {
          term: 'Yhteenveto',
          body: 'julkinen yhteenvetosivu lopputuloksineen ja tapahtuman päätöspalkintoineen — isoin droppi, eniten tappoja, ja loput.',
        },
        {
          term: 'Kysely',
          body: 'kysy klaanilta mitä he ajattelivat. Rakenna se Survey-välilehdellä; pelaajat vastaavat kun tapahtuma päättyy ja vain henkilökunta näkee tulokset.',
        },
        {
          term: 'Tallenna pohjaksi',
          body: 'säilytä juuri rakentamasi taulu, tapahtuman kohdasta **Settings → More**. Seuraava bingo alkaa siitä tyhjän ruudukon sijaan.',
        },
      ],
      federation:
        'Federaation ollessa päällä jäsenet voivat myös yhdistää muihin Anvil-klaaneihin pluginista — kätevää klaanien välisiin tapahtumiin, ja täysin vapaaehtoista jäsenkohtaisesti.',
      outro: 'Ohjaa sitten jäsenesi [pelaajien käyttöönotto-oppaaseen]({pluginGuide}) ja ala suunnitella seuraavaa.',
    },
    survey: {
      title: 'Kysy pelaajilta',
      intro: 'Kytke **Post-event survey** päälle kohdasta **Features** ja avaa sitten tapahtuman **Survey**-sivu.',
      body: [
        'Kohdassa **Build** lisää kysymyksiä: **Rating (1–5)**, **Free text**, **Choose one** tai **Choose many**, kukin valinnaisesti **Required**. Tai lataa malli: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** tai **Skilling / social**. **Preview the participant view** näyttää sen niin kuin pelaaja sen näkee.',
        'Se avautuu tapahtuman päättyessä vain hyväksytyille osallistujille, ja he voivat muuttaa vastauksiaan myöhemmin. **Results** näyttää vastaukset **By question** tai **By person**. Se ei ole anonyymi: henkilökunta näkee, kuka sanoi mitäkin.',
      ],
    },
  },

  clanVsClan: {
    metaTitle: 'Vierailevan klaanin isännöinti — Anvilin isäntäopas',
    metaDescription:
      'Pyöritä klaani vastaan klaani Anvilissa: anna jokaiselle vierailevalle klaanille kutsulinkki joka istuttaa heidän pelaajansa yhteen joukkueeseen, ja paikka jolla heidän oma moderaattorinsa hoitaa puoliskonsa.',
    eyebrow: 'Anvil · isännille',
    title: 'Vierailevan klaanin isännöinti',
    dek: 'Sinä isännöit taulua; he asettavat joukkueen. Tämä on se polku joka välttää tusinan RSN:n keräämisen yksityisviesteissä — yksi linkki joukkuetta kohden, ja paikka jolla heidän oma moderaattorinsa hoitaa oman puoliskonsa tapahtumasta.',
    facts: [
      { strong: '1 linkki', rest: 'vierailevaa joukkuetta kohden' },
      { strong: '0 ylläpitopaikkaa', rest: 'jaettu ulkopuolisille' },
      { strong: '~5 min', rest: 'kutsuttua klaania kohden' },
    ],
    footnote:
      'Kuvakaappaukset ovat oikeasta asennuksesta testitaululla — kutsu-tokenit ja Discord-nimet on peitetty. Oikea linkki kannattaa pitää tallessa: kuka tahansa jolla se on, voi ottaa paikan siitä joukkueesta niin kauan kuin se on voimassa.',

    shape: {
      title: 'Mitä olet pystyttämässä',
      body: [
        'Klaani vastaan klaani on aivan tavallinen tapahtuma yhdellä erolla: puolet pelaajista eivät ole klaanissasi eivätkä koskaan tule olemaan. Heitä ei voi synkronoida sisään jäsenlistasta, et halua ylentää heitä, etkä varmasti halua ilmoittaa kahtakymmentä heistä käsin ja sitten raahata jokaista oikeaan joukkueeseen.',
        'Kaksi palasta ratkaisee sen, ja ne ovat riippumattomia — käytä jompaakumpaa tai molempia.',
      ],
      rows: [
        {
          term: 'Kutsulinkki',
          body: 'osoite jonka luot kerran yhdelle joukkueelle. Sen avaava kirjautuu sisään, täyttää tavallisen ilmoittautumislomakkeen, ja päätyy siihen joukkueeseen jo hyväksyttynä — ei draft-poolia, ei hyväksyntäjonoa.',
        },
        {
          term: 'Paikka joukkueen henkilökunnassa',
          body: 'nimetty henkilö joka voi hoitaa _sitä yhtä joukkuetta_ — sen kokoonpanoa, lähetyksiä ja todisteita, maksuja — ilman ylläpitotiliä täällä, ja ilman että kapteenin paikka viedään siltä joka oikeasti pelaa.',
        },
      ],
      note: {
        tag: 'Mitä kutsu ei ole',
        body: 'Se ei ole kirjautuminen eikä oikotie vahvistuksen ohi. Sen avaava kirjautuu silti sisään Discordilla ja tarvitsee silti vahvistetun RSN:n, aivan kuten missä tahansa muussa ilmoittautumisessa. Ainoa mitä linkki ratkaisee on _mihin joukkueeseen_ ilmoittautuminen menee, ja ettei se tarvitse kenenkään hyväksyntää.',
      },
    },

    team: {
      title: 'Luo joukkue ensin',
      body: [
        'Avaa tapahtumasi ja mene sivulle **Teams & draft**. Luo yksi joukkue kutakin kutsumaasi klaania kohden ja nimeä se heidän mukaansa — nimi on se minkä heidän pelaajansa näkevät ilmoittautumislomakkeella, joten “Ironforge” voittaa nimen “Joukkue 2”.',
        'Sinun _ei_ tarvitse pitää draftia. Kutsulinkit ja draft ovat vaihtoehtoja: draft jakaa yhteisen ilmoittautumispoolin, linkki istuttaa ihmiset suoraan. Puhtaassa klaani vastaan klaani -tapahtumassa useimmat isännät luovat joukkueet, jakavat kullekin yhden linkin, eivätkä avaa draftia lainkaan.',
        'Avaa sitten itse joukkue — **Teams & draft → joukkue** — sillä siellä molemmat seuraavat vaiheet tapahtuvat.',
      ],
      captainNote: {
        tag: 'Kapteeni ensin',
        body: 'Nimeä vierailevan puolen kapteeni ennen kuin jaat linkin, jotta joukkuesivulla on omistaja alusta asti. Kapteenin nimeäminen myös istuttaa heidät joukkueeseen; jos kortti varoittaa etteivät he ole kokoonpanossa, ota vastaan sen tarjoama korjaus.',
      },
    },

    staff: {
      title: 'Anna heidän moderaattorilleen paikka',
      body: [
        'Joukkuesivun **Team staff** -paneeli on tapa jolla vierailevan klaanin oma moderaattori pääsee töihin ilman että annat heille yhtään mitään omalla sivustollasi. Paina **Add someone**, hae heidät, lisää huomautus kuten “Ironforge’s mod” jotta seuraava ylläpitäjä tietää miksi he ovat siellä, ja paina **Give a seat**.',
      ],
      figure: {
        caption: 'Tapahtuma → Teams & draft → joukkue → Team staff',
        alt: 'Team staff -paneeli, jossa yksi paikka on myönnetty ja hakukenttä auki lisäämistä varten',
        legend: [
          {
            label: 'Add someone',
            body: 'avaa haun. Vain ihmiset jotka ovat kirjautuneet täällä Discordilla vähintään kerran voivat näkyä — katso huomautus alla.',
          },
          {
            label: 'Huomautus',
            body: 'vapaata tekstiä, 120 merkkiä. Kirjoita mistä klaanista he ovat. Paikat jäävät listalle tapahtuman jälkeenkin, ja “kuka tämä on?” on kysymys jonka kanssa istut kolmen kuukauden päästä.',
          },
          {
            label: 'Remove',
            body: 'ottaa paikan heti takaisin. Tee se kun tapahtuma päättyy — paikka ei ole itsestään määräaikainen.',
          },
        ],
      },
      canDo: 'Mitä paikka voi tehdä, vain siinä joukkueessa:',
      canDoList: [
        'nähdä ja hoitaa joukkueen kokoonpanoa',
        'käsitellä sen lähetyksiä ja todisteita',
        'merkitä sen pelaajien maksut maksetuiksi',
        'luoda sille kutsulinkkejä, jos laitat sen päälle (seuraavan jälkeinen vaihe)',
      ],
      cantDo: 'Mitä se ei voi koskaan tehdä:',
      cantDoList: [
        'koskea mihinkään toiseen joukkueeseen',
        'muokata taulua tai sen ruutuja',
        'tehdä draft-valintoja',
        'vaihtaa ketään pois kun tapahtuma on käynnissä',
      ],
      note: {
        tag: 'Heidän on kirjauduttava täällä kerran ensin',
        body: 'Haku listaa vain tilit joilla on Discord yhdistettynä — paikka riippuu henkilöstä joka oikeasti voi kirjautua sisään. Lähetä siis vierailevan klaanin moderaattori tälle sivustolle, pyydä heitä painamaan **Login** kerran, ja myönnä paikka _vasta sitten_. Jos he eivät näy haussa, se kirjautuminen ei ole vielä tapahtunut.',
      },
    },

    link: {
      title: 'Luo kutsulinkki',
      body: [
        'Yhä joukkuesivulla **Invite links** -paneeli luo linkin. Kaksi kenttää ratkaisee mitä linkki lupaa, ja molemmat tulkitsevat arvon `0` niin että “älä lupaa mitään”.',
      ],
      figure: {
        caption: 'Tapahtuma → Teams & draft → joukkue → Invite links',
        alt: 'Invite links -paneeli, jossa paikka- ja vanhenemiskentät, Make a link -painike, ja yksi voimassa oleva linkki listalla',
        legend: [
          {
            label: 'Seats ja Expires in hours',
            body: 'kuinka monta ihmistä linkki saa istuttaa (enintään 100) ja kuinka kauan se on voimassa (enintään 30 päivää). Aseta paikat lupaamansa kokoonpanon kokoiseksi, niin linkki sulkee itsensä kun kaikki ovat sisällä; aseta vanheneminen kun linkki menee julkiseen Discordiin. `0` kummassa tahansa kentässä tarkoittaa ei rajaa.',
          },
          {
            label: 'Make a link',
            body: 'luo sen ja kopioi sen leikepöydällesi heti. Liitä se heille ennen kuin teet mitään muuta.',
          },
          {
            label: 'Voimassa olevien linkkien lista',
            body: 'jokainen linkki joka joukkueella on ulkona, sekä montako on liittynyt ja montako paikkaa on jäljellä. **Copy** hakee sen uudelleen; **Turn off** tappaa sen lopullisesti.',
          },
        ],
      },
      shape:
        'Linkki näyttää tältä: `{origin}/events/{eventId}/join/{token}` — yksi rivi, turvallinen liittää Discord-viestiin.',
      note: {
        tag: 'Järkevät oletukset',
        body: 'Klaani vastaan klaani -tapahtumassa jossa olet sopinut kokoonpanosta yhden moderaattorin kanssa: jätä molemmat kentät arvoon `0` ja anna heidän hoitaa se. Turvaudu paikkoihin ja vanhenemiseen kun linkki menee jonnekin mitä et hallitse.',
      },
      revoke:
        'Linkin sulkeminen vaikuttaa heti eikä poista ketään joka on jo liittynyt — he ovat nyt tavallisia pelaajia siinä joukkueessa. Jos haluat poistaa jonkun, käytä joukkueen kokoonpanoa.',
    },

    captains: {
      title: 'Anna heidän luoda omat linkkinsä',
      body: [
        'Oletuksena vain isäntä voi luoda linkkejä, ja kapteenille joka yrittää kerrotaan siitä. Se oletus on oikea tavalliselle klaanitapahtumalle — paikkoja jakava kapteeni täyttäisi kokoonpanoa jota kukaan ei ole hyväksynyt — ja väärä klaani vastaan klaani -tapahtumalle, jossa vieraileva puoli tuntee oman kokoonpanonsa paremmin kuin sinä.',
        'Kytkin on samassa **Invite links** -paneelissa: **Let captains make their own links**. Se koskee _jokaista joukkuetta tässä tapahtumassa_, ei vain sitä jota katsot — mikä on juuri se mitä haluat kun molemmat puolet ovat vierailevia klaaneja.',
        'Sen ollessa päällä joukkueen kapteeni ja kaikki joilla on paikka henkilökunnassa voivat luoda linkkejä itse kohdasta **My Team → Invite links**. He saavat saman paneelin kuin sinä, ilman kytkintä.',
      ],
      figure: {
        caption: 'My Team → joukkue → Invite links',
        alt: 'Invite links -välilehti kapteenin näkökulmasta joukkuekeskuksessa, paikka- ja vanhenemiskenttineen ja yhdellä voimassa olevalla linkillä',
        legend: [
          {
            label: 'Sama paneeli, kapteenin näkymä',
            body: 'luo, kopioi, sulje. Jos isäntä ei ole laittanut kytkintä päälle, siinä lukee “Only a host can make links for this event” ja kentät ovat poissa.',
          },
          {
            label: 'Voimassa olevien linkkien lista',
            body: 'kapteeni joka ei voi luoda linkkejä näkee silti ne jotka joukkueella on ulkona — jotta hän voi pyytää sinulta toisen sen sijaan että olettaisi ettei niitä ole.',
          },
        ],
      },
    },

    player: {
      title: 'Mitä heidän pelaajansa näkevät',
      intro:
        'Kannattaa käydä läpi kerran itse ennen linkin jakamista, jotta osaat vastata siitä esitettyihin kysymyksiin.',
      steps: [
        'He avaavat linkin. Jos he eivät ole kirjautuneina, he kirjautuvat ensin Discordilla ja palaavat suoraan takaisin — linkki ei katoa matkalla.',
        'He päätyvät aivan tavalliselle ilmoittautumislomakkeelle, jossa banneri sanoo **You’re joining {teamExample} by invite**. Samat kysymykset, sama tilinvalitsin, sama maksu kuin kaikilla muillakin.',
        'Lähettäessään he ovat siinä joukkueessa, hyväksyttyinä. Ei toimenpiteitä isännältä, ei draftia.',
      ],
      figure: {
        caption: 'Ilmoittautumislomake avattuna kutsulinkin kautta',
        alt: 'Tapahtuman ilmoittautumislomake bannerilla joka kertoo pelaajan liittyvän nimettyyn joukkueeseen kutsun kautta',
        legend: [
          {
            label: 'Kutsubanneri',
            body: 'nimeää joukkueen johon he ovat liittymässä. Jos se nimeää väärän joukkueen, heillä on väärä linkki — pysähdy ja tarkista ennen lähettämistä.',
          },
          {
            label: 'Loput lomakkeesta',
            body: 'ennallaan. Vahvistettu RSN vaaditaan yhä, ilmoittautumiskysymykset kysytään yhä, ja ilmoittautumismaksu pätee yhä.',
          },
        ],
      },
      note: {
        tag: 'Jo ilmoittautunut?',
        body: 'Jos joku ilmoittautui ensin tavallisesti ja istuu poolissa, linkin avaaminen siirtää heidät joukkueeseen sen sijaan että loisi toisen ilmoittautumisen. Se joka on jo hyväksytty toiseen joukkueeseen jätetään rauhaan — siirrä heidät kokoonpanosta sen sijaan.',
      },
    },

    dead: {
      title: 'Kun linkki lakkaa toimimasta',
      intro:
        'Hylätty linkki selittää itsensä sivulla sen sijaan että antaisi 404:n, joten sen haltija voi kertoa sinulle kummasta on kyse.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Joku painoi **Turn off**. Luo uusi — vanha linkki ei koskaan palaa.',
        },
        {
          term: 'This invite has expired.',
          body: 'Se saavutti asettamasi tuntimäärän. Luo toinen, tällä kertaa arvolla `0` tuntia jos vanheneminen ei tee hyvää.',
        },
        {
          term: 'This invite is full.',
          body: 'Kaikki paikat on otettu. Nosta sitä luomalla uusi linkki jossa on enemmän paikkoja — paikkamäärä on kiinteä heti kun linkki on olemassa.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Ainoa joka voi korjaantua itsestään. Tarkista tapahtuman ilmoittautumisikkuna: onko se jo auennut, onko määräaika mennyt, vai onko tapahtuma jo alkanut.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Toisen taulun linkki on liitetty. Tarkista että osoitteen tapahtuma-ID on se jota tarkoitit.',
        },
      ],
      checklist: 'Ennen tapahtumaa käy tämä lista läpi kerran kutakin vierailevaa klaania kohden:',
      checklistItems: [
        'heidän joukkueensa on olemassa ja nimetty heidän mukaansa',
        'heidän kapteeninsa on nimetty ja istutettu joukkueeseen',
        'heidän moderaattorinsa on kirjautunut täällä ja hänellä on paikka joukkueen henkilökunnassa',
        'linkki on luotu, kopioitu ja oikeasti toimitettu ihmiselle',
        'ilmoittautumisikkuna on auki niin kauan kuin he tarvitsevat',
      ],
      note: {
        tag: 'Kun kaikki on ohi',
        body: 'Sulje linkit ja poista paikat joukkueen henkilökunnasta. Kumpikaan ei vanhene itsestään, ja voimassa oleva linkki päättyneessä tapahtumassa on vain irtonainen lanka.',
      },
    },
    cohost: {
      title: 'Jos olet yhteisisäntä',
      intro: 'Yllä oleva on isännän puoli. Vierailevan klaanin henkilökunta saa oman sivun tapahtumalle, **Co-hosted with <host>**. Isäntä pitää päivämäärät, luonnoksen, tiimit ja sen, kuka sen näkee.',
      rows: [
        {
          term: 'Klaanisi ilmoittautumiset',
          body: '**Approve**, **Reject** tai **Withdraw** oman klaanisi pelaajille. Et koskaan näe tai muokkaa isännän pelaajia.',
        },
        {
          term: 'Taulu',
          body: 'voit muokata vain jos isäntä antoi henkilökunnallesi luvan. Muuten voit **Suggest a tile**: ruudun, tiedot ja pisteet, enintään 25 odottamassa kerrallaan. Jokainen näkyy **waiting**, **accepted ✓** tai **turned down** isännän perusteluineen.',
        },
        {
          term: 'Tiimisi',
          body: '**Manage** klaanisi tiimi.',
        },
        {
          term: 'Discord',
          body: 'ylläpitäjäsi valitsevat, mikä pääsee omalle palvelimellesi: **Everything shared**, **Big moments** tai **Nothing**, mikä kanava, kuka saa maininnan ja saavatko pelaajasi roolin **@Bingo player**.',
        },
      ],
    },
  },

  board: {
    metaTitle: 'Taulun rakentaminen — Anvilin ruutujen laatimisopas',
    metaDescription:
      'Laadi bingoruutuja jotka hyvittävät itsensä: mitä kukin ruututyyppi oikeasti näkee, massatuonti taulukkolaskennalla, ja virheet jotka epäonnistuvat hiljaa.',
    eyebrow: 'Anvil · taulun rakentajille',
    title: 'Rakenna taulu, joka seuraa itse itseään',
    dek: 'Ruutu on lupaus siitä että jokin huomataan. Tässä on mitä kukin tyyppi oikeasti näkee, miten kirjoitat kaksisataa niistä menettämättä iltaasi, ja ne muutamat virheet jotka epäonnistuvat hiljaa — ruutu ei yksinkertaisesti koskaan laukea, eikä kukaan huomaa sitä ennen neljättä päivää.',
    facts: [
      { strong: '15 tyyppiä', rest: 'yksi ruutua kohden, ei koskaan sekaisin' },
      { strong: '1000 ruutua', rest: 'taulua kohden, taulukkolaskennalla' },
      { strong: 'Hiljaa', rest: 'näin huono ruutu epäonnistuu' },
    ],
    footnote:
      'Taulukkomuoto on kuvattu kokonaisuudessaan tiedostossa `docs/tile-authoring.md`, joka on kirjoitettu sille (tai sille asialle) joka rivit tuottaa. Tämä sivu on inhimillinen puolisko: mihin tyyppiin tarttua, ja mikä menee pieleen.',

    kinds: {
      title: 'Yksi ruutu, yksi tyyppi',
      body: [
        'Jokainen ruutu on täsmälleen yhtä _tyyppiä_, ja tyyppi on koko kysymys: se ratkaisee mitä plugin tai hiscores-pyyhkäisy tarkkailee, ja siten voiko ruutu ylipäätään valmistua itsestään. Kahden tyypin kenttien sekoittaminen hylätään ovella sen sijaan että se hyväksyttäisiin ja jätettäisiin rikki.',
        'Tyypit jakautuvat kolmeen perheeseen, ja perhe merkitsee enemmän kuin nimilappu:',
      ],
      families: [
        {
          term: 'Manuaalinen',
          body: 'ihminen katsoo kuvakaappausta ja sanoo kyllä. Aina saatavilla, toimii aina, maksaa aina jonkun illan. Käytä sitä siihen mitä ohjelmisto ei voi nähdä.',
        },
        {
          term: 'Hiscoresista haettu',
          body: 'taitojen XP ja bossien tappomäärät, luettuna virallisesta Hiscoresista 15 minuutin välein tehtävällä pyyhkäisyllä. Ei vaadi pluginia ja toimii kaikille jäsenlistalla — mutta näkee vain sen mitä Hiscores laskee, ja vasta pelaajan kirjauduttua ulos.',
        },
        {
          term: 'Pluginin havaitsema',
          body: 'kaikki muu: dropit, NPC-tapot, aikarajassa suoritukset, diaryt, combat taskit, kierrokset, loot-arvo. Hyvittää sekunneissa ja leipoo todistekuvan — mutta vain pelaajille jotka oikeasti käyttävät pluginia.',
        },
      ],
      kindsIntro: 'Koko lista siinä järjestyksessä jossa tyyppivalitsin ne tarjoaa:',
      kindLabels: {
        standard: { label: 'Vakio', blurb: 'Manuaalinen ruutu — kapteeni merkitsee sen tehdyksi. Ei automaattista seurantaa.' },
        skill: { label: 'Taito', blurb: 'Valmistuu automaattisesti kun taito saavuttaa XP-tavoitteen (haettu hiscoresista).' },
        boss: { label: 'Bossin KC', blurb: 'Valmistuu automaattisesti kun bossi saavuttaa tappomäärätavoitteen (haettu hiscoresista).' },
        drop: { label: 'Droppi', blurb: 'N droppia esineestä (tai mistä tahansa poolista) — pluginin havaitsema, leivottu kuvakaappaus.' },
        collection: { label: 'Esinesarja', blurb: 'Useita esineitä, kullakin oma vaadittu määränsä — yksi kutakin täyteen sarjaan.' },
        kill: { label: 'Tapot', blurb: 'N tappoa mistä tahansa bossista tai hirviöstä. Lasketaan hiscoresista, kun jokainen ruudun hirviö on siellä, muuten plugin laskee pelatessasi (kanat, lehmät, Slayer-hirviöt).' },
        lap: { label: 'Agility-kierrokset', blurb: 'N kierrosta agility-radalla, tai N kerrosta / kokonaista suoritusta Hallowed Sepulchressa — laskettuna livenä pelin laskurista. Vain tapahtuman aikana juostut kierrokset lasketaan.' },
        pvp: { label: 'PvP-tappo', blurb: 'Tapa pelaajia — ketä tahansa, kilpailevia joukkueita, tai nimetty kohde — Wildernessissä tai PvP-maailmoissa. Turvalliset minipelit eivät koskaan laske.' },
        gain: { label: 'Esinesaalis', blurb: 'Pyydystä, valmista tai kerää N esinettä — laskettuna siitä mitä päätyy inventoryyn. Pluginin havaitsema.' },
        timed: { label: 'Aikarajassa', blurb: 'Suorita aktiviteetti aikarajan sisällä (Inferno, raidit, Colosseum). Plugin ottaa ajan.' },
        deathless: { label: 'Ilman kuolemia', blurb: 'Suorita raid NOLLALLA joukkueen kuolemalla, N kertaa. Plugin laskee jokaisen kuoleman instanssin sisällä.' },
        lms: { label: 'LMS', blurb: 'Sijoitu N parhaan joukkoon Last Man Standingissa (1 = voitto), M kertaa. Pluginin havaitsema pelin päättyessä.' },
        value: { label: 'Loot-arvo', blurb: 'Loot arvoltaan X gp — yksi saalis, tai saaliit jotka yhteensä yltävät tavoitteeseen. Plugin hinnoittelee saaliin.' },
        diary: { label: 'Diary', blurb: 'Suorita achievement diary -tasoja tapahtuman aikana. Pluginin havaitsema suoritusviestistä.' },
        ca: { label: 'Combat task', blurb: 'Suorita Combat Achievement -tehtäviä tapahtuman aikana. Pluginin havaitsema suoritusviestistä.' },
      },
      note: {
        tag: 'Plugin-kysymys, esitettynä kerran',
        body: 'Pluginin havaitsema ruutu on näkymätön pelaajalle joka ei käytä pluginia. Se ei ole vika jonka voi konfiguroida pois — mikään ei tarkkaile. Jos osa klaanistasi pelaa mobiililla tai virallisella asiakasohjelmalla: pidä nuo ruudut poissa voiton kriittiseltä polulta, tai pariuta ne manuaalisen vaihtoehdon kanssa ja varaudu tarkistamaan kuvakaappauksia.',
      },
    },

    pick: {
      title: 'Valitse tyyppi joka oikeasti laukeaa',
      intro:
        'Useimmat huonosti käyttäytyvät ruudut ovat oikea idea väärällä tyypillä ilmaistuna. Ne neljä jotka kompastuttavat:',
      rows: [
        {
          term: 'Bossilista ja yksi hiscoresin ulkopuolinen hirviö',
          body: 'on **kokonaan** pluginin ruutu. Tapot-ruutu lasketaan hiscoresista vain, jos jokainen sen hirviö on siellä; lisää kana neljän GWD-bossin joukkoon, ja koko ruutu tarvitsee pluginin. Jos osa klaanista pelaa ilman sitä, anna hiscores-bosseille oma ruutu.',
        },
        {
          term: 'Collection log -paikka',
          body: 'on droppi-ruutu. Lokimerkinnän avaaminen hyvittää sen, joten ruutu laukeaa myös duplikaatista jonka pelaaja jo omisti — mikä on yleensä juuri se mitä tarkoitit.',
        },
        {
          term: '“Hanki yksi kutakin”',
          body: 'on droppi-ruutu esinelistalla ja **ilman** `requiredAmount`-arvoa. Lisää `requiredAmount`, niin siitä tulee hiljaa “hanki mitkä tahansa N näistä” — sama rivi, aivan eri ruutu.',
        },
        {
          term: 'Diary tai combat task',
          body: 'hyvittää vain pelinsisäisestä suoritusviestistä, joka tulee sillä hetkellä kun taso tai tehtävä valmistuu. Sitä minkä pelaaja jo omistaa ei voi laukaista uudelleen — paitsi combat taskia, jossa **Settings → Combat Achievements → Repeat completion** antaa heidän laukaista sen uudestaan.',
        },
      ],
      note: {
        tag: 'Yhdistetyt boss-ruudut',
        body: 'Boss-ruudun seurattu tilasto voi sisältää useita hiscores-avaimia pilkulla eroteltuina, ja edistys lasketaan yhteen niiden yli. `chambersOfXeric,chambersOfXericChallengeMode` on yksi ruutu joka laskee CoX:n ja CM:n yhdessä — mikä on lähes aina se mitä raid-ruudulla tarkoitetaan.',
      },
    },

    bulk: {
      title: 'Laadi ne massana, ei selaimessa',
      body: [
        '25 ruudun ruudukon klikkaaminen käy hyvin. 200 tehtävän Leagues-taulun klikkaaminen ei käy, eikä sen oikoluku jälkikäteen. Tiles-välilehdellä on juuri tähän rakennettu edestakainen kierto.',
      ],
      steps: [
        '**Download spreadsheet** tapahtuman **Board & tiles** -sivulla. Saat .xlsx-tiedoston taulusta sellaisena kuin se on, pudotusvalikoineen, esinelistoineen ja sarakeohjeineen omilla välilehdillään.',
        'Muokkaa sitä. Yksi rivi ruutua kohden; rivijärjestys on ruutujärjestys.',
        '**Upload CSV / Excel** samalla välilehdellä. Vain **Tiles**-välilehti luetaan.',
      ],
      rules: [
        {
          term: 'Kierto ei hukkaa mitään',
          body: 'lataa alas ja lataa takaisin muuttamattomana, eikä mitään tapahdu — täsmäävät rivit raportoidaan muuttumattomina eikä niihin edes lyödä aikaleimaa. Se tekee viennistä turvallisen varmuuskopion ennen isoa muokkausta.',
        },
        {
          term: 'Rivit vastaavat paikkoja',
          body: 'rivi 1 on ruutu 1. Olemassa olevat ruudut päivitetään paikallaan, ja pois jättämäsi sarake jätetään rauhaan sen sijaan että se tyhjennettäisiin — joten voit lähettää kahden sarakkeen taulukon joka muuttaa vain pisteitä.',
        },
        {
          term: 'Vain dynaamiset taulut kasvavat',
          body: 'ylimääräiset rivit luovat uusia ruutuja Leagues-taululle tai ruutukisaan, ennen tapahtuman alkua, enintään 1000 asti. Klassisella N×N-ruudukolla on kiinteä muoto ja se ohittaa ne. Jos aiot tuottaa satoja tehtäviä, tee siitä Leagues-tapahtuma.',
        },
        {
          term: 'Kaikki tai ei mitään',
          body: 'kaikki rivit validoidaan ensin. Yksi esineen nimi jota ei voi tunnistaa kaataa koko tuonnin, nimeää syylliset, eikä muuta mitään — et koskaan päädy puolikkaaseen tauluun.',
        },
        {
          term: 'Osa kentistä lukkiutuu käynnistyksessä',
          body: 'nimi, tyyppi, vaadittu määrä ja esineasetukset otetaan käyttöön vain ennen tapahtuman alkua. Kuvaus, pisteet, kategoria ja valinnaisuuslippu pysyvät muokattavina koko ajan, joten voit korjata kirjoitusvirheen kesken tapahtuman avaamatta taulua uudelleen.',
        },
      ],
    },

    traps: {
      title: 'Virheet jotka epäonnistuvat hiljaa',
      intro:
        'Jokainen näistä menee sisään siististi, istuu taululla näyttäen oikealta, eikä koskaan laukea. Ne kannattaa lukea läpi ennen lataamista eikä sen jälkeen.',
      rows: [
        {
          term: 'Taito- ja boss-ruudut ovat `type=standard`',
          body: 'arvoa `type=skill` ei ole olemassa. Tyyppi tulee kentistä `trackedStat` + `statType` + `statGoal` muuten tavallisella standard-rivillä. Arvo `type=boss` hylätään; arvo `type=standard` ilman tilastosarakkeita ei hylkäänny — silloin saat manuaalisen ruudun jota kukaan ei koskaan hyväksy.',
        },
        {
          term: 'Erottimet vaihtelevat sarakkeittain',
          body: '`items` käyttää puolipistettä (pilkku on CSV-erotin). `targetNpcs` käyttää pystyviivaa. Combat task -rivillä pystyviiva on **ainoa** vaihtoehto, koska oikeat tehtävänimet sisältävät pilkkuja — `Nylocas, On the Rocks` on yksi tehtävä.',
        },
        {
          term: 'Raid-nimet täsmätään sanatarkasti',
          body: 'deathless- tai aikaruutu kantaa tilan täsmälleen niin kuin se pelissä kirjoitetaan: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Läheltä osunut kirjoitusasu on ruutu joka ei koskaan valmistu. Entry Mode -suoritukset eivät koskaan hyvitä tavallista raid-ruutua; vaikeammat tilat hyvittävät.',
        },
        {
          term: 'Esineiden nimien on oltava tarkkoja',
          body: 'pelin kirjoitusasu, tai tuonti epäonnistuu ja listaa mitä se ei saanut tunnistettua. Jos nimi on monitulkintainen, lukitse se muodossa `Name#id` ja lakkaa arvailemasta.',
        },
        {
          term: '`timeThresholdSeconds` tarkoittaa neljää asiaa',
          body: 'aikarajaa aikaruudussa, sijoitusrajaa LMS-ruudussa (1 = voitto), tarkkaa joukkuekokoa deathless-ruudussa, ja tarkkaa raid-joukkuekokoa droppi-ruudussa. Sama sarake, neljä merkitystä — tarkista että täytät sen jota tyyppisi oikeasti lukee.',
        },
        {
          term: 'Vaadittu määrä väärällä tyypillä',
          body: 'se kuuluu droppi-, kill-, gain-, lap-, PvP-, deathless- ja LMS-riveille. Tilasto- tai aikarivillä se ei tee mitään, ja droppi-rivillä se muuttaa esinesarjan “mitkä tahansa N” -pooliksi.',
        },
      ],
      note: {
        tag: 'Testaa yksi ennen kuin kirjoitat kaksisataa',
        body: 'Laadi yksi ainoa ruutu siitä tyypistä josta olet epävarma, paljasta se testitapahtumassa, ja mene tekemään se asia. Viisi minuuttia siinä voittaa sen että huomaat klaanin bingoiltana kokonaisen kategorian olleen kuollut.',
      },
    },

    points: {
      title: 'Pisteet, tasot ja onko tämä reilua',
      body: [
        'Pisteytetyllä taululla jokaisella ruudulla on oma arvonsa, ja nuo arvot kääntyvät nimetyiksi vaikeuskaistoiksi — easy–elite — joita voit muokata kohdassa **Rules & scoring** jos klaanisi luokittelee toisin. Kaista on se minkä pelaajat lukevat; luku on se joka lasketaan.',
        'Merkitse ruutu **optional**, niin se lakkaa laskemasta taulun kokonaissummaan, ja näin lisäät venytystavoitteita tekemättä blackoutista mahdotonta.',
        'Kun taulu on täynnä, aja **tasapainotarkastaja** Tiles-välilehdeltä. Se tarkistaa rakenteen ja työn jakautumisen ja kertoo missä taulu kallistuu — kategoria jota kukaan ei voi saada valmiiksi, kaista joka on tunnissa paljon arvokkaampi kuin naapurinsa — ennen kuin pelaajat löytävät ne puolestasi ja kiertävät ne.',
      ],
    },

    reveal: {
      title: 'Kukaan ei näe sitä ennen kuin sanot',
      body: [
        'Uudet taulut alkavat piilotettuina. Henkilökunta näkee ne aina; pelaajat eivät näe yhtään mitään ennen kuin paljastat — joten taulu voidaan rakentaa avoimesti, päivien mittaan, kanavassa jota jäsenesi voivat lukea, ilman että mikään pilaantuu.',
        'Tuo pääkytkin on lattia kaiken muun alla. Taululla jolla on paljastuskäytäntö — aikataulutettu, väli, palkkio tai kiertävä — moottori alkaa kääntää yksittäisiä ruutuja vasta kun itse taulu on paljastettu, joten taulun teroittaminen on aina tietoinen teko. Kumpi käytäntö valita, on oma sivunsa: [Formaatit ja ruutujen avautuminen]({formatsGuide}).',
        'Tehtävät ovat poikkeus jonka kannattaa tietää: ruutuja jotka on laadittu etukäteen mutta pidätetty, ilmoitettuna kesken tapahtuman omasta poolistaan samalla kun muu taulu pysyy näkyvillä.',
      ],
    },

    check: {
      title: 'Ennen kuin paljastat',
      intro: 'Kannattaa käydä läpi kerran taulua kohden. Suurin osa vie viisi minuuttia.',
      items: [
        'jokainen ruutu on sitä tyyppiä jota tarkoitit, ei sitä joka meni sisään siististi',
        'raid-tilat, esineiden nimet ja tehtävien nimet vastaavat pelin kirjoitusasua merkki merkiltä',
        'pluginin havaitsemat ruudut eivät ole ainoa reitti voittoon, jos osa klaanistasi pelaa ilman sitä',
        'pisteet on asetettu ja tasapainotarkastaja on tyytyväinen, tai olet eri mieltä sen kanssa tarkoituksella',
        'valinnaiset ruudut on merkitty valinnaisiksi',
        'olet ladannut taulukon kerran varmuuskopioksi jonka voit ladata takaisin',
      ],
      note: {
        tag: 'Kuka saa tehdä tämän',
        body: 'Ruutujen laatiminen on se yksi ylläpitotehtävä jolla on oma roolinsa. **Editor** voi laatia ruutuja eikä mitään muuta, ja hänet voidaan rajata tiettyihin tauluihin — joten toisesta klaanista tuleva vieraileva taulunrakentaja saa täsmälleen sen tapahtuman jonka annoit hänelle, ilman pääsyä mihinkään muuhun mitä pyörität.',
      },
    },
    library: {
      title: 'Tehtäväkirjasto ja ehdotukset',
      body: [
        'Ruudun muokkaajilla on **Task library** ylläpitovalikossa: klaanisi tallennetut tehtävät ja Anvilin oma kirjasto, josta kopioida. **⬇ Export pack** tallentaa tehtäväsi tiedostoon ja **⬆ Import pack** lataa sellaisen; näin taulu siirtyy klaanien välillä.',
        'Löysitkö virheen Anvilin kirjastosta tai tehtävän, jota siltä puuttuu? Paina tehtävän kohdalla **Suggest a fix** tai **Suggest a new task**. Anvil tarkistaa sen ja vastaus näkyy kohdassa **Your suggestions**: **Waiting for review**, **Approved** tai **Not taken**, muistiinpanon kanssa. Voit olla 5 odottamassa. Hyväksytty korjaus tavoittaa jokaisen klaanikopion, joka yhä seuraa kirjastoa.',
      ],
    },
    stats: {
      title: 'Aloitustilastot ja myöhään liittyjät',
      intro: 'XP- ja tappolaskuritaulut vertaavat jokaisen pelaajan tilastoja nyt niihin **starting stats** -lukemiin, jotka otettiin tapahtuman alkaessa. Tapahtuman **Stats**-sivulla tarkistat ja korjaat ne:',
      rows: [
        {
          term: 'Ota aloitustilastot',
          body: 'ennen alkua se vain lämmittää hiscoret; itse lähtölukema otetaan alussa. Alun jälkeen painike muuttuu **Capture late joiners** -painikkeeksi, lisätyille pelaajille. Sen voi ajaa kerran 30 minuutissa.',
        },
        {
          term: 'Päivitä nyt',
          body: 'päivittää tilanteen uusimmilla luvuilla. Ne päivittyvät myös joka tunti itsekseen.',
        },
        {
          term: 'Korjaa lähtötaso',
          body: 'pelaajakohtaisesti: muuta yhden taidon tai bossin lähtöluku käsin. Käytä, kun ennen tapahtumaa tehty grindi ei laskunut, koska pelaaja ei kirjautunut ulos ennen alkua.',
        },
        {
          term: 'Nollaa kaikki aloitustilastot',
          body: 'piilossa kohdassa **Danger zone**: ottaa kaikkien lähtörivin uudelleen nykyisistä tilastoista, pyyhkien kaikki tähänastiset kasvut. Vain tapahtumalle, joka alkoi vahingossa.',
        },
      ],
      outro: 'Sen alla **Member breakdown** näyttää, kuka tiimissä teki mitä, ja **Stat tile standings** jokaisen pelaajan lähtö- ja nykyluvut jokaisella XP- tai tappoarvoisella ruudulla.',
    },
  },

  captain: {
    metaTitle: 'Kapteenin opas — Anvil',
    metaDescription:
      'Draft-päivä ja sitä seuraavat viikot: poolin lukeminen ennen kellon käynnistymistä, valintojen tekeminen, ja joukkueesi kokoonpanon, todisteiden ja maksujen hoitaminen.',
    eyebrow: 'Anvil · kapteeneille',
    title: 'Kapteenin opas',
    dek: 'Käteesi työnnetään sotahuone, kello ja kahdenkymmenenviiden tuntemattoman ilmoittautumislomake. Tässä on mitä kaikki se tekee siinä järjestyksessä jossa sen kohtaat — sekä ne joukkueen vetämisen osat jotka alkavat vasta draftin päätyttyä.',
    facts: [
      { strong: 'Käärmejärjestys', rest: 'jotta myöhäiset valinnat tasoittuvat' },
      { strong: 'Kello', rest: 'ei koskaan valitse puolestasi' },
      { strong: 'Yksi välilehti', rest: 'hoitaa joukkuettasi koko tapahtuman' },
    ],
    footnote:
      'Kaikki täällä on sitä mitä kapteeni näkee. Maksut, muiden joukkueiden kokoonpanot ja taulu ennen paljastusta kuuluvat henkilökunnalle ja pysyvät siellä, joten mikään tällä sivulla ei voi saada sinua syytetyksi siitä että katsoit jotain mitä ei olisi pitänyt.',

    before: {
      title: 'Mitä saat ja milloin',
      body: [
        'Isäntä nimeää sinut kapteeniksi, mikä tekee kaksi asiaa: se istuttaa sinut joukkueeseen pelaajana, ja se avaa joukkueen pinnat sinulle. Jos joukkuesivu koskaan varoittaa ettet oikeasti ole kokoonpanossa, ota vastaan sen tarjoama korjaus — kapteeni oman joukkueensa ulkopuolella on tila joka hämmentää jokaista alempaa näkymää.',
        'Sen jälkeen sinulla on kaksi paikkaa. **My Team** on joukkueesi keskus, ja siellä vietät tapahtuman. **Sotahuone** on draft-päivän näkymä, ja se aukeaa heti kun ilmoittautuminen aukeaa — kauan ennen draft-iltaa.',
      ],
      note: {
        tag: 'Mene sinne ajoissa',
        body: 'Sotahuone on arvokkaimmillaan draftia _edeltävinä_ päivinä, kun ehdit lukea jokaisen ilmoittautumislomakkeen kunnolla. Itse iltana siitä tulee sekuntikello eikä sinulla ole aikaa lukea mitään.',
      },
    },

    warroom: {
      title: 'Lue pooli ennen kuin kello käynnistyy',
      body: [
        'Sotahuone näyttää kaikki jotka voidaan valita, ja kaiken mitä sivusto heistä tietää: mitä he pelaavat, mihin bosseihin heillä on oikeita tappomääriä, moneenko aiempaan tapahtumaan he ilmestyivät, ja vastaukset jotka he antoivat ilmoittautumislomakkeella.',
        'Nuo vastaukset ovat **jäädytettyinä sellaisina kuin ne lähetettiin**. Kukaan ei muokkaa “tuntejaan viikossa” nähtyään kuka valittiin ensin, ja juuri se on syy miksi ne kannattaa lukea.',
        'Rakenna **suosikkilista** lukiessasi. Se on yksityinen, se säilyy draft-iltaan, ja sinä iltana se on ero sen välillä että valitset listalta johon jo luotat ja että valitset sen joka sattuu olemaan ruudun ylimpänä.',
      ],
      rows: [
        {
          term: 'Arvio ja taso',
          body: 'yhteenveto siitä mitä joku on oikeasti tehnyt, johdettuna hänen tilihistoriastaan eikä siitä mitä hän kertoi sinulle. Ohjeellinen — lähtökohta keskustelulle, ei tuomio.',
        },
        {
          term: 'Alueet ja merkinnät',
          body: 'mitä he todistetusti tekevät: raideja, PvM:ää, skillausta, PvP:tä. Hyödyllinen aukon löytämiseen kokoonpanostasi sen sijaan että ottaisit korkeimman luvun neljä kertaa.',
        },
        {
          term: 'Osallistuminen',
          body: 'kuinka usein he saivat valmiiksi aiemmat tapahtumat joihin ilmoittautuivat. Sivun hiljaisin luku ja usein se joka ennustaa eniten.',
        },
      ],
    },

    draft: {
      title: 'Draft-päivä',
      body: [
        'Valinnat etenevät **käärmejärjestyksessä**: neljällä joukkueella ensimmäinen kierros menee A, B, C, D ja toinen D, C, B, A, joten viimeisenä valitseminen yhdellä kierroksella tarkoittaa ensimmäisenä valitsemista seuraavalla. Se joka veti ensimmäisen valinnan maksaa siitä minuuttia myöhemmin.',
        'Henkilö on yksi valinta, ei yksi tili. Jonkun ottaminen vetää kaikki hänen rekisteröimänsä tilit joukkueeseesi kerralla — et koskaan käytä toista valintaa jonkun alt-tiliin.',
      ],
      rows: [
        {
          term: 'Valintakello',
          body: 'jos isäntä on asettanut sen, saat sen verran sekunteja vuoroa kohden. Kun se loppuu, se **ei** valitse puolestasi — se avaa isännälle mahdollisuuden valita sinun puolestasi, ja sanoo sen molemmilla näytöillä. Mitään ei tapahdu hiljaisuudessa.',
        },
        {
          term: 'Kavennettu lista',
          body: 'jotkin tapahtumat käyttävät tasapainotilaa. Riippuen kummasta, vahvinta joukkuetta voidaan estää ottamasta vielä yhtä huippupelaajaa samalla kun kilpailijalla ei ole yhtään, tai sille voidaan asettaa katto sille kuinka paljon yli keskiarvon sen kokoonpano saa mennä. Jos haluamasi pelaaja on harmaana, syy on tämä, ja se koskee kaikkia.',
        },
        {
          term: 'Jos jäät siitä paitsi',
          body: 'kerro isännälle etukäteen. He voivat valita puolestasi samalta taululta, ja jättämäsi suosikkilista on ohje jota he seuraavat.',
        },
      ],
      note: {
        tag: 'Draft lukitsee kokoonpanon',
        body: 'Heti kun draft on käynnissä, sekä joukkueet että valintajärjestys ovat jäässä. Jos joukkue puuttuu tai järjestys on väärä, se on korjattava ennen ensimmäistä valintaa, ei sen jälkeen.',
      },
    },

    roster: {
      title: 'Joukkueesi keskus, koko tapahtuman ajan',
      intro:
        'Sivulla **My Team** kortti **Manage this team** sisältää kaiken mitä voit tehdä omalle puolellesi. Se tulee kasaan taitettuna; avaa se kerran, niin se pysyy siinä mihin jätit sen.',
      rows: [
        {
          term: 'Roster',
          body: 'ketkä ovat joukkueessa ja mitä he ovat panostaneet. Ensimmäinen paikka johon katsoa kun joku kysyy miksei hänen droppinsa laskenut — yhdistämätön tili näkyy täällä.',
        },
        {
          term: 'Requests',
          body: 'ihmiset jotka pyytävät päästä mukaan, tapahtumissa joissa pelaajat valitsevat joukkueensa itse. Näkyy vain kun sellaisia on.',
        },
        {
          term: 'Proof',
          body: 'joukkueesi lähetykset ja niiden kuvakaappaukset. Sinä et ole lopullinen hyväksyjä — henkilökunta on — mutta näet mitä on lähetetty ja voit jahdata sitä mitä ei ole.',
        },
        {
          term: 'Fees',
          body: 'ketkä joukkueessasi ovat yhä velkaa osallistumismaksun. Voit merkitä maksun maksetuksi; sen vahvistaminen on henkilökunnan työ, tarkoituksella.',
        },
        {
          term: 'Invite links',
          body: 'ilmestyy kun isäntä on sallinut kapteenien luoda omansa. Yksi linkki istuttaa sen avaajan suoraan joukkueeseesi. Katso [Vierailevan klaanin isännöinti]({clanVsClanGuide}) siitä mitä linkki oikeasti tekee.',
        },
      ],
    },

    during: {
      title: 'Sen pyörittäminen kun se on alkanut',
      body: [
        'Suurin osa tapahtumasta pyörii itsestään: plugin hyvittää sen minkä näkee ja arkistoi siitä leimatun kuvakaappauksen. Jäljelle jäävät ihmiset, ja se on työ.',
        'Se mikä oikeasti vaatii kapteenia: varmistaa että kaikilla puolellasi on plugin yhdistettynä ja tilinsä liitettyinä ennen lähtölaukausta, sillä yhdistämätön alt-tili ei panosta mihinkään; huomata mitä ruutuja kukaan ei ole koskenut puolivälissä; ja saada manuaaliset ruudut kuvattua ennen viimeistä tuntia, jolloin kaikki yrittävät samaan aikaan.',
        'Jos tapahtuma vaatii aloituskuvan, se on se yksi asia jonka jokaisen pelaajan on tehtävä itse ensimmäisten tuntien aikana. Jahtaa sitä ajoissa — pelaajalla jolla sitä ei ole, jokainen hyvitys merkitään tarkistettavaksi tai hylätään suoraan, riippuen siitä miten isäntä on sen asettanut.',
      ],
      note: {
        tag: 'Vaihdot',
        body: 'Kun tapahtuma on käynnissä, vain ylläpitäjä voi vaihtaa jonkun pois, tarkoituksella: panokset on jo kiinnitetty henkilöihin. Kysy isännältä sen sijaan että kiertäisit asian.',
      },
    },
  },

  formats: {
    metaTitle: 'Formaatit ja ruutujen avautuminen — Anvil',
    metaDescription:
      'Seitsemän tapahtumaformaattia, viisi tapaa joilla ruudut voivat avautua, ja pistekertoimet — mitä kukin niistä tekee sille miltä tapahtuma tuntuu pelata.',
    eyebrow: 'Anvil · klaanin henkilökunnalle',
    title: 'Formaatit ja ruutujen avautuminen',
    dek: 'Kaksi päätöstä muovaa tapahtumaa enemmän kuin yksikään sen ruuduista: minkä muotoinen taulu on, ja miten ruuduista tulee pelattavia. Ne ovat riippumattomia — mikä tahansa formaatti voi käyttää mitä tahansa paljastuskäytäntöä — ja yhdessä ne ovat ero viikon puurtamisen ja yhden illan kisan välillä.',
    facts: [
      { strong: '7 formaattia', rest: 'taulun muoto' },
      { strong: '5 käytäntöä', rest: 'miten ruudut avautuvat' },
      { strong: '3 kerrointa', rest: 'mitä suoritus on arvoltaan' },
    ],
    footnote:
      'Formaatti asetetaan luonnissa mutta sen voi muuttaa jälkikäteen tapahtuman Settings → Event -välilehdeltä; paljastuskäytäntöä ja pistekertoimia voi muuttaa milloin tahansa ennen kuin niiden koskettamat ruudut paljastetaan.',

    shape: {
      title: 'Taulun muoto',
      intro:
        'Formaatti ratkaisee miten taulu pisteytetään ja mitä luontilomake seuraavaksi kysyy. Kaikki muu tällä sivulla rakentuu sen päälle.',
      note: {
        tag: 'Kiinteä ruudukko vai tehtävälista',
        body: '**Klassinen** taulu on aito neliö, joten “N arvolla 5” tarkoittaa tasan 25 ruutua eikä määrä voi koskaan muuttua. Kaikki muu on minkä tahansa mittainen tehtävälista, ja se on myös ainoa taulutyyppi jota taulukkotuonti voi kasvattaa. Jos aiot tuottaa sata tehtävää, se päätös tehdään tässä.',
      },
    },

    reveal: {
      title: 'Miten ruudut avautuvat',
      intro:
        'Riippumaton formaatista. Tapahtumatason paljastuskytkin on yhä pääportti — niin kauan kuin taulu on piilossa, mitään ei näy eikä yksikään näistä moottoreista käy, joten teroitat taulun aina tietoisesti.',
      rows: [
        {
          term: 'Kaikki kerralla',
          body: 'klassikko. Jokainen ruutu on pelattavissa sillä hetkellä kun paljastat taulun, ja joukkueet valitsevat järjestyksen itse. Valitse tämä ellei sinulla ole syytä olla valitsematta.',
        },
        {
          term: 'Aikataulutettu',
          body: 'jokaisella ruudulla on oma paljastusaikansa, asetettuna Tiles-välilehdellä, ja se avautuu kun aika kuluu. “Tunnin ruutu” -taulu: se asettaa tahdin puolestasi ja vaatii aikojen kirjaamisen etukäteen.',
        },
        {
          term: 'Väli',
          body: 'moottori arpoo piilotettuja ruutuja kiinteällä välillä — erä joka N. minuutti, satunnaisesti tai taulujärjestyksessä. Bingokuuluttaja. Ei ylimääräistä laatimista itse ruutujen lisäksi, ja taulu paljastaa itsensä nukkuessasi.',
        },
        {
          term: 'Palkkio',
          body: 'täsmälleen yksi ruutu on auki kerrallaan, ja ensimmäinen joukkue joka saa sen valmiiksi vie sen — ruutu sulkeutuu ja seuraava arvotaan heti. Armotonta, hyvin seurattavaa, ja säälimätöntä aikavyöhykkeille.',
        },
        {
          term: 'Kiertävä',
          body: 'liukuva ikkuna jossa on muutama avoin ruutu: jokainen arvonta avaa uusia ja antaa vanhimpien vanheta. Toisin kuin palkkiossa, kaikki ehtivät saada avoimen ruudun valmiiksi ennen kuin se katoaa. Rakennettu yksilöllisiin tikapuihin.',
        },
      ],
      note: {
        tag: 'Aikavyöhykekysymys',
        body: 'Palkkio- ja välitaulut palkitsevat sen joka sattuu olemaan hereillä. Ympäri maailmaa levittäytyneessä klaanissa se on todellinen etu jonka jakaa kello eikä pelaaminen. Kiertävät ikkunat pehmentävät sitä — avoin ruutu pysyy auki ikkunan keston ajan, joten nukkuvakin pelaaja saa siihen mahdollisuuden.',
      },
    },

    scoring: {
      title: 'Mitä suoritus on arvoltaan',
      intro:
        'Kolme kerrointa, kaikki vain pistetilassa, kaikki jäädytettyinä suoritukseen sillä hetkellä kun se tapahtuu — joten myöhemmin tekemäsi muutos ei koskaan kirjoita historiaa uusiksi.',
      rows: [
        {
          term: 'Ensimmäisen joukkueen bonus',
          body: 'lisäpisteitä ensimmäiselle joukkueelle joka saa kunkin ruudun valmiiksi. Halvin tapa saada taulu jossa kaikki näkyy tuntumaan kisalta muuttamatta mitään muuta.',
        },
        {
          term: 'Arvon lasku',
          body: 'ruudun arvo skaalautuu lineaarisesti täydestä paljastushetkellä tavoiteprosenttiin N tunnin jälkeen, ja pysyy sitten. Alle 100 % se laskee ja palkitsee nopeuden; yli 100 % se **kasvaa**, mikä palkitsee vanhojen, kaikkien ohittamien tehtävien siivoamisen. Kasvava suunta on se jonka olemassaolon ihmiset unohtavat.',
        },
        {
          term: 'Lockout',
          body: 'ensimmäinen suoritus sulkee ruudun kaikilta muilta. Sisäänrakennettu palkkiotilaan. Taululla jossa joukkueiden voimaerot ovat suuria tämä voi ratkaista kisan aikaisin — se on parhaimmillaan kun joukkueet ovat lähellä toisiaan.',
        },
      ],
    },

    missions: {
      title: 'Tehtävät: yllätyksiä kesken tapahtuman',
      body: [
        'Tehtävät ovat etukäteen laadittuja mutta pidätettyjä ruutuja — ilmoitettuina omasta poolistaan samalla kun muu taulu pysyy näkyvillä. Ne ovat riippumattomia paljastuskäytännöstä, joten jopa aivan tavallisessa bingossa jossa kaikki näkyy voi olla niitä.',
        'Pudota ne käsin kun taulu hiljenee, kiinteällä välillä, tai tehtäväkohtaisen aikataulun mukaan. Jokaisella tehtävällä on oma pisteytyksensä: oma lockoutinsa, bonuksensa, arvonlaskunsa ja vanhenemisensa, asetettuna ruutukohtaisesti eikä tapahtumalle.',
        'Ne ovat halvin tapa herättää taulu viidentenä päivänä — ja viides päivä on se päivä jolloin jokainen pitkä tapahtuma tarvitsee herätyksen.',
      ],
    },

    choose: {
      title: 'Valinta, yhdellä sivulla',
      intro: 'Jos tiedät minkälaisen tunnelman haluat, tämä on lyhin reitti sinne.',
      rows: [
        { term: 'Tavallinen klaanibingo', body: 'Klassinen ruudukko, kaikki ruudut näkyvissä. Lisää ensimmäisen joukkueen bonus jos haluat hieman kiirettä.' },
        { term: 'Satoja tehtäviä, pisteytettynä vaikeuden mukaan', body: 'Leagues, kaikki näkyvissä. Se on myös ainoa muoto johon iso taulukkotuonti voi kasvaa.' },
        { term: 'Viikko joka rakentuu kohti jotain', body: 'Leagues aikataulutetulla tai välipaljastuksella, jolloin taulu aukeaa viikon mittaan eikä kerralla.' },
        { term: 'Ilta jota ihmiset seuraavat livenä', body: 'Palkkio. Yksi ruutu, ensimmäinen joukkue vie sen, seuraava ruutu heti.' },
        { term: 'Yksilökilpailu, ei joukkuekilpailu', body: 'Tikapuut kiertävällä ikkunalla ja arvonlaskulla. Tehtävät tulevat ja menevät eikä kukaan voi säästää niitä.' },
        { term: 'Kisa jolla on maaliviiva', body: 'Ruutukisa — järjestetty rata, ja pisimmälle päässyt voittaa.' },
      ],
      outro:
        'Valitsitpa minkä tahansa, itse ruudut ovat sama työ: katso [Rakenna taulu, joka seuraa itse itseään]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Maksut ja palkintojen jako — Anvilin rahastonhoitajan opas',
    metaDescription:
      'Osallistumismaksun asettaminen, sen kerääminen, toinen allekirjoitus joka sulkee sen, ja palkintopotin muuttaminen maksetuiksi sijoituksiksi.',
    eyebrow: 'Anvil · rahastonhoitajille',
    title: 'Maksut ja palkintojen jako',
    dek: 'Raha on se kohta jossa klaanitapahtumat menevät pieleen, ja ne menevät pieleen hiljaa: maksu jonka joku vannoo maksaneensa, potti joka ei täsmää kenellekään, palkintojen jako josta kiistellään voittajien jo kirjauduttua ulos. Tämä on polku joka jättää jäljen jokaisessa vaiheessa.',
    facts: [
      { strong: '2 allekirjoitusta', rest: 'sulkee maksun oletuksena' },
      { strong: 'Potti = lisätty', rest: '+ maksu × hyväksytyt ilmoittautumiset' },
      { strong: '1 rivi', rest: 'jokaista maksun saajaa kohden' },
    ],
    footnote:
      'Maksut ja palkintojen jako ovat rahastonhoitajan pinta. Rahastonhoitaja voi kaiken minkä moderaattorikin, sekä tämän; pelkkä moderaattori ei näe maksusivuja lainkaan.',

    set: {
      title: 'Maksun asettaminen',
      body: [
        'Osallistumismaksu on tapahtumalla, asetettuna kun luot sen tai muokattuna sen **Sign-ups**-välilehdeltä. Ei maksua lainkaan on täysin kelvollinen vastaus — monet tapahtumat pyörivät pelkällä isännän lisäämällä potilla.',
        'Kaksi asetusta ratkaisee mitä maksu oikeasti tarkoittaa, ja ne on helppo ohittaa:',
      ],
      rows: [
        {
          term: 'Henkilöä vai tiliä kohden',
          body: 'tapahtumassa jossa ihmiset saavat osallistua useilla tileillä tämä ratkaisee maksavatko he kerran vai kerran kutakin kohden. Jos se menee väärin, joudut palauttamaan rahoja.',
        },
        {
          term: 'Maksun määräaika',
          body: 'sen mentyä maksamattomat ilmoittautumiset lakkaavat olemasta jotain jota jahtaat ja muuttuvat päätökseksi. Aseta se aiemmaksi kuin luulet — tapahtumaa edeltävä päivä on liian myöhäistä korvaajan löytämiseen.',
        },
        {
          term: 'Guest fee',
          body: 'mitä maksavat pelaajat, jotka eivät ole taulua pyörittävän klaanin jäseniä. Jätä tyhjäksi, niin vieraat maksavat jäsenmaksun. Jos haluat periä yhdeltä pelaajalta eri summan, paina hänen rivillään **Sign-ups**-välilehdellä **Change this player’s fee**.',
        },
      ],
      note: {
        tag: 'Potti seuraa ilmoittautumisia',
        body: 'Näytetty palkintopotti on se minkä itse lisäsit, plus osallistumismaksu kertaa **hyväksyttyjen** ilmoittautumisten määrä. Se liikkuu sitä mukaa kun ilmoittautumisia hyväksytään ja suljetaan pois, joten sivulla näkyvä luku on aina se jonka oikeasti voisit maksaa ulos.',
      },
    },

    collect: {
      title: 'Kerääminen',
      body: [
        'Maksut kerätään sillä tavalla jolla klaanisi jo kerää rahaa — pelissä, Discordissa, miten teettekin. Anvilin työ alkaa sillä hetkellä kun raha saapuu: joku jolla on henkilökunnan pääsy merkitsee sen **maksetuksi**, ja se leimaa kuka sanoo ottaneensa sen vastaan ja milloin.',
        'Pelaajillakin on sananvaltaa. Jäsen voi ilmoittaa kenelle maksoi ja liittää kuvakaappauksen, ja juuri se muuttaa lauseen “maksoin ihan varmasti” merkinnäksi jolla on kaksi päätä. Kun pelaajan ilmoitus ja kerääjän väite nimeävät eri henkilöt, se on erimielisyys jonka sivusto voi näyttää sinulle sen sijaan että saisit sen tietää kesken riidan.',
        'Muistuttaminen on yksi painallus: **Remind unpaid** kohdassa Admin → **Fees** lähettää Discord-yksityisviestin kaikille, jotka ovat vielä velkaa siitä tapahtumasta.',
      ],
      note: {
        tag: 'Todiste poistetaan tarkoituksella',
        body: 'Maksukuvakaappaus säilytetään vain siihen asti kun maksu on suljettu, ja poistetaan sitten. Se on olemassa erimielisyyden ratkaisemiseksi, ei arkistossa vuoden makaamista varten.',
      },
    },

    sign: {
      title: 'Toinen allekirjoitus',
      body: [
        'Maksu on tilassa **kerätty** kunnes _toinen_ henkilökunnan jäsen vahvistaa sen saapuneen. Se joka käsitteli rahat ei voi olla myös se joka allekirjoittaa niiden ilmestyneen — se on koko kontrolli, ja siksi sivusto hylkää kerääjän oman vahvistuksen sen sijaan että vain paheksuisi sitä.',
        'Montako allekirjoitusta maksu vaatii on klaaniasetus (**Clan settings → Rules & scoring → Fee sign-off**), nollasta viiteen. Nolla on olemassa todellisesta syystä: klaanissa jossa rahastonhoitaja _on_ omistaja ei ole ketään muuta allekirjoittamaan, ja “34 maksua odottaa toista allekirjoitusta” muuttuu jonoksi jota ei voi koskaan tyhjentää ja pysyvästi äänekkäimmäksi asiaksi työpöydällä. Nollalla maksun merkitseminen maksetuksi **on** allekirjoitus.',
        'Aseta se yhteen — oletus — jos teitä on kaksi. Aseta se nollaan jos rehellisesti sanottuna ei ole, ja aseta korkeammaksi vain jos klaanillasi on sekä ihmiset että syy.',
      ],
    },

    pay: {
      title: 'Maksaminen',
      body: [
        'Kun tapahtuma päättyy, tapahtuman **Prizes**-sivu muuttaa potin listaksi ihmisiä. Luo se, niin saat yhden rivin saajaa kohden, ei joukkuetta kohden: voittavan joukkueen palkinto jaetaan tasan jäsenten kesken, jotta maksaminen on lista nimiä ja lukuja eikä laskutoimitus keskiyöllä.',
        'Summat alkavat ehdotetusta jaosta — voittajapainotteinen, ja mitä useampia maksettuja sijoja asetat, sitä tasaisempi siitä tulee — ja jokainen rivi on muokattavissa. Ehdotus on lähtökohta, ei linjaus.',
        'Sitten maksat heille ja kuittaat rivejä sitä mukaa. Pointti on se että joku voi viikkoa myöhemmin katsoa listaa ja nähdä kuka sai mitä, sen sijaan että rakentaisi sen uudelleen Discordin historiasta.',
      ],
      note: {
        tag: 'Ilmoita se kerran, täältä',
        body: 'Palkinnot julkaistaan Discord-kanaviinne itse tapahtumasta, jolloin ilmoitus ja merkintä ovat sama asia. Käsin ilmoitettu palkinto on palkinto jonka joku myöhemmin väittää jääneen saapumatta.',
      },
    },

    disputes: {
      title: 'Kun luvut ovat eri mieltä',
      intro: 'Ne neljä jotka oikeasti kohtaat:',
      rows: [
        {
          term: 'He sanovat maksaneensa, kukaan ei merkinnyt sitä',
          body: 'pyydä heitä ilmoittamaan maksusta kuvakaappauksen kera. Se laittaa nimetyn kerääjän ja aikaleiman merkintään, ja nimetty henkilö voi vahvistaa tai kiistää.',
        },
        {
          term: 'Kaksi henkilökunnasta luulee molemmat ottaneensa vastaan',
          body: 'pelaajan oma ilmoitus ratkaisee — se nimeää kenelle he ojensivat rahat. Korjaa kerääjä, ja sulje sitten maksu.',
        },
        {
          term: 'Maksu on jumissa odottamassa allekirjoitusta',
          body: 'joko se odottaa aidosti jotakuta toista, tai klaanissasi on vähemmän henkilökuntaa kuin vaadittujen vahvistusten asetus olettaa. Laske asetusta sen sijaan että vahvistaisit oman keräyksesi.',
        },
        {
          term: 'Potti muuttui sen jälkeen kun kerroit siitä ihmisille',
          body: 'se seuraa hyväksyttyjä ilmoittautumisia, joten ilmoittautumisen hyväksyminen tai pois sulkeminen liikuttaa sitä. Kerro potti sellaisena kuin se on ilmoittautumisen sulkeutuessa, ei sen auetessa.',
        },
      ],
    },
  },

  coffer: {
    metaTitle: 'Klaanin kassa — Anvilin opas rahastonhoitajalle',
    metaDescription:
      'Klaanin gp-kassa Anvilissa: lahjoitusten kirjaaminen ja niiden antajien nimeäminen, kolme tapaa maksaa palkinto, kuka saa siirtää rahaa, ja mitä tapahtuu kun kassa ei riitä.',
    eyebrow: 'Anvil · rahastonhoitajille',
    title: 'Klaanin kassa',
    dek: 'Useimmilla klaaneilla gp on yhden ihmisen pankissa ja kirjanpito yhden ihmisen muistissa. Kassa on yksi potti, jossa on rivi jokaisesta liikkeestä — kuka antoi sen, mihin se on luvattu, ja kuka sen oikeasti lähetti.',
    facts: [
      { strong: '3 lukua', rest: 'kassassa, luvattu, vapaana luvattavaksi' },
      { strong: '3 ulostuloa', rest: 'viikkokisat, tehtäväruudut, laudan potti' },
      { strong: 'Rahastonhoitaja', rest: 'tai admin — ei koskaan pelkkä arvo' },
    ],
    footnote:
      'Kaikki tämä on kohdassa Admin → **Coffer**, paitsi palkintoportaat, jotka ovat siinä mistä maksetaan. Julkinen puoli on `/coffer`: saldo, suurimmat lahjoittajat ja viimeisimmät liikkeet, jäsenille.',

    what: {
      title: 'Mikä se on',
      body: [
        'Kirjanpito, ei lompakko. Anvil ei koskaan pidä hallussaan teidän gp:tänne — se pysyy siellä missä klaani sitä jo säilyttää — joten kassa on merkintä siitä mitä tuli sisään, mitä on luvattu ja mitä on oikeasti annettu. Hyöty on siinä, että lupaus ja maksu ovat kaksi eri riviä.',
        'Sivu alkaa kolmella luvulla, ja niitä on kolme koska ne vastaavat kolmeen eri kysymykseen:',
      ],
      rows: [
        {
          term: 'Kassassa',
          body: 'hyväksytyt lahjoitukset ja oikaisut. Mitä klaani on saanut, miinus se mitä se on kirjannut pois.',
        },
        {
          term: 'Luvattu',
          body: 'gp, jonka palkinto on vaatinut — voitettu mutta ei vielä lähetetty, plus laudalle varattu potti. Varattua, vaikka se yhä olisi jonkun pankissa.',
        },
        {
          term: 'Vapaana luvattavaksi',
          body: 'kassassa miinus luvattu. Ainoa luku, jota vasten uutta palkintoa verrataan, koska vaihtoehto on luvata samat 50m kahdelle voittajalle rahastonhoitajan nukkuessa.',
        },
      ],
      note: {
        tag: 'Odottava lahjoitus ei laske mihinkään',
        body: 'Se että joku kirjoittaa "annoin 100m", on väite menneisyydestä, ei gp pankissa. Se on kaikkien kolmen luvun ulkopuolella kunnes henkilökunta tunnustaa sen, joten se ei voi koskaan rahoittaa palkintoa jota ei sitten pystytä maksamaan.',
      },
    },

    inbound: {
      title: 'Gp:n saaminen sisään',
      body: [
        'RuneLite-plugin hoitaa tavallisen reitin automaattisesti: avaa pelin Clan Coffer, niin Anvil kirjaa talletukset ja nostot sen todellisesta kolikkosaldosta. Ensimmäinen vilkaisu on vain lähtötaso — se ei koskaan oleta, että avaaja lahjoitti kaiken mitä siellä jo oli.',
        'Manuaalinen kirjaus on yhä olemassa kaikelle, mikä tapahtui kun kenelläkään ei ollut pluginia auki. Jäsen ilmoittaa oman lahjoituksensa osoitteessa `/coffer` ja se odottaa että henkilökunta uskoo sen; rahastonhoitaja kirjaa jo saapuneen, ja hänen kirjaamisensa **on** hyväksyntä.',
        'Kummassakin tapauksessa se kirjataan **henkilölle**. Sillä on enemmän väliä kuin miltä kuulostaa: julkisen sivun lahjoittajalista on ainoa kiitos jonka useimmat lahjoittajat koskaan saavat, ja "klaanilta" saapunut gp ei kiitä ketään.',
      ],
      rows: [
        {
          term: 'Avaa kassa pelissä',
          body: 'Anvil käytössä ja sisäänkirjautuneena (Profile sync → **Sync Clan Coffer** on oletuksena päällä). Vastaava peliviesti kirjaa oman talletuksesi tai nostosi sinulle; tauon jälkeen havaitut muutokset täsmäytetään nimeämättä havaitsijaa. Admin → Coffer näyttää viimeksi nähdyn fyysisen summan ja milloin se nähtiin.',
        },
        {
          term: 'Jäsen ilmoittaa lahjoituksen',
          body: 'julkiselta kassasivulta, kuvakaappauksen kanssa jos sellainen on. Se saapuu odottavana ja ilmestyy jonoosi. Hyväksyminen on se, mikä tekee siitä oikeaa rahaa.',
        },
        {
          term: 'Sinä kirjaat sen',
          body: 'Admin → Coffer → **Record a donation**. Hae listalta kuka sen antoi, laita summa nimen kohdalle, valmis. Myös vieraat voidaan kirjata — joku joka ei ole täysjäsen on silti voinut maksaa kassaan.',
        },
        {
          term: 'Useampi yhdessä',
          body: 'valitse kaikki, kirjoita kokonaissumma ja paina **Split … ways**, ja säädä yksittäistä osuutta käsin jos on tarpeen. Se kirjoittaa yhden rivin kullekin eikä yhtä riviä listalla, joten jokainen näkyy lahjoittajalistassa omalla nimellään.',
        },
      ],
      note: {
        tag: 'Oikaisu on eri asia',
        body: '**Correct the pot** on gp:lle joka on liikkunut kaiken tämän ulkopuolella — kassan alkupääoma, sen käyttäminen johonkin mitä Anvil ei nähnyt, virheen korjaaminen. Se ei tarkoituksella kuulu kenellekään, eikä se ole tapa kirjata lahja.',
      },
    },

    out: {
      title: 'Kolme tapaa maksaa ulos',
      intro: 'Jokainen Anvilin palkinto tulee tästä samasta potista, ja jokainen reitti ratkaisee voittajat omalla tavallaan. Aseta portaat sinne minne voitettava asia kuuluu — kassa ei koskaan kysy kuka voitti mitä.',
      rows: [
        {
          term: 'Viikkokisa, omalla sivullaan',
          body: 'Skill tai Boss of the Week kantaa sijoitusportaita: ensimmäinen saa tämän, toinen tuon. Se selvitetään **kerran** kisan päättyessä lopputilanteen perusteella — mikään ei vaihda omistajaa kesken kisan. Aseta se kisaa luodessasi tai myöhemmin kisan omalta sivulta.',
        },
        {
          term: 'Tehtäväruutu laudalla',
          body: 'tehtävät maksavat siinä järjestyksessä kuin ihmiset saavat ne valmiiksi, joten niiden portaat lunastetaan eikä selvitetä: ensimmäinen joukkue joka läpäisee sen, ottaa ykkössijan gp:n. Asetetaan ruudun rewards-osiossa, millä tahansa laudalla joka sallii tehtävät.',
        },
        {
          term: 'Laudan palkintopotti',
          body: 'bingo jakaa oman pottinsa sijoituksille, joten kassa ojentaa sille vain yhden luvun. Event → **Prizes** → *From the clan coffer*. Se lisätään ilmoittautumismaksuihin ja siihen mitä olet itse lisännyt, ja jako sijoille asetetaan samalla sivulla. Valitset myös, **varaako** kassa nuo gp:t heti vai kirjaako se vain lupauksen — ne eivät ole vielä lähteneet, eikä kuuden viikon päässä oleva lauta tarvitse puolta potista jäädytettynä siihen asti.',
        },
      ],
      note: {
        tag: 'Kun tulee tasapeli',
        body: 'Viikkoportaat voivat **jakaa tasapelin**: kaikki tasoissa olevat yhdistävät miehittämänsä sijat ja ottavat yhtä suuren osuuden, joten kolme 40 kc:n pelaajaa ottavat kukin kolmasosan ensimmäisestä, toisesta ja kolmannesta sen sijaan että ensimmäinen heistä veisi kaiken. Jätä pois päältä, ja laudan oma järjestys ratkaisee. Kumpikin on puolustettavissa — jälkikäteen päättäminen ei.',
      },
    },

    who: {
      title: 'Kuka saa siirtää sitä',
      intro: 'Raha on oma oikeutensa, ei arvoaste. Moderaattori voi hyväksyä lähetyksen koskematta koskaan kassaan, ja se on tarkoituksellista eikä unohdus.',
      rows: [
        {
          term: 'Rahastonhoitaja tai admin',
          body: 'koko kirjanpito: lahjoitusten kirjaaminen ja hyväksyminen, kassan oikaisu, palkintoportaiden asettaminen, palkinnon merkitseminen lähetetyksi. Omistaja lasketaan tässä adminiksi.',
        },
        {
          term: 'Moderaattori',
          body: 'ei mitään näistä. He eivät näe kassasivua lainkaan — rahan kerääminen on rahastonhoitajan työ, eikä pelkkä arvo ole koskaan antanut siihen oikeutta.',
        },
        {
          term: 'Laudan rahastonhoitaja',
          body: 'yhden tapahtuman rahat: sen maksut, sen palkinnot, sen palkintopotti. Myönnetään lautakohtaisesti, ja juuri niin vieraileva klaani hoitaa oman puolensa klaanien välisestä kisasta saamatta koko kirjanpitoanne. He eivät voi koskea klaanin kassaan.',
        },
        {
          term: 'Kuka tahansa jäsen',
          body: 'voi ilmoittaa lahjoituksen ja lukea julkista sivua. Siinä kaikki.',
        },
      ],
      note: {
        tag: 'Kerro klaanille, kanavalla',
        body: 'Osoita **Coffer ledger** Discord-kanavalle kohdassa Admin → Discord → What goes where → **Staff only**, niin jokainen liike julkaistaan sen jättämän saldon kanssa. Se on ainoa syöte ilman varareittiä: jätä tyhjäksi, eikä rahasta julkaista mitään missään. Katso [Anvil Discordissa]({discordGuide}).',
      },
    },

    short: {
      title: 'Kun kassa ei riitä',
      body: [
        'Kassaa suurempaa palkintoa ei hylätä. Se kirjataan **velaksi ilman katetta** — oikeana rivinä, jossa on voittajan nimi — koska vaihtoehto on voittaja ilman mitään ja ilman merkintää siitä että mitään koskaan luvattiin.',
        'Ratkaisu on siis tavallinen: hanki gp:tä sisään ja maksa sitten. Sitä mitä ei pidä tehdä, on muuttaa portaita hiljaa jälkikäteen; kirjanpito kertoo jo mitä ilmoitettiin, ja niiden ristiriita on pahempaa kuin rahan puute.',
      ],
      note: {
        tag: 'Anvil ei lähetä mitään',
        body: 'Jokainen palkinto päättyy siihen että ihminen ojentaa gp:n pelissä ja rastittaa rivin. Kirjanpidon tehtävä on varmistaa että rivi on olemassa, että siinä lukee kuka ja kuinka paljon, ja ettei kenenkään tarvitse viikkoa myöhemmin kaivaa sitä Discordin historiasta.',
      },
    },
  },
  moderator: {
    metaTitle: 'Vuorossa — Anvilin moderaattoriopas',
    metaDescription:
      'Moderaattorin päivä Anvil-klaanisivustolla: jono, lähetysten ja tilien tarkistus, jäsenlistan pitäminen rehellisenä, ja harkintakysymykset.',
    eyebrow: 'Anvil · moderaattoreille',
    title: 'Vuorossa',
    dek: 'Moderaattori tekee sen työn joka saapuu riippumatta siitä onko tapahtuma käynnissä: todisteita katsottavaksi, tilejä vahvistettavaksi, jäsenlista joka ajautuu. Tässä on mistä jono koostuu, ja miten tyhjennät sen tulematta itse syyksi siihen että ihmiset odottavat.',
    facts: [
      { strong: 'Ei tapahtumia', rest: 'moderaattori ei voi luoda eikä muokata niitä' },
      { strong: 'Yksi sivu', rest: 'kertoo mikä odottaa sinua' },
      { strong: 'Hyväksy nopeasti', rest: 'hidas jono tuntuu rikkinäiseltä sivustolta' },
    ],
    footnote:
      'Moderaattori näkee kaiken minkä jäsenkin, sekä tarkistuspinnat. Tapahtumien luonti ja muokkaus, asetukset, henkilökunta ja palkintojen maksu ovat ylläpitäjän ja rahastonhoitajan töitä — jos painiketta ei ole, syy on tämä, ja se on tarkoituksellista.',

    what: {
      title: 'Mikä rooli on',
      intro:
        'Roolit pinoutuvat alaspäin: kaiken minkä moderaattori voi, voi myös rahastonhoitaja ja ylläpitäjä. Se mikä on nimenomaan moderaattorin:',
      canList: [
        'jäsenlista: ihmisten lisääminen ja poistaminen sekä liittymispyyntöihin vastaaminen ([Väkesi]({peopleGuide}))',
        'tilien vahvistukset — XP-haaste ja manuaalinen tarkistus',
        'lähetykset ja todistekuvakaappaukset',
        'viikkokilpailut ja aikataulu',
        'klaanikalenterin tapahtumat',
      ],
      cantIntro: 'Mitä he eivät voi, tarkoituksella:',
      cantList: [
        'luoda tai muokata tapahtumaa tai sen ruutuja',
        'muuttaa klaaniasetuksia tai Discord-kytkentöjä',
        'ylentää ketään tai koskea henkilökuntaan',
        'sulkea maksua tai ajaa palkintojen maksua',
      ],
    },

    queue: {
      title: 'Aloita siitä mikä odottaa sinua',
      body: [
        'Ylläpidon työpöytä ei ole yhteenveto sivustosta — se on lista siitä mikä odottaa, järjestettynä sen mukaan kuinka paljon sillä on merkitystä, laskettuna oikeasta datasta eikä ajautuvista laskureista. Jos se sanoo ettei mikään odota sinua, mikään ei odota.',
        'Etene ylhäältä alas. Huipulle nousevat ne kohdat joissa on ihminen toisessa päässä: joku joka ei voi ilmoittautua koska tiliä ei ole vahvistettu, tai jonka droppia ei ole laskettu koska kukaan ei ole vielä katsonut sitä.',
      ],
    },

    submissions: {
      title: 'Lähetykset ja todisteet',
      body: [
        'Useimmat hyvitykset eivät koskaan tavoita sinua: plugin näkee dropin, arkistoi kuvakaappauksen joukkueella ja UTC-aikaleimalla leimattuna, ja ruutu valmistuu. Jonoon päätyvät manuaaliset ruudut ja kaikki mitä plugin on merkinnyt.',
        'Leima on se mikä tekee todisteesta vaikean kiistää. Pluginin kuvakaappaus kantaa joukkueen ja hetken kuvaan leivottuna, ja kahden ruudun todisteen ollessa päällä toinen ruutu pari sekuntia myöhemmin näyttää lootin asettuneen maahan. Kuvakaappaus jossa ei ole mitään näistä on kuvakaappaus puhelimesta, mikä on ihan hyvä — se vain tarkoittaa että sinä olet se joka tarkistaa.',
      ],
      rows: [
        {
          term: 'Hyväksy kun se on uskottava',
          body: 'et tarkasta pankkia. Jos kuva näyttää asian, tili on jäsenlistalla ja aikaleima on tapahtuman sisällä, hyväksy ja jatka eteenpäin.',
        },
        {
          term: 'Hylkää perusteluineen',
          body: 'hylkäys ilman selitystä palaa sinulle yksityisviestinä tunnin sisällä. Kerro mitä puuttui, jotta toinen yritys on oikein.',
        },
        {
          term: 'Merkitty lähetys on kysymys, ei syytös',
          body: 'plugin merkitsee sen mitä se ei voinut täysin vahvistaa — useimmiten pelaajan joka ei ole toimittanut aloituskuvaa. Lue se muodossa “katso tätä”, ei muodossa “joku huijasi”.',
        },
      ],
    },

    verify: {
      title: 'Tilien vahvistaminen',
      intro:
        'Kukaan ei voi ilmoittautua tapahtumaan ilman vähintään yhtä vahvistettua tiliä, joten tämä jono estää ihmisiä suoraan pelaamasta. Tämä kannattaa tyhjentää päivittäin.',
      rows: [
        {
          term: 'Vahvistettu pluginilla',
          body: 'ensimmäisen omistajuustarkistuksen jälkeen plugin tunnistaa tilin automaattisesti ja pysyvä sormenjälki säilyttää yhteyden nimenvaihdoksissa. Jäsenlistan tili ilman tunnettua sormenjälkeä käyttää XP-tarkistusta tai moderaattorin hyväksyntää kerran.',
        },
        {
          term: 'Verify by XP',
          body: 'pelaajille ilman pluginia. Sivusto valitsee satunnaisen taidon ja heidän on ansaittava siinä 1 000 XP kolmenkymmenen minuutin sisällä. Se tarkistaa itsensä — näet vain ne jotka epäonnistuvat.',
        },
        {
          term: 'Manuaalinen tarkistus',
          body: 'piilotetut Hiscoresit, tai alt-tili joka on liian uusi näkyäkseen niissä. Joku lähettää RSN:n huomautuksen kera ja sinä päätät. Pyydä kuvakaappaus kirjautumisruudusta jos huomautus ei riitä.',
        },
      ],
      note: {
        tag: 'Vahvistettu ei ole sama kuin jäsen',
        body: 'Tilin vahvistaminen sanoo “tämä on oikeasti heidän”. Se ei tee heistä osaa klaania. Jäsenyys tulee vain pelinsisäisestä jäsenlistan synkronoinnista tai henkilökunnalta, joka lisää heidät käsin, ja vieraspaikka vain liittymispyynnöstä, jonka henkilökunta hyväksyy (tai heti, jos klaani päästää kaikki sisään). Se on tarkoituksellista, ja se on se, mikä estää ketään liittymästä klaaniisi kirjoittamalla nimen.',
      },
    },

    roster: {
      title: 'Jäsenlistan pitäminen rehellisenä',
      body: [
        'Jäsenlista tulee yhdestä paikasta: ylläpitäjä ajaa synkronoinnin pelinsisäisestä klaanilistasta, pluginin Bingo-välilehdeltä Collection Logissa. Kaikki muu — vahvistukset, liitokset, ilmoittautumiset — roikkuu siinä.',
        'Ylläpitotyö on siis pieni mutta todellinen: pyydä ylläpitäjää ajamaan synkronointi jokaisen rekrytointikierroksen jälkeen (se tekee pelissä liittyneistä vieraista jäseniä), vastaa liittymispyyntöihin **Roster**-välilehden yläosassa ja käy **Needs review** läpi sen sijaan, että odottaisit ihmisten valittavan. Katso [Väkesi]({peopleGuide}).',
      ],
      note: {
        tag: 'Viimeksi nähty ei ole viimeksi pelattu',
        body: 'Jäsenen “viimeksi nähty klaanissa” -aikaleima kertoo viimeisimmän synkronoinnin joka löysi heidät, ei viimeistä kertaa jolloin he kirjautuivat sisään. Kysymykseen “pelaavatko he yhä” lue heidän live-tilastojensa aika sen sijaan — se on se joka liikkuu itsestään.',
      },
    },

    startshot: {
      title: 'Aloituskuvien tarkistaminen',
      body: [
        'Tapahtumassa joka vaatii sellaisen, jokaisen pelaajan on toimitettava kuvakaappaus otettuna sen jälkeen kun tapahtuma alkoi, paikassa joka arvottiin aloitushetkellä. Pluginin ottamat kuvat vahvistetulla salasanalla saapuvat jo hyväksyttyinä, joten käytännössä katsot vain pelaajia jotka latasivat käsin puhelimesta.',
        'Se mitä tarkistat on pieni: että hahmo on kuvassa, että salasana on chat-ikkunassa, ja että se on se salasana jonka juuri tuo pelaaja oikeasti sai. Lataukset lasketaan heti ja tarkistat ne jälkikäteen, joten kukaan ei ole estynyt pelaamasta odottaessaan sinua.',
      ],
    },

    judgement: {
      title: 'Harkintakysymykset joita joudut ratkomaan',
      intro:
        'Yhdelläkään näistä ei ole oikeaa vastausta ohjelmistossa, ja juuri siksi ne päätyvät ihmiselle.',
      rows: [
        {
          term: 'Todiste on aito mutta myöhässä',
          body: 'droppi tapahtui tapahtuman sisällä ja kuvakaappaus tuli sen päätyttyä. Hyväksy yleensä — katso kuvan leimaa, älä latausaikaa.',
        },
        {
          term: 'Tiliä ei ole vielä liitetty',
          body: 'droppi on aito, tili on heidän, sitä vain ei lisätty ennen pelaamista. Liitä se, ja hyväksy sitten. Älä pakota ketään tekemään raidia uudelleen paperityön takia.',
        },
        {
          term: 'Se näyttää lavastetulta',
          body: 'vie se ylläpitäjälle sen sijaan että hylkäisit sen itse. Hylkäys on julkinen syytös pienen klaanin sisällä, eikä sen pitäisi koskaan olla yhden ihmisen kiireessä tekemä päätös.',
        },
        {
          term: 'Olet itse mukana tapahtumassa',
          body: 'melkein varmasti olet. Anna kaikki oman joukkueesi asiat toiselle moderaattorille — ei siksi että olisit epäreilu, vaan siksi ettei sinun pitäisi joutua todistamaan ettet ollut.',
        },
      ],
    },
  },

  commands: {
    metaTitle: 'Discordin kauttaviivakomennot — Anvil',
    metaDescription:
      'Jokainen Anvilin kauttaviivakomento — /bingo, /sotw, /botw, /eff, /coffer, /stats ja /guide — jokainen valinta selitettynä, esimerkit, kuka saa käyttää mitä, ja korjaukset komentoihin, jotka eivät näy.',
    eyebrow: 'Anvil · Discordissa',
    title: 'Kauttaviivakomennot',
    dek: 'Kirjoita `/` klaanisi Discordiin, niin Anvil vastaa suoraan sivustolta reaaliajassa: taulu, tilanne, oma korttisi, viikkokisat, kassa ja kenen tahansa statsit. Tämä sivu on koko lista, joka on luotu niistä komennoista, jotka botti oikeasti rekisteröi, joten se ei ole koskaan vanhentunut.',
    facts: [
      { strong: 'Yksityinen', rest: 'vastaukset, jotka vain sinä näet, ja Share-painike' },
      { strong: 'Sinun kielesi', rest: 'se, jolle Discordisi on asetettu' },
      { strong: 'Vain luku', rest: 'paitsi /coffer add ja remove' },
    ],
    footnote:
      'Botin käyttöönotto ylipäätään on [Discord-oppaassa](/guide/discord). Tämä sivu kertoo sen käyttämisestä.',

    using: {
      title: 'Näin komento toimii',
      body: [
        'Kirjoita `/` mille tahansa kanavalle, jonka botti näkee, ja valitse listalta Anvil-komento. Discord näyttää sitten sen valinnat täytettävinä kenttinä: paina Tab tai klikkaa valintaa lisätäksesi sen. Alla kulmasulkeissa, `<angle brackets>`, olevat valinnat ovat pakollisia; hakasulkeissa, `[square brackets]`, olevat ovat valinnaisia ja voit jättää ne pois.',
        'Jokainen vastaus on **yksityinen**: vain sinä näet sen, joten taulun tarkistaminen kymmenen kertaa päivässä ei häiritse ketään. Jos se kannattaa näyttää kanavalle, paina vastauksen alla **Share to channel**. Jaettu kopio rakennetaan uudelleen sillä hetkellä, joten myöhemmin jaettu tilanne on tilanne sellaisena kuin se silloin on.',
      ],
      rows: [
        { term: 'Pakollinen', body: '`<amount>` — Discord ei lähetä komentoa ennen kuin se on täytetty.' },
        { term: 'Valinnainen', body: '`[member]` — jätä se pois, niin komento vastaa sinusta, joukkueestasi tai koko klaanista.' },
        { term: 'Lista', body: 'valitse jokin Discordin tarjoamista arvoista; omaa arvoa et voi kirjoittaa.' },
        { term: 'Kirjoita hakeaksesi', body: 'ala kirjoittaa ja valitse ehdotuksista, kuten bossien nimistä tai omista tileistäsi.' },
        { term: 'Jäsen', body: 'valitse joku palvelimelta, samaan tapaan kuin @maininnalla.' },
      ],
      note: {
        tag: 'Komennot toimivat vain klaanisi palvelimella',
        body: 'Jokainen vastaus koskee yhtä klaania, eikä yksityisviestillä ole klaania, josta vastata. Siksi komennot eivät näy yksityisviesteissä.',
      },
    },

    bingo: {
      title: 'Taulukomennot: /bingo',
      intro:
        '`/bingo` koskee yhtä taulua. Kun useampi taulu on käynnissä, **board** ja **leaderboard** listaavat ne kaikki; muut vastaavat käynnissä olevasta taulusta, sen puuttuessa seuraavaksi alkavasta ja sitten juuri päättyneestä.',
    },

    clan: {
      title: 'Klaanikomennot',
      intro:
        'Nämä vastaavat klaanista eivätkä taulusta, joten ne toimivat oli bingo käynnissä tai ei: viikkokisat, tehokkuus, kassa, kenen tahansa statsit ja käyttöönotto-oppaat.',
    },

    options: {
      title: 'Valinnat, jotka näet kaikkialla',
      intro: 'Muutama valinta tarkoittaa samaa jokaisessa komennossa, jossa se on:',
      rows: [
        {
          term: '`member`',
          body: 'joku muu palvelimella. Jätä pois kysyäksesi itsestäsi. Se löytää hänen Anvil-tilinsä sen Discord-kirjautumisen kautta, jota hän käytti sivustolla, joten se toimii vain jäsenille, jotka ovat kirjautuneet Anviliin kerran.',
        },
        {
          term: '`account`',
          body: 'mikä hänen OSRS-tileistään, alteja pelaaville. Kirjoita valitaksesi; jätä pois päätiliä varten.',
        },
        {
          term: '`page`',
          body: 'bossi tai aktiviteetti, haettuna kirjoittamalla: `Zulrah`, `Theatre of Blood`, `Tempoross`. Jätä pois kokonaisnäkymää varten.',
        },
        {
          term: '`language`',
          body: 'vastaa tämän yhden kerran eri kielellä. Oletuksena saat kielen, jolle Discordisi on asetettu, tai klaanin valitseman botin kielen.',
        },
        {
          term: '`amount`',
          body: 'gp helposti: `5m`, `2.5b`, `500k` tai tavallinen luku kuten `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Kuka saa käyttää mitä',
      body: [
        'Kuka tahansa palvelimella voi ajaa jokaisen vain luku -komennon. Näet saman kuin jäsen näkisi: taulu, jonka ruutuja ei ole vielä paljastettu, pysyy piilossa myös Discordissa, jopa henkilökunnalta.',
        '**Sinusta** vastaavien komentojen (`/bingo me`, `/stats` ilman member-valintaa) täytyy tietää, mikä Anvil-tili on sinun. Ne löytävät sen sen Discord-kirjautumisen kautta, jota käytit sivustolla, joten kirjaudu Anviliin Discordilla kerran, niin ne toimivat siitä lähtien.',
      ],
      rows: [
        { term: 'Kaikki', body: 'jokainen komento paitsi `/coffer add` ja `/coffer remove`.' },
        {
          term: 'Rahastonhoitajat, adminit, omistajat',
          body: '`/coffer add` ja `/coffer remove`. Tarkistetaan roolistasi **Anvil-sivustolla**, ei koskaan Discord-roolistasi, koska arvo chat-palvelimella ei ole koskaan tarkoittanut määräysvaltaa klaanin rahoihin.',
        },
      ],
    },

    trouble: {
      title: 'Kun komento ei toimi',
      intro: 'Tavalliset syyt, suunnilleen siinä järjestyksessä kuin ne tulevat vastaan:',
      rows: [
        {
          term: 'Listalla ei ole Anvil-komentoja',
          body: 'botti kutsuttiin ilman sen komentoja — se on erillinen oikeus, ja vanhemmat kutsulinkit pyysivät vain toista. Admin ajaa **Invite / re-invite the bot** uudelleen kohdasta Admin → Discord → **Connection**. Se ei poista bottia eikä nollaa mitään. Uusien komentojen ilmestyminen voi kestää jopa tunnin.',
        },
        {
          term: '"The application did not respond"',
          body: 'Anvil ei ollut hetkeen tavoitettavissa, yleensä kesken päivityksen. Aja komento uudelleen muutaman sekunnin päästä.',
        },
        {
          term: '"Et ole tällä taululla" itsestäsi',
          body: 'joko et ole liittynyt tähän tauluun, tai Anvil ei pysty yhdistämään Discordiasi tiliisi. Kirjaudu sivustolle tällä Discord-tilillä ja tarkista profiilisi.',
        },
        {
          term: 'Jäsenen statsit tulevat tyhjinä',
          body: 'hän ei ole vielä kirjautunut Anviliin Discordilla, tai hänen tilinsä hiscoreseja ei ole vielä luettu. Yritä uudelleen `account`-valinnalla, tai pyydä häntä kirjautumaan kerran.',
        },
        {
          term: '`/coffer add` sanoo, ettet voi',
          body: 'roolisi Anvil-sivustolla ei ole rahastonhoitaja, admin tai omistaja, tai tämä Discord ei ole se tili, jolla kirjaudut sivustolle.',
        },
      ],
    },

    labels: {
      options: 'Valinnat',
      noOptions: 'Ei valintoja — aja vain.',
      example: 'Esimerkki',
      examples: 'Esimerkit',
      required: 'pakollinen',
      optional: 'valinnainen',
      choices: 'Vaihtoehdot',
      range: '{min}–{max}',
      kinds: {
        text: 'teksti',
        number: 'luku',
        member: 'jäsen',
        choice: 'valitse listalta',
        search: 'kirjoita hakeaksesi',
        yesno: 'kyllä tai ei',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'Juuri nyt käynnissä oleva taulu. Ruutujen nimet pysyvät piilossa täälläkin, kunnes taulu paljastetaan.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Joukkueiden tilanne, pisteinä tai ruutuina sen mukaan, miten taulu pisteytetään.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Miten tämä taulu pisteytetään (luettu suoraan tapahtumasta, joten se on aina oikein), ja sitten klaanisi omat säännöt.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Miten pääset mukaan: ilmoittautumiset, osallistumismaksu, ja missä vaiheessa oma ilmoittautumisesi on.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Mitä on tulossa seuraavaksi: ruutujen paljastus, tehtävä tai määräaika.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Joukkueesi, sijoituksesi ja sinulle kirjatut ruudut.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'Lyhyt lista siitä, mihin botti vastaa, suoraan Discordissa.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'Joukkueen kortti: pisteet, kokoonpano ja viimeisimmät ruudut. Jätä nimi pois nähdäksesi oman joukkueesi.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Jokainen aktiivinen Skill of the Week, kunkin kärki ja oma sijoituksesi.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Jokainen aktiivinen Boss of the Week ja sen reaaliaikainen tilanne.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'Klaanin tehokkuuslista ja sijoituksesi siinä. Oletuksena pelatut tunnit; valitse bossitunnit bossaukseen.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Kassan saldo, suurimmat lahjoittajat ja viimeisimmät liikkeet.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Vain rahastonhoitajille, admineille ja omistajille. Kirjaa sisään tulevan gp:n; se postataan myös kassan syötekanavalle.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Vain rahastonhoitajille, admineille ja omistajille. Kieltäytyy viemästä kassaa alle nollan; kirjaa se kassasivulla, jos todella tarkoitat sitä.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Yksi tili yhdellä silmäyksellä: combat- ja kokonaistaso, pelatut tunnit ja bossitunnit, collection login määrä ja ennätykset.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Jokaisen skillin taso ja XP.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Pelatut tunnit ja bossitunnit, ja mistä skilleistä ja bosseista ne tulevat.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Collection login edistyminen kokonaisuutena, tai yhden bossin sivu.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Henkilökohtaiset ennätykset. Raideilla on oma aika kullekin moodille ja joukkuekoolle, joten käytä valintoja `mode` ja `size` löytääksesi tarkoittamasi runin.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Kuinka onnekas tili on ollut Anvilin seuraamissa dropeissa.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Klaanin suurimmat collection logit.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Klaanin kuivimmat ja onnekkaimmat jäsenet.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Käyttöönotto-opas Discordissa: vaiheiden lista, tai yksi vaihe linkillä suoraan siihen sivustolla.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'Yksi klaanin peliohjeista (raidit, bossaus, rahanteko…): ala kirjoittaa sen nimeä ja valitse se listasta.',
      },
    },
  },

  tiles: {
    metaTitle: 'Ruutujen säännöt ja rajoitukset — Anvil',
    metaDescription:
      'Mitä kukin bingoruututyyppi vaatii sinulta (peliasetukset, RuneLite-plugin, synkronoitu collection log, hiscores-sijoitus) ja mitä se ei pysty seuraamaan.',
    eyebrow: 'Anvil · pelaajille',
    title: 'Ruutujen säännöt ja rajoitukset',
    dek: 'Jokainen ruutu kertoo, mitä se vaatii sinulta ja mihin se ei pysty. Tämä sivu selittää jokaisen rivin; ruudun **Why?**-linkit tuovat tänne.',
    needs: 'Vaatii',
    limit: 'Hyvä tietää',
    checked: 'Ruutu tarkistaa tämän puolestasi',
    englishOnly: 'Alla olevat säännöt ovat toistaiseksi englanniksi, jotta ne vastaavat aina sitä, mitä sivusto oikeasti tekee.',
  },

  // /guide/creators — isännän opas creator-tilaan.
  creators: {
    metaTitle: 'Järjestä OSRS-bingo katsojillesi — Anvil',
    metaDescription:
      'Pidä Old School RuneScape -bingo tai ruutukilpailu striimillesi ilman klaania: tee tila, jaa yksi linkki, valitse kuka voi liittyä (Twitch, Kick, YouTube tai Discord) ja tuo taulu striimiin OBS:llä.',
    eyebrow: 'Striimaajille ja sisällöntuottajille',
    title: 'Tapahtumia katsojillesi',
    dek: 'Creator-tilassa voit pitää bingon striimillesi. Pelin sisäistä klaania ei tarvita. Teet yhden tapahtuman, jaat yhden linkin, ja katsojasi liittyvät.',
    facts: [
      { strong: 'Ei klaania', rest: 'tarvita' },
      { strong: 'Ilmainen', rest: 'aloittaa' },
      { strong: 'Yksi linkki', rest: 'chattiisi' },
    ],

    what: {
      title: 'Mikä creator-tila on',
      body: [
        'Se on oma sivusi Anvilissa osoitteessa `{apex}/c/sinun-nimesi`. Siellä pidät tapahtumia katsojillesi.',
        'Se ei ole klaani. Ei ole klaanilistaa, arvoja eikä viikkokisoja. Tapahtumaasi liittyvä pelaa sitä tapahtumaa. Ei muuta.',
        'Katsojat kirjautuvat Discordilla, lisäävät RuneScape-hahmonsa ja painavat **Join**. Anvilin RuneLite-plugin laskee sitten heidän dropinsa itse.',
      ],
    },

    create: {
      title: 'Tee tilasi',
      body: [
        'Mene osoitteeseen [{apex}/host](/host) ja kirjaudu Discordilla.',
        'Kirjoita tilallesi nimi. Kanavasi nimi on hyvä valinta. Linkki tehdään nimestä. Paina **change link**, jos haluat toisen.',
        'Paina **Create my space**. Saat yhden tilan per Discord-tili.',
      ],
    },

    first: {
      title: 'Tee ensimmäinen tapahtumasi',
      body: [
        'Heti tilan tehtyäsi pääset kohtaan **Create your first event**. Myöhemmin käytä **+ New event** -painiketta kohdan **Your events** yläreunassa.',
        '**Name.** Sen katsojasi näkevät.',
        '**What kind?** Valitse kortti. **Team bingo** on 5×5-ruudukko, ja Anvil jakaa pelaajat joukkueisiin puolestasi. **Solo bingo** on sama ruudukko, jokainen pelaa omillaan. **Team race** on tehtäviä järjestyksessä: pisimmälle edennyt joukkue voittaa.',
        '**Ready-made tiles** antaa sekoituksen helppoja ja vaikeita tehtäviä, joita voit muokata myöhemmin. **Blank, I’ll write my own** alkaa tyhjänä.',
        '**Who can join?** Jätä arvoon **Anyone** tai valitse kuka voi liittyä. Katso vaihe 5.',
        '**When?** Valitse alkamis- ja päättymispäivä. Tai jätä tyhjäksi ja aloita tapahtuma itse, kun olet valmis.',
        'Paina **Create event**. Paina sitten **Copy invite link**.',
      ],
    },

    share: {
      title: 'Jaa linkki',
      body: [
        'Liitä kutsulinkki striimisi chattiin, Discordiisi tai someen. Katsojasi tarvitsevat vain sen linkin.',
        'Voit kopioida sen uudelleen milloin tahansa: **Your events** → **Copy invite link** tapahtuman vieressä.',
        'Haluatko, että botti vastaa chatissa komentoon `!join` linkillä? Katso vaihe 9.',
      ],
    },

    who: {
      title: 'Valitse kuka voi liittyä',
      body: [
        'Jokainen tapahtuma alkaa avoimena kaikille (**Anyone**). Jos haluat pitää sen yhteisöllesi, avaa tapahtuman **Settings** → **Viewers** → **Who can join?** ja valitse yksi tai useampi vaihtoehto. Samat vaihtoehdot ovat ensimmäisen tapahtuman näkymässä.',
        'Jos valitset useamman, **mikä tahansa niistä riittää**. Seuraaja TAI palvelimen boostaaja pääsee sisään.',
      ],
      intro: 'Jokainen vaihtoehto ja mitä katsojan pitää tehdä:',
      rows: [
        {
          term: 'Anyone',
          body: 'Kuka tahansa linkin saanut liittyy heti.',
        },
        {
          term: 'Twitch followers',
          body: 'Katsoja painaa tapahtumasivulla **Link Twitch** ja kirjautuu Twitchillä. Anvil tarkistaa, että hän seuraa sinua.',
        },
        {
          term: 'Twitch subs',
          body: 'Kuten seuraajat, mutta heidän pitää olla tilaajia. Valitse alin taso: **Tier 1 or higher**, **Tier 2 or higher** tai **Tier 3**. Prime-tilaajat lasketaan tasoksi 1. Kanavasi pitää olla Twitchin affiliate tai partner.',
        },
        {
          term: 'Kick followers',
          body: 'Kick ei kerro sovelluksille, ketkä seuraavat sinua, joten Anvil laskee ne, jotka seuraavat _sen jälkeen_ kun yhdistät Kickin. Seurasiko jo aiemmin? Katsoja lopettaa seuraamisen ja seuraa uudelleen. Onko Kick-chattisi vain seuraajille? Laita **Kick channel** -laatikossa päälle **My Kick chat is followers-only**. Silloin katsoja, joka kirjoittaa Anvil-koodinsa chattiisi, lasketaan seuraajaksi.',
        },
        {
          term: 'Kick subs',
          body: 'Tilaajat, jotka Anvil on nähnyt Kickin yhdistämisen jälkeen, lasketaan itsestään. Kaikki muut painavat **Get Kick code** ja kirjoittavat koodin (se näyttää tältä: `ANVIL-7F3K9Q`) Kick-chattiisi, ja Anvil näkee heidän tilaajamerkkinsä. Kickissä ei ole tilaajatasoja.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Katsoja painaa **Check my YouTube subscription** ja kirjautuu Googlella. Hänen tilauksensa pitää olla julkisia YouTubessa.',
        },
        {
          term: 'YouTube members',
          body: 'Katsoja kirjoittaa Anvil-koodinsa YouTube-livechattiisi. Jäsenet voivat siis liittyä vain **kun olet livenä**.',
        },
        {
          term: 'Discord role',
          body: 'Ihmiset, joilla on valitsemasi rooli Discord-palvelimellasi (enintään 5 roolia). Yhdistä palvelimesi ensin: **Discord (optional)** valikossa.',
        },
        {
          term: 'Server boosters',
          body: 'Ihmiset, jotka boostaavat Discord-palvelintasi. Vaatii myös palvelimesi yhdistämisen.',
        },
      ],
      note: {
        tag: 'Hyvä tietää',
        body: 'Yhdistä kanavasi ensin (vaihe 7), muuten Twitch-, Kick- ja YouTube-valinnat pysyvät harmaina. Yksi Twitch-, Kick- tai YouTube-tili saa jokaiseen tapahtumaan vain yhden pelaajan. Henkilökuntasi ja nimeltä kutsumasi ihmiset ohittavat tarkistukset.',
      },
    },

    approve: {
      title: 'Hyväksy jokainen pelaaja (valinnainen)',
      body: [
        'Haluatko valita, ketkä pelaavat? Avaa tapahtuman **Settings** → **Viewers** → **Who can enter** ja valitse **Ask me about everyone**. Paina **Save changes**.',
        'Nyt katsojat painavat **Join**-painikkeen sijaan **Ask to join**. Heidän pitää silti ensin läpäistä **Who can join?** -valintasi.',
        'Heidän pyyntönsä näkyvät kohdassa **Your events** tekstinä **N waiting for you**. Klikkaa sitä tai avaa tapahtuman **Sign-ups**-välilehti. Ylälistan nimi on **Waiting for your yes**. Hyväksy tai hylkää jokainen.',
      ],
    },

    channels: {
      title: 'Yhdistä Twitch, Kick tai YouTube',
      body: [
        'Avaa valikosta **Settings**. Paina **Twitch channel**-, **YouTube channel**- tai **Kick channel** -laatikossa **Connect Twitch**, **Connect YouTube** tai **Connect Kick** ja kirjaudu kanavanasi.',
        'Jokainen yhdistämäsi kanava näkyy sivullasi **verified**-linkkinä. Linkkiä ei voi kirjoittaa käsin: kirjautumisesta Anvil tietää, että kanava on sinun.',
        'Kanavan voi yhdistää yhteen paikkaan Anvilissa. Jos se on jo toisessa pyörittämässäsi tilassa tai klaanissa, Anvil kysyy haluatko siirtää sen.',
      ],
    },

    overlay: {
      title: 'Tuo taulu striimiin (OBS)',
      body: [
        'Kohdassa **Your events** paina tapahtuman vieressä **Stream overlay** ja sitten **Make overlay links**.',
        'Saat kolme linkkiä. **Standings**: kärkijoukkueet ja kuinka pitkällä ne ovat. **Feed**: uusimmat dropit ja valmistuneet ruudut. **Board**: taulu, jossa valmiit ruudut on merkitty.',
        'Valitse **Text size** (S, M, L tai XL) ennen kopiointia. Paina sitten haluamasi vieressä **Copy**.',
      ],
      stepsTitle: 'Lisää se OBS:ään',
      steps: [
        'Paina OBS:ssä kohdassa **Sources** **+** ja valitse **Browser**.',
        'Liitä linkki kenttään **URL**.',
        'Aseta koko, esimerkiksi 800 × 600. Jätä **Custom CSS** tyhjäksi.',
        'Paina **OK**. Se päivittyy itsestään muutaman sekunnin välein.',
      ],
      tipsTag: 'Hyvä tietää',
      tips: [
        'Lisää linkin loppuun `&limit=10`, `&title=0` tai `&align=right` muuttaaksesi sitä.',
        'Overlay näyttää saman kuin julkinen tapahtumasivusi. Piilotetut tilanteet ja piilotetut ruudut pysyvät piilossa myös striimissä.',
        '**Reset link** tekee uudet linkit ja pysäyttää vanhat. Käytä sitä, jos linkki vuotaa. Uudet linkit pitää liittää OBS:ään uudelleen.',
        'Pieni “Anvil”-merkki on kulmassa. Gold-tasolla voit piilottaa sen kohdassa **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join chatissasi',
      body: [
        'Avaa **Settings** → **!join in Twitch chat** ja laita se päälle.',
        'Kun katsoja kirjoittaa `!join`, Anvil-botti (Anvil_OSRS) vastaa linkillä avoimeen tapahtumaasi. Se vastaa korkeintaan kerran 30 sekunnissa, vaikka kuinka moni kirjoittaisi sen.',
        'Se vastaa vain kanavalla, jonka yhdistit vaiheessa 7. Kickiä varten laita **Kick channel** -laatikossa päälle **!join in Kick chat**.',
        'Ei avointa tapahtumaa? Se kertoo sen: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Jos chattisi estää linkit (Twitchin **Block hyperlinks** tai AutoMod), botin vastaus jää pidätetyksi. Kirjoita chattiisi kerran `/vip anvil_osrs` tai `/mod anvil_osrs`, niin linkki menee läpi.',
        'Työstätkö tapahtumaa? Tapahtuman valikon **Space settings** vie takaisin näihin kytkimiin. Samoin **Switch it on in your settings** kohdan **Who can join?** alla.',
      ],
    },

    page: {
      title: 'Tee sivustasi omasi',
      body: [
        'Sivusi on se, minkä ihmiset näkevät osoitteessa `{apex}/c/your-name`, tapahtumiesi kanssa. Avaa **Settings** → **Your page**. Jokaisella osalla on oma tallennuspainikkeensa.',
      ],
      items: [
        '**Bio.** Muutama rivi sinusta ja striimeistäsi. Linkit, jotka alkavat `https://`, ovat klikattavia.',
        '**Logo and banner.** Paina **Upload a logo** tai **Upload a banner**. Banneri kulkee sivusi yläreunan poikki, joten tee siitä leveä (3:1, esimerkiksi 1500 × 500). PNG, JPEG, GIF tai WebP. Molemmat saavat olla animoituja.',
        '**Panels.** Enintään 8 korttia tapahtumiesi alla, kuten paneelit Twitch-kanavan alla. Paina **+ Add a panel** ja anna sille otsikko ja vähän tekstiä. Kuva ja linkki ovat vapaaehtoisia. Muuta järjestystä nuolilla.',
        '**Schedule.** Milloin yleensä menet liveen, omalla aikavyöhykkeelläsi. Kävijät näkevät jokaisen ajan omassa ajassaan.',
        '**Featured.** Yksi klippi kiinnitettynä sivusi yläosaan. Valitse yksi striimisi kohokohdista (seuraava vaihe) tai liitä klippilinkki Twitchistä, YouTubesta, Kickistä tai Medalista.',
        'Paina **Preview your page** nähdäksesi sivun niin kuin kävijät sen näkevät.',
      ],
      note: {
        tag: 'Jagexin säännöt',
        body: 'Kaiken sivullasi pitää noudattaa Jagexin sääntöjä: ei kullan tai tilien myyntiä, ei uhkapelaamista, ei botteja eikä yksityisiä palvelimia. Anvil tarkistaa tekstisi ja linkkisi tallentaessasi. Jos Anvilin henkilökunta piilottaa sivusi ilmoituksen jälkeen, asetuksesi kertovat sen. Kysy Anvilin Discordissa, jos se on mielestäsi virhe.',
      },
    },

    highlights: {
      title: 'Striimin kohokohdat',
      body: [
        'Kun Twitch- tai YouTube-kanavasi on yhdistetty, Anvil tallentaa tapahtumiesi isot hetket, kun olet livenä. Kytkimet ovat kohdassa **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** on päällä heti, kun yhdistät. Kun olet livenä Twitchissä, Anvil tekee klipin, kun jokin tapahtumasi alkaa, kun joukkue tyhjentää taulun tai voittaa ja kun oma hahmosi saa harvinaisen dropin tai petin. YouTubessa se tallentaa sen sijaan linkin striimisi kyseiseen sekuntiin. Kickissä kohokohtia ei vielä ole.',
        'Klipit näkyvät kohdassa **Highlights** tapahtumasivulla ja sivullasi. Voit kiinnittää yhden **Featured**-klipiksesi (vaihe 10).',
        '**Let Anvil feature clips from my events in its own promotion** pysyy pois päältä, kunnes laitat sen päälle. Sen jälkeen Anvil voi jakaa klipin omilla sivuillaan ja somessa, ja mainitsee sinut aina tekijänä.',
        'Pelaajasi voivat myös klipata omat isot hetkensä. He laittavat päälle **Clip my stream when I hit a big moment** Twitch-tilinsä alla kohdassa **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Näy Anvilin listalla',
      body: [
        'Tilasi ei ole listalla, kun teet sen. Vain linkin saaneet löytävät sen.',
        'Avaa **Settings** → **Advertise on Anvil** ja laita se päälle. Tilasi näkyy Anvilin klaanihakemistossa, ja uudet tapahtumasi näkyvät osoitteessa `{apex}/events`.',
        'Jos haluat listata vain yhden tapahtuman, avaa sen **Settings** → **Viewers** → **List on Anvil**. Se näkyy, kun tapahtuma on tulossa tai käynnissä.',
        'Tapahtuma ilman päivämääriä näkyy kohdassa **Open to join** merkinnällä “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Tasot ja rajat',
      body: [
        'Tasosi määrää, kuinka monta pelaajaa tapahtumissasi voi olla yhtä aikaa. Tapahtumat, joiden päivämäärät menevät päällekkäin, jakavat tämän luvun; eri päiville osuvat tapahtumat saavat sen kukin erikseen. Pelaaja, joka on kahdessa päällekkäisessä tapahtumassa, lasketaan kahdesti. Kaikki muu on sama kaikilla tasoilla: taulu, pluginin seuranta, overlay ja Discord.',
        'Tasokorttisi on kohdassa **Your events**. Vertaa tasoja [hinnoittelusta](/pricing#creators). Maksun muuttamiseen tai peruuttamiseen mene [laskutussivullesi](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Enintään 50 pelaajaa yhtä aikaa kaikissa tapahtumissasi. Yksi tapahtuma kerrallaan. Discord-roolin ja boostaajan tarkistukset.' },
        { term: 'Bronze', body: 'Enintään 150 pelaajaa yhtä aikaa kaikissa tapahtumissasi. Twitch-, Kick- ja YouTube-tarkistukset.' },
        { term: 'Silver', body: 'Enintään 300 pelaajaa yhtä aikaa kaikissa tapahtumissasi. Useampi tapahtuma kerrallaan. `!join` chatissa. Näkyy listassa ensimmäisenä.' },
        { term: 'Gold', body: 'Enintään 1 000 pelaajaa yhtä aikaa kaikissa tapahtumissasi. Piilota Anvil-merkki overlaystasi.' },
        { term: 'Partner', body: 'Ei pelaajarajaa. Sovitaan suoraan Anvilin kanssa — ota yhteyttä.' },
      ],
      note: {
        tag: 'Juuri nyt',
        body: 'Kaikki pääsevät vielä sisään Anvilin kasvaessa, myös tasosi lukujen yli. Rajat alkavat myöhemmin, ennakkoilmoituksella. Tasokorttisi näyttää kuinka lähellä olet.',
      },
    },

    faq: {
      title: 'Kysymyksiä',
      intro: 'Striimaajien useimmin kysymät:',
      rows: [
        {
          term: 'Tarvitsevatko katsojani klaanin?',
          body: 'Eivät. He tarvitsevat Discord-tilin ja OSRS-hahmon. Lähetä heille [katsojan opas]({joiningGuide}).',
        },
        {
          term: 'Tarvitsevatko he RuneLite-pluginin?',
          body: 'Dropeihin ja tappoihin kyllä. Plugin lähettää ne itse. Muutama ruutu lukee sen sijaan hiscoret.',
        },
        {
          term: 'Katsoja sanoo “The host’s Twitch connection isn’t working”.',
          body: 'Twitch lakkasi hyväksymästä yhteyttäsi. Avaa **Settings** ja paina **Reconnect Twitch**. Sama pätee Kickiin ja YouTubeen.',
        },
        {
          term: 'Voiko joku muu auttaa pyörittämisessä?',
          body: 'Voi. Avaa **Players** → **Staff & roles**, lisää heidät ja valitse, mitä kukin saa tehdä.',
        },
        {
          term: 'Pyöritän myös klaania pelissä.',
          body: 'Silloin et ehkä tarvitse tilaa. Julkinen klaani voi laittaa **Streaming** päälle. Katso [striimaus klaaneille]({streamingGuide}).',
        },
        {
          term: 'Voinko tehdä toisen tilan?',
          body: 'Toistaiseksi yksi tila per Discord-tili. Ota yhteyttä, jos tarvitset toisen.',
        },
        {
          term: 'Missä tilani asetukset ovat?',
          body: 'Paina valikosta **Settings**. Tapahtuman sisältä paina tapahtuman valikosta **Space settings**.',
        },
        {
          term: 'Mitä sivuni **Report**-painike tekee?',
          body: 'Kuka tahansa kirjautunut voi ilmoittaa sivustasi, paneelista, tapahtumasta tai kohokohdasta Anvilin henkilökunnalle. Ilmoitukset menevät vain henkilökunnalle. Jos henkilökunta piilottaa biosi, paneelisi, aikataulusi tai featured-klippisi, asetuksesi kertovat sen.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — katsojalle, joka klikkasi striimaajan linkkiä.
  joiningStream: {
    metaTitle: 'Striimaajan OSRS-bingoon liittyminen — Anvil',
    metaDescription:
      'Sait linkin striimaajalta? Kirjaudu Discordilla, lisää OSRS-hahmosi ja paina Join. Mitä tehdä Twitchin, Kickin tai YouTuben seuraaja- tai tilaajatapahtumissa ja miten dropisi lasketaan.',
    eyebrow: 'Katsojille',
    title: 'Striimaajan tapahtumaan liittyminen',
    dek: 'Striimaaja jakoi linkin. Näin pääset taululle. Klaania ei tarvita.',
    facts: [
      { strong: '~2 min', rest: 'liittyä' },
      { strong: 'Ei klaania', rest: 'tarvita' },
    ],

    join: {
      title: 'Liity neljässä vaiheessa',
      body: [
        '**Avaa linkki**, jonka striimaaja jakoi. Tai kirjoita hänen chattiinsa `!join`, niin botti postaa sen.',
        '**Kirjaudu Discordilla.** Se on Anvil-tilisi. Mitään ei tarvitse täyttää.',
        '**Lisää hahmosi.** Paina **Add my character** ja kirjoita RuneScape-nimesi. Jos näkyy **Prove it’s mine**, seuraa profiilisi ohjeita. [Pluginin opas]({pluginGuide}) näyttää miten.',
        '**Paina Join.** Valitse hahmosi, jos niitä on useampi. Näet **You’re in!**, kun onnistui.',
      ],
    },

    gated: {
      title: 'Seuraajille tai tilaajille tarkoitetut tapahtumat',
      body: [
        'Jotkin tapahtumat ovat vain striimaajan yhteisölle. Liittymiskortti kertoo kenelle, esimerkiksi “Open to followers of somename on Twitch”.',
        'Paina silti **Join**. Jos et vielä pääse sisään, kortti listaa mitä tehdä. Tee jokin niistä ja paina sitten **Join** uudelleen.',
      ],
      intro: 'Mitä tehdä kussakin tapauksessa:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Paina **Link Twitch** ja kirjaudu Twitchillä. Anvil ei pyydä mitään oikeuksia. Paina sitten **Join** uudelleen.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Paina **Get Kick code**. Kirjoita koodi (esim. `ANVIL-7F3K9Q`) striimaajan Kick-chattiin 10 minuutin sisällä. Jokainen koodi toimii kerran. Paina sitten **Join** uudelleen.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Paina **Check my YouTube subscription** ja kirjaudu Googlella. Valitse tili, jolla katsot. Tilauksesi pitää olla julkisia YouTuben yksityisyysasetuksissa.',
        },
        {
          term: 'YouTube member',
          body: 'Paina **Link my YouTube account**, kirjoita sitten koodisi YouTube-livechattiin ja paina **check the chat**. Tämä toimii vain, kun striimaaja on livenä.',
        },
        {
          term: 'Discord role or booster',
          body: 'Liity striimaajan Discord-palvelimelle ja hanki rooli (tai boostaa sitä). Anvil tarkistaa Discord-tililtä, jolla kirjauduit.',
        },
      ],
      note: {
        tag: 'Hyväksyntä',
        body: 'Jotkin striimaajat hyväksyvät jokaisen pelaajan erikseen. Silloin painikkeessa lukee **Ask to join**, ja näet **Waiting for the host**, kunnes he vastaavat.',
      },
    },

    plugin: {
      title: 'Asenna Anvil-plugin',
      body: [
        'Dropisi ja tapposi lasketaan RuneLiten Anvil-pluginilla. Asenna se Plugin Hubista ja kirjaudu Discordilla sen sivupaneelista.',
        '[Pluginin opas]({pluginGuide}) opastaa sen noin kolmessa minuutissa.',
      ],
    },

    play: {
      title: 'Pelaa',
      body: [
        'Siinä kaikki. Pelaa normaalisti. Kun saat dropin tai tapon, jota taulu tarvitsee, plugin lähettää sen itse.',
        'Avaa tapahtumalinkki milloin tahansa nähdäksesi taulun ja tilanteen. Pelaat vain tätä yhtä tapahtumaa: et liity klaaniin.',
      ],
    },

    accounts: {
      title: 'Yhdistetyt tilisi',
      body: [
        'Yhdistämäsi Twitch-, YouTube- ja Kick-tilit löytyvät kohdasta [Settings → Connected accounts](/settings/connections). Voit yhdistää ne siellä myös ennen liittymistä.',
        'Voit poistaa yhteyden milloin tahansa. Tapahtumat, joihin jo liityit, pitävät sinut mukana. Myöhemmin liittyessäsi rajattuun tapahtumaan sinua pyydetään yhdistämään uudelleen.',
        'Yhdistetyt Twitch-, YouTube- ja Kick-tilit näkyvät profiilissasi vahvistusmerkillä: todistit, että ne ovat sinun. Piilota tili laittamalla **Show on my profile** pois päältä. Medal-linkki on eri asia. Liität sen itse, joten siinä ei ole merkkiä.',
        'Striimaatko itse Twitchissä? Laita Twitch-tilisi alla päälle **Clip my stream when I hit a big moment**. Kun olet livenä striimaajan tapahtumassa, Anvil klippaa harvinaiset droppisi, pettisi ja valmiit ruutusi.',
      ],
    },

    faq: {
      title: 'Kysymyksiä',
      intro: 'Kun jokin sanoo ei:',
      rows: [
        {
          term: '“This event is full”',
          body: 'Lisäpelaajille ei ole tilaa. Vain striimaaja voi tehdä tilaa — kerro hänelle.',
        },
        {
          term: 'Olen tilaaja, mutta en pääse sisään.',
          body: 'Tarkista, että yhdistit saman tilin, jolla tilaat. Twitchissä katso liittymiskortin kohtaa **Your Twitch**. Kickissä kirjoita uusi koodi heidän chattiinsa: Anvil lukee tilaajamerkin siitä viestistä. YouTubessa tee tilauksistasi julkisia ja tarkista uudelleen.',
        },
        {
          term: 'Seurasin Kickissä, mutta se sanoo etten seurannut.',
          body: 'Anvil näkee vain seuraamiset, jotka on tehty sen jälkeen kun striimaaja yhdisti Kickin. Lopeta seuraaminen ja seuraa uudelleen, paina sitten **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Yksi Twitch-tili (tai Kick tai YouTube) tuo sisään yhden pelaajan. Joku muu on jo liittynyt sillä.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitchillä, Kickillä, YouTubella tai Discordilla oli hetken häiriö. Odota minuutti ja paina **Join** uudelleen.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'Tämä on striimaajan asia. Pyydä häntä yhdistämään kanavansa uudelleen Anvilissa.',
        },
        {
          term: 'Dropejani ei näy.',
          body: 'Tarkista, että plugin on asennettu ja kirjautunut sisään ja että liityit hahmolla, jolla pelaat. Katso [pluginin opas]({pluginGuide}).',
        },
        {
          term: 'Mistä löydän lisää tällaisia tapahtumia?',
          body: '[Tapahtumasivu](/events) listaa tapahtumat, joihin kuka tahansa voi liittyä, myös striimaajien juuri nyt avoimet tapahtumat.',
        },
        {
          term: 'Jokin striimaajan sivulla rikkoo sääntöjä.',
          body: 'Paina **Report** sivulla, tapahtumassa tai kohokohdassa. Valitse, mikä on vialla, ja paina **Send**. Se menee vain Anvilin henkilökunnalle. Striimaajalle ei koskaan kerrota, kuka ilmoitti.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — julkinen klaani laittaa Streamingin päälle.
  streamingClans: {
    metaTitle: 'Klaanisi tapahtumien striimaus — Anvil',
    metaDescription:
      'Anna striimisi katsojien liittyä yhteen klaanisi OSRS-tapahtumaan liittymättä klaaniin: laita Streaming päälle, avaa tapahtuma katsojille ja valitse, mitkä katsojat pääsevät sisään.',
    eyebrow: 'Striimaaville klaaneille',
    title: 'Striimaus klaaneille',
    dek: 'Striimaako klaanisi tapahtumiaan? Anna katsojien pelata yhtä tapahtumaa liittymättä klaaniisi.',

    on: {
      title: 'Laita Streaming päälle',
      body: [
        'Mene kohtaan Admin → **Clan settings** → **Profile** ja laita **Streaming** päälle.',
        'Vain julkinen klaani voi striimata. Katsojien pitää voida avata tapahtumasivusi, ja yksityinen klaani piilottaa sen heiltä. Klaanista, jolla Streaming on päällä, ei voi tehdä yksityistä ennen kuin laitat sen pois.',
        'Kun se on päällä, yhdistä Twitch-, YouTube- tai Kick-kanavasi heti sen alla.',
      ],
    },

    event: {
      title: 'Avaa tapahtuma katsojille',
      body: [
        'Jokainen tapahtuma pysyy tilassa **Members only**, kunnes toisin sanot. Niin se toimi ennenkin.',
        'Avaa tapahtuman **Settings** → **Entry & co-hosts** → **Who can join?** ja valitse **Members and viewers**. Valitse sitten **Which viewers?**: kuka tahansa tai seuraajat, tilaajat, Discord-rooli ja niin edelleen. Paina **Save**.',
        'Nämä tarkistukset koskevat vain katsojia. Klaanisi jäsenet pääsevät aina sisään, kuten ennenkin.',
      ],
    },

    viewers: {
      title: 'Mitä katsojat ovat',
      body: [
        'Katsoja, joka liittyy, on **event player**. Hän pelaa vain sen yhden tapahtuman.',
        'He eivät ole klaanijäseniä eivätkä vieraita. He eivät koskaan päädy klaanilistallesi, eikä heille anneta arvoa.',
        'Kaikki näin liittyneet näet kohdasta **People** → **Past viewers**.',
        'Vakituinen, jonka haluat pitää? **Make guest** hänen rivillään tekee hänestä klaanivieraan, joka voi liittyä mihin tahansa vieraille avoimeen tapahtumaasi, ei vain tähän. **Make a guest a viewer again** muuttaa vieraan takaisin yhden tapahtuman katsojaksi.',
      ],
    },

    tools: {
      title: 'Striimityökalusi',
      body: [
        'Striimaajan työkalut toimivat kuten creator-tilassa: vahvistetut kanavalinkit, **Who can join?** -tarkistukset, OBS-overlay ja `!join` chatissa.',
        'Klaanitapahtuman overlay-linkit ovat tapahtuman kohdassa **Settings** → **Stream** → **Stream overlay**. `!join` ja overlay-merkki ovat kohdassa **Clan settings** → **Profile** → **Streaming**.',
        '[Creator-opas]({creatorsGuide}) selittää jokaisen vaihe vaiheelta.',
        'Striimin kohokohdat toimivat täälläkin: kun Twitch tai YouTube on yhdistetty, Anvil klippaa katsojille avoimien tapahtumien isot hetket. `!join` Kick-chatissa on omalla kytkimellään **Kick channel** -laatikossa.',
      ],
    },

    faq: {
      title: 'Kysymyksiä',
      intro: 'Lyhyet vastaukset:',
      rows: [
        {
          term: 'Lasketaanko katsojat jäsenrajaamme?',
          body: 'Ei. He ovat tapahtumapelaajia, eivät jäseniä. Striimaajan rajat laskevat pelaajat yhtä aikaa kaikissa tapahtumissa, joita järjestät (katso [creator-opas]({creatorsGuide})).',
        },
        {
          term: 'Ohjaako `!join` ihmisiä vain jäsenille tarkoitettuun tapahtumaan?',
          body: 'Ei. Se osoittaa vain tapahtumaan, joka on avoin katsojille.',
        },
        {
          term: 'Pitäisikö minun tehdä sen sijaan creator-tila?',
          body: 'Vain jos sinulla ei ole klaania. Tila on striimaajille, joilla ei ole klaania pelissä.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Väkesi: jäsenlista, vieraat ja kuka saa liittyä — Anvil',
    metaDescription:
      'Mistä Anvil-klaanin jäsenlista tulee, mitä Members, Guests, Roster only, Departed ja Quiet tarkoittavat, miten liittymispyynnöt ja Needs review toimivat, Who can join -kohdan kolme asetusta sekä jonkun poistaminen tai porttikielto.',
    eyebrow: 'Anvil · klaanin henkilökunnalle',
    title: 'Väkesi: jäsenlista, vieraat ja kuka saa liittyä',
    dek: 'Jokainen kohdassa Admin → **People** on päätynyt sinne yhtä neljästä reitistä: pelin klaanilista nimesi hänet, henkilökunta hyväksyi hänet, klaani päästää kaikki sisään, tai joku lisäsi hänet käsin. Tässä kerrotaan, miten kukin reitti toimii, mitä Roster-välilehti kertoo, ja mitä tarkistaa, kun joku on väärässä paikassa.',
    facts: [
      { strong: 'Pelin jäsenlista', rest: 'ainoa automaattinen tapa tulla jäseneksi' },
      { strong: 'Kirjautuminen', rest: 'ei koskaan lisää ketään jäsenlistalle' },
      { strong: 'Kaksi jonoa', rest: 'kahdella eri välilehdellä' },
    ],
    footnote:
      'Kaikki tässä löytyy kohdasta Admin → **People**. Roster ja Needs review ovat moderaattorin työtä. **Who can join** ja **Staff & roles** ovat vain ylläpitäjille näkyviä välilehtiä. Kuka saa tehdä mitä koko hallintapaneelissa, katso [Henkilökunnan roolit: kuka saa tehdä mitä]({staffGuide}).',

    roster: {
      title: 'Mistä jäsenlista tulee',
      body: [
        'Jäsenlista on pelin klaanilistanne kopioituna sivustolle. Ylläpitäjä lähettää sen RuneLitestä Anvil-pluginilla: paina **Anvil**-painiketta klaani-ikkunan otsikkopalkissa tai **Sync roster** pluginin sivupaneelissa. Kaikki listalla olevat tulevat **jäseninä**, pelin arvonimensä kanssa. Vain se, jolla on sivustolla Admin-rooli, voi lähettää sen. Muille kerrotaan tästä pelissä.',
        'Synkronointi on ainoa asia, joka tekee jostakusta jäsenen itsestään. Kun joku lähtee klaanista pelissä, seuraava synkronointi merkitsee hänet lähteneeksi, ja kun joku palaa, hän tulee takaisin sitä seuraavassa synkronoinnissa. Hänen historiansa säilyy kummassakin tapauksessa.',
        'Kaikki muut paikat ovat **vieras**paikkoja: joku, joka pelaa tapahtumissanne olematta pelin klaanissanne. Vieraita seurataan ja he voivat osallistua tapahtumiin. He eivät ole jäseniä, eivätkä he kuluta tilauksenne jäsenpaikkoja.',
      ],
      note: {
        tag: 'Kirjautuminen ei koskaan lisää ketään jäsenlistalle',
        body: 'Discordilla kirjautuminen, hahmon yhdistäminen tai pluginilla pelaaminen ei anna kenellekään paikkaa. Jos plugin näkee jonkun, jonka pelin klaani on teidän mutta joka ei ole vielä jäsenlistalla, se pyytää häntä (katso vaihe 3). Muilla on vain Anvil-tili ilman klaania. Juuri tämä estää vierasta ihmistä liittymästä klaaniinne kirjoittamalla sen nimen.',
      },
    },

    filters: {
      title: 'Roster-välilehden lukeminen',
      intro:
        'Yläreunan palkki jakaa jäsenlistan osiin **Members**, **Guests** ja **Departed**. Napsauta osaa suodattaaksesi sen mukaan. Sen alla olevat sirut rajaavat listaa lisää:',
      rows: [
        {
          term: 'Active',
          body: 'jäsenet, jotka ovat yhä jäsenlistalla. Vieraat ja lähteneet jäävät pois.',
        },
        {
          term: 'Quiet 7d+',
          body: 'jäsenet, joita plugin ei ole nähnyt pelaavan seitsemään päivään tai pidempään. Joku, joka ei ole koskaan käyttänyt pluginia, ei ole tässä, koska häntä ei voi arvioida millään. Hänen kohdallaan **Last played** näyttää sen sijaan **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'nykyiset vieraspaikat: ihmiset, jotka pelaavat tapahtumissanne mutta eivät ole pelin klaanissanne.',
        },
        {
          term: 'Roster only',
          body: 'nykyiset jäsenet ja vieraat, joiden takana ei vielä ole sivustotiliä. Tavallista kaikille, jotka eivät ole koskaan kirjautuneet Discordilla. He pysyvät jäsenlistalla; he kirjautuvat ja yhdistävät hahmon, kun haluavat ilmoittautua johonkin.',
        },
        {
          term: 'Departed',
          body: 'ihmiset, jotka lähtivät pelissä tai jotka henkilökunta poisti. Heidän tuloksensa ja historiansa säilyvät.',
        },
        {
          term: 'All',
          body: 'kaikki yllä olevat.',
        },
      ],
      outro:
        'Sarake **Source** kertoo, miten kukin paikka sai alkunsa: **Clan sync**, **Added manually** tai **Applied or self-reported**. **Last played** tulee pluginilta, ei jäsenlistan synkronoinnista.',
      note: {
        tag: 'Arvonimi ja rooli ovat eri asioita',
        body: 'Sirujen vieressä olevat kaksi pudotusvalikkoa suodattavat pelin arvonimen ja sivuston roolin mukaan. Arvonimi on se, minkä peli ilmoittaa. Sivuston roolin asettaa ylläpitäjä kohdassa **Staff & roles**. Kumpikaan ei koskaan aseta toista.',
      },
    },

    review: {
      title: 'Liittymispyynnöt ja Needs review',
      intro: 'Kahdenlaiset ihmiset odottavat myöntävää vastausta, ja he odottavat eri välilehdillä.',
      rows: [
        {
          term: 'Asking to join',
          body: '**Roster**-välilehden yläosassa, näkyvissä vain silloin kun joku odottaa. Pyyntö tulee sivustolta (hän painoi **Apply** klaaninne sivulla tai yritti osallistua johonkin tapahtumaanne) tai pluginilta (se näki hänen pelaavan pelin klaanissanne ennen kuin hän oli jäsenlistalla). Jokainen rivi kertoo kummasta, ja onko hän jonkin toisen klaanin jäsen. **Approve** antaa hänelle vieraspaikan. **Decline** kertoo sen hänelle Discordin yksityisviestillä, jos bottinne tavoittaa hänet. Valitse useampi vastataksesi niihin kerralla.',
        },
        {
          term: 'Awaiting confirmation',
          body: 'kohdassa **Needs review**. Ihmiset, jotka yhdistivät jonkin jäsenlistanne hahmon keräämällä sillä XP:tä, pyytämällä tai pelaamalla sillä pluginin kanssa. He voivat jo pelata odottaessaan. Tarkista, että Discord-nimi sopii hahmoon, ja paina sitten **Approve**. **Not our member** poistaa hahmon listaltanne ja jättää sen omistajalleen. **Report to Anvil** on hahmolle, joka ei ole hänen.',
        },
        {
          term: 'Claim requests',
          body: 'myös kohdassa **Needs review**. Joku pelasi hahmolla, joka on täällä jo vakiintunut jäsen, joten Anvil ei yhdistä sitä häneen itsestään. Jos tiedät, että se on hän, paina **Yes, that’s them**; jos ei, **Not them**. Hahmo, joka on koskaan ollut vain teidän klaanissanne, yhdistetään heti. Hahmo, joka on myös toisessa klaanissa, menee Anvilin ratkaistavaksi.',
        },
      ],
      note: {
        tag: 'Merkki ei laske liittymispyyntöjä',
        body: 'Luku kohdassa **Needs review** ja sivupalkin kohdassa **People** laskee Awaiting confirmation- ja Claim requests -rivit. Liittymispyynnöt eivät ole mukana, joten katso myös Roster-välilehden yläosa.',
      },
    },

    policy: {
      title: 'Kuka saa liittyä',
      intro:
        'Kohdassa Admin → People → **Who can join** on kolme asetusta, ja vain ylläpitäjät näkevät välilehden. Ulkopuolisten pääsyn ratkaisee **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'oletus. Hakija, tai joku jonka plugin poimii pelin klaanistanne, odottaa liittymispyyntönä, kunnes henkilökunta hyväksyy hänet. Ilman myöntävää vastausta kukaan ei saa paikkaa.',
        },
        {
          term: 'Let anyone in',
          body: 'pyytäminen riittää. Hän saa heti vieraspaikan, eikä pyyntöä kirjata. Hyvä avoimeen tapahtumaan, muuten meluisa.',
        },
        {
          term: 'No guests',
          body: 'vain omat jäsenenne pelaavat. Muiden klaanien pelaajat eivät voi osallistua tapahtumiinne tai pyytää liittymistä, eikä plugin kirjaa heistä mitään.',
        },
      ],
      outro:
        '**Who can see this clan** on joko **Anyone** (taulun linkki toimii kenelle tahansa, jolle sen lähetät) tai **Members only** (muut näkevät klaanin kortin ja kutsun hakea). **List in the Clan Hall** lisää klaanin julkiseen klaanilistaan. Sen poistaminen käytöstä ei tee klaanista yksityistä.',
      note: {
        tag: 'Mikään näistä ei koske jäseniänne',
        body: 'Jäsenlistan synkronointi antaa jäsenille paikan, sanoivat nämä mitä tahansa. Omaa henkilökuntaanne ei myöskään koskaan kohdella vieraina: henkilökunnan jäsenen hahmo saa jäsenpaikan ilman pyyntöä.',
      },
    },

    manual: {
      title: 'Jonkun lisääminen käsin',
      body: [
        'Roster → **+ Add Manually** lisää yhden hahmon jäsenlistalle. Täytä **RSN**, ja halutessasi **Discord ID** ja **Rank**. Valitse **Add as guest** jollekulle, joka ei ole pelin klaanissanne. Sekä moderaattorit että ylläpitäjät voivat tehdä tämän.',
        'Käytä sitä jollekulle, jota synkronointi ei vielä näe, kuten tulokkaalle, joka liittyi viimeisimmän synkronoinnin jälkeen. Paikka merkitään **Added manually**, ja synkronointi pitää sitä sinun päätöksenäsi: jos myöhemmin poistat käsin lisäämäsi paikan, seuraava synkronointi ei tuo sitä takaisin.',
        'Jäsenlistalle lisääminen ei ilmoita ketään tapahtumaan. Sitä varten avaa tapahtuman **Sign-ups**-välilehti ja käytä painiketta **Add member**. Se on vain ylläpitäjille.',
      ],
    },

    removing: {
      title: 'Poistaminen ja porttikielto',
      intro: 'Jokaisella jäsenlistan rivillä on toimintovalikko. Nämä tekevät eri asioita:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'hän pysyy listalla ja hänet voi yhä ilmoittaa tapahtumiin, mutta häntä ei enää lasketa jäseneksi. **Promote to member** kumoaa sen.',
        },
        {
          term: 'Remove from roster',
          body: 'merkitsee hänet lähteneeksi. Hänen historiansa ja tuloksensa säilyvät. Jos hän on yhä pelin klaanissanne, seuraava synkronointi voi lisätä hänet takaisin.',
        },
        {
          term: 'Not our member',
          body: 'kohdassa Needs review, yhdistetylle hahmolle, joka ei ole klaanissanne. Se poistuu listaltanne ja jää omistajalleen.',
        },
        {
          term: 'Ban from this clan',
          body: 'päättää kaikki henkilön paikat täällä, myös alt-hahmot, poistaa hänen mahdollisen henkilökunnan roolinsa ja taulutehtävänsä tässä klaanissa ja estää häntä palaamasta: jäsenlistan synkronointi, plugin ja liittymispyynnöt hylkäävät hänet kaikki, kunnes porttikielto poistetaan. Hänen Anvil-tiliinsä ja muihin klaaneihinsa ei kosketa. Vain ylläpitäjät, henkilölle jolla on sivustotili ja ylläpitäjää alempi rooli, rivin valikosta, kohdasta **Staff & roles** tai useammalle ihmiselle kerralla. Porttikiellon poistaminen ei palauta häntä; hän liittyy uudelleen pelissä, tai sinä lisäät hänet.',
        },
      ],
      note: {
        tag: 'Porttikielto poistaa myös henkilökunnan roolin',
        body: 'Porttikielto päättää henkilön paikat ja vie häneltä henkilökunnan roolin sekä mahdolliset taulun muokkaajan tai taulun rahastonhoitajan tehtävät tämän klaanin tauluilla. Porttikiellon poistaminen ei palauta niitä: aseta rooli uudelleen kohdassa Staff & roles, jos hänellä kuuluu olla se.',
      },
    },

    faq: {
      title: 'Yleisiä kysymyksiä',
      intro: 'Mikä yleensä selittää, miksi joku on väärässä paikassa.',
      rows: [
        {
          term: 'Joku klaanista puuttuu',
          body: 'Aja ensin jäsenlistan synkronointi: lista muuttuu vain, kun ylläpitäjä lähettää sen. Tarkista sitten **Departed** siltä varalta, että hänet on poistettu, ja onko hänellä porttikielto; synkronointi ohittaa kaikki, joilla on täällä porttikielto, ja kertoo, kenet se ohitti. Jos klaani on yli tilauksensa ja armonaika on päättynyt, synkronointi lakkaa lisäämästä uusia jäseniä, kunnes päivität tilauksen tai karsit jäsenlistaa.',
        },
        {
          term: 'Joku näkyy vieraana, vaikka on klaanissa',
          body: 'Yleensä hän on Anvilissa yhä toisen klaanin jäsen. Hahmo voi olla kerrallaan vain yhden klaanin jäsen, joten synkronointi antaa hänelle täällä vieraspaikan ja tekee hänestä jäsenen ensimmäisessä synkronoinnissa sen jälkeen, kun hän on lähtenyt toisesta klaanista. Muuten hän tuli liittymispyynnön kautta, tai joku alensi hänet tai lisäsi hänet vieraana. Aja synkronointi tai käytä **Promote to member**.',
        },
        {
          term: 'Joku kirjautui, mutta ei ole jäsenlistalla',
          body: 'Niin kuuluukin. Kirjautuminen luo Anvil-tilin, ei paikkaa. Hän ilmestyy, kun synkronointi listaa hänet, kun hyväksyt hänen pyyntönsä tai kun lisäät hänet käsin.',
        },
        {
          term: 'Nimiä kuten #Player1234',
          body: 'RuneLite näyttää tuollaisen paikkamerkin hetken, kun pelaaja kirjautuu sisään, sekä klaanin jäsenille, joita se ei osaa nimetä. Anvil ohittaa nyt tällaiset nimet: synkronointi ohittaa ne, plugin ei kirjaa niille pyyntöä, ja vanhat pyynnöt sellaisella nimellä on piilotettu. Jos jäsenlistallasi on vielä sellainen, se on vanha rivi. **Remove from roster** poistaa sen.',
        },
        {
          term: 'Poistettu jäsen tulee aina takaisin',
          body: 'Poistaminen ei muuta pelin klaania, joten seuraava synkronointi lisää hänet takaisin niin kauan kuin peli yhä listaa hänet. Poista hänet pelissä tai anna hänelle porttikielto täällä.',
        },
        {
          term: 'Moderaattori ei näe Who can join -välilehteä',
          body: 'Se on vain ylläpitäjille näkyvä välilehti, kuten Staff & roles. Katso [Henkilökunnan roolit: kuka saa tehdä mitä]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Henkilökunnan roolit: kuka saa tehdä mitä — Anvil',
    metaDescription:
      'Anvilin klaaniroolit (omistaja, ylläpitäjä, rahastonhoitaja, moderaattori, jäsen), mihin kukin pääsee, miten jostakusta tehdään moderaattori, kuka voi antaa minkäkin roolin, ja yhtä tapahtumaa koskevat tehtävät.',
    eyebrow: 'Anvil · omistajille ja ylläpitäjille',
    title: 'Henkilökunnan roolit: kuka saa tehdä mitä',
    dek: 'Viisi roolia, jotka asetetaan klaanikohtaisesti kohdassa Admin → People → **Staff & roles**. Rooli täällä ei anna mitään missään muussa klaanissa, eikä kukaan voi antaa omaansa samanarvoista tai korkeampaa roolia. Tämä sivu on koko kartta: mihin kukin rooli pääsee, miten roolin antaa, ja yhtä tapahtumaa koskevat tehtävät.',
    facts: [
      { strong: 'Klaanikohtainen', rest: 'rooli täällä ei tarkoita mitään muualla' },
      { strong: 'Omaasi alempi', rest: 'on kaikki, mitä voit antaa' },
      { strong: 'Omistajuus', rest: 'siirtyy vain luovuttamalla' },
    ],
    footnote:
      'Roolit tarkistetaan uudelleen jokaisella sivun latauksella, joten muutos tulee voimaan henkilön seuraavalla klikkauksella; hänen ei tarvitse kirjautua ulos. Itse jäsenlistasta katso [Väkesi]({peopleGuide}). Moderaattorin päivästä katso [Vuorossa]({moderatorGuide}).',

    roles: {
      title: 'Roolit',
      intro: 'Jokainen Discordilla kirjautuva aloittaa tavallisena **Member**-käyttäjänä. Sen yläpuolella:',
      rows: [
        {
          term: 'Omistaja',
          body: 'henkilö, joka loi klaanin, kunnes hän luovuttaa sen eteenpäin. Kaikki, mitä ylläpitäjä voi, sekä omistajuuden siirtäminen ja klaanin poistaminen. Omistajia on tasan yksi, eikä kukaan voi alentaa, poistaa tai antaa hänelle porttikieltoa.',
        },
        {
          term: 'Ylläpitäjä',
          body: 'kaikki paitsi klaanin luovuttaminen: tapahtumat ja taulut, asetukset, Discord, henkilökunta ja klaanin rahat.',
        },
        {
          term: 'Rahastonhoitaja',
          body: 'maksut, kassa ja palkinnot, kaiken sen lisäksi mitä moderaattori tekee: jäsenlista, todisteet, kilpailut, Schedule ja Needs review.',
        },
        {
          term: 'Moderaattori',
          body: 'tulokkaat, jäsenlista, todisteet, viikkokilpailut ja klaanin tapahtumat. Ei tapahtumia tai tauluja, ei asetuksia, ei henkilökuntaa eikä rahaa.',
        },
        {
          term: 'Jäsen',
          body: 'ei henkilökunnan tehtävää. Pelaa, ilmoittautuu ja voi ilmoittaa lahjoituksen kassaan.',
        },
      ],
      outro:
        'Staff & roles -kohdassa roolin alla on kaksi valintaruutua kaikille ylläpitäjää alemmille, myös tavallisille jäsenille. **Can build bingo boards** avaa jokaisen taulun Tiles-välilehden ja Task libraryn. **Can write guides** antaa kirjoittaa klaanin oppaita. Ylläpitäjillä on jo molemmat.',
    },

    assign: {
      title: 'Jonkun tekeminen moderaattoriksi',
      intro:
        'Hänen täytyy olla kirjautunut Discordilla ja yhdistänyt hahmon, joka on jäsenlistallanne jäsenenä tai vieraana. Sitten:',
      steps: [
        'Avaa Admin → **People** → **Staff & roles**.',
        'Lista avautuu kohtaan **Staff**. Vaihda kohtaan **Members** tai **All accounts** ja hae hänen nimellään.',
        'Valitse sarakkeesta **Role** vaihtoehto **Moderator: newcomers, roster, sign-ups, proofs**. Se tallentuu heti, kun valitset sen.',
        'Jos hänen pitää myös rakentaa tauluja, valitse **Can build bingo boards**.',
      ],
      outro:
        'Eikö hän ole vielä kirjautunut? Etsi hänen hahmonsa **Roster**-välilehdeltä, avaa sen valikko ja valitse **Set role**. Se tallentaa roolin hahmolle. Hän saa sen, kun hän kirjautuu ensimmäisen kerran ja yhdistää hahmon, tai, jos hän odottaa kohdassa Needs review, kun moderaattori hyväksyy hänet.',
      note: {
        tag: 'Roolin poistaminen',
        body: 'Aseta rooliksi taas **Member**. Roolin muuttaminen poistaa myös kaikki taulutehtävät, joita hänellä oli tämän klaanin tauluilla (katso vaihe 5), joten lisää ne sen jälkeen uudelleen, jos hänen pitää säilyttää ne.',
      },
    },

    who: {
      title: 'Kuka voi antaa mitä',
      intro:
        'Staff & roles on vain ylläpitäjille näkyvä välilehti, ja jokainen siellä tehty muutos tarkistetaan kahta sääntöä vasten: voit antaa vain omaasi alemman roolin, ja voit muuttaa vain jonkun, jonka rooli on omaasi alempi.',
      rows: [
        {
          term: 'Omistaja',
          body: 'voi antaa tai poistaa ylläpitäjän, rahastonhoitajan ja moderaattorin roolin.',
        },
        {
          term: 'Ylläpitäjä',
          body: 'voi antaa tai poistaa rahastonhoitajan ja moderaattorin roolin. Ylläpitäjä ei voi tehdä toisesta ylläpitäjää, muuttaa toista ylläpitäjää eikä muuttaa omaa rooliaan.',
        },
        {
          term: 'Rahastonhoitajat ja moderaattorit',
          body: 'eivät voi muuttaa kenenkään roolia. Välilehti on heiltä piilossa.',
        },
        {
          term: 'Kukaan',
          body: 'ei voi muuttaa omistajan roolia, poistaa häntä tai antaa hänelle porttikieltoa. Klaanissa on myös aina vähintään yksi ylläpitäjä: viimeistä ei voi alentaa.',
        },
      ],
      note: {
        tag: 'Klaanin luovuttaminen',
        body: 'Vain omistaja voi, ja vain jollekulle, joka on jo ylläpitäjä: sen ylläpitäjän riville tulee toiminto **Make owner**. Turvallisuuden vuoksi siirto kestää 3 päivää, kuin pankin PIN-koodin vaihto: jokaisen ylläpitosivun banneri kertoo, milloin se tapahtuu, siihen asti voit perua painamalla **Cancel**, hän voi kieltäytyä painamalla **Decline**, ja Anvilin henkilökunta saa tiedon ja voi pysäyttää sen. Kun 3 päivää on kulunut, hänestä tulee omistaja ja sinusta tavallinen ylläpitäjä. Vain uusi omistaja voi siirtää sen takaisin.',
      },
    },

    table: {
      title: 'Kuka saa tehdä mitä',
      intro:
        'Mihin kukin rooli pääsee hallintapaneelissa. “Jos valittu” tarkoittaa Staff & roles -kohdan valintaruutua **Can build bingo boards** tai **Can write guides**.',
      areaLabel: 'Alue',
      columns: ['Omistaja', 'Ylläpitäjä', 'Rahastonhoitaja', 'Moderaattori', 'Jäsen'],
      rows: [
        { area: 'Dashboard', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Tapahtumat: luonti, muokkaus, joukkueet, ilmoittautumiset, käynnistys', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Taulun ruudut ja Task library', cells: ['Kyllä', 'Kyllä', 'Jos valittu', 'Jos valittu', 'Jos valittu'] },
        { area: 'Tarkistettavat todisteet', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Viikkokilpailut', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Klaanin tapahtumat', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Schedule', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Jäsenlista: katselu, lisäys, poisto', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Liittymispyynnöt ja Needs review', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Porttikielto klaanista', cells: ['Kyllä', 'Ylläpitäjää alemmille', 'Ei', 'Ei', 'Ei'] },
        { area: 'Staff & roles', cells: ['Kyllä', 'Ylläpitäjää alemmille', 'Ei', 'Ei', 'Ei'] },
        { area: 'Who can join', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Kassa ja palkintoportaat', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Ei', 'Ei'] },
        { area: 'Maksut: merkitse kerätyksi', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Ei', 'Ei'] },
        { area: 'Maksut: vahvista (toinen allekirjoitus)', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Discord-asetukset', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Julkaisu Discordiin', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Klaanin asetukset: Profile, Features, Rules & scoring, Boosts', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Tilaus ja laskutus', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Oppaat', cells: ['Kirjoitus', 'Kirjoitus', 'Luku; kirjoitus jos valittu', 'Luku; kirjoitus jos valittu', 'Kirjoitus jos valittu'] },
        { area: 'Toimintaloki', cells: ['Kyllä', 'Kyllä', 'Kyllä', 'Kyllä', 'Ei'] },
        { area: 'Jäsenlistan synkronointi RuneLitestä', cells: ['Kyllä', 'Kyllä', 'Ei', 'Ei', 'Ei'] },
        { area: 'Omistajuuden siirto, klaanin poisto', cells: ['Kyllä', 'Ei', 'Ei', 'Ei', 'Ei'] },
      ],
      note: {
        tag: 'Piilotettu ei tarkoita sallittua',
        body: 'Sivupalkki listaa vain sen, mitä roolisi voi käyttää, mutta ratkaiseva tarkistus tehdään palvelimella. Jos kirjoitat osoitteen sivulle, jota roolisi ei voi käyttää, sinut palautetaan dashboardille, ja sen takana oleva toiminto hylätään.',
      },
    },

    event: {
      title: 'Yhden tapahtuman tehtävät',
      intro:
        'Jotkin tehtävät koskevat yhtä tapahtumaa eivätkä koko klaania. Ylläpitäjä antaa ne itse tapahtumassa, ja ne ulottuvat siihen tapahtumaan eivätkä mihinkään muuhun, joten ne voi turvallisesti antaa tavalliselle jäsenelle.',
      rows: [
        {
          term: 'Taulun muokkaaja',
          body: 'rakentaa ja muokkaa sen taulun ruutuja. Annetaan tapahtuman kohdassa **Settings** → **Staff** → **Board staff**, tai henkilön toiminnoista **Boards…** Staff & roles -kohdassa. Jäsen, jolle se on annettu, näkee hallintapaneelissa vain omat taulunsa.',
        },
        {
          term: 'Taulun rahastonhoitaja',
          body: 'kerää sen taulun maksut ja hoitaa sen palkintojen maksun pääsemättä klaanin kassaan. Hallintapaneelissa hän näkee vain omat taulunsa, ja kustakin taulusta vain välilehdet **Sign-ups** ja **Prizes**. Annetaan myös kohdassa **Board staff**.',
        },
        {
          term: 'Team staff',
          body: 'hoitaa yhtä joukkuetta: sen kokoonpanoa, lähetyksiä ja todisteita sekä pelaajien maksujen merkitsemistä maksetuiksi. He eivät voi koskea toiseen joukkueeseen, muokata taulua, tehdä draft-valintoja tai vaihtaa ketään pois, kun tapahtuma on käynnissä. Lisätään joukkueen sivulla kohdassa **Team staff**. Näin vierailevan klaanin moderaattori hoitaa oman puoliskonsa klaani vastaan klaani -tapahtumasta.',
        },
        {
          term: 'Kapteeni',
          body: 'isännän nimeämä yhdelle joukkueelle. Kaikki, mitä team staff voi, sekä joukkueen draft-valinnat.',
        },
      ],
      note: {
        tag: 'Klaanirooli korvaa taulutehtävät',
        body: 'Klaaniroolin antaminen tai muuttaminen poistaa henkilön taulun muokkaajan ja taulun rahastonhoitajan tehtävät tämän klaanin tauluilla. Staff & roles varoittaa ensin, jos taulutehtävät ovat kaikki, mitä hänellä on. Lisää ne sen jälkeen uudelleen, jos hänen pitää säilyttää ne.',
      },
    },

    safety: {
      title: 'Turvallisuus',
      intro: 'Nämä pätevät, miten roolit sitten on asetettukin.',
      rows: [
        {
          term: 'Omistaja on suojattu',
          body: 'hänen rivillään Staff & roles -kohdassa lukee **Protected**. Hänen rooliaan ei voi muuttaa, eikä hänelle voi antaa porttikieltoa. Omistajuus siirtyy vain, kun hän luovuttaa sen.',
        },
        {
          term: 'Ylläpitäjät eivät voi poistaa toisiaan',
          body: 'ylläpitäjä ei voi alentaa toista ylläpitäjää eikä antaa tälle porttikieltoa, ei yksitellen eikä useita kerralla. Kun kaksi ylläpitäjää on eri mieltä, omistaja päättää. Porttikielto vie henkilöltä myös henkilökunnan roolin ja taulutehtävät tässä klaanissa.',
        },
        {
          term: 'Raha vaatii kaksi ihmistä',
          body: 'kun maksu pitää vahvistaa, vahvistuksen on tultava eri ylläpitäjältä kuin siltä, joka merkitsi sen kerätyksi. Montako vahvistusta maksu tarvitsee, nollasta viiteen, asetetaan kohdassa **Clan settings** → **Rules & scoring** → **Fee sign-off**. Ylläpitäjä, joka hoitaa rahaa yksin, voi silti pakottaa maksun suljetuksi erillisellä painikkeella.',
        },
        {
          term: 'Mitä moderaattori ei voi tehdä',
          body: 'luoda tai muokata tapahtumia, muuttaa asetuksia tai Discordia, antaa kenellekään roolia (ei itselleenkään) tai koskea klaanin rahoihin.',
        },
        {
          term: 'Kaikki kirjataan',
          body: 'roolimuutokset, omistajuuden siirrot, porttikiellot ja vastatut liittymispyynnöt kirjataan **Activity log** -lokiin, jota jokainen henkilökunnan jäsen voi lukea.',
        },
        {
          term: 'Discord-roolit ovat erillisiä',
          body: 'Anvilin roolisynkronointi yhdistää Discord-roolit **pelin arvonimiin**, ei sivuston rooleihin. Moderaattoriksi tekeminen täällä ei anna mitään Discord-palvelimellanne, ja Discordissa käsin antamaasi moderaattoriroolia ei kosketa. Ainoa bottikomento, joka muuttaa jotain, eli kassaan lisääminen komennolla `/coffer`, tarkistaa sivuston roolin: rahastonhoitaja, ylläpitäjä tai omistaja.',
        },
      ],
    },
    log: {
      title: 'Toimintaloki',
      body: [
        '**Activity log** ylläpitovalikossa listaa uusimmat 200 muutosta, ja jokainen henkilökunnan jäsen voi lukea sen: liittymiset, poistumiset, uudelleennimeämiset ja vahvistukset, omistajuuden siirrot, kapteenien lisäykset ja poistot, ilmoittautumiset hyväksytty tai hylätty, maksut vahvistettu, ominaisuudet kytketty ja asetukset muutettu. **Filter by event type** kaventaa sitä.',
        'Myös kaksoiskappaleet siivotaan täällä. **Merge two members** yhdistää kaksoiskappaleen oikeaan, ja **Suspected renames** listaa nimenvaihdot, jotka Anvil huomasi, vahvistettavaksi tai hylättäväksi.',
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter: tasot ja edut — Anvil',
    metaDescription:
      'Mitä Anvil Supporter, Champion ja Patron kukin saavat: nimen värit ja tähti, kultainen GZ, animoitu avatar ja banneri, vitriini, kaveritapahtumat, head-to-head, tapahtumachat ja klaanin boostit. Miten Gumroad-laskutus toimii ja mitä tapahtuu, kun perut.',
    eyebrow: 'Anvil · pelaajille',
    title: 'Anvil Supporter: tasot ja edut',
    dek: 'Anvil Supporter on henkilökohtainen tilaus, joka maksaa Anvilin palvelimet. Siinä on kolme tasoa, ja jokaisessa on kaikki, mitä sen alapuolisessa. Jokainen etu on ulkonäköä tai lisää tilaa järjestää: seuranta, tapahtumat, pisteytys ja omat tilastosi pysyvät ilmaisina kaikille, eikä mikään tässä muuta sitä, mitä tapahtuma laskee.',
    facts: [
      { strong: 'Alkaen $1 kuussa', rest: 'tai $10 vuodessa' },
      { strong: 'Vain ulkonäköä', rest: 'ei koskaan pisteitä, rankkia tai esinettä' },
      { strong: 'Mitään ei poisteta', rest: 'kun lopetat' },
    ],
    footnote:
      'Kaikki tässä asetetaan verkkosivulla kohdissa **Settings** → **Supporter**, **Profile look** ja **Clan boosts**. Boostit tarkemmin: [Klaanin boostaaminen]({boostsGuide}). Missä värisi näkyvät RuneLitessa: [Sivupaneeli välilehti kerrallaan]({panelGuide}).',

    tiers: {
      title: 'Kolme tasoa',
      intro: 'Hinnat ovat **Anvil Supporter** -sivulla, `/supporter`. Vuositilaus maksaa kymmenen kuukauden verran.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 kuussa tai $10 vuodessa. Kultainen nimi ja tähti, kultainen GZ, vitriini 4 paikalla, ja voit järjestää kaveritapahtuman.',
        },
        {
          term: 'Champion',
          body: '$2 kuussa tai $20 vuodessa. Nimen liukuväri valmiista vaihtoehdoistamme (tai yksi oma väri), oma avatar ja banneri (halutessasi animoituna), 8 vitriinipaikkaa, nopeampi tapahtumachat ja 1 klaaniboosti.',
        },
        {
          term: 'Patron',
          body: '$5 kuussa tai $50 vuodessa. Oma liikkuva liukuväri enintään 4 väristä, 12 vitriinipaikkaa, ei odotusta tapahtumachatissa, 2 kaveritapahtumaa kerralla ja 2 klaaniboostia.',
        },
      ],
      note: {
        tag: 'Aikaa kutsuista',
        body: 'Kohdasta Settings → Supporter saat kutsulinkin. Kun kutsumasi kaveri maksaa, ansaitset ilmaisia kuukausia; palkkio tulee kaksi viikkoa hänen ensimmäisen maksunsa jälkeen. Näin ansaittu aika antaa tasonsa kaikki edut paitsi klaanin boostit.',
      },
    },

    compare: {
      title: 'Mitä kukin taso saa',
      intro: 'Sama taulukko kuin Supporter-sivulla, sekä chat-edut.',
      table: {
        areaLabel: 'Etu',
        columns: ['Ilmainen', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Nimen värit', cells: ['—', 'Kulta', 'Valmisvärit tai yksi oma väri', 'Valmisvärit tai enintään neljä väriä, liikkuvat'] },
          { area: 'Tähti nimesi vieressä', cells: ['—', 'Kyllä', 'Kyllä', 'Kyllä'] },
          { area: 'Kultainen GZ', cells: ['—', 'Kyllä', 'Kyllä', 'Kyllä'] },
          { area: 'Oma avatar ja banneri, animoitu', cells: ['—', '—', 'Kyllä', 'Kyllä'] },
          { area: 'Vitriini', cells: ['—', '4 paikkaa', '8 paikkaa', '12 paikkaa'] },
          { area: 'Kaveritapahtumat (kerralla · pelaajia)', cells: ['Vain liittyminen', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Head-to-head-haasteet', cells: ['1 aktiivinen', '5 aktiivista', 'Rajaton', 'Rajaton'] },
          { area: 'Tapahtumachat: odotus rivien välillä', cells: ['5 s', '3 s', '1 s', 'Ei odotusta'] },
          { area: 'Klaanin boostit', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Kohdassa **Settings** → **In-game chat** on kolme lisää: omat värit chat-syötteellesi (Supporter), sen valitseminen, mitä kirjautumiskoosteesi kattaa (Champion), ja tähti nimesi vieressä muiden pelaajien chat-syötteissä (Patron).',
    },

    names: {
      title: 'Nimen värit',
      intro:
        'Aseta ne kohdassa **Settings** → **Supporter**, osiossa **Your name’s look**. Esikatselu näyttää nimesi tummalla ja vaalealla taustalla.',
      rows: [
        {
          term: 'Supporter',
          body: 'tasainen kulta. Valittavaa ei ole.',
        },
        {
          term: 'Champion',
          body: 'jokin valmiista liukuväreistä (**Classic**, oletus, **Ember**, **Ocean**, **Aurora**, **Rose gold** tai **Toxic**) tai **Your own**: yksi kiinteä väri. Kaikilla hahmoillasi yhteensä voit käyttää enintään kahta eri omaa väriä.',
        },
        {
          term: 'Patron',
          body: 'kaikki valmisvärit sekä **Prism**, Patronin oletus, tai **Your own** yhdellä–neljällä värillä. Yksi väri pysyy paikallaan; kahdesta neljään muodostaa liukuvärin, joka liikkuu vasemmalta oikealle.',
        },
      ],
      outro:
        '**Your Anvil display name** on Discordiin yhdistetyn tilisi nimi. Kohdassa **Your RuneScape characters** valitse **Same for all** tai **Customize each**, jotta jokainen hahmo saa oman ilmeensä. Paina **Save** (tai **Save for all characters**); **Reset to default** palauttaa tasosi värit.',
      note: {
        tag: 'Tummat ja vaaleat taustat',
        body: 'Sivusto, pluginin paneeli ja Discord ovat tummia; pelin kiinteä chatboksi on vaalea. Anvil säätää värejäsi, jotta ne pysyvät luettavina kummallakin. Jos haluat toiselle niistä eri ilmeen, kytke päälle **Set a separate look for dark backgrounds** tai **for light backgrounds**. Se ilme näytetään juuri niin kuin valitsit, ilman kontrastikorjausta, ja esikatselu varoittaa, jos sitä on vaikea lukea.',
      },
    },

    where: {
      title: 'Missä tyylisi näkyy',
      intro: 'Värisi ja tähti kulkevat kaikkialle, missä nimesikin:',
      rows: [
        {
          term: 'Sivustolla',
          body: 'taulut, jäsenlistat, profiilit, oma nimesi yläpalkissa ja hahmojesi nimet. Tähti on sinun väreissäsi.',
        },
        {
          term: 'Pluginin paneelissa',
          body: 'Feed, tapahtumachat, kortit ja **Tracking**-rivi. Patronin liukuväri liukuu; jokainen pelaaja voi pysäyttää sen asetuksella **Animated names**.',
        },
        {
          term: 'Pelissä',
          body: 'muille Anvil-pluginia käyttäville pelaajille: julkinen, klaani-, kaveri- ja yksityischat, klaanin ilmoitukset, kirjautumisilmoitukset, kaveri- ja klaanilistat sekä hiiren oikean painikkeen valikko (ei koskaan PvP-maailmoissa eikä Wildernessissä). Pelin chatissa tähti on vain Patroneilla.',
        },
        {
          term: 'Discordissa',
          body: 'tähti nimesi vieressä Anvilin julkaisuissa, omissa väreissäsi, jos olet valinnut sellaiset.',
        },
        {
          term: 'Kultainen GZ',
          body: 'klaanitoverin dropissa klaanisi syötteessä sivustolla GZ:si voi olla kultainen. Vain Supporterit voivat antaa sellaisen.',
        },
      ],
      note: {
        tag: 'Vain hahmoissa, jotka on todistettu sinun omiksesi',
        body: 'Värit näkyvät vain hahmoissa, jotka plugin on vahvistanut sinun omiksesi, sivustolla ja pelissä. Jos et halua niitä nimiisi muiden pelaajien pelichatissa, poista valinta **Show my colours on my characters’ names in game chat** kohdassa Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banneri ja vitriini',
      intro: 'Kaikki kolme löytyvät kohdasta **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar ja banneri',
          body: 'Champion ja Patron. Lataa omasi; GIF tai WebP pysyy animoituna. Ne näkyvät kortillasi, profiilissasi ja jokaisella hahmollasi, sivustolla ja pluginissa. Banneri voi olla enintään 6 MB ja vähintään 600×150; avatar enintään 2 MB.',
        },
        {
          term: 'Hahmokohtaisesti',
          body: 'anna yhdelle hahmolle oma banneri tai avatar, tai molemmat. Se korvaa oletuksesi vain sen hahmon sivuilla ja plugin-kortilla.',
        },
        {
          term: 'Vitriini',
          body: 'parhaat droppisi, tappomääräsi ja aikasi kiinnitettyinä profiiliisi: 4 paikkaa Supporterille, 8 Championille, 12 Patronille. Kiinnitykset hahmoista, joita et jaa, pysyvät yksityisinä.',
        },
      ],
    },

    hosting: {
      title: 'Kaveritapahtumat, head-to-head ja chat',
      intro: 'Edut, jotka antavat lisää tilaa pelata ulkonäön sijaan:',
      rows: [
        {
          term: 'Kaveritapahtumat',
          body: 'järjestä kavereille oma bingo, soolobingo tai kisa kohdasta **Host an event for your friends**, ja plugin seuraa sitä kuin klaanitapahtumaa. Kaverit liittyvät kutsulinkilläsi. Supporter: 1 käynnissä oleva tapahtuma, 10 pelaajaa. Champion: 1 tapahtuma, 25 pelaajaa. Patron: 2 kerralla, yhteensä 50 pelaajaa. Kuka tahansa voi liittyä.',
        },
        {
          term: 'Head-to-head',
          body: 'haasta kaveri hänen profiilistaan: kuka saa ensin dropin, tai eniten tappoja tai XP:tä 1 tunnissa, 24 tunnissa tai 7 päivässä. Vain kunnian vuoksi. Ilmaispelaajilla voi olla 1 avoinna kerrallaan, Supportereilla 5, Championeilla ja Patroneilla niin monta kuin haluavat.',
        },
        {
          term: 'Tapahtumachat',
          body: 'kuinka kauan odotat rivien välillä: 5 sekuntia ilman tasoa, 3 Supportereille, 1 Championeille, ei lainkaan Patroneille. Kun taulun chat ruuhkautuu, kaikki odottavat 10 sekuntia, myös Patronit.',
        },
        {
          term: 'Klaanin boostit',
          body: 'Champion 1, Patron 2, niin kauan kuin maksat. Katso [Klaanin boostaaminen]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Maksaminen, vaihtaminen ja peruminen',
      intro: 'Anvil Supporter laskutetaan Gumroadin kautta, kuukausittain tai vuosittain.',
      steps: [
        'Kirjaudu Anviliin ja avaa `/supporter`.',
        'Paina **Choose Supporter**, **Choose Champion** tai **Choose Patron**. Gumroadin kassa aukeaa, kuukausi- tai vuosilaskutuksella.',
        'Maksa. Etusi kytkeytyvät päälle heti, kun Gumroad ilmoittaa Anvilille, ja tasosi näkyy Supporter-sivulla kohdassa **Your tier**.',
      ],
      outro:
        'Vaihda tasoa kohdasta **Change tier** osiossa Settings → Supporter. Peru tai päivitä korttisi samasta paikasta kohdasta **Manage on Gumroad**. Peruttu jäsenyys pitää kaikki edut maksetun kauden loppuun asti.',
      note: {
        tag: 'Aloita aina sivulta /supporter',
        body: '**Choose**-painikkeessa on koodi, joka kertoo Anvilille, mikä tili maksoi. Anvil ei koskaan yhdistä maksua sähköpostin perusteella, joten suoraan Gumroadista ilman sitä painiketta tehty osto jää yhdistämättä. Jos niin kävi, kysy Anvilin Discordissa, niin henkilökunta voi liittää maksun tiliisi käsin.',
      },
    },

    lapse: {
      title: 'Tason laskeminen tai lopettaminen',
      intro:
        'Mitään asettamaasi ei poisteta. Jokainen etu tarkistetaan sitä tasoa vasten, joka sinulla juuri nyt on, joten se kytkeytyy pois itsestään ja palaa heti, kun uusit tilauksen.',
      rows: [
        {
          term: 'Nimen värit',
          body: 'tallennettu valintasi pysyy tallessa. Käytät uuden tasosi värejä, tai et mitään, kunnes taso, joka sallii valintasi, palaa.',
        },
        {
          term: 'Avatar ja banneri',
          body: 'Championin alapuolella ne näyttävät liikkumattoman ensimmäisen kuvansa liikkumisen sijaan.',
        },
        {
          term: 'Vitriini',
          body: 'näyttää ensimmäiset kiinnitykset, jotka tasosi sallii, ja piilottaa loput. Ilman tasoa se on piilossa; kiinnitykset odottavat sinua.',
        },
        {
          term: 'Klaanin boostit',
          body: 'vanhimmat boostisi lasketaan edelleen ja loput keskeytetään, ei poisteta.',
        },
      ],
      note: {
        tag: 'Anvilin henkilökunnan väliaikainen korotus',
        body: 'Henkilökunta voi antaa jollekulle korkeamman tason joksikin aikaa, esimerkiksi kiitoksena. Se tulee maksamasi päälle eikä koskaan muuta tilaustasi. Settings → Supporter näyttää **A gift from Anvil** ja milloin se päättyy; sen jälkeen olet taas maksamallasi tasolla. Lahja antaa klaaniboostipaikkoja vain, jos henkilökunta sisällyttää ne.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Anvilin sivupaneeli välilehti kerrallaan — Anvil',
    metaDescription:
      'Mitä Anvilin RuneLite-sivupaneelin kukin välilehti näyttää (Clan, Feed, You, Lookup ja ratas), miten tapahtumachat ja Feed-reaktiot toimivat, ja pluginin asetukset syötteelle pelichatissa, Supporter-väreille ja animoiduille nimille.',
    eyebrow: 'Anvil · pelaajille',
    title: 'Sivupaneeli välilehti kerrallaan',
    dek: 'Anvil-painike RuneLiten sivupalkissa avaa paneelin, jossa on neljä välilehteä ja ratas: **Clan**, **Feed**, **You**, **Lookup** ja ⚙. Suurin osa sen sisällöstä tulee sivustolta, joten se pysyy ajan tasalla ilman pluginin päivitystä. Muutama alla oleva asia on merkitty tulevaksi seuraavassa pluginin päivityksessä.',
    facts: [
      { strong: 'Neljä välilehteä', rest: 'ja ratas synkronointia ja asetuksia varten' },
      { strong: 'Tapahtumachat', rest: 'Feed-välilehdellä' },
      { strong: 'GZ, Sad, Sit', rest: 'Feedin riveillä' },
    ],
    footnote:
      'Pluginin asentaminen ja sisäänkirjautuminen: [RuneLite-pluginin käyttöönotto]({pluginGuide}). Supporter-värit, tähti ja chat-edut selitetään oppaassa [Anvil Supporter: tasot ja edut]({supporterGuide}).',

    header: {
      title: 'Paneelin yläosa',
      intro: 'Välilehtien yläpuolella ovat otsikko, **Refresh** ja tilirivi.',
      rows: [
        {
          term: 'Refresh',
          body: 'lataa paneelin uudelleen, Feed-välilehti mukaan lukien. Työskennellessään siinä lukee **Refreshing…**. Seuraavassa pluginin päivityksessä se lataa uudelleen myös You- ja Lookup-välilehdet, joten uusi avatar tai banneri näkyy heti, eikä se enää tyhjennä Feed-välilehteä.',
        },
        {
          term: 'Tracking',
          body: 'otsikon alla oleva rivi kertoo seurattavan hahmon, sen Supporter-väreissä, jos sillä on sellaiset. **Not my account…** lopettaa sellaisen hahmon seuraamisen, jota joku muu pelaa tällä tietokoneella; **Track again** kumoaa sen.',
        },
        {
          term: 'Tilivalikko',
          body: '⋯-linkki avaa kohdat **View my profile on Anvil**, **Not my account…** ja **Sign out…**. Seuraavassa pluginin päivityksessä siinä on myös **Become a Supporter**, tai **Your Supporter perks**, jos olet jo Supporter.',
        },
        {
          term: 'Kauden edistyminen',
          body: 'seuraavassa pluginin päivityksessä Leagues-, Deadman- ja muissa kausimaailmoissa näkyy rivi **Sharing season progress · Turn off**. Se lähettää reliikkisi, alueesi ja tehtäväsi (kuvakaappauksen kanssa) klaanillesi; klaanisi päättää verkkosivulla, mitä julkaistaan. **Turn on** jakaa sen taas. Sama kytkin on pluginin asetuksissa nimellä **Share seasonal activity**.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Tapahtumasi ja klaanisi. Sisällöntuottajan tilassa välilehden nimi on **Space**.',
      rows: [
        {
          term: 'Klaanin pudotusvalikko',
          body: 'näkyy, kun pelaat useammassa kuin yhdessä klaanissa tai tilassa. **All clans** (oletus) näyttää kaiken, missä pelaat, käynnissä oleva tapahtuma ensin. Yhden klaanin valitseminen rajaa paneelin siihen ja ohjaa lähetyksesi sinne.',
        },
        {
          term: 'Tapahtumat',
          body: 'jokainen käynnissä oleva ja tuleva taulu, Skill tai Boss of the Week ja klaanitapahtuma sijoituksinesi. Sen jälkeen **Your other boards**, **Also live** ja **Your clan**.',
        },
        {
          term: 'Taulu',
          body: 'avaa taulu nähdäksesi sijoitukset, joukkueet, tehtävät, viimeaikaisen toiminnan, lähimmät ruudut ja **View all tiles**. Sen **Feed**- ja **Chat**-painikkeet avaavat taulun Feed-välilehdellä.',
        },
        {
          term: 'Klaanitapahtuma',
          body: '**I’m going**, **Sign me up** tai **Answer the survey**, tapahtumasta riippuen.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Klaanisi ja taulujesi suuret hetket livenä: dropit, petit, saavutukset, questit, kuolemat ja valmiit ruudut.',
      rows: [
        {
          term: 'Kenen syöte',
          body: 'yläreunan pudotusvalikko listaa **Clan ·** jokaiselle klaanille, jonka jäsen olet, ja **Event ·** jokaiselle käynnissä olevalle taululle, jolla olet. Se avautuu taulullesi, jos sinulla on sellainen, muuten klaaniisi.',
        },
        {
          term: 'Suodattimet',
          body: '**All**, **Tiles** (vain taulut), **Drops**, **Pets**, **Achievements**, **Deaths**, ja **My team** taululla, jolla olet joukkueessa. Klaanin syötteessä on lisäksi pelitilojen toiminnan painike Leaguesia ja muita tiloja varten.',
        },
        {
          term: 'Uudet rivit',
          body: 'tulevat itsestään. Jos olet vierittänyt pois, **↑ N new** -pilleri vie sinut takaisin niihin.',
        },
      ],
      note: {
        tag: 'Ei sama kuin pelin chat-syöte',
        body: 'Feed-välilehti toimii riippumatta pluginin asetuksista. **Show feed in game chat** (vaihe 8) on erillinen asetus, joka tulostaa syötteen myös chatboksiisi.',
      },
    },

    reactions: {
      title: 'Reaktiot',
      intro: 'Jokaisen Feedin rivin alla on sen reaktio:',
      rows: [
        {
          term: 'GZ',
          body: 'dropeissa, peteissä ja saavutuksissa. Määrä näkyy sen vieressä, esimerkiksi **GZ 3**.',
        },
        {
          term: 'Sad ja Sit',
          body: 'kuolemissa GZ:n sijaan. Sit on pelin tapa käskeä kuollutta istumaan alas.',
        },
        {
          term: 'Kuka voi reagoida',
          body: 'klaanin syötteessä klaanitoverit. Taululla sen pelaajat ja isännän henkilökunta; kun taulu piilottaa sijoituksensa, pelaajat voivat reagoida vain oman joukkueensa riveihin.',
        },
        {
          term: 'Kuka reagoi',
          body: 'vie hiiri reaktion päälle nähdäksesi nimet, esimerkiksi “GZ · Mossy and 3 others”. Napsauta sitä uudelleen peruaksesi omasi.',
        },
      ],
      note: {
        tag: 'Seuraavassa pluginin päivityksessä',
        body: 'Reaktioista tulee pilleripainikkeita, sävytettyjä, kun yksi on sinun, ja muiden reaktiot päivittyvät livenä kaikille katsojille, myös muissa avoimissa clienteissäsi. Nyt määrä muuttuu, kun reagoit tai kun Feed latautuu uudelleen. Kultainen GZ, Supporterin reaktio, annetaan verkkosivun syötteissä; Feed-välilehdellä on GZ, Sad ja Sit.',
      },
    },

    chat: {
      title: 'Tapahtumachat',
      intro:
        'Taululla, jonka chat on päällä, on Feed-välilehden yläreunassa **Feed / Chat** -kytkin taulun pelaajille ja isännän henkilökunnalle. Clan-välilehden taulusivulla on myös **Chat**-painike.',
      rows: [
        {
          term: 'Kaikki tai oma joukkue',
          body: '**All** kirjoittaa koko taululle, **My team** vain joukkueellesi (ne rivit on merkitty **TEAM**). Henkilökunta näkee lisäksi kohdan **Host & mods**, ja sen rivit on merkitty **HOST** tai **MOD**.',
        },
        {
          term: 'Lähettäminen',
          body: 'kirjoita kenttään ja paina Enter. Rivit ovat enintään 200 merkkiä, ja vain isäntä ja modit voivat julkaista linkkejä.',
        },
        {
          term: 'Kuinka usein',
          body: 'odotus rivien välillä määräytyy Supporter-tasosi mukaan: 5 sekuntia ilman tasoa, 3 Supportereille, 1 Championeille, ei lainkaan Patroneille. Kentän alla oleva rivi kertoo, mikä sinun odotuksesi on. Henkilökunta ei koskaan odota.',
        },
        {
          term: 'Hidas tila',
          body: 'kun taulun chat ruuhkautuu kovasti, kaikki odottavat minuutin ajan vähintään 10 sekuntia, Patronit mukaan lukien. Kukaan ei voi lähettää yli 10 riviä 10 sekunnissa.',
        },
        {
          term: 'Moderointi',
          body: 'isäntä ja modit voivat napsauttaa riviä hiiren oikealla painikkeella ja valita **Delete message** tai **Mute** jollekulle, ja keskeyttää koko chatin kohdasta **Pause chat**.',
        },
      ],
      outro:
        'Saman henkilön peräkkäiset rivit jakavat yhden nimen ja ajan, kunnes tulee 5 minuutin tauko. Chat säilytetään 7 päivää tapahtuman päättymisen jälkeen.',
    },

    you: {
      title: 'You ja Lookup',
      intro: 'Kaksi välilehteä pelaajakorteille: sinun omasi ja kenen tahansa muun.',
      rows: [
        {
          term: 'You',
          body: 'oma korttisi hahmolle, jolla olet kirjautuneena: banneri ja avatar, **Display case**, Collection Log jokaisen sivun esineisiin asti, sekä **Skills**, **Bosses**, **Clues**, **Times** ja **CAs**. Sen alla mahdollinen sinua odottava **Head-to-head**-haaste (**Accept** tai **Decline**) ja tavoitteesi (**Goals**), painikkeella **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'vaihda **Players**- ja **Clans**-näkymän välillä, kirjoita nimi ja paina Enter. **Recent** listaa viimeisimmät hakusi. Napsauta ketä tahansa pelissä hiiren oikealla ja valitse **Anvil** päätyäksesi tänne.',
        },
        {
          term: 'Vertailu',
          body: 'jonkun toisen kortilla **Compare with me** asettaa teidät rinnakkain taito taidolta, bossi bossilta ja sivu sivulta. Klaanin kortilla on **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'Ratas-välilehti',
      intro: 'Synkronointia ja asetuksia katseltavan sijaan:',
      rows: [
        {
          term: 'Sync profile',
          body: 'lähettää Collection Logisi ja parhaat aikasi Anvilille.',
        },
        {
          term: 'Sync clan roster',
          body: 'vain klaanin ylläpitäjille: lähettää pelin klaanin jäsenlistan sivustolle. Jos plugin ei pysty lukemaan klaaniasi, siinä lukee sen sijaan **Join your clan channel to sync the roster**.',
        },
        {
          term: 'Banner sounds',
          body: '**Add clip** äänelle, jonka banneri soittaa, **Copy folder path** niiden hallintaan ja **Add mission clip** tehtäville.',
        },
        {
          term: 'Become a Supporter',
          body: 'seuraavassa pluginin päivityksessä alareunan ★-linkki avaa Supporter-sivun, tai siinä lukee **Your Supporter perks**, jos olet jo Supporter.',
        },
      ],
    },

    settings: {
      title: 'Asetukset, jotka muuttavat näkymääsi',
      intro:
        'RuneLiten Anvil-asetuksissa, kohdassa **Chat messages**. Kaikki ovat aluksi päällä.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'tulostaa syötteen myös chatboksiisi sitä mukaa kuin asioita tapahtuu: isot dropit, petit ja saavutukset tauluilta, joiden isäntä on ottanut sen käyttöön, ja klaaneista, joissa olet vieraana, joukkuetovereidesi ruutujen edistyminen ja muiden joukkueiden valmiit ruudut.',
        },
        {
          term: 'Supporter names in chat',
          body: 'Supportereiden värit (ja Patronin tähti) julkisessa, klaani-, kaveri- ja yksityischatissa sekä kaverilistallasi ja kanavien jäsenlistoilla. Nimilista ladataan Anvilista; siitä, keitä näet, ei lähetetä mitään.',
        },
        {
          term: 'Animated names',
          body: 'antaa Patronin liukuvärin liukua paneelissa, Feedissä ja tapahtumachatissa. Pois päältä se pysyy paikallaan. Seuraavassa pluginin päivityksessä se koskee myös boostattujen klaanien nimiä ja animoituja bannereita paneelissa.',
        },
        {
          term: 'Supporter names in menus',
          body: 'Supportereiden värit heidän nimessään, kun napsautat heitä hiiren oikealla, ei koskaan PvP-maailmoissa eikä Wildernessissä.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'päällä Supporterin värit korvaavat nimen värin, jonka jokin toinen plugin on asettanut, kuten Player Indicators. Pois päältä ne nimet jätetään rauhaan.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Klaanin boostaaminen — Anvil',
    metaDescription:
      'Miten Anvilin klaaniboostit toimivat: kenellä niitä on, boostin asettaminen ja siirtäminen, kolme boostitasoa ja mitä kukin avaa, klaanin nimen värit, lahjoitetut boostit sekä boostaajien merkit ja kunniamerkit.',
    eyebrow: 'Anvil · Supportereille ja klaanin henkilökunnalle',
    title: 'Klaanin boostaaminen',
    dek: 'Maksava Champion tai Patron voi asettaa boostin klaaniin, jonka jäsen hän on. Kun klaanin jäseniltä tulee tarpeeksi boosteja, klaani nousee tason, ja jokainen taso muuttaa sitä, miltä klaani näyttää ja missä se listataan. Boostit ovat vain ulkonäköä: ne eivät koskaan muuta rankkia, pisteitä, paikkaa tai klaanin tilausta.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boostia niin kauan kuin maksat' },
      { strong: 'Tasot 3, 8 ja 15', rest: 'laskettua boostia' },
      { strong: 'Kerran viikossa', rest: 'boostia voi siirtää' },
    ],
    footnote:
      'Jäsenet asettavat boostit kohdassa **Settings** → **Clan boosts**. Klaanin henkilökunta näkee tason ja sen asetukset kohdassa Admin → **Clan settings** → **Boosts**. Itse Supporter-tasoista: [Anvil Supporter: tasot ja edut]({supporterGuide}).',

    what: {
      title: 'Kenellä on boosteja',
      intro: 'Boostit tulevat maksullisen jäsenyyden mukana:',
      rows: [
        { term: 'Champion', body: '1 boosti.' },
        { term: 'Patron', body: '2 boostia.' },
        {
          term: 'Supporter',
          body: 'ei yhtään. Ei myöskään kutsuilla ansaittu aika. Anvilin henkilökunnan väliaikainen korotus antaa paikkoja vain, jos henkilökunta sisällyttää ne.',
        },
      ],
      outro:
        'Boostit kuuluvat sinulle, eivät hahmolle: kolme hahmoa kolmessa klaanissa jakavat silti yhden sarjan. **Settings** → **Clan boosts** näkyy asetuksissasi vain, kun olet Supporter tai sinulla on vielä boosti asetettuna.',
    },

    place: {
      title: 'Boostin asettaminen ja siirtäminen',
      intro: 'Asetat boostisi itse; kukaan ei voi asettaa niitä puolestasi.',
      steps: [
        'Avaa **Settings** → **Clan boosts**. **Your boosts** listaa asettamasi boostit ja mahdolliset vapaat paikat (**Free slot**).',
        'Paina kohdassa **Clans you can boost** klaanin vieressä **Boost**. Voit myös painaa **Boost this clan** klaanin oman sivun Boosters-osiossa.',
        'Siirrä boosti valitsemalla sen riviltä **Move to…** ja toinen klaani. **Remove** poistaa sen.',
      ],
      rows: [
        {
          term: 'Jäsenpaikka, 14 päivää vanha',
          body: 'jokainen boosti on jonkin hahmosi jäsenpaikan varassa pelin klaanissa. Vieraspaikka ei voi kantaa boostia. Paikan ikä lasketaan aiemmasta näistä: milloin Anvil näki sen ensimmäisen kerran tai milloin peli kertoo hahmon liittyneen. Siihen asti klaanin rivi kertoo, montako päivää on jäljellä.',
        },
        {
          term: 'Yksi rivi klaania kohden',
          body: 'lista näyttää jokaisen klaanin kerran, ja Anvil valitsee hahmon, jonka varassa boosti on: mainisi, jos mahdollista, muuten pisimpään pidetyn paikan. Klaani näkee vain sen hahmon, ei koskaan muita hahmojasi.',
        },
        {
          term: 'Kerran viikossa',
          body: 'asetetun boostin voi siirtää 7 päivää asettamisen jälkeen. Poistetun boostin paikka vapautuu samana päivänä, joten poistaminen ja uudelleen asettaminen ei ole oikotie. Jos hahmo, jonka varassa boosti oli, lähti klaanista, voit siirtää sen heti.',
        },
      ],
      note: {
        tag: 'Mitä merkinnät tarkoittavat',
        body: '**counting**: se lasketaan klaanin tasoon. **paused**: Supporter-tasollasi on nyt vähemmän paikkoja kuin olet asettanut, joten vanhimmat boostisi lasketaan edelleen ja loput odottavat. **seat gone**: hahmo, jonka varassa boosti oli, ei ole enää siellä jäsen; siirrä se. **over the 2-per-person cap**: klaani laskee jo kaksi boostiasi.',
      },
    },

    levels: {
      title: 'Tasot',
      intro:
        'Klaanin taso tulee sen lasketuista boosteista. Yhdeltä ihmiseltä lasketaan yhteen klaaniin enintään kaksi boostia, joten taso tarkoittaa aina, että useampi jäsen on valinnut sen.',
      rows: [
        { term: 'Taso 1', body: '3 laskettua boostia.' },
        { term: 'Taso 2', body: '8 laskettua boostia.' },
        { term: 'Taso 3', body: '15 laskettua boostia.' },
      ],
      outro:
        'Jäsenet näkevät edistymisen klaanin sivulla, esimerkiksi “5 of 8 to Level 2”. Nouseva klaani saa uuden tason heti.',
      note: {
        tag: 'Viikon armonaika',
        body: 'Kun boostit putoavat tason alle, klaani pitää sen tason edut 7 päivää. Admin → Clan settings → Boosts näyttää, milloin ne päättyvät. Jos jäsenet boostaavat sen takaisin ajoissa, mikään ei muutu.',
      },
    },

    perks: {
      title: 'Mitä kukin taso avaa',
      intro: 'Jokainen taso pitää kaiken alemmalta tasolta.',
      rows: [
        {
          term: 'Taso 1',
          body: '**Boosted**-merkki klaanisivulle, sen Clan Hall -kortille ja hakuun; paikka boostaamattomien klaanien yläpuolella Clan Hallissa ja sen hakutuloksissa; ja klaanin nimi liukuvärinä.',
        },
        {
          term: 'Taso 2',
          body: 'paikka Clan Hallin **Featured**-rivillä; klaanin animoitu banneri toistuu (tason 2 alapuolella se näyttää liikkumattoman kuvansa); rekrytointirivi vierailijoille; ja nimen liukuväri liikkuu.',
        },
        {
          term: 'Taso 3',
          body: '**Spotlight** Clan Hallin ylimpänä ja yksi rekrytointijulkaisu kuukaudessa Anvilin Discordissa, klaanin itse kirjoittamana.',
        },
      ],
      note: {
        tag: 'Klaanin logo ei ole etu',
        body: 'Animoitu logo (GIF- tai WebP-klaanikuva) toistuu millä tahansa tasolla. Vain banneri odottaa tasoa 2.',
      },
    },

    colours: {
      title: 'Klaanin nimen värit',
      intro:
        'Tasolta 1 alkaen klaanin nimi on Anvilin liukuvärissä. Omistajat ja ylläpitäjät voivat valita omat kohdassa Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'Yhdestä neljään väriä',
          body: 'yksi väri tekee nimestä kiinteän; kahdesta neljään tekee liukuvärin. Tasolta 2 alkaen liukuväri liikkuu.',
        },
        {
          term: 'Tummat ja vaaleat taustat',
          body: 'kuten Supporter-nimissä, Anvil säätää värejä, jotta ne pysyvät luettavina tummilla taustoilla (sivusto, pluginin paneeli, Discord) ja vaaleilla (pelin kiinteä chatboksi). Kytke jommallekummalle erillinen ilme, niin se näytetään juuri niin kuin valittiin.',
        },
        {
          term: 'Reset to Anvil',
          body: 'palauttaa Anvilin paletin.',
        },
      ],
      outro:
        'Värit pysyvät tallessa, jos klaani putoaa tason 1 alle, ja palaavat, kun se nousee takaisin. Plugin huomaa muutoksen seuraavassa päivityksessään.',
    },

    staff: {
      title: 'Klaanin henkilökunnalle',
      intro:
        'Admin → **Clan settings** → **Boosts** on omistajille ja ylläpitäjille. Henkilökunta ei voi asettaa boosteja jäsenten puolesta; jäsenet asettavat omansa.',
      rows: [
        {
          term: 'Taso',
          body: 'klaanin taso, montako boostia lasketaan, montako lisää tarvitaan seuraavaan tasoon, ja mahdollinen armonviikko.',
        },
        {
          term: 'Recruiting line',
          body: 'Taso 2. Yksi lause, enintään 140 merkkiä, joka näytetään klaaniin kuulumattomille klaanisivullanne ja Clan Hall -kortillanne.',
        },
        {
          term: 'Recruitment post in the Anvil Discord',
          body: 'Taso 3. Kerran kalenterikuukaudessa, 20–500 merkkiä, itse kirjoittamasi ja julkaistu, kun painat **Post it**, mukana linkki klaanisivullenne. Maininnat poistetaan eikä ketään pingata. Et voi muokata sitä tai lähettää uutta ennen seuraavaa kuukautta.',
        },
        {
          term: 'Boosters',
          body: 'lista hahmoista, jotka boostaavat klaania.',
        },
      ],
      note: {
        tag: 'Anvilin lahjoittamat boostit',
        body: 'Anvilin henkilökunta voi lahjoittaa klaanille tason, määräajaksi tai ilman loppua. Lahja lisää vain ne boostit, jotka klaanilta puuttuvat siihen tasoon, ja ne näkyvät klaanin Boosters-listalla nimellä **Anvil gift**. Jokainen jäsenen oikea boosti korvaa yhden lahjoitetun, ja klaani, joka on jo lahjoitettua tasoa ylempänä, pitää oman tasonsa. Kun lahja päättyy, klaani putoaa tasolle, jonka sen jäsenten boostit antavat.',
      },
    },

    boosters: {
      title: 'Boostaajien merkit ja kunniamerkit',
      intro: 'Mitä boostaaja saa klaanissa, jota hän boostaa:',
      rows: [
        {
          term: 'Boostaajan merkki',
          body: 'pieni jalokivi hänen hahmonsa vieressä sen klaanin jäsenlistassa, syötteessä ja Discord-julkaisuissa. Vie hiiri sen päälle nähdäksesi “Boosts this clan”.',
        },
        {
          term: 'Boostaajien seinä',
          body: 'klaanisivulla: yksi rivi hahmoa kohden, eniten boosteja ensin, sitten pisimpään boostanneet.',
        },
        {
          term: 'Kunniamerkit',
          body: '**First booster** sille, joka asetti klaanin kaikkien aikojen ensimmäisen boostin; **1 month**, **3 months**, **6 months** ja **1 year** katkeamatonta boostaamista; ja **Level-up 1**, **2** tai **3** boostista, joka nosti klaanin sille tasolle.',
        },
      ],
      note: {
        tag: 'Siirtäminen nollaa kellon',
        body: 'Aikaan perustuvat kunniamerkit lasketaan hahmon vanhimmasta yhä laskettavasta boostista, joten boostin siirtäminen tai poistaminen aloittaa ne alusta. Profiilisi listaa klaanit, joita boostaat, kerran klaania kohden.',
      },
    },
  },

  profile: {
    metaTitle: 'Profiilisi, Wrapped ja Compare — Anvil',
    metaDescription: 'Sivut, jotka Anvil pitää sinusta: profiilisi, jokaisen hahmon julkinen sivu, henkilösivusi, kuukausittainen ja vuosittainen Wrapped, tapahtuman Wrapped-kortit ja kahden hahmon vertailu rinnakkain.',
    eyebrow: 'Anvil · pelaajille',
    title: 'Profiilisi, Wrapped ja Compare',
    dek: 'Anvil pitää yhden sivun **sinulle** ja yhden **jokaiselle hahmolle**, jolla pelaat. Tässä on, mitä niillä on, kuka niitä voi avata, ja Wrapped-kortit, jotka tulevat jokaisen kuukauden ja tapahtuman lopussa.',
    facts: [
      {
        strong: 'Oletuksena jaettu',
        rest: 'vaihda minkä tahansa hahmon yksityiseksi yhdellä kytkimellä',
      },
      {
        strong: 'Kuukausittainen Wrapped',
        rest: 'ilmestyy seuraavan kuukauden 1. päivänä',
      },
      {
        strong: 'Tapahtuman Wrapped',
        rest: 'ilmestyy tapahtuman päättyessä',
      },
    ],
    footnote: 'Jokainen tässä mainittu kytkin on selitetty siellä, missä se sijaitsee kohdassa [Asetukset sivu kerrallaan]({settingsGuide}).',
    pages: {
      title: 'Sivusi',
      intro: 'Neljä sivua, joista jokainen vastaa eri kysymykseen:',
      rows: [
        {
          term: 'Profiilisi',
          body: '[/profile](/profile), jonka vain sinä näet. Valitse hahmo ylhäältä olevista siruista nähdäksesi sen tasot, bossit, kokoelmalokin ja tapahtumat. Kapteenit saavat täällä myös **Captain’s deck** -osion.',
        },
        {
          term: 'Hahmon sivu',
          body: '`/p/<name>`: yksi hahmo, jonka kuka tahansa linkin omaava voi lukea, kun se on jaettu. Se näyttää taidot, bossit, kokoelmalokin ja henkilökohtaiset ennätykset, ja tarkoituksella jättää pois klaanisijoituksesi, tapahtumahistoriasi ja Discord-nimesi.',
        },
        {
          term: 'Henkilösivusi',
          body: '`/u/…`: kaikki jaetut hahmosi yhdellä sivulla, näyttelyhyllysi ja ne suoratoistotilit, jotka valitsit näytettäviksi. Se on olemassa vain, jos käytät **Show that my characters are one person** -asetusta.',
        },
        {
          term: 'Klaanin jäsensivu',
          body: '`/c/<clan>/members/<name>`: sama hahmo, sellaisena kuin yksi klaani sen näkee, avattuna klaanin **Members**-listasta. Yksityinen klaani näyttää jäsenensä vain omilleen.',
        },
      ],
    },
    sharing: {
      title: 'Kuka näkee mitä',
      body: [
        'Jokainen hahmo alkaa **shared**-tilassa: sen sivu aukeaa kenelle tahansa linkin kanssa, ja se voi näkyä tulostauluilla ja muille klaaneille. Kytke yksi pois kohdasta **Who sees my characters** Asetuksissa, ja sen sivu vastaa kaikille muille _not found_ paitsi sinulle. Näet **Private — only you can see this page.** ja linkin **Share it →**.',
        'Jaetulla sivulla on nimen alla **Copy link**. Kirjautuneet kävijät, jotka pitävät sivua väärinkäyttävänä, voivat painaa **Report this profile**.',
        'Hahmokohtaisesti Asetuksissa voi myös piilottaa, minkä pelin klaanin jäsen hahmo on (**Show my in-game clan**), jolloin se poistuu hahmon sivulta ja kyseisen klaanin Anvil-sivulta.',
      ],
    },
    wrapped: {
      title: 'Kuukausittainen ja vuosittainen Wrapped',
      body: [
        'Joka kuukausi jokainen hahmo saa Wrapped-kortin: **XP gained**, **Boss kills**, **New slots** kokoelmalokissa, **Efficient**-tunnit, **PBs**, sekä lemmikit ja isoin drop. Se ilmestyy **seuraavan kuukauden 1. päivänä** (UTC). Siihen asti vain sinä voit avata sen esikatseluna.',
        'Vuodesta tulee myös oma, osoitteessa `/p/<name>/wrapped/<year>`, **1. joulukuuta** alkaen. `/p/<name>/wrapped` vie aina uusimpaan.',
        'Paina **Copy link to your Wrapped** jakaaksesi sen. Liitettynä Discordiin se avautuu kuvana kortista. Yksityisen hahmon Wrapped avautuu vain sinulle, ja sen linkin esikatselu näkyy tavallisena Anvil-korttina.',
      ],
      note: {
        tag: 'Tyhjä kuukausi',
        body: 'Jos Anvilille ei tullut kuukauden aikana mitään (ei XP:tä, tappoja, lokipaikkoja tai ennätyksiä), kortti kertoo sen nollien sijaan. Pelaa lisäosalla tai anna hiscoren tavoittaa sinut, ja seuraava kuukausi täyttyy.',
      },
    },
    events: {
      title: 'Tapahtuman Wrapped',
      body: [
        'Kun taulu päättyy, jokainen pelaaja ja jokainen tiimi saa kortin. Avaa tapahtuman **Wrapped**-sivu: **Your card** on ylhäällä, sitten **Teams** (sijoitus, pisteet ja pelaajat) ja **Players**. Paina **Open and share your card** ja sitten **Copy share link**.',
        'Ennen loppua näet **Cards aren’t out yet**. Henkilökunta voi avata esikatselun ajoissa tarkistaakseen kortit ennen kuin pelaajat näkevät ne.',
        'Kuvakortit näkyvät vain julkisen klaanin tapahtumalle, joka ei ollut vain kutsulla. Muille tapahtumille linkki toimii yhä niille, jotka näkevät tapahtuman, ja esikatselu näkyy tavallisena Anvil-korttina.',
      ],
    },
    compare: {
      title: 'Vertaile kahta hahmoa',
      body: [
        'Avaa [Compare](/compare) ja kirjoita kaksi nimeä. Saat taidot, bossit ja kokoelmalokisivut rinnakkain. Johtaja kussakin luvussa on kullalla. Sen alla ovat analyysi, XP per taito, jokainen boss, jonka kumpikin on tappanut, ja jokainen lokisivu kohde kohteelta: molemmilla on, kummallakaan ei, tai vain toisella teistä. **Swap sides** vaihtaa puolet.',
        'Vain jaettuja hahmoja voi verrata. Yksityinen tai nimi, jota Anvil ei tunne, palauttaa _ei Anvilissa tai ei jaettu_. Voit aina verrata omia yksityisiä hahmojasi kirjautuneena.',
      ],
    },
  },
  settings: {
    metaTitle: 'Asetukset sivu kerrallaan — Anvil',
    metaDescription: 'Jokainen Anvil-asetusten sivu: Discord-julkaisut ja kuvakaappausten yksityisyys, pelin chat-syöte, lisäosayhteys ja laitteet, omat webhookit, kuka näkee hahmosi, Supporter- ja profiilin ulkoasu, suoratoistotilit, jokainen hahmo ja omistajuusvaateet.',
    eyebrow: 'Anvil · pelaajille',
    title: 'Asetukset sivu kerrallaan',
    dek: '[Settings](/settings) on paikka, jossa omat valintasi asuvat: mitä julkaiset, mitä näet pelissä ja kuka näkee hahmosi. Täällä tehdyt valinnat seuraavat sinua jokaiselle koneelle, jolla pelaat.',
    facts: [
      {
        strong: 'Hakukenttä',
        rest: 'ensimmäisellä sivulla löytää minkä tahansa asetuksen',
      },
      {
        strong: 'Yksi sivu hahmoa kohden',
        rest: 'kohdassa Characters',
      },
      {
        strong: '10 webhookia',
        rest: 'omiasi',
      },
    ],
    footnote: 'Profiilisivusi on selitetty kohdassa [Profiilisi, Wrapped ja Compare]({profileGuide}); lisäosan omat asetukset kohdassa [RuneLite-lisäosan asennus]({pluginGuide}).',
    find: {
      title: 'Asetuksen löytäminen',
      body: [
        'Ensimmäisellä sivulla, **Overview & search**, on hakukenttä. Kirjoita mitä haluat omin sanoin, kuten _private messages_, _rare drop value_, _death message_, _name colour_ tai _plugin token_, ja se vie oikean kytkimen luo.',
        'Sivun sivupalkissa on kaksi ryhmää. **Account** sisältää alla olevat sivut. **Characters** sisältää yhden sivun jokaiselle linkittämällesi hahmolle (päähahmosi on merkitty **main**), sitten **Add character**. Numero **Add character** -kohdassa tarkoittaa, että Anvil on nähnyt sinun pelaavan hahmoja, joita et ole vielä linkittänyt.',
      ],
    },
    posts: {
      title: 'Discord-julkaisut ja kuvakaappaukset',
      intro: 'Mitä lisäosa julkaisee sinusta klaaniesi Discord-kanaviin ja mitä se piilottaa kuvakaappauksissa. Seuraava lisäosapäivitys lukee nämä valinnat. Siihen asti lisäosan omien asetusten samat kytkimet päättävät.',
      rows: [
        {
          term: 'Mitä lisäosasi julkaisee',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** ja **Diary completions** ovat alussa päällä; **PvP kills** on alussa pois.',
        },
        {
          term: 'Luvut',
          body: '**Min drop value** (alussa 1m, vähintään 1m, 0 kytkee pois), **Min drop rarity (1 in N)** (alussa 1 / 1 000), **Arvo ja harvinaisuus yhdessä** (alussa jompikumpi, tai **Vaadi molemmat**), **Loot key value** (1m), **Death message** enintään 200 merkkiä, jossa `{name}` muuttuu nimeksesi, sekä alin **Combat task tier** ja **Quest tier**, jotka julkaistaan (alussa Master). Arvo, harvinaisuus ja joko/molemmat-valinta seuraavat klaanisi oletuksia, kunnes asetat omat; **Palauta klaanin oletus** palauttaa seuraamisen.',
        },
        {
          term: 'Minne julkaisusi menevät',
          body: '**Keep my announcements out of clans I only guest in** ja **Level posts in clan channels**: **Clan rules**, **Only 99s & max** tai **Off**. **Per character** listaa jokaisen hahmon linkillä **Clans →**, jolla julkaisun voi kytkeä pois yhdeltä klaanilta.',
        },
        {
          term: 'Kuvakaappausten yksityisyys',
          body: 'rastita chat, joka jätetään pois jokaisesta lisäosan ottamasta kuvakaappauksesta, todisteista ja Discord-julkaisuista: **Private messages** (alussa rastitettuna), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** ja **Group chat**. Pelin viestit ja Anvilin omat rivit pysyvät aina mukana.',
        },
      ],
      note: {
        tag: 'Taulun ruudut eivät koskaan muutu',
        body: 'Julkaisun kytkeminen pois pysäyttää vain Discord-julkaisun. Dropit, tapot ja saavutukset lasketaan yhä millä tahansa taululla, jolla pelaat.',
      },
    },
    chat: {
      title: 'Pelin sisäinen chat-syöte',
      intro: 'Mitä lisäosa tulostaa chatiisi, kun lisäosan asetus **Show feed in game chat** on päällä.',
      rows: [
        {
          term: 'Mistä',
          body: '**Boards I play on** ja **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'Mitä',
          body: 'vähintään valitsemasi arvon arvoiset dropit, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, sekä taistelusaavutukset, tasot, tehtävät ja päiväkirjat.',
        },
        {
          term: 'Kirjautuessasi',
          body: '**A short brief in chat**: mitä tapahtui, kun olit poissa. Championit valitsevat, mitä se kattaa.',
        },
        {
          term: 'Värit',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)** tai **My own colours** Supportereille.',
        },
      ],
    },
    login: {
      title: 'Lisäosayhteys, kirjautuminen ja laitteet',
      intro: 'Missä lisäosa ja verkkosivusto ovat kirjautuneena ja miten ne kirjataan ulos.',
      rows: [
        {
          term: 'Lisäosayhteys',
          body: 'lisäosan tokenisi, siltä varalta että liität sen käsin. Yleensä sivupaneelin **Sign in with Discord** hoitaa tämän puolestasi.',
        },
        {
          term: 'Kirjautuminen ja laitteet',
          body: 'jokainen tietokone, jolla lisäosa on kirjautunut, nimellä **RuneLite sign-in 1**, **2**… ja tieto siitä, milloin se tehtiin ja milloin sitä viimeksi käytettiin. **Revoke** kirjaa yhden ulos, esimerkiksi myymäsi tietokoneen. **Enter a code** liittää toisen tietokoneen. **Sessions** kirjaa sinut ulos verkkosivustolta kaikkialta.',
        },
        {
          term: 'Klaanin laskutus',
          body: 'klaanin omistajat saavat täältä **Open portal →** klaanin laskutukseen.',
        },
      ],
    },
    webhooks: {
      title: 'Omat Discord-webhookit',
      body: [
        'Julkaisusi voivat myös mennä omalle Discord-palvelimellesi: yksityiseen kanavaan, kavereiden palvelimelle, minne tahansa missä voit tehdä webhookin. Liitä webhook-linkki, rastita mitä se saa (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), aseta halutessasi **Only drops worth at least … gp** ja paina **Add webhook**.',
        'Voit olla enintään 10. Vain Discord-webhook-linkit hyväksytään, ja tallennettu linkki näytetään peitettynä, joten tämän sivun kuvakaappaus ei vuoda sitä. **Level posts on my webhooks** asettaa omat tasosääntösi niille, erillään klaanistasi.',
      ],
    },
    privacy: {
      title: 'Kuka näkee hahmoni',
      intro: 'Hahmosi ovat alussa jaettuja. Kolme kytkintä muuttaa sen:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'yksi kytkin hahmoa kohden. Päällä (alussa) sen sivu on **Public**. Pois päältä se on **Only its clans**: sen klaanit näkevät sen yhä rostereissaan ja tapahtumissaan, muut eivät, ja se poistuu tulostauluilta.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'kahdella tai useammalla hahmolla tämä tekee henkilösivustasi, joka listaa jaetut hahmosi yhdessä. Pois päältä kukaan ei voi tietää, että ne ovat kaikki sinun.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'näkyvätkö etusivulla muiden klaanien avoimet taulut katseltavaksi.',
        },
      ],
    },
    look: {
      title: 'Supporter, profiilin ulkoasu, suoratoisto ja boostit',
      intro: 'Miltä näytät Anvilissa ja tilit ja edut sen takana.',
      rows: [
        {
          term: 'Supporter- ja nimivärit',
          body: 'tasosi, etusi ja kutsulinkkisi: tuo kavereita ja ansaitse ilmaisia kuukausia. Tasot on selitetty kohdassa [Anvil Supporter]({supporterGuide}).',
        },
        {
          term: 'Profiilin ulkoasu',
          body: 'avatar ja banneri (animoitu Championista alkaen), eri hahmoille eri jos haluat, sekä **Display case**: 4, 8 tai 12 pinssiä tason mukaan.',
        },
        {
          term: 'Suoratoistotilit',
          body: '**Twitch**, **YouTube**, **Kick** ja **Medal**. Jokaisesta näkyy, onko se vahvistettu, ja kytkin näyttää sen profiilissasi. Vahvistetut tilit ovat se, mikä päästää seuraaja- ja tilaajatapahtumiin.',
        },
        {
          term: 'Klaaniboostit',
          body: 'näkyy vain, kun voit boostata: slotisi, missä ne ovat ja klaanit, joita voit boostata. Katso [Boosting a clan]({boostsGuide}).',
        },
      ],
    },
    characters: {
      title: 'Jokainen hahmo',
      intro: 'Kohdassa **Characters** jokaisella hahmolla on oma sivunsa: sen tyyppi, onko se vahvistettu, sekä linkit julkiselle sivulle ja täyteen profiiliin.',
      rows: [
        {
          term: 'Näkyvyys',
          body: '**Show to other clans and on leaderboards** ja **Show my in-game clan**.',
        },
        {
          term: 'Klaanit',
          body: 'jokainen klaani ja tila, johon se kuuluu, **member**- tai **guest**-roolilla, kullekin klaanille **Announce drops & achievements** ja **Leave**. Jos Anvil on laittanut sen väärään klaaniin, **Which clan is it really in?** kertoo henkilökunnalle.',
        },
        {
          term: 'Hahmo',
          body: '**Make main**, pyydä uudelleennimeämistä nimenvaihdon jälkeen tai **Remove** se tililtäsi. Sen vanhat tulokset pysyvät paikoillaan.',
        },
        {
          term: 'Add character',
          body: 'pelaa hahmoa kerran lisäosa kirjautuneena, ja se linkittyy itse. Mobiilissa tai virallisella asiakkaalla linkitä se nimellä. **We noticed you playing** listaa ne, jotka Anvil on nähnyt; **Not mine** hylkää yhden.',
        },
      ],
    },
    claims: {
      title: 'Omistajuusvaateet',
      body: [
        'Jos hahmo on linkitetty jonkun toisen Anvil-tiliin, mutta on oikeasti sinun, paina **This is my account** lisäosan sivupaneelin **You**-välilehdellä. Todistat pelaavasi sitä nopealla XP-tarkistuksella, ja nykyistä haltijaa kysytään. Et koskaan saa tietää, kuka hän on, eikä hän koskaan saa tietää, kuka sinä olet.',
        'Vaatimuksesi näyttävät **XP check**, **open** ja sitten, miten ne päättyivät: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** tai **closed**. **Withdraw** peruuttaa yhden.',
        'Kun joku vaatii yhtä sinun hahmoistasi, se näkyy kohdassa **Claims on your characters** kanssa **Approve** tai **Object — it’s mine**. Vahvistamaton hahmo siirtyy 7 päivän jälkeen, ellet vastusta. Vahvistettu siirtyy vain, jos hyväksyt sen.',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill- ja Boss of the Week — Anvil',
    metaDescription: 'Skill of the Weekin, Boss of the Weekin tai tehokkuuskisan ajaminen Anvilissa: ajastus, toistaminen ja kierrättäminen, aloituslukemat, ihmisten lisääminen ja poistaminen, palkinnot, ajoissa lopettaminen ja se, mitä pelaajat näkevät.',
    eyebrow: 'Anvil · klaanin henkilökunnalle ja pelaajille',
    title: 'Skill- ja Boss of the Week',
    dek: 'Viikoittainen kilpailu on vähän työtä vaativa tapahtuma: ei ruutuja kirjoitettavana, ei tiimejä eikä ilmoittautumisia. Kaikki rosterilla ovat mukana alkaessa, ja voittaja on se, joka kerää eniten ennen loppua.',
    facts: [
      {
        strong: 'Ei ruutuja, ei tiimejä',
        rest: 'yksi tulostaulu',
      },
      {
        strong: 'Mukana alussa',
        rest: 'koko rosteri automaattisesti',
      },
      {
        strong: 'Enintään 10 palkintosijaa',
        rest: 'maksetaan kassasta',
      },
    ],
    footnote: 'Taulut (bingo) ovat kohdassa [Oman ensimmäisen tapahtuman ajaminen]({adminGuide}); palkinnot ja kassa kohdassa [Klaanin kassa]({cofferGuide}).',
    schedule: {
      title: 'Ajasta yksi',
      intro: 'Viisi valintaa, ja oletukset käyvät useimmille klaaneille:',
      steps: [
        'Avaa **Schedule** ylläpitovalikosta ja paina **+ Schedule event** (moderaattorit voivat käyttää **Schedule a competition**).',
        'Valitse laji: **Skill of the Week** (saadut XP), **Boss of the Week** (saadut tapot) tai **Efficiency race** (saatu pelatut tunnit tai bossitunnit).',
        'Kohdassa **What is measured** valitse taito tai boss. Jos haluat vaihtaa sen joka viikko, lisää niitä kohtaan **Then rotate through**. Jätä se tyhjäksi toistaaksesi saman.',
        'Valitse, milloin se **Runs**: **This weekend**, **One week** tai omat päivämäärät. Siinä on aina oltava loppu, koska se pisteyttää alun ja lopun välisen kasvun.',
        'Pidä **Repeat every week** päällä, jolloin seuraava alkaa heti kun tämä päättyy, samalla pituudella ja palkinnoilla. Rastita **Guests race too**, jos klaanisi vieraiden pitäisi olla taulussa.',
      ],
      outro: 'Muuta ei tarvitse asettaa. Aloitusluvut tulevat hiscoreista, kun se alkaa.',
    },
    counting: {
      title: 'Miten laskenta toimii',
      body: [
        'Jokaisen pelaajan kasvu on hänen tilastonsa nyt miinus hänen tilastonsa kilpailun alkaessa (hänen **starting line**). Suurin kasvu voittaa; tasatilanne listataan nimin, ja palkinnot voi jakaa tasapelisijoitusten kesken.',
        'Aloitusluvut otetaan hiscoreista. Sen jälkeen lisäosan live-päivitykset pitävät taulun ajan tasalla hiscore-tarkistusten välillä, joten lisäosan kanssa pelaavat nousevat taulussa pelatessaan.',
        'Luku, joka laskee, jätetään huomiotta, ja epäuskottava kasvu **flagged** henkilökunnalle sen sijaan, että se laskettaisiin tai leikattaisiin.',
      ],
      note: {
        tag: 'Pelaajat: kirjautukaa ulos ennen alkua',
        body: 'Hiscoret tallentavat tilastosi vain kun kirjaudut ulos. Jos grindaat aivan alkuun asti ulos kirjautumatta, aloitusrivisi otetaan ennen tuota grindiä ja grindi lasketaan kasvuksi. Henkilökunta yleensä huomaa sen ja korjaa aloitusrivisi, mutta kirjaudu silti kerran ulos ennen alkua.',
      },
    },
    manage: {
      title: 'Kilpailun ajaminen',
      intro: 'Avaa kilpailu kohdasta **Schedule** tai hallintapaneelista. Siinä on etusivu ja kolme välilehteä:',
      rows: [
        {
          term: 'Etusivu',
          body: '**Leaderboard** (kärki 25, ja kuinka monta pisteyttää), **flagged** kasvut, kuka tahansa, joka **left the clan**, sekä palkinnot. Kun se päättyy, voittajat ja **Final leaderboard**.',
        },
        {
          term: 'Aloitusrivit',
          body: 'jokaisen pelaajan **Started at**, **Now** ja **Gained**. Korjaa aloitusrivi käsin, kun kilpailua edeltävä grindi laskettiin, ja taulu seuraa. **Pull current stats** päivittää kaikki; **Reset baselines** aloittaa kaikki uudelleen hiscoreistaan nyt ja pyyhkii kaikki kasvut.',
        },
        {
          term: 'Osallistujat',
          body: 'koko rosteri on jo mukana. **Add someone** ottaa yhden nimen per rivi, vieraalle tai tilille, joka ei ole vielä rosterilla. Pelaajan poistaminen poistaa hänen tuloksensa; lisääminen takaisin antaa uuden aloitusrivin. **Leave one each** siivoaa henkilön, joka on mukana useilla hahmoilla. Voit myös pudottaa kaikki vieraat kerralla.',
        },
        {
          term: 'Asetukset',
          body: 'nimi, päivämäärät, **Repeat every week** ja **Status** (vain jumiutuneen korjaamiseen; se etenee itsestään). Ylläpitäjät voivat **Delete** sen osallistujineen ja tuloksineen.',
        },
      ],
    },
    prizes: {
      title: 'Palkinnot ja lopetus',
      body: [
        'Aseta palkinnot enintään 10 sijalle, maksettuna klaanin kassasta. Valitset, voidaanko palkita pelaaja ilman kasvua ja jakavatko tasapelisijat palkintonsa. Rahan kulku on kohdassa [Klaanin kassa]({cofferGuide}).',
        'Se päättyy itsestään asettamaasi aikaan. **End now** pysäyttää sen aiemmin: kasvut lakkaavat heti laskemasta, ja tulokset julkaistaan Discordiin, palkinnot maksettuna 15 minuutin sisällä.',
      ],
    },
    players: {
      title: 'Pelaajille',
      body: [
        'Et ilmoittaudu. Jos olet klaanin rosterilla kun se alkaa, olet mukana. Löydät sen klaanisi **Events**-sivulta, lisäosan sivupaneelin **Clan**-välilehdeltä asemasi kanssa, ja Discordista kun se alkaa ja päättyy.',
        'Jokaisella kilpailulla on oma sivu livetaulukolla ja siitä, miten kisa eteni päivittäin. Yksityinen klaani näyttää sen vain omille jäsenilleen.',
        'Lisäosalla pelaaminen pitää lukemasi ajantasaisena. Ilman sitä sinä lasketaan yhä, vain hiscoren vauhdilla.',
      ],
    },
  },
  clanEvents: {
    metaTitle: 'Klaanitapahtumat ja aikataulu — Anvil',
    metaDescription: 'Klaanitapahtumien ajastaminen Anvilissa: massat, reissut ja tapaamiset, viikkotoistot, ”I’m going” ja ilmoittautumiset paikkoineen, kysymyksineen ja maksuineen, Discord-julkaisut ja muistutukset, maksut, kyselyt ja aikataulu, joka näyttää aukot.',
    eyebrow: 'Anvil · klaanin henkilökunnalle',
    title: 'Klaanitapahtumat ja aikataulu',
    dek: 'Kaikki ei ole taulu. Klaanitapahtuma on massa, raidi-ilta, dropparty tai tapaaminen: aika ja paikka, julkaistu Discordiin ja muistutettu, niin paljon tai vähän ilmoittautumista kuin haluat.',
    facts: [
      {
        strong: 'Kerran tai joka viikko',
        rest: 'valinnainen loppupäivä',
      },
      {
        strong: 'Kolme tapaa liittyä',
        rest: 'tiedot, ”I’m going” tai ilmoittautumiset',
      },
      {
        strong: 'Muistutus',
        rest: '15 minuuttia ennen ja alussa',
      },
    ],
    footnote: 'Viikkokilpailut ovat kohdassa [Skill- ja Boss of the Week]({weeklyGuide}); maksut ja palkinnot kohdassa [Maksut ja palkkaukset]({feesGuide}).',
    create: {
      title: 'Ajasta yksi',
      intro: 'Avaa ylläpitovalikosta **Clan events** ja täytä lomake:',
      rows: [
        {
          term: 'Nimi, aika, pituus',
          body: '**Name**, **Starts (your time)** omassa aikavyöhykkeessäsi ja **Minutes**.',
        },
        {
          term: 'Toistot',
          body: '**Just once** tai **Every week**, valinnaisella **Until**-päivämäärällä.',
        },
        {
          term: 'Missä',
          body: '**Where**, **World** ja **Host**, sekä kuva: valitse boss tai taito, tai lataa oma.',
        },
        {
          term: 'Tiedot',
          body: 'varusteet, vaatimukset, mitä tuoda mukana.',
        },
        {
          term: 'Kuka tulee',
          body: '**Just information** (ei nappia, ei lukua), **“I’m going”** (yksi napautus, näyttää määrän) tai **Sign-ups** (paikat, kysymykset ja maksu).',
        },
        {
          term: 'Discord',
          body: '**Post to** kanavaan (tai klaanin oletukseen), valinnaisesti linkitettävät **Chat**-, **Guide**- ja **Voice**-kanavat sekä se, pingataanko jäsenrooli ilmoituksessa, muistutuksessa ja alussa.',
        },
      ],
      outro: 'Paina **Schedule it**. Maksut ja kysely lisätään tapahtuman omalta sivulta myöhemmin.',
    },
    discord: {
      title: 'Mitä Discord näkee',
      body: [
        'Ilmoitus nousee, kun ajastat sen, ja se muokataan paikallaan aina kun muutat jotain, joten vanhentunutta kopiota ei koskaan ole. Toistuva tapahtuma merkitään **every week**.',
        'Viisitoista minuuttia ennen se julkaisee **Starting in 15 minutes**, ja alussa **Starting now**. Jos siirrät aikaa, muistutukset siirtyvät mukana. Kun peruutat sen (**Cancel**), julkaisu merkitään **Cancelled**, ettei kukaan tule paikalle.',
      ],
    },
    manage: {
      title: 'Ilmoittautumiset, maksut ja palkkaukset',
      intro: 'Avaa tapahtuma muuttaaksesi, mitä se käyttää. Kaikki alkaa pois päältä:',
      rows: [
        {
          term: 'Ilmoittautumiset',
          body: '**Places**-kentällä (tyhjä = ei rajaa), kun **Sign-ups close**, ja **Sign-up questions**. **You approve each one** pakottaa jokaisen ilmoittautumisen odottamaan henkilökuntaa.',
        },
        {
          term: '”I’m going”-painike',
          body: 'pois päältä se on vain tieto: ei nappia eikä lukua sivustolla, lisäosassa tai Discordissa.',
        },
        {
          term: 'Osallistumismaksu',
          body: 'kytkee ilmoittautumiset päälle. Lisää omat gp potiin kohdassa **Added to the pot**.',
        },
        {
          term: 'Maksut',
          body: 'potti on maksut plus lisäämäsi. Nimeä **Who** saa mitä ja **For** mistä, ja merkitse kukin **Paid**. Anvil varoittaa, jos maksat enemmän kuin potissa on.',
        },
        {
          term: 'Kysely jälkeenpäin',
          body: 'avautuu, kun tapahtuma päättyy. Vain henkilökunta näkee vastaukset. Jos siinä oli ilmoittautumiset, kysytään vain ilmoittautuneilta.',
        },
        {
          term: 'Viikoittainen tapahtuma',
          body: '**Every week is…** **Its own** (ilmoittautumiset, potti ja kysely joka viikko) tai **One run** (yksi ilmoittautuminen, potti ja kysely koko sarjalle).',
        },
      ],
    },
    players: {
      title: 'Mitä jäsenet näkevät',
      body: [
        'Tapahtumasivu näyttää **When**, **Where**, **Host**, **Discord**, **Entry** ja **Prizes**, ja **Live now** kun se on käynnissä. Jäsenet painavat **I’m going** tai **Sign me up**, tai **Ask to sign up**, kun henkilökunta hyväksyy jokaisen. Se on myös lisäosan sivupaneelin **Clan**-välilehdellä samoilla napeilla.',
        'Vain klaanin jäsenet voivat ilmoittaa menevänsä tai ilmoittautua.',
      ],
    },
    calendar: {
      title: 'Aikataulu',
      body: [
        '**Schedule** laittaa taulut, viikkokilpailut ja klaanitapahtumat yhdelle kalenterille, jokaiselle oma suodatin.',
        'Kaikki kahden tai useamman päivän jakso, jossa ei ole mitään, merkitään aukoksi, ja **Fill the gap** ajastaa jotain siihen. Käytä sitä pitämään klaani aktiivisena isojen tapahtumien välissä, ettei hiljainen kaksi viikkoa pääse liukumaan ohi.',
      ],
    },
  },
  challenges: {
    metaTitle: 'Haasteet ja kaveritapahtumat — Anvil',
    metaDescription: 'Kaksintaistohaasteet Anvilissa (ensin drop, eniten tappoja tai eniten XP 1 tunnissa, 24 tunnissa tai 7 päivässä) ja Supporter-kaveritapahtumat: yksityiset taulut kavereillesi yhden kutsulinkin takana.',
    eyebrow: 'Anvil · pelaajille',
    title: 'Haasteet ja kaveritapahtumat',
    dek: 'Kaksi tapaa pelata ihmisiä vastaan, jotka tunnet ilman klaanitapahtumaa: **haaste** on yksi pelaaja yhtä vastaan, ja **kaveritapahtuma** on yksityinen taulu ryhmälle kutsulinkin takana.',
    facts: [
      {
        strong: '1 tunnista 7 päivään',
        rest: 'haastetta kohden',
      },
      {
        strong: 'Kerskailuoikeudet',
        rest: 'ei panoksia, ei gp:tä',
      },
      {
        strong: 'Enintään 50 kaveria',
        rest: 'kaveritapahtumaa kohden tason mukaan',
      },
    ],
    footnote: 'Tasot ja mitä kukin isännöi ovat kohdassa [Anvil Supporter: tasot ja edut]({supporterGuide}).',
    start: {
      title: 'Haasta joku',
      intro: 'Tarvitset vahvistetun hahmon, ja samoin hän.',
      steps: [
        'Avaa [Challenges](/challenges) tai paina **Challenge <name>** pelaajan profiilissa.',
        'Kohdassa **Who** kirjoita hänen nimensä, ja kohdassa **Playing as** valitse oma hahmosi. Sen on oltava vahvistettu.',
        'Valitse kilpailu: **First to a drop** (enintään 5 esinettä, kaikki hirviödropit), **Most kills** bossista tai **Most XP** yhdessä taidossa tai yleisesti.',
        'Valitse aikaraja: **1 hour**, **24 hours** tai **7 days**. Rastita **OK to show the result publicly**, jos et välitä siitä, että se nähdään; se on julkinen vain, jos rastitte molemmat.',
      ],
      outro: 'He saavat ilmoituksen ja Discord-viestin, ja heillä on 24 tuntia valita **Accept**, **Decline** tai **Decline and block**. Kello alkaa, kun he hyväksyvät.',
    },
    rules: {
      title: 'Miten ratkaistaan',
      intro: 'Anvil ratkaisee sen itse, minuutin sisällä lopusta.',
      rows: [
        {
          term: 'Tappot ja XP',
          body: 'molemmat aloitusrivit otetaan, kun se hyväksytään; kumpi kasvaa enemmän loppuun mennessä, voittaa, ja tasainen kasvu on tasapeli. Hiscoret ja lisäosa lasketaan molemmat, kumpi tahansa on korkeampi.',
        },
        {
          term: 'First to a drop',
          body: 'ensimmäinen teistä, joka saa yhden esineistä, voittaa siinä ja silloin. Dropit näkee vain lisäosa, joten teidän molempien pitää pitää sitä käynnissä. Jos kukaan ei saa sitä ajoissa: tasapeli.',
        },
        {
          term: 'Peruminen',
          body: 'voit vetää oman haasteesi pois, kunnes siihen vastataan. Kun se on käynnissä, se pysähtyy vain, jos te molemmat olette samaa mieltä.',
        },
      ],
    },
    limits: {
      title: 'Rajat ja kieltäytyminen',
      body: [
        'Avoimet haasteet (odottavat tai käynnissä, lähetetyt tai vastaanotetut) ovat rajattu tason mukaan: **1** ilmaiseksi, **5** Supportereille, rajaton Championeille ja Patroneille. Kuka tahansa voi aloittaa enintään 20 päivässä, ja vain yhden kerrallaan saman henkilön kanssa.',
        'Etkö halua niitä? **Turn away all new challenges**, tai estä yksi henkilö, kun hylkäät. Joka haastaa sinut, näkee saman hylkäyksen kummassakin tapauksessa, joten hän ei voi tietää, että hänet estettiin.',
        'Sivulla pidetään **Your record** (voitot, tappiot ja tasapelit), mikä on **Open now** ja **Your limit**.',
      ],
    },
    friends: {
      title: 'Isännöi kaveritapahtuma',
      body: [
        'Mikä tahansa Supporter, Champion tai Patron voi ajaa yksityisen taulun kavereille sivulta [Host](/host) → **Host for friends** → **New friends event**. Se on täysi taulu: bingo tai ruutukisa, lisäosan seuraama, samalla asetuksella kuin luojan tapahtuma.',
        'Lähetä **Invite link**; se on ainoa tapa sisään. Kaverit avaavat sen, kirjautuvat Discordilla sisään ja painavat **Open the event**. Liittyminen on aina ilmaista. Jos linkki vuotaa, tee uusi: vanha lakkaa toimimasta, ja jo mukana olevat pysyvät mukana.',
        'Kaveritapahtumaa ei koskaan listata missään Anvilissa, eikä se tarvitse klaania.',
      ],
      table: {
        areaLabel: 'Taso',
        columns: [
          'Pelaajat',
          'Käynnissä kerralla',
        ],
        rows: [
          {
            area: 'Supporter',
            cells: [
              '10',
              '1',
            ],
          },
          {
            area: 'Champion',
            cells: [
              '25',
              '1',
            ],
          },
          {
            area: 'Patron',
            cells: [
              '50',
              '2',
            ],
          },
        ],
      },
      note: {
        tag: 'Jos tasosi päättyy',
        body: 'Jo mukana olevat pysyvät mukana. Uudet kaverit eivät voi liittyä uuden rajan yli, eikä sinä voi aloittaa toista, ennen kuin olet alle rajan.',
      },
    },
  },
  clanHall: {
    metaTitle: 'Klaanien, tapahtumien ja tulostaulujen etsiminen — Anvil',
    metaDescription: 'OSRS-klaanin etsiminen Anvilin Clan Hallista, kahden klaanin vertailu, viikoittaiset pelaaja- ja klaanitulostaulut, julkinen tapahtumalista ja peliklaanien sivut klaaneille, jotka eivät ole Anvilissa.',
    eyebrow: 'Anvil · pelaajille ja klaaneille',
    title: 'Klaanien, tapahtumien ja tulostaulujen etsiminen',
    dek: 'Anvilin julkiset sivut katselemiseen: **Clan Hall** klaanin löytämiseen, **Events**-lista, josta löytää liityttävää, ja **Leaderboard** nähdäksesi, kuka kasvaa eniten.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: 'vain julkiset klaanit',
      },
      {
        strong: 'Leaderboard',
        rest: 'tämä viikko, 30 päivää, kaikki aika',
      },
      {
        strong: 'Events',
        rest: 'vain mitä isäntä mainosti',
      },
    ],
    footnote: 'Oman klaanisi listaamiseen katso [Klaanin perustaminen]({clanGuide}); boostatut klaanit ovat esillä, katso [Klaanin boostaaminen]({boostsGuide}).',
    hall: {
      title: 'The Clan Hall',
      body: [
        '[Clan Hall](/clans) listaa jokaisen julkisen klaanin. Hae nimellä tai iskulauseella ja kavenna **Taking members** tai **Open to challenges**. **Most active** (järjestys, jossa se avautuu) asettaa ensin klaanit, joiden jäsenet kasvoivat eniten tällä viikolla; **Biggest** lajittelee jäsenmäärän mukaan.',
        'Jokainen kortti kertoo, onko klaani **Recruiting**-tilassa ja miten se ottaa vieraita: **Guests welcome**, **Guests by approval** tai **No guests**. Boostatut klaanit saavat esillä-rivit ylhäälle, ja luojilla on oma rivinsä.',
      ],
      note: {
        tag: 'Ei listattu?',
        body: 'Vain julkisiksi asetetut klaanit näkyvät, ja klaani voi kytkeä listauksensa pois asetuksissaan. Yksityiset klaanit eivät koskaan ole Clan Hallissa, tulostaulussa tai vertailuissa.',
      },
    },
    compare: {
      title: 'Vertaile kahta klaania',
      body: [
        '[Compare clans](/compare/clans) asettaa kaksi listattua klaania rinnakkain. Jos haluat verrata kahta hahmoa, käytä [Compare](/compare)-sivua.',
      ],
    },
    board: {
      title: 'Tulostaulu',
      body: [
        '[Leaderboard](/leaderboard) järjestää pelaajat ja klaanit kokemuksen, tehokkaiden tuntien ja bossaamisen mukaan **This week**, **30 days** tai **All time**. Pelaajia voi kaventaa **Regular**-, **Ironman**-, **Hardcore**-, **Ultimate**- tai **Group**-tileihin.',
        'Klaanit järjestetään jäsentensä saaman XP:n mukaan. Vain vahvistetut ja Clan Hallissa listatut klaanit näkyvät. Vieraan kasvu lasketaan hänen omalle klaanilleen, ei sille, jossa hän on vieraana.',
      ],
    },
    events: {
      title: 'Etsi liityttävä tapahtuma',
      body: [
        '[Events](/events) listaa Anvilissa käynnissä olevat ja tulevat tapahtumat. Suodata **Live now**, **Open to join** tai **Starting this week**, muodon tai **Solo**-tilan mukaan, **Anyone can join** tai **Ask or meet a rule** -ehdon mukaan sekä **Clans** tai **Creators** mukaan. **Join** vie ilmoittautumiseen.',
        'Vain tapahtumat, joiden isäntä kytki **Advertise on Anvil** päälle, näkyvät. Vain jäsenille ja vain kutsulla olevat tapahtumat eivät koskaan näy.',
      ],
    },
    ghost: {
      title: 'Peliklaanit, jotka eivät ole Anvilissa',
      body: [
        'Hahmon sivu nimeää pelissä olevan klaanin. Jos se klaani ei ole Anvilissa, linkki avaa tavallisen sivun, jossa listataan Anvil-pelaajat, jotka ovat siinä ja päättivät näyttää sen. Se ei ole kyseisen klaanin rosteri, eikä mikään sivulla tee kenestäkään jäsentä.',
        'Jos se on sinun klaanisi, **Bring your clan to Anvil** perustaa sellaisen. Kun se on julkinen Anvil-klaani, linkki vie suoraan siihen.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: 'Peliohjeet: lukeminen, ehdottaminen ja klaanikopiot — Anvil',
    metaDescription: 'Anvilin ohjekirjasto: raidi-, boss-, skillaus- ja rahanteko-ohjeet sivustolla, pelissä ja Discordissa. Lukeminen tason mukaan, uuden ohjeen tai muokkauksen ehdottaminen sekä se, miten klaani kopioi ja muokkaa kirjaston ohjeita.',
    eyebrow: 'Anvil · pelaajille ja klaanin henkilökunnalle',
    title: 'Peliohjeet',
    dek: 'Näiden ohjesivujen lisäksi Anvililla on kirjasto peliohjeita: raidit, bossit, skillaus ja rahanteko. Kuka tahansa voi lukea niitä, kirjautunut voi ehdottaa, ja klaani voi pitää omat kopionsa.',
    facts: [
      {
        strong: 'Kolme tasoa',
        rest: 'Beginner, Intermediate, Advanced',
      },
      {
        strong: 'Kuka tahansa voi ehdottaa',
        rest: 'henkilökunta tarkistaa jokaisen',
      },
      {
        strong: '/guide',
        rest: 'julkaisee yhden Discordissa',
      },
    ],
    footnote: 'Kauttaviivakomennot ovat kohdassa [Kauttaviivakomennot]({commandsGuide}).',
    read: {
      title: 'Ohjeen lukeminen',
      body: [
        'Avaa **In-game guides** -välilehti ohjesivulla tai [/guides](/guides) klaanisi sivustolla. Klaanin listalla on sen omat ohjeet ja kaikki kirjaston ohjeet, joita se ei ole kopioinut.',
        'Monissa ohjeissa on tasokytkin yläreunassa: **Beginner**, **Intermediate** ja **Advanced**. Muiden tasojen osat taittuvat kiinni, joten ensikertalainen ja nopeuspelaaja lukevat saman sivun.',
        'Discordissa `/guide` ja nimen alku julkaisevat ohjeen kortin, jossa on linkki koko sivulle.',
      ],
    },
    propose: {
      title: 'Ehdota ohjetta tai muokkausta',
      body: [
        'Kirjautuneena avaa [Propose a guide](/guides/propose) kirjoittaaksesi uuden tai ehdottaaksesi muokkausta olemassa olevaan kirjastoohjeeseen. Kerro tarkistajalle, mitä muutit ja miksi; voit näyttää muutoksesi nykyistä ohjetta vasten ennen lähetystä.',
        'Paina **Send for review**. [My guide proposals](/guides/proposals) näyttää jokaisen **pending**-, **approved**-, **rejected**- tai **withdrawn**-tilassa ja tarkistajan muistiinpanon, kun se on vastattu. Kun se odottaa, voit muokata sitä tai **Withdraw** sen. Voit olla 5 odottamassa kerrallaan.',
        'Mikään ei mene julki ennen kuin Anvilin ohjetoimittajat hyväksyvät sen. Hyväksytty muokkaus päivittää myös jokaisen klaanikopion, jota ei ole muutettu.',
      ],
    },
    clan: {
      title: 'Klaanisi ohjeet',
      intro: 'Ylläpitäjät ja ohjeiden kirjoittamiseen oikeutetut moderaattorit hallitsevat niitä ylläpitovalikon kohdassa **Guides**.',
      rows: [
        {
          term: 'Show library guides on our site',
          body: 'päällä: kirjaston ohjeet, joita et ole kopioinut, näkyvät myös Guides-sivullasi, aina ajantasaisina.',
        },
        {
          term: 'Kopioi omiin ohjeisiin',
          body: 'tekee klaanikopion. Se **seuraa kirjastoa**, kunnes muokkaat sitä, ja saa jokaisen kirjastomuutoksen.',
        },
        {
          term: 'Kopion muokkaaminen',
          body: 'tekee siitä **customised**-kopion, klaanin oman. Kun kirjastoohje muuttuu myöhemmin, se näyttää **update available**: ota uusi versio tai pidä oma.',
        },
        {
          term: 'Uusi ohje',
          body: 'kirjoittaa sellaisen, jonka vain klaanisi omistaa, kuten oma raidisääntösi tai massaohje.',
        },
      ],
      note: {
        tag: 'Ohjeiden julkaiseminen',
        body: 'Ohjeita voi julkaista Discord-kanavalle, ja nämä julkaisut muokataan paikallaan, kun ohje muuttuu.',
      },
    },
  },
};

export default fi;
