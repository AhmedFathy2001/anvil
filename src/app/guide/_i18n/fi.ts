import type { PartialGuideDict } from './en';

// Suomi — Finnish.
//
// Sama käytäntö kuin kaikissa muissakin kielitiedostoissa: kaikki, mitä lukija NÄKEE ruudullaan,
// jää englanniksi — RuneLiten ja OBS:n valikot, pluginin omat chat-rivit, ja Anvilin omat
// hallintapaneelin nimikkeet, jotka ovat englanniksi kunnes sekin pinta käännetään. Käännetty
// "Tracked drop detected" on rivi, jota kukaan ei löydä uudestaan. Kaikki muu — selitys, järjestys,
// miksi — on suomea.

const fi: PartialGuideDict = {
  common: {
    contents: 'Sisältö',
    step: 'Vaihe',
    optional: 'valinnainen',
    minRead: '{n} min lukuaika',
    language: 'Kieli',
    partialNotice:
      'Tämä opas on käännetty {language} vain osittain. Kääntämättä jäänyt osuus näkyy englanniksi.',
    backToGuides: 'Kaikki oppaat',
    unreviewedNotice:
      'Kukaan äidinkielinen puhuja ei ole vielä lukenut tätä {language} käännöstä läpi. Jos jokin lause tuntuu väärältä, [englanninkielinen sivu]({englishHref}) on alkuperäinen — ja [ilmoittaminen](/feedback) on se, mikä saa sen korjatuksi.',
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
    },
    cards: {
      plugin: {
        eyebrow: 'Pelaajille',
        title: 'RuneLite-pluginin käyttöönotto',
        blurb:
          'Asenna plugin, yhdistä se tähän sivustoon ja anna sen lähettää dropit puolestasi. Kattaa myös Discord-ilmoitukset ja OBS-leikkeet.',
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
    },
  },

  plugin: {
    metaTitle: 'RuneLite-pluginin käyttöönotto — Anvil',
    metaDescription:
      'Asenna Anvilin RuneLite-plugin, yhdistä se tähän sivustoon ja ota käyttöön Discord-ilmoitukset sekä OBS-leikkeet.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Käyttöönotto-opas pelaajille',
    dek: 'Asenna se, osoita se kohteeseen {clanName} ja pelaa. Plugin lähettää bingo-droppisi, julkaisee harvinaiset droppisi ja kuolemasi Discordiin ja — jos käytät OBS:ää — tallentaa ja julkaisee leikkeet hetkistä, jotka kannattaa katsoa uudelleen.',
    facts: [
      { strong: '2 kenttää', rest: 'ja seuranta on käynnissä' },
      { strong: '~3 min', rest: 'perusasetuksiin' },
      { strong: 'Leikkeet', rest: 'vaativat OBS:n + 5 minuuttia lisää' },
    ],
    footnote:
      'Kuvakaappaukset ovat oikeasta asennuksesta — tilin token, OBS-osoite ja Discord-webhook on peitetty tarkoituksella. Omiesi kuuluu pysyä yhtä yksityisinä.',

    install: {
      title: 'Asenna plugin',
      body: [
        'RuneLitessä: **Configuration** (jakoavain) → **Plugin Hub** → hae **Anvil** → **Install**. Julkaisija on `AhmedFathy2001`.',
        'Yksi plugin palvelee kaikkia klaaneja — osoitat sen tähän sivustoon seuraavassa vaiheessa, joten mitään klaanikohtaista ei tarvitse ladata. Kun se on asennettu, avaa **Configuration → Anvil** päästäksesi asetuspaneeliin, jota tässä oppaassa käytetään läpi koko matkan.',
      ],
    },

    connect: {
      title: 'Yhdistä tähän sivustoon',
      intro: 'Vain **Setup**-osio on tärkeä alkuun pääsemiseksi. Kaikella muulla on järkevät oletusarvot.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Anvil-pluginin Setup-osio, jossa Site URL- ja Account Token -kentät on kehystetty',
        legend: [
          {
            label: 'Site URL',
            body: 'kohteelle {clanName} se on `{origin}`. Kenttä on tyhjä alusta asti, joten se on täytettävä. Loppukauttaviivaa ei tarvita, ja `https://` lisätään jos jätät sen pois.',
          },
          {
            label: 'Account Token',
            body: 'henkilökohtainen avaimesi tähän sivustoon. Anna joko pluginin täyttää se puolestasi (alla) tai liitä se itse. Kohtele sitä kuin salasanaa.',
          },
        ],
      },
      easyHeading: 'Helppo tapa: kirjaudu sisään pluginista',
      easyIntro:
        'Kun Site URL on asetettu ja token vielä tyhjä, **Anvilin sivupaneeli** näyttää **Sign in with Discord** -painikkeen. Klikkaa sitä, niin plugin opastaa sinut läpi — mitään ei tarvitse kopioida.',
      easySteps: [
        'Paneeli näyttää koodin ja avaa selaimesi tähän sivustoon.',
        'Tarkista että sivun koodi vastaa RuneLitessä näkyvää, ja klikkaa sitten **Approve**.',
        'Paneeli sanoo _Signed in_ ja täyttää Account Tokenin puolestasi.',
      ],
      linkFigure: {
        caption: 'Tämä sivusto → /link-device',
        alt: 'Link your RuneLite client -sivu, jossa koodikenttä ja Approve-painike on kehystetty',
        legend: [
          { label: 'Koodi', body: 'sen on vastattava sitä, mitä plugin näyttää sinulle juuri nyt.' },
          {
            label: 'Approve',
            body: 'hyväksy vain koodi, jonka _oma_ asiakasohjelmasi näyttää. Jos joku lähetti sinulle linkin tai koodin, hylkää se — hyväksyminen luovuttaisi heille tilisi.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Miksi toinen verkkotunnus ilmestyy',
        body: [
          'Hyväksyntä tapahtuu täällä, osoitteessa `{origin}`. Jos et ole vielä kirjautunut sivustolle, itse kirjautumisvaihe kulkee Anvilin jaetun Discord-kirjautumisen kautta osoitteessa `anvilosrs.com` vahvistaakseen Discord-henkilöllisyytesi, ja palauttaa sinut sitten suoraan takaisin tänne — se on sama kirjautuminen jonka saat tämän sivuston Login-painikkeesta, ei osa pluginin kulkua.',
          'Plugin itse puhuu vain osoitteen `{origin}` kanssa: se kieltäytyy avaamasta kirjautumissivua, joka ei ole kirjoittamassasi Site URL -osoitteessa.',
        ],
      },
      directNote: {
        tag: 'Missä tämä tapahtuu',
        body: [
          'Koko kulku pysyy osoitteessa `{origin}` — koodi myönnetään täällä, hyväksytään täällä {clanName}:n omalla Discord-kirjautumisella, ja token luovutetaan täällä. Plugin kieltäytyy avaamasta kirjautumissivua, joka ei ole kirjoittamassasi Site URL -osoitteessa, joten mikään tässä vaiheessa ei päädy toiseen Anvil-asennukseen.',
        ],
      },
      federationAside:
        'Ei pidä sekoittaa sivupaneelin **Connect clans** -painikkeeseen — se on erillinen, vapaaehtoinen painike joka yhdistää sinut muihin Anvil-klaaneihin, ja se ilmestyy vasta kun olet jo kirjautunut täällä.',
      manualFallback:
        'Jos selain ei aukea itsestään, paneeli tulostaa osoitteen ja koodin, jotta voit avata sen käsin. Koodit vanhenevat kymmenessä minuutissa — paina vain painiketta uudelleen.',
      manualHeading: 'Käsityötapa: kopioi tokenisi',
      manualIntro:
        'Kirjaudu sisään Discordilla ja avaa [Profile](/profile), ja vieritä sitten kortille **RuneLite plugin**.',
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
            body: 'kopioi se pluginin Account Token -kenttään. Rotate myöntää uuden ja tappaa vanhan — käytä sitä jos epäilet tokenisi vuotaneen.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Hyvä tietää',
        body: ['Yksi token kattaa kaikki tapahtumat joihin olet täällä ilmoittautunut — sitä ei tarvitse liittää uudelleen bingoa kohden.'],
      },
    },

    accounts: {
      title: 'Yhdistä tilisi — pelaa vain',
      body: [
        'Mitään yhdistämiskoodia ei tarvitse kirjoittaa. Kun token on paikallaan, se tili jolla kirjaudut sisään yhdistetään profiiliisi automaattisesti.',
        'Plugin lähettää pelinsisäisen nimesi sekä pysyvän tilisormenjäljen jokaisen pyynnön mukana, ja sivusto tunnistaa ensin sormenjäljestä — joten yhteytesi kestävät nimenvaihdon. Kirjaudu alt-tilille kerran, niin se ilmestyy profiiliisi otsikon _Accounts we noticed you playing_ alle yhden klikkauksen **Add**-painikkeen kera.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Profiilisivun RuneScape Accounts -kortti, jossa on listattu pluginin kautta vahvistetut tilit',
        legend: [
          {
            label: 'Yhdistetyt tilisi',
            body: 'kaikki mikä on merkitty “Verified via plugin” päätyi sinne pelkästään pelaamalla. Lisää niin monta alt-tiliä kuin haluat; yksi niistä on päätilisi.',
          },
        ],
      },
      noPluginHeading: 'Etkö voi käyttää pluginia?',
      noPluginIntro:
        'Mobiililla tai virallisella asiakasohjelmalla yhdistät tilin verkkosivulla sen sijaan — profiilisivu näyttää molemmat vaihtoehdot:',
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
        'Sinun pitäisi myös nähdä **Anvilin sivupaneelin** täyttyvän tapahtumallasi, joukkueellasi ja ruutuedistymiselläsi — sekä **Bingo**-välilehden ilmestyvän pelinsisäiseen Collection Logiin.',
      guestNote: {
        tag: 'Vieras vai jäsen',
        body: 'Jos chat sanoo _Tracked as a guest_, sinua seurataan mutta et ole vielä klaanin jäsenlistalla. Ylläpitäjä korjaa sen synkronoimalla jäsenlistan pelistä — kysy {discordLink}.',
        discordWord: 'Discordissa',
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
            label: 'Auto Submit Drops',
            body: 'ottaa kuvakaappauksen ja lähettää seuratun dropin siinä hetkessä kun se putoaa. Jätä päälle; siinä on koko idea.',
          },
          {
            label: 'Show Overlay',
            body: 'piirtää pienen _Anvil / joukkue / UTC-päivämäärä_ -paneelin vasempaan yläkulmaan. Siitä tulee osa todistekuvakaappaustesi kuvaa, ja juuri se tekee todisteen väärentämisestä tai taannehtivasta päiväämisestä vaikeaa. Se on pois päältä tässä kuvassa — laita se päälle jos klaanisi haluaa joukkueen ja ajan näkyviin jokaiseen todisteeseen.',
          },
          {
            label: 'Team completion popups',
            body: 'banneri kun kuka tahansa joukkueestasi saa ruudun valmiiksi. Useita kerralla: vaikein saa bannerin, loput menevät chattiin.',
          },
          {
            label: 'Bingo tab in Collection Log',
            body: 'sijoittaa taulusi pelinsisäiseen Collection Logiin, tallennettujen todisteidesi viereen.',
          },
          {
            label: 'Banner sound + volume',
            body: 'soittaa äänen bannerin kanssa. Mitään ei soi ennen kuin lisäät itse vähintään yhden .wav-tiedoston sen Bingo-välilehden “Banner sounds” -painikkeesta.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'leipoo kuvakaappaukseen toisen ruudun pari sekuntia myöhemmin, kun loot on asettunut maahan. Pidä päällä; se säästää kiistoilta.',
          },
        ],
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
        'Nämä lähtevät riippumatta siitä onko bingo käynnissä, ja ne julkaistaan klaanin kanaviin. Minkä kanavan ylläpitäjät määrittävät täällä — sinä valitset vain _mitä_ julkaiset.',
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
            body: 'kaksi toisistaan riippumatonta reittiä julkaisuun: arvoltaan vähintään näin paljon (GE tai high alch, kumpi on korkeampi), tai harvinaisempi kuin 1/N (oletuksena 1/10 000 — löysemmät asetukset täyttävät kanavan yrttiheitoilla). Klaanisi voi asettaa harvinaisuusrajan joka koskee kaikkia; omasi pätee silti kun se on tiukempi. Aseta jompikumpi nollaan sulkeaksesi sen reitin.',
          },
          { label: 'Screenshot rare drops', body: 'liitä kuva mukaan, ei pelkkää tekstiä.' },
          {
            label: 'Loot key value',
            body: 'loot key julkaistaan kerran, yhtenä ilmoituksena, kun sen koko sisältö ylittää tämän luvun.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'petit julkaistaan harvinaisten droppien kanavaan.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Ilmoitusosio Combat achievements, jossa jokainen asetus on kehystetty ja numeroitu',
        legend: [
          { label: 'Notify on combat achievements', body: 'suoritetut tasot julkaistaan aina kun tämä on päällä.' },
          {
            label: 'CA task min tier',
            body: 'kuinka äänekkäitä yksittäiset tehtävät ovat. Elite tässä; oletus on Master. Aseta Grandmasteriin jos haluat vain kaikkein harvinaisimmat.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99:t, joka 100. kokonaistaso 1800:sta ylöspäin, sekä max.',
          },
          { label: 'Notify on diary completions', body: 'achievement diary -tasot.' },
          {
            label: 'Announce quest completions',
            body: 'valitsemastasi vaikeustasosta ylöspäin. “All quests” tässä; oletus on Master ja ylöspäin.',
          },
        ],
      },
    },

    clips: {
      title: 'Leikkeet OBS:llä',
      intro: [
        'Paina yhtä näppäintä, niin viimeiset 30 sekuntia tallentuvat ja päätyvät klaanin leikekanavaan. Se on pois päältä oletuksena ja vaatii OBS:n käynnissä — mutta se on lähinnä kooste-videota mitä klaanisi saa.',
        'Näin se toimii: OBS pitää yllä liukuvaa **replay bufferia** viimeisistä X sekunnista. Pikanäppäimesi käskee OBS:ää kirjoittamaan bufferin tiedostoon, ja plugin poimii tiedoston ja lataa sen liittämääsi Discord-webhookiin.',
      ],
      privacyNote: {
        tag: 'Minne videosi päätyy',
        body: 'Leikkeet ladataan **suoraan koneeltasi Discordiin**. Ne eivät koskaan kulje tämän sivuston kautta, eikä mitään ladata lainkaan jos jätät webhook-kentän tyhjäksi — silloin leikkeet jäävät koneellesi.',
      },
      obsHeading: 'A. Aseta OBS (kerran)',
      obsSteps: [
        'Tarvitset **OBS Studio 28:n tai uudemman** — WebSocket-palvelin on sisäänrakennettu versiosta 28 alkaen, ei erillistä latausta.',
        'Varmista että OBS todella kaappaa pelin: Game / Window / Display Capture -lähde joka näyttää RuneLiten. Jos OBS ei näe asiakasohjelmaasi, leikkeistäsi tulee musta suorakulmio.',
        '**Settings → Output** → rastita **Enable Replay Buffer**. (Simple output -tilassa se on Recording-sivulla; Advanced-tilassa sillä on oma välilehtensä.) Tarkista samalla että tallennuspolulla on tilaa.',
        '**Tools → WebSocket Server Settings** → rastita **Enable WebSocket server**. Merkitse muistiin **Server Port** (oletuksena 4455) ja klikkaa **Show Connect Info** saadaksesi salasanan.',
      ],
      obsAside:
        'Sinun _ei_ tarvitse painaa “Start Replay Buffer” — plugin käynnistää sen puolestasi kun se yhdistää, ja käynnistää uudelleen aina kun muutat leikkeen pituutta.',
      fillHeading: 'B. Täytä pluginin asetukset',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Pluginin asetusten Clips-osio, jossa jokainen asetus on kehystetty ja numeroitu; OBS-isäntä ja webhook-osoite on piilotettu',
        legend: [
          { label: 'Enable clip capture', body: 'pääkytkin. Pois päältä plugin ei puhu OBS:n kanssa lainkaan.' },
          {
            label: 'Capture clip hotkey',
            body: 'aseta se, tai mitään ei koskaan tapahdu. Valitse jotain jota et osu vahingossa kesken raidin.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` kun OBS pyörii samalla koneella kuin RuneLite. Jos OBS on toisella koneella, laita sen koneen paikallinen IP tähän — piilotettu tässä kuvassa — ja avaa portti sen palomuurissa. Portti ja salasana löytyvät kohdasta _Show Connect Info_; jätä salasana tyhjäksi jos otit OBS:n tunnistautumisen pois.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'kaikki sitä suurempi tallennetaan paikallisesti ja mainitaan hillitysti chatissa julkaisemisen sijaan. Aseta se sen mukaan mitä Discord-palvelimesi oikeasti hyväksyy; plugin tulee arvolla 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'kuinka kauas taaksepäin kukin leike ulottuu. Tämä kirjoittaa bufferin pituuden OBS-profiiliisi, joten OBS tarvitsee sen verran sekunteja etumatkaa ennen kuin täysipituinen leike on edes olemassa. Pidemmät leikkeet = isommat tiedostot; 30 on hyvä keskitie.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 näkyy esikatseluna ja soi suoraan Discordissa; MKV on ladattava ensin. Huomaa että tämä muuttaa OBS:n tallennusmuotoa, mikä vaikuttaa myös tavallisiin tallenteisiisi. Ota pois päältä jättääksesi OBS:n rauhaan.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'minne leikkeet julkaistaan — pyydä ylläpitäjältä leikekanavan webhook. Tyhjä = leikkeet pysyvät koneellasi. Piilotettu tässä, ja syystäkin: kuka tahansa jolla on tämä osoite voi julkaista siihen kanavaan.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'käsittelee myös tallennukset jotka OBS itse tai “Save Replay Buffer for OBS” -plugin käynnistää. Jätä pois päältä jos ajat kahta RuneLite-asiakasta yhtä OBS:ää vasten, tai jokainen leike julkaistaan kahdesti.',
          },
        ],
      },
      useHeading: 'C. Käytä sitä',
      useIntro: 'Jotain hauskaa tapahtuu → paina pikanäppäintäsi → chat opastaa sinut läpi:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Muista',
        body: 'Leike kattaa sekunnit _ennen_ näppäimen painamista — joten paina hetken jälkeen, älä sen aikana. Sinulla on koko bufferin pituus aikaa reagoida.',
      },
      decodedHeading: 'Leikeviestit, selitettyinä',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS ei ole käynnissä, WebSocket-palvelin on pois päältä, tai isäntä/portti/salasana eivät täsmää. Korjaa ja paina uudelleen — plugin yrittää yhteyttä itse 30 sekunnin välein.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Buffer ei ole käynnissä. Tarkista Enable Replay Buffer OBS:n output-asetuksista, ja käännä sitten Enable clip capture pois ja takaisin päälle.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Toimii kuten pitääkin, sinulla ei vain ole webhookia asetettuna. Tiedosto on OBS:n tallennuskansiossasi.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Lyhennä leikkeen pituutta, laske OBS-tallenteen laatua, tai nosta maksimikokoa jos palvelimesi hyväksyy isompia tiedostoja.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Liian iso, rate-limitattu, tai lataus aikakatkaistiin. Tiedosto on yhä koneellasi — julkaise se käsin jos se on sen arvoinen.',
        },
      ],
    },

    trouble: {
      title: 'Kun jokin menee rikki',
      intro:
        'Plugin kertoo chatissa kun seuranta on pysähtynyt — se odottaa noin 90 sekuntia ennen valittamista ja toistaa korkeintaan 5 minuutin välein.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token on väärä tai se on kierrätetty. Kopioi se uudelleen kohdasta [Profile → RuneLite plugin](/profile#plugin-token), tai tyhjennä kenttä ja kirjaudu pluginista uudelleen.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Tarkista Site URL kirjoitusvirheiden varalta — sen pitäisi olla `{origin}`. Jos se on oikein, sivusto on todennäköisesti alhaalla.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Sitä tiliä ei ole vielä yhdistetty. Lisää se kohdasta Profile → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ei mitään. Se korjaantui itsestään.',
        },
      ],
      logHeading: 'Yhä jumissa? Lähetä ylläpitäjälle loki',
      logBody:
        'Kirjoita `::anvillog` pelin chattiin (tai aseta **Export debug log hotkey** pluginin Support-osiossa). Se kirjoittaa lokitiedoston `.runelite/anvil-debug`-kansioosi, avaa kansion ja kopioi polun leikepöydälle — lähetä se tiedosto ylläpitäjälle, niin he näkevät tarkalleen mikä meni pieleen.',
      missingNote: {
        tag: 'Puuttuuko todisteita?',
        body: 'Petit ja Champion’s scrollien duplikaatit vaativat käsin otetun kuvakaappauksen. Ne tallentuvat kansioon `.runelite/osrs-bingo-pending/` ja näkyvät **Saved proofs** -rivinä Collection Login Bingo-välilehdellä.',
      },
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
      { strong: '4 vaihetta', rest: 'käyttöönottovelhossa' },
      { strong: '7 formaattia', rest: 'joista rakentaa taulu' },
      { strong: '1 painike', rest: 'jäsenlistan synkronointiin' },
    ],
    footnote:
      'Tämä opas seuraa sovellusta sellaisena kuin se on tänään. Jos jokin näkymä täällä ei vastaa sitä mitä katsot, sovellus on oikeassa ja opas vanhentunut — [kerro meille](/feedback), niin korjaamme sen.',

    access: {
      title: 'Kuka saa tehdä mitä',
      intro:
        'Kaikki kirjautuvat sisään Discordilla — salasanoja ei ole. Ensimmäinen ylläpitäjä tulee palvelinasetuksista; sen jälkeen ylläpitäjä ylentää muita kohdasta **Clan → Members & staff**. Roolit pinoutuvat alaspäin: kaiken minkä moderaattori voi, voi myös rahastonhoitaja ja ylläpitäjä.',
      rows: [
        {
          term: 'Admin',
          body: 'täysi pääsy — tapahtumat, ruudut, joukkueet, asetukset, henkilökunta, maksut. Anna se niin harvalle kuin klaani kestää.',
        },
        { term: 'Treasurer', body: 'kaiken minkä moderaattori voi, sekä osallistumismaksut ja palkintojen maksun.' },
        {
          term: 'Moderator',
          body: 'arjen työ: jäsenlista, vahvistukset, viikkokilpailut, aikataulu, palaute. Ei voi luoda tai muokata tapahtumia.',
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
        '**System → Setup** on neljän vaiheen velho, ja työpöytä pitää samat neljä tarkistuslistana kunnes ne on tehty: nimeä klaani, yhdistä Discord, luo tapahtuma, lisää ruudut. Tila lasketaan oikeasta datasta, joten vaihe kuittautuu vasta kun se on aidosti valmis.',
      discord:
        'Discordiin on kaksi reittiä, ja ne täydentävät toisiaan: anna Anvilille **botti**, niin se voi luoda webhookeja, synkronoida rooleja ja nimimerkkejä sekä rakentaa yksityisiä joukkuekanavia; anna sille yksi **webhook-osoite**, niin se voi julkaista ilmoituksia eikä mitään muuta. Aloita webhookista jos haluat olla pystyssä kahdessa minuutissa, ja lisää botti kun haluat automatiikan.',
      permsNote: {
        tag: 'Botin oikeudet',
        body: 'Botti tarvitsee oikeudet _Manage Webhooks_, _Manage Roles_, _Manage Channels_ ja _Manage Nicknames_, ja sen roolin on oltava _yläpuolella_ hallitsemiaan rooleja palvelimesi roolilistassa. Muuten Discord kieltäytyy hiljaisesti.',
      },
      hosted:
        'Ylläpidetyllä tilauksella kohtasit tuon näkymän jo kerran: botin lisääminen käyttöönoton aikana oli tapa jolla Anvil sai tietää mikä palvelin on teidän, joten palvelin-ID:tä ei koskaan tarvinnut kopioida. Sama linkki on täällä kun haluat siirtää botin toiselle palvelimelle.',
    },

    channels: {
      title: 'Jaa julkaisut useaan kanavaan',
      body: [
        'Kaikki julkaistaan oletuksena yhteen pääilmoituskanavaan. Kun se käy meluisaksi, avaa **System → Advanced settings → Webhooks** ja anna äänekkäille kategorioille omat kotinsa — bingotapahtumat, viikkokilpailut, harvinaiset dropit, kuolemat, PvP-tapot, combat achievementit, leikkeet. Kaikki minkä jätät tyhjäksi putoaa takaisin pääkanavaan, joten voit erottaa yhden kategorian kerrallaan.',
        'Botin ollessa yhdistettynä et koskaan koske webhook-osoitteeseen: valitse kanava valikosta ja paina **Create webhook**. Kiireisessä tapahtumassa voit lisätä toisen webhookin samaan kanavaan — Anvil vuorottelee niiden välillä, jottei Discordin nopeusraja niele julkaisuja.',
      ],
      clipsNote: {
        tag: 'Leikekanava on erilainen',
        body: 'Leikevideot ladataan suoraan kunkin pelaajan koneelta Discordiin — ne eivät koskaan kulje tämän sivuston kautta. Siksi täällä asettamasi leike-webhook on se jonka _jaat ulos_: jäsenet liittävät sen itse pluginiinsa. Kaikki muu tällä sivulla tapahtuu palvelimella, eivätkä jäsenet näe sitä koskaan.',
      },
    },

    roster: {
      title: 'Saa jäsenlistasi sisään',
      body: [
        'Klaanijäsenyys tulee yhdestä paikasta: pelinsisäisestä jäsenlistan synkronoinnista. Asenna [Anvilin RuneLite-plugin]({pluginGuide}) _ylläpitäjän_ tilille, avaa pelinsisäisen Collection Login **Bingo**-välilehti, ja paina **Sync clan roster**. Se työntää todellisen klaanilistanne pelistä sivustolle yhdellä klikkauksella.',
        'Kuka tahansa joka yhdistää tai vahvistaa tilin verkkosivulla olematta sillä listalla on **vieras** — seurattu ja näkyvä, mutta ei jäsen ennen kuin ylläpitäjä ylentää heidät tai seuraava synkronointi poimii heidät. Se on tarkoituksellista: se tarkoittaa ettei kukaan voi ylentää itseään klaaniinne kirjoittamalla nimeä.',
        'Voit myös lisätä jonkun käsin kohdasta **Clan → Members & staff**, mukaan lukien ilmoittaa heidät tapahtumaan heidän puolestaan kun he eivät pääse sivustolle.',
      ],
    },

    board: {
      title: 'Luo ensimmäinen taulusi',
      intro:
        '**Events → All events → New event**. Valitse formaatti ensin — se ratkaisee miten taulu pisteytetään ja mitä loput lomakkeesta sinulta kysyy.',
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
          blurb: 'Järjestetty rata — joukkueet saavuttavat ruudut peräkkäin; pisimmälle päässyt voittaa.',
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
        'Tapahtuman **Tiles**-välilehti on se paikka jossa taulusta tulee bingo. Jokainen ruutu on yhtä _tyyppiä_ oleva tehtävä, ja tyyppi ratkaisee mitä plugin tarkkailee: droppia, bossin tappomäärää, taidon XP:tä, NPC-tappoa, aikarajassa suorittamista, achievement diarya, Combat Achievementia, collection log -avausta, PvP-tappoa, esinesaalista, tai kuolematonta suoritusta. Manuaaliset ruudut — ne jotka ihminen vahvistaa kuvakaappauksesta — ovat myös aina vaihtoehto.',
        'Täyttä taulua varten laadi ruudut massana: vie taulukko ulos, täytä se taulukkolaskennassa, ja tuo takaisin. Sekä CSV että .xlsx kulkevat molempiin suuntiin, ja rivit vastaavat paikkoja, joten voit kirjoittaa koko 25 ruudun ruudukon uusiksi yhdellä liittämisellä.',
      ],
      rows: [
        {
          term: 'Vaikeusasteet',
          body: 'pistearvot kääntyvät nimetyiksi kaistoiksi (easy → elite). Muokkaa kaistoja kohdassa Advanced settings jos klaanisi luokittelee toisin.',
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
        'Välilehti **Teams & Draft** mukautuu valitsemaasi formaattiin: formaatti joka ei käytä joukkueita ohittaa sen kokonaan. Tavallisessa joukkuebingossa luot joukkueet, päätät kuka kutakin kapteenoi, ja joko jaat pelaajat itse tai pidät live-draftin.',
        'Kapteenit draftaavat ilmoittautuneiden poolista valitsemassasi järjestyksessä, ja jokainen kapteeni näkee vastaukset jotka ihmiset antoivat ilmoittautumislomakkeella — jäädytettyinä sellaisina kuin ne lähetettiin, jottei kukaan muokkaa “tuntejaan viikossa” tultuaan valituksi.',
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
          body: 'System → Announce julkaisee viestin kanaviinne kesken tapahtuman ilman että kirjoitat webhookia käsin.',
        },
      ],
      missionNote: {
        tag: 'Yllätyksiä kesken tapahtuman',
        body: 'Voit pudottaa **tehtävän** käynnissä olevaan bingoon — piilotetun bonusruudun joka ilmoitetaan kun laukaiset sen, ja joka voi haluttaessa laskea arvoltaan tai vanheta. Se on halvin tapa herättää taulu viidentenä päivänä.',
      },
      startProofNote: {
        tag: 'Etukäteisvarastoinnin pysäyttäminen',
        body: [
          'Laita **Starting shot** päälle (tapahtuma → Overview), niin jokaisen pelaajan on toimitettava yksi kuvakaappaus otettuna sen jälkeen kun tapahtuma on alkanut, paikassa jonka Anvil arpoo aloitushetkellä — jottei kukaan istu viikon verran säästetyillä cluilla ja arkuilla nollahetkellä. Paikka ilmoitetaan käynnistyksen yhteydessä; kunkin pelaajan salasana on henkilökohtainen, johdettu arvonnasta, eikä sitä ole olemassa ennen tapahtuman alkua, joten kukaan ei voi lavastaa sitä etukäteen.',
          'Kiinnitä paikat maailmankartalle (pooliedittorissa on sellainen), niin plugin tarkistaa että pelaajat oikeasti seisovat siellä sen sijaan että heille vain kerrottiin. Voit myös vaatia **tuoreen istunnon** — oletuksena 15 minuuttia: hiscores tallentuu vain kun pelaaja kirjautuu ulos, joten kaikkien pakottaminen kirjautumaan uudelleen juuri ennen kuvaansa on se, mikä tekee jokaisen XP- ja KC-ruudun takana olevista aloituslukemista rehelliset.',
          'Pluginin käyttäjät painavat yhtä painiketta. Kaikki muut kirjoittavat salasanansa pelissä ja lataavat kuvan My Team -sivulla. Sinä valitset mitä tapahtuu hyvitykselle joltakulta joka ei ole toimittanut: merkitse se tarkistettavaksi (oletus) tai kiellä se kunnes he toimittavat. Sama Overview-paneeli on tarkistuslista — pluginin ottamat kuvat vahvistetulla salasanalla saapuvat jo hyväksyttyinä, joten käytännössä katsot vain mobiilipelaajia.',
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
          body: 'tapahtuman Payouts-välilehti muuttaa palkintopotin listaksi siitä kuka saa mitäkin, ja seuraa maksuja sitä mukaa kun maksat.',
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
          body: 'säilytä juuri rakentamasi taulu. Seuraava bingo alkaa siitä tyhjän ruudukon sijaan.',
        },
      ],
      federation:
        'Federaation ollessa päällä jäsenet voivat myös yhdistää muihin Anvil-klaaneihin pluginista — kätevää klaanien välisiin tapahtumiin, ja täysin vapaaehtoista jäsenkohtaisesti.',
      outro: 'Ohjaa sitten jäsenesi [pelaajien käyttöönotto-oppaaseen]({pluginGuide}) ja ala suunnitella seuraavaa.',
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
        'Avaa tapahtumasi ja mene välilehdelle **Teams & Draft**. Luo yksi joukkue kutakin kutsumaasi klaania kohden ja nimeä se heidän mukaansa — nimi on se minkä heidän pelaajansa näkevät ilmoittautumislomakkeella, joten “Ironforge” voittaa nimen “Joukkue 2”.',
        'Sinun _ei_ tarvitse pitää draftia. Kutsulinkit ja draft ovat vaihtoehtoja: draft jakaa yhteisen ilmoittautumispoolin, linkki istuttaa ihmiset suoraan. Puhtaassa klaani vastaan klaani -tapahtumassa useimmat isännät luovat joukkueet, jakavat kullekin yhden linkin, eivätkä avaa draftia lainkaan.',
        'Avaa sitten itse joukkue — **Teams & Draft → joukkue** — sillä siellä molemmat seuraavat vaiheet tapahtuvat.',
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
        caption: 'Tapahtuma → Teams & Draft → joukkue → Team staff',
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
        caption: 'Tapahtuma → Teams & Draft → joukkue → Invite links',
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
        kill: { label: 'Tappomäärä', blurb: 'N tappoa NPC:stä — myös niistä joita hiscores ei koskaan laskenut (kanat, lehmät). Pluginin havaitsema.' },
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
          term: 'Bossin KC-tavoite',
          body: '**ei** ole kill-ruutu. Kill-ruudut tarkkailevat NPC-kuolemia pluginin kautta; KC-tavoite on hiscores-luku ja tarvitsee `trackedStat` + `statType=boss` + `statGoal`. Käytä kill-ruutua siihen mitä Hiscores ei koskaan laskenut — lehmiin, kanoihin, tiettyyn slayer-möröön.',
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
        '**Download spreadsheet** tapahtuman **Tiles**-välilehdellä. Saat .xlsx-tiedoston taulusta sellaisena kuin se on, pudotusvalikoineen, esinelistoineen ja sarakeohjeineen omilla välilehdillään.',
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
        'Pisteytetyllä taululla jokaisella ruudulla on oma arvonsa, ja nuo arvot kääntyvät nimetyiksi vaikeuskaistoiksi — easy–elite — joita voit muokata kohdassa **Advanced settings** jos klaanisi luokittelee toisin. Kaista on se minkä pelaajat lukevat; luku on se joka lasketaan.',
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
      'Formaatti asetetaan luonnissa mutta sen voi muuttaa jälkikäteen tapahtuman Overview-välilehdeltä; paljastuskäytäntöä ja pistekertoimia voi muuttaa milloin tahansa ennen kuin niiden koskettamat ruudut paljastetaan.',

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
      'Maksut ja palkintojen jako ovat rahastonhoitajan pinta. Rahastonhoitaja voi kaiken minkä moderaattorikin, sekä tämän; moderaattori voi merkitä maksun kerätyksi mutta ei koskaan sulkea sitä.',

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
        'Montako allekirjoitusta maksu vaatii on klaaniasetus, nollasta viiteen. Nolla on olemassa todellisesta syystä: klaanissa jossa rahastonhoitaja _on_ omistaja ei ole ketään muuta allekirjoittamaan, ja “34 maksua odottaa toista allekirjoitusta” muuttuu jonoksi jota ei voi koskaan tyhjentää ja pysyvästi äänekkäimmäksi asiaksi työpöydällä. Nollalla maksun merkitseminen maksetuksi **on** allekirjoitus.',
        'Aseta se yhteen — oletus — jos teitä on kaksi. Aseta se nollaan jos rehellisesti sanottuna ei ole, ja aseta korkeammaksi vain jos klaanillasi on sekä ihmiset että syy.',
      ],
    },

    pay: {
      title: 'Maksaminen',
      body: [
        'Kun tapahtuma päättyy, tapahtuman **Payouts**-välilehti muuttaa potin listaksi ihmisiä. Luo se, niin saat yhden rivin saajaa kohden, ei joukkuetta kohden: voittavan joukkueen palkinto jaetaan tasan jäsenten kesken, jotta maksaminen on lista nimiä ja lukuja eikä laskutoimitus keskiyöllä.',
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
        'jäsenlista: sen synkronointi, ihmisten lisääminen, vieraan ylentäminen',
        'tilien vahvistukset — XP-haaste ja manuaalinen tarkistus',
        'lähetykset ja todistekuvakaappaukset',
        'viikkokilpailut ja aikataulu',
        'jäsenten palaute',
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
          body: 'tavallinen tapaus, eikä se vaadi sinulta mitään. Tilillä pelaaminen pluginin ollessa yhdistettynä liittää sen automaattisesti, ja pysyvä tilisormenjälki saa liitoksen kestämään nimenvaihdon.',
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
        body: 'Tilin vahvistaminen sanoo “tämä on oikeasti heidän”. Se ei tee heistä osaa klaania — klaanijäsenyys tulee vain pelinsisäisestä jäsenlistan synkronoinnista tai ylläpitäjältä joka lisää heidät käsin. Joku joka on vahvistettu mutta ei listalla on **vieras**: seurattu, näkyvä, ei jäsen. Se on tarkoituksellista, ja se on se mikä estää ketään liittymästä klaaniisi kirjoittamalla nimen.',
      },
    },

    roster: {
      title: 'Jäsenlistan pitäminen rehellisenä',
      body: [
        'Jäsenlista tulee yhdestä paikasta: ylläpitäjä ajaa synkronoinnin pelinsisäisestä klaanilistasta, pluginin Bingo-välilehdeltä Collection Logissa. Kaikki muu — vahvistukset, liitokset, ilmoittautumiset — roikkuu siinä.',
        'Ylläpitotyö on siis pieni mutta todellinen: aja synkronointi jokaisen rekrytointikierroksen jälkeen, ylennä ne vieraat jotka oikeasti liittyivät, ja katso niitä ihmisiä jotka sivusto on merkinnyt tarkistettaviksi sen sijaan että odottaisit heidän valittavan.',
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
};

export default fi;
