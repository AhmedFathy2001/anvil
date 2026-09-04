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
// Alt andet — forklaringen, rækkefølgen, hvorfor man gør det — er dansk.

const da: PartialGuideDict = {
  common: {
    contents: 'Indhold',
    step: 'Trin',
    optional: 'valgfrit',
    minRead: '{n} min læsning',
    language: 'Sprog',
    partialNotice:
      'Denne vejledning er kun delvist oversat til {language}. Det, der endnu ikke er oversat, vises på engelsk.',
    backToGuides: 'Alle vejledninger',
    unreviewedNotice:
      'Denne oversættelse til {language} er endnu ikke læst igennem af en, der har sproget som modersmål. Læser en sætning forkert, er [den engelske side]({englishHref}) originalen — og [at sige til](/feedback) er dét, der får den rettet.',
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
    },
    cards: {
      discord: {
        eyebrow: 'Til den der styrer serveren',
        title: 'Anvil i Discord',
        blurb: 'Én invitation, så kanalerne hver feed skriver i, roller, slash-kommandoer, og hvad du tjekker når det stopper.',
        minutes: '~5 min',
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
          'Installér pluginnet, forbind det til denne side, og lad det indsende dine drops. Dækker også Discord-beskeder og klip via OBS.',
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
    footnote: 'Du kan ændre alt dette senere under Admin → Klan, undtagen adressen — den er værd at tænke over nu.',
    before: {
      title: 'Før du går i gang',
      body: [
        'Du skal bruge en Discord-konto, og det er hele listen. Log først ind på `{apex}`: en klan skal have en ejer, og indlogningen er måden siden ved, at det er dig. Start fra **Start en klan** på platformsiderne, eller gå direkte til `{apex}/clans/new`.',
        'Det koster ingenting. Ingen plan at vælge, intet kort at indtaste, og ingen prøveperiode der udløber og tager dit bræt med sig — en klan starter gratis og bliver ved med at virke.',
      ],
      note: {
        tag: 'Du bliver dens ejer',
        body: 'Ejer er den ene rolle, ingen kan tage fra dig, og den går til den, der opretter klanen. Tilføj stab bagefter under Admin → Klan; se [På vagtplanen]({moderatorGuide}).',
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
      intro: 'Fire ting står mellem en frisk klan og et kørende event. Guiden går dem igennem i rækkefølge og springer over, hvad du allerede har lavet.',
      steps: [
        {
          term: 'Giv den navn i Discord',
          body: 'Dit visningsnavn, dit klannavn i spillet og et invitationslink til din server. Invitationen er dét, der lader tilmeldingssider og guides pege folk hen til dig.',
        },
        {
          term: 'Forbind Discord',
          body: 'Én delt bot, så der er ingen applikation at registrere og intet token at indsætte. Godkend den én gang, så kan den skrive i dine kanaler og læse dine roller.',
        },
        {
          term: 'Giv den en kanal',
          body: 'En annonceringskanal til eventopslag. Del eventuelt pluginets feeds ud: sjældne drops i én kanal, dødsfald i en anden, så de ikke drukner hinanden.',
        },
        {
          term: 'Lav et bræt',
          body: 'Det første event. Vælg et format, tilføj felter, åbn tilmeldinger — det er [Kør dit første event]({adminGuide}), og klart den længste af de fire.',
        },
      ],
      after: [
        'Du kan springe guiden helt over og gøre det hele senere under Admin → Klan. Den findes, fordi rækkefølgen betyder noget, når man aldrig har gjort det før: Discord før kanaler, kanaler før et bræt der vil skrive i dem.',
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
          term: 'De spiller bare',
          body: 'Alle der logger ind med pluginet kørende, bliver genkendt automatisk. Er de ikke på listen endnu, spores de som **gæst** — synlige, tællelige og én synkronisering fra at være medlem.',
        },
        {
          term: 'I hånden',
          body: 'Admin → Klan tager navne ét ad gangen, til den der spiller på mobil eller den officielle klient og slet ikke kan køre pluginet.',
        },
      ],
      note: {
        tag: 'Gæster er ikke et problem, der skal løses',
        body: 'En gæst er simpelthen en, vi har set, som ikke står på din liste — en spiller fra en gæsteklan, en alt, en der meldte sig ind i morges. De kan deltage i events uden nogensinde at blive medlem.',
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
    footnote: 'Alt her ligger under Admin → Indstillinger, fordelt på fanerne Discord-bot, Webhooks, Roller & kanaler og Notifikationer.',
    bot: {
      title: 'Én bot, allerede bygget',
      body: [
        'Der er ingen Discord-applikation at oprette, intet token at generere og ingen hemmelighed at indsætte. Anvil kører én bot, som alle klaner deler, så at forbinde er en invitation og intet andet.',
        'Du kan stadig tage din egen med — indsæt et token under **Discord-bot**, så bruges det i stedet. Det er kun umagen værd, hvis du vil have botten til at bære din klans navn og avatar i medlemslisten; alt i denne guide virker ens uanset hvad.',
      ],
      permissions: [
        {
          term: 'Se kanaler, sende beskeder, indlejre links, vedhæfte filer',
          body: 'Det basale. Uden dem er den på din server og tavs.',
        },
        {
          term: 'Administrere webhooks',
          body: 'Så knappen **Opret** på Webhooks-fanen kan lave en webhook for dig i stedet for, at du kopierer URL’er ud af Discord i hånden.',
        },
        {
          term: 'Administrere roller',
          body: 'Kun hvis du slår rollesynkronisering til. Så kan den uddele de roller, du kobler — og den kan aldrig røre en rolle over sin egen, hvilket er Discords regel, ikke vores.',
        },
        {
          term: 'Administrere kaldenavne',
          body: 'Kun hvis du slår kaldenavnssynkronisering til, så et medlems servernavn kan sættes til deres RSN.',
        },
        {
          term: 'Administrere kanaler',
          body: 'Kun til private holdkanaler under et draft. Spring den over, og alt andet virker stadig.',
        },
      ],
      note: {
        tag: 'Den beder om alle fem på én gang',
        body: 'Discord kan ikke bede om en rettighed senere, så invitationslinket beder om hele sættet, og de funktioner du aldrig slår til, bruger aldrig deres. At åbne invitationslinket igen er også måden at reparere en rettighed, nogen har fjernet.',
      },
    },
    connect: {
      title: 'At forbinde den',
      intro: 'To ting, i denne rækkefølge. Botten skal være på din server, og Anvil skal vide, hvilken server der er din.',
      steps: [
        {
          term: 'Inviter botten',
          body: 'Admin → Indstillinger → **Discord-bot** → **Inviter / geninviter botten**. Linket forvælger din server, når id’et er sat, så du kan ikke tilføje den til den forkerte ved et uheld.',
        },
        {
          term: 'Sæt server-id’et',
          body: 'Højreklik på dit serverikon i Discord → **Kopiér server-id** (kræver Udviklertilstand, under Discords egne avancerede indstillinger) og indsæt det. Det er feltet, der gør forbindelsen til din.',
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
      title: 'Hvor tingene skrives',
      body: [
        'Anvil skriver gennem **webhooks**, én pr. kanal, og hver eneste er valgfri. Der skrives intet nogen steder, før du peger en feed mod en kanal — en frisk klan er tavs med vilje, ikke ved et uheld.',
        'Webhooks-fanen kan lave dem for dig: vælg en kanal, tryk **Opret**, og botten laver webhooken med sin rettighed. At indsætte en URL, du selv har lavet i Discord, virker på samme måde.',
      ],
      feeds: [
        {
          term: 'Annonceringer',
          body: 'Den vigtigste. Events der starter og slutter, tilmeldinger der åbner, stillinger, ugens resultater. Sæt kun den, så har du en fungerende klan.',
        },
        {
          term: 'Plugin-standard',
          body: 'Hvor alt fra spillet havner, når det ikke har sin egen kanal. Sæt den som nummer to.',
        },
        {
          term: 'De opdelte feeds',
          body: 'Sjældne drops, pets, dødsfald, collection log, combat achievements, levels, quests, diaries, klip, PvP-kills og Leagues får hver sin kanal. Den opdeling er forskellen på en feed folk læser og en, de slår fra.',
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
        'To synkroniseringer, begge slukket til du slår dem til, og begge styret af medlemslisten frem for af noget, nogen skriver i Discord.',
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
        body: 'Discord lader ingen bot røre en rolle på eller over sin egen, og den nægter det tavst fra din side — synkroniseringen gør så bare ingenting. Træk Anvil-rollen op under Serverindstillinger → Roller, så begynder den at virke; der skal ikke geninviteres noget.',
      },
    },
    commands: {
      title: 'Slash-kommandoer',
      body: [
        'Botten svarer på `/bingo` på din server: **board**, **rules**, **leaderboard**, **me** og **team**. De læser det igangværende event, så ingen behøver forlade Discord for at se, hvor de står.',
        'De dukker op cirka et minut efter, botten er kommet ind. Dukker de slet ikke op, gav invitationen botten men ikke dens kommandoer — det er to separate rettigheder, og et ældre invitationslink bad kun om den ene. Åbn linket igen fra Discord-bot-fanen; det smider ikke botten ud og nulstiller ingenting.',
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
    quiet: {
      title: 'Når der bliver stille',
      body: [
        'I rækkefølge, fordi hvert punkt udelukker det næste:',
      ],
      checks: [
        {
          term: 'Er botten faktisk på serveren?',
          body: 'Discord-bot-fanen siger det direkte. „Token gyldigt“ og „på din server“ er to forskellige ting, og det første medfører ikke det andet — med en delt bot er tokenet altid gyldigt.',
        },
        {
          term: 'Er server-id’et rigtigt?',
          body: 'Et forkert-men-ægte id ser præcis ud som et rigtigt, indtil du opdager, at opslagene lander et andet sted.',
        },
        {
          term: 'Findes webhooken stadig?',
          body: 'At slette en Discord-kanal sletter dens webhook, og Anvil beholder den døde URL. Lav den igen på Webhooks-fanen.',
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
  },

  plugin: {
    metaTitle: 'Opsætning af RuneLite-pluginnet — Anvil',
    metaDescription:
      'Installér Anvils RuneLite-plugin, forbind det til denne side, og sæt Discord-beskeder og OBS-klip op.',
    eyebrow: 'Anvil · RuneLite-plugin',
    title: 'Opsætningsguide til spillere',
    dek: 'Installér det, peg det på {clanName}, og spil. Pluginnet indsender dine bingo-drops, poster dine sjældne drops og dødsfald på Discord og — hvis du kører OBS — gemmer og poster klip af de øjeblikke, der er værd at se igen.',
    facts: [
      { strong: '2 felter', rest: 'og du bliver tracket' },
      { strong: '~3 min', rest: 'til den basale opsætning' },
      { strong: 'Klip', rest: 'kræver OBS + 5 minutter mere' },
    ],
    footnote:
      'Skærmbillederne er fra en rigtig opsætning — kontotoken, OBS-adresse og Discord-webhook er sløret med vilje. Dine bør blive lige så private.',

    install: {
      title: 'Installér pluginnet',
      body: [
        'I RuneLite: **Configuration** (skruenøglen) → **Plugin Hub** → søg efter **Anvil** → **Install**. Udgiveren er `AhmedFathy2001`.',
        'Ét plugin dækker alle klaner — du peger det på denne side i næste trin, så der er ikke noget klan-specifikt at hente. Når det er installeret, åbner du **Configuration → Anvil** for at nå indstillingerne, der bruges hele vejen igennem denne vejledning.',
      ],
    },

    connect: {
      title: 'Forbind til denne side',
      intro: 'Kun afsnittet **Setup** betyder noget for at komme i gang. Alt andet har fornuftige standardværdier.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Anvil-pluginnets Setup-afsnit med felterne Site URL og Account Token markeret',
        legend: [
          {
            label: 'Site URL',
            body: 'for {clanName} er det `{origin}`. Feltet er tomt fra start, så du skal selv udfylde det. Der skal ikke skråstreg til sidst, og `https://` bliver sat på, hvis du udelader det.',
          },
          {
            label: 'Account Token',
            body: 'din personlige nøgle til denne side. Enten lader du pluginnet udfylde den for dig (se nedenfor), eller du indsætter den selv. Behandl den som et kodeord.',
          },
        ],
      },
      easyHeading: 'Den nemme vej: log ind fra pluginnet',
      easyIntro:
        'Når Site URL er sat, og token stadig er tom, viser **Anvil-sidepanelet** en **Sign in with Discord**-knap. Klik på den, så guider pluginnet dig igennem — du skal ikke kopiere noget.',
      easySteps: [
        'Panelet viser en kode og åbner din browser på denne side.',
        'Tjek at koden på siden er den samme som den i RuneLite, og klik så **Approve**.',
        'Panelet skriver _Signed in_ og udfylder Account Token for dig.',
      ],
      linkFigure: {
        caption: 'Denne side → /link-device',
        alt: 'Siden Link your RuneLite client med kodefeltet og Approve-knappen markeret',
        legend: [
          { label: 'Koden', body: 'den skal stemme med det, pluginnet viser dig lige nu.' },
          {
            label: 'Approve',
            body: 'godkend kun en kode, som _din egen_ klient viser. Har nogen sendt dig et link eller en kode, så afvis den — at godkende ville give dem din konto.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Derfor dukker et andet domæne op',
        body: [
          'Godkendelsen sker her, på `{origin}`. Hvis du ikke allerede er logget ind på siden, går selve login-trinnet via Anvils fælles Discord-login på `anvilosrs.com` for at bekræfte, hvem du er på Discord — og sender dig så direkte tilbage hertil. Det er det samme login, du får fra Login-knappen på denne side, og ikke en del af pluginnets flow.',
          'Pluginnet selv taler kun med `{origin}`: det nægter at åbne en login-side, der ikke ligger på den Site URL, du har skrevet.',
        ],
      },
      directNote: {
        tag: 'Hvor det foregår',
        body: [
          'Hele forløbet bliver på `{origin}` — koden udstedes her, godkendes her med {clanName}s eget Discord-login, og token udleveres her. Pluginnet nægter at åbne en login-side, der ikke ligger på den Site URL, du har skrevet, så intet i dette trin når frem til en anden Anvil-installation.',
        ],
      },
      federationAside:
        'Må ikke forveksles med **Connect clans** i sidepanelet — det er den separate, valgfrie knap, der forbinder dig til andre Anvil-klaner, og den dukker først op, når du allerede er logget ind her.',
      manualFallback:
        'Åbner browseren ikke af sig selv, skriver panelet adressen og koden, så du kan åbne den manuelt. Koder udløber efter ti minutter — tryk bare på knappen igen.',
      manualHeading: 'Den manuelle vej: kopiér din token',
      manualIntro:
        'Log ind med Discord og åbn [Profile](/profile), og rul så ned til kortet **RuneLite plugin**.',
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
            body: 'kopiér den ind i pluginnets Account Token-felt. Rotate udsteder en ny og dræber den gamle — brug den, hvis du overhovedet mistænker, at din token er sluppet ud.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Værd at vide',
        body: ['Én token dækker alle de events, du er tilmeldt her — du skal aldrig indsætte den igen pr. bingo.'],
      },
    },

    accounts: {
      title: 'Forbind dine konti — bare spil',
      body: [
        'Der er ingen linkkode at taste. Når din token er på plads, bliver den konto, du logger ind med, automatisk koblet til din profil.',
        'Pluginnet sender dit navn i spillet plus et stabilt kontofingeraftryk med hver forespørgsel, og siden matcher på fingeraftrykket først — så dine links overlever et navneskift. Log ind på en alt én gang, og den dukker op på din profil under _Accounts we noticed you playing_ med et **Add** i ét klik.',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: 'RuneScape Accounts-kortet på profilsiden med konti verificeret via pluginnet',
        legend: [
          {
            label: 'Dine forbundne konti',
            body: 'alt med “Verified via plugin” er kommet dertil bare ved at blive spillet. Tilføj lige så mange alts, du vil; én af dem er din primære.',
          },
        ],
      },
      noPluginHeading: 'Kan du ikke køre pluginnet?',
      noPluginIntro:
        'På mobil eller i den officielle klient forbinder du kontoen på hjemmesiden i stedet — profilsiden viser begge muligheder:',
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
        'Du bør også se **Anvil-sidepanelet** fyldes ud med dine klaner, dine igangværende events, din placering og synkroniseringsknapperne — og en **Anvil**-knap dukke op i titellinjen på din Collection Log i spillet, ved siden af WikiSync og RuneProfile.',
      guestNote: {
        tag: 'Gæst kontra medlem',
        body: 'Står der _Tracked as a guest_ i chatten, bliver du tracket, men du står endnu ikke på klanens medlemsliste. Det retter en admin ved at synkronisere medlemslisten fra spillet — spørg {discordLink}.',
        discordWord: 'på Discord',
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
            label: 'Auto Submit Drops',
            body: 'tager et screenshot og indsender et tracket drop i samme øjeblik, det falder. Lad den være tændt; det er hele pointen.',
          },
          {
            label: 'Show Overlay',
            body: 'tegner et lille _Anvil / hold / UTC-dato_-panel øverst til venstre. Det bliver en del af billedet på dine bevis-screenshots, og det er netop dét, der gør et bevis svært at forfalske eller datere tilbage. Den er slukket på dette skærmbillede — tænd den, hvis din klan vil have hold og tidspunkt synligt på hvert bevis.',
          },
          {
            label: 'Team completion popups',
            body: 'et banner, når nogen på dit hold gør et felt færdigt. Flere på én gang: det sværeste får banneret, resten går i chatten.',
          },
          {
            label: 'Distinct mission sound',
            body: 'giver det sin egen lyd, når en mission lander — og når nogen henter den — så du kan høre forskel på den og et almindeligt felt uden at kigge.',
          },
          {
            label: 'Banner sound + volume',
            body: 'afspiller en lyd sammen med banneret. Der sker ingenting, før du selv tilføjer mindst én .wav-fil via **Add clip** under “Banner sounds” i Anvil-sidepanelet.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'bager et billede nummer to ind i screenshottet et par sekunder senere, når loot har lagt sig på jorden. Lad den være tændt; den sparer dig for diskussioner.',
          },
        ],
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
        'De sendes, uanset om der kører en bingo eller ej, og de lander i klanens kanaler. Hvilken kanal bestemmer administratorerne her — du vælger kun _hvad_ du poster.',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Beskedafsnittene Deaths and kills og Drops and pets med hver indstilling markeret og nummereret',
        legend: [
          {
            label: 'Notify on death',
            body: 'poster i klanens dødsfaldskanal med et screenshot af det øjeblik, du døde.',
          },
          { label: 'Death message', body: 'din egen linje. `{name}` bliver erstattet med dit RSN.' },
          {
            label: 'Notify on PvP kill',
            body: 'et screenshot af det tick, hvor dit mål rammer 0 HP. Slukket som standard; tændt her.',
          },
          { label: 'Notify on rare drops', body: 'hovedafbryderen for drop-opslag.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'to uafhængige veje til et opslag: værd mindst så meget (GE eller high alch, alt efter hvad der er højest), eller sjældnere end 1-ud-af-N (1/10.000 som standard — løsere indstillinger fylder kanalen med urteruller). Din klan kan sætte en sjældenhedsgrænse, der gælder alle; din egen gælder stadig, når den er strengere. Sæt en af dem til 0 for at slukke den vej.',
          },
          { label: 'Screenshot rare drops', body: 'vedhæft billedet, ikke bare teksten.' },
          {
            label: 'Loot key value',
            body: 'en loot key posteres én gang, som én besked, når hele indholdet kommer over dette tal.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pets lander i kanalen for sjældne drops.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Beskedafsnittet Combat achievements med hver indstilling markeret og nummereret',
        legend: [
          { label: 'Notify on combat achievements', body: 'gennemførte tiers posteres altid, når denne er tændt.' },
          {
            label: 'CA task min tier',
            body: 'hvor larmende de enkelte opgaver er. Elite her; standarden er Master. Sæt den til Grandmaster, hvis du kun vil have de allersjældneste.',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99’ere, hver 100 total levels fra 1800 og op, samt max.',
          },
          { label: 'Notify on diary completions', body: 'gennemførte achievement diary-tiers.' },
          {
            label: 'Announce quest completions',
            body: 'fra den sværhedsgrad, du vælger, og opefter. “All quests” her; standarden er Master og op.',
          },
        ],
      },
    },

    clips: {
      title: 'Klip med OBS',
      intro: [
        'Tryk på én tast, og de sidste 30 sekunder bliver gemt og lagt i klanens klipkanal. Det er slukket som standard og kræver, at OBS kører — men det er det tætteste, din klan kommer på en highlight-reel.',
        'Sådan virker det: OBS holder en rullende **replay buffer** med de sidste X sekunder. Din genvejstast beder OBS om at skrive den buffer til en fil, og pluginnet samler filen op og uploader den til en Discord-webhook, du har indsat.',
      ],
      privacyNote: {
        tag: 'Hvor din video havner',
        body: 'Klip uploades **direkte fra din PC til Discord**. De passerer aldrig denne side, og der uploades intet som helst, hvis du lader webhook-feltet stå tomt — så bliver klippene liggende på din maskine.',
      },
      obsHeading: 'A. Sæt OBS op (én gang)',
      obsSteps: [
        'Du skal bruge **OBS Studio 28 eller nyere** — WebSocket-serveren er indbygget fra 28 og frem, ingen ekstra download.',
        'Sørg for, at OBS faktisk optager spillet: en Game / Window / Display Capture-kilde, der viser RuneLite. Kan OBS ikke se din klient, bliver dine klip et sort rektangel.',
        '**Settings → Output** → sæt flueben i **Enable Replay Buffer**. (I Simple output-tilstand ligger den på Recording-siden; i Advanced har den sin egen fane.) Tjek samtidig, at der er plads på den sti, du optager til.',
        '**Tools → WebSocket Server Settings** → sæt flueben i **Enable WebSocket server**. Notér **Server Port** (4455 som standard), og klik **Show Connect Info** for at få adgangskoden.',
      ],
      obsAside:
        'Du behøver _ikke_ trykke på “Start Replay Buffer” — pluginnet starter den for dig, når det forbinder, og genstarter den, hver gang du ændrer kliplængden.',
      fillHeading: 'B. Udfyld pluginnet',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'Clips-afsnittet i pluginnets indstillinger med hver indstilling markeret og nummereret; OBS-værten og webhook-URL’en er skjult',
        legend: [
          { label: 'Enable clip capture', body: 'hovedafbryderen. Er den slukket, taler pluginnet slet ikke med OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'sæt den, ellers sker der aldrig noget. Vælg noget, du ikke rammer ved et uheld midt i et raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost`, når OBS kører på samme PC som RuneLite. Kører OBS på en anden maskine, skriver du dens lokale IP her — skjult på dette skærmbillede — og lukker porten igennem dens firewall. Port og adgangskode kommer fra _Show Connect Info_; lad adgangskoden stå tom, hvis du har slået OBS-godkendelse fra.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'alt større bliver gemt lokalt og nævnt diskret i chatten i stedet for at blive postet. Sæt den til det, din Discord-server faktisk accepterer; pluginnet leveres med 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'hvor langt tilbage hvert klip rækker. Den skriver bufferlængden ind i din OBS-profil, så OBS skal bruge det antal sekunders tilløb, før et klip i fuld længde overhovedet findes. Længere klip = større filer; 30 er et godt sted at lande.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 kan forhåndsvises og afspilles direkte i Discord; MKV skal hentes ned først. Bemærk at den ændrer OBS’ optageformat, hvilket også påvirker dine almindelige optagelser. Slå den fra for at lade OBS være i fred.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'hvor klip bliver postet — spørg en admin om webhooken til klipkanalen. Tom = klippene bliver på din PC. Skjult her, og værd at skjule: alle med denne URL kan poste i den kanal.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'håndterer også gemte klip udløst af OBS selv eller af pluginnet “Save Replay Buffer for OBS”. Lad den være slukket, hvis du kører to RuneLite-klienter mod én OBS — ellers bliver hvert klip postet to gange.',
          },
        ],
      },
      useHeading: 'C. Brug det',
      useIntro: 'Der sker noget sjovt → tryk på din genvejstast → chatten fører dig igennem:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Husk',
        body: 'Klippet dækker sekunderne _før_, du trykkede — så tryk efter øjeblikket, ikke under. Du har hele bufferens længde til at reagere.',
      },
      decodedHeading: 'Klip-beskeder, oversat',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS kører ikke, WebSocket-serveren er slukket, eller host/port/adgangskode passer ikke. Ret det og tryk igen — pluginnet prøver selv at forbinde igen hvert 30. sekund.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'Bufferen kører ikke. Tjek Enable Replay Buffer i OBS’ output-indstillinger, og slå så Enable clip capture fra og til igen.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Det virker, som det skal — du har bare ingen webhook sat. Filen ligger i din OBS-optagemappe.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Gør kliplængden kortere, sænk kvaliteten på din OBS-optagelse, eller hæv maksstørrelsen, hvis din server accepterer større filer.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'For stor, rate-limited, eller uploaden løb tør for tid. Filen ligger stadig på din PC — post den i hånden, hvis den er det værd.',
        },
      ],
    },

    trouble: {
      title: 'Når noget går galt',
      intro:
        'Pluginnet siger til i chatten, når trackingen er stoppet — det venter cirka 90 sekunder, før det brokker sig, og gentager højst hvert 5. minut.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'Token er forkert eller er blevet roteret. Kopiér den igen fra [Profile → RuneLite plugin](/profile#plugin-token), eller ryd feltet og log ind fra pluginnet igen.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Tjek Site URL for tastefejl — den skal være `{origin}`. Er den rigtig, er siden formentlig nede.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Den konto er ikke forbundet endnu. Tilføj den fra Profile → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Ingenting. Den kom sig selv.',
        },
      ],
      logHeading: 'Stadig i vanskeligheder? Send en admin en log',
      logBody:
        'Skriv `::anvillog` i spillets chat (eller sæt **Export debug log hotkey** i pluginnets Support-afsnit). Den skriver en logfil til din `.runelite/anvil-debug`-mappe, åbner mappen og kopierer stien til din udklipsholder — send filen til en admin, så kan de se præcis, hvad der gik galt.',
      missingNote: {
        tag: 'Mangler der beviser?',
        body: 'Pets og ekstra Champion’s scrolls kræver et manuelt screenshot. Pluginnet tager det for dig og gemmer det i `.runelite/osrs-bingo-pending/` — **Copy folder path** i Anvil-sidepanelet åbner mappen — så du vedhæfter det på siden i stedet for at lede efter et billede bagefter.',
      },
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
      { strong: '4 trin', rest: 'i opsætningsguiden' },
      { strong: '7 formater', rest: 'at bygge et bræt af' },
      { strong: '1 knap', rest: 'til at synkronisere medlemslisten' },
    ],
    footnote:
      'Denne vejledning følger appen, som den ser ud i dag. Passer en skærm her ikke med det, du kigger på, er appen rigtig, og vejledningen er forældet — [sig til](/feedback), så retter vi den.',

    access: {
      title: 'Hvem må hvad',
      intro:
        'Alle logger ind med Discord — der er ingen kodeord. Den første admin kommer fra serverkonfigurationen; derefter forfremmer en admin folk fra **Clan → Members & staff**. Rollerne stabler nedad: alt en moderator kan, kan en treasurer og en admin også.',
      rows: [
        {
          term: 'Admin',
          body: 'fuld adgang — events, felter, hold, indstillinger, stab, udbetalinger. Giv den til så få, som klanen kan holde ud.',
        },
        { term: 'Treasurer', body: 'alt hvad en moderator kan, plus tilmeldingsgebyrer og udbetalinger.' },
        {
          term: 'Moderator',
          body: 'det daglige: medlemsliste, verificeringer, ugentlige konkurrencer, kalender, feedback. Kan ikke oprette eller redigere events.',
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
        '**System → Setup** er en guide i fire trin, og dashboardet holder de samme fire som en tjekliste, indtil de er klaret: navngiv klanen, forbind Discord, opret et event, tilføj felter. Status regnes ud fra rigtige data, så et trin bliver først flueben, når det virkelig er færdigt.',
      discord:
        'Til Discord har du to veje, og de kan kombineres: giv Anvil en **bot**, og den kan oprette webhooks, synkronisere roller og kaldenavne og bygge private holdkanaler for dig; giv den en enkelt **webhook-URL**, og den kan poste beskeder og intet andet. Start med webhooken, hvis du vil være i luften om to minutter, og tilføj botten, når du vil have automatikken.',
      permsNote: {
        tag: 'Bottens rettigheder',
        body: 'Botten skal bruge _Manage Webhooks_, _Manage Roles_, _Manage Channels_ og _Manage Nicknames_, og dens rolle skal ligge _over_ de roller, den styrer, i din servers rolleliste. Ellers nægter Discord i stilhed.',
      },
      hosted:
        'På en hostet plan har du mødt den skærm én gang før: det var ved at tilføje botten under opsætningen, at Anvil fandt ud af, hvilken server der er jeres — derfor var der aldrig et server-ID at kopiere. Det samme link ligger her, når du vil flytte botten til en anden server.',
    },

    channels: {
      title: 'Fordel opslag på flere kanaler',
      body: [
        'Alt lander som standard i én hovedkanal til beskeder. Når den bliver larmende, åbner du **System → Advanced settings → Webhooks** og giver de larmende kategorier deres eget hjem — bingo-events, ugentlige konkurrencer, sjældne drops, dødsfald, PvP-kills, combat achievements, klip. Alt du lader stå tomt falder tilbage til hovedkanalen, så du kan flytte én kategori ad gangen.',
        'Med botten forbundet rører du aldrig en webhook-URL: vælg en kanal i menuen og tryk **Create webhook**. Under et travlt event kan du lægge en webhook nummer to på samme kanal — Anvil skifter mellem dem, så Discords rate limit ikke sluger opslag.',
      ],
      clipsNote: {
        tag: 'Klipkanalen er anderledes',
        body: 'Klipvideoer uploades direkte fra hver spillers PC til Discord — de passerer aldrig denne side. Derfor er klip-webhooken, du sætter her, den ene du _deler ud_: medlemmerne indsætter den selv i deres plugin. Alt andet på denne side er serverside, og medlemmerne ser det aldrig.',
      },
    },

    roster: {
      title: 'Få din medlemsliste ind',
      body: [
        'Medlemskab af klanen kommer ét sted fra: en synkronisering af medlemslisten inde fra spillet. Installér [Anvils RuneLite-plugin]({pluginGuide}) på en _admins_ konto, åbn **Bingo**-fanen i Collection Log i spillet, og tryk **Sync clan roster**. Det skubber jeres faktiske klanliste fra spillet op på siden med ét klik.',
        'Alle, der forbinder eller verificerer en konto på hjemmesiden uden at stå på den liste, er en **gæst** — tracket og synlig, men ikke medlem, før en admin forfremmer dem, eller næste synkronisering samler dem op. Det er med vilje: det betyder, at ingen kan forfremme sig selv ind i jeres klan ved at skrive et navn.',
        'Du kan også tilføje nogen i hånden fra **Clan → Members & staff** — inklusive at tilmelde dem et event på deres vegne, når de ikke kan nå siden.',
      ],
    },

    board: {
      title: 'Opret dit første bræt',
      intro:
        '**Events → All events → New event**. Vælg format først — det afgør, hvordan brættet giver point, og hvad resten af formularen spørger dig om.',
      formats: {
        classic: {
          label: 'Klassisk bingo',
          blurb: 'Et kvadratisk N×N-gitter — holdene tager felterne i vilkårlig rækkefølge, hvert felt tæller 1.',
        },
        leagues: {
          label: 'Leagues-bingo',
          blurb: 'En opgaveliste, hvor hvert felt har sin egen pointværdi — et vilkårligt antal felter.',
        },
        race: {
          label: 'Feltræs',
          blurb: 'En ordnet bane — holdene når felterne i rækkefølge; den, der når længst, vinder.',
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
        'Eventets **Tiles**-fane er der, hvor et bræt bliver til en bingo. Hvert felt er én _slags_ opgave, og slagsen afgør, hvad pluginnet holder øje med: et drop, en boss-killcount, skill-XP, et NPC-kill, en tid at slå, en achievement diary, en combat achievement, en collection log-oplåsning, et PvP-kill, en gevinst i inventory eller en tur uden dødsfald. Manuelle felter — dem et menneske godkender ud fra et screenshot — er også altid en mulighed.',
        'Til et helt bræt er det hurtigere at skrive dem i bulk: eksportér arket, udfyld det i et regneark, og importér det tilbage. Både CSV og .xlsx kan gå frem og tilbage, og rækkerne følger positionerne, så du kan skrive et helt 25-felters gitter om i én indsætning.',
      ],
      rows: [
        {
          term: 'Sværhedsgrader',
          body: 'pointværdier oversættes til navngivne bånd (easy → elite). Rediger båndene under Advanced settings, hvis din klan graduerer anderledes.',
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
        'Fanen **Teams & Draft** retter sig efter det format, du valgte: et format uden hold springer den helt over. Til en almindelig holdbingo opretter du holdene, bestemmer hvem der er kaptajner, og enten fordeler spillerne selv eller kører en live draft.',
        'Kaptajnerne drafter fra tilmeldingspuljen i den rækkefølge, du vælger, og hver kaptajn kan se de svar, folk gav i tilmeldingsformularen — fastfrosset som de blev indsendt, så ingen redigerer deres “timer om ugen”, efter de er blevet valgt.',
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
          body: 'System → Announce sender en besked til jeres kanaler midt i eventet, uden at du selv skal skrive en webhook.',
        },
      ],
      missionNote: {
        tag: 'Overraskelser undervejs',
        body: 'Du kan slippe en **mission** løs på en igangværende bingo — et skjult bonusfelt, der bliver annonceret, når du fyrer det af, og som eventuelt falder i værdi eller udløber. Det er den billigste måde at vække et bræt på dag fem.',
      },
      startProofNote: {
        tag: 'Sådan stopper du hamstring før eventet',
        body: [
          'Slå **Starting shot** til (event → Overview), så skal hver spiller aflevere ét screenshot taget efter, at eventet er gået i gang, på et sted Anvil trækker i selve startøjeblikket — så ingen kan sidde på en uges opsparede clues og kister ved T0. Stedet annonceres sammen med starten; hver spillers kodeord er personligt, udledt af trækningen, og findes ikke, før eventet starter, så det kan ikke stilles op i forvejen af nogen.',
          'Sæt stederne på verdenskortet (puljeeditoren har et), så tjekker pluginnet, at spillerne rent faktisk står der, i stedet for bare at have fået besked på det. Du kan også kræve en **frisk session** — 15 minutter som standard: hiscores gemmes kun, når en spiller logger ud, så det at få alle til at relogge lige inden deres billede er dét, der gør starttallene bag hvert XP- og KC-felt ærlige.',
          'Plugin-brugere trykker på én knap. Alle andre skriver deres kodeord i spillet og uploader på My Team. Du bestemmer, hvad der sker med en kredit fra en, der ikke har afleveret: markér den til gennemsyn (standard), eller afvis den, indtil de gør. Det samme Overview-panel er gennemsynslisten — billeder fra pluginnet med et verificeret kodeord ankommer allerede godkendt, så i praksis kigger du kun mobilspillerne efter.',
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
          body: 'eventets Payouts-fane laver præmiepuljen om til en liste over, hvem der får hvad, og følger med, mens du betaler ud.',
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
          body: 'behold det bræt, du lige har bygget. Næste bingo starter fra det i stedet for et tomt gitter.',
        },
      ],
      federation:
        'Med federation slået til kan medlemmerne også forbinde sig til andre Anvil-klaner fra pluginnet — praktisk til events på tværs af klaner, og helt frivilligt for det enkelte medlem.',
      outro: 'Send så dine medlemmer videre til [opsætningsguiden til spillere]({pluginGuide}), og begynd at planlægge den næste.',
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
        'Åbn dit event og gå til fanen **Teams & Draft**. Opret ét hold pr. klan, du har inviteret, og opkald det efter dem — navnet er det, deres spillere ser i tilmeldingsformularen, så “Ironforge” slår “Hold 2”.',
        'Du behøver _ikke_ køre en draft. Invitationslinks og en draft er alternativer: en draft fordeler en fælles tilmeldingspulje, et link sætter folk direkte på plads. Ved en ren clan-mod-clan opretter de fleste værter holdene, deler ét link ud til hver, og åbner aldrig draften.',
        'Åbn så selve holdet — **Teams & Draft → holdet** — for det er der, begge de næste to trin foregår.',
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
        caption: 'Event → Teams & Draft → holdet → Team staff',
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
        caption: 'Event → Teams & Draft → holdet → Invite links',
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
        kill: { label: 'Killcount', blurb: 'N kills af en NPC — også dem der aldrig stod på hiscores (høns, køer). Registreret af pluginnet.' },
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
          term: 'Et boss-KC-mål',
          body: 'er **ikke** et kill-felt. Kill-felter holder øje med NPC-dødsfald gennem pluginnet; et KC-mål er et hiscores-tal og skal bruge `trackedStat` + `statType=boss` + `statGoal`. Brug et kill-felt til det, Hiscores aldrig har talt — køer, høns, en bestemt slayer-mob.',
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
        'At klikke sig gennem et 25-felters gitter er fint. At klikke sig gennem et Leagues-bræt med 200 opgaver er det ikke — og at læse korrektur bagefter er værre. Tiles-fanen har en tur-retur bygget til præcis det.',
      ],
      steps: [
        '**Download spreadsheet** på eventets **Tiles**-fane. Du får en .xlsx af brættet, som det ser ud nu, med dropdowns, itemlisten og kolonnevejledningen på hver sit ark.',
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
          body: 'ekstra rækker opretter nye felter på et Leagues-bræt eller et feltræs, før eventet starter, op til 1000. Et klassisk N×N-gitter har en fast form og ignorerer dem. Skal du generere hundredvis af opgaver, så lav det som et Leagues-event.',
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
        'På et pointbaseret bræt har hvert felt sin egen værdi, og de værdier oversættes til navngivne sværhedsbånd — easy til elite — som du kan redigere under **Advanced settings**, hvis din klan graduerer anderledes. Båndet er det, spillerne læser; tallet er det, der giver point.',
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
      'Formatet ligger fast ved oprettelsen, men kan ændres bagefter fra eventets Overview-fane; afsløringspolitikken og pointmodifikatorerne kan ændres når som helst, før de felter, de påvirker, bliver afsløret.',

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
        { term: 'Hundredvis af opgaver, scoret efter sværhedsgrad', body: 'Leagues, alt synligt. Det er også den eneste form, en stor regnearksimport kan vokse ind i.' },
        { term: 'En uge, der bygger op mod noget', body: 'Leagues med planlagt eller interval-afsløring, så brættet åbner sig over ugen i stedet for på én gang.' },
        { term: 'En aften folk ser med på live', body: 'Dusør. Ét felt, første hold tager det, næste felt med det samme.' },
        { term: 'En individuel konkurrence, ikke en holdkonkurrence', body: 'Stige med et roterende vindue og henfald. Opgaver kommer og går, og ingen kan gemme dem.' },
        { term: 'Et ræs med en målstreg', body: 'Feltræs — en ordnet bane, og den der når længst, vinder.' },
      ],
      outro:
        'Uanset hvad du vælger, er selve felterne det samme job: se [Byg et bræt, der tracker sig selv]({boardGuide}).',
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
      'Gebyrer og udbetalinger er kassérens flade. En kassér kan alt det, en moderator kan, plus dette; en moderator kan markere et gebyr som modtaget, men aldrig afslutte et.',

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
        'Hvor mange underskrifter et gebyr kræver, er en klanindstilling fra nul til fem. Nul findes af en rigtig grund: i en klan hvor kassereren _er_ ejeren, er der ingen anden at skrive under, og “34 gebyrer venter på en anden underskrift” bliver en kø, der aldrig kan tømmes, og permanent det højeste på dashboardet. Ved nul **er** det at markere et gebyr betalt selve underskriften.',
        'Sæt den til én — standarden — hvis I er to. Sæt den til nul, hvis I ærligt talt ikke er, og sæt den højere kun hvis din klan har både folkene og grunden.',
      ],
    },

    pay: {
      title: 'At betale ud',
      body: [
        'Når eventet slutter, laver eventets **Payouts**-fane puljen om til en liste over mennesker. Generér den, og du får én række pr. modtager — ikke pr. hold: et vindende holds præmie deles ligeligt mellem medlemmerne, så udbetalingen bliver en liste med navne og tal frem for et regnestykke ved midnat.',
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
        'medlemslisten: at synkronisere den, tilføje folk, forfremme en gæst',
        'verificering af konti — XP-udfordringen og manuelt gennemsyn',
        'indsendelser og bevis-screenshots',
        'ugentlige konkurrencer og kalenderen',
        'feedback fra medlemmerne',
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
          body: 'det almindelige tilfælde, og det kræver ingenting af dig. At spille kontoen med pluginnet forbundet tilknytter den automatisk, og et stabilt kontofingeraftryk gør, at tilknytningen overlever et navneskift.',
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
        body: 'At verificere en konto siger “den er virkelig deres”. Det gør dem ikke til en del af klanen — klanmedlemskab kommer kun fra en synkronisering af medlemslisten i spillet eller fra en admin, der tilføjer dem i hånden. En, der er verificeret, men ikke står på listen, er en **gæst**: tracket, synlig og ikke medlem. Det er med vilje, og det er dét, der forhindrer nogen i at melde sig ind i din klan ved at skrive et navn.',
      },
    },

    roster: {
      title: 'At holde medlemslisten ærlig',
      body: [
        'Medlemslisten kommer ét sted fra: en admin kører en synkronisering fra klanlisten i spillet med **Anvil**-knappen i titellinjen på klanvinduet (eller **Sync roster** i pluginnets sidepanel). Alt andet — verificeringer, tilknytninger, tilmeldinger — hænger på den.',
        'Så vedligeholdelsesjobbet er lille, men reelt: kør synkroniseringen efter enhver rekrutteringsrunde, forfrem de gæster, der faktisk er kommet med, og kig på de folk, siden har markeret som noget, der skal ses på, frem for at vente på, at de brokker sig.',
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
};

export default da;
