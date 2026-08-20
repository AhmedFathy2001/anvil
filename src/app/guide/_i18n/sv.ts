import type { PartialGuideDict } from './en';

// Svenska — Swedish.
//
// Samma konvention som i alla andra språkfiler här: allt läsaren FAKTISKT SER på skärmen står kvar
// på engelska — menyer i RuneLite och OBS, pluginets egna chattrader, och Anvils adminetiketter,
// som är engelska tills den ytan också översätts. En översatt "Tracked drop detected" är en rad
// ingen hittar igen. Allt annat — förklaringen, ordningen, varför — är svenska.

const sv: PartialGuideDict = {
  common: {
    contents: 'Innehåll',
    step: 'Steg',
    optional: 'valfritt',
    minRead: '{n} min läsning',
    language: 'Språk',
    partialNotice:
      'Den här guiden är bara delvis översatt till {language}. Det som ännu inte är översatt visas på engelska.',
    backToGuides: 'Alla guider',
    unreviewedNotice:
      'Den här översättningen till {language} har ännu inte lästs igenom av någon som har språket som modersmål. Om en mening känns fel är [den engelska sidan]({englishHref}) originalet — och [att säga till](/feedback) är det som får den rättad.',
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
    },
    cards: {
      plugin: {
        eyebrow: 'För spelare',
        title: 'Installera RuneLite-pluginet',
        blurb:
          'Installera pluginet, koppla det till den här sajten och låt det skicka in dina drops. Täcker även Discord-notiser och klipp via OBS.',
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
    },
  },

  plugin: {
    metaTitle: 'Installera RuneLite-pluginet — Anvil',
    metaDescription:
      'Installera Anvils RuneLite-plugin, koppla det till den här sajten och sätt upp Discord-notiser och OBS-klipp.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Installationsguide för spelare',
    dek: 'Installera det, peka det mot {clanName} och spela. Pluginet skickar in dina bingo-drops, postar dina sällsynta drops och dödsfall till Discord och — om du kör OBS — sparar och postar klipp av ögonblicken som är värda att se igen.',
    facts: [
      { strong: '2 fält', rest: 'så är spårningen igång' },
      { strong: '~3 min', rest: 'för grundinstallationen' },
      { strong: 'Klipp', rest: 'kräver OBS + 5 minuter till' },
    ],
    footnote:
      'Skärmbilderna kommer från en riktig installation — kontotoken, OBS-adress och Discord-webhook är maskade med flit. Dina bör förbli lika privata.',

    install: {
      title: 'Installera pluginet',
      body: [
        'I RuneLite: **Configuration** (skiftnyckeln) → **Plugin Hub** → sök på **Anvil** → **Install**. Utgivaren är `AhmedFathy2001`.',
        'Ett plugin räcker för alla klaner — du pekar det mot den här sajten i nästa steg, så det finns inget klanspecifikt att ladda ner. När det är installerat, öppna **Configuration → Anvil** för att nå inställningarna som används genom hela den här guiden.',
      ],
    },

    connect: {
      title: 'Koppla till den här sajten',
      intro: 'Bara avsnittet **Setup** spelar roll för att komma igång. Allt annat har vettiga standardvärden.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Setup-avsnittet i Anvil-pluginet, med fälten Site URL och Account Token inramade',
        legend: [
          {
            label: 'Site URL',
            body: 'för {clanName} är det `{origin}`. Fältet är tomt från början, så du måste fylla i det. Inget snedstreck på slutet behövs, och `https://` läggs till om du utelämnar det.',
          },
          {
            label: 'Account Token',
            body: 'din personliga nyckel till den här sajten. Antingen låter du pluginet fylla i den åt dig (nedan), eller så klistrar du in den själv. Behandla den som ett lösenord.',
          },
        ],
      },
      easyHeading: 'Den enkla vägen: logga in från pluginet',
      easyIntro:
        'När Site URL är satt och token fortfarande är tom visar **Anvils sidopanel** en **Sign in with Discord**-knapp. Klicka på den så leder pluginet dig igenom — utan att du kopierar något.',
      easySteps: [
        'Panelen visar en kod och öppnar din webbläsare på den här sajten.',
        'Kontrollera att koden på sidan stämmer med den i RuneLite, klicka sedan **Approve**.',
        'Panelen säger _Signed in_ och fyller i Account Token åt dig.',
      ],
      linkFigure: {
        caption: 'Den här sajten → /link-device',
        alt: 'Sidan Link your RuneLite client, med kodfältet och Approve-knappen inramade',
        legend: [
          { label: 'Koden', body: 'den måste stämma med det pluginet visar för dig just nu.' },
          {
            label: 'Approve',
            body: 'godkänn bara en kod som _din egen_ klient visar. Har någon skickat dig en länk eller en kod, neka den — att godkänna vore att ge bort ditt konto.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Därför dyker en annan domän upp',
        body: [
          'Godkännandet sker här, på `{origin}`. Om du inte redan är inloggad på sajten går själva inloggningssteget via Anvils delade Discord-inloggning på `anvilosrs.com` för att bekräfta vem du är på Discord, och skickar dig sedan direkt tillbaka hit — det är samma inloggning som Login-knappen på den här sajten ger dig, inte en del av pluginets flöde.',
          'Pluginet självt pratar bara med `{origin}`: det vägrar öppna en inloggningssida som inte ligger på den Site URL du skrev in.',
        ],
      },
      directNote: {
        tag: 'Var det här sker',
        body: [
          'Hela flödet stannar på `{origin}` — koden utfärdas här, godkänns här med {clanName}s egen Discord-inloggning, och token lämnas tillbaka här. Pluginet vägrar öppna en inloggningssida som inte ligger på den Site URL du skrev in, så inget i det här steget når en annan Anvil-installation.',
        ],
      },
      federationAside:
        'Ska inte förväxlas med **Connect clans** i sidopanelen — det är den separata, frivilliga knappen som kopplar dig till andra Anvil-klaner, och den dyker upp först när du redan är inloggad här.',
      manualFallback:
        'Om webbläsaren inte öppnas av sig själv skriver panelen ut adressen och koden så att du kan öppna den manuellt. Koder går ut efter tio minuter — tryck bara på knappen igen.',
      manualHeading: 'Den manuella vägen: kopiera din token',
      manualIntro:
        'Logga in med Discord och öppna [Profile](/profile), scrolla sedan till kortet **RuneLite plugin**.',
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
            body: 'kopiera in den i pluginets Account Token-fält. Rotate utfärdar en ny och dödar den gamla — använd den om du någonsin misstänker att din token läckt.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Bra att veta',
        body: ['En token räcker för alla event du är anmäld till här — du klistrar aldrig in den på nytt per bingo.'],
      },
    },

    accounts: {
      title: 'Koppla dina konton — bara spela',
      body: [
        'Det finns ingen kopplingskod att skriva in. När token väl är på plats matchas det konto du loggar in med automatiskt mot din profil.',
        'Pluginet skickar ditt namn i spelet plus ett stabilt kontofingeravtryck med varje anrop, och sajten matchar på fingeravtrycket först — så dina kopplingar överlever ett namnbyte. Logga in på ett altkonto en gång så dyker det upp på din profil under _Accounts we noticed you playing_ med ett **Add** i ett klick.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'Kortet RuneScape Accounts på profilsidan som listar konton verifierade via pluginet',
        legend: [
          {
            label: 'Dina kopplade konton',
            body: 'allt som är märkt “Verified via plugin” hamnade där bara genom att spelas. Lägg till hur många altkonton du vill; ett av dem är ditt huvudkonto.',
          },
        ],
      },
      noPluginHeading: 'Kan du inte köra pluginet?',
      noPluginIntro:
        'På mobil eller i den officiella klienten kopplar du kontot på webbplatsen i stället — profilsidan visar båda alternativen:',
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
        'Du bör också se **Anvils sidopanel** fyllas med ditt event, ditt lag och dina framsteg på rutorna — och en **Bingo**-flik dyka upp i spelets Collection Log.',
      guestNote: {
        tag: 'Gäst kontra medlem',
        body: 'Om chatten säger _Tracked as a guest_ blir du spårad, men du står inte på klanens medlemslista än. Det fixar en admin genom att synka medlemslistan från spelet — fråga {discordLink}.',
        discordWord: 'i Discord',
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
            label: 'Auto Submit Drops',
            body: 'tar en skärmbild och skickar in en spårad drop i samma stund den faller. Låt den vara på; det är hela poängen.',
          },
          {
            label: 'Show Overlay',
            body: 'ritar en liten panel med _Anvil / lag / UTC-datum_ uppe till vänster. Den blir en del av bilden i dina bevisskärmbilder, och det är just det som gör ett bevis svårt att förfalska eller datera bakåt. Den är av på den här bilden — slå på den om din klan vill se lag och tid på varje bevis.',
          },
          {
            label: 'Team completion popups',
            body: 'en banner när någon i ditt lag klarar en ruta. Flera samtidigt: den svåraste får bannern, resten går till chatten.',
          },
          {
            label: 'Bingo tab in Collection Log',
            body: 'lägger din bräda i spelets Collection Log, bredvid dina sparade bevis.',
          },
          {
            label: 'Banner sound + volume',
            body: 'spelar ett ljud tillsammans med bannern. Ingenting spelas förrän du själv lägger till minst en .wav-fil, via knappen “Banner sounds” i den Bingo-fliken.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'bakar in en andra bild i skärmbilden ett par sekunder senare, när lootet har lagt sig på marken. Låt den vara på; den besparar dig diskussioner.',
          },
        ],
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
        'De skickas oavsett om en bingo pågår eller inte, och de postas i klanens kanaler. Vilken kanal bestämmer administratörerna här — du väljer bara _vad_ du postar.',
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
            body: 'två oberoende vägar till ett inlägg: värt minst så här mycket (GE eller high alch, det som är högst), eller ovanligare än 1 på N (1/10 000 som standard — lösare inställningar fyller kanalen med örtrullar). Din klan kan sätta en sällsynthetsgräns som gäller alla; din egen gäller ändå när den är strängare. Sätt någon av dem till 0 för att stänga av den vägen.',
          },
          { label: 'Screenshot rare drops', body: 'bifoga bilden, inte bara texten.' },
          {
            label: 'Loot key value',
            body: 'en loot key postas en gång, som en enda notis, när hela innehållet passerar det här talet.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pets postas i kanalen för sällsynta drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Notisavsnittet Combat achievements med varje inställning inramad och numrerad',
        legend: [
          { label: 'Notify on combat achievements', body: 'avklarade nivåer postas alltid när den här är på.' },
          {
            label: 'CA task min tier',
            body: 'hur högljudda enskilda uppgifter är. Elite här; standard är Master. Sätt den till Grandmaster för bara de allra ovanligaste.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99:or, varje 100 totalnivåer från 1800 och uppåt, samt max.',
          },
          { label: 'Notify on diary completions', body: 'nivåer i achievement diary.' },
          {
            label: 'Announce quest completions',
            body: 'från den svårighetsgrad du väljer och uppåt. “All quests” här; standard är Master och uppåt.',
          },
        ],
      },
    },

    clips: {
      title: 'Klipp med OBS',
      intro: [
        'Tryck på en tangent så sparas de senaste 30 sekunderna och läggs i klanens klippkanal. Det är av som standard och kräver att OBS körs — men det är det närmaste en höjdpunktsfilm din klan kommer.',
        'Så fungerar det: OBS håller en rullande **replay buffer** med de senaste X sekunderna. Din snabbtangent ber OBS skriva bufferten till en fil, och pluginet plockar upp filen och laddar upp den till en Discord-webhook du klistrat in.',
      ],
      privacyNote: {
        tag: 'Vart din video tar vägen',
        body: 'Klipp laddas upp **direkt från din dator till Discord**. De passerar aldrig den här sajten, och ingenting laddas upp alls om du lämnar webhook-fältet tomt — då stannar klippen på din maskin.',
      },
      obsHeading: 'A. Ställ in OBS (en gång)',
      obsSteps: [
        'Du behöver **OBS Studio 28 eller nyare** — WebSocket-servern är inbyggd från 28 och framåt, ingen extra nedladdning.',
        'Se till att OBS faktiskt fångar spelet: en Game / Window / Display Capture-källa som visar RuneLite. Ser inte OBS din klient blir dina klipp en svart rektangel.',
        '**Settings → Output** → kryssa i **Enable Replay Buffer**. (I Simple output-läge ligger den på Recording-sidan; i Advanced har den en egen flik.) Kolla samtidigt att inspelningssökvägen har ledigt utrymme.',
        '**Tools → WebSocket Server Settings** → kryssa i **Enable WebSocket server**. Notera **Server Port** (4455 som standard) och klicka **Show Connect Info** för lösenordet.',
      ],
      obsAside:
        'Du behöver _inte_ trycka på “Start Replay Buffer” — pluginet startar den åt dig när det ansluter, och startar om den varje gång du ändrar kliplängden.',
      fillHeading: 'B. Fyll i pluginet',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Clips-avsnittet i pluginets inställningar med varje inställning inramad och numrerad; OBS-värden och webhook-URL:en är dolda',
        legend: [
          { label: 'Enable clip capture', body: 'huvudströmbrytaren. Är den av pratar pluginet aldrig med OBS över huvud taget.' },
          {
            label: 'Capture clip hotkey',
            body: 'ställ in den, annars händer aldrig något. Välj något du inte råkar trycka mitt i ett raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` när OBS körs på samma dator som RuneLite. Kör OBS på en annan maskin, skriv in den maskinens lokala IP här — dold på den här bilden — och öppna porten i dess brandvägg. Port och lösenord kommer från _Show Connect Info_; lämna lösenordet tomt om du stängt av OBS-autentisering.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'allt större sparas lokalt och nämns diskret i chatten i stället för att postas. Ställ in den efter vad din Discord-server faktiskt accepterar; pluginet levereras med 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'hur långt tillbaka varje klipp når. Detta skriver in buffertlängden i din OBS-profil, så OBS behöver så många sekunders upptakt innan ett klipp i full längd ens finns. Längre klipp = större filer; 30 är en bra mittpunkt.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 förhandsvisas och spelas direkt i Discord; MKV måste laddas ner först. Observera att detta ändrar OBS inspelningsformat, vilket även påverkar dina vanliga inspelningar. Stäng av den för att lämna OBS i fred.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'dit klippen postas — be en admin om webhooken till klippkanalen. Tomt = klippen stannar på din dator. Dold här, och värd att dölja: alla med den här URL:en kan posta i den kanalen.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'hanterar även sparningar som utlösts av OBS självt eller av pluginet “Save Replay Buffer for OBS”. Låt den vara av om du kör två RuneLite-klienter mot en OBS, annars postas varje klipp två gånger.',
          },
        ],
      },
      useHeading: 'C. Använd det',
      useIntro: 'Något roligt händer → tryck på din snabbtangent → chatten leder dig igenom:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Kom ihåg',
        body: 'Klippet täcker sekunderna _före_ att du tryckte — så tryck efter ögonblicket, inte under. Du har hela buffertens längd på dig att reagera.',
      },
      decodedHeading: 'Klippmeddelanden, förklarade',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS körs inte, WebSocket-servern är av, eller värd/port/lösenord stämmer inte. Fixa det och tryck igen — pluginet försöker ansluta på nytt av sig självt var 30:e sekund.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Bufferten körs inte. Kontrollera Enable Replay Buffer i OBS utgångsinställningar, slå sedan av och på Enable clip capture.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Fungerar som det ska, du har bara ingen webhook inställd. Filen ligger i din OBS-inspelningsmapp.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Korta kliplängden, sänk kvaliteten på din OBS-inspelning, eller höj maxstorleken om din server tar emot större filer.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'För stor, rate-limitad, eller så tog uppladdningen slut på tid. Filen ligger kvar på din dator — posta den för hand om den är värd det.',
        },
      ],
    },

    trouble: {
      title: 'När något går sönder',
      intro:
        'Pluginet säger till i chatten när spårningen har slutat — det väntar omkring 90 sekunder innan det klagar och upprepar sig som mest var 5:e minut.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token är fel eller har roterats. Kopiera den på nytt från [Profile → RuneLite plugin](/profile#plugin-token), eller töm fältet och logga in från pluginet igen.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Kontrollera Site URL efter stavfel — den ska vara `{origin}`. Stämmer den är sajten troligen nere.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Det kontot är inte kopplat än. Lägg till det från Profile → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ingenting. Det löste sig av sig självt.',
        },
      ],
      logHeading: 'Fortfarande fast? Skicka en admin en logg',
      logBody:
        'Skriv `::anvillog` i spelets chatt (eller ställ in **Export debug log hotkey** i pluginets Support-avsnitt). Den skriver en loggfil till din `.runelite/anvil-debug`-mapp, öppnar mappen och kopierar sökvägen till urklipp — skicka den filen till en admin så ser de exakt vad som gick fel.',
      missingNote: {
        tag: 'Saknas bevis?',
        body: 'Pets och dubbletter av Champion’s scrolls kräver en manuell skärmbild. De sparas i `.runelite/osrs-bingo-pending/` och dyker upp som en **Saved proofs**-rad i Bingo-fliken i Collection Log.',
      },
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
      { strong: '4 steg', rest: 'i installationsguiden' },
      { strong: '7 format', rest: 'att bygga en bräda av' },
      { strong: '1 knapp', rest: 'för att synka medlemslistan' },
    ],
    footnote:
      'Den här guiden följer appen som den ser ut i dag. Stämmer inte en skärm här med det du tittar på är appen rätt och guiden gammal — [säg till](/feedback) så fixar vi den.',

    access: {
      title: 'Vem får göra vad',
      intro:
        'Alla loggar in med Discord — inga lösenord. Den första administratören kommer från serverkonfigurationen; därefter befordrar en admin folk från **Clan → Members & staff**. Rollerna staplas nedåt: allt en moderator kan, kan en kassör och en admin också.',
      rows: [
        {
          term: 'Admin',
          body: 'full åtkomst — event, rutor, lag, inställningar, stab, utbetalningar. Ge den till så få som klanen står ut med.',
        },
        { term: 'Treasurer', body: 'allt en moderator kan, plus anmälningsavgifter och utbetalningar.' },
        {
          term: 'Moderator',
          body: 'det dagliga: medlemslista, verifieringar, veckotävlingar, schema, feedback. Kan inte skapa eller redigera event.',
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
        '**System → Setup** är en guide i fyra steg, och instrumentpanelen håller kvar samma fyra som en checklista tills de är klara: namnge klanen, koppla Discord, skapa ett event, lägg till rutor. Statusen räknas ut från riktiga data, så ett steg bockas av först när det verkligen är färdigt.',
      discord:
        'För Discord har du två vägar, och de går att kombinera: ge Anvil en **bot** så kan den skapa webhooks, synka roller och smeknamn och bygga privata lagkanaler; ge den en enda **webhook-URL** så kan den posta meddelanden och inget annat. Börja med webhooken om du vill vara igång på två minuter, och lägg till boten när du vill ha automatiken.',
      permsNote: {
        tag: 'Botens behörigheter',
        body: 'Boten behöver _Manage Webhooks_, _Manage Roles_, _Manage Channels_ och _Manage Nicknames_, och dess roll måste ligga _ovanför_ de roller den hanterar i serverns rollista. Annars vägrar Discord tyst.',
      },
      hosted:
        'På ett hostat abonnemang mötte du den skärmen en gång redan: att lägga till boten under installationen var hur Anvil fick veta vilken server som är er, så det fanns aldrig något server-ID att kopiera. Samma länk finns här när du vill flytta boten till en annan server.',
    },

    channels: {
      title: 'Sprid inläggen över flera kanaler',
      body: [
        'Allt postas som standard i en enda huvudkanal för meddelanden. När den blir stökig, öppna **System → Advanced settings → Webhooks** och ge de högljudda kategorierna egna hem — bingoevent, veckotävlingar, sällsynta drops, dödsfall, PvP-kills, combat achievements, klipp. Allt du lämnar tomt faller tillbaka till huvudkanalen, så du kan flytta en kategori i taget.',
        'Med boten ansluten rör du aldrig en webhook-URL: välj en kanal i listan och tryck **Create webhook**. Under ett hektiskt event kan du lägga till en andra webhook till samma kanal — Anvil växlar mellan dem så att Discords hastighetsgräns inte sväljer inlägg.',
      ],
      clipsNote: {
        tag: 'Klippkanalen är annorlunda',
        body: 'Klippvideor laddas upp direkt från varje spelares dator till Discord — de passerar aldrig den här sajten. Därför är klipp-webhooken du ställer in här den du _delar ut_: medlemmarna klistrar in den själva i sitt plugin. Allt annat på den här sidan sker på servern och medlemmarna ser det aldrig.',
      },
    },

    roster: {
      title: 'Få in din medlemslista',
      body: [
        'Klanmedlemskap kommer från ett enda ställe: en synkning av medlemslistan från spelet. Installera [Anvils RuneLite-plugin]({pluginGuide}) på en _admins_ konto, öppna **Bingo**-fliken i spelets Collection Log och tryck **Sync clan roster**. Det skickar upp er faktiska klanlista från spelet till sajten med ett klick.',
        'Alla som kopplar eller verifierar ett konto på webbplatsen utan att stå på den listan är en **gäst** — spårad och synlig, men inte medlem förrän en admin befordrar dem eller nästa synkning plockar upp dem. Det är avsiktligt: det betyder att ingen kan befordra sig själv in i er klan genom att skriva ett namn.',
        'Du kan också lägga till någon för hand från **Clan → Members & staff**, inklusive att anmäla dem till ett event å deras vägnar när de inte når sajten.',
      ],
    },

    board: {
      title: 'Skapa din första bräda',
      intro:
        '**Events → All events → New event**. Välj format först — det avgör hur brädan poängsätts och vad resten av formuläret frågar dig om.',
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
          blurb: 'En ordnad bana — lagen når rutorna i följd; den som kommer längst vinner.',
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
        'Eventets **Tiles**-flik är där en bräda blir en bingo. Varje ruta är en _sorts_ uppgift, och sorten avgör vad pluginet håller utkik efter: en drop, ett boss-killcount, färdighets-XP, ett NPC-kill, en klarning på tid, en achievement diary, en Combat Achievement, en upplåsning i collection log, ett PvP-kill, en föremålsvinst, eller en dödsfri runda. Manuella rutor — de som en människa godkänner från en skärmbild — finns alltid som alternativ också.',
        'För en full bräda, redigera i klump: exportera arket, fyll i det i ett kalkylprogram och importera tillbaka. Både CSV och .xlsx går fram och tillbaka, och rader följer positioner, så du kan skriva om ett helt 25-rutors nät med en enda inklistring.',
      ],
      rows: [
        {
          term: 'Svårighetsgrader',
          body: 'poängvärden översätts till namngivna band (easy → elite). Redigera banden under Advanced settings om din klan graderar annorlunda.',
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
        'Fliken **Teams & Draft** anpassar sig efter formatet du valde: ett format som inte använder lag hoppar rakt förbi den. För en vanlig lagbingo skapar du lagen, bestämmer vilka som är kaptener, och antingen fördelar spelarna själv eller kör en livedraft.',
        'Kaptenerna draftar ur anmälningspoolen i den ordning du väljer, och varje kapten ser svaren folk gav i anmälningsformuläret — frysta som de skickades in, så att ingen redigerar sina “timmar per vecka” efter att ha blivit vald.',
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
          body: 'System → Announce postar ett meddelande i era kanaler mitt under eventet utan att du skriver en webhook för hand.',
        },
      ],
      missionNote: {
        tag: 'Överraskningar under eventet',
        body: 'Du kan släppa ett **uppdrag** på en pågående bingo — en dold bonusruta som annonseras när du avfyrar den, och som valfritt sjunker i värde eller går ut. Det är det billigaste sättet att väcka en bräda på dag fem.',
      },
      startProofNote: {
        tag: 'Att stoppa hamstring före eventet',
        body: [
          'Slå på **Starting shot** (eventet → Overview) så måste varje spelare lämna in en skärmbild tagen efter att eventet gått igång, på en plats Anvil lottar i startögonblicket — så att ingen sitter på en vecka av sparade clues och kistor vid noll. Platsen annonseras vid starten; varje spelares lösenord är personligt, härlett ur dragningen, och existerar inte förrän eventet startar, så det kan inte iscensättas i förväg av någon.',
          'Nåla platserna på världskartan (poolredigeraren har en) så kontrollerar pluginet att spelarna faktiskt står där i stället för att bara ha blivit tillsagda. Du kan också kräva en **färsk session** — 15 minuter som standard: hiscores sparas bara när en spelare loggar ut, så att få alla att logga om precis före sin bild är det som gör startsiffrorna bakom varje XP- och KC-ruta ärliga.',
          'Pluginanvändare trycker på en knapp. Alla andra skriver sitt lösenord i spelet och laddar upp på My Team. Du väljer vad som händer med en kreditering från någon som inte lämnat in: flagga den för granskning (standard) eller neka den tills de gör det. Samma Overview-panel är granskningslistan — pluginbilder med verifierat lösenord kommer in redan godkända, så i praktiken tittar du bara på mobilspelarna.',
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
          body: 'eventets Payouts-flik gör prispotten till en lista över vem som får vad, som bockas av medan du betalar ut.',
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
          body: 'behåll brädan du just byggt. Nästa bingo börjar från den i stället för ett tomt rutnät.',
        },
      ],
      federation:
        'Med federation påslaget kan medlemmarna också koppla upp sig mot andra Anvil-klaner från pluginet — praktiskt för event över klangränser, och helt frivilligt per medlem.',
      outro: 'Peka sedan dina medlemmar mot [installationsguiden för spelare]({pluginGuide}) och börja planera nästa.',
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
        'Öppna ditt event och gå till fliken **Teams & Draft**. Skapa ett lag per klan du bjudit in och döp det efter dem — namnet är det deras spelare ser i anmälningsformuläret, så “Ironforge” slår “Lag 2”.',
        'Du behöver _inte_ köra en draft. Inbjudningslänkar och en draft är alternativ: en draft fördelar en gemensam anmälningspool, en länk placerar folk direkt. I ett rent klan-mot-klan skapar de flesta värdar lagen, delar ut en länk var, och öppnar aldrig draften.',
        'Öppna sedan laget självt — **Teams & Draft → laget** — för det är där båda de två nästa stegen sker.',
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
        caption: 'Eventet → Teams & Draft → laget → Team staff',
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
        caption: 'Eventet → Teams & Draft → laget → Invite links',
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
        kill: { label: 'Killcount', blurb: 'N kills av en NPC — även sådana som aldrig stått på hiscores (höns, kor). Upptäckt av pluginet.' },
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
          term: 'Ett boss-KC-mål',
          body: 'är **inte** en kill-ruta. Kill-rutor bevakar NPC-dödsfall via pluginet; ett KC-mål är ett hiscores-tal och behöver `trackedStat` + `statType=boss` + `statGoal`. Använd en kill-ruta för sådant Hiscores aldrig räknat — kor, höns, en specifik slayer-mob.',
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
        '**Download spreadsheet** i eventets **Tiles**-flik. Du får en .xlsx av brädan som den ser ut nu, med rullgardiner, föremålslistan och kolumnanvisningarna på egna blad.',
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
        'På en poängsatt bräda bär varje ruta sitt eget värde, och de värdena översätts till namngivna svårighetsband — easy till elite — som du kan redigera under **Advanced settings** om din klan graderar annorlunda. Bandet är vad spelarna läser; siffran är vad som räknas.',
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
      'Formatet bestäms vid skapandet men går att ändra efteråt från eventets Overview-flik; avslöjandepolicyn och poängmodifierarna kan ändras när som helst innan rutorna de påverkar avslöjas.',

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
      'Avgifter och utbetalningar är kassörens yta. En kassör kan allt en moderator kan, plus det här; en moderator kan markera en avgift som insamlad men aldrig avsluta en.',

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
        'Hur många signaturer en avgift kräver är en klaninställning, från noll till fem. Noll finns av ett riktigt skäl: i en klan där kassören _är_ ägaren finns det ingen annan att skriva under, och “34 avgifter väntar på en andra signatur” blir en kö som aldrig går att tömma och permanent det högsta på instrumentpanelen. Vid noll **är** det att markera en avgift betald själva underskriften.',
        'Sätt den till ett — standard — om ni är två. Sätt den till noll om ni ärligt talat inte är det, och sätt den högre bara om din klan har både folket och skälet.',
      ],
    },

    pay: {
      title: 'Att betala ut',
      body: [
        'När eventet är slut gör eventets **Payouts**-flik potten till en lista över människor. Generera den så får du en rad per mottagare, inte per lag: ett vinnande lags pris delas jämnt mellan medlemmarna, så att utbetalningen blir en lista med namn och tal snarare än ett räkneproblem vid midnatt.',
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
        'medlemslistan: att synka den, lägga till folk, befordra en gäst',
        'kontoverifieringar — XP-utmaningen och manuell granskning',
        'inskickade bevis och skärmbilder',
        'veckotävlingar och schemat',
        'feedback från medlemmarna',
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
          body: 'det vanliga fallet, och det kräver ingenting av dig. Att spela kontot med pluginet anslutet kopplar det automatiskt, och ett stabilt kontofingeravtryck gör att kopplingen överlever ett namnbyte.',
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
        body: 'Att verifiera ett konto säger “det här är verkligen deras”. Det gör dem inte till en del av klanen — klanmedlemskap kommer bara från en synkning av medlemslistan i spelet eller från en admin som lägger till dem för hand. Någon som är verifierad men inte på listan är en **gäst**: spårad, synlig, och inte medlem. Det är avsiktligt, och det är det som hindrar någon från att gå med i din klan genom att skriva ett namn.',
      },
    },

    roster: {
      title: 'Att hålla medlemslistan ärlig',
      body: [
        'Medlemslistan kommer från ett enda ställe: en admin kör en synkning från klanlistan i spelet, via pluginets Bingo-flik i Collection Log. Allt annat — verifieringar, kopplingar, anmälningar — hänger på den.',
        'Underhållsjobbet är alltså litet men verkligt: kör synkningen efter varje rekryteringsomgång, befordra de gäster som faktiskt gått med, och titta på de personer sajten flaggat som något att granska i stället för att vänta på att de klagar.',
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
};

export default sv;
