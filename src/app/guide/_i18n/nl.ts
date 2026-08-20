import type { PartialGuideDict } from './en';

// Nederlands — Dutch.
//
// Zelfde afspraak als in alle andere taalbestanden hier: alles wat de lezer daadwerkelijk OP HET
// SCHERM ZIET blijft Engels — menu's in RuneLite en OBS, de chatregels van de plugin zelf, en
// Anvils eigen adminlabels, die Engels zijn tot ook die kant vertaald wordt. Een vertaalde
// "Tracked drop detected" is een regel die niemand terugvindt. Al het andere — de uitleg, de
// volgorde, het waarom — is Nederlands.

const nl: PartialGuideDict = {
  common: {
    contents: 'Inhoud',
    step: 'Stap',
    optional: 'optioneel',
    minRead: '{n} min lezen',
    language: 'Taal',
    partialNotice:
      'Deze handleiding is maar gedeeltelijk vertaald naar het {language}. Wat nog niet vertaald is, staat er in het Engels.',
    backToGuides: 'Alle handleidingen',
    unreviewedNotice:
      'Deze vertaling naar het {language} is nog door geen enkele moedertaalspreker nagelezen. Leest een zin verkeerd, dan is [de Engelse pagina]({englishHref}) het origineel — en [het ons laten weten](/feedback) is wat het rechtzet.',
  },

  index: {
    metaTitle: 'Handleidingen — Anvil',
    metaDescription:
      'Aan de slag met Anvil: de RuneLite-plugin voor spelers, een event draaien voor de clanstaf, en een bezoekende clan ontvangen.',
    title: 'Handleidingen',
    dek: 'Alles wat je nodig hebt om te beginnen, geschreven voor precies de versie van Anvil die hier draait.',
    groups: {
      playing: 'Spelen',
      running: 'Een event draaien',
      clan: 'De clan runnen',
    },
    cards: {
      plugin: {
        eyebrow: 'Voor spelers',
        title: 'RuneLite-plugin instellen',
        blurb:
          'Installeer de plugin, koppel hem aan deze site, en laat hem je drops indienen. Behandelt ook Discord-meldingen en OBS-clips.',
        minutes: '~3 min instellen',
      },
      board: {
        eyebrow: 'Voor bordbouwers',
        title: 'Bouw een bord dat zichzelf bijhoudt',
        blurb:
          'Wat elk vaksoort werkelijk kan zien, in bulk werken via een spreadsheet, en de fouten die netjes importeren en daarna nooit afgaan.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Voor teamcaptains',
        title: 'Captainshandleiding',
        blurb:
          'De pool lezen voordat de klok loopt, de draftdag zelf, en de delen van een team leiden die pas daarna beginnen.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Voor de clanstaf',
        title: 'Formats, en hoe vakjes opengaan',
        blurb:
          'Zeven bordvormen, vijf manieren waarop vakjes speelbaar worden, en de drie modifiers die bepalen wat een voltooiing waard is.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Voor penningmeesters',
        title: 'Inleg en uitbetalingen',
        blurb:
          'Inleg heffen, hem innen, de tweede handtekening die hem afsluit, en een pot omzetten in betaalde plaatsen.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Voor moderators',
        title: 'Aan de beurt',
        blurb:
          'De wachtrij, inzendingen en accounts controleren, de ledenlijst eerlijk houden, en de afwegingen die bij een mens terechtkomen.',
        minutes: '~5 min',
      },
      admin: {
        eyebrow: 'Voor de clanstaf',
        title: 'Zo draai je je eerste event',
        blurb:
          'Discord, ledenlijst, borden, vakjes, teams en de draft, de start — en wat je doet als het event voorbij is.',
        minutes: 'één avond, eenmalig',
      },
      clanVsClan: {
        eyebrow: 'Voor organisatoren',
        title: 'Een bezoekende clan ontvangen',
        blurb:
          'Clan tegen clan zonder ook maar één RSN met de hand te verzamelen: één uitnodigingslink per team, en een plek waarmee hun eigen moderator hun helft runt.',
        minutes: '~5 min per team',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite-plugin instellen — Anvil',
    metaDescription:
      'Installeer Anvils RuneLite-plugin, koppel hem aan deze site, en zet Discord-meldingen en OBS-clips op.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Instelhandleiding voor spelers',
    dek: 'Installeren, richten op {clanName}, spelen. De plugin dient je bingo-drops in, post je zeldzame drops en sterfgevallen op Discord en — als je OBS draait — bewaart en post hij clips van de momenten die het terugkijken waard zijn.',
    facts: [
      { strong: '2 velden', rest: 'en het bijhouden loopt' },
      { strong: '~3 min', rest: 'voor de basisinstelling' },
      { strong: 'Clips', rest: 'vragen OBS + 5 minuten extra' },
    ],
    footnote:
      'De schermafbeeldingen komen uit een echte installatie — accounttoken, OBS-adres en Discord-webhook zijn met opzet onleesbaar gemaakt. De jouwe horen net zo privé te blijven.',

    install: {
      title: 'Installeer de plugin',
      body: [
        'In RuneLite: **Configuration** (de moersleutel) → **Plugin Hub** → zoek op **Anvil** → **Install**. De uitgever is `AhmedFathy2001`.',
        'Eén plugin bedient alle clans — je richt hem in de volgende stap op deze site, er valt dus niets clanspecifieks te downloaden. Na installatie open je **Configuration → Anvil** om bij het instellingenpaneel te komen dat in deze hele handleiding wordt getoond.',
      ],
    },

    connect: {
      title: 'Koppelen aan deze site',
      intro: 'Alleen het onderdeel **Setup** doet ertoe om te beginnen. Al het andere heeft verstandige standaardwaarden.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Het Setup-onderdeel van de Anvil-plugin, met de velden Site URL en Account Token omkaderd',
        legend: [
          {
            label: 'Site URL',
            body: 'voor {clanName} is dat `{origin}`. Het veld is leeg bij levering, dus je moet het invullen. Een slash aan het eind hoeft niet, en `https://` wordt toegevoegd als je het weglaat.',
          },
          {
            label: 'Account Token',
            body: 'jouw persoonlijke sleutel tot deze site. Laat hem de plugin voor je invullen (hieronder), of plak hem zelf. Behandel hem als een wachtwoord.',
          },
        ],
      },
      easyHeading: 'De makkelijke weg: inloggen vanuit de plugin',
      easyIntro:
        'Met de Site URL ingevuld en het token nog leeg toont het **Anvil-zijpaneel** een knop **Sign in with Discord**. Klik erop en de plugin loodst je erdoorheen — je hoeft niets te kopiëren.',
      easySteps: [
        'Het paneel toont een code en opent je browser op deze site.',
        'Controleer of de code op de pagina overeenkomt met die in RuneLite, en klik dan **Approve**.',
        'Het paneel zegt _Signed in_ en vult het Account Token voor je in.',
      ],
      linkFigure: {
        caption: 'Deze site → /link-device',
        alt: 'De pagina Link your RuneLite client, met het codeveld en de Approve-knop omkaderd',
        legend: [
          { label: 'De code', body: 'die moet overeenkomen met wat de plugin je op dit moment laat zien.' },
          {
            label: 'Approve',
            body: 'keur alleen een code goed die _je eigen_ client toont. Heeft iemand je een link of een code gestuurd, weiger die dan — goedkeuren zou betekenen dat je ze je account geeft.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Waarom er een tweede domein opduikt',
        body: [
          'Het goedkeuren gebeurt hier, op `{origin}`. Ben je nog niet ingelogd op de site, dan loopt de inlogstap via Anvils gedeelde Discord-login op `anvilosrs.com` om je Discord-identiteit te bevestigen, en zet je daarna meteen weer hier neer — dat is dezelfde login die de Login-knop op deze site je geeft, geen onderdeel van de plugin.',
          'De plugin zelf praat alleen met `{origin}`: hij weigert een inlogpagina te openen die niet op de door jou ingevulde Site URL staat.',
        ],
      },
      directNote: {
        tag: 'Waar dit gebeurt',
        body: [
          'Alles in deze stroom blijft op `{origin}` — de code wordt hier uitgegeven, hier goedgekeurd met {clanName}s eigen Discord-login, en het token wordt hier teruggegeven. De plugin weigert een inlogpagina te openen die niet op de ingevulde Site URL staat, dus niets in deze stap bereikt een andere Anvil-installatie.',
        ],
      },
      federationAside:
        'Niet te verwarren met **Connect clans** in het zijpaneel — dat is de aparte, optionele knop die je met andere Anvil-clans verbindt, en die verschijnt pas als je hier al bent ingelogd.',
      manualFallback:
        'Opent de browser niet vanzelf, dan drukt het paneel het adres en de code af zodat je het handmatig kunt openen. Codes verlopen na tien minuten — druk gewoon opnieuw op de knop.',
      manualHeading: 'De handmatige weg: kopieer je token',
      manualIntro:
        'Log in met Discord en open [Profile](/profile), scrol dan naar de kaart **RuneLite plugin**.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'De kaart RuneLite plugin op de profielpagina, met het tokenveld en de knoppen Reveal, Copy en Rotate omkaderd',
        legend: [
          {
            label: 'Jouw token',
            body: 'verborgen tot je op Reveal drukt. Op deze schermafbeelding is hij met opzet onleesbaar; post die van jou nooit in Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'kopieer hem naar het Account Token-veld van de plugin. Rotate geeft een nieuwe uit en maakt de oude ongeldig — gebruik dat als je ooit vermoedt dat je token is uitgelekt.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Goed om te weten',
        body: ['Eén token dekt elk event waarvoor je je hier hebt ingeschreven — je plakt hem nooit opnieuw per bingo.'],
      },
    },

    accounts: {
      title: 'Koppel je accounts — gewoon spelen',
      body: [
        'Er is geen koppelcode in te tikken. Zodra het token erin staat, wordt het account waarmee je inlogt automatisch aan je profiel gekoppeld.',
        'De plugin stuurt bij elk verzoek je naam in het spel mee plus een stabiele accountvingerafdruk, en de site matcht eerst op die vingerafdruk — je koppelingen overleven dus een naamswijziging. Log één keer in op een altaccount en het verschijnt op je profiel onder _Accounts we noticed you playing_ met een **Add** in één klik.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'De kaart RuneScape Accounts op de profielpagina met de via de plugin geverifieerde accounts',
        legend: [
          {
            label: 'Je gekoppelde accounts',
            body: 'alles met “Verified via plugin” is daar puur door te spelen terechtgekomen. Voeg zoveel altaccounts toe als je wilt; één daarvan is je hoofdaccount.',
          },
        ],
      },
      noPluginHeading: 'Kun je de plugin niet draaien?',
      noPluginIntro:
        'Op mobiel of in de officiële client koppel je het account in plaats daarvan op de website — de profielpagina toont beide opties:',
      noPluginOptions: [
        '**Verify by XP** — vul je RSN in, de site kiest een willekeurige skill, en je moet daarin binnen 30 minuten 1.000 XP halen.',
        '**Manual review** — voor verborgen Hiscores of gloednieuwe altaccounts: dien je RSN in met een notitie, en een moderator keurt het goed.',
      ],
      signupNote:
        'Inschrijven voor events vraagt minstens één geverifieerd account, dus regel dit voordat je je inschrijft.',
    },

    working: {
      title: 'Controleer of het werkt',
      intro:
        'Log in en lees je chatvenster. De plugin begroet je zodra hij verbonden is en er een event loopt.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…later, naarmate er dingen gebeuren…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Je hoort ook het **Anvil-zijpaneel** te zien vollopen met je event, je team en je voortgang op de vakjes — en een **Bingo**-tabblad te zien verschijnen in de Collection Log in het spel.',
      guestNote: {
        tag: 'Gast of lid',
        body: 'Zegt de chat _Tracked as a guest_, dan word je bijgehouden maar sta je nog niet op de ledenlijst van de clan. Dat lost een admin op door de ledenlijst vanuit het spel te synchroniseren — vraag het {discordLink}.',
        discordWord: 'in Discord',
      },
    },

    bingo: {
      title: 'Bingo-instellingen',
      intro:
        'Die doen er alleen toe zolang je in een event zit. De standaardwaarden zijn prima — dit is wat elk ervan werkelijk doet.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Het Bingo-onderdeel van de plugin-instellingen met elke instelling omkaderd en genummerd',
        legend: [
          {
            label: 'Auto Submit Drops',
            body: 'maakt een schermafbeelding en dient een bijgehouden drop in op het moment dat hij valt. Laat dit aan; daar draait het om.',
          },
          {
            label: 'Show Overlay',
            body: 'tekent linksboven een klein paneel met _Anvil / team / UTC-datum_. Het wordt onderdeel van het beeld in je bewijsafbeeldingen, en juist dat maakt een bewijs lastig te vervalsen of terug te dateren. Op deze afbeelding staat het uit — zet het aan als je clan team en tijd op elk bewijs wil zien.',
          },
          {
            label: 'Team completion popups',
            body: 'een banner wanneer iemand uit je team een vakje afrondt. Meerdere tegelijk: het moeilijkste krijgt de banner, de rest gaat naar de chat.',
          },
          {
            label: 'Bingo tab in Collection Log',
            body: 'zet je bord in de Collection Log in het spel, naast je bewaarde bewijzen.',
          },
          {
            label: 'Banner sound + volume',
            body: 'speelt een geluid bij de banner. Er klinkt niets tot je zelf minstens één .wav toevoegt, via de knop “Banner sounds” in dat Bingo-tabblad.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'bakt een paar seconden later een tweede beeld in de schermafbeelding, als de loot op de grond is beland. Laat het aan; het bespaart discussies.',
          },
        ],
      },
      startHeading: 'Startfoto',
      startBody: [
        'Sommige events vragen van iedereen een **startfoto**: één schermafbeelding gemaakt nadat het event live is gegaan, op een locatie die op het startmoment wordt geloot. Het voorkomt dat iemand de week voor het event besteedt aan het hamsteren van clues, kisten en kills om die op dag één te dumpen.',
        'Draai je de plugin, dan valt er niets voor te bereiden. Bij de start krijg je een chatregel die zegt waar je heen moet, en het Anvil-zijpaneel toont een knop **Take starting shot**. Ga staan waar het zegt, druk één keer, en je bent klaar — de plugin maakt de foto, stempelt je RSN, je team, de locatie en een codewoord dat alleen jouw account krijgt erop, en archiveert hem voor je.',
        'Twee dingen controleert hij voordat hij iets archiveert, zodat je ze in het spel oplost in plaats van achteraf in een Discord-ruzie. Heeft de organisator de plek op de kaart gezet, dan weet de plugin hoe ver je weg bent en zegt dat, in plaats van een foto van de verkeerde kant van Gielinor te sturen. En vraagt het event om een verse sessie, dan moet je **uitloggen en opnieuw inloggen** voordat je hem maakt: je hiscores worden alleen bij uitloggen bewaard, dus opnieuw inloggen vlak voor de foto is wat je startwaarden — en daarmee elk XP- en KC-vakje — kloppend maakt.',
        'Op mobiel, of zonder de plugin: open **My Team** op deze site, lees je codewoord op de startfotokaart, tik het in het chatvenster in het spel, maak een schermafbeelding waarop zowel je personage als het codewoord te zien is, en upload hem op diezelfde kaart. Die upload telt meteen — je kunt spelen zodra hij binnen is, en de staf bekijkt hem achteraf. Log eerst uit en weer in als de kaart daarom vraagt.',
      ],
    },

    notifications: {
      title: 'Discord-meldingen',
      intro:
        'Die gaan af of er nu een bingo loopt of niet, en ze verschijnen in de kanalen van de clan. Welk kanaal, bepalen de admins hier — jij kiest alleen _wat_ je post.',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'De meldingsonderdelen Deaths and kills en Drops and pets met elke instelling omkaderd en genummerd',
        legend: [
          {
            label: 'Notify on death',
            body: 'post in het sterfkanaal van de clan, met een schermafbeelding van het moment dat je stierf.',
          },
          { label: 'Death message', body: 'je eigen regel. `{name}` wordt vervangen door je RSN.' },
          {
            label: 'Notify on PvP kill',
            body: 'een schermafbeelding van de tick waarop je doelwit op 0 HP komt. Standaard uit; hier aan.',
          },
          { label: 'Notify on rare drops', body: 'de hoofdschakelaar voor drop-berichten.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'twee onafhankelijke routes naar een bericht: minstens zoveel waard (GE of high alch, welke hoger is), of zeldzamer dan 1 op N (standaard 1/10.000 — lossere waarden vullen het kanaal met kruidenrollen). Je clan kan een zeldzaamheidsdrempel zetten die voor iedereen geldt; die van jou telt nog steeds als hij strenger is. Zet er een op 0 om die route uit te schakelen.',
          },
          { label: 'Screenshot rare drops', body: 'de afbeelding meesturen, niet alleen de tekst.' },
          {
            label: 'Loot key value',
            body: 'een loot key wordt één keer gepost, als één melding, wanneer de hele inhoud boven dit getal uitkomt.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pets komen in het kanaal voor zeldzame drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Het meldingsonderdeel Combat achievements met elke instelling omkaderd en genummerd',
        legend: [
          { label: 'Notify on combat achievements', body: 'afgeronde tiers worden altijd gepost zolang dit aanstaat.' },
          {
            label: 'CA task min tier',
            body: 'hoe luidruchtig losse taken zijn. Hier Elite; standaard is Master. Zet hem op Grandmaster voor alleen de zeldzaamste.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99’s, elke 100 totale levels vanaf 1800, en max.',
          },
          { label: 'Notify on diary completions', body: 'tiers van achievement diaries.' },
          {
            label: 'Announce quest completions',
            body: 'vanaf de moeilijkheidsgraad die je kiest en hoger. Hier “All quests”; standaard is Master en hoger.',
          },
        ],
      },
    },

    clips: {
      title: 'Clips met OBS',
      intro: [
        'Eén toets indrukken en de laatste 30 seconden worden bewaard en in het clipkanaal van de clan gezet. Standaard uit en het vraagt een draaiende OBS — maar het is het dichtste bij een highlightsvideo dat je clan gaat krijgen.',
        'Hoe het werkt: OBS houdt een doorlopende **replay buffer** bij van de laatste X seconden. Je sneltoets zegt OBS die buffer naar een bestand te schrijven, en de plugin pikt dat bestand op en uploadt het naar een Discord-webhook die je erin plakt.',
      ],
      privacyNote: {
        tag: 'Waar je video heen gaat',
        body: 'Clips worden **rechtstreeks van je pc naar Discord** geüpload. Ze gaan nooit via deze site, en er wordt helemaal niets geüpload als je het webhookveld leeg laat — dan blijven de clips op je machine staan.',
      },
      obsHeading: 'A. OBS instellen (eenmalig)',
      obsSteps: [
        'Je hebt **OBS Studio 28 of nieuwer** nodig — de WebSocket-server zit er vanaf 28 ingebouwd in, geen extra download.',
        'Zorg dat OBS het spel ook echt vastlegt: een Game- / Window- / Display-Capture-bron die RuneLite toont. Ziet OBS je client niet, dan worden je clips een zwarte rechthoek.',
        '**Settings → Output** → vink **Enable Replay Buffer** aan. (In Simple output-modus staat het op de Recording-pagina; in Advanced heeft het een eigen tabblad.) Controleer meteen of er ruimte is op je opnamepad.',
        '**Tools → WebSocket Server Settings** → vink **Enable WebSocket server** aan. Noteer de **Server Port** (standaard 4455) en klik **Show Connect Info** voor het wachtwoord.',
      ],
      obsAside:
        'Je hoeft _niet_ op “Start Replay Buffer” te drukken — de plugin start hem voor je zodra hij verbindt, en herstart hem telkens als je de cliplengte wijzigt.',
      fillHeading: 'B. Vul de plugin in',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Het Clips-onderdeel van de plugin-instellingen met elke instelling omkaderd en genummerd; de OBS-host en de webhook-URL zijn verborgen',
        legend: [
          { label: 'Enable clip capture', body: 'de hoofdschakelaar. Staat hij uit, dan praat de plugin helemaal niet met OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'stel hem in, anders gebeurt er nooit iets. Kies iets dat je midden in een raid niet per ongeluk raakt.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` als OBS op dezelfde pc draait als RuneLite. Draait OBS op een andere machine, zet dan het lokale IP van die machine hier neer — verborgen op deze afbeelding — en laat de poort door de firewall. Poort en wachtwoord komen uit _Show Connect Info_; laat het wachtwoord leeg als je OBS-authenticatie hebt uitgezet.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'alles wat groter is, wordt lokaal bewaard en terloops in de chat genoemd in plaats van gepost. Zet hem op wat je Discord-server werkelijk accepteert; de plugin komt op 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'hoe ver elke clip terugreikt. Dit schrijft de bufferlengte in je OBS-profiel, dus OBS heeft zoveel seconden aanloop nodig voordat een clip op volle lengte überhaupt bestaat. Langere clips = grotere bestanden; 30 is een prima middenweg.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 wordt in Discord meteen als voorbeeld getoond en afgespeeld; MKV moet eerst gedownload worden. Let op: dit verandert het opnameformaat van OBS, wat ook je gewone opnames raakt. Zet het uit om OBS met rust te laten.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'waar clips terechtkomen — vraag een admin om de webhook van het clipkanaal. Leeg = clips blijven op je pc. Hier verborgen, en terecht: iedereen met deze URL kan in dat kanaal posten.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'verwerkt ook opslagacties die OBS zelf of de plugin “Save Replay Buffer for OBS” start. Laat hem uit als je twee RuneLite-clients tegen één OBS draait, anders wordt elke clip twee keer gepost.',
          },
        ],
      },
      useHeading: 'C. Gebruik het',
      useIntro: 'Er gebeurt iets grappigs → druk je sneltoets in → de chat loodst je erdoorheen:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Onthoud',
        body: 'De clip beslaat de seconden _vóór_ je de toets indrukte — druk dus ná het moment, niet tijdens. Je hebt de lengte van je buffer om te reageren.',
      },
      decodedHeading: 'Clipmeldingen, uitgelegd',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS draait niet, de WebSocket-server staat uit, of host/poort/wachtwoord kloppen niet. Los het op en druk opnieuw — de plugin probeert vanzelf elke 30 seconden opnieuw te verbinden.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'De buffer draait niet. Controleer Enable Replay Buffer in de output-instellingen van OBS, en zet Enable clip capture daarna uit en weer aan.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Werkt zoals bedoeld, je hebt alleen geen webhook ingesteld. Het bestand staat in je OBS-opnamemap.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Kort de cliplengte in, verlaag de kwaliteit van je OBS-opname, of verhoog de maximumgrootte als je server grotere bestanden aanneemt.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Te groot, rate-limited, of de upload liep in een time-out. Het bestand staat nog op je pc — post het met de hand als het dat waard is.',
        },
      ],
    },

    trouble: {
      title: 'Als er iets stukgaat',
      intro:
        'De plugin zegt het in de chat wanneer het bijhouden is gestopt — hij wacht ongeveer 90 seconden voordat hij klaagt en herhaalt zich hooguit elke 5 minuten.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Het token is verkeerd of is geroteerd. Kopieer het opnieuw uit [Profile → RuneLite plugin](/profile#plugin-token), of maak het veld leeg en log opnieuw in vanuit de plugin.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Controleer de Site URL op typefouten — die hoort `{origin}` te zijn. Klopt hij, dan ligt de site waarschijnlijk plat.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Dat account is nog niet gekoppeld. Voeg het toe via Profile → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Niets. Het herstelde zichzelf.',
        },
      ],
      logHeading: 'Nog steeds vast? Stuur een admin een log',
      logBody:
        'Typ `::anvillog` in de spelchat (of stel **Export debug log hotkey** in bij het Support-onderdeel van de plugin). Hij schrijft een logbestand naar je map `.runelite/anvil-debug`, opent de map, en kopieert het pad naar je klembord — stuur dat bestand naar een admin en die ziet precies wat er misging.',
      missingNote: {
        tag: 'Bewijs kwijt?',
        body: 'Pets en dubbele Champion’s scrolls vragen een handmatige schermafbeelding. Die worden opgeslagen in `.runelite/osrs-bingo-pending/` en verschijnen als een rij **Saved proofs** in het Bingo-tabblad van de Collection Log.',
      },
    },
  },

  admin: {
    metaTitle: 'Zo draai je je eerste event — Anvil-adminhandleiding',
    metaDescription:
      'Zet een clan op in Anvil en draai een bingo van begin tot eind: Discord, ledenlijst, borden, vakjes, teams en draft, de start, en wat er gebeurt als het event afloopt.',
    eyebrow: 'Anvil · voor de clanstaf',
    title: 'Zo draai je je eerste event',
    dek: 'De hele route, in de volgorde waarin je hem echt aflegt: {clanName} instellen, de ledenlijst binnenhalen, een bord bouwen, teams draften, het geheel starten, en de prijzen uitdelen. Ongeveer een avond werk voor de eerste bingo — minuten voor de tweede.',
    facts: [
      { strong: '4 stappen', rest: 'in de instelwizard' },
      { strong: '7 formats', rest: 'om een bord van te bouwen' },
      { strong: '1 knop', rest: 'om de ledenlijst te synchroniseren' },
    ],
    footnote:
      'Deze handleiding volgt de app zoals die vandaag draait. Klopt een scherm hier niet met wat je ziet, dan heeft de app gelijk en is de handleiding verouderd — [laat het weten](/feedback), dan repareren we het.',

    access: {
      title: 'Wie mag wat',
      intro:
        'Iedereen logt in met Discord — er zijn geen wachtwoorden. De eerste admin komt uit de serverconfiguratie; daarna promoveert een admin anderen via **Clan → Members & staff**. De rollen stapelen naar beneden: alles wat een moderator kan, kunnen een penningmeester en een admin ook.',
      rows: [
        {
          term: 'Admin',
          body: 'volledige toegang — events, vakjes, teams, instellingen, staf, uitbetalingen. Geef die aan zo weinig mogelijk mensen.',
        },
        { term: 'Treasurer', body: 'alles wat een moderator kan, plus inleg en uitbetalingen.' },
        {
          term: 'Moderator',
          body: 'het dagelijkse werk: ledenlijst, verificaties, weekcompetities, agenda, feedback. Kan geen events aanmaken of bewerken.',
        },
        {
          term: 'Editor',
          body: 'alleen vakjes opstellen. Geef het globaal, of beperk het tot bepaalde borden zodat een ingehuurde bordbouwer alleen bij het event kan dat je hem hebt gegeven.',
        },
        { term: 'Member', body: 'speelt; ziet helemaal geen adminomgeving.' },
      ],
      seeAlso:
        'Twee van die rollen hebben een eigen pagina: [Aan de beurt]({moderatorGuide}) over wat een moderator werkelijk met zijn avond doet, en [Inleg en uitbetalingen]({feesGuide}) voor de penningmeester.',
      ownerNote: {
        tag: 'Eigenaar',
        body: 'Eén account is de eigenaar. Niemand anders kan die degraderen, en het is de enige rol die het eigendom kan doorgeven — een ruzie met een mede-admin verliezen kan je dus nooit de clan kosten.',
      },
    },

    setup: {
      title: 'Noem de clan, koppel Discord',
      intro:
        '**System → Setup** is een wizard van vier stappen, en het dashboard houdt diezelfde vier als checklist tot ze klaar zijn: noem de clan, koppel Discord, maak een event aan, voeg vakjes toe. De status wordt uit echte gegevens berekend, dus een stap wordt pas afgevinkt als hij echt af is.',
      discord:
        'Voor Discord heb je twee routes, en ze vullen elkaar aan: geef Anvil een **bot**, dan kan hij webhooks aanmaken, rollen en bijnamen synchroniseren en privé teamkanalen bouwen; geef hem één **webhook-URL**, dan kan hij aankondigingen posten en verder niets. Begin met de webhook als je binnen twee minuten live wil zijn, en voeg de bot toe wanneer je de automatisering wil.',
      permsNote: {
        tag: 'Rechten van de bot',
        body: 'De bot heeft _Manage Webhooks_, _Manage Roles_, _Manage Channels_ en _Manage Nicknames_ nodig, en zijn rol moet in de rollenlijst van je server _boven_ de rollen staan die hij beheert. Anders weigert Discord het stilletjes.',
      },
      hosted:
        'Op een gehost pakket kwam je dat scherm al eens tegen: de bot tijdens de installatie toevoegen was hoe Anvil te weten kwam welke server van jullie is, er viel dus nooit een server-ID te kopiëren. Dezelfde link staat hier wanneer je de bot naar een andere server wil verhuizen.',
    },

    channels: {
      title: 'Verdeel de berichten over kanalen',
      body: [
        'Standaard gaat alles naar één hoofdkanaal voor aankondigingen. Wordt dat rumoerig, open dan **System → Advanced settings → Webhooks** en geef de luide categorieën hun eigen plek — bingo-events, weekcompetities, zeldzame drops, sterfgevallen, PvP-kills, combat achievements, clips. Alles wat je leeg laat, valt terug op het hoofdkanaal, je kunt dus één categorie tegelijk afsplitsen.',
        'Met de bot verbonden raak je nooit een webhook-URL aan: kies een kanaal uit de lijst en druk **Create webhook**. Bij een druk event kun je een tweede webhook op hetzelfde kanaal zetten — Anvil wisselt ertussen zodat de snelheidslimiet van Discord geen berichten opslokt.',
      ],
      clipsNote: {
        tag: 'Het clipkanaal is anders',
        body: 'Clipvideo’s worden rechtstreeks vanaf de pc van elke speler naar Discord geüpload — ze gaan nooit via deze site. Daarom is de clip-webhook die je hier instelt degene die je _uitdeelt_: leden plakken hem zelf in hun plugin. Al het andere op deze pagina gebeurt aan de serverkant, en leden zien het nooit.',
      },
    },

    roster: {
      title: 'Haal je ledenlijst binnen',
      body: [
        'Clanlidmaatschap komt uit precies één plek: een synchronisatie van de ledenlijst vanuit het spel. Installeer [Anvils RuneLite-plugin]({pluginGuide}) op het account van een _admin_, open het **Bingo**-tabblad in de Collection Log in het spel, en druk **Sync clan roster**. Dat duwt jullie werkelijke clanlijst met één klik vanuit het spel naar de site.',
        'Iedereen die een account op de website koppelt of verifieert zonder op die lijst te staan is een **gast** — bijgehouden en zichtbaar, maar geen lid tot een admin hem promoveert of de volgende synchronisatie hem oppikt. Dat is opzet: het betekent dat niemand zichzelf jullie clan in kan promoveren door een naam in te tikken.',
        'Je kunt iemand ook met de hand toevoegen via **Clan → Members & staff**, inclusief hem namens hemzelf inschrijven voor een event wanneer hij de site niet kan bereiken.',
      ],
    },

    board: {
      title: 'Maak je eerste bord',
      intro:
        '**Events → All events → New event**. Kies eerst een format — dat bepaalt hoe het bord scoort en wat de rest van het formulier je vraagt.',
      formats: {
        classic: {
          label: 'Klassieke bingo',
          blurb: 'Een vierkant N×N-raster — teams doen de vakjes in willekeurige volgorde, elk telt 1.',
        },
        leagues: {
          label: 'Leagues-bingo',
          blurb: 'Een takenlijst waarin elk vakje zijn eigen puntenwaarde draagt — zoveel vakjes als je wil.',
        },
        race: {
          label: 'Vakjesrace',
          blurb: 'Een geordend parcours — teams bereiken de vakjes op volgorde; wie het verst komt, wint.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Vakjes blijven verborgen tot hun geplande moment — stel elke onthulling in op het Tiles-tabblad. Op punten, in DMM All Stars-stijl.',
        },
        luckydraw: {
          label: 'Gelukstrekking',
          blurb: 'Een bingo-omroeper: verborgen vakjes gaan open in willekeurige trekkingen op een vast interval. Op punten.',
        },
        bounty: {
          label: 'Premiejacht',
          blurb:
            'Eén open vakje tegelijk — het eerste team dat het afrondt pakt de punten, en de volgende premie wordt getrokken.',
        },
        ladder: {
          label: 'Ladder',
          blurb:
            'Een takenlijst op punten, gerangschikt als individuele ranglijst (teams optioneel). Taken rouleren — oplopend, één tegelijk, of in een schuivend venster — en kunnen in waarde dalen. In de stijl van een maandladder.',
        },
      },
      outro:
        'Stel daarna de data in, het inschrijfvenster, en of inschrijven inleg kost. Begin vanuit een sjabloon als je liever niet met een leeg raster start — de galerij bevat zowel de ingebouwde sjablonen als elk bord dat je eerder als sjabloon hebt bewaard.',
      seeAlso:
        'Het format is maar de helft van de keuze — hoe vakjes speelbaar worden is de andere helft, en de twee bouwen op elkaar. Beide volledig: [Formats, en hoe vakjes opengaan]({formatsGuide}).',
      utcNote: {
        tag: 'Data zijn UTC',
        body: 'Elk tijdstempel in Anvil wordt in UTC opgeslagen en vergeleken, en getoond in de lokale tijd van elke bezoeker. Zet de eindtijd die je bedoelt; de site toont een Brit en een Australiër twee verschillende klokken voor hetzelfde moment.',
      },
    },

    tiles: {
      title: 'Vul het bord',
      body: [
        'Het **Tiles**-tabblad van het event is waar een bord een bingo wordt. Elk vakje is één _soort_ taak, en de soort bepaalt waar de plugin op let: een drop, een boss-killcount, skill-XP, een NPC-kill, een tijd halen, een achievement diary, een Combat Achievement, een collection log-ontgrendeling, een PvP-kill, itemwinst, of een run zonder doodgaan. Handmatige vakjes — die een mens goedkeurt aan de hand van een schermafbeelding — kunnen ook altijd.',
        'Voor een vol bord werk je in bulk: exporteer het blad, vul het in een spreadsheet, en importeer het terug. CSV en .xlsx gaan allebei heen en weer, en rijen volgen posities, dus je kunt een heel raster van 25 vakjes met één plakactie herschrijven.',
      ],
      rows: [
        {
          term: 'Moeilijkheidsgraden',
          body: 'puntenwaarden vertalen naar benoemde banden (easy → elite). Pas de banden aan onder Advanced settings als je clan anders indeelt.',
        },
        {
          term: 'Balanscontrole',
          body: 'controleert een afgerond bord op structurele problemen en scheve werklast voordat spelers het überhaupt zien.',
        },
        {
          term: 'Verborgen tot onthulling',
          body: 'nieuwe borden beginnen verborgen. De staf ziet ze altijd; spelers zien niets tot je onthult — een bord kan dus in de openbaarheid gebouwd worden zonder verpest te raken.',
        },
      ],
      seeAlso:
        'Welke soort je pakt, hoe je er tweehonderd in een spreadsheet schrijft, en de fouten die netjes importeren en daarna nooit afgaan: [Bouw een bord dat zichzelf bijhoudt]({boardGuide}).',
    },

    teams: {
      title: 'Teams en de draft',
      body: [
        'Het tabblad **Teams & Draft** past zich aan het gekozen format aan: een format zonder teams slaat het helemaal over. Voor een gewone teambingo maak je de teams aan, bepaal je wie er captain is, en verdeel je de spelers zelf of draai je een live draft.',
        'De captains draften uit de inschrijfpool in de volgorde die jij kiest, en elke captain ziet de antwoorden die mensen op het inschrijfformulier gaven — bevroren zoals ze zijn ingediend, zodat niemand zijn “uren per week” aanpast nadat hij gekozen is.',
      ],
      lockNote: {
        tag: 'De draft zet de teams vast',
        body: 'Zodra een draft loopt, liggen de teams en de pickvolgorde vast. Voeg het vergeten team toe _voordat_ je op start drukt, niet erna.',
      },
      seeAlso:
        'Stuur je captains [de captainshandleiding]({captainGuide}) vóór de draftavond — de warroom is het meest waard in de dagen ervoor, en niemand leest een nieuw scherm terwijl er een klok loopt.',
      visitingClans:
        'Spelen jullie tegen een andere clan in plaats van je eigen mensen te draften? De bezoekende kant stelt zijn eigen ploeg op via één link, en hun moderator runt die zonder adminaccount hier — zie [Een bezoekende clan ontvangen]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Starten en draaien',
      body: [
        'Onthul de vakjes en start daarna het event. Anvil weigert een bord te starten dat niet klaar is — een draft die nog loopt, of spelers zonder team — en zegt welke. Weet jij het beter (een oefenpotje, een herhaling, een bord dat je test), dan kun je het forceren.',
        'Daarna draait het grotendeels vanzelf. De plugin schrijft automatisch alles bij wat hij ziet en post bewijsafbeeldingen gestempeld met team en een UTC-tijdstempel. Wat op jouw bord belandt is:',
      ],
      rows: [
        {
          term: 'Inzendingen om te beoordelen',
          body: 'handmatige vakjes en alles wat de plugin heeft gemarkeerd. Keur goed of af met het bewijs voor je.',
        },
        {
          term: 'Statistieken',
          body: 'het Stats-tabblad van het event toont de bijdrage per speler — nuttig wanneer een team ruziet over wie wie droeg.',
        },
        {
          term: 'Aankondigingen',
          body: 'System → Announce post midden in het event een bericht in jullie kanalen zonder dat je zelf een webhook schrijft.',
        },
      ],
      missionNote: {
        tag: 'Verrassingen tijdens het event',
        body: 'Je kunt een **missie** op een lopende bingo droppen — een verborgen bonusvakje dat wordt aangekondigd zodra je het afvuurt, en dat desgewenst in waarde daalt of verloopt. Het is de goedkoopste manier om een bord op dag vijf wakker te maken.',
      },
      startProofNote: {
        tag: 'Hamsteren vóór het event stoppen',
        body: [
          'Zet **Starting shot** aan (event → Overview), dan moet elke speler één schermafbeelding indienen, gemaakt nadat het event live ging, op een locatie die Anvil op het startmoment loot — zodat niemand op nul op een week aan opgespaarde clues en kisten zit. De locatie wordt bij de start bekendgemaakt; het codewoord van elke speler is persoonlijk, afgeleid uit de trekking, en bestaat pas als het event begint, dus niemand kan het van tevoren opzetten.',
          'Zet de plekken op de wereldkaart (de pool-editor heeft er een), dan controleert de plugin of spelers er ook echt staan in plaats van het alleen te horen. Je kunt ook een **verse sessie** eisen — standaard 15 minuten: hiscores worden alleen bij uitloggen bewaard, dus iedereen vlak voor zijn foto opnieuw laten inloggen is wat de startwaarden achter elk XP- en KC-vakje eerlijk maakt.',
          'Pluginfgebruikers drukken op één knop. Alle anderen tikken hun codewoord in het spel en uploaden op My Team. Jij kiest wat er gebeurt met een bijschrijving van iemand die niets heeft ingediend: markeer hem voor beoordeling (standaard) of weiger hem tot ze het doen. Datzelfde Overview-paneel is de beoordelingslijst — plugin-opnames met een geverifieerd codewoord komen al goedgekeurd binnen, in de praktijk kijk je dus alleen naar de mobiele spelers.',
        ],
      },
    },

    after: {
      title: 'Na het laatste vakje',
      intro:
        'Als de klok afloopt, bevriest het bord en gaat het event op slot — punten, bijdragen en wie-deed-wat worden bevroren zoals ze stonden. Moet je achteraf iets herstellen, dan kan een admin het bewust openen.',
      rows: [
        {
          term: 'Uitbetalingen',
          body: 'het Payouts-tabblad van het event maakt van de prijzenpot een lijst van wie wat krijgt, en vinkt af terwijl je uitbetaalt.',
        },
        {
          term: 'Terugblik',
          body: 'een openbare terugblikpagina met de eindstand en onderscheidingen na afloop — grootste drop, meeste kills, en de rest.',
        },
        {
          term: 'Enquête',
          body: 'vraag de clan wat ze ervan vonden. Bouw hem op het Survey-tabblad; spelers antwoorden zodra het event afloopt en alleen de staf ziet de uitkomsten.',
        },
        {
          term: 'Opslaan als sjabloon',
          body: 'houd het bord dat je net gebouwd hebt. De volgende bingo begint daaruit in plaats van uit een leeg raster.',
        },
      ],
      federation:
        'Met federatie aan kunnen leden zich vanuit de plugin ook met andere Anvil-clans verbinden — handig voor events tussen clans, en per lid volledig vrijwillig.',
      outro: 'Wijs je leden daarna naar de [instelhandleiding voor spelers]({pluginGuide}) en begin de volgende te plannen.',
    },
  },

  clanVsClan: {
    metaTitle: 'Een bezoekende clan ontvangen — Anvils organisatorenhandleiding',
    metaDescription:
      'Draai clan tegen clan op Anvil: geef elke bezoekende clan een uitnodigingslink die hun spelers in één team zet, en een plek waarmee hun eigen moderator hun helft runt.',
    eyebrow: 'Anvil · voor organisatoren',
    title: 'Een bezoekende clan ontvangen',
    dek: 'Jij organiseert het bord; zij leveren de ploeg. Dit is de route die je bespaart een dozijn RSN’s in een DM te verzamelen — één link per team, en een plek waarmee hun eigen moderator hun helft van het event runt.',
    facts: [
      { strong: '1 link', rest: 'per bezoekend team' },
      { strong: '0 adminplekken', rest: 'uitgedeeld aan buitenstaanders' },
      { strong: '~5 min', rest: 'per clan die je uitnodigt' },
    ],
    footnote:
      'De schermafbeeldingen komen uit een echte opzet op een testbord — uitnodigingstokens en Discord-namen zijn onleesbaar gemaakt. Een echte link is het bewaken waard: iedereen die hem heeft, kan een plek in dat team pakken zolang hij actief is.',

    shape: {
      title: 'Wat je hier opzet',
      body: [
        'Clan tegen clan is een doodgewoon event met één verschil: de helft van de spelers zit niet in jouw clan en zal dat ook nooit doen. Ze kunnen niet via de ledenlijst binnengesynchroniseerd worden, je wil ze niet promoveren, en je wil al helemaal niet twintig van hen met de hand inschrijven en vervolgens stuk voor stuk naar het juiste team slepen.',
        'Twee onderdelen lossen dat op, en ze staan los van elkaar — gebruik er één, of allebei.',
      ],
      rows: [
        {
          term: 'Een uitnodigingslink',
          body: 'een URL die je eenmalig voor één team maakt. Wie hem opent logt in, vult het gewone inschrijfformulier in, en belandt in dat team al goedgekeurd — geen draftpool, geen goedkeuringsrij.',
        },
        {
          term: 'Een plek in de teamstaf',
          body: 'een met naam genoemde persoon die _precies dat ene team_ kan runnen — de ploeg, de inzendingen en bewijzen, de inleg — zonder adminaccount hier, en zonder de captainsplek af te pakken van wie er daadwerkelijk speelt.',
        },
      ],
      note: {
        tag: 'Wat een uitnodiging niet is',
        body: 'Het is geen login en geen omweg om de verificatie heen. Wie hem opent logt nog steeds in met Discord en heeft nog steeds een geverifieerd RSN nodig, net als bij elke andere inschrijving. Het enige wat de link bepaalt is _in welk team_ de inschrijving belandt, en dat er niemands goedkeuring aan te pas komt.',
      },
    },

    team: {
      title: 'Maak eerst het team',
      body: [
        'Open je event en ga naar het tabblad **Teams & Draft**. Maak één team per uitgenodigde clan en noem het naar hen — de naam is wat hun spelers op het inschrijfformulier zien, dus “Ironforge” verslaat “Team 2”.',
        'Je hoeft _geen_ draft te draaien. Uitnodigingslinks en een draft zijn alternatieven: een draft verdeelt een gedeelde inschrijfpool, een link zet mensen rechtstreeks neer. Bij een zuivere clan-tegen-clan maken de meeste organisatoren de teams aan, geven ze er één link per stuk uit, en openen ze de draft nooit.',
        'Open daarna het team zelf — **Teams & Draft → het team** — want daar spelen beide volgende stappen zich af.',
      ],
      captainNote: {
        tag: 'Eerst de captain',
        body: 'Wijs de captain van de bezoekende kant aan voordat je de link uitdeelt, zodat de teampagina van meet af aan een eigenaar heeft. Een captain aanwijzen zet hem meteen in het team; waarschuwt de kaart dat hij niet in de ploeg staat, neem dan de aangeboden correctie.',
      },
    },

    staff: {
      title: 'Geef hun moderator een plek',
      body: [
        'Het paneel **Team staff** op de teampagina is hoe de eigen moderator van de bezoekende clan aan de slag gaat zonder dat jij hem iets op jouw site geeft. Druk **Add someone**, zoek hem op, voeg een notitie toe zoals “Ironforge’s mod” zodat de volgende admin weet waarom hij er is, en druk **Give a seat**.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → het team → Team staff',
        alt: 'Het Team staff-paneel met één toegekende plek en het zoekveld open om er meer toe te voegen',
        legend: [
          {
            label: 'Add someone',
            body: 'opent het zoekveld. Alleen mensen die hier minstens één keer met Discord hebben ingelogd, kunnen verschijnen — zie de notitie hieronder.',
          },
          {
            label: 'De notitie',
            body: 'vrije tekst, 120 tekens. Schrijf op uit welke clan ze komen. Plekken blijven na het event in de lijst staan, en “wie is dit?” is de vraag waar je over drie maanden mee zit.',
          },
          {
            label: 'Remove',
            body: 'neemt de plek meteen terug. Doe dat als het event afloopt — een plek is niet vanzelf tijdelijk.',
          },
        ],
      },
      canDo: 'Wat een plek kan, alleen in dat team:',
      canDoList: [
        'de ploeg van het team zien en beheren',
        'de inzendingen en bewijzen afhandelen',
        'de inleg van zijn spelers als betaald markeren',
        'er uitnodigingslinks voor maken, als jij dat aanzet (de stap na de volgende)',
      ],
      cantDo: 'Wat het nooit kan:',
      cantDoList: [
        'aan een ander team komen',
        'het bord of zijn vakjes bewerken',
        'draftkeuzes maken',
        'iemand wisselen zodra het event loopt',
      ],
      note: {
        tag: 'Ze moeten hier eerst één keer inloggen',
        body: 'Het zoekveld toont alleen accounts met een gekoppelde Discord — een plek hangt aan iemand die daadwerkelijk kan inloggen. Stuur de moderator van de bezoekende clan dus naar deze site, laat hem één keer op **Login** drukken, en geef _daarna_ de plek. Verschijnt hij niet in het zoekveld, dan heeft die login nog niet plaatsgevonden.',
      },
    },

    link: {
      title: 'Maak de uitnodigingslink',
      body: [
        'Nog steeds op de teampagina maakt het paneel **Invite links** de link. Twee velden bepalen wat de link belooft, en allebei lezen ze `0` als “beloof niets”.',
      ],
      figure: {
        caption: 'Event → Teams & Draft → het team → Invite links',
        alt: 'Het Invite links-paneel met de velden voor plekken en verloop, de knop Make a link, en één actieve link in de lijst',
        legend: [
          {
            label: 'Seats en Expires in hours',
            body: 'hoeveel mensen de link mag plaatsen (tot 100) en hoe lang hij geldig blijft (tot 30 dagen). Zet de plekken op de omvang van de ploeg die ze je beloofd hebben, dan sluit de link zichzelf zodra ze allemaal binnen zijn; zet een verloop wanneer de link naar een openbare Discord gaat. `0` in een van de velden betekent geen limiet.',
          },
          {
            label: 'Make a link',
            body: 'maakt hem aan en kopieert hem meteen naar je klembord. Plak hem naar hen toe voordat je iets anders doet.',
          },
          {
            label: 'De lijst met actieve links',
            body: 'elke link die dit team buiten heeft staan, met hoeveel mensen er zijn ingestapt en hoeveel plekken over zijn. **Copy** haalt hem opnieuw op; **Turn off** maakt hem definitief onbruikbaar.',
          },
        ],
      },
      shape:
        'De link ziet er zo uit: `{origin}/events/{eventId}/join/{token}` — één regel, veilig in een Discord-bericht te plakken.',
      note: {
        tag: 'Verstandige standaardwaarden',
        body: 'Bij een clan-tegen-clan waarbij je een ploeg met één moderator hebt afgesproken: laat beide velden op `0` staan en laat hem het regelen. Grijp naar plekken en verloop wanneer de link ergens heen gaat dat jij niet in de hand hebt.',
      },
      revoke:
        'Een link uitzetten werkt meteen en verwijdert niemand die al is ingestapt — die zijn nu gewone spelers in dat team. Wil je iemand eruit halen, gebruik dan de ploeg van het team.',
    },

    captains: {
      title: 'Laat ze hun eigen links maken',
      body: [
        'Standaard kan alleen een organisator links maken, en een captain die het probeert krijgt dat te horen. Die standaard is juist voor een gewoon clanevent — een captain die plekken uitdeelt, vult een ploeg die niemand heeft goedgekeurd — en verkeerd voor een clan-tegen-clan, waar de bezoekende kant zijn eigen ploeg beter kent dan jij.',
        'De schakelaar zit in datzelfde **Invite links**-paneel: **Let captains make their own links**. Hij geldt voor _elk team in dit event_, niet alleen voor het team dat je bekijkt — precies wat je wil wanneer beide kanten bezoekende clans zijn.',
        'Staat hij aan, dan kunnen de captain van het team en iedereen met een plek in de staf zelf links maken via **My Team → Invite links**. Ze krijgen hetzelfde paneel als jij, zonder de schakelaar.',
      ],
      figure: {
        caption: 'My Team → het team → Invite links',
        alt: 'Het Invite links-tabblad vanuit het perspectief van de captain in de teamhub, met de velden voor plekken en verloop en één actieve link',
        legend: [
          {
            label: 'Hetzelfde paneel, de blik van de captain',
            body: 'maken, kopiëren, uitzetten. Heeft de organisator de schakelaar niet aangezet, dan staat er “Only a host can make links for this event” en zijn de velden weg.',
          },
          {
            label: 'De lijst met actieve links',
            body: 'een captain die geen links mag maken, ziet toch welke zijn team buiten heeft staan — zodat hij je om nog een kan vragen in plaats van aan te nemen dat er geen zijn.',
          },
        ],
      },
    },

    player: {
      title: 'Wat hun spelers zien',
      intro:
        'De moeite waard om zelf één keer te doorlopen voordat je de link uitdeelt, zodat je vragen erover kunt beantwoorden.',
      steps: [
        'Ze openen de link. Zijn ze niet ingelogd, dan loggen ze eerst in met Discord en komen direct terug — de link raakt onderweg niet kwijt.',
        'Ze belanden op het doodgewone inschrijfformulier, met een banner: **You’re joining {teamExample} by invite**. Dezelfde vragen, dezelfde accountkeuze, dezelfde inleg als voor iedereen.',
        'Bij het indienen zitten ze in dat team, goedgekeurd. Geen actie van de organisator, geen draft.',
      ],
      figure: {
        caption: 'Het inschrijfformulier, geopend via een uitnodigingslink',
        alt: 'Het inschrijfformulier van het event met een banner dat de speler via een uitnodiging bij een genoemd team komt',
        legend: [
          {
            label: 'De uitnodigingsbanner',
            body: 'noemt het team waar ze zo in komen. Noemt hij het verkeerde team, dan hebben ze de verkeerde link — stop en controleer voordat ze indienen.',
          },
          {
            label: 'De rest van het formulier',
            body: 'onveranderd. Een geverifieerd RSN is nog steeds vereist, de inschrijfvragen worden nog steeds gesteld, en inleg geldt nog steeds.',
          },
        ],
      },
      note: {
        tag: 'Al ingeschreven?',
        body: 'Heeft iemand zich eerst gewoon ingeschreven en zit hij in de pool, dan verplaatst het openen van de link hem naar het team in plaats van een tweede inschrijving te maken. Wie al is goedgekeurd voor een ander team wordt met rust gelaten — verplaats hem in plaats daarvan via de ploeg.',
      },
    },

    dead: {
      title: 'Als een link niet meer werkt',
      intro:
        'Een geweigerde link legt zichzelf op de pagina uit in plaats van een 404 te geven, dus wie hem heeft kan je vertellen welke van deze het is.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Iemand heeft **Turn off** ingedrukt. Maak een nieuwe — een oude link komt nooit terug.',
        },
        {
          term: 'This invite has expired.',
          body: 'Hij heeft de door jou gezette uren bereikt. Maak er nog een, dit keer met `0` uur als het verloop niets oplevert.',
        },
        {
          term: 'This invite is full.',
          body: 'Alle plekken zijn bezet. Verhoog het door een nieuwe link met meer plekken te maken — het aantal ligt vast zodra een link bestaat.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'De enige die zichzelf kan oplossen. Controleer het inschrijfvenster van het event: al open, deadline verstreken, of het event al gestart.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Er is een link van een ander bord geplakt. Controleer of de event-id in de URL degene is die je bedoelde.',
        },
      ],
      checklist: 'Loop deze lijst vóór het event één keer per bezoekende clan door:',
      checklistItems: [
        'hun team bestaat en is naar hen genoemd',
        'hun captain is aangewezen en in het team gezet',
        'hun moderator heeft hier ingelogd en heeft een plek in de teamstaf',
        'de link is gemaakt, gekopieerd, en daadwerkelijk bij een mens aangekomen',
        'het inschrijfvenster staat zo lang open als ze nodig hebben',
      ],
      note: {
        tag: 'Als alles voorbij is',
        body: 'Zet de links uit en haal de plekken in de teamstaf weg. Geen van beide verloopt vanzelf, en een actieve link op een afgelopen event is gewoon een losse draad.',
      },
    },
  },

  board: {
    metaTitle: 'Een bord bouwen — Anvils handleiding voor het opstellen van vakjes',
    metaDescription:
      'Stel bingovakjes op die zichzelf bijschrijven: wat elk vaksoort werkelijk kan zien, in bulk werken via een spreadsheet, en de fouten die stilletjes mislukken.',
    eyebrow: 'Anvil · voor bordbouwers',
    title: 'Bouw een bord dat zichzelf bijhoudt',
    dek: 'Een vakje is een belofte dat iets zal worden opgemerkt. Dit is wat elke soort werkelijk kan zien, hoe je er tweehonderd schrijft zonder je avond kwijt te raken, en de handvol fouten die stilletjes mislukken — het vakje gaat simpelweg nooit af, en niemand merkt het voor dag vier.',
    facts: [
      { strong: '15 soorten', rest: 'één per vakje, nooit gemengd' },
      { strong: '1000 vakjes', rest: 'per bord, via een spreadsheet' },
      { strong: 'Stilletjes', rest: 'zo mislukt een slecht vakje' },
    ],
    footnote:
      'Het spreadsheetformaat staat volledig beschreven in `docs/tile-authoring.md`, geschreven voor wie (of wat) de rijen genereert. Deze pagina is de menselijke helft: naar welke soort je grijpt, en wat er misgaat.',

    kinds: {
      title: 'Eén vakje, één soort',
      body: [
        'Elk vakje is precies één _soort_, en de soort is de hele vraag: die bepaalt waar de plugin of de hiscores-ronde op let, en dus of het vakje überhaupt vanzelf kan afronden. Velden van twee soorten mengen wordt aan de deur geweigerd in plaats van geaccepteerd en kapot achtergelaten.',
        'De soorten vallen in drie families, en de familie telt zwaarder dan het label:',
      ],
      families: [
        {
          term: 'Handmatig',
          body: 'een mens kijkt naar een schermafbeelding en zegt ja. Altijd beschikbaar, werkt altijd, kost altijd iemand zijn avond. Gebruik het voor wat software niet kan zien.',
        },
        {
          term: 'Uit de Hiscores',
          body: 'skill-XP en boss-killcounts, elke 15 minuten uit de officiële Hiscores gelezen. Vraagt geen plugin en werkt voor iedereen op de ledenlijst — maar ziet alleen wat de Hiscores tellen, en pas nadat de speler is uitgelogd.',
        },
        {
          term: 'Door de plugin gezien',
          body: 'al het andere: drops, NPC-kills, tijden, diaries, combat tasks, rondes, lootwaarde. Schrijft binnen seconden bij en bakt een bewijsafbeelding in — maar alleen voor spelers die de plugin daadwerkelijk draaien.',
        },
      ],
      kindsIntro: 'De volledige lijst, in de volgorde van de soortkiezer:',
      kindLabels: {
        standard: { label: 'Standaard', blurb: 'Handmatig vakje — een captain vinkt het af. Geen automatisch bijhouden.' },
        skill: { label: 'Skill', blurb: 'Rondt vanzelf af zodra een skill een XP-doel haalt (uit de hiscores gelezen).' },
        boss: { label: 'Boss-KC', blurb: 'Rondt vanzelf af zodra een boss een killcount-doel haalt (uit de hiscores gelezen).' },
        drop: { label: 'Drop', blurb: 'N drops van een item (of eender welk uit een pool) — door de plugin gezien, met ingebakken schermafbeelding.' },
        collection: { label: 'Itemset', blurb: 'Meerdere items, elk met een eigen vereist aantal — één van elk voor een volledige set.' },
        kill: { label: 'Killcount', blurb: 'N kills van een NPC — ook die nooit in de hiscores stonden (kippen, koeien). Door de plugin gezien.' },
        lap: { label: 'Agility-rondes', blurb: 'N rondes op een agility-parcours, of N verdiepingen / volledige runs in de Hallowed Sepulchre — live meegeteld met de teller in het spel. Alleen rondes tijdens het event tellen.' },
        pvp: { label: 'PvP-kill', blurb: 'Dood spelers — wie dan ook, rivaliserende teams, of een genoemd doelwit — in de Wilderness of op PvP-werelden. Veilige minigames tellen nooit.' },
        gain: { label: 'Itemwinst', blurb: 'Vang, kook of verzamel N van een item — geteld aan wat in de inventory belandt. Door de plugin gezien.' },
        timed: { label: 'Op tijd', blurb: 'Rond een activiteit af binnen een tijdslimiet (Inferno, raids, Colosseum). De plugin klokt het.' },
        deathless: { label: 'Zonder doden', blurb: 'Rond een raid af met NUL doden in de groep, N keer. De plugin telt elke dood binnen de instantie.' },
        lms: { label: 'LMS', blurb: 'Eindig in de top N van Last Man Standing (1 = winst), M keer. Door de plugin gezien bij het einde van het spel.' },
        value: { label: 'Lootwaarde', blurb: 'Loot ter waarde van X gp — één buit, of buiten die samen een doel halen. De plugin prijst de buit.' },
        diary: { label: 'Diary', blurb: 'Rond tijdens het event achievement diary-tiers af. Door de plugin gezien aan het voltooiingsbericht.' },
        ca: { label: 'Combat task', blurb: 'Rond tijdens het event Combat Achievement-taken af. Door de plugin gezien aan het voltooiingsbericht.' },
      },
      note: {
        tag: 'De pluginvraag, één keer gesteld',
        body: 'Een vakje dat de plugin ziet, is onzichtbaar voor een speler die de plugin niet draait. Dat is geen bug die je kunt wegconfigureren — er kijkt niets mee. Speelt een deel van je clan op mobiel of in de officiële client: houd die vakjes dan uit de route naar de winst, of zet er een handmatig alternatief naast en reken erop schermafbeeldingen te moeten beoordelen.',
      },
    },

    pick: {
      title: 'Kies de soort die daadwerkelijk afgaat',
      intro:
        'De meeste vakjes die zich misdragen zijn het juiste idee in de verkeerde soort uitgedrukt. De vier waar mensen over struikelen:',
      rows: [
        {
          term: 'Een boss-KC-doel',
          body: 'is **geen** kill-vakje. Kill-vakjes kijken via de plugin naar NPC-doden; een KC-doel is een hiscores-getal en heeft `trackedStat` + `statType=boss` + `statGoal` nodig. Gebruik een kill-vakje voor wat de Hiscores nooit hebben geteld — koeien, kippen, een bepaalde slayer-mob.',
        },
        {
          term: 'Een plek in de collection log',
          body: 'is een drop-vakje. Het ontgrendelen van de logregel schrijft het bij, dus het vakje gaat ook af bij een duplicaat dat de speler al had — meestal precies wat je bedoelde.',
        },
        {
          term: '“Eén van elk”',
          body: 'is een drop-vakje met een itemlijst en **zonder** `requiredAmount`. Voeg een `requiredAmount` toe en het wordt stilletjes “eender welke N hiervan” — dezelfde rij, een compleet ander vakje.',
        },
        {
          term: 'Een diary of combat task',
          body: 'schrijft alleen bij aan het voltooiingsbericht in het spel, dat komt op het moment dat de tier of taak af is. Wat een speler al bezit, kan niet opnieuw afgaan — behalve bij een combat task, waar **Settings → Combat Achievements → Repeat completion** het opnieuw laat afgaan.',
        },
      ],
      note: {
        tag: 'Samengestelde boss-vakjes',
        body: 'De bijgehouden stat van een boss-vakje mag meerdere hiscores-sleutels bevatten, gescheiden door komma’s, en de voortgang telt over die sleutels op. `chambersOfXeric,chambersOfXericChallengeMode` is één vakje dat CoX en CM samen telt — bijna altijd wat een raid-vakje bedoelt.',
      },
    },

    bulk: {
      title: 'Stel ze in bulk op, niet in de browser',
      body: [
        'Een raster van 25 vakjes bij elkaar klikken gaat prima. Een Leagues-bord met 200 taken bij elkaar klikken niet, en het daarna nalezen evenmin. Het Tiles-tabblad heeft daar een heen-en-weer voor.',
      ],
      steps: [
        '**Download spreadsheet** op het **Tiles**-tabblad van het event. Je krijgt een .xlsx van het bord zoals het nu is, met keuzelijsten, de itemlijst en de kolomuitleg op eigen bladen.',
        'Bewerk het. Eén rij per vakje; de rijvolgorde is de vakjesvolgorde.',
        '**Upload CSV / Excel** op hetzelfde tabblad. Alleen het blad **Tiles** wordt gelezen.',
      ],
      rules: [
        {
          term: 'De rondgang verliest niets',
          body: 'download en upload ongewijzigd terug, en er gebeurt niets — overeenkomende rijen worden als ongewijzigd gemeld en krijgen niet eens een nieuw tijdstempel. Dat maakt de export een veilige back-up vóór een grote bewerking.',
        },
        {
          term: 'Rijen volgen posities',
          body: 'rij 1 is vakje 1. Bestaande vakjes worden ter plekke bijgewerkt, en een kolom die je weglaat blijft ongemoeid in plaats van geleegd — je kunt dus een blad met twee kolommen sturen dat alleen punten wijzigt.',
        },
        {
          term: 'Alleen dynamische borden groeien',
          body: 'extra rijen maken nieuwe vakjes op een Leagues-bord of een vakjesrace, vóór de start van het event, tot 1000. Een klassiek N×N-raster heeft een vaste vorm en negeert ze. Wil je honderden taken genereren, maak er dan een Leagues-event van.',
        },
        {
          term: 'Alles of niets',
          body: 'alle rijen worden eerst gecontroleerd. Eén itemnaam die niet op te zoeken is, laat de hele import mislukken, noemt de boosdoeners, en verandert niets — je houdt nooit een half bord over.',
        },
        {
          term: 'Sommige velden gaan bij de start op slot',
          body: 'naam, soort, vereist aantal en itemconfiguratie worden alleen vóór de start toegepast. Beschrijving, punten, categorie en de optioneel-vlag blijven de hele tijd bewerkbaar, je kunt dus midden in het event een typefout herstellen zonder het bord opnieuw te openen.',
        },
      ],
    },

    traps: {
      title: 'De fouten die stilletjes mislukken',
      intro:
        'Elk hiervan importeert netjes, staat er goed uitziend op het bord, en gaat nooit af. Ze zijn eerder vóór het uploaden een leesbeurt waard dan erna.',
      rows: [
        {
          term: 'Skill- en boss-vakjes zijn `type=standard`',
          body: 'er bestaat geen `type=skill`. De soort komt uit `trackedStat` + `statType` + `statGoal` op een verder gewone standaardrij. `type=boss` schrijven wordt geweigerd; `type=standard` schrijven en de stat-kolommen vergeten niet — dan heb je een handmatig vakje dat niemand ooit goedkeurt.',
        },
        {
          term: 'De scheidingstekens verschillen per kolom',
          body: '`items` gebruikt puntkomma’s (de komma is het CSV-scheidingsteken). `targetNpcs` gebruikt verticale strepen. Op een combat task-rij is de verticale streep de **enige** optie, want echte taaknamen bevatten komma’s — `Nylocas, On the Rocks` is één taak.',
        },
        {
          term: 'Raid-namen worden letterlijk vergeleken',
          body: 'een deathless- of tijdsvakje draagt de modus precies zoals hij in het spel gespeld wordt: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Een spelling die er bijna is, is een vakje dat nooit afrondt. Entry Mode-runs schrijven nooit bij op een gewoon raid-vakje; zwaardere modi wel.',
        },
        {
          term: 'Itemnamen moeten exact zijn',
          body: 'de spelling uit het spel, anders mislukt de import en somt hij op wat hij niet kon opzoeken. Is een naam dubbelzinnig, zet hem dan vast als `Name#id` en stop met gokken.',
        },
        {
          term: '`timeThresholdSeconds` betekent vier dingen',
          body: 'een tijdslimiet op een tijdsvakje, een plaatsingsgrens op een LMS-vakje (1 = winst), een exacte groepsgrootte op een deathless-vakje, en een exacte raid-groepsgrootte op een drop-vakje. Dezelfde kolom, vier betekenissen — controleer of je die invult die jouw soort echt leest.',
        },
        {
          term: 'Een vereist aantal op de verkeerde soort',
          body: 'het hoort op drop-, kill-, gain-, lap-, PvP-, deathless- en LMS-rijen. Op een stat- of tijdsrij doet het niets, en op een drop-rij maakt het van een itemset een “eender welke N”-pool.',
        },
      ],
      note: {
        tag: 'Test er één voordat je er tweehonderd schrijft',
        body: 'Stel één enkel vakje op van de soort waar je onzeker over bent, onthul het in een wegwerp-event, en ga het ding doen. Vijf minuten daar verslaat de ontdekking op de bingoavond van de clan dat een hele categorie dood was.',
      },
    },

    points: {
      title: 'Punten, niveaus en of het eerlijk is',
      body: [
        'Op een bord op punten draagt elk vakje zijn eigen waarde, en die waarden vertalen naar benoemde moeilijkheidsbanden — easy tot elite — die je onder **Advanced settings** kunt aanpassen als je clan anders indeelt. De band is wat spelers lezen; het getal is wat telt.',
        'Markeer een vakje als **optional** en het telt niet meer mee in het totaal van het bord — zo voeg je stretchdoelen toe zonder een blackout onmogelijk te maken.',
        'Als het bord vol is, draai dan de **balanscontrole** vanaf het Tiles-tabblad. Die kijkt naar de structuur en de spreiding van werk en vertelt je waar het bord scheef ligt — een categorie die niemand kan afmaken, een band die per uur veel meer waard is dan zijn buren — voordat spelers die dingen voor je vinden en eromheen spelen.',
      ],
    },

    reveal: {
      title: 'Niemand ziet het tot jij het zegt',
      body: [
        'Nieuwe borden beginnen verborgen. De staf ziet ze altijd; spelers zien helemaal niets tot je onthult — een bord kan dus in de openbaarheid gebouwd worden, over dagen, in een kanaal dat je leden kunnen lezen, zonder dat er iets verpest wordt.',
        'Die hoofdschakelaar is de bodem onder al het andere. Op een bord met een onthullingsregel — gepland, interval, premie, roterend — begint de motor pas losse vakjes om te draaien zodra het bord zelf onthuld is; een bord scherp zetten is dus altijd een bewuste handeling. Welke regel je kiest heeft een eigen pagina: [Formats, en hoe vakjes opengaan]({formatsGuide}).',
        'Missies zijn de uitzondering die het kennen waard is: vakjes die vooraf zijn opgesteld maar achtergehouden, midden in het event aangekondigd uit een eigen pool terwijl de rest van het bord zichtbaar blijft.',
      ],
    },

    check: {
      title: 'Voordat je onthult',
      intro: 'Eén keer per bord doorlopen is het waard. Het meeste kost vijf minuten.',
      items: [
        'elk vakje heeft de soort die je bedoelde, niet de soort die netjes importeerde',
        'raid-modi, itemnamen en taaknamen komen teken voor teken overeen met de spelling in het spel',
        'de door de plugin geziene vakjes zijn niet de enige route naar de winst, als een deel van je clan zonder speelt',
        'de punten staan en de balanscontrole is tevreden, of je bent het bewust met haar oneens',
        'optionele vakjes zijn als optioneel gemarkeerd',
        'je hebt het spreadsheet één keer gedownload, als back-up die je terug kunt uploaden',
      ],
      note: {
        tag: 'Wie mag dit',
        body: 'Vakjes opstellen is de ene adminklus met een eigen rol. Een **editor** kan vakjes opstellen en verder niets, en kan tot bepaalde borden worden beperkt — een ingehuurde bordbouwer uit een andere clan krijgt dus precies het event dat je hem gaf, zonder toegang tot iets anders dat je draait.',
      },
    },
  },

  captain: {
    metaTitle: 'Captainshandleiding — Anvil',
    metaDescription:
      'De draftdag en de weken erna: de pool lezen voordat de klok loopt, picks maken, en de ploeg, bewijzen en inleg van je team beheren.',
    eyebrow: 'Anvil · voor captains',
    title: 'Captainshandleiding',
    dek: 'Je krijgt een warroom, een klok en de inschrijfformulieren van vijfentwintig onbekenden in handen gedrukt. Dit is wat dat allemaal doet, in de volgorde waarin je het tegenkomt — plus de delen van een team leiden die pas beginnen als de draft voorbij is.',
    facts: [
      { strong: 'Slangvolgorde', rest: 'zodat late picks worden rechtgetrokken' },
      { strong: 'De klok', rest: 'pickt nooit voor je' },
      { strong: 'Eén tabblad', rest: 'runt je team het hele event' },
    ],
    footnote:
      'Alles hier is wat een captain ziet. Inleg, de ploegen van andere teams en het bord vóór de onthulling zijn van de staf en blijven dat — niets op deze pagina kan je dus de verdenking opleveren dat je ergens hebt gekeken waar je niet mocht.',

    before: {
      title: 'Wat je krijgt, en wanneer',
      body: [
        'Een organisator maakt je captain, en dat doet twee dingen: het zet je als speler in het team, en het opent de teamomgeving voor je. Waarschuwt de teampagina ooit dat je eigenlijk niet in de ploeg staat, neem dan de aangeboden correctie — een captain buiten zijn eigen team is een toestand die elk scherm verderop in de war schopt.',
        'Daarna heb je twee plekken. **My Team** is de hub van je team, en daar breng je het event door. De **warroom** is het scherm van de draftdag, en die opent zodra de inschrijving opent — lang vóór de draftavond.',
      ],
      note: {
        tag: 'Ga er vroeg heen',
        body: 'De warroom is het nuttigst in de dagen _vóór_ de draft, wanneer je elk inschrijfformulier rustig kunt lezen. Op de avond zelf wordt het een stopwatch en heb je geen tijd om iets te lezen.',
      },
    },

    warroom: {
      title: 'Lees de pool voordat de klok loopt',
      body: [
        'De warroom toont iedereen die gepickt kan worden, met alles wat de site over hen weet: wat ze spelen, bij welke bosses ze echte killcounts hebben, naar hoeveel eerdere events ze zijn komen opdagen, en de antwoorden die ze op het inschrijfformulier gaven.',
        'Die antwoorden zijn **bevroren zoals ze zijn ingediend**. Niemand past zijn “uren per week” aan nadat hij heeft gezien wie er als eerste is gekozen — en dat is precies waarom ze het lezen waard zijn.',
        'Bouw tijdens het lezen een **shortlist** op. Hij is privé, hij blijft tot de draftavond, en op die avond is hij het verschil tussen kiezen uit een lijst die je al vertrouwt en kiezen wie er toevallig bovenaan staat.',
      ],
      rows: [
        {
          term: 'Waardering en niveau',
          body: 'een samenvatting van wat iemand werkelijk heeft gedaan, afgeleid uit zijn accountgeschiedenis in plaats van uit wat hij je vertelde. Adviserend — een startpunt voor een gesprek, geen oordeel.',
        },
        {
          term: 'Domeinen en markers',
          body: 'wat ze aantoonbaar doen: raids, PvM, skillen, PvP. Nuttig om het gat in je ploeg te vinden in plaats van vier keer het hoogste getal te pakken.',
        },
        {
          term: 'Opkomst',
          body: 'hoe vaak ze eerdere events waarvoor ze zich inschreven ook afmaakten. Het stilste getal op de pagina en vaak het meest voorspellende.',
        },
      ],
    },

    draft: {
      title: 'De draftdag',
      body: [
        'De picks lopen in **slangvolgorde**: met vier teams gaat de eerste ronde A, B, C, D en de tweede D, C, B, A, dus als laatste picken in de ene ronde betekent als eerste picken in de volgende. Wie de eerste pick trok, betaalt er een minuut later voor.',
        'Een persoon is één pick, geen account. Iemand nemen trekt alle accounts die hij heeft geregistreerd in één keer naar je team — je besteedt nooit een tweede pick aan iemands altaccount.',
      ],
      rows: [
        {
          term: 'De pickklok',
          body: 'heeft de organisator er een gezet, dan krijg je zoveel seconden per beurt. Loopt hij af, dan pickt hij **niet** voor je — hij ontgrendelt de mogelijkheid voor de organisator om namens jou te picken, en zegt dat op beide schermen. Er gebeurt niets in stilte.',
        },
        {
          term: 'Een ingeperkte lijst',
          body: 'sommige events draaien met een balansmodus. Afhankelijk daarvan kan het sterkste team geblokkeerd worden om nog een topspeler te nemen terwijl een rivaal er geen heeft, of een plafond krijgen hoever zijn ploeg boven het gemiddelde mag komen. Is iemand die je wilde grijs, dan is dat de reden, en het geldt voor iedereen.',
        },
        {
          term: 'Als je hem mist',
          body: 'zeg het de organisator van tevoren. Hij kan vanaf hetzelfde bord voor je picken, en een shortlist die je hebt achtergelaten is de instructie die hij volgt.',
        },
      ],
      note: {
        tag: 'De draft zet de ploeg vast',
        body: 'Zodra een draft loopt, liggen de teams en de pickvolgorde vast. Ontbreekt er een team of klopt de volgorde niet, dan moet dat vóór de eerste pick opgelost worden, niet erna.',
      },
    },

    roster: {
      title: 'De hub van je team, het hele event',
      intro:
        'Op **My Team** bevat de kaart **Manage this team** alles wat je voor jouw kant kunt doen. Hij komt ingeklapt; open hem één keer en hij blijft waar je hem liet.',
      rows: [
        {
          term: 'Roster',
          body: 'wie er in het team zit en wat ze hebben bijgedragen. De eerste plek om te kijken als iemand vraagt waarom zijn drop niet telde — een niet-gekoppeld account duikt hier op.',
        },
        {
          term: 'Requests',
          body: 'mensen die willen aansluiten, bij events waar spelers zelf hun team kiezen. Verschijnt alleen als er iemand is.',
        },
        {
          term: 'Proof',
          body: 'de inzendingen van je team en hun schermafbeeldingen. Jij bent niet de laatste goedkeurder — dat is de staf — maar je ziet wat er is gestuurd en kunt achter het ontbrekende aan.',
        },
        {
          term: 'Fees',
          body: 'wie in je team nog inleg verschuldigd is. Je kunt er een als betaald markeren; het bevestigen is bewust werk van de staf.',
        },
        {
          term: 'Invite links',
          body: 'verschijnt zodra de organisator captains toestaat hun eigen links te maken. Eén link zet wie hem opent rechtstreeks in jouw team. Zie [Een bezoekende clan ontvangen]({clanVsClanGuide}) voor wat de link werkelijk doet.',
        },
      ],
    },

    during: {
      title: 'Het draaien zodra het loopt',
      body: [
        'Het meeste van het event draait vanzelf: de plugin schrijft bij wat hij ziet en legt er een gestempelde schermafbeelding bij. Wat overblijft zijn mensen, en dat is het werk.',
        'Wat echt een captain vraagt: zorgen dat iedereen aan jouw kant de plugin verbonden en zijn accounts gekoppeld heeft vóór het startschot, want een niet-gekoppeld altaccount draagt aan niets bij; halverwege opmerken welke vakjes niemand heeft aangeraakt; en de handmatige vakjes gefotografeerd krijgen vóór het laatste uur, wanneer iedereen tegelijk begint.',
        'Vraagt het event een startfoto, dan is dat het ene dat elke speler in de eerste uren zelf moet doen. Zit er vroeg achteraan — bij een speler zonder wordt elke bijschrijving gemarkeerd voor beoordeling, of ronduit geweigerd, afhankelijk van hoe de organisator het heeft ingesteld.',
      ],
      note: {
        tag: 'Wissels',
        body: 'Zodra een event loopt, kan alleen een admin iemand wisselen, en dat met opzet: bijdragen hangen al aan personen. Vraag het een organisator in plaats van eromheen te knutselen.',
      },
    },
  },

  formats: {
    metaTitle: 'Formats, en hoe vakjes opengaan — Anvil',
    metaDescription:
      'De zeven eventformats, de vijf manieren waarop vakjes kunnen opengaan, en de puntenmodifiers — wat elk daarvan doet met hoe een event aanvoelt.',
    eyebrow: 'Anvil · voor de clanstaf',
    title: 'Formats, en hoe vakjes opengaan',
    dek: 'Twee keuzes bepalen een event sterker dan welk vakje erin dan ook: welke vorm het bord heeft, en hoe vakjes speelbaar worden. Ze staan los van elkaar — elk format kan elke onthullingsregel gebruiken — en samen zijn ze het verschil tussen een week ploeteren en een race op één avond.',
    facts: [
      { strong: '7 formats', rest: 'de vorm van het bord' },
      { strong: '5 regels', rest: 'hoe vakjes opengaan' },
      { strong: '3 modifiers', rest: 'wat een voltooiing waard is' },
    ],
    footnote:
      'Het format wordt bij het aanmaken gekozen maar is daarna te wijzigen via het Overview-tabblad van het event; de onthullingsregel en de puntenmodifiers kun je altijd wijzigen voordat de vakjes die ze raken onthuld zijn.',

    shape: {
      title: 'De vorm van het bord',
      intro:
        'Het format bepaalt hoe het bord scoort en wat het aanmaakformulier je daarna vraagt. Al het andere op deze pagina bouwt daarop.',
      note: {
        tag: 'Vast raster of takenlijst',
        body: 'Een **klassiek** bord is een echt vierkant, dus “N is 5” betekent precies 25 vakjes en dat aantal kan nooit veranderen. Al het andere is een takenlijst van willekeurige lengte, en dat is ook het enige soort bord dat een spreadsheetimport kan laten groeien. Wil je honderd taken genereren, dan valt die keuze hier.',
      },
    },

    reveal: {
      title: 'Hoe vakjes opengaan',
      intro:
        'Los van het format. De onthullingsschakelaar op eventniveau blijft de hoofdpoort — zolang een bord verborgen is, is er niets zichtbaar en draait geen van deze motoren, dus je zet een bord altijd bewust scherp.',
      rows: [
        {
          term: 'Alles tegelijk',
          body: 'de klassieker. Elk vakje is speelbaar op het moment dat je het bord onthult, en teams kiezen zelf hun volgorde. Kies dit tenzij je reden hebt om het niet te doen.',
        },
        {
          term: 'Gepland',
          body: 'elk vakje draagt zijn eigen onthullingstijd, ingesteld op het Tiles-tabblad, en gaat live wanneer die tijd verstrijkt. Een “vakje van het uur”-bord: het bepaalt het tempo voor je en vraagt dat de tijden vooraf worden ingevuld.',
        },
        {
          term: 'Interval',
          body: 'de motor trekt verborgen vakjes op een vast interval — een lichting elke N minuten, willekeurig of op bordvolgorde. Een bingo-omroeper. Geen extra werk buiten de vakjes zelf, en het bord onthult zichzelf terwijl jij slaapt.',
        },
        {
          term: 'Premie',
          body: 'precies één vakje staat open, en het eerste team dat het afrondt pakt het — het vakje sluit en het volgende wordt meteen getrokken. Genadeloos, erg leuk om te volgen, en onbarmhartig voor tijdzones.',
        },
        {
          term: 'Roterend',
          body: 'een schuivend venster met een paar open vakjes: elke trekking opent nieuwe en laat de oudste verlopen. Anders dan bij premie halen alle spelers een open vakje voordat het verdwijnt. Gebouwd voor individuele ladders.',
        },
      ],
      note: {
        tag: 'De tijdzonevraag',
        body: 'Premie- en intervalborden belonen wie toevallig wakker is. In een clan verspreid over de wereld is dat een echt voordeel dat door de klok wordt uitgedeeld in plaats van door spelen. Roterende vensters verzachten dat — een open vakje blijft open zolang het venster duurt, dus ook een slapende speler krijgt een kans.',
      },
    },

    scoring: {
      title: 'Wat een voltooiing waard is',
      intro:
        'Drie modifiers, allemaal alleen in puntenmodus, allemaal in de voltooiing bevroren op het moment dat die plaatsvindt — een wijziging die je later maakt herschrijft dus nooit de geschiedenis.',
      rows: [
        {
          term: 'Bonus voor het eerste team',
          body: 'extra punten voor het eerste team dat elk vakje afrondt. De goedkoopste manier om een bord waar alles zichtbaar is als een race te laten aanvoelen zonder verder iets te wijzigen.',
        },
        {
          term: 'Waardeverval',
          body: 'de waarde van een vakje schaalt lineair van vol bij de onthulling naar een doelpercentage na N uur, en houdt daarna stand. Onder de 100 % daalt hij en beloont hij snelheid; boven de 100 % **groeit** hij, wat het wegwerken van de oude taken beloont die iedereen oversloeg. Die groeiende richting is degene waarvan mensen vergeten dat hij bestaat.',
        },
        {
          term: 'Lockout',
          body: 'de eerste voltooiing sluit het vakje voor alle anderen. Bij premie inbegrepen. Op een bord met grote verschillen in teamsterkte kan dat de strijd vroeg beslissen — hij is op zijn best als de teams dicht bij elkaar liggen.',
        },
      ],
    },

    missions: {
      title: 'Missies: verrassingen tijdens het event',
      body: [
        'Missies zijn vooraf opgestelde maar achtergehouden vakjes — aangekondigd uit een eigen pool terwijl de rest van het bord zichtbaar blijft. Ze staan los van de onthullingsregel, dus zelfs een doodgewone bingo waarin alles zichtbaar is kan ze hebben.',
        'Laat ze met de hand vallen als het bord stil wordt, op een vast interval, of volgens een schema per missie. Elke missie draagt zijn eigen scoring: eigen lockout, bonus, waardeverval en verloop, per vakje ingesteld in plaats van voor het event.',
        'Ze zijn de goedkoopste manier om een bord op dag vijf wakker te maken — en dag vijf is de dag waarop elk lang event wakker geschud moet worden.',
      ],
    },

    choose: {
      title: 'Kiezen, op één pagina',
      intro: 'Weet je welk gevoel je wil, dan is dit de kortste route ernaartoe.',
      rows: [
        { term: 'Een gewone clanbingo', body: 'Klassiek raster, alle vakjes zichtbaar. Voeg een bonus voor het eerste team toe als je wat haast wil.' },
        { term: 'Honderden taken, gescoord op moeilijkheid', body: 'Leagues, alles zichtbaar. Dat is ook de enige vorm waar een grote spreadsheetimport in kan groeien.' },
        { term: 'Een week die ergens naartoe werkt', body: 'Leagues met geplande of interval-onthulling, zodat het bord zich over de week opent in plaats van in één keer.' },
        { term: 'Een avond die mensen live volgen', body: 'Premie. Eén vakje, het eerste team pakt het, meteen het volgende.' },
        { term: 'Een individuele competitie, geen teamcompetitie', body: 'Ladder met roterend venster en waardeverval. Taken komen en gaan en niemand kan ze opsparen.' },
        { term: 'Een race met een finish', body: 'Vakjesrace — een geordend parcours, en wie het verst komt wint.' },
      ],
      outro:
        'Wat je ook kiest, de vakjes zelf zijn hetzelfde werk: zie [Bouw een bord dat zichzelf bijhoudt]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Inleg en uitbetalingen — Anvils penningmeestershandleiding',
    metaDescription:
      'Inleg heffen, hem innen, de tweede handtekening die hem afsluit, en de prijzenpot omzetten in uitbetaalde plaatsen.',
    eyebrow: 'Anvil · voor penningmeesters',
    title: 'Inleg en uitbetalingen',
    dek: 'Geld is waar clanevents misgaan, en ze gaan stilletjes mis: inleg waarvan iemand zweert dat hij hem betaald heeft, een pot die niemand kan kloppend krijgen, een prijsverdeling waarover geruzied wordt nadat de winnaars zijn uitgelogd. Dit is de route die bij elke stap een spoor achterlaat.',
    facts: [
      { strong: '2 handtekeningen', rest: 'sluiten standaard een inleg af' },
      { strong: 'Pot = ingelegd', rest: '+ inleg × goedgekeurde inschrijvingen' },
      { strong: '1 rij', rest: 'per persoon die betaald krijgt' },
    ],
    footnote:
      'Inleg en uitbetalingen zijn het terrein van de penningmeester. Een penningmeester kan alles wat een moderator kan, plus dit; een moderator kan inleg als geïnd markeren maar nooit afsluiten.',

    set: {
      title: 'De inleg instellen',
      body: [
        'De inleg hangt aan het event, ingesteld bij het aanmaken of bewerkt via het **Sign-ups**-tabblad. Helemaal geen inleg is een prima antwoord — heel wat events draaien op alleen een pot die de organisator zelf heeft ingelegd.',
        'Twee instellingen bepalen wat de inleg werkelijk betekent, en ze worden makkelijk overgeslagen:',
      ],
      rows: [
        {
          term: 'Per persoon of per account',
          body: 'bij een event waar mensen met meerdere accounts mogen meedoen, bepaalt dat of ze één keer betalen of één keer per account. Klopt het niet, dan ga je geld terugbetalen.',
        },
        {
          term: 'Betaaldeadline',
          body: 'zodra die verstreken is, houden onbetaalde inschrijvingen op iets te zijn waar je achteraan zit en worden ze een beslissing. Zet hem eerder dan je denkt — de dag vóór het event is te laat om iemand te vervangen.',
        },
      ],
      note: {
        tag: 'De pot volgt de inschrijvingen',
        body: 'De getoonde prijzenpot is wat je zelf hebt ingelegd, plus de inleg maal het aantal **goedgekeurde** inschrijvingen. Hij beweegt terwijl inschrijvingen worden goedgekeurd en uitgesloten, dus het getal op de pagina is altijd het bedrag dat je daadwerkelijk zou kunnen uitbetalen.',
      },
    },

    collect: {
      title: 'Innen',
      body: [
        'Inleg wordt geïnd zoals jullie clan sowieso al geld int — in het spel, op Discord, hoe jullie het ook doen. Anvils werk begint op het moment dat het binnenkomt: iemand met stafttoegang markeert het als **betaald**, en dat legt vast wie zegt het te hebben ontvangen, en wanneer.',
        'Spelers hebben ook een stem. Een lid kan melden aan wie hij betaalde en er een schermafbeelding bij hangen, en dat is wat “ik heb echt betaald” tot een vastlegging met twee kanten maakt. Wanneer de melding van de speler en de bewering van de inner verschillende mensen noemen, is dat een geschil dat de site je kan tonen in plaats van een dat je midden in een ruzie ontdekt.',
      ],
      note: {
        tag: 'Het bewijs wordt met opzet verwijderd',
        body: 'Een betaalschermafbeelding wordt alleen bewaard tot de inleg is afgesloten en daarna verwijderd. Hij bestaat om een meningsverschil op te lossen, niet om een jaar in een archief te liggen.',
      },
    },

    sign: {
      title: 'De tweede handtekening',
      body: [
        'Inleg staat op **geïnd** tot een _ander_ staflid bevestigt dat hij is aangekomen. Wie het geld heeft aangenomen kan niet ook degene zijn die tekent dat het is aangekomen — dat is de hele controle, en daarom weigert de site de eigen bevestiging van een inner in plaats van er alleen van af te raden.',
        'Hoeveel handtekeningen een inleg vraagt is een claninstelling, van nul tot vijf. Nul bestaat om een echte reden: in een clan waar de penningmeester _de_ eigenaar is, is er niemand anders om te tekenen, en “34 inlegposten wachten op een tweede handtekening” wordt een rij die nooit leeg kan en permanent het luidste op het dashboard. Bij nul **is** het als betaald markeren de handtekening.',
        'Zet hem op één — de standaard — als jullie met z’n tweeën zijn. Zet hem op nul als dat eerlijk gezegd niet zo is, en hoger alleen als je clan zowel de mensen als de reden heeft.',
      ],
    },

    pay: {
      title: 'Uitbetalen',
      body: [
        'Als het event afloopt, maakt het **Payouts**-tabblad van het event van de pot een lijst met mensen. Genereer hem en je krijgt één rij per ontvanger, niet per team: de prijs van een winnend team wordt gelijk over de leden verdeeld, zodat uitbetalen een lijst met namen en getallen is en geen rekensom om middernacht.',
        'De bedragen beginnen bij een voorgestelde verdeling — zwaar naar de winnaar, en hoe meer betaalde plaatsen je instelt hoe vlakker hij wordt — en elke rij is aan te passen. Het voorstel is een startpunt, geen beleid.',
        'Daarna betaal je ze uit en vink je rijen af terwijl je bezig bent. Het punt is dat iemand een week later naar de lijst kan kijken en kan zien wie wat kreeg, in plaats van het uit de Discord-geschiedenis te reconstrueren.',
      ],
      note: {
        tag: 'Kondig het één keer aan, hiervandaan',
        body: 'Uitbetalingen worden vanuit het event zelf in jullie Discord-kanalen gepost, dus de aankondiging en de vastlegging zijn hetzelfde. Een met de hand aangekondigde prijs is een prijs waarvan later iemand beweert dat hij nooit is aangekomen.',
      },
    },

    disputes: {
      title: 'Als de getallen niet kloppen',
      intro: 'De vier die je werkelijk tegenkomt:',
      rows: [
        {
          term: 'Hij zegt betaald te hebben, niemand heeft het gemarkeerd',
          body: 'vraag hem de betaling te melden met een schermafbeelding. Dat zet een genoemde inner en een tijdstempel in de vastlegging, en die genoemde persoon kan bevestigen of ontkennen.',
        },
        {
          term: 'Twee stafleden denken allebei dat zij het aannamen',
          body: 'de eigen melding van de speler is de doorslag — die noemt aan wie hij het geld gaf. Corrigeer de inner en sluit de inleg daarna af.',
        },
        {
          term: 'Inleg zit vast te wachten op een handtekening',
          body: 'óf hij wacht echt op iemand anders, óf je clan heeft minder stafleden dan de instelling voor vereiste bevestigingen aanneemt. Verlaag de instelling in plaats van je eigen inning te bevestigen.',
        },
        {
          term: 'De pot veranderde nadat je het mensen had verteld',
          body: 'hij volgt goedgekeurde inschrijvingen, dus een inschrijving goedkeuren of uitsluiten verschuift hem. Noem de pot zoals hij staat bij het sluiten van de inschrijving, niet bij het openen.',
        },
      ],
    },
  },

  moderator: {
    metaTitle: 'Aan de beurt — Anvils moderatorhandleiding',
    metaDescription:
      'Een dag als moderator op een Anvil-clansite: de wachtrij, inzendingen en accounts controleren, de ledenlijst eerlijk houden, en de afwegingen.',
    eyebrow: 'Anvil · voor moderators',
    title: 'Aan de beurt',
    dek: 'Een moderator doet het werk dat binnenkomt of er nu een event loopt of niet: bewijzen om naar te kijken, accounts om te verifiëren, een ledenlijst die afdrijft. Dit is waar de wachtrij uit bestaat, en hoe je hem leegt zonder zelf de reden te worden dat mensen wachten.',
    facts: [
      { strong: 'Geen events', rest: 'een moderator kan ze niet aanmaken of bewerken' },
      { strong: 'Eén pagina', rest: 'zegt wat op je wacht' },
      { strong: 'Keur snel goed', rest: 'een trage rij voelt als een kapotte site' },
    ],
    footnote:
      'Een moderator ziet alles wat een lid ziet plus de beoordelingsomgeving. Events aanmaken en bewerken, instellingen, staf en uitbetalingen zijn werk voor admins en penningmeesters — ontbreekt er een knop, dan is dat de reden, en het is opzet.',

    what: {
      title: 'Wat de rol is',
      intro:
        'De rollen stapelen naar beneden: alles wat een moderator kan, kunnen een penningmeester en een admin ook. Wat specifiek van een moderator is:',
      canList: [
        'de ledenlijst: synchroniseren, mensen toevoegen, een gast promoveren',
        'accountverificaties — de XP-uitdaging en handmatige beoordeling',
        'inzendingen en bewijsafbeeldingen',
        'weekcompetities en de agenda',
        'feedback van leden',
      ],
      cantIntro: 'Wat ze bewust niet kunnen:',
      cantList: [
        'een event of zijn vakjes aanmaken of bewerken',
        'claninstellingen of de Discord-koppeling wijzigen',
        'iemand promoveren, of aan de staf komen',
        'inleg afsluiten of een uitbetaling draaien',
      ],
    },

    queue: {
      title: 'Begin bij wat op je wacht',
      body: [
        'Het admindashboard is geen samenvatting van de site — het is een lijst van wat wacht, gesorteerd naar hoe zwaar het weegt, berekend uit echte gegevens in plaats van uit tellers die afdrijven. Zegt het dat er niets op je wacht, dan wacht er niets.',
        'Werk van boven naar beneden. De items die bovenaan komen zijn die met een mens aan de andere kant: iemand die zich niet kan inschrijven omdat zijn account niet geverifieerd is, of wiens drop niet is geteld omdat er nog niemand naar heeft gekeken.',
      ],
    },

    submissions: {
      title: 'Inzendingen en bewijs',
      body: [
        'De meeste bijschrijvingen bereiken je nooit: de plugin ziet de drop, legt een schermafbeelding vast gestempeld met team en een UTC-tijdstempel, en het vakje rondt af. In de wachtrij belanden de handmatige vakjes en alles wat de plugin heeft gemarkeerd.',
        'De stempel is wat een bewijs moeilijk te betwisten maakt. Een plugin-schermafbeelding draagt het team en het moment ingebakken in het beeld, en met tweebeeldsbewijs aan toont een tweede beeld een paar seconden later de loot op de grond. Een schermafbeelding zonder dat alles is een schermafbeelding van een telefoon, wat prima is — het betekent alleen dat jij degene bent die controleert.',
      ],
      rows: [
        {
          term: 'Keur goed als het aannemelijk is',
          body: 'je controleert geen bank. Toont het beeld het ding, staat het account op de ledenlijst en valt het tijdstempel binnen het event, keur dan goed en ga verder.',
        },
        {
          term: 'Wijs af met een reden',
          body: 'een afwijzing zonder uitleg komt binnen het uur als DM bij je terug. Zeg wat er ontbrak, zodat de tweede poging klopt.',
        },
        {
          term: 'Een gemarkeerde inzending is een vraag, geen beschuldiging',
          body: 'de plugin markeert wat hij niet volledig kon bevestigen — meestal een speler die geen startfoto heeft ingediend. Lees het als “kijk hier even naar”, niet als “iemand heeft valsgespeeld”.',
        },
      ],
    },

    verify: {
      title: 'Accounts verifiëren',
      intro:
        'Niemand kan zich zonder minstens één geverifieerd account voor een event inschrijven, deze wachtrij houdt mensen dus rechtstreeks van het spelen af. Die is het waard dagelijks leeg te maken.',
      rows: [
        {
          term: 'Geverifieerd via de plugin',
          body: 'het gewone geval, en het vraagt niets van jou. Het account spelen met de plugin verbonden koppelt het automatisch, en een stabiele accountvingerafdruk laat de koppeling een naamswijziging overleven.',
        },
        {
          term: 'Verify by XP',
          body: 'voor spelers zonder plugin. De site kiest een willekeurige skill en ze moeten daarin binnen dertig minuten 1.000 XP halen. Dat controleert zichzelf — je ziet alleen wie het niet haalt.',
        },
        {
          term: 'Handmatige beoordeling',
          body: 'verborgen Hiscores, of een altaccount dat te nieuw is om erop te staan. Iemand dient een RSN met een notitie in en jij beslist. Vraag om een schermafbeelding van het inlogscherm als de notitie niet volstaat.',
        },
      ],
      note: {
        tag: 'Geverifieerd is niet hetzelfde als lid',
        body: 'Een account verifiëren zegt “dit is echt van hem”. Het maakt hem geen deel van de clan — clanlidmaatschap komt alleen uit een synchronisatie van de ledenlijst in het spel of van een admin die hem met de hand toevoegt. Wie geverifieerd is maar niet op de lijst staat, is een **gast**: bijgehouden, zichtbaar, geen lid. Dat is opzet, en juist dat voorkomt dat iemand jouw clan binnenkomt door een naam in te tikken.',
      },
    },

    roster: {
      title: 'De ledenlijst eerlijk houden',
      body: [
        'De ledenlijst komt uit precies één plek: een admin draait een synchronisatie vanuit de clanlijst in het spel, via het Bingo-tabblad van de plugin in de Collection Log. Al het andere — verificaties, koppelingen, inschrijvingen — hangt daaraan.',
        'Het onderhoudswerk is dus klein maar echt: draai de synchronisatie na elke wervingsronde, promoveer de gasten die daadwerkelijk zijn toegetreden, en kijk naar de mensen die de site heeft gemarkeerd in plaats van te wachten tot ze klagen.',
      ],
      note: {
        tag: 'Laatst gezien is niet laatst gespeeld',
        body: 'Het tijdstempel “laatst gezien in de clan” legt de laatste synchronisatie vast die het lid vond, niet de laatste keer dat hij inlogde. Voor “speelt hij nog” lees je in plaats daarvan de tijd van zijn live-statistiek — die beweegt vanzelf.',
      },
    },

    startshot: {
      title: 'Startfoto’s beoordelen',
      body: [
        'Bij een event dat er een vraagt, moet elke speler een schermafbeelding indienen, gemaakt nadat het event live ging, op een locatie die op het startmoment geloot werd. Plugin-opnames met een geverifieerd codewoord komen al goedgekeurd binnen, in de praktijk kijk je dus alleen naar de spelers die met de hand vanaf een telefoon hebben geüpload.',
        'Wat je controleert is weinig: dat het personage in beeld is, dat het codewoord in het chatvenster staat, en dat het het codewoord is dat juist die speler kreeg. De uploads tellen meteen en jij beoordeelt ze achteraf, dus niemand wordt van het spelen gehouden terwijl hij op jou wacht.',
      ],
    },

    judgement: {
      title: 'De afwegingen die je zult moeten maken',
      intro:
        'Geen ervan heeft een goed antwoord in software, en juist daarom komen ze bij een mens terecht.',
      rows: [
        {
          term: 'Het bewijs is echt maar laat',
          body: 'de drop gebeurde binnen het event en de schermafbeelding kwam erna. Meestal goedkeuren — kijk naar de stempel in het beeld, niet naar de uploadtijd.',
        },
        {
          term: 'Het account is nog niet gekoppeld',
          body: 'de drop is echt, het account is van hem, het werd alleen niet toegevoegd voordat hij speelde. Laat het koppelen en keur dan goed. Laat niemand een raid overdoen om papierwerk.',
        },
        {
          term: 'Het ziet er in scène gezet uit',
          body: 'breng het naar een admin in plaats van het zelf af te wijzen. Een afwijzing is binnen een kleine clan een publieke beschuldiging, en dat hoort nooit de snelle beslissing van één persoon te zijn.',
        },
        {
          term: 'Je zit zelf in het event',
          body: 'dat doe je vrijwel zeker. Geef alles wat je eigen team betreft door aan een andere moderator — niet omdat je oneerlijk zou zijn, maar omdat je niet zou moeten hoeven bewijzen dat je dat niet was.',
        },
      ],
    },
  },
};

export default nl;
