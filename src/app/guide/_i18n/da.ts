import type { PartialGuideDict } from './en';

// Dansk.
//
// To ting bliver med vilje stående på engelsk, og skal blive ved med det:
//
//   1. Alt spillet og pluginnet selv skriver — chatlinjer, fejlbeskeder, knapper og menupunkter i
//      RuneLite og OBS. En dansk oversættelse af "Tracked drop detected" ville ikke kunne findes
//      igen af den, der leder efter linjen på sin skærm.
//   2. Navnene på felterne i Anvils egen adminflade, indtil den flade også bliver oversat. Så længe
//      knappen hedder "Make a link", skal vejledningen sige "Make a link".
//
// Discords egne menuer, indstillinger og rettighedsnavne følger derimod Discords officielle danske
// oversættelse — det, læserens Discord-app viser på dansk (og de ville blive på engelsk, hvis
// Discord ikke var oversat til sproget).
//
// Alt andet — forklaringen, rækkefølgen, hvorfor man gør det — er dansk.

const da: PartialGuideDict = {
  common: {
    contents: 'Indhold',
    step: 'Trin',
    optional: 'valgfrit',
    minRead: '{n} min læsning',
    copyLink: 'Kopiér et link til dette afsnit',
    linkCopied: 'Link kopieret',
    language: 'Sprog',
    partialNotice:
      'Denne vejledning er kun delvist oversat til {language}. Det, der endnu ikke er oversat, vises på engelsk.',
    backToGuides: 'Alle vejledninger',
    unreviewedNotice:
      'Denne oversættelse til {language} er endnu ikke læst igennem af en, der har sproget som modersmål. Læser en sætning forkert, er [den engelske side]({englishHref}) originalen — og [at sige til](/feedback) er dét, der får den rettet.',
    support: {
      lead: 'Sidder du fast, eller ser noget forkert ud?',
      link: 'Spørg i Anvils support-Discord',
    },
    legalPaid: 'Spørgsmål om penge: [Refusioner](/legal/refunds) og [Vilkår](/legal/terms).',
    legalPrivacy: 'Sådan håndterer vi dine data: [Privatlivspolitik](/legal/privacy).',
    aboutLine: 'Hvem står bag Anvil? Læs [Om](/about).',
  },

  index: {
    metaTitle: 'Vejledninger — Anvil',
    metaDescription:
      'Kom i gang med Anvil: RuneLite-pluginnet til spillere, afvikling af et event for klanens stab, og hvordan man er vært for en gæsteklan.',
    title: 'Vejledninger',
    dek: 'Alt hvad du skal bruge for at komme i gang, skrevet til præcis den version af Anvil, der kører her.',
    groups: {
      playing: 'At spille',
      running: 'At køre et event',
      clan: 'At køre klanen',
      streamers: 'Streamers',
    },
    anvilTab: 'Brug af Anvil',
    ingame: {
      title: 'Guides til spillet',
      dek: 'Raids, bosser, skilling og pengetjening fra Anvil-biblioteket — de samme guides, som pluginet viser i spillet, og som botten slår op i Discord.',
      browse: 'Se alle guides',
      language: 'Disse guides er ikke oversat: de vises, som de er skrevet, uanset sproget på denne side.',
      empty: 'Anvil-biblioteket har ingen udgivne guides endnu. Kig forbi igen snart.',
      placeholder: 'Søg i guides til spillet — prøv "zulrah", "raids" eller "money"',
      readTime: '{n} min. læsning',
      metaTitle: 'OSRS-guides til spillet — Anvil',
      metaDescription: 'Guides til raids, bossing, skilling og pengetjening fra Anvil-biblioteket — til at læse på siden, i spillet via RuneLite-pluginet og i Discord.',
    },
    search: {
      placeholder: 'Søg i vejledningerne — prøv "webhook", "felter" eller "drops vises ikke"',
      results: '{n} vejledninger',
      empty: 'Ingenting passede. Prøv et jævnere ord — "felter", "udbetaling", "bot" — eller bladr i listen nedenfor.',
      clear: 'Ryd søgningen',
    },
    cards: {
      tiles: {
        eyebrow: 'Til spillere',
        title: 'Feltregler og begrænsninger',
        blurb: 'Hvad et felt kræver af dig, før du går i gang (en spilindstilling, pluginnet, en synkroniseret log, en hiscores-placering), og hvad det ikke kan spore.',
        minutes: '~4 min',
      },
      discord: {
        eyebrow: 'Til den der styrer serveren',
        title: 'Anvil i Discord',
        blurb: 'Én invitation, så kanalerne hver feed skriver i, roller, slash-kommandoer, og hvad du tjekker når det stopper.',
        minutes: '~5 min',
      },
      switching: {
        eyebrow: 'Skift til Anvil',
        title: 'Skift fra andre plugins og trackere',
        blurb:
          'Anvil poster dine drops på Discord og kører jeres ugentlige konkurrencer. Fem trin for staben, to for spillerne.',
        minutes: '~3 min',
      },
      clan: {
        eyebrow: 'Til dig der starter en',
        title: 'Start en klan',
        blurb: 'To navne og en adresse, så er den live. Derefter Discord, din medlemsliste og det første bræt.',
        minutes: '~4 min, gratis',
      },
      plugin: {
        eyebrow: 'Til spillere',
        title: 'Opsætning af RuneLite-pluginnet',
        blurb:
          'Installér pluginnet, log ind fra dets sidepanel, og lad det indsende dine drops. Dækker også Discord-beskeder og opslag af spillere.',
        minutes: '~3 min opsætning',
      },
      admin: {
        eyebrow: 'Til klanens stab',
        title: 'Sådan afvikler du dit første event',
        blurb:
          'Discord, medlemsliste, brætter, felter, hold og draft, opstart — og hvad du gør, når eventet er slut.',
        minutes: 'en aften, én gang',
      },
      board: {
        eyebrow: 'Til brætbyggere',
        title: 'Byg et bræt, der tracker sig selv',
        blurb:
          'Hvad hver felttype rent faktisk kan se, masseoprettelse via regneark, og de fejl der importerer pænt og så aldrig udløses.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Til kaptajner',
        title: 'Kaptajnguide',
        blurb:
          'At læse puljen før uret starter, selve draftdagen, og de dele af at styre et hold, der først begynder bagefter.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Til klanens stab',
        title: 'Formater, og hvordan felter åbner',
        blurb:
          'Syv brætformer, fem måder felter bliver spilbare på, og de tre modifikatorer der afgør, hvad en gennemførelse er værd.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Til kasserere',
        title: 'Gebyrer og udbetalinger',
        blurb:
          'At tage et tilmeldingsgebyr, samle det ind, den anden underskrift der afslutter det, og at lave en pulje om til betalte placeringer.',
        minutes: '~5 min',
      },
      coffer: {
        eyebrow: 'Til kasserere',
        title: 'Klankassen',
        blurb:
          'Én kasse til klanens gp: hvad der kommer ind, de tre måder den betaler præmier ud på, og hvem der må røre den.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Til moderatorer',
        title: 'På vagt',
        blurb:
          'Køen, godkendelse af indsendelser og konti, at holde medlemslisten ærlig, og de skøn der ender hos et menneske.',
        minutes: '~5 min',
      },
      clanVsClan: {
        eyebrow: 'Til værter',
        title: 'Vær vært for en gæsteklan',
        blurb:
          'Clan-mod-clan uden at samle et eneste RSN ind i hånden: ét invitationslink pr. hold, og en plads der lader deres egen moderator styre deres halvdel.',
        minutes: '~5 min pr. hold',
      },
      commands: {
        eyebrow: 'Til alle medlemmer',
        title: 'Slash-kommandoer',
        blurb:
          'Hver kommando botten svarer på i Discord, hvad hver valgmulighed gør, gennemgåede eksempler, og hvad du tjekker, når en ikke dukker op.',
        minutes: '~6 min',
      },
      creators: {
        eyebrow: 'Til streamere',
        title: 'Hold events for dine seere',
        blurb:
          'Ingen klan nødvendig. Lav et rum, del ét link, vælg hvem der må være med (følgere, subs, Discord-roller) og vis brættet på stream.',
        minutes: '~6 min',
      },
      joiningStream: {
        eyebrow: 'Til seere',
        title: 'Sådan er du med i en streamers event',
        blurb:
          'Fik du et link fra en stream? Log ind, tilføj din karakter, tryk Join. Hvad du gør ved events kun for følgere eller subs.',
        minutes: '~2 min',
      },
      streamingClans: {
        eyebrow: 'Til klaner, der streamer',
        title: 'Streaming for klaner',
        blurb:
          'Lad dine seere spille ét event uden at være med i klanen. Slå Streaming til, og åbn så et event for seere.',
        minutes: '~2 min',
      },
      people: {
        eyebrow: 'Til klanens stab',
        title: 'Dine folk: medlemsliste, gæster og hvem der kan komme ind',
        blurb:
          'Hvor medlemmerne kommer fra, hvad filtrene på Roster-fanen betyder, anmodninger om at komme ind og Needs review, de tre indstillinger under Who can join, og hvordan du fjerner eller bandlyser nogen.',
        minutes: '~6 min',
      },
      staffRoles: {
        eyebrow: 'Til ejere og admins',
        title: 'Stabsroller: hvem kan hvad',
        blurb:
          'Ejer, admin, kasserer og moderator: hvad hver rolle når, hvordan du gør nogen til moderator, hvem der kan give hvilken rolle, og opgaver, der kun gælder ét event.',
        minutes: '~6 min',
      },
      supporter: {
        eyebrow: 'Til spillere',
        title: 'Anvil Supporter: niveauer og fordele',
        blurb:
          'Supporter, Champion og Patron: navnefarver, stjernen, profilbilleder, vitrinen, vennevents og klan-boosts, hvordan betalingen fungerer, og hvad der sker, hvis du stopper.',
        minutes: '~6 min',
      },
      sidePanel: {
        eyebrow: 'Til spillere',
        title: 'Sidepanelet, fane for fane',
        blurb:
          'Clan, Feed, You, Lookup og tandhjulet: hvad hver fane viser, eventchat, GZ- og Sad-reaktioner, og de indstillinger, der bringer feedet og Supporter-farverne ind i dit spil.',
        minutes: '~6 min',
      },
      clanBoosts: {
        eyebrow: 'Til Supporters og klanens stab',
        title: 'At booste en klan',
        blurb:
          'At placere og flytte et boost, de tre niveauer og hvad hvert af dem låser op for, klanens navnefarver, boosts i gave, og booster-mærker og badges.',
        minutes: '~5 min',
      },
      profile: {
        eyebrow: 'Til spillere',
        title: 'Din profil, Wrapped og Compare',
        blurb: 'Din profil, hver karakters offentlige side og din personside, hvem der kan se dem, månedlige og event-baserede Wrapped-kort samt sammenligning af to karakterer.',
        minutes: '~4 min',
      },
      settings: {
        eyebrow: 'Til spillere',
        title: 'Indstillinger, side for side',
        blurb: 'Discord-opslag og skærmbilledefortrolighed, chatfeedet i spillet, enheder, dine egne webhooks, hvem der ser dine karakterer, hver karakter og ejerskabskrav.',
        minutes: '~6 min',
      },
      challenges: {
        eyebrow: 'Til spillere',
        title: 'Udfordringer og venne-events',
        blurb: 'Udfordr en spiller til et drop-, kill- eller XP-væddeløb, og vær vært for et privat bræt for dine venner bag ét invitationslink.',
        minutes: '~4 min',
      },
      clanHall: {
        eyebrow: 'Til spillere og klaner',
        title: 'Find klaner, events og ranglister',
        blurb: 'Clan Hall, sammenligning af to klaner, den ugentlige rangliste, listen over offentlige events og sider for klaner i spillet, der ikke er på Anvil.',
        minutes: '~3 min',
      },
      guideLibrary: {
        eyebrow: 'Til spillere og klanstaben',
        title: 'Guides i spillet',
        blurb: 'Læs guidebiblioteket efter niveau, foreslå en ny guide eller en ændring, og hold din klans egne kopier.',
        minutes: '~3 min',
      },
      weekly: {
        eyebrow: 'Til klanstaben og spillere',
        title: 'Skill og Boss of the Week',
        blurb: 'Planlæg en ugentlig konkurrence, gentag og roter den, startlinjer, præmier, afslutning før tid og hvad spillerne ser.',
        minutes: '~4 min',
      },
      teamComps: {
        "eyebrow": "Til klanstaff og spillere",
        "title": "Holdkonkurrencer",
        "blurb": "Færdigheds- og bosskonkurrencer som hold eller klan mod klan: opsætning, invitation af klaner, hvordan summer og gennemsnit virker, og hvad spillerne ser.",
        "minutes": "~4 min"
      },
      clanEvents: {
        eyebrow: 'Til klanstaben',
        title: 'Klanevents og kalenderen',
        blurb: 'Masser, raidaftener og samlinger: ugentlige gentagelser, “I’m going” og tilmeldinger, Discord-påmindelser, udbetalinger, undersøgelser og huller i kalenderen.',
        minutes: '~4 min',
      },
      luckRecords: {
        eyebrow: 'Til spillere',
        title: 'Droppchancer, held og rekorder',
        blurb:
          'Hvad chancerne på et drop-felt betyder, hvordan held beregnes, og hvor din bedste dag, uge, måned og år vises.',
        minutes: '~3 min.',
      },
    },
  },

  switching: {
    metaTitle: 'Skift fra andre plugins og trackere — Anvil',
    metaDescription:
      'Flyt din klan over til Anvil: sæt Discord-kanalerne op, synkronisér medlemslisten, start Skill eller Boss of the Week, og fortæl det til dine medlemmer.',
    eyebrow: 'Skift til Anvil',
    title: 'Skift fra andre plugins og trackere',
    dek: 'Anvil poster din klans drops og bedrifter på Discord. Den holder også styr på medlemslisten og kører ugentlige konkurrencer.',

    staff: {
      title: 'Hvis du driver klanen',
      body: [
        '**Lad botten sætte jeres kanaler op.** Gå til Admin → Discord → **Set it up for me**. Vælg én kanal eller flere. Hvis et andet plugin postede et sted, så sæt kryds ved _Use the same channels_. Intet flytter sig for dine medlemmer.',
        '**Synkronisér medlemslisten.** Åbn Anvil-pluginnets indstillinger i RuneLite. Slå **Keep the clan roster in sync** til. Én admin gør det én gang i spillet. Det erstatter enhver medlemsliste, du har ført andre steder.',
        '**Start en Skill eller Boss of the Week.** Gå til Admin → All events → **+ New event**, og vælg Skill of the Week eller Boss of the Week. Alle på medlemslisten er automatisk med. Det erstatter konkurrencer, du har kørt andre steder.',
        '**Fortæl det til dine medlemmer.** Gå til Admin → Discord → **Tell your members** → **Post it**. Botten poster spillertrinnene for dig.',
        '**En uge senere: ryd op.** Gå til Admin → Discord → **Remove old webhooks from other plugins**, sæt kryds ved dem, der skal væk, tryk på **Remove … webhooks** og derefter **Yes, remove them**. Derefter kan intet blive postet to gange. Tryk **Keep** ved dem, du vil lade være.',
      ],
    },

    player: {
      title: 'Hvis du er spiller',
      body: [
        '**Installér Anvil.** Åbn Plugin Hub i RuneLite, søg efter Anvil og tryk på **Install**. Log så ind med Discord fra Anvil-sidepanelet.',
        '**Slå dit gamle plugins notifikationer fra**, så intet bliver postet to gange. Eller afinstallér det, hvis du ikke bruger det til andet.',
        '**Det var det.** Der er ikke noget andet at sætte op.',
      ],
    },

    questions: {
      title: 'Spørgsmål',
      intro: 'Dem, klaner oftest spørger om:',
      rows: [
        {
          term: 'Registrerer Anvil kill counts, slayer-opgaver og personlige rekorder?',
          body: 'Ja. Anvil registrerer selv kill counts, slayer-opgaver og personlige rekorder, så der er ikke noget andet, der skal køre.',
        },
        {
          term: 'Skal spillerne indsætte en webhook et sted?',
          body: 'Nej. Klanen vælger kanalerne på sitet.',
        },
        {
          term: 'Vil du også have indlæg på din egen server?',
          body: 'Gå til din profil → **Announcements & webhooks** → _Your own webhooks_.',
        },
      ],
    },
  },

  clan: {
    metaTitle: 'Start en klan — Anvil',
    metaDescription: 'Opret en klan på Anvil: giv den navn, vælg adresse, forbind Discord, synkroniser medlemslisten og kør dit første event.',
    eyebrow: 'Anvil · kom i gang',
    title: 'Start en klan',
    dek: 'To navne og en adresse, så er din klan live — gratis, og der er ikke noget at vente på. Det er dét, plus de fire ting der er værd at gøre lige bagefter.',
    facts: [
      {
        strong: 'Gratis',
        rest: 'intet kort, ingen prøveperiode',
      },
      {
        strong: 'Live',
        rest: 'i det øjeblik du sender',
      },
      {
        strong: '~4 min',
        rest: 'til en fungerende klan',
      },
    ],
    footnote: 'Du kan ændre alt dette senere under Admin → **Clan settings**, undtagen adressen — den er værd at tænke over nu.',
    before: {
      title: 'Før du går i gang',
      body: [
        'Du skal bruge en Discord-konto, og det er hele listen. Log først ind på `{apex}`: en klan skal have en ejer, og indlogningen er måden siden ved, at det er dig. Start fra **Start en klan** på platformsiderne, eller gå direkte til `{apex}/clans/new`.',
        'Det koster ingenting. Ingen plan at vælge, intet kort at indtaste, og ingen prøveperiode der udløber og tager dit bræt med sig — en klan starter gratis og bliver ved med at virke.',
        'Store klaner kan senere skifte til en større plan via **Plan and billing** i Admin. Alt, hvad du betaler for på Anvil — en klan, et creator-rum eller dit eget Supporter-medlemskab — står på [din betalingsside](/portal).',
      ],
      note: {
        tag: 'Du bliver dens ejer',
        body: 'Ejer er den ene rolle, ingen kan tage fra dig, og den går til den, der opretter klanen. Tilføj stab bagefter under Admin → **People** → **Staff & roles**; se [På vagtplanen]({moderatorGuide}).',
      },
    },
    create: {
      title: 'Giv den navn, og vælg adresse',
      intro: 'Tre felter, og kun to reelle beslutninger. Formularen tjekker adressen mens du skriver og siger til, før du sender.',
      fields: [
        {
          term: 'Klannavn i spillet',
          body: 'Påkrævet, og det skal matche OSRS **præcist**. Det er ikke pynt: rostersynkroniseringen matcher på det og afviser en medlemsliste, der meldes under et andet navn. Det er dét, der forhindrer en andens medlemsliste i at lande på din side.',
        },
        {
          term: 'Klannavn',
          body: 'Valgfrit. Det folk ser — på siden og i hvert Discord-opslag. Lad det stå tomt, så bruges dit spilnavn til begge dele.',
        },
        {
          term: 'Adresse',
          body: 'Din klan bor på `{apex}/c/dit-slug`. Den foreslås ud fra navnet, du kan redigere den, og en håndfuld ord er reserveret. Vælg en, du stadig kan lide om et år: det er linket, der ender fastgjort i din Discord.',
        },
      ],
      note: {
        tag: 'Spilnavnet er en lås, ikke en etiket',
        body: 'Hvis din klan skifter navn i spillet, så ret det også her — indtil da afviser rostersynkroniseringen det nye navn. Det er kontrollen der virker, ikke en fejl.',
      },
    },
    live: {
      title: 'Den er live',
      body: [
        'Tryk **Opret klan**, og den findes. Ingen provisionering, ingen kø, intet „vi bygger din side, kig forbi om et par minutter“ — en klan er en række, så den kører allerede, før siden er færdig med at skifte.',
        'Du lander på et valg mellem **Sæt den op**, som åbner guiden, og **Se dig omkring først**. Der går intet i stykker, hvis du går væk og kommer tilbage i morgen; guiden husker, hvilke trin du har lavet.',
      ],
    },
    setup: {
      title: 'Opsætningsguiden',
      intro: 'Tre trin står mellem en frisk klan og et kørende event, og guiden går dem igennem i rækkefølge og springer over, hvad du allerede har lavet. Brættet kommer lige bagefter.',
      steps: [
        {
          term: 'Din klan',
          body: 'Dit visningsnavn, dit klannavn i spillet og et invitationslink til din server. Invitationen er dét, der lader tilmeldingssider og guides pege folk hen til dig.',
        },
        {
          term: 'Forbind Discord',
          body: 'Én delt bot, så der er ingen applikation at registrere og intet token at indsætte. Tryk **Connect your bot** og godkend den én gang, vælg så **A few channels** eller **Just one channel**, og tryk **Set it up for me** — botten opretter kanalerne for dig.',
        },
        {
          term: 'Få dine medlemmer ind',
          body: 'Installér pluginet, log ind med Discord, åbn så dit klanvindue i spillet og tryk på **Anvil**-knappen i dets titellinje. Ingen kan tilmelde sig et event, før din medlemsliste er inde.',
        },
        {
          term: 'Lav et bræt',
          body: 'Guiden slutter på **Create your first event →**. Vælg et format, tilføj felter, åbn tilmeldinger — det er [Kør dit første event]({adminGuide}), og klart det længste trin.',
        },
      ],
      after: [
        'Du kan springe guiden helt over med **Skip setup** og gøre det hele senere under Admin → **Clan settings** og Admin → **Discord**. Den findes, fordi rækkefølgen betyder noget, når man aldrig har gjort det før: Discord før kanaler, medlemmer før et bræt, de skal tilmelde sig.',
      ],
    },
    members: {
      title: 'Få dine medlemmer ind',
      body: [
        'Ingen skal tilmelde sig, registrere sig eller inviteres én ad gangen. Din medlemsliste kommer fra spillet.',
      ],
      ways: [
        {
          term: 'Rostersynkronisering (tag den her)',
          body: 'Åbn klanvinduet i spillet med pluginet kørende og tryk på **Anvil**-knappen i titellinjen. Hele din medlemsliste kommer ind med rangene i behold, og en liste fra en klan hvis navn ikke matcher dit, bliver afvist. Gentag det når folk kommer eller går — se [opsætningsguiden for spillere]({pluginGuide}).',
        },
        {
          term: 'De beder om at komme ind',
          body: 'At logge ind eller spille med pluginet giver aldrig nogen en plads af sig selv. Ser pluginet nogen spille i din klan i spillet, før din medlemsliste har dem, opretter det en anmodning om at komme ind for dem, og alle andre kan spørge med **Apply** på jeres klanside. Staben svarer på begge dele øverst på **Roster**-fanen, og **Who can join** afgør, om de venter på et ja, kommer ind med det samme eller slet ikke kan spørge. En, der spiller en karakter, som allerede står på din medlemsliste, bliver i stedet bekræftet under **Needs review**. Detaljerne står i [Dine folk]({peopleGuide}).',
        },
        {
          term: 'I hånden',
          body: 'Admin → **People** → **+ Add Manually** tager navne ét ad gangen, til den der spiller på mobil eller den officielle klient og slet ikke kan køre pluginet.',
        },
      ],
      note: {
        tag: 'Gæster er ikke et problem, der skal løses',
        body: 'En gæst spiller med i dine events uden at være i din klan i spillet: en spiller fra en gæsteklan, en ven, en alt. De får en plads, når staben godkender deres anmodning, eller med det samme, hvis **Who can join** er sat til **Let anyone in**. De bliver tracket og kan deltage i events, og de tæller ikke med i dit abonnement. En, der melder sig ind i din klan i spillet, bliver medlem ved næste synkronisering af medlemslisten.',
      },
    },
    first: {
      title: 'Dit første event',
      body: [
        'Den korteste vej til at der sker noget: lav et bræt, tilføj en håndfuld felter pluginet selv kan se, åbn tilmeldinger, og start. Drops, killcounts og XP skriver sig så selv ind.',
        'To guides bærer læsset her. [Kør dit første event]({adminGuide}) går fra start til slut — Discord, hold, opstart, og hvad man gør når det slutter. [Byg et bræt der følger med selv]({boardGuide}) handler specifikt om felter: hvad hver type faktisk kan opdage, og dem der importeres pænt og så aldrig udløser.',
        'Vil du helst ikke bygge et bræt overhovedet i din første uge, så kør en **Skill of the Week** eller **Boss of the Week** i stedet. Alle på listen er automatisk med, stillingen kommer fra hiscores, og der er intet at skrive.',
      ],
    },
    together: {
      title: 'Events på tværs af flere klaner',
      body: [
        'Et event behøver ikke tilhøre én klan. Flere klaner kan køre det samme bræt sammen — to, eller et dusin — hvor hver side beholder sin egen medlemsliste, sin egen stab og sin egen halvdel af moderationen.',
        'De kan også dele én pulje af spillere i stedet for at sidde på hver sin side af en stilling: ét event, alle med, uanset hvordan holdene ender med at blive skåret. Klan mod klan er én form for det, ikke den eneste.',
        'Hver gæsteklan får et invitationslink pr. hold, så du aldrig indsamler et eneste RSN i hånden, og en plads der lader deres egen moderator godkende deres egne medlemmers bevis. [Vær vært for en gæsteklan]({clanVsClanGuide}) dækker at arrangere et.',
      ],
      note: {
        tag: 'Intet at købe',
        body: 'Det er gratis at deltage i en andens event, og det er gratis at arrangere et. En klan der kun nogensinde dukker op på andres brætter, får aldrig brug for mere end sin egen gratis klan.',
      },
    },
    boosts: {
      title: 'Klan-boosts',
      body: [
        'Medlemmer, der betaler for Anvil Supporter som **Champion** (ét boost) eller **Patron** (to), kan booste klanen fra deres egne **Settings → Clan boosts**. Et boost tæller, når deres plads i klanen er 14 dage gammel, og der tæller højst to fra den samme person.',
        'Du ser, hvor I står, på Admin → **Clan settings** → **Boosts**: klanens niveau, hvor mange boosts der tæller, og hvor mange flere det næste niveau kræver. Niveau 1 kræver 3 boosts, niveau 2 kræver 8 og niveau 3 kræver 15. Falder antallet af boosts under et niveau, bliver dets fordele hængende en uge først.',
        'Niveau 1 sætter et **Boosted**-mærke på jeres klanside, jeres kort i Clan Hall og i søgningen, viser jer over klaner uden boost i Clan Hall og giver jeres navn en farvegradient. Niveau 2 giver en plads i Clan Halls Featured-række, afspiller jeres animerede banner og låser op for en **Recruiting line**: én sætning på op til 140 tegn, som besøgende ser. Niveau 3 giver et Spotlight øverst i Clan Hall og ét **Recruitment post in the Anvil Discord** om måneden, op til 500 tegn, sendt én gang med **Post to the Anvil Discord**, med et link til jeres klanside og uden at pinge nogen.',
      ],
      note: {
        tag: 'Kun udseende',
        body: 'Boosts ændrer, hvordan klanen ser ud, og hvor den bliver vist. De ændrer aldrig en rang, en score, jeres pladser eller jeres abonnement.',
      },
    },
    features: {
      title: 'Funktioner og abonnement',
      intro: 'Admins kan slå hele dele af Anvil til eller fra under **Features**. Fra skjuler dem i menuerne; intet slettes.',
      rows: [
        {
          term: 'Events',
          body: '**Skill & Boss of the Week** (til), **Surprise-task formats** (fra), **Missions** (fra), **Post-event survey** (fra).',
        },
        {
          term: 'Penge',
          body: '**Sign-up fees** (til), **Clan coffer** (fra).',
        },
        {
          term: 'Discord og plugin',
          body: '**Post to Discord** (til), **Death & fun messages** (fra), **Clan Hall card**, der viser, hvem der er online i din Discord, på din offentlige klanside (til).',
        },
      ],
      outro: '**Plan and billing** viser dit abonnement, hvor mange medlemmer du har i forhold til dets størrelse, og de større abonnementer. Betaler du, er **Manage subscription and invoices** der også.',
    },
  },

  discord: {
    metaTitle: 'Anvil i Discord — Anvil',
    metaDescription: 'Forbind Anvil-botten til din Discord-server: én invitation, kanalerne hver feed skriver i, rolle- og kaldenavnssynkronisering, slash-kommandoer, og hvad du tjekker når der bliver stille.',
    eyebrow: 'Anvil · Discord',
    title: 'Anvil i Discord',
    dek: 'Én bot, én invitation, og ingen applikation at registrere. Her står hvad den skriver, hvor den skriver det, hvad den må ændre på din server — og hvad du kigger på den dag, den holder op.',
    facts: [
      {
        strong: 'Én bot',
        rest: 'delt, intet at oprette',
      },
      {
        strong: '~5 min',
        rest: 'fra invitation til første opslag',
      },
      {
        strong: 'Tilvalg',
        rest: 'hver feed er slukket, til du peger den et sted hen',
      },
    ],
    footnote: 'Alt her ligger på Admin → **Discord**: hurtig opsætning øverst, derefter **More settings** — Connection, What goes where, Event posts, Roles & nicknames, Team channels, Commands og Post without a bot.',
    bot: {
      title: 'Én bot, allerede bygget',
      body: [
        'Der er ingen Discord-applikation at oprette, intet token at generere og ingen hemmelighed at indsætte. Anvil kører én bot, som alle klaner deler, så at forbinde er en invitation og intet andet.',
        'Du kan stadig tage din egen med — indsæt et token under **Use your own bot instead (advanced)**, så bruges det i stedet. Det er kun umagen værd, hvis du vil have botten til at bære din klans navn og avatar i medlemslisten; alt i denne guide virker ens uanset hvad.',
      ],
      permissions: [
        {
          term: 'Se kanaler, Send beskeder, Indlejr links, Vedhæft filer',
          body: 'Det basale. Uden dem er den på din server og tavs.',
        },
        {
          term: 'Administrer webhooks',
          body: 'Så **Set it up for me** og **Post here** kan lave webhooks for dig i stedet for, at du kopierer URL’er ud af Discord i hånden, og så Anvil kan finde gamle webhooks, du kan fjerne.',
        },
        {
          term: 'Administrer roller',
          body: 'Kun hvis du slår rollesynkronisering til. Så kan den uddele de roller, du kobler — og den kan aldrig røre en rolle over sin egen, hvilket er Discords regel, ikke vores.',
        },
        {
          term: 'Administrer kaldenavne',
          body: 'Kun hvis du slår kaldenavnssynkronisering til, så et medlems servernavn kan sættes til deres RSN.',
        },
        {
          term: 'Administrer kanaler',
          body: 'Til private holdkanaler under en draft, og til guides der postes som en ny kategori eller et forum. Spring det over, og alt andet virker stadig.',
        },
        {
          term: 'Administrer tråde, Send beskeder i tråde',
          body: 'Til guides i et forum: at skrive i opslaget og fjerne det igen — Discord lader ikke en bot slette selv sit eget forumopslag uden.',
        },
        {
          term: 'Skift kaldenavn',
          body: 'Kun hvis du giver botten jeres klans navn under **Connection → Bot appearance in your server**. Det ændrer kun bottens navn på jeres server.',
        },
      ],
      note: {
        tag: 'Den beder om det hele på én gang',
        body: 'Discord kan ikke bede om en rettighed senere, så invitationslinket beder om hele sættet, og de funktioner du aldrig slår til, bruger aldrig deres. At åbne invitationslinket igen er også måden at reparere en rettighed, nogen har fjernet.',
      },
    },
    connect: {
      title: 'At forbinde den',
      intro: 'To ting, i denne rækkefølge. Botten skal være på din server, og Anvil skal vide, hvilken server der er din.',
      steps: [
        {
          term: 'Inviter botten',
          body: 'Admin → **Discord** → **Connect your Discord server** (eller **Add Anvil to Discord**). Discord spørger, hvilken server Anvil skal tilføjes til, og sender dig tilbage hertil, så du kan ikke tilføje den til den forkerte ved et uheld. Senere ligger **Invite / re-invite the bot** under **More settings → Connection**.',
        },
        {
          term: 'Sæt server-id’et',
          body: 'Kun hvis knappen ikke kan klare det: åbn **Can’t use the button? Enter the server ID**, højreklik på dit serverikon i Discord → **Kopiér server-ID** (kræver, at Udviklertilstand er slået til under Avanceret i Discords egne indstillinger), indsæt det i **Your Discord server’s ID**, og tryk **Save**. Det er feltet, der gør forbindelsen til din.',
        },
      ],
      after: [
        'Panelet fortæller dig så sandheden i stedet for din hensigt: om botten faktisk er medlem af den server, og hvilke rettigheder den mangler. En grøn linje dér er mere værd end en gemt formular.',
      ],
      note: {
        tag: 'Server-id’et er hele bindingen',
        body: 'En server tilhører præcis én klan på Anvil, og slash-kommandoer fra en server, ingen har gjort krav på, afvises frem for at blive gættet. Indtil du sætter det, er botten inviteret og uvirksom.',
      },
    },
    channels: {
      title: 'Opsæt webhooks',
      body: [
        'Anvil skriver gennem **webhooks**, én pr. kanal, og hver eneste er valgfri. Der skrives intet nogen steder, før du peger en feed mod en kanal — en frisk klan er tavs med vilje, ikke ved et uheld.',
        'Med Anvil-botten på din server opretter **Set it up for me** øverst på **Admin → Discord** kanalerne og peger hvert feed på dem. Vil du gøre det i hånden, så åbn **More settings → What goes where**, og begynd med **Catch-all channel** på **Clan & events**, derefter **In-game catch-all** på **In-game (plugin)**: vælg en kanal i dropdown-menuen, så gemmes den. Uden botten går du i Discord til kanalens **Rediger kanal → Integrationer → Webhooks**, opretter en, kopierer URL’en, vælger **Paste a webhook…** i dropdown-menuen, indsætter den og trykker **Save**. En webhook-URL kan skrive i kanalen, så behandl den som en adgangskode; slet den i Discord og lav en ny, hvis den lækker. **Test**, og **Add another** til at fordele travle opslag mellem to webhooks, ligger under **Post without a bot**.',
      ],
      feeds: [
        {
          term: 'Samlekanal',
          body:
            'Den vigtigste, på fanen **Clan & events**. Event-start og -slut, tilmeldinger der åbner, ranglister, ugentlige resultater – alt det, siden poster uden en egen kanal. Sæt kun denne, og du har en fungerende klan.',
        },
        {
          term: 'Samlekanal i spillet',
          body:
            'På fanen **In-game (plugin)**: Her havner alt fra spillet, der ikke har en egen kanal. Sæt denne som den næste.',
        },
        {
          term: 'Milepæle og mere',
          body:
            'På fanen **In-game (plugin)**. Slayer, clues, speedruns, killtal, BA-gambles og egne chatbeskeder postes her, når spillerne slår dem til. Knappen **Filters** angiver, hvad din klan giver medlemmerne som standard. Spillernes egne skabeloner og private typer står i [Settings, page by page]({settingsGuide}).',
        },
        {
          term: 'De delte feeds',
          body:
            'Eventposts, boards du er medvært for, Skill & Boss of the Week og klanens kalenderbegivenheder kan skilles fra samlekanalen. Sjældne drops, kæledyr, samlelog, niveauer, combat achievements, quests, dagbøger, dødsfald og PvP-kills kan skilles fra samlekanalen i spillet. Medlemsændringer, godkendelser af tilmeldinger og kasselog ligger under **Staff only**. Tomme delte feeds falder tilbage til deres samlekanal. Kassen er undtagelsen: tom betyder, at ingen penge postes. League og andre modes har deres egen fane **Game modes**.',
        },
      ],
      note: {
        tag: 'Del dødsfaldene fra først',
        body: 'Dødsfald er den feed med størst volumen på de fleste brætter og den, der begraver alt andet. Deler du kun én ting fra, så del den.',
      },
    },
    roles: {
      title: 'Roller og kaldenavne',
      body: [
        'Begge synkroniseringer er slukket, indtil du aktiverer dem under **Admin → Discord → Roles & nicknames**, og begge styres af medlemslisten. Slå **Enable Discord role sync** til, lad **Auto-match in-game rank → Discord role by name** være slået til, vælg eventuelle generelle **Member roles** og **Guest roles**, gem, og tryk så **Sync roles & nicknames now**. Hver person skal også have en forbundet Discord-identitet; synkroniseringsrapporten nævner alle, den ikke kunne finde ud af.',
      ],
      ways: [
        {
          term: 'Rollesynkronisering',
          body: 'Kobl dine range fra spillet til Discord-roller, så holder Anvil dem i trit. Der er også enkeltroller til medlemmer, gæster, holdkaptajner og det igangværende event, så du kan pinge de rigtige uden at vedligeholde en liste i hånden.',
        },
        {
          term: 'Kaldenavnssynkronisering',
          body: 'Sætter et medlems servernavn til deres RSN. Den udfylder som udgangspunkt et tomt kaldenavn og kan få besked på at overskrive et, nogen selv har valgt — det er indstillingen at tænke over før, ikke efter.',
        },
      ],
      note: {
        tag: 'Bottens rolle skal ligge over dem, den styrer',
        body: 'Discord lader ingen bot røre en rolle på eller over sin egen, og den nægter det tavst fra din side — synkroniseringen gør så bare ingenting. Træk Anvil-rollen op under **Serverindstillinger → Roller**, så begynder den at virke; der skal ikke geninviteres noget.',
      },
    },
    commands: {
      title: 'Slash-kommandoer',
      body: [
        'Botten svarer på `/bingo` på din server (brættet, stillingen, reglerne, dit eget kort) plus klankommandoer som `/sotw`, `/stats` og `/coffer`. De læser den levende side, så ingen behøver forlade Discord for at se, hvor de står. [Hver kommando og dens valgmuligheder]({commandsGuide}) har sin egen side.',
        'De dukker op cirka et minut efter, botten er kommet ind. Dukker de slet ikke op, gav invitationen botten men ikke dens kommandoer — det er to separate rettigheder, og et ældre invitationslink bad kun om den ene. Kør **Invite / re-invite the bot** under **Connection** på Discord-siden igen; det smider ikke botten ud og nulstiller ingenting.',
      ],
      note: {
        tag: 'Den svarer på hver enkelts eget sprog',
        body: 'Som udgangspunkt svarer botten på det sprog, det medlem har sat sin Discord til, med engelsk som reserve. Vælg ét sprog under **Botsprog** for at tilsidesætte det for alle — det er også den eneste vej til arabisk, da Discord ikke har et arabisk klientsprog at opdage.',
      },
    },
    posts: {
      title: 'Hvad den skriver, og hvornår',
      body: [
        'To kilder, og det er værd at vide hvilken er hvilken, når noget ser forkert ud.',
        '**Siden** skriver om events: et bræt der åbner, tilmeldinger, en start, stillinger, resultatet. De kommer fra Anvil selv og virker, uanset om nogen har pluginet.',
        '**Pluginet** skriver hvad der sker i spillet: drops, pets, dødsfald, levels, collection log-pladser, combat achievements. De findes kun for medlemmer der kører det, så en tavs drops-kanal betyder som regel et tavst plugin frem for en ødelagt webhook.',
      ],
      note: {
        tag: 'Intet skrives to gange',
        body: 'Et drop der fuldfører et felt er ét opslag, ikke ét fra pluginet og endnu et fra brættet.',
      },
    },
    modes: {
      title: 'Leagues, Deadman og andre spiltilstande',
      body: [
        'Leagues, Deadman, hardcore og andre modes kører på egne verdener med egne karakterer. Deres posts er altid mærket og tæller aldrig med i boards eller konkurrencer. De har deres egen fane: **Admin → Discord → What goes where → Game modes**. En mode dukker op der, første gang et medlem spiller den.',
        'Hver mode har en kontakt og en **To**-kanal. Slå **Send game-mode posts to their own channels** til for at bruge disse kanaler. Lader du den være fra, poster alle modes til de normale kanaler, stadig mærket. Knappen **Posts** i en mode\'s række viser alt, den sender – de sædvanlige og modens egne events – hver med sin egen kontakt.',
        'Under listen laver **Custom thresholds**, at en mode poster mindre end hovedspillet. **Post drops rarer than 1 in…** (mindst 2) og **Post drops worth at least (gp)** (mindst 1,000) sætter egne gulve (tom = samme som hovedspillet). Tryk derefter på **Save drop thresholds**: items der altid postes, bliver stadig postet, men drops der kun tæller på deres værdi, gør ikke. **Use its own level milestones** poster kun et level-up, hvis det opfylder begge regelsæt.',
      ],
      note: {
        tag: 'Strengere, aldrig løsere',
        body: 'En spiltilstands filtre kan kun tage opslag væk. Pluginet har allerede brugt dine indstillinger for hovedspillet, så intet et filter for en spiltilstand gør, kan bringe et opslag tilbage.',
      },
    },
    cleanup: {
      title: 'Gamle webhooks fra andre plugins eller bots',
      body: [
        'Med botten på din server viser Discord-siden hver webhook på den, der ikke er Anvils. **Coming from other plugins?** tilbyder **Use the same channels**, så **Set it up for me** skriver, hvor dine gamle feeds gjorde, og intet flytter sig for dine medlemmer.',
        'Når dine medlemmer er på Anvil, så gå til **Remove old webhooks from other plugins**, sæt kryds ved dem, der skal væk, og tryk **Remove … webhooks**, derefter **Yes, remove them**. Det sletter dem i Discord for altid — det kan ikke fortrydes.',
        'Listen rummer enhver webhook, der ikke er Anvils, ikke kun dem fra andre plugins. Er der én, du vil beholde, som en anden bots feed? Tryk **Keep**, så forsvinder den fra listen; **Show kept** og **Put back** henter den tilbage. At beholde skjuler den kun her — intet ændrer sig i Discord.',
      ],
      note: {
        tag: 'Kræver „Administrer webhooks“',
        body: 'Botten læser din servers webhooks for at finde dem. Uden _Administrer webhooks_ på dens rolle siger siden, at den ikke kan se dem.',
      },
    },
    announce: {
      title: 'Post to Discord',
      body: [
        'Admins kan skrive som botten fra **Post to Discord**, under **Clan** i adminmenuen. Vælg en **Channel**, skriv **Message**, og tryk **Send message**. Lang tekst, som et regelsæt, bliver selv delt op i flere beskeder.',
        '**Send as an embed** er slået til som standard og tilføjer en valgfri **Title** og en **Accent colour**; slå den fra for ren tekst. **Ping** vælger en rolle, eller @everyone, der skal nævnes, og Anvil spørger, før den sender.',
        'Hvert opslag, du sender, står under **Sent from here**. **Edit** ændrer det i Discord uden at pinge igen, og **Delete** fjerner det.',
      ],
      note: {
        tag: 'Kun admins, med botten',
        body: 'Den skriver som Anvils bot, så forbind din server først. Moderatorer kan ikke se den. Det er kontakten **Post to Discord** under **Clan settings → Features**; slået fra forsvinder den fra menuen.',
      },
    },
    quiet: {
      title: 'Når der bliver stille',
      body: [
        'I rækkefølge, fordi hvert punkt udelukker det næste:',
      ],
      checks: [
        {
          term: 'Er botten faktisk på serveren?',
          body: '**Connection** på Discord-siden siger det direkte. „Token gyldigt“ og „på din server“ er to forskellige ting, og det første medfører ikke det andet — med en delt bot er tokenet altid gyldigt.',
        },
        {
          term: 'Er server-id’et rigtigt?',
          body: 'Et forkert-men-ægte id ser præcis ud som et rigtigt, indtil du opdager, at opslagene lander et andet sted.',
        },
        {
          term: 'Findes webhooken stadig?',
          body: 'At slette en Discord-kanal sletter dens webhook, og Anvil beholder den døde URL. Vælg en kanal til den igen under **What goes where**.',
        },
        {
          term: 'Ligger bottens rolle højt nok?',
          body: 'Kun for rolle- og kaldenavnssynkronisering — se ovenfor. Det er den, der fejler tavst.',
        },
      ],
      note: {
        tag: 'Den kan ikke byde nye velkommen',
        body: 'Discord melder kun tilgange over en gateway-forbindelse, som en delt bot ikke holder åben for hver server. Der er derfor intet „velkommen“-opslag — læg tilmeldingslinket i en #roller- eller #start-her-kanal i stedet, hvor folk alligevel kigger.',
      },
    },
    drops: {
      title: 'Droptærskler',
      body: [
        'Anvil starter ved **1m gp** eller **1 in 1,000**. Et drop postes, når det opfylder en af dem. Ingen kan sætte egne tal under dem, og 0 slår en fra.',
        'Angiv din klans standarder under **Admin → Discord → What goes where → Drops**: **Default minimum drop value (gp)**, **Default: post drops rarer than 1 in…** og **Require both**. Slår du **Require both** til, skal et drop opfylde værdien **and** sjældenheden.',
        'Hver karakter følger standarden for den klan, den er medlem af, og Anvils standard, hvis den ingen har. Spillere kan vælge egne tal i **Settings**. Der vises **Using clan default** eller **Custom**, og **Reset** går tilbage.',
        '**Hard floor: never post drops more common than 1 in…** er den strenge. Medlemmer kan ikke gå løsere end den i dine klans kanaler. Deres egne webhooks kan.',
      ],
      note: {
        tag: 'Mere om spillersiden',
        body: 'Spillernes egne tal, skabeloner og webhooks står i [Settings, page by page]({settingsGuide}).',
      },
    },
    pools: {
      title: 'Flere webhooks til travle kanaler',
      body: [
        'En webhook kan kun sende så hurtigt. Til et travlt event tilføjer du flere webhooks til samme kanal. Tryk på **Busy channel? Let the bot add … more webhooks** (kræver **Manage Webhooks**), eller indsæt flere webhook-links i kanalens felt. Anvil foreslår flere, når du har 50 eller flere spillere, mange posts i minuttet, eller Discord for nylig har sagt „slow down“. Op til 10 er rigeligt.',
        'Anvil skifter mellem dem. Hvis Discord siger „slow down“ til en, hviler den et øjeblik, og den næste tager posten. Hvis en slettes eller holder op med at virke, springes den over i 10 minutter. Posts fortsætter, så længe én webhook virker.',
        'Alle skal pege på samme kanal. Anvil advarer dig, hvis de ikke gør. Brug **Test** til at tjekke én, eller **Stop posting here** for at fjerne den.',
      ],
      note: {
        tag: 'Samme kanal, samme posts',
        body:
          'Flere webhooks poster aldrig dobbelt. De deler kun arbejdet. Den samme idé findes i [Droptærskler](#drops) ovenfor, og admin-siden findes i [Running the event]({adminGuide}).',
      },
    },
  },

  plugin: {
    metaTitle: 'Opsætning af RuneLite-pluginnet — Anvil',
    metaDescription:
      'Installér Anvils RuneLite-plugin, log ind fra dets sidepanel, og sæt Discord-beskeder op.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Opsætningsguide til spillere',
    dek: 'Installér det, log ind, og spil. Pluginnet indsender dine bingo-drops, poster dine sjældne drops, dødsfald og milepæle på Discord, og lader dig slå hvem som helst op med et højreklik.',
    facts: [
      { strong: '1 knap', rest: 'og du bliver tracket' },
      { strong: '~3 min', rest: 'til den basale opsætning' },
      { strong: 'Højreklik', rest: 'for at slå hvem som helst op' },
    ],
    footnote:
      'Skærmbillederne er fra en rigtig opsætning — kontotokenet er sløret med vilje. Dit bør blive lige så privat.',

    install: {
      title: 'Installér pluginnet',
      body: [
        'I RuneLite: **Configuration** (skruenøglen) → **Plugin Hub** → søg efter **Anvil** → **Install**. Udgiveren er `AhmedFathy2001`.',
        'Ét plugin dækker alle klaner — det forbinder altid til `anvilosrs.com`, og det er login (næste trin), der knytter det til dig og dine klaner. Der er ikke noget klan-specifikt at hente og ingen adresse at skrive ind. Når det er installeret, dukker en **Anvil**-knap op i RuneLites sidebjælke, og indstillingerne ligger under **Configuration → Anvil**.',
      ],
    },

    connect: {
      title: 'Log ind',
      intro: 'Åbn **Anvil**-panelet fra RuneLites sidebjælke, og klik på **Sign in with Discord**. Din browser åbner på `anvilosrs.com`; godkend koden dér, så logger pluginnet selv ind — intet at skrive, intet at kopiere og intet at udfylde under indstillinger.',
      panelFigure: {
        caption: 'RuneLite → Anvil-knappen',
        alt: 'RuneLites sidebjælke med Anvil-knappen nederst i ikonstriben markeret',
        legend: [
          {
            label: 'Anvil-knappen',
            body: 'langs siden af RuneLite-vinduet, nederst i ikonstriben. Klik på den for at åbne panelet. Den dukker op, så snart pluginnet er installeret og slået til — og du kan trække den op ad striben, hvis du hellere vil have den øverst.',
          },
        ],
      },
      signInFigure: {
        caption: 'Anvil-panelet',
        alt: 'Anvil-panelet med knappen Sign in with Discord og den side, det forbinder til, markeret',
        legend: [
          {
            label: 'Sign in with Discord',
            body: 'vises kun, så længe denne computer er logget ud. Klik på den, og resten sker i din browser.',
          },
          {
            label: 'Connects to',
            body: 'altid `anvilosrs.com` — den eneste side, pluginnet taler med, og den, dit token hører til.',
          },
          {
            label: 'Paste a token instead',
            body: 'nødløsningen, hvis browsertrinnet ikke virker for dig — se slutningen af dette trin.',
          },
        ],
      },
      easySteps: [
        'Klik på **Sign in with Discord**. Panelet viser en kort kode og åbner din browser på `anvilosrs.com`.',
        'Log ind med Discord dér, hvis du ikke allerede er det, tjek at koden på siden matcher den i RuneLite, og klik så på **Approve**.',
        'Tilbage i RuneLite står der _Signed in_ øverst i panelet — og, når du logger ind i spillet, hvilken karakter det følger. Det var det.',
      ],
      linkFigure: {
        caption: 'anvilosrs.com → /link-device',
        alt: 'Siden Link your RuneLite client med kodefeltet og Approve-knappen markeret',
        legend: [
          { label: 'Koden', body: 'den skal stemme med det, pluginnet viser dig lige nu.' },
          {
            label: 'Approve',
            body: 'godkend kun en kode, som _din egen_ klient viser. Har nogen sendt dig et link eller en kode, så afvis den — at godkende ville give dem din konto.',
          },
        ],
      },
      directNote: {
        tag: 'Hvor det foregår',
        body: [
          'Hele forløbet bliver på `anvilosrs.com` — koden udstedes dér, du godkender den dér med dit eget Discord-login, og token sendes direkte tilbage til pluginnet. Pluginnet åbner kun login-sider på `anvilosrs.com`, så et login-link, der peger andre steder hen, kommer ikke fra det.',
        ],
      },
      federationAside:
        'Må ikke forveksles med **Connect clans** i sidepanelet — det er den separate, valgfrie knap, der forbinder dig til andre Anvil-klaner, og den dukker først op, når du allerede er logget ind her.',
      manualFallback:
        'Åbner browseren ikke af sig selv, skriver panelet adressen og koden, så du kan åbne den manuelt. Koder udløber efter ti minutter — tryk bare på knappen igen.',
      manualHeading: 'Nødløsning: indsæt dit token i hånden',
      manualIntro:
        'Hvis login fra pluginnet ikke virker for dig, så kopiér dit token nedenfor (eller fra [Profile → plugin token](/profile#plugin-token), hvor du også kan rotere det), klik derefter på **Paste a token instead** under login-knappen i Anvil-panelet, og indsæt det dér.',
      tokenFigure: {
        caption: 'Profile → RuneLite plugin',
        alt: 'RuneLite plugin-kortet på profilsiden med tokenfeltet og knapperne Reveal, Copy og Rotate markeret',
        legend: [
          {
            label: 'Din token',
            body: 'skjult indtil du trykker Reveal. Den er sløret på dette skærmbillede med vilje; post aldrig din egen på Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'kopiér den, og brug så **Paste a token instead** i Anvil-panelet. Rotate udsteder en ny og dræber den gamle — brug den, hvis du overhovedet mistænker, at din token er sluppet ud.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Brug sidepanelet til daglig',
        body: ['**Anvil-sidepanelet er dit primære arbejdssted**: log ind og ud dér, se dine klaner og aktive events, gennemse og gør krav på felter, følg fremskridt, tag startbilleder, kør synkroniseringer og åbn supportværktøjer. **Configuration → Anvil**, vist nedenfor, er kun til indstillinger — der er intet token i det. Vil du logge denne computer ud, så åbn **⋯**-menuen ved siden af dit navn øverst i panelet. Ét login dækker alle events, du er tilmeldt — du skal aldrig gøre det igen for hver bingo.'],
      },
    },

    accounts: {
      title: 'Forbind dine konti',
      body: [
        'Når din token er på plads, vises konti, du spiller på, automatisk på din profil. En helt ny konto kan forbindes med det samme; en konto, der allerede står på en klanliste, kræver først ét ejerskabstjek, fordi et offentligt RuneScape-navn ikke beviser, hvem der ejer det.',
        'Ved den første forbindelse kan du bruge [det hurtige XP-tjek](/profile#link-account) eller bede en klanmoderator godkende kontoen under [konti vi har registreret](/profile#detected-accounts). Når den er bevist, følger det stabile kontofingeraftryk fremtidige navneskift og genkender kontoen automatisk.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'RuneScape Accounts-kortet på profilsiden med konti verificeret via pluginnet',
        legend: [
          {
            label: 'Dine forbundne konti',
            body: 'alt med “Verified via plugin” er forbundet og genkendes automatisk. Etablerede klankonti kan først bede om et enkelt XP-tjek eller en moderatorgodkendelse.',
          },
        ],
      },
      noPluginHeading: 'Kan du ikke køre pluginnet?',
      noPluginIntro:
        'På mobil eller i den officielle klient kan du bruge [Profile → account linking](/profile#link-account) i stedet:',
      noPluginOptions: [
        '**Verify by XP** — skriv dit RSN, siden vælger en tilfældig skill, og du skal tjene 1.000 XP i den inden for 30 minutter.',
        '**Manual review** — til skjulte Hiscores eller helt nye alts: indsend dit RSN med en note, og en moderator godkender det.',
      ],
      signupNote:
        'Tilmelding til et event kræver mindst én verificeret konto, så få det klaret, inden du melder dig til.',
    },

    working: {
      title: 'Tjek at det virker',
      intro:
        'Log ind og læs din chatboks. Pluginnet hilser på dig, når det er forbundet, og der kører et event.',
      // Verbatim: det er præcis de linjer, spillet skriver.
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…senere, efterhånden som ting sker…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Du bør også se **Anvil-sidepanelet** fyldes ud med dine klaner, dine igangværende events, din placering og synkroniseringsknapperne — og en **Anvil**-knap dukke op i titellinjen på din Collection Log i spillet.',
      guestNote: {
        tag: 'Gæst kontra medlem',
        body: 'Står der _Tracked as a guest_ i chatten, bliver du tracket, men du står endnu ikke på klanens medlemsliste. Det retter en admin ved at synkronisere medlemslisten fra spillet — spørg {discordLink}.',
        discordWord: 'på Discord',
      },
      panelHeading: 'Sidepanelet',
      panelBody: [
        'Fire faner og et tandhjul. **Clan** er dine events og din klan: alle igangværende og kommende bingoer og ugentlige konkurrencer med din placering. **Feed** er din klans og dine brætters store øjeblikke, mens de sker, med eventchat. **You** er din egen profil, og **Lookup** finder alle andres, spiller eller klan. Tandhjulet rummer synkronisering og dine bannerlyde.',
        'Alle faner, eventchat, reaktioner og de indstillinger, der bringer feedet og Supporter-farverne ind i dit spil, står i [Sidepanelet, fane for fane]({panelGuide}).',
      ],
      panelFigure: {
        caption: 'Clan · You · Lookup',
        alt: 'Anvil-sidepanelets tre faner side om side: Clan-fanen med events og klanens uge, You-fanen med din Collection Log og Lookup-fanen med en anden spillers kort',
      },
      lookupHeading: 'Slå hvem som helst op',
      lookupBody:
        'Højreklik på en spiller — lige ved siden af dig, eller på navnet i chatten, din venneliste eller klanpanelet — og vælg **Anvil** for at åbne deres kort under sidepanelets **Lookup**-fane. Din egen er **You**-fanen.',
      lookupFigure: {
        caption: 'Højreklik på et navn → Anvil',
        alt: 'En spillers højreklikmenu i spillet med et Anvil-punkt under Lookup',
      },
      lookupSettingNote:
        'Vælg, hvor **Anvil**-punktet vises, under **Player lookup** i pluginets indstillinger. På et navn i chatten er det aldrig venstreklik-valget, så et klik på et navn gør stadig det, spillet plejer.',
      lookupSettingFigure: {
        caption: 'Configuration → Anvil → Player lookup',
        alt: 'Afsnittet Player lookup i Anvils indstillinger med hver indstilling markeret og nummereret',
        legend: [
          {
            label: 'Anvil lookup on players',
            body: 'hovedafbryderen. Slået fra skjuler den punktet overalt.',
          },
          {
            label: 'Players in the world',
            body: 'når du højreklikker på en spiller, der står i nærheden.',
          },
          {
            label: 'Chatbox and private messages',
            body: 'navne i chatboksen og i private beskeder.',
          },
          {
            label: 'Clan panels / Friends chat / Friends, ignore and party lists',
            body: 'navnelisterne: medlemmer af din klan og gæsteklanen, friends chat-kanalen, din venne- og ignoreliste samt raid-partypanelet.',
          },
        ],
      },
    },

    bingo: {
      title: 'Bingo-indstillinger',
      intro:
        'De betyder kun noget, mens du er med i et event. Standardværdierne er fine — her står, hvad hver enkelt rent faktisk gør.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'Bingo-afsnittet i pluginnets indstillinger med hver indstilling markeret og nummereret',
        legend: [
          {
            label: 'Show Overlay',
            body: 'tegner et lille _Anvil / hold / UTC-dato_-panel øverst til venstre. Det bliver en del af billedet på dine bevis-screenshots, og det er netop dét, der gør et bevis svært at forfalske eller datere tilbage. Den er slukket på dette skærmbillede — tænd den, hvis din klan vil have hold og tidspunkt synligt på hvert bevis.',
          },
          {
            label: 'Team completion popups',
            body: 'et banner, når nogen på dit hold gør et felt færdigt. Flere på én gang: det sværeste får banneret, resten går i chatten.',
          },
          {
            label: 'My tile popups',
            body: 'en popup, når dit eget drop rykker et felt frem eller gør det færdigt. Slået fra tracker den stadig — bare stille.',
          },
          {
            label: 'Banner sound + volume',
            body: 'afspiller en lyd sammen med banneret. Der sker ingenting, før du selv tilføjer mindst én .wav-fil via **Add clip** under “Banner sounds” i Anvil-sidepanelet. Missioner har deres egen mappe — tilføj et klip under **Mission sounds**, så spiller de det i stedet for den indbyggede lyd, der holder dem fra at lyde som et fuldført felt.',
          },
          {
            label: 'Auto starting shot',
            body: 'tager et events startbillede for dig i det øjeblik, du står på det fastlagte sted. Slået fra trykker du selv på **Take starting shot** i sidepanelet.',
          },
        ],
      },
      teamsHeading: 'Hold',
      teamsBody:
        'Knappen **Teams** på et event viser dets hold i rangorden, med dit øverst. Åbn et for at se dets trup, kaptajnen først, eller søg efter en spiller på tværs af alle hold — klik på et navn for at slå personen op.',
      teamsFigure: {
        caption: 'Event → Teams',
        alt: 'Teams-siden med et events hold, point og antal medlemmer, ved siden af ét holds trup med kaptajnen først',
      },
      startHeading: 'Startbillede',
      startBody: [
        'Nogle events kræver et **startbillede** af alle: ét screenshot taget efter, at eventet er gået i gang, på et sted der trækkes i selve startøjeblikket. Det forhindrer folk i at bruge ugen op til eventet på at hamstre clues, kister og kills, som de så dumper på første dag.',
        'Kører du pluginnet, er der intet at forberede. Når eventet starter, får du en chatlinje med besked om, hvor du skal hen, og Anvil-sidepanelet viser en **Take starting shot**-knap. Stil dig, hvor der står, tryk én gang, og så er du færdig — pluginnet tager billedet, stempler dit RSN, dit hold, stedet og et kodeord, kun din konto får, ind i det, og arkiverer det for dig.',
        'To ting tjekker det, inden det arkiverer noget, så du kan nå at rette dem i spillet i stedet for i en Discord-diskussion bagefter. Har værten sat stedet på kortet, ved pluginnet, hvor langt væk du er, og siger det — i stedet for at sende et billede fra den forkerte ende af Gielinor. Og kræver eventet en frisk session, skal du **logge ud og ind igen**, før du tager billedet: dine hiscores gemmes kun, når du logger ud, så et relog lige inden billedet er dét, der gør dine starttal — og dermed hvert eneste XP- og KC-felt — rigtige.',
        'På mobil, eller uden pluginnet: åbn **My Team** her på siden, læs dit kodeord på startbillede-kortet, skriv det i chatboksen i spillet, tag et screenshot hvor både din figur og kodeordet er synlige, og upload det på samme kort. Den upload tæller med det samme — du kan spille, så snart den er inde, og staben ser den igennem bagefter. Log ud og ind først, hvis kortet beder dig om det.',
      ],
    },

    notifications: {
      title: 'Discord-beskeder',
      intro:
        'De sendes, uanset om der kører en bingo eller ej, og de lander i klanens kanaler. Hvilken kanal bestemmer administratorerne her — du vælger kun _hvad_ du poster. I den næste plugin-opdatering flytter disse valg til hjemmesiden, under **Settings → Discord posts & screenshots**, og følger dig til hver computer. På samme side vælger **Screenshot privacy**, hvilken chat (private beskeder, offentlig chat, klanchat) der skjules på alle skærmbilleder, pluginet tager. Pluginet beholder to kontakter under **Notifications**: **Share clan posts** sætter alle opslag fra hovedspillet på pause på én gang, og **Share seasonal activity** gør det samme på Leagues, Deadman og andre sæsonverdener.',
      examplesFigure: {
        caption: 'Sådan ser et opslag ud',
        alt: 'To Discord-opslag fra Anvil: en Grandmaster combat task med point og fremskridt mod næste unlock, og et dødsfald med dets besked, hver med et skærmbillede af øjeblikket',
      },
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Beskedafsnittene Deaths and kills og Drops and pets med hver indstilling markeret og nummereret',
        legend: [
          {
            label: 'Notify on death',
            body: 'poster til klanens dødskanal med et skærmbillede af øjeblikket, hvor du døde.',
          },
          {
            label: 'Death message',
            body: 'din egen linje. `{name}` erstattes med dit RSN.',
          },
          {
            label: 'Notify on PvP kill',
            body: 'et skærmbillede af tikken, hvor dit mål rammer 0 HP. Fra som standard; tændt her.',
          },
          {
            label: 'Notify on rare drops',
            body: 'hovedkontakten for drop-posts.',
          },
          {
            label: 'Min drop value / Min drop rarity',
            body:
              'et drop postes, hvis det er værd mindst dette (GE eller high alch, det højeste af de to) eller sjældnere end 1-ud-af-N. Anvil starter ved 1m og 1/1,000. Din klan kan sætte egne standarder for sine medlemmer. Indtil du selv vælger et tal, følger du klanens. **Reset to clan default** (eller **Reset to Anvil default**, hvis du ingen klan har) går tilbage til at følge den. En klan kan også sætte en hård sjældenhedsgrænse, som kun gælder for posts i klanens egne kanaler. Dit tal kan ikke gå løsere end den der, og det ændrer aldrig værdigrænsen. Sæt et af tallene til 0 for at slå det fra.',
          },
          {
            label: 'Value and rarity together',
            body:
              'et drop postes som standard, når det opfylder værdien **or** sjældenheden. Slår du **Require both** til, skal det opfylde værdien **and** sjældenheden. Din klan kan vælge denne standard for sine medlemmer. Indtil du vælger, følger du den. Uden klan gælder enten det ene eller det andet. Hver af dine egne webhooks kan også sætte sin egen minimumsværdi, sjældenhed og enten/begge. Det den lader være tomt, følger dine indstillinger.',
          },
          {
            label: 'Loot key value',
            body: 'en loot key postes én gang som en enkelt notifikation, når hele indholdet overstiger dette tal.',
          },
          {
            label: 'Notify on pets',
            body: 'kæledyr postes i kanalen for sjældne drops.',
          },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · collection log · levels · diaries · quests',
        alt: 'Beskedafsnittet Combat achievements med hver indstilling markeret og nummereret',
        legend: [
          {
            label: 'CA post tier',
            body: 'det laveste opgave-tier, der posteres; gennemførte tiers posteres også. Standarden er Master; Grandmaster poster kun de allersjældneste, **Off** poster ingen. Bingoens CA-felter tæller uanset hvad.',
          },
          {
            label: 'Notify on collection log slots',
            body: 'hver ny plads i collection loggen.',
          },
          {
            label: 'Notify on level milestones',
            body: 'level-ups, din klan har valgt at annoncere — som standard 99’ere, hver 100 total levels fra 1800, samt max. Klanens admins sætter reglerne; du kan poste mindre (eller lave dine egne regler til dine personlige webhooks) under Announcements på din profil.',
          },
          {
            label: 'Notify on diary completions',
            body: 'gennemførte achievement diary-tiers, med et screenshot.',
          },
          {
            label: 'Quest post tier',
            body: 'quests fra den sværhedsgrad, du vælger, og opefter, fra All (hver quest) op til Grandmaster; **Off** poster ingen. Standarden er Master. Bingoens quest-felter tæller uanset hvad.',
          },
        ],
      },
    },

    trouble: {
      title: 'Når noget går galt',
      intro:
        'Pluginnet siger til i chatten, når trackingen er stoppet — det venter cirka 90 sekunder, før det brokker sig, og gentager højst hvert 5. minut.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token er forkert eller er blevet roteret. Åbn **⋯**-menuen øverst i Anvil-panelet, tryk på **Sign out** og derefter **Sign in with Discord** igen — eller brug **Paste a token instead** med en frisk token fra [Profile → RuneLite plugin](/profile#plugin-token).',
        },
        {
          term: '`Anvil: can’t reach the site (anvilosrs.com) — tracking is OFF.`',
          body: 'Pluginnet kan ikke nå `anvilosrs.com`. Tjek din internetforbindelse og en eventuel firewall eller VPN, der kan blokere RuneLite. Er alt det i orden, er siden formentlig nede et øjeblik — pluginnet genopretter selv forbindelsen.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Kontoen er ikke forbundet endnu. Åbn [Profile → registrerede konti](/profile#detected-accounts) for at tilføje den eller starte ejerskabstjekket.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ingenting. Den kom sig selv.',
        },
        {
          term: '“<RSN> belongs to another Anvil player”',
          body: 'En anden linkede denne karakter på Anvil først, så intet tæller for den fra dit login. Er den virkelig din? Så tryk **This is my account** på panelets **You**-fane og tag det hurtige XP-tjek. Derefter bliver den nuværende ejer spurgt, eller Anvils staff afgør det. Du får aldrig at vide, hvem de er. Følg sagen under [Settings → Ownership claims](/settings/characters#claims).',
        },
      ],
      logHeading: 'Stadig i vanskeligheder? Send en admin en log',
      logBody:
        'Send en admin din RuneLite-log: `client.log` i mappen `.runelite/logs` i din brugermappe (på Windows: indsæt `%USERPROFILE%\\.runelite\\logs` i adresselinjen i Stifinder). Pluginnet skriver, hvad det så og hvorfor, ind i den, så de kan se præcis, hvad der gik galt.',
      missingNote: {
        tag: 'Mangler der beviser?',
        body: 'Pets og ekstra Champion’s scrolls kræver et manuelt screenshot. Pluginnet tager det for dig og gemmer det i `.runelite/osrs-bingo-pending/` — **Copy folder path** i Anvil-sidepanelet åbner mappen — så du vedhæfter det på siden i stedet for at lede efter et billede bagefter.',
      },
    },
    limits: {
      title: 'Kendte begrænsninger',
      intro:
        'Et par ting kan ikke spores perfekt — næsten altid på grund af, hvad selve spillet rapporterer, ikke Anvil. Løsningen er den samme hver gang: tag et skærmbillede og indsend det manuelt.',
      rows: [
        {
          term: 'Barraging og andre drab på flere mål',
          body: 'Antal drab (KC) kommer fra det, spillet rapporterer pr. drab, og trylleformularer med flere mål som Ice Barrage får det til at overse nogle, så **KC kan blive lavere** end det, du har dræbt. RuneLites egen Loot Tracker undertæller på samme måde — det er en begrænsning i spilmotoren, ikke en Anvil-fejl.',
        },
        {
          term: 'Combat Achievements, du har klaret før',
          body: 'Slå **repeat completion** til i spillets indstillinger for Combat Achievements. Uden den melder spillet ikke en opgave, du allerede har klaret, og pluginnet kan kun give point for det, spillet melder.',
        },
        {
          term: 'Yama-kontrakten som Combat Achievement',
          body: 'Spillet melder ikke denne igen, selv med repeat completion slået til, så pluginnet ser den aldrig. Tag et skærmbillede og indsend den manuelt.',
        },
        {
          term: 'Indsamlingsfelter uden pluginnet',
          body: 'Antal genstande — et antal fisk, malme, træstammer — står ikke på hiscores, så kun pluginnet kan spore dem. Uden det skal du tage skærmbillede af hvert inventar; eller, hvis genstanden vises i Loot Tracker, et skærmbillede nulstillet til 0 i starten og igen til sidst.',
        },
        {
          term: 'Implings, fisk, malme og andre genstandsgevinster',
          body: 'At fange implings og samle genstande (fisk, malme og alt andet, der tælles ud fra det, der lander i dit inventory) **registreres nogle gange ikke korrekt, selv med pluginnet**. Gem skærmbilleder undervejs, og hvis en optælling ser for lav ud, så rapportér det og indsend forskellen manuelt.',
        },
        {
          term: 'Fisketønder, brændekurve og andet opbevaring',
          body: 'Felter for item-gevinst tæller kun det, der lander i din inventory **direkte fra kilden** — et fiskested, en klippe, et træ. Alt, der tages ud af opbevaring (tømning af fisketønde, brændekurv, kul- eller ædelstenspose, urtesæk), købes i en butik, hæves fra banken eller samles op fra jorden, **tæller ikke**. Det holder feltet ærligt: ellers kunne den samme fisk fyldes i en tønde og tømmes ud igen i det uendelige. Fangster, du samler direkte i en tønde eller kurv, tæller ikke.',
        },
        {
          term: "Dobbelte pets og champion's scrolls",
          body: "Når du allerede har pet'en eller scrollen, siger spillet kun, at du har en **“funny feeling”** — den siger aldrig hvilken. Pluginnet regner det ud fra, hvad du lige har dræbt eller trænet, krediterer feltet og **markerer det, så staff kan tjekke det**. Kan det ikke afgøre det — to pets fra samme kilde, eller et pet uden et kill eller en skill bag (Bloodhound fra et master clue, et gamblet Jad- eller Zuk-pet, Chompy chick) — gemmes skærmbilledet i **Saved proofs**, så du kan indsende det manuelt.",
        },
      ],
    },
    screen: {
      title: 'På skærmen, mens du spiller',
      intro: 'Hvad pluginnet tegner og skriver, mens du spiller, og indstillingen bag hver.',
      rows: [
        {
          term: 'Fastgjorte felter',
          body: 'åbn et felt i sidepanelet og tryk **Track on screen** (op til 3). Med **Pinned tiles in one panel** til deler de ét lille panel: hvert felts navn, dit holds fremskridt og linjer som _3/5 runs_ eller hvilke dele af en kombination der er færdige. Fra får hvert sit eget større widget med dine holdkammerater og de andre hold. Alt-træk for at flytte det. Højreklik for **Unpin** eller **Unpin all**. Et færdigt felt viser **Done** og fjerner sig selv bagefter.',
        },
        {
          term: 'Startskud-kortet',
          body: 'mens et event venter på dit startskud, siger et kort **Starting shot needed** øverst på skærmen, hvor du skal hen, og viser hvert tjek med grønt eller rødt: relog, hvor længe din session har varet, og hvor mange felter du er fra stedet. En pejlepil og et verdenskortpin (**Anvil starting shot**) fører dig derhen. Med **Auto starting shot** til tages skuddet, så snart alt er grønt; så siger kortet **You’re tracked** og går. Indstilling: **Starting shot guide**.',
        },
        {
          term: 'Bannere',
          body: '**Tile complete!** når dit hold færdiggør et felt, dit eget drops fremskridt på et felt, og **New mission!**. Indstillinger: **Team completion popups** og **My tile popups**.',
        },
        {
          term: 'Vestige-ruller',
          body: 'ved Desert Treasure II-bosserne skriver hver unik en linje med, hvor du er i vestige-rotationen, f.eks. _Roll 2 of 4_ eller _the next unique is the vestige_. Den siger _(estimated)_, indtil den har set dig få en vestige. Ingen indstilling; den kører med eller uden event.',
        },
        {
          term: 'Lookup-autofuldførelse',
          body: 'når du skriver i **Lookup**-feltet, fuldfører den navnet for dig ud fra dine seneste opslag, venner, klanfolk online og spillere i nærheden. **Enter** accepterer. Den læser kun din egen klient; intet sendes.',
        },
        {
          term: 'Chatfarver',
          body: '**[Anvil] tag colour** og **Message colour** under **Chat messages**. Indtil du vælger, bliver de mørkt guld og sort på en uigennemsigtig chatboks, så de forbliver læselige. Hold musen over en Supporters navn i chatten for at se niveauet, f.eks. _Anvil Patron_.',
        },
      ],
    },
    sync: {
      title: 'Profilsynkronisering, og hvad den ellers sender',
      intro: 'Indstillingerne **Profile sync** udfylder din Anvil-profil. Alle fire er slået til fra start:',
      rows: [
        {
          term: 'Synkronisér samlingslog',
          body: 'hver samlingslogside du åbner, sendes til din profil.',
        },
        {
          term: 'Synkronisér hele loggen ved åbning',
          body: 'åbning af samlingsloggen sender hele den, ikke kun den side, du kigger på. For at gøre det på forespørgsel, tryk på knappen **Anvil** i samlingsloggens titellinje, eller **Sync profile** i sidepanelet mens loggen er åben. Chatten bekræfter det: _Profile synced — N collection log slots._',
        },
        {
          term: 'Synkronisér personlige rekorder',
          body: 'boss- og raidtider sendes, så snart du sætter dem.',
        },
        {
          term: 'Importér eksisterende rekorder én gang',
          body: 'én gang pr. karakter kopieres de personlige rekorder, RuneLite allerede har gemt på din computer: _Imported N personal best(s) from RuneLite._',
        },
        {
          term: 'Del højdepunkter med klanen',
          body: 'dine kæledyr, store drops, dødsfald, kampopgaver, levelmilepæle, nye logpladser, dagbøger og quests vises i din klans feed på siden og i chatfeedet hos spillere, der kan se dem. Nye logpladser, dagbøger og quests vises også i feedet for hvert live-bræt, du er med på.',
        },
      ],
      outro: 'Tre ting mere sendes uden en indstilling af egen. **Hvem dræbte dig**: monsteret eller spilleren, der havde dig som mål de sidste 15 sekunder, nævnes i feedet. **Spiltællere**: nogle felter tæller et tal, spillet selv holder, som Tithe Farm-point, Giants’ Foundry-omdømme, Doom-delves eller slayer-serier; kun stigninger tæller. **Leagues, Deadman og andre modes**: på de verdener sendes spillets egne linjer om relikvier, områder og opgaver, så din klan kan poste dem i sin mode-kanal.',
    },
  },

  admin: {
    metaTitle: 'Sådan afvikler du dit første event — Anvil adminguide',
    metaDescription:
      'Sæt en klan op på Anvil og kør en bingo fra ende til anden: Discord, medlemsliste, brætter, felter, hold og draft, opstart, og hvad der sker, når eventet slutter.',
    eyebrow: 'Anvil · til klanens stab',
    title: 'Sådan afvikler du dit første event',
    dek: 'Hele vejen, i den rækkefølge du faktisk går den: få {clanName} sat op, få medlemslisten ind, byg et bræt, draft hold, sæt det i gang, og del præmierne ud. Cirka en aftens arbejde for den første bingo — minutter for den næste.',
    facts: [
      { strong: '5 trin', rest: 'på opsætningstjeklisten' },
      { strong: '7 formater', rest: 'at bygge et bræt af' },
      { strong: '1 knap', rest: 'til at synkronisere medlemslisten' },
    ],
    footnote:
      'Denne vejledning følger appen, som den ser ud i dag. Passer en skærm her ikke med det, du kigger på, er appen rigtig, og vejledningen er forældet — [sig til](/feedback), så retter vi den.',

    access: {
      title: 'Hvem må hvad',
      intro:
        'Alle logger ind med Discord — der er ingen kodeord. Den første admin er ejeren, altså den der oprettede klanen; derefter forfremmer en admin folk fra **People → Staff & roles**. Rollerne stabler nedad: alt en moderator kan, kan en treasurer og en admin også.',
      rows: [
        {
          term: 'Admin',
          body: 'fuld adgang — events, felter, hold, indstillinger, stab, udbetalinger. Giv den til så få, som klanen kan holde ud.',
        },
        { term: 'Treasurer', body: 'alt hvad en moderator kan, plus tilmeldingsgebyrer og udbetalinger.' },
        {
          term: 'Moderator',
          body: 'det daglige: medlemsliste, verificeringer, beviser der skal tjekkes, ugentlige konkurrencer, kalenderen og klanevents. Kan ikke oprette eller redigere events.',
        },
        {
          term: 'Editor',
          body: 'kun oprettelse af felter. Giv den globalt, eller afgræns den til bestemte brætter, så en udefrakommende brætbygger kun kan røre det event, du har givet dem.',
        },
        { term: 'Member', body: 'spiller; har slet ingen adminflade.' },
      ],
      seeAlso:
        'To af de roller har deres egen side: [På vagt]({moderatorGuide}) om, hvad en moderator faktisk bruger sin aften på, og [Gebyrer og udbetalinger]({feesGuide}) til kassereren.',
      ownerNote: {
        tag: 'Ejer',
        body: 'Én konto er ejeren. Den kan ikke degraderes af andre og er den eneste rolle, der kan give ejerskabet videre — så en tabt diskussion med en med-admin kan aldrig koste dig klanen.',
      },
    },

    setup: {
      title: 'Navngiv klanen, forbind Discord',
      intro:
        '**Settings → Finish setup** er en kort guide (den bliver i menuen, indtil du er færdig), og dashboardet holder en tjekliste i fem trin, indtil de er klaret: navngiv klanen, forbind Discord, hent dine medlemmer, opret et event, tilføj felter. Status regnes ud fra rigtige data, så et trin bliver først flueben, når det virkelig er færdigt.',
      discord:
        'Til Discord har du to veje, og de kan kombineres: giv Anvil en **bot**, og den kan oprette webhooks, synkronisere roller og kaldenavne og bygge private holdkanaler for dig; giv den en enkelt **webhook-URL**, og den kan poste beskeder og intet andet. Start med webhooken, hvis du vil være i luften om to minutter, og tilføj botten, når du vil have automatikken.',
      permsNote: {
        tag: 'Bottens rettigheder',
        body: 'Botten skal bruge _Administrer webhooks_, _Administrer roller_, _Administrer kanaler_ og _Administrer kaldenavne_, og dens rolle skal ligge _over_ de roller, den styrer, i din servers rolleliste. Ellers nægter Discord i stilhed.',
      },
      hosted:
        'På en hostet plan har du mødt den skærm én gang før: det var ved at tilføje botten under opsætningen, at Anvil fandt ud af, hvilken server der er jeres — derfor var der aldrig et server-ID at kopiere. Det samme link ligger her, når du vil flytte botten til en anden server.',
    },

    channels: {
      title: 'Fordel opslag på flere kanaler',
      body: [
        'Alt lander som standard i én catch-all-kanal. Når den bliver larmende, åbner du **Discord → What goes where** og giver de larmende kategorier deres eget hjem — eventopslag, ugentlige konkurrencer, sjældne drops, dødsfald, PvP-kills, combat achievements. Alt du lader stå tomt falder tilbage til sin catch-all, så du kan flytte én kategori ad gangen.',
        'Med botten forbundet rører du aldrig en webhook-URL: vælg en kanal i rækkens dropdown-menu, så gemmes den. Under et travlt event kan du tilføje en webhook nummer to med **Add another** under **Post without a bot** — Anvil skifter mellem dem, så Discords rate limit ikke sluger opslag.',
      ],
      clipsNote: {
        tag: 'Klipkanalen er anderledes',
        body: 'Klipvideoer uploades direkte fra hver spillers PC til Discord — de passerer aldrig denne side. Derfor er klip-webhooken, du sætter her, den ene du _deler ud_: medlemmerne indsætter den selv i deres plugin. Alt andet på denne side er serverside, og medlemmerne ser det aldrig.',
      },
    },

    roster: {
      title: 'Få din medlemsliste ind',
      body: [
        'Medlemskab af klanen kommer ét sted fra: en synkronisering af medlemslisten inde fra spillet. Installér [Anvils RuneLite-plugin]({pluginGuide}) på en _admins_ konto, åbn dit klanvindue i spillet, og tryk på **Anvil**-knappen i dets titellinje. Det skubber jeres faktiske klanliste fra spillet op på siden med ét klik.',
        'At logge ind, linke en karakter eller spille med pluginet sætter aldrig nogen på medlemslisten. Ser pluginet nogen spille i jeres klan i spillet, før medlemslisten har dem, opretter det en anmodning om at komme ind; alle andre kan spørge med **Apply** på jeres klanside. Staben svarer på anmodninger øverst på **People → Roster**, og **People → Who can join** afgør, om folk venter på et ja, får en gæsteplads med det samme eller slet ikke kan spørge. Det er med vilje: ingen kommer ind i jeres klan ved at skrive dens navn. Hele billedet står i [Dine folk]({peopleGuide}).',
        'Du kan også tilføje nogen i hånden fra **People → + Add Manually** og tilmelde dem et event på deres vegne med **Add member** på eventets **Sign-ups**-side, når de ikke kan nå siden.',
      ],
    },

    board: {
      title: 'Opret dit første bræt',
      intro:
        '**Events → All events → + New event**. Vælg format først — det afgør, hvordan brættet giver point, og hvad resten af formularen spørger dig om.',
      formats: {
        classic: {
          label: 'Klassisk bingo',
          blurb: 'Et kvadratisk N×N-gitter — holdene tager felterne i vilkårlig rækkefølge, hvert felt tæller 1.',
        },
        leagues: {
          label: 'Point Hunt',
          blurb: 'En opgaveliste, hvor hvert felt har sin egen pointværdi — et vilkårligt antal felter.',
        },
        race: {
          label: 'Feltræs',
          blurb: 'En ordnet bane — holdene når felterne i rækkefølge; den, der når længst, vinder. Værten kan dele den i ruter, der deler sig og mødes — det felt, I klarer, vælger jeres vej.',
        },
        showdown: {
          label: 'Showdown',
          blurb:
            'Felterne er skjult indtil deres planlagte tidspunkt — sæt hver afsløring på Tiles-fanen. Pointbaseret, i DMM All Stars-stil.',
        },
        luckydraw: {
          label: 'Lykketrækning',
          blurb:
            'En bankospiller: skjulte felter går live i tilfældige trækninger med faste mellemrum. Pointbaseret.',
        },
        bounty: {
          label: 'Dusørjagt',
          blurb:
            'Ét åbent felt ad gangen — det første hold, der gør det færdigt, tager pointene, og den næste dusør trækkes.',
        },
        ladder: {
          label: 'Stige',
          blurb:
            'En pointbaseret opgaveliste rangeret som en individuel leaderboard (hold er valgfrit). Opgaverne roterer — progressivt, én ad gangen eller i et rullende vindue — og kan falde i værdi. I stil med en månedsstige.',
        },
      },
      outro:
        'Sæt derefter datoerne, tilmeldingsvinduet, og om tilmelding koster et gebyr. Start fra en skabelon, hvis du helst ikke vil starte med et tomt gitter — galleriet rummer både de indbyggede skabeloner og ethvert bræt, du selv har gemt som skabelon.',
      seeAlso:
        'Formatet er kun den halve beslutning — hvordan felter bliver spilbare er den anden halvdel, og de to lægger sig oven på hinanden. Begge dele i sin helhed: [Formater, og hvordan felter åbner]({formatsGuide}).',
      utcNote: {
        tag: 'Datoer er UTC',
        body: 'Alle tidsstempler i Anvil gemmes og sammenlignes i UTC og vises i hver besøgendes lokale tid. Sæt det sluttidspunkt, du mener; siden viser en brite og en australier to forskellige ure for det samme øjeblik.',
      },
    },

    tiles: {
      title: 'Fyld brættet',
      body: [
        'Eventets **Board & tiles**-side er der, hvor et bræt bliver til en bingo. Hvert felt er én _slags_ opgave, og slagsen afgør, hvad pluginnet holder øje med: et drop, en boss-killcount, skill-XP, et NPC-kill, en tid at slå, en achievement diary, en combat achievement, en collection log-oplåsning, et PvP-kill, en gevinst i inventory eller en tur uden dødsfald. Manuelle felter — dem et menneske godkender ud fra et screenshot — er også altid en mulighed.',
        'Til et helt bræt er det hurtigere at skrive dem i bulk: eksportér arket, udfyld det i et regneark, og importér det tilbage. Både CSV og .xlsx kan gå frem og tilbage, og rækkerne følger positionerne, så du kan skrive et helt 25-felters gitter om i én indsætning.',
      ],
      rows: [
        {
          term: 'Sværhedsgrader',
          body: 'pointværdier oversættes til navngivne bånd (easy → elite). Rediger båndene under **Clan settings → Rules & scoring → Difficulty & balance**, hvis din klan graduerer anderledes.',
        },
        {
          term: 'Balance-revisor',
          body: 'gennemgår et færdigt bræt for strukturelle problemer og skæv arbejdsbyrde, før spillerne overhovedet ser det.',
        },
        {
          term: 'Skjult indtil afsløring',
          body: 'nye brætter starter skjulte. Staben ser dem altid; spillerne ser ingenting, før du afslører — så et bræt kan bygges i åbenhed uden at blive spoleret.',
        },
      ],
      seeAlso:
        'Hvilken type du skal gribe fat i, hvordan du skriver to hundrede af dem i et regneark, og de fejl der importerer pænt og så aldrig udløses: [Byg et bræt, der tracker sig selv]({boardGuide}).',
    },

    teams: {
      title: 'Hold og draft',
      body: [
        'Siden **Teams & draft** retter sig efter det format, du valgte: et format uden hold springer den helt over. Til en almindelig holdbingo opretter du holdene, bestemmer hvem der er kaptajner, og enten fordeler spillerne selv eller kører en live draft.',
        'Kaptajnerne drafter fra tilmeldingspuljen i den rækkefølge, du vælger, og hver kaptajn kan se de svar, folk gav i tilmeldingsformularen — fastfrosset som de blev indsendt, så ingen redigerer deres “timer om ugen”, efter de er blevet valgt.',
      ],
      placementIntro:
        'Du behøver ikke at drafte. **Team placement**, på oprettelsesformularen og fanen **Sign-ups**, bestemmer, hvor hver ny tilmelding havner:',
      placementRows: [
        {
          term: 'Auto-balance',
          body: 'hver person, der tilmelder sig, kommer på holdet med færrest spillere. Du vælger kun, hvor mange hold der er. Godt til store offentlige events.',
        },
        {
          term: 'Players pick',
          body: 'du laver holdene først, og hver spiller vælger et på tilmeldingsformularen. Sæt en grænse pr. hold for at holde dem lige.',
        },
        {
          term: 'Host drafts',
          body: 'alle venter i en pulje, indtil du eller dine kaptajner drafter dem eller sætter dem på et hold i hånden. Bedst, når du kender spillerne.',
        },
        {
          term: 'Solo',
          body: 'slet ingen hold. Hver spiller er for sig selv, opkaldt efter sin karakter, og stillingen rangerer spillere.',
        },
      ],
      lockNote: {
        tag: 'Draften låser holdene',
        body: 'Så snart en draft er gået i gang, er både holdene og pickrækkefølgen låst. Tilføj det hold, du glemte, _inden_ du trykker start — ikke efter.',
      },
      seeAlso:
        'Send dine kaptajner [kaptajnguiden]({captainGuide}) før draftaftenen — krigsrummet er mest værd i dagene før, og ingen læser en ny skærm, mens et ur kører.',
      visitingClans:
        'Spiller I mod en anden klan i stedet for at drafte jeres egne? En gæsteklan stiller sin egen trup gennem ét link, og deres moderator styrer den uden en adminkonto her — se [Vær vært for en gæsteklan]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Start og kør det',
      body: [
        'Afslør felterne, og start så eventet. Anvil nægter at starte et bræt, der ikke er klar — en draft midt i forløbet, eller spillere uden hold — og fortæller dig hvilket. Ved du bedre (en træningskamp, en genkørsel, et bræt du tester), kan du tvinge det igennem.',
        'Derefter kører det stort set sig selv. Pluginnet krediterer automatisk alt, det kan se, og poster bevis-screenshots stemplet med hold og et UTC-tidsstempel. Det, der lander på dit bord, er:',
      ],
      rows: [
        {
          term: 'Indsendelser til godkendelse',
          body: 'manuelle felter og alt, pluginnet har markeret. Godkend eller afvis med beviset foran dig.',
        },
        {
          term: 'Statistik',
          body: 'eventets Stats-fane viser bidraget pr. spiller — nyttigt når et hold diskuterer, hvem der bar hvem.',
        },
        {
          term: 'Beskeder',
          body: '**Post to Discord** (under **Clan** i menuen) sender en besked som botten til en hvilken som helst kanal midt i eventet, uden at du selv skal skrive en webhook.',
        },
      ],
      missionNote: {
        tag: 'Overraskelser undervejs',
        body: 'Du kan slippe en **mission** løs på en igangværende bingo — et skjult bonusfelt, der bliver annonceret, når du fyrer det af, og som eventuelt falder i værdi eller udløber. Det er den billigste måde at vække et bræt på dag fem.',
      },
      startProofNote: {
        tag: 'Sådan stopper du hamstring før eventet',
        body: [
          'Slå **Starting shot** til (event → Home → **Extras**), så skal hver spiller aflevere ét screenshot taget efter, at eventet er gået i gang, på et sted Anvil trækker i selve startøjeblikket — så ingen kan sidde på en uges opsparede clues og kister ved T0. Stedet annonceres sammen med starten; hver spillers kodeord er personligt, udledt af trækningen, og findes ikke, før eventet starter, så det kan ikke stilles op i forvejen af nogen.',
          'Sæt stederne på verdenskortet (puljeeditoren har et), så tjekker pluginnet, at spillerne rent faktisk står der, i stedet for bare at have fået besked på det. Du kan også kræve en **frisk session** — 15 minutter som standard: hiscores gemmes kun, når en spiller logger ud, så det at få alle til at relogge lige inden deres billede er dét, der gør starttallene bag hvert XP- og KC-felt ærlige.',
          'Plugin-brugere trykker på én knap. Alle andre skriver deres kodeord i spillet og uploader på My Team. Du bestemmer, hvad der sker med en kredit fra en, der ikke har afleveret: markér den til gennemsyn (standard), eller afvis den, indtil de gør. Det samme panel på eventets Home er gennemsynslisten — billeder fra pluginnet med et verificeret kodeord ankommer allerede godkendt, så i praksis kigger du kun mobilspillerne efter.',
        ],
      },
    },

    after: {
      title: 'Efter det sidste felt',
      intro:
        'Når uret løber ud, fryser brættet, og eventet låses — point, bidrag og hvem-gjorde-hvad fastfryses, som de stod. Skal noget rettes bagefter, kan en admin bevidst låse det op igen.',
      rows: [
        {
          term: 'Udbetalinger',
          body: 'eventets **Prizes**-side laver præmiepuljen om til en liste over, hvem der får hvad, og følger med, mens du betaler ud.',
        },
        {
          term: 'Opsamling',
          body: 'en offentlig opsamlingsside med de endelige stillinger og sjove kåringer — største drop, flest kills og resten.',
        },
        {
          term: 'Spørgeskema',
          body: 'spørg klanen, hvad de synes. Byg det på Survey-fanen; spillerne svarer, når eventet er slut, og kun staben ser resultaterne.',
        },
        {
          term: 'Gem som skabelon',
          body: 'behold det bræt, du lige har bygget, fra eventets **Settings → More**. Næste bingo starter fra det i stedet for et tomt gitter.',
        },
      ],
      federation:
        'Med federation slået til kan medlemmerne også forbinde sig til andre Anvil-klaner fra pluginnet — praktisk til events på tværs af klaner, og helt frivilligt for det enkelte medlem.',
      outro: 'Send så dine medlemmer videre til [opsætningsguiden til spillere]({pluginGuide}), og begynd at planlægge den næste.',
    },
    survey: {
      title: 'Spørg spillerne',
      intro: 'Slå **Post-event survey** til under **Features**, og åbn så eventets **Survey**-side.',
      body: [
        'Under **Build** tilføjer du spørgsmål: **Rating (1–5)**, **Free text**, **Choose one** eller **Choose many**, hver især valgfrit **Required**. Eller indlæs en skabelon: **Bingo wrap-up**, **Quick pulse**, **PvM mass**, **Raid team** eller **Skilling / social**. **Preview the participant view** viser den, sådan som en spiller ser den.',
        'Den åbner, når eventet slutter, kun for godkendte deltagere, og de kan ændre deres svar senere. **Results** viser svar **By question** eller **By person**. Den er ikke anonym: staben ser, hvem der sagde hvad.',
      ],
    },
  },

  clanVsClan: {
    metaTitle: 'Vær vært for en gæsteklan — Anvil værtsguide',
    metaDescription:
      'Kør en clan-mod-clan på Anvil: giv hver gæsteklan et invitationslink, der sætter deres spillere på ét hold, og en plads så deres egen moderator styrer deres halvdel.',
    eyebrow: 'Anvil · til værter',
    title: 'Vær vært for en gæsteklan',
    dek: 'Du er vært for brættet; de stiller truppen. Det er den vej, der sparer dig for at samle et dusin RSN’er ind i en DM — ét link pr. hold, og en plads der lader deres egen moderator styre deres halvdel af eventet.',
    facts: [
      { strong: '1 link', rest: 'pr. gæstehold' },
      { strong: '0 adminpladser', rest: 'givet til udefrakommende' },
      { strong: '~5 min', rest: 'pr. klan du inviterer' },
    ],
    footnote:
      'Skærmbillederne er fra en rigtig opsætning på et testbræt — invitationstokens og Discord-navne er slørede. Et rigtigt link er værd at passe på: alle, der har det, kan tage en plads på det hold, så længe det er aktivt.',

    teamCompsLine: "Vil du have klaner til at konkurrere på færdigheder eller bosser i stedet? Se [Holdkonkurrencer]({teamCompsGuide}).",

    shape: {
      title: 'Det, du er ved at sætte op',
      body: [
        'En clan-mod-clan er et helt almindeligt event med én forskel: halvdelen af spillerne er ikke i din klan og bliver det aldrig. De kan ikke synkroniseres ind fra medlemslisten, du vil ikke forfremme dem, og du vil bestemt ikke tilmelde tyve af dem i hånden og derefter trække hver enkelt over på det rigtige hold.',
        'To ting løser det, og de er uafhængige — brug den ene, eller begge.',
      ],
      rows: [
        {
          term: 'Et invitationslink',
          body: 'en URL, du laver én gang til ét hold. Den, der åbner den, logger ind, udfylder den normale tilmeldingsformular og lander på det hold allerede godkendt — ingen draftpulje, ingen godkendelseskø.',
        },
        {
          term: 'En plads i holdstaben',
          body: 'en navngiven person, der kan styre _netop det ene hold_ — dets trup, dets indsendelser og beviser, dets gebyrer — uden en adminkonto her, og uden at tage kaptajnpladsen fra den, der faktisk spiller.',
        },
      ],
      note: {
        tag: 'Hvad et invitationslink ikke er',
        body: 'Det er ikke et login og ikke en genvej uden om verificering. Den, der åbner det, logger stadig ind med Discord og skal stadig have et verificeret RSN, præcis som ved enhver anden tilmelding. Det eneste, linket afgør, er _hvilket hold_ tilmeldingen kommer på, og at den ikke skal godkendes af nogen.',
      },
    },

    team: {
      title: 'Lav holdet først',
      body: [
        'Åbn dit event og gå til siden **Teams & draft**. Opret ét hold pr. klan, du har inviteret, og opkald det efter dem — navnet er det, deres spillere ser i tilmeldingsformularen, så “Ironforge” slår “Hold 2”.',
        'Du behøver _ikke_ køre en draft. Invitationslinks og en draft er alternativer: en draft fordeler en fælles tilmeldingspulje, et link sætter folk direkte på plads. Ved en ren clan-mod-clan opretter de fleste værter holdene, deler ét link ud til hver, og åbner aldrig draften.',
        'Åbn så selve holdet — **Teams & draft → holdet** — for det er der, begge de næste to trin foregår.',
      ],
      captainNote: {
        tag: 'Kaptajnen først',
        body: 'Udpeg gæsteklanens kaptajn, før du deler linket ud, så holdsiden har en ejer fra starten. At udpege en kaptajn sætter dem samtidig på holdet; advarer kortet om, at de ikke står på truppen, så tag imod den rettelse, det tilbyder.',
      },
    },

    staff: {
      title: 'Giv deres moderator en plads',
      body: [
        'Panelet **Team staff** på holdsiden er måden, gæsteklanens egen moderator kommer i gang på, uden at du giver dem noget som helst på din side. Tryk **Add someone**, søg dem frem, skriv en note som “Ironforges mod”, så den næste admin ved, hvorfor de er der, og tryk **Give a seat**.',
      ],
      figure: {
        caption: 'Event → Teams & draft → holdet → Team staff',
        alt: 'Team staff-panelet med én tildelt plads og søgefeltet til at tilføje flere åbent',
        legend: [
          {
            label: 'Add someone',
            body: 'åbner søgningen. Kun folk, der har logget ind her med Discord mindst én gang, kan dukke op — se noten nedenfor.',
          },
          {
            label: 'Noten',
            body: 'fri tekst, 120 tegn. Skriv hvilken klan de kommer fra. Pladser bliver stående på listen efter eventet, og “hvem er det her?” er præcis det spørgsmål, du sidder med om tre måneder.',
          },
          {
            label: 'Remove',
            body: 'tager pladsen tilbage med det samme. Gør det, når eventet er slut — en plads er ikke tidsbegrænset af sig selv.',
          },
        ],
      },
      canDo: 'Hvad en plads kan, udelukkende på det hold:',
      canDoList: [
        'se og styre holdets trup',
        'håndtere dets indsendelser og beviser',
        'markere dets spilleres gebyrer som betalt',
        'lave invitationslinks til det, hvis du slår det til (næste trin på nær ét)',
      ],
      cantDo: 'Hvad den aldrig kan:',
      cantDoList: [
        'røre noget som helst andet hold',
        'redigere brættet eller dets felter',
        'foretage draftvalg',
        'skifte nogen ud, når eventet først er i gang',
      ],
      note: {
        tag: 'De skal logge ind her først',
        body: 'Søgningen viser kun konti med et forbundet Discord — en plads hænger på en person, der rent faktisk kan logge ind. Så send gæsteklanens moderator ind på siden, få dem til at trykke **Login** én gang, og giv _derefter_ pladsen. Dukker de ikke op i søgningen, er det login ikke sket endnu.',
      },
    },

    link: {
      title: 'Lav invitationslinket',
      body: [
        'Stadig på holdsiden: panelet **Invite links** laver linket. To felter afgør, hvad linket lover, og begge forstår `0` som “lov ikke noget”.',
      ],
      figure: {
        caption: 'Event → Teams & draft → holdet → Invite links',
        alt: 'Invite links-panelet med felterne til pladser og udløb, knappen Make a link, og ét aktivt link på listen',
        legend: [
          {
            label: 'Seats og Expires in hours',
            body: 'hvor mange personer linket må sætte på plads (op til 100), og hvor længe det holder (op til 30 dage). Sæt pladserne til størrelsen på den trup, de har lovet dig, så lukker linket sig selv, når de alle er inde; sæt et udløb, når linket skal ud i en offentlig Discord. `0` i et af felterne betyder ingen grænse.',
          },
          {
            label: 'Make a link',
            body: 'laver det og kopierer det til din udklipsholder med det samme. Send det til dem, før du gør noget andet.',
          },
          {
            label: 'Listen over aktive links',
            body: 'alle links, holdet har ude, med hvor mange der er kommet ind, og hvor mange pladser der er tilbage. **Copy** henter det igen; **Turn off** dræber det for altid.',
          },
        ],
      },
      shape:
        'Linket ser sådan ud: `{origin}/events/{eventId}/join/{token}` — én linje, sikker at indsætte i en Discord-besked.',
      note: {
        tag: 'Fornuftige standardvalg',
        body: 'Til en clan-mod-clan, hvor du har aftalt truppen med én moderator, så lad begge felter stå på `0`, og lad dem styre det. Grib til pladser og udløb, når linket skal et sted hen, du ikke selv kontrollerer.',
      },
      revoke:
        'At slukke et link virker med det samme og fjerner ikke nogen, der allerede er kommet ind — de er helt almindelige spillere på holdet nu. Vil du tage nogen af, gør du det fra holdets trup.',
    },

    captains: {
      title: 'Lad dem lave deres egne links',
      body: [
        'Som udgangspunkt er det kun en vært, der kan lave links, og en kaptajn, der prøver, får det at vide. Den standard er rigtig til et almindeligt klanevent — en kaptajn, der deler pladser ud, ville fylde en trup, ingen har godkendt — og forkert til en clan-mod-clan, hvor gæsteklanen kender sin egen trup bedre end du gør.',
        'Kontakten sidder på det samme **Invite links**-panel: **Let captains make their own links**. Den gælder _hvert hold i dette event_, ikke kun det, du står på — hvilket netop er, hvad du vil have, når begge sider er gæsteklaner.',
        'Med den slået til kan holdets kaptajn og alle med en plads i holdstaben selv lave links fra **My Team → Invite links**. De får det samme panel som dig, minus kontakten.',
      ],
      figure: {
        caption: 'My Team → holdet → Invite links',
        alt: 'Invite links-fanen set fra kaptajnens side i holdcentret, med felterne til pladser og udløb og ét aktivt link',
        legend: [
          {
            label: 'Samme panel, kaptajnens udgave',
            body: 'lav, kopiér, sluk. Har værten ikke slået kontakten til, står der “Only a host can make links for this event”, og felterne er væk.',
          },
          {
            label: 'Listen over aktive links',
            body: 'en kaptajn, der ikke må lave links, kan stadig se dem, holdet har ude — så de kan bede dig om et til i stedet for at gå ud fra, at der ingen er.',
          },
        ],
      },
    },

    player: {
      title: 'Det, deres spillere ser',
      intro:
        'Værd at gå igennem én gang selv, før du deler linket ud, så du kan svare på spørgsmål om det.',
      steps: [
        'De åbner linket. Er de ikke logget ind, logger de ind med Discord først og kommer direkte tilbage — linket går ikke tabt undervejs.',
        'De lander på den helt normale tilmeldingsformular med et banner, der siger **You’re joining {teamExample} by invite**. Samme spørgsmål, samme kontovælger, samme gebyr som alle andre.',
        'Når de sender ind, er de på holdet og godkendt. Ingen handling fra værten, ingen draft.',
      ],
      figure: {
        caption: 'Tilmeldingsformularen, åbnet gennem et invitationslink',
        alt: 'Eventets tilmeldingsformular med et banner om, at spilleren er ved at komme på et navngivet hold via invitation',
        legend: [
          {
            label: 'Invitationsbanneret',
            body: 'nævner det hold, de er ved at komme på. Står der et forkert hold, har de det forkerte link — stop og tjek, inden de sender ind.',
          },
          {
            label: 'Resten af formularen',
            body: 'uændret. Et verificeret RSN er stadig påkrævet, tilmeldingsspørgsmålene bliver stadig stillet, og et tilmeldingsgebyr gælder stadig.',
          },
        ],
      },
      note: {
        tag: 'Allerede tilmeldt?',
        body: 'Har nogen meldt sig til på normal vis først og sidder i puljen, flytter linket dem over på holdet i stedet for at oprette en ekstra tilmelding. En, der allerede er godkendt på et andet hold, bliver ladt i fred — flyt dem fra truppen i stedet.',
      },
    },

    dead: {
      title: 'Når et link holder op med at virke',
      intro:
        'Et afvist link forklarer sig selv på siden i stedet for at give en 404, så den, der sidder med det, kan fortælle dig, hvilken af disse det er.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Nogen har trykket **Turn off**. Lav et nyt — et gammelt link kommer aldrig tilbage.',
        },
        {
          term: 'This invite has expired.',
          body: 'Det ramte de timer, du satte. Lav et nyt, denne gang med `0` timer, hvis udløbet ikke gør nogen nytte.',
        },
        {
          term: 'This invite is full.',
          body: 'Alle pladser er taget. Du hæver det ved at lave et nyt link med flere pladser — antallet ligger fast, når først et link findes.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'Den eneste, der kan løse sig selv. Tjek eventets tilmeldingsvindue: er det åbnet endnu, er fristen løbet ud, eller er eventet allerede gået i gang.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Et link fra et andet bræt er blevet indsat. Tjek at event-id’et i URL’en er det, du mente.',
        },
      ],
      checklist: 'Gå denne liste igennem én gang pr. gæsteklan, inden eventet går i gang:',
      checklistItems: [
        'deres hold findes og er opkaldt efter dem',
        'deres kaptajn er udpeget og sidder på holdet',
        'deres moderator har logget ind her og har en plads i holdstaben',
        'linket er lavet, kopieret og faktisk afleveret til et menneske',
        'tilmeldingsvinduet er åbent, så længe de har brug for det',
      ],
      note: {
        tag: 'Når det er slut',
        body: 'Sluk linkene og fjern pladserne i holdstaben. Ingen af delene udløber af sig selv, og et aktivt link på et afsluttet event er bare en løs ende.',
      },
    },
    cohost: {
      title: 'Hvis du er medvært',
      intro: 'Alt ovenfor er værtens side. Den besøgende klans stab får deres egen side for eventet, **Co-hosted with <host>**. Værten beholder datoerne, kladden, holdene og hvem der kan se det.',
      rows: [
        {
          term: 'Jeres klans tilmeldinger',
          body: '**Approve**, **Reject** eller **Withdraw** din egen klans spillere. Du ser eller rører aldrig værtens.',
        },
        {
          term: 'Brættet',
          body: 'du kan kun redigere, hvis værten gav din stab det. Ellers kan du **Suggest a tile**: feltet, detaljer og point, op til 25 ventende ad gangen. Hvert vises som **waiting**, **accepted ✓** eller **turned down** med værtens begrundelse.',
        },
        {
          term: 'Dit hold',
          body: '**Manage** din klans hold.',
        },
        {
          term: 'Discord',
          body: 'dine admins vælger, hvad der når din egen server: **Everything shared**, **Big moments** eller **Nothing**, hvilken kanal, hvem der får en ping, og om dine spillere får rollen **@Bingo player**.',
        },
      ],
    },
  },
  board: {
    metaTitle: 'Byg et bræt — Anvils vejledning til feltopsætning',
    metaDescription:
      'Lav bingofelter, der krediterer sig selv: hvad hver felttype rent faktisk kan se, masseoprettelse via regneark, og de fejl der går galt i stilhed.',
    eyebrow: 'Anvil · til brætbyggere',
    title: 'Byg et bræt, der tracker sig selv',
    dek: 'Et felt er et løfte om, at nogen lægger mærke til noget. Her står, hvad hver type faktisk kan se, hvordan du skriver to hundrede af dem uden at bruge hele aftenen, og de få fejl der går galt i stilhed — feltet udløses bare aldrig, og ingen opdager det før dag fire.',
    facts: [
      { strong: '15 typer', rest: 'én pr. felt, aldrig blandet' },
      { strong: '1000 felter', rest: 'pr. bræt, via regneark' },
      { strong: 'I stilhed', rest: 'er sådan et dårligt felt fejler' },
    ],
    footnote:
      'Regnearksformatet er beskrevet fuldt ud i `docs/tile-authoring.md`, som er skrevet til den (eller det), der genererer rækkerne. Denne side er den menneskelige halvdel: hvilken type du skal gribe fat i, og hvad der går galt.',

    kinds: {
      title: 'Ét felt, én type',
      body: [
        'Hvert felt er præcis én _type_, og typen er hele spørgsmålet: den afgør, hvad pluginnet eller hiscores-sweepet holder øje med, og dermed om feltet overhovedet kan blive færdigt af sig selv. Blander du felter fra to typer, bliver det afvist ved døren i stedet for accepteret og efterladt i stykker.',
        'Typerne falder i tre familier, og familien betyder mere end navnet:',
      ],
      families: [
        {
          term: 'Manuel',
          body: 'et menneske kigger på et screenshot og siger ja. Altid muligt, virker altid, koster altid nogen deres aften. Brug den til det, software ikke kan se.',
        },
        {
          term: 'Hiscores-hentet',
          body: 'skill-XP og boss-killcount, læst fra de officielle Hiscores i et sweep hvert 15. minut. Kræver intet plugin og virker for alle på medlemslisten — men ser kun det, Hiscores tæller, og først når spilleren logger ud.',
        },
        {
          term: 'Plugin-registreret',
          body: 'alt andet: drops, NPC-kills, tider, diaries, combat tasks, omgange, lootværdi. Krediterer inden for sekunder og bager et bevis-screenshot — men kun for spillere, der faktisk kører pluginnet.',
        },
      ],
      kindsIntro: 'Hele listen, som typevælgeren tilbyder dem:',
      kindLabels: {
        standard: { label: 'Standard', blurb: 'Manuelt felt — en kaptajn markerer det som gjort. Ingen automatisk tracking.' },
        skill: { label: 'Skill', blurb: 'Bliver færdigt automatisk, når en skill når et XP-mål (hentet fra hiscores).' },
        boss: { label: 'Boss-KC', blurb: 'Bliver færdigt automatisk, når en boss når et killcount-mål (hentet fra hiscores).' },
        drop: { label: 'Drop', blurb: 'N drops af et item (eller hvilket som helst fra en pulje) — registreret af pluginnet, med indbagt screenshot.' },
        collection: { label: 'Itemsæt', blurb: 'Flere items, hver med sit eget krævede antal — 1× af hver til et fuldt sæt.' },
        kill: { label: 'Kills', blurb: 'N kills af en hvilken som helst boss eller monster. Talt fra hiscores, når hvert monster på feltet står der, ellers af pluginnet mens du spiller (høns, køer, Slayer-monstre).' },
        lap: { label: 'Agility-omgange', blurb: 'N omgange på en agility-bane, eller N etager / hele runs i Hallowed Sepulchre — talt live fra tælleren i spillet. Kun omgange løbet under eventet tæller.' },
        pvp: { label: 'PvP-kill', blurb: 'Dræb spillere — hvem som helst, rivaliserende hold, eller en navngiven dusør — i Wilderness eller på PvP-verdener. Sikre minigames tæller aldrig.' },
        gain: { label: 'Item-gevinst', blurb: 'Fang, tilbered eller saml N af et item — talt fra det, der lander i inventory. Registreret af pluginnet.' },
        timed: { label: 'På tid', blurb: 'Gennemfør en aktivitet under et tidsloft (Inferno, raids, Colosseum). Pluginnet tager tid.' },
        deathless: { label: 'Uden dødsfald', blurb: 'Gennemfør et raid med NUL dødsfald i holdet, N gange. Pluginnet tæller hvert dødsfald inde i instansen.' },
        lms: { label: 'LMS', blurb: 'Bliv top-N i Last Man Standing (1 = sejr), M gange. Registreret af pluginnet, når spillet slutter.' },
        value: { label: 'Lootværdi', blurb: 'Loot for X gp — ét udbytte, eller flere der tilsammen når et mål. Pluginnet prissætter udbyttet.' },
        diary: { label: 'Diary', blurb: 'Gennemfør achievement diary-tiers under eventet. Registreret af pluginnet ud fra beskeden om gennemførelse.' },
        ca: { label: 'Combat task', blurb: 'Gennemfør Combat Achievement-opgaver under eventet. Registreret af pluginnet ud fra beskeden om gennemførelse.' },
      },
      note: {
        tag: 'Plugin-spørgsmålet, stillet én gang',
        body: 'Et plugin-registreret felt er usynligt for en spiller, der ikke kører pluginnet. Det er ikke en fejl, du kan konfigurere væk — der er ingen, der kigger. Spiller en del af din klan på mobil eller i den officielle klient, så hold enten den slags felter væk fra vejen til sejren, eller sæt et manuelt alternativ ved siden af og forvent at skulle godkende screenshots.',
      },
    },

    pick: {
      title: 'Vælg den type, der rent faktisk udløses',
      intro:
        'De fleste felter, der opfører sig dårligt, er den rigtige idé udtrykt som den forkerte type. De fire, der fanger folk:',
      rows: [
        {
          term: 'En boss-liste plus ét monster uden for hiscores',
          body: 'er et plugin-felt for **det hele**. Et Kills-felt tælles kun fra hiscores, når hvert monster på det står der; læg en høne til fire GWD-bosser, og hele feltet kræver pluginnet. Spiller en del af klanen uden, så giv hiscores-bosserne deres eget felt.',
        },
        {
          term: 'En collection log-plads',
          body: 'er et drop-felt. Oplåsningen af log-feltet krediterer det, så feltet udløses også på en dublet, spilleren allerede havde — hvilket som regel er det, du mente.',
        },
        {
          term: '“Få én af hver”',
          body: 'er et drop-felt med en itemliste og **uden** `requiredAmount`. Tilføjer du et `requiredAmount`, bliver det i stilhed til “få hvilke som helst N af disse” — samme række, et helt andet felt.',
        },
        {
          term: 'En diary eller combat task',
          body: 'krediterer kun ud fra beskeden i spillet, som kun kommer i det øjeblik, tieren eller opgaven bliver færdig. Noget en spiller allerede ejer, kan ikke udløses igen — undtagen en combat task, hvor **Settings → Combat Achievements → Repeat completion** lader dem udløse den forfra.',
        },
      ],
      note: {
        tag: 'Sammensatte boss-felter',
        body: 'Et boss-felts trackede stat må rumme flere hiscores-nøgler adskilt af komma, og fremgangen lægges sammen på tværs af dem. `chambersOfXeric,chambersOfXericChallengeMode` er ét felt, der tæller CoX og CM sammen — hvilket næsten altid er, hvad et raid-felt betyder.',
      },
    },

    bulk: {
      title: 'Skriv dem i bulk, ikke i browseren',
      body: [
        'At klikke sig gennem et 25-felters gitter er fint. At klikke sig gennem et Point Hunt-bræt med 200 opgaver er det ikke — og at læse korrektur bagefter er værre. Tiles-fanen har en tur-retur bygget til præcis det.',
      ],
      steps: [
        '**Download spreadsheet** på eventets **Board & tiles**-side. Du får en .xlsx af brættet, som det ser ud nu, med dropdowns, itemlisten og kolonnevejledningen på hver sit ark.',
        'Ret i det. Én række pr. felt; rækkefølgen af rækker er rækkefølgen af felter.',
        '**Upload CSV / Excel** på samme fane. Kun **Tiles**-arket bliver læst.',
      ],
      rules: [
        {
          term: 'Turen frem og tilbage taber intet',
          body: 'hent ned og læg op igen uden ændringer, og der sker ingenting — rækker, der matcher, rapporteres som uændrede og bliver ikke engang tidsstemplet. Det gør eksporten sikker at bruge som backup før en stor omgang rettelser.',
        },
        {
          term: 'Rækker følger positioner',
          body: 'række 1 er felt 1. Eksisterende felter opdateres på stedet, og en kolonne, du udelader, bliver ladt i fred i stedet for tømt — så du kan sende et ark med to kolonner, der kun retter point.',
        },
        {
          term: 'Kun dynamiske brætter vokser',
          body: 'ekstra rækker opretter nye felter på et Point Hunt-bræt eller et feltræs, før eventet starter, op til 1000. Et klassisk N×N-gitter har en fast form og ignorerer dem. Skal du generere hundredvis af opgaver, så lav det som et Point Hunt-event.',
        },
        {
          term: 'Alt eller intet',
          body: 'alle rækker valideres først. Ét itemnavn, der ikke kan slås op, får hele importen til at fejle, nævner synderne og ændrer ingenting — du ender aldrig med et halvt bræt.',
        },
        {
          term: 'Nogle felter låser ved start',
          body: 'navn, type, krævet antal og itemopsætning bliver kun anvendt, før eventet starter. Beskrivelse, point, kategori og valgfri-flaget kan redigeres hele vejen, så du kan rette en tastefejl midt i eventet uden at åbne brættet igen.',
        },
      ],
    },

    traps: {
      title: 'De fejl, der går galt i stilhed',
      intro:
        'Hver eneste af dem importerer uden problemer, står på brættet og ser rigtig ud, og udløses aldrig. De er værd at læse igennem før uploaden frem for efter.',
      rows: [
        {
          term: 'Skill- og boss-felter er `type=standard`',
          body: 'der findes ikke noget `type=skill`. Typen kommer fra `trackedStat` + `statType` + `statGoal` på en ellers helt almindelig standard-række. At skrive `type=boss` bliver afvist; at skrive `type=standard` og glemme stat-kolonnerne bliver det ikke — så har du et manuelt felt, ingen nogensinde godkender.',
        },
        {
          term: 'Separatorerne er forskellige fra kolonne til kolonne',
          body: '`items` bruger semikolon (komma er CSV-separatoren). `targetNpcs` bruger lodrette streger. På en combat task-række er lodret streg den **eneste** mulighed, fordi rigtige opgavenavne indeholder komma — `Nylocas, On the Rocks` er én opgave.',
        },
        {
          term: 'Raid-navne matches ord for ord',
          body: 'et deathless- eller tidsfelt bærer tilstanden præcis som den staves i spillet: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. En stavemåde, der er tæt på, er et felt, der aldrig bliver færdigt. Entry Mode-runs krediterer aldrig et almindeligt raid-felt; sværere tilstande gør.',
        },
        {
          term: 'Itemnavne skal være præcise',
          body: 'stavemåden fra spillet, ellers fejler importen og lister det, den ikke kunne slå op. Er et navn flertydigt, så lås det fast som `Name#id` og hold op med at gætte.',
        },
        {
          term: '`timeThresholdSeconds` betyder fire ting',
          body: 'et tidsloft på et tidsfelt, en placeringsgrænse på et LMS-felt (1 = sejr), en præcis holdstørrelse på et deathless-felt, og en præcis raid-holdstørrelse på et drop-felt. Samme kolonne, fire betydninger — tjek at du udfylder den, din type rent faktisk læser.',
        },
        {
          term: 'Et krævet antal på den forkerte type',
          body: 'det hører hjemme på drop-, kill-, gain-, lap-, PvP-, deathless- og LMS-rækker. På en stat- eller tidsrække gør det ingenting, og på en drop-række laver det et itemsæt om til en “hvilke som helst N”-pulje.',
        },
      ],
      note: {
        tag: 'Test ét, før du skriver to hundrede',
        body: 'Lav ét enkelt felt af den type, du er i tvivl om, afslør det på et testevent, og gå ud og gør det. Fem minutter dér slår at opdage på klanens bingoaften, at en hel kategori var død.',
      },
    },

    points: {
      title: 'Point, sværhedsgrader og om det er fair',
      body: [
        'På et pointbaseret bræt har hvert felt sin egen værdi, og de værdier oversættes til navngivne sværhedsbånd — easy til elite — som du kan redigere under **Rules & scoring**, hvis din klan graduerer anderledes. Båndet er det, spillerne læser; tallet er det, der giver point.',
        'Markér et felt som **optional**, og det holder op med at tælle med i brættets total. Sådan tilføjer du strækmål uden at gøre en blackout umulig.',
        'Når brættet er fyldt, så kør **balance-revisoren** fra Tiles-fanen. Den tjekker strukturen og fordelingen af arbejde og fortæller dig, hvor brættet er skævt — en kategori ingen kan gøre færdig, et bånd der er langt mere værd i timen end naboerne — før spillerne finder de ting for dig og styrer uden om dem.',
      ],
    },

    reveal: {
      title: 'Ingen ser det, før du siger til',
      body: [
        'Nye brætter starter skjulte. Staben ser dem altid; spillerne ser overhovedet ingenting, før du afslører — så et bræt kan bygges i åbenhed, over flere dage, i en kanal dine medlemmer kan læse, uden at noget bliver spoleret.',
        'Den hovedkontakt er gulvet under alt andet. På et bræt med en afsløringspolitik — planlagt, interval, dusør eller roterende — begynder motoren først at vende de enkelte felter, når selve brættet er afsløret, så det er altid en bevidst handling at gøre et bræt skarpt. Hvilken politik du skal vælge, har sin egen side: [Formater, og hvordan felter åbner]({formatsGuide}).',
        'Missioner er den undtagelse, der er værd at kende: felter skrevet på forhånd, men holdt tilbage og annonceret midt i eventet fra deres egen pulje, mens resten af brættet bliver stående synligt.',
      ],
    },

    check: {
      title: 'Før du afslører',
      intro: 'Værd at gå igennem én gang pr. bræt. Det meste tager fem minutter.',
      items: [
        'hvert felt har den type, du mente — ikke den type, der importerede pænt',
        'raid-tilstande, itemnavne og opgavenavne matcher stavemåden i spillet tegn for tegn',
        'de plugin-registrerede felter er ikke den eneste vej til sejr, hvis en del af klanen spiller uden',
        'point er sat, og balance-revisoren er tilfreds — eller du er uenig med den med vilje',
        'valgfrie felter er markeret som valgfrie',
        'du har hentet regnearket ned én gang som en backup, du kan lægge op igen',
      ],
      note: {
        tag: 'Hvem må det her',
        body: 'Brætopsætning er det ene adminjob, der har sin egen rolle. En **editor** kan oprette felter og intet andet, og kan afgrænses til bestemte brætter — så en gæstebrætbygger fra en anden klan får præcis det event, du har givet dem, og ingen adgang til noget andet, du kører.',
      },
    },
    library: {
      title: 'Opgavebiblioteket og forslag',
      body: [
        'Felt-redaktører har **Task library** i admin-menuen: din klans gemte opgaver, og Anvils eget bibliotek at kopiere fra. **⬇ Export pack** gemmer dine opgaver som en fil, og **⬆ Import pack** indlæser en. Sådan flytter et bræt sig mellem klaner.',
        'Fundet en fejl i Anvils bibliotek, eller en opgave der mangler? Tryk **Suggest a fix** på opgaven, eller **Suggest a new task**. Anvil gennemgår det, og svaret vises under **Your suggestions**: **Waiting for review**, **Approved** eller **Not taken**, med en note. Du kan have 5 ventende. En godkendt rettelse når alle klankopier, der stadig følger biblioteket.',
      ],
    },
    stats: {
      title: 'Startstatistik og sene deltagere',
      intro: 'XP- og drabstællerfelter sammenligner hver spillers statistik nu med deres **startstatistik**, taget når eventet starter. Eventets **Stats**-side er der, du kontrollerer og retter dem:',
      rows: [
        {
          term: 'Tag startstatistik',
          body: 'før start varmer den kun hiscores op; selve startlinjen tages ved start. Efter start bliver knappen til **Capture late joiners**, for spillere, der er tilføjet siden. Den kan køre én gang hvert 30. minut.',
        },
        {
          term: 'Update now',
          body: 'opdaterer stillingerne fra de seneste tal. De opdateres også hver time af sig selv.',
        },
        {
          term: 'Fix baseline',
          body: 'pr. spiller: ret et skills- eller bossstartnummer i hånden. Brug det, når et grind fra før eventet ikke blev talt, fordi spilleren ikke logget ud, før det startede.',
        },
        {
          term: 'Nulstil al startstatistik',
          body: 'gemt under **Danger zone**: tager alles startlinje igen fra deres nuværende stats og fjerner alle gevinster indtil nu. Kun til et event, der startede ved en fejl.',
        },
      ],
      outro: 'Nedenunder viser **Member breakdown**, hvem der på hvert hold gjorde hvad, og **Stat tile standings** hver spillers start- og nuværende tal på hvert XP- eller drabsfelt.',
    },
    race: {
      title: 'Tile-kapløbsbaner',
      intro:
        'På et tile-kapløbs-board bygger du en bane i stedet for et gitter. Tiles ligger på nummererede trin, og et hold bevæger sig langs dem.',
      body: [
        'Åbn **Tiles** og brug sektionen **Route**. Vælg en skabelon (**Diamond** er standard), tilføj dine tiles til trinene og tryk på **Save route**. Hvert tile du linker til, skal ligge på det næste trin.',
        'Veje kan dele sig og mødes igen, men der er kun ét mål. Ved en vejgaffel vælger du, om fuldførelse af et tile sætter vejen, eller om kaptajnen vælger den og låser den. Den fulde liste over valg, og hvad spillerne ser, står i [Formats, and how tiles open]({formatsGuide}).',
      ],
    },
  },

  captain: {
    metaTitle: 'Kaptajnguide — Anvil',
    metaDescription:
      'Draftdagen og ugerne efter: at læse puljen før uret starter, at vælge, og at styre dit holds trup, beviser og gebyrer.',
    eyebrow: 'Anvil · til kaptajner',
    title: 'Kaptajnguide',
    dek: 'Du får stukket et krigsrum, et ur og femogtyve fremmedes tilmeldingsskemaer i hånden. Her står, hvad det hele gør, i den rækkefølge du møder det — plus de dele af at styre et hold, der først begynder, når draften er slut.',
    facts: [
      { strong: 'Slangeorden', rest: 'så sene valg jævner ud' },
      { strong: 'Uret', rest: 'vælger aldrig for dig' },
      { strong: 'Én fane', rest: 'styrer dit hold hele eventet' },
    ],
    footnote:
      'Alt her er det, en kaptajn ser. Gebyrer, andre holds trupper og brættet før afsløring er stabens og bliver ved med at være det, så intet på denne side kan få dig beskyldt for at kigge på noget, du ikke måtte.',

    before: {
      title: 'Hvad du får, og hvornår',
      body: [
        'En vært udpeger dig som kaptajn, og det gør to ting: det sætter dig på holdet som spiller, og det åbner holdets flader for dig. Advarer holdsiden nogensinde om, at du faktisk ikke står på truppen, så tag imod den rettelse, den tilbyder — en kaptajn uden for sit eget hold er en tilstand, der forvirrer hver eneste skærm nedenfor.',
        'Derfra har du to steder at være. **My Team** er dit holds hovedkvarter, og det er der, du tilbringer eventet. **Krigsrummet** er draftdagens skærm, og det åbner, så snart tilmeldingen gør — længe før draftaftenen.',
      ],
      note: {
        tag: 'Gå derind tidligt',
        body: 'Krigsrummet er mest værd i dagene _før_ draften, hvor du kan læse hvert tilmeldingsskema ordentligt. På selve aftenen bliver det til et stopur, og du får ikke tid til at læse noget som helst.',
      },
    },

    warroom: {
      title: 'Læs puljen, før uret starter',
      body: [
        'Krigsrummet viser alle, der kan vælges, med alt hvad siden ved om dem: hvad de spiller, hvilke bosser de har rigtige killcounts på, hvor mange tidligere events de mødte op til, og de svar de gav i tilmeldingsskemaet.',
        'De svar er **fastfrosset, som de blev indsendt**. Ingen retter deres “timer om ugen”, efter de har set, hvem der blev valgt først — og det er hele grunden til, at de er værd at læse.',
        'Byg en **kandidatliste**, mens du læser. Den er privat, den overlever til draftaftenen, og på aftenen er den forskellen på at vælge fra en liste, du allerede stoler på, og at vælge den, der står øverst på skærmen.',
      ],
      rows: [
        {
          term: 'Rating og niveau',
          body: 'et sammendrag af, hvad nogen faktisk har lavet, udledt af deres kontohistorik i stedet for af, hvad de fortalte dig. Vejledende — et udgangspunkt for en samtale, ikke en dom.',
        },
        {
          term: 'Domæner og markører',
          body: 'det, de beviseligt laver: raids, PvM, skilling, PvP. Nyttigt til at spotte hullet i din trup i stedet for at tage det højeste tal fire gange.',
        },
        {
          term: 'Fremmøde',
          body: 'hvor ofte de gjorde tidligere events færdige, som de havde meldt sig til. Det stilleste tal på siden og ofte det, der forudsiger mest.',
        },
      ],
    },

    draft: {
      title: 'Draftdagen',
      body: [
        'Valgene kører i **slangeorden**: med fire hold går første runde A, B, C, D og anden runde D, C, B, A — så at vælge sidst i én runde betyder at vælge først i den næste. Den, der trak første valg, betaler for det et minut senere.',
        'En person er ét valg, ikke én konto. Tager du nogen, følger alle de konti, de har registreret, med over på dit hold — du bruger aldrig et valg nummer to på nogens alt.',
      ],
      rows: [
        {
          term: 'Vælgeuret',
          body: 'har værten sat et, får du det antal sekunder pr. tur. Når det løber ud, vælger det **ikke** for dig — det låser op for, at værten kan vælge på dine vegne, og siger det på begge skærme. Der sker ingenting i det skjulte.',
        },
        {
          term: 'En indsnævret liste',
          body: 'nogle events kører en balancetilstand. Alt efter hvilken kan det stærkeste hold være blokeret fra at tage endnu en topspiller, mens en rival ingen har, eller have et loft over, hvor langt over gennemsnittet truppen må komme. Er en, du ville have haft, gråtonet, er det derfor — og det gælder alle.',
        },
        {
          term: 'Hvis du misser den',
          body: 'sig til værten på forhånd. De kan vælge for dig fra samme skærm, og en kandidatliste, du har efterladt, er den instruks, de følger.',
        },
      ],
      note: {
        tag: 'Draften låser holdene',
        body: 'Så snart en draft kører, er både holdene og valgrækkefølgen frosset. Mangler der et hold, eller er rækkefølgen forkert, skal det rettes før første valg — ikke efter.',
      },
    },

    roster: {
      title: 'Dit holds hovedkvarter, hele eventet',
      intro:
        'På **My Team** rummer kortet **Manage this team** alt, hvad du kan gøre for din side. Det starter foldet sammen; åbn det én gang, så bliver det, hvor du lagde det.',
      rows: [
        {
          term: 'Roster',
          body: 'hvem der er på holdet, og hvad de har bidraget med. Det første sted at kigge, når nogen spørger, hvorfor deres drop ikke talte — en konto, der ikke er forbundet, dukker op her.',
        },
        {
          term: 'Requests',
          body: 'folk der beder om at komme med, på events hvor spillerne selv vælger hold. Vises kun, når der er nogen.',
        },
        {
          term: 'Proof',
          body: 'dit holds indsendelser og deres screenshots. Du er ikke den, der godkender til sidst — det er staben — men du kan se, hvad der er sendt, og rykke for det, der ikke er.',
        },
        {
          term: 'Fees',
          body: 'hvem på dit hold der stadig skylder tilmeldingsgebyr. Du kan markere et som betalt; at bekræfte det er stabens job, med vilje.',
        },
        {
          term: 'Invite links',
          body: 'dukker op, når værten har tilladt kaptajner at lave deres egne. Ét link sætter den, der åbner det, direkte på dit hold. Se [Vær vært for en gæsteklan]({clanVsClanGuide}) for, hvad linket egentlig gør.',
        },
      ],
    },

    during: {
      title: 'At køre det, når det først er i gang',
      body: [
        'Det meste af eventet kører sig selv: pluginnet krediterer det, det kan se, og arkiverer et stemplet screenshot for det. Tilbage er mennesker — og det er jobbet.',
        'Det, der virkelig kræver en kaptajn: at sikre at alle på din side har pluginnet forbundet og deres konti tilknyttet inden startskuddet, for en alt uden tilknytning bidrager til ingenting; at bemærke hvilke felter ingen har rørt halvvejs inde; og at få de manuelle felter fotograferet før den sidste time, hvor alle prøver på én gang.',
        'Kræver eventet et startbillede, er det den ene ting, hver spiller selv skal nå i de første timer. Ryk for det tidligt — en spiller uden får hver kredit markeret til gennemsyn eller afvist direkte, alt efter hvordan værten har sat det op.',
      ],
      note: {
        tag: 'Udskiftninger',
        body: 'Når et event først er i gang, kan kun en admin skifte nogen ud, og det er med vilje: bidrag er allerede knyttet til personer. Spørg en vært i stedet for at rokere uden om det.',
      },
    },
  },

  formats: {
    metaTitle: 'Formater, og hvordan felter åbner — Anvil',
    metaDescription:
      'De syv eventformater, de fem måder felter kan åbne på, og pointmodifikatorerne — hvad hver af dem gør ved, hvordan et event føles at spille.',
    eyebrow: 'Anvil · til klanens stab',
    title: 'Formater, og hvordan felter åbner',
    dek: 'To beslutninger former et event mere end alle felterne i det: hvilken form brættet har, og hvordan felter bliver spilbare. De er uafhængige — ethvert format kan bruge enhver afsløringspolitik — og tilsammen er de forskellen på en uges slid og et natligt kapløb.',
    facts: [
      { strong: '7 formater', rest: 'brættets form' },
      { strong: '5 politikker', rest: 'hvordan felter åbner' },
      { strong: '3 modifikatorer', rest: 'hvad en gennemførelse er værd' },
    ],
    footnote:
      'Formatet ligger fast ved oprettelsen, men kan ændres bagefter fra eventets Settings → Event-fane; afsløringspolitikken og pointmodifikatorerne kan ændres når som helst, før de felter, de påvirker, bliver afsløret.',

    shape: {
      title: 'Brættets form',
      intro:
        'Formatet afgør, hvordan brættet giver point, og hvad oprettelsesformularen spørger dig om bagefter. Alt andet på denne side lægger sig oven på det.',
      note: {
        tag: 'Fast gitter eller opgaveliste',
        body: 'Et **klassisk** bræt er et ægte kvadrat, så “N på 5” betyder præcis 25 felter, og antallet kan aldrig ændre sig. Alt andet er en opgaveliste af vilkårlig længde — og det er også den eneste slags bræt, en regnearksimport kan få til at vokse. Skal du generere hundrede opgaver, træffes den beslutning her.',
      },
    },

    reveal: {
      title: 'Hvordan felter åbner',
      intro:
        'Uafhængigt af formatet. Eventets afsløringskontakt er stadig hovedgulvet — så længe et bræt er skjult, er intet synligt, og ingen af motorerne kører, så du gør altid et bræt skarpt bevidst.',
      rows: [
        {
          term: 'Alle på én gang',
          body: 'klassikeren. Hvert felt er spilbart i samme øjeblik, du afslører brættet, og holdene vælger selv rækkefølgen. Vælg den, medmindre du har en grund til at lade være.',
        },
        {
          term: 'Planlagt',
          body: 'hvert felt har sit eget afsløringstidspunkt, sat på Tiles-fanen, og går live når tiden passerer. Et “timens felt”-bræt: det sætter tempoet for dig og kræver, at tiderne er skrevet ind på forhånd.',
        },
        {
          term: 'Interval',
          body: 'motoren trækker skjulte felter med et fast mellemrum — en portion hvert N. minut, tilfældigt eller i brætrækkefølge. En bankospiller. Ingen ekstra opsætning ud over felterne selv, og brættet afslører sig selv, mens du sover.',
        },
        {
          term: 'Dusør',
          body: 'præcis ét felt er åbent ad gangen, og det første hold, der gør det færdigt, tager det — feltet lukker, og det næste trækkes med det samme. Hårdt, meget sjovt at se på, og benhårdt over for tidszoner.',
        },
        {
          term: 'Roterende',
          body: 'et rullende vindue med nogle få åbne felter: hver trækning åbner nye og lukker de ældste. I modsætning til dusør kan alle nå at gøre et åbent felt færdigt, før det forsvinder. Bygget til individuelle stiger.',
        },
      ],
      note: {
        tag: 'Tidszonespørgsmålet',
        body: 'Dusør- og intervalbrætter belønner den, der tilfældigvis er vågen. På en klan spredt ud over verden er det en reel fordel, uddelt af uret i stedet for af spil. Roterende vinduer blødgør det — et åbent felt bliver åbent, så længe vinduet varer, så en sovende spiller stadig får en chance.',
      },
    },

    scoring: {
      title: 'Hvad en gennemførelse er værd',
      intro:
        'Tre modifikatorer, alle kun i pointtilstand, alle fastfrosset ind i gennemførelsen i samme øjeblik den sker — så en ændring, du laver senere, skriver aldrig historien om.',
      rows: [
        {
          term: 'Bonus til første hold',
          body: 'ekstra point til det første hold, der gør hvert felt færdigt. Den billigste måde at få et bræt med alt synligt til at føles som et kapløb uden at ændre andet.',
        },
        {
          term: 'Henfald',
          body: 'et felts værdi skalerer lineært fra fuld ved afsløring til en målprocent efter N timer og holder så. Under 100 % falder den og belønner at være hurtig; over 100 % **vokser** den, hvilket belønner at rydde de gamle opgaver, alle sprang over. Den voksende retning er den, folk glemmer findes.',
        },
        {
          term: 'Lockout',
          body: 'den første gennemførelse lukker feltet for alle andre. Underforstået ved dusør. På et bræt med stor forskel i holdstyrke kan det afgøre kampen tidligt — den er bedst, når holdene er tæt på hinanden.',
        },
      ],
    },

    missions: {
      title: 'Missioner: overraskelser undervejs',
      body: [
        'Missioner er felter, der er skrevet på forhånd og holdt tilbage — annonceret fra deres egen pulje, mens resten af brættet bliver stående synligt. De er uafhængige af afsløringspolitikken, så selv en helt almindelig bingo med alt synligt kan have dem.',
        'Slip dem løs i hånden, når brættet bliver stille, med et fast interval, eller efter en plan pr. mission. Hver mission har sin egen pointopsætning: sin egen lockout, bonus, henfald og udløb, sat pr. felt frem for for hele eventet.',
        'De er den billigste måde at vække et bræt på dag fem — og dag fem er den dag, ethvert langt event har brug for at blive vækket.',
      ],
    },

    choose: {
      title: 'At vælge, på én side',
      intro: 'Ved du, hvilken fornemmelse du er ude efter, er det her den korteste vej dertil.',
      rows: [
        { term: 'En almindelig klanbingo', body: 'Klassisk gitter, alle felter synlige. Læg en bonus til første hold oveni, hvis du vil have lidt hastværk.' },
        { term: 'Hundredvis af opgaver, scoret efter sværhedsgrad', body: 'Point Hunt, alt synligt. Det er også den eneste form, en stor regnearksimport kan vokse ind i.' },
        { term: 'En uge, der bygger op mod noget', body: 'Point Hunt med planlagt eller interval-afsløring, så brættet åbner sig over ugen i stedet for på én gang.' },
        { term: 'En aften folk ser med på live', body: 'Dusør. Ét felt, første hold tager det, næste felt med det samme.' },
        { term: 'En individuel konkurrence, ikke en holdkonkurrence', body: 'Stige med et roterende vindue og henfald. Opgaver kommer og går, og ingen kan gemme dem.' },
        { term: 'Et ræs med en målstreg', body: 'Feltræs — en ordnet bane, og den der når længst, vinder.' },
      ],
      outro:
        'Uanset hvad du vælger, er selve felterne det samme job: se [Byg et bræt, der tracker sig selv]({boardGuide}).',
    },
    race: {
      title: 'Tile-kapløbsruter',
      intro:
        'Et tile-kapløb er en bane med nummererede trin. Hold bevæger sig fra trin til trin, og den, der kommer længst, vinder. Værten kan gøre banen til et kort med veje, der deler sig og forbindes.',
      body: [
        'Hver rute har én start, veje der kan dele sig og mødes igen, og ét mål. Hver vej er lige lang. Et holds fremskridt er den vej, det har gået indtil nu.',
      ],
      rows: [
        {
          term: 'Efter præstation',
          body:
            'hvert tile efter dit nuværende er åbent. Det første, et hold fuldfører, sætter dets vej, og de andre lukkes for det hold.',
        },
        {
          term: 'Vælg og lås',
          body:
            'kaptajnen (eller holdstaben) vælger det næste tile med **Pick this road**, før noget tæller. Kun valget er åbent. Et valg kan ikke fortrydes, undtagen af en admin-nulstilling.',
        },
        {
          term: 'Gem tidlige færdiggørelser',
          body:
            'slået fra som standard, så kun tiles, der er åbne på et holds vej, tæller. Slår du den til, gemmes en færdiggørelse på et tile, holdet endnu ikke har nået. Den fuldføres, når vejen når dertil. Den springer aldrig et hold over, der er foran, og åbner aldrig noget for tidligt.',
        },
      ],
      steps: [
        'Åbn eventets **Tiles**-side og find **Route**.',
        'Vælg en **Route template** og tryk på **Apply template**. **Diamond** er standard: én start, to veje, ét mål. **Two roads**, **Braid**, **Straight line** og **Free** (uden links) findes også.',
        'Vælg **How a team’s road is set at a fork**: efter præstation, eller vælg og lås.',
        'Tilføj eller flyt trin med **+ Step before**, **Move step earlier/later** og **Remove step**, og tryk derefter på **Save route**.',
        'Er eventet allerede live, spørger Anvil, hvad der skal ske med færdiggørelser, den nye rute skærer af: **Keep** dem eller **Roll back**.',
      ],
      outro:
        'Spillerne ser en **Race track** på eventsiden, med en guldfarvet **You**-markør på deres holds tile. **Fullscreen board** gør den stor, og **Esc** lukker den. I pluginnet viser sidepanelet **Your road** og **After that**.',
    },
  },

  fees: {
    metaTitle: 'Gebyrer og udbetalinger — Anvils kassérguide',
    metaDescription:
      'At tage et tilmeldingsgebyr, at samle det ind, den anden underskrift der afslutter det, og at lave præmiepuljen om til udbetalte placeringer.',
    eyebrow: 'Anvil · til kasserere',
    title: 'Gebyrer og udbetalinger',
    dek: 'Penge er der, hvor klanevents går galt, og de går galt i stilhed: et gebyr nogen sværger på, de har betalt, en pulje ingen kan få til at gå op, en præmiefordeling der bliver diskuteret, efter vinderne er logget af. Her er vejen, der efterlader et spor ved hvert skridt.',
    facts: [
      { strong: '2 underskrifter', rest: 'afslutter et gebyr som standard' },
      { strong: 'Pulje = tilføjet', rest: '+ gebyr × godkendte tilmeldinger' },
      { strong: '1 række', rest: 'pr. person der får penge' },
    ],
    footnote:
      'Gebyrer og udbetalinger er kassérens flade. En kassér kan alt det, en moderator kan, plus dette; en almindelig moderator ser slet ikke gebyrsiderne.',

    set: {
      title: 'At sætte gebyret',
      body: [
        'Tilmeldingsgebyret ligger på eventet, sat når du opretter det, eller redigeret fra dets **Sign-ups**-fane. Intet gebyr er et helt fint svar — masser af events kører alene på en pulje, værten har lagt i.',
        'To indstillinger afgør, hvad gebyret rent faktisk betyder, og de er nemme at overse:',
      ],
      rows: [
        {
          term: 'Pr. person eller pr. konto',
          body: 'på et event, hvor folk må stille op med flere konti, afgør den, om de betaler én gang eller én gang hver. Bliver den forkert, kommer du til at betale penge tilbage.',
        },
        {
          term: 'Betalingsfrist',
          body: 'når den er passeret, holder ubetalte tilmeldinger op med at være noget, du render efter, og bliver til en beslutning. Sæt den tidligere end du tror — dagen før eventet er for sent til at finde en erstatning.',
        },
        {
          term: 'Gæstegebyr',
          body: 'det, spillere betaler, når de ikke er medlem af en klan, der kører brættet. Lad det stå tomt, så betaler gæster medlemsgebyret. Skal én spiller betale et andet beløb, så tryk **Change this player’s fee** på spillerens række i **Sign-ups**.',
        },
      ],
      note: {
        tag: 'Puljen følger tilmeldingerne',
        body: 'Den viste præmiepulje er det, du selv har lagt i, plus tilmeldingsgebyret gange antallet af **godkendte** tilmeldinger. Den bevæger sig, efterhånden som tilmeldinger godkendes og udelukkes, så tallet på siden er altid det, du faktisk kunne udbetale.',
      },
    },

    collect: {
      title: 'At samle ind',
      body: [
        'Gebyrer bliver samlet ind på den måde, din klan i forvejen samler penge ind — i spillet, på Discord, som I nu gør. Anvils job begynder i det øjeblik, pengene lander: nogen med stabsadgang markerer det **betalt**, og det stempler, hvem der siger, de tog imod, og hvornår.',
        'Spillerne har også et ord at skulle have sagt. Et medlem kan indberette, hvem de betalte til, og vedhæfte et screenshot — og det er dét, der gør “jeg har helt sikkert betalt” til en registrering med to ender. Når spillerens indberetning og indsamlerens påstand nævner forskellige personer, er det en uenighed, siden kan vise dig, i stedet for en du opdager midt i et skænderi.',
        'At rykke for betaling er én knap: **Remind unpaid** under Admin → **Fees** sender en Discord-DM til alle i det event, der stadig skylder.',
      ],
      note: {
        tag: 'Beviset bliver slettet med vilje',
        body: 'Et betalingsscreenshot gemmes kun, indtil gebyret er afsluttet, og fjernes så. Det findes for at løse en uenighed, ikke for at ligge i et arkiv i et år.',
      },
    },

    sign: {
      title: 'Den anden underskrift',
      body: [
        'Et gebyr står som **modtaget**, indtil et _andet_ stabsmedlem bekræfter, at det kom frem. Den, der håndterede pengene, kan ikke også være den, der skriver under på, at de dukkede op — det er hele kontrollen, og det er derfor, siden afviser en indsamlers egen bekræftelse i stedet for bare at fraråde den.',
        'Hvor mange underskrifter et gebyr kræver, er en klanindstilling (**Clan settings → Rules & scoring → Fee sign-off**) fra nul til fem. Nul findes af en rigtig grund: i en klan hvor kassereren _er_ ejeren, er der ingen anden at skrive under, og “34 gebyrer venter på en anden underskrift” bliver en kø, der aldrig kan tømmes, og permanent det højeste på dashboardet. Ved nul **er** det at markere et gebyr betalt selve underskriften.',
        'Sæt den til én — standarden — hvis I er to. Sæt den til nul, hvis I ærligt talt ikke er, og sæt den højere kun hvis din klan har både folkene og grunden.',
      ],
    },

    pay: {
      title: 'At betale ud',
      body: [
        'Når eventet slutter, laver eventets **Prizes**-side puljen om til en liste over mennesker. Generér den, og du får én række pr. modtager — ikke pr. hold: et vindende holds præmie deles ligeligt mellem medlemmerne, så udbetalingen bliver en liste med navne og tal frem for et regnestykke ved midnat.',
        'Beløbene starter fra en foreslået fordeling — tungest i toppen, og jo flere betalte pladser du sætter, jo fladere bliver den — og hver række kan redigeres. Forslaget er et udgangspunkt, ikke en politik.',
        'Så betaler du dem og hakker rækkerne af undervejs. Pointen er, at nogen en uge senere kan kigge på listen og se, hvem der fik hvad, i stedet for at rekonstruere det fra Discord-historikken.',
      ],
      note: {
        tag: 'Annoncér det én gang, herfra',
        body: 'Udbetalinger postes til jeres Discord-kanaler fra selve eventet, så annonceringen og registreringen er det samme. En præmie, der annonceres i hånden, er en præmie, nogen senere påstår aldrig kom.',
      },
    },

    disputes: {
      title: 'Når tallene er uenige',
      intro: 'De fire, du faktisk kommer til at møde:',
      rows: [
        {
          term: 'De siger, de har betalt, ingen har markeret det',
          body: 'bed dem indberette betalingen med et screenshot. Det sætter en navngiven modtager og et tidsstempel på registreringen, og den navngivne person kan bekræfte eller afvise.',
        },
        {
          term: 'To fra staben tror begge, de tog imod',
          body: 'spillerens egen indberetning er afgørelsen — den nævner, hvem de rakte pengene til. Ret indsamleren, og afslut så gebyret.',
        },
        {
          term: 'Et gebyr sidder fast og venter på en underskrift',
          body: 'enten venter det reelt på en anden, eller også har din klan færre stabsfolk, end indstillingen for krævede bekræftelser går ud fra. Sæt indstillingen ned frem for at bekræfte din egen indsamling.',
        },
        {
          term: 'Puljen ændrede sig, efter du fortalte folk om den',
          body: 'den følger godkendte tilmeldinger, så det at godkende eller udelukke en tilmelding flytter den. Nævn puljen som den ser ud, når tilmeldingen lukker — ikke når den åbner.',
        },
      ],
    },
  },

  coffer: {
    metaTitle: 'Klankassen — Anvil-vejledning for kasserere',
    metaDescription:
      'Klanens gp-kasse i Anvil: at registrere donationer og give æren til dem der gav dem, de tre måder en præmie bliver betalt på, hvem der må flytte pengene, og hvad der sker når kassen er tom.',
    eyebrow: 'Anvil · til kasserere',
    title: 'Klankassen',
    dek: 'De fleste klaner har deres gp i én persons bank og deres regnskab i én persons hukommelse. Kassen er én pulje med en linje for hver bevægelse — hvem der gav den, hvad den er lovet væk til, og hvem der rent faktisk sendte den.',
    facts: [
      { strong: '3 tal', rest: 'i kassen, lovet væk, frit at love væk' },
      { strong: '3 veje ud', rest: 'ugekonkurrencer, missionsfelter, en plades pulje' },
      { strong: 'Kasserer', rest: 'eller admin — aldrig rang alene' },
    ],
    footnote:
      'Alt herfra ligger under Admin → **Coffer**, undtagen præmiestigerne, som ligger på det der bliver betalt for. Den offentlige halvdel er `/coffer`: saldoen, de største givere og de seneste bevægelser, til medlemmerne.',

    what: {
      title: 'Hvad den er',
      body: [
        'Et regnskab, ikke en pengepung. Anvil ligger aldrig inde med jeres gp — den bliver hvor klanen i forvejen har den — så kassen er registreringen af hvad der kom ind, hvad der er lovet væk, og hvad der faktisk er udleveret. Nytten er, at løftet og betalingen er to forskellige linjer.',
        'Siden starter med tre tal, og de er tre fordi de svarer på tre forskellige spørgsmål:',
      ],
      rows: [
        {
          term: 'I kassen',
          body: 'godkendte donationer og reguleringer. Hvad klanen har fået, minus hvad den har afskrevet.',
        },
        {
          term: 'Lovet væk',
          body: 'gp som en præmie har gjort krav på — vundet men ikke sendt endnu, plus en eventuel pulje sat af til en plade. Disponeret, også selvom det stadig står i nogens bank.',
        },
        {
          term: 'Frit at love væk',
          body: 'i kassen minus lovet væk. Det eneste tal en ny præmie bliver holdt op imod, for alternativet er at love de samme 50m til to vindere mens kassereren sover.',
        },
      ],
      note: {
        tag: 'En donation der venter, tæller ingen steder',
        body: 'At nogen skriver "jeg gav 100m" er en påstand om fortiden, ikke gp i en bank. Den står uden for alle tre tal indtil staben anerkender den, så den kan aldrig finansiere en præmie der bagefter ikke kan betales.',
      },
    },

    inbound: {
      title: 'At få gp ind',
      body: [
        'RuneLite-pluginet klarer den almindelige vej automatisk: åbn Clan Coffer i spillet, så registrerer Anvil indskud og hævninger ud fra dens rigtige møntsaldo. Det første kig er kun et udgangspunkt — det lader aldrig, som om den, der åbnede den, har doneret alt det, der allerede lå i den.',
        'Manuelle registreringer er der stadig til alt, der skete, mens ingen havde pluginet åbent. Et medlem indberetter sin egen donation fra `/coffer`, og den venter på at staben tror på den; en kasserer registrerer en der allerede er ankommet, og at vedkommende taster den **er** godkendelsen.',
        'Uanset hvad bliver den krediteret en **person**. Det betyder mere end det lyder: listen over de største givere på den offentlige side er den eneste tak de fleste givere nogensinde får, og gp der ankommer som "klanen" takker ingen.',
      ],
      rows: [
        {
          term: 'Åbn kassen i spillet',
          body: 'med Anvil slået til og logget ind (Profile sync → **Sync Clan Coffer** er slået til som standard). En matchende spilbesked krediterer dit eget indskud eller din egen hævning til dig; ændringer, der ses efter et hul, bliver afstemt uden at navngive den, der så dem. Admin → Coffer viser det seneste fysiske beløb, og hvornår det blev set.',
        },
        {
          term: 'Et medlem indberetter en',
          body: 'fra den offentlige kasseside, med et skærmbillede hvis de har et. Den lander som afventende og dukker op i din kø. At godkende den er det, der gør den til rigtige penge.',
        },
        {
          term: 'Du registrerer en',
          body: 'Admin → Coffer → **Record a donation**. Søg i medlemslisten efter hvem der gav den, sæt et beløb ud for navnet, færdig. Gæster kan også krediteres — en der ikke er fuldt medlem kan sagtens have betalt til kassen.',
        },
        {
          term: 'Flere sammen',
          body: 'vælg dem alle, tast totalen og tryk **Split … ways**, og ret så en enkelt andel i hånden hvis det passer bedre. Det skriver én linje til hver frem for én linje med en liste, så hver af dem står i giverlisten under sit eget navn.',
        },
      ],
      note: {
        tag: 'En regulering er noget andet',
        body: '**Correct the pot** er til gp der har flyttet sig uden om alt det her — at fylde kassen op, at bruge den på noget Anvil aldrig så, at rette en fejl. Den tilhører med vilje ingen, og den er bevidst ikke måden at registrere en gave på.',
      },
    },

    out: {
      title: 'De tre måder den betaler ud',
      intro: 'Hver eneste præmie i Anvil kommer fra denne ene kasse, og hver vej afgør vinderne på sin egen måde. Sæt stigen dér hvor det der vindes hører hjemme — kassen spørger aldrig hvem der vandt noget.',
      rows: [
        {
          term: 'En ugekonkurrence, på sin egen side',
          body: 'en Skill eller Boss of the Week har en placeringsstige: første får dette, anden får hint. Den gøres op **én gang** når konkurrencen slutter, ud fra slutstillingen — der skifter intet hænder undervejs. Sæt den mens du opretter konkurrencen, eller bagefter fra konkurrencens egen side.',
        },
        {
          term: 'Et missionsfelt, på pladen',
          body: 'missioner betaler i den rækkefølge folk bliver færdige, så deres stige bliver gjort krav på frem for gjort op: det første hold der klarer den, tager førstepladsens gp. Sættes i feltets rewards-afsnit, på enhver plade der tillader missioner.',
        },
        {
          term: 'En plades præmiepulje',
          body: 'et bingo fordeler selv sin pulje på placeringer, så kassen rækker den bare ét tal. Event → **Prizes** → *From the clan coffer*. Det lægger sig til tilmeldingsgebyrerne og det, du selv har lagt oveni, og fordelingen på pladser sættes på samme side. Du vælger også, om kassen **holder** de gp med det samme eller kun noterer løftet — de har jo ikke forladt kassen endnu, og et bræt om seks uger har ikke brug for, at halvdelen af puljen er låst indtil da.',
        },
      ],
      note: {
        tag: 'Når folk ender lige',
        body: 'En ugestige kan **dele ved pointlighed**: alle der er lige, lægger de pladser de optager sammen og deler ligeligt, så tre på 40 kc hver tager en tredjedel af første, anden og tredje frem for at den første af dem tager det hele. Lad den være slået fra, og pladens egen rækkefølge afgør det. Begge dele kan forsvares — at beslutte det efter resultaterne er inde, kan ikke.',
      },
    },

    who: {
      title: 'Hvem der må flytte den',
      intro: 'Penge er sin egen tilladelse, ikke en rang. En moderator kan godkende en indsendelse og aldrig røre kassen, og det er med vilje frem for en forglemmelse.',
      rows: [
        {
          term: 'Kasserer eller admin',
          body: 'hele regnskabet: registrere og godkende donationer, regulere kassen, sætte præmiestiger, markere en præmie som sendt. Ejeren tæller som admin her.',
        },
        {
          term: 'En moderator',
          body: 'intet af det. De ser slet ikke kassesiden — at samle penge ind er kassererens arbejde, og rang alene har aldrig givet ret til det.',
        },
        {
          term: 'En pladekasserer',
          body: 'ét events penge: dets gebyrer, dets udbetalinger, dets præmiepulje. Gives per plade, hvilket er sådan en gæsteklan kører sin egen halvdel af en klan-mod-klan uden at få jeres regnskab i hænderne. De kan ikke røre klankassen.',
        },
        {
          term: 'Ethvert medlem',
          body: 'kan indberette en donation og læse den offentlige side. Det er det hele.',
        },
      ],
      note: {
        tag: 'Fortæl klanen det, i en kanal',
        body: 'Peg **Coffer ledger** på en Discord-kanal under Admin → Discord → What goes where → **Staff only**, så bliver hver bevægelse skrevet med den saldo, den efterlader. Det er det ene feed uden reserveløsning: lad det stå tomt, og der bliver ikke skrevet noget om pengene nogen steder. Se [Anvil i Discord]({discordGuide}).',
      },
    },

    short: {
      title: 'Når kassen er for lille',
      body: [
        'En præmie der er større end kassen, bliver ikke afvist. Den bliver registreret som **skyldig og ikke dækket** — en rigtig linje i regnskabet med en vinders navn på — for alternativet er en vinder uden noget og uden bevis for at der nogensinde blev lovet noget.',
        'Så løsningen er den almindelige: skaf gp ind, og betal så. Det du ikke skal, er at rette stigen bagefter i stilhed; regnskabet siger allerede hvad der blev annonceret, og at de to er uenige er værre end at mangle penge.',
      ],
      note: {
        tag: 'Anvil sender ingenting',
        body: 'Hver præmie ender med at et menneske rækker gp over i spillet og sætter flueben ved en linje. Regnskabets opgave er at sikre at linjen findes, at den siger hvem og hvor meget, og at ingen en uge senere skal grave det frem af Discord-historikken.',
      },
    },
  },

  commands: {
    metaTitle: 'Slash-kommandoer i Discord — Anvil',
    metaDescription:
      'Alle Anvils slash-kommandoer — /bingo, /sotw, /botw, /eff, /coffer, /stats og /guide — med hver valgmulighed forklaret, eksempler, hvem der må bruge hvad, og løsninger når kommandoer ikke dukker op.',
    eyebrow: 'Anvil · i Discord',
    title: 'Slash-kommandoer',
    dek: 'Skriv `/` i din klans Discord, så svarer Anvil fra den levende side: brættet, stillingen, dit eget kort, ugekonkurrencerne, kassen og hvem som helsts stats. Denne side er den fulde liste, genereret ud fra de kommandoer botten faktisk registrerer, så den er aldrig forældet.',
    facts: [
      { strong: 'Privat', rest: 'svar som kun du kan se, med en Share-knap' },
      { strong: 'Dit sprog', rest: 'det, din Discord er sat til' },
      { strong: 'Kun læsning', rest: 'undtagen /coffer add og remove' },
    ],
    footnote:
      'At sætte botten op i første omgang står i [Discord-vejledningen](/guide/discord). Denne side handler om at bruge den.',

    using: {
      title: 'Sådan virker en kommando',
      body: [
        'Skriv `/` i en hvilken som helst kanal, botten kan se, og vælg en Anvil-kommando fra listen. Discord viser så dens valgmuligheder som felter, der skal udfyldes: tryk Tab eller klik på en for at tilføje den. Valgmuligheder skrevet som `<angle brackets>` nedenfor er påkrævede; dem skrevet som `[square brackets]` er valgfrie, og du kan udelade dem.',
        'Hvert svar er **privat**: kun du ser det, så at tjekke brættet ti gange om dagen generer ingen. Er det værd at vise kanalen, så tryk **Share to channel** under svaret. Den delte kopi bygges i det øjeblik, så en stilling, der deles senere, er stillingen, som den ser ud dér.',
      ],
      rows: [
        { term: 'Påkrævet', body: '`<amount>` — Discord sender ikke kommandoen, før den er udfyldt.' },
        { term: 'Valgfri', body: '`[member]` — udelad den, så svarer kommandoen om dig, dit hold eller hele klanen.' },
        { term: 'En liste', body: 'vælg en af de værdier, Discord tilbyder; du kan ikke skrive din egen.' },
        { term: 'Skriv for at søge', body: 'begynd at skrive, og vælg blandt forslagene, f.eks. bossnavne eller dine egne konti.' },
        { term: 'Et medlem', body: 'vælg en fra serveren, ligesom ved en @mention.' },
      ],
      note: {
        tag: 'Kommandoerne virker kun på din klans server',
        body: 'Hvert svar handler om én klan, og en DM har ingen klan at svare om. Derfor dukker kommandoerne ikke op i DM’er.',
      },
    },

    bingo: {
      title: 'Brætkommandoer: /bingo',
      intro:
        '`/bingo` handler om ét bræt. Når flere brætter kører, viser **board** og **leaderboard** dem alle; resten svarer om det bræt, der kører, så det næste, der starter, og så det, der lige er sluttet.',
    },

    clan: {
      title: 'Klankommandoer',
      intro:
        'De her svarer om klanen frem for et bræt, så de virker, uanset om der kører et bingo: ugekonkurrencerne, effektivitet, kassen, hvem som helsts stats og opsætningsvejledningerne.',
    },

    options: {
      title: 'Valgmuligheder du ser overalt',
      intro: 'Nogle få valgmuligheder betyder det samme på hver kommando, der har dem:',
      rows: [
        {
          term: '`member`',
          body: 'en anden på serveren. Udelad den for at spørge om dig selv. Den finder deres Anvil-konto via det Discord-login, de brugte på siden, så den virker kun for medlemmer, der har logget ind på Anvil én gang.',
        },
        {
          term: '`account`',
          body: 'hvilken af personens OSRS-konti, for folk med alts. Skriv for at vælge; udelad den for deres main.',
        },
        {
          term: '`page`',
          body: 'en boss eller aktivitet, skrevet for at søge: `Zulrah`, `Theatre of Blood`, `Tempoross`. Udelad den for det samlede overblik.',
        },
        {
          term: '`language`',
          body: 'svar denne ene gang på et andet sprog. Som udgangspunkt får du det sprog, din Discord er sat til, eller klanens valgte botsprog.',
        },
        {
          term: '`amount`',
          body: 'gp på den nemme måde: `5m`, `2.5b`, `500k` eller et almindeligt tal som `2,500,000`.',
        },
      ],
    },

    who: {
      title: 'Hvem der må bruge hvad',
      body: [
        'Alle på serveren kan køre alle de kommandoer, der kun læser. Det, du ser, er det, et medlem ville se: et bræt, hvis felter ikke er afsløret endnu, forbliver også skjult i Discord, selv for staben.',
        'Kommandoer, der svarer om **dig** (`/bingo me`, `/stats` uden member), skal vide, hvilken Anvil-konto der er din. De finder den via det Discord-login, du brugte på siden, så log ind på Anvil med Discord én gang, så virker de fra da af.',
      ],
      rows: [
        { term: 'Alle', body: 'alle kommandoer undtagen `/coffer add` og `/coffer remove`.' },
        {
          term: 'Kasserere, admins, ejere',
          body: '`/coffer add` og `/coffer remove`. Tjekkes mod din rolle **på Anvil-siden**, aldrig din Discord-rolle, for en rang på en chatserver har aldrig betydet kontrol over klanens penge.',
        },
      ],
    },

    trouble: {
      title: 'Når en kommando ikke virker',
      intro: 'De sædvanlige årsager, cirka i den rækkefølge de opstår:',
      rows: [
        {
          term: 'Ingen Anvil-kommandoer på listen',
          body: 'botten blev inviteret uden sine kommandoer — det er en separat rettighed, og ældre invitationslinks bad kun om den ene. En admin kører **Invite / re-invite the bot** igen fra Admin → Discord → **Connection**. Det smider ikke botten ud og nulstiller ingenting. Nytilføjede kommandoer kan være op til en time om at dukke op.',
        },
        {
          term: '"The application did not respond"',
          body: 'Anvil var kortvarigt utilgængelig, som regel midt i en opdatering. Kør den igen et par sekunder senere.',
        },
        {
          term: '"Ikke på dette bræt" om dig selv',
          body: 'enten har du ikke tilmeldt dig dette bræt, eller også kan Anvil ikke matche din Discord med din konto. Log ind på siden med denne Discord-konto, og tjek din profil.',
        },
        {
          term: 'Et medlems stats kommer tomme tilbage',
          body: 'de har ikke logget ind på Anvil med Discord endnu, eller deres kontos hiscores er ikke blevet læst endnu. Prøv igen med valgmuligheden `account`, eller bed dem logge ind én gang.',
        },
        {
          term: '`/coffer add` siger, at du ikke må',
          body: 'din rolle på Anvil-siden er ikke kasserer, admin eller ejer, eller også er denne Discord ikke den konto, du logger ind på siden med.',
        },
      ],
    },

    labels: {
      options: 'Valgmuligheder',
      noOptions: 'Ingen valgmuligheder — kør den bare.',
      example: 'Eksempel',
      examples: 'Eksempler',
      required: 'påkrævet',
      optional: 'valgfri',
      choices: 'Valg',
      range: 'fra {min} til {max}',
      kinds: {
        text: 'tekst',
        number: 'tal',
        member: 'et medlem',
        choice: 'vælg fra en liste',
        search: 'skriv for at søge',
        yesno: 'ja eller nej',
      },
    },

    examples: {
      'bingo board': {
        examples: ['/bingo board'],
        tip: 'Brættet, der kører lige nu. Indtil brættet er afsløret, forbliver feltnavnene også skjult her.',
      },
      'bingo leaderboard': {
        examples: ['/bingo leaderboard'],
        tip: 'Holdenes stilling, med point eller felter afhængigt af, hvordan brættet tæller.',
      },
      'bingo rules': {
        examples: ['/bingo rules'],
        tip: 'Hvordan dette bræt tæller (læst direkte fra selve eventet, så det altid passer), og derefter din klans egne husregler.',
      },
      'bingo apply': {
        examples: ['/bingo apply'],
        tip: 'Sådan kommer du med: tilmelding, gebyret, og hvor din egen tilmelding står.',
      },
      'bingo next': {
        examples: ['/bingo next'],
        tip: 'Hvad der kommer nu: en feltafsløring, en mission eller en deadline.',
      },
      'bingo me': {
        examples: ['/bingo me'],
        tip: 'Dit hold, din placering og de felter, der er krediteret dig.',
      },
      'bingo help': {
        examples: ['/bingo help'],
        tip: 'En kort liste over, hvad botten svarer på, inde i Discord.',
      },
      'bingo team': {
        examples: ['/bingo team', '/bingo team name:Iron Wolves'],
        tip: 'Et holds kort: score, holdliste og seneste felter. Udelad navnet for dit eget hold.',
      },
      sotw: {
        examples: ['/sotw', '/sotw language:Deutsch'],
        tip: 'Alle aktive Skill of the Week, toppen af hver, og hvor du ligger.',
      },
      botw: {
        examples: ['/botw'],
        tip: 'Alle aktive Boss of the Week og deres aktuelle stilling.',
      },
      eff: {
        examples: ['/eff', '/eff metric:Hours bossed'],
        tip: 'Klanens effektivitets-leaderboard og din placering på den. spilletimer som standard; vælg bosstimer for bossing.',
      },
      'coffer balance': {
        examples: ['/coffer balance'],
        tip: 'Kassens saldo, de største givere og de seneste bevægelser.',
      },
      'coffer add': {
        examples: ['/coffer add amount:5m', '/coffer add amount:250k note:Raffle proceeds'],
        tip: 'Kun kasserere, admins og ejere. Registrerer gp, der kommer ind; det bliver også skrevet i kassens feed-kanal.',
      },
      'coffer remove': {
        examples: ['/coffer remove amount:20m note:SOTW prize'],
        tip: 'Kun kasserere, admins og ejere. Nægter at tage kassen under nul; registrér det på kassesiden, hvis du mener det.',
      },
      'stats profile': {
        examples: ['/stats profile', '/stats profile player:Zezima'],
        tip: 'Én konto på et øjeblik: combat- og total level, spilletimer og bosstimer, antal i collection log og personlige rekorder.',
      },
      'stats levels': {
        examples: ['/stats levels', '/stats levels player:My Iron'],
        tip: 'Hver skills level og XP.',
      },
      'stats efficiency': {
        examples: ['/stats efficiency'],
        tip: 'Spilletimer og bosstimer, og hvilke skills og bosser de kommer fra.',
      },
      'stats clog': {
        examples: ['/stats clog', '/stats clog page:Zulrah'],
        tip: 'Fremskridt i collection log samlet, eller én boss’ side.',
      },
      'stats pbs': {
        examples: ['/stats pbs', '/stats pbs page:Theatre of Blood mode:Hard size:3'],
        tip: 'Personlige rekorder. Raids gemmer en tid pr. mode og holdstørrelse, så brug `mode` og `size` til at finde den tur, du mener.',
      },
      'stats luck': {
        examples: ['/stats luck', '/stats luck player:Zezima'],
        tip: 'Hvor heldig kontoen har været på tværs af de drops, Anvil holder øje med.',
      },
      'stats collectors': {
        examples: ['/stats collectors'],
        tip: 'Klanens største collection logs.',
      },
      'stats luckboard': {
        examples: ['/stats luckboard'],
        tip: 'Klanens mest uheldige og mest heldige medlemmer.',
      },
      setup: {
        examples: ['/setup topic:Plugin setup', '/setup topic:Plugin setup step:5'],
        tip: 'En opsætningsvejledning inde i Discord: listen over trin, eller ét trin med et link direkte til det på siden.',
      },
      guide: {
        examples: ['/guide guide:ToB 4-man gear'],
        tip: 'En af klanens spilguides (raids, bossing, money making…): begynd at skrive navnet, og vælg den på listen.',
      },
    },
  },
  moderator: {
    metaTitle: 'På vagt — Anvils moderatorguide',
    metaDescription:
      'En moderators dag på et Anvil-klansite: køen, godkendelse af indsendelser og konti, at holde medlemslisten ærlig, og de skøn der skal træffes.',
    eyebrow: 'Anvil · til moderatorer',
    title: 'På vagt',
    dek: 'En moderator tager det arbejde, der lander, uanset om der kører et event: beviser der skal ses på, konti der skal verificeres, en medlemsliste der driver. Her er, hvad køen består af, og hvordan du tømmer den uden selv at blive grunden til, at folk venter.',
    facts: [
      { strong: 'Ingen events', rest: 'en moderator kan hverken oprette eller redigere dem' },
      { strong: 'Én side', rest: 'siger hvad der venter på dig' },
      { strong: 'Godkend hurtigt', rest: 'en langsom kø føles som et ødelagt site' },
    ],
    footnote:
      'En moderator ser alt det, et medlem ser, plus gennemsynsfladerne. At oprette og redigere events, indstillinger, stab og udbetalinger er admin- og kassérjobs — er en knap der ikke, er det derfor, og det er med vilje.',

    what: {
      title: 'Hvad rollen er',
      intro:
        'Rollerne stabler nedad: alt en moderator kan, kan en kassér og en admin også. Det, en moderator specifikt ejer:',
      canList: [
        'medlemslisten: at tilføje og fjerne folk og svare på anmodninger om at komme ind ([Dine folk]({peopleGuide}))',
        'verificering af konti — XP-udfordringen og manuelt gennemsyn',
        'indsendelser og bevis-screenshots',
        'ugentlige konkurrencer og kalenderen',
        'events i klankalenderen',
      ],
      cantIntro: 'Det, de ikke kan, med vilje:',
      cantList: [
        'oprette eller redigere et event eller dets felter',
        'ændre klanindstillinger eller Discord-opsætning',
        'forfremme nogen eller røre ved staben',
        'afslutte et gebyr eller køre en udbetaling',
      ],
    },

    queue: {
      title: 'Start ved det, der venter på dig',
      body: [
        'Admin-dashboardet er ikke et overblik over siden — det er en liste over det, der venter, sorteret efter hvor meget det betyder, og regnet ud fra rigtige data frem for fra tællere, der driver. Står der, at intet venter på dig, så gør der ikke.',
        'Arbejd oppefra og ned. De ting, der når toppen, er dem med et menneske i den anden ende: en der ikke kan melde sig til, fordi kontoen ikke er verificeret, eller en hvis drop ikke er talt med, fordi ingen har kigget på det endnu.',
      ],
    },

    submissions: {
      title: 'Indsendelser og beviser',
      body: [
        'De fleste krediteringer når aldrig frem til dig: pluginnet ser droppet, arkiverer et screenshot stemplet med hold og et UTC-tidsstempel, og feltet bliver færdigt. Det, der lander i køen, er de manuelle felter og alt, pluginnet har markeret.',
        'Stemplet er dét, der gør et bevis svært at diskutere. Et plugin-screenshot bærer holdet og øjeblikket bagt ind i billedet, og med to-billeders bevis slået til viser billede nummer to et par sekunder senere, at loot har lagt sig på jorden. Et screenshot uden noget af det er et screenshot fra en telefon — hvilket er helt fint, det betyder bare, at det er dig, der tjekker efter.',
      ],
      rows: [
        {
          term: 'Godkend når det er sandsynligt',
          body: 'du reviderer ikke en bank. Viser billedet tingen, står kontoen på medlemslisten, og ligger tidsstemplet inde i eventet, så godkend det og gå videre.',
        },
        {
          term: 'Afvis med en begrundelse',
          body: 'en afvisning uden forklaring kommer tilbage som en DM til dig inden for en time. Sig hvad der manglede, så forsøg nummer to er rigtigt.',
        },
        {
          term: 'En markeret indsendelse er et spørgsmål, ikke en anklage',
          body: 'pluginnet markerer det, det ikke kunne bekræfte helt — oftest en spiller, der ikke har afleveret et startbillede. Læs det som “kig lige på den her”, ikke som “nogen har snydt”.',
        },
      ],
    },

    verify: {
      title: 'At verificere konti',
      intro:
        'Ingen kan melde sig til et event uden mindst én verificeret konto, så den her kø blokerer folk direkte fra at spille. Det er den, der er værd at tømme dagligt.',
      rows: [
        {
          term: 'Verificeret via pluginnet',
          body: 'efter det første ejerskabstjek genkender pluginet kontoen automatisk, og et stabilt kontofingeraftryk bevarer forbindelsen ved navneskift. En medlemslistekonto uden et kendt fingeraftryk bruger XP-tjek eller moderatorgodkendelse én gang.',
        },
        {
          term: 'Verify by XP',
          body: 'til spillere uden pluginnet. Siden vælger en tilfældig skill, og de skal tjene 1.000 XP i den inden for tredive minutter. Den tjekker sig selv — du ser kun dem, der fejler.',
        },
        {
          term: 'Manuelt gennemsyn',
          body: 'skjulte Hiscores eller en alt, der er for ny til at stå på dem. Nogen indsender et RSN med en note, og du bestemmer. Bed om et screenshot af login-skærmen, hvis noten ikke er nok.',
        },
      ],
      note: {
        tag: 'Verificeret er ikke det samme som medlem',
        body: 'At verificere en konto siger “den er virkelig deres”. Det gør dem ikke til en del af klanen. Medlemskab kommer kun fra en synkronisering af medlemslisten i spillet eller fra staben, der tilføjer dem i hånden, og en gæsteplads kun fra en anmodning om at komme ind, som staben godkender (eller med det samme, hvis klanen lukker alle ind). Det er med vilje, og det er dét, der forhindrer nogen i at melde sig ind i din klan ved at skrive et navn.',
      },
    },

    roster: {
      title: 'At holde medlemslisten ærlig',
      body: [
        'Medlemslisten kommer ét sted fra: en admin kører en synkronisering fra klanlisten i spillet med **Anvil**-knappen i titellinjen på klanvinduet (eller **Sync roster** i pluginnets sidepanel). Alt andet — verificeringer, tilknytninger, tilmeldinger — hænger på den.',
        'Så vedligeholdelsesjobbet er lille, men reelt: bed en admin om at køre synkroniseringen efter enhver rekrutteringsrunde (den gør gæster, der er kommet ind i klanen i spillet, til medlemmer), svar på anmodningerne om at komme ind øverst på **Roster**-fanen, og arbejd dig igennem **Needs review** i stedet for at vente på, at folk brokker sig. Se [Dine folk]({peopleGuide}).',
      ],
      note: {
        tag: 'Sidst set er ikke sidst spillet',
        body: 'Et medlems “sidst set i klanen”-tidsstempel viser den seneste synkronisering, der fandt dem — ikke sidste gang de loggede ind. Til spørgsmålet “spiller de stadig” skal du læse tidspunktet for deres live-statistik i stedet; det er det, der bevæger sig af sig selv.',
      },
    },

    startshot: {
      title: 'At gennemgå startbilleder',
      body: [
        'På et event, der kræver et, skal hver spiller aflevere et screenshot taget efter, at eventet gik i gang, på et sted der blev trukket i startøjeblikket. Plugin-billeder med et verificeret kodeord ankommer allerede godkendt, så i praksis kigger du kun på de spillere, der har uploadet i hånden fra en telefon.',
        'Det, du tjekker, er lille: at figuren er med på billedet, at kodeordet står i chatboksen, og at det er det kodeord, netop den spiller fik. Uploads tæller med det samme, og du ser dem igennem bagefter, så ingen bliver forhindret i at spille, mens de venter på dig.',
      ],
    },

    judgement: {
      title: 'De skøn, du kommer til at træffe',
      intro:
        'Ingen af dem har et rigtigt svar i software — og det er derfor, de ender hos et menneske.',
      rows: [
        {
          term: 'Beviset er ægte, men sent',
          body: 'droppet skete inde i eventet, og screenshottet kom efter, det sluttede. Godkend som regel — kig på stemplet i billedet, ikke på uploadtidspunktet.',
        },
        {
          term: 'Kontoen er ikke tilknyttet endnu',
          body: 'droppet er ægte, kontoen er deres, den blev bare ikke tilføjet, før de spillede. Få den tilknyttet, og godkend så. Få ikke nogen til at lave et raid om på grund af papirarbejde.',
        },
        {
          term: 'Det ser iscenesat ud',
          body: 'tag det til en admin frem for selv at afvise det. En afvisning er en offentlig anklage inde i en lille klan, og den bør aldrig være én persons hurtige beslutning.',
        },
        {
          term: 'Du er selv med i eventet',
          body: 'det er du næsten helt sikkert. Giv alt, der involverer dit eget hold, til en anden moderator — ikke fordi du ville være uretfærdig, men fordi du ikke skal stå og bevise, at du ikke var.',
        },
      ],
    },
  },

  tiles: {
    metaTitle: 'Feltregler og begrænsninger — Anvil',
    metaDescription:
      'Hvad hver slags bingofelt kræver af dig (spilindstillinger, RuneLite-pluginnet, en synkroniseret collection log, en hiscores-placering), og hvor grænserne går for, hvad det kan spore.',
    eyebrow: 'Anvil · til spillere',
    title: 'Feltregler og begrænsninger',
    dek: 'Hvert felt viser, hvad det kræver af dig, og hvad det ikke kan. Denne side forklarer hver linje; feltets **Why?**-links lander her.',
    needs: 'Kræver',
    limit: 'Godt at vide',
    checked: 'Feltet tjekker det for dig',
    englishOnly: 'Reglerne nedenfor er på engelsk indtil videre, så de altid passer med det, sitet faktisk gør.',
  },

  // /guide/creators — værtens vejledning til et creator-rum (lib/creatorSpaces). Skrevet til en, der
  // aldrig har brugt Anvil og ikke har nogen klan. Grænser og fordele følger lib/creatorCatalog.
  creators: {
    metaTitle: 'Hold et OSRS-bingo for dine seere — Anvil',
    metaDescription:
      'Kør et Old School RuneScape-bingo eller felt-løb til din stream uden en klan: lav et rum, del ét link, vælg hvem der må være med (Twitch, Kick, YouTube eller Discord), og vis brættet på stream med OBS.',
    eyebrow: 'Til streamere og creators',
    title: 'Hold events for dine seere',
    dek: 'Med et creator-rum kan du køre et bingo til din stream. Du behøver ikke en klan i spillet. Du laver ét event, deler ét link, og dine seere er med.',
    facts: [
      { strong: 'Ingen klan', rest: 'nødvendig' },
      { strong: 'Gratis', rest: 'at starte' },
      { strong: 'Ét link', rest: 'til din chat' },
    ],

    what: {
      title: 'Hvad et creator-rum er',
      body: [
        'Det er din egen side på Anvil på `{apex}/c/dit-navn`. Der kører du events for dine seere.',
        'Det er ikke en klan. Der er ingen klanliste, ingen rangordner og ingen ugentlige konkurrencer. Den, der er med i dit event, spiller det event. Ikke andet.',
        'Seerne logger ind med Discord, tilføjer deres RuneScape-karakter og trykker **Join**. Anvil RuneLite-pluginnet tæller så deres drops af sig selv.',
      ],
    },

    create: {
      title: 'Lav dit rum',
      body: [
        'Gå til [{apex}/host](/host) og log ind med Discord.',
        'Skriv et navn til dit rum. Navnet på din kanal er et godt valg. Dit link laves ud fra navnet. Tryk **change link**, hvis du vil have et andet.',
        'Tryk **Create my space**. Du får ét rum pr. Discord-konto.',
      ],
    },

    first: {
      title: 'Lav dit første event',
      body: [
        'Lige efter du har lavet dit rum, lander du på **Create your first event**. Senere bruger du **+ New event** øverst under **Your events**.',
        '**Name.** Det, dine seere ser.',
        '**What kind?** Vælg et kort. **Team bingo** er et 5×5-gitter, og Anvil deler spillerne i hold for dig. **Solo bingo** er det samme gitter, hver spiller for sig selv. **Team race** er opgaver i rækkefølge: holdet, der er længst, vinder.',
        '**Ready-made tiles** giver dig en blanding af lette til svære opgaver, du kan ændre senere. **Blank, I’ll write my own** starter tomt.',
        '**Who can join?** Lad den stå på **Anyone**, eller vælg, hvem der må være med. Se trin 5.',
        '**When?** Vælg start- og slutdato. Eller lad feltet stå tomt og start eventet selv, når du er klar.',
        'Tryk **Create event**. Tryk så **Copy invite link**.',
      ],
    },

    share: {
      title: 'Del linket',
      body: [
        'Sæt invitationslinket ind i din stream-chat, din Discord eller dine sociale medier. Det link er alt, dine seere har brug for.',
        'Du kan kopiere det igen når som helst: **Your events** → **Copy invite link** ved siden af eventet.',
        'Vil du have botten til at svare på `!join` i chatten med linket? Se trin 9.',
      ],
    },

    who: {
      title: 'Vælg hvem der må være med',
      body: [
        'Hvert event starter åbent for **Anyone**. Vil du holde det for dit fællesskab, så åbn eventets **Settings** → **Viewers** → **Who can join?** og vælg ét eller flere punkter. De samme valg er på skærmen til det første event.',
        'Vælger du mere end ét, **er ét af dem nok**. En følger ELLER en server-booster kommer ind.',
      ],
      intro: 'Hvert valg, og hvad en seer skal gøre:',
      rows: [
        {
          term: 'Anyone',
          body: 'Alle med linket kommer straks ind.',
        },
        {
          term: 'Twitch followers',
          body: 'Seeren trykker **Link Twitch** på event-siden og logger ind med Twitch. Anvil tjekker, at de følger dig.',
        },
        {
          term: 'Twitch subs',
          body: 'Som følgere, men de skal være subscribed. Vælg det laveste niveau: **Tier 1 or higher**, **Tier 2 or higher** eller **Tier 3**. Prime-subs tæller som tier 1. Din kanal skal være Twitch-affiliate eller -partner.',
        },
        {
          term: 'Kick followers',
          body: 'Kick fortæller ikke apps, hvem der følger dig, så Anvil tæller folk, der følger _efter_ du forbinder Kick. Fulgte de før? Så skal seeren fjerne følgen og følge igen. Er din Kick-chat kun for følgere? Slå **My Kick chat is followers-only** til i boksen **Kick channel**. Så tæller en seer, der skriver sin Anvil-kode i din chat, som følger.',
        },
        {
          term: 'Kick subs',
          body: 'Subs, som Anvil så efter du forbandt Kick, tæller af sig selv. Alle andre trykker **Get Kick code** og skriver koden (den ser ud som `ANVIL-7F3K9Q`) i din Kick-chat, og Anvil ser deres sub-badge. Kick har ingen sub-niveauer.',
        },
        {
          term: 'YouTube subscribers',
          body: 'Seeren trykker **Check my YouTube subscription** og logger ind med Google. Deres abonnementer skal være offentlige på YouTube.',
        },
        {
          term: 'YouTube members',
          body: 'Seeren skriver sin Anvil-kode i din YouTube live-chat. Medlemmer kan derfor kun komme med, **mens du er live**.',
        },
        {
          term: 'Discord role',
          body: 'Folk med en rolle, du vælger, i din Discord-server (op til 5 roller). Forbind først din server: **Discord (optional)** i menuen.',
        },
        {
          term: 'Server boosters',
          body: 'Folk, der booster din Discord-server. Kræver også, at din server er forbundet.',
        },
      ],
      note: {
        tag: 'Godt at vide',
        body: 'Forbind først din kanal (trin 7), ellers står Twitch-, Kick- og YouTube-valgene nedtonede. Én Twitch-, Kick- eller YouTube-konto kan kun få én spiller ind i hvert event. Dit staff og folk, du inviterer ved navn, springer tjekkene over.',
      },
    },

    approve: {
      title: 'Sig ja til hver spiller (valgfrit)',
      body: [
        'Vil du selv vælge, hvem der spiller? Åbn eventets **Settings** → **Viewers** → **Who can enter** og vælg **Ask me about everyone**. Tryk **Save changes**.',
        'Nu trykker seerne **Ask to join** i stedet for **Join**. De skal stadig først bestå dine **Who can join?**-valg.',
        'Deres anmodninger vises på **Your events** som **N waiting for you**. Klik på den, eller åbn eventets **Sign-ups**-fane. Listen øverst hedder **Waiting for your yes**. Acceptér eller afvis hver enkelt.',
      ],
    },

    channels: {
      title: 'Forbind din Twitch, Kick eller YouTube',
      body: [
        'Åbn **Settings** i menuen. I boksen **Twitch channel**, **YouTube channel** eller **Kick channel** trykker du **Connect Twitch**, **Connect YouTube** eller **Connect Kick** og logger ind som din kanal.',
        'Hver kanal, du forbinder, vises på din side som et **verified** link. Du kan ikke skrive et link ind i hånden: at logge ind er sådan, Anvil ved, at kanalen er din.',
        'En kanal kan kun være forbundet ét sted på Anvil. Er den allerede på et andet rum eller en anden klan, du styrer, spørger Anvil, om du vil flytte den.',
      ],
    },

    overlay: {
      title: 'Vis brættet på stream (OBS)',
      body: [
        'På **Your events** trykker du **Stream overlay** ved siden af eventet og så **Make overlay links**.',
        'Du får tre links. **Standings**: de bedste hold og hvor langt de er. **Feed**: de seneste drops og færdige felter. **Board**: brættet, med færdige felter markeret.',
        'Vælg en **Text size** (S, M, L eller XL), før du kopierer. Tryk så **Copy** ved siden af det, du vil have.',
      ],
      stepsTitle: 'Sæt det ind i OBS',
      steps: [
        'Tryk **+** under **Sources** i OBS og vælg **Browser**.',
        'Sæt linket ind i **URL**.',
        'Vælg en størrelse, for eksempel 800 × 600. Lad **Custom CSS** stå tom.',
        'Tryk **OK**. Det opdaterer sig selv hvert par sekunder.',
      ],
      tipsTag: 'Godt at vide',
      tips: [
        'Skriv `&limit=10`, `&title=0` eller `&align=right` til sidst i et link for at ændre det.',
        'Overlayet viser det samme som din offentlige event-side. Skjulte stillinger og skjulte felter forbliver også skjulte på stream.',
        '**Reset link** laver nye links og stopper de gamle. Brug det, hvis et link slipper ud. Du skal sætte de nye links ind i OBS igen.',
        'Et lille “Anvil”-mærke sidder i hjørnet. Med Gold-planen kan du skjule det under **Settings** → **Anvil mark on your overlay**.',
      ],
    },

    chatjoin: {
      title: '!join i din chat',
      body: [
        'Åbn **Settings** → **!join in Twitch chat** og slå det til.',
        'Når en seer skriver `!join`, svarer Anvil-botten (Anvil_OSRS) med linket til dit åbne event. Den svarer højst én gang hvert 30. sekund, uanset hvor mange der skriver det.',
        'Den svarer kun i en kanal, du forbandt i trin 7. Til Kick slår du **!join in Kick chat** til i boksen **Kick channel**.',
        'Intet event åbent? Så siger den det: “No event is open to join right now — keep an eye on the stream!”',
      ],
      tips: [
        'Hvis din chat blokerer links (Twitchs **Block hyperlinks** eller AutoMod), bliver bottens svar holdt tilbage. Skriv `/vip anvil_osrs` eller `/mod anvil_osrs` i din chat én gang, så linket kommer igennem.',
        'Er du i gang med et event? **Space settings** i eventets menu fører dig tilbage til disse kontakter. Det gør **Switch it on in your settings** under **Who can join?** også.',
      ],
    },

    page: {
      title: 'Gør din side til din egen',
      body: [
        'Din side er det, folk ser på `{apex}/c/your-name`, sammen med dine events. Åbn **Settings** → **Your page**. Hver del har sin egen gem-knap.',
      ],
      items: [
        '**Bio.** Et par linjer om dig og dine streams. Links, der starter med `https://`, kan klikkes.',
        '**Logo and banner.** Tryk **Upload a logo** eller **Upload a banner**. Banneret går hen over toppen af din side, så gør det bredt (3:1, for eksempel 1500 × 500). PNG, JPEG, GIF eller WebP. Begge må være animerede.',
        '**Panels.** Op til 8 kort under dine events, ligesom panelerne under en Twitch-kanal. Tryk **+ Add a panel**, og giv det en titel og lidt tekst. Et billede og et link er valgfrie. Brug pilene til at ændre rækkefølgen.',
        '**Schedule.** Hvornår du plejer at gå live, i din egen tidszone. Besøgende ser hvert tidspunkt på deres eget ur.',
        '**Featured.** Ét klip, fastgjort øverst på din side. Vælg et af dine stream-highlights (næste trin), eller indsæt et kliplink fra Twitch, YouTube, Kick eller Medal.',
        'Tryk **Preview your page** for at se siden, som besøgende ser den.',
      ],
      note: {
        tag: 'Jagex’ regler',
        body: 'Alt på din side skal følge Jagex’ regler: intet salg af guld eller konti, intet gambling, ingen bots og ingen private servere. Anvil tjekker dine ord og links, når du gemmer. Hvis Anvils staff skjuler din side efter en anmeldelse, står det i dine indstillinger. Spørg på Anvils Discord, hvis du mener, det er en fejl.',
      },
    },

    highlights: {
      title: 'Stream-highlights',
      body: [
        'Når din Twitch- eller YouTube-kanal er forbundet, fanger Anvil de store øjeblikke i dine events, mens du er live. Kontakterne ligger i **Settings** → **Stream highlights**.',
        '**Auto-clip big moments on my stream** er slået til, så snart du forbinder. Mens du er live på Twitch, laver Anvil et klip, når et af dine events starter, når et hold klarer hele brættet eller vinder, og når din egen karakter får et sjældent drop eller et pet. På YouTube gemmer Anvil i stedet et link til netop det sekund i din stream. Kick har ingen highlights endnu.',
        'Klippene vises under **Highlights** på eventsiden og på din side. Du kan fastgøre et som dit **Featured**-klip (trin 10).',
        '**Let Anvil feature clips from my events in its own promotion** er slået fra, indtil du slår det til. Så må Anvil dele et klip på sine egne sider og sociale medier, og du bliver altid krediteret.',
        'Dine spillere kan også klippe deres egne store øjeblikke. De slår **Clip my stream when I hit a big moment** til under deres Twitch-konto i **Settings** → **Connected accounts**.',
      ],
    },

    listing: {
      title: 'Bliv vist på Anvil',
      body: [
        'Dit rum er ikke vist, når du laver det. Kun folk med dit link kan finde det.',
        'Åbn **Settings** → **Advertise on Anvil** og slå det til. Dit rum vises i Anvils klanoversigt, og dine nye events vises på `{apex}/events`.',
        'Vil du kun vise ét event, så åbn dets **Settings** → **Viewers** → **List on Anvil**. Det vises, mens eventet er kommende eller i gang.',
        'Et event uden datoer vises under **Open to join**, markeret med “Open now · starts when the host starts it”.',
      ],
    },

    plans: {
      title: 'Planer og grænser',
      body: [
        'Din plan bestemmer, hvor mange spillere der kan være med i dine events på samme tid. Events, hvis datoer overlapper, deler det tal; events på forskellige datoer får det hver for sig. En spiller i to overlappende events tæller to gange. Alt andet er ens på alle planer: brættet, plugin-sporingen, overlayet og Discord.',
        'Dit plankort er på **Your events**. Vil du sammenligne planer, så se [priser](/pricing#creators). Vil du ændre eller opsige det, du betaler, så gå til [din betalingsside](/portal).',
      ],
      rows: [
        { term: 'Free', body: 'Op til 50 spillere på samme tid på tværs af dine events. Ét event ad gangen. Tjek af Discord-rolle og booster.' },
        { term: 'Bronze', body: 'Op til 150 spillere på samme tid på tværs af dine events. Tjek af Twitch, Kick og YouTube.' },
        { term: 'Silver', body: 'Op til 300 spillere på samme tid på tværs af dine events. Mere end ét event ad gangen. `!join` i chatten. Vist først på listen.' },
        { term: 'Gold', body: 'Op til 1.000 spillere på samme tid på tværs af dine events. Skjul Anvil-mærket på dit overlay.' },
        { term: 'Partner', body: 'Ingen grænse for spillere. Sættes op direkte med Anvil — kontakt os.' },
      ],
      note: {
        tag: 'Lige nu',
        body: 'Alle kommer stadig ind, mens Anvil vokser, også over din plans tal. Grænserne starter senere, med varsel. Dit plankort viser, hvor tæt du er på.',
      },
    },

    faq: {
      title: 'Spørgsmål',
      intro: 'De, streamere spørger mest om:',
      rows: [
        {
          term: 'Skal mine seere have en klan?',
          body: 'Nej. De skal bruge en Discord-konto og en OSRS-karakter. Send dem [seervejledningen]({joiningGuide}).',
        },
        {
          term: 'Skal de have RuneLite-pluginnet?',
          body: 'Til drops og kills, ja. Pluginnet sender dem ind af sig selv. Nogle få felter læser hiscores i stedet.',
        },
        {
          term: 'En seer siger “The host’s Twitch connection isn’t working”.',
          body: 'Twitch holdt op med at acceptere din forbindelse. Åbn **Settings** og tryk **Reconnect Twitch**. Det samme gælder Kick og YouTube.',
        },
        {
          term: 'Kan en anden hjælpe mig med at køre det?',
          body: 'Ja. Åbn **Players** → **Staff & roles**, tilføj dem, og vælg, hvad hver af dem må.',
        },
        {
          term: 'Jeg har også en klan i spillet.',
          body: 'Så har du måske ikke brug for et rum. En offentlig klan kan i stedet slå **Streaming** til. Se [streaming for klaner]({streamingGuide}).',
        },
        {
          term: 'Kan jeg lave et rum mere?',
          body: 'Ét rum pr. Discord-konto indtil videre. Kontakt os, hvis du har brug for et til.',
        },
        {
          term: 'Hvor finder jeg mit rums indstillinger?',
          body: 'Tryk **Settings** i menuen. Inde fra et event trykker du **Space settings** i eventets menu.',
        },
        {
          term: 'Hvad gør knappen **Report** på min side?',
          body: 'Alle, der er logget ind, kan anmelde din side, et panel, et event eller et highlight til Anvils staff. Anmeldelser går kun til staff. Hvis staff skjuler din bio, dine paneler, dit skema eller dit fremhævede klip, står det i dine indstillinger.',
        },
      ],
    },
  },

  // /guide/joining-a-streamer-event — til en seer, der klikkede på en streamers link. Antager intet:
  // ingen klan, ingen Anvil-konto, måske intet RuneLite-plugin. Knapperne står ordret som på siden.
  joiningStream: {
    metaTitle: 'Sådan er du med i en streamers OSRS-bingo — Anvil',
    metaDescription:
      'Fik du et link fra en streamer? Log ind med Discord, tilføj din OSRS-karakter, tryk Join. Hvad du gør ved events kun for følgere eller subs på Twitch, Kick eller YouTube, og hvordan dine drops tæller.',
    eyebrow: 'Til seere',
    title: 'Sådan er du med i en streamers event',
    dek: 'En streamer delte et link. Sådan kommer du på brættet. Du behøver ikke en klan.',
    facts: [
      { strong: '~2 min', rest: 'at komme med' },
      { strong: 'Ingen klan', rest: 'nødvendig' },
    ],

    join: {
      title: 'Kom med i fire trin',
      body: [
        '**Åbn linket**, streameren delte. Eller skriv `!join` i deres chat, så sender botten det.',
        '**Log ind med Discord.** Det er din Anvil-konto. Der er intet at udfylde.',
        '**Tilføj din karakter.** Tryk **Add my character** og skriv dit RuneScape-navn. Står der **Prove it’s mine**, så følg trinnene på din profil. [Plugin-vejledningen]({pluginGuide}) viser hvordan.',
        '**Tryk Join.** Vælg din karakter, hvis du har flere. Du ser **You’re in!**, når det lykkedes.',
      ],
    },

    gated: {
      title: 'Events for følgere eller subs',
      body: [
        'Nogle events er kun for streamerens fællesskab. Join-kortet siger hvem, for eksempel “Open to followers of somename on Twitch”.',
        'Tryk **Join** alligevel. Hvis du ikke er lukket ind endnu, viser kortet, hvad du skal gøre. Gør ét af dem, og tryk så **Join** igen.',
      ],
      intro: 'Hvad du gør for hver slags:',
      rows: [
        {
          term: 'Twitch follow or sub',
          body: 'Tryk **Link Twitch** og log ind med Twitch. Anvil beder ikke om nogen tilladelser. Tryk så **Join** igen.',
        },
        {
          term: 'Kick follow or sub',
          body: 'Tryk **Get Kick code**. Skriv koden (som `ANVIL-7F3K9Q`) i streamerens Kick-chat inden for 10 minutter. Hver kode virker én gang. Tryk så **Join** igen.',
        },
        {
          term: 'YouTube subscriber',
          body: 'Tryk **Check my YouTube subscription** og log ind med Google. Vælg den konto, du ser med. Dine abonnementer skal være offentlige i YouTubes privatlivsindstillinger.',
        },
        {
          term: 'YouTube member',
          body: 'Tryk **Link my YouTube account**, skriv så din kode i YouTube live-chatten og tryk **check the chat**. Det virker kun, mens streameren er live.',
        },
        {
          term: 'Discord role or booster',
          body: 'Kom med på streamerens Discord-server og få rollen (eller boost den). Anvil tjekker med den Discord-konto, du loggede ind med.',
        },
      ],
      note: {
        tag: 'Godkendelse',
        body: 'Nogle streamere siger ja til hver spiller. Så står der **Ask to join** på knappen, og du ser **Waiting for the host**, til de svarer.',
      },
    },

    plugin: {
      title: 'Installér Anvil-pluginnet',
      body: [
        'Dine drops og kills tæller gennem Anvil-pluginnet til RuneLite. Installér det fra Plugin Hub og log ind med Discord fra dets sidepanel.',
        '[Plugin-vejledningen]({pluginGuide}) leder dig igennem det på omkring tre minutter.',
      ],
    },

    play: {
      title: 'Spil',
      body: [
        'Det var det. Spil som du plejer. Når du får et drop eller et kill, som brættet skal bruge, sender pluginnet det ind af sig selv.',
        'Åbn event-linket når som helst for at se brættet og stillingen. Du spiller kun dette ene event: du bliver ikke medlem af en klan.',
      ],
    },

    accounts: {
      title: 'Dine forbundne konti',
      body: [
        'De Twitch-, YouTube- og Kick-konti, du har linket, står i [Settings → Connected accounts](/settings/account#streaming). Du kan også linke dem der, før du kommer med.',
        'Fjern et link når som helst. Events, du allerede er med i, beholder dig. Et event med krav, du kommer med i senere, beder dig linke igen.',
        'Linkede Twitch-, YouTube- og Kick-konti vises på din profil med et flueben: du har bevist, at de er dine. Slå **Show on my profile** fra for at skjule en. Et Medal-link er anderledes. Det indsætter du selv, så det får intet flueben.',
        'Streamer du selv på Twitch? Slå **Clip my stream when I hit a big moment** til under din Twitch-konto. Mens du er live i en streamers event, klipper Anvil dine sjældne drops, pets og færdige felter.',
      ],
    },

    faq: {
      title: 'Spørgsmål',
      intro: 'Når noget siger nej:',
      rows: [
        {
          term: '“This event is full”',
          body: 'Der er ikke plads til flere spillere. Kun streameren kan skabe plads — sig det til dem.',
        },
        {
          term: 'Jeg er subbed, men jeg kommer ikke ind.',
          body: 'Tjek, at du linkede den samme konto, du abonnerer med. På Twitch kan du se **Your Twitch** på join-kortet. På Kick skriver du en ny kode i deres chat: Anvil læser sub-badget på den besked. På YouTube skal du gøre dine abonnementer offentlige og tjekke igen.',
        },
        {
          term: 'Jeg fulgte på Kick, men der står, at jeg ikke gjorde.',
          body: 'Anvil ser kun følger, der kom, efter streameren forbandt Kick. Fjern følgen og følg igen, og tryk så **Join**.',
        },
        {
          term: '“That Twitch account was already used to join this event”',
          body: 'Én Twitch-konto (eller Kick eller YouTube) får én spiller ind. En anden er allerede kommet med på den.',
        },
        {
          term: '“Twitch didn’t answer just now”',
          body: 'Twitch, Kick, YouTube eller Discord havde et lille hik. Vent et minut og tryk **Join** igen.',
        },
        {
          term: '“The host’s … connection isn’t working”',
          body: 'Det er streamerens sag. Sig til dem, at de skal forbinde deres kanal på Anvil igen.',
        },
        {
          term: 'Mine drops vises ikke.',
          body: 'Tjek, at pluginnet er installeret og logget ind, og at du kom med med den karakter, du spiller. Se [plugin-vejledningen]({pluginGuide}).',
        },
        {
          term: 'Hvor finder jeg flere events som dette?',
          body: '[Eventsiden](/events) viser events, som alle kan være med i, også streameres events, der er åbne lige nu.',
        },
        {
          term: 'Noget på en streamers side bryder reglerne.',
          body: 'Tryk **Report** på siden, eventet eller highlightet. Vælg, hvad der er galt, og tryk **Send**. Det går kun til Anvils staff. Streameren får aldrig at vide, hvem der anmeldte det.',
        },
      ],
    },
  },

  // /guide/streaming-for-clans — en offentlig klan, der slår Streaming til (lib/streamingSwitch). Kun det,
  // der er anderledes end et creator-rum; de fælles værktøjer peger på creator-vejledningen.
  streamingClans: {
    metaTitle: 'Stream din klans events — Anvil',
    metaDescription:
      'Lad din streams seere være med i et af din klans OSRS-events uden at blive medlem af klanen: slå Streaming til, åbn et event for seere, og vælg hvilke seere der kommer ind.',
    eyebrow: 'Til klaner, der streamer',
    title: 'Streaming for klaner',
    dek: 'Streamer din klan sine events? Lad seere spille ét event uden at blive medlem af din klan.',

    on: {
      title: 'Slå Streaming til',
      body: [
        'Gå til Admin → **Clan settings** → **Profile** og slå **Streaming** til.',
        'Kun en offentlig klan kan streame. Seerne skal kunne åbne din event-side, og en privat klan skjuler den for dem. En klan med Streaming slået til kan ikke blive privat, før du slår det fra.',
        'Når det er slået til, forbinder du din Twitch-, YouTube- eller Kick-kanal lige under.',
      ],
    },

    event: {
      title: 'Åbn et event for seere',
      body: [
        'Hvert event forbliver **Members only**, til du siger andet. Sådan var det før.',
        'Åbn eventets **Settings** → **Entry & co-hosts** → **Who can join?** og vælg **Members and viewers**. Vælg så **Which viewers?**: alle, eller følgere, subs, en Discord-rolle og så videre. Tryk **Save**.',
        'Disse tjek gælder kun seere. Dine klanmedlemmer kommer altid ind, som før.',
      ],
    },

    viewers: {
      title: 'Hvad seere er',
      body: [
        'En seer, der deltager, er en **event player**. De spiller det ene event.',
        'De er ikke klanmedlemmer og ikke gæster. De kommer aldrig på din klanliste, og de får ingen rang.',
        'Du kan se alle, der er kommet ind på den måde, under **People** → **Past viewers**.',
        'En stamgæst du gerne vil beholde? **Make guest** på deres række gør dem til en klangæst, så de kan deltage i alle dine events, der er åbne for gæster, ikke kun dette. **Make a guest a viewer again** gør en gæst til en seer af ét event igen.',
      ],
    },

    tools: {
      title: 'Dine stream-værktøjer',
      body: [
        'Streamer-værktøjerne virker som i et creator-rum: verificerede kanallinks, **Who can join?**-tjek, OBS-overlayet og `!join` i chatten.',
        'Overlay-linkene til et klan-event ligger i eventets **Settings** → **Stream** → **Stream overlay**. `!join` og overlay-mærket ligger under **Clan settings** → **Profile** → **Streaming**.',
        '[Creator-vejledningen]({creatorsGuide}) forklarer hver enkelt trin for trin.',
        'Stream-highlights virker også her: med Twitch eller YouTube forbundet klipper Anvil de store øjeblikke i events, der er åbne for seere. `!join` i Kick-chat har sin egen kontakt i boksen **Kick channel**.',
      ],
    },

    faq: {
      title: 'Spørgsmål',
      intro: 'De korte svar:',
      rows: [
        {
          term: 'Tæller seere med i vores medlemsgrænse?',
          body: 'Nej. De er event players, ikke medlemmer. Streamer-grænserne tæller spillere på samme tid på tværs af de events, du kører (se [creator-vejledningen]({creatorsGuide})).',
        },
        {
          term: 'Sender `!join` folk til et event kun for medlemmer?',
          body: 'Nej. Den peger kun på et event, der er åbent for seere.',
        },
        {
          term: 'Skal jeg lave et creator-rum i stedet?',
          body: 'Kun hvis du ikke har en klan. Et rum er til streamere uden klan i spillet.',
        },
      ],
    },
  },

  people: {
    metaTitle: 'Dine folk: medlemsliste, gæster og hvem der kan komme ind — Anvil',
    metaDescription:
      'Hvor en Anvil-klans medlemsliste kommer fra, hvad Members, Guests, Roster only, Departed og Quiet betyder, hvordan anmodninger om at komme ind og Needs review fungerer, de tre indstillinger under Who can join, og hvordan du fjerner eller bandlyser nogen.',
    eyebrow: 'Anvil · til klanens stab',
    title: 'Dine folk: medlemsliste, gæster og hvem der kan komme ind',
    dek: 'Alle under Admin → **People** er kommet dertil på en af fire måder: klanlisten i spillet nævnte dem, staben godkendte dem, klanen lukker alle ind, eller nogen tilføjede dem i hånden. Her er, hvordan hver af dem virker, hvad Roster-fanen fortæller dig, og hvad du skal tjekke, når nogen står det forkerte sted.',
    facts: [
      { strong: 'Medlemslisten i spillet', rest: 'den eneste automatiske vej til at blive medlem' },
      { strong: 'At logge ind', rest: 'sætter aldrig nogen på medlemslisten' },
      { strong: 'To køer', rest: 'på to forskellige faner' },
    ],
    footnote:
      'Alt her ligger under Admin → **People**. Roster og Needs review er moderatorarbejde. **Who can join** og **Staff & roles** er faner kun for admins. Hvem der kan hvad i hele adminområdet, står i [Stabsroller: hvem kan hvad]({staffGuide}).',

    roster: {
      title: 'Hvor medlemslisten kommer fra',
      body: [
        'Medlemslisten er klanlisten fra spillet, kopieret over på siden. En admin sender den fra RuneLite med Anvil-pluginnet: tryk på **Anvil**-knappen i klanvinduets titellinje eller på **Sync roster** i pluginnets sidepanel. Alle på listen kommer ind som **medlem** med deres rang fra spillet. Kun en med Admin-rollen på siden kan sende den. Alle andre får det at vide i spillet.',
        'En synkronisering er det eneste, der gør nogen til medlem af sig selv. Forlader nogen klanen i spillet, bliver de markeret som udmeldt ved næste synkronisering, og melder de sig ind igen, kommer de tilbage ved synkroniseringen efter. Deres historik bliver liggende i begge tilfælde.',
        'Alle andre pladser er **gæstepladser**: folk, der spiller med i jeres events uden at være i klanen i spillet. Gæster bliver tracket og kan deltage i events. De er ikke medlemmer, og de tæller ikke med i jeres abonnement.',
      ],
      note: {
        tag: 'At logge ind sætter aldrig nogen på medlemslisten',
        body: 'At logge ind med Discord, linke en karakter eller spille med pluginnet giver ingen en plads. Ser pluginnet nogen, hvis klan i spillet er jeres, men som ikke står på medlemslisten endnu, beder det om at få dem ind (se trin 3). Alle andre har bare en Anvil-konto uden klan. Det er det, der forhindrer en fremmed i at komme ind i jeres klan ved at skrive dens navn.',
      },
    },

    filters: {
      title: 'Sådan læser du Roster-fanen',
      intro:
        'Bjælken øverst deler medlemslisten op i **Members**, **Guests** og **Departed**. Klik på et felt for at filtrere på det. Knapperne under den skærer listen yderligere ned:',
      rows: [
        {
          term: 'Active',
          body: 'medlemmer, der stadig står på medlemslisten. Gæster og udmeldte er udeladt.',
        },
        {
          term: 'Quiet 7d+',
          body: 'medlemmer, pluginnet ikke har set spille i syv dage eller mere. Har nogen aldrig brugt pluginnet, er de ikke med her, for der er intet at bedømme dem på. Deres **Last played** viser i stedet **no plugin data**.',
        },
        {
          term: 'Guests',
          body: 'nuværende gæstepladser: folk, der spiller med i jeres events, men ikke er i klanen i spillet.',
        },
        {
          term: 'Roster only',
          body: 'nuværende medlemmer og gæster, der endnu ikke har en konto på siden. Helt normalt for alle, der aldrig har logget ind med Discord. De bliver stående på medlemslisten og logger ind og linker karakteren, når de vil tilmelde sig noget.',
        },
        {
          term: 'Departed',
          body: 'folk, der har forladt klanen i spillet, eller som staben har fjernet. Deres resultater og historik bliver liggende.',
        },
        {
          term: 'All',
          body: 'alle ovenstående.',
        },
      ],
      outro:
        'Kolonnen **Source** viser, hvordan hver plads startede: **Clan sync**, **Added manually** eller **Applied or self-reported**. **Last played** kommer fra pluginnet, ikke fra synkroniseringen af medlemslisten.',
      note: {
        tag: 'Rang og rolle er to forskellige ting',
        body: 'De to rullemenuer ved siden af knapperne filtrerer på rang i spillet og på rolle på siden. Rangen er det, spillet melder. Rollen på siden er det, en admin sætter under **Staff & roles**. Den ene sætter aldrig den anden.',
      },
    },

    review: {
      title: 'Anmodninger om at komme ind og Needs review',
      intro: 'To slags folk venter på et ja, og de venter på hver sin fane.',
      rows: [
        {
          term: 'Asking to join',
          body: 'øverst på **Roster**-fanen, kun vist mens nogen venter. En anmodning kommer fra siden (de trykkede **Apply** på jeres klanside eller prøvede at deltage i et af jeres events) eller fra pluginnet (det så dem spille i jeres klan i spillet, før medlemslisten havde dem). Hver række viser hvilken, og om de er medlem af en anden klan. **Approve** giver dem en gæsteplads. **Decline** giver dem besked, som Discord-DM, når jeres bot kan nå dem. Sæt flueben ved flere for at svare dem på én gang.',
        },
        {
          term: 'Awaiting confirmation',
          body: 'på **Needs review**. Folk, der har linket en af karaktererne på jeres medlemsliste ved at få XP på den, ved at spørge eller ved at spille den med pluginnet. De kan allerede spille, mens de venter. Tjek, at Discord-navnet passer til karakteren, og tryk så **Approve**. **Not our member** tager karakteren af jeres liste og lader den blive hos sin ejer. **Report to Anvil** er til en karakter, der ikke er deres.',
        },
        {
          term: 'Claim requests',
          body: 'også på **Needs review**. Nogen har spillet en karakter, der allerede er et etableret medlem her, så Anvil ville ikke selv linke den til dem. Ved du, at det er dem, så tryk **Yes, that’s them**; ellers **Not them**. En karakter, der kun nogensinde har været i jeres klan, bliver linket med det samme. En, der også er i en anden klan, går til Anvil, der afgør det.',
        },
      ],
      note: {
        tag: 'Mærket tæller ikke anmodninger om at komme ind',
        body: 'Tallet på **Needs review** og på **People** i sidebjælken tæller Awaiting confirmation og Claim requests. Anmodninger om at komme ind er ikke med, så kig også øverst på Roster-fanen.',
      },
    },

    policy: {
      title: 'Hvem der kan komme ind',
      intro:
        'Admin → People → **Who can join** har tre indstillinger, og kun admins ser fanen. Den, der afgør, hvordan udefrakommende kommer ind, er **Players from other clans**:',
      rows: [
        {
          term: 'Ask first',
          body: 'standarden. Den, der ansøger, eller som pluginnet opfanger fra jeres klan i spillet, venter som en anmodning, indtil staben godkender dem. Ingen får en plads uden et ja.',
        },
        {
          term: 'Let anyone in',
          body: 'det er nok at spørge. De får en gæsteplads med det samme, og der oprettes ingen anmodning. Godt til et åbent event, ellers mest støj.',
        },
        {
          term: 'No guests',
          body: 'kun jeres egne medlemmer spiller. Spillere fra andre klaner kan ikke deltage i jeres events eller bede om at komme ind, og pluginnet opretter intet for dem.',
        },
      ],
      outro:
        '**Who can see this clan** er enten **Anyone** (et link til et bræt virker for den, du sender det til) eller **Members only** (alle andre ser klanens kort og en opfordring til at ansøge). **List in the Clan Hall** sætter klanen på den offentlige liste over klaner. At slå den fra gør ikke klanen privat.',
      note: {
        tag: 'Ingen af dem rører jeres medlemmer',
        body: 'Synkroniseringen af medlemslisten giver medlemmer en plads, uanset hvad der står her. Jeres egen stab bliver heller aldrig behandlet som gæster: en fra stabens karakter får en medlemsplads uden en anmodning.',
      },
    },

    manual: {
      title: 'Tilføj nogen i hånden',
      body: [
        'Roster → **+ Add Manually** sætter én karakter på medlemslisten. Udfyld **RSN** og eventuelt deres **Discord ID** og **Rank**. Sæt flueben i **Add as guest** for en, der ikke er i jeres klan i spillet. Både moderatorer og admins kan gøre det.',
        'Brug det til en, synkroniseringen ikke kan se endnu, fx en rekrut, der kom ind efter sidste synkronisering. Pladsen bliver markeret **Added manually**, og synkroniseringen respekterer den som jeres beslutning: fjerner du senere en plads, du tilføjede i hånden, bringer næste synkronisering den ikke tilbage.',
        'At sætte nogen på medlemslisten tilmelder dem ikke et event. Det gør du på eventets fane **Sign-ups** med **Add member**. Den er kun for admins.',
      ],
    },

    removing: {
      title: 'Fjern og bandlys',
      intro: 'Hver række på medlemslisten har en handlingsmenu. Punkterne gør forskellige ting:',
      rows: [
        {
          term: 'Demote to guest',
          body: 'de bliver på listen og kan stadig sættes i events, men tæller ikke længere som medlem. **Promote to member** gør det om.',
        },
        {
          term: 'Remove from roster',
          body: 'markerer dem som udmeldt. Deres historik og resultater bliver liggende. Er de stadig i jeres klan i spillet, kan næste synkronisering af medlemslisten tilføje dem igen.',
        },
        {
          term: 'Not our member',
          body: 'på Needs review, til en karakter, nogen har linket, men som ikke er i jeres klan. Den ryger af jeres liste og bliver hos sin ejer.',
        },
        {
          term: 'Ban from this clan',
          body: 'afslutter alle pladser, personen har her, alts inklusive, fjerner enhver stabsrolle og brætopgave, de har i denne klan, og forhindrer dem i at komme tilbage: synkroniseringen, pluginnet og anmodninger om at komme ind afviser dem alle, indtil bandlysningen bliver ophævet. Deres Anvil-konto og deres andre klaner bliver ikke rørt. Kun for admins, kun for en med en konto på siden og en rolle under admin, fra rækkens menu, fra **Staff & roles** eller for flere personer på én gang. At ophæve en bandlysning sætter dem ikke tilbage; de melder sig ind igen i spillet, eller du tilføjer dem.',
        },
      ],
      note: {
        tag: 'En bandlysning fjerner også deres stabsrolle',
        body: 'At bandlyse nogen afslutter deres pladser og fratager dem deres stabsrolle og eventuelle opgaver som brætredaktør eller brætkasserer på klanens bræt. At ophæve bandlysningen giver dem ikke tilbage: sæt rollen igen under Staff & roles, hvis de skal have den.',
      },
    },

    faq: {
      title: 'Almindelige spørgsmål',
      intro: 'Det, der som regel forklarer, at nogen står det forkerte sted.',
      rows: [
        {
          term: 'En fra klanen mangler',
          body: 'Kør først en synkronisering af medlemslisten: listen ændrer sig kun, når en admin sender den. Tjek så **Departed**, hvis de er blevet fjernet, og om de er bandlyst; synkroniseringen springer alle bandlyste her over og melder, hvem den sprang over. Er klanen over sit abonnement, og er henstandsperioden udløbet, holder synkroniseringen op med at tilføje nye medlemmer, indtil I opgraderer eller skærer ned på medlemslisten.',
        },
        {
          term: 'En står som gæst, men er i klanen',
          body: 'Som regel er de stadig medlem af en anden klan på Anvil. En karakter kan kun være medlem af én klan ad gangen, så synkroniseringen giver dem en gæsteplads her og gør dem til medlem ved første synkronisering, efter de har forladt den anden klan. Ellers kom de ind via en anmodning, eller nogen har degraderet dem eller tilføjet dem som gæst. Kør en synkronisering, eller brug **Promote to member**.',
        },
        {
          term: 'En har logget ind, men står ikke på medlemslisten',
          body: 'Det er forventet. At logge ind opretter en Anvil-konto, ikke en plads. De dukker op, når synkroniseringen har dem med, når du godkender deres anmodning, eller når du tilføjer dem i hånden.',
        },
        {
          term: 'Navne som #Player1234',
          body: 'RuneLite viser sådan en pladsholder et øjeblik, mens en spiller logger ind, og for klanmedlemmer, det ikke kan navngive. Anvil ignorerer de navne nu: synkroniseringen springer dem over, pluginnet opretter ingen anmodning for dem, og gamle anmodninger under sådan et navn er skjult. Står der stadig et på jeres medlemsliste, er det en gammel række. **Remove from roster** fjerner den.',
        },
        {
          term: 'Et fjernet medlem bliver ved med at komme tilbage',
          body: 'At fjerne nogen ændrer ikke klanen i spillet, så næste synkronisering tilføjer dem igen, så længe spillet stadig har dem på listen. Fjern dem i spillet, eller bandlys dem her.',
        },
        {
          term: 'En moderator kan ikke se Who can join',
          body: 'Det er en fane kun for admins, ligesom Staff & roles. Se [Stabsroller: hvem kan hvad]({staffGuide}).',
        },
      ],
    },
  },

  staffRoles: {
    metaTitle: 'Stabsroller: hvem kan hvad — Anvil',
    metaDescription:
      'Klanrollerne på Anvil (ejer, admin, kasserer, moderator, medlem), hvad hver af dem når, hvordan du gør nogen til moderator, hvem der kan give hvilken rolle, og de opgaver, der kun gælder ét event.',
    eyebrow: 'Anvil · til ejere og admins',
    title: 'Stabsroller: hvem kan hvad',
    dek: 'Fem roller, sat for hver klan under Admin → People → **Staff & roles**. En rolle her giver intet i nogen anden klan, og ingen kan give en rolle, der er lige så høj som eller højere end deres egen. Denne side er hele kortet: hvad hver rolle når, hvordan du giver en, og de opgaver, der dækker et enkelt event.',
    facts: [
      { strong: 'For hver klan', rest: 'en rolle her betyder intet andre steder' },
      { strong: 'Under din egen', rest: 'er alt, du kan give' },
      { strong: 'Ejer', rest: 'skifter kun ved overdragelse' },
    ],
    footnote:
      'Roller bliver tjekket igen ved hver sidevisning, så en ændring gælder fra personens næste klik; de behøver ikke logge ud. Om selve medlemslisten, se [Dine folk]({peopleGuide}). Om en moderators hverdag, se [På vagt]({moderatorGuide}).',

    roles: {
      title: 'Rollerne',
      intro: 'Alle, der logger ind med Discord, starter som almindeligt **Member**. Derover:',
      rows: [
        {
          term: 'Ejer',
          body: 'den, der oprettede klanen, indtil de giver den videre. Alt, hvad en admin kan, plus at overdrage ejerskabet og slette klanen. Der er præcis én, og ingen kan degradere, fjerne eller bandlyse dem.',
        },
        {
          term: 'Admin',
          body: 'alt undtagen at overdrage klanen: events og bræt, indstillinger, Discord, staben og klanens penge.',
        },
        {
          term: 'Kasserer',
          body: 'gebyrer, kassen og præmier, oven i alt det, en moderator gør: medlemslisten, beviser, konkurrencer, Schedule og Needs review.',
        },
        {
          term: 'Moderator',
          body: 'nye folk, medlemslisten, beviser, ugentlige konkurrencer og klanevents. Ingen events eller bræt, ingen indstillinger, ingen stab og ingen penge.',
        },
        {
          term: 'Medlem',
          body: 'ingen opgave i staben. Spiller, tilmelder sig og kan indberette en donation til kassen.',
        },
      ],
      outro:
        'Under rollen på Staff & roles sidder to afkrydsningsfelter, for alle under admin, almindelige medlemmer inklusive. **Can build bingo boards** åbner Tiles-fanen på alle bræt og Task library. **Can write guides** lader dem skrive klanens guides. Admins har begge dele i forvejen.',
    },

    assign: {
      title: 'Sådan gør du nogen til moderator',
      intro:
        'De skal have logget ind med Discord og linket en karakter, der står på jeres medlemsliste, som medlem eller gæst. Så:',
      steps: [
        'Åbn Admin → **People** → **Staff & roles**.',
        'Listen åbner på **Staff**. Skift til **Members** eller **All accounts**, og søg efter deres navn.',
        'Vælg **Moderator: newcomers, roster, sign-ups, proofs** i kolonnen **Role**. Det gemmes, så snart du vælger.',
        'Skal de også bygge bræt, så sæt flueben i **Can build bingo boards**.',
      ],
      outro:
        'Har de ikke logget ind endnu? Find deres karakter på **Roster**-fanen, åbn dens menu, og vælg **Set role**. Så gemmes rollen på karakteren. De får den første gang, de logger ind og linker den, eller, hvis de venter på Needs review, når en moderator godkender dem.',
      note: {
        tag: 'Tag den fra dem igen',
        body: 'Sæt rollen tilbage til **Member**. At ændre nogens rolle fjerner også de brætopgaver, de havde på klanens bræt (se trin 5), så giv dem dem igen bagefter, hvis de skal beholde dem.',
      },
    },

    who: {
      title: 'Hvem kan give hvad',
      intro:
        'Staff & roles er en fane kun for admins, og hver ændring på den bliver tjekket mod to regler: du kan kun give en rolle under din egen, og du kan kun ændre en, hvis rolle er under din egen.',
      rows: [
        {
          term: 'Ejeren',
          body: 'kan give og fratage Admin, Treasurer og Moderator.',
        },
        {
          term: 'En admin',
          body: 'kan give og fratage Treasurer og Moderator. En admin kan ikke gøre en anden til admin, ændre en anden admin eller ændre sin egen rolle.',
        },
        {
          term: 'Kasserere og moderatorer',
          body: 'kan ikke ændre nogens rolle. Fanen er skjult for dem.',
        },
        {
          term: 'Ingen',
          body: 'kan ændre ejerens rolle, fjerne ejeren eller bandlyse dem. Klanen beholder også altid én admin: den sidste kan ikke degraderes.',
        },
      ],
      note: {
        tag: 'Overdrag klanen',
        body: 'Det kan kun ejeren, og kun til en, der allerede er admin: den admins række får handlingen **Make owner**. Af sikkerhedshensyn tager det 3 dage, ligesom når man skifter bank-PIN: et banner på alle admin-sider viser, hvornår det sker, du kan trykke **Cancel** indtil da, de kan trykke **Decline**, og Anvils staff får besked og kan stoppe det. Når de 3 dage er gået, bliver de ejer, og du bliver almindelig admin. Kun den nye ejer kan overdrage den tilbage.',
      },
    },

    table: {
      title: 'Hvem kan hvad',
      intro:
        'Hvad hver rolle når i adminområdet. “Hvis valgt” betyder feltet **Can build bingo boards** eller **Can write guides** under Staff & roles.',
      areaLabel: 'Område',
      columns: ['Ejer', 'Admin', 'Kasserer', 'Moderator', 'Medlem'],
      rows: [
        { area: 'Dashboard', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Events: oprette, redigere, hold, tilmeldinger, starte', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Felter på bræt og Task library', cells: ['Ja', 'Ja', 'Hvis valgt', 'Hvis valgt', 'Hvis valgt'] },
        { area: 'Beviser, der skal tjekkes', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Ugentlige konkurrencer', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Klanevents', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Schedule', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Medlemsliste: se, tilføje, fjerne', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Anmodninger om at komme ind og Needs review', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Bandlyse nogen fra klanen', cells: ['Ja', 'Under admin', 'Nej', 'Nej', 'Nej'] },
        { area: 'Staff & roles', cells: ['Ja', 'Under admin', 'Nej', 'Nej', 'Nej'] },
        { area: 'Who can join', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Kassen og præmiestiger', cells: ['Ja', 'Ja', 'Ja', 'Nej', 'Nej'] },
        { area: 'Gebyrer: markere som indsamlet', cells: ['Ja', 'Ja', 'Ja', 'Nej', 'Nej'] },
        { area: 'Gebyrer: bekræfte (den anden underskrift)', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Discord-indstillinger', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Poste i Discord', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Klanindstillinger: Profile, Features, Rules & scoring, Boosts', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Abonnement og betaling', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Guides', cells: ['Skrive', 'Skrive', 'Læse; skrive hvis valgt', 'Læse; skrive hvis valgt', 'Skrive hvis valgt'] },
        { area: 'Aktivitetslog', cells: ['Ja', 'Ja', 'Ja', 'Ja', 'Nej'] },
        { area: 'Synkronisere medlemslisten fra RuneLite', cells: ['Ja', 'Ja', 'Nej', 'Nej', 'Nej'] },
        { area: 'Overdrage ejerskabet, slette klanen', cells: ['Ja', 'Nej', 'Nej', 'Nej', 'Nej'] },
      ],
      note: {
        tag: 'Skjult er ikke det samme som tilladt',
        body: 'Sidebjælken viser kun det, din rolle kan bruge, men det tjek, der tæller, kører på serveren. Skriver du adressen på en side, din rolle ikke kan bruge, bliver du sendt tilbage til dashboardet, og handlingen bag den bliver afvist.',
      },
    },

    event: {
      title: 'Opgaver på ét event',
      intro:
        'Nogle opgaver dækker et enkelt event i stedet for klanen. En admin giver dem på selve eventet, og de når det event og intet andet, så de er trygge at give til et almindeligt medlem.',
      rows: [
        {
          term: 'Brætredaktør',
          body: 'bygger og redigerer felterne på det bræt. Gives under eventets **Settings** → **Staff** → **Board staff** eller med **Boards…** i en persons handlinger under Staff & roles. Et medlem, der får en, ser kun sine bræt i adminområdet.',
        },
        {
          term: 'Brætkasserer',
          body: 'indsamler det bræts gebyrer og står for dets udbetalinger uden at nå klanens kasse. I adminområdet ser de kun deres egne bræt, og kun hvert bræts faner **Sign-ups** og **Prizes**. Gives også under **Board staff**.',
        },
        {
          term: 'Holdstab',
          body: 'styrer ét hold: dets trup, dets indsendelser og beviser, og at markere spillernes gebyrer som betalt. De kan ikke røre et andet hold, redigere brættet, drafte eller skifte nogen ud, når eventet er live. Tilføjes på holdets side under **Team staff**. Det er sådan en gæsteklans moderator styrer sin halvdel af en clan-mod-clan.',
        },
        {
          term: 'Kaptajn',
          body: 'udpeget af værten til ét hold. Alt, hvad holdstaben kan, plus at foretage holdets draftvalg.',
        },
      ],
      note: {
        tag: 'En klanrolle erstatter brætopgaver',
        body: 'At give nogen en klanrolle, eller ændre den, fjerner deres opgaver som brætredaktør og brætkasserer på klanens bræt. Staff & roles advarer dig først, hvis brætopgaver er alt, de har. Giv dem dem igen bagefter, hvis de skal beholde dem.',
      },
    },

    safety: {
      title: 'Sådan holdes det sikkert',
      intro: 'Det her gælder, uanset hvordan rollerne er sat.',
      rows: [
        {
          term: 'Ejeren er beskyttet',
          body: 'deres række under Staff & roles viser **Protected**. Deres rolle kan ikke ændres, og de kan ikke bandlyses. Ejerskabet skifter kun, når de selv overdrager det.',
        },
        {
          term: 'Admins kan ikke fjerne hinanden',
          body: 'en admin kan hverken degradere eller bandlyse en anden admin, hverken én ad gangen eller flere på én gang. Er to admins uenige, afgør ejeren det. En bandlysning fratager også personen deres stabsrolle og brætopgaver i denne klan.',
        },
        {
          term: 'Penge kræver to personer',
          body: 'når et gebyr skal bekræftes, skal bekræftelsen komme fra en anden admin end den, der markerede det som indsamlet. Hvor mange bekræftelser et gebyr kræver, fra nul til fem, sættes under **Clan settings** → **Rules & scoring** → **Fee sign-off**. En admin, der er alene om pengene, kan stadig tvinge et gebyr lukket med en særskilt knap.',
        },
        {
          term: 'Det kan en moderator ikke',
          body: 'oprette eller redigere events, ændre indstillinger eller Discord, give nogen en rolle (heller ikke sig selv) eller røre klanens penge.',
        },
        {
          term: 'Det hele bliver registreret',
          body: 'rolleændringer, overdragelser af ejerskab, bandlysninger og besvarede anmodninger om at komme ind bliver skrevet i **Activity log**, som alle i staben kan læse.',
        },
        {
          term: 'Discord-roller er noget andet',
          body: 'Anvils rollesynkronisering matcher Discord-roller med **rang i spillet**, ikke med roller på siden. At gøre nogen til moderator her giver dem intet på jeres Discord-server, og en moderatorrolle, du har givet i hånden i Discord, bliver ladet i fred. Den ene botkommando, der ændrer noget, at lægge til kassen med `/coffer`, tjekker rollen på siden: kasserer, admin eller ejer.',
        },
      ],
    },
    log: {
      title: 'Aktivitetsloggen',
      body: [
        '**Activity log** i admin-menuen viser de nyeste 200 ændringer, og alle stabsmedlemmer kan læse den: tilslutninger, afgange, omdøbninger og verifikationer, ejerskabsoverdragelser, kaptajner tilføjet og fjernet, tilmeldinger godkendt eller afvist, gebyrer bekræftet, funktioner slået til eller fra og indstillinger ændret. **Filter by event type** indsnævrer den.',
        'Det er også der, dubletter bliver ryddet op. **Merge two members** slår en dublet ind i den rigtige, og **Suspected renames** viser navneændringer, Anvil har set, som du kan bekræfte eller afvise.',
      ],
    },
  },
  supporter: {
    metaTitle: 'Anvil Supporter: niveauer og fordele — Anvil',
    metaDescription:
      'Hvad Anvil Supporter, Champion og Patron hver især får: navnefarver og stjernen, guld-GZ, animeret avatar og banner, vitrinen, vennevents, head-to-head, eventchat og klan-boosts. Hvordan betalingen via Gumroad fungerer, og hvad der sker, når du opsiger.',
    eyebrow: 'Anvil · til spillere',
    title: 'Anvil Supporter: niveauer og fordele',
    dek: 'Anvil Supporter er et personligt abonnement, der betaler for Anvils servere. Det findes i tre niveauer, og hvert af dem har alt det, niveauet under har. Hver fordel er udseende eller plads til at arrangere: tracking, events, point og dine egne statistikker forbliver gratis for alle, og intet her ændrer, hvad et event tæller.',
    facts: [
      { strong: 'Fra $1 om måneden', rest: 'eller $10 om året' },
      { strong: 'Kun udseende', rest: 'aldrig point, en rang eller et item' },
      { strong: 'Intet bliver slettet', rest: 'når du stopper' },
    ],
    footnote:
      'Alt her sættes på hjemmesiden under **Settings** → **Supporter**, **Profile look** og **Clan boosts**. Boosts i detaljer står i [At booste en klan]({boostsGuide}). Hvor dine farver vises i RuneLite, står i [Sidepanelet, fane for fane]({panelGuide}).',

    tiers: {
      title: 'De tre niveauer',
      intro: 'Priserne står på siden **Anvil Supporter**, `/supporter`. Et årsabonnement koster det samme som ti måneder.',
      rows: [
        {
          term: 'Supporter',
          body: '$1 om måneden eller $10 om året. Et navn i guld og en stjerne, guld-GZ, en vitrine med 4 pladser, og du kan arrangere et vennevent.',
        },
        {
          term: 'Champion',
          body: '$2 om måneden eller $20 om året. Et gradientnavn fra vores forvalg (eller én farve efter eget valg), din egen avatar og dit eget banner (animeret, hvis du vil), 8 pladser i vitrinen, hurtigere eventchat og 1 klan-boost.',
        },
        {
          term: 'Patron',
          body: '$5 om måneden eller $50 om året. Din egen gradient med op til 4 farver, der bevæger sig, 12 pladser i vitrinen, ingen ventetid i eventchatten, 2 vennevents ad gangen og 2 klan-boosts.',
        },
      ],
      note: {
        tag: 'Tid fra invitationer',
        body: 'Under Settings → Supporter får du et invitationslink. Når en ven, du har inviteret, betaler, optjener du gratis måneder; belønningen lander to uger efter deres første betaling. Tid optjent på den måde giver alle fordelene på sit niveau undtagen klan-boosts.',
      },
    },

    compare: {
      title: 'Hvad hvert niveau får',
      intro: 'Den samme tabel som på Supporter-siden, plus fordelene i chatten.',
      table: {
        areaLabel: 'Fordel',
        columns: ['Gratis', 'Supporter', 'Champion', 'Patron'],
        rows: [
          { area: 'Navnefarver', cells: ['—', 'Guld', 'Forudindstillede eller én egen farve', 'Forudindstillede eller op til fire farver, i bevægelse'] },
          { area: 'Stjerne ved dit navn', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Guld-GZ', cells: ['—', 'Ja', 'Ja', 'Ja'] },
          { area: 'Egen avatar og eget banner, animeret', cells: ['—', '—', 'Ja', 'Ja'] },
          { area: 'Vitrine', cells: ['—', '4 pladser', '8 pladser', '12 pladser'] },
          { area: 'Vennevents (ad gangen · spillere)', cells: ['Kun deltage', '1 · 10', '1 · 25', '2 · 50'] },
          { area: 'Head-to-head-udfordringer', cells: ['1 aktiv', '5 aktive', 'Ubegrænset', 'Ubegrænset'] },
          { area: 'Eventchat: ventetid mellem linjer', cells: ['5 s', '3 s', '1 s', 'Ingen'] },
          { area: 'Klan-boosts', cells: ['—', '—', '1', '2'] },
        ],
      },
      outro:
        'Under **Settings** → **In-game chat** er der tre mere: dine egne farver i chatfeedet (Supporter), at vælge, hvad din login-oversigt dækker (Champion), og en stjerne ved dit navn i andre spilleres chatfeed (Patron).',
    },

    names: {
      title: 'Navnefarver',
      intro:
        'Sæt dem under **Settings** → **Supporter**, i **Your name’s look**. Forhåndsvisningen viser dit navn på en mørk og på en lys baggrund.',
      rows: [
        {
          term: 'Supporter',
          body: 'helt guld. Der er intet at vælge.',
        },
        {
          term: 'Champion',
          body: 'en af de forudindstillede gradienter (**Classic**, standarden, **Ember**, **Ocean**, **Aurora**, **Rose gold** eller **Toxic**) eller **Your own**: én fast farve. På tværs af alle dine karakterer kan du højst bruge to forskellige egne farver.',
        },
        {
          term: 'Patron',
          body: 'alle de forudindstillede plus **Prism**, Patron-standarden, eller **Your own** med en til fire farver. Én farve står stille; to til fire giver en gradient, der bevæger sig fra venstre mod højre.',
        },
      ],
      outro:
        '**Your Anvil display name** er navnet på din konto, der er linket til Discord. Under **Your RuneScape characters** vælger du **Same for all** eller **Customize each** for at give hver karakter sit eget udseende. Tryk **Save** (eller **Save for all characters**); **Reset to default** går tilbage til dit niveaus farver.',
      note: {
        tag: 'Mørke og lyse baggrunde',
        body: 'Siden, pluginpanelet og Discord er mørke; spillets faste chatboks er lys. Anvil justerer dine farver, så de forbliver læsbare på hver af dem. Vil du have et andet udseende på en af dem, så slå **Set a separate look for dark backgrounds** eller **for light backgrounds** til. Det udseende vises præcis, som du valgte det, uden kontrastjustering, og forhåndsvisningen advarer dig, når det er svært at læse.',
      },
    },

    where: {
      title: 'Hvor dit flair vises',
      intro: 'Dine farver og stjernen følger med, overalt hvor dit navn står:',
      rows: [
        {
          term: 'På siden',
          body: 'bræt, medlemslister, profiler, dit eget navn i topbjælken og dine karakterers navne. Stjernen bærer dine farver.',
        },
        {
          term: 'I pluginpanelet',
          body: 'Feed, eventchat, kort og **Tracking**-linjen. En Patrons gradient glider; hver spiller kan stoppe den med **Animated names**.',
        },
        {
          term: 'I spillet',
          body: 'for andre spillere, der bruger Anvil-pluginnet: offentlig chat, klan-, venne- og privatchat, klanbroadcasts, login-beskeder, venne- og klanlister og højrekliksmenuen (aldrig på PvP-verdener eller i Wilderness). I spillets chat er stjernen en Patrons.',
        },
        {
          term: 'På Discord',
          body: 'en stjerne ved dit navn på Anvils opslag, tegnet i dine egne farver, hvis du har valgt nogen.',
        },
        {
          term: 'Guld-GZ',
          body: 'på en klankammerats drop i klanens feed på siden kan dit GZ være i guld. Kun Supporters kan give et.',
        },
      ],
      note: {
        tag: 'Kun på karakterer, der er bevist at være dine',
        body: 'Farverne vises kun på karakterer, pluginnet har bekræftet er dine, på siden og i spillet. Vil du holde dem væk fra dine navne i andres chat i spillet, så fjern fluebenet i **Show my colours on my characters’ names in game chat** under Settings → Supporter.',
      },
    },

    profile: {
      title: 'Avatar, banner og vitrine',
      intro: 'Alle tre ligger under **Settings** → **Profile look**.',
      rows: [
        {
          term: 'Avatar og banner',
          body: 'Champion og Patron. Upload dine egne; en GIF eller WebP forbliver animeret. De vises på dit kort, din profil og alle dine karakterer, på siden og i pluginnet. Et banner kan fylde op til 6 MB og skal være mindst 600×150; en avatar op til 2 MB.',
        },
        {
          term: 'For hver karakter',
          body: 'giv én karakter sit eget banner eller sin egen avatar, eller begge dele. Det erstatter din standard kun på den karakters sider og pluginkort.',
        },
        {
          term: 'Vitrine',
          body: 'dine bedste drops, killcounts og tider fastgjort på din profil: 4 pladser for Supporter, 8 for Champion, 12 for Patron. Fastgjorte ting fra karakterer, du ikke deler, forbliver private.',
        },
      ],
    },

    hosting: {
      title: 'Vennevents, head-to-head og chat',
      intro: 'De fordele, der giver dig mere plads til at spille i stedet for et udseende:',
      rows: [
        {
          term: 'Vennevents',
          body: 'kør din egen bingo, solobingo eller dit eget race for venner fra **Host an event for your friends**, tracket af pluginnet ligesom et klanevent. Venner deltager med dit invitationslink. Supporter: 1 igangværende event, 10 spillere. Champion: 1 event, 25 spillere. Patron: 2 ad gangen, 50 spillere i alt. Alle kan deltage i et.',
        },
        {
          term: 'Head-to-head',
          body: 'udfordr en ven fra deres profil: først til et drop, eller flest kills eller mest XP på 1 time, 24 timer eller 7 dage. Kun for prestigen. Gratis spillere kan have 1 åben ad gangen, Supporters 5, Champions og Patrons lige så mange, de vil.',
        },
        {
          term: 'Eventchat',
          body: 'hvor længe du venter mellem linjer: 5 sekunder uden niveau, 3 for Supporters, 1 for Champions, ingen for Patrons. Når et bræts chat bliver travl, venter alle 10 sekunder, også Patrons.',
        },
        {
          term: 'Klan-boosts',
          body: 'Champion 1, Patron 2, så længe du betaler. Se [At booste en klan]({boostsGuide}).',
        },
      ],
    },

    billing: {
      title: 'Betale, skifte og opsige',
      intro: 'Anvil Supporter bliver opkrævet via Gumroad, månedligt eller årligt.',
      steps: [
        'Log ind på Anvil, og åbn `/supporter`.',
        'Tryk **Choose Supporter**, **Choose Champion** eller **Choose Patron**. Gumroads betalingsside åbner, med månedlig eller årlig betaling.',
        'Betal. Dine fordele slår til, så snart Gumroad giver Anvil besked, og dit niveau står på Supporter-siden som **Your tier**.',
      ],
      outro:
        'Skift niveau med **Change tier** under Settings → Supporter. Opsig eller opdatér dit kort med **Manage on Gumroad** samme sted. Et opsagt medlemskab beholder alle fordele til slutningen af den periode, du har betalt for.',
      note: {
        tag: 'Start altid fra /supporter',
        body: '**Choose**-knappen bærer en kode, der fortæller Anvil, hvilken konto der betalte. Anvil matcher aldrig en betaling på e-mail, så køber du direkte hos Gumroad uden den knap, bliver betalingen ikke koblet til noget. Er det sket, så spørg på Anvils Discord, så kan staben knytte den til din konto i hånden.',
      },
    },

    lapse: {
      title: 'At gå ned eller stoppe',
      intro:
        'Intet, du har sat op, bliver slettet. Hver fordel bliver tjekket mod det niveau, du har lige nu, så den slår fra af sig selv og kommer tilbage, så snart du fornyer.',
      rows: [
        {
          term: 'Navnefarver',
          body: 'dit gemte valg bliver liggende. Du bærer dit nye niveaus farver, eller ingen, indtil et niveau, der tillader det, kommer tilbage.',
        },
        {
          term: 'Avatar og banner',
          body: 'under Champion viser de deres første stillbillede i stedet for at bevæge sig.',
        },
        {
          term: 'Vitrine',
          body: 'viser de første fastgjorte ting, dit niveau tillader, og skjuler resten. Uden niveau er den skjult; de fastgjorte ting venter på dig.',
        },
        {
          term: 'Klan-boosts',
          body: 'dine ældste boosts bliver ved med at tælle, og resten bliver sat på pause, ikke fjernet.',
        },
      ],
      note: {
        tag: 'En midlertidig opgradering fra Anvils stab',
        body: 'Staben kan give nogen et højere niveau i en periode, fx som tak. Det ligger oven på det, du betaler, og ændrer aldrig dit abonnement. Settings → Supporter viser **A gift from Anvil** og hvornår den udløber; derefter er du tilbage på dit betalte niveau. En gave giver kun pladser til klan-boosts, når staben tager dem med.',
      },
    },
  },

  sidePanel: {
    metaTitle: 'Anvils sidepanel, fane for fane — Anvil',
    metaDescription:
      'Hvad hver fane i Anvils sidepanel i RuneLite viser (Clan, Feed, You, Lookup og tandhjulet), hvordan eventchat og reaktioner i Feed fungerer, og pluginindstillingerne for feedet i spillets chat, Supporter-farver og animerede navne.',
    eyebrow: 'Anvil · til spillere',
    title: 'Sidepanelet, fane for fane',
    dek: 'Anvil-knappen i RuneLites sidebjælke åbner et panel med fire faner og et tandhjul: **Clan**, **Feed**, **You**, **Lookup** og ⚙. Det meste af det, panelet viser, kommer fra siden, så det holder sig opdateret uden en opdatering af pluginnet. Nogle få ting nedenfor er markeret som på vej i næste pluginopdatering.',
    facts: [
      { strong: 'Fire faner', rest: 'og et tandhjul til synkronisering og indstillinger' },
      { strong: 'Eventchat', rest: 'på Feed-fanen' },
      { strong: 'GZ, Sad, Sit', rest: 'på rækkerne i Feed' },
    ],
    footnote:
      'At installere pluginnet og logge ind står i [Opsætning af RuneLite-pluginnet]({pluginGuide}). Supporter-farver, stjernen og fordelene i chatten er forklaret i [Anvil Supporter: niveauer og fordele]({supporterGuide}).',

    header: {
      title: 'Toppen af panelet',
      intro: 'Over fanerne sidder titlen, **Refresh** og kontolinjen.',
      rows: [
        {
          term: 'Refresh',
          body: 'genindlæser panelet, Feed-fanen inklusive. Der står **Refreshing…**, mens den arbejder. I næste pluginopdatering genindlæser den også You og Lookup, så en ny avatar eller et nyt banner vises med det samme, og den tømmer ikke længere Feed-fanen.',
        },
        {
          term: 'Tracking',
          body: 'linjen under titlen nævner den karakter, der bliver tracket, i dens Supporter-farver, hvis den har nogen. **Not my account…** stopper tracking af en karakter, som en anden spiller på denne computer; **Track again** gør det om.',
        },
        {
          term: 'Kontomenuen',
          body: '⋯-linket åbner **View my profile on Anvil**, **Not my account…** og **Sign out…**. I næste pluginopdatering har den også **Become a Supporter**, eller **Your Supporter perks**, hvis du allerede er det.',
        },
        {
          term: 'Fremskridt i sæsonen',
          body: 'i næste pluginopdatering står der på Leagues, Deadman og andre sæsonverdener en linje: **Sharing season progress · Turn off**. Den sender dine relics, områder og tasks (med et skærmbillede) til din klan; klanen vælger på hjemmesiden, hvad der bliver postet. **Turn on** deler det igen. Den samme kontakt hedder **Share seasonal activity** i pluginindstillingerne.',
        },
      ],
    },

    clan: {
      title: 'Clan',
      intro:
        'Dine events og din klan. I en creators space hedder fanen **Space**.',
      rows: [
        {
          term: 'Klan-rullelisten',
          body:
            'vises, når du spiller i mere end én klan eller ét space. **All clans** (standard) viser alt, du spiller, med det live event først. Vælger du én klan, begrænses panelet til den, og dine indsendelser gemmes der.',
        },
        {
          term: 'Næste',
          body:
            'et guldkort øverst, der peger på den ene ting, der er værd at gøre nu, f.eks. at deltage i et event, svare på en undersøgelse eller tage dit startskud.',
        },
        {
          term: 'Events',
          body:
            'alle live og kommende boards, Skill- eller Boss of the Week og klanevents, med hvor du står. Derefter **Your other boards**, **Also live** og **Your clan**.',
        },
        {
          term: 'Et board',
          body:
            'åbn et for dets stillinger (top tre og dine egne linjer, med **View all** for resten), hold, missioner, seneste aktivitet, de nærmeste tiles og **View all tiles**. Knapperne **Feed** og **Chat** åbner det board i fanen Feed.',
        },
        {
          term: 'Rangændringer',
          body:
            'et grønt **▲** eller korallrødt **▼** med et tal ved siden af et navn viser, hvor langt det har flyttet sig siden dagens start.',
        },
        {
          term: 'Et klanevent',
          body: '**I’m going**, **Sign me up** eller **Answer the survey**, afhængigt af eventet.',
        },
      ],
    },

    feed: {
      title: 'Feed',
      intro:
        'Din klans og dine bræts store øjeblikke, live: drops, pets, achievements, quests, dødsfald og færdige felter.',
      rows: [
        {
          term: 'Hvis feed',
          body:
            'rullelisten øverst viser **Clan ·** hver klan du er medlem af og **Event ·** hvert live board, du er på. Den åbner på dit board, hvis du har et, ellers på din klan.',
        },
        {
          term: 'Filtre',
          body:
            '**All**, **Tiles** (kun boards), **Drops**, **Pets**, **Achievements**, **Deaths**, **Milestones** (slayer, clues, killtal og lignende, når spillerne slår dem til), og **My team** på et board, hvor du er på et hold. Et klanfeed har også en knap til game-mode-aktivitet for Leagues og andre modes.',
        },
        {
          term: 'Nye rækker',
          body: 'kommer af sig selv. Hvis du har scrollet væk, tager en **↑ N new**-pille dig tilbage til dem.',
        },
      ],
      note: {
        tag: 'Ikke det samme som chatfeedet i spillet',
        body: 'Feed-fanen virker, uanset hvad dine pluginindstillinger siger. **Show feed in game chat** (trin 8) er den separate indstilling, der også skriver det i din chatboks.',
      },
    },

    reactions: {
      title: 'Reaktioner',
      intro: 'Hver række i Feed har sin reaktion under sig:',
      rows: [
        {
          term: 'GZ',
          body: 'på drops, pets og achievements. Antallet står ved siden af, fx **GZ 3**.',
        },
        {
          term: 'Sad og Sit',
          body: 'på dødsfald i stedet for GZ. Sit er spillets måde at bede en, der er død, om at sætte sig ned.',
        },
        {
          term: 'Hvem kan reagere',
          body: 'på et klanfeed: klankammerater. På et bræt: spillerne på det og værtens stab; når et bræt skjuler stillingen, kan spillerne kun reagere på deres eget holds rækker.',
        },
        {
          term: 'Hvem har reageret',
          body: 'hold musen over en reaktion for at se navne, fx “GZ · Mossy and 3 others”. Klik igen for at tage din tilbage.',
        },
      ],
      note: {
        tag: 'I næste pluginopdatering',
        body: 'Reaktioner bliver til pilleknapper, farvet når en af dem er din, og andres reaktioner opdateres live for alle, der kigger med, også på dine andre åbne klienter. I dag ændrer antallet sig, når du reagerer, eller når Feed genindlæses. Guld-GZ, Supporter-reaktionen, gives på hjemmesidens feeds; Feed-fanen har GZ, Sad og Sit.',
      },
    },

    chat: {
      title: 'Eventchat',
      intro:
        'Et bræt med chat slået til har en **Feed / Chat**-kontakt øverst på Feed-fanen, for spillerne på det bræt og værtens stab. Brættets side på Clan-fanen har også en **Chat**-knap.',
      rows: [
        {
          term: 'Alle eller dit hold',
          body:
            'Vælg en kanal med chips øverst: **All teams** for hele boardet, **My team** kun for dit hold og **Announcements**, hvor kun værten og mods kan skrive. Hver chip viser antallet af ulæste linjer. Linjer fra værten og mods er markeret **HOST** eller **MOD**.',
        },
        {
          term: 'Afsendelse',
          body:
            'skriv i feltet og tryk på Enter. Linjer kan være op til 200 tegn, og kun værten og mods kan poste links.',
        },
        {
          term: 'Hvor ofte',
          body:
            'ventetiden mellem dine linjer følger dit Supporter-niveau: 5 sekunder uden en, 3 for Supporters, 1 for Champions, ingen for Patrons. Linjen under feltet siger, hvad din er. Staff venter aldrig.',
        },
        {
          term: 'Langsom tilstand',
          body:
            'når et boards chat bliver meget travl, skal alle vente mindst 10 sekunder i et minut, også Patrons. Ingen kan sende mere end 10 linjer på 10 sekunder.',
        },
        {
          term: 'Moderation',
          body:
            'værten og mods kan højreklikke på en linje for at vælge **Delete message** eller give en person **Mute**, og sætte chatten på pause med **Pause chat**. En pause stopper alle undtagen staff i at skrive, undtagen i **Announcements**. **Mute** i panelet er et forbud, der varer, indtil det ophæves på moderationssiden. Der kan du også give en timeout på 5 minutter, 1 time eller 24 timer (eller et hvilket som helst tidsrum fra 1 minut til 30 dage), som lukker alle kanaler for den person, og filtrere chatten efter kanal.',
        },
      ],
      outro:
        'En række linjer fra den samme person deler ét navn og ét tidspunkt, indtil der er en pause på 5 minutter. Chatten gemmes i 7 dage, efter eventet er slut.',
    },

    you: {
      title: 'You og Lookup',
      intro: 'To faner til spillerkort: dit eget og alle andres.',
      rows: [
        {
          term: 'Dig',
          body:
            'dit eget kort for den karakter, du er logget ind på: banner og avatar, **Display case**, og fanerne **Stats**, **Bosses** og **Log** (samlelog ned til hver sides items, samt clues, tider og combat achievements). Nedenunder vises en **Head-to-head**-udfordring, der venter på dig (**Accept** eller **Decline**), og dine **Goals** med **+ Add goal**.',
        },
        {
          term: 'Opslag',
          body:
            'skift mellem **Players** og **Clans**, skriv et navn og tryk på Enter. **Recent** lister dine sidste par. Højreklik på en person i spillet og vælg **Anvil** for at lande her.',
        },
        {
          term: 'Sammenlign',
          body:
            'på en andens kort stiller **Compare with me** jer to op ved siden af hinanden, skill for skill, boss for boss og side for side. En klans kort har **Compare with my clan**.',
        },
      ],
    },

    gear: {
      title: 'Tandhjulsfanen',
      intro: 'Synkronisering og indstillinger snarere end ting at kigge på:',
      rows: [
        {
          term: 'Sync profile',
          body: 'sender din Collection Log og dine bedste tider til Anvil.',
        },
        {
          term: 'Sync clan roster',
          body: 'kun for klanens admins: sender klanens medlemsliste fra spillet til siden. Kan pluginnet ikke læse din klan, står der i stedet **Join your clan channel to sync the roster**.',
        },
        {
          term: 'Bannerlyde',
          body: '**Add clip** til den lyd, et banner afspiller, **Copy folder path** til at administrere dem, og **Add mission clip** til missioner.',
        },
        {
          term: 'Become a Supporter',
          body: 'i næste pluginopdatering åbner et ★-link nederst Supporter-siden, eller der står **Your Supporter perks**, hvis du allerede er det.',
        },
      ],
    },

    settings: {
      title: 'Indstillinger, der ændrer, hvad du ser',
      intro:
        'I RuneLites konfiguration for Anvil, under **Chat messages**. De er alle slået til fra start.',
      rows: [
        {
          term: 'Show feed in game chat',
          body: 'skriver også feedet i din chatboks, efterhånden som det sker: store drops, pets og achievements fra bræt, hvis vært har slået det til, og klaner, du er gæst i, dine holdkammeraters fremskridt på felter og andre holds færdige felter.',
        },
        {
          term: 'Supporter names in chat',
          body: 'Supporters’ farver (og en Patrons stjerne) i offentlig chat, klan-, venne- og privatchat og på din venneliste og kanalernes medlemslister. Listen over navne hentes fra Anvil; intet om, hvem du ser, bliver sendt.',
        },
        {
          term: 'Animated names',
          body: 'lader en Patrons gradient glide i panelet, Feed og eventchatten. Slået fra står den stille. I næste pluginopdatering dækker den også boostede klannavne og animerede bannere i panelet.',
        },
        {
          term: 'Supporter names in menus',
          body: 'Supporters’ farver på deres navn, når du højreklikker på dem, aldrig på PvP-verdener eller i Wilderness.',
        },
        {
          term: 'Over other plugins’ colours',
          body: 'slået til erstatter en Supporters farver en navnefarve, et andet plugin har sat, fx Player Indicators. Slået fra lader de navne være.',
        },
      ],
    },
  },

  clanBoosts: {
    metaTitle: 'At booste en klan — Anvil',
    metaDescription:
      'Sådan virker klan-boosts på Anvil: hvem der har dem, at placere og flytte et boost, de tre boost-niveauer og hvad hvert af dem låser op for, klanens navnefarver, boosts i gave, og booster-mærker og badges.',
    eyebrow: 'Anvil · til Supporters og klanens stab',
    title: 'At booste en klan',
    dek: 'En betalende Champion eller Patron kan sætte et boost på en klan, de er medlem af. Nok boosts fra en klans medlemmer løfter den et niveau, og hvert niveau ændrer, hvordan klanen ser ud, og hvor den bliver vist. Boosts er kun udseende: de ændrer aldrig en rang, en score, en plads eller klanens abonnement.',
    facts: [
      { strong: 'Champion 1, Patron 2', rest: 'boosts, så længe du betaler' },
      { strong: 'Niveauer ved 3, 8 og 15', rest: 'tællende boosts' },
      { strong: 'Én gang om ugen', rest: 'kan et boost flyttes' },
    ],
    footnote:
      'Medlemmer placerer boosts under **Settings** → **Clan boosts**. Klanens stab ser niveauet og dets muligheder under Admin → **Clan settings** → **Boosts**. Selve niveauerne står i [Anvil Supporter: niveauer og fordele]({supporterGuide}).',

    what: {
      title: 'Hvem har boosts',
      intro: 'Boosts følger med et betalt medlemskab:',
      rows: [
        { term: 'Champion', body: '1 boost.' },
        { term: 'Patron', body: '2 boosts.' },
        {
          term: 'Supporter',
          body: 'ingen. Det giver tid optjent via invitationer heller ikke. En midlertidig opgradering fra Anvils stab giver kun pladser, når staben tager dem med.',
        },
      ],
      outro:
        'Boosts tilhører dig, ikke en karakter: tre karakterer i tre klaner deler stadig ét sæt. **Settings** → **Clan boosts** vises kun i dine indstillinger, mens du er Supporter eller stadig har et boost placeret.',
    },

    place: {
      title: 'At placere og flytte et boost',
      intro: 'Du placerer selv dine boosts; ingen kan placere et for dig.',
      steps: [
        'Åbn **Settings** → **Clan boosts**. **Your boosts** viser, hvad du har placeret, og eventuelle **Free slot**.',
        'Under **Clans you can boost** trykker du **Boost** ud for en klan. Du kan også trykke **Boost this clan** i Boosters-afsnittet på klanens egen side.',
        'Vil du flytte et, så brug **Move to…** på dets række, og vælg en anden klan. **Remove** tager det af.',
      ],
      rows: [
        {
          term: 'En medlemsplads, 14 dage gammel',
          body: 'hvert boost hviler på en medlemsplads, som en af dine karakterer har i klanen i spillet. En gæsteplads kan ikke bære et. Pladsen tæller fra det tidligste af to tidspunkter: da Anvil første gang så den, eller da spillet siger, at karakteren kom ind. Indtil da står der på klanens række, hvor mange dage der er tilbage.',
        },
        {
          term: 'Én række pr. klan',
          body: 'listen viser hver klan én gang, og Anvil vælger den karakter, boostet hviler på: din main, hvor det kan lade sig gøre, ellers den plads, der har været holdt længst. Klanen ser kun den karakter, aldrig dine andre.',
        },
        {
          term: 'Én gang om ugen',
          body: 'et placeret boost kan flyttes 7 dage efter, du placerede det. Et fjernet boosts plads åbner igen på samme dato, så at fjerne og placere igen er ingen genvej. Har den karakter, det hvilede på, forladt klanen, kan du flytte det med det samme.',
        },
      ],
      note: {
        tag: 'Hvad mærkaterne betyder',
        body: '**counting**: det tæller med i klanens niveau. **paused**: dit niveau har nu færre pladser, end du har placeret, så dine ældste boosts bliver ved med at tælle, og resten venter. **seat gone**: den karakter, det hvilede på, er ikke længere medlem der; flyt det. **over the 2-per-person cap**: klanen tæller allerede to af dine.',
      },
    },

    levels: {
      title: 'Niveauer',
      intro:
        'En klans niveau kommer fra dens tællende boosts. Højst to boosts fra den samme person tæller med for én klan, så et niveau betyder altid, at flere medlemmer har valgt den.',
      rows: [
        { term: 'Niveau 1', body: '3 tællende boosts.' },
        { term: 'Niveau 2', body: '8 tællende boosts.' },
        { term: 'Niveau 3', body: '15 tællende boosts.' },
      ],
      outro:
        'Medlemmer ser fremskridtet på klanens side, fx “5 of 8 to Level 2”. En klan, der stiger, får det nye niveau med det samme.',
      note: {
        tag: 'En uges henstand',
        body: 'Når antallet af boosts falder under et niveau, beholder klanen niveauets fordele i 7 dage. Admin → Clan settings → Boosts viser, hvornår de udløber. Booster medlemmerne den op igen i tide, ændrer intet sig.',
      },
    },

    perks: {
      title: 'Hvad hvert niveau låser op for',
      intro: 'Hvert niveau beholder alt fra niveauet under.',
      rows: [
        {
          term: 'Niveau 1',
          body: 'et **Boosted**-mærke på klansiden, dens kort i Clan Hall og i søgningen; en plads over klaner uden boost i Clan Hall og dens søgeresultater; og klannavnet i en gradient.',
        },
        {
          term: 'Niveau 2',
          body: 'en plads i Clan Halls **Featured**-række; klanens animerede banner afspilles (under niveau 2 viser det sit stillbillede); en rekrutteringslinje til besøgende; og navnets gradient bevæger sig.',
        },
        {
          term: 'Niveau 3',
          body: '**Spotlight** helt øverst i Clan Hall og ét rekrutteringsopslag om måneden på Anvils Discord, skrevet af klanen.',
        },
      ],
      note: {
        tag: 'Klanens logo er ikke en fordel',
        body: 'Et animeret logo (et klanbillede i GIF eller WebP) afspilles på ethvert niveau. Kun banneret venter på niveau 2.',
      },
    },

    colours: {
      title: 'Klanens navnefarver',
      intro:
        'Fra niveau 1 bærer klanens navn Anvils gradient. Ejere og admins kan vælge deres egne under Admin → **Clan settings** → **Boosts** → **Clan name colours**:',
      rows: [
        {
          term: 'En til fire farver',
          body: 'én farve giver et fast navn; to til fire giver en gradient. Fra niveau 2 bevæger en gradient sig.',
        },
        {
          term: 'Mørke og lyse baggrunde',
          body: 'ligesom med Supporter-navne justerer Anvil farverne, så de forbliver læsbare på mørke baggrunde (siden, pluginpanelet, Discord) og lyse (spillets faste chatboks). Slå et separat udseende til for en af dem, så vises det præcis som valgt.',
        },
        {
          term: 'Reset to Anvil',
          body: 'går tilbage til Anvils palet.',
        },
      ],
      outro:
        'Farverne forbliver gemt, hvis klanen falder under niveau 1, og kommer tilbage, når den vender tilbage. Pluginnet opfanger en ændring ved næste opdatering.',
    },

    staff: {
      title: 'Til klanens stab',
      intro:
        'Admin → **Clan settings** → **Boosts** er for ejere og admins. Staben kan ikke placere boosts for medlemmer; medlemmerne placerer deres egne.',
      rows: [
        {
          term: 'Niveauet',
          body: 'klanens niveau, hvor mange boosts der tæller, hvor mange flere der skal til for næste niveau, og en eventuel henstandsuge.',
        },
        {
          term: 'Rekrutteringslinje',
          body: 'Niveau 2. Én sætning på op til 140 tegn, vist for folk, der ikke er i klanen, på jeres klanside og jeres kort i Clan Hall.',
        },
        {
          term: 'Rekrutteringsopslag på Anvils Discord',
          body: 'Niveau 3. Én gang pr. kalendermåned, 20 til 500 tegn, skrevet af dig og postet, når du trykker **Post it**, med et link til jeres klanside. Mentions bliver fjernet, og ingen bliver pinget. Du kan ikke redigere det eller sende et nyt før næste måned.',
        },
        {
          term: 'Boosters',
          body: 'listen over karakterer, der booster klanen.',
        },
      ],
      note: {
        tag: 'Boosts i gave fra Anvil',
        body: 'Anvils stab kan give en klan et niveau i gave, for en fast periode eller uden udløb. Gaven tilføjer kun de boosts, klanen mangler for at nå det niveau, vist som **Anvil gift** på klanens Boosters-liste. Hvert rigtigt boost fra et medlem erstatter ét gaveboost, og en klan, der allerede ligger over gaveniveauet, beholder sit eget. Når gaven udløber, falder klanen tilbage til det niveau, medlemmernes boosts giver den.',
      },
    },

    boosters: {
      title: 'Booster-mærker og badges',
      intro: 'Hvad en booster får i den klan, de booster:',
      rows: [
        {
          term: 'Booster-mærket',
          body: 'en lille ædelsten ved deres karakter i den klans medlemsliste, feed og Discord-opslag. Hold musen over den for at se “Boosts this clan”.',
        },
        {
          term: 'Boosters-væggen',
          body: 'på klansiden: én række pr. karakter, flest boosts først, derefter dem, der har stået længst.',
        },
        {
          term: 'Badges',
          body: '**First booster** til den, der placerede klanens allerførste boost; **1 month**, **3 months**, **6 months** og **1 year** for at booste uden afbrydelse; og **Level-up 1**, **2** eller **3** for det boost, der løftede klanen til det niveau.',
        },
      ],
      note: {
        tag: 'At flytte starter uret forfra',
        body: 'Badges for tid tæller fra karakterens tidligste boost, der stadig tæller, så at flytte eller fjerne et boost starter dem forfra. Din profil viser de klaner, du booster, én gang pr. klan.',
      },
    },
  },

  profile: {
    metaTitle: 'Din profil, Wrapped og Compare — Anvil',
    metaDescription: 'De sider Anvil har om dig: din profil, hver karakters offentlige side, din personside, månedlig og årlig Wrapped, event-Wrapped-kort og sammenligning af to karakterer side om side.',
    eyebrow: 'Anvil · til spillere',
    title: 'Din profil, Wrapped og Compare',
    dek: 'Anvil har én side for **dig** og én for **hver karakter**, du spiller. Her er, hvad der står på dem, hvem der kan åbne dem, og Wrapped-kortene, der kommer ved udgangen af hver måned og hvert event.',
    facts: [
      {
        strong: 'Delt som standard',
        rest: 'slå enhver karakter privat med ét skifte',
      },
      {
        strong: 'Monthly Wrapped',
        rest: 'kommer den 1. i den følgende måned',
      },
      {
        strong: 'Event Wrapped',
        rest: 'kommer, når eventet slutter',
      },
    ],
    footnote: 'Alle skift, der nævnes her, forklares, hvor de findes, i [Indstillinger, side for side]({settingsGuide}).',
    pages: {
      title: 'Dine sider',
      intro: 'Fire sider, der hver svarer på et forskelligt spørgsmål:',
      rows: [
        {
          term: 'Din profil',
          body: '[/profile](/profile), kun synlig for dig. Vælg en karakter fra brikkerne øverst for at se dens niveauer, bosser, samlingslog og events. Kaptajner får også et **Captain’s deck** her.',
        },
        {
          term: 'En karakters side',
          body: '`/p/<name>`: én karakter, læsbar for alle med linket, mens den er delt. Den viser skills, bosser, samlingsloggen og personlige rekorder, og udelader med vilje dine klanplaceringer, din eventhistorik og dit Discord-navn.',
        },
        {
          term: 'Din personside',
          body: '`/u/…`: alle dine delte karakterer på én side, med din udstillingsvitrine og de streamingkonti, du valgte at vise. Den findes kun, hvis du slår **Show that my characters are one person** til.',
        },
        {
          term: 'En klans medlemsside',
          body: '`/c/<clan>/members/<name>`: den samme karakter, som én klan ser den, nået fra den klans **Members**-liste. En privat klan viser kun sine medlemmer til sine egne.',
        },
      ],
    },
    sharing: {
      title: 'Hvem der kan se hvad',
      body: [
        'Hver karakter starter **shared**: dens side åbner for alle med linket, og den kan optræde på ranglister og over for andre klaner. Slå en fra under **Who sees my characters** i Indstillinger, og dens side svarer _not found_ for alle undtagen dig. Du ser **Private — only you can see this page.** med et **Share it →**-link.',
        'En delt side har **Copy link** under navnet. Indloggede besøgende, der synes en side er krænkende, kan trykke **Report this profile**.',
        'Pr. karakter lader Indstillinger dig også skjule, hvilken klan i spillet den er i (**Show my in-game clan**), så den forlader karakterens side og den klans Anvil-side.',
      ],
    },
    wrapped: {
      title: 'Din månedlige og årlige Wrapped',
      body: [
        'Hver måned får hver karakter et Wrapped-kort: **XP gained**, **Boss kills**, **New slots** i samlingsloggen, **Efficient**-timer, **PBs**, samt kæledyr og det største drop. Det kommer den **1. i den følgende måned** (UTC). Indtil da kan kun du åbne det, som en forhåndsvisning.',
        'Året får også ét, på `/p/<name>/wrapped/<year>`, fra **1. december**. `/p/<name>/wrapped` fører altid til det nyeste, der findes.',
        'Tryk **Copy link to your Wrapped** for at dele det. Sat ind i Discord vises det som et billede af kortet. En privat karakters Wrapped åbner kun for dig, og dens link forhåndsvises som et almindeligt Anvil-kort.',
      ],
      note: {
        tag: 'En tom måned',
        body: 'Hvis intet nåede Anvil den måned (ingen XP, drab, logpladser eller PBs), siger kortet det i stedet for at vise nuller. Spil med pluginnet, eller lad hiscores fange dig, og næste måned udfyldes.',
      },
    },
    events: {
      title: 'Event Wrapped',
      body: [
        'Når et bræt slutter, får hver spiller og hvert hold et kort. Åbn eventets **Wrapped**-side: **Your card** står øverst, derefter **Teams** (rang, score og spillere) og **Players**. Tryk **Open and share your card**, og så **Copy share link**.',
        'Før slutningen ser du **Cards aren’t out yet**. Staff kan åbne en forhåndsvisning tidligt, så de kan tjekke kortene, før spillerne ser dem.',
        'Kortbillederne vises kun for et offentligt klans event, der ikke var kun for inviterede. For alle andre events virker linket stadig for dem, der kan se eventet, og forhåndsvises som et almindeligt Anvil-kort.',
      ],
    },
    compare: {
      title: 'Sammenlign to karakterer',
      body: [
        'Åbn [Compare](/compare) og skriv to navne. Du får skills-, boss- og samlingslogsider side om side. Lederen på hver optælling er i guld. Nedenunder er en analyse, XP pr. skill, hver boss I begge har dræbt, og hver logside punkt for punkt: I har begge det, ingen af jer har det, eller kun en af jer. **Swap sides** vender dem om.',
        'Kun delte karakterer kan sammenlignes. En privat, eller et navn Anvil ikke kender, giver _not on Anvil, or not shared_. Du kan altid sammenligne dine egne private karakterer, når du er logget ind.',
      ],
    },
    news: {
      title: 'Hvad er nyt og changeloggen',
      body: [
        '[Hvad er nyt](/whats-new) viser, hvad der er ændret på Anvil, nyeste først. Når du er logget ind, starter den med **For you**, nyhederne der er vigtige for dit niveau og din klan, og derefter **Everything new**. Ting, der kræver en pluginopdatering, siger **Coming in the next plugin update**.',
        '[Changeloggen](/changelog) lister hver udgivelse med dens nyheder, højdepunkter og hvad der er **New**, **Improved** og **Fixed**.',
        'Når en udgivelse går ud, postes dens nyheder i Anvil Discord og i din klans Anvil updates, og pluginnet viser en linje, når du logger ind. Små rettelser samles i næste post.',
      ],
    },
  },
  settings: {
    metaTitle: 'Indstillinger, side for side — Anvil',
    metaDescription: 'Hver side under Anvil-indstillinger: Discord-opslag og skærmbilledefortrolighed, chatfeedet i spillet, pluginforbindelse og enheder, dine egne webhooks, hvem der ser dine karakterer, Supporter- og profiludseende, streamingkonti, hver karakter og ejerskabskrav.',
    eyebrow: 'Anvil · til spillere',
    title: 'Indstillinger, side for side',
    dek: '[Settings](/settings) er der, dine egne valg bor: hvad du poster, hvad du ser i spillet, og hvem der kan se dine karakterer. Valg, du træffer her, følger dig til hver computer, du spiller på.',
    facts: [
      {
        strong: 'Søgefelt',
        rest: 'på første side finder enhver indstilling',
      },
      {
        strong: 'Én side pr. karakter',
        rest: 'under Characters',
      },
      {
        strong: '10 webhooks',
        rest: 'af dine egne',
      },
    ],
    footnote: 'Dine profilsider forklares i [Din profil, Wrapped og Compare]({profileGuide}); pluginnets egne indstillinger i [Opsætning af RuneLite-pluginnet]({pluginGuide}).',
    find: {
      title: 'Find en indstilling',
      body: [
        'Den første side, **Overview & search**, har et søgefelt. Skriv det, du vil have, med egne ord, som _private messages_, _rare drop value_, _death message_, _name colour_ eller _plugin token_, og det fører dig til det rette skifte.',
        'Menuen ned ad siden har to grupper. **Account** rummer siderne nedenfor. **Characters** har én side pr. karakter, du har koblet (din hovedkarakter er markeret **main**), og så **Add character**. Et tal på **Add character** betyder, at Anvil har set dig spille karakterer, du ikke har koblet endnu.',
      ],
    },
    posts: {
      title: 'Discord-opslag og skærmbilleder',
      intro: 'Hvad pluginnet poster om dig i dine klans Discord-kanaler, og hvad det skjuler på skærmbilleder. Disse valg læses af den næste pluginopdatering. Indtil du har den, bestemmer de samme skift i pluginnets egne indstillinger.',
      rows: [
        {
          term: 'Hvad dit plugin poster',
          body: '**Rare drops**, **Pets**, **Deaths**, **Collection log slots**, **Level milestones** og **Diary completions** er slået til fra start; **PvP kills** er slået fra.',
        },
        {
          term: 'Tallene',
          body: '**Min drop value** (1m fra start, mindst 1m, 0 slår det fra), **Min drop rarity (1 in N)** (1 pr. 1.000 fra start), **Værdi og sjældenhed sammen** (enten den ene fra start, eller **Kræv begge**), **Loot key value** (1m), en **Death message** på op til 200 tegn, hvor `{name}` bliver til dit navn, og den laveste **Combat task tier** og **Quest tier**, der posteres (Master fra start). Værdien, sjældenheden og valget mellem enten/begge følger din klans standarder, indtil du selv sætter dem; **Nulstil til klanstandard** går tilbage til at følge dem.',
        },
        {
          term: 'Hvor dine opslag går',
          body: '**Keep my announcements out of clans I only guest in**, og **Level posts in clan channels**: **Clan rules**, **Only 99s & max** eller **Off**. **Per character** lister hver karakter med et **Clans →**-link, så du kan slå opslag fra for én klan.',
        },
        {
          term: 'Skærmbilleder pr. type',
          body: 'vælg for hver type (**Rare drops**, **Pets**, **Deaths**, **Collection log**, **Combat tasks**, **Achievement diaries**, **Levels**, **Player kills**) om opslaget skal have et skærmbillede. Alle er slået til fra start. Din klan kan sætte en standard for sine medlemmer; indtil du ændrer én, følger du den, og **Reset** går tilbage til den. Bingo-beviser tages altid, uanset hvad du vælger: de er dit bevis.',
        },
        {
          term: 'Mere at annoncere',
          body: '**Slayer** (hver N. opgave), **Clue scrolls** (fra det niveau du vælger), **Speedruns** (kun personlige rekorder, eller hver gang), **Kill count** (hver N. kill), **BA gambles** (hver N. gamble) og **Custom chat messages** (spilbeskeder, der matcher dine egne mønstre, hvor `*` er vilkårlig tekst og `#` et vilkårligt tal; op til 10). Alle er slået fra fra start. Din klan kan slå dem til som standard for sine medlemmer, og du kan selv slå dem til eller fra; **Reset to clan default** går tilbage til at følge din klan. De postes i din klans **Milestones & more**-kanal og til dine egne webhooks, der tager dem; dine egne mønstre postes kun til dine egne webhooks.',
        },
        {
          term: 'Privat: Grand Exchange, handler, gruppelager, andre plugins',
          body: '**Grand Exchange** (afsluttede tilbud til mindst det beløb du sætter), **Player trades** (hvad du gav og fik), **Group storage** (hvad du lagde ind eller tog ud) og **Other plugins** (RuneLite-plugins du nævner, kan poste via Anvil). De er slået fra fra start, kun du kan slå dem til, din klan kan aldrig slå dem til for dig, og de poster kun til dine egne webhooks: sæt flueben ved typen på den webhook, de skal ind i.',
        },
        {
          term: 'Meddelelsesskabeloner',
          body: 'ændrer første linje i ethvert opslag: **Loot**, **Pet**, **Collection log**, **Combat tasks**, **Achievement diary**, **Quests**, **Levels**, **Death**, **Player kills**, **Slayer**, **Clue scrolls**, **Speedruns**, **Kill count**, **BA gambles** og kun for dig **Grand Exchange**, **Player trades** og **Group storage**. Klik på en pladsholder som `{player}` eller `{item}` for at tilføje den; forhåndsvisningen udfylder eksempelværdier. Hver type har sine egne pladsholdere, og alt andet i klammer står, som du skrev det. Op til 200 tegn; omtaler og links bliver aldrig postet. Uændret læses et opslag som altid; din klan kan sætte sin egen, og **Reset to clan default** går tilbage til den.',
        },
        {
          term: 'Skærmbilledefortrolighed',
          body: 'sæt kryds ved den chat, der udelades fra hvert skærmbillede pluginnet tager, både beviser og Discord-opslag: **Private messages** (sat til fra start), **Public chat**, **Clan chat: others’ messages**, **Clan chat: your own messages**, **Chat channel** og **Group chat**. Spilbeskeder og Anvils egne linjer bliver altid med.',
        },
      ],
      note: {
        tag: 'Brætfelter berøres aldrig',
        body: 'At slå et opslag fra stopper kun Discord-opslaget. Drops, drab og bedrifter tæller stadig på ethvert bræt, du spiller.',
      },
    },
    chat: {
      title: 'Chatfeed i spillet',
      intro: 'Hvad pluginnet skriver i din chatboks, når pluginindstillingen **Show feed in game chat** er slået til.',
      rows: [
        {
          term: 'Hvorfra',
          body: '**Boards I play on**, og **Clans I’m guesting in, and my clan’s guests**.',
        },
        {
          term: 'Hvad',
          body: 'drops til mindst et beløb du vælger, **Pets**, **New collection log slots**, **Other teams’ completed tiles**, **My team’s progress on item tiles**, **Leagues, Deadman and other game-mode unlocks**, og kampopgaver, niveauer, quests og dagbøger.',
        },
        {
          term: 'Når du logger ind',
          body: '**A short brief in chat**: hvad der skete, mens du var væk. Champions vælger, hvad det dækker.',
        },
        {
          term: 'Farver',
          body: '**Anvil lines in chat**: **By type (Anvil colours)**, **One colour (the plugin’s own)**, eller **My own colours** for Supporters.',
        },
      ],
    },
    login: {
      title: 'Pluginforbindelse, login og enheder',
      intro: 'Hvor pluginnet og hjemmesiden er logget ind, og hvordan du logger dem ud.',
      rows: [
        {
          term: 'Pluginforbindelse',
          body: 'dit plugin-token, til det sjældne tilfælde hvor du indsætter det i hånden. Normalt gør **Sign in with Discord** i sidepanelet det for dig.',
        },
        {
          term: 'Login og enheder',
          body: 'hver computer pluginnet er logget ind på, som **RuneLite sign-in 1**, **2** … med hvornår den blev lavet og sidst brugt. **Revoke** logger en ud, f.eks. en computer du har solgt. **Enter a code** kobler en anden computer til. **Sessions** logger dig ud af hjemmesiden alle steder.',
        },
        {
          term: 'Klanfakturering',
          body: 'klanejere får **Open portal →** her, til klanens fakturering.',
        },
      ],
    },
    webhooks: {
      title: 'Dine Discord-webhooks',
      body: [
        'Dine posts kan også gå til en Discord-server af din egen: en privat kanal, en venneserver, hvor som helst du kan lave en webhook. Indsæt webhook-linket, sæt kryds ved, hvad den modtager (**Rare drops**, **Pets**, **Deaths**, **Combat achievements**, **Levels & milestones**, **Quests**, **Achievement diaries**, **Collection log**, **PvP kills**), sæt evt. en minimumsværdi og sjældenhed kun for den, og tryk på **Add webhook**. På en webhook, der tager **Rare drops**, kan du ændre dem senere og vælge **Value or rarity: my setting**, **either** eller **both**. Det, der står tomt, følger dine egne indstillinger, og en webhook må være løsere end din klans hårde gulv.',
        'Du kan have op til 10. Kun Discord-webhook-links accepteres, og et gemt vises maskeret, så et skærmbillede af denne side ikke lækker det. **Level posts on my webhooks** angiver dine egne niveauregler for dem, adskilt fra din klans.',
      ],
    },
    privacy: {
      title: 'Hvem der ser mine karakterer',
      intro: 'Dine karakterer er delt fra start. Tre skift ændrer det:',
      rows: [
        {
          term: 'Show <name> publicly',
          body: 'ét skift pr. karakter. Til (fra start), er dens side **Public**. Fra, er den **Only its clans**: dens klaner ser den stadig i deres lister og events, ingen andre gør, og den forlader ranglisterne.',
        },
        {
          term: 'Show that my characters are one person',
          body: 'med to eller flere karakterer laver dette din personside, der samler dine delte karakterer. Fra kan ingen se, at de alle er dig.',
        },
        {
          term: 'Show other clans’ boards',
          body: 'om forsiden viser andre klaners åbne bræt, som du kan kigge på.',
        },
      ],
    },
    look: {
      title: 'Supporter, profiludseende, streaming og boosts',
      intro: 'Sådan ser du ud på Anvil, og kontiene og fordelene bag det.',
      rows: [
        {
          term: 'Supporter og navnefarver',
          body: 'dit niveau, dine fordele og dit invitationslink: tag venner med og optjen gratis måneder. Niveauerne forklares i [Anvil Supporter]({supporterGuide}).',
        },
        {
          term: 'Profilens udseende',
          body: 'avatar og banner (animeret fra Champion), forskellige pr. karakter hvis du vil, og **Display case**: 4, 8 eller 12 pins efter niveau.',
        },
        {
          term: 'Streamingkonti',
          body: '**Twitch**, **YouTube**, **Kick** og **Medal**. Hver viser, om den er verificeret, med et skift til at vise den på din profil. Verificerede konti er det, der lukker dig ind til følger- og abonnentevents.',
        },
        {
          term: 'Klan-boosts',
          body: 'vises først, når du kan booste: dine pladser, hvor de er placeret, og de klaner du kan booste. Se [Sådan booster du en klan]({boostsGuide}).',
        },
      ],
    },
    characters: {
      title: 'Hver karakter',
      intro: 'Under **Characters** har hver karakter sin egen side: dens type, om den er verificeret, og links til dens offentlige side og fulde profil.',
      rows: [
        {
          term: 'Synlighed',
          body: '**Show to other clans and on leaderboards**, og **Show my in-game clan**.',
        },
        {
          term: 'Klaner',
          body: 'hver klan og hvert rum den er i, som **member** eller **guest**, med **Announce drops & achievements** pr. klan og **Leave**. Hvis Anvil har den i den forkerte klan, fortæller **Which clan is it really in?** staff det.',
        },
        {
          term: 'Karakter',
          body: '**Make main**, bed om et navneskift efter en navneændring, eller **Remove** den fra din konto. Dens tidligere resultater bliver, hvor de er.',
        },
        {
          term: 'Add character',
          body: 'spil en karakter én gang med pluginnet logget ind, så kobler den sig selv. På mobil eller den officielle klient kobler du den med navn. **We noticed you playing** lister dem, Anvil har set; **Not mine** afviser en.',
        },
      ],
    },
    claims: {
      title: 'Ejerskabskrav',
      body: [
        'Hvis en karakter er koblet til en andens Anvil-konto, men egentlig er din, så tryk **This is my account** i pluginets sidepanel under fanen **You**. Du beviser, at du spiller den med et hurtigt XP-tjek, og så bliver den nuværende ejer spurgt. Du får aldrig at vide, hvem de er, og de får aldrig at vide, hvem du er.',
        'Dine krav viser **XP check**, **open**, og derefter hvordan de endte: **moved to you**, **with Anvil staff**, **withdrawn**, **check timed out** eller **closed**. **Withdraw** annullerer et.',
        'Når nogen gør krav på en af dine, vises den under **Claims on your characters** med **Approve** eller **Object — it’s mine**. En ikke-verificeret karakter flytter sig efter 7 dage, medmindre du gør indsigelse. En verificeret flytter sig kun, hvis du godkender det.',
      ],
    },
  },
  weekly: {
    metaTitle: 'Skill og Boss of the Week — Anvil',
    metaDescription: 'Sådan kører du en Skill of the Week, Boss of the Week eller et effektivitetsløb på Anvil: planlægning, gentagelse og rotation, startlinjer, tilføjelse og fjernelse af folk, præmier, afslutning før tid og hvad spillerne ser.',
    eyebrow: 'Anvil · til klanstaben og spillere',
    title: 'Skill og Boss of the Week',
    dek: 'Et ugentligt væddeløb er det lavindsats-event: ingen felter at skrive, ingen hold og ingen tilmeldinger. Alle på listen er med, når det starter, og vinderen er den, der får mest, før det slutter.',
    facts: [
      {
        strong: 'Ingen felter, ingen hold',
        rest: 'ét ranglisteskema',
      },
      {
        strong: 'Med fra start',
        rest: 'hele listen, automatisk',
      },
      {
        strong: 'Op til 10 præmiepladser',
        rest: 'udbetalt fra kassen',
      },
    ],
    footnote: 'Bræt (bingo) står i [Kør dit første event]({adminGuide}); præmier og kassen i [Klanens kasse]({cofferGuide}).',
    schedule: {
      title: 'Planlæg en',
      intro: 'Fem valg, og standardindstillingerne er fine for de fleste klaner:',
      steps: [
        'Åbn **Schedule** i admin-menuen, og tryk **+ Schedule event** (moderatorer kan bruge **Schedule a competition**).',
        'Vælg typen: **Skill of the Week** (XP optjent), **Boss of the Week** (drab optjent) eller **Efficiency race** (spilletimer eller bosstimer optjent).',
        'Under **What is measured** vælger du skillen eller bossen. For at skifte den hver uge tilføjer du flere under **Then rotate through**. Lad det stå tomt for at gentage den samme.',
        'Vælg hvornår den **Runs**: **This weekend**, **One week** eller dine egne datoer. Den skal altid have en slutning, fordi den scorer gevinsterne mellem start og slut.',
        'Lad **Repeat every week** være til, og den næste starter i det øjeblik, denne slutter, med samme længde og præmier. Sæt kryds ved **Guests race too**, hvis din klans gæster skal være på brættet.',
      ],
      outro: 'Der er intet andet at sætte op. Startnumrene hentes fra hiscores, når den begynder.',
    },
    counting: {
      title: 'Sådan tælles det',
      body: [
        'Hver spillers gevinst er deres stat nu minus deres stat, da konkurrencen startede (deres **startlinje**). Den højeste gevinst vinder; uafgjort står med navn på, og præmier kan deles mellem lige placeringer.',
        'Startlinjerne tages fra hiscores. Derefter holder pluginnets live-opdateringer brættet opdateret mellem hiscores-tjekkene, så spillere med pluginnet rykker op på brættet, mens de spiller.',
        'Et tal, der går ned, ignoreres, og en gevinst, der ser umulig ud, bliver **flagged** til staff i stedet for at blive talt eller skåret ned.',
      ],
      note: {
        tag: 'Spillere: log ud, før det starter',
        body: 'Hiscores gemmer kun dine stats, når du logger ud. Hvis du grinder helt op til starten uden at logge ud, tages din startlinje fra før det grind, og grindet tæller som gevinst. Staff fanger det som regel og retter din startlinje, så log ud en gang, før det starter.',
      },
    },
    manage: {
      title: 'Sådan kører du den',
      intro: 'Åbn konkurrencen fra **Schedule** eller dashboardet. Den har en forside og tre faner:',
      rows: [
        {
          term: 'Home',
          body: '**Leaderboard** (top 25, med hvor mange der scorer), **flagged** gevinster, alle der **left the clan**, og præmierne. Når den slutter, vinderne og **Final leaderboard**.',
        },
        {
          term: 'Starting lines',
          body: 'hver spillers **Started at**, **Now** og **Gained**. Ret en startlinje i hånden, når et grind før konkurrencen blev talt, og ranglisten følger med. **Pull current stats** opdaterer alle; **Reset baselines** starter alle forfra fra deres hiscores nu og fjerner alle gevinster.',
        },
        {
          term: 'Participants',
          body: 'hele listen er allerede med. **Add someone** tager ét navn pr. linje, til en gæst eller en konto, der ikke står på listen endnu. Fjerner du en spiller, fjernes deres placering; tilføjer du dem igen, får de en ny startlinje. **Leave one each** rydder op i en person, der er tilmeldt på flere karakterer. Du kan også fjerne alle gæster på én gang.',
        },
        {
          term: 'Settings',
          body: 'navn, datoer, **Repeat every week**, og **Status** (kun til at løsne én, der sidder fast; den flytter sig selv). Admins kan **Delete** den, sammen med dens deltagere og placeringer.',
        },
      ],
    },
    prizes: {
      title: 'Præmier og afslutning',
      body: [
        'Sæt præmier for op til 10 pladser, udbetalt fra klanens kasse. Du vælger, om en spiller uden gevinst kan få præmie, og om lige placeringer deler deres præmier. Hvordan pengene flytter sig, står i [Klanens kasse]({cofferGuide}).',
        'Den slutter af sig selv på det tidspunkt, du har sat. **End now** stopper den før tid: gevinster tæller ikke længere med det samme, og resultaterne poster til Discord, med præmier afregnet inden for 15 minutter.',
      ],
    },
    players: {
      title: 'Til spillere',
      body: [
        'Du skal ikke tilmelde dig. Hvis du er på klanlisten, når den starter, er du med. Find den på din klans **Events**-side, i pluginets sidepanels fane **Clan** med hvor du står, og i Discord, når den starter og slutter.',
        'Hver konkurrence har sin egen side med den live-rangliste og hvordan løbet gik dag for dag. En privat klan viser den kun til sine egne medlemmer.',
        'At spille med pluginnet holder dit tal live. Uden det tæller du stadig, bare i hiscores’ tempo.',
      ],
    },
    teamsLine: "Vil du have hold, eller klaner der konkurrerer mod hinanden, på en færdighed eller boss? Sæt **Format**, når du planlægger den. Se [Holdkonkurrencer]({teamCompsGuide}).",
  },
  teamComps: {
    "metaTitle": "Holdkonkurrencer — Anvil",
    "metaDescription": "Kør en Skill eller Boss of the Week som hold eller klan mod klan på Anvil: opdel spillere i hold, inviter andre klaner, hvordan summer og gennemsnit giver point, sene tilmeldinger og hvad spillerne ser.",
    "eyebrow": "Anvil · til klanstaff og spillere",
    "title": "Holdkonkurrencer",
    "dek": "Hver færdigheds- eller bosskonkurrence har et Format. Solo er standard og virker, som den altid har gjort. Vælg Teams for at dele din klan i sider, eller Clan vs clan for at konkurrere mod andre klaner om samme færdighed eller boss.",
    "facts": [
      {
        "strong": "Tre formater",
        "rest": "Solo, Teams, Clan vs clan"
      },
      {
        "strong": "Summer afgør det",
        "rest": "med et gennemsnit pr. spiller"
      },
      {
        "strong": "Én vært redigerer",
        "rest": "partnerklaner følger med"
      }
    ],
    "footnote": "Grundlæggende om Skill and Boss of the Week findes i [Skill and Boss of the Week]({weeklyGuide}). Vil du have klaner til at konkurrere på bingobrætter i stedet? Se [Være vært for en besøgende klan]({clanVsClanGuide}).",
    "teams": {
      "title": "Opsæt hold",
      "intro": "Teams deler din egen klan i sider. Det tager cirka et minut:",
      "steps": [
        "Planlæg en konkurrence som sædvanligt. Sæt **Format** til **Teams**.",
        "Skriv dine holdnavne. Alle indtastede fordeles jævnt efter deres nuværende level eller KC, så siderne starter fair.",
        "Lad **Late joiners go into the smallest team** være slået til, hvis folk må komme efter start. Slå den fra for at holde holdene faste.",
        "Vil du ændre noget senere, så åbn konkurrencen og vælg **Teams** i dens admin-sidepanel. Der kan du:"
      ],
      "rows": [
        {
          "term": "Omdøb og skift farve",
          "body": "giv hvert hold et navn og en farve, spillerne kan genkende."
        },
        {
          "term": "Tilføj og slet hold",
          "body": "start med to og tilføj et tredje, eller fjern et, du ikke længere har brug for."
        },
        {
          "term": "Flyt en spiller",
          "body": "send nogen til et andet hold. Praktisk for venner, der vil spille sammen."
        },
        {
          "term": "Auto-balance",
          "body": "tryk **Auto-balance by current level/KC** for at fordele alle jævnt igen."
        },
        {
          "term": "Late joiners",
          "body": "slå muligheden for sene tilmeldinger til eller fra. Når den er til, går nye spillere ind i det mindste hold."
        }
      ],
      "note": {
        "tag": "Intet hold, intet problem",
        "body": "En spiller uden hold tæller stadig på den individuelle tavle. De lægger bare ikke noget til en holdtotal."
      },
      "outro": "En gentagen konkurrence overfører sine hold til næste uge og balancerer dem igen."
    },
    "clans": {
      "title": "Opsæt klan mod klan",
      "intro": "Clan vs clan lader andre klaner deltage i din konkurrence, så mange du vil. Du er vært, og de andre klaner er partnere.",
      "steps": [
        "Som admin eller højere i værtsklanen sætter du **Format** til **Clan vs clan**.",
        "Inviter de andre klaner med deres adresse. Gør det på oprettelsesformularen, eller senere på konkurrencens **Clans**-side.",
        "Den inviterede klans ejer eller admin accepterer eller afslår på sin **People**-side eller **Events**-liste. En moderator kan ikke. Ingen fra den klan bliver tilmeldt, før den har accepteret.",
        "Når den accepterer, vælger den, hvem der deltager: **All members** på dens roster, eller **Selected people** den vælger. Den kan ændre det senere fra samme kort.",
      ],
      "body": [
        "Partnerklanen kan følge stillingen på sin egen side på `/c/<slug>/weekly/<id>`. Det er skrivebeskyttet. Kun værten redigerer konkurrencen.",
        "For at fjerne en klan fjerner du den på **Clans**-siden. Dens spillere forsvinder fra tavlen.",
        "En gentagende konkurrence sender nye invitationer hver uge, så hver klan skal sige ja igen.",
        "Får du uønskede invitationer? Vælg **Decline & block this clan** på invitationen. Den klans senere invitationer afvises stille, og du kan fjerne blokeringen under **Settings → Blocked clans**.",
      ],
      "note": {
        "tag": "Del adressen",
        "body": "En klans adresse er det korte navn i dens webadresse. Spørg den anden klans admin om det, før du inviterer dem."
      }
    },
    "scoring": {
      "title": "Sådan scorer det",
      "body": [
        "En hold- eller klantotal er summen af medlemmernes gevinster. Gevinster tælles på samme måde som på den individuelle tavle.",
        "Ved siden af hver total ser du også et **average per player**, så et hold på 8 og et hold på 12 stadig kan sammenlignes.",
        "Hvis to totaler er ens, rangerer den, der nåede dertil først, højere."
      ]
    },
    "players": {
      "title": "Hvad spillerne ser",
      "body": [
        "Konkurrencesiden viser først hold- eller klanstillingen. Åbn en af dem for at se dens spillere. Dit eget hold eller din egen klan er fremhævet.",
        "Discord-opslag ved start, halvvejs og slut viser stillingen. I clan vs clan sendes de til hver klans kanal, og din er markeret med **← you**.",
        "I plugin-sidepanelet kan du se, hvor dit hold placerer sig.",
        "Der er intet at tilmelde sig. Hvis din klan tilmelder alle medlemmer, og du står på rosteret, er du med. Hvis den vælger personer, er du med, når du er valgt.",
        "Vil du ikke være med? Tryk **Opt out** ved siden af **You’re in** på konkurrencesiden, i Events-listen eller i pluginnet. Du forlader tavlen for netop den konkurrence, og du kan melde dig til igen, mens den kører.",
      ]
    },
    "faq": {
      "title": "Spørgsmål",
      "intro": "Dem, klanens staff og spillere oftest spørger om:",
      "rows": [
        { term: "Vores hold har forskellig størrelse. Er det unfair?", body: "Ikke i sig selv. Summerne afgør rangeringen, men hvert hold viser også et gennemsnit pr. spiller, så du kan se, hvordan et mindre hold reelt klarer sig." },
        { term: "Hvad med folk, der melder sig sent?", body: "Med kontakten for sene tilmeldinger slået til, går de til det mindste hold. Slået fra tæller de kun på den individuelle tavle. Du kan altid flytte dem manuelt på siden **Teams**." },
        { term: "Kan den anden klan redigere vores konkurrence?", body: "Nej. Partnerklaner ser stillingen skrivebeskyttet. Kun værtsklanen kan ændre konkurrencen." },
        { term: "Kan jeg stå over en konkurrence?", body: "Ja. Tryk **Opt out** på konkurrencesiden, i Events-listen eller i pluginnet. Kun den konkurrence berøres, og du kan melde dig til igen, mens den kører." },
        { term: "Hvor mange klaner kan deltage?", body: "Så mange du inviterer, op til 50 i én konkurrence. Hver klan ser sin egen side markeret i stillingen og i sine Discord-opslag." },
        { term: "En anden klan bliver ved med at invitere os. Kan vi stoppe det?", body: "Ja. En ejer eller admin vælger **Decline & block this clan** på invitationen. Dens senere invitationer afvises uden besked til dem. Du kan fjerne blokeringen når som helst under **Settings → Blocked clans**." },
        { term: "Hvis vi siger ja én gang, er vi så tilmeldt hver uge?", body: "Nej. En gentagende konkurrence sender nye invitationer hver uge, og en ejer eller admin skal acceptere hver enkelt." },
      ]
    }
  },

  clanEvents: {
    metaTitle: 'Klanevents og kalenderen — Anvil',
    metaDescription: 'Planlægning af klanevents på Anvil: masser, ture og samlinger, ugentlige gentagelser, “I’m going” og tilmeldinger med pladser, spørgsmål og gebyrer, Discord-opslag og påmindelser, udbetalinger, undersøgelser og kalenderen, der viser huller.',
    eyebrow: 'Anvil · til klanstaben',
    title: 'Klanevents og kalenderen',
    dek: 'Ikke alt er et bræt. Et klanevent er en masse, en raidaften, en drop-fest eller en samling: et tidspunkt og et sted, opslået på Discord og påmindet, med så meget eller så lidt tilmelding, du vil have.',
    facts: [
      {
        strong: 'Én gang eller hver uge',
        rest: 'med valgfri slutdato',
      },
      {
        strong: 'Tre måder at deltage',
        rest: 'info, “I’m going” eller tilmeldinger',
      },
      {
        strong: 'Påmindelse',
        rest: '15 minutter før, og så ved start',
      },
    ],
    footnote:
      'Ugentlige konkurrencer står i [Skill and Boss of the Week]({weeklyGuide}); gebyrer og præmier i [Fees and payouts]({feesGuide}). Påmindelsesposts bruger din klans beskedskabeloner, forklaret i [Settings, page by page]({settingsGuide}).',
    create: {
      title: 'Planlæg en',
      intro: 'Åbn **Clan events** i admin-menuen, og udfyld formularen:',
      rows: [
        {
          term: 'Navn, tidspunkt, længde',
          body: '**Name**, **Starts (your time)** i din egen tidszone, og **Minutes**.',
        },
        {
          term: 'Gentagelser',
          body: '**Just once** eller **Every week**, med en valgfri **Until**-dato.',
        },
        {
          term: 'Hvor',
          body: '**Where**, **World** og **Host**, plus et billede: vælg en boss eller skill, eller upload dit eget.',
        },
        {
          term: 'Detaljer',
          body: 'udstyr, krav, hvad man skal medbringe.',
        },
        {
          term: 'Hvem kommer',
          body: '**Just information** (ingen knap, ingen tælling), **“I’m going”** (ét tryk, viser en tælling) eller **Sign-ups** (pladser, spørgsmål og et gebyr).',
        },
        {
          term: 'Discord',
          body: '**Post to** en kanal (eller klanens standard), valgfri **Chat**-, **Guide**- og **Voice**-kanaler at linke, og om medlemsrollen skal pinges på opslaget, påmindelsen og ved start.',
        },
      ],
      outro: 'Tryk **Schedule it**. Udbetalinger og en undersøgelse tilføjes bagefter fra eventets egen side.',
    },
    discord: {
      title: 'Hvad Discord ser',
      body: [
        'Opslaget går op, når du planlægger det, og redigeres på stedet, hver gang du ændrer noget, så der aldrig er en forældet kopi. Et gentagende event er markeret **every week**.',
        'Femten minutter før poster det **Starting in 15 minutes**, og ved start **Starting now**. Flytter du tidspunktet, flytter påmindelserne med. Aflyser du (**Cancel**), markeres opslaget **Cancelled**, så ingen møder op.',
      ],
    },
    manage: {
      title: 'Tilmeldinger, gebyrer og udbetalinger',
      intro: 'Åbn eventet for at ændre, hvad det bruger. Alt starter slået fra:',
      rows: [
        {
          term: 'Sign-ups',
          body: 'med **Places** (tomt for ingen grænse), hvornår **Sign-ups close**, og **Sign-up questions**. **You approve each one** får hver tilmelding til at vente på staff.',
        },
        {
          term: '“I’m going”-knap',
          body: 'fra gør det kun til information: ingen knap eller tælling på siden, i pluginnet eller på Discord.',
        },
        {
          term: 'Deltagergebyr',
          body: 'slår tilmeldinger til. Læg gp af dit eget i puljen under **Added to the pot**.',
        },
        {
          term: 'Udbetalinger',
          body: 'puljen er gebyrerne plus det, du har lagt til. Navngiv **Who** der får hvad og **For** hvad, og markér hver **Paid**. Anvil advarer dig, hvis du udbetaler mere end puljen.',
        },
        {
          term: 'Undersøgelse bagefter',
          body: 'åbner, når den slutter. Kun staff ser svarene. Tog den tilmeldinger, bliver kun dem, der tilmeldte sig, spurgt.',
        },
        {
          term: 'Et ugentligt event',
          body: '**Every week is…** **Its own** (tilmeldinger, pulje og undersøgelse hver uge) eller **One run** (én tilmelding, pulje og undersøgelse for hele serien).',
        },
      ],
    },
    players: {
      title: 'Hvad medlemmer ser',
      body: [
        'Eventsiden viser **When**, **Where**, **Host**, **Discord**, **Entry** og **Prizes**, med **Live now**, mens det kører. Medlemmer trykker **I’m going** eller **Sign me up**, eller **Ask to sign up**, når staff godkender hver enkelt. Det står også i pluginnets sidepanels fane **Clan**, med de samme knapper.',
        'Kun medlemmer af klanen kan sige, at de kommer, eller tilmelde sig.',
      ],
    },
    calendar: {
      title: 'Kalenderen',
      body: [
        '**Schedule** samler brætter, ugentlige konkurrencer og klanevents på én kalender, med et filter for hver.',
        'Et stykke på to eller flere dage uden noget markeres som et hul, med **Fill the gap** for at planlægge noget der. Brug det til at holde klanen i gang mellem store events, i stedet for at lade en stille fjortendag glide forbi.',
      ],
    },
  },
  challenges: {
    metaTitle: 'Udfordringer og venne-events — Anvil',
    metaDescription: 'Head-to-head-udfordringer på Anvil (først til et drop, flest drab eller mest XP på 1 time, 24 timer eller 7 dage) og Supporter-venne-events: private bræt for dine venner bag ét invitationslink.',
    eyebrow: 'Anvil · til spillere',
    title: 'Udfordringer og venne-events',
    dek: 'To måder at spille mod folk, du kender, uden et klanevent: en **udfordring** er én spiller mod én anden, og et **venne-event** er et privat bræt for en gruppe, bag et invitationslink.',
    facts: [
      {
        strong: '1 time til 7 dage',
        rest: 'pr. udfordring',
      },
      {
        strong: 'Prestige',
        rest: 'ingen indsats, ingen gp',
      },
      {
        strong: 'Op til 50 venner',
        rest: 'pr. venne-event, efter niveau',
      },
    ],
    footnote: 'Niveauerne og hvad hvert enkelt er vært for, står i [Anvil Supporter: niveauer og fordele]({supporterGuide}).',
    start: {
      title: 'Udfordr nogen',
      intro: 'Du skal have en verificeret karakter, og det skal de også.',
      steps: [
        'Åbn [Challenges](/challenges), eller tryk **Challenge <name>** på en spillers profil.',
        'Under **Who** skriver du deres navn, og under **Playing as** vælger du din egen karakter. Den skal være verificeret.',
        'Vælg løbet: **First to a drop** (op til 5 genstande, alle monsterdrops), **Most kills** af en boss, eller **Most XP** i én skill eller samlet.',
        'Vælg tidsgrænsen: **1 hour**, **24 hours** eller **7 days**. Sæt kryds ved **OK to show the result publicly**, hvis du ikke har noget imod, at det ses; det er kun offentligt, hvis I begge sætter kryds.',
      ],
      outro: 'De får en notifikation og en Discord-besked og har 24 timer til at **Accept**, **Decline** eller **Decline and block**. Uret starter, når de accepterer.',
    },
    rules: {
      title: 'Sådan afgøres det',
      intro: 'Anvil afgør det selv, inden for et minut efter slutningen.',
      rows: [
        {
          term: 'Drab og XP',
          body: 'begge startlinjer tages, når den accepteres; den, der får mest i gevinst ved slutningen, vinder, og lige gevinster er uafgjort. Hiscores og pluginnet tæller begge, den af dem der er højest.',
        },
        {
          term: 'Først til et drop',
          body: 'den første af jer, der får en af genstandene, vinder med det samme. Drops ses kun af pluginnet, så I skal begge have det kørende. Ingen får en i tide: uafgjort.',
        },
        {
          term: 'Aflysning',
          body: 'du kan trække din egen udfordring tilbage, indtil den er besvaret. Når den kører, stopper den kun, hvis I begge er enige.',
        },
      ],
    },
    limits: {
      title: 'Grænser og at sige nej',
      body: [
        'Åbne udfordringer (ventende eller i gang, sendte eller modtagne) er begrænset efter niveau: **1** gratis, **5** for Supporters, ubegrænset for Champions og Patrons. Alle kan starte op til 20 om dagen, og kun én ad gangen med den samme person.',
        'Vil du ingen have? **Turn away all new challenges**, eller bloker én person, når du afviser. Den, der udfordrer dig, ser den samme afvisning uanset hvad, så de ikke kan se, at de blev blokeret.',
        'Siden holder **Your record** (sejre, nederlag og uafgjorte), hvad der er **Open now** og **Your limit**.',
      ],
    },
    friends: {
      title: 'Vært for et venne-event',
      body: [
        'Enhver Supporter, Champion eller Patron kan køre et privat bræt for venner fra [Host](/host) → **Host for friends** → **New friends event**. Det er et helt bræt: bingo eller et felt-løb, fulgt af pluginnet, med samme opsætning som en creators event.',
        'Send **Invite link**; det er den eneste vej ind. Venner åbner det, logger ind med Discord og trykker **Open the event**. At deltage er altid gratis. Lækker linket, så lav et nyt: det gamle holder op med at virke, og alle, der allerede er med, bliver med.',
        'Et venne-event står aldrig opført noget sted på Anvil, og kræver ingen klan.',
      ],
      table: {
        areaLabel: 'Niveau',
        columns: [
          'Spillere',
          'Kører samtidig',
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
        tag: 'Hvis dit niveau stopper',
        body: 'Venner, der allerede er med, bliver med. Nye venner kan ikke komme ind over din nye grænse, og du kan ikke starte et nyt, før du er under den igen.',
      },
    },
  },
  clanHall: {
    metaTitle: 'Find klaner, events og ranglister — Anvil',
    metaDescription: 'Find en OSRS-klan på Anvils Clan Hall, sammenlign to klaner, de ugentlige spiller- og klanranglister, listen over offentlige events og klansider i spillet for klaner, der ikke er på Anvil.',
    eyebrow: 'Anvil · til spillere og klaner',
    title: 'Find klaner, events og ranglister',
    dek: 'Anvils offentlige sider til at kigge rundt: **Clan Hall** til at finde en klan, **Events**-listen til at finde noget at deltage i, og **Leaderboard** til at se, hvem der får mest.',
    facts: [
      {
        strong: 'Clan Hall',
        rest: 'kun offentlige klaner',
      },
      {
        strong: 'Leaderboard',
        rest: 'denne uge, 30 dage, nogensinde',
      },
      {
        strong: 'Events',
        rest: 'kun det værten har annonceret',
      },
    ],
    footnote: 'For at få din egen klan opført, se [Start en klan]({clanGuide}); boostede klaner fremhæves, se [Sådan booster du en klan]({boostsGuide}).',
    hall: {
      title: 'Clan Hall',
      body: [
        '[Clan Hall](/clans) lister hver offentlig klan. Søg efter navn eller slogan, og indsnævr så til **Taking members** eller **Open to challenges**. **Most active** (den rækkefølge den åbner i) sætter klaner, hvis medlemmer fik mest denne uge, først; **Biggest** sorterer efter medlemmer.',
        'Hvert kort siger, om klanen er **Recruiting**, og hvordan den tager gæster: **Guests welcome**, **Guests by approval** eller **No guests**. Boostede klaner får de fremhævede rækker øverst, og creators har en række for sig selv.',
      ],
      note: {
        tag: 'Ikke listet?',
        body: 'Kun klaner sat til offentlig vises, og en klan kan slå sin listning fra i sine indstillinger. Private klaner står aldrig i Clan Hall, på ranglisten eller i sammenligninger.',
      },
    },
    compare: {
      title: 'Sammenlign to klaner',
      body: [
        '[Compare clans](/compare/clans) sætter to vilkårlige listede klaner side om side. Vil du sammenligne to karakterer i stedet, brug [Compare](/compare).',
      ],
    },
    board: {
      title: 'Ranglisten',
      body: [
        '[Leaderboard](/leaderboard) rangerer spillere og klaner efter erfaring, effektive timer og bossing over **This week**, **30 days** eller **All time**. Spillere kan indsnævres til **Regular**, **Ironman**, **Hardcore**, **Ultimate** eller **Group**-konti.',
        'Klaner rangeres efter den XP deres medlemmer fik. Kun verificerede klaner, der står i Clan Hall, vises. En gæsts gevinster tæller for deres egen klan, ikke den de er gæst i.',
      ],
    },
    events: {
      title: 'Find et event at deltage i',
      body: [
        '[Events](/events) lister, hvad der kører og kommer op på tværs af Anvil. Filtrér efter **Live now**, **Open to join** eller **Starting this week**, efter format eller **Solo**, efter **Anyone can join** eller **Ask or meet a rule**, og efter **Clans** eller **Creators**. **Join** fører dig til at tilmelde dig.',
        'Kun events, hvis vært slog **Advertise on Anvil** til, vises. Medlemsbegrænsede og inviteringsbegrænsede events gør aldrig.',
      ],
    },
    ghost: {
      title: 'Klaner i spillet, der ikke er på Anvil',
      body: [
        'En karakters side nævner den klan i spillet, den er i. Hvis den klan ikke er på Anvil, åbner linket en almindelig side, der lister de Anvil-spillere, der er i den, og valgte at vise det. Det er ikke den klans liste, og intet på den gør nogen til medlem.',
        'Er det din klan, sætter **Bring your clan to Anvil** en op. Når den er en offentlig Anvil-klan, går linket direkte til den.',
      ],
    },
  },
  guideLibrary: {
    metaTitle: 'Guides i spillet: læsning, forslag og klankopier — Anvil',
    metaDescription: 'Anvils guidebibliotek: raid-, boss-, skilling- og pengeguides på siden, i spillet og i Discord. Læsning efter niveau, forslag til en ny guide eller en ændring, og hvordan en klan kopierer og redigerer bibliotekets guides.',
    eyebrow: 'Anvil · til spillere og klanstaben',
    title: 'Guides i spillet',
    dek: 'Ud over disse vejledningssider har Anvil et bibliotek af spilguides: raids, bosser, skilling og pengetjening. Alle kan læse dem, enhver der er logget ind kan foreslå en, og en klan kan beholde sine egne kopier.',
    facts: [
      {
        strong: 'Tre niveauer',
        rest: 'Beginner, Intermediate, Advanced',
      },
      {
        strong: 'Alle kan foreslå',
        rest: 'staff gennemgår hver enkelt',
      },
      {
        strong: '/guide',
        rest: 'poster en i Discord',
      },
    ],
    footnote: 'Slash-kommandoer står i [Slash-kommandoer]({commandsGuide}).',
    read: {
      title: 'Læs en guide',
      body: [
        'Åbn fanen **In-game guides** på guidesiden, eller [/guides](/guides) på din klans side. En klans liste har sine egne guides plus de bibliotek-guides, den ikke har kopieret.',
        'Mange guides har et niveauskifte øverst: **Beginner**, **Intermediate** og **Advanced**. Delene for andre niveauer klapper sammen, så en nybegynder og en speed-runner læser den samme side.',
        'I Discord poster `/guide` og begyndelsen af et navn et guide-kort med et link til hele siden.',
      ],
    },
    propose: {
      title: 'Foreslå en guide eller en ændring',
      body: [
        'Når du er logget ind, åbn [Propose a guide](/guides/propose) for at skrive en ny, eller foreslå en ændring til en eksisterende bibliotek-guide. Fortæl gennemgangspersonen, hvad du har ændret og hvorfor; du kan vise dine ændringer mod den nuværende guide, før du sender.',
        'Tryk **Send for review**. [My guide proposals](/guides/proposals) viser hver enkelt som **pending**, **approved**, **rejected** eller **withdrawn**, med gennemgangspersonens note, når den er besvaret. Mens den er pending, kan du redigere den eller **Withdraw** den. Du kan have 5 ventende ad gangen.',
        'Intet kommer live, før Anvils guide-redaktører godkender det. En godkendt ændring opdaterer også hver klankopi, der ikke er ændret.',
      ],
    },
    clan: {
      title: 'Din klans guides',
      intro: 'Admins og moderatorer, der må skrive guides, styrer dem under **Guides** i admin-menuen.',
      rows: [
        {
          term: 'Show library guides on our site',
          body: 'til: bibliotek-guides, du ikke har kopieret, vises også på din Guides-side, altid opdaterede.',
        },
        {
          term: 'Copy to our guides',
          body: 'laver en klankopi. Den **follows library**, indtil du redigerer den, og henter hver bibliotek-ændring.',
        },
        {
          term: 'Redigering af en kopi',
          body: 'gør den **customised**, klanens egen. Når bibliotek-guiden senere ændres, vises **update available**: tag den nye version, eller behold din.',
        },
        {
          term: 'Ny guide',
          body: 'skriver én, kun din klan har, som jeres egne raid-regler eller en masse-guide.',
        },
      ],
      note: {
        tag: 'Opslag af dem',
        body: 'Guides kan postes i en Discord-kanal, og de opslag redigeres på stedet, når guiden ændres.',
      },
    },
  },
  luckRecords: {
    metaTitle: 'Droppchancer, held og rekorder — Anvil',
    metaDescription:
      'Hvad chancelinjen på et drop-felt betyder, hvordan Anvil beregner held (spooned, dry eller on rate), hvad efficient hours er, og hvor din bedste dag, uge, måned og år gemmes.',
    eyebrow: 'Anvil · til spillere',
    title: 'Droppchancer, held og rekorder',
    dek:
      'Anvil kan fortælle dig, hvor sjældent et drop er, hvor lang tid det typisk tager, og hvor heldig du har været. Det kan også huske dine bedste dage. Denne side forklarer tallene.',
    facts: [
      {
        strong: 'Rater',
        rest: 'kommer fra OSRS Wiki',
      },
      {
        strong: 'Held',
        rest: 'forventede kills mod dine rigtige',
      },
      {
        strong: 'Rekorder',
        rest: 'medregner historik fra da Anvil begyndte at følge dig',
      },
    ],
    footnote:
      'Dine egne sider står i [Your profile, Wrapped and Compare]({profileGuide}). Kontakterne står i [Settings, page by page]({settingsGuide}).',
    odds: {
      title: 'Chancerne på et drop-felt',
      intro: 'Åbn et drop-felt, og du ser op til otte linjer, én pr. item med kendte chancer. En linje ser sådan ud:',
      body: [
        '`Item: 1 in 512 from Boss · ~512 kills ≈ 9.4 h at 55/h`',
        'Hvis itemet kan rulles mere end én gang pr. kill, står der også **(×2 rolls)**. Hvis Anvil ikke ved, hvor hurtigt folk dræber den boss, udelades timedelen.',
      ],
      rows: [
        {
          term: '1 in N',
          body: 'chancen for dropet på ét kill, fra den kilde der er hurtigst at få det fra.',
        },
        {
          term: 'Forventede kills',
          body: 'det gennemsnitlige antal kills, det tager. Det beregnes ud fra chancerne og antallet af rul.',
        },
        {
          term: 'Timer',
          body:
            'forventede kills divideret med hvor mange kills i timen folk typisk klarer. Det er en vejledning, ikke et løfte.',
        },
      ],
      note: {
        tag: 'Gennemsnit, ikke en grænse',
        body:
          'Halvdelen af alle spillere får den før de forventede kills, og nogle skal bruge langt flere. Brug det til at vurdere, hvor stort et tile er, ikke til at sige, hvornår det lander.',
      },
    },
    luck: {
      title: 'Held: spooned, dry eller on rate',
      body: [
        'Held sammenligner de kills, du har lavet, med de kills, det skulle have taget. Har du fået dropet på færre kills end forventet, er du **spooned**. Har du lavet mange kills og stadig ingenting, er du **dry**. Derimellem er du **on rate**.',
        'Anvil markerer kun dig som **dry** eller **spooned**, når det er usædvanligt: omkring en chance på én ud af tyve eller sjældnere. Det viser, hvor mange du har mod hvor mange der var forventet, og hvor langt foran eller bagud du er.',
        'Fanen **Luck** på Members-siden lister de tørreste og heldigste i din klan. Plugin-posts for sjældne drops kan også have en heldlinje, f.eks. en topprocent eller hvor mange spillere der ville have haft det nu.',
      ],
    },
    source: {
      title: 'Hvor tallene kommer fra',
      body: [
        'Droprater kommer fra OSRS Wiki og opdateres hver dag. Killrater til timerne kommer fra Wikiens penge-guides. Hvor en rate er et omhyggeligt skøn, behandler Anvil den som et.',
        'Hvis en rate ser forkert ud, er Wiki stedet at rette den. Anvil tager ændringen med.',
      ],
    },
    records: {
      title: 'Rekorder og effektive timer',
      body: [
        'Anvil gemmer din bedste **day**, **week**, **month** og **year** for skill-XP, bosskills og effektive timer. Dage er UTC, og uger starter mandag.',
        'Rekorder går tilbage til det tidspunkt, hvor Anvil begyndte at følge din konto: Første gang du åbner dem, udfylder Anvil dem fra din daglige historik og holder dem derefter opdateret. En rekord ændres kun, når du slår din gamle bedste.',
        'Du ser dine egne på din karakters side under **Records**. Din klans rekordholdere findes under **Members → Records**.',
        '**Efficient hours played** er, hvor lang tid dine gevinster ville tage med gode træningsmetoder, så en hurtig skill og en langsom kan sammenlignes. **Efficient hours bossed** gør det samme for kills. Satserne kommer fra OSRS Wiki, og ironman-konti bruger deres egne satser.',
      ],
    },
  },
};

export default da;
