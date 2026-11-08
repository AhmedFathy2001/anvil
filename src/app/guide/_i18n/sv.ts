import type { PartialGuideDict } from './en';

// Svenska — Swedish.
//
// Samma konvention som i alla andra språkfiler här: allt läsaren FAKTISKT SER på skärmen i Anvil,
// RuneLite och OBS står kvar på engelska — menyer i RuneLite och OBS, pluginets egna chattrader, och
// Anvils adminetiketter, som är engelska tills den ytan också översätts. En översatt "Tracked drop
// detected" är en rad ingen hittar igen. Discords egna UI-etiketter (menyer, inställningar,
// behörighetsnamn) följer Discords svenska översättning: "Kopiera server-ID",
// "Serverinställningar → Roller", "Hantera webhooks". Allt annat — förklaringen, ordningen, varför —
// är svenska.

const sv: PartialGuideDict = {
  common: {
    contents: 'Innehåll',
    step: 'Steg',
    optional: 'valfritt',
    minRead: '{n} min läsning',
    copyLink: 'Kopiera en länk till det här avsnittet',
    linkCopied: 'Länk kopierad',
    language: 'Språk',
    partialNotice:
      'Den här guiden är bara delvis översatt till {language}. Det som ännu inte är översatt visas på engelska.',
    backToGuides: 'Alla guider',
    unreviewedNotice:
      'Den här översättningen till {language} har ännu inte lästs igenom av någon som har språket som modersmål. Om en mening känns fel är [den engelska sidan]({englishHref}) originalet — och [att säga till](/feedback) är det som får den rättad.',
    support: {
      lead: 'Fastnat, eller ser något fel ut?',
      link: 'Fråga i Anvils support-Discord',
    },
  },

  index: {
    metaTitle: 'Guider — Anvil',
    metaDescription:
      'Kom igång med Anvil: RuneLite-pluginet för spelare, att köra ett event för klanens stab, och att vara värd för en gästklan.',
    title: 'Guider',
    dek: 'Allt du behöver för att komma igång, skrivet för exakt den version av Anvil som körs här.',
    groups: {
      playing: 'Att spela',
      running: 'Att köra ett event',
      clan: 'Att sköta klanen',
      streamers: 'Streamers',
    },
    anvilTab: 'Använda Anvil',
    ingame: {
      title: 'Guider för spelet',
      dek: 'Raids, bossar, skilling och pengar från Anvil-biblioteket — samma guider som pluginet visar i spelet och boten postar i Discord.',
      browse: 'Visa alla guider',
      language: 'De här guiderna är inte översatta: de visas som de skrevs, oavsett vilket språk den här sidan är på.',
      empty: 'Anvil-biblioteket har inga publicerade guider än. Titta in snart igen.',
      placeholder: 'Sök i guider för spelet — prova "zulrah", "raids" eller "money"',
      readTime: '{n} min läsning',
      metaTitle: 'OSRS-guider för spelet — Anvil',
      metaDescription: 'Guider för raids, bossing, skilling och pengar från Anvil-biblioteket — att läsa på sajten, i spelet via RuneLite-pluginet och i Discord.',
    },
    search: {
      placeholder: 'Sök i guiderna — prova "webhook", "rutor" eller "drops syns inte"',
      results: '{n} guider',
      empty: 'Inget matchade. Prova ett enklare ord — "rutor", "utbetalning", "bot" — eller bläddra i listan nedan.',
      clear: 'Rensa sökningen',
    },
    cards: {
      tiles: {
        eyebrow: 'För spelare',
        title: 'Rutregler och begränsningar',
        blurb: 'Vad en ruta kräver av dig innan du börjar (en spelinställning, pluginet, en synkad logg, en hiscores-placering) och vad den inte kan spåra.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'För den som sköter servern',
        title: 'Anvil i Discord',
        blurb: 'En inbjudan, sedan kanalerna varje flöde postar i, roller, snedstreckskommandon, och vad du kollar när det tystnar.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Byt till Anvil',
        title: 'Byt från andra plugins och spårare',
        blurb:
          'Anvil postar dina drops på Discord och kör era veckotävlingar. Fem steg för staben, två för spelarna.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'För dig som startar en',
        title: 'Starta en klan',
        blurb: 'Två namn och en adress, så är den live. Sedan Discord, medlemslistan och första brädet.',
        minutes: '~4 min, gratis',
      },
      plugin: {
        eyebrow: 'För spelare',
        title: 'Installera RuneLite-pluginet',
        blurb:
          'Installera pluginet, logga in från dess sidopanel och låt det skicka in dina drops. Täcker även Discord-notiser och spelaruppslag.',
        minutes: '~3 min installation',
      },
      board: {
        eyebrow: 'För brädbyggare',
        title: 'Bygg en bräda som spårar sig själv',
        blurb:
          'Vad varje rutsort faktiskt kan se, massredigering via kalkylark, och misstagen som importeras snyggt och sedan aldrig utlöses.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'För lagkaptener',
        title: 'Kaptensguiden',
        blurb:
          'Att läsa poolen innan klockan startar, själva draftdagen, och de delar av att leda ett lag som börjar efteråt.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'För klanens stab',
        title: 'Format, och hur rutor öppnas',
        blurb:
          'Sju brädformer, fem sätt rutor blir spelbara på, och de tre modifierarna som avgör vad ett avklarat mål är värt.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'För kassörer',
        title: 'Avgifter och utbetalningar',
        blurb:
          'Att ta ut en anmälningsavgift, samla in den, den andra signaturen som avslutar den, och att göra en pott till betalda placeringar.',
        minutes: '~5 min',
      },
      coffer: {
        eyebrow: 'För kassörer',
        title: 'Klankassan',
        blurb:
          'En kassa för klanens gp: vad som kommer in, de tre sätt den betalar ut priser på, och vem som får röra den.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'För moderatorer',
        title: 'På passet',
        blurb:
          'Kön, granskning av inskickade bevis och konton, att hålla medlemslistan ärlig, och bedömningarna som landar hos en människa.',
        minutes: '~5 min',
      },
      admin: {
        eyebrow: 'För klanens stab',
        title: 'Så kör du ditt första event',
        blurb:
          'Discord, medlemslista, brädor, rutor, lag och draft, start — och vad du gör när eventet är slut.',
        minutes: 'en kväll, en gång',
      },
      clanVsClan: {
        eyebrow: 'För värdar',
        title: 'Att vara värd för en gästklan',
        blurb:
          'Klan mot klan utan att samla in ett enda RSN för hand: en inbjudningslänk per lag, och en plats som låter deras egen moderator sköta sin halva.',
        minutes: '~5 min per lag',
      },
      commands: {
        eyebrow: 'För alla medlemmar',
        title: 'Snedstreckskommandon',
        blurb:
          'Varje kommando boten svarar på i Discord, vad varje alternativ gör, genomgångna exempel, och vad du kollar när ett inte dyker upp.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'För streamers',
        title: 'Håll event för dina tittare',
        blurb:
          'Ingen klan behövs. Skapa ett utrymme, dela en länk, välj vem som får gå med (följare, subs, Discord-roller) och visa brädet på streamen.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'För tittare',
        title: 'Gå med i en streamers event',
        blurb:
          'Fått en länk från en stream? Logga in, lägg till din karaktär, tryck på Join. Vad du gör för event för följare eller subs.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'För klaner som streamar',
        title: 'Streaming för klaner',
        blurb:
          'Låt dina tittare spela ett event utan att gå med i klanen. Slå på Streaming och öppna sedan ett event för tittare.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'För klanens stab',
        title: 'Dina medlemmar: medlemslista, gäster och vem som får gå med',
        blurb:
          'Var medlemmarna kommer ifrån, vad filtren på Roster-fliken betyder, ansökningar om att gå med och Needs review, de tre inställningarna under Who can join, och hur du tar bort eller bannlyser någon.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'För ägare och admins',
        title: 'Stabsroller: vem får göra vad',
        blurb:
          'Ägare, admin, kassör och moderator: vad varje roll når, hur du gör någon till moderator, vem som kan ge vilken roll, och uppgifter som bara gäller ett event.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'För spelare',
        title: 'Anvil Supporter: nivåer och förmåner',
        blurb:
          'Supporter, Champion och Patron: namnfärger, stjärnan, profilbilder, montern, vänevent och klanboosts, hur betalningen fungerar och vad som händer om du slutar.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'För spelare',
        title: 'Sidopanelen, flik för flik',
        blurb:
          'Clan, Feed, You, Lookup och kugghjulet: vad varje flik visar, eventchatt, GZ- och Sad-reaktioner, och inställningarna som tar in flödet och Supporter-färgerna i ditt spel.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'För Supporters och klanens stab',
        title: 'Boosta en klan',
        blurb:
          'Att placera och flytta en boost, de tre nivåerna och vad var och en låser upp, klanens namnfärger, boosts i gåva, och boostermärken och badges.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'För spelare',
        title: 'Din profil, Wrapped och Compare',
        blurb: 'Din profil, varje karaktärs publika sida och din personsida, vem som kan se dem, månatliga och eventbaserade Wrapped-kort, och att jämföra två karaktärer.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'För spelare',
        title: 'Inställningar, sida för sida',
        blurb: 'Discord-inlägg och skärmbildsintegritet, chattflödet i spelet, enheter, egna webhooks, vem som ser dina karaktärer, varje karaktär och ägandeanspråk.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'För spelare',
        title: 'Utmaningar och vänevent',
        blurb: 'Utmana en spelare i ett drop-, dödsantals- eller XP-lopp, och var värd för en privat bräda för dina vänner bakom en enda inbjudningslänk.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'För spelare och klaner',
        title: 'Hitta klaner, event och ledartavlor',
        blurb: 'Clan Hall, jämförelse av två klaner, veckans ledartavla, den publika eventlistan och sidor för klaner i spelet som inte finns på Anvil.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'För spelare och klanstab',
        title: 'Guider i spelet',
        blurb: 'Läsa guidebiblioteket efter nivå, föreslå en ny guide eller en ändring, och hålla din klans egna kopior.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'För klanstab och spelare',
        title: 'Skill och Boss of the Week',
        blurb: 'Schemalägga en veckotävling, upprepa och rotera den, startlinjer, priser, avsluta i förtid och vad spelarna ser.',
        minutes: '~4 min',
      },
      teamComps: {
        "eyebrow": "För klanledare och spelare",
        "title": "Lagtävlingar",
        "blurb": "Skill- och bosstävlingar som lag eller klan mot klan: så ställer du in dem, bjuder in klaner, hur summor och medelvärden räknas och vad spelarna ser.",
        "minutes": "~4 min"
      },
      clanEvents: {
        eyebrow: 'För klanstab',
        title: 'Klanevent och schemat',
        blurb: 'Massor, raidkvällar och träffar: veckovisa upprepningar, “jag är med” och anmälningar, Discord-påminnelser, utbetalningar, enkäter och att hitta luckor i schemat.',
        minutes: '~4 min',
      },
    },
  },

  switching: {
    metaTitle: 'Byt från andra plugins och spårare — Anvil',
    metaDescription:
      'Flytta din klan till Anvil: ställ in Discord-kanalerna, synka klanlistan, starta Skill eller Boss of the Week och berätta för dina medlemmar.',
    eyebrow: 'Byt till Anvil',
    title: 'Byt från andra plugins och spårare',
    dek: 'Anvil postar klanens drops och bedrifter till Discord. Det håller också klanlistan och kör de veckovisa tävlingarna.',

    staff: {
      title: 'Om du driver klanen',
      body: [
        '**Låt boten ställa in era kanaler.** Gå till Admin → Discord → **Set it up for me**. Välj en kanal eller flera. Om ett annat plugin postade någonstans, kryssa i _Use the same channels_. Inget ändras för dina medlemmar.',
        '**Synka klanlistan.** Öppna Anvil-pluginets inställningar i RuneLite. Slå på **Keep the clan roster in sync**. En admin gör detta en gång, i spelet. Det ersätter klanlistan du höll någon annanstans.',
        '**Starta en Skill eller Boss of the Week.** Gå till Admin → All events → **+ New event** och välj Skill of the Week eller Boss of the Week. Alla på klanlistan är med automatiskt. Det ersätter tävlingar du körde någon annanstans.',
        '**Berätta för dina medlemmar.** Gå till Admin → Discord → **Tell your members** → **Post it**. Boten postar spelarstegen åt dig.',
        '**En vecka senare: städa upp.** Gå till Admin → Discord → **Remove old webhooks from other plugins**, kryssa i dem som ska bort, tryck på **Remove … webhooks** och sedan **Yes, remove them**. Efter det kan inget postas två gånger. Tryck på **Keep** på dem du vill låta vara.',
      ],
    },

    player: {
      title: 'Om du är spelare',
      body: [
        '**Installera Anvil.** Öppna Plugin Hub i RuneLite, sök efter Anvil och tryck på **Install**. Logga sedan in med Discord från Anvils sidopanel.',
        '**Stäng av notiserna från ditt gamla plugin** så att inget postas två gånger. Eller avinstallera det, om du inte använder det till något annat.',
        '**Det var allt.** Det finns inget mer att ställa in.',
      ],
    },

    questions: {
      title: 'Frågor',
      intro: 'De som klaner frågar oftast om:',
      rows: [
        {
          term: 'Spårar Anvil kill counts, slayer-uppdrag och personbästa?',
          body: 'Ja. Anvil spårar kill counts, slayer-uppdrag och personbästa själv, så det finns inget annat att hålla igång.',
        },
        {
          term: 'Måste spelarna klistra in en webhook någonstans?',
          body: 'Nej. Klanen väljer kanalerna på sajten.',
        },
        {
          term: 'Vill du ha inlägg på din egen server också?',
          body: 'Gå till din profil → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Starta en klan — Anvil',
    metaDescription: 'Skapa en klan på Anvil: namnge den, välj adress, koppla Discord, synka medlemslistan och kör ditt första event.',
    eyebrow: 'Anvil · komma igång',
    title: 'Starta en klan',
    dek: 'Två namn och en adress, så är din klan live — gratis, och det finns inget att vänta på. Det är detta, plus de fyra sakerna som är värda att göra direkt efteråt.',
    facts: [
      {
        strong: 'Gratis',
        rest: 'inget kort, ingen provperiod',
      },
      {
        strong: 'Live',
        rest: 'i samma stund du skickar',
      },
      {
        strong: '~4 min',
        rest: 'till en fungerande klan',
      },
    ],
    footnote: 'Allt detta kan du ändra senare under Admin → **Clan settings**, utom adressen — den är värd en tanke nu.',
    before: {
      title: 'Innan du börjar',
      body: [
        'Du behöver ett Discord-konto, och det är hela listan. Logga in på `{apex}` först: en klan måste ha en ägare, och inloggningen är hur sidan vet att det är du. Börja från **Starta en klan** på plattformssidorna, eller gå direkt till `{apex}/clans/new`.',
        'Det kostar ingenting. Ingen plan att välja, inget kort att fylla i, och ingen provperiod som går ut och tar ditt bräde med sig — en klan startar gratis och fortsätter fungera.',
        'Stora klaner kan senare gå upp till en större plan via **Plan and billing** i Admin. Allt du betalar för på Anvil — en klan, ett creator-utrymme eller ditt eget Supporter-medlemskap — finns på [din faktureringssida](/portal).',
      ],
      note: {
        tag: 'Du blir dess ägare',
        body: 'Ägare är den enda roll ingen kan ta ifrån dig, och den går till den som skapar klanen. Lägg till personal efteråt under Admin → **People** → **Staff & roles**; se [På schemat]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Namnge den, och välj adress',
      intro: 'Tre fält, och bara två verkliga beslut. Formuläret kontrollerar adressen medan du skriver och säger till innan du skickar.',
      fields: [
        {
          term: 'Klannamn i spelet',
          body: 'Obligatoriskt, och det måste stämma **exakt** med OSRS. Det är ingen dekoration: rostersynkroniseringen matchar på det och avvisar en medlemslista som rapporteras under något annat namn. Det är det som hindrar någon annans medlemslista från att hamna på din sida.',
        },
        {
          term: 'Klannamn',
          body: 'Valfritt. Det folk ser — på sidan och i varje Discord-inlägg. Lämna det tomt så används ditt spelnamn för båda.',
        },
        {
          term: 'Adress',
          body: 'Din klan bor på `{apex}/c/din-slug`. Den föreslås utifrån namnet du skrev, du kan ändra den, och en handfull ord är reserverade. Välj en du fortfarande gillar om ett år: det är länken som hamnar fastnålad i din Discord.',
        },
      ],
      note: {
        tag: 'Spelnamnet är ett lås, inte en etikett',
        body: 'Om din klan byter namn i spelet, ändra det här också — tills dess avvisar rostersynkroniseringen det nya namnet. Det är kontrollen som fungerar, inte ett fel.',
      },
    },
    live: {
      title: 'Den är live',
      body: [
        'Tryck **Skapa klan**, så finns den. Ingen provisionering, ingen kö, inget ”vi bygger din sida, kom tillbaka om några minuter” — en klan är en rad, så den körs redan innan sidan hunnit byta.',
        'Du landar på ett val mellan **Sätt upp den**, som öppnar guiden, och **Titta runt först**. Inget går sönder om du går därifrån och kommer tillbaka i morgon; guiden minns vilka steg du gjort.',
      ],
    },
    setup: {
      title: 'Installationsguiden',
      intro: 'Tre steg står mellan en färsk klan och ett event i gång, och guiden går igenom dem i ordning och hoppar över det du redan gjort. Brädet kommer direkt efter.',
      steps: [
        {
          term: 'Din klan',
          body: 'Ditt visningsnamn, ditt klannamn i spelet och en inbjudningslänk till din server. Inbjudan är det som låter anmälningssidor och guider peka folk till dig.',
        },
        {
          term: 'Koppla Discord',
          body: 'En delad bot, så det finns ingen applikation att registrera och ingen token att klistra in. Tryck på **Connect your bot** och godkänn den en gång, välj sedan **A few channels** eller **Just one channel** och tryck på **Set it up for me** — boten skapar kanalerna åt dig.',
        },
        {
          term: 'Få in dina medlemmar',
          body: 'Installera pluginet, logga in med Discord, öppna sedan klanfönstret i spelet och tryck på **Anvil**-knappen i titelraden. Ingen kan anmäla sig till ett event förrän din medlemslista är inne.',
        },
        {
          term: 'Gör ett bräde',
          body: 'Guiden slutar på **Create your first event →**. Välj format, lägg till rutor, öppna anmälan — det är [Kör ditt första event]({adminGuide}), och klart det längsta steget.',
        },
      ],
      after: [
        'Du kan hoppa över guiden helt med **Skip setup** och göra allt senare under Admin → **Clan settings** och Admin → **Discord**. Den finns för att ordningen spelar roll när man aldrig gjort det förut: Discord före kanaler, medlemmar före ett bräde de behöver anmäla sig till.',
      ],
    },
    members: {
      title: 'Få in dina medlemmar',
      body: [
        'Ingen behöver anmäla sig, registrera sig eller bjudas in en i taget. Din medlemslista kommer från spelet.',
      ],
      ways: [
        {
          term: 'Rostersynkronisering (ta den här)',
          body: 'Öppna klanfönstret i spelet med pluginet igång och tryck **Anvil**-knappen i titelraden. Hela din medlemslista kommer in med rangerna kvar, och en lista från en klan vars namn inte stämmer med ditt avvisas. Upprepa det när folk kommer eller går — se [installationsguiden för spelare]({pluginGuide}).',
        },
        {
          term: 'De ansöker om att gå med',
          body: 'Att logga in eller spela med pluginet ger aldrig någon en plats av sig självt. Ser pluginet någon spela i din klan i spelet innan din medlemslista har hen, skapar det en ansökan om att gå med åt hen, och alla andra kan fråga med **Apply** på er klansida. Staben svarar på båda överst på fliken **Roster**, och **Who can join** avgör om de väntar på ett ja, kommer in direkt eller inte kan fråga alls. Den som spelar en karaktär som redan står på din medlemslista bekräftas i stället under **Needs review**. Detaljerna finns i [Dina medlemmar]({peopleGuide}).',
        },
        {
          term: 'För hand',
          body: 'Admin → **People** → **+ Add Manually** tar namn ett i taget, för den som spelar på mobil eller den officiella klienten och inte kan köra pluginet alls.',
        },
      ],
      note: {
        tag: 'Gäster är inget problem att lösa',
        body: 'En gäst spelar i dina event utan att vara med i din klan i spelet: en spelare från en gästklan, en vän, ett alt. Hen får en plats när staben godkänner hens ansökan, eller direkt om **Who can join** är inställt på **Let anyone in**. Gäster spåras och kan delta i event, och de räknas inte mot din plan. Den som går med i din klan i spelet blir medlem vid nästa synk av medlemslistan.',
      },
    },
    first: {
      title: 'Ditt första event',
      body: [
        'Kortaste vägen till att något händer: gör ett bräde, lägg till en handfull rutor som pluginet ser själv, öppna anmälan, och starta. Drops, killcounts och XP skriver då in sig själva.',
        'Två guider bär lasset här. [Kör ditt första event]({adminGuide}) går från början till slut — Discord, lag, start, och vad man gör när det tar slut. [Bygg ett bräde som följer sig självt]({boardGuide}) handlar särskilt om rutor: vad varje sort faktiskt kan upptäcka, och de som importeras snyggt och sedan aldrig utlöser.',
        'Vill du helst inte bygga ett bräde alls första veckan, kör en **Skill of the Week** eller **Boss of the Week** i stället. Alla på listan är med automatiskt, ställningen kommer från hiscores, och det finns inget att skriva.',
      ],
    },
    together: {
      title: 'Event över flera klaner',
      body: [
        'Ett event behöver inte tillhöra en klan. Flera klaner kan köra samma bräde tillsammans — två, eller ett dussin — där varje sida behåller sin egen medlemslista, sin egen personal och sin egen halva av modereringen.',
        'De kan också dela en pool av spelare i stället för att sitta på var sin sida av en tabell: ett event, alla med, hur lagen än delas upp. Klan mot klan är en form av detta, inte den enda.',
        'Varje gästklan får en inbjudningslänk per lag, så att du aldrig samlar in ett enda RSN för hand, och en plats som låter deras egen moderator godkänna sina egna medlemmars bevis. [Vara värd för en gästklan]({clanVsClanGuide}) täcker att arrangera ett.',
      ],
      note: {
        tag: 'Inget att köpa',
        body: 'Att delta i någon annans event är gratis, och att arrangera ett är också gratis. En klan som bara dyker upp på andras bräden behöver aldrig mer än sin egen gratisklan.',
      },
    },

    boosts: {
      title: 'Klanboosts',
      body: [
        'Medlemmar som betalar för Anvil Supporter på nivån **Champion** (en boost) eller **Patron** (två) kan boosta klanen från sina egna **Settings → Clan boosts**. En boost räknas när personens plats i klanen är 14 dagar gammal, och högst två räknas från en och samma person.',
        'Du ser var ni står på Admin → **Clan settings** → **Boosts**: klanens nivå, hur många boosts som räknas och hur många fler nästa nivå behöver. Nivå 1 kräver 3 boosts, nivå 2 kräver 8 och nivå 3 kräver 15. Faller boostarna under en nivå ligger dess förmåner kvar en vecka först.',
        'Nivå 1 sätter ett **Boosted**-märke på er klansida, ert Clan Hall-kort och i sökningen, listar er ovanför oboostade klaner i Clan Hall och ger ert namn en gradient. Nivå 2 lägger till en plats i Clan Halls Featured-rad, spelar upp er animerade banner och låser upp en **Recruiting line**: en mening, upp till 140 tecken, som visas för besökare. Nivå 3 lägger till en Spotlight högst upp i Clan Hall och ett **Recruitment post in the Anvil Discord** i månaden, upp till 500 tecken, som skickas en gång med **Post to the Anvil Discord**, med en länk till er klansida och utan att någon pingas.',
      ],
      note: {
        tag: 'Bara utseende',
        body: 'Boosts ändrar hur klanen ser ut och var den listas. De ändrar aldrig en rang, en poäng, era platser eller er plan.',
      },
    },
    features: {
      title: 'Funktioner och plan',
      intro: 'Admins kan slå av och på hela delar av Anvil under **Features**. Av döljer dem från menyerna; inget raderas.',
      rows: [
        {
          term: 'Events',
          body: '**Skill & Boss of the Week** (på), **Surprise-task formats** (av), **Missions** (av), **Post-event survey** (av).',
        },
        {
          term: 'Money',
          body: '**Sign-up fees** (på), **Clan coffer** (av).',
        },
        {
          term: 'Discord & plugin',
          body: '**Post to Discord** (på), **Death & fun messages** (av), **Clan Hall card**, som visar vem som är online på er Discord på din publika klansida (på).',
        },
      ],
      outro: '**Plan and billing** visar din plan, hur många medlemmar du har jämfört med dess storlek, och de större planerna. Om du betalar finns **Manage subscription and invoices** där också.',
    },
  },

  discord: {
    metaTitle: 'Anvil i Discord — Anvil',
    metaDescription: 'Koppla Anvil-boten till din Discord-server: en inbjudan, kanalerna varje flöde postar i, roll- och smeknamnssynk, snedstreckskommandon, och vad du kollar när det tystnar.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil i Discord',
    dek: 'En bot, en inbjudan, och ingen applikation att registrera. Här står vad den postar, var den postar det, vad den får ändra på din server — och vad du tittar på den dag den slutar.',
    facts: [
      {
        strong: 'En bot',
        rest: 'delad, inget att skapa',
      },
      {
        strong: '~5 min',
        rest: 'från inbjudan till första inlägget',
      },
      {
        strong: 'Tillval',
        rest: 'varje flöde är av tills du riktar det någonstans',
      },
    ],
    footnote: 'Allt här ligger på Admin → **Discord**: snabbinstallationen överst, sedan **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands och Post without a bot.',
    bot: {
      title: 'En bot, redan byggd',
      body: [
        'Det finns ingen Discord-applikation att skapa, ingen token att generera och ingen hemlighet att klistra in. Anvil kör en bot som varje klan delar, så att koppla är en inbjudan och inget mer.',
        'Du kan ändå ta med din egen — klistra in en token under **Use your own bot instead (advanced)** så används den i stället. Värt det bara om du vill att boten ska bära din klans namn och avatar i medlemslistan; allt i den här guiden fungerar likadant oavsett.',
      ],
      permissions: [
        {
          term: 'Visa kanaler, Skicka meddelanden, Bädda in länkar, Bifoga filer',
          body: 'Grunderna. Utan dem är den på din server och tyst.',
        },
        {
          term: 'Hantera webhooks',
          body: 'Så att **Set it up for me** och **Post here** kan skapa webhooks åt dig i stället för att du kopierar URL:er ur Discord för hand, och så att Anvil kan hitta gamla webhooks som du kan ta bort.',
        },
        {
          term: 'Hantera roller',
          body: 'Bara om du slår på rollsynk. Då kan den dela ut rollerna du kopplar — och den kan aldrig röra en roll ovanför sin egen, vilket är Discords regel, inte vår.',
        },
        {
          term: 'Hantera smeknamn',
          body: 'Bara om du slår på smeknamnssynk, så att en medlems servernamn kan sättas till deras RSN.',
        },
        {
          term: 'Hantera kanaler',
          body: 'För privata lagkanaler under en draft, och för guider som postas som en ny kategori eller ett forum. Hoppa över den så fungerar allt annat ändå.',
        },
        {
          term: 'Hantera trådar, Skicka meddelanden i trådar',
          body: 'För guider i ett forum: att skriva i inlägget och ta bort det igen — Discord låter inte en bot radera ens sitt eget foruminlägg utan den.',
        },
        {
          term: 'Ändra smeknamn',
          body: 'Bara om du ger boten er klans namn under **Connection → Bot appearance in your server**. Det ändrar bara botens namn på er server.',
        },
      ],
      note: {
        tag: 'Den ber om allt på en gång',
        body: 'Discord kan inte be om en behörighet i efterhand, så inbjudningslänken begär hela uppsättningen, och funktionerna du aldrig slår på använder aldrig sina. Att öppna inbjudningslänken igen är också hur du reparerar en behörighet någon tagit bort.',
      },
    },
    connect: {
      title: 'Att koppla den',
      intro: 'Två saker, i den här ordningen. Boten måste finnas på din server, och Anvil måste veta vilken server som är din.',
      steps: [
        {
          term: 'Bjud in boten',
          body: 'Admin → **Discord** → **Connect your Discord server** (eller **Add Anvil to Discord**). Discord frågar vilken server Anvil ska läggas till på och skickar dig tillbaka hit, så du kan inte lägga till den på fel server av misstag. Senare finns **Invite / re-invite the bot** under **More settings → Connection**.',
        },
        {
          term: 'Ange server-id',
          body: 'Bara om knappen inte klarar det: öppna **Can’t use the button? Enter the server ID**, högerklicka din serverikon i Discord → **Kopiera server-ID** (kräver att Utvecklarläge är på, under Avancerat i Discords egna inställningar), klistra in det i **Your Discord server’s ID** och tryck på **Save**. Det är fältet som gör kopplingen till din.',
        },
      ],
      after: [
        'Panelen berättar sedan sanningen i stället för din avsikt: om boten faktiskt är medlem på den servern, och vilka behörigheter den saknar. En grön rad där är värd mer än ett sparat formulär.',
      ],
      note: {
        tag: 'Server-id:t är hela bindningen',
        body: 'En server tillhör exakt en klan på Anvil, och snedstreckskommandon från en server som ingen gjort anspråk på avvisas i stället för att gissas. Tills du anger det är boten inbjuden och overksam.',
      },
    },
    channels: {
      title: 'Konfigurera webhooks',
      body: [
        'Anvil postar genom **webhooks**, en per kanal, och varenda en är valfri. Inget postas någonstans förrän du riktar ett flöde mot en kanal — en färsk klan är tyst med flit, inte av misstag.',
        'Med Anvil-boten på din server skapar **Set it up for me** högst upp på **Admin → Discord** kanalerna och riktar varje flöde mot dem. Vill du göra det för hand öppnar du **More settings → What goes where** och börjar med **Catch-all channel** på **Clan & events**, sedan **In-game catch-all** på **In-game (plugin)**: välj en kanal i rullgardinen så sparas den. Utan boten går du i Discord till kanalens **Redigera kanal → Integrationer → Webhooks**, skapar en, kopierar URL:en, väljer **Paste a webhook…** i rullgardinen, klistrar in den och trycker på **Save**. En webhook-URL kan posta i kanalen, så behandla den som ett lösenord; radera den i Discord och skapa en ny om den läcker. **Test**, och **Add another** för att växla täta inlägg mellan två webhooks, finns under **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Catch-all channel',
          body: 'Den viktigaste, på fliken **Clan & events**. Event som startar och slutar, anmälan som öppnar, ställningar, veckoresultat — allt som sajten postar utan en egen kanal. Ange bara den, så har du en fungerande klan.',
        },
        {
          term: 'In-game catch-all',
          body: 'På fliken **In-game (plugin)**: dit allt från spelet går när det inte har en egen kanal. Ange den som nummer två.',
        },
        {
          term: 'De uppdelade flödena',
          body: 'Eventinlägg, bräden du är medarrangör för, Skill & boss of the week och händelser i klankalendern kan delas av från samlingskanalen; sällsynta drops, pets, collection log, nivåer, combat achievements, quests, diaries, dödsfall och PvP-kills kan delas av från spelets samlingskanal. Ändringar i medlemslistan, godkännanden av anmälningar och kassaboken ligger på **Staff only**. Tomma uppdelade flöden faller tillbaka till sin samlingskanal. Kassan är undantaget: tomt betyder inga inlägg om pengar alls. Leagues och andra spellägen har en egen flik, **Game modes**.',
        },
      ],
      note: {
        tag: 'Dela av dödsfallen först',
        body: 'Dödsfall är flödet med störst volym på de flesta bräden och det som begraver allt annat. Delar du av bara en sak, dela av den.',
      },
    },
    roles: {
      title: 'Roller och smeknamn',
      body: [
        'Båda synkroniseringarna är av tills du aktiverar dem under **Admin → Discord → Roles & nicknames**, och båda styrs av medlemslistan. Slå på **Enable Discord role sync**, lämna **Auto-match in-game rank → Discord role by name** på, välj eventuella allmänna **Member roles** och **Guest roles**, spara och tryck sedan på **Sync roles & nicknames now**. Varje person måste också ha en länkad Discord-identitet; synkrapporten namnger alla den inte kunde koppla.',
      ],
      ways: [
        {
          term: 'Rollsynkronisering',
          body: 'För automatisk rangmatchning måste Discord-rollens namn stämma med klanrangen i spelet: `Owner`, `Deputy Owner`, `Coordinator`, `Overseer`, `General`, `Captain`, `Lieutenant`, `Sergeant`, `Corporal` eller `Recruit`. Egna ranger fungerar också när deras Discord-roll har samma namn. Matchningen bryr sig inte om versaler och räknar understreck som mellanslag, men extra ord matchar inte: `General` fungerar; `OSRS General` gör det inte. Medlems- och gästroller väljs separat, så de kan heta vad som helst.',
        },
        {
          term: 'Smeknamnssynkronisering',
          body: 'Sätter en medlems servernamn till deras RSN. Den fyller som standard i ett tomt smeknamn och kan instrueras att skriva över ett som någon valt själv — det är inställningen att fundera över före, inte efter.',
        },
      ],
      note: {
        tag: 'Botens roll måste ligga ovanför dem den hanterar',
        body: 'Discord låter ingen bot röra en roll på eller ovanför sin egen, och nekar det tyst från din sida — synkroniseringen gör då helt enkelt ingenting. Dra upp Anvil-rollen under Serverinställningar → Roller, så börjar den fungera; inget behöver bjudas in igen.',
      },
    },
    commands: {
      title: 'Snedstreckskommandon',
      body: [
        'Boten svarar på `/bingo` på din server (brädet, ställningen, reglerna, ditt eget kort) plus klankommandon som `/sotw`, `/stats` och `/coffer`. De läser den levande sajten, så ingen behöver lämna Discord för att se hur de ligger till. [Varje kommando och dess alternativ]({commandsGuide}) har en egen sida.',
        'De dyker upp ungefär en minut efter att boten gått med. Dyker de inte upp alls gav inbjudan boten men inte dess kommandon — det är två separata behörigheter, och en äldre inbjudningslänk bad bara om den ena. Kör **Invite / re-invite the bot** igen under **Connection** på Discord-sidan; det sparkar inte ut boten och återställer ingenting.',
      ],
      note: {
        tag: 'Den svarar på var och ens eget språk',
        body: 'Som standard svarar boten på det språk medlemmen ställt in sin Discord på, med engelska som reserv. Välj ett enda språk under **Botspråk** för att åsidosätta det för alla — det är också enda vägen till arabiska, eftersom Discord inte har något arabiskt klientspråk att upptäcka.',
      },
    },
    posts: {
      title: 'Vad den postar, och när',
      body: [
        'Två källor, och det är värt att veta vilken som är vilken när något ser fel ut.',
        '**Sidan** postar om event: ett bräde som öppnar, anmälan, en start, ställningar, resultatet. De kommer från Anvil självt och fungerar oavsett om någon har pluginet.',
        '**Pluginet** postar vad som händer i spelet: drops, pets, dödsfall, nivåer, collection log-platser, combat achievements. De finns bara för medlemmar som kör det, så en tyst drops-kanal betyder oftast ett tyst plugin snarare än en trasig webhook.',
      ],
      note: {
        tag: 'Inget postas två gånger',
        body: 'Ett drop som fullbordar en ruta är ett inlägg, inte ett från pluginet och ytterligare ett från brädet.',
      },
    },
    modes: {
      title: 'Leagues, Deadman och andra spellägen',
      body: [
        'Leagues, Deadman, hardcore och andra spellägen körs på egna världar med egna karaktärer. Deras inlägg är alltid märkta och räknas aldrig mot bräden eller tävlingar. De har en egen flik: **Admin → Discord → What goes where → Game modes**. Ett spelläge dyker upp där första gången en medlem spelar det.',
        'Varje spelläge har en brytare och en **To**-kanal. Slå på **Send game-mode posts to their own channels** för att använda de kanalerna; lämna den av så postar varje spelläge i de vanliga kanalerna, fortfarande märkt. Knappen **Posts** på ett spelläges rad listar varje sorts inlägg det skickar — de vanliga och spellägets egna händelser — var och en med sin egen brytare.',
        'Under den listan får du med **Custom filters** ett spelläge att posta mindre än huvudspelet. **Post drops rarer than 1 in…** sätter en egen sällsynthetsgräns (tomt = samma som huvudspelet): föremål som alltid postas postas ändå, men drops som bara räknas för sitt värde gör det inte. **Use its own level milestones** postar en nivåhöjning bara om den uppfyller båda regeluppsättningarna.',
      ],
      note: {
        tag: 'Striktare, aldrig lösare',
        body: 'Ett spelläges filter kan bara ta bort inlägg. Pluginet har redan tillämpat dina inställningar för huvudspelet, så inget ett spelläges filter gör kan få tillbaka ett inlägg.',
      },
    },
    cleanup: {
      title: 'Gamla webhooks från andra plugins eller botar',
      body: [
        'Med boten på din server listar Discord-sidan varje webhook på servern som inte är Anvils. **Coming from other plugins?** erbjuder **Use the same channels**, så att **Set it up for me** postar där dina gamla flöden gjorde och ingenting flyttas för dina medlemmar.',
        'När dina medlemmar väl är på Anvil går du till **Remove old webhooks from other plugins**, kryssar i dem som ska bort och trycker på **Remove … webhooks**, sedan **Yes, remove them**. Det raderar dem i Discord för gott — det går inte att ångra.',
        'Listan rymmer alla webhooks som inte är Anvils, inte bara de från andra plugins. Finns det en du vill behålla, som en annan bots flöde? Tryck på **Keep** så försvinner den från listan; **Show kept** och **Put back** tar tillbaka den. Att behålla döljer den bara här — ingenting ändras i Discord.',
      ],
      note: {
        tag: 'Kräver behörigheten Hantera webhooks',
        body: 'Boten läser serverns webhooks för att hitta dem. Utan _Hantera webhooks_ på sin roll säger sidan att den inte kan se dem.',
      },
    },
    announce: {
      title: 'Posta i Discord',
      body: [
        'Admins kan posta som boten från **Post to Discord**, under **Clan** i adminmenyn. Välj en **Channel**, skriv ditt **Message** och tryck på **Send message**. Lång text, som en regelbok, delas av sig själv upp i flera meddelanden.',
        '**Send as an embed** är på som standard och lägger till en valfri **Title** och en **Accent colour**; slå av den för ren text. **Ping** väljer en roll, eller @everyone, att nämna, och Anvil frågar innan det skickas.',
        'Varje inlägg du skickar listas under **Sent from here**. **Edit** ändrar det i Discord utan att pinga igen, och **Delete** tar bort det.',
      ],
      note: {
        tag: 'Bara admins, med boten',
        body: 'Det postas som Anvils bot, så koppla din server först. Moderatorer ser det inte. Det är brytaren **Post to Discord** under **Clan settings → Features**; är den avslagen försvinner sidan ur menyn.',
      },
    },
    quiet: {
      title: 'När det tystnar',
      body: [
        'I ordning, eftersom varje punkt utesluter nästa:',
      ],
      checks: [
        {
          term: 'Är boten faktiskt på servern?',
          body: '**Connection** på Discord-sidan säger det direkt. ”Token giltig” och ”på din server” är två olika fakta, och det första innebär inte det andra — med en delad bot är token alltid giltig.',
        },
        {
          term: 'Är server-id:t rätt?',
          body: 'Ett fel-men-äkta id ser precis ut som ett rätt, tills du märker att inläggen hamnar någon annanstans.',
        },
        {
          term: 'Finns webhooken kvar?',
          body: 'Att radera en Discord-kanal raderar dess webhook, och Anvil behåller den döda URL:en. Välj en kanal för den igen under **What goes where**.',
        },
        {
          term: 'Ligger botens roll tillräckligt högt?',
          body: 'Bara för roll- och smeknamnssynk — se ovan. Det är den som misslyckas tyst.',
        },
      ],
      note: {
        tag: 'Den kan inte hälsa nya välkomna',
        body: 'Discord rapporterar bara anslutningar över en gateway-koppling, som en delad bot inte håller öppen för varje server. Det finns därför inget ”välkommen”-inlägg — lägg anmälningslänken i en #roller- eller #börja-här-kanal i stället, där folk ändå tittar.',
      },
    },
  },

  plugin: {
    metaTitle: 'Installera RuneLite-pluginet — Anvil',
    metaDescription:
      'Installera Anvils RuneLite-plugin, logga in från dess sidopanel och ställ in Discord-notiser.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Installationsguide för spelare',
    dek: 'Installera det, logga in och spela. Pluginet skickar in dina bingo-drops, postar dina sällsynta drops, dödsfall och milstolpar på Discord och låter dig slå upp vem som helst med ett högerklick.',
    facts: [
      { strong: '1 knapp', rest: 'så är spårningen igång' },
      { strong: '~3 min', rest: 'för grundinstallationen' },
      { strong: 'Högerklick', rest: 'för att slå upp vem som helst' },
    ],
    footnote:
      'Skärmbilderna kommer från en riktig installation — kontotoken är maskad med flit. Din bör förbli lika privat.',

    install: {
      title: 'Installera pluginet',
      body: [
        'I RuneLite: **Configuration** (skiftnyckeln) → **Plugin Hub** → sök på **Anvil** → **Install**. Utgivaren är `AhmedFathy2001`.',
        'Ett plugin räcker för alla klaner — det ansluter alltid till `anvilosrs.com`, och det är inloggningen (nästa steg) som knyter det till dig och dina klaner. Det finns inget klanspecifikt att ladda ner och ingen adress att skriva in. När det är installerat dyker en **Anvil**-knapp upp i RuneLites sidofält, och inställningarna finns under **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Logga in',
      intro: 'Öppna **Anvil**-panelen från RuneLites sidofält och klicka på **Sign in with Discord**. Webbläsaren öppnas på `anvilosrs.com`; godkänn koden där så loggar pluginet in sig självt — inget att skriva, inget att kopiera och inget att fylla i under inställningar.',
      panelFigure: {
        caption: 'RuneLite → Anvil-knappen',
        alt: 'RuneLites sidopanel med Anvil-knappen längst ned i ikonraden inringad',
        legend: [
          {
            label: 'Anvil-knappen',
            body: 'längs kanten av RuneLite-fönstret, längst ned i ikonraden. Klicka på den för att öppna panelen. Den dyker upp så fort pluginet är installerat och påslaget — och du kan dra den uppåt i raden om du hellre vill ha den nära toppen.',
          },
        ],
      },
      signInFigure: {
        caption: 'Anvil-panelen',
        alt: 'Anvil-panelen med knappen Sign in with Discord och sidan den ansluter till inringade',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'visas bara så länge den här datorn är utloggad. Klicka på den, så sker resten i din webbläsare.',
          },
          {
            label: 'Connects to',
            body: 'alltid `anvilosrs.com` — den enda sajt pluginet pratar med, och den som din token hör till.',
          },
          {
            label: 'Paste a token instead',
            body: 'reservlösningen, om webbläsarsteget inte fungerar för dig — se slutet av det här steget.',
          },
        ],
      },
      easySteps: [
        'Klicka på **Sign in with Discord**. Panelen visar en kort kod och öppnar webbläsaren på `anvilosrs.com`.',
        'Logga in med Discord där om du inte redan är inloggad, kontrollera att koden på sidan stämmer med den i RuneLite och klicka sedan på **Approve**.',
        'Tillbaka i RuneLite står det _Signed in_ högst upp i panelen — och, när du loggar in i spelet, vilken karaktär den följer. Klart.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Sidan Link your RuneLite client, med kodfältet och Approve-knappen inramade',
        legend: [
          { label: 'Koden', body: 'den måste stämma med det pluginet visar för dig just nu.' },
          {
            label: 'Approve',
            body: 'godkänn bara en kod som _din egen_ klient visar. Har någon skickat dig en länk eller en kod, neka den — att godkänna vore att ge bort ditt konto.',
          },
        ],
      },
      directNote: {
        tag: 'Var det här sker',
        body: [
          'Hela flödet stannar på `anvilosrs.com` — koden utfärdas där, du godkänner den där med din egen Discord-inloggning, och token skickas direkt tillbaka till pluginet. Pluginet öppnar bara inloggningssidor på `anvilosrs.com`, så en inloggningslänk som pekar någon annanstans kommer inte från det.',
        ],
      },
      federationAside:
        'Ska inte förväxlas med **Connect clans** i sidopanelen — det är den separata, frivilliga knappen som kopplar dig till andra Anvil-klaner, och den dyker upp först när du redan är inloggad här.',
      manualFallback:
        'Om webbläsaren inte öppnas av sig själv skriver panelen ut adressen och koden så att du kan öppna den manuellt. Koder går ut efter tio minuter — tryck bara på knappen igen.',
      manualHeading: 'Reservväg: klistra in din token för hand',
      manualIntro:
        'Om inloggningen från pluginet inte fungerar för dig, kopiera din token nedan (eller från [Profile → plugin token](/profile#plugin-token), där du också kan rotera den), klicka sedan på **Paste a token instead** under inloggningsknappen i Anvil-panelen och klistra in den där.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'RuneLite plugin-kortet på profilsidan, med tokenfältet och knapparna Reveal, Copy och Rotate inramade',
        legend: [
          {
            label: 'Din token',
            body: 'dold tills du trycker Reveal. Den är maskad på den här skärmbilden med flit; posta aldrig din egen i Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'kopiera den och använd sedan **Paste a token instead** i Anvil-panelen. Rotate utfärdar en ny och dödar den gamla — använd den om du någonsin misstänker att din token läckt.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Använd sidopanelen till vardags',
        body: ['**Anvils sidopanel är din huvudsakliga arbetsyta**: logga in och ut där, se dina klaner och aktiva event, bläddra bland och gör anspråk på rutor, följ framsteg, ta startbilder, kör synkroniseringar och öppna supportverktyg. **Configuration → Anvil**, som visas nedan, är bara till för inställningar — där finns ingen token. För att logga ut den här datorn, öppna **⋯**-menyn bredvid ditt namn högst upp i panelen. En inloggning räcker för alla event du är anmäld till — du gör den aldrig om per bingo.'],
      },
    },

    accounts: {
      title: 'Koppla dina konton',
      body: [
        'När token är inställd visas konton du spelar på automatiskt i din profil. Ett helt nytt konto kan kopplas direkt; ett konto som redan finns på en klanlista behöver först en ägarskapskontroll, eftersom ett offentligt RuneScape-namn inte bevisar vem som äger det.',
        'För den första kopplingen använder du [den snabba XP-kontrollen](/profile#link-account), eller ber en klanmoderator godkänna kontot under [upptäckta konton](/profile#detected-accounts). Därefter följer det stabila kontofingeravtrycket namnbyten och känner igen kontot automatiskt.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Kortet RuneScape Accounts på profilsidan som listar konton verifierade via pluginet',
        legend: [
          {
            label: 'Dina kopplade konton',
            body: 'allt märkt “Verified via plugin” är kopplat och känns igen automatiskt. Befintliga klanlistekonton kan först kräva en engångskontroll via XP eller moderator.',
          },
        ],
      },
      noPluginHeading: 'Kan du inte köra pluginet?',
      noPluginIntro:
        'På mobil eller i den officiella klienten använder du [Profile → account linking](/profile#link-account) i stället:',
      noPluginOptions: [
        '**Verify by XP** — skriv in ditt RSN, sajten väljer en slumpmässig färdighet, och du ska tjäna 1 000 XP i den inom 30 minuter.',
        '**Manual review** — för dolda Hiscores eller helt nya altkonton: skicka in ditt RSN med en kommentar så godkänner en moderator det.',
      ],
      signupNote:
        'Anmälan till event kräver minst ett verifierat konto, så få det gjort innan du anmäler dig.',
    },

    working: {
      title: 'Kontrollera att det fungerar',
      intro:
        'Logga in och läs din chattruta. Pluginet hälsar på dig när det är anslutet och ett event pågår.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…senare, allteftersom saker händer…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Du bör också se **Anvils sidopanel** fyllas med dina klaner, dina pågående event, din placering och synkroniseringsknapparna — och en **Anvil**-knapp dyka upp i titelraden på din Collection Log i spelet.',
      guestNote: {
        tag: 'Gäst kontra medlem',
        body: 'Om chatten säger _Tracked as a guest_ blir du spårad, men du står inte på klanens medlemslista än. Det fixar en admin genom att synka medlemslistan från spelet — fråga {discordLink}.',
        discordWord: 'i Discord',
      },
      panelHeading: 'Sidopanelen',
      panelBody: [
        'Fyra flikar och ett kugghjul. **Clan** är dina event och din klan: varje pågående och kommande bingo och veckotävling med var du står. **Feed** är din klans och dina brädors stora ögonblick medan de händer, med eventchatt. **You** är din egen profil, och **Lookup** hittar alla andras, spelare eller klan. Kugghjulet rymmer synkning och dina bannerljud.',
        'Varje flik, eventchatten, reaktioner och inställningarna som tar in flödet och Supporter-färgerna i ditt spel finns i [Sidopanelen, flik för flik]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Anvil-sidopanelens tre flikar sida vid sida: Clan-fliken med event och klanens vecka, You-fliken med din collection log, och Lookup-fliken med en annan spelares kort',
      },
      lookupHeading: 'Slå upp vem som helst',
      lookupBody:
        'Högerklicka på en spelare — bredvid dig, eller på namnet i chatten, vänlistan eller klanpanelen — och välj **Anvil** för att öppna deras kort i sidopanelens **Lookup**-flik. Ditt eget är **You**-fliken.',
      lookupFigure: {
        caption: 'Högerklicka på ett namn → Anvil',
        alt: 'En spelares högerklicksmeny i spelet med ett Anvil-val under Lookup',
      },
      lookupSettingNote:
        'Välj var **Anvil**-valet visas under **Player lookup** i pluginets inställningar. På ett namn i chatten är det aldrig vänsterklicksvalet, så ett klick på ett namn gör fortfarande det spelet brukar göra.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Avsnittet Player lookup i Anvils inställningar med varje inställning inramad och numrerad',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'huvudbrytaren. Av döljer valet överallt.',
          },
          {
            label: 'Players in the world',
            body: 'högerklick på en spelare som står nära dig.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'namn i chattrutan och i privatchatten.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'namnlistorna: medlemmarna i din klan och gästklanen, friends chat-kanalen, dina vän- och ignoreringslistor och raidens partypanel.',
          },
        ],
      },
    },

    bingo: {
      title: 'Bingo-inställningar',
      intro:
        'De spelar bara roll medan du är med i ett event. Standardvärdena är bra — så här gör var och en av dem faktiskt.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Bingo-avsnittet i pluginets inställningar med varje inställning inramad och numrerad',
        legend: [
          {
            label: 'Show Overlay',
            body: 'ritar en liten panel med _Anvil / lag / UTC-datum_ uppe till vänster. Den blir en del av bilden i dina bevisskärmbilder, och det är just det som gör ett bevis svårt att förfalska eller datera bakåt. Den är av på den här bilden — slå på den om din klan vill se lag och tid på varje bevis.',
          },
          {
            label: 'Team completion popups',
            body: 'en banner när någon i ditt lag klarar en ruta. Flera samtidigt: den svåraste får bannern, resten går till chatten.',
          },
          {
            label: 'My tile popups',
            body: 'en popup när din egen drop flyttar fram en ruta eller klarar den. Av spåras den ändå — bara i tysthet.',
          },
          {
            label: 'Banner sound + volume',
            body: 'spelar ett ljud tillsammans med bannern. Ingenting händer förrän du själv lägger till minst en .wav-fil, via **Add clip** under ”Banner sounds” i Anvils sidopanel. Uppdrag har en egen mapp — lägg till ett klipp under **Mission sounds**, så spelas det i stället för det inbyggda ljudet som skiljer dem från en klarad ruta.',
          },
          {
            label: 'Auto starting shot',
            body: 'tar ett events startbild åt dig i samma ögonblick som du står på den fästa platsen. Av trycker du själv på **Take starting shot** i sidopanelen.',
          },
        ],
      },
      teamsHeading: 'Lag',
      teamsBody:
        '**Teams**-knappen på ett event listar dess lag rangordnade, med ditt överst. Öppna ett lag för dess medlemslista, kaptenen först, eller sök efter en spelare i alla lag — klicka på ett namn för att slå upp personen.',
      teamsFigure: {
        caption: 'Eventet → Teams',
        alt: 'Teams-sidan med ett events lag, poäng och antal medlemmar, bredvid ett lags medlemslista med kaptenen först',
      },
      startHeading: 'Startbild',
      startBody: [
        'Vissa event kräver en **startbild** av alla: en skärmbild tagen efter att eventet gått igång, på en plats som lottas i startögonblicket. Det hindrar folk från att ägna veckan före eventet åt att samla på sig clues, kistor och kills att dumpa första dagen.',
        'Kör du pluginet finns det inget att förbereda. När eventet startar får du en chattrad som säger vart du ska, och Anvils sidopanel visar en **Take starting shot**-knapp. Ställ dig där det står, tryck en gång, och du är klar — pluginet tar bilden, stämplar den med ditt RSN, ditt lag, platsen och ett lösenord som bara ditt konto får, och arkiverar den åt dig.',
        'Två saker kontrolleras innan något arkiveras, så att du hinner rätta dem i spelet i stället för i ett Discord-gräl efteråt. Har värden nålat platsen på kartan vet pluginet hur långt bort du är och säger till, i stället för att skicka en bild från fel sida av Gielinor. Och om eventet kräver en färsk session måste du **logga ut och in igen** innan du tar den: dina hiscores sparas bara när du loggar ut, så en omloggning precis före bilden är det som gör dina startsiffror — och därmed varje XP- och KC-ruta — korrekta.',
        'På mobil, eller utan pluginet: öppna **My Team** på den här sajten, läs ditt lösenord på startbildskortet, skriv in det i spelets chattruta, ta en skärmbild där både din karaktär och lösenordet syns, och ladda upp den på samma kort. Uppladdningen räknas direkt — du kan spela så fort den är inne, och staben granskar den i efterhand. Logga ut och in först om kortet ber dig om det.',
      ],
    },

    notifications: {
      title: 'Discord-notiser',
      intro:
        'De skickas oavsett om en bingo pågår eller inte, och de postas i klanens kanaler. Vilken kanal bestämmer administratörerna här — du väljer bara _vad_ du postar. I nästa pluginuppdatering flyttar de här valen till webbplatsen, under **Settings → Discord posts & screenshots**, och följer med dig till varje dator. På samma sida väljer **Screenshot privacy** vilken chatt (privata meddelanden, offentlig chatt, klanchatt) som döljs på varje skärmdump pluginet tar. Pluginet behåller två reglage under **Notifications**: **Share clan posts** pausar alla inlägg från huvudspelet på en gång, och **Share seasonal activity** gör samma sak på Leagues, Deadman och andra säsongsvärldar.',
      examplesFigure: {
        caption: 'Så ser en post ut',
        alt: 'Två Discord-poster från Anvil: en Grandmaster combat task med poäng och framsteg mot nästa upplåsning, och en död med sitt meddelande, båda med en skärmbild av ögonblicket',
      },
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Notisavsnitten Deaths and kills och Drops and pets med varje inställning inramad och numrerad',
        legend: [
          {
            label: 'Notify on death',
            body: 'postar i klanens dödskanal med en skärmbild av ögonblicket du dog.',
          },
          { label: 'Death message', body: 'din egen rad. `{name}` byts ut mot ditt RSN.' },
          {
            label: 'Notify on PvP kill',
            body: 'en skärmbild av ticket då ditt mål når 0 HP. Av som standard; på här.',
          },
          { label: 'Notify on rare drops', body: 'huvudströmbrytaren för drop-inlägg.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'ett drop postas när det är värt minst så här mycket (GE eller high alch, det som är högst) eller är ovanligare än 1 på N. Anvil startar på 1m och 1/1,000. Din klan kan sätta egna standardvärden för sina medlemmar, och tills du väljer ett tal själv följer du klanens; **Återställ till klanens standard** (eller **Återställ till Anvils standard** om du inte har någon klan) går tillbaka till att följa den. En klan kan också sätta ett hårt sällsynthetsgolv för sina egna kanaler, som ditt tal inte kan gå under. Sätt något av talen till 0 för att stänga av det.',
          },
          {
            label: 'Värde och sällsynthet tillsammans',
            body: 'som standard postas ett drop när det uppfyller värdet **eller** sällsyntheten. Slå på **Kräv båda** så måste det uppfylla värdet **och** sällsyntheten. Din klan kan välja den här standarden för sina medlemmar; tills du väljer själv följer du den, och utan klan gäller ett av alternativen. Var och en av dina egna webhooks kan också sätta sitt eget minimivärde, sällsynthet och antingen/båda; det den lämnar tomt följer dina inställningar.',
          },
          {
            label: 'Loot key value',
            body: 'en loot key postas en gång, som en enda notis, när hela innehållet passerar det här talet.',
          },
          { label: 'Notify on pets', body: 'pets postas i kanalen för sällsynta drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Notisavsnittet Combat achievements med varje inställning inramad och numrerad',
        legend: [
          {
            label: 'CA post tier',
            body: 'den lägsta uppgiftsnivån som postas; avklarade nivåer postas också. Standard är Master; Grandmaster postar bara de allra ovanligaste, **Off** postar inga. CA-rutor i bingo räknas oavsett.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'varje ny plats i collection log.',
          },
          {
            label: 'Notify on level milestones',
            body: 'levlingar som din klan har valt att annonsera — som standard 99:or, varje 100 totalnivåer från 1800, samt max. Klanens administratörer bestämmer reglerna; du kan posta mindre (eller ställa in egna regler för dina personliga webhooks) under Announcements på din profil.',
          },
          {
            label: 'Notify on diary completions',
            body: 'nivåer i achievement diary, med en skärmbild.',
          },
          {
            label: 'Quest post tier',
            body: 'quests från den svårighetsgrad du väljer och uppåt, från All (varje quest) upp till Grandmaster; **Off** postar inga. Standard är Master. Quest-rutor i bingo räknas oavsett.',
          },
        ],
      },
    },

    trouble: {
      title: 'När något går sönder',
      intro:
        'Pluginet säger till i chatten när spårningen har slutat — det väntar omkring 90 sekunder innan det klagar och upprepar sig som mest var 5:e minut.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token är fel eller har roterats. Öppna **⋯**-menyn högst upp i Anvil-panelen, tryck på **Sign out** och sedan **Sign in with Discord** igen — eller använd **Paste a token instead** med en ny token från [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Pluginet når inte `anvilosrs.com`. Kontrollera din internetanslutning och eventuell brandvägg eller VPN som kan blockera RuneLite. Om allt det ser bra ut ligger sajten förmodligen nere en stund — pluginet återansluter av sig självt.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Kontot är inte kopplat än. Öppna [Profile → upptäckta konton](/profile#detected-accounts) för att lägga till det eller starta ägarskapskontrollen.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ingenting. Det löste sig av sig självt.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'Någon annan kopplade den här karaktären på Anvil först, så inget räknas för den från din inloggning. Är den verkligen din? Tryck på **This is my account** på panelens flik **You** och gör den snabba XP-kontrollen. Då tillfrågas den nuvarande ägaren, eller så avgör Anvils personal. Du får aldrig veta vem det är. Följ ärendet under [Settings → Ownership claims](/settings/claims).',
        },
      ],
      logHeading: 'Fortfarande fast? Skicka en admin en logg',
      logBody:
        'Skicka din RuneLite-logg till en admin: `client.log` i mappen `.runelite/logs` i din användarmapp (på Windows klistrar du in `%USERPROFILE%\\.runelite\\logs` i adressfältet i Utforskaren). Pluginet skriver in vad det såg och varför, så de kan se exakt vad som gick fel.',
      missingNote: {
        tag: 'Saknas bevis?',
        body: 'Pets och dubbletter av Champion’s scrolls kräver en manuell skärmbild. Pluginet tar den åt dig och sparar den i `.runelite/osrs-bingo-pending/` — **Copy folder path** i Anvils sidopanel öppnar mappen — så att du bifogar den på sajten i stället för att leta efter en bild efteråt.',
      },
    },
    limits: {
      title: 'Kända begränsningar',
      intro:
        'Några saker går inte att spåra perfekt — nästan alltid på grund av vad själva spelet rapporterar, inte Anvil. Lösningen är densamma varje gång: ta en skärmbild och skicka in den manuellt.',
      rows: [
        {
          term: 'Barraging och andra dråp på flera mål',
          body: 'Antal dråp (KC) kommer från det spelet rapporterar per dråp, och flermålsformler som Ice Barrage gör att en del missas, så **KC kan bli lägre** än vad du dödat. RuneLites egen Loot Tracker räknar för lågt på samma sätt — det är en begränsning i spelmotorn, inte en Anvil-bugg.',
        },
        {
          term: 'Combat achievements du gjort förut',
          body: 'Slå på **repeat completion** i spelets inställningar för Combat Achievements. Utan den meddelar spelet inte en uppgift du redan klarat, och pluginet kan bara ge poäng för det spelet meddelar.',
        },
        {
          term: 'Yama-kontraktets combat achievement',
          body: 'Spelet meddelar inte denna igen ens med repeat completion på, så pluginet ser den aldrig. Ta en skärmbild och skicka in den manuellt.',
        },
        {
          term: 'Insamlingsrutor utan pluginet',
          body: 'Antal föremål — ett antal fiskar, malmer, stockar — finns inte på hiscores, så bara pluginet spårar dem. Utan det: ta en skärmbild av varje inventory; eller, om föremålet syns i Loot Tracker, en skärmbild nollställd till 0 i början och en igen i slutet.',
        },
        {
          term: 'Implings, fisk, malm och andra föremålsvinster',
          body: 'Att fånga implings och samla föremål (fisk, malm och allt annat som räknas utifrån det som landar i ditt inventory) **spåras ibland inte korrekt, även med pluginet**. Spara skärmbilder längs vägen, och om en räkning ser för låg ut, rapportera det och skicka in skillnaden manuellt.',
        },
        {
          term: 'Fisktunnor, vedkorgar och annan förvaring',
          body: 'Rutor för item-ökning räknar bara det som hamnar i din inventory **direkt från källan** — en fiskeplats, en sten, ett träd. Allt som tas ur förvaring (tömma en fisktunna, vedkorg, kol- eller ädelstenspåse, örtsäck), köps i en butik, tas ut från banken eller plockas upp från marken **räknas inte**. Det håller rutan ärlig: annars kunde samma fisk fyllas i en tunna och tömmas ut igen i all oändlighet. Fångst du samlar direkt i en tunna eller korg räknas inte.',
        },
        {
          term: "Dubbla pets och champion's scrolls",
          body: 'När du redan har peten eller scrollen säger spelet bara att du har en **”funny feeling”** — den säger aldrig vilken. Pluginet räknar ut det från vad du nyss dödade eller tränade, krediterar rutan och **flaggar den för granskning av staff**. Kan det inte avgöra säkert — två pets från samma källa, eller en pet utan kill eller skill bakom (Bloodhound från en master clue, en gamblad Jad- eller Zuk-pet, Chompy chick) — sparas skärmdumpen i **Saved proofs** så att du kan skicka in den manuellt.',
        },
      ],
    },
    screen: {
      title: 'På skärmen medan du spelar',
      intro: 'Det pluginet ritar och skriver ut medan du spelar, och inställningen bakom varje del.',
      rows: [
        {
          term: 'Fästa brickor',
          body: 'öppna en bricka i sidopanelen och tryck på **Track on screen** (upp till 3). Med **Pinned tiles in one panel** på delar de en liten panel: varje brickas namn, ditt lags framsteg och rader som _3/5 runs_ eller vilka delar av en kombo som är klara. Av får var och en en egen större widget med dina lagkamrater och de andra lagen. Alt-dra för att flytta den. Högerklicka för **Unpin** eller **Unpin all**. En klar bricka visar **Done** och lossnar sedan av sig själv.',
        },
        {
          term: 'Startskottskortet',
          body: 'medan ett event väntar på ditt startskott visar ett kort **Starting shot needed** överst på skärmen vart du ska och visar varje kontroll i grönt eller rött: relogg, hur länge ditt pass har varat, hur många rutor du är från platsen. En pekpil och en kartnål på världskartan (**Anvil starting shot**) leder dit. Med **Auto starting shot** på tas startskottet så fort allt är grönt; då säger kortet **You’re tracked** och går. Inställning: **Starting shot guide**.',
        },
        {
          term: 'Bannerramar',
          body: '**Tile complete!** när ditt lag klarar en bricka, ditt eget drops framsteg på en bricka, och **New mission!**. Inställningar: **Team completion popups** och **My tile popups**.',
        },
        {
          term: 'Vestige-rullningar',
          body: 'vid Desert Treasure II-bossarna skriver varje unik ut en rad med var du är i vestige-rotationen, som _Roll 2 of 4_ eller _the next unique is the vestige_. Den säger _(estimated)_ tills den har sett dig få en vestige. Ingen inställning; den körs med eller utan event.',
        },
        {
          term: 'Förslag i Lookup',
          body: 'när du skriver i rutan **Lookup** fyller det i namnet åt dig, från dina senaste sökningar, vänner, klanmedlemmar som är online och spelare i närheten. **Enter** godkänner. Det läser bara din egen klient; inget skickas.',
        },
        {
          term: 'Chattfärger',
          body: '**[Anvil] tag colour** och **Message colour** under **Chat messages**. Tills du väljer blir de mörk guld och svart på en ogenomskinlig chatbox så att de går att läsa. Håll muspekaren över en Supporters namn i chatten för att se dess nivå, som _Anvil Patron_.',
        },
      ],
    },
    sync: {
      title: 'Profilsynk, och vad mer den skickar',
      intro: 'Inställningarna för **Profile sync** fyller i din Anvil-profil. Alla fyra är på från start:',
      rows: [
        {
          term: 'Synka samlingsloggen',
          body: 'varje sida i samlingsloggen du öppnar skickas till din profil.',
        },
        {
          term: 'Synka hela loggen vid öppning',
          body: 'när du öppnar samlingsloggen skickas hela den, inte bara sidan du tittar på. För att göra det på begäran, tryck på knappen **Anvil** i samlingsloggens namnlist, eller **Sync profile** i sidopanelen medan loggen är öppen. Chatten bekräftar det: _Profile synced — N collection log slots._',
        },
        {
          term: 'Synka personliga rekord',
          body: 'boss- och raidtider skickas när du sätter dem.',
        },
        {
          term: 'Importera befintliga rekord en gång',
          body: 'en gång per karaktär kopieras de personliga rekord som RuneLite redan har sparat på din dator: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Dela höjdpunkter med klanen',
          body: 'dina husdjur, stora drops, dödsfall, stridsuppgifter, nivåmilstolpar, nya loggplatser och dagböcker visas i flödet på din klans sajt, och i chattflödet för spelare som kan se dem.',
        },
      ],
      outro: 'Tre saker till skickas utan en egen inställning. **Vem som dödade dig**: monstret eller spelaren som hade dig som mål de sista 15 sekunderna namnges i flödet. **Spelräknare**: vissa dödsantalsbrickor räknar ett tal som spelet själv håller, som Tithe Farm-poäng, Giants’ Foundry-rykte, Doom-delves eller slayer-streaks; bara ökningar räknas. **Leagues, Deadman och andra lägen**: på de världarna skickas spelets egna rader om relikter, områden och uppgifter så att din klan kan posta dem i sin lägeskanal.',
    },
  },

  admin: {
    metaTitle: 'Så kör du ditt första event — Anvils adminguide',
    metaDescription:
      'Sätt upp en klan på Anvil och kör en bingo från början till slut: Discord, medlemslista, brädor, rutor, lag och draft, start, och vad som händer när eventet är slut.',
    eyebrow: 'Anvil · för klanens stab',
    title: 'Så kör du ditt första event',
    dek: 'Hela vägen, i den ordning du faktiskt går den: få {clanName} konfigurerad, få in medlemslistan, bygg en bräda, drafta lag, dra igång det hela och dela ut priserna. Ungefär en kvälls arbete för första bingot — minuter för det andra.',
    facts: [
      { strong: '5 steg', rest: 'på installationens checklista' },
      { strong: '7 format', rest: 'att bygga en bräda av' },
      { strong: '1 knapp', rest: 'för att synka medlemslistan' },
    ],
    footnote:
      'Den här guiden följer appen som den ser ut i dag. Stämmer inte en skärm här med det du tittar på är appen rätt och guiden gammal — [säg till](/feedback) så fixar vi den.',

    access: {
      title: 'Vem får göra vad',
      intro:
        'Alla loggar in med Discord — inga lösenord. Den första administratören är ägaren, den som skapade klanen; därefter befordrar en admin folk från **People → Staff & roles**. Rollerna staplas nedåt: allt en moderator kan, kan en kassör och en admin också.',
      rows: [
        {
          term: 'Admin',
          body: 'full åtkomst — event, rutor, lag, inställningar, stab, utbetalningar. Ge den till så få som klanen står ut med.',
        },
        { term: 'Treasurer', body: 'allt en moderator kan, plus anmälningsavgifter och utbetalningar.' },
        {
          term: 'Moderator',
          body: 'det dagliga: medlemslista, verifieringar, bevis att granska, veckotävlingar, schemat och klanens kalenderhändelser. Kan inte skapa eller redigera event.',
        },
        {
          term: 'Editor',
          body: 'bara rutredigering. Ge den globalt, eller begränsa den till specifika brädor så att en inbjuden brädbyggare bara kommer åt det event du lämnat över.',
        },
        { term: 'Member', body: 'spelar; har ingen adminyta alls.' },
      ],
      seeAlso:
        'Två av de rollerna har en egen sida: [På passet]({moderatorGuide}) om vad en moderator faktiskt gör med sin kväll, och [Avgifter och utbetalningar]({feesGuide}) för kassören.',
      ownerNote: {
        tag: 'Ägare',
        body: 'Ett konto är ägaren. Ingen annan kan degradera det, och det är den enda rollen som kan lämna över ägarskapet — så att förlora ett gräl med en medadmin kan aldrig kosta dig klanen.',
      },
    },

    setup: {
      title: 'Namnge klanen, koppla Discord',
      intro:
        '**Settings → Finish setup** är en kort guide (den ligger kvar i menyn tills du är klar), och instrumentpanelen håller kvar en checklista i fem steg tills de är klara: namnge klanen, koppla Discord, läs in dina medlemmar, skapa ett event, lägg till rutor. Statusen räknas ut från riktiga data, så ett steg bockas av först när det verkligen är färdigt.',
      discord:
        'För Discord har du två vägar, och de går att kombinera: ge Anvil en **bot** så kan den skapa webhooks, synka roller och smeknamn och bygga privata lagkanaler; ge den en enda **webhook-URL** så kan den posta meddelanden och inget annat. Börja med webhooken om du vill vara igång på två minuter, och lägg till boten när du vill ha automatiken.',
      permsNote: {
        tag: 'Botens behörigheter',
        body: 'Boten behöver behörigheterna _Hantera webhooks_, _Hantera roller_, _Hantera kanaler_ och _Hantera smeknamn_, och dess roll måste ligga _ovanför_ de roller den hanterar i serverns rollista. Annars vägrar Discord tyst.',
      },
      hosted:
        'På ett hostat abonnemang mötte du den skärmen en gång redan: att lägga till boten under installationen var hur Anvil fick veta vilken server som är er, så det fanns aldrig något server-ID att kopiera. Samma länk finns här när du vill flytta boten till en annan server.',
    },

    channels: {
      title: 'Sprid inläggen över flera kanaler',
      body: [
        'Allt postas som standard i en enda samlingskanal. När den blir stökig, öppna **Discord → What goes where** och ge de högljudda kategorierna egna hem — eventinlägg, veckotävlingar, sällsynta drops, dödsfall, PvP-kills, combat achievements. Allt du lämnar tomt faller tillbaka till sin samlingskanal, så du kan flytta en kategori i taget.',
        'Med boten ansluten rör du aldrig en webhook-URL: välj en kanal i radens rullgardin så sparas den. Under ett hektiskt event kan du lägga till en andra webhook med **Add another** under **Post without a bot** — Anvil växlar mellan dem så att Discords hastighetsgräns inte sväljer inlägg.',
      ],
      clipsNote: {
        tag: 'Klippkanalen är annorlunda',
        body: 'Klippvideor laddas upp direkt från varje spelares dator till Discord — de passerar aldrig den här sajten. Därför är klipp-webhooken du ställer in här den du _delar ut_: medlemmarna klistrar in den själva i sitt plugin. Allt annat på den här sidan sker på servern och medlemmarna ser det aldrig.',
      },
    },

    roster: {
      title: 'Få in din medlemslista',
      body: [
        'Klanmedlemskap kommer från ett enda ställe: en synkning av medlemslistan från spelet. Installera [Anvils RuneLite-plugin]({pluginGuide}) på en _admins_ konto, öppna klanfönstret i spelet och tryck på **Anvil**-knappen i titelraden. Det skickar upp er faktiska klanlista från spelet till sajten med ett klick.',
        'Att logga in, länka en karaktär eller spela med pluginet sätter aldrig någon på medlemslistan. Ser pluginet någon spela i er klan i spelet innan medlemslistan har hen, skapar det en ansökan om att gå med; alla andra kan fråga med **Apply** på er klansida. Staben svarar på ansökningar överst på **People → Roster**, och **People → Who can join** avgör om folk väntar på ett ja, får en gästplats direkt eller inte kan fråga alls. Det är avsiktligt: ingen går med i er klan genom att skriva dess namn. Hela bilden finns i [Dina medlemmar]({peopleGuide}).',
        'Du kan också lägga till någon för hand från **People → + Add Manually**, och anmäla dem till ett event å deras vägnar med **Add member** på eventets **Sign-ups**-sida när de inte når sajten.',
      ],
    },

    board: {
      title: 'Skapa din första bräda',
      intro:
        '**Events → All events → + New event**. Välj format först — det avgör hur brädan poängsätts och vad resten av formuläret frågar dig om.',
      formats: {
        classic: {
          label: 'Klassisk bingo',
          blurb: 'Ett kvadratiskt N×N-rutnät — lagen klarar rutorna i valfri ordning, var och en värd 1.',
        },
        leagues: {
          label: 'Leagues-bingo',
          blurb: 'En uppgiftslista där varje ruta bär sitt eget poängvärde — hur många rutor som helst.',
        },
        race: {
          label: 'Rutrace',
          blurb: 'En ordnad bana — lagen når rutorna i följd; den som kommer längst vinner. Värden kan dela upp den i vägar som delar sig och möts — rutan ni klarar väljer er väg.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Rutorna hålls dolda till sin schemalagda tidpunkt — ställ in varje avslöjande i Tiles-fliken. Poängsatt, i DMM All Stars-stil.',
        },
        luckydraw: {
          label: 'Lyckodragning',
          blurb: 'En bingoutropare: dolda rutor öppnas i slumpmässiga dragningar med fast intervall. Poängsatt.',
        },
        bounty: {
          label: 'Prisjakt',
          blurb:
            'En öppen ruta i taget — första laget som klarar den tar poängen och nästa jakt dras.',
        },
        ladder: {
          label: 'Stege',
          blurb:
            'En poängsatt uppgiftslista rankad som en individuell topplista (lag valfritt). Uppgifterna roterar — progressivt, en i taget eller i ett rullande fönster — och kan sjunka i värde. I stil med en månadsstege.',
        },
      },
      outro:
        'Ställ sedan in datumen, anmälningsfönstret, och om anmälan kostar en avgift. Börja från en mall om du hellre slipper börja med ett tomt rutnät — galleriet rymmer både de inbyggda mallarna och varje bräda du sparat som mall tidigare.',
      seeAlso:
        'Formatet är bara halva beslutet — hur rutor blir spelbara är den andra halvan, och de två kombineras. Båda i sin helhet: [Format, och hur rutor öppnas]({formatsGuide}).',
      utcNote: {
        tag: 'Datum är UTC',
        body: 'Varje tidsstämpel i Anvil lagras och jämförs i UTC, och visas i varje besökares lokala tid. Ställ in sluttiden du menar; sajten visar en britt och en australier två olika klockslag för samma ögonblick.',
      },
    },

    tiles: {
      title: 'Fyll brädan',
      body: [
        'Eventets **Board & tiles**-sida är där en bräda blir en bingo. Varje ruta är en _sorts_ uppgift, och sorten avgör vad pluginet håller utkik efter: en drop, ett boss-killcount, färdighets-XP, ett NPC-kill, en klarning på tid, en achievement diary, en Combat Achievement, en upplåsning i collection log, ett PvP-kill, en föremålsvinst, eller en dödsfri runda. Manuella rutor — de som en människa godkänner från en skärmbild — finns alltid som alternativ också.',
        'För en full bräda, redigera i klump: exportera arket, fyll i det i ett kalkylprogram och importera tillbaka. Både CSV och .xlsx går fram och tillbaka, och rader följer positioner, så du kan skriva om ett helt 25-rutors nät med en enda inklistring.',
      ],
      rows: [
        {
          term: 'Svårighetsgrader',
          body: 'poängvärden översätts till namngivna band (easy → elite). Redigera banden under **Clan settings → Rules & scoring → Difficulty & balance** om din klan graderar annorlunda.',
        },
        {
          term: 'Balansgranskaren',
          body: 'kollar en färdig bräda efter strukturella problem och sned arbetsbörda innan spelarna ens ser den.',
        },
        {
          term: 'Dold tills du avslöjar',
          body: 'nya brädor börjar dolda. Staben ser dem alltid; spelarna ser ingenting förrän du avslöjar — så en bräda kan byggas öppet utan att spoilas.',
        },
      ],
      seeAlso:
        'Vilken sort du ska välja, hur du skriver tvåhundra av dem i ett kalkylark, och misstagen som importeras snyggt och sedan aldrig utlöses: [Bygg en bräda som spårar sig själv]({boardGuide}).',
    },

    teams: {
      title: 'Lag och draft',
      body: [
        'Sidan **Teams & draft** anpassar sig efter formatet du valde: ett format som inte använder lag hoppar rakt förbi den. För en vanlig lagbingo skapar du lagen, bestämmer vilka som är kaptener, och antingen fördelar spelarna själv eller kör en livedraft.',
        'Kaptenerna draftar ur anmälningspoolen i den ordning du väljer, och varje kapten ser svaren folk gav i anmälningsformuläret — frysta som de skickades in, så att ingen redigerar sina “timmar per vecka” efter att ha blivit vald.',
      ],
      placementIntro:
        'Du måste inte drafta. **Team placement**, i skapa-formuläret och på fliken **Sign-ups**, avgör var varje ny anmälan hamnar:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'varje person som anmäler sig hamnar i laget med minst spelare. Du väljer bara hur många lag det ska vara. Bra för stora öppna event.',
        },
        {
          term: 'Players pick',
          body: 'du skapar lagen först, och varje spelare väljer ett i anmälningsformuläret. Sätt en gräns per lag för att hålla dem jämna.',
        },
        {
          term: 'Host drafts',
          body: 'alla väntar i en pool tills du eller dina kaptener draftar dem eller placerar dem för hand. Bäst när du känner spelarna.',
        },
        {
          term: 'Solo',
          body: 'inga lag alls. Varje spelare kör på egen hand, under sin karaktärs namn, och ställningen rankar spelare.',
        },
      ],
      lockNote: {
        tag: 'Draften låser lagen',
        body: 'När en draft väl är igång är både laguppsättningen och valordningen frysta. Lägg till laget du glömde _innan_ du trycker start, inte efter.',
      },
      seeAlso:
        'Skicka dina kaptener [kaptensguiden]({captainGuide}) före draftkvällen — krigsrummet är mest värt i dagarna före, och ingen läser en ny skärm medan en klocka tickar.',
      visitingClans:
        'Spelar ni mot en annan klan i stället för att drafta era egna? Den besökande sidan ställer upp med sin egen trupp genom en enda länk, och deras moderator sköter den utan ett adminkonto här — se [Att vara värd för en gästklan]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Starta och kör det',
      body: [
        'Avslöja rutorna och starta sedan eventet. Anvil vägrar starta en bräda som inte är redo — en draft som fortfarande pågår, eller spelare utan lag — och talar om vilket. Vet du bättre (en träningsmatch, en omkörning, en bräda du testar) kan du tvinga fram det.',
        'Därefter sköter det sig i stort sett självt. Pluginet krediterar automatiskt allt det ser och postar bevisbilder stämplade med lag och en UTC-tidsstämpel. Det som hamnar på ditt bord är:',
      ],
      rows: [
        {
          term: 'Inskickat att granska',
          body: 'manuella rutor och allt pluginet flaggat. Godkänn eller avslå med beviset framför dig.',
        },
        {
          term: 'Statistik',
          body: 'eventets Stats-flik visar bidraget per spelare — användbart när ett lag bråkar om vem som bar vem.',
        },
        {
          term: 'Meddelanden',
          body: '**Post to Discord** (under **Clan** i menyn) postar ett meddelande i valfri kanal som boten mitt under eventet utan att du skriver en webhook för hand.',
        },
      ],
      missionNote: {
        tag: 'Överraskningar under eventet',
        body: 'Du kan släppa ett **uppdrag** på en pågående bingo — en dold bonusruta som annonseras när du avfyrar den, och som valfritt sjunker i värde eller går ut. Det är det billigaste sättet att väcka en bräda på dag fem.',
      },
      startProofNote: {
        tag: 'Att stoppa hamstring före eventet',
        body: [
          'Slå på **Starting shot** (eventet → Home → **Extras**) så måste varje spelare lämna in en skärmbild tagen efter att eventet gått igång, på en plats Anvil lottar i startögonblicket — så att ingen sitter på en vecka av sparade clues och kistor vid noll. Platsen annonseras vid starten; varje spelares lösenord är personligt, härlett ur dragningen, och existerar inte förrän eventet startar, så det kan inte iscensättas i förväg av någon.',
          'Nåla platserna på världskartan (poolredigeraren har en) så kontrollerar pluginet att spelarna faktiskt står där i stället för att bara ha blivit tillsagda. Du kan också kräva en **färsk session** — 15 minuter som standard: hiscores sparas bara när en spelare loggar ut, så att få alla att logga om precis före sin bild är det som gör startsiffrorna bakom varje XP- och KC-ruta ärliga.',
          'Pluginanvändare trycker på en knapp. Alla andra skriver sitt lösenord i spelet och laddar upp på My Team. Du väljer vad som händer med en kreditering från någon som inte lämnat in: flagga den för granskning (standard) eller neka den tills de gör det. Samma panel på eventets Home är granskningslistan — pluginbilder med verifierat lösenord kommer in redan godkända, så i praktiken tittar du bara på mobilspelarna.',
        ],
      },
    },

    after: {
      title: 'Efter sista rutan',
      intro:
        'När klockan går ut fryser brädan och eventet låses — poäng, bidrag och vem-gjorde-vad fryses som de stod. Behöver du fixa något efteråt kan en admin låsa upp det medvetet.',
      rows: [
        {
          term: 'Utbetalningar',
          body: 'eventets **Prizes**-sida gör prispotten till en lista över vem som får vad, som bockas av medan du betalar ut.',
        },
        {
          term: 'Sammanfattning',
          body: 'en publik sammanfattningssida med slutställningen och utmärkelser efter eventet — största dropen, flest kills, och resten.',
        },
        {
          term: 'Enkät',
          body: 'fråga klanen vad de tyckte. Bygg den i Survey-fliken; spelarna svarar när eventet är slut och bara staben ser resultaten.',
        },
        {
          term: 'Spara som mall',
          body: 'behåll brädan du just byggt, från eventets **Settings → More**. Nästa bingo börjar från den i stället för ett tomt rutnät.',
        },
      ],
      federation:
        'Med federation påslaget kan medlemmarna också koppla upp sig mot andra Anvil-klaner från pluginet — praktiskt för event över klangränser, och helt frivilligt per medlem.',
      outro: 'Peka sedan dina medlemmar mot [installationsguiden för spelare]({pluginGuide}) och börja planera nästa.',
    },
    survey: {
      title: 'Fråga spelarna',
      intro: 'Slå på **Post-event survey** under **Features**, och öppna sedan eventets sida **Survey**.',
      body: [
        'Under **Build** lägger du till frågor: **Rating (1–5)**, **Free text**, **Choose one** eller **Choose many**, var och en eventuellt **Required**. Eller ladda en mall: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** eller **Skilling / social**. **Preview the participant view** visar den så som en spelare ser den.',
        'Den öppnas när eventet slutar, bara för godkända deltagare, och de kan ändra sina svar senare. **Results** visar svaren **By question** eller **By person**. Den är inte anonym: staben ser vem som sa vad.',
      ],
    },
  },

  clanVsClan: {
    metaTitle: 'Att vara värd för en gästklan — Anvils värdguide',
    metaDescription:
      'Kör klan mot klan på Anvil: ge varje gästklan en inbjudningslänk som placerar deras spelare i ett lag, och en plats så att deras egen moderator sköter sin halva.',
    eyebrow: 'Anvil · för värdar',
    title: 'Att vara värd för en gästklan',
    dek: 'Du är värd för brädan; de ställer upp med truppen. Det här är vägen som slipper samla in ett dussin RSN i ett DM — en länk per lag, och en plats som låter deras egen moderator sköta sin halva av eventet.',
    facts: [
      { strong: '1 länk', rest: 'per gästlag' },
      { strong: '0 adminplatser', rest: 'utdelade till utomstående' },
      { strong: '~5 min', rest: 'per klan du bjuder in' },
    ],
    footnote:
      'Skärmbilderna kommer från en riktig uppsättning på en testbräda — inbjudningstoken och Discord-namn är maskade. En riktig länk är värd att vakta: alla som har den kan ta en plats i det laget så länge den är aktiv.',

    teamCompsLine: "Vill du att klaner tävlar i skills eller bosses istället? Se [Lagtävlingar]({teamCompsGuide}).",

    shape: {
      title: 'Det du håller på att sätta upp',
      body: [
        'Klan mot klan är ett helt vanligt event med en skillnad: hälften av spelarna är inte i din klan och kommer aldrig att vara det. De kan inte synkas in från medlemslistan, du vill inte befordra dem, och du vill definitivt inte anmäla tjugo av dem för hand och sedan dra var och en till rätt lag.',
        'Två bitar löser det, och de är oberoende — använd den ena, eller båda.',
      ],
      rows: [
        {
          term: 'En inbjudningslänk',
          body: 'en URL du skapar en gång för ett lag. Den som öppnar den loggar in, fyller i det vanliga anmälningsformuläret och landar i det laget redan godkänd — ingen draftpool, ingen godkännandekö.',
        },
        {
          term: 'En plats i lagstaben',
          body: 'en namngiven person som kan sköta _just det ena laget_ — dess trupp, dess inskickade bevis, dess avgifter — utan ett adminkonto här, och utan att ta kaptensplatsen från den som faktiskt spelar.',
        },
      ],
      note: {
        tag: 'Vad en inbjudan inte är',
        body: 'Det är inte en inloggning och ingen genväg förbi verifiering. Den som öppnar den loggar ändå in med Discord och behöver ändå ett verifierat RSN, precis som vid vilken annan anmälan som helst. Det enda länken avgör är _vilket lag_ anmälan hamnar i, och att den inte behöver någons godkännande.',
      },
    },

    team: {
      title: 'Skapa laget först',
      body: [
        'Öppna ditt event och gå till sidan **Teams & draft**. Skapa ett lag per klan du bjudit in och döp det efter dem — namnet är det deras spelare ser i anmälningsformuläret, så “Ironforge” slår “Lag 2”.',
        'Du behöver _inte_ köra en draft. Inbjudningslänkar och en draft är alternativ: en draft fördelar en gemensam anmälningspool, en länk placerar folk direkt. I ett rent klan-mot-klan skapar de flesta värdar lagen, delar ut en länk var, och öppnar aldrig draften.',
        'Öppna sedan laget självt — **Teams & draft → laget** — för det är där båda de två nästa stegen sker.',
      ],
      captainNote: {
        tag: 'Kaptenen först',
        body: 'Utse den besökande sidans kapten innan du delar ut länken, så att lagsidan har en ägare från början. Att utse en kapten placerar dem också i laget; varnar kortet för att de inte står i truppen, ta emot rättelsen det erbjuder.',
      },
    },

    staff: {
      title: 'Ge deras moderator en plats',
      body: [
        'Panelen **Team staff** på lagsidan är hur gästklanens egen moderator kommer igång utan att du ger dem något alls på din sajt. Tryck **Add someone**, sök upp dem, lägg till en notering som “Ironforge’s mod” så nästa admin vet varför de är där, och tryck **Give a seat**.',
      ],
      figure: {
        caption: 'Eventet → Teams & draft → laget → Team staff',
        alt: 'Team staff-panelen med en tilldelad plats och sökfältet öppet för att lägga till fler',
        legend: [
          {
            label: 'Add someone',
            body: 'öppnar sökningen. Bara personer som loggat in här med Discord minst en gång kan dyka upp — se noteringen nedan.',
          },
          {
            label: 'Noteringen',
            body: 'fritext, 120 tecken. Skriv vilken klan de kommer från. Platser blir kvar i listan efter eventet, och “vem är det här?” är frågan du sitter med om tre månader.',
          },
          {
            label: 'Remove',
            body: 'tar tillbaka platsen direkt. Gör det när eventet är slut — en plats är inte tidsbegränsad av sig själv.',
          },
        ],
      },
      canDo: 'Vad en plats kan göra, bara i det laget:',
      canDoList: [
        'se och sköta lagets trupp',
        'hantera dess inskickade bevis',
        'markera dess spelares avgifter betalda',
        'skapa inbjudningslänkar till det, om du slår på det (steget efter nästa)',
      ],
      cantDo: 'Vad den aldrig kan göra:',
      cantDoList: [
        'röra något annat lag',
        'redigera brädan eller dess rutor',
        'göra draftval',
        'byta ut någon när eventet väl är igång',
      ],
      note: {
        tag: 'De måste logga in här en gång först',
        body: 'Sökningen listar bara konton med kopplad Discord — en plats hänger på en person som faktiskt kan logga in. Skicka alltså gästklanens moderator till den här sajten, be dem trycka **Login** en gång, och ge _sedan_ platsen. Dyker de inte upp i sökningen har den inloggningen inte skett än.',
      },
    },

    link: {
      title: 'Skapa inbjudningslänken',
      body: [
        'Fortfarande på lagsidan skapar panelen **Invite links** länken. Två fält avgör vad länken lovar, och båda tolkar `0` som “lova ingenting”.',
      ],
      figure: {
        caption: 'Eventet → Teams & draft → laget → Invite links',
        alt: 'Invite links-panelen med fälten för platser och giltighetstid, knappen Make a link, och en aktiv länk i listan',
        legend: [
          {
            label: 'Seats och Expires in hours',
            body: 'hur många personer länken får placera (upp till 100) och hur länge den gäller (upp till 30 dagar). Sätt platserna till storleken på truppen de lovat dig så stänger länken sig själv när alla är inne; sätt en giltighetstid när länken ska ut i en offentlig Discord. `0` i något av fälten betyder ingen gräns.',
          },
          {
            label: 'Make a link',
            body: 'skapar den och kopierar den till urklipp direkt. Klistra in den till dem innan du gör något annat.',
          },
          {
            label: 'Listan över aktiva länkar',
            body: 'varje länk laget har ute, med hur många som gått med och hur många platser som är kvar. **Copy** hämtar den igen; **Turn off** dödar den för gott.',
          },
        ],
      },
      shape:
        'Länken ser ut så här: `{origin}/events/{eventId}/join/{token}` — en rad, trygg att klistra in i ett Discord-meddelande.',
      note: {
        tag: 'Vettiga standardval',
        body: 'I ett klan-mot-klan där du kommit överens om en trupp med en moderator: lämna båda fälten på `0` och låt dem sköta det. Ta till platser och giltighetstid när länken ska någonstans du inte kontrollerar.',
      },
      revoke:
        'Att stänga av en länk sker direkt och tar inte bort någon som redan gått med — de är vanliga spelare i laget nu. Vill du ta bort någon, använd lagets trupp.',
    },

    captains: {
      title: 'Låt dem skapa egna länkar',
      body: [
        'Som standard är det bara en värd som kan skapa länkar, och en kapten som försöker får veta det. Den standarden är rätt för ett vanligt klanevent — en kapten som delar ut platser fyller en trupp ingen godkänt — och fel för ett klan-mot-klan, där den besökande sidan känner sin egen trupp bättre än du.',
        'Reglaget sitter i samma **Invite links**-panel: **Let captains make their own links**. Det gäller _varje lag i det här eventet_, inte bara det du tittar på — vilket är precis vad du vill när båda sidor är gästklaner.',
        'Med det påslaget kan lagets kapten och alla med en plats i staben skapa länkar själva från **My Team → Invite links**. De får samma panel som du, minus reglaget.',
      ],
      figure: {
        caption: 'My Team → laget → Invite links',
        alt: 'Invite links-fliken sedd från kaptenens håll i lagnavet, med fälten för platser och giltighetstid och en aktiv länk',
        legend: [
          {
            label: 'Samma panel, kaptenens vy',
            body: 'skapa, kopiera, stäng av. Har värden inte slagit på reglaget står det “Only a host can make links for this event” och fälten är borta.',
          },
          {
            label: 'Listan över aktiva länkar',
            body: 'en kapten som inte får skapa ser ändå länkarna laget har ute — så att de kan be dig om en till i stället för att anta att det inte finns några.',
          },
        ],
      },
    },

    player: {
      title: 'Vad deras spelare ser',
      intro:
        'Värt att gå igenom en gång själv innan du delar ut länken, så att du kan svara på frågor om den.',
      steps: [
        'De öppnar länken. Är de inte inloggade loggar de in med Discord först och kommer direkt tillbaka — länken tappas inte bort på vägen.',
        'De landar på det vanliga anmälningsformuläret, med en banner som säger **You’re joining {teamExample} by invite**. Samma frågor, samma kontoväljare, samma avgift som för alla andra.',
        'När de skickar in är de i det laget, godkända. Ingen åtgärd från värden, ingen draft.',
      ],
      figure: {
        caption: 'Anmälningsformuläret, öppnat via en inbjudningslänk',
        alt: 'Eventets anmälningsformulär med en banner om att spelaren går med i ett namngivet lag via inbjudan',
        legend: [
          {
            label: 'Inbjudningsbannern',
            body: 'namnger laget de är på väg att gå med i. Namnger den fel lag har de fel länk — stanna och kontrollera innan de skickar in.',
          },
          {
            label: 'Resten av formuläret',
            body: 'oförändrat. Ett verifierat RSN krävs fortfarande, anmälningsfrågorna ställs fortfarande, och en anmälningsavgift gäller fortfarande.',
          },
        ],
      },
      note: {
        tag: 'Redan anmäld?',
        body: 'Har någon anmält sig på vanligt vis först och sitter i poolen flyttar länken dem till laget i stället för att skapa en andra anmälan. Den som redan godkänts till ett annat lag lämnas i fred — flytta dem från truppen i stället.',
      },
    },

    dead: {
      title: 'När en länk slutar fungera',
      intro:
        'En nekad länk förklarar sig själv på sidan i stället för att ge en 404, så den som har den kan berätta vilken av dessa det är.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Någon tryckte **Turn off**. Skapa en ny — en gammal länk kommer aldrig tillbaka.',
        },
        {
          term: 'This invite has expired.',
          body: 'Den nådde timmarna du satte. Skapa en till, den här gången med `0` timmar om giltighetstiden inte gör någon nytta.',
        },
        {
          term: 'This invite is full.',
          body: 'Alla platser är tagna. Höj det genom att skapa en ny länk med fler platser — antalet ligger fast så snart en länk finns.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Den enda som kan lösa sig själv. Kontrollera eventets anmälningsfönster: har det öppnat än, har deadline passerat, eller har eventet redan startat.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'En länk från en annan bräda har klistrats in. Kontrollera att event-id:t i URL:en är det du menade.',
        },
      ],
      checklist: 'Före eventet, gå igenom den här listan en gång per gästklan:',
      checklistItems: [
        'deras lag finns och är uppkallat efter dem',
        'deras kapten är utsedd och placerad i laget',
        'deras moderator har loggat in här och har en plats i lagstaben',
        'länken är skapad, kopierad och faktiskt levererad till en människa',
        'anmälningsfönstret är öppet så länge de behöver det',
      ],
      note: {
        tag: 'När allt är över',
        body: 'Stäng av länkarna och ta bort platserna i lagstaben. Ingetdera går ut av sig självt, och en aktiv länk på ett avslutat event är bara en lös tråd.',
      },
    },
    cohost: {
      title: 'Om du är medvärd',
      intro: 'Allt ovan är värdens sida. Den besökande klanens stab får en egen sida för eventet, **Co-hosted with <host>**. Värden behåller datumen, draften, lagen och vem som kan se det.',
      rows: [
        {
          term: 'Din klans anmälningar',
          body: '**Approve**, **Reject** eller **Withdraw** din egen klans spelare. Du ser eller rör aldrig värdens.',
        },
        {
          term: 'Brädan',
          body: 'du kan bara redigera om värden gav din stab det. Annars kan du **Suggest a tile**: brickan, detaljer och poäng, upp till 25 väntande åt gången. Varje visas som **waiting**, **accepted ✓** eller **turned down** med värdens motivering.',
        },
        {
          term: 'Ditt lag',
          body: '**Manage** din klans lag.',
        },
        {
          term: 'Discord',
          body: 'dina admins väljer vad som når din egen server: **Everything shared**, **Big moments** eller **Nothing**, vilken kanal, vem som pingas, och om dina spelare får rollen **@Bingo player**.',
        },
      ],
    },
  },

  board: {
    metaTitle: 'Bygga en bräda — Anvils guide till rutredigering',
    metaDescription:
      'Skapa bingorutor som krediterar sig själva: vad varje rutsort faktiskt kan se, massredigering via kalkylark, och misstagen som misslyckas tyst.',
    eyebrow: 'Anvil · för brädbyggare',
    title: 'Bygg en bräda som spårar sig själv',
    dek: 'En ruta är ett löfte om att något kommer att märkas. Det här är vad varje sort faktiskt kan se, hur du skriver tvåhundra av dem utan att förlora kvällen, och de få misstag som misslyckas tyst — rutan utlöses helt enkelt aldrig, och ingen märker det förrän dag fyra.',
    facts: [
      { strong: '15 sorter', rest: 'en per ruta, aldrig blandade' },
      { strong: '1000 rutor', rest: 'per bräda, via kalkylark' },
      { strong: 'Tyst', rest: 'är hur en dålig ruta misslyckas' },
    ],
    footnote:
      'Kalkylarksformatet beskrivs i sin helhet i `docs/tile-authoring.md`, som är skrivet för den (eller det) som genererar raderna. Den här sidan är den mänskliga halvan: vilken sort du ska välja, och vad som går fel.',

    kinds: {
      title: 'En ruta, en sort',
      body: [
        'Varje ruta är exakt en _sort_, och sorten är hela frågan: den avgör vad pluginet eller hiscores-svepet håller utkik efter, och därmed om rutan över huvud taget kan bli klar av sig själv. Att blanda fält från två sorter avvisas i dörren i stället för att accepteras och lämnas trasigt.',
        'Sorterna faller i tre familjer, och familjen betyder mer än etiketten:',
      ],
      families: [
        {
          term: 'Manuell',
          body: 'en människa tittar på en skärmbild och säger ja. Alltid tillgänglig, fungerar alltid, kostar alltid någon deras kväll. Använd den till det programvara inte kan se.',
        },
        {
          term: 'Hämtad från Hiscores',
          body: 'färdighets-XP och boss-killcount, lästa från de officiella Hiscores i ett svep var 15:e minut. Kräver inget plugin och fungerar för alla på medlemslistan — men ser bara det Hiscores räknar, och först efter att spelaren loggat ut.',
        },
        {
          term: 'Upptäckt av pluginet',
          body: 'allt annat: drops, NPC-kills, klarningar på tid, diaries, combat tasks, varv, lootvärde. Krediterar inom sekunder och bakar in en bevisbild — men bara för spelare som faktiskt kör pluginet.',
        },
      ],
      kindsIntro: 'Hela listan, i den ordning sortväljaren erbjuder dem:',
      kindLabels: {
        standard: { label: 'Standard', blurb: 'Manuell ruta — en kapten markerar den som klar. Ingen automatisk spårning.' },
        skill: { label: 'Färdighet', blurb: 'Blir klar automatiskt när en färdighet når ett XP-mål (hämtat från hiscores).' },
        boss: { label: 'Boss-KC', blurb: 'Blir klar automatiskt när en boss når ett killcount-mål (hämtat från hiscores).' },
        drop: { label: 'Drop', blurb: 'N drops av ett föremål (eller vilket som helst ur en pool) — upptäckt av pluginet, med inbakad skärmbild.' },
        collection: { label: 'Föremålsset', blurb: 'Flera föremål, vart och ett med sitt eget krav — ett av varje för ett komplett set.' },
        kill: { label: 'Kills', blurb: 'N kills av vilken boss eller vilket monster som helst. Räknas från hiscores när varje monster på rutan finns där, annars av pluginet medan du spelar (höns, kor, Slayer-monster).' },
        lap: { label: 'Agility-varv', blurb: 'N varv på en agility-bana, eller N våningar / hela rundor i Hallowed Sepulchre — räknade live från spelets räknare. Bara varv som körs under eventet räknas.' },
        pvp: { label: 'PvP-kill', blurb: 'Döda spelare — vem som helst, rivaliserande lag, eller ett namngivet mål — i Wilderness eller på PvP-världar. Säkra minispel räknas aldrig.' },
        gain: { label: 'Föremålsvinst', blurb: 'Fånga, laga eller samla N av ett föremål — räknat från det som hamnar i inventoryt. Upptäckt av pluginet.' },
        timed: { label: 'På tid', blurb: 'Klara en aktivitet under ett tidstak (Inferno, raids, Colosseum). Pluginet tar tiden.' },
        deathless: { label: 'Utan dödsfall', blurb: 'Klara ett raid med NOLL dödsfall i laget, N gånger. Pluginet räknar varje dödsfall inne i instansen.' },
        lms: { label: 'LMS', blurb: 'Placera dig topp-N i Last Man Standing (1 = vinst), M gånger. Upptäckt av pluginet vid spelets slut.' },
        value: { label: 'Lootvärde', blurb: 'Loot värt X gp — ett byte, eller byten som tillsammans når ett mål. Pluginet prissätter bytet.' },
        diary: { label: 'Diary', blurb: 'Klara achievement diary-nivåer under eventet. Upptäckt av pluginet via meddelandet om avklarat.' },
        ca: { label: 'Combat task', blurb: 'Klara Combat Achievement-uppgifter under eventet. Upptäckt av pluginet via meddelandet om avklarat.' },
      },
      note: {
        tag: 'Pluginfrågan, ställd en gång',
        body: 'En ruta som pluginet upptäcker är osynlig för en spelare som inte kör pluginet. Det är ingen bugg du kan konfigurera bort — ingenting tittar. Spelar en del av din klan på mobil eller den officiella klienten: håll antingen de rutorna borta från vägen till en vinst, eller para ihop dem med ett manuellt alternativ och räkna med att granska skärmbilder.',
      },
    },

    pick: {
      title: 'Välj sorten som faktiskt utlöses',
      intro:
        'De flesta rutor som beter sig illa är rätt idé uttryckt som fel sort. De fyra som fångar folk:',
      rows: [
        {
          term: 'En bosslista plus ett monster utanför hiscores',
          body: 'är en plugin-ruta för **allt**. En Kills-ruta räknas bara från hiscores när varje monster på den finns där; lägg till en höna till fyra GWD-bossar så behöver hela rutan pluginet. Spelar en del av klanen utan, ge hiscores-bossarna en egen ruta.',
        },
        {
          term: 'En plats i collection log',
          body: 'är en drop-ruta. Upplåsningen av loggposten krediterar den, så rutan utlöses även på en dubblett spelaren redan ägde — vilket oftast är vad du menade.',
        },
        {
          term: '“Få en av varje”',
          body: 'är en drop-ruta med en föremålslista och **utan** `requiredAmount`. Lägg till ett `requiredAmount` så blir den tyst “få vilka N som helst av dessa” i stället — samma rad, en helt annan ruta.',
        },
        {
          term: 'En diary eller combat task',
          body: 'krediterar bara via meddelandet i spelet, som kommer i samma stund nivån eller uppgiften är klar. Något en spelare redan äger kan inte utlösas igen — utom en combat task, där **Settings → Combat Achievements → Repeat completion** låter dem utlösa den på nytt.',
        },
      ],
      note: {
        tag: 'Sammansatta boss-rutor',
        body: 'En boss-rutas spårade stat får rymma flera hiscores-nycklar separerade med komma, och framstegen summeras över dem. `chambersOfXeric,chambersOfXericChallengeMode` är en ruta som räknar CoX och CM tillsammans — vilket nästan alltid är vad en raid-ruta betyder.',
      },
    },

    bulk: {
      title: 'Skriv dem i klump, inte i webbläsaren',
      body: [
        'Att klicka fram ett 25-rutors nät går bra. Att klicka fram en Leagues-bräda med 200 uppgifter gör det inte, och inte heller att korrekturläsa den efteråt. Tiles-fliken har en tur-och-retur byggd för precis det.',
      ],
      steps: [
        '**Download spreadsheet** på eventets **Board & tiles**-sida. Du får en .xlsx av brädan som den ser ut nu, med rullgardiner, föremålslistan och kolumnanvisningarna på egna blad.',
        'Redigera den. En rad per ruta; radordningen är rutordningen.',
        '**Upload CSV / Excel** i samma flik. Bara **Tiles**-bladet läses.',
      ],
      rules: [
        {
          term: 'Turen tappar ingenting',
          body: 'ladda ner och ladda upp igen oförändrad så händer ingenting — matchande rader rapporteras som oförändrade och tidsstämplas inte ens. Det gör exporten trygg att använda som säkerhetskopia före en stor ändring.',
        },
        {
          term: 'Rader följer positioner',
          body: 'rad 1 är ruta 1. Befintliga rutor uppdateras på plats, och en kolumn du utelämnar lämnas i fred i stället för att tömmas — så du kan skicka ett ark med två kolumner som bara ändrar poäng.',
        },
        {
          term: 'Bara dynamiska brädor växer',
          body: 'extra rader skapar nya rutor på en Leagues-bräda eller ett rutrace, före eventets start, upp till 1000. Ett klassiskt N×N-nät har en fast form och ignorerar dem. Ska du generera hundratals uppgifter, gör det till ett Leagues-event.',
        },
        {
          term: 'Allt eller inget',
          body: 'alla rader valideras först. Ett enda föremålsnamn som inte går att slå upp får hela importen att misslyckas, namnger syndarna, och ändrar ingenting — du får aldrig en halv bräda.',
        },
        {
          term: 'Vissa fält låser vid start',
          body: 'namn, sort, krävt antal och föremålsuppsättning tillämpas bara före eventets start. Beskrivning, poäng, kategori och valfri-flaggan går att redigera hela vägen, så du kan fixa ett stavfel mitt i eventet utan att öppna brädan igen.',
        },
      ],
    },

    traps: {
      title: 'Misstagen som misslyckas tyst',
      intro:
        'Vart och ett av de här importeras snyggt, står på brädan och ser rätt ut, och utlöses aldrig. De är värda en genomläsning före uppladdningen snarare än efter.',
      rows: [
        {
          term: 'Färdighets- och boss-rutor är `type=standard`',
          body: 'det finns inget `type=skill`. Sorten kommer från `trackedStat` + `statType` + `statGoal` på en i övrigt vanlig standardrad. Att skriva `type=boss` avvisas; att skriva `type=standard` och glömma stat-kolumnerna gör det inte — då får du en manuell ruta ingen någonsin godkänner.',
        },
        {
          term: 'Avgränsarna skiljer sig åt mellan kolumner',
          body: '`items` använder semikolon (komma är CSV-avgränsaren). `targetNpcs` använder lodstreck. På en combat task-rad är lodstreck det **enda** alternativet, eftersom riktiga uppgiftsnamn innehåller komma — `Nylocas, On the Rocks` är en uppgift.',
        },
        {
          term: 'Raid-namn matchas ordagrant',
          body: 'en deathless- eller tidsruta bär läget precis som det stavas i spelet: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. En näraliggande stavning är en ruta som aldrig blir klar. Entry Mode-klarningar krediterar aldrig en vanlig raid-ruta; svårare lägen gör det.',
        },
        {
          term: 'Föremålsnamn måste vara exakta',
          body: 'stavningen från spelet, annars misslyckas importen och listar vad den inte kunde slå upp. Är ett namn tvetydigt, lås det som `Name#id` och sluta gissa.',
        },
        {
          term: '`timeThresholdSeconds` betyder fyra saker',
          body: 'ett tidstak på en tidsruta, en placeringsgräns på en LMS-ruta (1 = vinst), en exakt lagstorlek på en deathless-ruta, och en exakt raid-lagstorlek på en drop-ruta. Samma kolumn, fyra betydelser — kontrollera att du fyller i den din sort faktiskt läser.',
        },
        {
          term: 'Ett krävt antal på fel sort',
          body: 'det hör hemma på drop-, kill-, gain-, lap-, PvP-, deathless- och LMS-rader. På en stat- eller tidsrad gör det ingenting, och på en drop-rad förvandlar det ett föremålsset till en “vilka N som helst”-pool.',
        },
      ],
      note: {
        tag: 'Testa en innan du skriver tvåhundra',
        body: 'Skapa en enda ruta av den sort du är osäker på, avslöja den i ett slask-event, och gå och gör saken. Fem minuter där slår att upptäcka på klanens bingokväll att en hel kategori var död.',
      },
    },

    points: {
      title: 'Poäng, nivåer och om det är rättvist',
      body: [
        'På en poängsatt bräda bär varje ruta sitt eget värde, och de värdena översätts till namngivna svårighetsband — easy till elite — som du kan redigera under **Rules & scoring** om din klan graderar annorlunda. Bandet är vad spelarna läser; siffran är vad som räknas.',
        'Markera en ruta **optional** så slutar den räknas mot brädans total, och så lägger du till sträckmål utan att göra en blackout omöjlig.',
        'När brädan är full, kör **balansgranskaren** från Tiles-fliken. Den kollar strukturen och arbetsfördelningen och talar om var brädan lutar — en kategori ingen kan avsluta, ett band som är värt mycket mer per timme än sina grannar — innan spelarna hittar de sakerna åt dig och styr runt dem.',
      ],
    },

    reveal: {
      title: 'Ingen ser den förrän du säger till',
      body: [
        'Nya brädor börjar dolda. Staben ser dem alltid; spelarna ser ingenting alls förrän du avslöjar — så en bräda kan byggas öppet, över flera dagar, i en kanal dina medlemmar kan läsa, utan att något spoilas.',
        'Den huvudströmbrytaren är golvet under allt annat. På en bräda med en avslöjandepolicy — schemalagd, intervall, prisjakt eller roterande — börjar motorn vända enskilda rutor först när själva brädan är avslöjad, så att göra en bräda skarp är alltid en medveten handling. Vilken policy du ska välja har en egen sida: [Format, och hur rutor öppnas]({formatsGuide}).',
        'Uppdrag är undantaget som är värt att känna till: rutor skrivna i förväg men undanhållna, annonserade mitt i eventet ur sin egen pool medan resten av brädan förblir synlig.',
      ],
    },

    check: {
      title: 'Innan du avslöjar',
      intro: 'Värt att gå igenom en gång per bräda. Det mesta tar fem minuter.',
      items: [
        'varje ruta har den sort du menade, inte den sort som importerades snyggt',
        'raid-lägen, föremålsnamn och uppgiftsnamn matchar spelets stavning tecken för tecken',
        'de plugin-upptäckta rutorna är inte enda vägen till vinst, om en del av din klan spelar utan det',
        'poängen är satta och balansgranskaren är nöjd, eller så är du oense med den med flit',
        'valfria rutor är markerade som valfria',
        'du har laddat ner kalkylarket en gång, som en säkerhetskopia du kan ladda upp igen',
      ],
      note: {
        tag: 'Vem får göra det här',
        body: 'Brädredigering är det enda adminjobbet med en egen roll. En **editor** kan skapa rutor och inget annat, och kan begränsas till specifika brädor — så en inbjuden brädbyggare från en annan klan får exakt det event du lämnat över, utan åtkomst till något annat du kör.',
      },
    },
    library: {
      title: 'Uppgiftsbiblioteket och förslag',
      body: [
        'Brickredigerare har **Task library** i admin-menyn: din klans sparade uppgifter, och Anvils eget bibliotek att kopiera från. **⬇ Export pack** sparar dina uppgifter som en fil och **⬆ Import pack** laddar in en, och det är så en bräda flyttar mellan klaner.',
        'Hittade du ett fel i Anvils bibliotek, eller en uppgift som saknas? Tryck på **Suggest a fix** på uppgiften, eller **Suggest a new task**. Anvil granskar det och svaret visas under **Your suggestions**: **Waiting for review**, **Approved** eller **Not taken**, med en notering. Du kan ha 5 väntande. En godkänd rättelse når varje klankopia som fortfarande följer biblioteket.',
      ],
    },
    stats: {
      title: 'Startstatistik och sena deltagare',
      intro: 'XP- och dödsantalsbrickor jämför varje spelares stats nu med deras **starting stats**, tagna när eventet startar. Eventets sida **Stats** är där du kollar och rättar dem:',
      rows: [
        {
          term: 'Ta startstatistik',
          body: 'före start värmer den bara upp hiscores; själva startlinjen tas vid start. Efter start blir knappen **Capture late joiners**, för spelare som lagts till sedan dess. Den kan köras en gång var 30:e minut.',
        },
        {
          term: 'Uppdatera nu',
          body: 'uppdaterar ställningarna från de senaste siffrorna. De uppdateras också varje timme av sig själva.',
        },
        {
          term: 'Rätta baslinjen',
          body: 'per spelare: ändra en färdighets eller bossens startsiffra för hand. Använd den när en grind från före eventet inte räknades, eftersom spelaren inte loggade ut innan det startade.',
        },
        {
          term: 'Återställ alla startstatistiker',
          body: 'gömt under **Danger zone**: tar alla startlinjer på nytt från deras stats nu och raderar alla vinster hittills. Bara för ett event som startade av misstag.',
        },
      ],
      outro: 'Under det visar **Member breakdown** vem i varje lag som gjorde vad, och **Stat tile standings** varje spelares start- och aktuella siffror på varje XP- eller dödsantalsbricka.',
    },
  },

  captain: {
    metaTitle: 'Kaptensguiden — Anvil',
    metaDescription:
      'Draftdagen och veckorna efter: att läsa poolen innan klockan startar, att välja, och att sköta ditt lags trupp, bevis och avgifter.',
    eyebrow: 'Anvil · för lagkaptener',
    title: 'Kaptensguiden',
    dek: 'Du får ett krigsrum, en klocka och tjugofem främlingars anmälningsformulär i handen. Det här är vad alltihop gör, i den ordning du möter det — plus de delar av att leda ett lag som börjar först när draften är över.',
    facts: [
      { strong: 'Ormordning', rest: 'så att sena val jämnas ut' },
      { strong: 'Klockan', rest: 'väljer aldrig åt dig' },
      { strong: 'En flik', rest: 'sköter ditt lag hela eventet' },
    ],
    footnote:
      'Allt här är vad en kapten ser. Avgifter, andra lags trupper och brädan före avslöjandet hör staben till och förblir så, så inget på den här sidan kan få dig anklagad för att ha tittat på något du inte fick.',

    before: {
      title: 'Vad du får, och när',
      body: [
        'En värd utser dig till kapten, vilket gör två saker: det placerar dig i laget som spelare, och det öppnar lagets ytor för dig. Varnar lagsidan någonsin för att du faktiskt inte står i truppen, ta emot rättelsen den erbjuder — en kapten utanför sitt eget lag är ett tillstånd som förvirrar varje skärm längre ner.',
        'Därefter har du två ställen att vara på. **My Team** är ditt lags nav, och det är där du tillbringar eventet. **Krigsrummet** är draftdagens skärm, och det öppnar så snart anmälan gör det — långt före draftkvällen.',
      ],
      note: {
        tag: 'Gå in tidigt',
        body: 'Krigsrummet är mest värt i dagarna _före_ draften, när du hinner läsa varje anmälan ordentligt. På själva kvällen blir det ett stoppur och du får inte tid att läsa någonting.',
      },
    },

    warroom: {
      title: 'Läs poolen innan klockan startar',
      body: [
        'Krigsrummet visar alla som kan väljas, med allt sajten vet om dem: vad de spelar, vilka bossar de har riktiga killcounts på, hur många tidigare event de dök upp till, och svaren de gav i anmälningsformuläret.',
        'De svaren är **frysta som de skickades in**. Ingen redigerar sina “timmar per vecka” efter att ha sett vem som valdes först, och det är hela anledningen till att de är värda att läsa.',
        'Bygg en **kandidatlista** medan du läser. Den är privat, den överlever till draftkvällen, och på kvällen är den skillnaden mellan att välja ur en lista du redan litar på och att välja den som råkar ligga överst.',
      ],
      rows: [
        {
          term: 'Betyg och nivå',
          body: 'en sammanfattning av vad någon faktiskt har gjort, härledd ur deras kontohistorik snarare än ur vad de berättade för dig. Vägledande — en utgångspunkt för ett samtal, inte en dom.',
        },
        {
          term: 'Områden och markörer',
          body: 'vad de bevisligen gör: raids, PvM, skilling, PvP. Användbart för att hitta luckan i din trupp i stället för att ta det högsta talet fyra gånger.',
        },
        {
          term: 'Närvaro',
          body: 'hur ofta de slutförde tidigare event de anmält sig till. Det tystaste talet på sidan och ofta det som säger mest.',
        },
      ],
    },

    draft: {
      title: 'Draftdagen',
      body: [
        'Valen går i **ormordning**: med fyra lag går första rundan A, B, C, D och andra D, C, B, A, så att välja sist i en runda betyder att välja först i nästa. Den som drog första valet betalar för det en minut senare.',
        'En person är ett val, inte ett konto. Att ta någon drar med alla konton de registrerat till ditt lag på en gång — du lägger aldrig ett andra val på någons altkonto.',
      ],
      rows: [
        {
          term: 'Valklockan',
          body: 'har värden satt en får du så många sekunder per tur. När den går ut väljer den **inte** åt dig — den låser upp värdens möjlighet att välja å dina vägnar, och säger det på båda skärmarna. Ingenting sker i tysthet.',
        },
        {
          term: 'En smalare lista',
          body: 'vissa event kör ett balansläge. Beroende på vilket kan det starkaste laget hindras från att ta ännu en toppspelare medan en rival inte har någon, eller ha ett tak för hur långt över snittet dess trupp får gå. Är någon du ville ha nedtonad är det därför, och det gäller alla.',
        },
        {
          term: 'Om du missar den',
          body: 'säg till värden i förväg. De kan välja åt dig från samma bräda, och en kandidatlista du lämnat efter dig är instruktionen de följer.',
        },
      ],
      note: {
        tag: 'Draften låser truppen',
        body: 'När en draft väl är igång är både lagen och valordningen frysta. Saknas ett lag eller är ordningen fel måste det åtgärdas före första valet, inte efter.',
      },
    },

    roster: {
      title: 'Ditt lags nav, hela eventet',
      intro:
        'På **My Team** rymmer kortet **Manage this team** allt du kan göra för din sida. Det kommer hopfällt; öppna det en gång så stannar det där du lämnade det.',
      rows: [
        {
          term: 'Roster',
          body: 'vilka som är i laget och vad de bidragit med. Första stället att titta när någon frågar varför deras drop inte räknades — ett okopplat konto syns här.',
        },
        {
          term: 'Requests',
          body: 'folk som ber att få gå med, på event där spelarna väljer lag själva. Syns bara när det finns några.',
        },
        {
          term: 'Proof',
          body: 'ditt lags inskickade bevis och deras skärmbilder. Du är inte den som godkänner till slut — det är staben — men du ser vad som skickats och kan jaga det som inte gjort det.',
        },
        {
          term: 'Fees',
          body: 'vilka i ditt lag som fortfarande är skyldiga anmälningsavgift. Du kan markera en som betald; att bekräfta den är stabens jobb, med flit.',
        },
        {
          term: 'Invite links',
          body: 'dyker upp när värden tillåtit kaptener att skapa egna. En länk placerar den som öppnar den direkt i ditt lag. Se [Att vara värd för en gästklan]({clanVsClanGuide}) för vad länken faktiskt gör.',
        },
      ],
    },

    during: {
      title: 'Att köra det när det väl börjat',
      body: [
        'Det mesta av eventet sköter sig självt: pluginet krediterar det det ser och arkiverar en stämplad skärmbild för det. Kvar blir människor, och det är jobbet.',
        'Det som verkligen behöver en kapten: att se till att alla på din sida har pluginet anslutet och sina konton kopplade före startskottet, för ett okopplat altkonto bidrar till ingenting; att lägga märke till vilka rutor ingen rört vid halvtid; och att få de manuella rutorna fotograferade före sista timmen, när alla försöker samtidigt.',
        'Kräver eventet en startbild är det den enda sak varje spelare måste göra själv under de första timmarna. Jaga den tidigt — en spelare utan får varje kreditering flaggad, eller nekad rakt av, beroende på hur värden ställt in det.',
      ],
      note: {
        tag: 'Byten',
        body: 'När ett event väl är igång är det bara admins som kan byta ut någon, med flit: bidrag är redan knutna till personer. Fråga en värd i stället för att laborera runt det.',
      },
    },
  },

  formats: {
    metaTitle: 'Format, och hur rutor öppnas — Anvil',
    metaDescription:
      'De sju eventformaten, de fem sätten rutor kan öppnas på, och poängmodifierarna — vad var och en gör med hur ett event känns att spela.',
    eyebrow: 'Anvil · för klanens stab',
    title: 'Format, och hur rutor öppnas',
    dek: 'Två beslut formar ett event mer än alla rutor i det: vilken form brädan har, och hur rutor blir spelbara. De är oberoende — vilket format som helst kan använda vilken avslöjandepolicy som helst — och tillsammans är de skillnaden mellan en veckas slit och en kvälls kapplöpning.',
    facts: [
      { strong: '7 format', rest: 'brädans form' },
      { strong: '5 policyer', rest: 'hur rutor öppnas' },
      { strong: '3 modifierare', rest: 'vad ett avklarat mål är värt' },
    ],
    footnote:
      'Formatet bestäms vid skapandet men går att ändra efteråt från eventets flik Settings → Event; avslöjandepolicyn och poängmodifierarna kan ändras när som helst innan rutorna de påverkar avslöjas.',

    shape: {
      title: 'Brädans form',
      intro:
        'Formatet avgör hur brädan poängsätts och vad skapandeformuläret frågar dig om härnäst. Allt annat på den här sidan byggs ovanpå det.',
      note: {
        tag: 'Fast rutnät eller uppgiftslista',
        body: 'En **klassisk** bräda är en äkta kvadrat, så “N på 5” betyder exakt 25 rutor och antalet kan aldrig ändras. Allt annat är en uppgiftslista av valfri längd, vilket också är den enda sortens bräda en kalkylarksimport kan få att växa. Ska du generera hundra uppgifter fattas det beslutet här.',
      },
    },

    reveal: {
      title: 'Hur rutor öppnas',
      intro:
        'Oberoende av formatet. Eventets avslöjandereglage är fortfarande huvudporten — så länge en bräda är dold syns ingenting och ingen av de här motorerna går, så du gör alltid en bräda skarp medvetet.',
      rows: [
        {
          term: 'Allt på en gång',
          body: 'klassikern. Varje ruta är spelbar i samma stund du avslöjar brädan, och lagen väljer själva ordning. Välj det här om du inte har skäl att låta bli.',
        },
        {
          term: 'Schemalagt',
          body: 'varje ruta bär sin egen avslöjandetid, satt i Tiles-fliken, och går live när tiden passerar. En “timmens ruta”-bräda: den sätter tempot åt dig och kräver att tiderna skrivs in i förväg.',
        },
        {
          term: 'Intervall',
          body: 'motorn drar dolda rutor med fast intervall — en omgång var N:e minut, slumpmässigt eller i brädordning. En bingoutropare. Ingen extra redigering utöver rutorna själva, och brädan avslöjar sig medan du sover.',
        },
        {
          term: 'Prisjakt',
          body: 'exakt en ruta är öppen i taget, och första laget som klarar den tar den — rutan stängs och nästa dras direkt. Hänsynslöst, mycket sevärt, och obarmhärtigt mot tidszoner.',
        },
        {
          term: 'Roterande',
          body: 'ett rullande fönster med några få öppna rutor: varje dragning öppnar nya och låter de äldsta gå ut. Till skillnad från prisjakt hinner alla klara en öppen ruta innan den försvinner. Byggt för individuella stegar.',
        },
      ],
      note: {
        tag: 'Tidszonsfrågan',
        body: 'Prisjakts- och intervallbrädor belönar den som råkar vara vaken. I en klan spridd över världen är det en verklig fördel utdelad av klockan snarare än av spel. Roterande fönster mjukar upp det — en öppen ruta står öppen så länge fönstret varar, så en sovande spelare får ändå en chans.',
      },
    },

    scoring: {
      title: 'Vad ett avklarat mål är värt',
      intro:
        'Tre modifierare, alla bara i poängläge, alla frysta in i avklarandet i samma stund det sker — så en ändring du gör senare skriver aldrig om historien.',
      rows: [
        {
          term: 'Bonus till första laget',
          body: 'extrapoäng till första laget som klarar varje ruta. Det billigaste sättet att få en bräda där allt syns att kännas som en kapplöpning utan att ändra något annat.',
        },
        {
          term: 'Avtagande värde',
          body: 'en rutas värde skalas linjärt från fullt vid avslöjandet till en målprocent efter N timmar, och håller sedan. Under 100 % avtar det och belönar snabbhet; över 100 % **växer** det, vilket belönar att rensa de gamla uppgifterna alla hoppade över. Den växande riktningen är den folk glömmer finns.',
        },
        {
          term: 'Lockout',
          body: 'det första avklarandet stänger rutan för alla andra. Underförstått i prisjakt. På en bräda med stor spridning i lagstyrka kan det avgöra tävlingen tidigt — den är som bäst när lagen står nära varandra.',
        },
      ],
    },

    missions: {
      title: 'Uppdrag: överraskningar mitt i eventet',
      body: [
        'Uppdrag är rutor skrivna i förväg och undanhållna — annonserade ur sin egen pool medan resten av brädan förblir synlig. De är oberoende av avslöjandepolicyn, så även en vanlig bingo där allt syns kan ha dem.',
        'Släpp dem för hand när brädan blir tyst, med fast intervall, eller enligt ett schema per uppdrag. Varje uppdrag bär sin egen poängsättning: sin egen lockout, bonus, avtagande värde och utgång, satt per ruta i stället för för eventet.',
        'De är det billigaste sättet att väcka en bräda på dag fem — och dag fem är den dag varje långt event behöver väckas.',
      ],
    },

    choose: {
      title: 'Att välja, på en sida',
      intro: 'Vet du vilken känsla du vill ha är det här kortaste vägen dit.',
      rows: [
        { term: 'En vanlig klanbingo', body: 'Klassiskt rutnät, alla rutor synliga. Lägg till en bonus till första laget om du vill ha lite brådska.' },
        { term: 'Hundratals uppgifter, poängsatta efter svårighet', body: 'Leagues, allt synligt. Det är också den enda formen en stor kalkylarksimport kan växa in i.' },
        { term: 'En vecka som byggs mot något', body: 'Leagues med schemalagt eller intervallavslöjande, så att brädan öppnar sig över veckan i stället för på en gång.' },
        { term: 'En kväll folk följer live', body: 'Prisjakt. En ruta, första laget tar den, nästa ruta direkt.' },
        { term: 'En individuell tävling, inte en lagtävling', body: 'Stege med roterande fönster och avtagande värde. Uppgifter kommer och går och ingen kan spara dem.' },
        { term: 'Ett race med en mållinje', body: 'Rutrace — en ordnad bana, och den som når längst vinner.' },
      ],
      outro:
        'Vad du än väljer är rutorna själva samma jobb: se [Bygg en bräda som spårar sig själv]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Avgifter och utbetalningar — Anvils kassörsguide',
    metaDescription:
      'Att ta ut en anmälningsavgift, samla in den, den andra signaturen som avslutar den, och att göra prispotten till utbetalda placeringar.',
    eyebrow: 'Anvil · för kassörer',
    title: 'Avgifter och utbetalningar',
    dek: 'Pengar är där klanevent går fel, och de går fel i tysthet: en avgift någon svär att de betalat, en pott ingen får att gå ihop, en prisfördelning som diskuteras efter att vinnarna loggat ut. Det här är vägen som lämnar ett spår vid varje steg.',
    facts: [
      { strong: '2 signaturer', rest: 'avslutar en avgift som standard' },
      { strong: 'Pott = tillagt', rest: '+ avgift × godkända anmälningar' },
      { strong: '1 rad', rest: 'per person som får betalt' },
    ],
    footnote:
      'Avgifter och utbetalningar är kassörens yta. En kassör kan allt en moderator kan, plus det här; en vanlig moderator ser inte avgiftssidorna alls.',

    set: {
      title: 'Att sätta avgiften',
      body: [
        'Anmälningsavgiften ligger på eventet, satt när du skapar det eller redigerad från dess **Sign-ups**-flik. Ingen avgift alls är ett helt bra svar — massor av event går på en pott värden lagt in själv.',
        'Två inställningar avgör vad avgiften faktiskt betyder, och de är lätta att missa:',
      ],
      rows: [
        {
          term: 'Per person eller per konto',
          body: 'på ett event där folk får ställa upp med flera konton avgör den om de betalar en gång eller en gång var. Blir den fel kommer du att betala tillbaka pengar.',
        },
        {
          term: 'Betalningsdeadline',
          body: 'när den passerat slutar obetalda anmälningar vara något du jagar och blir ett beslut. Sätt den tidigare än du tror — dagen före eventet är för sent för att ersätta någon.',
        },
        {
          term: 'Gästavgift',
          body: 'det som spelare betalar när de inte är medlemmar i en klan som kör brädet. Lämna den tom så betalar gäster medlemsavgiften. Ska en spelare betala ett annat belopp trycker du på **Change this player’s fee** på spelarens rad i **Sign-ups**.',
        },
      ],
      note: {
        tag: 'Potten följer anmälningarna',
        body: 'Den visade prispotten är det du lagt in för hand, plus anmälningsavgiften gånger antalet **godkända** anmälningar. Den rör sig när anmälningar godkänns och utesluts, så talet på sidan är alltid det du faktiskt kan betala ut.',
      },
    },

    collect: {
      title: 'Att samla in',
      body: [
        'Avgifter samlas in på det sätt din klan redan samlar in pengar — i spelet, i Discord, hur ni nu gör. Anvils jobb börjar i samma stund pengarna kommer: någon med stabsåtkomst markerar den **betald**, och det stämplar vem som säger sig ha tagit emot och när.',
        'Spelarna har också ett ord med i laget. En medlem kan rapportera vem de betalade och bifoga en skärmbild, och det är det som gör “jag har definitivt betalat” till en anteckning med två ändar. När spelarens rapport och insamlarens påstående namnger olika personer är det en tvist sajten kan visa dig, i stället för en du upptäcker mitt i ett gräl.',
        'Att påminna är en knapp: **Remind unpaid** under Admin → **Fees** skickar ett Discord-DM till alla i det eventet som fortfarande är skyldiga.',
      ],
      note: {
        tag: 'Beviset raderas med flit',
        body: 'En betalningsskärmbild sparas bara tills avgiften är avslutad, sedan tas den bort. Den finns för att lösa en oenighet, inte för att ligga i ett arkiv i ett år.',
      },
    },

    sign: {
      title: 'Den andra signaturen',
      body: [
        'En avgift står som **insamlad** tills en _annan_ i staben bekräftar att den kommit fram. Den som hanterat pengarna kan inte också vara den som skriver under på att de dök upp — det är hela kontrollen, och därför vägrar sajten en insamlares egen bekräftelse i stället för att bara avråda från den.',
        'Hur många signaturer en avgift kräver är en klaninställning (**Clan settings → Rules & scoring → Fee sign-off**), från noll till fem. Noll finns av ett riktigt skäl: i en klan där kassören _är_ ägaren finns det ingen annan att skriva under, och “34 avgifter väntar på en andra signatur” blir en kö som aldrig går att tömma och permanent det högsta på instrumentpanelen. Vid noll **är** det att markera en avgift betald själva underskriften.',
        'Sätt den till ett — standard — om ni är två. Sätt den till noll om ni ärligt talat inte är det, och sätt den högre bara om din klan har både folket och skälet.',
      ],
    },

    pay: {
      title: 'Att betala ut',
      body: [
        'När eventet är slut gör eventets **Prizes**-sida potten till en lista över människor. Generera den så får du en rad per mottagare, inte per lag: ett vinnande lags pris delas jämnt mellan medlemmarna, så att utbetalningen blir en lista med namn och tal snarare än ett räkneproblem vid midnatt.',
        'Beloppen börjar från en föreslagen fördelning — tung i toppen, och ju fler betalda placeringar du sätter desto flackare blir den — och varje rad går att redigera. Förslaget är en utgångspunkt, inte en policy.',
        'Betala dem sedan och bocka av rader medan du går. Poängen är att någon en vecka senare kan titta på listan och se vem som fick vad, i stället för att rekonstruera det ur Discord-historiken.',
      ],
      note: {
        tag: 'Annonsera det en gång, härifrån',
        body: 'Utbetalningar postas till era Discord-kanaler från själva eventet, så att annonseringen och anteckningen är samma sak. Ett pris som annonseras för hand är ett pris någon senare påstår aldrig kom.',
      },
    },

    disputes: {
      title: 'När talen inte stämmer överens',
      intro: 'De fyra du faktiskt kommer att möta:',
      rows: [
        {
          term: 'De säger att de betalat, ingen markerade det',
          body: 'be dem rapportera betalningen med en skärmbild. Det sätter en namngiven insamlare och en tidsstämpel på anteckningen, och den namngivna personen kan bekräfta eller neka.',
        },
        {
          term: 'Två i staben tror båda att de tog emot',
          body: 'spelarens egen rapport är avgörandet — den namnger vem de räckte pengarna till. Rätta insamlaren och avsluta sedan avgiften.',
        },
        {
          term: 'En avgift har fastnat i väntan på en signatur',
          body: 'antingen väntar den verkligen på någon annan, eller så har din klan färre i staben än inställningen för krävda bekräftelser förutsätter. Sänk inställningen i stället för att bekräfta din egen insamling.',
        },
        {
          term: 'Potten ändrades efter att du berättat för folk',
          body: 'den följer godkända anmälningar, så att godkänna eller utesluta en anmälan flyttar den. Ange potten som den ser ut när anmälan stänger, inte när den öppnar.',
        },
      ],
    },
  },

  coffer: {
    metaTitle: 'Klankassan — Anvil-guide för kassörer',
    metaDescription:
      'Klanens gp-kassa i Anvil: att registrera donationer och ge äran åt dem som gav dem, de tre sätten ett pris betalas ut på, vem som får flytta pengarna, och vad som händer när kassan inte räcker.',
    eyebrow: 'Anvil · för kassörer',
    title: 'Klankassan',
    dek: 'De flesta klaner har sitt gp i någons bank och sin bokföring i någons minne. Kassan är en pott med en rad för varje rörelse — vem som gav den, vad den är lovad till, och vem som faktiskt skickade den.',
    facts: [
      { strong: '3 tal', rest: 'i kassan, lovat bort, fritt att lova' },
      { strong: '3 vägar ut', rest: 'veckotävlingar, uppdragsrutor, en tavlas pott' },
      { strong: 'Kassör', rest: 'eller admin — aldrig rang i sig' },
    ],
    footnote:
      'Allt här ligger under Admin → **Coffer**, utom prisstegarna, som ligger på det som betalas för. Den offentliga halvan är `/coffer`: saldot, de största givarna och de senaste rörelserna, för medlemmarna.',

    what: {
      title: 'Vad den är',
      body: [
        'En bokföring, inte en plånbok. Anvil håller aldrig ert gp — det ligger kvar där klanen redan förvarar det — så kassan är noteringen av vad som kom in, vad som lovats bort och vad som faktiskt lämnats över. Nyttan är att löftet och betalningen är två olika rader.',
        'Sidan inleds med tre tal, och de är tre för att de svarar på tre olika frågor:',
      ],
      rows: [
        {
          term: 'I kassan',
          body: 'godkända donationer och justeringar. Vad klanen har fått, minus vad den skrivit av.',
        },
        {
          term: 'Lovat bort',
          body: 'gp som ett pris gjort anspråk på — vunnet men inte skickat än, plus en pott avsatt för en tavla. Intecknat, även om det fortfarande står på någons bank.',
        },
        {
          term: 'Fritt att lova',
          body: 'i kassan minus lovat bort. Det enda tal ett nytt pris prövas mot, eftersom alternativet är att lova samma 50m till två vinnare medan kassören sover.',
        },
      ],
      note: {
        tag: 'En väntande donation räknas ingenstans',
        body: 'Att någon skriver "jag gav 100m" är ett påstående om det förflutna, inte gp på en bank. Den står utanför alla tre talen tills staben erkänner den, så den kan aldrig finansiera ett pris som sedan inte går att betala.',
      },
    },

    inbound: {
      title: 'Att få in gp',
      body: [
        'RuneLite-pluginet sköter den vanliga vägen automatiskt: öppna Clan Coffer i spelet så registrerar Anvil insättningar och uttag utifrån dess verkliga myntsaldo. Första titten är bara en utgångspunkt — den låtsas aldrig att den som öppnade kassan donerade allt som redan låg i den.',
        'Manuella registreringar finns kvar för allt som hände medan ingen hade pluginet öppet. En medlem rapporterar sin egen donation från `/coffer` och den väntar på att staben ska tro på den; en kassör registrerar en som redan kommit, och att hen skriver in den **är** godkännandet.',
        'Hur som helst krediteras den en **person**. Det betyder mer än det låter: listan över största givare på den offentliga sidan är det enda tack de flesta givare får, och gp som kommer in som "klanen" tackar ingen.',
      ],
      rows: [
        {
          term: 'Öppna kassan i spelet',
          body: 'med Anvil aktiverat och inloggat (Profile sync → **Sync Clan Coffer** är på som standard). Ett matchande spelmeddelande krediterar din egen insättning eller ditt eget uttag till dig; förändringar som syns efter ett uppehåll stäms av utan att den som såg dem namnges. Admin → Coffer visar det senaste fysiska beloppet och när det sågs.',
        },
        {
          term: 'En medlem rapporterar en',
          body: 'från den offentliga kassasidan, med en skärmbild om de har en. Den landar som väntande och dyker upp i din kö. Att godkänna den är det som gör den till riktiga pengar.',
        },
        {
          term: 'Du registrerar en',
          body: 'Admin → Coffer → **Record a donation**. Sök i medlemslistan efter vem som gav den, sätt ett belopp bredvid namnet, klart. Gäster kan också krediteras — någon som inte är fullvärdig medlem kan mycket väl ha betalat in.',
        },
        {
          term: 'Flera tillsammans',
          body: 'välj alla, skriv totalen och tryck **Split … ways**, och justera sedan en enskild andel för hand. Det skriver en rad var i stället för en rad med en lista, så var och en syns i givarlistan under sitt eget namn.',
        },
      ],
      note: {
        tag: 'En justering är något annat',
        body: '**Correct the pot** är för gp som rört sig utanför allt detta — att fylla på kassan, att lägga den på något Anvil aldrig såg, att rätta ett misstag. Den tillhör med avsikt ingen, och den är medvetet inte sättet att registrera en gåva.',
      },
    },

    out: {
      title: 'De tre sätten den betalar ut',
      intro: 'Varje pris i Anvil kommer ur samma pott, och varje väg avgör vinnarna på sitt sätt. Sätt stegen där det som vinns hör hemma — kassan frågar aldrig vem som vann något.',
      rows: [
        {
          term: 'En veckotävling, på sin egen sida',
          body: 'en Skill eller Boss of the Week bär en placeringsstege: första får det här, andra det där. Den görs upp **en gång** när tävlingen tar slut, utifrån slutställningen — inget byter ägare medan den pågår. Sätt den när du skapar tävlingen, eller senare från tävlingens egen sida.',
        },
        {
          term: 'En uppdragsruta, på tavlan',
          body: 'uppdrag betalar i den ordning folk blir klara, så deras stege görs anspråk på snarare än görs upp: första laget som klarar den tar förstaplatsens gp. Sätts i rutans rewards-avsnitt, på varje tavla som tillåter uppdrag.',
        },
        {
          term: 'En tavlas prispott',
          body: 'ett bingo fördelar själv sin pott över placeringar, så kassan räcker den bara ett tal. Event → **Prizes** → *From the clan coffer*. Det läggs till anmälningsavgifterna och det du lagt till för hand, och fördelningen över platser sätts på samma sida. Du väljer också om kassan **håller** de gp:na direkt eller bara noterar löftet — de har ju inte lämnat än, och en tavla om sex veckor behöver inte halva potten låst till dess.',
        },
      ],
      note: {
        tag: 'När folk hamnar lika',
        body: 'En veckostege kan **dela lika vid oavgjort**: alla som är lika slår ihop de platser de upptar och tar en lika del, så tre på 40 kc var tar en tredjedel av första, andra och tredje i stället för att den första av dem tar allt. Låt det vara av, och tavlans egen ordning avgör. Båda går att försvara — att bestämma efter att resultaten är inne gör det inte.',
      },
    },

    who: {
      title: 'Vem som får flytta den',
      intro: 'Pengar är sin egen behörighet, inte en rang. En moderator kan godkänna ett inskick och aldrig röra kassan, och det är avsiktligt snarare än förbisett.',
      rows: [
        {
          term: 'Kassör eller admin',
          body: 'hela bokföringen: registrera och godkänna donationer, justera kassan, sätta prisstegar, markera ett pris som skickat. Ägaren räknas som admin här.',
        },
        {
          term: 'En moderator',
          body: 'inget av det. De ser inte kassasidan alls — att samla in pengar är kassörens jobb, och rang i sig har aldrig gett rätten till det.',
        },
        {
          term: 'En tavelkassör',
          body: 'ett events pengar: dess avgifter, dess utbetalningar, dess prispott. Ges per tavla, vilket är så en gästande klan sköter sin egen halva av en klan-mot-klan utan att få er bokföring i knät. De kan inte röra klankassan.',
        },
        {
          term: 'Vilken medlem som helst',
          body: 'kan rapportera en donation och läsa den offentliga sidan. Det är hela listan.',
        },
      ],
      note: {
        tag: 'Berätta för klanen, i en kanal',
        body: 'Peka **Coffer ledger** mot en Discord-kanal under Admin → Discord → What goes where → **Staff only**, så postas varje rörelse med saldot den lämnar efter sig. Det är det enda flödet utan reservväg: lämna det tomt och ingenting om pengarna postas någonstans. Se [Anvil i Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'När potten inte räcker',
      body: [
        'Ett pris större än kassan avvisas inte. Det bokförs som **skyldigt och otäckt** — en riktig rad med en vinnares namn på — eftersom alternativet är en vinnare utan något och utan spår av att något någonsin lovades.',
        'Så lösningen är den vanliga: få in gp, betala sedan. Det du inte ska göra är att i tysthet ändra stegen efteråt; bokföringen säger redan vad som utlovades, och att de två säger emot varandra är värre än att sakna pengar.',
      ],
      note: {
        tag: 'Anvil skickar ingenting',
        body: 'Varje pris slutar med att en människa räcker över gp i spelet och bockar av en rad. Bokföringens uppgift är att se till att raden finns, att den säger vem och hur mycket, och att ingen en vecka senare behöver gräva fram det ur Discord-historiken.',
      },
    },
  },

  commands: {
    metaTitle: 'Snedstreckskommandon i Discord — Anvil',
    metaDescription:
      'Alla Anvils snedstreckskommandon — /bingo, /sotw, /botw, /eff, /coffer, /stats och /guide — med varje alternativ förklarat, exempel, vem som får använda vad, och lösningar när kommandon inte dyker upp.',
    eyebrow: 'Anvil · i Discord',
    title: 'Snedstreckskommandon',
    dek: 'Skriv `/` i klanens Discord så svarar Anvil från den levande sajten: brädet, ställningen, ditt eget kort, veckotävlingarna, kassan och vem som helsts stats. Den här sidan är hela listan, genererad från de kommandon boten faktiskt registrerar, så den är aldrig inaktuell.',
    facts: [
      { strong: 'Privat', rest: 'svar som bara du ser, med en Share-knapp' },
      { strong: 'Ditt språk', rest: 'det din Discord är inställd på' },
      { strong: 'Bara läsning', rest: 'utom /coffer add och remove' },
    ],
    footnote:
      'Att sätta upp boten från början står i [Discord-guiden](/guide/discord). Den här sidan handlar om att använda den.',

    using: {
      title: 'Så fungerar ett kommando',
      body: [
        'Skriv `/` i valfri kanal som boten kan se och välj ett Anvil-kommando i listan. Discord visar sedan dess alternativ som rutor att fylla i: tryck Tab eller klicka på ett för att lägga till det. Alternativ skrivna som `<angle brackets>` nedan är obligatoriska; de skrivna som `[square brackets]` är valfria och kan utelämnas.',
        'Varje svar är **privat**: bara du ser det, så att kolla brädet tio gånger om dagen stör ingen. Är det värt att visa kanalen, tryck **Share to channel** under svaret. Den delade kopian byggs i det ögonblicket, så en ställning som delas senare är ställningen som den ser ut då.',
      ],
      rows: [
        { term: 'Obligatoriskt', body: '`<amount>` — Discord skickar inte kommandot förrän det är ifyllt.' },
        { term: 'Valfritt', body: '`[member]` — utelämna det så svarar kommandot om dig, ditt lag eller hela klanen.' },
        { term: 'En lista', body: 'välj ett av värdena Discord erbjuder; du kan inte skriva ett eget.' },
        { term: 'Skriv för att söka', body: 'börja skriva och välj bland förslagen, till exempel bossnamn eller dina egna konton.' },
        { term: 'En medlem', body: 'välj någon från servern, precis som vid en @mention.' },
      ],
      note: {
        tag: 'Kommandona fungerar bara på klanens server',
        body: 'Varje svar handlar om en klan, och ett DM har ingen klan att svara om. Därför dyker kommandona inte upp i DM.',
      },
    },

    bingo: {
      title: 'Brädkommandon: /bingo',
      intro:
        '`/bingo` handlar om ett bräde. När flera bräden pågår listar **board** och **leaderboard** alla; resten svarar om brädet som pågår, sedan nästa som startar, sedan det som just tagit slut.',
    },

    clan: {
      title: 'Klankommandon',
      intro:
        'De här svarar om klanen snarare än ett bräde, så de fungerar oavsett om ett bingo pågår: veckotävlingarna, effektivitet, kassan, vem som helsts stats och installationsguiderna.',
    },

    options: {
      title: 'Alternativ du ser överallt',
      intro: 'Några alternativ betyder samma sak på varje kommando som har dem:',
      rows: [
        {
          term: '`member`',
          body: 'någon annan på servern. Utelämna det för att fråga om dig själv. Det hittar deras Anvil-konto via Discord-inloggningen de använde på sajten, så det fungerar bara för medlemmar som har loggat in på Anvil en gång.',
        },
        {
          term: '`account`',
          body: 'vilket av personens OSRS-konton, för folk med alts. Skriv för att välja; utelämna det för deras main.',
        },
        {
          term: '`page`',
          body: 'en boss eller aktivitet, sökbar genom att skriva: `Zulrah`, `Theatre of Blood`, `Tempoross`. Utelämna det för helhetsvyn.',
        },
        {
          term: '`language`',
          body: 'svara den här enda gången på ett annat språk. Som standard får du språket din Discord är inställd på, eller klanens valda botspråk.',
        },
        {
          term: '`amount`',
          body: 'gp på det smidiga sättet: `5m`, `2.5b`, `500k`, eller ett vanligt tal som `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Vem som får använda vad',
      body: [
        'Alla på servern kan köra alla kommandon som bara läser. Det du ser är det en medlem skulle se: ett bräde vars rutor inte avslöjats än förblir dolt i Discord också, även för staben.',
        'Kommandon som svarar om **dig** (`/bingo me`, `/stats` utan member) behöver veta vilket Anvil-konto som är ditt. De hittar det via Discord-inloggningen du använde på sajten, så logga in på Anvil med Discord en gång så fungerar de från och med då.',
      ],
      rows: [
        { term: 'Alla', body: 'alla kommandon utom `/coffer add` och `/coffer remove`.' },
        {
          term: 'Kassörer, admins, ägare',
          body: '`/coffer add` och `/coffer remove`. Kontrolleras mot din roll **på Anvil-sajten**, aldrig din Discord-roll, eftersom en rang på en chattserver aldrig har inneburit kontroll över klanens pengar.',
        },
      ],
    },

    trouble: {
      title: 'När ett kommando inte fungerar',
      intro: 'De vanliga orsakerna, ungefär i den ordning de inträffar:',
      rows: [
        {
          term: 'Inga Anvil-kommandon i listan',
          body: 'boten bjöds in utan sina kommandon — det är en separat behörighet, och äldre inbjudningslänkar bad bara om den ena. En admin kör **Invite / re-invite the bot** igen från Admin → Discord → **Connection**. Det sparkar inte ut boten och återställer ingenting. Nytillagda kommandon kan ta upp till en timme att dyka upp.',
        },
        {
          term: '"The application did not respond"',
          body: 'Anvil var kortvarigt onåbart, oftast mitt i en uppdatering. Kör det igen några sekunder senare.',
        },
        {
          term: '"Inte med på det här brädet" om dig själv',
          body: 'antingen har du inte anmält dig till det här brädet, eller så kan Anvil inte matcha din Discord mot ditt konto. Logga in på sajten med det här Discord-kontot och kolla din profil.',
        },
        {
          term: 'En medlems stats kommer tillbaka tomma',
          body: 'de har inte loggat in på Anvil med Discord än, eller så har deras kontos hiscores inte lästs in än. Försök igen med alternativet `account`, eller be dem logga in en gång.',
        },
        {
          term: '`/coffer add` säger att du inte får',
          body: 'din roll på Anvil-sajten är inte kassör, admin eller ägare, eller så är den här Discorden inte kontot du loggar in på sajten med.',
        },
      ],
    },

    labels: {
      options: 'Alternativ',
      noOptions: 'Inga alternativ — kör det bara.',
      example: 'Exempel',
      examples: 'Exempel',
      required: 'obligatoriskt',
      optional: 'valfritt',
      choices: 'Val',
      range: 'från {min} till {max}',
      kinds: {
        text: 'text',
        number: 'tal',
        member: 'en medlem',
        choice: 'välj från en lista',
        search: 'skriv för att söka',
        yesno: 'ja eller nej',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'Brädet som pågår just nu. Tills brädet avslöjas förblir rutnamnen dolda här också.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Lagens ställning, med poäng eller rutor beroende på hur brädet räknas.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Hur det här brädet räknas (läst direkt från eventet självt, så det stämmer alltid), sedan klanens egna husregler.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Hur du kommer med: anmälan, avgiften, och var din egen anmälan står.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Vad som kommer härnäst: en rutavslöjning, ett uppdrag eller en deadline.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Ditt lag, din placering och rutorna som krediterats dig.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'En kort lista över vad boten svarar på, inne i Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'Ett lags kort: poäng, laguppställning och senaste rutor. Utelämna namnet för ditt eget lag.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Varje aktiv Skill of the Week, toppen av var och en, och var du ligger.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Varje aktiv Boss of the Week och dess aktuella ställning.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'Klanens effektivitetstopplista och din placering på den. spelade timmar som standard; välj bosstimmar för bossing.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Kassans saldo, de största givarna och de senaste rörelserna.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Endast kassörer, admins och ägare. Registrerar gp som kommer in; det postas också i kassans flödeskanal.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Endast kassörer, admins och ägare. Vägrar ta kassan under noll; registrera det på kassasidan om du menar allvar.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Ett konto i en överblick: combat- och totalnivå, spelade timmar och bosstimmar, antal i collection log och personbästan.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Varje skills nivå och XP.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Spelade timmar och bosstimmar, och vilka skills och bossar de kommer från.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Framsteg i collection log totalt, eller sidan för en enskild boss.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Personbästan. Raids sparar en tid per mode och lagstorlek, så använd `mode` och `size` för att hitta rätt run.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Hur tursamt kontot har varit över de drops Anvil håller koll på.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Klanens största collection logs.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Klanens mest otursamma och mest tursamma medlemmar.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'En installationsguide inne i Discord: listan över steg, eller ett steg med en länk direkt till det på sajten.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'En av klanens spelguider (raids, bossing, money making…): börja skriv namnet och välj den i listan.',
      },
    },
  },
  moderator: {
    metaTitle: 'På passet — Anvils moderatorguide',
    metaDescription:
      'En moderators dag på en Anvil-klansajt: kön, granskning av inskickade bevis och konton, att hålla medlemslistan ärlig, och bedömningarna.',
    eyebrow: 'Anvil · för moderatorer',
    title: 'På passet',
    dek: 'En moderator tar det arbete som kommer oavsett om ett event pågår eller inte: bevis att titta på, konton att verifiera, en medlemslista som driver. Det här är vad kön består av, och hur du tömmer den utan att själv bli skälet till att folk väntar.',
    facts: [
      { strong: 'Inga event', rest: 'en moderator kan varken skapa eller redigera dem' },
      { strong: 'En sida', rest: 'säger vad som väntar på dig' },
      { strong: 'Godkänn snabbt', rest: 'en långsam kö känns som en trasig sajt' },
    ],
    footnote:
      'En moderator ser allt en medlem ser plus granskningsytorna. Att skapa och redigera event, inställningar, stab och utbetalningar är admin- och kassörsjobb — saknas en knapp är det därför, och det är avsiktligt.',

    what: {
      title: 'Vad rollen är',
      intro:
        'Rollerna staplas nedåt: allt en moderator kan, kan en kassör och en admin också. Det en moderator specifikt äger:',
      canList: [
        'medlemslistan: att lägga till och ta bort folk, och svara på ansökningar om att gå med ([Dina medlemmar]({peopleGuide}))',
        'kontoverifieringar — XP-utmaningen och manuell granskning',
        'inskickade bevis och skärmbilder',
        'veckotävlingar och schemat',
        'klanens kalenderhändelser',
      ],
      cantIntro: 'Vad de inte kan, med flit:',
      cantList: [
        'skapa eller redigera ett event, eller dess rutor',
        'ändra klaninställningar eller Discord-kopplingar',
        'befordra någon, eller röra staben',
        'avsluta en avgift eller köra en utbetalning',
      ],
    },

    queue: {
      title: 'Börja med det som väntar på dig',
      body: [
        'Admin-instrumentpanelen är ingen sammanfattning av sajten — den är en lista över vad som väntar, sorterad efter hur mycket det spelar roll, uträknad från riktiga data snarare än från räknare som driver. Säger den att inget väntar på dig, så gör det inte det.',
        'Arbeta uppifrån och ner. Posterna som når toppen är de med en människa i andra änden: någon som inte kan anmäla sig för att kontot inte är verifierat, eller vars drop inte räknats för att ingen tittat på den än.',
      ],
    },

    submissions: {
      title: 'Inskickat och bevis',
      body: [
        'De flesta krediteringar når dig aldrig: pluginet ser dropen, arkiverar en skärmbild stämplad med lag och en UTC-tidsstämpel, och rutan blir klar. Det som hamnar i kön är de manuella rutorna och allt pluginet flaggat.',
        'Stämpeln är det som gör ett bevis svårt att bråka om. En pluginskärmbild bär laget och ögonblicket inbakat i bilden, och med tvåbildsbevis påslaget visar en andra bild ett par sekunder senare att lootet lagt sig på marken. En skärmbild utan något av det är en skärmbild från en telefon, vilket är helt okej — det betyder bara att det är du som kontrollerar.',
      ],
      rows: [
        {
          term: 'Godkänn när det är rimligt',
          body: 'du reviderar ingen bank. Visar bilden saken, står kontot på medlemslistan och ligger tidsstämpeln inom eventet, godkänn och gå vidare.',
        },
        {
          term: 'Avslå med en anledning',
          body: 'ett avslag utan förklaring kommer tillbaka som ett DM till dig inom en timme. Säg vad som saknades så att andra försöket blir rätt.',
        },
        {
          term: 'En flaggad inskickning är en fråga, inte en anklagelse',
          body: 'pluginet flaggar det det inte kunde bekräfta helt — oftast en spelare som inte lämnat in någon startbild. Läs det som “titta på den här”, inte som “någon har fuskat”.',
        },
      ],
    },

    verify: {
      title: 'Att verifiera konton',
      intro:
        'Ingen kan anmäla sig till ett event utan minst ett verifierat konto, så den här kön hindrar folk direkt från att spela. Det är den värd att tömma dagligen.',
      rows: [
        {
          term: 'Verifierat via pluginet',
          body: 'efter den första ägarskapskontrollen känner pluginet igen kontot automatiskt, och ett stabilt fingeravtryck bevarar kopplingen vid namnbyten. Ett listkonto utan känt fingeravtryck använder XP-kontroll eller moderatorgodkännande en gång.',
        },
        {
          term: 'Verify by XP',
          body: 'för spelare utan pluginet. Sajten väljer en slumpmässig färdighet och de ska tjäna 1 000 XP i den inom trettio minuter. Den kontrollerar sig själv — du ser bara dem som misslyckas.',
        },
        {
          term: 'Manuell granskning',
          body: 'dolda Hiscores, eller ett altkonto som är för nytt för att synas där. Någon skickar in ett RSN med en kommentar och du avgör. Be om en skärmbild av inloggningsskärmen om kommentaren inte räcker.',
        },
      ],
      note: {
        tag: 'Verifierad är inte detsamma som medlem',
        body: 'Att verifiera ett konto säger “det här är verkligen deras”. Det gör dem inte till en del av klanen. Medlemskap kommer bara från en synkning av medlemslistan i spelet eller från staben som lägger till dem för hand, och en gästplats bara från en ansökan om att gå med som staben godkänner (eller direkt, om klanen släpper in alla). Det är avsiktligt, och det är det som hindrar någon från att gå med i din klan genom att skriva ett namn.',
      },
    },

    roster: {
      title: 'Att hålla medlemslistan ärlig',
      body: [
        'Medlemslistan kommer från ett enda ställe: en admin kör en synkning från klanlistan i spelet, med **Anvil**-knappen i titelraden på klanfönstret (eller **Sync roster** i pluginets sidopanel). Allt annat — verifieringar, kopplingar, anmälningar — hänger på den.',
        'Underhållsjobbet är alltså litet men verkligt: be en admin köra synkningen efter varje rekryteringsomgång (den gör gäster som gått med i spelet till medlemmar), svara på ansökningarna om att gå med överst på fliken **Roster**, och beta av **Needs review** i stället för att vänta på att folk klagar. Se [Dina medlemmar]({peopleGuide}).',
      ],
      note: {
        tag: 'Senast sedd är inte senast spelad',
        body: 'En medlems tidsstämpel för “senast sedd i klanen” visar den senaste synkningen som hittade dem, inte senaste gången de loggade in. För “spelar de fortfarande”, läs tiden för deras livestatistik i stället — det är den som rör sig av sig själv.',
      },
    },

    startshot: {
      title: 'Att granska startbilder',
      body: [
        'På ett event som kräver en måste varje spelare lämna in en skärmbild tagen efter att eventet gått igång, på en plats som lottas i startögonblicket. Pluginbilder med verifierat lösenord kommer in redan godkända, så i praktiken tittar du bara på spelarna som laddat upp för hand från en telefon.',
        'Det du kontrollerar är litet: att karaktären är med i bilden, att lösenordet står i chattrutan, och att det är det lösenord just den spelaren faktiskt fick. Uppladdningarna räknas direkt och du granskar dem i efterhand, så ingen hindras från att spela medan de väntar på dig.',
      ],
    },

    judgement: {
      title: 'Bedömningarna du kommer att behöva göra',
      intro:
        'Ingen av dem har ett rätt svar i programvara, och det är därför de landar hos en människa.',
      rows: [
        {
          term: 'Beviset är äkta men sent',
          body: 'dropen skedde inom eventet och skärmbilden kom efter att det tog slut. Godkänn oftast — titta på stämpeln i bilden, inte på uppladdningstiden.',
        },
        {
          term: 'Kontot är inte kopplat än',
          body: 'dropen är äkta, kontot är deras, det lades bara inte till innan de spelade. Få det kopplat, godkänn sedan. Låt inte någon göra om ett raid på grund av pappersarbete.',
        },
        {
          term: 'Det ser iscensatt ut',
          body: 'ta det till en admin i stället för att avslå det själv. Ett avslag är en offentlig anklagelse inne i en liten klan, och det bör aldrig vara en persons beslut fattat i farten.',
        },
        {
          term: 'Du är själv med i eventet',
          body: 'det är du nästan säkert. Lämna över allt som rör ditt eget lag till en annan moderator — inte för att du skulle vara orättvis, utan för att du inte ska behöva bevisa att du inte var det.',
        },
      ],
    },
  },

  tiles: {
    metaTitle: 'Rutregler och begränsningar — Anvil',
    metaDescription:
      'Vad varje sorts bingoruta kräver av dig (spelinställningar, RuneLite-pluginet, en synkad collection log, en hiscores-placering) och gränserna för vad den kan spåra.',
    eyebrow: 'Anvil · för spelare',
    title: 'Rutregler och begränsningar',
    dek: 'Varje ruta visar vad den kräver av dig och vad den inte klarar. Den här sidan förklarar varje rad; rutans **Why?**-länkar leder hit.',
    needs: 'Kräver',
    limit: 'Bra att veta',
    checked: 'Rutan kollar det åt dig',
    englishOnly: 'Reglerna nedan är på engelska tills vidare, så att de alltid stämmer med vad sajten faktiskt gör.',
  },

  // /guide/creators — värdens guide för ett creator-utrymme.
  creators: {
    metaTitle: 'Håll ett OSRS-bingo för dina tittare — Anvil',
    metaDescription:
      'Kör ett Old School RuneScape-bingo eller ruttkapplöpning för din stream, utan klan: skapa ett utrymme, dela en länk, välj vem som får gå med (Twitch, Kick, YouTube eller Discord) och visa brädet på streamen med OBS.',
    eyebrow: 'För streamers och creators',
    title: 'Håll event för dina tittare',
    dek: 'Ett creator-utrymme låter dig köra ett bingo för din stream. Du behöver ingen klan i spelet. Du skapar ett event, delar en länk, och dina tittare går med.',
    facts: [
      { strong: 'Ingen klan', rest: 'behövs' },
      { strong: 'Gratis', rest: 'att börja' },
      { strong: 'En länk', rest: 'till din chatt' },
    ],

    what: {
      title: 'Vad ett creator-utrymme är',
      body: [
        'Det är din egen sida på Anvil, på `{apex}/c/ditt-namn`. Där kör du event för dina tittare.',
        'Det är ingen klan. Det finns ingen klanlista, inga ranker och inga veckotävlingar. Den som går med i ditt event spelar det eventet. Inget mer.',
        'Tittarna loggar in med Discord, lägger till sin RuneScape-karaktär och trycker på **Join**. Anvils RuneLite-plugin räknar sedan deras drops av sig självt.',
      ],
    },

    create: {
      title: 'Skapa ditt utrymme',
      body: [
        'Gå till [{apex}/host](/host) och logga in med Discord.',
        'Skriv ett namn på ditt utrymme. Namnet på din kanal är ett bra val. Länken görs av namnet. Tryck på **change link** om du vill ha en annan.',
        'Tryck på **Create my space**. Du får ett utrymme per Discord-konto.',
      ],
    },

    first: {
      title: 'Skapa ditt första event',
      body: [
        'Direkt efter att du skapat utrymmet hamnar du på **Create your first event**. Senare använder du **+ New event** högst upp under **Your events**.',
        '**Name.** Det som dina tittare ser.',
        '**What kind?** Välj ett kort. **Team bingo** är ett rutnät på 5×5 och Anvil delar in spelarna i lag åt dig. **Solo bingo** är samma rutnät, var och en för sig. **Team race** är uppgifter i ordning: laget som kommit längst vinner.',
        '**Ready-made tiles** ger dig en blandning av lätta till svåra uppgifter som du kan ändra senare. **Blank, I’ll write my own** börjar tomt.',
        '**Who can join?** Låt den stå på **Anyone**, eller välj vem som får gå med. Se steg 5.',
        '**When?** Välj start- och slutdatum. Eller lämna tomt och starta eventet själv när du är redo.',
        'Tryck på **Create event**. Tryck sedan på **Copy invite link**.',
      ],
    },

    share: {
      title: 'Dela länken',
      body: [
        'Klistra in inbjudningslänken i din streamchatt, din Discord eller dina sociala medier. Den länken är allt dina tittare behöver.',
        'Du kan kopiera den igen när som helst: **Your events** → **Copy invite link** bredvid eventet.',
        'Vill du att boten svarar på `!join` i chatten med länken? Se steg 9.',
      ],
    },

    who: {
      title: 'Välj vem som får gå med',
      body: [
        'Varje event börjar öppet för **Anyone**. För att behålla det för din community öppnar du eventets **Settings** → **Viewers** → **Who can join?** och väljer ett eller flera alternativ. Samma alternativ finns på skärmen för första eventet.',
        'Väljer du fler än ett räcker **vilket som helst av dem**. En följare ELLER en serverbooster kommer in.',
      ],
      intro: 'Varje alternativ, och vad en tittare behöver göra:',
      rows: [
        {
          term: 'Anyone',
          body: 'Alla med länken går med direkt.',
        },
        {
          term: 'Twitch followers',
          body: 'Tittaren trycker på **Link Twitch** på eventsidan och loggar in med Twitch. Anvil kollar att de följer dig.',
        },
        {
          term: 'Twitch subs',
          body: 'Som följare, men de måste vara prenumeranter. Välj lägsta nivå: **Tier 1 or higher**, **Tier 2 or higher** eller **Tier 3**. Prime-subs räknas som tier 1. Din kanal måste vara Twitch-affiliate eller partner.',
        },
        {
          term: 'Kick followers',
          body: 'Kick berättar inte för appar vem som följer dig, så Anvil räknar de som följer _efter_ att du kopplat Kick. Följde de innan? Tittaren slutar följa och följer igen. Är din Kick-chatt bara för följare? Slå på **My Kick chat is followers-only** i avsnittet **Kick channel**. Då räknas en tittare som skriver sin Anvil-kod i din chatt som följare.',
        },
        {
          term: 'Kick subs',
          body: 'Subs som Anvil sett efter att du kopplat Kick räknas av sig självt. Alla andra trycker på **Get Kick code** och skriver koden (den ser ut som `ANVIL-7F3K9Q`) i din Kick-chatt, så ser Anvil deras sub-märke. Kick har inga sub-nivåer.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Tittaren trycker på **Check my YouTube subscription** och loggar in med Google. Deras prenumerationer måste vara offentliga på YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'Tittaren skriver sin Anvil-kod i din YouTube-livechatt. Medlemmar kan alltså bara gå med **medan du sänder live**.',
        },
        {
          term: 'Discord role',
          body: 'Personer med en roll du väljer på din Discord-server (upp till 5 roller). Koppla först din server: **Discord (optional)** i menyn.',
        },
        {
          term: 'Server boosters',
          body: 'Personer som boostar din Discord-server. Kräver också att din server är kopplad.',
        },
      ],
      note: {
        tag: 'Bra att veta',
        body: 'Koppla först din kanal (steg 7), annars förblir valen för Twitch, Kick och YouTube gråa. Ett Twitch-, Kick- eller YouTube-konto kan bara få in en spelare i varje event. Din personal, och personer du bjuder in vid namn, hoppar över kontrollerna.',
      },
    },

    approve: {
      title: 'Säg ja till varje spelare (valfritt)',
      body: [
        'Vill du välja vem som spelar? Öppna eventets **Settings** → **Viewers** → **Who can enter** och välj **Ask me about everyone**. Tryck på **Save changes**.',
        'Nu trycker tittarna på **Ask to join** i stället för **Join**. De måste fortfarande klara dina val under **Who can join?** först.',
        'Deras förfrågningar syns under **Your events** som **N waiting for you**. Klicka på den, eller öppna eventets flik **Sign-ups**. Listan högst upp heter **Waiting for your yes**. Godkänn eller avslå varje förfrågan.',
      ],
    },

    channels: {
      title: 'Koppla din Twitch, Kick eller YouTube',
      body: [
        'Öppna **Settings** i menyn. I avsnittet **Twitch channel**, **YouTube channel** eller **Kick channel** trycker du på **Connect Twitch**, **Connect YouTube** eller **Connect Kick** och loggar in som din kanal.',
        'Varje kanal du kopplar visas på din sida som en **verified**-länk. Du kan inte skriva in en länk för hand: inloggningen är hur Anvil vet att kanalen är din.',
        'En kanal kan kopplas till ett ställe på Anvil. Är den redan på ett annat utrymme eller en annan klan du driver frågar Anvil om du vill flytta den.',
      ],
    },

    overlay: {
      title: 'Visa brädet på streamen (OBS)',
      body: [
        'Under **Your events** trycker du på **Stream overlay** bredvid eventet, sedan på **Make overlay links**.',
        'Du får tre länkar. **Standings**: topplagen och hur långt de kommit. **Feed**: de senaste drops och klara rutor. **Board**: brädet, med klara rutor markerade.',
        'Välj en **Text size** (S, M, L eller XL) innan du kopierar. Tryck sedan på **Copy** bredvid den du vill ha.',
      ],
      stepsTitle: 'Lägg till den i OBS',
      steps: [
        'I OBS, under **Sources**, trycker du på **+** och väljer **Browser**.',
        'Klistra in länken i **URL**.',
        'Ställ in en storlek, till exempel 800 × 600. Lämna **Custom CSS** tomt.',
        'Tryck på **OK**. Den uppdateras av sig självt med några sekunders mellanrum.',
      ],
      tipsTag: 'Bra att veta',
      tips: [
        'Lägg till `&limit=10`, `&title=0` eller `&align=right` sist i en länk för att ändra den.',
        'Overlayen visar det som din publika eventsida visar. Dolda ställningar och dolda rutor förblir dolda på streamen också.',
        '**Reset link** skapar nya länkar och stoppar de gamla. Använd den om en länk läcker. Du måste klistra in de nya länkarna i OBS igen.',
        'Ett litet “Anvil”-märke sitter i hörnet. På Gold-planen kan du dölja det under **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join i din chatt',
      body: [
        'Öppna **Settings** → **!join in Twitch chat** och slå på det.',
        'När en tittare skriver `!join` svarar Anvil-boten (Anvil_OSRS) med länken till ditt öppna event. Den svarar högst en gång var 30:e sekund, hur många som än skriver det.',
        'Den svarar bara i en kanal du kopplade i steg 7. För Kick slår du på **!join in Kick chat** i avsnittet **Kick channel**.',
        'Inget event öppet? Då säger den det: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Om din chatt blockerar länkar (Twitchs **Block hyperlinks** eller AutoMod) hålls botens svar kvar. Skriv `/vip anvil_osrs` eller `/mod anvil_osrs` i chatten en gång så kommer länken igenom.',
        'Jobbar du med ett event? **Space settings** i eventets meny tar dig tillbaka till de här reglagen. Det gör även **Switch it on in your settings** under **Who can join?**.',
      ],
    },

    page: {
      title: 'Gör sidan till din egen',
      body: [
        'Din sida är det folk ser på `{apex}/c/your-name`, tillsammans med dina event. Öppna **Settings** → **Your page**. Varje del har sin egen spara-knapp.',
      ],
      items: [
        '**Bio.** Några rader om dig och dina streams. Länkar som börjar med `https://` går att klicka på.',
        '**Logo and banner.** Tryck på **Upload a logo** eller **Upload a banner**. Bannern går tvärs över toppen av din sida, så gör den bred (3:1, till exempel 1500 × 500). PNG, JPEG, GIF eller WebP. Båda får vara animerade.',
        '**Panels.** Upp till 8 kort under dina event, som panelerna under en Twitch-kanal. Tryck på **+ Add a panel** och ge den en titel och lite text. En bild och en länk är valfria. Använd pilarna för att ändra ordningen.',
        '**Schedule.** När du brukar gå live, i din egen tidszon. Besökare ser varje tid på sin egen klocka.',
        '**Featured.** Ett klipp, fäst högst upp på din sida. Välj en av dina stream-höjdpunkter (nästa steg), eller klistra in en klipplänk från Twitch, YouTube, Kick eller Medal.',
        'Tryck på **Preview your page** för att se sidan som besökare ser den.',
      ],
      note: {
        tag: 'Jagex regler',
        body: 'Allt på din sida måste följa Jagex regler: ingen försäljning av guld eller konton, inget gambling, inga bottar och inga privata servrar. Anvil kontrollerar dina ord och länkar när du sparar. Om Anvils personal döljer din sida efter en anmälan står det i dina inställningar. Fråga på Anvils Discord om du tror att det är ett misstag.',
      },
    },

    highlights: {
      title: 'Stream-höjdpunkter',
      body: [
        'När din Twitch- eller YouTube-kanal är kopplad fångar Anvil de stora ögonblicken i dina event medan du är live. Reglagen finns i **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** är på så fort du kopplar. Medan du är live på Twitch gör Anvil ett klipp när ett av dina event startar, när ett lag klarar hela brädet eller vinner, och när din egen karaktär får en sällsynt drop eller en pet. På YouTube sparar Anvil i stället en länk till just den sekunden i din stream. Kick har inga höjdpunkter än.',
        'Klippen visas under **Highlights** på eventsidan och på din sida. Du kan fästa ett som ditt **Featured**-klipp (steg 10).',
        '**Let Anvil feature clips from my events in its own promotion** är av tills du slår på det. Då får Anvil dela ett klipp på sina egna sidor och sociala medier, och nämner alltid dig.',
        'Dina spelare kan också klippa sina egna stora ögonblick. De slår på **Clip my stream when I hit a big moment** under sitt Twitch-konto i **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Bli listad på Anvil',
      body: [
        'Ditt utrymme är olistat när du skapar det. Bara de som har din länk kan hitta det.',
        'Öppna **Settings** → **Advertise on Anvil** och slå på det. Ditt utrymme syns i Anvils klankatalog, och dina nya event syns på `{apex}/events`.',
        'För att lista bara ett event öppnar du dess **Settings** → **Viewers** → **List on Anvil**. Det syns medan eventet är kommande eller pågår.',
        'Ett event utan datum visas under **Open to join**, märkt “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Planer och gränser',
      body: [
        'Din plan avgör hur många spelare som kan vara med i dina event samtidigt. Event vars datum överlappar delar på det talet; event på olika datum får det var för sig. En spelare i två överlappande event räknas två gånger. Allt annat är lika på alla planer: brädet, plugin-spårningen, overlayen och Discord.',
        'Ditt plankort finns under **Your events**. För att jämföra planer, se [priser](/pricing#creators). För att ändra eller säga upp det du betalar, gå till [din faktureringssida](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Upp till 50 spelare samtidigt i alla dina event. Ett event i taget. Kontroller av Discord-roll och booster.' },
        { term: 'Bronze', body: 'Upp till 150 spelare samtidigt i alla dina event. Kontroller för Twitch, Kick och YouTube.' },
        { term: 'Silver', body: 'Upp till 300 spelare samtidigt i alla dina event. Mer än ett event i taget. `!join` i chatten. Visas först i listan.' },
        { term: 'Gold', body: 'Upp till 1 000 spelare samtidigt i alla dina event. Dölj Anvil-märket på din overlay.' },
        { term: 'Partner', body: 'Ingen spelargräns. Ordnas direkt med Anvil — hör av dig.' },
      ],
      note: {
        tag: 'Just nu',
        body: 'Alla kommer fortfarande in medan Anvil växer, även över din plans siffror. Gränserna börjar gälla senare, med förvarning. Ditt plankort visar hur nära du är.',
      },
    },

    faq: {
      title: 'Frågor',
      intro: 'De som streamers frågar mest:',
      rows: [
        {
          term: 'Behöver mina tittare en klan?',
          body: 'Nej. De behöver ett Discord-konto och en OSRS-karaktär. Skicka dem [tittarguiden]({joiningGuide}).',
        },
        {
          term: 'Behöver de RuneLite-pluginet?',
          body: 'För drops och kills, ja. Pluginet skickar in dem av sig självt. Några rutor läser hiscores i stället.',
        },
        {
          term: 'En tittare säger “The host’s Twitch connection isn’t working”.',
          body: 'Twitch slutade godta din koppling. Öppna **Settings** och tryck på **Reconnect Twitch**. Samma gäller Kick och YouTube.',
        },
        {
          term: 'Kan någon annan hjälpa mig att köra det?',
          body: 'Ja. Öppna **Players** → **Staff & roles**, lägg till dem och välj vad var och en får göra.',
        },
        {
          term: 'Jag driver också en klan i spelet.',
          body: 'Då behöver du kanske inget utrymme. En publik klan kan slå på **Streaming** i stället. Se [streaming för klaner]({streamingGuide}).',
        },
        {
          term: 'Kan jag skapa ett andra utrymme?',
          body: 'Ett utrymme per Discord-konto tills vidare. Hör av dig om du behöver ett till.',
        },
        {
          term: 'Var hittar jag mitt utrymmes inställningar?',
          body: 'Tryck på **Settings** i menyn. Inifrån ett event trycker du på **Space settings** i eventets meny.',
        },
        {
          term: 'Vad gör knappen **Report** på min sida?',
          body: 'Alla som är inloggade kan anmäla din sida, en panel, ett event eller en höjdpunkt till Anvils personal. Anmälningar går bara till personalen. Om personalen döljer din bio, dina paneler, ditt schema eller ditt utvalda klipp står det i dina inställningar.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — för en tittare som klickat på en streamers länk.
  joiningStream: {
    metaTitle: 'Gå med i en streamers OSRS-bingo — Anvil',
    metaDescription:
      'Fått en länk från en streamer? Logga in med Discord, lägg till din OSRS-karaktär, tryck på Join. Vad du gör för event för följare eller subs på Twitch, Kick eller YouTube, och hur dina drops räknas.',
    eyebrow: 'För tittare',
    title: 'Gå med i en streamers event',
    dek: 'En streamer delade en länk. Så här kommer du med på brädet. Du behöver ingen klan.',
    facts: [
      { strong: '~2 min', rest: 'att gå med' },
      { strong: 'Ingen klan', rest: 'behövs' },
    ],

    join: {
      title: 'Gå med i fyra steg',
      body: [
        '**Öppna länken** som streamern delade. Eller skriv `!join` i deras chatt så postar boten den.',
        '**Logga in med Discord.** Det är ditt Anvil-konto. Inget att fylla i.',
        '**Lägg till din karaktär.** Tryck på **Add my character** och skriv ditt RuneScape-namn. Om det står **Prove it’s mine**, följ stegen på din profil. [Plugin-guiden]({pluginGuide}) visar hur.',
        '**Tryck på Join.** Välj din karaktär om du har fler än en. Du ser **You’re in!** när det gick bra.',
      ],
    },

    gated: {
      title: 'Event för följare eller subs',
      body: [
        'Vissa event är bara för streamerns community. Join-kortet säger vilka, till exempel “Open to followers of somename on Twitch”.',
        'Tryck på **Join** ändå. Om du inte släpps in än listar kortet vad du ska göra. Gör något av det och tryck sedan på **Join** igen.',
      ],
      intro: 'Vad du gör för varje sort:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Tryck på **Link Twitch** och logga in med Twitch. Anvil ber inte om några behörigheter. Tryck sedan på **Join** igen.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Tryck på **Get Kick code**. Skriv koden (som `ANVIL-7F3K9Q`) i streamerns Kick-chatt inom 10 minuter. Varje kod fungerar en gång. Tryck sedan på **Join** igen.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Tryck på **Check my YouTube subscription** och logga in med Google. Välj kontot du tittar med. Dina prenumerationer måste vara offentliga i YouTubes sekretessinställningar.',
        },
        {
          term: 'YouTube member',
          body: 'Tryck på **Link my YouTube account**, skriv sedan din kod i YouTube-livechatten och tryck på **check the chat**. Det fungerar bara medan streamern sänder live.',
        },
        {
          term: 'Discord role or booster',
          body: 'Gå med i streamerns Discord-server och få rollen (eller boosta den). Anvil kollar med det Discord-konto du loggade in med.',
        },
      ],
      note: {
        tag: 'Godkännande',
        body: 'Vissa streamers säger ja till varje spelare. Då står det **Ask to join** på knappen, och du ser **Waiting for the host** tills de svarat.',
      },
    },

    plugin: {
      title: 'Installera Anvil-pluginet',
      body: [
        'Dina drops och kills räknas via Anvil-pluginet för RuneLite. Installera det från Plugin Hub och logga in med Discord från dess sidopanel.',
        '[Plugin-guiden]({pluginGuide}) går igenom det på ungefär tre minuter.',
      ],
    },

    play: {
      title: 'Spela',
      body: [
        'Det var allt. Spela som vanligt. När du får en drop eller en kill som brädet behöver skickar pluginet in den av sig självt.',
        'Öppna eventlänken när som helst för att se brädet och ställningen. Du spelar bara det här eventet: du går inte med i en klan.',
      ],
    },

    accounts: {
      title: 'Dina kopplade konton',
      body: [
        'Twitch-, YouTube- och Kick-kontona du kopplat finns i [Settings → Connected accounts](/settings/connections). Du kan koppla dem där innan du går med också.',
        'Koppla bort ett när som helst. Event du redan gått med i behåller dig. Ett begränsat event du går med i senare ber dig koppla igen.',
        'Kopplade Twitch-, YouTube- och Kick-konton visas på din profil med en bock: du har visat att de är dina. Stäng av **Show on my profile** för att dölja ett. En Medal-länk är annorlunda. Den klistrar du in själv, så den får ingen bock.',
        'Streamar du själv på Twitch? Slå på **Clip my stream when I hit a big moment** under ditt Twitch-konto. Medan du är live i en streamers event klipper Anvil dina sällsynta drops, pets och klarade rutor.',
      ],
    },

    faq: {
      title: 'Frågor',
      intro: 'När något säger nej:',
      rows: [
        {
          term: '“This event is full”',
          body: 'Det finns inte plats för fler spelare. Bara streamern kan skapa plats — säg till dem.',
        },
        {
          term: 'Jag är sub men får inte komma in.',
          body: 'Kolla att du kopplat samma konto som du prenumererar med. På Twitch, titta på **Your Twitch** på join-kortet. På Kick, skriv en ny kod i deras chatt: Anvil läser sub-märket på det meddelandet. På YouTube, gör dina prenumerationer offentliga och kolla igen.',
        },
        {
          term: 'Jag följde på Kick men det står att jag inte gjorde det.',
          body: 'Anvil ser bara följningar som gjorts efter att streamern kopplade Kick. Sluta följa och följ igen, tryck sedan på **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Ett Twitch-konto (eller Kick, eller YouTube) får in en spelare. Någon annan har redan gått med med det.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube eller Discord hade ett hack. Vänta en minut och tryck på **Join** igen.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'Det här ligger hos streamern. Säg åt dem att koppla om sin kanal på Anvil.',
        },
        {
          term: 'Mina drops syns inte.',
          body: 'Kolla att pluginet är installerat och inloggat, och att du gick med med karaktären du spelar. Se [plugin-guiden]({pluginGuide}).',
        },
        {
          term: 'Var hittar jag fler event som det här?',
          body: '[Eventsidan](/events) listar event som alla kan gå med i, även streamers event som är öppna just nu.',
        },
        {
          term: 'Något på en streamers sida bryter mot reglerna.',
          body: 'Tryck på **Report** på sidan, eventet eller höjdpunkten. Välj vad som är fel och tryck på **Send**. Det går bara till Anvils personal. Streamern får aldrig veta vem som anmälde.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — en publik klan som slår på Streaming.
  streamingClans: {
    metaTitle: 'Streama din klans event — Anvil',
    metaDescription:
      'Låt tittarna på din stream gå med i ett av din klans OSRS-event utan att gå med i klanen: slå på Streaming, öppna ett event för tittare och välj vilka tittare som kommer in.',
    eyebrow: 'För klaner som streamar',
    title: 'Streaming för klaner',
    dek: 'Streamar din klan sina event? Låt tittare spela ett event utan att gå med i din klan.',

    on: {
      title: 'Slå på Streaming',
      body: [
        'Gå till Admin → **Clan settings** → **Profile** och slå på **Streaming**.',
        'Bara en publik klan kan streama. Tittarna måste kunna öppna din eventsida, och en privat klan döljer den för dem. En klan med Streaming på kan inte bli privat förrän du slår av det.',
        'När det är på kopplar du din Twitch-, YouTube- eller Kick-kanal precis under.',
      ],
    },

    event: {
      title: 'Öppna ett event för tittare',
      body: [
        'Varje event förblir **Members only** tills du säger något annat. Så fungerade det tidigare.',
        'Öppna eventets **Settings** → **Entry & co-hosts** → **Who can join?** och välj **Members and viewers**. Välj sedan **Which viewers?**: vem som helst, eller följare, subs, en Discord-roll och så vidare. Tryck på **Save**.',
        'De här kontrollerna gäller bara tittare. Dina klanmedlemmar kommer alltid in, som förut.',
      ],
    },

    viewers: {
      title: 'Vad tittare är',
      body: [
        'En tittare som går med blir en **event player**. De spelar bara det eventet.',
        'De är inte klanmedlemmar och inte gäster. De hamnar aldrig på din klanlista och får ingen rang.',
        'Du kan se alla som gått med på det här sättet under **People** → **Past viewers**.',
        'En stamtittare du vill behålla? **Make guest** på deras rad gör dem till klangäst, så att de kan gå med i vilket av dina event som helst som är öppet för gäster, inte bara det här. **Make a guest a viewer again** gör en gäst till tittare av ett event igen.',
      ],
    },

    tools: {
      title: 'Dina streamverktyg',
      body: [
        'Streamerverktygen fungerar som i ett creator-utrymme: verifierade kanallänkar, kontroller under **Who can join?**, OBS-overlayen och `!join` i chatten.',
        'Overlay-länkarna för ett klanevent finns i eventets **Settings** → **Stream** → **Stream overlay**. `!join` och overlay-märket finns under **Clan settings** → **Profile** → **Streaming**.',
        '[Creator-guiden]({creatorsGuide}) förklarar var och en steg för steg.',
        'Stream-höjdpunkter fungerar här också: med Twitch eller YouTube kopplat klipper Anvil de stora ögonblicken i event som är öppna för tittare. `!join` i Kick-chatten har ett eget reglage i avsnittet **Kick channel**.',
      ],
    },

    faq: {
      title: 'Frågor',
      intro: 'De korta svaren:',
      rows: [
        {
          term: 'Räknas tittare mot vår medlemsgräns?',
          body: 'Nej. De är eventspelare, inte medlemmar. Streamergränserna räknar spelare samtidigt i alla event du arrangerar (se [creator-guiden]({creatorsGuide})).',
        },
        {
          term: 'Skickar `!join` folk till ett event bara för medlemmar?',
          body: 'Nej. Den pekar bara på ett event som är öppet för tittare.',
        },
        {
          term: 'Ska jag skapa ett creator-utrymme i stället?',
          body: 'Bara om du inte har en klan. Ett utrymme är för streamers utan klan i spelet.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Dina medlemmar: medlemslista, gäster och vem som får gå med — Anvil',
    metaDescription:
      'Var en Anvil-klans medlemslista kommer ifrån, vad Members, Guests, Roster only, Departed och Quiet betyder, hur ansökningar om att gå med och Needs review fungerar, de tre inställningarna under Who can join, och hur du tar bort eller bannlyser någon.',
    eyebrow: 'Anvil · för klanens stab',
    title: 'Dina medlemmar: medlemslista, gäster och vem som får gå med',
    dek: 'Alla under Admin → **People** har hamnat där på ett av fyra sätt: klanlistan i spelet tog med dem, staben godkände dem, klanen släpper in alla, eller någon lade till dem för hand. Här är hur vart och ett fungerar, vad Roster-fliken säger dig, och vad du ska kolla när någon hamnat på fel ställe.',
    facts: [
      { strong: 'Medlemslistan i spelet', rest: 'det enda automatiska sättet att bli medlem' },
      { strong: 'Att logga in', rest: 'sätter aldrig någon på medlemslistan' },
      { strong: 'Två köer', rest: 'på två olika flikar' },
    ],
    footnote:
      'Allt här ligger under Admin → **People**. Roster och Needs review är moderatorarbete. **Who can join** och **Staff & roles** är flikar bara för admins. Vem som får göra vad i hela adminytan står i [Stabsroller: vem får göra vad]({staffGuide}).',

    roster: {
      title: 'Var medlemslistan kommer ifrån',
      body: [
        'Medlemslistan är klanlistan från spelet, kopierad till sajten. En admin skickar den från RuneLite med Anvil-pluginet: tryck på **Anvil**-knappen i klanfönstrets titelrad, eller på **Sync roster** i pluginets sidopanel. Alla på listan kommer in som **medlem**, med sin rang från spelet. Bara någon med Admin-rollen på sajten kan skicka den. Alla andra får veta det i spelet.',
        'En synk är det enda som gör någon till medlem av sig själv. Lämnar någon klanen i spelet markeras hen som utträdd vid nästa synk, och går hen med igen kommer hen tillbaka vid synken efter det. Historiken ligger kvar i båda fallen.',
        'Alla andra platser är **gästplatser**: folk som spelar i era event utan att vara med i klanen i spelet. Gäster spåras och kan delta i event. De är inte medlemmar, och de räknas inte in i er plan.',
      ],
      note: {
        tag: 'Att logga in sätter aldrig någon på medlemslistan',
        body: 'Att logga in med Discord, länka en karaktär eller spela med pluginet ger ingen en plats. Ser pluginet någon vars klan i spelet är er, men som inte står på medlemslistan än, ber det om att få in hen (se steg 3). Alla andra har bara ett Anvil-konto utan klan. Det är det som hindrar en främling från att gå med i er klan genom att skriva dess namn.',
      },
    },

    filters: {
      title: 'Så läser du Roster-fliken',
      intro:
        'Fältet högst upp delar medlemslistan i **Members**, **Guests** och **Departed**. Klicka på en del för att filtrera på den. Knapparna under den smalnar av listan ytterligare:',
      rows: [
        {
          term: 'Active',
          body: 'medlemmar som fortfarande står på medlemslistan. Gäster och utträdda räknas inte med.',
        },
        {
          term: 'Quiet 7d+',
          body: 'medlemmar som pluginet inte sett spela på sju dagar eller mer. Den som aldrig har använt pluginet syns inte här, eftersom det inte finns något att bedöma hen efter. Deras **Last played** visar i stället **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'nuvarande gästplatser: folk som spelar i era event men inte är med i klanen i spelet.',
        },
        {
          term: 'Roster only',
          body: 'nuvarande medlemmar och gäster som ännu inte har något konto på sajten. Helt normalt för alla som aldrig loggat in med Discord. De står kvar på medlemslistan; de loggar in och länkar karaktären när de vill anmäla sig till något.',
        },
        {
          term: 'Departed',
          body: 'folk som lämnat i spelet, eller som staben tagit bort. Deras resultat och historik ligger kvar.',
        },
        {
          term: 'All',
          body: 'alla ovan.',
        },
      ],
      outro:
        'Kolumnen **Source** visar hur varje plats började: **Clan sync**, **Added manually** eller **Applied or self-reported**. **Last played** kommer från pluginet, inte från synken av medlemslistan.',
      note: {
        tag: 'Rang och roll är olika saker',
        body: 'De två rullgardinsmenyerna bredvid knapparna filtrerar på rang i spelet och på roll på sajten. Rangen är vad spelet rapporterar. Rollen på sajten är vad en admin sätter under **Staff & roles**. Den ena sätter aldrig den andra.',
      },
    },

    review: {
      title: 'Ansökningar om att gå med och Needs review',
      intro: 'Två sorters folk väntar på ett ja, och de väntar på olika flikar.',
      rows: [
        {
          term: 'Asking to join',
          body: 'högst upp på **Roster**-fliken, och syns bara när någon väntar. En ansökan kommer från sajten (de tryckte på **Apply** på er klansida, eller försökte delta i ett av era event) eller från pluginet (det såg dem spela i er klan i spelet innan medlemslistan hade dem). Varje rad visar vilket, och om de är medlem i en annan klan. **Approve** ger dem en gästplats. **Decline** meddelar dem, som DM på Discord när er bot kan nå dem. Kryssa i flera för att svara alla på en gång.',
        },
        {
          term: 'Awaiting confirmation',
          body: 'på **Needs review**. Folk som länkat en av karaktärerna på er medlemslista genom att få XP på den, genom att fråga, eller genom att spela den med pluginet. De kan redan spela medan de väntar. Kolla att Discord-namnet stämmer med karaktären och tryck sedan på **Approve**. **Not our member** tar bort karaktären från er lista och lämnar den hos sin ägare. **Report to Anvil** är för en karaktär som inte är deras.',
        },
        {
          term: 'Claim requests',
          body: 'också på **Needs review**. Någon har spelat en karaktär som redan är en etablerad medlem här, så Anvil länkade den inte till hen av sig självt. Vet du att det är hen, tryck **Yes, that’s them**; annars **Not them**. En karaktär som bara någonsin varit i er klan länkas direkt. En som också är med i en annan klan går till Anvil för beslut.',
        },
      ],
      note: {
        tag: 'Märket räknar inte ansökningar om att gå med',
        body: 'Siffran på **Needs review**, och på **People** i sidofältet, räknar Awaiting confirmation och Claim requests. Ansökningar om att gå med räknas inte, så titta högst upp på Roster-fliken också.',
      },
    },

    policy: {
      title: 'Vem som får gå med',
      intro:
        'Admin → People → **Who can join** har tre inställningar, och bara admins ser fliken. Den som avgör hur utomstående kommer in är **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'standardvalet. Den som ansöker, eller som pluginet plockar upp från er klan i spelet, väntar som en ansökan tills staben godkänner hen. Ingen får en plats utan ett ja.',
        },
        {
          term: 'Let anyone in',
          body: 'det räcker att fråga. De får en gästplats direkt och ingen ansökan skapas. Bra för ett öppet event, annars mest brus.',
        },
        {
          term: 'No guests',
          body: 'bara era egna medlemmar spelar. Spelare från andra klaner kan inte delta i era event eller be om att gå med, och pluginet skapar ingenting för dem.',
        },
      ],
      outro:
        '**Who can see this clan** är antingen **Anyone** (en länk till en bräda fungerar för den du skickar den till) eller **Members only** (alla andra ser klanens kort och en inbjudan att ansöka). **List in the Clan Hall** sätter klanen på den offentliga listan över klaner. Att stänga av den gör inte klanen privat.',
      note: {
        tag: 'Ingen av dem rör era medlemmar',
        body: 'Synken av medlemslistan ger medlemmar en plats oavsett vad som står här. Er egen stab behandlas heller aldrig som gäster: en stabsmedlems karaktär får en medlemsplats utan ansökan.',
      },
    },

    manual: {
      title: 'Lägga till någon för hand',
      body: [
        'Roster → **+ Add Manually** sätter en karaktär på medlemslistan. Fyll i **RSN**, och om du vill hens **Discord ID** och **Rank**. Kryssa i **Add as guest** för någon som inte är med i er klan i spelet. Både moderatorer och admins kan göra det.',
        'Använd det för någon som synken inte ser än, till exempel en rekryt som gick med efter senaste synken. Platsen markeras **Added manually**, och synken behandlar den som ert beslut: tar du senare bort en plats du lagt till för hand, tar nästa synk inte tillbaka den.',
        'Att lägga till någon på medlemslistan anmäler hen inte till ett event. Det gör du på eventets flik **Sign-ups** med **Add member**. Den är bara för admins.',
      ],
    },

    removing: {
      title: 'Ta bort och bannlysa',
      intro: 'Varje rad på medlemslistan har en åtgärdsmeny. De här gör olika saker:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'de står kvar på listan och kan fortfarande sättas in i event, men räknas inte längre som medlem. **Promote to member** gör det ogjort.',
        },
        {
          term: 'Remove from roster',
          body: 'markerar dem som utträdda. Deras historik och resultat ligger kvar. Är de fortfarande med i er klan i spelet kan nästa synk av medlemslistan lägga till dem igen.',
        },
        {
          term: 'Not our member',
          body: 'på Needs review, för en karaktär som någon länkat men som inte är med i er klan. Den tas bort från er lista och stannar hos sin ägare.',
        },
        {
          term: 'Ban from this clan',
          body: 'avslutar alla platser personen har här, alts inräknade, tar bort alla stabsroller och brädjobb hen har i den här klanen, och hindrar hen från att komma tillbaka: synken av medlemslistan, pluginet och ansökningar om att gå med avvisar hen alla tills bannlysningen hävs. Hens Anvil-konto och andra klaner påverkas inte. Bara för admins, bara för någon med konto på sajten och en roll under admin, från radens meny, från **Staff & roles** eller för flera personer på en gång. Att häva en bannlysning sätter inte tillbaka hen; hen går med igen i spelet eller så lägger du till hen.',
        },
      ],
      note: {
        tag: 'En bannlysning tar också bort stabsrollen',
        body: 'Att bannlysa någon avslutar hens platser och tar bort hens stabsroll och eventuella jobb som brädredaktör eller brädkassör på klanens brädor. Att häva bannlysningen ger inte tillbaka dem: sätt rollen igen under Staff & roles om hen ska ha den.',
      },
    },

    faq: {
      title: 'Vanliga frågor',
      intro: 'Det som oftast förklarar att någon hamnat på fel ställe.',
      rows: [
        {
          term: 'Någon i klanen saknas',
          body: 'Kör en synk av medlemslistan först: listan ändras bara när en admin skickar den. Kolla sedan **Departed**, ifall hen tagits bort, och om hen är bannlyst; synken hoppar över alla som är bannlysta här och rapporterar vilka den hoppade över. Har klanen gått över sin plan och respitperioden löpt ut slutar synken lägga till nya medlemmar tills ni uppgraderar eller rensar medlemslistan.',
        },
        {
          term: 'Någon visas som gäst men är med i klanen',
          body: 'Oftast är hen fortfarande medlem i en annan klan på Anvil. En karaktär kan bara vara medlem i en klan i taget, så synken ger hen en gästplats här och gör hen till medlem vid första synken efter att hen lämnat den andra klanen. Annars kom hen in via en ansökan, eller så har någon degraderat hen eller lagt till hen som gäst. Kör en synk, eller använd **Promote to member**.',
        },
        {
          term: 'Någon har loggat in men står inte på medlemslistan',
          body: 'Det är väntat. Att logga in skapar ett Anvil-konto, inte en plats. Hen dyker upp när synken listar hen, när du godkänner hens ansökan, eller när du lägger till hen för hand.',
        },
        {
          term: 'Namn som #Player1234',
          body: 'RuneLite visar en sådan platshållare en kort stund medan en spelare loggar in, och för klanmedlemmar som det inte kan namnge. Anvil ignorerar de namnen nu: synken hoppar över dem, pluginet skapar ingen ansökan för dem, och gamla ansökningar under ett sådant namn är dolda. Står det fortfarande ett på er medlemslista är det en gammal rad. **Remove from roster** tar bort den.',
        },
        {
          term: 'En borttagen medlem kommer hela tiden tillbaka',
          body: 'Att ta bort någon ändrar inte klanen i spelet, så nästa synk lägger till hen igen så länge spelet fortfarande listar hen. Ta bort hen i spelet, eller bannlys hen här.',
        },
        {
          term: 'En moderator ser inte Who can join',
          body: 'Det är en flik bara för admins, precis som Staff & roles. Se [Stabsroller: vem får göra vad]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Stabsroller: vem får göra vad — Anvil',
    metaDescription:
      'Klanrollerna på Anvil (ägare, admin, kassör, moderator, medlem), vad varje roll når, hur du gör någon till moderator, vem som kan ge vilken roll, och de uppgifter som bara gäller ett event.',
    eyebrow: 'Anvil · för ägare och admins',
    title: 'Stabsroller: vem får göra vad',
    dek: 'Fem roller, satta per klan under Admin → People → **Staff & roles**. En roll här ger ingenting i någon annan klan, och ingen kan dela ut en roll som är lika hög som eller högre än den egna. Den här sidan är hela kartan: vad varje roll når, hur du delar ut en, och uppgifterna som täcker ett enda event.',
    facts: [
      { strong: 'Per klan', rest: 'en roll här betyder ingenting någon annanstans' },
      { strong: 'Under din egen', rest: 'är allt du kan ge' },
      { strong: 'Ägare', rest: 'byts bara genom överlåtelse' },
    ],
    footnote:
      'Roller kontrolleras på nytt vid varje sidladdning, så en ändring gäller från personens nästa klick; hen behöver inte logga ut. Om själva medlemslistan, se [Dina medlemmar]({peopleGuide}). Om en moderators vardag, se [På passet]({moderatorGuide}).',

    roles: {
      title: 'Rollerna',
      intro: 'Alla som loggar in med Discord börjar som vanlig **Member**. Ovanför det:',
      rows: [
        {
          term: 'Ägare',
          body: 'den som skapade klanen, tills hen lämnar över den. Allt en admin kan göra, plus att överlåta ägarskapet och radera klanen. Det finns exakt en, och ingen kan degradera, ta bort eller bannlysa hen.',
        },
        {
          term: 'Admin',
          body: 'allt utom att lämna över klanen: event och brädor, inställningar, Discord, staben och klanens pengar.',
        },
        {
          term: 'Kassör',
          body: 'avgifter, kassan och priser, utöver allt en moderator gör: medlemslistan, bevis, tävlingar, Schedule och Needs review.',
        },
        {
          term: 'Moderator',
          body: 'nykomlingar, medlemslistan, bevis, veckotävlingar och klanevent. Inga event eller brädor, inga inställningar, ingen stab och inga pengar.',
        },
        {
          term: 'Medlem',
          body: 'ingen uppgift i staben. Spelar, anmäler sig, och kan rapportera en donation till kassan.',
        },
      ],
      outro:
        'Under rollen på Staff & roles finns två kryssrutor, för alla under admin, vanliga medlemmar inräknade. **Can build bingo boards** öppnar Tiles-fliken på varje bräda och Task library. **Can write guides** låter dem skriva klanens guider. Admins har redan båda.',
    },

    assign: {
      title: 'Göra någon till moderator',
      intro:
        'Hen måste ha loggat in med Discord och länkat en karaktär som står på er medlemslista, som medlem eller gäst. Sedan:',
      steps: [
        'Öppna Admin → **People** → **Staff & roles**.',
        'Listan öppnas på **Staff**. Byt till **Members** eller **All accounts** och sök efter hens namn.',
        'Välj **Moderator: newcomers, roster, sign-ups, proofs** i kolumnen **Role**. Det sparas så fort du väljer.',
        'Ska hen också bygga brädor, kryssa i **Can build bingo boards**.',
      ],
      outro:
        'Inte inloggad än? Leta upp hens karaktär på **Roster**-fliken, öppna dess meny och välj **Set role**. Då sparas rollen på karaktären. Hen får den första gången hen loggar in och länkar den, eller, om hen väntar på Needs review, när en moderator godkänner hen.',
      note: {
        tag: 'Ta tillbaka den',
        body: 'Sätt tillbaka rollen till **Member**. Att ändra någons roll tar också bort de brädjobb hen hade på klanens brädor (se steg 5), så lägg till dem igen efteråt om hen ska behålla dem.',
      },
    },

    who: {
      title: 'Vem kan ge vad',
      intro:
        'Staff & roles är en flik bara för admins, och varje ändring där kontrolleras mot två regler: du kan bara ge en roll under din egen, och du kan bara ändra någon vars roll är under din egen.',
      rows: [
        {
          term: 'Ägaren',
          body: 'kan ge och ta bort Admin, Treasurer och Moderator.',
        },
        {
          term: 'En admin',
          body: 'kan ge och ta bort Treasurer och Moderator. En admin kan inte göra någon annan till admin, ändra en annan admin eller ändra sin egen roll.',
        },
        {
          term: 'Kassörer och moderatorer',
          body: 'kan inte ändra någons roll. Fliken är dold för dem.',
        },
        {
          term: 'Ingen',
          body: 'kan ändra ägarens roll, ta bort hen eller bannlysa hen. Klanen behåller också alltid en admin: den sista kan inte degraderas.',
        },
      ],
      note: {
        tag: 'Lämna över klanen',
        body: 'Det kan bara ägaren, och bara till någon som redan är admin: den adminens rad får åtgärden **Make owner**. Av säkerhetsskäl tar det 3 dagar, som att byta PIN-kod hos banken: en banderoll på varje adminsida visar när det sker, fram till dess kan du trycka **Cancel**, hen kan trycka **Decline**, och Anvils personal får veta och kan stoppa det. När de 3 dagarna har gått blir hen ägare och du en vanlig admin. Bara den nya ägaren kan överlåta den tillbaka.',
      },
    },

    table: {
      title: 'Vem får göra vad',
      intro:
        'Vad varje roll når i adminytan. ”Om ikryssad” betyder rutan **Can build bingo boards** eller **Can write guides** under Staff & roles.',
      areaLabel: 'Område',
      columns: ['Ägare', 'Admin', 'Kassör', 'Moderator', 'Medlem'],
      rows: [
        { area: 'Dashboard', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Event: skapa, redigera, lag, anmälningar, starta', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Brädans rutor och Task library', cells: ['Ja', 'Ja', 'Om ikryssad', 'Om ikryssad', 'Om ikryssad'] },
        { area: 'Bevis att granska', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Veckotävlingar', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Klanevent', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Schedule', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Medlemslista: visa, lägga till, ta bort', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Ansökningar om att gå med och Needs review', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Bannlysa någon från klanen', cells: ['Ja', 'Under admin', 'Nej', 'Nej', 'Nej'] },
        { area: 'Staff & roles', cells: ['Ja', 'Under admin', 'Nej', 'Nej', 'Nej'] },
        { area: 'Who can join', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Kassan och prisstegar', cells: ['Ja', 'Ja', 'Ja', 'Nej', 'Nej'] },
        { area: 'Avgifter: markera som insamlade', cells: ['Ja', 'Ja', 'Ja', 'Nej', 'Nej'] },
        { area: 'Avgifter: bekräfta (den andra signaturen)', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Discord-inställningar', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Posta i Discord', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Klaninställningar: Profile, Features, Rules & scoring, Boosts', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Plan och betalning', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Guider', cells: ['Skriva', 'Skriva', 'Läsa; skriva om ikryssad', 'Läsa; skriva om ikryssad', 'Skriva om ikryssad'] },
        { area: 'Aktivitetslogg', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Synka medlemslistan från RuneLite', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Överlåta ägarskapet, radera klanen', cells: ['Ja', 'Nej', 'Nej', 'Nej', 'Nej'] },
      ],
      note: {
        tag: 'Dold är inte samma sak som tillåten',
        body: 'Sidofältet listar bara det din roll kan använda, men kontrollen som räknas körs på servern. Skriver du in adressen till en sida din roll inte kan använda skickas du tillbaka till dashboarden, och åtgärden bakom den avvisas.',
      },
    },

    event: {
      title: 'Uppgifter på ett event',
      intro:
        'Vissa uppgifter gäller ett enda event i stället för klanen. En admin ger dem på själva eventet, och de når det eventet och inget annat, så de är säkra att ge till en vanlig medlem.',
      rows: [
        {
          term: 'Brädredaktör',
          body: 'bygger och redigerar den brädans rutor. Ges under eventets **Settings** → **Staff** → **Board staff**, eller med **Boards…** i en persons åtgärder under Staff & roles. En medlem som fått en ser bara sina brädor i adminytan.',
        },
        {
          term: 'Brädkassör',
          body: 'samlar in den brädans avgifter och sköter dess utbetalningar, utan att nå klanens kassa. I adminytan ser hen bara sina egna brädor, och bara varje brädas flikar **Sign-ups** och **Prizes**. Ges också under **Board staff**.',
        },
        {
          term: 'Lagstab',
          body: 'sköter ett lag: dess trupp, dess inlämningar och bevis, och att markera spelarnas avgifter som betalda. De kan inte röra ett annat lag, redigera brädan, göra draftval eller byta ut någon när eventet är live. Läggs till på lagets sida under **Team staff**. Det är så en gästklans moderator sköter sin halva av en klan-mot-klan.',
        },
        {
          term: 'Kapten',
          body: 'utsedd av värden för ett lag. Allt lagstaben kan, plus att göra lagets draftval.',
        },
      ],
      note: {
        tag: 'En klanroll ersätter brädjobb',
        body: 'Att ge någon en klanroll, eller ändra den, tar bort hens jobb som brädredaktör och brädkassör på klanens brädor. Staff & roles varnar dig först när brädjobb är allt hen har. Lägg till dem igen efteråt om hen ska behålla dem.',
      },
    },

    safety: {
      title: 'Så hålls det säkert',
      intro: 'Det här gäller hur rollerna än är satta.',
      rows: [
        {
          term: 'Ägaren är skyddad',
          body: 'hens rad under Staff & roles visar **Protected**. Rollen kan inte ändras och hen kan inte bannlysas. Ägarskapet byts bara när hen själv överlåter det.',
        },
        {
          term: 'Admins kan inte ta bort varandra',
          body: 'en admin kan varken degradera eller bannlysa en annan admin, vare sig en i taget eller flera på en gång. När två admins är oense avgör ägaren. En bannlysning tar också bort personens stabsroll och brädjobb i den här klanen.',
        },
        {
          term: 'Pengar kräver två personer',
          body: 'när en avgift behöver bekräftas måste bekräftelsen komma från en annan admin än den som markerade den som insamlad. Hur många bekräftelser en avgift kräver, från noll till fem, ställs in under **Clan settings** → **Rules & scoring** → **Fee sign-off**. En admin som är ensam om pengarna kan ändå tvinga en avgift stängd, med en separat knapp.',
        },
        {
          term: 'Det här kan en moderator inte',
          body: 'skapa eller redigera event, ändra inställningar eller Discord, ge någon en roll (inte heller sig själv) eller röra klanens pengar.',
        },
        {
          term: 'Allt hamnar i loggen',
          body: 'rolländringar, överlåtelser av ägarskap, bannlysningar och besvarade ansökningar om att gå med skrivs till **Activity log**, som alla i staben kan läsa.',
        },
        {
          term: 'Discord-roller är en annan sak',
          body: 'Anvils rollsynk matchar Discord-roller mot **rang i spelet**, inte mot roller på sajten. Att göra någon till moderator här ger hen ingenting på er Discord-server, och en moderatorroll du delat ut för hand i Discord lämnas i fred. Det enda botkommandot som ändrar något, att lägga till i kassan med `/coffer`, kontrollerar rollen på sajten: kassör, admin eller ägare.',
        },
      ],
    },
    log: {
      title: 'Aktivitetsloggen',
      body: [
        '**Activity log** i admin-menyn listar de senaste 200 ändringarna, och alla i stabben kan läsa den: inträden, avhopp, namnbyten och verifieringar, ägarbyten, kaptener som utsetts och tagits bort, anmälningar som godkänts eller nekats, avgifter som bekräftats, funktioner som slagits av och på, och inställningar som ändrats. **Filter by event type** begränsar den.',
        'Det är också där dubbletter städas. **Merge two members** viker en dubblett in i den riktiga, och **Suspected renames** listar namnbyten som Anvil har upptäckt för dig att bekräfta eller förkasta.',
      ],
    },
  },
  supporter: {
    metaTitle: 'Anvil Supporter: nivåer och förmåner — Anvil',
    metaDescription:
      'Vad Anvil Supporter, Champion och Patron får: namnfärger och stjärnan, guld-GZ, animerad avatar och banner, montern, vänevent, head-to-head, eventchatt och klanboosts. Hur betalningen via Gumroad fungerar och vad som händer när du säger upp.',
    eyebrow: 'Anvil · för spelare',
    title: 'Anvil Supporter: nivåer och förmåner',
    dek: 'Anvil Supporter är en personlig prenumeration som betalar för Anvils servrar. Den finns i tre nivåer, och varje nivå har allt som nivån under har. Varje förmån är utseende eller utrymme att arrangera: spårning, event, poäng och din egen statistik är fortsatt gratis för alla, och inget här ändrar vad ett event räknar.',
    facts: [
      { strong: 'Från $1 i månaden', rest: 'eller $10 om året' },
      { strong: 'Bara utseende', rest: 'aldrig poäng, en rang eller ett föremål' },
      { strong: 'Inget raderas', rest: 'när du slutar' },
    ],
    footnote:
      'Allt här ställs in på webbplatsen under **Settings** → **Supporter**, **Profile look** och **Clan boosts**. Boosts i detalj finns i [Boosta en klan]({boostsGuide}). Var dina färger syns i RuneLite står i [Sidopanelen, flik för flik]({panelGuide}).',

    tiers: {
      title: 'De tre nivåerna',
      intro: 'Priserna står på sidan **Anvil Supporter**, `/supporter`. En årsplan kostar som tio månader.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 i månaden eller $10 om året. Ett namn i guld och en stjärna, guld-GZ, en monter med 4 platser, och du kan arrangera ett vänevent.',
        },
        {
          term: 'Champion',
          body: '$2 i månaden eller $20 om året. Ett gradientnamn från våra förval (eller en egen färg), egen avatar och egen banner (animerade om du vill), 8 platser i montern, snabbare eventchatt och 1 klanboost.',
        },
        {
          term: 'Patron',
          body: '$5 i månaden eller $50 om året. Din egen gradient med upp till 4 färger, som rör sig, 12 platser i montern, ingen väntan i eventchatten, 2 vänevent samtidigt och 2 klanboosts.',
        },
      ],
      note: {
        tag: 'Tid från inbjudningar',
        body: 'Under Settings → Supporter får du en inbjudningslänk. När en vän du bjudit in betalar tjänar du gratis månader; belöningen kommer två veckor efter deras första betalning. Tid som tjänats in så ger alla förmåner på sin nivå utom klanboosts.',
      },
    },

    compare: {
      title: 'Vad varje nivå får',
      intro: 'Samma tabell som på Supporter-sidan, plus chattförmånerna.',
      table: {
        areaLabel: 'Förmån',
        columns: ['Gratis', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Namnfärger', cells: ['—', 'Guld', 'Förval eller en egen färg', 'Förval eller upp till fyra färger, i rörelse'] },
          { area: 'Stjärna vid ditt namn', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Guld-GZ', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Egen avatar och banner, animerade', cells: ['—', '—', 'Ja', 'Ja'] },
          { area: 'Monter', cells: ['—', '4 platser', '8 platser', '12 platser'] },
          { area: 'Vänevent (samtidigt · spelare)', cells: ['Bara delta', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Head-to-head-utmaningar', cells: ['1 aktiv', '5 aktiva', 'Obegränsat', 'Obegränsat'] },
          { area: 'Eventchatt: väntan mellan rader', cells: ['5 s', '3 s', '1 s', 'Ingen'] },
          { area: 'Klanboosts', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Under **Settings** → **In-game chat** finns tre till: egna färger i chattflödet (Supporter), att välja vad din inloggningssammanfattning tar upp (Champion), och en stjärna vid ditt namn i andra spelares chattflöden (Patron).',
    },

    names: {
      title: 'Namnfärger',
      intro:
        'Ställ in dem under **Settings** → **Supporter**, i **Your name’s look**. Förhandsvisningen visar ditt namn på en mörk och på en ljus bakgrund.',
      rows: [
        {
          term: 'Supporter',
          body: 'helt i guld. Det finns inget att välja.',
        },
        {
          term: 'Champion',
          body: 'en av de förvalda gradienterna (**Classic**, standard, **Ember**, **Ocean**, **Aurora**, **Rose gold** eller **Toxic**), eller **Your own**: en fast färg. Över alla dina karaktärer kan du använda högst två olika egna färger.',
        },
        {
          term: 'Patron',
          body: 'alla förval plus **Prism**, Patrons standard, eller **Your own** med en till fyra färger. En färg står still; två till fyra ger en gradient som rör sig från vänster till höger.',
        },
      ],
      outro:
        '**Your Anvil display name** är namnet på ditt Discord-länkade konto. Under **Your RuneScape characters** väljer du **Same for all** eller **Customize each** för att ge varje karaktär ett eget utseende. Tryck på **Save** (eller **Save for all characters**); **Reset to default** går tillbaka till din nivås färger.',
      note: {
        tag: 'Mörka och ljusa bakgrunder',
        body: 'Sajten, pluginpanelen och Discord är mörka; spelets fasta chattruta är ljus. Anvil justerar dina färger så att de förblir läsbara på båda. Vill du ha ett annat utseende på någon av dem, slå på **Set a separate look for dark backgrounds** eller **for light backgrounds**. Det utseendet visas precis som du valde det, utan kontrastjustering, och förhandsvisningen varnar dig när det är svårläst.',
      },
    },

    where: {
      title: 'Var din flair syns',
      intro: 'Dina färger och stjärnan följer med överallt där ditt namn står:',
      rows: [
        {
          term: 'På sajten',
          body: 'brädor, medlemslistor, profiler, ditt eget namn i toppraden och dina karaktärers namn. Stjärnan bär dina färger.',
        },
        {
          term: 'I pluginpanelen',
          body: 'Feed, eventchatten, korten och raden **Tracking**. En Patrons gradient glider; varje spelare kan stoppa den med **Animated names**.',
        },
        {
          term: 'I spelet',
          body: 'för andra spelare som använder Anvil-pluginet: offentlig chatt, klan-, vän- och privatchatt, klanutrop, inloggningsmeddelanden, vän- och klanlistor och högerklicksmenyn (aldrig på PvP-världar eller i Wilderness). I spelchatten är stjärnan en Patrons.',
        },
        {
          term: 'På Discord',
          body: 'en stjärna bredvid ditt namn på Anvils inlägg, ritad i dina egna färger om du valt några.',
        },
        {
          term: 'Guld-GZ',
          body: 'på en klankamrats drop i klanens flöde på sajten kan ditt GZ vara i guld. Bara Supporters kan ge ett.',
        },
      ],
      note: {
        tag: 'Bara på karaktärer som bevisats vara dina',
        body: 'Färgerna syns bara på karaktärer som pluginet har bekräftat är dina, på sajten och i spelet. För att hålla dem borta från dina namn i andras spelchatt, kryssa ur **Show my colours on my characters’ names in game chat** under Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banner och monter',
      intro: 'Alla tre finns under **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar och banner',
          body: 'Champion och Patron. Ladda upp dina egna; en GIF eller WebP förblir animerad. De syns på ditt kort, din profil och alla dina karaktärer, på sajten och i pluginet. En banner får vara upp till 6 MB och minst 600×150; en avatar upp till 2 MB.',
        },
        {
          term: 'Per karaktär',
          body: 'ge en karaktär en egen banner eller avatar, eller båda. Det ersätter din standard bara på den karaktärens sidor och pluginkort.',
        },
        {
          term: 'Monter',
          body: 'dina bästa drops, killcounts och tider fästa på din profil: 4 platser för Supporter, 8 för Champion, 12 för Patron. Fästa saker från karaktärer du inte delar förblir privata.',
        },
      ],
    },

    hosting: {
      title: 'Vänevent, head-to-head och chatt',
      intro: 'Förmånerna som ger dig mer utrymme att spela, i stället för ett utseende:',
      rows: [
        {
          term: 'Vänevent',
          body: 'kör din egen bingo, solobingo eller race för vänner från **Host an event for your friends**, spårat av pluginet precis som ett klanevent. Vänner går med via din inbjudningslänk. Supporter: 1 pågående event, 10 spelare. Champion: 1 event, 25 spelare. Patron: 2 samtidigt, 50 spelare sammanlagt. Vem som helst kan gå med i ett.',
        },
        {
          term: 'Head-to-head',
          body: 'utmana en vän från hens profil: först till en drop, eller flest kills eller mest XP på 1 timme, 24 timmar eller 7 dagar. Bara för äran. Gratisspelare kan ha 1 öppen åt gången, Supporters 5, Champions och Patrons hur många de vill.',
        },
        {
          term: 'Eventchatt',
          body: 'hur länge du väntar mellan rader: 5 sekunder utan nivå, 3 för Supporters, 1 för Champions, ingen för Patrons. När en brädas chatt blir livlig väntar alla 10 sekunder, Patrons också.',
        },
        {
          term: 'Klanboosts',
          body: 'Champion 1, Patron 2, så länge du betalar. Se [Boosta en klan]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Betala, byta och säga upp',
      intro: 'Anvil Supporter faktureras via Gumroad, månadsvis eller årsvis.',
      steps: [
        'Logga in på Anvil och öppna `/supporter`.',
        'Tryck på **Choose Supporter**, **Choose Champion** eller **Choose Patron**. Gumroads kassa öppnas, med månads- eller årsbetalning.',
        'Betala. Dina förmåner slås på så fort Gumroad meddelar Anvil, och din nivå visas på Supporter-sidan som **Your tier**.',
      ],
      outro:
        'Byt nivå med **Change tier** under Settings → Supporter. Säg upp eller uppdatera ditt kort med **Manage on Gumroad** på samma ställe. Ett uppsagt medlemskap behåller alla förmåner till slutet av perioden du betalat för.',
      note: {
        tag: 'Börja alltid från /supporter',
        body: 'Knappen **Choose** bär en kod som talar om för Anvil vilket konto som betalade. Anvil matchar aldrig en betalning via e-post, så om du köper direkt från Gumroad utan den knappen blir betalningen inte kopplad. Har det hänt, fråga i Anvils Discord så kan staben koppla den till ditt konto för hand.',
      },
    },

    lapse: {
      title: 'Gå ner eller sluta',
      intro:
        'Inget du ställt in raderas. Varje förmån kontrolleras mot den nivå du har just nu, så den stängs av av sig själv och kommer tillbaka så fort du förnyar.',
      rows: [
        {
          term: 'Namnfärger',
          body: 'ditt sparade val ligger kvar. Du bär din nya nivås färger, eller inga, tills en nivå som tillåter det kommer tillbaka.',
        },
        {
          term: 'Avatar och banner',
          body: 'under Champion visar de sin första stillbild i stället för att röra sig.',
        },
        {
          term: 'Monter',
          body: 'visar de första fästa sakerna din nivå tillåter och döljer resten. Utan nivå är den dold; de fästa sakerna väntar på dig.',
        },
        {
          term: 'Klanboosts',
          body: 'dina äldsta boosts fortsätter räknas och resten pausas, de tas inte bort.',
        },
      ],
      note: {
        tag: 'En tillfällig uppgradering från Anvils stab',
        body: 'Staben kan ge någon en högre nivå ett tag, till exempel som tack. Den ligger ovanpå det du betalar och ändrar aldrig din prenumeration. Settings → Supporter visar **A gift from Anvil** och när den tar slut; efter det är du tillbaka på din betalda nivå. En gåva ger bara platser för klanboosts när staben tar med dem.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Anvils sidopanel, flik för flik — Anvil',
    metaDescription:
      'Vad varje flik i Anvils sidopanel i RuneLite visar (Clan, Feed, You, Lookup och kugghjulet), hur eventchatt och reaktioner i Feed fungerar, och plugininställningarna för flödet i spelchatten, Supporter-färger och animerade namn.',
    eyebrow: 'Anvil · för spelare',
    title: 'Sidopanelen, flik för flik',
    dek: 'Anvil-knappen i RuneLites sidofält öppnar en panel med fyra flikar och ett kugghjul: **Clan**, **Feed**, **You**, **Lookup** och ⚙. Det mesta den visar kommer från sajten, så den håller sig aktuell utan en uppdatering av pluginet. Några saker nedan är markerade som på väg i nästa pluginuppdatering.',
    facts: [
      { strong: 'Fyra flikar', rest: 'och ett kugghjul för synkning och inställningar' },
      { strong: 'Eventchatt', rest: 'på Feed-fliken' },
      { strong: 'GZ, Sad, Sit', rest: 'på raderna i Feed' },
    ],
    footnote:
      'Att installera pluginet och logga in står i [Installationsguide för spelare]({pluginGuide}). Supporter-färger, stjärnan och chattförmånerna förklaras i [Anvil Supporter: nivåer och förmåner]({supporterGuide}).',

    header: {
      title: 'Överst i panelen',
      intro: 'Ovanför flikarna sitter titeln, **Refresh** och kontoraden.',
      rows: [
        {
          term: 'Refresh',
          body: 'laddar om panelen, Feed-fliken inräknad. Det står **Refreshing…** medan den arbetar. I nästa pluginuppdatering laddar den också om You och Lookup, så att en ny avatar eller banner syns direkt, och den tömmer inte längre Feed-fliken.',
        },
        {
          term: 'Tracking',
          body: 'raden under titeln visar karaktären som spåras, i dess Supporter-färger om den har några. **Not my account…** slutar spåra en karaktär som någon annan spelar på den här datorn; **Track again** ångrar det.',
        },
        {
          term: 'Kontomenyn',
          body: 'länken ⋯ öppnar **View my profile on Anvil**, **Not my account…** och **Sign out…**. I nästa pluginuppdatering har den också **Become a Supporter**, eller **Your Supporter perks** om du redan är det.',
        },
        {
          term: 'Säsongsframsteg',
          body: 'i nästa pluginuppdatering står det på Leagues, Deadman och andra säsongsvärldar en rad: **Sharing season progress · Turn off**. Den skickar dina relics, områden och tasks (med en skärmbild) till din klan; klanen väljer på webbplatsen vad som postas. **Turn on** delar det igen. Samma reglage heter **Share seasonal activity** i plugininställningarna.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Dina event och din klan. I en kreatörs space heter fliken **Space**.',
      rows: [
        {
          term: 'Klanmenyn',
          body: 'visas när du spelar i mer än en klan eller space. **All clans** (standard) visar allt du spelar, med pågående event först. Väljer du en klan smalnas panelen av till den, och dina inskick hamnar där.',
        },
        {
          term: 'Event',
          body: 'varje pågående och kommande bräda, Skill eller Boss of the Week och klanevent, med var du står. Sedan **Your other boards**, **Also live** och **Your clan**.',
        },
        {
          term: 'En bräda',
          body: 'öppna en för ställningen, lagen, uppdragen, senaste aktiviteten, de närmaste rutorna och **View all tiles**. Dess knappar **Feed** och **Chat** öppnar brädan på Feed-fliken.',
        },
        {
          term: 'Ett klanevent',
          body: '**I’m going**, **Sign me up** eller **Answer the survey**, beroende på eventet.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Din klans och dina brädors stora ögonblick, live: drops, pets, achievements, quests, dödsfall och klara rutor.',
      rows: [
        {
          term: 'Vems flöde',
          body: 'menyn överst listar **Clan ·** för varje klan du är medlem i och **Event ·** för varje pågående bräda du är med på. Den öppnas på din bräda om du har en, annars på din klan.',
        },
        {
          term: 'Filter',
          body: '**All**, **Tiles** (bara brädor), **Drops**, **Pets**, **Achievements**, **Deaths**, och **My team** på en bräda där du är med i ett lag. Ett klanflöde har också en knapp för aktivitet i spellägen som Leagues och andra lägen.',
        },
        {
          term: 'Nya rader',
          body: 'kommer av sig själva. Har du scrollat iväg tar en **↑ N new**-knapp dig tillbaka till dem.',
        },
      ],
      note: {
        tag: 'Inte samma sak som chattflödet i spelet',
        body: 'Feed-fliken fungerar oavsett vad dina plugininställningar säger. **Show feed in game chat** (steg 8) är den separata inställningen som också skriver ut det i din chattruta.',
      },
    },

    reactions: {
      title: 'Reaktioner',
      intro: 'Varje rad i Feed har sin reaktion under sig:',
      rows: [
        {
          term: 'GZ',
          body: 'på drops, pets och achievements. Antalet visas bredvid, till exempel **GZ 3**.',
        },
        {
          term: 'Sad och Sit',
          body: 'på dödsfall, i stället för GZ. Sit är spelets sätt att säga åt någon som dött att sätta sig ner.',
        },
        {
          term: 'Vem som kan reagera',
          body: 'på ett klanflöde: klankamrater. På en bräda: spelarna på den och värdens stab; när en bräda döljer ställningen kan spelarna bara reagera på sitt eget lags rader.',
        },
        {
          term: 'Vem som reagerat',
          body: 'håll muspekaren över en reaktion för att se namn, till exempel “GZ · Mossy and 3 others”. Klicka igen för att ta tillbaka din.',
        },
      ],
      note: {
        tag: 'I nästa pluginuppdatering',
        body: 'Reaktionerna blir pillerknappar, färgade när en är din, och andras reaktioner uppdateras live för alla som tittar, även i dina andra öppna klienter. I dag ändras antalet när du reagerar eller när Feed laddas om. Guld-GZ, Supporter-reaktionen, ges i webbplatsens flöden; Feed-fliken har GZ, Sad och Sit.',
      },
    },

    chat: {
      title: 'Eventchatt',
      intro:
        'En bräda med chatt påslagen har ett **Feed / Chat**-reglage överst på Feed-fliken, för spelarna på den brädan och värdens stab. Brädans sida på Clan-fliken har också en **Chat**-knapp.',
      rows: [
        {
          term: 'Alla eller ditt lag',
          body: '**All** skriver till hela brädan, **My team** bara till ditt lag (de raderna är märkta **TEAM**). Staben ser också **Host & mods**, och deras rader är märkta **HOST** eller **MOD**.',
        },
        {
          term: 'Skicka',
          body: 'skriv i rutan och tryck på Enter. Rader får vara upp till 200 tecken, och bara värden och moddarna kan posta länkar.',
        },
        {
          term: 'Hur ofta',
          body: 'väntan mellan dina rader följer din Supporter-nivå: 5 sekunder utan nivå, 3 för Supporters, 1 för Champions, ingen för Patrons. Raden under rutan säger vad som gäller för dig. Staben väntar aldrig.',
        },
        {
          term: 'Slow mode',
          body: 'när en brädas chatt blir väldigt livlig väntar alla minst 10 sekunder i en minut, Patrons inräknade. Ingen kan skicka fler än 10 rader på 10 sekunder.',
        },
        {
          term: 'Moderering',
          body: 'värden och moddarna kan högerklicka på en rad för att välja **Delete message** eller **Mute** någon, och pausa hela chatten med **Pause chat**.',
        },
      ],
      outro:
        'Flera rader i följd från samma person delar ett namn och en tid, tills det blir ett uppehåll på 5 minuter. Chatten sparas i 7 dagar efter att eventet slutat.',
    },

    you: {
      title: 'You och Lookup',
      intro: 'Två flikar för spelarkort: ditt eget och alla andras.',
      rows: [
        {
          term: 'You',
          body: 'ditt eget kort för karaktären du är inloggad på: banner och avatar, **Display case**, collection log ner till varje sidas föremål, och **Skills**, **Bosses**, **Clues**, **Times** och **CAs**. Under det finns en eventuell **Head-to-head**-utmaning som väntar på dig (**Accept** eller **Decline**) och dina **Goals**, med **+ Add goal**.',
        },
        {
          term: 'Lookup',
          body: 'växla mellan **Players** och **Clans**, skriv ett namn och tryck på Enter. **Recent** listar dina senaste. Högerklicka på vem som helst i spelet och välj **Anvil** för att hamna här.',
        },
        {
          term: 'Jämför',
          body: 'på någon annans kort ställer **Compare with me** upp er två färdighet för färdighet, boss för boss och sida för sida. En klans kort har **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'Kugghjulsfliken',
      intro: 'Synkning och inställningar, snarare än saker att titta på:',
      rows: [
        {
          term: 'Sync profile',
          body: 'skickar din collection log och dina bästa tider till Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'bara för klanens admins: skickar klanens medlemslista från spelet till sajten. Kan pluginet inte läsa din klan står det **Join your clan channel to sync the roster** i stället.',
        },
        {
          term: 'Bannerljud',
          body: '**Add clip** för ljudet en banner spelar, **Copy folder path** för att hantera dem, och **Add mission clip** för uppdrag.',
        },
        {
          term: 'Become a Supporter',
          body: 'i nästa pluginuppdatering öppnar en ★-länk längst ner Supporter-sidan, eller så står det **Your Supporter perks** om du redan är det.',
        },
      ],
    },

    settings: {
      title: 'Inställningar som ändrar vad du ser',
      intro:
        'I RuneLites konfiguration för Anvil, under **Chat messages**. Alla är påslagna från början.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'skriver också ut flödet i din chattruta medan det händer: stora drops, pets och achievements från brädor vars värd slagit på det och klaner du är gäst i, dina lagkamraters framsteg på rutor och andra lags klara rutor.',
        },
        {
          term: 'Supporter names in chat',
          body: 'Supporters färger (och en Patrons stjärna) i offentlig chatt, klan-, vän- och privatchatt, och på din vänlista och kanalernas medlemslistor. Listan med namn laddas ner från Anvil; inget om vilka du ser skickas.',
        },
        {
          term: 'Animated names',
          body: 'låter en Patrons gradient glida i panelen, Feed och eventchatten. Avslaget står den still. I nästa pluginuppdatering gäller den också boostade klannamn och animerade banners i panelen.',
        },
        {
          term: 'Supporter names in menus',
          body: 'Supporters färger på deras namn när du högerklickar på dem, aldrig på PvP-världar eller i Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'påslagen ersätter en Supporters färger en namnfärg som ett annat plugin satt, till exempel Player Indicators. Avslagen låter de namnen vara.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'Boosta en klan — Anvil',
    metaDescription:
      'Så fungerar klanboosts på Anvil: vem som har dem, att placera och flytta en boost, de tre boostnivåerna och vad var och en låser upp, klanens namnfärger, boosts i gåva, och boostermärken och badges.',
    eyebrow: 'Anvil · för Supporters och klanens stab',
    title: 'Boosta en klan',
    dek: 'En betalande Champion eller Patron kan lägga en boost på en klan hen är medlem i. Tillräckligt många boosts från en klans medlemmar höjer den en nivå, och varje nivå ändrar hur klanen ser ut och var den listas. Boosts är bara utseende: de ändrar aldrig en rang, en poäng, en plats eller klanens plan.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosts så länge du betalar' },
      { strong: 'Nivåer vid 3, 8 och 15', rest: 'räknade boosts' },
      { strong: 'En gång i veckan', rest: 'kan en boost flyttas' },
    ],
    footnote:
      'Medlemmar placerar boosts under **Settings** → **Clan boosts**. Klanens stab ser nivån och dess alternativ under Admin → **Clan settings** → **Boosts**. Om själva Supporter-nivåerna, se [Anvil Supporter: nivåer och förmåner]({supporterGuide}).',

    what: {
      title: 'Vem som har boosts',
      intro: 'Boosts följer med ett betalt medlemskap:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosts.' },
        {
          term: 'Supporter',
          body: 'inga. Det gör inte heller tid som tjänats in via inbjudningar. En tillfällig uppgradering från Anvils stab ger platser bara när staben tar med dem.',
        },
      ],
      outro:
        'Boosts tillhör dig, inte en karaktär: tre karaktärer i tre klaner delar ändå på en uppsättning. **Settings** → **Clan boosts** syns bara i dina inställningar medan du är Supporter eller fortfarande har en boost placerad.',
    },

    place: {
      title: 'Placera och flytta en boost',
      intro: 'Du placerar dina egna boosts; ingen kan placera en åt dig.',
      steps: [
        'Öppna **Settings** → **Clan boosts**. **Your boosts** listar vad du har placerat och eventuella **Free slot**.',
        'Under **Clans you can boost**, tryck på **Boost** bredvid en klan. Du kan också trycka på **Boost this clan** i Boosters-delen på klanens egen sida.',
        'För att flytta en, använd **Move to…** på dess rad och välj en annan klan. **Remove** tar bort den.',
      ],
      rows: [
        {
          term: 'En medlemsplats, 14 dagar gammal',
          body: 'varje boost vilar på en medlemsplats som en av dina karaktärer har i klanen i spelet. En gästplats kan inte bära en. Platsen räknas från det som kom först: när Anvil först såg den, eller när spelet säger att karaktären gick med. Fram till dess visar klanens rad hur många dagar som är kvar.',
        },
        {
          term: 'En rad per klan',
          body: 'listan visar varje klan en gång, och Anvil väljer karaktären som boosten vilar på: din main där det går, annars den plats du haft längst. Klanen ser bara den karaktären, aldrig dina andra.',
        },
        {
          term: 'En gång i veckan',
          body: 'en placerad boost kan flyttas 7 dagar efter att du placerade den. En borttagen boosts plats öppnas igen på samma datum, så att ta bort och placera igen är ingen genväg. Har karaktären den vilade på lämnat klanen kan du flytta den direkt.',
        },
      ],
      note: {
        tag: 'Vad etiketterna betyder',
        body: '**counting**: den räknas mot klanens nivå. **paused**: din nivå har nu färre platser än du har placerat, så dina äldsta boosts fortsätter räknas och resten väntar. **seat gone**: karaktären den vilade på är inte längre medlem där; flytta den. **over the 2-per-person cap**: klanen räknar redan två av dina.',
      },
    },

    levels: {
      title: 'Nivåer',
      intro:
        'En klans nivå kommer från dess räknade boosts. Högst två boosts från en och samma person räknas för en klan, så en nivå betyder alltid att flera medlemmar valt den.',
      rows: [
        { term: 'Nivå 1', body: '3 räknade boosts.' },
        { term: 'Nivå 2', body: '8 räknade boosts.' },
        { term: 'Nivå 3', body: '15 räknade boosts.' },
      ],
      outro:
        'Medlemmarna ser framstegen på klanens sida, till exempel “5 of 8 to Level 2”. En klan som stiger får den nya nivån direkt.',
      note: {
        tag: 'En veckas respit',
        body: 'När boostarna faller under en nivå behåller klanen nivåns förmåner i 7 dagar. Admin → Clan settings → Boosts visar när de tar slut. Om medlemmarna boostar tillbaka den i tid ändras ingenting.',
      },
    },

    perks: {
      title: 'Vad varje nivå låser upp',
      intro: 'Varje nivå behåller allt från nivån under.',
      rows: [
        {
          term: 'Nivå 1',
          body: 'ett **Boosted**-märke på klansidan, dess Clan Hall-kort och i sökningen; en plats ovanför oboostade klaner i Clan Hall och dess sökresultat; och klannamnet i en gradient.',
        },
        {
          term: 'Nivå 2',
          body: 'en plats i Clan Halls **Featured**-rad; klanens animerade banner spelas upp (under nivå 2 visar den sin stillbild); en rekryteringsrad för besökare; och namnets gradient rör sig.',
        },
        {
          term: 'Nivå 3',
          body: '**Spotlight** högst upp i Clan Hall, och ett rekryteringsinlägg i månaden i Anvils Discord, skrivet av klanen.',
        },
      ],
      note: {
        tag: 'Klanens logga är ingen förmån',
        body: 'En animerad logga (en klanbild i GIF eller WebP) spelas upp på alla nivåer. Bara bannern väntar på nivå 2.',
      },
    },

    colours: {
      title: 'Klanens namnfärger',
      intro:
        'Från nivå 1 bär klanens namn Anvils gradient. Ägare och admins kan välja sina egna under Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'En till fyra färger',
          body: 'en färg ger ett fast namn; två till fyra ger en gradient. Från nivå 2 rör sig en gradient.',
        },
        {
          term: 'Mörka och ljusa bakgrunder',
          body: 'precis som med Supporter-namn justerar Anvil färgerna så att de förblir läsbara på mörka bakgrunder (sajten, pluginpanelen, Discord) och ljusa (spelets fasta chattruta). Slå på ett separat utseende för någon av dem så visas det precis som det valts.',
        },
        {
          term: 'Reset to Anvil',
          body: 'går tillbaka till Anvils palett.',
        },
      ],
      outro:
        'Färgerna förblir sparade om klanen faller under nivå 1 och kommer tillbaka när den återvänder. Pluginet plockar upp en ändring vid nästa uppdatering.',
    },

    staff: {
      title: 'För klanens stab',
      intro:
        'Admin → **Clan settings** → **Boosts** är för ägare och admins. Staben kan inte placera boosts åt medlemmar; medlemmarna placerar sina egna.',
      rows: [
        {
          term: 'Nivån',
          body: 'klanens nivå, hur många boosts som räknas, hur många fler som behövs till nästa nivå, och en eventuell respitvecka.',
        },
        {
          term: 'Rekryteringsrad',
          body: 'Nivå 2. En mening, upp till 140 tecken, som visas för personer som inte är med i klanen, på er klansida och ert Clan Hall-kort.',
        },
        {
          term: 'Rekryteringsinlägg i Anvils Discord',
          body: 'Nivå 3. En gång per kalendermånad, 20 till 500 tecken, skrivet av dig och postat när du trycker på **Post it**, med en länk till er klansida. Omnämnanden tas bort och ingen pingas. Du kan inte redigera det eller skicka ett nytt förrän nästa månad.',
        },
        {
          term: 'Boosters',
          body: 'listan över karaktärer som boostar klanen.',
        },
      ],
      note: {
        tag: 'Boosts i gåva från Anvil',
        body: 'Anvils stab kan ge en klan en nivå i gåva, för en bestämd tid eller utan slut. Gåvan lägger bara till de boosts klanen saknar för att nå den nivån, och de visas som **Anvil gift** på klanens Boosters-lista. Varje riktig boost från en medlem ersätter en gåvoboost, och en klan som redan ligger över gåvonivån behåller sin egen. När gåvan tar slut faller klanen tillbaka till den nivå medlemmarnas boosts ger den.',
      },
    },

    boosters: {
      title: 'Boostermärken och badges',
      intro: 'Vad en booster får i klanen hen boostar:',
      rows: [
        {
          term: 'Boostermärket',
          body: 'en liten ädelsten bredvid hens karaktär i den klanens medlemslista, flöde och Discord-inlägg. Håll muspekaren över den för “Boosts this clan”.',
        },
        {
          term: 'Boosters-väggen',
          body: 'på klansidan: en rad per karaktär, flest boosts först, sedan de som stått längst.',
        },
        {
          term: 'Badges',
          body: '**First booster** för den som placerade klanens allra första boost; **1 month**, **3 months**, **6 months** och **1 year** för att ha boostat utan avbrott; och **Level-up 1**, **2** eller **3** för boosten som lyfte klanen till den nivån.',
        },
      ],
      note: {
        tag: 'Att flytta startar om klockan',
        body: 'Badges för tid räknas från karaktärens tidigaste boost som fortfarande räknas, så att flytta eller ta bort en boost startar om dem. Din profil listar klanerna du boostar, en gång per klan.',
      },
    },
  },

  profile: {
    metaTitle: 'Din profil, Wrapped och Compare — Anvil',
    metaDescription: 'Sidorna Anvil håller om dig: din profil, varje karaktärs publika sida, din personsida, månatlig och årlig Wrapped, eventets Wrapped-kort och att jämföra två karaktärer sida vid sida.',
    eyebrow: 'Anvil · för spelare',
    title: 'Din profil, Wrapped och Compare',
    dek: 'Anvil har en sida för **dig** och en för **varje karaktär** du spelar. Det här finns på dem, vem som kan öppna dem, och Wrapped-korten som kommer ut i slutet av varje månad och varje event.',
    facts: [
      {
        strong: 'Delad som standard',
        rest: 'gör vilken karaktär som helst privat med en knapp',
      },
      {
        strong: 'Månatlig Wrapped',
        rest: 'kommer den 1:a i nästa månad',
      },
      {
        strong: 'Event-Wrapped',
        rest: 'kommer när eventet slutar',
      },
    ],
    footnote: 'Varje inställning som nämns här förklaras där den finns i [Inställningar, sida för sida]({settingsGuide}).',
    pages: {
      title: 'Dina sidor',
      intro: 'Fyra sidor, var och en svarar på en annan fråga:',
      rows: [
        {
          term: 'Din profil',
          body: '[/profile](/profile), som bara du ser. Välj en karaktär från knapparna överst för att se dess nivåer, bossar, samlingslogg och event. Kaptener får också en **Captain’s deck** här.',
        },
        {
          term: 'En karaktärs sida',
          body: '`/p/<name>`: en karaktär, läsbar för alla med länken så länge den är delad. Den visar färdigheter, bossar, samlingsloggen och personliga rekord, och lämnar medvetet bort dina klanplaceringar, din eventhistorik och ditt Discord-namn.',
        },
        {
          term: 'Din personsida',
          body: '`/u/…`: alla dina delade karaktärer på en sida, med ditt utställningsskåp och de streamingkonton du valt att visa. Den finns bara om du slår på **Show that my characters are one person**.',
        },
        {
          term: 'En klans medlemssida',
          body: '`/c/<clan>/members/<name>`: samma karaktär så som en klan ser den, nådd från den klanens lista **Members**. En privat klan visar sina medlemmar bara för sina egna.',
        },
      ],
    },
    sharing: {
      title: 'Vem som kan se vad',
      body: [
        'Varje karaktär börjar **shared**: dess sida öppnas för alla med länken, och den kan dyka upp på ledartavlor och för andra klaner. Stäng av en under **Who sees my characters** i Inställningar så svarar dess sida _not found_ för alla utom dig. Du ser **Private — only you can see this page.** med en länk **Share it →**.',
        'En delad sida har **Copy link** under namnet. Inloggade besökare som tycker att en sida är kränkande kan trycka på **Report this profile**.',
        'Per karaktär låter Inställningar dig också dölja vilken klan i spelet den tillhör (**Show my in-game clan**), så den lämnar den karaktärens sida och den klanens Anvil-sida.',
      ],
    },
    wrapped: {
      title: 'Din månatliga och årliga Wrapped',
      body: [
        'Varje månad får varje karaktär ett Wrapped-kort: **XP gained**, **Boss kills**, **New slots** i samlingsloggen, **Efficient** timmar, **PBs**, plus husdjur och den största drop. Det kommer ut den **1:a i nästa månad** (UTC). Tills dess kan bara du öppna det, som en förhandsvisning.',
        'Året får också ett, på `/p/<name>/wrapped/<year>`, från **1 december**. `/p/<name>/wrapped` tar dig alltid till det nyaste som finns.',
        'Tryck på **Copy link to your Wrapped** för att dela det. Klistrat i Discord visas det som en bild av kortet. En privat karaktärs Wrapped öppnas bara för dig, och dess länk förhandsvisas som ett vanligt Anvil-kort.',
      ],
      note: {
        tag: 'En tom månad',
        body: 'Om inget nådde Anvil den månaden (ingen XP, inga dödsantal, loggplatser eller PB), säger kortet det i stället för att visa nollor. Spela med pluginet, eller låt hiscores fånga dig, så fylls nästa månad i.',
      },
    },
    events: {
      title: 'Event-Wrapped',
      body: [
        'När en bräda slutar får varje spelare och varje lag ett kort. Öppna eventets sida **Wrapped**: **Your card** är överst, sedan **Teams** (placering, poäng och spelare) och **Players**. Tryck på **Open and share your card**, och sedan **Copy share link**.',
        'Före slutet ser du **Cards aren’t out yet**. Stabben kan öppna en förhandsvisning i förväg, så att de kan kontrollera korten innan spelarna ser dem.',
        'Kortbilderna visas bara för ett publikt klanevent som inte var endast inbjudan. För alla andra event fungerar länken fortfarande för de som kan se eventet, och förhandsvisas som ett vanligt Anvil-kort.',
      ],
    },
    compare: {
      title: 'Jämför två karaktärer',
      body: [
        'Öppna [Compare](/compare) och skriv två namn. Du får färdigheter, bossar och samlingsloggssidor sida vid sida. Ledaren i varje räkning är i guld. Under det finns en analys, XP per färdighet, varje boss någon av er har dödat, och varje loggsida föremål för föremål: ni har båda, ingen av er, eller bara en av er. **Swap sides** byter plats på dem.',
        'Bara delade karaktärer kan jämföras. En privat, eller ett namn Anvil inte känner till, returneras som _not on Anvil, or not shared_. Du kan alltid jämföra dina egna privata karaktärer medan du är inloggad.',
      ],
    },
  },
  settings: {
    metaTitle: 'Inställningar, sida för sida — Anvil',
    metaDescription: 'Varje sida under Anvil-inställningarna: Discord-inlägg och skärmbildsintegritet, chattflödet i spelet, pluginanslutning och enheter, egna webhooks, vem som ser dina karaktärer, Supporter- och profilutseende, streamingkonton, varje karaktär och ägandeanspråk.',
    eyebrow: 'Anvil · för spelare',
    title: 'Inställningar, sida för sida',
    dek: '[Settings](/settings) är där dina egna val bor: vad du postar, vad du ser i spelet, vem som kan se dina karaktärer. Val som görs här följer med dig till varje dator du spelar på.',
    facts: [
      {
        strong: 'Sökruta',
        rest: 'på första sidan hittar vilken inställning som helst',
      },
      {
        strong: 'En sida per karaktär',
        rest: 'under Characters',
      },
      {
        strong: '10 webhooks',
        rest: 'egna',
      },
    ],
    footnote: 'Dina profilsidor förklaras i [Din profil, Wrapped och Compare]({profileGuide}); pluginets egna inställningar i [RuneLite-pluginets installation]({pluginGuide}).',
    find: {
      title: 'Hitta en inställning',
      body: [
        'Första sidan, **Overview & search**, har en sökruta. Skriv det du vill ha med egna ord, som _private messages_, _rare drop value_, _death message_, _name colour_ eller _plugin token_, så tar den dig till rätt knapp.',
        'Menyn längs sidan har två grupper. **Account** rymmer sidorna nedan. **Characters** har en sida per karaktär du har länkat (din huvudkaraktär är märkt **main**), och sedan **Add character**. En siffra på **Add character** betyder att Anvil har sett dig spela karaktärer du inte har länkat än.',
      ],
    },
    posts: {
      title: 'Discord-inlägg och skärmbilder',
      intro: 'Vad pluginet postar om dig till dina klaners Discord-kanaler, och vad det döljer i skärmbilder. Dessa val läses av nästa pluginuppdatering. Tills du har den avgör samma knappar i pluginets egna inställningar.',
      rows: [
        {
          term: 'Vad ditt plugin postar',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** och **Diary completions** är på från start; **PvP kills** är av från start.',
        },
        {
          term: 'Siffrorna',
          body: '**Min drop value** (1m från start, minst 1m, 0 stänger av den), **Min drop rarity (1 in N)** (1 av 1,000 från start), **Värde och sällsynthet tillsammans** (endera från start, eller kräv båda), **Loot key value** (1m), en **Death message** på upp till 200 tecken där `{name}` blir ditt namn, och den lägsta **Combat task tier** och **Quest tier** som postas (Master från start). Värdet, sällsyntheten och valet mellan endera eller båda följer din klans standard tills du väljer själv; **Återställ till klanens standard** går tillbaka till att följa den.',
        },
        {
          term: 'Vart dina inlägg går',
          body: '**Keep my announcements out of clans I only guest in**, och **Level posts in clan channels**: **Clan rules**, **Only 99s & max** eller **Off**. **Per character** listar varje karaktär med en länk **Clans →** för att stänga av inlägg för en klan.',
        },
        {
          term: 'Skärmbildsintegritet',
          body: 'bocka i den chatt som lämnas bort från varje skärmbild pluginet tar, bevis och Discord-inlägg likaså: **Private messages** (ibockad från start), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** och **Group chat**. Spelmeddelanden och Anvils egna rader finns alltid kvar.',
        },
      ],
      note: {
        tag: 'Brädans brickor påverkas aldrig',
        body: 'Att stänga av ett inlägg stoppar bara Discord-inlägget. Drops, dödsfall och bedrifter räknas fortfarande på vilken bräda du än spelar.',
      },
    },
    chat: {
      title: 'Chattflödet i spelet',
      intro: 'Vad pluginet skriver i din chatbox när plugininställningen **Show feed in game chat** är på.',
      rows: [
        {
          term: 'Varifrån',
          body: '**Boards I play on**, och **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'Vad',
          body: 'drops värda minst ett belopp du väljer, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, och stridsbedrifter, nivåer, quests och dagböcker.',
        },
        {
          term: 'När du loggar in',
          body: '**A short brief in chat**: vad som hände medan du var borta. Champions väljer vad den täcker.',
        },
        {
          term: 'Färger',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)**, eller **My own colours** för Supporters.',
        },
      ],
    },
    login: {
      title: 'Pluginanslutning, inloggning och enheter',
      intro: 'Var pluginet och webbplatsen är inloggade, och hur du loggar ut dem.',
      rows: [
        {
          term: 'Pluginanslutning',
          body: 'din plugintoken, för det sällsynta fallet att du klistrar in den för hand. Normalt gör **Sign in with Discord** i sidopanelen det här åt dig.',
        },
        {
          term: 'Inloggning och enheter',
          body: 'varje dator pluginet är inloggat på, som **RuneLite sign-in 1**, **2**… med när den skapades och senast användes. **Revoke** loggar ut en, till exempel en dator du sålt. **Enter a code** länkar en annan dator. **Sessions** loggar ut dig från webbplatsen överallt.',
        },
        {
          term: 'Klanfakturering',
          body: 'klanägare får **Open portal →** här, för klanens fakturering.',
        },
      ],
    },
    webhooks: {
      title: 'Dina Discord-webhooks',
      body: [
        'Dina inlägg kan också gå till en egen Discord-server: en privat kanal, en vänners server, var som helst du kan skapa en webhook. Klistra in webhook-länken, bocka i vad den tar emot (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), eventuellt ställ in **Only drops worth at least … gp**, och tryck på **Add webhook**.',
        'Du kan ha upp till 10. Bara Discord-webhook-länkar godkänns, och en sparad visas maskerad, så en skärmbild av den här sidan läcker inte den. **Level posts on my webhooks** ställer in dina egna nivåregler för dem, separata från din klans.',
      ],
    },
    privacy: {
      title: 'Vem som ser mina karaktärer',
      intro: 'Dina karaktärer är delade från början. Tre knappar ändrar det:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'en knapp per karaktär. På (från start) är dess sida **Public**. Av är den **Only its clans**: dess klaner ser den fortfarande i sina listor och event, ingen annan gör det, och den lämnar ledartavlorna.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'med två eller fler karaktärer skapar detta din personsida, som listar dina delade karaktärer tillsammans. Av kan ingen se att de alla är du.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'om startsidan listar andra klaners öppna brädor för dig att titta på.',
        },
      ],
    },
    look: {
      title: 'Supporter, profilutseende, streaming och boosts',
      intro: 'Hur du ser ut på Anvil, och kontona och förmånerna bakom det.',
      rows: [
        {
          term: 'Supporter & namnfärger',
          body: 'din nivå, dina förmåner och din inbjudningslänk: ta med vänner och tjäna gratismånader. Nivåerna förklaras i [Anvil Supporter]({supporterGuide}).',
        },
        {
          term: 'Profilutseende',
          body: 'avatar och banner (animerade från Champion), olika för varje karaktär om du vill, och **Display case**: 4, 8 eller 12 märken beroende på nivå.',
        },
        {
          term: 'Streamingkonton',
          body: '**Twitch**, **YouTube**, **Kick** och **Medal**. Varje visar om det är verifierat, med en knapp för att visa det på din profil. Verifierade konton är vad som släpper in dig i följar- och prenumerantevent.',
        },
        {
          term: 'Klanboosts',
          body: 'visas bara när du kan boosta: dina platser, var de är placerade och klanerna du kan boosta. Se [Boosta en klan]({boostsGuide}).',
        },
      ],
    },
    characters: {
      title: 'Varje karaktär',
      intro: 'Under **Characters** har varje karaktär en egen sida: dess typ, om den är verifierad, och länkar till dess publika sida och hela profil.',
      rows: [
        {
          term: 'Synlighet',
          body: '**Show to other clans and on leaderboards**, och **Show my in-game clan**.',
        },
        {
          term: 'Klaner',
          body: 'varje klan och space den är i, som **member** eller **guest**, med **Announce drops & achievements** per klan och **Leave**. Om Anvil har den i fel klan berättar **Which clan is it really in?** för stabben.',
        },
        {
          term: 'Karaktär',
          body: '**Make main**, be om ett namnbyte efter en namnändring, eller **Remove** den från ditt konto. Dess tidigare resultat stannar kvar där de är.',
        },
        {
          term: 'Lägg till karaktär',
          body: 'spela en karaktär en gång med pluginet inloggat så länkar den sig själv. På mobil eller den officiella klienten länkar du den med namn. **We noticed you playing** listar de Anvil har sett; **Not mine** avfärdar en.',
        },
      ],
    },
    claims: {
      title: 'Ägandeanspråk',
      body: [
        'Om en karaktär är länkad till någon annans Anvil-konto men egentligen är din, tryck på **This is my account** i pluginets sidopanel under fliken **You**. Du bevisar att du spelar den med en snabb XP-kontroll, sedan frågas den nuvarande innehavaren. Du får aldrig veta vem de är, och de får aldrig veta vem du är.',
        'Dina anspråk visar **XP check**, **open**, och sedan hur de slutade: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** eller **closed**. **Withdraw** avbryter ett.',
        'När någon gör anspråk på en av dina visas det under **Claims on your characters** med **Approve** eller **Object — it’s mine**. En overifierad karaktär flyttas efter 7 dagar om du inte invänder. En verifierad flyttas bara om du godkänner det.',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill och Boss of the Week — Anvil',
    metaDescription: 'Köra en Skill of the Week, Boss of the Week eller effektivitetslopp på Anvil: schemalägga en, upprepa och rotera den, startlinjer, lägga till och ta bort folk, priser, avsluta i förtid, och vad spelarna ser.',
    eyebrow: 'Anvil · för klanstab och spelare',
    title: 'Skill och Boss of the Week',
    dek: 'En veckotävling är det låginsatta eventet: inga brickor att skriva, inga lag och inga anmälningar. Alla på listan är med när den startar, och vinnaren är den som vinner mest innan den slutar.',
    facts: [
      {
        strong: 'Inga brickor, inga lag',
        rest: 'en ledartavla',
      },
      {
        strong: 'Med vid start',
        rest: 'hela listan, automatiskt',
      },
      {
        strong: 'Upp till 10 prisplatser',
        rest: 'betalda från kassan',
      },
    ],
    footnote: 'Brädor (bingo) finns i [Kör ditt första event]({adminGuide}); priser och kassan i [Klankassan]({cofferGuide}).',
    schedule: {
      title: 'Schemalägg en',
      intro: 'Fem val, och standardvärdena duger för de flesta klaner:',
      steps: [
        'Öppna **Schedule** i admin-menyn och tryck på **+ Schedule event** (moderatorer kan använda **Schedule a competition**).',
        'Välj typen: **Skill of the Week** (vunnen XP), **Boss of the Week** (vunna dödsantal) eller **Efficiency race** (vunna spelade timmar eller bosstimmar).',
        'Under **What is measured**, välj färdighet eller boss. För att byta varje vecka, lägg till fler under **Then rotate through**. Lämna det tomt för att upprepa samma.',
        'Välj när den **Runs**: **This weekend**, **One week**, eller egna datum. Den behöver alltid ett slut, eftersom den poängsätter vinsterna mellan start och slut.',
        'Lämna **Repeat every week** på, så startar nästa i samma ögonblick som den här slutar, med samma längd och priser. Bocka i **Guests race too** om din klans gäster ska vara med på listan.',
      ],
      outro: 'Det finns inget annat att ställa in. Startsiffrorna hämtas från hiscores när den börjar.',
    },
    counting: {
      title: 'Så räknas det',
      body: [
        'Varje spelares vinst är deras stat nu minus deras stat när tävlingen startade (deras **starting line**). Högst vinst vinner; en lika placering listas med namn, och priser kan delas mellan lika placeringar.',
        'Startlinjer tas från hiscores. Därefter håller pluginets livevärden listan aktuell mellan hiscore-kontrollerna, så spelare med pluginet rör sig uppåt på listan när de spelar.',
        'En siffra som går ner ignoreras, och en vinst som ser omöjlig ut **flaggas** för stabben i stället för att räknas eller klippas bort.',
      ],
      note: {
        tag: 'Spelare: logga ut innan den startar',
        body: 'Hiscores sparar dina stats först när du loggar ut. Om du grindar ända fram till starten utan att logga ut, tas din startlinje från före den grinden och grinden räknas som vinst. Stabben fångar det oftast och rättar din startlinje, men logga ut en gång innan den startar.',
      },
    },
    manage: {
      title: 'Att köra den',
      intro: 'Öppna tävlingen från **Schedule** eller instrumentpanelen. Den har en startsida och tre flikar:',
      rows: [
        {
          term: 'Hem',
          body: '**Leaderboard** (topp 25, med hur många som poängsätts), **flaggade** vinster, alla som **left the clan**, och priserna. När den slutar: vinnarna och **Final leaderboard**.',
        },
        {
          term: 'Startlinjer',
          body: 'varje spelares **Started at**, **Now** och **Gained**. Rätta en startlinje för hand när en grind före tävlingen räknades, så följer ledartavlan. **Pull current stats** uppdaterar alla; **Reset baselines** startar alla på nytt från deras hiscores nu och raderar alla vinster.',
        },
        {
          term: 'Deltagare',
          body: 'hela listan är redan med. **Add someone** tar ett namn per rad, för en gäst eller ett konto som ännu inte är på listan. Att ta bort en spelare tar bort deras placering; att lägga tillbaka dem ger dem en ny startlinje. **Leave one each** städar upp en person som är med på flera karaktärer. Du kan också ta bort alla gäster på en gång.',
        },
        {
          term: 'Inställningar',
          body: 'namn, datum, **Repeat every week**, och **Status** (bara för att lossa en som fastnat; den rör sig vidare av sig själv). Admins kan **Delete** den, tillsammans med dess deltagare och placeringar.',
        },
      ],
    },
    prizes: {
      title: 'Priser och slut',
      body: [
        'Sätt priser för upp till 10 platser, betalda från klankassan. Du väljer om en spelare utan vinst kan få betalt och om lika placeringar delar sina priser. Hur pengarna flyttas står i [Klankassan]({cofferGuide}).',
        'Den slutar av sig själv vid den tid du satt. **End now** stoppar den tidigt: vinsterna räknas inte längre direkt, och resultaten postas på Discord med priserna avräknade inom 15 minuter.',
      ],
    },
    players: {
      title: 'För spelare',
      body: [
        'Du anmäler dig inte. Om du står på klanlistan när den startar är du med. Hitta den på din klans sida **Events**, i plugins sidopanel under fliken **Clan** med var du står, och på Discord när den startar och slutar.',
        'Varje tävling har en egen sida med den livliga ledartavlan och hur loppet gick dag för dag. En privat klan visar den bara för sina egna medlemmar.',
        'Att spela med pluginet håller din siffra levande. Utan det räknas du fortfarande, bara i hiscores takt.',
      ],
    },
    teamsLine: "Vill ha lag, eller klaner som tävlar mot varandra, i en skill eller boss? Sätt **Format** när du schemalägger den. Se [Lagtävlingar]({teamCompsGuide}).",
  },
  teamComps: {
    "metaTitle": "Lagtävlingar — Anvil",
    "metaDescription": "Kör en skill- eller boss-tävling för veckan som lag eller klan mot klan på Anvil: dela upp spelare i lag, bjud in andra klaner, hur summor och medelvärden ger poäng, sena deltagare och vad spelarna ser.",
    "eyebrow": "Anvil · för klanledare och spelare",
    "title": "Lagtävlingar",
    "dek": "Varje skill- eller bosstävling har ett Format. Solo är standard och fungerar som tidigare. Välj Teams för att dela upp din klan i sidor, eller Clan vs clan för att tävla mot andra klaner i samma skill eller boss.",
    "facts": [
      {
        "strong": "Tre format",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "Summorna avgör",
        "rest": "med ett medelvärde per spelare"
      },
      {
        "strong": "En värd redigerar",
        "rest": "samarbetande klaner följer med"
      }
    ],
    "footnote": "Grunderna om Skill och Boss of the Week finns i [Skill och Boss of the Week]({weeklyGuide}). Vill du att klaner tävlar på bingobrädor istället? Se [Ta emot en besökande klan]({clanVsClanGuide}).",
    "teams": {
      "title": "Ställ in lag",
      "intro": "Teams delar upp din egen klan i sidor. Det tar cirka en minut:",
      "steps": [
        "Schemalägg en tävling som vanligt. Sätt **Format** till **Teams**.",
        "Skriv in lagnamnen. Alla som anmälts delas jämnt efter nuvarande nivå eller antal kills, så att sidorna börjar rättvist.",
        "Låt **Late joiners go into the smallest team** vara på om folk kan komma efter start. Stäng av för att hålla lagen fasta.",
        "För att ändra något senare, öppna tävlingen och välj **Teams** i dess adminsidofält. Där kan du:"
      ],
      "rows": [
        {
          "term": "Byt namn och färg",
          "body": "ge varje lag ett namn och en färg som spelarna känner igen."
        },
        {
          "term": "Lägg till och ta bort lag",
          "body": "börja med två och lägg till ett tredje, eller ta bort ett du inte behöver längre."
        },
        {
          "term": "Flytta en spelare",
          "body": "skicka någon till ett annat lag. Bra för vänner som vill spela ihop."
        },
        {
          "term": "Auto-balance",
          "body": "tryck på **Auto-balance by current level/KC** för att fördela alla jämnt igen."
        },
        {
          "term": "Late joiners",
          "body": "slå på eller av alternativet för sena deltagare. När det är på går nya spelare med i det minsta laget."
        }
      ],
      "note": {
        "tag": "Inget lag, inga problem",
        "body": "En spelare utan lag räknas fortfarande på den individuella listan. Den bidrar bara inte till någon lagsumma."
      },
      "outro": "En återkommande tävling tar med sina lag till nästa vecka och balanserar dem igen."
    },
    "clans": {
      "title": "Ställ in klan mot klan",
      "intro": "Clan vs clan låter andra klaner gå med i din tävling, hur många som helst. Du är värd, och de andra klanerna är samarbetspartners.",
      "steps": [
        "Som admin eller högre i värdklanen, sätt **Format** till **Clan vs clan**.",
        "Bjud in de andra klanerna med deras adress. Gör det i skapandeformuläret, eller senare på tävlingens **Clans**-sida.",
        "Den inbjudna klanens ägare eller admin accepterar eller avböjer på sin **People**-sida eller i sin **Events**-lista. En moderator kan inte. Ingen från den klanen blir med förrän den accepterat.",
        "När den accepterar väljer den vem som tävlar: **All members** i sin roster, eller **Selected people** som den plockar ut. Den kan ändra detta senare från samma kort.",
      ],
      "body": [
        "Samarbetsklanen kan följa resultatlistan på sin egen sida, på `/c/<slug>/weekly/<id>`. Det är skrivskyddat. Bara värden redigerar tävlingen.",
        "För att ta bort en klan, ta bort den på sidan **Clans**. Dess spelare försvinner från brädet.",
        "En återkommande tävling skickar nya inbjudningar varje vecka, så varje klan måste säga ja igen.",
        "Får du oönskade inbjudningar? Välj **Decline & block this clan** på inbjudan. Den klanens senare inbjudningar avvisas tyst, och du kan avblockera den under **Settings → Blocked clans**.",
      ],
      "note": {
        "tag": "Dela adressen",
        "body": "En klans adress är det korta namnet i dess webbadress. Fråga den andra klanens admin om den innan du bjuder in dem."
      }
    },
    "scoring": {
      "title": "Så poängsätts det",
      "body": [
        "En lag- eller klansumma är summan av medlemmarnas vinster. Vinster räknas på samma sätt som på den individuella listan.",
        "Bredvid varje summa ser du också ett **average per player**, så ett lag på 8 och ett på 12 kan ändå jämföras.",
        "Om två summor är lika rankas den som nådde dit först högre."
      ]
    },
    "players": {
      "title": "Vad spelarna ser",
      "body": [
        "Tävlingssidan visar lag- eller klanresultaten först. Öppna någon av dem för att se dess spelare. Ditt eget lag eller din egen klan är markerad.",
        "Discord-inläggen vid start, halvvägs och slut visar resultatlistan. I klan vs klan går de till varje klans kanal, och din är markerad med **← you**.",
        "I plugin-panelen på sidan kan du se var ditt lag placerar sig.",
        "Det finns inget att anmäla sig till. Om din klan tar med alla medlemmar och du står i rostern, är du med. Om den väljer ut personer är du med när du blivit vald.",
        "Vill du inte vara med? Tryck på **Opt out** bredvid **You’re in**, på tävlingssidan, i listan Events eller i pluginet. Du lämnar brädet för just den tävlingen, och du kan gå med igen medan den pågår.",
      ]
    },
    "faq": {
      "title": "Frågor",
      "intro": "Det klanens stab och spelare frågar oftast om:",
      "rows": [
        { term: "Våra lag är olika stora. Är det orättvist?", body: "Inte i sig. Summorna avgör rankningen, men varje lag visar också ett medelvärde per spelare, så du kan se hur ett mindre lag faktiskt presterar." },
        { term: "Hur är det med personer som går med sent?", body: "Med växlaren för sena deltagare på, går de till det minsta laget. Med den av, räknas de bara på den individuella listan. Du kan alltid flytta dem för hand på sidan **Teams**." },
        { term: "Kan den andra klanen redigera vår tävling?", body: "Nej. Samarbetsklaner ser resultatlistan skrivskyddad. Bara värdklanen kan ändra tävlingen." },
        { term: "Kan jag hoppa över en tävling?", body: "Ja. Tryck på **Opt out** på tävlingssidan, i listan Events eller i pluginet. Bara den tävlingen påverkas, och du kan gå med igen medan den pågår." },
        { term: "Hur många klaner kan tävla?", body: "Så många du bjuder in, upp till 50 i en tävling. Varje klan ser sin egen sida markerad i resultatlistan och i sina Discord-inlägg." },
        { term: "En annan klan bjuder in oss hela tiden. Kan vi stoppa det?", body: "Ja. En ägare eller admin väljer **Decline & block this clan** på inbjudan. Dess senare inbjudningar avvisas utan att de får veta det. Avblockera när som helst under **Settings → Blocked clans**." },
        { term: "Om vi säger ja en gång, är vi anmälda varje vecka?", body: "Nej. En återkommande tävling skickar nya inbjudningar varje vecka, och en ägare eller admin måste acceptera varje en." },
      ]
    }
  },

  clanEvents: {
    metaTitle: 'Klanevent och schemat — Anvil',
    metaDescription: 'Schemalägga klanevent på Anvil: massor, resor och träffar, veckovisa upprepningar, “jag är med” och anmälningar med platser, frågor och avgifter, Discord-inlägg och påminnelser, utbetalningar, enkäter, och schemat som visar luckor.',
    eyebrow: 'Anvil · för klanstab',
    title: 'Klanevent och schemat',
    dek: 'Inte allt är en bräda. Ett klanevent är en massa, en raidkväll, en drop-fest eller en träff: en tid och en plats, postad på Discord och påmind, med så mycket eller så lite anmälan du vill.',
    facts: [
      {
        strong: 'En gång eller varje vecka',
        rest: 'med ett valfritt slutdatum',
      },
      {
        strong: 'Tre sätt att gå med',
        rest: 'info, “jag är med” eller anmälningar',
      },
      {
        strong: 'Påminnelse',
        rest: '15 minuter före, sedan vid start',
      },
    ],
    footnote: 'Veckotävlingar finns i [Skill och Boss of the Week]({weeklyGuide}); avgifter och priser i [Avgifter och utbetalningar]({feesGuide}).',
    create: {
      title: 'Schemalägg ett',
      intro: 'Öppna **Clan events** i admin-menyn och fyll i formuläret:',
      rows: [
        {
          term: 'Namn, tid, längd',
          body: '**Name**, **Starts (your time)** i din egen tidszon, och **Minutes**.',
        },
        {
          term: 'Upprepas',
          body: '**Just once** eller **Every week**, med ett valfritt datum **Until**.',
        },
        {
          term: 'Var',
          body: '**Where**, **World** och **Host**, plus en bild: välj en boss eller färdighet, eller ladda upp din egen.',
        },
        {
          term: 'Detaljer',
          body: 'utrustning, krav, vad man ska ta med.',
        },
        {
          term: 'Vem som kommer',
          body: '**Just information** (ingen knapp, ingen räkning), **“I’m going”** (ett tryck, visar en räkning) eller **Sign-ups** (platser, frågor och en avgift).',
        },
        {
          term: 'Discord',
          body: '**Post to** en kanal (eller klanens standard), valfria kanaler för **Chat**, **Guide** och **Voice** att länka, och om rollen för medlemmar ska pingas vid kungörelsen, påminnelsen och starten.',
        },
      ],
      outro: 'Tryck på **Schedule it**. Utbetalningar och en enkät läggs till från eventets egen sida efteråt.',
    },
    discord: {
      title: 'Vad Discord ser',
      body: [
        'Kungörelsen går upp när du schemalägger den och redigeras på plats när du ändrar något, så det finns aldrig en gammal kopia. Ett upprepat event markeras **every week**.',
        'Femton minuter före postar den **Starting in 15 minutes**, och vid starten **Starting now**. Om du flyttar tiden flyttar sig påminnelserna med den. Att ställa in det (**Cancel**) markerar inlägget **Cancelled**, så ingen dyker upp.',
      ],
    },
    manage: {
      title: 'Anmälningar, avgifter och utbetalningar',
      intro: 'Öppna eventet för att ändra vad det använder. Allt är av från start:',
      rows: [
        {
          term: 'Anmälningar',
          body: 'med **Places** (tomt för ingen gräns), när **Sign-ups close**, och **Sign-up questions**. **You approve each one** gör att varje anmälan väntar på stabben.',
        },
        {
          term: 'Knappen “I’m going”',
          body: 'av gör den till bara information: ingen knapp eller räkning på sajten, i pluginet eller på Discord.',
        },
        {
          term: 'Deltagaravgift',
          body: 'slår på anmälningar. Lägg till gp av egna pengar i potten under **Added to the pot**.',
        },
        {
          term: 'Utbetalningar',
          body: 'potten är avgifterna plus det du lagt till. Ange **Who** som får vad och **For** vad, och markera varje som **Paid**. Anvil varnar dig om du betalar ut mer än potten.',
        },
        {
          term: 'Enkät efteråt',
          body: 'öppnas när den slutar. Bara stabben ser svaren. Om den tog anmälningar tillfrågas bara de som anmält sig.',
        },
        {
          term: 'Ett veckoevent',
          body: '**Every week is…** **Its own** (anmälningar, pott och enkät varje vecka) eller **One run** (en anmälan, pott och enkät för hela serien).',
        },
      ],
    },
    players: {
      title: 'Vad medlemmarna ser',
      body: [
        'Eventsidan visar **When**, **Where**, **Host**, **Discord**, **Entry** och **Prizes**, med **Live now** medan det pågår. Medlemmar trycker på **I’m going** eller **Sign me up**, eller **Ask to sign up** när stabben godkänner var och en. Det finns också i plugins sidopanel under fliken **Clan**, med samma knappar.',
        'Bara klanens medlemmar kan säga att de är med eller anmäla sig.',
      ],
    },
    calendar: {
      title: 'Schemat',
      body: [
        '**Schedule** lägger brädor, veckotävlingar och klanevent i en kalender, med ett filter för varje.',
        'Ett spann på två eller fler dagar utan något markeras som en lucka, med **Fill the gap** för att schemalägga något där. Använd det för att hålla klanen sysselsatt mellan stora event i stället för att låta en lugn fjortondag glida förbi.',
      ],
    },
  },
  challenges: {
    metaTitle: 'Utmaningar och vänevent — Anvil',
    metaDescription: 'Utmaningar mot varandra på Anvil (först till ett drop, flest dödsfall eller mest XP på 1 timme, 24 timmar eller 7 dagar) och Supporter-vänevent: privata brädor för dina vänner bakom en enda inbjudningslänk.',
    eyebrow: 'Anvil · för spelare',
    title: 'Utmaningar och vänevent',
    dek: 'Två sätt att spela mot personer du känner utan ett klanevent: en **utmaning** är en spelare mot en annan, och ett **vänevent** är en privat bräda för en grupp, bakom en inbjudningslänk.',
    facts: [
      {
        strong: '1 timme till 7 dagar',
        rest: 'per utmaning',
      },
      {
        strong: 'Skryträtt',
        rest: 'inga insatser, inga gp',
      },
      {
        strong: 'Upp till 50 vänner',
        rest: 'per vänevent, efter nivå',
      },
    ],
    footnote: 'Nivåer och vad var och en är värd för finns i [Anvil Supporter: nivåer och förmåner]({supporterGuide}).',
    start: {
      title: 'Utmana någon',
      intro: 'Du behöver en verifierad karaktär, och det behöver de också.',
      steps: [
        'Öppna [Challenges](/challenges), eller tryck på **Challenge <name>** på en spelares profil.',
        'Under **Who**, skriv deras namn, och under **Playing as**, välj din egen karaktär. Den måste vara verifierad.',
        'Välj loppet: **First to a drop** (upp till 5 föremål, alla monsterdrops), **Most kills** av en boss, eller **Most XP** i en färdighet eller totalt.',
        'Välj tidsgränsen: **1 hour**, **24 hours** eller **7 days**. Bocka i **OK to show the result publicly** om du inte har något emot att det syns; det är bara offentligt om ni båda bockar i det.',
      ],
      outro: 'De får en notis och ett Discord-meddelande, och har 24 timmar på sig att **Accept**, **Decline** eller **Decline and block**. Klockan startar när de accepterar.',
    },
    rules: {
      title: 'Så avgörs det',
      intro: 'Anvil avgör det själv, inom en minut efter slutet.',
      rows: [
        {
          term: 'Dödsfall och XP',
          body: 'båda startlinjerna tas när den accepteras; den som vinner mest till slutet vinner, och lika vinster är oavgjort. Hiscores och pluginet räknas båda, vilket som är högre.',
        },
        {
          term: 'Först till ett drop',
          body: 'den första av er som får ett av föremålen vinner, på stället. Drops ser bara pluginet, så ni behöver båda ha det igång. Ingen får ett i tid: oavgjort.',
        },
        {
          term: 'Avbryta',
          body: 'du kan dra tillbaka din egen utmaning tills den besvaras. När den väl pågår stannar den bara om ni båda går med på det.',
        },
      ],
    },
    limits: {
      title: 'Gränser och att säga nej',
      body: [
        'Öppna utmaningar (väntande eller pågående, skickade eller mottagna) begränsas av nivå: **1** gratis, **5** för Supporters, obegränsat för Champions och Patrons. Vem som helst kan starta upp till 20 om dagen, och bara en åt gången med samma person.',
        'Vill du inte ha några? **Turn away all new challenges**, eller blockera en person när du tackar nej. Den som utmanar dig ser samma avslag oavsett, så de kan inte se att de blockerats.',
        'Sidan håller **Your record** (vinster, förluster och oavgjorda), vad som är **Open now** och **Your limit**.',
      ],
    },
    friends: {
      title: 'Var värd för ett vänevent',
      body: [
        'Vilken Supporter, Champion eller Patron som helst kan köra en privat bräda för vänner från [Host](/host) → **Host for friends** → **New friends event**. Det är en full bräda: bingo eller ett brickrace, spårad av pluginet, med samma uppsättning som ett skapares event.',
        'Skicka **Invite link**; det är det enda sättet in. Vännerna öppnar den, loggar in med Discord och trycker på **Open the event**. Att gå med är alltid gratis. Om länken läcker, gör en ny: den gamla slutar fungera och alla som redan är med stannar kvar.',
        'Ett vänevent listas aldrig någonstans på Anvil, och kräver ingen klan.',
      ],
      table: {
        areaLabel: 'Nivå',
        columns: [
          'Spelare',
          'Körs samtidigt',
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
        tag: 'Om din nivå upphör',
        body: 'Vänner som redan är med stannar kvar. Nya vänner kan inte gå med över din nya gräns, och du kan inte starta ett till förrän du är under den igen.',
      },
    },
  },
  clanHall: {
    metaTitle: 'Hitta klaner, event och ledartavlor — Anvil',
    metaDescription: 'Hitta en OSRS-klan i Anvils Clan Hall, jämföra två klaner, veckans spelar- och klanledartavlor, den publika eventlistan, och sidor för klaner i spelet som inte finns på Anvil.',
    eyebrow: 'Anvil · för spelare och klaner',
    title: 'Hitta klaner, event och ledartavlor',
    dek: 'Anvils publika sidor för att titta runt: **Clan Hall** för att hitta en klan, **Events**-listan för att hitta något att gå med i, och **Leaderboard** för att se vem som vinner mest.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: 'bara publika klaner',
      },
      {
        strong: 'Ledartavla',
        rest: 'denna vecka, 30 dagar, all tid',
      },
      {
        strong: 'Event',
        rest: 'bara det värden annonserat',
      },
    ],
    footnote: 'För att få din egen klan listad, se [Starta en klan]({clanGuide}); boostade klaner lyfts fram, se [Boosta en klan]({boostsGuide}).',
    hall: {
      title: 'Clan Hall',
      body: [
        '[Clan Hall](/clans) listar varje publik klan. Sök på namn eller slogan, och smalna sedan av till **Taking members** eller **Open to challenges**. **Most active** (ordningen den öppnas i) lägger klaner vars medlemmar vunnit mest denna vecka först; **Biggest** sorterar efter medlemmar.',
        'Varje kort säger om klanen **Recruiting** och hur den tar emot gäster: **Guests welcome**, **Guests by approval** eller **No guests**. Boostade klaner får de utvalda raderna överst, och skapare har en egen rad.',
      ],
      note: {
        tag: 'Inte listad?',
        body: 'Bara klaner som är satta till publika visas, och en klan kan stänga av sin listning i sina inställningar. Privata klaner finns aldrig i Clan Hall, ledartavlan eller jämförelser.',
      },
    },
    compare: {
      title: 'Jämför två klaner',
      body: [
        '[Compare clans](/compare/clans) ställer två valfria listade klaner sida vid sida. För att jämföra två karaktärer i stället, använd [Compare](/compare).',
      ],
    },
    board: {
      title: 'Ledartavlan',
      body: [
        '[Leaderboard](/leaderboard) rankar spelare och klaner efter erfarenhet, effektiva timmar och bossande under **This week**, **30 days** eller **All time**. Spelare kan smalnas av till konton som **Regular**, **Ironman**, **Hardcore**, **Ultimate** eller **Group**.',
        'Klaner rankas efter XP som deras medlemmar vunnit. Bara verifierade klaner som är listade i Clan Hall visas. En gästs vinster räknas för deras egen klan, inte den de är gäst i.',
      ],
    },
    events: {
      title: 'Hitta ett event att gå med i',
      body: [
        '[Events](/events) listar vad som pågår och kommer upp på hela Anvil. Filtrera på **Live now**, **Open to join** eller **Starting this week**, efter format eller **Solo**, efter **Anyone can join** eller **Ask or meet a rule**, och efter **Clans** eller **Creators**. **Join** tar dig till anmälan.',
        'Bara event vars värd slagit på **Advertise on Anvil** visas. Medlemsevent och inbjudningsevent visas aldrig.',
      ],
    },
    ghost: {
      title: 'Klaner i spelet som inte finns på Anvil',
      body: [
        'En karaktärs sida anger klanen i spelet den tillhör. Om den klanen inte finns på Anvil öppnar länken en enkel sida som listar de Anvil-spelare som är med i den och valt att visa det. Det är inte den klanens lista, och inget på den gör någon till medlem.',
        'Om det är din klan sätter **Bring your clan to Anvil** upp en. När den är en publik Anvil-klan går länken direkt dit.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: 'Guider i spelet: läsning, förslag och klankopior — Anvil',
    metaDescription: 'Anvils guidebibliotek: raid-, boss-, skillnings- och pengarguider på sajten, i spelet och på Discord. Läsa efter nivå, föreslå en ny guide eller en ändring, och hur en klan kopierar och redigerar bibliotekets guider.',
    eyebrow: 'Anvil · för spelare och klanstab',
    title: 'Guider i spelet',
    dek: 'Utöver de här hur-gör-man-sidorna har Anvil ett bibliotek med spelguider: raids, bossar, skillning och pengarguider. Vem som helst kan läsa dem, vem som helst som är inloggad kan föreslå en, och en klan kan behålla sina egna kopior.',
    facts: [
      {
        strong: 'Tre nivåer',
        rest: 'Beginner, Intermediate, Advanced',
      },
      {
        strong: 'Vem som helst kan föreslå',
        rest: 'stabben granskar varje en',
      },
      {
        strong: '/guide',
        rest: 'postar en på Discord',
      },
    ],
    footnote: 'Snedstreckskommandon finns i [Snedstreckskommandon]({commandsGuide}).',
    read: {
      title: 'Läsa en guide',
      body: [
        'Öppna fliken **In-game guides** på guidesidan, eller [/guides](/guides) på din klans sajt. En klans lista har sina egna guider plus alla bibliotek-guider den inte kopierat.',
        'Många guider har en nivåknapp överst: **Beginner**, **Intermediate** och **Advanced**. Delarna för andra nivåer viks ihop, så en nybörjare och en speedrunner läser samma sida.',
        'På Discord postar `/guide` och början på ett namn en guides kort med en länk till hela sidan.',
      ],
    },
    propose: {
      title: 'Föreslå en guide eller en ändring',
      body: [
        'När du är inloggad, öppna [Propose a guide](/guides/propose) för att skriva en ny, eller föreslå en ändring av en befintlig bibliotekets guide. Berätta för granskaren vad du ändrat och varför; du kan visa dina ändringar mot den nuvarande guiden innan du skickar.',
        'Tryck på **Send for review**. [My guide proposals](/guides/proposals) visar varje en som **pending**, **approved**, **rejected** eller **withdrawn**, med granskarens notering när den är besvarad. Medan den väntar kan du redigera den eller **Withdraw** den. Du kan ha 5 väntande åt gången.',
        'Inget går live förrän Anvils guideredaktörer godkänner det. En godkänd ändring uppdaterar också varje klankopia som inte har ändrats.',
      ],
    },
    clan: {
      title: 'Din klans guider',
      intro: 'Admins, och moderatorer som får skriva guider, hanterar dem under **Guides** i admin-menyn.',
      rows: [
        {
          term: 'Visa bibliotekets guider på vår sajt',
          body: 'på: bibliotekets guider du inte kopierat visas även på din Guides-sida, alltid aktuella.',
        },
        {
          term: 'Kopiera till våra guider',
          body: 'gör en klankopia. Den **följer biblioteket** tills du redigerar den, och tar emot varje bibliotekets ändring.',
        },
        {
          term: 'Redigera en kopia',
          body: 'gör den **customised**, klanens egen. När bibliotekets guide ändras senare visar den **update available**: ta den nya versionen eller behåll din.',
        },
        {
          term: 'Ny guide',
          body: 'skriver en som bara din klan har, som dina egna raidregler eller en massguide.',
        },
      ],
      note: {
        tag: 'Att posta dem',
        body: 'Guider kan postas i en Discord-kanal, och de inläggen redigeras på plats när guiden ändras.',
      },
    },
  },
};

export default sv;
