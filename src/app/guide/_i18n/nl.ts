import type { PartialGuideDict } from './en';

// Nederlands — Dutch.
//
// Zelfde afspraak als in alle andere taalbestanden hier: alles wat de lezer in Anvil, RuneLite en
// OBS daadwerkelijk OP HET SCHERM ZIET blijft Engels — menu's in RuneLite en OBS, de chatregels van
// de plugin zelf, en Anvils eigen adminlabels, die Engels zijn tot ook die kant vertaald wordt. Een
// vertaalde "Tracked drop detected" is een regel die niemand terugvindt.
// Discords eigen UI-labels (menu's, instellingen, namen van machtigingen: "Server-ID kopiëren",
// "Serverinstellingen → Rollen", "Webhooks beheren") volgen Discords eigen Nederlandse vertaling — wat
// de Discord-client van de lezer toont — en zouden Engels blijven waar Discord niet vertaald is.
// Al het andere — de uitleg, de volgorde, het waarom — is Nederlands.

const nl: PartialGuideDict = {
  common: {
    contents: 'Inhoud',
    step: 'Stap',
    optional: 'optioneel',
    minRead: '{n} min lezen',
    copyLink: 'Kopieer een link naar dit onderdeel',
    linkCopied: 'Link gekopieerd',
    language: 'Taal',
    partialNotice:
      'Deze handleiding is maar gedeeltelijk vertaald naar het {language}. Wat nog niet vertaald is, staat er in het Engels.',
    backToGuides: 'Alle handleidingen',
    unreviewedNotice:
      'Deze vertaling naar het {language} is nog door geen enkele moedertaalspreker nagelezen. Leest een zin verkeerd, dan is [de Engelse pagina]({englishHref}) het origineel — en [het ons laten weten](/feedback) is wat het rechtzet.',
    support: {
      lead: 'Vastgelopen, of klopt er iets niet?',
      link: 'Vraag het in de Anvil-support-Discord',
    },
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
      streamers: 'Streamers',
    },
    anvilTab: 'Anvil gebruiken',
    ingame: {
      title: 'In-game gidsen',
      dek: 'Raids, bosses, skilling en geld verdienen uit de Anvil-bibliotheek — dezelfde gidsen die de plugin in-game toont en de bot in Discord plaatst.',
      browse: 'Alle gidsen bekijken',
      language: 'Deze gidsen zijn niet vertaald: ze staan er zoals ze geschreven zijn, in welke taal deze pagina ook is.',
      empty: 'De Anvil-bibliotheek heeft nog geen gepubliceerde gidsen. Kom snel terug.',
      placeholder: 'Zoek in de in-game gidsen — probeer "zulrah", "raids" of "money"',
      readTime: '{n} min lezen',
      metaTitle: 'In-game OSRS-gidsen — Anvil',
      metaDescription: 'Gidsen voor raids, bossing, skilling en geld verdienen uit de Anvil-bibliotheek, te lezen op de site, in-game via de RuneLite-plugin en in Discord.',
    },
    search: {
      placeholder: 'Zoek in de handleidingen — probeer "webhook", "vakjes" of "drops komen niet binnen"',
      results: '{n} handleidingen',
      empty: 'Niets gevonden. Probeer een gewoner woord — "vakjes", "uitbetaling", "bot" — of blader door de lijst hieronder.',
      clear: 'Zoekopdracht wissen',
    },
    cards: {
      tiles: {
        eyebrow: 'Voor spelers',
        title: 'Regels en beperkingen van vakjes',
        blurb: 'Wat een vakje van je nodig heeft voordat je begint (een game-instelling, de plugin, een gesynchroniseerde log, een hiscores-rang) en wat het niet kan bijhouden.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'Voor wie de server beheert',
        title: 'Anvil in Discord',
        blurb: 'Eén uitnodiging, dan de kanalen waar elke feed post, rollen, slash-commando’s, en wat je nakijkt als het stopt.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Overstappen naar Anvil',
        title: 'Overstappen van andere plugins en trackers',
        blurb:
          'Anvil post je drops op Discord en draait jullie wekelijkse wedstrijden. Vijf stappen voor het bestuur, twee voor spelers.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'Voor wie er een begint',
        title: 'Een clan starten',
        blurb: 'Twee namen en een adres, en hij staat live. Daarna Discord, je ledenlijst en het eerste bord.',
        minutes: '~4 min, gratis',
      },
      plugin: {
        eyebrow: 'Voor spelers',
        title: 'RuneLite-plugin instellen',
        blurb:
          'Installeer de plugin, log in vanuit het zijpaneel, en laat hem je drops insturen. Behandelt ook Discord-meldingen en spelers opzoeken.',
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
      coffer: {
        eyebrow: 'Voor penningmeesters',
        title: 'De clankas',
        blurb:
          'Eén pot voor het gp van de clan: wat erin gaat, de drie manieren waarop hij prijzen uitbetaalt, en wie eraan mag komen.',
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
      commands: {
        eyebrow: 'Voor elk lid',
        title: 'Slash-commando’s',
        blurb:
          'Elk commando waarop de bot in Discord antwoordt, wat elke optie doet, uitgewerkte voorbeelden, en wat je controleert als er een niet verschijnt.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'Voor streamers',
        title: 'Events organiseren voor je kijkers',
        blurb:
          'Geen clan nodig. Maak een space, deel één link, kies wie mee mag doen (volgers, subs, Discord-rollen) en zet het bord in je stream.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'Voor kijkers',
        title: 'Meedoen aan het event van een streamer',
        blurb:
          'Een link uit een stream gekregen? Log in, voeg je character toe, druk op Join. Wat je doet bij events alleen voor volgers of subs.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'Voor clans die streamen',
        title: 'Streamen voor clans',
        blurb:
          'Laat je kijkers aan één event meedoen zonder lid van de clan te worden. Zet Streaming aan en open daarna een event voor kijkers.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'Voor clanstaf',
        title: 'Je mensen: ledenlijst, gasten en wie mag joinen',
        blurb:
          'Waar leden vandaan komen, wat de filters op het Roster-tabblad betekenen, joinverzoeken en Needs review, de drie instellingen onder Who can join, en iemand verwijderen of verbannen.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'Voor eigenaars en admins',
        title: 'Stafrollen: wie mag wat',
        blurb:
          'Eigenaar, admin, penningmeester en moderator: waar elke rol bij kan, hoe je iemand moderator maakt, wie welke rol mag geven, en taken voor één event.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'Voor spelers',
        title: 'Anvil Supporter: niveaus en voordelen',
        blurb:
          'Supporter, Champion en Patron: naamkleuren, de ster, profielfoto’s, de vitrine, vriendenevents en clanboosts, hoe betalen werkt en wat er gebeurt als je stopt.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'Voor spelers',
        title: 'Het zijpaneel, tabblad voor tabblad',
        blurb:
          'Clan, Feed, You, Lookup en het tandwiel: wat elk tabblad toont, eventchat, GZ- en Sad-reacties, en de instellingen die de feed en Supporter-kleuren in je spel brengen.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'Voor Supporters en clanstaf',
        title: 'Een clan boosten',
        blurb:
          'Een boost plaatsen en verplaatsen, de drie levels en wat elk ervan ontgrendelt, de naamkleuren van de clan, geschonken boosts, en boostertekens en badges.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'Voor spelers',
        title: 'Je profiel, Wrapped en Compare',
        blurb: 'Je profiel, de openbare pagina van elk character en je persoonspagina, wie die kan zien, de maandelijkse en event-Wrapped-kaarten, en het vergelijken van twee characters.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'Voor spelers',
        title: 'Instellingen, pagina voor pagina',
        blurb: 'Discord-berichten en privacy van screenshots, de chatfeed in het spel, apparaten, je eigen webhooks, wie je characters ziet, elk character, en eigendomsclaims.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'Voor spelers',
        title: 'Challenges en vriendenevents',
        blurb: 'Daag één speler uit voor een race op drops, kills of XP, en host een privébord voor je vrienden achter één uitnodigingslink.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'Voor spelers en clans',
        title: 'Clans, events en ranglijsten vinden',
        blurb: 'De Clan Hall, twee clans vergelijken, de wekelijkse ranglijst, de openbare eventlijst, en pagina\'s voor in-game clans die niet op Anvil staan.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'Voor spelers en clanstaf',
        title: 'In-game gidsen',
        blurb: 'De gidsenbibliotheek per niveau lezen, een nieuwe gids of een wijziging voorstellen, en de eigen kopieën van je clan bijhouden.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'Voor clanstaf en spelers',
        title: 'Skill en Boss of the Week',
        blurb: 'Een wekelijkse wedstrijd inplannen, herhalen en laten roteren, startlijnen, prijzen, vroegtijdig stoppen, en wat spelers zien.',
        minutes: '~4 min',
      },
      teamComps: {
        "eyebrow": "Voor clanstaff en spelers",
        "title": "Teamwedstrijden",
        "blurb": "Skill- en bosswedstrijden als teams of clan tegen clan: opzetten, clans uitnodigen, hoe totalen en gemiddelden werken en wat spelers zien.",
        "minutes": "~4 min"
      },
      clanEvents: {
        eyebrow: 'Voor clanstaf',
        title: 'Clanevents en de planning',
        blurb: 'Massa\'s, raidavonden en meetups: wekelijkse herhalingen, “Ik ga” en aanmeldingen, Discord-herinneringen, uitbetalingen, enquêtes, en gaten in de planning vinden.',
        minutes: '~4 min',
      },
    },
  },

  switching: {
    metaTitle: 'Overstappen van andere plugins en trackers — Anvil',
    metaDescription:
      'Verhuis je clan naar Anvil: stel de Discord-kanalen in, synchroniseer de clanlijst, start Skill of Boss of the Week en vertel het je leden.',
    eyebrow: 'Overstappen naar Anvil',
    title: 'Overstappen van andere plugins en trackers',
    dek: 'Anvil post de drops en prestaties van je clan op Discord. Het houdt ook je clanlijst bij en draait wekelijkse wedstrijden.',

    staff: {
      title: 'Als je de clan leidt',
      body: [
        '**Laat de bot je kanalen instellen.** Ga naar Admin → Discord → **Set it up for me**. Kies één kanaal of meerdere. Als een andere plugin ergens postte, vink dan _Use the same channels_ aan. Voor je leden verandert er niets.',
        '**Synchroniseer je clanlijst.** Open in RuneLite de instellingen van de Anvil-plugin. Zet **Keep the clan roster in sync** aan. Eén admin doet dit één keer, in het spel. Dit vervangt een clanlijst die je ergens anders bijhield.',
        '**Start een Skill of Boss of the Week.** Ga naar Admin → All events → **+ New event** en kies Skill of the Week of Boss of the Week. Iedereen op de clanlijst doet automatisch mee. Dit vervangt wedstrijden die je ergens anders hield.',
        '**Vertel het je leden.** Ga naar Admin → Discord → **Tell your members** → **Post it**. De bot post de stappen voor spelers voor je.',
        '**Een week later: opruimen.** Ga naar Admin → Discord → **Remove old webhooks from other plugins**, vink aan welke weg mogen, klik op **Remove … webhooks** en daarna op **Yes, remove them**. Daarna kan niets meer dubbel posten. Klik op **Keep** bij elke webhook die je met rust wilt laten.',
      ],
    },

    player: {
      title: 'Als je speler bent',
      body: [
        '**Installeer Anvil.** Open in RuneLite de Plugin Hub, zoek naar Anvil en klik op **Install**. Log daarna in met Discord via het Anvil-zijpaneel.',
        '**Zet de meldingen van je oude plugin uit** zodat niets dubbel wordt gepost. Of verwijder de plugin, als je hem voor niets anders gebruikt.',
        '**Dat is alles.** Er is verder niets in te stellen.',
      ],
    },

    questions: {
      title: 'Vragen',
      intro: 'De vragen die clans het vaakst stellen:',
      rows: [
        {
          term: 'Houdt Anvil kill counts, slayer-taken en persoonlijke records bij?',
          body: 'Ja. Anvil houdt kill counts, slayer-taken en persoonlijke records zelf bij, dus er is niets anders dat je moet blijven draaien.',
        },
        {
          term: 'Moeten spelers ergens een webhook plakken?',
          body: 'Nee. De clan stelt de kanalen in op de site.',
        },
        {
          term: 'Wil je ook posts op je eigen server?',
          body: 'Ga naar je profiel → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Een clan starten — Anvil',
    metaDescription: 'Een clan aanmaken op Anvil: een naam geven, een adres kiezen, Discord koppelen, je ledenlijst synchroniseren en je eerste event draaien.',
    eyebrow: 'Anvil · beginnen',
    title: 'Een clan starten',
    dek: 'Twee namen en een adres, en je clan staat live — gratis, en er valt niets af te wachten. Dat is dit, plus de vier dingen die je er meteen daarna bij wilt doen.',
    facts: [
      {
        strong: 'Gratis',
        rest: 'geen kaart, geen proefperiode',
      },
      {
        strong: 'Live',
        rest: 'zodra je verzendt',
      },
      {
        strong: '~4 min',
        rest: 'tot een werkende clan',
      },
    ],
    footnote: 'Dit kun je later allemaal aanpassen via Admin → **Clan settings**, behalve het adres — daar is het nu even over nadenken waard.',
    before: {
      title: 'Voordat je begint',
      body: [
        'Je hebt een Discord-account nodig, en dat is de hele lijst. Meld je eerst aan op `{apex}`: een clan heeft een eigenaar nodig, en via het aanmelden weet de site dat jij dat bent. Begin bij **Een clan starten** op de platformpagina’s, of ga direct naar `{apex}/clans/new`.',
        'Het kost niets. Geen abonnement te kiezen, geen kaart in te vullen, en geen proefperiode die verloopt en je bord meeneemt — een clan begint gratis en blijft bruikbaar.',
        'Grote clans kunnen later overstappen op een groter abonnement via **Plan and billing** in Admin. Alles wat je op Anvil betaalt — een clan, een creator-space of je eigen Supporter-lidmaatschap — staat op [je factuurpagina](/portal).',
      ],
      note: {
        tag: 'Jij wordt de eigenaar',
        body: 'Eigenaar is de ene rol die niemand je kan afnemen, en die gaat naar wie de clan aanmaakt. Voeg daarna staf toe via Admin → **People** → **Staff & roles**; zie [Op het rooster]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Naam geven en een adres kiezen',
      intro: 'Drie velden, en maar twee echte beslissingen. Het formulier controleert het adres terwijl je typt en zegt het je vóór je verzendt.',
      fields: [
        {
          term: 'Clannaam in het spel',
          body: 'Verplicht, en hij moet **exact** overeenkomen met OSRS. Dit is geen versiering: de rostersynchronisatie matcht hierop en weigert een ledenlijst die onder een andere naam wordt gemeld. Dat is wat voorkomt dat andermans ledenlijst op jouw site belandt.',
        },
        {
          term: 'Clannaam',
          body: 'Optioneel. Wat mensen zien — op de site en in elke Discord-post. Laat het leeg en je spelnaam wordt voor beide gebruikt.',
        },
        {
          term: 'Adres',
          body: 'Je clan staat op `{apex}/c/jouw-slug`. Hij wordt voorgesteld op basis van de naam die je typte, je kunt hem aanpassen, en een handvol woorden is gereserveerd. Kies er een die je over een jaar nog mooi vindt: dit is de link die in je Discord vastgepind komt te staan.',
        },
      ],
      note: {
        tag: 'De spelnaam is een slot, geen label',
        body: 'Als je clan in het spel hernoemt, verander hem hier ook — tot die tijd weigert de rostersynchronisatie de nieuwe naam. Dat is de controle die werkt, geen storing.',
      },
    },
    live: {
      title: 'Hij staat live',
      body: [
        'Druk op **Clan aanmaken** en hij bestaat. Geen provisioning, geen wachtrij, geen „we bouwen je site, kom over een paar minuten terug” — een clan is een rij, dus hij draait al voordat de pagina klaar is met wisselen.',
        'Je komt uit bij een keuze tussen **Instellen**, wat de wizard opent, en **Eerst rondkijken**. Er gaat niets stuk als je wegloopt en morgen terugkomt; de wizard onthoudt welke stappen je gedaan hebt.',
      ],
    },
    setup: {
      title: 'De installatiewizard',
      intro: 'Drie stappen staan tussen een verse clan en een lopend event, en de wizard loopt ze op volgorde af en slaat over wat je al gedaan hebt. Het bord komt direct daarna.',
      steps: [
        {
          term: 'Je clan',
          body: 'Je weergavenaam, je clannaam in het spel, en een uitnodigingslink naar je server. Die uitnodiging is wat aanmeldpagina’s en gidsen naar je laat verwijzen.',
        },
        {
          term: 'Discord koppelen',
          body: 'Eén gedeelde bot, dus geen applicatie te registreren en geen token te plakken. Druk op **Connect your bot** en keur hem één keer goed, kies dan **A few channels** of **Just one channel** en druk op **Set it up for me** — de bot maakt de kanalen voor je aan.',
        },
        {
          term: 'Haal je leden binnen',
          body: 'Installeer de plugin, meld je aan met Discord, open dan in het spel je clanvenster en druk op de **Anvil**-knop in de titelbalk. Niemand kan zich voor een event aanmelden tot je ledenlijst binnen is.',
        },
        {
          term: 'Maak een bord',
          body: 'De wizard eindigt op **Create your first event →**. Kies een formaat, voeg tegels toe, open aanmeldingen — dat is [Je eerste event draaien]({adminGuide}), en veruit de langste stap.',
        },
      ],
      after: [
        'Je kunt de wizard helemaal overslaan met **Skip setup** en alles later doen via Admin → **Clan settings** en Admin → **Discord**. Hij bestaat omdat de volgorde ertoe doet als je het nooit eerder gedaan hebt: Discord vóór kanalen, leden vóór een bord waarvoor ze zich moeten aanmelden.',
      ],
    },
    members: {
      title: 'Je leden binnenhalen',
      body: [
        'Niemand hoeft zich aan te melden, te registreren of één voor één uitgenodigd te worden. Je ledenlijst komt uit het spel.',
      ],
      ways: [
        {
          term: 'Rostersynchronisatie (doe deze)',
          body: 'Open het clanvenster in het spel met de plugin actief en druk op de **Anvil**-knop in de titelbalk. Je hele ledenlijst komt binnen met rangen en al, en een lijst van een clan waarvan de naam niet klopt wordt geweigerd. Herhaal het wanneer mensen komen of gaan — zie de [installatiegids voor spelers]({pluginGuide}).',
        },
        {
          term: 'Ze vragen om te joinen',
          body: 'Inloggen of spelen met de plugin geeft niemand uit zichzelf een plek. Ziet de plugin iemand spelen in je clan in het spel voordat je ledenlijst hem heeft, dan dient hij een joinverzoek voor hem in, en ieder ander kan het vragen met **Apply** op je clanpagina. De staf beantwoordt beide bovenaan het **Roster**-tabblad, en **Who can join** bepaalt of ze op een ja wachten, meteen binnenkomen of helemaal niet kunnen vragen. Wie een character speelt dat al op je ledenlijst staat, wordt in plaats daarvan bevestigd onder **Needs review**. De details staan in [Je mensen]({peopleGuide}).',
        },
        {
          term: 'Met de hand',
          body: 'Via Admin → **People** → **+ Add Manually** voeg je namen één voor één toe, voor de persoon op mobiel of de officiële client die de plugin helemaal niet kan draaien.',
        },
      ],
      note: {
        tag: 'Gasten zijn geen probleem om op te lossen',
        body: 'Een gast speelt mee in je events zonder in je clan in het spel te zitten: een speler van een bezoekende clan, een vriend, een alt. Hij krijgt een plek als de staf zijn verzoek goedkeurt, of meteen als **Who can join** op **Let anyone in** staat. Gasten worden bijgehouden, kunnen meedoen aan events en tellen niet mee voor je abonnement. Wie in het spel bij je clan komt, wordt lid bij de volgende synchronisatie van de ledenlijst.',
      },
    },
    first: {
      title: 'Je eerste event',
      body: [
        'De kortste weg naar iets dat gebeurt: maak een bord, voeg een handvol tegels toe die de plugin zelf kan zien, open aanmeldingen en start. Drops, killcounts en XP schrijven zichzelf dan in.',
        'Twee gidsen dragen hier het gewicht. [Je eerste event draaien]({adminGuide}) loopt van begin tot eind — Discord, teams, starten, en wat te doen als het afloopt. [Een bord bouwen dat zichzelf bijhoudt]({boardGuide}) gaat specifiek over tegels: wat elk soort echt kan detecteren, en welke netjes importeren en dan nooit afgaan.',
        'Wil je in je eerste week liever helemaal geen bord bouwen, draai dan een **Skill of the Week** of **Boss of the Week**. Iedereen op de lijst doet automatisch mee, de stand komt van de hiscores, en er valt niets te schrijven.',
      ],
    },
    together: {
      title: 'Events over meerdere clans',
      body: [
        'Een event hoeft niet bij één clan te horen. Meerdere clans kunnen hetzelfde bord samen draaien — twee, of een stuk of twaalf — waarbij elke kant zijn eigen ledenlijst, eigen staf en eigen helft van de moderatie houdt.',
        'Ze kunnen ook één poule spelers delen in plaats van aan weerszijden van een scorebord te zitten: één event, iedereen erin, hoe de teams ook uitvallen. Clan-tegen-clan is één vorm hiervan, niet de enige.',
        'Elke bezoekende clan krijgt een uitnodigingslink per team, zodat je nooit één RSN met de hand verzamelt, en een zetel waarmee hun eigen moderator het bewijs van hun eigen leden kan goedkeuren. [Een bezoekende clan ontvangen]({clanVsClanGuide}) behandelt het organiseren.',
      ],
      note: {
        tag: 'Niets te kopen',
        body: 'Meedoen aan andermans event is gratis, en er zelf een organiseren ook. Een clan die alleen ooit op andermans borden verschijnt heeft nooit meer nodig dan zijn eigen gratis clan.',
      },
    },
    boosts: {
      title: 'Clanboosts',
      body: [
        'Leden die Anvil Supporter op **Champion** (één boost) of **Patron** (twee) betalen, kunnen de clan boosten via hun eigen **Settings → Clan boosts**. Een boost telt zodra hun plek in de clan 14 dagen oud is, en van één persoon tellen er nooit meer dan twee.',
        'Waar je staat zie je op Admin → **Clan settings** → **Boosts**: het level van de clan, hoeveel boosts er meetellen en hoeveel het volgende level er nog nodig heeft. Level 1 vraagt 3 boosts, Level 2 vraagt er 8 en Level 3 vraagt er 15. Zakken de boosts onder een level, dan blijven de voordelen ervan eerst nog een week.',
        'Level 1 zet een **Boosted**-badge op je clanpagina, op je kaart in de Clan Hall en in de zoekresultaten, zet je in de Clan Hall boven clans zonder boost en geeft je naam een kleurverloop. Level 2 voegt een plek in de Featured-rij van de Clan Hall toe, speelt je geanimeerde banner af en ontgrendelt een **Recruiting line**: één zin, tot 140 tekens, die bezoekers te zien krijgen. Level 3 voegt een Spotlight bovenaan de Clan Hall toe en één **Recruitment post in the Anvil Discord** per maand, tot 500 tekens, één keer verstuurd met **Post to the Anvil Discord**, met een link naar je clanpagina en zonder dat iemand gepingd wordt.',
      ],
      note: {
        tag: 'Alleen het uiterlijk',
        body: 'Boosts veranderen hoe de clan eruitziet en waar hij vermeld staat. Ze veranderen nooit een rang, een score, je zetels of je abonnement.',
      },
    },
    features: {
      title: 'Functies en abonnement',
      intro: 'Admins kunnen hele onderdelen van Anvil aan of uit zetten onder **Features**. Uit verbergt ze in de menu\'s; er wordt niets verwijderd.',
      rows: [
        {
          term: 'Events',
          body: '**Skill & Boss of the Week** (aan), **formats met verrassingstaken** (uit), **Missions** (uit), **Enquête na het event** (uit).',
        },
        {
          term: 'Geld',
          body: '**Inschrijfkosten** (aan), **Clankas** (uit).',
        },
        {
          term: 'Discord & plugin',
          body: '**Posten naar Discord** (aan), **Dood- en plezierberichten** (uit), **Clan Hall-kaart**, die op je openbare clanpagina laat zien wie er in je Discord online is (aan).',
        },
      ],
      outro: '**Plan and billing** toont je abonnement, hoeveel leden je hebt ten opzichte van de limiet, en de grotere abonnementen. Betaal je, dan staat ook **Manage subscription and invoices** er.',
    },
  },

  discord: {
    metaTitle: 'Anvil in Discord — Anvil',
    metaDescription: 'Koppel de Anvil-bot aan je Discord-server: één uitnodiging, de kanalen waar elke feed post, rol- en bijnaamsynchronisatie, slash-commando’s, en wat je nakijkt als het stil wordt.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil in Discord',
    dek: 'Eén bot, één uitnodiging, en geen applicatie te registreren. Dit is wat hij post, waar hij het post, wat hij in je server mag veranderen — en waar je naar kijkt op de dag dat het stopt.',
    facts: [
      {
        strong: 'Eén bot',
        rest: 'gedeeld, niets aan te maken',
      },
      {
        strong: '~5 min',
        rest: 'van uitnodiging tot eerste post',
      },
      {
        strong: 'Opt-in',
        rest: 'elke feed staat uit tot je hem ergens op richt',
      },
    ],
    footnote: 'Alles hier staat op Admin → **Discord**: bovenaan de snelle installatie, daaronder **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands en Post without a bot.',
    bot: {
      title: 'Eén bot, al gebouwd',
      body: [
        'Er is geen Discord-applicatie aan te maken, geen token te genereren en geen geheim te plakken. Anvil draait één bot die elke clan deelt, dus koppelen is een uitnodiging en verder niets.',
        'Je kunt nog steeds je eigen meebrengen — plak een token onder **Use your own bot instead (advanced)** en die wordt in plaats daarvan gebruikt. Alleen de moeite waard als je wilt dat de bot de naam en avatar van je clan draagt in de ledenlijst; alles in deze gids werkt hoe dan ook hetzelfde.',
      ],
      permissions: [
        {
          term: 'Kanalen bekijken, Berichten versturen, Links insluiten, Bestanden bijvoegen',
          body: 'De basis. Zonder deze staat hij in je server en zwijgt hij.',
        },
        {
          term: 'Webhooks beheren',
          body: 'Zodat **Set it up for me** en **Post here** webhooks voor je kunnen maken, in plaats van dat jij URL’s met de hand uit Discord kopieert, en zodat Anvil oude webhooks voor je kan opsporen om te verwijderen.',
        },
        {
          term: 'Rollen beheren',
          body: 'Alleen als je rolsynchronisatie aanzet. Hij kan dan de rollen uitdelen die je koppelt — en hij kan nooit aan een rol boven de zijne komen, wat Discords regel is, niet de onze.',
        },
        {
          term: 'Bijnamen beheren',
          body: 'Alleen als je bijnaamsynchronisatie aanzet, zodat de servernaam van een lid op hun RSN gezet kan worden.',
        },
        {
          term: 'Kanalen beheren',
          body: 'Voor privé-teamkanalen tijdens een draft, en voor gidsen die als nieuwe categorie of forum worden geplaatst. Sla het over en de rest werkt gewoon.',
        },
        {
          term: 'Threads beheren, Berichten versturen in threads',
          body: 'Voor gidsen in een forum: schrijven in de post en die weer verwijderen — zonder dit laat Discord een bot zelfs zijn eigen forumpost niet verwijderen.',
        },
        {
          term: 'Bijnaam wijzigen',
          body: 'Alleen als je de bot de naam van je clan geeft onder **Connection → Bot appearance in your server**. Het verandert alleen de naam van de bot in jouw server.',
        },
      ],
      note: {
        tag: 'Hij vraagt ze allemaal tegelijk',
        body: 'Discord kan een permissie niet later alsnog vragen, dus de uitnodigingslink vraagt de hele set en de functies die je nooit aanzet gebruiken de hunne nooit. De link opnieuw openen is ook hoe je een permissie herstelt die iemand heeft weggehaald.',
      },
    },
    connect: {
      title: 'Koppelen',
      intro: 'Twee dingen, in deze volgorde. De bot moet in je server zitten, en Anvil moet weten welke server de jouwe is.',
      steps: [
        {
          term: 'Nodig de bot uit',
          body: 'Admin → **Discord** → **Connect your Discord server** (of **Add Anvil to Discord**). Discord vraagt aan welke server je Anvil wilt toevoegen en stuurt je daarna hierheen terug, dus je kunt hem niet per ongeluk aan de verkeerde toevoegen. Later staat **Invite / re-invite the bot** onder **More settings → Connection**.',
        },
        {
          term: 'Stel het server-ID in',
          body: 'Alleen als de knop het niet kan: open **Can’t use the button? Enter the server ID**, rechtsklik op je servericoon in Discord → **Server-ID kopiëren** (vereist Ontwikkelaarsmodus, onder Geavanceerd in Discords eigen instellingen), plak het in **Your Discord server’s ID** en druk op **Save**. Dit veld maakt de koppeling specifiek van jou.',
        },
      ],
      after: [
        'Het paneel vertelt je daarna de waarheid in plaats van je bedoeling: of de bot echt lid is van die server, en welke permissies hij mist. Een groene regel daar is meer waard dan een opgeslagen formulier.',
      ],
      note: {
        tag: 'Het server-ID is de hele koppeling',
        body: 'Een server hoort op Anvil bij precies één clan, en slash-commando’s uit een server die niemand geclaimd heeft worden geweigerd in plaats van geraden. Tot je het instelt is de bot uitgenodigd en werkloos.',
      },
    },
    channels: {
      title: 'Webhooks instellen',
      body: [
        'Anvil post via **webhooks**, één per kanaal, en elk daarvan is optioneel. Er wordt nergens iets gepost tot je een feed op een kanaal richt — een verse clan is stil met opzet, niet per ongeluk.',
        'Zit de Anvil-bot in je server, dan maakt **Set it up for me** bovenaan **Admin → Discord** de kanalen aan en richt hij elke feed erop. Wil je het met de hand doen, open dan **More settings → What goes where** en begin met het **Catch-all channel** op **Clan & events**, daarna de **In-game catch-all** op **In-game (plugin)**: kies een kanaal uit de keuzelijst en het wordt opgeslagen. Zonder bot open je in Discord bij dat kanaal **Kanaal bewerken → Integraties → Webhooks**, maak je er een, kopieer je de URL, kies je **Paste a webhook…** in de keuzelijst, plak je hem en druk je op **Save**. Een webhook-URL kan in zijn kanaal posten, dus behandel hem als een wachtwoord; verwijder hem in Discord en maak een nieuwe als hij uitlekt. **Test**, en **Add another** om drukke posts over twee webhooks te verdelen, staan onder **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Catch-all channel',
          body: 'De belangrijkste, op het tabblad **Clan & events**. Starts en eindes van events, aanmeldingen die opengaan, standen, weekresultaten — alles wat de site post zonder eigen kanaal. Stel alleen deze in en je hebt een werkende clan.',
        },
        {
          term: 'In-game catch-all',
          body: 'Op het tabblad **In-game (plugin)**: waar alles uit het spel heen gaat dat geen eigen kanaal heeft. Stel deze als tweede in.',
        },
        {
          term: 'De gesplitste feeds',
          body: 'Eventposts, borden die je samen met andere clans organiseert, Skill & boss of the week en activiteiten uit de clanagenda kunnen afsplitsen van de catch-all; zeldzame drops, pets, collection log, levels, combat achievements, quests, diaries, doden en PvP-kills kunnen afsplitsen van de in-game catch-all. Wijzigingen in de ledenlijst, goedgekeurde aanmeldingen en het kasboek staan op **Staff only**. Lege gesplitste feeds vallen terug op hun catch-all. De kas is de uitzondering: leeg betekent helemaal geen posts over geld. Leagues en andere modi hebben hun eigen tabblad **Game modes**.',
        },
      ],
      note: {
        tag: 'Splits eerst de doden af',
        body: 'Doden zijn op de meeste borden de feed met het meeste volume en degene die al het andere bedelft. Als je maar één ding splitst, splits dat.',
      },
    },
    roles: {
      title: 'Rollen en bijnamen',
      body: [
        'Beide synchronisaties staan uit tot je ze inschakelt onder **Admin → Discord → Roles & nicknames**, en beide worden aangestuurd door de ledenlijst. Zet **Enable Discord role sync** aan, laat **Auto-match in-game rank → Discord role by name** aanstaan, kies eventueel algemene **Member roles** en **Guest roles**, sla op en druk op **Sync roles & nicknames now**. Iedereen heeft ook een gekoppelde Discord-identiteit nodig; het synchronisatierapport noemt iedereen die het niet kon thuisbrengen.',
      ],
      ways: [
        {
          term: 'Rolsynchronisatie',
          body: 'Voor automatisch koppelen van rangen moet de naam van de Discord-rol overeenkomen met de clanrang in het spel: `Owner`, `Deputy Owner`, `Coordinator`, `Overseer`, `General`, `Captain`, `Lieutenant`, `Sergeant`, `Corporal` of `Recruit`. Eigen rangen werken ook, als hun Discord-rol precies diezelfde naam heeft. Hoofdletters maken niet uit en onderstrepingstekens tellen als spaties, maar extra woorden komen niet overeen: `General` werkt, `OSRS General` niet. Leden- en gastrollen kies je apart, dus die mogen elke naam hebben.',
        },
        {
          term: 'Bijnaamsynchronisatie',
          body: 'Zet de servernaam van een lid op hun RSN. Standaard vult hij een lege bijnaam in, en je kunt hem opdragen er een te overschrijven die iemand zelf koos — dat is de instelling om vooraf over na te denken, niet achteraf.',
        },
      ],
      note: {
        tag: 'De rol van de bot moet boven de rollen staan die hij beheert',
        body: 'Discord laat geen enkele bot aan een rol op of boven zijn eigen komen, en weigert dat van jouw kant zwijgend — de synchronisatie doet dan gewoon niets. Sleep de Anvil-rol omhoog in **Serverinstellingen → Rollen** en hij werkt; opnieuw uitnodigen hoeft niet.',
      },
    },
    commands: {
      title: 'Slash-commando’s',
      body: [
        'De bot beantwoordt `/bingo` in je server (het bord, de stand, de regels, je eigen kaart) plus clancommando’s zoals `/sotw`, `/stats` en `/coffer`. Ze lezen de live site, dus niemand hoeft Discord te verlaten om te zien hoe hij ervoor staat. [Elk commando en zijn opties]({commandsGuide}) heeft een eigen pagina.',
        'Ze verschijnen ongeveer een minuut nadat de bot binnenkomt. Verschijnen ze helemaal niet, dan gaf de uitnodiging de bot wel maar zijn commando’s niet — dat zijn twee losse permissies, en een oudere uitnodigingslink vroeg er maar één. Gebruik opnieuw **Invite / re-invite the bot** onder **Connection** op de Discord-pagina; dat schopt de bot er niet uit en zet niets terug.',
      ],
      note: {
        tag: 'Hij antwoordt in ieders eigen taal',
        body: 'Standaard antwoordt de bot in de taal die dat lid in Discord ingesteld heeft, met Engels als terugval. Kies één taal onder **Bottaal** om dat voor iedereen te overschrijven — dat is ook de enige manier om Arabisch te krijgen, omdat Discord geen Arabische clienttaal heeft om te detecteren.',
      },
    },
    posts: {
      title: 'Wat hij post, en wanneer',
      body: [
        'Twee bronnen, en het is nuttig te weten welke welke is als er iets niet klopt.',
        'De **site** post events: een bord dat opengaat, aanmeldingen, een start, standen, de uitslag. Die komen uit Anvil zelf en blijven werken of iemand nu de plugin heeft of niet.',
        'De **plugin** post wat er in het spel gebeurt: drops, pets, doden, levels, collection log-slots, combat achievements. Die bestaan alleen voor leden die hem draaien, dus een stil dropskanaal betekent meestal een stille plugin, niet een kapotte webhook.',
      ],
      note: {
        tag: 'Niets wordt dubbel gepost',
        body: 'Een drop die een tegel afrondt is één post, niet één van de plugin en nog een van het bord.',
      },
    },
    modes: {
      title: 'Leagues, Deadman en andere modi',
      body: [
        'Leagues, Deadman, hardcore en andere modi draaien op hun eigen werelden met hun eigen personages. Hun posts zijn altijd gelabeld en tellen nooit mee voor borden of competities. Ze hebben hun eigen tabblad: **Admin → Discord → What goes where → Game modes**. Een modus verschijnt daar zodra een lid hem voor het eerst speelt.',
        'Elke modus heeft een schakelaar en een **To**-kanaal. Zet **Send game-mode posts to their own channels** aan om die kanalen te gebruiken; laat het uit en elke modus post in de gewone kanalen, nog steeds gelabeld. De knop **Posts** op de rij van een modus toont elk soort post dat hij verstuurt — de gebruikelijke en de eigen events van de modus — elk met een eigen schakelaar.',
        'Onder die lijst laten **Custom filters** een modus minder posten dan het hoofdspel. **Post drops rarer than 1 in…** stelt een eigen zeldzaamheidsgrens in (leeg = hetzelfde als het hoofdspel): items die altijd gepost worden, worden nog steeds gepost, maar drops die alleen om hun waarde meetellen niet. **Use its own level milestones** post een level-up alleen als die aan beide sets regels voldoet.',
      ],
      note: {
        tag: 'Strenger, nooit losser',
        body: 'De filters van een modus kunnen alleen posts weghalen. De plugin heeft je instellingen voor het hoofdspel al toegepast, dus niets wat een modusfilter doet kan een post terugbrengen.',
      },
    },
    cleanup: {
      title: 'Oude webhooks van andere plugins of bots',
      body: [
        'Zit de bot in je server, dan toont de Discord-pagina elke webhook daarin die niet van Anvil is. **Coming from other plugins?** biedt **Use the same channels** aan, zodat **Set it up for me** post waar je oude feeds postten en er voor je leden niets verschuift.',
        'Zodra je leden op Anvil zitten, ga je naar **Remove old webhooks from other plugins**, vink je aan welke weg mogen en druk je op **Remove … webhooks**, daarna op **Yes, remove them**. Dat verwijdert ze voorgoed in Discord — het kan niet ongedaan worden gemaakt.',
        'De lijst bevat elke webhook die niet van Anvil is, niet alleen die van een andere plugin. Wil je er een houden, zoals de feed van een andere bot? Druk op **Keep** en hij verdwijnt uit de lijst; met **Show kept** en **Put back** haal je hem terug. Houden verbergt hem alleen hier — in Discord verandert er niets.',
      ],
      note: {
        tag: 'Vereist Webhooks beheren',
        body: 'De bot leest de webhooks van je server om ze te vinden. Zonder _Webhooks beheren_ op zijn rol meldt de pagina dat hij ze niet kan zien.',
      },
    },
    announce: {
      title: 'Posten in Discord',
      body: [
        'Admins kunnen als de bot posten via **Post to Discord**, onder **Clan** in het adminmenu. Kies een **Channel**, schrijf je tekst in **Message** en druk op **Send message**. Lange tekst, zoals een reglement, wordt vanzelf over meerdere berichten verdeeld.',
        '**Send as an embed** staat standaard aan en voegt een optionele **Title** en een **Accent colour** toe; zet het uit voor platte tekst. Met **Ping** kies je een rol, of @everyone, om te vermelden, en Anvil vraagt het je voordat het verstuurt.',
        'Elke post die je verstuurt staat onder **Sent from here**. **Edit** past hem aan in Discord zonder opnieuw te pingen, en **Delete** verwijdert hem.',
      ],
      note: {
        tag: 'Alleen admins, met de bot',
        body: 'Het post als de bot van Anvil, dus koppel eerst je server. Moderators zien het niet. Het is de schakelaar **Post to Discord** onder **Clan settings → Features**; staat die uit, dan verdwijnt het uit het menu.',
      },
    },
    quiet: {
      title: 'Als het stil wordt',
      body: [
        'Op volgorde, want elk punt sluit het volgende uit:',
      ],
      checks: [
        {
          term: 'Zit de bot echt in de server?',
          body: '**Connection** op de Discord-pagina zegt het rechtstreeks. „Token geldig” en „in je server” zijn verschillende feiten en het eerste impliceert het tweede niet — bij een gedeelde bot is het token altijd geldig.',
        },
        {
          term: 'Klopt het server-ID?',
          body: 'Een verkeerd-maar-echt ID ziet er precies zo uit als een goed ID, tot je merkt dat de posts ergens anders heen gaan.',
        },
        {
          term: 'Bestaat de webhook nog?',
          body: 'Een Discord-kanaal verwijderen verwijdert zijn webhook, en Anvil houdt de dode URL. Kies er opnieuw een kanaal voor onder **What goes where**.',
        },
        {
          term: 'Staat de rol van de bot hoog genoeg?',
          body: 'Alleen voor rol- en bijnaamsynchronisatie — zie hierboven. Dit is degene die zwijgend faalt.',
        },
      ],
      note: {
        tag: 'Hij kan mensen die binnenkomen niet begroeten',
        body: 'Discord meldt binnenkomsten alleen via een gateway-verbinding, die een gedeelde bot niet voor elke server openhoudt. Er is dus geen „welkom”-post — zet de aanmeldlink in plaats daarvan in een #rollen- of #begin-hier-kanaal, waar mensen toch al kijken.',
      },
    },
  },

  plugin: {
    metaTitle: 'RuneLite-plugin instellen — Anvil',
    metaDescription:
      'Installeer de Anvil RuneLite-plugin, log in vanuit het zijpaneel, en stel Discord-meldingen in.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Instelhandleiding voor spelers',
    dek: 'Installeren, inloggen, spelen. De plugin stuurt je bingo-drops in, post je zeldzame drops, sterfgevallen en mijlpalen op Discord, en laat je iedereen opzoeken met een rechtermuisklik.',
    facts: [
      { strong: '1 knop', rest: 'en het bijhouden loopt' },
      { strong: '~3 min', rest: 'voor de basisinstelling' },
      { strong: 'Rechtsklik', rest: 'om iedereen op te zoeken' },
    ],
    footnote:
      'De schermafbeeldingen komen uit een echte installatie — het accounttoken is met opzet onleesbaar gemaakt. Het jouwe hoort net zo privé te blijven.',

    install: {
      title: 'Installeer de plugin',
      body: [
        'In RuneLite: **Configuration** (de moersleutel) → **Plugin Hub** → zoek op **Anvil** → **Install**. De uitgever is `AhmedFathy2001`.',
        'Eén plugin bedient alle clans — hij maakt altijd verbinding met `anvilosrs.com`, en pas het inloggen (volgende stap) koppelt hem aan jou en je clans. Er valt niets clanspecifieks te downloaden en geen adres in te typen. Na installatie verschijnt er een **Anvil**-knop in de zijbalk van RuneLite, en de instellingen staan onder **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Inloggen',
      intro: 'Open het **Anvil**-paneel in de zijbalk van RuneLite en klik op **Sign in with Discord**. Je browser opent op `anvilosrs.com`; keur daar de code goed en de plugin logt zichzelf in — niets te typen, niets te kopiëren en niets in te vullen bij de instellingen.',
      panelFigure: {
        caption: 'RuneLite → de Anvil-knop',
        alt: 'De pictogrammenbalk van RuneLite, met de Anvil-knop onderaan omcirkeld',
        legend: [
          {
            label: 'De Anvil-knop',
            body: 'langs de zijkant van het RuneLite-venster, onderaan de pictogrammenbalk. Klik erop om het paneel te openen. Hij verschijnt zodra de plug-in is geïnstalleerd en aanstaat — en je kunt hem omhoog slepen als je hem liever bovenaan hebt.',
          },
        ],
      },
      signInFigure: {
        caption: 'Het Anvil-paneel',
        alt: 'Het Anvil-paneel met de knop Sign in with Discord en de site waarmee het verbindt omkaderd',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'verschijnt alleen zolang deze computer is afgemeld. Klik erop en de rest gebeurt in je browser.',
          },
          {
            label: 'Connects to',
            body: 'altijd `anvilosrs.com` — de enige site waar de plugin mee praat, en die waar je token bij hoort.',
          },
          {
            label: 'Paste a token instead',
            body: 'de noodoplossing, als de stap in de browser bij jou niet werkt — zie het einde van deze stap.',
          },
        ],
      },
      easySteps: [
        'Klik op **Sign in with Discord**. Het paneel toont een korte code en opent je browser op `anvilosrs.com`.',
        'Log daar in met Discord als je dat nog niet bent, controleer of de code op de pagina overeenkomt met die in RuneLite, en klik dan op **Approve**.',
        'Terug in RuneLite staat bovenaan het paneel _Signed in_ — en, zodra je inlogt in het spel, welk personage het volgt. Klaar.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'De pagina Link your RuneLite client, met het codeveld en de Approve-knop omkaderd',
        legend: [
          { label: 'De code', body: 'die moet overeenkomen met wat de plugin je op dit moment laat zien.' },
          {
            label: 'Approve',
            body: 'keur alleen een code goed die _je eigen_ client toont. Heeft iemand je een link of een code gestuurd, weiger die dan — goedkeuren zou betekenen dat je ze je account geeft.',
          },
        ],
      },
      directNote: {
        tag: 'Waar dit gebeurt',
        body: [
          'Deze hele stroom blijft op `anvilosrs.com` — de code wordt daar uitgegeven, je keurt hem daar goed met je eigen Discord-login, en het token gaat rechtstreeks terug naar de plugin. De plugin opent alleen inlogpagina’s op `anvilosrs.com`, dus een inloglink die ergens anders heen wijst, komt niet van hem.',
        ],
      },
      federationAside:
        'Niet te verwarren met **Connect clans** in het zijpaneel — dat is de aparte, optionele knop die je met andere Anvil-clans verbindt, en die verschijnt pas als je hier al bent ingelogd.',
      manualFallback:
        'Opent de browser niet vanzelf, dan drukt het paneel het adres en de code af zodat je het handmatig kunt openen. Codes verlopen na tien minuten — druk gewoon opnieuw op de knop.',
      manualHeading: 'Noodoplossing: plak je token met de hand',
      manualIntro:
        'Werkt inloggen vanuit de plugin bij jou niet, kopieer dan je token hieronder (of via [Profile → plugin token](/profile#plugin-token), waar je het ook kunt roteren), klik vervolgens op **Paste a token instead** onder de aanmeldknop in het Anvil-paneel en plak het daar.',
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
            body: 'kopieer hem en gebruik dan **Paste a token instead** in het Anvil-paneel. Rotate geeft een nieuwe uit en maakt de oude ongeldig — gebruik dat als je ooit vermoedt dat je token is uitgelekt.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Gebruik dagelijks het zijpaneel',
        body: ['**Het Anvil-zijpaneel is je belangrijkste werkplek**: meld je daar aan en af, bekijk je clans en actieve events, blader door vakjes en claim ze, volg de voortgang, maak startfoto’s, voer synchronisaties uit en open de supporttools. **Configuration → Anvil**, hieronder afgebeeld, is alleen voor voorkeuren — er staat geen token in. Wil je deze computer afmelden, open dan het **⋯**-menu naast je naam bovenaan het paneel. Eén aanmelding geldt voor alle events waarvoor je bent ingeschreven — je doet het nooit opnieuw per bingo.'],
      },
    },

    accounts: {
      title: 'Koppel je accounts',
      body: [
        'Zodra het token is ingesteld, verschijnen accounts waarmee je speelt automatisch op je profiel. Een nieuw account kan direct worden gekoppeld; een account dat al op een clanrooster staat vereist eerst één eigendomscontrole, omdat een openbare RuneScape-naam niet bewijst wie de eigenaar is.',
        'Gebruik voor de eerste koppeling [de snelle XP-controle](/profile#link-account), of vraag een clanmoderator het account goed te keuren bij [gedetecteerde accounts](/profile#detected-accounts). Daarna volgt de stabiele accountvingerafdruk naamswijzigingen en wordt het account automatisch herkend.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'De kaart RuneScape Accounts op de profielpagina met de via de plugin geverifieerde accounts',
        legend: [
          {
            label: 'Je gekoppelde accounts',
            body: 'alles met “Verified via plugin” is gekoppeld en wordt automatisch herkend. Bestaande clanroosteraccounts kunnen eerst een eenmalige XP-controle of goedkeuring door een moderator vragen.',
          },
        ],
      },
      noPluginHeading: 'Kun je de plugin niet draaien?',
      noPluginIntro:
        'Gebruik op mobiel of in de officiële client [Profile → account linking](/profile#link-account):',
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
        'Je ziet ook het **Anvil-zijpaneel** zich vullen met je clans, je lopende events, je positie en de sync-knoppen — en er verschijnt een **Anvil**-knop in de titelbalk van je Collection Log in het spel.',
      guestNote: {
        tag: 'Gast of lid',
        body: 'Zegt de chat _Tracked as a guest_, dan word je bijgehouden maar sta je nog niet op de ledenlijst van de clan. Dat lost een admin op door de ledenlijst vanuit het spel te synchroniseren — vraag het {discordLink}.',
        discordWord: 'in Discord',
      },
      panelHeading: 'Het zijpaneel',
      panelBody: [
        'Vier tabbladen en een tandwiel. **Clan** zijn je events en je clan: elke lopende en komende bingo en wekelijkse competitie met waar je staat. **Feed** zijn de grote momenten van je clan en je borden terwijl ze gebeuren, met eventchat. **You** is je eigen profiel, en **Lookup** vindt dat van iedereen anders, speler of clan. Onder het tandwiel zitten synchroniseren en je bannergeluiden.',
        'Elk tabblad, eventchat, reacties en de instellingen die de feed en Supporter-kleuren in je spel brengen, staan in [Het zijpaneel, tabblad voor tabblad]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'De drie tabbladen van het Anvil-zijpaneel naast elkaar: het Clan-tabblad met events en de week van de clan, het You-tabblad met je collection log, en het Lookup-tabblad met de kaart van een andere speler',
      },
      lookupHeading: 'Zoek iedereen op',
      lookupBody:
        'Klik met rechts op een speler — naast je, of op zijn naam in de chat, je vriendenlijst of het clanpaneel — en kies **Anvil** om zijn kaart te openen in het **Lookup**-tabblad van het zijpaneel. Je eigen kaart is het **You**-tabblad.',
      lookupFigure: {
        caption: 'Rechtsklik op een naam → Anvil',
        alt: 'Het rechtsklikmenu van een speler in het spel met een Anvil-optie onder Lookup',
      },
      lookupSettingNote:
        'Kies onder **Player lookup** in de plugin-instellingen waar het **Anvil**-item verschijnt. Op een naam in de chat is het nooit de linkerklikoptie, dus op een naam klikken doet nog steeds wat het spel doet.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Het onderdeel Player lookup van de Anvil-instellingen met elke instelling omkaderd en genummerd',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'de hoofdschakelaar. Uit verbergt het item overal.',
          },
          {
            label: 'Players in the world',
            body: 'rechtsklikken op een speler die bij je in de buurt staat.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'namen in de chatbox en in privéchat.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'de namenlijsten: leden van je clan en gastclan, het friends-chatkanaal, je vrienden- en negeerlijst en het raid-partypaneel.',
          },
        ],
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
            label: 'Show Overlay',
            body: 'tekent linksboven een klein paneel met _Anvil / team / UTC-datum_. Het wordt onderdeel van het beeld in je bewijsafbeeldingen, en juist dat maakt een bewijs lastig te vervalsen of terug te dateren. Op deze afbeelding staat het uit — zet het aan als je clan team en tijd op elk bewijs wil zien.',
          },
          {
            label: 'Team completion popups',
            body: 'een banner wanneer iemand uit je team een vakje afrondt. Meerdere tegelijk: het moeilijkste krijgt de banner, de rest gaat naar de chat.',
          },
          {
            label: 'My tile popups',
            body: 'een pop-up wanneer je eigen drop een vakje verder brengt of afrondt. Uit wordt het nog steeds bijgehouden — alleen stilletjes.',
          },
          {
            label: 'Banner sound + volume',
            body: 'speelt een geluid bij de banner. Er gebeurt niets tot je zelf minstens één .wav toevoegt, via **Add clip** onder “Banner sounds” in het Anvil-zijpaneel. Missies hebben een eigen map — voeg een clip toe onder **Mission sounds** en die speelt in plaats van het ingebouwde geluid dat ze van een afgeronde tegel onderscheidt.',
          },
          {
            label: 'Auto starting shot',
            body: 'maakt de startfoto van een event voor je zodra je op de vastgepinde plek staat. Uit druk je zelf op **Take starting shot** in het zijpaneel.',
          },
        ],
      },
      teamsHeading: 'Teams',
      teamsBody:
        'De knop **Teams** bij een event toont de teams op volgorde van stand, met het jouwe bovenaan. Open er een voor de selectie, aanvoerder eerst, of zoek een speler in alle teams — klik op een naam om die op te zoeken.',
      teamsFigure: {
        caption: 'Event → Teams',
        alt: 'De Teams-pagina met de teams van een event, hun punten en aantal leden, naast de selectie van één team met de aanvoerder bovenaan',
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
        'Die gaan af of er nu een bingo loopt of niet, en ze verschijnen in de kanalen van de clan. Welk kanaal, bepalen de admins hier — jij kiest alleen _wat_ je post. Met de volgende plugin-update verhuizen deze keuzes naar de website, onder **Settings → Discord posts & screenshots**, en volgen ze je naar elke computer. Op dezelfde pagina kies je bij **Screenshot privacy** welke chat (privéberichten, openbare chat, clanchat) verborgen wordt op elke screenshot die de plugin maakt. In de plugin blijven twee schakelaars onder **Notifications**: **Share clan posts** pauzeert in één keer alle posts uit het hoofdspel, en **Share seasonal activity** doet hetzelfde op Leagues, Deadman en andere seizoenswerelden.',
      examplesFigure: {
        caption: 'Zo ziet een post eruit',
        alt: 'Twee Discord-posts van Anvil: een Grandmaster-combat task met punten en de voortgang naar de volgende unlock, en een dood met het bijbehorende bericht, elk met een screenshot van het moment',
      },
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
            body: 'een drop wordt geplaatst wanneer hij minstens zoveel waard is (GE of high alch, welke hoger is) of zeldzamer is dan 1 op N. Anvil begint bij 1m en 1/1,000. Je clan kan eigen standaardwaarden instellen voor zijn leden; totdat jij zelf een getal instelt, volg je die van de clan. **Terug naar clanstandaard** (of **Terug naar Anvil-standaard** als je geen clan hebt) zet je weer op volgen. Een clan kan ook een harde zeldzaamheidsgrens instellen voor de eigen kanalen, waar jouw getal niet onder kan. Zet een van beide getallen op 0 om het uit te schakelen.',
          },
          {
            label: 'Waarde en zeldzaamheid samen',
            body: 'standaard wordt een drop geplaatst als hij aan de waarde **of** de zeldzaamheid voldoet. Zet **Beide vereist** aan en hij moet aan de waarde **en** de zeldzaamheid voldoen. Je clan kan deze standaard kiezen voor zijn leden; totdat jij kiest, volg je die, en zonder clan is het een van de twee. Elk van je eigen webhooks kan ook zijn eigen minimumwaarde, zeldzaamheid en een van beide/beide instellen; wat leeg blijft volgt jouw instellingen.',
          },
          {
            label: 'Loot key value',
            body: 'een loot key wordt één keer gepost, als één melding, wanneer de hele inhoud boven dit getal uitkomt.',
          },
          { label: 'Notify on pets', body: 'pets komen in het kanaal voor zeldzame drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Het meldingsonderdeel Combat achievements met elke instelling omkaderd en genummerd',
        legend: [
          {
            label: 'CA post tier',
            body: 'de laagste taaktier die gepost wordt; afgeronde tiers worden ook gepost. Standaard is Master; Grandmaster post alleen de zeldzaamste, **Off** post niets. Bingo-CA-vakjes tellen hoe dan ook.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'elk nieuw slot in je collection log.',
          },
          {
            label: 'Notify on level milestones',
            body: 'level-ups die je clan heeft gekozen om aan te kondigen — standaard 99’s, elke 100 totale levels vanaf 1800, en max. De admins van je clan bepalen de regels; je kunt minder posten (of eigen regels instellen voor je persoonlijke webhooks) via Announcements op je profiel.',
          },
          {
            label: 'Notify on diary completions',
            body: 'tiers van achievement diaries, met een schermafbeelding.',
          },
          {
            label: 'Quest post tier',
            body: 'quests vanaf de moeilijkheidsgraad die je kiest, van All (elke quest) tot Grandmaster; **Off** post er geen. Standaard is Master. Bingo-questvakjes tellen hoe dan ook.',
          },
        ],
      },
    },

    trouble: {
      title: 'Als er iets stukgaat',
      intro:
        'De plugin zegt het in de chat wanneer het bijhouden is gestopt — hij wacht ongeveer 90 seconden voordat hij klaagt en herhaalt zich hooguit elke 5 minuten.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Het token is verkeerd of is geroteerd. Open het **⋯**-menu bovenaan het Anvil-paneel, druk op **Sign out** en daarna opnieuw op **Sign in with Discord** — of gebruik **Paste a token instead** met een vers token uit [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'De plugin kan `anvilosrs.com` niet bereiken. Controleer je internetverbinding en een eventuele firewall of VPN die RuneLite blokkeert. Is dat allemaal in orde, dan ligt de site waarschijnlijk even plat — de plugin maakt vanzelf opnieuw verbinding.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Dat account is nog niet gekoppeld. Open [Profile → gedetecteerde accounts](/profile#detected-accounts) om het toe te voegen of de eigendomscontrole te starten.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Niets. Het herstelde zichzelf.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'Iemand anders heeft dit character als eerste op Anvil gekoppeld, dus vanaf jouw login telt er niets voor. Is het echt van jou? Druk dan op **This is my account** in het tabblad **You** van het paneel en doe de korte XP-controle. Daarna wordt de huidige eigenaar gevraagd, of beslist de staf van Anvil. Je komt nooit te weten wie het is. Volg het via [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Nog steeds vast? Stuur een admin een log',
      logBody:
        'Stuur een admin je RuneLite-log: `client.log` in de map `.runelite/logs` in je gebruikersmap (op Windows plak je `%USERPROFILE%\\.runelite\\logs` in de adresbalk van Verkenner). De plugin schrijft daarin wat hij zag en waarom, zodat de admin precies ziet wat er misging.',
      missingNote: {
        tag: 'Bewijs kwijt?',
        body: 'Pets en dubbele Champion’s scrolls hebben een handmatige screenshot nodig. De plugin maakt hem voor je en bewaart hem in `.runelite/osrs-bingo-pending/` — **Copy folder path** in het Anvil-zijpaneel opent de map — zodat je hem op de site toevoegt in plaats van achteraf naar een plaatje te zoeken.',
      },
    },
    limits: {
      title: 'Bekende beperkingen',
      intro:
        'Een paar dingen zijn niet perfect bij te houden — bijna altijd door wat het spel zelf meldt, niet door Anvil. De oplossing is elke keer dezelfde: maak een screenshot en dien die handmatig in.',
      rows: [
        {
          term: 'Barraging en andere kills op meerdere doelen',
          body: 'Kill-aantallen (KC) komen uit wat het spel per kill meldt, en spreuken met meerdere doelen zoals Ice Barrage laten het er een paar missen, dus **KC kan lager uitvallen** dan wat je hebt gedood. RuneLites eigen Loot Tracker telt op dezelfde manier te laag — het is een limiet van de game-engine, geen Anvil-bug.',
        },
        {
          term: 'Combat achievements die je eerder hebt gedaan',
          body: 'Zet **repeat completion** aan in de Combat Achievements-instellingen van het spel. Zonder die optie kondigt het spel een taak die je al hebt voltooid niet aan, en de plugin kan alleen toekennen wat het spel aankondigt.',
        },
        {
          term: 'De Yama-contract combat achievement',
          body: 'Het spel kondigt deze niet opnieuw aan, ook niet met repeat completion aan, dus de plugin ziet hem nooit. Maak een screenshot en dien hem handmatig in.',
        },
        {
          term: 'Verzamelvakjes zonder de plugin',
          body: 'Aantallen items — een aantal vissen, ertsen, boomstammen — staan niet in de hiscores, dus alleen de plugin houdt ze bij. Zonder plugin: maak een screenshot van elke inventory; of, als het item in de Loot Tracker staat, een screenshot na het resetten naar 0 aan het begin en nog een aan het eind.',
        },
        {
          term: 'Implings, vis, erts en andere itemwinsten',
          body: 'Het vangen van implings en het verzamelen van items (vis, erts en alles wat wordt geteld op basis van wat in je inventory belandt) **wordt soms niet goed bijgehouden, zelfs met de plugin**. Bewaar onderweg screenshots, en als een telling te laag lijkt, meld het en dien het verschil handmatig in.',
        },
        {
          term: 'Visvaten, houtmanden en andere opslag',
          body: 'Item-opbrengstvakjes tellen alleen wat **rechtstreeks van de bron** in je inventory belandt — een visplek, een rots, een boom. Alles wat uit opslag komt (een visvat, houtmand, kolen- of edelsteenzak of kruidenzak legen), in een winkel gekocht, van de bank opgenomen of van de grond opgepakt wordt, **telt niet**. Zo blijft het vakje eerlijk: anders kon dezelfde vis eindeloos in een vat gestopt en er weer uit gehaald worden. Wat je rechtstreeks in een vat of mand verzamelt, telt niet.',
        },
        {
          term: "Dubbele pets en champion's scrolls",
          body: 'Als je de pet of scroll al hebt, zegt het spel alleen dat je een **“funny feeling”** hebt — welke, zegt het nooit. De plugin leidt het af uit wat je net hebt gedood of getraind, rekent het vakje toe en **markeert het voor controle door de staff**. Kan hij het niet zeker weten — twee pets uit dezelfde bron, of een pet zonder kill of skill erachter (Bloodhound uit een master clue, een gegokte Jad- of Zuk-pet, Chompy chick) — dan komt de screenshot in **Saved proofs** zodat je hem handmatig indient.',
        },
      ],
    },
    screen: {
      title: 'Op het scherm tijdens het spelen',
      intro: 'Wat de plugin tijdens het spelen tekent en print, en de instelling achter elk onderdeel.',
      rows: [
        {
          term: 'Vastgezette vakjes',
          body: 'open een vakje in het zijpaneel en druk op **Track on screen** (tot 3). Met **Pinned tiles in one panel** aan delen ze één klein paneel: de naam van elk vakje, de voortgang van je team, en regels als _3/5 runs_ of welke delen van een combo al klaar zijn. Uit krijgt elk vakje een eigen, groter widget met je teamgenoten en de andere teams. Alt-slepen om het te verplaatsen. Klik er met de rechtermuisknop op voor **Unpin** of **Unpin all**. Een afgerond vakje toont **Done** en maakt zichzelf daarna los.',
        },
        {
          term: 'De kaart van het startschot',
          body: 'zolang een event op jouw startschot wacht, staat er bovenaan het scherm een kaart **Starting shot needed** die zegt waar je heen moet en elke controle groen of rood toont: de relog, hoe lang je sessie al duurt, en hoeveel vierkanten je van de plek af staat. Een pijl en een wereldkaartpin (**Anvil starting shot**) leiden je erheen. Met **Auto starting shot** aan wordt het startschot genomen zodra alles groen is; daarna zegt de kaart **You’re tracked** en gaat hij weg. Instelling: **Starting shot guide**.',
        },
        {
          term: 'Banners',
          body: '**Tile complete!** wanneer je team een vakje afrondt, de voortgang van je eigen drop op een vakje, en **New mission!**. Instellingen: **Team completion popups** en **My tile popups**.',
        },
        {
          term: 'Vestige-rolls',
          body: 'bij de Desert Treasure II-bossen print elk uniek item een regel met waar je in de vestige-rotatie staat, zoals _Roll 2 of 4_ of _the next unique is the vestige_. Er staat _(estimated)_ tot het je een vestige heeft zien krijgen. Geen instelling; het draait met of zonder event.',
        },
        {
          term: 'Aanvullen bij zoeken',
          body: 'typ je in het vak **Lookup** dan vult de plugin de naam voor je aan, uit je recente zoekopdrachten, vrienden, clanleden die online zijn en spelers in de buurt. **Enter** neemt het over. Hij leest alleen je eigen client; er wordt niets verstuurd.',
        },
        {
          term: 'Chatkleuren',
          body: '**[Anvil] tag colour** en **Message colour** onder **Chat messages**. Totdat je kiest, worden ze donkergoud en zwart op een ondoorzichtige chatbox, zodat ze leesbaar blijven. Hou de muis boven de naam van een Supporter in de chat om hun niveau te zien, zoals _Anvil Patron_.',
        },
      ],
    },
    sync: {
      title: 'Profielsynchronisatie, en wat er verder naartoe gaat',
      intro: 'De instellingen **Profile sync** vullen je Anvil-profiel. Alle vier staan aan om mee te beginnen:',
      rows: [
        {
          term: 'Collectielog synchroniseren',
          body: 'elke pagina van de collectielog die je opent, wordt naar je profiel gestuurd.',
        },
        {
          term: 'Het hele log synchroniseren bij openen',
          body: 'het openen van de collectielog stuurt het hele log, niet alleen de pagina die je bekijkt. Wil je het op verzoek, druk dan op de knop **Anvil** in de titelbalk van de collectielog, of op **Sync profile** in het zijpaneel terwijl het log open is. De chat bevestigt het: _Profile synced — N collection log slots._',
        },
        {
          term: 'Persoonlijke records synchroniseren',
          body: 'boss- en raidtijden worden verstuurd zodra je ze zet.',
        },
        {
          term: 'Bestaande records eenmalig importeren',
          body: 'eenmaal per character kopieert dit de persoonlijke records die RuneLite al op je computer heeft opgeslagen: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Highlights met de clan delen',
          body: 'je pets, grote drops, doden, combattaken, levelmijlpalen, nieuwe logplekken en dagboeken verschijnen op de feed van de site van je clan, en in de chatfeed van spelers die ze kunnen zien.',
        },
      ],
      outro: 'Drie dingen worden verstuurd zonder eigen instelling. **Wie jou heeft gedood**: het monster of de speler die je in je laatste 15 seconden had getarget, wordt in de feed genoemd. **Spel-tellers**: sommige kill-vakjes tellen een getal dat het spel bijhoudt, zoals Tithe Farm-punten, Giants’ Foundry-reputatie, Doom delves of slayer-reeksen; alleen stijgingen tellen mee. **Leagues, Deadman en andere modi**: op die werelden worden de eigen regels van het spel over relics, gebieden en taken verstuurd, zodat je clan ze in het modekanaal kan plaatsen.',
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
      { strong: '5 stappen', rest: 'op de instelchecklist' },
      { strong: '7 formats', rest: 'om een bord van te bouwen' },
      { strong: '1 knop', rest: 'om de ledenlijst te synchroniseren' },
    ],
    footnote:
      'Deze handleiding volgt de app zoals die vandaag draait. Klopt een scherm hier niet met wat je ziet, dan heeft de app gelijk en is de handleiding verouderd — [laat het weten](/feedback), dan repareren we het.',

    access: {
      title: 'Wie mag wat',
      intro:
        'Iedereen logt in met Discord — er zijn geen wachtwoorden. De eerste admin is de eigenaar, degene die de clan heeft aangemaakt; daarna promoveert een admin anderen via **People → Staff & roles**. De rollen stapelen naar beneden: alles wat een moderator kan, kunnen een penningmeester en een admin ook.',
      rows: [
        {
          term: 'Admin',
          body: 'volledige toegang — events, vakjes, teams, instellingen, staf, uitbetalingen. Geef die aan zo weinig mogelijk mensen.',
        },
        { term: 'Treasurer', body: 'alles wat een moderator kan, plus inleg en uitbetalingen.' },
        {
          term: 'Moderator',
          body: 'het dagelijkse werk: ledenlijst, verificaties, bewijs om te controleren, weekcompetities, de agenda en clanactiviteiten. Kan geen events aanmaken of bewerken.',
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
        '**Settings → Finish setup** is een korte wizard (hij blijft in het menu staan tot je klaar bent), en het dashboard houdt een checklist van vijf stappen tot ze klaar zijn: noem de clan, koppel Discord, laad je leden, maak een event aan, voeg vakjes toe. De status wordt uit echte gegevens berekend, dus een stap wordt pas afgevinkt als hij echt af is.',
      discord:
        'Voor Discord heb je twee routes, en ze vullen elkaar aan: geef Anvil een **bot**, dan kan hij webhooks aanmaken, rollen en bijnamen synchroniseren en privé teamkanalen bouwen; geef hem één **webhook-URL**, dan kan hij aankondigingen posten en verder niets. Begin met de webhook als je binnen twee minuten live wil zijn, en voeg de bot toe wanneer je de automatisering wil.',
      permsNote: {
        tag: 'Rechten van de bot',
        body: 'De bot heeft _Webhooks beheren_, _Rollen beheren_, _Kanalen beheren_ en _Bijnamen beheren_ nodig, en zijn rol moet in de rollenlijst van je server _boven_ de rollen staan die hij beheert. Anders weigert Discord het stilletjes.',
      },
      hosted:
        'Op een gehost pakket kwam je dat scherm al eens tegen: de bot tijdens de installatie toevoegen was hoe Anvil te weten kwam welke server van jullie is, er viel dus nooit een server-ID te kopiëren. Dezelfde link staat hier wanneer je de bot naar een andere server wil verhuizen.',
    },

    channels: {
      title: 'Verdeel de berichten over kanalen',
      body: [
        'Standaard gaat alles naar één catch-all-kanaal. Wordt dat rumoerig, open dan **Discord → What goes where** en geef de luide categorieën hun eigen plek — eventposts, weekcompetities, zeldzame drops, sterfgevallen, PvP-kills, combat achievements. Alles wat je leeg laat, valt terug op zijn catch-all, je kunt dus één categorie tegelijk afsplitsen.',
        'Met de bot verbonden raak je nooit een webhook-URL aan: kies een kanaal uit de keuzelijst van de rij en het wordt opgeslagen. Bij een druk event kun je met **Add another** onder **Post without a bot** een tweede webhook toevoegen — Anvil wisselt ertussen zodat de snelheidslimiet van Discord geen berichten opslokt.',
      ],
      clipsNote: {
        tag: 'Het clipkanaal is anders',
        body: 'Clipvideo’s worden rechtstreeks vanaf de pc van elke speler naar Discord geüpload — ze gaan nooit via deze site. Daarom is de clip-webhook die je hier instelt degene die je _uitdeelt_: leden plakken hem zelf in hun plugin. Al het andere op deze pagina gebeurt aan de serverkant, en leden zien het nooit.',
      },
    },

    roster: {
      title: 'Haal je ledenlijst binnen',
      body: [
        'Clanlidmaatschap komt uit precies één plek: een synchronisatie van de ledenlijst vanuit het spel. Installeer [Anvils RuneLite-plugin]({pluginGuide}) op het account van een _admin_, open je clanvenster in het spel, en druk op de **Anvil**-knop in de titelbalk. Dat duwt jullie werkelijke clanlijst met één klik vanuit het spel naar de site.',
        'Inloggen, een character koppelen of spelen met de plugin zet nooit iemand op de ledenlijst. Ziet de plugin iemand spelen in jullie clan in het spel voordat de ledenlijst hem heeft, dan dient hij een joinverzoek in; ieder ander kan het vragen met **Apply** op jullie clanpagina. De staf beantwoordt verzoeken bovenaan **People → Roster**, en **People → Who can join** bepaalt of mensen op een ja wachten, meteen een gastplek krijgen of helemaal niet kunnen vragen. Dat is opzet: niemand komt jullie clan binnen door de naam in te tikken. Het hele verhaal staat in [Je mensen]({peopleGuide}).',
        'Je kunt iemand ook met de hand toevoegen via **People → + Add Manually**, en hem met **Add member** op de **Sign-ups**-pagina van het event namens zichzelf inschrijven wanneer hij de site niet kan bereiken.',
      ],
    },

    board: {
      title: 'Maak je eerste bord',
      intro:
        '**Events → All events → + New event**. Kies eerst een format — dat bepaalt hoe het bord scoort en wat de rest van het formulier je vraagt.',
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
          blurb: 'Een geordend parcours — teams bereiken de vakjes op volgorde; wie het verst komt, wint. De host kan het vertakken in routes die splitsen en samenkomen — het vakje dat je haalt, kiest je weg.',
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
        'De pagina **Board & tiles** van het event is waar een bord een bingo wordt. Elk vakje is één _soort_ taak, en de soort bepaalt waar de plugin op let: een drop, een boss-killcount, skill-XP, een NPC-kill, een tijd halen, een achievement diary, een Combat Achievement, een collection log-ontgrendeling, een PvP-kill, itemwinst, of een run zonder doodgaan. Handmatige vakjes — die een mens goedkeurt aan de hand van een schermafbeelding — kunnen ook altijd.',
        'Voor een vol bord werk je in bulk: exporteer het blad, vul het in een spreadsheet, en importeer het terug. CSV en .xlsx gaan allebei heen en weer, en rijen volgen posities, dus je kunt een heel raster van 25 vakjes met één plakactie herschrijven.',
      ],
      rows: [
        {
          term: 'Moeilijkheidsgraden',
          body: 'puntenwaarden vertalen naar benoemde banden (easy → elite). Pas de banden aan onder **Clan settings → Rules & scoring → Difficulty & balance** als je clan anders indeelt.',
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
        'De pagina **Teams & draft** past zich aan het gekozen format aan: een format zonder teams slaat hem helemaal over. Voor een gewone teambingo maak je de teams aan, bepaal je wie er captain is, en verdeel je de spelers zelf of draai je een live draft.',
        'De captains draften uit de inschrijfpool in de volgorde die jij kiest, en elke captain ziet de antwoorden die mensen op het inschrijfformulier gaven — bevroren zoals ze zijn ingediend, zodat niemand zijn “uren per week” aanpast nadat hij gekozen is.',
      ],
      placementIntro:
        'Je hoeft niet te draften. **Team placement**, op het aanmaakformulier en het tabblad **Sign-ups**, bepaalt waar elke nieuwe inschrijving terechtkomt:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'elke persoon die zich inschrijft, komt in het team met de minste spelers. Jij kiest alleen hoeveel teams er zijn. Goed voor grote openbare events.',
        },
        {
          term: 'Players pick',
          body: 'jij maakt eerst de teams, en elke speler kiest er een op het inschrijfformulier. Stel een limiet per team in om ze gelijk te houden.',
        },
        {
          term: 'Host drafts',
          body: 'iedereen wacht in een pool tot jij of je captains ze draften of met de hand indelen. Het beste als je de spelers kent.',
        },
        {
          term: 'Solo',
          body: 'helemaal geen teams. Elke speler speelt voor zichzelf, onder de naam van zijn character, en de stand rangschikt spelers.',
        },
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
          body: '**Post to Discord** (onder **Clan** in het menu) post midden in het event als de bot een bericht in elk kanaal dat je kiest, zonder dat je zelf een webhook schrijft.',
        },
      ],
      missionNote: {
        tag: 'Verrassingen tijdens het event',
        body: 'Je kunt een **missie** op een lopende bingo droppen — een verborgen bonusvakje dat wordt aangekondigd zodra je het afvuurt, en dat desgewenst in waarde daalt of verloopt. Het is de goedkoopste manier om een bord op dag vijf wakker te maken.',
      },
      startProofNote: {
        tag: 'Hamsteren vóór het event stoppen',
        body: [
          'Zet **Starting shot** aan (event → Home → **Extras**), dan moet elke speler één schermafbeelding indienen, gemaakt nadat het event live ging, op een locatie die Anvil op het startmoment loot — zodat niemand op nul op een week aan opgespaarde clues en kisten zit. De locatie wordt bij de start bekendgemaakt; het codewoord van elke speler is persoonlijk, afgeleid uit de trekking, en bestaat pas als het event begint, dus niemand kan het van tevoren opzetten.',
          'Zet de plekken op de wereldkaart (de pool-editor heeft er een), dan controleert de plugin of spelers er ook echt staan in plaats van het alleen te horen. Je kunt ook een **verse sessie** eisen — standaard 15 minuten: hiscores worden alleen bij uitloggen bewaard, dus iedereen vlak voor zijn foto opnieuw laten inloggen is wat de startwaarden achter elk XP- en KC-vakje eerlijk maakt.',
          'Plugingebruikers drukken op één knop. Alle anderen tikken hun codewoord in het spel en uploaden op My Team. Jij kiest wat er gebeurt met een bijschrijving van iemand die niets heeft ingediend: markeer hem voor beoordeling (standaard) of weiger hem tot ze het doen. Datzelfde paneel op de Home van het event is de beoordelingslijst — plugin-opnames met een geverifieerd codewoord komen al goedgekeurd binnen, in de praktijk kijk je dus alleen naar de mobiele spelers.',
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
          body: 'de pagina **Prizes** van het event maakt van de prijzenpot een lijst van wie wat krijgt, en vinkt af terwijl je uitbetaalt.',
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
          body: 'houd het bord dat je net gebouwd hebt, via **Settings → More** van het event. De volgende bingo begint daaruit in plaats van uit een leeg raster.',
        },
      ],
      federation:
        'Met federatie aan kunnen leden zich vanuit de plugin ook met andere Anvil-clans verbinden — handig voor events tussen clans, en per lid volledig vrijwillig.',
      outro: 'Wijs je leden daarna naar de [instelhandleiding voor spelers]({pluginGuide}) en begin de volgende te plannen.',
    },
    survey: {
      title: 'Vraag de spelers',
      intro: 'Zet **Post-event survey** aan onder **Features**, en open daarna de pagina **Survey** van het event.',
      body: [
        'Voeg onder **Build** vragen toe: **Rating (1–5)**, **Free text**, **Choose one** of **Choose many**, elk optioneel **Required**. Of laad een sjabloon: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** of **Skilling / social**. **Preview the participant view** toont het zoals een speler het ziet.',
        'De enquête opent zodra het event eindigt, alleen voor goedgekeurde deelnemers, en zij kunnen hun antwoorden later nog wijzigen. **Results** toont de antwoorden **By question** of **By person**. Hij is niet anoniem: staf ziet wie wat heeft gezegd.',
      ],
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

    teamCompsLine: "Wil je dat clans juist op skills of bosses racen? Zie [Teamwedstrijden]({teamCompsGuide}).",

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
        'Open je event en ga naar de pagina **Teams & draft**. Maak één team per uitgenodigde clan en noem het naar hen — de naam is wat hun spelers op het inschrijfformulier zien, dus “Ironforge” verslaat “Team 2”.',
        'Je hoeft _geen_ draft te draaien. Uitnodigingslinks en een draft zijn alternatieven: een draft verdeelt een gedeelde inschrijfpool, een link zet mensen rechtstreeks neer. Bij een zuivere clan-tegen-clan maken de meeste organisatoren de teams aan, geven ze er één link per stuk uit, en openen ze de draft nooit.',
        'Open daarna het team zelf — **Teams & draft → het team** — want daar spelen beide volgende stappen zich af.',
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
        caption: 'Event → Teams & draft → het team → Team staff',
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
        caption: 'Event → Teams & draft → het team → Invite links',
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
    cohost: {
      title: 'Als je de medehost bent',
      intro: 'Alles hierboven is de kant van de host. De staf van de bezoekende clan krijgt een eigen pagina voor het event, **Co-hosted with <host>**. De host bepaalt de data, de draft, de teams en wie het kan zien.',
      rows: [
        {
          term: 'De aanmeldingen van je clan',
          body: '**Approve**, **Reject** of **Withdraw** de spelers van je eigen clan. Je ziet of raakt die van de host nooit aan.',
        },
        {
          term: 'Het bord',
          body: 'je kunt alleen bewerken als de host je staf dat heeft gegeven. Anders kun je **Suggest a tile** gebruiken: het vakje, de details en de punten, tot 25 tegelijk in de wachtrij. Elk toont **waiting**, **accepted ✓** of **turned down** met de reden van de host.',
        },
        {
          term: 'Je team',
          body: '**Manage** het team van je clan.',
        },
        {
          term: 'Discord',
          body: 'je admins kiezen wat je eigen server bereikt: **Everything shared**, **Big moments** of **Nothing**, welk kanaal, wie er een ping krijgt, en of je spelers de rol **@Bingo player** krijgen.',
        },
      ],
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
        kill: { label: 'Kills', blurb: 'N kills van elke boss of elk monster. Geteld uit de hiscores als elk monster op het vakje daarin staat, anders door de plugin terwijl je speelt (kippen, koeien, Slayer-monsters).' },
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
          term: 'Een bosslijst plus één monster buiten de hiscores',
          body: 'is in z’n **geheel** een plugin-vakje. Een Kills-vakje telt alleen uit de hiscores als elk monster erop daarin staat; zet een kip bij vier GWD-bosses en het hele vakje heeft de plugin nodig. Speelt een deel van je clan zonder, geef de hiscores-bosses dan een eigen vakje.',
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
        '**Download spreadsheet** op de pagina **Board & tiles** van het event. Je krijgt een .xlsx van het bord zoals het nu is, met keuzelijsten, de itemlijst en de kolomuitleg op eigen bladen.',
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
        'Op een bord op punten draagt elk vakje zijn eigen waarde, en die waarden vertalen naar benoemde moeilijkheidsbanden — easy tot elite — die je onder **Rules & scoring** kunt aanpassen als je clan anders indeelt. De band is wat spelers lezen; het getal is wat telt.',
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
    library: {
      title: 'De taakbibliotheek en suggesties',
      body: [
        'Vakjeseditors hebben **Task library** in het admin-menu: de opgeslagen taken van je clan, en de eigen bibliotheek van Anvil om van te kopiëren. **⬇ Export pack** slaat je taken op als bestand en **⬆ Import pack** laadt er één in, zo verhuist een bord tussen clans.',
        'Een fout in de bibliotheek van Anvil gevonden, of een taak die ontbreekt? Druk op de taak op **Suggest a fix**, of op **Suggest a new task**. Anvil bekijkt het en het antwoord staat onder **Your suggestions**: **Waiting for review**, **Approved** of **Not taken**, met een notitie. Je kunt er 5 in de wachtrij hebben. Een goedgekeurde correctie komt bij elke clankopie die de bibliotheek nog volgt.',
      ],
    },
    stats: {
      title: 'Startstatistieken en late deelnemers',
      intro: 'XP- en killtelvakjes vergelijken de huidige stats van elke speler met hun **starting stats**, die bij de start van het event worden genomen. Op de pagina **Stats** van het event controleer en corrigeer je ze:',
      rows: [
        {
          term: 'Starting stats vastleggen',
          body: 'vóór de start warmt het alleen de hiscores op; de startlijn zelf wordt bij de start genomen. Na de start wordt de knop **Capture late joiners**, voor spelers die later zijn toegevoegd. Dit kan één keer per 30 minuten.',
        },
        {
          term: 'Nu bijwerken',
          body: 'ververst de standen met de nieuwste cijfers. Ze worden ook elk uur vanzelf ververst.',
        },
        {
          term: 'Basislijn corrigeren',
          body: 'per speler: wijzig met de hand één vaardigheids- of bossgetal van de start. Gebruik dit als een grind van vóór het event is meegeteld, omdat de speler niet heeft uitgelogd voordat het begon.',
        },
        {
          term: 'Alle starting stats resetten',
          body: 'verborgen onder **Danger zone**: neemt ieders startlijn opnieuw op basis van hun huidige stats, en wist alle winst tot nu toe. Alleen voor een event dat per vergissing is gestart.',
        },
      ],
      outro: 'Daaronder toont **Member breakdown** wie er in elk team wat heeft gedaan, en **Stat tile standings** de start- en huidige cijfers van elke speler op elk XP- of killvakje.',
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
      'Het format wordt bij het aanmaken gekozen maar is daarna te wijzigen via het tabblad Settings → Event van het event; de onthullingsregel en de puntenmodifiers kun je altijd wijzigen voordat de vakjes die ze raken onthuld zijn.',

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
      'Inleg en uitbetalingen zijn het terrein van de penningmeester. Een penningmeester kan alles wat een moderator kan, plus dit; een gewone moderator ziet de inlegpagina’s helemaal niet.',

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
        {
          term: 'Gastinleg',
          body: 'wat spelers betalen die geen lid zijn van een clan die het bord runt. Laat je het leeg, dan betalen gasten de ledeninleg. Wil je één speler een ander bedrag laten betalen, druk dan op **Change this player’s fee** in zijn rij bij **Sign-ups**.',
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
        'Achter mensen aan zitten is één knop: **Remind unpaid** bij Admin → **Fees** stuurt een Discord-DM naar iedereen bij dat event die nog moet betalen.',
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
        'Hoeveel handtekeningen een inleg vraagt is een claninstelling (**Clan settings → Rules & scoring → Fee sign-off**), van nul tot vijf. Nul bestaat om een echte reden: in een clan waar de penningmeester _de_ eigenaar is, is er niemand anders om te tekenen, en “34 inlegposten wachten op een tweede handtekening” wordt een rij die nooit leeg kan en permanent het luidste op het dashboard. Bij nul **is** het als betaald markeren de handtekening.',
        'Zet hem op één — de standaard — als jullie met z’n tweeën zijn. Zet hem op nul als dat eerlijk gezegd niet zo is, en hoger alleen als je clan zowel de mensen als de reden heeft.',
      ],
    },

    pay: {
      title: 'Uitbetalen',
      body: [
        'Als het event afloopt, maakt de pagina **Prizes** van het event van de pot een lijst met mensen. Genereer hem en je krijgt één rij per ontvanger, niet per team: de prijs van een winnend team wordt gelijk over de leden verdeeld, zodat uitbetalen een lijst met namen en getallen is en geen rekensom om middernacht.',
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

  coffer: {
    metaTitle: 'De clankas — Anvil-handleiding voor penningmeesters',
    metaDescription:
      'De gp-pot van de clan in Anvil: donaties vastleggen en toeschrijven aan wie ze gaf, de drie manieren waarop een prijs wordt betaald, wie het geld mag verplaatsen, en wat er gebeurt als de pot te klein is.',
    eyebrow: 'Anvil · voor penningmeesters',
    title: 'De clankas',
    dek: 'De meeste clans bewaren hun gp op iemands bank en hun boekhouding in iemands hoofd. De kas is één pot met een regel voor elke beweging — wie hem gaf, waaraan hij beloofd is, en wie hem daadwerkelijk stuurde.',
    facts: [
      { strong: '3 getallen', rest: 'in kas, vastgelegd, vrij te beloven' },
      { strong: '3 uitgangen', rest: 'weekcompetities, missievakjes, de pot van een bord' },
      { strong: 'Penningmeester', rest: 'of admin — nooit rang alleen' },
    ],
    footnote:
      'Alles hier staat onder Admin → **Coffer**, behalve de prijsladders, die staan bij datgene waarvoor betaald wordt. De publieke helft is `/coffer`: het saldo, de grootste gevers en de recente bewegingen, voor de leden.',

    what: {
      title: 'Wat het is',
      body: [
        'Een grootboek, geen portemonnee. Anvil houdt jullie gp nooit vast — het blijft waar de clan het al bewaart — dus de kas is de vastlegging van wat binnenkwam, wat beloofd is en wat er daadwerkelijk is overhandigd. Het nut zit erin dat de belofte en de betaling twee verschillende regels zijn.',
        'De pagina begint met drie getallen, en het zijn er drie omdat ze drie verschillende vragen beantwoorden:',
      ],
      rows: [
        {
          term: 'In kas',
          body: 'goedgekeurde donaties en correcties. Wat de clan gekregen heeft, min wat ze heeft afgeschreven.',
        },
        {
          term: 'Vastgelegd',
          body: 'gp waar een prijs aanspraak op maakt — gewonnen maar nog niet verstuurd, plus een pot die voor een bord opzij is gezet. Bestemd, ook al staat het nog op iemands bank.',
        },
        {
          term: 'Vrij te beloven',
          body: 'in kas min vastgelegd. Het enige getal waar een nieuwe prijs tegenaan wordt gehouden, want het alternatief is dezelfde 50m aan twee winnaars beloven terwijl de penningmeester slaapt.',
        },
      ],
      note: {
        tag: 'Een wachtende donatie telt nergens mee',
        body: 'Dat iemand "ik heb 100m gegeven" typt, is een bewering over het verleden, geen gp op een bank. Ze staat buiten alle drie de getallen tot de staf haar erkent, zodat ze nooit een prijs kan financieren die daarna niet betaald kan worden.',
      },
    },

    inbound: {
      title: 'Gp binnenkrijgen',
      body: [
        'De RuneLite-plugin regelt de gewone route automatisch: open de Clan Coffer in het spel en Anvil legt stortingen en opnames vast aan de hand van het echte muntensaldo. De eerste blik is alleen een nulmeting — hij doet nooit alsof degene die hem opende alles gedoneerd heeft wat er al in zat.',
        'Handmatige vastleggingen blijven voor alles wat gebeurde terwijl niemand de plugin open had. Een lid meldt zijn eigen donatie via `/coffer` en die wacht tot de staf hem gelooft; een penningmeester legt er een vast die al binnen is, en dat hij hem intikt **is** de goedkeuring.',
        'Hoe dan ook wordt hij aan een **persoon** toegeschreven. Dat weegt zwaarder dan het klinkt: de lijst met grootste gevers op de publieke pagina is het enige bedankje dat de meeste gevers ooit krijgen, en gp dat binnenkomt als "de clan" bedankt niemand.',
      ],
      rows: [
        {
          term: 'Open de kas in het spel',
          body: 'met Anvil ingeschakeld en ingelogd (Profile sync → **Sync Clan Coffer** staat standaard aan). Een bijpassend spelbericht schrijft je eigen storting of opname aan jou toe; veranderingen die pas na een onderbreking gezien worden, worden verrekend zonder de waarnemer te noemen. Admin → Coffer toont het laatst geziene fysieke bedrag en wanneer dat gezien is.',
        },
        {
          term: 'Een lid meldt er een',
          body: 'via de publieke kaspagina, met een schermafbeelding als die er is. Hij komt binnen als wachtend en verschijnt in je wachtrij. Goedkeuren is wat er echt geld van maakt.',
        },
        {
          term: 'Jij legt er een vast',
          body: 'Admin → Coffer → **Record a donation**. Zoek in de ledenlijst wie hem gaf, zet een bedrag naast de naam, klaar. Gasten kunnen ook worden toegeschreven — wie geen volwaardig lid is, kan best hebben bijgedragen.',
        },
        {
          term: 'Meerdere samen',
          body: 'kies ze allemaal, tik het totaal in en druk op **Split … ways**, en pas daarna een enkel aandeel met de hand aan. Het schrijft één regel per persoon in plaats van één regel met een lijst, zodat ieder van hen onder zijn eigen naam in de geverslijst staat.',
        },
      ],
      note: {
        tag: 'Een correctie is iets anders',
        body: '**Correct the pot** is voor gp dat zich buiten dit alles om heeft verplaatst — de pot vullen, hem uitgeven aan iets dat Anvil nooit zag, een fout rechtzetten. Hij hoort met opzet bij niemand, en is bewust niet de manier om een gift vast te leggen.',
      },
    },

    out: {
      title: 'De drie manieren waarop hij uitbetaalt',
      intro: 'Elke prijs in Anvil komt uit deze ene pot, en elke route bepaalt de winnaars anders. Zet de ladder waar het gewonnene thuishoort — de kas vraagt nooit wie wat won.',
      rows: [
        {
          term: 'Een weekcompetitie, op haar eigen pagina',
          body: 'een Skill of Boss of the Week draagt een plaatsenladder: eerste krijgt dit, tweede dat. Ze wordt **één keer** afgerekend als de competitie eindigt, op basis van de eindstand — tijdens de rit verandert er niets van eigenaar. Zet hem terwijl je de competitie aanmaakt, of later op de eigen pagina van de competitie.',
        },
        {
          term: 'Een missievakje, op het bord',
          body: 'missies betalen in de volgorde waarin mensen klaar zijn, dus hun ladder wordt geclaimd in plaats van afgerekend: het eerste team dat hem haalt, pakt het gp van de eerste plaats. Wordt gezet in het rewards-gedeelte van het vakje, op elk bord dat missies toestaat.',
        },
        {
          term: 'De prijzenpot van een bord',
          body: 'een bingo verdeelt zijn eigen pot over plaatsen, dus de kas geeft hem gewoon één getal. Event → **Prizes** → *From the clan coffer*. Het komt bij het inschrijfgeld en bij wat je zelf hebt toegevoegd, en de verdeling over plaatsen zet je op diezelfde pagina. Je kiest ook of de kas dat gp meteen **vasthoudt** of alleen de belofte vastlegt — het is nog niet weg, en een bord over zes weken hoeft niet de halve pot tot dan vastgezet te hebben.',
        },
      ],
      note: {
        tag: 'Als mensen gelijk eindigen',
        body: 'Een weekladder kan **gelijke standen delen**: iedereen die gelijk staat, legt de plaatsen die ze bezetten samen en neemt een gelijk deel, zodat drie mensen met elk 40 kc een derde van de eerste, tweede en derde plaats nemen in plaats van dat de eerste van hen alles pakt. Laat het uit en de eigen volgorde van het bord beslist. Beide zijn te verdedigen — beslissen nadat de uitslag binnen is niet.',
      },
    },

    who: {
      title: 'Wie hem mag verplaatsen',
      intro: 'Geld is een eigen bevoegdheid, geen rang. Een moderator kan een inzending goedkeuren en de kas nooit aanraken, en dat is opzet en geen vergetelheid.',
      rows: [
        {
          term: 'Penningmeester of admin',
          body: 'het hele grootboek: donaties vastleggen en goedkeuren, de pot corrigeren, prijsladders zetten, een prijs als verstuurd markeren. De eigenaar telt hier als admin.',
        },
        {
          term: 'Een moderator',
          body: 'niets daarvan. Ze zien de kaspagina helemaal niet — geld ophalen is het werk van de penningmeester, en rang alleen heeft dat recht nooit gegeven.',
        },
        {
          term: 'Een bordpenningmeester',
          body: 'het geld van één event: de kosten, de uitbetalingen, de prijzenpot. Wordt per bord gegeven, en zo draait een bezoekende clan zijn eigen helft van een clan-tegen-clan zonder jullie grootboek in handen te krijgen. Aan de clankas komen ze niet.',
        },
        {
          term: 'Elk lid',
          body: 'kan een donatie melden en de publieke pagina lezen. Meer is het niet.',
        },
      ],
      note: {
        tag: 'Vertel het de clan, in een kanaal',
        body: 'Richt het **Coffer ledger** onder Admin → Discord → What goes where → **Staff only** op een Discord-kanaal, dan wordt elke beweging geplaatst met het saldo dat ze achterlaat. Het is de enige feed zonder terugval: laat hem leeg en er wordt nergens iets over het geld geplaatst. Zie [Anvil in Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'Als de pot te klein is',
      body: [
        'Een prijs die groter is dan de kas wordt niet geweigerd. Hij wordt geboekt als **verschuldigd en niet gedekt** — een echte regel met de naam van een winnaar erop — want het alternatief is een winnaar zonder iets en zonder spoor dat er ooit iets beloofd is.',
        'De oplossing is dus de gewone: haal gp binnen en betaal daarna. Wat je niet moet doen is de ladder achteraf stilletjes aanpassen; het grootboek zegt al wat er is aangekondigd, en dat die twee elkaar tegenspreken is erger dan tekortkomen.',
      ],
      note: {
        tag: 'Anvil verstuurt niets',
        body: 'Elke prijs eindigt ermee dat een mens in het spel gp overhandigt en een regel afvinkt. De taak van het grootboek is te zorgen dat die regel bestaat, dat er wie en hoeveel op staat, en dat niemand hem een week later uit de Discord-geschiedenis hoeft op te diepen.',
      },
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
        'de ledenlijst: mensen toevoegen en verwijderen, en joinverzoeken beantwoorden ([Je mensen]({peopleGuide}))',
        'accountverificaties — de XP-uitdaging en handmatige beoordeling',
        'inzendingen en bewijsafbeeldingen',
        'weekcompetities en de agenda',
        'activiteiten in de clanagenda',
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
          body: 'na de eerste eigendomscontrole herkent de plugin het account automatisch en houdt een stabiele vingerafdruk de koppeling in stand bij naamswijzigingen. Een roosteraccount zonder bekende vingerafdruk gebruikt eenmalig de XP-controle of een moderator.',
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
        body: 'Een account verifiëren zegt “dit is echt van hem”. Het maakt hem geen deel van de clan. Lidmaatschap komt alleen uit een synchronisatie van de ledenlijst in het spel of van de staf die hem met de hand toevoegt, en een gastplek alleen uit een joinverzoek dat de staf goedkeurt (of meteen, als de clan iedereen toelaat). Dat is opzet, en juist dat voorkomt dat iemand jouw clan binnenkomt door een naam in te tikken.',
      },
    },

    roster: {
      title: 'De ledenlijst eerlijk houden',
      body: [
        'De ledenlijst komt uit precies één plek: een admin draait een synchronisatie vanuit de clanlijst in het spel, met de **Anvil**-knop in de titelbalk van het clanvenster (of **Sync roster** in het zijpaneel van de plugin). Al het andere — verificaties, koppelingen, inschrijvingen — hangt daaraan.',
        'Het onderhoudswerk is dus klein maar echt: vraag een admin de synchronisatie te draaien na elke wervingsronde (die maakt gasten die in het spel zijn toegetreden lid), beantwoord de joinverzoeken bovenaan het **Roster**-tabblad, en werk **Needs review** af in plaats van te wachten tot mensen klagen. Zie [Je mensen]({peopleGuide}).',
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

  commands: {
    metaTitle: 'Discord-slash-commando’s — Anvil',
    metaDescription:
      'Elk slash-commando van Anvil — /bingo, /sotw, /botw, /eff, /coffer, /stats en /guide — met elke optie uitgelegd, voorbeelden, wie wat mag gebruiken, en oplossingen voor commando’s die niet verschijnen.',
    eyebrow: 'Anvil · in Discord',
    title: 'Slash-commando’s',
    dek: 'Typ `/` in de Discord van je clan en Anvil antwoordt vanaf de live site: het bord, de stand, je eigen kaart, de weekcompetities, de kas en de stats van wie dan ook. Deze pagina is de volledige lijst, gegenereerd uit de commando’s die de bot echt registreert, dus hij is nooit verouderd.',
    facts: [
      { strong: 'Privé', rest: 'antwoorden die alleen jij ziet, met een Share-knop' },
      { strong: 'Jouw taal', rest: 'waar je Discord ook op ingesteld staat' },
      { strong: 'Alleen lezen', rest: 'behalve /coffer add en remove' },
    ],
    footnote:
      'Hoe je de bot überhaupt opzet, staat in de [Discord-handleiding](/guide/discord). Deze pagina gaat over het gebruik ervan.',

    using: {
      title: 'Zo werkt een commando',
      body: [
        'Typ `/` in een kanaal dat de bot kan zien en kies een Anvil-commando uit de lijst. Discord toont dan de opties als vakken om in te vullen: druk op Tab of klik er een aan om hem toe te voegen. Opties tussen punthaken, `<angle brackets>`, zijn hieronder verplicht; opties tussen vierkante haken, `[square brackets]`, zijn optioneel en mag je weglaten.',
        'Elk antwoord is **privé**: alleen jij ziet het, dus tien keer per dag het bord checken stoort niemand. Is het de moeite waard om aan het kanaal te laten zien, druk dan op **Share to channel** onder het antwoord. De gedeelde kopie wordt op dat moment opnieuw opgebouwd, dus een stand die je later deelt is de stand van dat moment.',
      ],
      rows: [
        { term: 'Verplicht', body: '`<amount>` — Discord verstuurt het commando pas als dit is ingevuld.' },
        { term: 'Optioneel', body: '`[member]` — laat het weg en het commando antwoordt over jou, je team of de hele clan.' },
        { term: 'Een lijst', body: 'kies een van de waarden die Discord aanbiedt; zelf iets typen kan niet.' },
        { term: 'Typen om te zoeken', body: 'begin te typen en kies uit de suggesties, zoals bossnamen of je eigen accounts.' },
        { term: 'Een lid', body: 'kies iemand uit de server, net als bij een @mention.' },
      ],
      note: {
        tag: 'Commando’s werken alleen in de server van je clan',
        body: 'Elk antwoord gaat over één clan, en een DM heeft geen clan om over te antwoorden. Daarom verschijnen de commando’s niet in DM’s.',
      },
    },

    bingo: {
      title: 'Bordcommando’s: /bingo',
      intro:
        '`/bingo` gaat over één bord. Als er meerdere borden live zijn, tonen **board** en **leaderboard** ze allemaal; de rest antwoordt over het bord dat nu loopt, anders het volgende dat start, anders het bord dat net is afgelopen.',
    },

    clan: {
      title: 'Clancommando’s',
      intro:
        'Deze antwoorden over de clan in plaats van over een bord, dus ze werken of er nu een bingo loopt of niet: de weekcompetities, efficiëntie, de kas, de stats van wie dan ook, en de installatiehandleidingen.',
    },

    options: {
      title: 'Opties die je overal tegenkomt',
      intro: 'Een paar opties betekenen hetzelfde bij elk commando dat ze heeft:',
      rows: [
        {
          term: '`member`',
          body: 'iemand anders in de server. Laat het weg om naar jezelf te vragen. Het vindt hun Anvil-account via de Discord-login die ze op de site gebruikten, dus het werkt alleen voor leden die één keer bij Anvil zijn ingelogd.',
        },
        {
          term: '`account`',
          body: 'welk van de OSRS-accounts van die persoon, voor mensen met alts. Typ om te kiezen; laat het weg voor hun main.',
        },
        {
          term: '`page`',
          body: 'een boss of activiteit, getypt om te zoeken: `Zulrah`, `Theatre of Blood`, `Tempoross`. Laat het weg voor het totaaloverzicht.',
        },
        {
          term: '`language`',
          body: 'antwoord deze ene keer in een andere taal. Standaard krijg je de taal waarop je Discord staat, of de bottaal die de clan gekozen heeft.',
        },
        {
          term: '`amount`',
          body: 'gp op de makkelijke manier: `5m`, `2.5b`, `500k`, of een gewoon getal zoals `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Wie wat mag gebruiken',
      body: [
        'Iedereen in de server kan elk alleen-lezen-commando gebruiken. Wat je ziet is wat een lid zou zien: een bord waarvan de vakjes nog niet onthuld zijn, blijft ook in Discord verborgen, zelfs voor de staf.',
        'Commando’s die over **jou** antwoorden (`/bingo me`, `/stats` zonder member) moeten weten welk Anvil-account van jou is. Ze vinden het via de Discord-login die je op de site gebruikte, dus log één keer met Discord in bij Anvil en vanaf dan werken ze.',
      ],
      rows: [
        { term: 'Iedereen', body: 'elk commando behalve `/coffer add` en `/coffer remove`.' },
        {
          term: 'Penningmeesters, admins, eigenaren',
          body: '`/coffer add` en `/coffer remove`. Gecontroleerd aan de hand van je rol **op de Anvil-site**, nooit je Discord-rol, want een rang in een chatserver heeft nog nooit zeggenschap over het geld van de clan betekend.',
        },
      ],
    },

    trouble: {
      title: 'Als een commando niet werkt',
      intro: 'De gebruikelijke oorzaken, ongeveer in de volgorde waarin ze voorkomen:',
      rows: [
        {
          term: 'Geen Anvil-commando’s in de lijst',
          body: 'de bot is uitgenodigd zonder zijn commando’s — dat is een losse permissie, en oudere uitnodigingslinks vroegen er maar één. Een admin gebruikt opnieuw **Invite / re-invite the bot** via Admin → Discord → **Connection**. Dat schopt de bot er niet uit en zet niets terug. Nieuw toegevoegde commando’s kunnen tot een uur nodig hebben om te verschijnen.',
        },
        {
          term: '"The application did not respond"',
          body: 'Anvil was even onbereikbaar, meestal midden in een update. Probeer het een paar seconden later opnieuw.',
        },
        {
          term: '"Niet op dit bord" over jezelf',
          body: 'je hebt je niet voor dit bord ingeschreven, of Anvil kan je Discord niet aan je account koppelen. Log op de site in met dit Discord-account en controleer je profiel.',
        },
        {
          term: 'De stats van een lid komen leeg terug',
          body: 'die persoon is nog niet met Discord bij Anvil ingelogd, of de hiscores van het account zijn nog niet gelezen. Probeer het opnieuw met de optie `account`, of vraag diegene één keer in te loggen.',
        },
        {
          term: '`/coffer add` zegt dat het niet mag',
          body: 'je rol op de Anvil-site is niet penningmeester, admin of eigenaar, of deze Discord is niet het account waarmee je op de site inlogt.',
        },
      ],
    },

    labels: {
      options: 'Opties',
      noOptions: 'Geen opties — gewoon uitvoeren.',
      example: 'Voorbeeld',
      examples: 'Voorbeelden',
      required: 'verplicht',
      optional: 'optioneel',
      choices: 'Keuzes',
      range: 'van {min} tot {max}',
      kinds: {
        text: 'tekst',
        number: 'getal',
        member: 'een lid',
        choice: 'kies uit een lijst',
        search: 'typ om te zoeken',
        yesno: 'ja of nee',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'Het bord dat nu loopt. Tot het bord onthuld is, blijven de namen van de vakjes ook hier verborgen.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'De teamstand, in punten of vakjes, afhankelijk van hoe het bord telt.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Hoe dit bord telt (rechtstreeks uit het event gelezen, dus altijd juist), en daarna de huisregels van je clan.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Hoe je erin komt: inschrijvingen, het inschrijfgeld, en hoe het met je eigen inschrijving staat.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Wat er hierna komt: een onthulling van vakjes, een missie of een deadline.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Je team, je plek en de vakjes die aan jou zijn toegeschreven.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'Een korte lijst van waar de bot op antwoordt, gewoon in Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'De kaart van een team: score, opstelling en recente vakjes. Laat de naam weg voor je eigen team.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Elke actieve Skill of the Week, de top van elk, en waar jij staat.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Elke actieve Boss of the Week en de live stand ervan.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'De efficiëntieranglijst van de clan en jouw plek erin. Standaard gespeelde uren; kies bossuren voor bossen.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Het saldo van de kas, de grootste gevers en de recente bewegingen.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Alleen voor penningmeesters, admins en eigenaren. Legt binnenkomend gp vast; het wordt ook in het kasfeedkanaal gepost.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Alleen voor penningmeesters, admins en eigenaren. Weigert de kas onder nul te brengen; leg dat vast op de kaspagina als je het echt meent.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Eén account in één oogopslag: combat- en totaallevel, gespeelde uren en bossuren, aantal in het collection log en persoonlijke records.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Het level en de XP van elke skill.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Gespeelde uren en bossuren, en uit welke skills en bosses ze komen.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Voortgang in het collection log in totaal, of de pagina van één boss.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Persoonlijke records. Raids houden een tijd bij per modus en teamgrootte, dus gebruik `mode` en `size` om de run te vinden die je bedoelt.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Hoeveel geluk het account heeft gehad met de drops die Anvil bijhoudt.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'De grootste collection logs van de clan.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'De droogste en gelukkigste leden van de clan.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'Een installatiehandleiding binnen Discord: de lijst met stappen, of één stap met een link er rechtstreeks naartoe op de site.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'Een van de spelgidsen van de clan (raids, bossing, money making…): begin de naam te typen en kies hem uit de lijst.',
      },
    },
  },

  tiles: {
    metaTitle: 'Regels en beperkingen van vakjes — Anvil',
    metaDescription:
      'Wat elk soort bingovakje van je nodig heeft (game-instellingen, de RuneLite-plugin, een gesynchroniseerde collection log, een hiscores-rang) en waar de grenzen liggen van wat het kan bijhouden.',
    eyebrow: 'Anvil · voor spelers',
    title: 'Regels en beperkingen van vakjes',
    dek: 'Elk vakje laat zien wat het van je nodig heeft en wat het niet kan. Deze pagina legt elke regel uit; de **Why?**-links op een vakje komen hier uit.',
    needs: 'Nodig',
    limit: 'Goed om te weten',
    checked: 'Het vakje controleert dit voor je',
    englishOnly: 'De regels hieronder zijn voorlopig in het Engels, zodat ze altijd kloppen met wat de site echt doet.',
  },
  // /guide/creators — de gids voor hosts van een creator-space.
  creators: {
    metaTitle: 'Een OSRS-bingo organiseren voor je kijkers — Anvil',
    metaDescription:
      'Organiseer een Old School RuneScape-bingo of tile-race voor je stream, zonder clan: maak een space, deel één link, kies wie mee mag doen (Twitch, Kick, YouTube of Discord) en zet het bord met OBS in je stream.',
    eyebrow: 'Voor streamers en creators',
    title: 'Events organiseren voor je kijkers',
    dek: 'Met een creator-space organiseer je een bingo voor je stream. Je hebt geen clan in het spel nodig. Je maakt één event, deelt één link en je kijkers doen mee.',
    facts: [
      { strong: 'Geen clan', rest: 'nodig' },
      { strong: 'Gratis', rest: 'om te starten' },
      { strong: 'Eén link', rest: 'voor je chat' },
    ],

    what: {
      title: 'Wat een creator-space is',
      body: [
        'Het is je eigen pagina op Anvil, op `{apex}/c/jouw-naam`. Daar organiseer je events voor je kijkers.',
        'Het is geen clan. Er is geen clanlijst, geen rangen en geen wekelijkse wedstrijden. Wie meedoet aan jouw event, speelt dat event. Meer niet.',
        'Kijkers loggen in met Discord, voegen hun RuneScape-character toe en drukken op **Join**. De Anvil RuneLite-plugin telt hun drops dan vanzelf.',
      ],
    },

    create: {
      title: 'Maak je space',
      body: [
        'Ga naar [{apex}/host](/host) en log in met Discord.',
        'Typ een naam voor je space. Je kanaalnaam is een goede keuze. Je link wordt van de naam gemaakt. Druk op **change link** als je een andere wilt.',
        'Druk op **Create my space**. Je krijgt één space per Discord-account.',
      ],
    },

    first: {
      title: 'Maak je eerste event',
      body: [
        'Direct nadat je je space hebt gemaakt, kom je bij **Create your first event**. Later gebruik je **+ New event** bovenaan **Your events**.',
        '**Name.** Dit zien je kijkers.',
        '**What kind?** Kies een kaart. **Team bingo** is een 5×5-raster en Anvil verdeelt de spelers voor je over teams. **Solo bingo** is hetzelfde raster, iedereen voor zichzelf. **Team race** zijn taken op volgorde: het team dat het verst is, wint.',
        '**Ready-made tiles** geeft je een mix van makkelijke tot moeilijke taken die je later kunt aanpassen. **Blank, I’ll write my own** begint leeg.',
        '**Who can join?** Laat het op **Anyone** staan, of kies wie mee mag doen. Zie stap 5.',
        '**When?** Kies de start- en einddatum. Of laat het leeg en start het event zelf als je klaar bent.',
        'Druk op **Create event**. Druk daarna op **Copy invite link**.',
      ],
    },

    share: {
      title: 'Deel de link',
      body: [
        'Plak de uitnodigingslink in je stream-chat, je Discord of je socials. Die link is alles wat je kijkers nodig hebben.',
        'Je kunt hem altijd opnieuw kopiëren: **Your events** → **Copy invite link** naast het event.',
        'Wil je dat de bot in de chat op `!join` antwoordt met de link? Zie stap 9.',
      ],
    },

    who: {
      title: 'Kies wie mee mag doen',
      body: [
        'Elk event begint open voor **Anyone**. Om het voor je community te houden, open je de **Settings** van het event → **Viewers** → **Who can join?** en kies je een of meer opties. Dezelfde opties staan op het scherm voor het eerste event.',
        'Kies je er meer dan één, dan **is één van hen genoeg**. Een volger OF een server booster komt binnen.',
      ],
      intro: 'Elke optie, en wat een kijker moet doen:',
      rows: [
        {
          term: 'Anyone',
          body: 'Iedereen met de link doet meteen mee.',
        },
        {
          term: 'Twitch followers',
          body: 'De kijker drukt op de eventpagina op **Link Twitch** en logt in met Twitch. Anvil controleert of hij jou volgt.',
        },
        {
          term: 'Twitch subs',
          body: 'Zoals bij volgers, maar hij moet geabonneerd zijn. Kies het laagste niveau: **Tier 1 or higher**, **Tier 2 or higher** of **Tier 3**. Prime-subs tellen als tier 1. Je kanaal moet een Twitch-affiliate of -partner zijn.',
        },
        {
          term: 'Kick followers',
          body: 'Kick vertelt apps niet wie je volgt. Daarom telt Anvil mensen die je volgen _nadat_ je Kick hebt gekoppeld. Eerder gevolgd? Dan ontvolgt de kijker je en volgt opnieuw. Is je Kick-chat alleen voor volgers? Zet dan **My Kick chat is followers-only** aan in het vak **Kick channel**. Een kijker die zijn Anvil-code in je chat typt, telt dan als volger.',
        },
        {
          term: 'Kick subs',
          body: 'Subs die Anvil heeft gezien nadat je Kick koppelde, tellen vanzelf. Alle anderen drukken op **Get Kick code** en typen de code (hij ziet eruit als `ANVIL-7F3K9Q`) in je Kick-chat, en Anvil ziet hun sub-badge. Kick heeft geen sub-niveaus.',
        },
        {
          term: 'YouTube subscribers',
          body: 'De kijker drukt op **Check my YouTube subscription** en logt in met Google. Zijn abonnementen moeten openbaar zijn op YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'De kijker typt zijn Anvil-code in je YouTube-livechat. Leden kunnen dus alleen meedoen **terwijl je live bent**.',
        },
        {
          term: 'Discord role',
          body: 'Mensen met een rol die je kiest in je Discord-server (maximaal 5 rollen). Koppel eerst je server: **Discord (optional)** in het menu.',
        },
        {
          term: 'Server boosters',
          body: 'Mensen die je Discord-server boosten. Hiervoor moet je server ook gekoppeld zijn.',
        },
      ],
      note: {
        tag: 'Goed om te weten',
        body: 'Koppel eerst je kanaal (stap 7), anders blijven de opties voor Twitch, Kick en YouTube grijs. Eén Twitch-, Kick- of YouTube-account brengt maar één speler in elk event. Je staff en mensen die je bij naam uitnodigt, slaan de controles over.',
      },
    },

    approve: {
      title: 'Zeg ja tegen elke speler (optioneel)',
      body: [
        'Wil je zelf kiezen wie speelt? Open de **Settings** van het event → **Viewers** → **Who can enter** en kies **Ask me about everyone**. Druk op **Save changes**.',
        'Nu drukken kijkers op **Ask to join** in plaats van **Join**. Ze moeten eerst nog steeds door je **Who can join?**-opties heen.',
        'Hun verzoeken staan bij **Your events** als **N waiting for you**. Klik erop, of open het tabblad **Sign-ups** van het event. De lijst bovenaan heet **Waiting for your yes**. Accepteer of wijs elk verzoek af.',
      ],
    },

    channels: {
      title: 'Koppel je Twitch, Kick of YouTube',
      body: [
        'Open **Settings** in het menu. Druk in het vak **Twitch channel**, **YouTube channel** of **Kick channel** op **Connect Twitch**, **Connect YouTube** of **Connect Kick** en log in als je kanaal.',
        'Elk kanaal dat je koppelt, staat op je pagina als **verified**-link. Je kunt geen link met de hand intypen: door in te loggen weet Anvil dat het kanaal van jou is.',
        'Een kanaal kan aan één plek op Anvil gekoppeld zijn. Staat het al op een andere space of clan van jou, dan vraagt Anvil of je het wilt verplaatsen.',
      ],
    },

    overlay: {
      title: 'Zet het bord in je stream (OBS)',
      body: [
        'Druk bij **Your events** naast het event op **Stream overlay**, daarna op **Make overlay links**.',
        'Je krijgt drie links. **Standings**: de beste teams en hoe ver ze zijn. **Feed**: de nieuwste drops en voltooide tiles. **Board**: het bord, met voltooide tiles gemarkeerd.',
        'Kies vóór het kopiëren een **Text size** (S, M, L of XL). Druk daarna op **Copy** naast de link die je wilt.',
      ],
      stepsTitle: 'Voeg het toe in OBS',
      steps: [
        'Druk in OBS onder **Sources** op **+** en kies **Browser**.',
        'Plak de link bij **URL**.',
        'Stel een grootte in, bijvoorbeeld 800 × 600. Laat **Custom CSS** leeg.',
        'Druk op **OK**. Het ververst zichzelf om de paar seconden.',
      ],
      tipsTag: 'Goed om te weten',
      tips: [
        'Zet `&limit=10`, `&title=0` of `&align=right` achter een link om hem aan te passen.',
        'De overlay toont wat je openbare eventpagina toont. Verborgen standen en verborgen tiles blijven ook in de stream verborgen.',
        '**Reset link** maakt nieuwe links en stopt de oude. Gebruik het als een link uitlekt. Je moet de nieuwe links dan opnieuw in OBS plakken.',
        'Een klein “Anvil”-teken staat in de hoek. Met het Gold-abonnement kun je het verbergen via **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join in je chat',
      body: [
        'Open **Settings** → **!join in Twitch chat** en zet het aan.',
        'Als een kijker `!join` typt, antwoordt de Anvil-bot (Anvil_OSRS) met de link naar je open event. Hij antwoordt hooguit eens per 30 seconden, hoeveel mensen het ook typen.',
        'Hij antwoordt alleen in een kanaal dat je in stap 7 hebt gekoppeld. Voor Kick zet je **!join in Kick chat** aan in het vak **Kick channel**.',
        'Geen event open? Dat zegt hij dan: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Blokkeert je chat links (Twitch’ **Block hyperlinks** of AutoMod), dan wordt het antwoord van de bot tegengehouden. Typ één keer `/vip anvil_osrs` of `/mod anvil_osrs` in je chat zodat de link erdoor komt.',
        'Bezig met een event? **Space settings** in het menu van het event brengt je terug naar deze schakelaars. Dat doet **Switch it on in your settings** onder **Who can join?** ook.',
      ],
    },

    page: {
      title: 'Maak je pagina persoonlijk',
      body: [
        'Je pagina is wat mensen zien op `{apex}/c/your-name`, samen met je events. Open **Settings** → **Your page**. Elk onderdeel heeft een eigen opslaanknop.',
      ],
      items: [
        '**Bio.** Een paar regels over jou en je streams. Links die beginnen met `https://` zijn klikbaar.',
        '**Logo and banner.** Druk op **Upload a logo** of **Upload a banner**. De banner loopt over de hele bovenkant van je pagina, dus maak hem breed (3:1, bijvoorbeeld 1500 × 500). PNG, JPEG, GIF of WebP. Beide mogen geanimeerd zijn.',
        '**Panels.** Tot 8 kaarten onder je events, zoals de panelen onder een Twitch-kanaal. Druk op **+ Add a panel** en geef het een titel en wat tekst. Een afbeelding en een link zijn optioneel. Met de pijlen verander je de volgorde.',
        '**Schedule.** Wanneer je meestal live gaat, in je eigen tijdzone. Bezoekers zien elke tijd op hun eigen klok.',
        '**Featured.** Eén clip, vastgezet bovenaan je pagina. Kies een van je stream-highlights (volgende stap), of plak een cliplink van Twitch, YouTube, Kick of Medal.',
        'Druk op **Preview your page** om je pagina te zien zoals bezoekers hem zien.',
      ],
      note: {
        tag: 'De regels van Jagex',
        body: 'Alles op je pagina moet de regels van Jagex volgen: geen verkoop van goud of accounts, geen gokken, geen bots en geen privéservers. Anvil controleert je tekst en links als je opslaat. Verbergt de staf van Anvil je pagina na een melding, dan staat dat in je instellingen. Denk je dat het een vergissing is? Vraag het op de Discord van Anvil.',
      },
    },

    highlights: {
      title: 'Stream-highlights',
      body: [
        'Is je Twitch- of YouTube-kanaal gekoppeld, dan legt Anvil de grote momenten van je events vast terwijl je live bent. De schakelaars staan in **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** staat aan zodra je koppelt. Terwijl je live bent op Twitch, maakt Anvil een clip als een van je events begint, als een team het bord uitspeelt of wint, en als je eigen character een zeldzame drop of een pet krijgt. Op YouTube bewaart Anvil in plaats daarvan een link naar die seconde van je stream. Kick heeft nog geen highlights.',
        'De clips staan onder **Highlights** op de eventpagina en op je pagina. Je kunt er een vastzetten als je **Featured**-clip (stap 10).',
        '**Let Anvil feature clips from my events in its own promotion** blijft uit tot je het aanzet. Daarna mag Anvil een clip delen op zijn eigen pagina’s en socials, en noemt het jou altijd als maker.',
        'Je spelers kunnen ook hun eigen grote momenten clippen. Ze zetten **Clip my stream when I hit a big moment** aan onder hun Twitch-account in **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Laat je vermelden op Anvil',
      body: [
        'Je space staat bij het maken niet in de lijst. Alleen mensen met je link kunnen hem vinden.',
        'Open **Settings** → **Advertise on Anvil** en zet het aan. Je space staat dan in de Anvil-clangids en je nieuwe events staan op `{apex}/events`.',
        'Wil je maar één event vermelden, open dan de **Settings** ervan → **Viewers** → **List on Anvil**. Het staat erin zolang het event gepland of live is.',
        'Een event zonder datums staat onder **Open to join**, met de tekst “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Abonnementen en limieten',
      body: [
        'Je abonnement bepaalt hoeveel spelers er tegelijk in je events kunnen zijn. Events waarvan de datums overlappen delen dat aantal; events op verschillende datums krijgen het elk. Een speler in twee overlappende events telt twee keer mee. Al het andere is bij elk abonnement hetzelfde: het bord, de plugin-tracking, de overlay en Discord.',
        'Je abonnementskaart staat bij **Your events**. Om abonnementen te vergelijken, zie [prijzen](/pricing#creators). Om te wijzigen of op te zeggen wat je betaalt, ga je naar [je factuurpagina](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Tot 50 spelers tegelijk in al je events. Eén event tegelijk. Controles voor Discord-rol en booster.' },
        { term: 'Bronze', body: 'Tot 150 spelers tegelijk in al je events. Controles voor Twitch, Kick en YouTube.' },
        { term: 'Silver', body: 'Tot 300 spelers tegelijk in al je events. Meer dan één event tegelijk. `!join` in de chat. Als eerste getoond in de lijst.' },
        { term: 'Gold', body: 'Tot 1.000 spelers tegelijk in al je events. Verberg het Anvil-teken op je overlay.' },
        { term: 'Partner', body: 'Geen spelerslimiet. Direct met Anvil ingesteld — neem contact op.' },
      ],
      note: {
        tag: 'Op dit moment',
        body: 'Zolang Anvil groeit, komt iedereen nog binnen, ook boven de aantallen van je abonnement. De limieten gaan later in, met aankondiging. Je abonnementskaart laat zien hoe dicht je erbij zit.',
      },
    },

    faq: {
      title: 'Vragen',
      intro: 'De vragen die streamers het vaakst stellen:',
      rows: [
        {
          term: 'Hebben mijn kijkers een clan nodig?',
          body: 'Nee. Ze hebben een Discord-account en een OSRS-character nodig. Stuur ze de [gids voor kijkers]({joiningGuide}).',
        },
        {
          term: 'Hebben ze de RuneLite-plugin nodig?',
          body: 'Voor drops en kills wel. De plugin stuurt ze vanzelf in. Een paar tiles lezen in plaats daarvan de hiscores.',
        },
        {
          term: 'Een kijker zegt “The host’s Twitch connection isn’t working”.',
          body: 'Twitch accepteert je koppeling niet meer. Open **Settings** en druk op **Reconnect Twitch**. Hetzelfde geldt voor Kick en YouTube.',
        },
        {
          term: 'Kan iemand anders me helpen met organiseren?',
          body: 'Ja. Open **Players** → **Staff & roles**, voeg ze toe en kies wat elk van hen mag doen.',
        },
        {
          term: 'Ik run ook een clan in het spel.',
          body: 'Dan heb je misschien geen space nodig. Een openbare clan kan in plaats daarvan **Streaming** aanzetten. Zie [streamen voor clans]({streamingGuide}).',
        },
        {
          term: 'Kan ik een tweede space maken?',
          body: 'Voorlopig één space per Discord-account. Neem contact op als je er nog een nodig hebt.',
        },
        {
          term: 'Waar vind ik de instellingen van mijn space?',
          body: 'Druk op **Settings** in het menu. Zit je in een event, druk dan op **Space settings** in het menu van het event.',
        },
        {
          term: 'Wat doet de **Report**-knop op mijn pagina?',
          body: 'Iedereen die is ingelogd, kan je pagina, een paneel, een event of een highlight melden bij de staf van Anvil. Meldingen gaan alleen naar de staf. Verbergt de staf je bio, panelen, schema of uitgelichte clip, dan staat dat in je instellingen.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — voor een kijker die op de link van een streamer klikte.
  joiningStream: {
    metaTitle: 'Meedoen aan de OSRS-bingo van een streamer — Anvil',
    metaDescription:
      'Een link van een streamer gekregen? Log in met Discord, voeg je OSRS-character toe, druk op Join. Wat je doet bij events alleen voor volgers of subs op Twitch, Kick of YouTube, en hoe je drops tellen.',
    eyebrow: 'Voor kijkers',
    title: 'Meedoen aan het event van een streamer',
    dek: 'Een streamer deelde een link. Zo kom je op het bord. Je hebt geen clan nodig.',
    facts: [
      { strong: '~2 min', rest: 'om mee te doen' },
      { strong: 'Geen clan', rest: 'nodig' },
    ],

    join: {
      title: 'Meedoen in vier stappen',
      body: [
        '**Open de link** die de streamer deelde. Of typ `!join` in hun chat, dan plaatst de bot hem.',
        '**Log in met Discord.** Dat is je Anvil-account. Je hoeft niets in te vullen.',
        '**Voeg je character toe.** Druk op **Add my character** en typ je RuneScape-naam. Staat er **Prove it’s mine**, volg dan de stappen op je profiel. De [pluginhandleiding]({pluginGuide}) laat zien hoe.',
        '**Druk op Join.** Kies je character als je er meer hebt. Je ziet **You’re in!** als het gelukt is.',
      ],
    },

    gated: {
      title: 'Events voor volgers of subs',
      body: [
        'Sommige events zijn alleen voor de community van de streamer. De joinkaart zegt voor wie, bijvoorbeeld “Open to followers of somename on Twitch”.',
        'Druk toch op **Join**. Word je nog niet binnengelaten, dan staat op de kaart wat je kunt doen. Doe een van die dingen en druk dan opnieuw op **Join**.',
      ],
      intro: 'Wat je doet per soort:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Druk op **Link Twitch** en log in met Twitch. Anvil vraagt om geen rechten. Druk daarna opnieuw op **Join**.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Druk op **Get Kick code**. Typ de code (zoals `ANVIL-7F3K9Q`) binnen 10 minuten in de Kick-chat van de streamer. Elke code werkt één keer. Druk daarna opnieuw op **Join**.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Druk op **Check my YouTube subscription** en log in met Google. Kies het account waarmee je kijkt. Je abonnementen moeten openbaar zijn in de privacyinstellingen van YouTube.',
        },
        {
          term: 'YouTube member',
          body: 'Druk op **Link my YouTube account**, typ dan je code in de YouTube-livechat en druk op **check the chat**. Dit werkt alleen terwijl de streamer live is.',
        },
        {
          term: 'Discord role or booster',
          body: 'Word lid van de Discord-server van de streamer en krijg de rol (of boost hem). Anvil controleert dit met het Discord-account waarmee je bent ingelogd.',
        },
      ],
      note: {
        tag: 'Goedkeuring',
        body: 'Sommige streamers zeggen ja tegen elke speler. Dan staat er op de knop **Ask to join** en zie je **Waiting for the host** tot ze antwoorden.',
      },
    },

    plugin: {
      title: 'Installeer de Anvil-plugin',
      body: [
        'Je drops en kills tellen via de Anvil-plugin voor RuneLite. Installeer hem uit de Plugin Hub en log in met Discord in het zijpaneel.',
        'De [pluginhandleiding]({pluginGuide}) loopt je er in zo’n drie minuten doorheen.',
      ],
    },

    play: {
      title: 'Spelen',
      body: [
        'Dat is alles. Speel gewoon. Als je een drop of kill krijgt die het bord nodig heeft, stuurt de plugin hem vanzelf in.',
        'Open de eventlink altijd om het bord en de standen te zien. Je speelt alleen dit ene event: je wordt geen lid van een clan.',
      ],
    },

    accounts: {
      title: 'Je gekoppelde accounts',
      body: [
        'De Twitch-, YouTube- en Kick-accounts die je hebt gekoppeld staan in [Settings → Connected accounts](/settings/connections). Je kunt ze daar ook koppelen voordat je meedoet.',
        'Je kunt er altijd een ontkoppelen. Events waaraan je al meedoet, houden je erin. Bij een afgeschermd event waaraan je later meedoet, moet je opnieuw koppelen.',
        'Gekoppelde Twitch-, YouTube- en Kick-accounts staan op je profiel met een vinkje: je hebt bewezen dat ze van jou zijn. Zet **Show on my profile** uit om er een te verbergen. Een Medal-link is anders. Die plak je zelf, dus die krijgt geen vinkje.',
        'Stream je zelf op Twitch? Zet **Clip my stream when I hit a big moment** aan onder je Twitch-account. Terwijl je live bent in het event van een streamer, clipt Anvil je zeldzame drops, pets en voltooide tiles.',
      ],
    },

    faq: {
      title: 'Vragen',
      intro: 'Als iets nee zegt:',
      rows: [
        {
          term: '“This event is full”',
          body: 'Er is geen plek meer voor extra spelers. Alleen de streamer kan plek maken — laat het ze weten.',
        },
        {
          term: 'Ik ben sub, maar ik kom er niet in.',
          body: 'Controleer of je hetzelfde account hebt gekoppeld waarmee je geabonneerd bent. Kijk bij Twitch op de joinkaart bij **Your Twitch**. Typ bij Kick een verse code in hun chat: Anvil leest de sub-badge op dat bericht. Maak bij YouTube je abonnementen openbaar en controleer opnieuw.',
        },
        {
          term: 'Ik volgde op Kick, maar het zegt van niet.',
          body: 'Anvil ziet alleen volgers van nadat de streamer Kick koppelde. Ontvolg en volg opnieuw, en druk dan op **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Eén Twitch-account (of Kick, of YouTube) brengt één speler binnen. Iemand anders deed al mee met dit account.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube of Discord had een haperinkje. Wacht een minuut en druk opnieuw op **Join**.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'Dit ligt aan de streamer. Zeg dat ze hun kanaal opnieuw moeten koppelen op Anvil.',
        },
        {
          term: 'Mijn drops verschijnen niet.',
          body: 'Controleer of de plugin geïnstalleerd en ingelogd is, en of je met de character meedoet die je speelt. Zie de [pluginhandleiding]({pluginGuide}).',
        },
        {
          term: 'Waar vind ik meer events zoals dit?',
          body: '[De eventspagina](/events) toont events waaraan iedereen mee kan doen, ook events van streamers die nu open zijn.',
        },
        {
          term: 'Iets op de pagina van een streamer breekt de regels.',
          body: 'Druk op **Report** op de pagina, het event of de highlight. Kies wat er mis is en druk op **Send**. Het gaat alleen naar de staf van Anvil. De streamer hoort nooit wie het meldde.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — een openbare clan die Streaming aanzet.
  streamingClans: {
    metaTitle: 'De events van je clan streamen — Anvil',
    metaDescription:
      'Laat de kijkers van je stream meedoen aan een event van je clan zonder lid van de clan te worden: zet Streaming aan, open een event voor kijkers en kies welke kijkers binnenkomen.',
    eyebrow: 'Voor clans die streamen',
    title: 'Streamen voor clans',
    dek: 'Streamt je clan zijn events? Laat kijkers aan één event meedoen zonder lid van je clan te worden.',

    on: {
      title: 'Zet Streaming aan',
      body: [
        'Ga naar Admin → **Clan settings** → **Profile** en zet **Streaming** aan.',
        'Alleen een openbare clan kan streamen. Kijkers moeten je eventpagina kunnen openen, en een privéclan verbergt die. Een clan met Streaming aan kan niet privé worden totdat je het uitzet.',
        'Staat het aan, koppel dan direct eronder je Twitch-, YouTube- of Kick-kanaal.',
      ],
    },

    event: {
      title: 'Open een event voor kijkers',
      body: [
        'Elk event blijft **Members only** totdat je iets anders zegt. Zo werkte het ook al eerder.',
        'Open de **Settings** van het event → **Entry & co-hosts** → **Who can join?** en kies **Members and viewers**. Kies dan **Which viewers?**: iedereen, of volgers, subs, een Discord-rol enzovoort. Druk op **Save**.',
        'Deze controles gelden alleen voor kijkers. Je clanleden komen er, zoals eerder, altijd in.',
      ],
    },

    viewers: {
      title: 'Wat kijkers zijn',
      body: [
        'Een kijker die meedoet, is een **event player**. Die speelt alleen dat ene event.',
        'Het zijn geen clanleden en ook geen gasten. Ze komen nooit op je clanlijst te staan en krijgen geen rang.',
        'Alle mensen die zo zijn meegedaan, zie je onder **People** → **Past viewers**.',
        'Een vaste kijker die je wilt houden? **Make guest** op hun rij maakt er een clangast van, zodat ze mee kunnen doen aan elk van je events die voor gasten openstaan, niet alleen dit ene. **Make a guest a viewer again** maakt van een gast weer een kijker van één event.',
      ],
    },

    tools: {
      title: 'Je streamtools',
      body: [
        'De streamertools werken hetzelfde als in een creator-space: geverifieerde kanaallinks, **Who can join?**-controles, de OBS-overlay en `!join` in de chat.',
        'De overlaylinks voor een clanevent staan in de **Settings** van het event → **Stream** → **Stream overlay**. `!join` en het overlayteken staan onder **Clan settings** → **Profile** → **Streaming**.',
        'De [creatorgids]({creatorsGuide}) legt elk ervan stap voor stap uit.',
        'Stream-highlights werken hier ook: is Twitch of YouTube gekoppeld, dan clipt Anvil de grote momenten van events die open zijn voor kijkers. `!join` in de Kick-chat heeft een eigen schakelaar in het vak **Kick channel**.',
      ],
    },

    faq: {
      title: 'Vragen',
      intro: 'De korte antwoorden:',
      rows: [
        {
          term: 'Tellen kijkers mee voor onze ledenlimiet?',
          body: 'Nee. Het zijn eventspelers, geen leden. De streamerlimieten tellen spelers tegelijk in alle events die je organiseert (zie de [creatorgids]({creatorsGuide})).',
        },
        {
          term: 'Stuurt `!join` mensen naar een event alleen voor leden?',
          body: 'Nee. Het wijst alleen naar een event dat open is voor kijkers.',
        },
        {
          term: 'Moet ik in plaats daarvan een creator-space maken?',
          body: 'Alleen als je geen clan hebt. Een space is voor streamers zonder clan in het spel.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Je mensen: ledenlijst, gasten en wie mag joinen — Anvil',
    metaDescription:
      'Waar de ledenlijst van een Anvil-clan vandaan komt, wat Members, Guests, Roster only, Departed en Quiet betekenen, hoe joinverzoeken en Needs review werken, de drie instellingen onder Who can join, en iemand verwijderen of verbannen.',
    eyebrow: 'Anvil · voor clanstaf',
    title: 'Je mensen: ledenlijst, gasten en wie mag joinen',
    dek: 'Iedereen onder Admin → **People** is daar op een van vier manieren gekomen: de clanlijst in het spel noemde hem, de staf keurde hem goed, de clan laat iedereen toe, of iemand voegde hem met de hand toe. Zo werkt elke route, dit vertelt het Roster-tabblad je, en dit controleer je als iemand op de verkeerde plek staat.',
    facts: [
      { strong: 'Ledenlijst in het spel', rest: 'de enige automatische manier om lid te worden' },
      { strong: 'Inloggen', rest: 'zet nooit iemand op de ledenlijst' },
      { strong: 'Twee wachtrijen', rest: 'op twee verschillende tabbladen' },
    ],
    footnote:
      'Alles hier staat onder Admin → **People**. Roster en Needs review zijn werk voor moderators. **Who can join** en **Staff & roles** zijn tabbladen alleen voor admins. Wie wat mag in de hele adminomgeving staat in [Stafrollen: wie mag wat]({staffGuide}).',

    roster: {
      title: 'Waar de ledenlijst vandaan komt',
      body: [
        'De ledenlijst is jullie clanlijst uit het spel, gekopieerd naar de site. Een admin stuurt hem vanuit RuneLite met de Anvil-plugin: druk op de **Anvil**-knop in de titelbalk van het clanvenster, of op **Sync roster** in het zijpaneel van de plugin. Iedereen op de lijst komt binnen als **lid**, met zijn rang in het spel. Alleen iemand met de Admin-rol op de site kan hem sturen. Ieder ander krijgt dat in het spel te horen.',
        'Een synchronisatie is het enige dat iemand vanzelf lid maakt. Wie de clan in het spel verlaat, wordt bij de volgende synchronisatie als vertrokken gemarkeerd, en wie terugkomt, staat er bij de synchronisatie daarna weer op. Zijn geschiedenis blijft in beide gevallen bewaard.',
        'Elke andere plek is een **gast**plek: iemand die meedoet aan jullie events zonder in jullie clan in het spel te zitten. Gasten worden bijgehouden en kunnen aan events meedoen. Ze zijn geen lid en tellen niet mee voor jullie abonnement.',
      ],
      note: {
        tag: 'Inloggen zet nooit iemand op de ledenlijst',
        body: 'Inloggen met Discord, een character koppelen of spelen met de plugin geeft niemand een plek. Ziet de plugin iemand wiens clan in het spel de jouwe is maar die nog niet op de ledenlijst staat, dan vraagt hij hem aan (zie stap 3). Ieder ander heeft gewoon een Anvil-account zonder clan. Dat voorkomt dat een vreemde jullie clan binnenkomt door de naam in te tikken.',
      },
    },

    filters: {
      title: 'Het Roster-tabblad lezen',
      intro:
        'De balk bovenaan verdeelt de ledenlijst in **Members**, **Guests** en **Departed**. Klik op een deel om erop te filteren. De chips eronder maken de lijst verder kleiner:',
      rows: [
        {
          term: 'Active',
          body: 'leden die nog op de ledenlijst staan. Gasten en vertrokken mensen vallen erbuiten.',
        },
        {
          term: 'Quiet 7d+',
          body: 'leden die de plugin zeven dagen of langer niet heeft zien spelen. Wie de plugin nooit heeft gebruikt, staat hier niet in, want er is niets om hem op te beoordelen. Bij hem staat onder **Last played** dan **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'huidige gastplekken: mensen die meedoen aan jullie events maar niet in jullie clan in het spel zitten.',
        },
        {
          term: 'Roster only',
          body: 'huidige leden en gasten zonder siteaccount erachter. Normaal voor iedereen die nooit met Discord heeft ingelogd. Ze blijven op de ledenlijst; ze loggen in en koppelen het character zodra ze zich ergens voor willen inschrijven.',
        },
        {
          term: 'Departed',
          body: 'mensen die in het spel zijn vertrokken, of die de staf heeft verwijderd. Hun resultaten en geschiedenis blijven.',
        },
        {
          term: 'All',
          body: 'iedereen hierboven.',
        },
      ],
      outro:
        'De kolom **Source** zegt hoe elke plek begon: **Clan sync**, **Added manually** of **Applied or self-reported**. **Last played** komt van de plugin, niet van de synchronisatie van de ledenlijst.',
      note: {
        tag: 'Rang en rol zijn twee verschillende dingen',
        body: 'De twee keuzelijsten naast de chips filteren op rang in het spel en op rol op de site. De rang is wat het spel doorgeeft. De rol op de site stelt een admin in onder **Staff & roles**. Het een stelt nooit het ander in.',
      },
    },

    review: {
      title: 'Joinverzoeken en Needs review',
      intro: 'Twee soorten mensen wachten op een ja, en ze wachten op verschillende tabbladen.',
      rows: [
        {
          term: 'Asking to join',
          body: 'bovenaan het tabblad **Roster**, alleen zichtbaar zolang er iemand wacht. Een verzoek komt van de site (hij drukte op **Apply** op jullie clanpagina, of probeerde mee te doen aan een van jullie events) of van de plugin (die zag hem spelen in jullie clan in het spel voordat hij op de ledenlijst stond). Elke rij zegt welke van de twee, en of hij lid is van een andere clan. **Approve** geeft hem een gastplek. **Decline** laat het hem weten, via een Discord-DM als jullie bot hem kan bereiken. Vink er meerdere aan om ze in één keer te beantwoorden.',
        },
        {
          term: 'Awaiting confirmation',
          body: 'onder **Needs review**. Mensen die een character van jullie ledenlijst hebben gekoppeld door er XP op te halen, door het te vragen of door het met de plugin te spelen. Ze kunnen al spelen terwijl ze wachten. Controleer of de Discord-naam bij het character past en druk dan op **Approve**. **Not our member** haalt het character van jullie lijst en laat het bij de eigenaar. **Report to Anvil** is voor een character dat niet van hem is.',
        },
        {
          term: 'Claim requests',
          body: 'ook onder **Needs review**. Iemand speelde een character dat hier al een vast lid is, dus koppelt Anvil het niet vanzelf aan hem. Weet je dat hij het is, druk dan op **Yes, that’s them**; zo niet, **Not them**. Een character dat alleen ooit in jullie clan heeft gezeten, wordt meteen gekoppeld. Een character dat ook in een andere clan zit, gaat naar Anvil om over te beslissen.',
        },
      ],
      note: {
        tag: 'Het badge telt geen joinverzoeken',
        body: 'Het getal bij **Needs review**, en bij **People** in de zijbalk, telt Awaiting confirmation en Claim requests. Joinverzoeken zitten er niet in, dus kijk ook bovenaan het Roster-tabblad.',
      },
    },

    policy: {
      title: 'Wie mag joinen',
      intro:
        'Admin → People → **Who can join** heeft drie instellingen, en alleen admins zien het tabblad. Hoe buitenstaanders binnenkomen, bepaalt **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'de standaard. Wie zich aanmeldt, of wie de plugin oppikt uit jullie clan in het spel, wacht als joinverzoek tot de staf hem goedkeurt. Zonder ja krijgt niemand een plek.',
        },
        {
          term: 'Let anyone in',
          body: 'vragen is genoeg. Hij krijgt meteen een gastplek en er wordt geen verzoek aangemaakt. Goed voor een open event, anders onrustig.',
        },
        {
          term: 'No guests',
          body: 'alleen jullie eigen leden spelen. Spelers uit andere clans kunnen niet meedoen aan jullie events of vragen om te joinen, en de plugin maakt niets voor ze aan.',
        },
      ],
      outro:
        '**Who can see this clan** is **Anyone** (een bordlink werkt voor iedereen naar wie je hem stuurt) of **Members only** (de rest ziet de kaart van de clan en een uitnodiging om zich aan te melden). **List in the Clan Hall** zet de clan op de openbare lijst van clans. Uitzetten maakt de clan niet privé.',
      note: {
        tag: 'Niets hiervan raakt jullie leden',
        body: 'De synchronisatie van de ledenlijst geeft leden hun plek, wat hier ook staat. Jullie eigen staf wordt ook nooit als gast behandeld: het character van een staflid krijgt zonder verzoek een ledenplek.',
      },
    },

    manual: {
      title: 'Iemand met de hand toevoegen',
      body: [
        'Roster → **+ Add Manually** zet één character op de ledenlijst. Vul de **RSN** in, en eventueel **Discord ID** en **Rank**. Vink **Add as guest** aan voor iemand die niet in jullie clan in het spel zit. Moderators en admins kunnen dit allebei.',
        'Gebruik het voor iemand die de synchronisatie nog niet ziet, zoals een nieuwe rekruut die na de laatste synchronisatie is gejoind. De plek wordt gemarkeerd als **Added manually**, en de synchronisatie behandelt hem als jouw beslissing: verwijder je later een plek die je met de hand hebt toegevoegd, dan haalt de volgende synchronisatie hem niet terug.',
        'Iemand op de ledenlijst zetten schrijft hem niet in voor een event. Open daarvoor het tabblad **Sign-ups** van het event en gebruik **Add member**. Dat kunnen alleen admins.',
      ],
    },

    removing: {
      title: 'Verwijderen en verbannen',
      intro: 'Elke rij op de ledenlijst heeft een actiemenu. Deze doen verschillende dingen:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'hij blijft op de lijst en kan nog steeds voor events worden ingeschreven, maar telt niet meer als lid. **Promote to member** draait het terug.',
        },
        {
          term: 'Remove from roster',
          body: 'markeert hem als vertrokken. Zijn geschiedenis en resultaten blijven. Zit hij nog in jullie clan in het spel, dan kan de volgende synchronisatie hem weer toevoegen.',
        },
        {
          term: 'Not our member',
          body: 'onder Needs review, voor een gekoppeld character dat niet in jullie clan zit. Het gaat van jullie lijst en blijft bij de eigenaar.',
        },
        {
          term: 'Ban from this clan',
          body: 'beëindigt elke plek die de persoon hier heeft, alts meegerekend, haalt elke stafrol en elke bordtaak weg die hij in deze clan heeft, en houdt hem buiten: de synchronisatie, de plugin en joinverzoeken weigeren hem allemaal tot de ban is opgeheven. Zijn Anvil-account en zijn andere clans blijven onaangeroerd. Alleen admins, voor iemand met een siteaccount en een rol onder admin, via het rijmenu, via **Staff & roles**, of voor meerdere mensen tegelijk. Een ban opheffen zet hem niet terug; hij joint opnieuw in het spel, of jij voegt hem toe.',
        },
      ],
      note: {
        tag: 'Een ban haalt ook de stafrol weg',
        body: 'Een ban beëindigt iemands plekken en neemt zijn stafrol af, plus elke taak als bordredacteur of bordpenningmeester op de borden van deze clan. Een ban opheffen geeft die niet terug: zet de rol opnieuw onder Staff & roles als hij hem hoort te hebben.',
      },
    },

    faq: {
      title: 'Veelgestelde vragen',
      intro: 'Wat meestal verklaart waarom iemand op de verkeerde plek staat.',
      rows: [
        {
          term: 'Iemand uit de clan ontbreekt',
          body: 'Draai eerst een synchronisatie van de ledenlijst: de lijst verandert alleen als een admin hem stuurt. Kijk daarna bij **Departed**, voor het geval hij is verwijderd, en of hij verbannen is; de synchronisatie slaat iedereen over die hier verbannen is en meldt wie hij oversloeg. Zit de clan boven zijn abonnement en is de respijtperiode voorbij, dan voegt een synchronisatie geen nieuwe leden meer toe tot je upgradet of de ledenlijst inkort.',
        },
        {
          term: 'Iemand staat als gast maar zit in de clan',
          body: 'Meestal is hij op Anvil nog lid van een andere clan. Een character kan maar lid zijn van één clan tegelijk, dus de synchronisatie zet hem hier als gast en maakt hem lid bij de eerste synchronisatie nadat hij de andere clan heeft verlaten. Anders kwam hij binnen via een joinverzoek, of heeft iemand hem gedegradeerd of als gast toegevoegd. Draai een synchronisatie, of gebruik **Promote to member**.',
        },
        {
          term: 'Iemand heeft ingelogd maar staat niet op de ledenlijst',
          body: 'Dat klopt. Inloggen maakt een Anvil-account aan, geen plek. Hij verschijnt als de synchronisatie hem noemt, als je zijn verzoek goedkeurt, of als je hem met de hand toevoegt.',
        },
        {
          term: 'Namen zoals #Player1234',
          body: 'RuneLite toont zo’n plaatshouder heel even terwijl een speler inlogt, en voor clanleden die het geen naam kan geven. Anvil negeert die namen nu: de synchronisatie slaat ze over, de plugin maakt er geen verzoek voor aan, en oude verzoeken onder zo’n naam zijn verborgen. Staat er nog een op je ledenlijst, dan is het een oude rij. **Remove from roster** ruimt hem op.',
        },
        {
          term: 'Een verwijderd lid blijft terugkomen',
          body: 'Iemand verwijderen verandert niets aan de clan in het spel, dus de volgende synchronisatie voegt hem weer toe zolang het spel hem nog noemt. Verwijder hem in het spel, of verban hem hier.',
        },
        {
          term: 'Een moderator ziet Who can join niet',
          body: 'Dat is een tabblad alleen voor admins, net als Staff & roles. Zie [Stafrollen: wie mag wat]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Stafrollen: wie mag wat — Anvil',
    metaDescription:
      'De clanrollen op Anvil (eigenaar, admin, penningmeester, moderator, lid), waar elke rol bij kan, hoe je iemand moderator maakt, wie welke rol mag geven, en de taken voor één event.',
    eyebrow: 'Anvil · voor eigenaars en admins',
    title: 'Stafrollen: wie mag wat',
    dek: 'Vijf rollen, per clan ingesteld onder Admin → People → **Staff & roles**. Een rol hier geeft niets in een andere clan, en niemand kan een rol geven die gelijk aan of hoger dan zijn eigen rol is. Deze pagina is de hele kaart: waar elke rol bij kan, hoe je er een geeft, en de taken voor één event.',
    facts: [
      { strong: 'Per clan', rest: 'een rol hier betekent elders niets' },
      { strong: 'Onder je eigen rol', rest: 'is alles wat je kunt geven' },
      { strong: 'Eigenaar', rest: 'wisselt alleen via een overdracht' },
    ],
    footnote:
      'Rollen worden bij elke paginaweergave opnieuw gecontroleerd, dus een wijziging geldt bij de volgende klik van die persoon; uitloggen hoeft niet. Voor de ledenlijst zelf, zie [Je mensen]({peopleGuide}). Voor de dag van een moderator, zie [Aan de beurt]({moderatorGuide}).',

    roles: {
      title: 'De rollen',
      intro: 'Iedereen die met Discord inlogt, begint als gewoon **Member**. Daarboven:',
      rows: [
        {
          term: 'Eigenaar',
          body: 'degene die de clan heeft aangemaakt, tot hij hem doorgeeft. Alles wat een admin kan, plus het eigendom overdragen en de clan verwijderen. Er is er precies één, en niemand kan hem degraderen, verwijderen of verbannen.',
        },
        {
          term: 'Admin',
          body: 'alles behalve de clan overdragen: events en borden, instellingen, Discord, staf en het geld van de clan.',
        },
        {
          term: 'Penningmeester',
          body: 'inleg, de kas en prijzen, bovenop alles wat een moderator doet: de ledenlijst, bewijs, competities, de Schedule en Needs review.',
        },
        {
          term: 'Moderator',
          body: 'nieuwkomers, de ledenlijst, bewijs, weekcompetities en clanactiviteiten. Geen events of borden, geen instellingen, geen staf en geen geld.',
        },
        {
          term: 'Lid',
          body: 'geen stafwerk. Speelt, schrijft zich in, en kan een donatie aan de kas melden.',
        },
      ],
      outro:
        'Onder de rol op Staff & roles staan twee vakjes, voor iedereen onder admin, gewone leden inbegrepen. **Can build bingo boards** opent het Tiles-tabblad van elk bord en de Task library. **Can write guides** laat ze de handleidingen van de clan schrijven. Admins hebben ze allebei al.',
    },

    assign: {
      title: 'Iemand moderator maken',
      intro:
        'Hij moet met Discord hebben ingelogd en een character hebben gekoppeld dat op jullie ledenlijst staat, als lid of als gast. Dan:',
      steps: [
        'Open Admin → **People** → **Staff & roles**.',
        'De lijst opent op **Staff**. Schakel naar **Members** of **All accounts** en zoek op zijn naam.',
        'Kies in de kolom **Role** voor **Moderator: newcomers, roster, sign-ups, proofs**. Het wordt meteen opgeslagen als je kiest.',
        'Moet hij ook borden bouwen, vink dan **Can build bingo boards** aan.',
      ],
      outro:
        'Nog niet ingelogd? Zoek zijn character op het tabblad **Roster**, open het menu en kies **Set role**. Dat slaat de rol op bij het character. Hij krijgt hem de eerste keer dat hij inlogt en het koppelt, of, als hij bij Needs review wacht, zodra een moderator hem goedkeurt.',
      note: {
        tag: 'Het weer afnemen',
        body: 'Zet de rol terug op **Member**. Iemands rol wijzigen haalt ook alle bordtaken weg die hij op de borden van deze clan had (zie stap 5), dus voeg die daarna opnieuw toe als hij ze moet houden.',
      },
    },

    who: {
      title: 'Wie wat mag geven',
      intro:
        'Staff & roles is een tabblad alleen voor admins, en elke wijziging daar wordt aan twee regels getoetst: je kunt alleen een rol geven die lager is dan je eigen rol, en je kunt alleen iemand wijzigen wiens rol lager is dan de jouwe.',
      rows: [
        {
          term: 'De eigenaar',
          body: 'kan admin, penningmeester en moderator geven of afnemen.',
        },
        {
          term: 'Een admin',
          body: 'kan penningmeester en moderator geven of afnemen. Een admin kan geen andere admin aanstellen, geen andere admin wijzigen en zijn eigen rol niet wijzigen.',
        },
        {
          term: 'Penningmeesters en moderators',
          body: 'kunnen niemands rol wijzigen. Het tabblad is voor hen verborgen.',
        },
        {
          term: 'Niemand',
          body: 'kan de rol van de eigenaar wijzigen, hem verwijderen of verbannen. De clan houdt ook altijd één admin: de laatste kan niet worden gedegradeerd.',
        },
      ],
      note: {
        tag: 'De clan overdragen',
        body: 'Alleen de eigenaar kan dat, en alleen aan iemand die al admin is: de rij van die admin krijgt een actie **Make owner**. Voor de veiligheid duurt het 3 dagen, zoals het wijzigen van een bankpincode: een banner op elke adminpagina zegt wanneer het gebeurt, tot dan kun jij het met **Cancel** annuleren, kan de ander het met **Decline** weigeren, en het Anvil-team krijgt bericht en kan het tegenhouden. Na de 3 dagen wordt hij eigenaar en word jij een gewone admin. Alleen de nieuwe eigenaar kan het terug overdragen.',
      },
    },

    table: {
      title: 'Wie mag wat',
      intro:
        'Waar elke rol bij kan in de adminomgeving. “Indien aangevinkt” betekent het vakje **Can build bingo boards** of **Can write guides** op Staff & roles.',
      areaLabel: 'Onderdeel',
      columns: ['Eigenaar', 'Admin', 'Penningmeester', 'Moderator', 'Lid'],
      rows: [
        { area: 'Dashboard', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'Events: aanmaken, bewerken, teams, inschrijvingen, starten', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Bordvakjes en de Task library', cells: ['Ja', 'Ja', 'Indien aangevinkt', 'Indien aangevinkt', 'Indien aangevinkt'] },
        { area: 'Bewijs om te controleren', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'Weekcompetities', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'Clanactiviteiten', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'Schedule', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'Ledenlijst: bekijken, toevoegen, verwijderen', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'Joinverzoeken en Needs review', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'Iemand uit de clan verbannen', cells: ['Ja', 'Onder admin', 'Nee', 'Nee', 'Nee'] },
        { area: 'Staff & roles', cells: ['Ja', 'Onder admin', 'Nee', 'Nee', 'Nee'] },
        { area: 'Who can join', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Kas en prijsladders', cells: ['Ja', 'Ja', 'Ja', 'Nee', 'Nee'] },
        { area: 'Inleg: als geïnd markeren', cells: ['Ja', 'Ja', 'Ja', 'Nee', 'Nee'] },
        { area: 'Inleg: bevestigen (de tweede handtekening)', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Discord-instellingen', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Posten op Discord', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Claninstellingen: Profile, Features, Rules & scoring, Boosts', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Abonnement en facturatie', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Handleidingen', cells: ['Schrijven', 'Schrijven', 'Lezen; schrijven indien aangevinkt', 'Lezen; schrijven indien aangevinkt', 'Schrijven indien aangevinkt'] },
        { area: 'Activiteitenlog', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nee'] },
        { area: 'De ledenlijst synchroniseren vanuit RuneLite', cells: ['Ja', 'Ja', 'Nee', 'Nee', 'Nee'] },
        { area: 'Eigendom overdragen, de clan verwijderen', cells: ['Ja', 'Nee', 'Nee', 'Nee', 'Nee'] },
      ],
      note: {
        tag: 'Verborgen is niet hetzelfde als toegestaan',
        body: 'De zijbalk toont alleen wat jouw rol kan gebruiken, maar de controle die telt draait op de server. Tik je het adres in van een pagina die jouw rol niet mag gebruiken, dan word je teruggestuurd naar het dashboard, en de actie erachter wordt geweigerd.',
      },
    },

    event: {
      title: 'Taken voor één event',
      intro:
        'Sommige taken gelden voor één event in plaats van voor de clan. Een admin geeft ze op het event zelf, en ze reiken tot dat event en niets anders, dus je kunt ze gerust aan een gewoon lid geven.',
      rows: [
        {
          term: 'Bordredacteur',
          body: 'bouwt en bewerkt de vakjes van dat bord. Gegeven onder **Settings** → **Staff** → **Board staff** van het event, of met **Boards…** in de acties van een persoon op Staff & roles. Een lid met deze taak ziet in de adminomgeving alleen zijn eigen borden.',
        },
        {
          term: 'Bordpenningmeester',
          body: 'int de inleg van dat bord en regelt de uitbetalingen, zonder bij de kas van de clan te kunnen. In de adminomgeving ziet hij alleen zijn eigen borden, en van elk bord alleen de tabbladen **Sign-ups** en **Prizes**. Ook gegeven onder **Board staff**.',
        },
        {
          term: 'Team staff',
          body: 'runt één team: de opstelling, de inzendingen en het bewijs, en het als betaald markeren van de inleg van de spelers. Ze kunnen geen ander team aanraken, het bord niet bewerken, geen draftpicks doen en niemand wisselen zodra het event live is. Toegevoegd op de teampagina onder **Team staff**. Zo runt de moderator van een bezoekende clan zijn helft van een clan-tegen-clan.',
        },
        {
          term: 'Captain',
          body: 'door de organisator aangewezen voor één team. Alles wat team staff kan, plus de draftpicks van het team doen.',
        },
      ],
      note: {
        tag: 'Een clanrol vervangt bordtaken',
        body: 'Iemand een clanrol geven, of die wijzigen, haalt zijn taken als bordredacteur en bordpenningmeester op de borden van deze clan weg. Staff & roles waarschuwt je eerst als bordtaken alles zijn wat hij heeft. Voeg ze daarna opnieuw toe als hij ze moet houden.',
      },
    },

    safety: {
      title: 'Zo blijft het veilig',
      intro: 'Dit geldt hoe de rollen ook zijn ingesteld.',
      rows: [
        {
          term: 'De eigenaar is beschermd',
          body: 'zijn rij op Staff & roles toont **Protected**. Zijn rol kan niet worden gewijzigd en hij kan niet worden verbannen. Het eigendom wisselt alleen als hij het overdraagt.',
        },
        {
          term: 'Admins kunnen elkaar niet verwijderen',
          body: 'een admin kan een andere admin niet degraderen en niet verbannen, niet één tegelijk en niet meerdere tegelijk. Zijn twee admins het oneens, dan beslist de eigenaar. Een ban neemt de persoon ook zijn stafrol en bordtaken in deze clan af.',
        },
        {
          term: 'Geld vraagt om twee mensen',
          body: 'moet inleg worden bevestigd, dan moet die bevestiging komen van een andere admin dan degene die hem als geïnd markeerde. Hoeveel bevestigingen inleg nodig heeft, van nul tot vijf, stel je in onder **Clan settings** → **Rules & scoring** → **Fee sign-off**. Een admin die als enige met geld werkt, kan inleg toch afsluiten, met een aparte knop.',
        },
        {
          term: 'Wat een moderator niet kan',
          body: 'events aanmaken of bewerken, instellingen of Discord wijzigen, iemand een rol geven (zichzelf inbegrepen) of aan het geld van de clan komen.',
        },
        {
          term: 'Alles wordt vastgelegd',
          body: 'rolwijzigingen, eigendomsoverdrachten, bans en beantwoorde joinverzoeken worden geschreven naar het **Activity log**, dat elk staflid kan lezen.',
        },
        {
          term: 'Discord-rollen staan los hiervan',
          body: 'de rolsynchronisatie van Anvil koppelt Discord-rollen aan **rangen in het spel**, niet aan rollen op de site. Iemand hier moderator maken geeft hem niets in jullie Discord-server, en een moderatorrol die je in Discord met de hand hebt gegeven, blijft ongemoeid. Het ene botcommando dat iets verandert, iets aan de kas toevoegen met `/coffer`, controleert de rol op de site: penningmeester, admin of eigenaar.',
        },
      ],
    },
    log: {
      title: 'Het activiteitenlogboek',
      body: [
        '**Activity log** in het admin-menu toont de nieuwste 200 wijzigingen, en elk stafflid kan het lezen: aanmeldingen, vertrekken, hernoemingen en verificaties, eigendomsoverdrachten, aangewezen en ingetrokken captains, aanmeldingen goedgekeurd of afgewezen, kosten bevestigd, functies aan- of uitgezet en instellingen gewijzigd. **Filter by event type** beperkt het overzicht.',
        'Hier worden ook dubbelen opgeruimd. **Merge two members** voegt een dubbel toe aan het echte lid, en **Suspected renames** toont naamswijzigingen die Anvil voor je heeft gezien, om te bevestigen of af te wijzen.',
      ],
    },
  },

  supporter: {
    metaTitle: 'Anvil Supporter: niveaus en voordelen — Anvil',
    metaDescription:
      'Wat Anvil Supporter, Champion en Patron elk krijgen: naamkleuren en de ster, gouden GZ, geanimeerde avatar en banner, de vitrine, vriendenevents, head-to-head, eventchat en clanboosts. Hoe betalen via Gumroad werkt en wat er gebeurt als je opzegt.',
    eyebrow: 'Anvil · voor spelers',
    title: 'Anvil Supporter: niveaus en voordelen',
    dek: 'Anvil Supporter is een persoonlijk abonnement dat de servers van Anvil betaalt. Er zijn drie niveaus, en elk heeft alles wat het niveau eronder heeft. Elk voordeel is uiterlijk of meer ruimte om te organiseren: tracking, events, scores en je eigen statistieken blijven voor iedereen gratis, en niets hier verandert wat een event telt.',
    facts: [
      { strong: 'Vanaf $1 per maand', rest: 'of $10 per jaar' },
      { strong: 'Alleen uiterlijk', rest: 'nooit een score, een rang of een item' },
      { strong: 'Niets verwijderd', rest: 'als je stopt' },
    ],
    footnote:
      'Alles hier stel je op de website in onder **Settings** → **Supporter**, **Profile look** en **Clan boosts**. Boosts in detail staan in [Een clan boosten]({boostsGuide}). Waar je kleuren in RuneLite verschijnen, staat in [Het zijpaneel, tabblad voor tabblad]({panelGuide}).',

    tiers: {
      title: 'De drie niveaus',
      intro: 'De prijzen staan op de pagina **Anvil Supporter**, `/supporter`. Een jaarplan kost tien maanden.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 per maand of $10 per jaar. Een gouden naam en een ster, een gouden GZ, een vitrine met 4 plekken, en je kunt een vriendenevent organiseren.',
        },
        {
          term: 'Champion',
          body: '$2 per maand of $20 per jaar. Een naam met een kleurverloop uit onze voorinstellingen (of één eigen kleur), je eigen avatar en banner (geanimeerd als je wilt), 8 vitrineplekken, snellere eventchat en 1 clanboost.',
        },
        {
          term: 'Patron',
          body: '$5 per maand of $50 per jaar. Je eigen kleurverloop van maximaal 4 kleuren, dat beweegt, 12 vitrineplekken, geen wachttijd in eventchat, 2 vriendenevents tegelijk en 2 clanboosts.',
        },
      ],
      note: {
        tag: 'Tijd via uitnodigingen',
        body: 'Onder Settings → Supporter krijg je een uitnodigingslink. Betaalt een vriend die je hebt uitgenodigd, dan verdien je gratis maanden; de beloning komt twee weken na zijn eerste betaling. Zo verdiende tijd geeft elk voordeel van dat niveau behalve clanboosts.',
      },
    },

    compare: {
      title: 'Wat elk niveau krijgt',
      intro: 'Dezelfde tabel als op de Supporter-pagina, plus de chatvoordelen.',
      table: {
        areaLabel: 'Voordeel',
        columns: ['Gratis', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Naamkleuren', cells: ['—', 'Goud', 'Presets of één eigen kleur', 'Presets of tot vier kleuren, bewegend'] },
          { area: 'Ster bij je naam', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Gouden GZ', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Eigen avatar en banner, geanimeerd', cells: ['—', '—', 'Ja', 'Ja'] },
          { area: 'Vitrine', cells: ['—', '4 plekken', '8 plekken', '12 plekken'] },
          { area: 'Vriendenevents (tegelijk · spelers)', cells: ['Alleen meedoen', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Head-to-head-uitdagingen', cells: ['1 actief', '5 actief', 'Onbeperkt', 'Onbeperkt'] },
          { area: 'Eventchat: wachten tussen regels', cells: ['5 s', '3 s', '1 s', 'Geen'] },
          { area: 'Clanboosts', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Onder **Settings** → **In-game chat** staan er nog drie: eigen kleuren voor je chatfeed (Supporter), kiezen wat je loginoverzicht behandelt (Champion), en een ster bij je naam in de chatfeeds van andere spelers (Patron).',
    },

    names: {
      title: 'Naamkleuren',
      intro:
        'Je stelt ze in onder **Settings** → **Supporter**, bij **Your name’s look**. De preview toont je naam op een donkere en op een lichte achtergrond.',
      rows: [
        {
          term: 'Supporter',
          body: 'effen goud. Er valt niets te kiezen.',
        },
        {
          term: 'Champion',
          body: 'een van de vaste kleurverlopen (**Classic**, de standaard, **Ember**, **Ocean**, **Aurora**, **Rose gold** of **Toxic**), of **Your own**: één vaste kleur. Over al je characters samen kun je hoogstens twee verschillende eigen kleuren gebruiken.',
        },
        {
          term: 'Patron',
          body: 'elke preset plus **Prism**, de standaard voor Patrons, of **Your own** met één tot vier kleuren. Eén kleur staat stil; twee tot vier vormen een kleurverloop dat van links naar rechts beweegt.',
        },
      ],
      outro:
        '**Your Anvil display name** is de naam op je aan Discord gekoppelde account. Kies onder **Your RuneScape characters** **Same for all** of **Customize each** om elk character een eigen uiterlijk te geven. Druk op **Save** (of **Save for all characters**); **Reset to default** gaat terug naar de kleuren van je niveau.',
      note: {
        tag: 'Donkere en lichte achtergronden',
        body: 'De site, het pluginpaneel en Discord zijn donker; de effen chatbox van het spel is licht. Anvil past je kleuren aan zodat ze op allebei leesbaar blijven. Wil je op een ervan een ander uiterlijk, zet dan **Set a separate look for dark backgrounds** of **for light backgrounds** aan. Dat uiterlijk wordt precies getoond zoals je het koos, zonder contrastcorrectie, en de preview waarschuwt je als het slecht leesbaar is.',
      },
    },

    where: {
      title: 'Waar je flair te zien is',
      intro: 'Je kleuren en de ster gaan overal mee waar je naam staat:',
      rows: [
        {
          term: 'Op de site',
          body: 'borden, ledenlijsten, profielen, je eigen naam in de bovenbalk en de namen van je characters. De ster draagt je kleuren.',
        },
        {
          term: 'In het pluginpaneel',
          body: 'de Feed, eventchat, kaarten en de **Tracking**-regel. Het kleurverloop van een Patron schuift; elke speler kan dat stoppen met **Animated names**.',
        },
        {
          term: 'In het spel',
          body: 'voor andere spelers die de Anvil-plugin gebruiken: openbare, clan-, vrienden- en privéchat, clanbroadcasts, loginmeldingen, vrienden- en clanlijsten, en het rechtsklikmenu (nooit op PvP-werelden of in de Wilderness). In de spelchat is de ster alleen voor Patrons.',
        },
        {
          term: 'In Discord',
          body: 'een ster naast je naam in de posts van Anvil, in je eigen kleuren als je die gekozen hebt.',
        },
        {
          term: 'Gouden GZ',
          body: 'bij een drop van een clangenoot in de feed van je clan op de site kan je GZ goud zijn. Alleen Supporters kunnen er een geven.',
        },
      ],
      note: {
        tag: 'Alleen op characters waarvan bewezen is dat ze van jou zijn',
        body: 'Kleuren verschijnen alleen op characters waarvan de plugin heeft bevestigd dat ze van jou zijn, op de site en in het spel. Wil je ze niet op je namen in de spelchat van anderen, vink dan **Show my colours on my characters’ names in game chat** uit onder Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banner en vitrine',
      intro: 'Alle drie staan onder **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar & banner',
          body: 'Champion en Patron. Upload je eigen; een GIF of WebP blijft geanimeerd. Ze verschijnen op je kaart, je profiel en elk van je characters, op de site en in de plugin. Een banner mag tot 6 MB zijn en minstens 600×150; een avatar tot 2 MB.',
        },
        {
          term: 'Per character',
          body: 'geef één character een eigen banner of avatar, of allebei. Die vervangt je standaard alleen op de pagina’s en de pluginkaart van dat character.',
        },
        {
          term: 'Vitrine',
          body: 'je beste drops, killcounts en tijden, vastgepind op je profiel: 4 plekken voor Supporter, 8 voor Champion, 12 voor Patron. Pins van characters die je niet deelt, blijven privé.',
        },
      ],
    },

    hosting: {
      title: 'Vriendenevents, head-to-head en chat',
      intro: 'De voordelen die je meer ruimte geven om te spelen, in plaats van een uiterlijk:',
      rows: [
        {
          term: 'Vriendenevents',
          body: 'organiseer je eigen bingo, solobingo of race voor vrienden via **Host an event for your friends**, door de plugin bijgehouden zoals een clanevent. Vrienden doen mee via je uitnodigingslink. Supporter: 1 lopend event, 10 spelers. Champion: 1 event, 25 spelers. Patron: 2 tegelijk, samen 50 spelers. Iedereen kan meedoen.',
        },
        {
          term: 'Head-to-head',
          body: 'daag een vriend uit vanaf zijn profiel: wie het eerst een drop heeft, of de meeste kills of XP in 1 uur, 24 uur of 7 dagen. Alleen om op te scheppen. Gratis spelers kunnen er 1 tegelijk open hebben, Supporters 5, Champions en Patrons zoveel als ze willen.',
        },
        {
          term: 'Eventchat',
          body: 'hoe lang je tussen regels wacht: 5 seconden zonder niveau, 3 voor Supporters, 1 voor Champions, geen voor Patrons. Wordt de chat van een bord druk, dan wacht iedereen 10 seconden, Patrons ook.',
        },
        {
          term: 'Clanboosts',
          body: 'Champion 1, Patron 2, zolang je betaalt. Zie [Een clan boosten]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Betalen, wisselen en opzeggen',
      intro: 'Anvil Supporter wordt via Gumroad gefactureerd, per maand of per jaar.',
      steps: [
        'Log in op Anvil en open `/supporter`.',
        'Druk op **Choose Supporter**, **Choose Champion** of **Choose Patron**. De kassa van Gumroad opent, met betalen per maand of per jaar.',
        'Betaal. Je voordelen gaan aan zodra Gumroad het aan Anvil doorgeeft, en je niveau staat op de Supporter-pagina als **Your tier**.',
      ],
      outro:
        'Wissel van niveau met **Change tier** onder Settings → Supporter. Opzeggen of je kaart bijwerken doe je daar met **Manage on Gumroad**. Een opgezegd lidmaatschap houdt elk voordeel tot het einde van de periode waarvoor je betaald hebt.',
      note: {
        tag: 'Begin altijd bij /supporter',
        body: 'De **Choose**-knop draagt een code die Anvil vertelt welk account betaald heeft. Anvil koppelt een betaling nooit op e-mailadres, dus wie rechtstreeks bij Gumroad koopt, zonder die knop, blijft met een ongekoppelde betaling zitten. Is dat gebeurd, vraag het dan in de Anvil-Discord, dan kan de staf hem met de hand aan je account koppelen.',
      },
    },

    lapse: {
      title: 'Omlaag gaan of stoppen',
      intro:
        'Niets wat je hebt ingesteld wordt verwijderd. Elk voordeel wordt getoetst aan het niveau dat je nu hebt, dus het gaat vanzelf uit en komt terug zodra je verlengt.',
      rows: [
        {
          term: 'Naamkleuren',
          body: 'je opgeslagen keuze blijft bewaard. Je draagt de kleuren van je nieuwe niveau, of geen, tot er weer een niveau is dat het toestaat.',
        },
        {
          term: 'Avatar & banner',
          body: 'onder Champion tonen ze hun stilstaande eerste beeld in plaats van te bewegen.',
        },
        {
          term: 'Vitrine',
          body: 'toont de eerste pins die je niveau toestaat en verbergt de rest. Zonder niveau is hij verborgen; de pins wachten op je.',
        },
        {
          term: 'Clanboosts',
          body: 'je oudste boosts blijven meetellen en de rest wordt gepauzeerd, niet verwijderd.',
        },
      ],
      note: {
        tag: 'Een tijdelijke upgrade van de Anvil-staf',
        body: 'De staf kan iemand een tijdje een hoger niveau geven, bijvoorbeeld als bedankje. Dat komt bovenop wat je betaalt en verandert nooit je abonnement. Settings → Supporter toont **A gift from Anvil** en wanneer het afloopt; daarna zit je weer op je betaalde niveau. Een cadeau geeft alleen clanboostplekken als de staf die erbij doet.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Het Anvil-zijpaneel, tabblad voor tabblad — Anvil',
    metaDescription:
      'Wat elk tabblad van het Anvil-zijpaneel in RuneLite toont (Clan, Feed, You, Lookup en het tandwiel), hoe eventchat en Feed-reacties werken, en de plugininstellingen voor de feed in de spelchat, Supporter-kleuren en geanimeerde namen.',
    eyebrow: 'Anvil · voor spelers',
    title: 'Het zijpaneel, tabblad voor tabblad',
    dek: 'De Anvil-knop in de zijbalk van RuneLite opent een paneel met vier tabbladen en een tandwiel: **Clan**, **Feed**, **You**, **Lookup** en ⚙. Het meeste wat het toont komt van de site, dus het blijft actueel zonder plugin-update. Een paar dingen hieronder zijn gemarkeerd als komend in de volgende plugin-update.',
    facts: [
      { strong: 'Vier tabbladen', rest: 'en een tandwiel voor synchroniseren en instellingen' },
      { strong: 'Eventchat', rest: 'in het Feed-tabblad' },
      { strong: 'GZ, Sad, Sit', rest: 'op Feed-regels' },
    ],
    footnote:
      'De plugin installeren en inloggen staat in [RuneLite-plugin instellen]({pluginGuide}). Supporter-kleuren, de ster en de chatvoordelen worden uitgelegd in [Anvil Supporter: niveaus en voordelen]({supporterGuide}).',

    header: {
      title: 'Bovenaan het paneel',
      intro: 'Boven de tabbladen staan de titel, **Refresh** en de accountregel.',
      rows: [
        {
          term: 'Refresh',
          body: 'laadt het paneel opnieuw, het Feed-tabblad inbegrepen. Terwijl het bezig is staat er **Refreshing…**. In de volgende plugin-update laadt het ook You en Lookup opnieuw, zodat een nieuwe avatar of banner meteen verschijnt, en maakt het het Feed-tabblad niet meer leeg.',
        },
        {
          term: 'Tracking',
          body: 'de regel onder de titel noemt het character dat gevolgd wordt, in zijn Supporter-kleuren als het die heeft. **Not my account…** stopt het volgen van een character dat iemand anders op deze computer speelt; **Track again** maakt dat ongedaan.',
        },
        {
          term: 'Het accountmenu',
          body: 'de ⋯-link opent **View my profile on Anvil**, **Not my account…** en **Sign out…**. In de volgende plugin-update staat er ook **Become a Supporter** in, of **Your Supporter perks** als je er al een bent.',
        },
        {
          term: 'Seizoensvoortgang',
          body: 'in de volgende plugin-update staat er op Leagues-, Deadman- en andere seizoenswerelden een regel **Sharing season progress · Turn off**. Die stuurt je relics, gebieden en taken (met een screenshot) naar je clan; je clan kiest op de website wat er gepost wordt. **Turn on** deelt het weer. Dezelfde schakelaar is **Share seasonal activity** in de plugininstellingen.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Je events en je clan. In de space van een creator heet het tabblad **Space**.',
      rows: [
        {
          term: 'De clankeuzelijst',
          body: 'verschijnt als je in meer dan één clan of space speelt. **All clans** (de standaard) toont alles waarin je speelt, lopend event eerst. Kies je één clan, dan beperkt het paneel zich daartoe en gaan je inzendingen daarheen.',
        },
        {
          term: 'Events',
          body: 'elk lopend en komend bord, Skill of Boss of the Week en clanevent, met waar je staat. Daarna **Your other boards**, **Also live** en **Your clan**.',
        },
        {
          term: 'Een bord',
          body: 'open er een voor de stand, teams, missies, recente activiteit, de dichtstbijzijnde tiles en **View all tiles**. De knoppen **Feed** en **Chat** openen dat bord in het Feed-tabblad.',
        },
        {
          term: 'Een clanevent',
          body: '**I’m going**, **Sign me up** of **Answer the survey**, afhankelijk van het event.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'De grote momenten van je clan en je borden, live: drops, pets, prestaties, quests, doden en voltooide tiles.',
      rows: [
        {
          term: 'Wiens feed',
          body: 'de keuzelijst bovenaan toont **Clan ·** voor elke clan waarvan je lid bent en **Event ·** voor elk lopend bord waarop je zit. Hij opent op je bord als je er een hebt, anders op je clan.',
        },
        {
          term: 'Filters',
          body: '**All**, **Tiles** (alleen borden), **Drops**, **Pets**, **Achievements**, **Deaths**, en **My team** op een bord waar je in een team zit. Een clanfeed heeft ook een knop voor spelmodusactiviteit, voor Leagues en andere modi.',
        },
        {
          term: 'Nieuwe regels',
          body: 'komen vanzelf binnen. Ben je weggescrold, dan brengt een **↑ N new**-pil je er weer naartoe.',
        },
      ],
      note: {
        tag: 'Niet hetzelfde als de chatfeed in het spel',
        body: 'Het Feed-tabblad werkt wat je plugininstellingen ook zeggen. **Show feed in game chat** (stap 8) is de aparte instelling die hem ook in je chatbox zet.',
      },
    },

    reactions: {
      title: 'Reacties',
      intro: 'Elke regel in de Feed heeft zijn reactie eronder:',
      rows: [
        {
          term: 'GZ',
          body: 'bij drops, pets en prestaties. Het aantal staat ernaast, zoals **GZ 3**.',
        },
        {
          term: 'Sad en Sit',
          body: 'bij doden, in plaats van GZ. Sit is de manier van het spel om iemand die doodging te zeggen dat hij moet gaan zitten.',
        },
        {
          term: 'Wie kan reageren',
          body: 'in een clanfeed de clangenoten. Op een bord de spelers erop en de staf van de organisator; als een bord zijn stand verbergt, kunnen spelers alleen op de regels van hun eigen team reageren.',
        },
        {
          term: 'Wie reageerde',
          body: 'beweeg over een reactie om namen te zien, zoals “GZ · Mossy and 3 others”. Klik er nog eens op om de jouwe terug te nemen.',
        },
      ],
      note: {
        tag: 'In de volgende plugin-update',
        body: 'Reacties worden pilknoppen, gekleurd als er een van jou is, en de reacties van anderen werken live bij voor iedereen die kijkt, ook op je andere open clients. Nu verandert het aantal als jij reageert of als de Feed opnieuw laadt. Gouden GZ, de Supporter-reactie, wordt gegeven in de feeds op de website; het Feed-tabblad heeft GZ, Sad en Sit.',
      },
    },

    chat: {
      title: 'Eventchat',
      intro:
        'Een bord waarop chat aanstaat heeft bovenaan het Feed-tabblad een schakelaar **Feed / Chat**, voor de spelers op dat bord en de staf van de organisator. De bordpagina in het Clan-tabblad heeft ook een **Chat**-knop.',
      rows: [
        {
          term: 'Iedereen of je team',
          body: '**All** schrijft naar het hele bord, **My team** alleen naar je team (die regels zijn gemarkeerd met **TEAM**). De staf ziet ook **Host & mods**, en hun regels zijn gemarkeerd met **HOST** of **MOD**.',
        },
        {
          term: 'Versturen',
          body: 'typ in het vak en druk op Enter. Regels zijn tot 200 tekens, en alleen de organisator en mods kunnen links plaatsen.',
        },
        {
          term: 'Hoe vaak',
          body: 'de wachttijd tussen je regels volgt je Supporter-niveau: 5 seconden zonder niveau, 3 voor Supporters, 1 voor Champions, geen voor Patrons. De regel onder het vak zegt wat de jouwe is. De staf wacht nooit.',
        },
        {
          term: 'Slow mode',
          body: 'wordt de chat van een bord heel druk, dan wacht iedereen een minuut lang minstens 10 seconden, Patrons ook. Niemand kan meer dan 10 regels in 10 seconden versturen.',
        },
        {
          term: 'Moderatie',
          body: 'de organisator en mods kunnen met rechts op een regel klikken voor **Delete message**, of voor **Mute** om iemand het zwijgen op te leggen, en de hele chat pauzeren met **Pause chat**.',
        },
      ],
      outro:
        'Een reeks regels van één persoon deelt één naam en tijd, tot er 5 minuten tussen zitten. Chat wordt bewaard tot 7 dagen na het einde van het event.',
    },

    you: {
      title: 'You en Lookup',
      intro: 'Twee tabbladen voor spelerskaarten: die van jou en die van iedereen anders.',
      rows: [
        {
          term: 'You',
          body: 'je eigen kaart voor het character waarmee je bent ingelogd: banner en avatar, **Display case**, collection log tot op de items van elke pagina, en **Skills**, **Bosses**, **Clues**, **Times** en **CAs**. Daaronder elke **Head-to-head**-uitdaging die op je wacht (**Accept** of **Decline**) en je **Goals**, met **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'wissel tussen **Players** en **Clans**, typ een naam en druk op Enter. **Recent** toont je laatste paar. Klik in het spel met rechts op iemand en kies **Anvil** om hier uit te komen.',
        },
        {
          term: 'Vergelijken',
          body: 'op de kaart van iemand anders zet **Compare with me** jullie twee naast elkaar, skill voor skill, boss voor boss en pagina voor pagina. De kaart van een clan heeft **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'Het tandwieltabblad',
      intro: 'Synchroniseren en instellingen, in plaats van dingen om naar te kijken:',
      rows: [
        {
          term: 'Sync profile',
          body: 'stuurt je collection log en beste tijden naar Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'alleen clanadmins: stuurt de ledenlijst van de clan in het spel naar de site. Kan de plugin je clan niet lezen, dan staat er in plaats daarvan **Join your clan channel to sync the roster**.',
        },
        {
          term: 'Banner sounds',
          body: '**Add clip** voor het geluid dat een banner afspeelt, **Copy folder path** om ze te beheren, en **Add mission clip** voor missies.',
        },
        {
          term: 'Become a Supporter',
          body: 'in de volgende plugin-update opent een ★-link onderaan de Supporter-pagina, of staat er **Your Supporter perks** als je er al een bent.',
        },
      ],
    },

    settings: {
      title: 'Instellingen die veranderen wat je ziet',
      intro:
        'In de RuneLite-configuratie van Anvil, onder **Chat messages**. Ze staan in het begin allemaal aan.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'zet de feed ook in je chatbox terwijl het gebeurt: grote drops, pets en prestaties van borden waarvan de organisator het heeft aangezet en van clans waar je gast bent, de tilevoortgang van je teamgenoten, en voltooide tiles van andere teams.',
        },
        {
          term: 'Supporter names in chat',
          body: 'de kleuren van Supporters (en de ster van een Patron) in openbare, clan-, vrienden- en privéchat, en op je vriendenlijst en de ledenlijsten van kanalen. De lijst met namen wordt van Anvil gedownload; er wordt niets verstuurd over wie jij ziet.',
        },
        {
          term: 'Animated names',
          body: 'laat het kleurverloop van een Patron schuiven in het paneel, de Feed en eventchat. Uit houdt het stil. In de volgende plugin-update geldt het ook voor gebooste clannamen en geanimeerde banners in het paneel.',
        },
        {
          term: 'Supporter names in menus',
          body: 'de kleuren van Supporters op hun naam als je met rechts op ze klikt, nooit op PvP-werelden of in de Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'aan vervangen de kleuren van een Supporter een naamkleur die een andere plugin heeft ingesteld, zoals Player Indicators. Uit laat die namen met rust.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Een clan boosten — Anvil',
    metaDescription:
      'Hoe clanboosts op Anvil werken: wie ze heeft, een boost plaatsen en verplaatsen, de drie boostlevels en wat elk ervan ontgrendelt, de naamkleuren van de clan, geschonken boosts, en boostertekens en badges.',
    eyebrow: 'Anvil · voor Supporters en clanstaf',
    title: 'Een clan boosten',
    dek: 'Een betalende Champion of Patron kan een boost zetten op een clan waarvan hij lid is. Genoeg boosts van de leden van een clan tillen hem een level hoger, en elk level verandert hoe de clan eruitziet en waar hij vermeld staat. Boosts zijn alleen uiterlijk: ze veranderen nooit een rang, een score, een plek of het abonnement van de clan.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosts zolang je betaalt' },
      { strong: 'Levels bij 3, 8 en 15', rest: 'meetellende boosts' },
      { strong: 'Eén keer per week', rest: 'kan een boost verhuizen' },
    ],
    footnote:
      'Leden plaatsen boosts onder **Settings** → **Clan boosts**. De clanstaf ziet het level en de opties ervan onder Admin → **Clan settings** → **Boosts**. Voor de Supporter-niveaus zelf, zie [Anvil Supporter: niveaus en voordelen]({supporterGuide}).',

    what: {
      title: 'Wie boosts heeft',
      intro: 'Boosts horen bij een betaald lidmaatschap:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosts.' },
        {
          term: 'Supporter',
          body: 'geen. Tijd verdiend via uitnodigingen ook niet. Een tijdelijke upgrade van de Anvil-staf geeft alleen plekken als de staf die erbij doet.',
        },
      ],
      outro:
        'Boosts zijn van jou, niet van een character: drie characters in drie clans delen nog steeds één set. **Settings** → **Clan boosts** verschijnt alleen in je instellingen zolang je Supporter bent of nog een boost geplaatst hebt.',
    },

    place: {
      title: 'Een boost plaatsen en verplaatsen',
      intro: 'Je plaatst je boosts zelf; niemand kan er een voor je plaatsen.',
      steps: [
        'Open **Settings** → **Clan boosts**. **Your boosts** toont wat je geplaatst hebt en elke **Free slot**.',
        'Druk onder **Clans you can boost** op **Boost** naast een clan. Je kunt ook op **Boost this clan** drukken in het Boosters-gedeelte van de eigen pagina van de clan.',
        'Om er een te verplaatsen, gebruik je **Move to…** op zijn regel en kies je een andere clan. **Remove** haalt hem weg.',
      ],
      rows: [
        {
          term: 'Een ledenplek van 14 dagen oud',
          body: 'elke boost hangt aan een ledenplek die een van je characters in de clan in het spel heeft. Een gastplek kan er geen dragen. De plek telt vanaf het vroegste van twee momenten: wanneer Anvil hem voor het eerst zag, of wanneer het spel zegt dat het character lid werd. Tot dan zegt de regel van de clan hoeveel dagen er nog over zijn.',
        },
        {
          term: 'Eén regel per clan',
          body: 'de lijst toont elke clan één keer, en Anvil kiest het character waaraan de boost hangt: je main waar dat kan, anders de plek die je het langst hebt. De clan ziet alleen dat character, nooit je andere.',
        },
        {
          term: 'Eén keer per week',
          body: 'een geplaatste boost kan 7 dagen na het plaatsen verhuizen. De plek van een verwijderde boost komt op dezelfde datum weer vrij, dus verwijderen en opnieuw plaatsen is geen kortere weg. Is het character waaraan hij hing uit de clan gegaan, dan kun je hem meteen verplaatsen.',
        },
      ],
      note: {
        tag: 'Wat de labels betekenen',
        body: '**counting**: hij telt mee voor het level van de clan. **paused**: je Supporter-niveau heeft nu minder plekken dan je geplaatst hebt, dus je oudste boosts blijven meetellen en de rest wacht. **seat gone**: het character waaraan hij hing is daar geen lid meer; verplaats hem. **over the 2-per-person cap**: de clan telt er al twee van jou.',
      },
    },

    levels: {
      title: 'Levels',
      intro:
        'Het level van een clan komt uit zijn meetellende boosts. Van één persoon tellen er hoogstens twee mee voor één clan, dus een level betekent altijd dat meerdere leden ervoor kozen.',
      rows: [
        { term: 'Level 1', body: '3 meetellende boosts.' },
        { term: 'Level 2', body: '8 meetellende boosts.' },
        { term: 'Level 3', body: '15 meetellende boosts.' },
      ],
      outro:
        'Leden zien de voortgang op de pagina van de clan, bijvoorbeeld “5 of 8 to Level 2”. Een clan die stijgt, krijgt het nieuwe level meteen.',
      note: {
        tag: 'Een week respijt',
        body: 'Zakken de boosts onder een level, dan houdt de clan de voordelen van dat level nog 7 dagen. Admin → Clan settings → Boosts toont wanneer ze aflopen. Boosten de leden hem op tijd weer omhoog, dan verandert er niets.',
      },
    },

    perks: {
      title: 'Wat elk level ontgrendelt',
      intro: 'Elk level houdt alles van het level eronder.',
      rows: [
        {
          term: 'Level 1',
          body: 'een **Boosted**-badge op de clanpagina, op zijn kaart in de Clan Hall en in de zoekresultaten; een plek boven clans zonder boost in de Clan Hall en de zoekresultaten ervan; en de clannaam in een kleurverloop.',
        },
        {
          term: 'Level 2',
          body: 'een plek in de **Featured**-rij van de Clan Hall; de geanimeerde banner van de clan speelt af (onder Level 2 toont hij zijn stilstaande beeld); een wervingsregel voor bezoekers; en het kleurverloop van de naam beweegt.',
        },
        {
          term: 'Level 3',
          body: 'de **Spotlight** helemaal bovenaan de Clan Hall, en één wervingspost per maand in de Anvil-Discord, door de clan zelf geschreven.',
        },
      ],
      note: {
        tag: 'Het clanlogo is geen voordeel',
        body: 'Een geanimeerd logo (een GIF- of WebP-clanafbeelding) speelt op elk level af. Alleen de banner wacht op Level 2.',
      },
    },

    colours: {
      title: 'De naamkleuren van de clan',
      intro:
        'Vanaf Level 1 draagt de naam van de clan het kleurverloop van Anvil. Eigenaars en admins kunnen hun eigen kiezen onder Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'Eén tot vier kleuren',
          body: 'één kleur geeft een stilstaande naam; twee tot vier vormen een kleurverloop. Vanaf Level 2 beweegt een kleurverloop.',
        },
        {
          term: 'Donkere en lichte achtergronden',
          body: 'net als bij Supporter-namen past Anvil de kleuren aan zodat ze leesbaar blijven op donkere achtergronden (de site, het pluginpaneel, Discord) en lichte (de effen chatbox van het spel). Zet voor een van beide een apart uiterlijk aan, dan wordt het precies getoond zoals gekozen.',
        },
        {
          term: 'Reset to Anvil',
          body: 'gaat terug naar het palet van Anvil.',
        },
      ],
      outro:
        'De kleuren blijven bewaard als de clan onder Level 1 zakt, en komen terug als hij het weer haalt. De plugin pikt een wijziging op bij zijn volgende refresh.',
    },

    staff: {
      title: 'Voor clanstaf',
      intro:
        'Admin → **Clan settings** → **Boosts** is voor eigenaars en admins. De staf kan geen boosts plaatsen voor leden; leden plaatsen hun eigen.',
      rows: [
        {
          term: 'Het level',
          body: 'het level van de clan, hoeveel boosts er meetellen, hoeveel er nog nodig zijn voor het volgende level, en een eventuele respijtweek.',
        },
        {
          term: 'Recruiting line',
          body: 'Level 2. Eén zin, tot 140 tekens, die mensen buiten de clan te zien krijgen op je clanpagina en je kaart in de Clan Hall.',
        },
        {
          term: 'Recruitment post in the Anvil Discord',
          body: 'Level 3. Eén keer per kalendermaand, 20 tot 500 tekens, door jou geschreven en geplaatst als je op **Post it** drukt, met een link naar je clanpagina. Vermeldingen worden verwijderd en niemand wordt gepingd. Je kunt hem niet bewerken of een nieuwe sturen tot volgende maand.',
        },
        {
          term: 'Boosters',
          body: 'de lijst van characters die de clan boosten.',
        },
      ],
      note: {
        tag: 'Geschonken boosts van Anvil',
        body: 'De Anvil-staf kan een clan een level schenken, voor een bepaalde tijd of zonder einde. Het cadeau voegt alleen de boosts toe die de clan mist om dat level te halen, getoond als **Anvil gift** in de Boosters-lijst van de clan. Elke echte boost van een lid vervangt één geschonken boost, en een clan die al boven het geschonken level zit, houdt zijn eigen. Loopt het cadeau af, dan valt de clan terug naar het level dat de boosts van zijn leden hem geven.',
      },
    },

    boosters: {
      title: 'Boostertekens en badges',
      intro: 'Wat een booster krijgt in de clan die hij boost:',
      rows: [
        {
          term: 'Het boosterteken',
          body: 'een klein edelsteentje naast zijn character in de ledenlijst, de feed en de Discord-posts van die clan. Beweeg erover voor “Boosts this clan”.',
        },
        {
          term: 'De boostermuur',
          body: 'op de clanpagina: één regel per character, de meeste boosts eerst, daarna wie het langst boost.',
        },
        {
          term: 'Badges',
          body: '**First booster** voor wie de allereerste boost van de clan plaatste; **1 month**, **3 months**, **6 months** en **1 year** boosten zonder onderbreking; en **Level-up 1**, **2** of **3** voor de boost die de clan naar dat level tilde.',
        },
      ],
      note: {
        tag: 'Verplaatsen zet de klok terug',
        body: 'Badges voor tijd tellen vanaf de vroegste boost van het character die nog meetelt, dus een boost verplaatsen of verwijderen laat ze opnieuw beginnen. Je profiel toont de clans die je boost, één keer per clan.',
      },
    },
  },

  profile: {
    metaTitle: 'Je profiel, Wrapped en Compare — Anvil',
    metaDescription: 'De pagina’s die Anvil over jou bijhoudt: je profiel, de openbare pagina van elk character, je persoonspagina, maandelijkse en jaarlijkse Wrapped, event-Wrapped-kaarten, en twee characters naast elkaar vergelijken.',
    eyebrow: 'Anvil · voor spelers',
    title: 'Je profiel, Wrapped en Compare',
    dek: 'Anvil houdt één pagina voor **jou** en één voor **elk character** dat je speelt. Dit staat erop, wie ze kan openen, en de Wrapped-kaarten die aan het eind van elke maand en elk event verschijnen.',
    facts: [
      {
        strong: 'Standaard gedeeld',
        rest: 'zet elk character in één schakelaar op privé',
      },
      {
        strong: 'Maandelijkse Wrapped',
        rest: 'verschijnt op de 1e van de volgende maand',
      },
      {
        strong: 'Event-Wrapped',
        rest: 'verschijnt wanneer het event eindigt',
      },
    ],
    footnote: 'Elke schakelaar die hier wordt genoemd, wordt uitgelegd waar hij staat in [Instellingen, pagina voor pagina]({settingsGuide}).',
    pages: {
      title: 'Je pagina’s',
      intro: 'Vier pagina’s, elk met een ander antwoord:',
      rows: [
        {
          term: 'Je profiel',
          body: '[/profile](/profile), alleen door jou te zien. Kies bovenaan een character uit de chips om de levels, bossen, collectielog en events te zien. Captains krijgen hier ook een **Captain’s deck**.',
        },
        {
          term: 'De pagina van een character',
          body: '`/p/<name>`: één character, leesbaar voor iedereen met de link zolang het gedeeld is. Het toont skills, bossen, de collectielog en persoonlijke records, en laat met opzet je clanstanden, je eventgeschiedenis en je Discord-naam weg.',
        },
        {
          term: 'Je persoonspagina',
          body: '`/u/…`: al je gedeelde characters op één pagina, met je display case en de streamingaccounts die je wilt tonen. Die bestaat alleen als je **Show that my characters are one person** aanzet.',
        },
        {
          term: 'De ledenpagina van een clan',
          body: '`/c/<clan>/members/<name>`: hetzelfde character zoals één clan het ziet, bereikt vanuit de lijst **Members** van die clan. Een privéclan toont zijn leden alleen aan de eigen mensen.',
        },
      ],
    },
    sharing: {
      title: 'Wie wat kan zien',
      body: [
        'Elk character begint als **gedeeld**: de pagina opent voor iedereen met de link, en het kan op ranglijsten en bij andere clans verschijnen. Zet er één uit onder **Who sees my characters** in Instellingen, dan antwoordt de pagina voor iedereen behalve jou met _not found_. Jij ziet **Private — only you can see this page.** met een link **Share it →**.',
        'Een gedeelde pagina heeft **Copy link** onder de naam. Ingelogde bezoekers die een pagina misbruik vinden, kunnen op **Report this profile** drukken.',
        'Per character kun je in Instellingen ook verbergen in welke in-game clan het zit (**Show my in-game clan**), zodat het van die pagina en van de Anvil-pagina van die clan verdwijnt.',
      ],
    },
    wrapped: {
      title: 'Je maandelijkse en jaarlijkse Wrapped',
      body: [
        'Elke maand krijgt elk character een Wrapped-kaart: **XP gained**, **Boss kills**, **New slots** in de collectielog, **Efficient** uren, **PBs**, plus pets en de grootste drop. Die verschijnt op de **1e van de volgende maand** (UTC). Tot die tijd kun alleen jij hem openen, als voorbeeld.',
        'Het jaar krijgt er ook één, op `/p/<name>/wrapped/<year>`, vanaf **1 december**. `/p/<name>/wrapped` brengt je altijd naar de nieuwste die er is.',
        'Druk op **Copy link to your Wrapped** om hem te delen. In Discord geplakt, toont hij zich als een afbeelding van de kaart. De Wrapped van een privécharacter opent alleen voor jou, en zijn link toont een gewone Anvil-kaart als voorbeeld.',
      ],
      note: {
        tag: 'Een lege maand',
        body: 'Als er die maand niets bij Anvil is aangekomen (geen XP, kills, logplekken of PB’s), zegt de kaart dat in plaats van nullen te tonen. Speel met de plugin, of laat de hiscores je vangen, en de volgende maand vult zich.',
      },
    },
    events: {
      title: 'Event-Wrapped',
      body: [
        'Wanneer een bord eindigt, krijgt elke speler en elk team een kaart. Open de pagina **Wrapped** van het event: **Your card** staat bovenaan, dan **Teams** (rang, score en spelers) en **Players**. Druk op **Open and share your card** en daarna op **Copy share link**.',
        'Vóór het einde zie je **Cards aren’t out yet**. Staf kan een voorbeeld vroeg openen, zodat ze de kaarten kunnen controleren voordat spelers ze zien.',
        'De kaartafbeeldingen verschijnen alleen bij een openbaar clanevent dat niet op uitnodiging was. Bij elk ander event werkt de link nog voor de mensen die dat event kunnen zien, en toont hij een gewone Anvil-kaart als voorbeeld.',
      ],
    },
    compare: {
      title: 'Twee characters vergelijken',
      body: [
        'Open [Compare](/compare) en typ twee namen. Je krijgt skills, bossen en collectielogpagina’s naast elkaar. De leider bij elk getal staat in goud. Daaronder staan een analyse, XP per skill, elke boss die een van jullie heeft gedood, en elk logonderdeel per item: jullie hebben het allebei, geen van beiden, of alleen één van jullie. **Swap sides** draait ze om.',
        'Alleen gedeelde characters kunnen worden vergeleken. Een privécharacter, of een naam die Anvil niet kent, komt terug als _not on Anvil, or not shared_. Je kunt je eigen privécharacters altijd vergelijken als je bent ingelogd.',
      ],
    },
  },
  settings: {
    metaTitle: 'Instellingen, pagina voor pagina — Anvil',
    metaDescription: 'Elke pagina onder Anvil-instellingen: Discord-berichten en privacy van screenshots, de chatfeed in het spel, pluginverbinding en apparaten, je eigen webhooks, wie je characters ziet, Supporter- en profiellook, streamingaccounts, elk character, en eigendomsclaims.',
    eyebrow: 'Anvil · voor spelers',
    title: 'Instellingen, pagina voor pagina',
    dek: '[Settings](/settings) is waar je eigen keuzes staan: wat je post, wat je in het spel ziet, wie je characters kan zien. Keuzes die je hier maakt, volgen je naar elke computer waarop je speelt.',
    facts: [
      {
        strong: 'Zoekvak',
        rest: 'op de eerste pagina vindt elke instelling',
      },
      {
        strong: 'Eén pagina per character',
        rest: 'onder Characters',
      },
      {
        strong: '10 webhooks',
        rest: 'van je eigen',
      },
    ],
    footnote: 'Je profielpagina’s worden uitgelegd in [Je profiel, Wrapped en Compare]({profileGuide}); de eigen instellingen van de plugin in [RuneLite-plugin instellen]({pluginGuide}).',
    find: {
      title: 'Een instelling vinden',
      body: [
        'De eerste pagina, **Overview & search**, heeft een zoekvak. Typ wat je wilt in je eigen woorden, zoals _private messages_, _rare drop value_, _death message_, _name colour_ of _plugin token_, en het brengt je naar de juiste schakelaar.',
        'Het menu aan de zijkant heeft twee groepen. **Account** bevat de pagina’s hieronder. **Characters** heeft één pagina per character dat je hebt gekoppeld (je hoofdcharacter is gemarkeerd met **main**), gevolgd door **Add character**. Een getal bij **Add character** betekent dat Anvil heeft gezien dat je characters speelt die je nog niet hebt gekoppeld.',
      ],
    },
    posts: {
      title: 'Discord-berichten & screenshots',
      intro: 'Wat de plugin over jou post in de Discord-kanalen van je clans, en wat hij verbergt in screenshots. Deze keuzes worden gelezen door de volgende pluginupdate. Tot je die hebt, bepalen dezelfde schakelaars in de eigen instellingen van de plugin het.',
      rows: [
        {
          term: 'Wat je plugin post',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** en **Diary completions** staan standaard aan; **PvP kills** staat standaard uit.',
        },
        {
          term: 'De getallen',
          body: '**Min drop value** (standaard 1m, minimaal 1m, 0 zet het uit), **Min drop rarity (1 in N)** (standaard 1 op 1,000), **Waarde en zeldzaamheid samen** (standaard een van beide, of beide vereist), **Loot key value** (1m), een **Death message** van maximaal 200 tekens waarin `{name}` je naam wordt, en de laagste **Combat task tier** en **Quest tier** die worden geplaatst (standaard Master). De waarde, de zeldzaamheid en de keuze van een van beide of beide volgen de standaarden van je clan totdat jij ze zelf instelt; **Terug naar clanstandaard** zet je weer op volgen.',
        },
        {
          term: 'Waar je berichten naartoe gaan',
          body: '**Keep my announcements out of clans I only guest in**, en **Level posts in clan channels**: **Clan rules**, **Only 99s & max** of **Off**. **Per character** toont elk character met een link **Clans →** om het posten voor één clan uit te zetten.',
        },
        {
          term: 'Screenshots per soort',
          body: 'kies per soort (**Rare drops**, **Pets**, **Deaths**, **Collection log**, **Combat tasks**, **Achievement diaries**, **Levels**, **Player kills**) of de post een screenshot bevat. Alles staat standaard aan. Je clan kan een standaard instellen voor zijn leden; totdat je er zelf een wijzigt, volg je die, en **Reset** zet je terug op die standaard. Bingobewijzen worden altijd vastgelegd, wat je ook kiest: het zijn je bewijzen.',
        },
        {
          term: 'Meer om aan te kondigen',
          body: '**Slayer** (elke N taken), **Clue scrolls** (vanaf de gekozen tier), **Speedruns** (alleen persoonlijke records, of elke keer), **Kill count** (elke N kills), **BA gambles** (elke N gambles) en **Custom chat messages** (spelberichten die passen bij je eigen patronen, waarbij `*` elke tekst is en `#` elk getal; tot 10). Alles staat standaard uit. Je clan kan ze als standaard aanzetten voor zijn leden, en je kunt er zelf elk aan- of uitzetten; **Reset to clan default** zet je terug op het volgen van je clan. Ze worden geplaatst in het **Milestones & more**-kanaal van je clan en in je eigen webhooks die ze accepteren; je eigen patronen worden alleen in je eigen webhooks geplaatst.',
        },
        {
          term: 'Privé: Grand Exchange, handel, groepsopslag, andere plugins',
          body: '**Grand Exchange** (afgeronde aanbiedingen ter waarde van ten minste het bedrag dat je instelt), **Player trades** (wat je gaf en kreeg), **Group storage** (wat je erin stopte of eruit haalde) en **Other plugins** (RuneLite-plugins die je noemt, mogen via Anvil plaatsen). Ze staan standaard uit, alleen jij kunt ze aanzetten, je clan kan ze nooit namens jou aanzetten, en ze plaatsen alleen in je eigen webhooks: vink het soort aan op de webhook waarin je ze wilt.',
        },
        {
          term: 'Berichtsjablonen',
          body: 'verandert de eerste regel van elk bericht: **Loot**, **Pet**, **Collection log**, **Combat tasks**, **Achievement diary**, **Quests**, **Levels**, **Death**, **Player kills**, **Slayer**, **Clue scrolls**, **Speedruns**, **Kill count**, **BA gambles** en voor jou alleen **Grand Exchange**, **Player trades** en **Group storage**. Klik op een plaatshouder zoals `{player}` of `{item}` om hem toe te voegen; de voorvertoning vult voorbeeldwaarden in. Elke soort heeft eigen plaatshouders, en al het andere tussen accolades blijft staan zoals je het typte. Maximaal 200 tekens; vermeldingen en links worden nooit geplaatst. Ongewijzigd leest een bericht zoals altijd; je clan kan er een eigen instellen, en **Reset to clan default** zet het daarop terug.',
        },
        {
          term: 'Privacy van screenshots',
          body: 'vink de chat aan die wordt weggelaten uit elke screenshot die de plugin maakt, zowel bewijzen als Discord-berichten: **Private messages** (standaard aangevinkt), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** en **Group chat**. Spelberichten en de eigen regels van Anvil blijven altijd erin.',
        },
      ],
      note: {
        tag: 'Bordvakjes worden nooit beïnvloed',
        body: 'Een bericht uitzetten stopt alleen het Discord-bericht. Drops, kills en prestaties tellen nog steeds mee op elk bord dat je speelt.',
      },
    },
    chat: {
      title: 'Chatfeed in het spel',
      intro: 'Wat de plugin in je chatvenster print als de plugininstelling **Show feed in game chat** aan staat.',
      rows: [
        {
          term: 'Vandaan',
          body: '**Boards I play on**, en **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'Wat',
          body: 'drops die minstens een bedrag waard zijn dat je kiest, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, en combattaken, levels, quests en dagboeken.',
        },
        {
          term: 'Wanneer je inlogt',
          body: '**A short brief in chat**: wat er gebeurde terwijl je weg was. Champions kiezen wat het behandelt.',
        },
        {
          term: 'Kleuren',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)**, of **My own colours** voor Supporters.',
        },
      ],
    },
    login: {
      title: 'Pluginverbinding, login & apparaten',
      intro: 'Waar de plugin en de website zijn ingelogd, en hoe je ze uitlogt.',
      rows: [
        {
          term: 'Pluginverbinding',
          body: 'je plugin-token, voor het zeldzame geval dat je hem met de hand plakt. Normaal regelt **Sign in with Discord** in het zijpaneel dit voor je.',
        },
        {
          term: 'Login & apparaten',
          body: 'elke computer waarop de plugin is ingelogd, als **RuneLite sign-in 1**, **2**… met wanneer hij is gemaakt en laatst gebruikt. **Revoke** logt er één uit, bijvoorbeeld een computer die je hebt verkocht. **Enter a code** koppelt een andere computer. **Sessions** logt je overal uit op de website.',
        },
        {
          term: 'Clanfacturatie',
          body: 'clan-eigenaars krijgen hier **Open portal →**, voor de facturatie van de clan.',
        },
      ],
    },
    webhooks: {
      title: 'Je Discord-webhooks',
      body: [
        'Je berichten kunnen ook naar een eigen Discord-server: een privékanaal, een vriendenserver, overal waar je een webhook kunt maken. Plak de webhooklink, vink aan wat hij krijgt (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), stel eventueel **Only drops worth at least … gp** in, en druk op **Add webhook**.',
        'Je kunt er tot 10 hebben. Alleen Discord-webhooklinks worden geaccepteerd, en een opgeslagen link wordt gemaskeerd getoond, zodat een screenshot van deze pagina hem niet lekt. **Level posts on my webhooks** stelt je eigen levelregels voor hen in, los van die van je clan.',
      ],
    },
    privacy: {
      title: 'Wie mijn characters ziet',
      intro: 'Je characters worden in het begin gedeeld. Drie schakelaars veranderen dat:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'één schakelaar per character. Aan (standaard), is de pagina **Public**. Uit, wordt het **Only its clans**: de clans van dat character zien het nog in hun ledenlijsten en events, niemand anders, en het verdwijnt van de ranglijsten.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'met twee of meer characters maakt dit je persoonspagina, die je gedeelde characters samen toont. Uit, dan kan niemand zien dat ze allemaal van jou zijn.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'of de startpagina open borden van andere clans toont om naar te kijken.',
        },
      ],
    },
    look: {
      title: 'Supporter, profiellook, streaming en boosts',
      intro: 'Hoe je eruitziet op Anvil, en de accounts en voordelen erachter.',
      rows: [
        {
          term: 'Supporter & naamkleuren',
          body: 'je niveau, je voordelen en je uitnodigingslink: breng vrienden mee en verdien gratis maanden. Niveaus worden uitgelegd in [Anvil Supporter]({supporterGuide}).',
        },
        {
          term: 'Profiellook',
          body: 'avatar en banner (geanimeerd vanaf Champion), per character verschillend als je wilt, en de **Display case**: 4, 8 of 12 pins, afhankelijk van het niveau.',
        },
        {
          term: 'Streamingaccounts',
          body: '**Twitch**, **YouTube**, **Kick** en **Medal**. Elk toont of het is geverifieerd, met een schakelaar om het op je profiel te tonen. Geverifieerde accounts zijn wat je toegang geeft tot events voor volgers en abonnees.',
        },
        {
          term: 'Clanboosts',
          body: 'alleen zichtbaar zodra je kunt boosten: je slots, waar ze staan en de clans die je kunt boosten. Zie [Een clan boosten]({boostsGuide}).',
        },
      ],
    },
    characters: {
      title: 'Elk character',
      intro: 'Onder **Characters** heeft elk character zijn eigen pagina: het type, of het is geverifieerd, en links naar de openbare pagina en het volledige profiel.',
      rows: [
        {
          term: 'Zichtbaarheid',
          body: '**Show to other clans and on leaderboards**, en **Show my in-game clan**.',
        },
        {
          term: 'Clans',
          body: 'elke clan en space waarin het zit, als **member** of **guest**, met **Announce drops & achievements** per clan en **Leave**. Heeft Anvil het in de verkeerde clan, dan vertelt **Which clan is it really in?** het aan de staf.',
        },
        {
          term: 'Character',
          body: '**Make main**, vraag om een nieuwe naam na een naamswijziging, of **Remove** het uit je account. De eerdere resultaten blijven staan waar ze staan.',
        },
        {
          term: 'Add character',
          body: 'speel een character één keer met de plugin ingelogd en het koppelt zichzelf. Op mobiel of de officiële client koppel je het op naam. **We noticed you playing** toont degenen die Anvil heeft gezien; **Not mine** verbergt er één.',
        },
      ],
    },
    claims: {
      title: 'Eigendomsclaims',
      body: [
        'Is een character gekoppeld aan het Anvil-account van iemand anders, maar is het echt van jou, druk dan op **This is my account** in het tabblad **You** van het zijpaneel van de plugin. Je bewijst dat je het speelt met een snelle XP-controle, daarna wordt de huidige houder gevraagd. Jij komt nooit te weten wie zij zijn, en zij komen nooit te weten wie jij bent.',
        'Je claims tonen **XP check**, **open**, en daarna hoe ze eindigden: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** of **closed**. **Withdraw** annuleert er één.',
        'Als iemand een van jouw characters claimt, staat die onder **Claims on your characters** met **Approve** of **Object — it’s mine**. Een niet-geverifieerd character verhuist na 7 dagen tenzij je bezwaar maakt. Een geverifieerd character verhuist alleen als jij het goedkeurt.',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill en Boss of the Week — Anvil',
    metaDescription: 'Een Skill of the Week, Boss of the Week of efficiency-race op Anvil draaien: er één inplannen, herhalen en laten roteren, startlijnen, mensen toevoegen en verwijderen, prijzen, vroegtijdig stoppen, en wat spelers zien.',
    eyebrow: 'Anvil · voor clanstaf en spelers',
    title: 'Skill en Boss of the Week',
    dek: 'Een wekelijkse wedstrijd is het event met weinig werk: geen vakjes om te schrijven, geen teams en geen aanmeldingen. Iedereen op de ledenlijst doet automatisch mee bij de start, en de winnaar is wie het meeste wint voordat het eindigt.',
    facts: [
      {
        strong: 'Geen vakjes, geen teams',
        rest: 'één ranglijst',
      },
      {
        strong: 'Automatisch bij de start',
        rest: 'de hele ledenlijst',
      },
      {
        strong: 'Tot 10 prijsplaatsen',
        rest: 'betaald uit de kas',
      },
    ],
    footnote: 'Borden (bingo) staan in [Je eerste event draaien]({adminGuide}); prijzen en de kas in [De clankas]({cofferGuide}).',
    schedule: {
      title: 'Er één inplannen',
      intro: 'Vijf keuzes, en de standaardinstellingen zijn voor de meeste clans prima:',
      steps: [
        'Open **Schedule** in het admin-menu en druk op **+ Schedule event** (moderators kunnen **Schedule a competition** gebruiken).',
        'Kies de soort: **Skill of the Week** (XP gewonnen), **Boss of the Week** (kills gewonnen) of **Efficiency race** (gespeelde uren of bossuren gewonnen).',
        'Kies onder **What is measured** de skill of boss. Wil je hem elke week veranderen, voeg dan meer toe onder **Then rotate through**. Laat dat leeg om steeds dezelfde te herhalen.',
        'Kies wanneer het **Runs**: **This weekend**, **One week**, of je eigen data. Er moet altijd een einde zijn, want het telt de winst tussen start en einde.',
        'Laat **Repeat every week** aan en de volgende begint op het moment dat deze eindigt, met dezelfde lengte en prijzen. Vink **Guests race too** aan als de gasten van je clan op het bord moeten staan.',
      ],
      outro: 'Er valt verder niets in te stellen. De startgetallen komen uit de hiscores zodra het begint.',
    },
    counting: {
      title: 'Hoe er geteld wordt',
      body: [
        'De winst van elke speler is hun stat nu min hun stat toen de wedstrijd begon (hun **starting line**). De hoogste winst wint; een gelijke stand wordt op naam vermeld, en prijzen kunnen tussen gelijke plaatsen worden gedeeld.',
        'Startlijnen komen uit de hiscores. Daarna houden de live-updates van de plugin het bord actueel tussen de hiscorecontroles, zodat spelers met de plugin omhoog gaan terwijl ze spelen.',
        'Een getal dat daalt, wordt genegeerd, en een winst die onmogelijk lijkt, wordt voor de staf **flagged** in plaats van geteld of ingekort.',
      ],
      note: {
        tag: 'Spelers: log uit voordat het begint',
        body: 'De hiscores slaan je stats alleen op als je uitlogt. Grind je tot vlak voor de start zonder uit te loggen, dan wordt je startlijn genomen van vóór die grind en telt de grind als winst. De staf vangt dit meestal op en corrigeert je startlijn, maar log toch één keer uit voordat het begint.',
      },
    },
    manage: {
      title: 'Het draaien ervan',
      intro: 'Open de wedstrijd via **Schedule** of het dashboard. Hij heeft een startpagina en drie tabbladen:',
      rows: [
        {
          term: 'Home',
          body: 'het **Leaderboard** (top 25, met hoeveel er scoren), **flagged** winsten, iedereen die de clan **left the clan**, en de prijzen. Als hij eindigt, de winnaars en de **Final leaderboard**.',
        },
        {
          term: 'Startlijnen',
          body: 'elke speler met **Started at**, **Now** en **Gained**. Corrigeer een startlijn met de hand als een grind van vóór de wedstrijd is meegeteld, en het klassement volgt. **Pull current stats** ververst iedereen; **Reset baselines** begint opnieuw voor iedereen op basis van hun huidige hiscores en wist alle winst.',
        },
        {
          term: 'Deelnemers',
          body: 'de hele ledenlijst zit er al in. **Add someone** neemt één naam per regel, voor een gast of een account dat nog niet op de ledenlijst staat. Een speler verwijderen haalt zijn stand weg; hem weer toevoegen geeft hem een nieuwe startlijn. **Leave one each** ruimt iemand op die op meerdere characters is ingevoerd. Je kunt ook alle gasten in één keer laten vallen.',
        },
        {
          term: 'Instellingen',
          body: 'naam, data, **Repeat every week**, en **Status** (alleen om er één weer in beweging te krijgen; hij schuift vanzelf door). Admins kunnen hem **Delete**, samen met de deelnemers en standen.',
        },
      ],
    },
    prizes: {
      title: 'Prijzen en afsluiting',
      body: [
        'Stel prijzen in voor maximaal 10 plaatsen, betaald uit de clankas. Je kiest of een speler zonder winst kan worden betaald en of gelijke plaatsen hun prijzen delen. Hoe het geld beweegt, staat in [De clankas]({cofferGuide}).',
        'Hij eindigt vanzelf op het tijdstip dat je instelt. **End now** stopt hem eerder: winsten tellen meteen niet meer, en de uitslag wordt naar Discord gepost met de prijzen binnen 15 minuten afgehandeld.',
      ],
    },
    players: {
      title: 'Voor spelers',
      body: [
        'Je meldt je niet aan. Als je op de ledenlijst van de clan staat wanneer het begint, doe je mee. Vind het op de pagina **Events** van je clan, in het tabblad **Clan** van het zijpaneel van de plugin met waar je staat, en in Discord bij start en einde.',
        'Elke wedstrijd heeft een eigen pagina met het live klassement en hoe de race dag voor dag verliep. Een privéclan toont hem alleen aan de eigen leden.',
        'Met de plugin spelen houdt je getal live. Zonder de plugin tel je ook mee, alleen in het tempo van de hiscores.',
      ],
    },
    teamsLine: "Wil je teams, of clans die tegen elkaar racen, op een skill of boss? Zet de **Format** wanneer je het plant. Zie [Teamwedstrijden]({teamCompsGuide}).",
  },
  teamComps: {
    "metaTitle": "Teamwedstrijden — Anvil",
    "metaDescription": "Laat een Skill- of Boss of the Week spelen als teams of clan tegen clan op Anvil: spelers in teams verdelen, andere clans uitnodigen, hoe totalen en gemiddelden scoren, late deelnemers en wat spelers zien.",
    "eyebrow": "Anvil · voor clanstaff en spelers",
    "title": "Teamwedstrijden",
    "dek": "Elke skill- of bosswedstrijd heeft een Format. Solo is de standaard en werkt zoals altijd. Kies Teams om je clan in groepen te splitsen, of Clan vs clan om andere clans te laten racen op dezelfde skill of boss.",
    "facts": [
      {
        "strong": "Drie formats",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "Totalen beslissen",
        "rest": "met een gemiddelde per speler"
      },
      {
        "strong": "Eén host bewerkt",
        "rest": "partnerclans kijken mee"
      }
    ],
    "footnote": "De basis van Skill and Boss of the Week staat in [Skill and Boss of the Week]({weeklyGuide}). Wil je dat clans op bingoborden racen? Zie dan [Een bezoekende clan hosten]({clanVsClanGuide}).",
    "teams": {
      "title": "Teams instellen",
      "intro": "Teams verdelen je eigen clan in groepen. Het duurt ongeveer een minuut:",
      "steps": [
        "Plan een wedstrijd zoals gewoonlijk. Zet **Format** op **Teams**.",
        "Typ je teamnamen. Iedereen die is ingevoerd, wordt gelijkmatig verdeeld op basis van huidig level of KC, zodat de teams eerlijk beginnen.",
        "Laat **Late joiners go into the smallest team** aan als spelers later kunnen instappen. Zet het uit om de teams vast te houden.",
        "Wil je later iets wijzigen, open dan de wedstrijd en kies **Teams** in de admin-zijbalk. Daar kun je:"
      ],
      "rows": [
        {
          "term": "Hernoemen en van kleur veranderen",
          "body": "geef elk team een naam en een kleur die spelers herkennen."
        },
        {
          "term": "Teams toevoegen en verwijderen",
          "body": "begin met twee en voeg een derde toe, of verwijder er een die je niet meer nodig hebt."
        },
        {
          "term": "Een speler verplaatsen",
          "body": "stuur iemand naar een ander team. Handig voor vrienden die samen willen spelen."
        },
        {
          "term": "Auto-balance",
          "body": "druk op **Auto-balance by current level/KC** om iedereen opnieuw gelijkmatig te verdelen."
        },
        {
          "term": "Late joiners",
          "body": "zet de optie voor late deelnemers aan of uit. Staat die aan, dan gaan nieuwe spelers naar het kleinste team."
        }
      ],
      "note": {
        "tag": "Geen team, geen probleem",
        "body": "Een speler zonder team telt nog mee op het individuele bord. Die telt alleen niet mee in een teamtotaal."
      },
      "outro": "Een herhalende wedstrijd neemt zijn teams mee naar de volgende week en verdeelt ze opnieuw."
    },
    "clans": {
      "title": "Clan vs clan instellen",
      "intro": "Met Clan vs clan kunnen andere clans meedoen aan je wedstrijd, zoveel als je wilt. Jij bent de host, de andere clans zijn partners.",
      "steps": [
        "Zet als admin of hoger in de hostclan **Format** op **Clan vs clan**.",
        "Nodig de andere clans uit via hun adres. Doe dat op het aanmaakformulier, of later op de pagina **Clans** van de wedstrijd.",
        "De eigenaar of admin van de uitgenodigde clan accepteert of weigert op hun pagina **People** of in de lijst **Events**. Een moderator kan dat niet. Niemand uit die clan wordt ingeschreven totdat die clan accepteert.",
        "Bij acceptatie kiest de clan wie er meedoet: **All members** van de ledenlijst, of **Selected people** die zij zelf kiezen. Dit kan later worden aangepast vanaf dezelfde kaart.",
      ],
      "body": [
        "De partnerclan kan de stand volgen op de eigen site via `/c/<slug>/weekly/<id>`. Dat is alleen-lezen. Alleen de host bewerkt de wedstrijd.",
        "Wil je een clan verwijderen? Verwijder die dan op de pagina **Clans**. De spelers ervan verdwijnen van het bord.",
        "Een terugkerende wedstrijd stuurt elke week nieuwe uitnodigingen, dus elke clan moet opnieuw ja zeggen.",
        "Ongewenste uitnodigingen? Kies bij de uitnodiging **Decline & block this clan**. Latere uitnodigingen van die clan worden stilletjes geweigerd, en je kunt de clan weer deblokkeren via **Settings → Blocked clans**.",
      ],
      "note": {
        "tag": "Deel het adres",
        "body": "Het adres van een clan is de korte naam in zijn webadres. Vraag die aan de admin van de andere clan voordat je ze uitnodigt."
      }
    },
    "scoring": {
      "title": "Hoe er gescoord wordt",
      "body": [
        "Het totaal van een team of clan is de som van de gains van de leden. Gains worden op dezelfde manier geteld als op het individuele bord.",
        "Naast elk totaal zie je ook een **average per player**, zodat een team van 8 en een team van 12 toch vergeleken kunnen worden.",
        "Staan twee totalen gelijk, dan staat degene die het eerst bereikte hoger."
      ]
    },
    "players": {
      "title": "Wat spelers zien",
      "body": [
        "De wedstrijdpagina toont eerst de stand van de teams of clans. Open er een om de spelers te zien. Je eigen team of clan is gemarkeerd.",
        "Discord-berichten aan het begin, halverwege en aan het eind tonen de stand. Bij clan vs clan gaan ze naar het kanaal van elke clan, en dat van jou is gemarkeerd met **← you**.",
        "In het zijpaneel van de plugin zie je waar je team staat.",
        "Je hoeft je nergens voor aan te melden. Als je clan alle leden inschrijft en jij staat op de ledenlijst, doe je mee. Als de clan mensen kiest, doe je mee zodra je gekozen bent.",
        "Wil je niet meedoen? Druk op **Opt out** naast **You’re in**, op de wedstrijdpagina, in de lijst Events of in de plugin. Je verdwijnt dan van het bord voor deze ene wedstrijd, en je kunt je weer aanmelden terwijl die loopt.",
      ]
    },
    "faq": {
      "title": "Vragen",
      "intro": "De vragen die clanstaf en spelers het vaakst stellen:",
      "rows": [
        { term: "Onze teams zijn verschillend groot. Is dat niet eerlijk?", body: "Op zich niet. Totalen bepalen de ranglijst, maar elk team toont ook een gemiddelde per speler, zodat je ziet hoe een kleiner team er echt voor staat." },
        { term: "En mensen die laat instappen?", body: "Met de schakelaar voor late instappers aan, gaan ze naar het kleinste team. Staat die uit, dan tellen ze alleen mee op het individuele bord. Je kunt ze altijd met de hand verplaatsen op de pagina **Teams**." },
        { term: "Kan de andere clan onze wedstrijd bewerken?", body: "Nee. Partnerclans zien de stand alleen-lezen. Alleen de hostclan kan de wedstrijd wijzigen." },
        { term: "Kan ik één wedstrijd overslaan?", body: "Ja. Druk op **Opt out** op de wedstrijdpagina, in de lijst Events of in de plugin. Alleen die ene wedstrijd wordt geraakt, en je kunt je weer aanmelden terwijl hij loopt." },
        { term: "Hoeveel clans kunnen meedoen?", body: "Zoveel als je uitnodigt, tot 50 in één wedstrijd. Elke clan ziet zijn eigen kant gemarkeerd in de stand en in zijn Discord-berichten." },
        { term: "Een andere clan blijft ons uitnodigen. Kunnen we dat stoppen?", body: "Ja. Een eigenaar of admin kiest bij de uitnodiging **Decline & block this clan**. Latere uitnodigingen worden geweigerd zonder dat de clan dat hoort. Deblokkeer hem op elk moment via **Settings → Blocked clans**." },
        { term: "Als we één keer akkoord gaan, doen we dan elke week mee?", body: "Nee. Een terugkerende wedstrijd stuurt elke week nieuwe uitnodigingen, en een eigenaar of admin moet elke uitnodiging apart accepteren." },
      ]
    }
  },

  clanEvents: {
    metaTitle: 'Clanevents en de planning — Anvil',
    metaDescription: 'Clanevents op Anvil plannen: massa’s, trips en meetups, wekelijkse herhalingen, “Ik ga” en aanmeldingen met plaatsen, vragen en kosten, Discord-berichten en herinneringen, uitbetalingen, enquêtes, en de planning die gaten toont.',
    eyebrow: 'Anvil · voor clanstaf',
    title: 'Clanevents en de planning',
    dek: 'Niet alles is een bord. Een clanevent is een massa, een raidavond, een dropfeest of een meetup: een tijd en een plek, geplaatst op Discord en met herinneringen, met zoveel of zo weinig aanmelding als je wilt.',
    facts: [
      {
        strong: 'Eenmaal of elke week',
        rest: 'met een optionele einddatum',
      },
      {
        strong: 'Drie manieren om mee te doen',
        rest: 'info, “Ik ga”, of aanmeldingen',
      },
      {
        strong: 'Herinnering',
        rest: '15 minuten vooraf, daarna bij de start',
      },
    ],
    footnote: 'Wekelijkse wedstrijden staan in [Skill en Boss of the Week]({weeklyGuide}); kosten en prijzen in [Kosten en uitbetalingen]({feesGuide}).',
    create: {
      title: 'Er één inplannen',
      intro: 'Open **Clan events** in het admin-menu en vul het formulier in:',
      rows: [
        {
          term: 'Naam, tijd, duur',
          body: '**Name**, **Starts (your time)** in je eigen tijdzone, en **Minutes**.',
        },
        {
          term: 'Herhaling',
          body: '**Just once** of **Every week**, met een optionele datum **Until**.',
        },
        {
          term: 'Waar',
          body: '**Where**, **World** en **Host**, plus een afbeelding: kies een boss of skill, of upload je eigen.',
        },
        {
          term: 'Details',
          body: 'uitrusting, eisen, wat je moet meenemen.',
        },
        {
          term: 'Wie komt',
          body: '**Just information** (geen knop, geen telling), **“I’m going”** (één tik, toont een telling) of **Sign-ups** (plaatsen, vragen en kosten).',
        },
        {
          term: 'Discord',
          body: '**Post to** een kanaal (of het standaardkanaal van de clan), optioneel de kanalen **Chat**, **Guide** en **Voice** om te koppelen, en of de memberrol bij de aankondiging, de herinnering en de start een ping krijgt.',
        },
      ],
      outro: 'Druk op **Schedule it**. Uitbetalingen en een enquête worden daarna op de eigen pagina van het event toegevoegd.',
    },
    discord: {
      title: 'Wat Discord ziet',
      body: [
        'De aankondiging gaat online zodra je hem plant en wordt ter plekke bijgewerkt zodra je iets wijzigt, dus er is nooit een verouderde kopie. Een herhalend event krijgt de markering **every week**.',
        'Vijftien minuten vooraf plaatst het **Starting in 15 minutes**, en bij de start **Starting now**. Als je de tijd verzet, verschuiven de herinneringen mee. Afblazen (**Cancel**) markeert het bericht als **Cancelled**, zodat niemand komt opdagen.',
      ],
    },
    manage: {
      title: 'Aanmeldingen, kosten en uitbetalingen',
      intro: 'Open het event om te wijzigen wat het gebruikt. Alles staat in het begin uit:',
      rows: [
        {
          term: 'Aanmeldingen',
          body: 'met **Places** (leeg voor geen limiet), wanneer **Sign-ups close**, en **Sign-up questions**. **You approve each one** laat elke aanmelding wachten op de staf.',
        },
        {
          term: 'Knop “I’m going”',
          body: 'uit maakt het alleen informatie: geen knop of telling op de site, in de plugin of in Discord.',
        },
        {
          term: 'Inleg',
          body: 'zet aanmeldingen aan. Voeg eigen gp toe aan de pot onder **Added to the pot**.',
        },
        {
          term: 'Uitbetalingen',
          body: 'de pot is de kosten plus wat je zelf hebt toegevoegd. Noem **Who** wat krijgt en **For** waarvoor, en markeer elk als **Paid**. Anvil waarschuwt je als je meer uitbetaalt dan de pot.',
        },
        {
          term: 'Enquête achteraf',
          body: 'opent zodra het eindigt. Alleen staf ziet de antwoorden. Als er aanmeldingen waren, wordt alleen aan de mensen die zich hebben aangemeld gevraagd.',
        },
        {
          term: 'Een wekelijks event',
          body: '**Every week is…** **Its own** (aanmeldingen, pot en enquête elke week) of **One run** (één aanmelding, pot en enquête voor de hele reeks).',
        },
      ],
    },
    players: {
      title: 'Wat leden zien',
      body: [
        'De eventpagina toont **When**, **Where**, **Host**, **Discord**, **Entry** en **Prizes**, met **Live now** zolang het bezig is. Leden drukken op **I’m going** of **Sign me up**, of op **Ask to sign up** wanneer de staf elke aanmelding goedkeurt. Het staat ook in het tabblad **Clan** van het zijpaneel van de plugin, met dezelfde knoppen.',
        'Alleen leden van de clan kunnen zeggen dat ze komen of zich aanmelden.',
      ],
    },
    calendar: {
      title: 'De planning',
      body: [
        '**Schedule** zet borden, wekelijkse wedstrijden en clanevents op één kalender, met een filter voor elk.',
        'Elke periode van twee of meer dagen zonder iets ertussen wordt als gat gemarkeerd, met **Fill the gap** om er iets in te plannen. Gebruik dit om de clan bezig te houden tussen grote events door, in plaats van een rustige twee weken te laten verstrijken.',
      ],
    },
  },
  challenges: {
    metaTitle: 'Challenges en vriendenevents — Anvil',
    metaDescription: 'Challenges van man tegen man op Anvil (eerst een drop, de meeste kills of de meeste XP binnen 1 uur, 24 uur of 7 dagen) en vriendenevents voor Supporters: privéborden voor je vrienden achter één uitnodigingslink.',
    eyebrow: 'Anvil · voor spelers',
    title: 'Challenges en vriendenevents',
    dek: 'Twee manieren om tegen mensen die je kent te spelen zonder clanevent: een **challenge** is de ene speler tegen één andere, en een **friends event** is een privébord voor een groep, achter een uitnodigingslink.',
    facts: [
      {
        strong: '1 uur tot 7 dagen',
        rest: 'per challenge',
      },
      {
        strong: 'Bewijs van kunnen',
        rest: 'geen inzet, geen gp',
      },
      {
        strong: 'Tot 50 vrienden',
        rest: 'per vriendenevent, op niveau',
      },
    ],
    footnote: 'Niveaus en wat elk host, staan in [Anvil Supporter: niveaus en voordelen]({supporterGuide}).',
    start: {
      title: 'Daag iemand uit',
      intro: 'Je hebt een geverifieerd character nodig, en zij ook.',
      steps: [
        'Open [Challenges](/challenges), of druk op **Challenge <name>** op het profiel van een speler.',
        'Typ onder **Who** hun naam, en kies onder **Playing as** je eigen character. Het moet geverifieerd zijn.',
        'Kies de race: **First to a drop** (tot 5 items, allemaal monsterdrops), **Most kills** van een boss, of **Most XP** in één skill of in totaal.',
        'Kies de tijdslimiet: **1 hour**, **24 hours** of **7 days**. Vink **OK to show the result publicly** aan als je het niet erg vindt om gezien te worden; het is alleen openbaar als jullie beiden het aanvinken.',
      ],
      outro: 'Zij krijgen een melding en een Discord-bericht, en hebben 24 uur om te **Accept**, **Decline** of **Decline and block**. De klok start zodra zij accepteren.',
    },
    rules: {
      title: 'Hoe het wordt beslist',
      intro: 'Anvil regelt het zelf, binnen een minuut na het einde.',
      rows: [
        {
          term: 'Kills en XP',
          body: 'beide startlijnen worden genomen als het wordt geaccepteerd; wie aan het eind het meest wint, wint, en gelijke winst is gelijkspel. Hiscores en de plugin tellen allebei mee, welke het hoogst is.',
        },
        {
          term: 'Eerst een drop',
          body: 'de eerste van jullie die een van de items krijgt, wint, meteen. Drops worden alleen door de plugin gezien, dus jullie hebben er allebei een nodig. Krijgt niemand er op tijd een: gelijkspel.',
        },
        {
          term: 'Afblazen',
          body: 'je kunt je eigen challenge intrekken zolang er nog niet op is gereageerd. Zodra hij loopt, stopt hij alleen als jullie beiden akkoord gaan.',
        },
      ],
    },
    limits: {
      title: 'Limieten en nee zeggen',
      body: [
        'Open challenges (wachtend of lopend, verstuurd of ontvangen) zijn beperkt per niveau: **1** gratis, **5** voor Supporters, onbeperkt voor Champions en Patrons. Iedereen kan er tot 20 per dag starten, en maar één tegelijk met dezelfde persoon.',
        'Geen zin in? **Turn away all new challenges**, of blokkeer één persoon wanneer je weigert. Wie jou uitdaagt, ziet in beide gevallen dezelfde weigering, dus die kan niet zien dat hij is geblokkeerd.',
        'De pagina houdt **Your record** bij (winst, verlies en gelijkspel), wat **Open now** is, en je **Your limit**.',
      ],
    },
    friends: {
      title: 'Een vriendenevent hosten',
      body: [
        'Elke Supporter, Champion of Patron kan een privébord voor vrienden draaien vanaf [Host](/host) → **Host for friends** → **New friends event**. Het is een volledig bord: bingo of een vakjesrace, bijgehouden door de plugin, met dezelfde opzet als het event van een maker.',
        'Stuur de **Invite link**; het is de enige weg naar binnen. Vrienden openen hem, loggen in met Discord en drukken op **Open the event**. Meedoen is altijd gratis. Als de link uitlekt, maak een nieuwe: de oude werkt niet meer en iedereen die al binnen is, blijft binnen.',
        'Een vriendenevent wordt nergens op Anvil vermeld, en heeft geen clan nodig.',
      ],
      table: {
        areaLabel: 'Niveau',
        columns: [
          'Spelers',
          'Tegelijk actief',
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
        tag: 'Als je niveau eindigt',
        body: 'Vrienden die er al in zitten, blijven erin. Nieuwe vrienden kunnen niet meer meedoen zodra je de nieuwe limiet hebt bereikt, en je kunt er geen andere starten tot je er weer onder zit.',
      },
    },
  },
  clanHall: {
    metaTitle: 'Clans, events en ranglijsten vinden — Anvil',
    metaDescription: 'Een OSRS-clan vinden in de Clan Hall van Anvil, twee clans vergelijken, de wekelijkse ranglijsten voor spelers en clans, de openbare eventlijst, en pagina’s van in-game clans die niet op Anvil staan.',
    eyebrow: 'Anvil · voor spelers en clans',
    title: 'Clans, events en ranglijsten vinden',
    dek: 'De openbare pagina’s van Anvil om rond te kijken: de **Clan Hall** om een clan te vinden, de lijst **Events** om iets te vinden om aan mee te doen, en het **Leaderboard** om te zien wie het meest wint.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: 'alleen openbare clans',
      },
      {
        strong: 'Leaderboard',
        rest: 'deze week, 30 dagen, altijd',
      },
      {
        strong: 'Events',
        rest: 'alleen wat de host heeft aangekondigd',
      },
    ],
    footnote: 'Om je eigen clan te laten vermelden, zie [Een clan starten]({clanGuide}); geboostte clans staan in de spotlight, zie [Een clan boosten]({boostsGuide}).',
    hall: {
      title: 'De Clan Hall',
      body: [
        '[Clan Hall](/clans) toont elke openbare clan. Zoek op naam of slogan, en beperk het tot **Taking members** of **Open to challenges**. **Most active** (de volgorde waarin het opent) zet clans waarvan de leden deze week het meest hebben gewonnen eerst; **Biggest** sorteert op leden.',
        'Elke kaart zegt of de clan **Recruiting** is en hoe hij gasten opneemt: **Guests welcome**, **Guests by approval** of **No guests**. Geboostte clans krijgen de uitgelichte rijen bovenaan, en makers hebben een eigen rij.',
      ],
      note: {
        tag: 'Niet vermeld?',
        body: 'Alleen clans die op openbaar staan, verschijnen, en een clan kan zijn vermelding uitzetten in zijn instellingen. Privéclans staan nooit in de Clan Hall, het leaderboard of vergelijkingen.',
      },
    },
    compare: {
      title: 'Twee clans vergelijken',
      body: [
        '[Compare clans](/compare/clans) zet twee willekeurige vermelde clans naast elkaar. Wil je in plaats daarvan twee characters vergelijken, gebruik dan [Compare](/compare).',
      ],
    },
    board: {
      title: 'Het leaderboard',
      body: [
        '[Leaderboard](/leaderboard) rangschikt spelers en clans op ervaring, efficiënte uren en bossen over **This week**, **30 days** of **All time**. Spelers kunnen worden beperkt tot **Regular**, **Ironman**, **Hardcore**, **Ultimate** of **Group** accounts.',
        'Clans worden gerangschikt op de XP die hun leden hebben gewonnen. Alleen geverifieerde clans die in de Clan Hall staan, verschijnen. De winst van een gast telt voor zijn eigen clan, niet voor de clan waar hij gast is.',
      ],
    },
    events: {
      title: 'Vind een event om aan mee te doen',
      body: [
        '[Events](/events) toont wat er op Anvil live is en wat eraan komt. Filter op **Live now**, **Open to join** of **Starting this week**, op format of **Solo**, op **Anyone can join** of **Ask or meet a rule**, en op **Clans** of **Creators**. **Join** brengt je naar de aanmelding.',
        'Alleen events waarvan de host **Advertise on Anvil** heeft aangezet, verschijnen. Events alleen voor leden en op uitnodiging nooit.',
      ],
    },
    ghost: {
      title: 'In-game clans die niet op Anvil staan',
      body: [
        'De pagina van een character noemt de in-game clan waarin het zit. Staat die clan niet op Anvil, dan opent de link een eenvoudige pagina met de Anvil-spelers die erin zitten en ervoor kiezen dat te tonen. Het is niet de ledenlijst van die clan, en niets op de pagina maakt iemand lid.',
        'Is het jouw clan, dan zet **Bring your clan to Anvil** er één op. Zodra het een openbare Anvil-clan is, gaat de link rechtstreeks ernaartoe.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: 'In-game gidsen: lezen, voorstellen en clankopieën — Anvil',
    metaDescription: 'De gidsenbibliotheek van Anvil: gidsen voor raids, bossen, skilling en geldverdienen op de site, in het spel en in Discord. Lezen per niveau, een nieuwe gids of wijziging voorstellen, en hoe een clan bibliotheekgidsen kopieert en bewerkt.',
    eyebrow: 'Anvil · voor spelers en clanstaf',
    title: 'In-game gidsen',
    dek: 'Naast deze how-to-pagina’s houdt Anvil een bibliotheek met spelgidsen bij: raids, bossen, skilling en geldverdienen. Iedereen kan ze lezen, iedereen die is ingelogd kan er een voorstellen, en een clan kan zijn eigen kopieën bewaren.',
    facts: [
      {
        strong: 'Drie niveaus',
        rest: 'Beginner, Intermediate, Advanced',
      },
      {
        strong: 'Iedereen kan voorstellen',
        rest: 'de staf bekijkt elk voorstel',
      },
      {
        strong: '/guide',
        rest: 'plaatst er één in Discord',
      },
    ],
    footnote: 'Slash-commando’s staan in [Slash-commando’s]({commandsGuide}).',
    read: {
      title: 'Een gids lezen',
      body: [
        'Open het tabblad **In-game guides** op de gidsenpagina, of [/guides](/guides) op de site van je clan. De lijst van een clan heeft zijn eigen gidsen plus de bibliotheekgidsen die het nog niet heeft gekopieerd.',
        'Veel gidsen hebben bovenaan een niveauschakelaar: **Beginner**, **Intermediate** en **Advanced**. De delen voor andere niveaus klappen in, zodat een nieuweling en een speedrunner dezelfde pagina lezen.',
        'In Discord plaatsen `/guide` en het begin van een naam de kaart van een gids met een link naar de volledige pagina.',
      ],
    },
    propose: {
      title: 'Een gids of wijziging voorstellen',
      body: [
        'Ingelogd, open [Propose a guide](/guides/propose) om een nieuwe te schrijven, of stel een wijziging voor aan een bestaande bibliotheekgids. Vertel de beoordelaar wat je hebt veranderd en waarom; je kunt je wijzigingen naast de huidige gids tonen voordat je verstuurt.',
        'Druk op **Send for review**. [My guide proposals](/guides/proposals) toont elk voorstel als **pending**, **approved**, **rejected** of **withdrawn**, met de notitie van de beoordelaar zodra er een antwoord is. Zolang het in behandeling is, kun je het bewerken of **Withdraw** doen. Je kunt er 5 tegelijk in de wachtrij hebben.',
        'Niets gaat live totdat de gidsredacteuren van Anvil het goedkeuren. Een goedgekeurde wijziging werkt ook elke clankopie bij die niet is aangepast.',
      ],
    },
    clan: {
      title: 'De gidsen van je clan',
      intro: 'Admins, en moderators die gidsen mogen schrijven, beheren ze onder **Guides** in het admin-menu.',
      rows: [
        {
          term: 'Bibliotheekgidsen op onze site tonen',
          body: 'aan: bibliotheekgidsen die je nog niet hebt gekopieerd, staan ook op je pagina Guides, altijd actueel.',
        },
        {
          term: 'Naar onze gidsen kopiëren',
          body: 'maakt een clankopie. Die **volgt de bibliotheek** tot je hem bewerkt, en neemt elke wijziging in de bibliotheek over.',
        },
        {
          term: 'Een kopie bewerken',
          body: 'maakt hem **aangepast**, de eigen versie van de clan. Verandert de bibliotheekgids later, dan staat er **update available**: neem de nieuwe versie of hou de jouwe.',
        },
        {
          term: 'Nieuwe gids',
          body: 'schrijft er één die alleen je clan heeft, zoals je eigen raidregels of een massagids.',
        },
      ],
      note: {
        tag: 'Ze posten',
        body: 'Gidsen kunnen naar een Discord-kanaal worden gepost, en die berichten worden ter plekke bewerkt wanneer de gids verandert.',
      },
    },
  },
};

export default nl;
